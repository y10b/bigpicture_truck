import { won } from "@/lib/format";
import { Card, cn } from "@/components/ui";

export type Totals = {
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
};

export function emptyTotals(): Totals {
  return { count: 0, credit: 0, cod: 0, extra: 0, total: 0 };
}

export function sumTotals(rows: Partial<Totals>[]): Totals {
  return rows.reduce<Totals>(
    (a, r) => ({
      count: a.count + (r.count ?? 0),
      credit: a.credit + (r.credit ?? 0),
      cod: a.cod + (r.cod ?? 0),
      extra: a.extra + (r.extra ?? 0),
      total: a.total + (r.total ?? 0),
    }),
    emptyTotals(),
  );
}

export default function TotalsCard({
  label,
  totals,
  className,
}: {
  label: string;
  totals: Totals;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="bg-ink px-4 py-4 text-paper">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-paper/60">{label}</span>
          <span className="text-[12px] font-semibold text-paper/60">
            총 <span className="tnum text-accent">{totals.count}</span>건
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="tnum text-[32px] leading-none font-extrabold tracking-tight">
            {won(totals.total)}
          </span>
          <span className="text-[15px] font-semibold text-paper/60">원</span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-ink/8">
        <Stat label="신용" value={totals.credit} accent="bg-brand-400" />
        <Stat label="착불" value={totals.cod} accent="bg-accent" />
        <Stat label="추가금" value={totals.extra} accent="bg-ink-3" />
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", accent)} />
        <span className="text-[12px] font-semibold text-ink-3">{label}</span>
      </div>
      <p className="tnum mt-1 text-[15px] font-bold">{won(value)}</p>
    </div>
  );
}
