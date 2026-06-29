"use client";

import { useMemo, useState } from "react";
import type { FixtureStats } from "@/lib/stats";
import type { PlayerStatus, StatOverrides } from "@/lib/statOverrides";

/**
 * Commentator-only editor for the Info + Line-ups panels (Phase 11). Functional-
 * first (the full visual redesign comes later). Produces a sparse StatOverrides
 * patch and hands it to onSave, which persists + broadcasts it. Inputs pre-fill
 * from the currently-shown (already-merged) values; blank Info fields mean "use
 * Sportmonks". Saving freezes only what the commentator actually sets.
 */

const inputCls =
  "w-full rounded-md border border-line bg-canvas px-2 py-1 text-sm text-primary placeholder:text-secondary";
const btnCls = "rounded-md px-3 py-1.5 text-sm font-semibold";

type NewsRow = { name: string; reason: string };

function InfoEditor({
  data,
  overrides,
  onSave,
  onClose,
  saving,
}: {
  data: FixtureStats;
  overrides: StatOverrides | null;
  onSave: (next: StatOverrides) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const info = data.info;
  const oInfo = overrides?.info;
  const [venue, setVenue] = useState(oInfo?.venue ?? "");
  const [referee, setReferee] = useState(oInfo?.referee ?? "");
  const [weather, setWeather] = useState(oInfo?.weather ?? "");
  const [home, setHome] = useState<NewsRow[]>(info?.teamNews.home ?? []);
  const [away, setAway] = useState<NewsRow[]>(info?.teamNews.away ?? []);

  const venuePh = info?.venue
    ? info.venue.city
      ? `${info.venue.name}, ${info.venue.city}`
      : info.venue.name
    : "Venue";
  const refPh = info?.referees[0]?.name ?? "Referee";
  const weatherPh = info?.weather?.description ?? "Weather";

  const NewsList = ({
    label,
    rows,
    setRows,
  }: {
    label: string;
    rows: NewsRow[];
    setRows: (r: NewsRow[]) => void;
  }) => (
    <div>
      <p className="mb-1 text-xs font-semibold text-secondary">{label} — absences</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1">
            <input
              className={inputCls}
              placeholder="Player"
              value={r.name}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <input
              className={inputCls}
              placeholder="Reason"
              value={r.reason}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))
              }
            />
            <button
              type="button"
              aria-label="Remove"
              className="shrink-0 rounded-md border border-line px-2 text-secondary"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-1 text-xs font-semibold text-gold"
        onClick={() => setRows([...rows, { name: "", reason: "" }])}
      >
        + Add absence
      </button>
    </div>
  );

  function save() {
    const clean = (rows: NewsRow[]) =>
      rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), reason: r.reason.trim() }));
    const nextInfo: NonNullable<StatOverrides["info"]> = {
      teamNews: { home: clean(home), away: clean(away) },
    };
    if (venue.trim()) nextInfo.venue = venue.trim();
    if (referee.trim()) nextInfo.referee = referee.trim();
    if (weather.trim()) nextInfo.weather = weather.trim();
    onSave({ ...overrides, info: nextInfo });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold text-secondary">Venue</span>
        <input className={inputCls} placeholder={venuePh} value={venue} onChange={(e) => setVenue(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-secondary">Referee</span>
        <input className={inputCls} placeholder={refPh} value={referee} onChange={(e) => setReferee(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-secondary">Weather</span>
        <input className={inputCls} placeholder={weatherPh} value={weather} onChange={(e) => setWeather(e.target.value)} />
      </label>
      <NewsList label={data.home.name} rows={home} setRows={setHome} />
      <NewsList label={data.away.name} rows={away} setRows={setAway} />
      <EditorActions onSave={save} onClose={onClose} saving={saving} />
    </div>
  );
}

type Edit = { name: string; jersey: string; status: PlayerStatus };

function LineupEditor({
  data,
  overrides,
  onSave,
  onClose,
  saving,
}: {
  data: FixtureStats;
  overrides: StatOverrides | null;
  onSave: (next: StatOverrides) => void;
  onClose: () => void;
  saving: boolean;
}) {
  // shown (merged) players with their current status; id < 0 = commentator-added
  const shown = useMemo(() => {
    const rows: { id: number; side: "home" | "away"; name: string; jersey: string; status: PlayerStatus }[] = [];
    for (const side of ["home", "away"] as const) {
      const s = data.lineups[side];
      if (!s) continue;
      for (const p of s.starters)
        rows.push({ id: p.playerId, side, name: p.name, jersey: p.jersey?.toString() ?? "", status: "pitch" });
      for (const p of s.bench)
        rows.push({ id: p.playerId, side, name: p.name, jersey: p.jersey?.toString() ?? "", status: "bench" });
    }
    return rows;
  }, [data]);

  const [edits, setEdits] = useState<Record<number, Edit>>(() => {
    const init: Record<number, Edit> = {};
    for (const r of shown) init[r.id] = { name: r.name, jersey: r.jersey, status: r.status };
    return init;
  });
  const [added, setAdded] = useState<{ id: number; side: "home" | "away"; name: string; jersey: string; status: "pitch" | "bench" }[]>([]);

  const setEdit = (id: number, patch: Partial<Edit>) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  function save() {
    const players: NonNullable<StatOverrides["players"]> = { ...(overrides?.players ?? {}) };
    for (const r of shown) {
      if (r.id < 0) continue; // added players are saved via `added`, not players-overrides
      const e = edits[r.id];
      if (!e) continue;
      const patch: { name?: string; jersey?: number | null; status?: PlayerStatus } = {};
      if (e.name.trim() && e.name.trim() !== r.name) patch.name = e.name.trim();
      const jerseyNum = e.jersey.trim() === "" ? null : Number(e.jersey);
      const shownJersey = r.jersey === "" ? null : Number(r.jersey);
      if (Number.isFinite(jerseyNum ?? NaN) || e.jersey.trim() === "") {
        if (jerseyNum !== shownJersey) patch.jersey = jerseyNum;
      }
      if (e.status !== r.status) patch.status = e.status;
      if (Object.keys(patch).length) players[String(r.id)] = { ...players[String(r.id)], ...patch };
    }
    // existing added (id<0) that the commentator still wants, with any edits applied
    const keepAdded = (overrides?.added ?? []).map((a) => {
      const e = edits[a.id];
      return e
        ? { ...a, name: e.name.trim() || a.name, jersey: e.jersey.trim() === "" ? null : Number(e.jersey), status: (e.status === "out" ? "bench" : e.status) as "pitch" | "bench" }
        : a;
    });
    const newAdded = added
      .filter((a) => a.name.trim())
      .map((a) => ({ id: a.id, side: a.side, name: a.name.trim(), jersey: a.jersey.trim() === "" ? null : Number(a.jersey), status: a.status }));
    onSave({ ...overrides, players, added: [...keepAdded, ...newAdded] });
  }

  const Row = ({ r }: { r: (typeof shown)[number] }) => {
    const e = edits[r.id];
    return (
      <div className="flex items-center gap-1">
        <input
          className={`${inputCls} w-12 text-center`}
          inputMode="numeric"
          value={e.jersey}
          onChange={(ev) => setEdit(r.id, { jersey: ev.target.value.replace(/\D/g, "").slice(0, 2) })}
        />
        <input className={inputCls} value={e.name} onChange={(ev) => setEdit(r.id, { name: ev.target.value })} />
        <select
          className="shrink-0 rounded-md border border-line bg-canvas px-1 py-1 text-xs"
          value={e.status}
          onChange={(ev) => setEdit(r.id, { status: ev.target.value as PlayerStatus })}
        >
          <option value="pitch">On pitch</option>
          <option value="bench">Bench</option>
          <option value="out">Out</option>
        </select>
      </div>
    );
  };

  const SideBlock = ({ side }: { side: "home" | "away" }) => {
    const name = side === "home" ? data.home.name : data.away.name;
    const minId = Math.min(-1, ...shown.filter((r) => r.id < 0).map((r) => r.id), ...added.map((a) => a.id));
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-primary">{name}</p>
        <div className="space-y-1">
          {shown.filter((r) => r.side === side).map((r) => (
            <Row key={r.id} r={r} />
          ))}
          {added.filter((a) => a.side === side).map((a) => (
            <div key={a.id} className="flex items-center gap-1">
              <input
                className={`${inputCls} w-12 text-center`}
                inputMode="numeric"
                value={a.jersey}
                onChange={(ev) =>
                  setAdded(added.map((x) => (x.id === a.id ? { ...x, jersey: ev.target.value.replace(/\D/g, "").slice(0, 2) } : x)))
                }
              />
              <input
                className={inputCls}
                placeholder="New player"
                value={a.name}
                onChange={(ev) => setAdded(added.map((x) => (x.id === a.id ? { ...x, name: ev.target.value } : x)))}
              />
              <select
                className="shrink-0 rounded-md border border-line bg-canvas px-1 py-1 text-xs"
                value={a.status}
                onChange={(ev) => setAdded(added.map((x) => (x.id === a.id ? { ...x, status: ev.target.value as "pitch" | "bench" } : x)))}
              >
                <option value="pitch">On pitch</option>
                <option value="bench">Bench</option>
              </select>
              <button
                type="button"
                aria-label="Remove"
                className="shrink-0 rounded-md border border-line px-2 text-secondary"
                onClick={() => setAdded(added.filter((x) => x.id !== a.id))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-gold"
          onClick={() => setAdded([...added, { id: minId - 1, side, name: "", jersey: "", status: "bench" }])}
        >
          + Add player
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">
        Fix a name or number, move a player on/off the pitch, mark someone Out, or add a missing player.
      </p>
      <SideBlock side="home" />
      <SideBlock side="away" />
      <EditorActions onSave={save} onClose={onClose} saving={saving} />
    </div>
  );
}

function EditorActions({
  onSave,
  onClose,
  saving,
}: {
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" className={`${btnCls} border border-line text-secondary`} onClick={onClose} disabled={saving}>
        Cancel
      </button>
      <button type="button" className={`${btnCls} bg-gold text-canvas`} onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save & push live"}
      </button>
    </div>
  );
}

export function StatsEditor(props: {
  section: "info" | "lineups";
  data: FixtureStats;
  overrides: StatOverrides | null;
  onSave: (next: StatOverrides) => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="mb-3 rounded-xl border border-gold/40 bg-surface p-3">
      <p className="mb-2 text-sm font-bold">
        Edit {props.section === "info" ? "match info" : "line-ups"}
      </p>
      {props.section === "info" ? <InfoEditor {...props} /> : <LineupEditor {...props} />}
    </div>
  );
}
