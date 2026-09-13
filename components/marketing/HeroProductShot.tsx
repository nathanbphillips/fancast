import { brand } from "@/lib/brand";

/**
 * Hero product shot (Programme reskin): the room preview redrawn as a printed
 * programme page - an ink-ruled paper panel with a small-caps masthead, a
 * red ON AIR strip, a display-type scoreline, the sync controls, ruled chat
 * entries and a stats mini-column. Decorative (aria-hidden); the hero copy
 * carries the meaning for assistive tech. HONESTY: this is a labelled Preview
 * with SAMPLE in-UI values (score, stats) and an ARCHETYPE host ("Your host",
 * never a named person). It deliberately shows NO fabricated engagement
 * counts (no "listening"/"talking"/"messages" numbers) - those would read as
 * invented momentum, which we don't show pre-launch.
 */
export function HeroProductShot() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-[760px] lg:mt-0 lg:max-w-none lg:-rotate-1"
    >
      <div className="border-2 border-primary bg-canvas p-4 text-left sm:p-5">
        {/* masthead */}
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-primary pb-2.5">
          <span className="display text-[15px]">
            <span className="text-red">{brand.logoParts.accent}</span>
            <span className="text-primary">{brand.logoParts.base}</span>
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.14em] text-tertiary sm:inline">
            THE MATCHDAY ROOM
          </span>
          <span className="border border-line px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-tertiary">
            PREVIEW
          </span>
        </div>

        {/* ON AIR strip */}
        <div className="mt-3 flex items-center justify-between bg-red-fill px-3 py-2 text-on-red">
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em]">
            <span className="h-[7px] w-[7px] animate-fc-blink rounded-full bg-on-red" />
            ON AIR
          </span>
          <span className="font-mono text-[11px] tabular-nums">1H 23:14</span>
        </div>

        {/* body: room column + stats mini-column */}
        <div className="mt-4 grid gap-5 sm:grid-cols-[1.5fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* scoreline */}
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <span className="display text-[20px]">ARS</span>
              <span className="display text-[34px] tabular-nums">
                2<span className="mx-2.5 text-tertiary">-</span>0
              </span>
              <span className="display text-[20px]">BUR</span>
            </div>

            {/* host row */}
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <span className="h-9 w-9 shrink-0 rounded-full border-2 border-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-primary">Your host</span>
                <span className="block font-mono text-[10px] tracking-[0.06em] text-secondary">
                  A REAL ARSENAL SUPPORTER · SPEAKING
                </span>
              </span>
              <span className="flex h-[18px] items-end gap-[2px]">
                {[0.6, 1, 0.5, 0.8].map((d, i) => (
                  <span
                    key={i}
                    className="w-[3px] origin-bottom animate-fceq bg-red-fill"
                    style={{ height: "100%", animationDelay: `-${d}s` }}
                  />
                ))}
              </span>
            </div>

            {/* sync row */}
            <div className="flex items-stretch gap-2">
              <span className="flex flex-1 items-center justify-center border-2 border-primary py-2 font-mono text-[11px] font-semibold text-primary">
                −0.5s
              </span>
              <span className="flex flex-[1.4] items-center justify-center bg-red-fill py-2 font-mono text-[10px] font-bold tracking-[0.08em] text-on-red">
                ◎ SYNC NOW
              </span>
              <span className="flex flex-1 items-center justify-center border-2 border-primary py-2 font-mono text-[11px] font-semibold text-primary">
                +0.5s
              </span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-tertiary italic">
              <span className="text-green">✓</span> locked · 0.0s
            </span>

            {/* chat entries */}
            <div className="mt-1 border-t-[3px] border-t-primary pt-2">
              <div className="flex items-center justify-between pb-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] text-tertiary">
                  THE ROOM
                </span>
                <span className="font-mono text-[10px] tracking-[0.08em] text-tertiary">
                  TOP · NEW
                </span>
              </div>
              <div className="border-t border-line py-2">
                <span className="block text-[12px] text-primary">
                  <b>Nathan</b> <span className="text-tertiary">· 23′</span>
                </span>
                <span className="block text-[12px] leading-snug text-secondary">
                  Ødegaard running this half on his own. Take a bow.
                </span>
              </div>
              <div className="border-t border-line py-2">
                <span className="block text-[12px] text-primary">
                  <b>Priya</b> <span className="text-tertiary">· 24′</span>
                </span>
                <span className="block text-[12px] leading-snug text-secondary">
                  Two up and the press still hasn&apos;t dropped a gear.
                </span>
              </div>
              <div className="border-t border-line pt-2 font-mono text-[10px] text-tertiary">
                Sign in to join the room…
              </div>
            </div>
          </div>

          {/* stats mini-column */}
          <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-3 sm:border-t-0 sm:border-l sm:border-line sm:pt-0 sm:pl-5">
            <span className="border-b-[3px] border-double border-primary pb-1.5 font-mono text-[10px] tracking-[0.12em] text-tertiary">
              STATS · LIVE
            </span>
            <div>
              <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-[0.06em]">
                <span className="text-secondary">POSSESSION</span>
                <span className="text-primary tabular-nums">58 · 42</span>
              </div>
              <div className="flex h-[7px] border border-line bg-inset">
                <span className="animate-fc-grow origin-left bg-red-fill" style={{ width: "58%" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-line p-2.5">
                <div className="display text-[20px] text-red tabular-nums">1.94</div>
                <div className="font-mono text-[10px] tracking-[0.08em] text-secondary">XG</div>
              </div>
              <div className="border border-line p-2.5">
                <div className="display text-[20px] tabular-nums">14</div>
                <div className="font-mono text-[10px] tracking-[0.08em] text-secondary">SHOTS</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[10px] tracking-[0.06em] text-secondary">
                MOMENTUM
              </div>
              <div className="flex h-[30px] items-end gap-[2px]">
                {[40, 62, 88, 96, 54, 34, 70, 82, 48].map((h, i) => (
                  <span
                    key={i}
                    className={`flex-1 ${h > 50 ? "bg-red-fill" : "bg-inset"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="font-mono text-[10px] text-tertiary italic">
              Lineups &amp; team news pushed by your host
            </div>
          </div>
        </div>

        {/* footer address line */}
        <div className="mt-4 border-t border-line pt-2 text-center font-mono text-[10px] tracking-[0.06em] text-tertiary">
          {brand.domain}/room/arsenal-vs-burnley
        </div>
      </div>
    </div>
  );
}
