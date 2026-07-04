import type { SupabaseClient } from "@supabase/supabase-js";
import {
  channelDefault,
  type NotificationChannel,
  type NotificationType,
} from "@/lib/notify/types";
import {
  emailHtml,
  renderNotification,
  type NotificationPayload,
} from "@/lib/notify/render";
import { sendEmail } from "@/lib/notify/email";
import { sendPush } from "@/lib/notify/push";
import { unsubscribeToken } from "@/lib/notify/tokens";
import { siteUrl } from "@/lib/notify/urls";

/**
 * The notification outbox (FR-21.4). Every notification is enqueued here first
 * (DB is source of truth). Immediate types are flushed inline after the
 * response (send-after-write); reminders sit until due_at and drain from
 * high-traffic routes + the daily cron. Dedupe is enforced by the partial
 * unique index on dedupe_key (where unsent): a follower of both co-hosts, or
 * an RSVP holder who also follows the host, gets one row per (recipient, room,
 * type, channel), never two.
 */

type EnqueueOpts = {
  type: NotificationType;
  recipientIds: string[];
  roomId?: string | null;
  actorId?: string | null;
  dueAt?: Date;
  payload: NotificationPayload;
  /** overrides the room segment of the dedupe key for batched events
   *  (e.g. a season summary keyed by subscription, not room) */
  dedupeScope?: string;
};

const CHANNELS: NotificationChannel[] = ["email", "push"];

/** Resolve each recipient's per-channel enablement for a type (stored pref or
 *  registry default). One query for the whole set. */
async function resolvePrefs(
  service: SupabaseClient,
  recipientIds: string[],
  type: NotificationType,
): Promise<Map<string, { email: boolean; push: boolean }>> {
  const result = new Map<string, { email: boolean; push: boolean }>();
  for (const id of recipientIds) {
    result.set(id, {
      email: channelDefault(type, "email"),
      push: channelDefault(type, "push"),
    });
  }
  if (recipientIds.length === 0) return result;
  const { data } = await service
    .from("notification_prefs")
    .select("user_id, email_enabled, push_enabled")
    .eq("type", type)
    .in("user_id", recipientIds);
  for (const row of data ?? []) {
    result.set(row.user_id as string, {
      email: row.email_enabled as boolean,
      push: row.push_enabled as boolean,
    });
  }
  return result;
}

function dedupeKey(
  recipientId: string,
  scope: string,
  type: NotificationType,
  channel: NotificationChannel,
): string {
  return `${recipientId}:${scope}:${type}:${channel}`;
}

/**
 * Enqueue a notification for one or many recipients. Returns the ids of rows
 * actually inserted (deduped rows are skipped). Does NOT send: call
 * flushRows() for immediate types, or let the drainer pick up reminders.
 */
export async function enqueue(
  service: SupabaseClient,
  opts: EnqueueOpts,
): Promise<string[]> {
  const prefs = await resolvePrefs(service, opts.recipientIds, opts.type);
  const scope = opts.dedupeScope ?? opts.roomId ?? "none";
  const dueAt = (opts.dueAt ?? new Date()).toISOString();

  const rows: {
    recipient_id: string;
    type: string;
    channel: NotificationChannel;
    room_id: string | null;
    actor_id: string | null;
    due_at: string;
    dedupe_key: string;
    payload: NotificationPayload;
  }[] = [];
  for (const recipientId of opts.recipientIds) {
    const pref = prefs.get(recipientId)!;
    for (const channel of CHANNELS) {
      if (channel === "email" && !pref.email) continue;
      if (channel === "push" && !pref.push) continue;
      rows.push({
        recipient_id: recipientId,
        type: opts.type,
        channel,
        room_id: opts.roomId ?? null,
        actor_id: opts.actorId ?? null,
        due_at: dueAt,
        dedupe_key: dedupeKey(recipientId, scope, opts.type, channel),
        payload: opts.payload,
      });
    }
  }
  if (rows.length === 0) return [];

  // pre-filter against unsent rows with the same keys, then insert the rest;
  // the partial unique index is the hard backstop for the tiny race
  const keys = rows.map((r) => r.dedupe_key);
  const { data: existing } = await service
    .from("notifications_outbox")
    .select("dedupe_key")
    .is("sent_at", null)
    .in("dedupe_key", keys);
  const taken = new Set((existing ?? []).map((r) => r.dedupe_key as string));
  const fresh = rows.filter((r) => !taken.has(r.dedupe_key));
  if (fresh.length === 0) return [];

  const { data: inserted, error } = await service
    .from("notifications_outbox")
    .insert(fresh)
    .select("id");
  if (error) {
    // a concurrent enqueue won the race on some key: retry per-row, swallow dups
    const ids: string[] = [];
    for (const row of fresh) {
      const { data, error: e } = await service
        .from("notifications_outbox")
        .insert(row)
        .select("id")
        .maybeSingle();
      if (!e && data) ids.push(data.id as string);
    }
    return ids;
  }
  return (inserted ?? []).map((r) => r.id as string);
}

/**
 * Reschedule a pending reminder (FR-21.4): when a room moves, the reminder's
 * due_at recomputes. Updates the unsent row for this key if present.
 */
export async function reschedule(
  service: SupabaseClient,
  recipientId: string,
  roomId: string,
  type: NotificationType,
  dueAt: Date,
): Promise<void> {
  for (const channel of CHANNELS) {
    await service
      .from("notifications_outbox")
      .update({ due_at: dueAt.toISOString() })
      .eq("dedupe_key", dedupeKey(recipientId, roomId, type, channel))
      .is("sent_at", null);
  }
}

type OutboxRow = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  payload: NotificationPayload;
  attempts: number;
};

/** Send one outbox row: render, dispatch to the channel, mark sent or failed. */
async function sendRow(service: SupabaseClient, row: OutboxRow): Promise<boolean> {
  const rendered = renderNotification(row.type, row.payload);

  if (row.channel === "email") {
    const { data: userRes } = await service.auth.admin.getUserById(
      row.recipient_id,
    );
    const to = userRes?.user?.email;
    if (!to) {
      await markFailed(service, row, "no email on record");
      return false;
    }
    const token = unsubscribeToken(row.recipient_id, row.type);
    const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?token=${token}`;
    const res = await sendEmail({
      to,
      subject: rendered.subject,
      html: emailHtml(rendered, unsubscribeUrl),
      text: `${rendered.body}\n\n${rendered.url}\n\nUnsubscribe: ${unsubscribeUrl}`,
    });
    if (!res.ok) {
      await markFailed(service, row, res.error);
      return false;
    }
    await markSent(service, row);
    return true;
  }

  // push: fan out to the recipient's live device subscriptions
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", row.recipient_id)
    .is("revoked_at", null);
  if (!subs || subs.length === 0) {
    // nothing to push to; mark sent so it doesn't retry forever
    await markSent(service, row);
    return true;
  }
  for (const sub of subs) {
    const res = await sendPush(sub, {
      title: rendered.title,
      body: rendered.body,
      url: rendered.url,
    });
    if (!res.ok && res.gone) {
      await service
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", sub.id);
    }
  }
  await markSent(service, row);
  return true;
}

async function markSent(service: SupabaseClient, row: OutboxRow) {
  await service
    .from("notifications_outbox")
    .update({ sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
    .eq("id", row.id);
}

async function markFailed(service: SupabaseClient, row: OutboxRow, error: string) {
  await service
    .from("notifications_outbox")
    .update({ attempts: row.attempts + 1, last_error: error.slice(0, 300) })
    .eq("id", row.id);
}

/** Flush specific rows now (immediate producers call this inside after()). */
export async function flushRows(
  service: SupabaseClient,
  rowIds: string[],
): Promise<void> {
  if (rowIds.length === 0) return;
  const { data: rows } = await service
    .from("notifications_outbox")
    .select("id, recipient_id, type, channel, payload, attempts")
    .in("id", rowIds)
    .is("sent_at", null);
  for (const row of (rows ?? []) as OutboxRow[]) {
    await sendRow(service, row);
  }
}

/**
 * Drain due, unsent rows (FR-21.4). Called opportunistically from high-traffic
 * routes and by the daily cron. Retries stop after MAX_ATTEMPTS so a
 * permanently bad row doesn't churn forever.
 */
const MAX_ATTEMPTS = 5;
export async function drainDue(
  service: SupabaseClient,
  limit = 50,
): Promise<{ sent: number; failed: number }> {
  const { data: rows } = await service
    .from("notifications_outbox")
    .select("id, recipient_id, type, channel, payload, attempts")
    .is("sent_at", null)
    .lte("due_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("due_at", { ascending: true })
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const row of (rows ?? []) as OutboxRow[]) {
    const ok = await sendRow(service, row);
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

/** Convenience for immediate producers: enqueue then flush inside one call. */
export async function enqueueAndFlush(
  service: SupabaseClient,
  opts: EnqueueOpts,
): Promise<void> {
  const ids = await enqueue(service, opts);
  await flushRows(service, ids);
}

/**
 * Opportunistic drain from high-traffic routes (FR-21.4, Hobby ruling). A
 * per-instance timestamp throttle keeps it to at most once per interval so a
 * busy route doesn't drain on every request; the daily cron is the backstop.
 * Safe to fire-and-forget inside after().
 */
let lastOpportunisticDrain = 0;
const OPPORTUNISTIC_INTERVAL_MS = 60_000;
export async function maybeOpportunisticDrain(
  service: SupabaseClient,
): Promise<void> {
  const now = Date.now();
  if (now - lastOpportunisticDrain < OPPORTUNISTIC_INTERVAL_MS) return;
  lastOpportunisticDrain = now;
  try {
    await drainDue(service, 25);
  } catch (err) {
    console.error("opportunistic drain failed:", err);
  }
}
