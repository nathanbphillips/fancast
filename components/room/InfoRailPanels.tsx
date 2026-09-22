"use client";

/**
 * Programme room right rail (founder 2026-09-22): Game information (real data
 * only - rows without data do not render, honesty rule) and the host-only
 * Production desk (slots wrap the EXISTING host controls; the desk adds only
 * the bulletin composer and the host-gated RSVP name list).
 */

import { useEffect, useState } from "react";

type GameInfoPanelProps = {
  competition: string | null;
  venue: { name: string; city: string | null } | null;
  kickoffLabel: string;
  referee: string | null;
  attendance: number | null;
  hostLine: string;
};

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="font-mono text-[13px] text-tertiary">{label}</div>
      <div>{children}</div>
    </>
  );
}

export function GameInfoPanel({
  competition,
  venue,
  kickoffLabel,
  referee,
  attendance,
  hostLine,
}: GameInfoPanelProps) {
  return (
    <section>
      <h3 className="display text-[18px] border-b-[3px] border-double border-primary pb-2">
        Game information
      </h3>
      <div className="grid grid-cols-[110px_1fr] gap-x-3.5 gap-y-1.5 text-[14.5px] leading-[1.6] mt-3">
        {competition ? <InfoRow label="Competition">{competition}</InfoRow> : null}
        {venue ? (
          <InfoRow label="Venue">
            {venue.city ? `${venue.name}, ${venue.city}` : venue.name}
          </InfoRow>
        ) : null}
        <InfoRow label="Kick-off">{kickoffLabel}</InfoRow>
        {referee ? <InfoRow label="Referee">{referee}</InfoRow> : null}
        {attendance != null ? (
          <InfoRow label="Attendance">
            <span className="tabular-nums">
              {attendance.toLocaleString("en-GB")}
            </span>
          </InfoRow>
        ) : null}
        <InfoRow label="Host">{hostLine}</InfoRow>
        <InfoRow label="Listening">Free, no account needed</InfoRow>
        <InfoRow label="One rule">Audio only, always</InfoRow>
      </div>
    </section>
  );
}

type ProductionDeskProps = {
  roomId: string;
  /** null slots skip their section entirely - the broadcast/mic/caller
   *  controls stay in the host strip, the desk carries only what's new */
  broadcastControls: React.ReactNode;
  clockControls?: React.ReactNode;
  recordingControls?: React.ReactNode;
  micControls: React.ReactNode;
  callerQueue: React.ReactNode;
  roster?: React.ReactNode;
  pollStatus: string | null;
  onPushBulletin: (body: string) => Promise<boolean>;
  lastBulletin: { body: string; createdAt: string } | null;
  rsvpCount: number | null;
};

function DeskLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[13.5px] tracking-[0.1em] font-semibold mt-4">
      {children}
    </div>
  );
}

const RSVP_NAMES_SHOWN = 12;

export function ProductionDesk({
  roomId,
  broadcastControls,
  clockControls,
  recordingControls,
  micControls,
  callerQueue,
  roster,
  pollStatus,
  onPushBulletin,
  lastBulletin,
  rsvpCount,
}: ProductionDeskProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [rsvps, setRsvps] = useState<{ names: string[]; count: number } | null>(
    null,
  );
  const [rsvpError, setRsvpError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${roomId}/rsvps`)
      .then(async (res) => {
        if (!res.ok) throw new Error("rsvps failed");
        const data = (await res.json()) as { names: string[]; count: number };
        if (!cancelled) setRsvps({ names: data.names ?? [], count: data.count ?? 0 });
      })
      .catch(() => {
        if (!cancelled) setRsvpError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function submitBulletin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const ok = await onPushBulletin(trimmed);
      if (ok) setDraft("");
    } finally {
      setSending(false);
    }
  }

  const rsvpNamesCount = rsvps ? rsvps.count : null;
  const rsvpSuffix =
    rsvpNamesCount != null
      ? ` - ${rsvpNamesCount} going`
      : rsvpCount != null
        ? ` - ${rsvpCount} going`
        : "";

  return (
    <section className="border-2 border-red p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2.5 border-b-[3px] border-double border-red pb-2.5">
        <h3 className="display text-[19px] text-red">The production desk</h3>
        {roster}
      </div>

      {(broadcastControls || clockControls || recordingControls || micControls) && (
        <>
          <DeskLabel>On the air</DeskLabel>
          {broadcastControls ? <div className="mt-2">{broadcastControls}</div> : null}
          {clockControls ? <div className="mt-2">{clockControls}</div> : null}
          {recordingControls ? <div className="mt-2">{recordingControls}</div> : null}
          {micControls ? <div className="mt-2">{micControls}</div> : null}
        </>
      )}

      {callerQueue ? (
        <>
          <DeskLabel>Caller queue</DeskLabel>
          {callerQueue}
        </>
      ) : null}

      <DeskLabel>Production</DeskLabel>
      <form onSubmit={submitBulletin} className="flex mt-2 border-b-2 border-primary">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder="Team news for everyone&hellip;"
          className="flex-1 min-w-0 bg-transparent text-[15px] py-1.5 px-1 outline-none placeholder:italic"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-inverted text-inverted-fg font-mono text-[13.5px] tracking-[0.08em] px-4 py-1.5 whitespace-nowrap cursor-pointer"
        >
          Push bulletin
        </button>
      </form>
      {lastBulletin ? (
        <div className="font-mono text-[12.5px] text-tertiary mt-1.5">
          Pushed &#10003;{" "}
          <span className="fv-normal">
            {lastBulletin.body.length > 60
              ? `${lastBulletin.body.slice(0, 60)}…`
              : lastBulletin.body}
          </span>
        </div>
      ) : null}
      {pollStatus ? (
        <div className="text-[13.5px] leading-[1.6] text-secondary mt-2">
          {pollStatus}
        </div>
      ) : null}

      <DeskLabel>{`RSVP list${rsvpSuffix}`}</DeskLabel>
      {rsvpError ? (
        <div className="italic text-[13.5px] leading-[1.6] text-tertiary mt-1">
          RSVP list unavailable.
        </div>
      ) : rsvps ? (
        rsvps.names.length === 0 ? (
          <div className="italic text-[13.5px] leading-[1.6] text-tertiary mt-1">
            No RSVPs on the books.
          </div>
        ) : (
          <div className="text-[13.5px] leading-[1.6] text-secondary mt-1 fv-normal">
            {rsvps.names.slice(0, RSVP_NAMES_SHOWN).join(", ")}
            {rsvps.names.length > RSVP_NAMES_SHOWN
              ? ` +${rsvps.names.length - RSVP_NAMES_SHOWN}`
              : ""}
          </div>
        )
      ) : null}

      <div className="italic text-[13px] text-tertiary mt-3">
        Moderation lives on each message in the stream.
      </div>
    </section>
  );
}
