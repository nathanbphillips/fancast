import { Pill } from "@/components/ui/Pill";
import { Waveform } from "@/components/ui/Waveform";
import { EqBars } from "@/components/ui/EqBars";

/**
 * Marketing "ON AIR" player card for the home hero (Cloud Design) — a bobbing
 * mock of the room's transport. Illustrative content, no real data, no crests
 * (avatar is a CSS gradient). Decorative.
 */
export function OnAirCard() {
  return (
    <div className="animate-fcbob relative rounded-2xl border border-red/40 bg-gradient-to-b from-inset to-surface p-5 shadow-raised">
      <div className="flex items-center justify-between">
        <Pill variant="red" live>
          ON AIR
        </Pill>
        <span className="font-mono text-xs text-secondary tabular-nums">
          1H 23:14
        </span>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 font-display text-2xl">
        <span>ARS</span>
        <span className="font-sans text-3xl font-bold tabular-nums">2</span>
        <span className="text-secondary">–</span>
        <span className="font-sans text-3xl font-bold tabular-nums">0</span>
        <span>BUR</span>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-inset px-3 py-2.5">
        <span
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 30%, #f1232b, #7a0f14)",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            nathan
            <span className="rounded border border-gold/40 px-1 py-0.5 font-mono text-[8px] font-bold tracking-wider text-gold uppercase">
              Host
            </span>
          </p>
          <p className="font-mono text-[10px] text-secondary">Gooner · lifelong</p>
        </div>
        <EqBars />
      </div>

      <Waveform bars={40} height={56} className="mt-4" />

      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red text-white shadow-glow"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <div className="flex flex-1 items-center gap-2 font-mono text-[10px] font-bold uppercase">
          <span className="flex-1 rounded-md border border-line py-2 text-center text-secondary">
            −0.5s
          </span>
          <span className="flex-[1.4] rounded-md bg-inverted py-2 text-center text-inverted-fg">
            Sync now
          </span>
          <span className="flex-1 rounded-md border border-line py-2 text-center text-secondary">
            +0.5s
          </span>
        </div>
      </div>
    </div>
  );
}
