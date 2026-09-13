import { EqBars } from "@/components/ui/EqBars";

/**
 * Marketing "ON AIR" player card (Programme reskin): a flat red-fill panel -
 * pulsing lamp, small-caps ON AIR, sample scoreline and transport, all in
 * paper-on-red. Explicitly labelled "Preview" and hosted by a generic "Your
 * host" so it reads as a UI demo, not a live broadcast happening now (trust:
 * no fabricated live event). No real data, no club crests.
 */
export function OnAirCard() {
  return (
    <div className="bg-red-fill p-5 text-on-red">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em]">
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] animate-fcpulse rounded-full bg-on-red"
          />
          ON AIR
        </span>
        <span className="flex items-center gap-2">
          <span className="border border-on-red px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase">
            Preview
          </span>
          <span className="font-mono text-[13px] tracking-wide tabular-nums">1H 23:14</span>
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between border-y border-on-red/50 px-1 py-3">
        <span className="display text-[17px]" style={{ letterSpacing: "0.03em" }}>
          ARS
        </span>
        <span
          className="display text-[26px] whitespace-nowrap tabular-nums"
          style={{ letterSpacing: "0.06em" }}
        >
          2<span className="mx-2 opacity-70">-</span>0
        </span>
        <span className="display text-[17px]" style={{ letterSpacing: "0.03em" }}>
          BUR
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-[46px] w-[46px] shrink-0 rounded-full border-2 border-on-red"
        />
        <div className="flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            Your host
            <span className="border border-on-red px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.1em] uppercase">
              Host
            </span>
          </p>
          <p className="text-[12.5px] opacity-80">A real Arsenal supporter</p>
        </div>
        <EqBars color="bg-on-red" />
      </div>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-on-red text-red-fill"
        >
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <div className="flex flex-1 items-center gap-1.5 font-mono text-[11px]">
          <span className="flex-1 border-2 border-on-red py-2.5 text-center">−0.5s</span>
          <span className="flex-[1.4] bg-on-red py-2.5 text-center font-bold tracking-[0.1em] text-red-fill">
            ◎ SYNC NOW
          </span>
          <span className="flex-1 border-2 border-on-red py-2.5 text-center">+0.5s</span>
        </div>
      </div>
    </div>
  );
}
