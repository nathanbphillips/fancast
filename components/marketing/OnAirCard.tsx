import { Waveform } from "@/components/ui/Waveform";
import { EqBars } from "@/components/ui/EqBars";

/**
 * Marketing "ON AIR" player card for the home hero (Cloud Design) — a bobbing
 * mock of the room transport. Explicitly labelled "Preview" and hosted by a
 * generic "Your host" so it reads as a UI demo, not a live broadcast happening
 * now (trust: no fabricated live event). Team marks are abstract CSS stripe
 * swatches (no real crests). Decorative, no real data.
 */
const swatch =
  "repeating-linear-gradient(45deg, rgb(var(--hair) / 0.14), rgb(var(--hair) / 0.14) 4px, rgb(var(--hair) / 0.05) 4px, rgb(var(--hair) / 0.05) 8px)";

export function OnAirCard() {
  return (
    <div className="animate-fcbob rounded-[20px] border border-line bg-gradient-to-b from-surface to-inset p-5 shadow-raised">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-red">
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] animate-fcpulse rounded-full bg-red"
            style={{ boxShadow: "0 0 10px #f1232b" }}
          />
          ON AIR
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-secondary uppercase">
            Preview
          </span>
          <span className="font-mono text-[13px] tracking-wide text-secondary tabular-nums">
            1H 23:14
          </span>
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-inset px-4 py-3">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-[22px] w-[22px] rounded-[5px]"
            style={{ background: swatch }}
          />
          <span className="display text-[17px]" style={{ letterSpacing: "0.03em" }}>
            ARS
          </span>
        </span>
        <span
          className="display text-[26px] whitespace-nowrap"
          style={{ letterSpacing: "0.06em" }}
        >
          2<span className="mx-2 text-secondary">–</span>0
        </span>
        <span className="flex items-center gap-2.5">
          <span className="display text-[17px]" style={{ letterSpacing: "0.03em" }}>
            BUR
          </span>
          <span
            aria-hidden="true"
            className="h-[22px] w-[22px] rounded-[5px]"
            style={{ background: swatch }}
          />
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-[46px] w-[46px] shrink-0 rounded-full border border-line"
          style={{ background: "radial-gradient(circle at 35% 30%, #3a3a40, #1b1b1f)" }}
        />
        <div className="flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            Your host
            <span className="rounded border border-gold/50 px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-gold uppercase">
              Host
            </span>
          </p>
          <p className="text-[12.5px] text-secondary">A real Arsenal supporter</p>
        </div>
        <EqBars />
      </div>

      <div className="mb-3.5 rounded-xl border border-line bg-inset px-3.5">
        <Waveform bars={40} height={66} />
      </div>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-red text-white"
          style={{ boxShadow: "0 8px 24px -6px rgba(241,35,43,0.7)" }}
        >
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <div className="flex flex-1 items-center gap-1.5 font-mono text-[11px]">
          <span className="flex-1 rounded-lg border border-line bg-inset py-2.5 text-center text-secondary">
            −0.5s
          </span>
          <span className="flex-[1.4] rounded-lg bg-inverted py-2.5 text-center font-bold tracking-[0.1em] text-inverted-fg">
            SYNC NOW
          </span>
          <span className="flex-1 rounded-lg border border-line bg-inset py-2.5 text-center text-secondary">
            +0.5s
          </span>
        </div>
      </div>
    </div>
  );
}
