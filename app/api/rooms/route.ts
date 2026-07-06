import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import {
  deleteBroadcastRoom,
  purgeRadio,
  startBroadcastEgress,
  stopBroadcastEgress,
} from "@/lib/egress";
import { emitMarker } from "@/lib/markers";
import { config } from "@/lib/config";
import { insertRoomWithHost } from "@/lib/createRoom";
import { fetchSportmonksFixtureRow } from "@/lib/fixtureSearch";
import { rateLimit } from "@/lib/ratelimit";
import { isRoomHost } from "@/lib/roomHosts";
import { flushRows, purgeUnsentRoomReminders } from "@/lib/notify/outbox";
import {
  enqueueGoLive,
  enqueuePreStartReminders,
  enqueueRoomScheduled,
} from "@/lib/notify/producers";
import { triggerProcessing } from "@/lib/recording";
import type { Room, RoomState } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";

// recording processing can run for a few minutes on a long session
export const maxDuration = 300;

/**
 * Room lifecycle (FR-3). Phase 4 transitions:
 *   open_waiting: (no room | scheduled) -> waiting   [commentator]
 *   start:        waiting -> pregame                 [room commentator]
 *   end:          pregame..postgame -> wrapped       [room commentator]
 * Clock-driven transitions (live_1h etc.) arrive with the clock in Phase 6.
 * Every transition persists first, then publishes a `state` event on the
 * control channel; clients unlock/lock without reload.
 */

const bodySchema = z.discriminatedUnion("action", [
  // FR-19.1/19.2: schedule a room against a fixture; exactly two user inputs
  z.object({
    action: z.literal("create"),
    fixtureId: z.number().int(),
    broadcastStart: z.iso.datetime().optional(),
    blurb: z.string().trim().max(140).optional(),
  }),
  // founder 2026-07-06: a room not tied to a listed fixture. The title is the
  // matchup ("Home vs Away"); optionally linked to a real fixture found via
  // /api/fixtures/search; the start can be immediate or in the future.
  z.object({
    action: z.literal("create_custom"),
    title: z.string().trim().min(3).max(90),
    startIso: z.iso.datetime(),
    blurb: z.string().trim().max(140).optional(),
    sportmonksFixtureId: z.number().int().positive().optional(),
  }),
  z.object({ action: z.literal("open_waiting"), fixtureId: z.number().int() }),
  z.object({ action: z.literal("start"), roomId: z.uuid() }),
  z.object({ action: z.literal("end"), roomId: z.uuid() }),
  z.object({
    action: z.literal("set_broadcast_start"),
    roomId: z.uuid(),
    broadcastStart: z.iso.datetime().nullable(),
  }),
  z.object({
    action: z.literal("set_features"),
    roomId: z.uuid(),
    chatOpen: z.boolean().optional(),
    linksOpen: z.boolean().optional(),
  }),
]);

const END_FROM: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

async function publishState(roomId: string, state: RoomState) {
  await publish(channels.control(roomId), "state", {
    state,
    ts: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const service = createServiceClient();

  if (body.action === "create") {
    // FR-19.1: any commentator schedules a room from the fixture picker
    if (
      caller.profile.role !== "commentator" &&
      !isAdmin(caller.userId, caller.profile)
    ) {
      return NextResponse.json(
        { error: "Only commentators can create rooms." },
        { status: 403 },
      );
    }

    const { data: fixture } = await service
      .from("fixtures")
      .select("id, kickoff_utc, home_team, away_team")
      .eq("id", body.fixtureId)
      .maybeSingle();
    if (!fixture) {
      return NextResponse.json({ error: "Fixture not found." }, { status: 404 });
    }
    if (new Date(fixture.kickoff_utc).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "That game has already kicked off." },
        { status: 400 },
      );
    }

    // one room per fixture per commentator (the unique constraint backs this;
    // check first for the friendly message)
    const { data: existing } = await service
      .from("rooms")
      .select("id, state, slug")
      .eq("fixture_id", fixture.id)
      .eq("commentator_id", caller.userId)
      .maybeSingle();
    if (existing && existing.state !== "canceled") {
      return NextResponse.json(
        { error: "You already have a room for this fixture." },
        { status: 409 },
      );
    }

    // default broadcast start: kickoff minus 15 minutes (FR-19.2)
    const broadcastStart =
      body.broadcastStart ??
      new Date(
        new Date(fixture.kickoff_utc).getTime() - 15 * 60 * 1000,
      ).toISOString();
    if (new Date(broadcastStart).getTime() < Date.now() - 60_000) {
      return NextResponse.json(
        { error: "That start time is in the past. Pick a future time." },
        { status: 400 },
      );
    }

    // FR-21: notify the host's followers a room was scheduled (immediate) and
    // schedule the 15-min pre-start reminder. Runs after the response.
    const notifyScheduled = (r: Room) => {
      const payload = {
        matchLabel: `${fixture.home_team} vs ${fixture.away_team}`,
        roomSlug: r.slug,
        hostName: caller.profile.username,
      };
      after(async () => {
        const svc = createServiceClient();
        const ids = await enqueueRoomScheduled(svc, {
          roomId: r.id,
          hostUserId: caller.userId,
          payload,
        });
        await flushRows(svc, ids);
        await enqueuePreStartReminders(svc, {
          roomId: r.id,
          hostUserId: caller.userId,
          broadcastStart: r.broadcast_start ?? broadcastStart,
          payload,
        });
      });
    };

    if (existing) {
      // canceled room for this fixture: revive it rather than fight the
      // unique(fixture_id, commentator_id) constraint. Clear subscription_id:
      // a manual re-create is host-authored, so a later unsubscribe must not
      // sweep it away (adversarial review 2026-07-03).
      const { data: revived, error } = await service
        .from("rooms")
        .update({
          state: "scheduled",
          broadcast_start: broadcastStart,
          blurb: body.blurb || null,
          postponed: false,
          subscription_id: null,
        })
        .eq("id", existing.id)
        .select()
        .single<Room>();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await service.from("room_hosts").upsert(
        {
          room_id: existing.id,
          user_id: caller.userId,
          status: "accepted",
          responded_at: new Date().toISOString(),
        },
        { onConflict: "room_id,user_id" },
      );
      if (revived) notifyScheduled(revived);
      return NextResponse.json({ room: revived }, { status: 201 });
    }

    const { room, error } = await insertRoomWithHost(service, {
      fixtureId: fixture.id,
      creatorId: caller.userId,
      creatorUsername: caller.profile.username,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      kickoffUtc: fixture.kickoff_utc,
      state: "scheduled",
      broadcastStart,
      blurb: body.blurb || null,
    });
    if (error || !room) {
      return NextResponse.json(
        { error: error ?? "Couldn't create the room." },
        { status: 500 },
      );
    }
    notifyScheduled(room);
    return NextResponse.json({ room }, { status: 201 });
  }

  if (body.action === "create_custom") {
    // same gate as create (founder 2026-07-06: rooms without a listed fixture)
    if (
      caller.profile.role !== "commentator" &&
      !isAdmin(caller.userId, caller.profile)
    ) {
      return NextResponse.json(
        { error: "Only commentators can create rooms." },
        { status: 403 },
      );
    }

    // flood control: unlike the picker create (bounded by unique(fixture_id,
    // commentator_id) over listed fixtures), an unlinked custom room mints a
    // fresh synthetic fixture each call, so bound it explicitly (review
    // 2026-07-06). Rate limit + a generous active-room backstop that never hits
    // a legit season-hoster.
    if (!rateLimit(`customroom:${caller.userId}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "That's a lot of rooms at once. Give it a minute and try again." },
        { status: 429 },
      );
    }
    {
      const { count: activeRooms } = await service
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("commentator_id", caller.userId)
        .in("state", ["scheduled", "waiting"]);
      if ((activeRooms ?? 0) >= 100) {
        return NextResponse.json(
          {
            error:
              "You have a lot of upcoming rooms already. Open, host, or cancel some before adding more.",
          },
          { status: 429 },
        );
      }
    }

    const startMs = new Date(body.startIso).getTime();
    if (startMs < Date.now() - 60_000) {
      return NextResponse.json(
        { error: "That start time is in the past. Pick now or a future time." },
        { status: 400 },
      );
    }
    if (startMs > Date.now() + 180 * 86_400_000) {
      return NextResponse.json(
        { error: "Pick a start within the next six months." },
        { status: 400 },
      );
    }

    // an immediate room opens its waiting room right away; a future one is
    // scheduled exactly like a picker room
    const immediate = startMs <= Date.now() + 10 * 60_000;
    const nowIso = new Date().toISOString();

    // resolve the fixture this room hangs off (a linked game, an existing
    // fixture we dedupe onto, or a fresh synthetic one) + the display matchup
    let fixtureId = 0;
    let home = "";
    let away = "";
    let kickoffUtc = body.startIso;
    let mintedFixtureId: number | null = null; // set only when WE inserted it (rollback)

    if (body.sportmonksFixtureId != null) {
      // linked to a suggested game: fetch server-side (never trust client
      // names/kickoffs). Insert-if-absent so we NEVER overwrite a fixture other
      // hosts' rooms depend on (review 2026-07-06); an existing row already
      // carries the sportmonks id, so stats keep working.
      let row: Awaited<ReturnType<typeof fetchSportmonksFixtureRow>> = null;
      try {
        row = await fetchSportmonksFixtureRow(body.sportmonksFixtureId);
      } catch {
        row = null;
      }
      if (!row) {
        return NextResponse.json(
          {
            error:
              "We couldn't load that match from the data feed. Try again, or create the room without linking it.",
          },
          { status: 404 },
        );
      }
      if (new Date(row.kickoff_utc).getTime() < Date.now() - 3 * 3_600_000) {
        return NextResponse.json(
          { error: "That match has already finished." },
          { status: 400 },
        );
      }
      fixtureId = row.id;
      home = row.home_team;
      away = row.away_team;
      kickoffUtc = row.kickoff_utc;
      const { data: existingFx } = await service
        .from("fixtures")
        .select("id")
        .eq("id", fixtureId)
        .maybeSingle();
      if (!existingFx) {
        const { error: insErr } = await service.from("fixtures").insert(row);
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }
    } else {
      // unlinked: the title IS the matchup. "Home vs Away" keeps the slug,
      // scoreboard, and daily auto-matcher working.
      const parts = body.title
        .split(/\s+vs?\.?\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length !== 2 || parts[0].length > 40 || parts[1].length > 40) {
        return NextResponse.json(
          {
            error:
              'Give the room a title like "Arsenal vs Chelsea" (Home vs Away).',
          },
          { status: 400 },
        );
      }
      home = parts[0];
      away = parts[1];
      kickoffUtc = body.startIso;

      // dedupe: if a fixture for this matchup already exists near this time (a
      // covered game the host didn't link, or another host's custom room),
      // reuse it instead of duplicating the public listing (review 2026-07-06)
      const { data: dup } = await service
        .from("fixtures")
        .select("id, home_team, away_team, kickoff_utc")
        .ilike("home_team", home)
        .ilike("away_team", away)
        .gte("kickoff_utc", new Date(startMs - 24 * 3_600_000).toISOString())
        .lte("kickoff_utc", new Date(startMs + 24 * 3_600_000).toISOString())
        .order("kickoff_utc", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (dup) {
        fixtureId = dup.id;
        home = dup.home_team;
        away = dup.away_team;
        kickoffUtc = dup.kickoff_utc;
      } else {
        // synthetic id, retried on the rare same-millisecond PK collision
        // (concurrent creates); wall-clock is not a safe PK on its own
        let inserted = false;
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const candidate =
            Date.now() * 1000 + Math.floor(Math.random() * 1000);
          const { error: fxErr } = await service.from("fixtures").insert({
            id: candidate,
            source: "admin",
            competition: "Match",
            home_team: home,
            away_team: away,
            season: config.season,
            kickoff_utc: kickoffUtc,
          });
          if (!fxErr) {
            fixtureId = candidate;
            mintedFixtureId = candidate;
            inserted = true;
          } else if (fxErr.code !== "23505") {
            return NextResponse.json(
              { error: "Couldn't set up the room. Try again." },
              { status: 500 },
            );
          }
        }
        if (!inserted) {
          return NextResponse.json(
            { error: "Couldn't set up the room. Try again." },
            { status: 500 },
          );
        }
      }
    }

    // notifications mirror the picker flows: scheduled -> room_scheduled +
    // pre-start reminder; immediate (straight into waiting) -> go_live
    const notifyCustom = (r: Room) => {
      const payload = {
        matchLabel: `${home} vs ${away}`,
        roomSlug: r.slug,
        hostName: caller.profile.username,
      };
      after(async () => {
        const svc = createServiceClient();
        if (immediate) {
          const ids = await enqueueGoLive(svc, { roomId: r.id, payload });
          await flushRows(svc, ids);
        } else {
          const ids = await enqueueRoomScheduled(svc, {
            roomId: r.id,
            hostUserId: caller.userId,
            payload,
          });
          await flushRows(svc, ids);
          await enqueuePreStartReminders(svc, {
            roomId: r.id,
            hostUserId: caller.userId,
            broadcastStart: body.startIso,
            payload,
          });
        }
      });
    };

    // one room per fixture per commentator (shared with the picker rule): a
    // canceled one revives, an active one is a friendly 409
    const { data: existing } = await service
      .from("rooms")
      .select("id, state")
      .eq("fixture_id", fixtureId)
      .eq("commentator_id", caller.userId)
      .maybeSingle();
    if (existing && existing.state !== "canceled") {
      return NextResponse.json(
        { error: "You already have a room for this match." },
        { status: 409 },
      );
    }
    if (existing) {
      const { data: revived, error } = await service
        .from("rooms")
        .update({
          state: immediate ? "waiting" : "scheduled",
          broadcast_start: body.startIso,
          blurb: body.blurb || null,
          postponed: false,
          subscription_id: null,
          opened_at: immediate ? nowIso : null,
        })
        .eq("id", existing.id)
        .select()
        .single<Room>();
      if (error || !revived) {
        return NextResponse.json(
          { error: error?.message ?? "Couldn't create the room." },
          { status: 500 },
        );
      }
      await service.from("room_hosts").upsert(
        {
          room_id: existing.id,
          user_id: caller.userId,
          status: "accepted",
          responded_at: nowIso,
        },
        { onConflict: "room_id,user_id" },
      );
      // the pre-cancel schedule may have left unsent reminders; the cancel path
      // purges them, but purge again so a revive with a new start is clean
      await purgeUnsentRoomReminders(service, existing.id);
      notifyCustom(revived);
      return NextResponse.json({ room: revived }, { status: 201 });
    }

    const { room, error } = await insertRoomWithHost(service, {
      fixtureId,
      creatorId: caller.userId,
      creatorUsername: caller.profile.username,
      homeTeam: home,
      awayTeam: away,
      kickoffUtc,
      state: immediate ? "waiting" : "scheduled",
      broadcastStart: body.startIso,
      blurb: body.blurb || null,
      openedAt: immediate ? nowIso : null,
    });
    if (error || !room) {
      if (mintedFixtureId != null) {
        await service.from("fixtures").delete().eq("id", mintedFixtureId); // no orphan
      }
      return NextResponse.json(
        { error: error ?? "Couldn't create the room." },
        { status: 500 },
      );
    }
    notifyCustom(room);
    return NextResponse.json({ room }, { status: 201 });
  }

  if (body.action === "open_waiting") {
    if (
      caller.profile.role !== "commentator" &&
      !isAdmin(caller.userId, caller.profile)
    ) {
      return NextResponse.json(
        { error: "Only commentators can open a waiting room." },
        { status: 403 },
      );
    }

    const { data: fixture } = await service
      .from("fixtures")
      .select("id, kickoff_utc, home_team, away_team")
      .eq("id", body.fixtureId)
      .maybeSingle();
    if (!fixture) {
      return NextResponse.json({ error: "Fixture not found." }, { status: 404 });
    }

    const { data: existing } = await service
      .from("rooms")
      .select("*")
      .eq("fixture_id", body.fixtureId)
      .eq("commentator_id", caller.userId)
      .maybeSingle<Room>();

    if (existing && existing.state === "wrapped") {
      // a wrapped room is one-way and can't be reopened — say so clearly
      // instead of silently handing back the dead room (L-2, audit)
      return NextResponse.json(
        { error: "That broadcast has ended. Open a room for the next fixture." },
        { status: 409 },
      );
    }
    if (
      existing &&
      existing.state !== "scheduled" &&
      existing.state !== "canceled"
    ) {
      // already open — just go there (a canceled room instead revives below)
      return NextResponse.json({ room: existing });
    }

    const now = new Date().toISOString();
    let room: Room;
    if (existing) {
      const { data: updated, error } = await service
        .from("rooms")
        .update({ state: "waiting", opened_at: now })
        .eq("id", existing.id)
        .select()
        .single<Room>();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      room = updated;
    } else {
      // creating on the fly: same path as `create` (slug + host row), just
      // straight into waiting
      const { room: created, error } = await insertRoomWithHost(service, {
        fixtureId: fixture.id,
        creatorId: caller.userId,
        creatorUsername: caller.profile.username,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        kickoffUtc: fixture.kickoff_utc,
        state: "waiting",
        openedAt: now,
      });
      if (error || !created) {
        return NextResponse.json(
          { error: error ?? "Couldn't open the room." },
          { status: 500 },
        );
      }
      room = created;
    }

    await publishState(room.id, "waiting");

    // FR-21 go_live: the room entered waiting; notify the hosts' followers
    // (keeps FR-1.4). Deduped across co-hosts by the outbox key.
    const goLiveRoom = room;
    after(async () => {
      const svc = createServiceClient();
      const ids = await enqueueGoLive(svc, {
        roomId: goLiveRoom.id,
        payload: {
          matchLabel: `${fixture.home_team} vs ${fixture.away_team}`,
          roomSlug: goLiveRoom.slug,
          hostName: caller.profile.username,
        },
      });
      await flushRows(svc, ids);
    });

    return NextResponse.json({ room }, { status: 201 });
  }

  // start / end act on an existing room owned by the caller
  const { data: room } = await service
    .from("rooms")
    .select("*")
    .eq("id", body.roomId)
    .maybeSingle<Room>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  // FR-25.2: any accepted host (equal hosts, no primary) can run the room
  if (
    !(await isRoomHost(service, caller.userId, room.id)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json(
      { error: "Only the room's hosts can do that." },
      { status: 403 },
    );
  }

  if (body.action === "set_broadcast_start") {
    // a countdown target in the past is always a mistake (60s grace)
    if (
      body.broadcastStart !== null &&
      new Date(body.broadcastStart).getTime() < Date.now() - 60_000
    ) {
      return NextResponse.json(
        { error: "That start time is in the past — pick a future time." },
        { status: 400 },
      );
    }
    const { data: updated, error } = await service
      .from("rooms")
      .update({ broadcast_start: body.broadcastStart })
      .eq("id", room.id)
      .select()
      .single<Room>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await publish(channels.control(room.id), "broadcast_start", {
      broadcastStart: body.broadcastStart,
    });
    return NextResponse.json({ room: updated });
  }

  if (body.action === "set_features") {
    const update: { chat_open?: boolean; links_open?: boolean } = {};
    if (body.chatOpen !== undefined) update.chat_open = body.chatOpen;
    if (body.linksOpen !== undefined) update.links_open = body.linksOpen;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const { data: updated, error } = await service
      .from("rooms")
      .update(update)
      .eq("id", room.id)
      .select()
      .single<Room>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await publish(channels.control(room.id), "features", {
      chatOpen: updated.chat_open,
      linksOpen: updated.links_open,
    });
    return NextResponse.json({ room: updated });
  }

  if (body.action === "start") {
    if (room.state !== "waiting") {
      return NextResponse.json(
        { error: `Can't start from ${room.state}.` },
        { status: 409 },
      );
    }
    const startedAt = new Date().toISOString();
    // atomic from-state claim (M-5): only the request that actually flips
    // waiting->pregame proceeds, so a double-tapped/retried start can't launch
    // two egresses and orphan a recording.
    const { data: updated, error } = await service
      .from("rooms")
      .update({ state: "pregame", started_at: startedAt })
      .eq("id", room.id)
      .eq("state", "waiting")
      .select()
      .maybeSingle<Room>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      // lost the race — another start already claimed it
      return NextResponse.json(
        { error: `Can't start from ${room.state}.` },
        { status: 409 },
      );
    }
    await publishState(room.id, "pregame");

    // recording starts at Start Broadcast (FR-3.3), opening the outermost
    // segment span (FR-13.2)
    await emitMarker(service, room.id, "broadcast_start", startedAt, "auto");

    // one egress, two outputs: radio HLS + the OGG recording. Never let
    // an egress problem block the show itself.
    try {
      const egress = await startBroadcastEgress(service, room.id);
      if (egress) {
        await service
          .from("rooms")
          .update({ hls_url: egress.hlsUrl, hls_egress_id: egress.egressId })
          .eq("id", room.id);
        await service.from("recordings").upsert(
          {
            room_id: room.id,
            egress_id: egress.egressId,
            source_path: egress.sourcePath,
            started_at: startedAt,
            status: "recording",
          },
          { onConflict: "room_id" },
        );
        await publish(channels.control(room.id), "radio", {
          url: egress.hlsUrl,
        });
      }
    } catch (err) {
      console.error("broadcast egress start failed:", err);
    }
    return NextResponse.json({ room: updated });
  }

  // end
  if (!END_FROM.includes(room.state)) {
    return NextResponse.json(
      { error: `Can't end from ${room.state}.` },
      { status: 409 },
    );
  }
  const endedAt = new Date().toISOString();
  // atomic from-state claim (M-5): a double-tapped End can't run stopEgress /
  // purge / triggerProcessing twice.
  const { data: updated, error } = await service
    .from("rooms")
    .update({ state: "wrapped", ended_at: endedAt })
    .eq("id", room.id)
    .in("state", END_FROM)
    .select()
    .maybeSingle<Room>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: `Can't end from ${room.state}.` },
      { status: 409 },
    );
  }
  await publishState(room.id, "wrapped");

  // close the outermost span (FR-13.2), stop the egress, kick off cutting
  await emitMarker(service, room.id, "broadcast_end", endedAt, "auto");
  if (room.hls_egress_id) {
    await stopBroadcastEgress(room.hls_egress_id);
  }
  // radio is live-only; purge the public HLS copy so a byte-identical
  // broadcast can't be re-fetched anonymously after the show (the private
  // recording is the only durable copy — FR-14.2)
  await purgeRadio(service, room.id);

  const { data: rec } = await service
    .from("recordings")
    .select("id")
    .eq("room_id", room.id)
    .maybeSingle();
  if (rec) {
    // ended_at only — processRecording atomically claims status (so it can
    // serialize concurrent runs and reclaim a stale one)
    await service
      .from("recordings")
      .update({ ended_at: endedAt })
      .eq("id", rec.id);
    // process asynchronously — the panel polls status (FR-13.5). This also
    // deletes the LiveKit room (M-7) once egress is terminal, so the recording
    // isn't aborted by tearing the room down too early.
    triggerProcessing(room.id);
  } else {
    // no recording to protect (storage unconfigured / radio-only): cut the
    // LiveKit room loose now so no lingering listener keeps the audio sub (M-7)
    await deleteBroadcastRoom(room.id);
  }
  return NextResponse.json({ room: updated });
}
