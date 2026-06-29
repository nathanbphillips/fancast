"use client";

import { useEffect, useMemo, useState } from "react";
import type { FixtureStats } from "@/lib/stats";
import type { PlayerStatus, StatOverrides } from "@/lib/statOverrides";

/**
 * Commentator-only editor for the Info + Line-ups panels (Phase 11). Functional-
 * first (the full visual redesign comes later). Produces a sparse StatOverrides
 * patch and hands it to onSave, which persists + broadcasts it.
 *
 * All row sub-components live at MODULE scope (not inline) so their identity is
 * stable: the stats poll hands the editor a fresh `data` object every ~10-15s,
 * and an inline component would remount its inputs each poll, stealing the
 * commentator's keyboard focus mid-edit.
 */

const inputCls =
  "w-full rounded-md border border-line bg-canvas px-2 py-1 text-sm text-primary placeholder:text-secondary";
const btnCls = "rounded-md px-3 py-1.5 text-sm font-semibold";
const selectCls = "shrink-0 rounded-md border border-line bg-canvas px-1 py-1 text-xs";
const removeCls = "shrink-0 rounded-md border border-line px-2 text-secondary";

type NewsRow = { name: string; reason: string };
type Edit = { name: string; jersey: string; status: PlayerStatus };
type AddedRow = { id: number; side: "home" | "away"; name: string; jersey: string; status: "pitch" | "bench" };
type ShownRow = { id: number; side: "home" | "away"; name: string; jersey: string; status: PlayerStatus };

const onlyDigits = (s: string) => s.replace(/\D/g, "").slice(0, 2);

// ---- module-scope row components (stable identity → inputs keep focus) ----

function NewsListEditor({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: NewsRow[];
  onChange: (rows: NewsRow[]) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-secondary">{label} — absences</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1">
            <input
              className={inputCls}
              placeholder="Player"
              value={r.name}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className={inputCls}
              placeholder="Reason"
              value={r.reason}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
            />
            <button
              type="button"
              aria-label="Remove"
              className={removeCls}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-1 text-xs font-semibold text-gold"
        onClick={() => onChange([...rows, { name: "", reason: "" }])}
      >
        + Add absence
      </button>
    </div>
  );
}

function PlayerRowEditor({ e, onChange }: { e: Edit; onChange: (patch: Partial<Edit>) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        className={`${inputCls} w-12 text-center`}
        inputMode="numeric"
        value={e.jersey}
        onChange={(ev) => onChange({ jersey: onlyDigits(ev.target.value) })}
      />
      <input className={inputCls} value={e.name} onChange={(ev) => onChange({ name: ev.target.value })} />
      <select
        className={selectCls}
        value={e.status}
        onChange={(ev) => onChange({ status: ev.target.value as PlayerStatus })}
      >
        <option value="pitch">On pitch</option>
        <option value="bench">Bench</option>
        <option value="out">Out</option>
      </select>
    </div>
  );
}

function AddedRowEditor({
  a,
  onChange,
  onRemove,
}: {
  a: AddedRow;
  onChange: (patch: Partial<AddedRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        className={`${inputCls} w-12 text-center`}
        inputMode="numeric"
        value={a.jersey}
        onChange={(ev) => onChange({ jersey: onlyDigits(ev.target.value) })}
      />
      <input
        className={inputCls}
        placeholder="New player"
        value={a.name}
        onChange={(ev) => onChange({ name: ev.target.value })}
      />
      <select
        className={selectCls}
        value={a.status}
        onChange={(ev) => onChange({ status: ev.target.value as "pitch" | "bench" })}
      >
        <option value="pitch">On pitch</option>
        <option value="bench">Bench</option>
      </select>
      <button type="button" aria-label="Remove" className={removeCls} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function SideBlock({
  teamName,
  rows,
  edits,
  onEdit,
  added,
  onAddedChange,
  onAddedRemove,
  onAdd,
}: {
  teamName: string;
  rows: ShownRow[];
  edits: Record<number, Edit>;
  onEdit: (id: number, patch: Partial<Edit>) => void;
  added: AddedRow[];
  onAddedChange: (id: number, patch: Partial<AddedRow>) => void;
  onAddedRemove: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-primary">{teamName}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <PlayerRowEditor
            key={r.id}
            e={edits[r.id] ?? { name: r.name, jersey: r.jersey, status: r.status }}
            onChange={(patch) => onEdit(r.id, patch)}
          />
        ))}
        {added.map((a) => (
          <AddedRowEditor
            key={a.id}
            a={a}
            onChange={(patch) => onAddedChange(a.id, patch)}
            onRemove={() => onAddedRemove(a.id)}
          />
        ))}
      </div>
      <button type="button" className="mt-1 text-xs font-semibold text-gold" onClick={onAdd}>
        + Add player
      </button>
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

// ---- the two section editors ----

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
  // team news pre-fills from the shown (merged) list so it's editable, but is only
  // written when touched — otherwise an untouched save would freeze the current
  // Sportmonks news. A side that ALREADY has an override counts as touched, so a
  // re-save (to fix something else) re-emits and preserves it rather than dropping it.
  const oNews = oInfo?.teamNews;
  const [home, setHome] = useState<NewsRow[]>(info?.teamNews.home ?? []);
  const [away, setAway] = useState<NewsRow[]>(info?.teamNews.away ?? []);
  const [homeTouched, setHomeTouched] = useState(oNews?.home !== undefined);
  const [awayTouched, setAwayTouched] = useState(oNews?.away !== undefined);

  const venuePh = info?.venue
    ? info.venue.city
      ? `${info.venue.name}, ${info.venue.city}`
      : info.venue.name
    : "Venue";
  const refPh = info?.referees[0]?.name ?? "Referee";
  const weatherPh = info?.weather?.description ?? "Weather";

  function save() {
    const clean = (rows: NewsRow[]) =>
      rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), reason: r.reason.trim() }));
    const nextInfo: NonNullable<StatOverrides["info"]> = {};
    if (venue.trim()) nextInfo.venue = venue.trim();
    if (referee.trim()) nextInfo.referee = referee.trim();
    if (weather.trim()) nextInfo.weather = weather.trim();
    if (homeTouched || awayTouched) {
      nextInfo.teamNews = {};
      if (homeTouched) nextInfo.teamNews.home = clean(home);
      if (awayTouched) nextInfo.teamNews.away = clean(away);
    }
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
      <NewsListEditor
        label={data.home.name}
        rows={home}
        onChange={(r) => {
          setHome(r);
          setHomeTouched(true);
        }}
      />
      <NewsListEditor
        label={data.away.name}
        rows={away}
        onChange={(r) => {
          setAway(r);
          setAwayTouched(true);
        }}
      />
      <EditorActions onSave={save} onClose={onClose} saving={saving} />
    </div>
  );
}

function LineupEditor({
  data,
  rawLineups,
  overrides,
  onSave,
  onClose,
  saving,
}: {
  data: FixtureStats;
  rawLineups: FixtureStats["lineups"] | undefined;
  overrides: StatOverrides | null;
  onSave: (next: StatOverrides) => void;
  onClose: () => void;
  saving: boolean;
}) {
  // shown (merged) players with their current status; id < 0 = commentator-added
  const shown = useMemo(() => {
    const rows: ShownRow[] = [];
    for (const side of ["home", "away"] as const) {
      const s = data.lineups[side];
      if (!s) continue;
      for (const p of s.starters)
        rows.push({ id: p.playerId, side, name: p.name, jersey: p.jersey?.toString() ?? "", status: "pitch" });
      for (const p of s.bench)
        rows.push({ id: p.playerId, side, name: p.name, jersey: p.jersey?.toString() ?? "", status: "bench" });
    }
    // re-surface real players the commentator marked "Out": mergeSide drops them
    // from the display, so look them up in the raw (pre-override) lineup so the
    // editor can show them (status Out) and the commentator can move them back.
    const shownIds = new Set(rows.map((r) => r.id));
    for (const [idStr, o] of Object.entries(overrides?.players ?? {})) {
      const id = Number(idStr);
      if (o?.status !== "out" || id < 0 || shownIds.has(id)) continue;
      for (const side of ["home", "away"] as const) {
        const s = rawLineups?.[side];
        const p = s ? [...s.starters, ...s.bench].find((x) => x.playerId === id) : undefined;
        if (p) {
          rows.push({
            id,
            side,
            name: o.name ?? p.name,
            jersey: (o.jersey ?? p.jersey)?.toString() ?? "",
            status: "out",
          });
          break;
        }
      }
    }
    return rows;
  }, [data, rawLineups, overrides]);

  const [edits, setEdits] = useState<Record<number, Edit>>(() => {
    const init: Record<number, Edit> = {};
    for (const r of shown) init[r.id] = { name: r.name, jersey: r.jersey, status: r.status };
    return init;
  });
  const [touched, setTouched] = useState<Set<number>>(() => new Set());
  const [added, setAdded] = useState<AddedRow[]>([]);

  // keep `edits` in sync with `shown` for untouched rows (a later poll publishes
  // the XI / a live sub reclassifies a player) so no Row reads an undefined entry
  // and an untouched row never diffs as a spurious change at save.
  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of shown) {
        if (touched.has(r.id)) continue;
        next[r.id] = { name: r.name, jersey: r.jersey, status: r.status };
      }
      return next;
    });
  }, [shown, touched]);

  const onEdit = (id: number, patch: Partial<Edit>) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
    setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));
  };
  const onAdd = (side: "home" | "away") => {
    const minId = Math.min(-1, ...shown.filter((r) => r.id < 0).map((r) => r.id), ...added.map((a) => a.id));
    setAdded((prev) => [...prev, { id: minId - 1, side, name: "", jersey: "", status: "bench" }]);
  };

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
      if (jerseyNum !== shownJersey) patch.jersey = jerseyNum;
      if (e.status !== r.status) patch.status = e.status;
      if (Object.keys(patch).length) players[String(r.id)] = { ...players[String(r.id)], ...patch };
    }
    // existing added players: marking one "Out" removes it; otherwise carry edits forward
    const keepAdded = (overrides?.added ?? [])
      .filter((a) => edits[a.id]?.status !== "out")
      .map((a) => {
        const e = edits[a.id];
        if (!e) return a;
        return {
          ...a,
          name: e.name.trim() || a.name,
          jersey: e.jersey.trim() === "" ? null : Number(e.jersey),
          status: (e.status === "out" ? "bench" : e.status) as "pitch" | "bench",
        };
      });
    const newAdded = added
      .filter((a) => a.name.trim())
      .map((a) => ({
        id: a.id,
        side: a.side,
        name: a.name.trim(),
        jersey: a.jersey.trim() === "" ? null : Number(a.jersey),
        status: a.status,
      }));
    onSave({ ...overrides, players, added: [...keepAdded, ...newAdded] });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">
        Fix a name or number, move a player on/off the pitch, or mark someone Out. Add a missing player below; mark an
        added player Out to remove them.
      </p>
      {(["home", "away"] as const).map((side) => (
        <SideBlock
          key={side}
          teamName={side === "home" ? data.home.name : data.away.name}
          rows={shown.filter((r) => r.side === side)}
          edits={edits}
          onEdit={onEdit}
          added={added.filter((a) => a.side === side)}
          onAddedChange={(id, patch) => setAdded((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
          onAddedRemove={(id) => setAdded((prev) => prev.filter((x) => x.id !== id))}
          onAdd={() => onAdd(side)}
        />
      ))}
      <EditorActions onSave={save} onClose={onClose} saving={saving} />
    </div>
  );
}

export function StatsEditor({
  section,
  data,
  rawLineups,
  overrides,
  onSave,
  onClose,
  saving,
}: {
  section: "info" | "lineups";
  data: FixtureStats;
  rawLineups?: FixtureStats["lineups"];
  overrides: StatOverrides | null;
  onSave: (next: StatOverrides) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const common = { data, overrides, onSave, onClose, saving };
  return (
    <div className="mb-3 rounded-xl border border-gold/40 bg-surface p-3">
      <p className="mb-2 text-sm font-bold">Edit {section === "info" ? "match info" : "line-ups"}</p>
      {section === "info" ? (
        <InfoEditor {...common} />
      ) : (
        <LineupEditor {...common} rawLineups={rawLineups} />
      )}
    </div>
  );
}
