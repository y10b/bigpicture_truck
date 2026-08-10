import { won } from "@/lib/format";
import { Card, cn } from "@/components/ui";
import type { Settlement } from "@/lib/settlement";

/**
 * 기간 매출과 출금 상황을 보여줍니다.
 * 벌어들인 금액 → 찾아간 금액 → 아직 안 찾은 금액 순으로 읽히게 했습니다.
 */
export default function SettlementCard({
  label,
  s,
  showWithdraw = true,
  className,
}: {
  label: string;
  s: Settlement;
  showWithdraw?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="bg-ink px-4 py-4 text-paper">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-paper/60">{label}</span>
          <span className="text-[12px] font-semibold text-paper/60">
            근무 <span className="tnum text-accent">{s.workedDays}</span>일
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="tnum text-[32px] leading-none font-extrabold tracking-tight">
            {won(s.total)}
          </span>
          <span className="text-[15px] font-semibold text-paper/60">원</span>
        </div>
      </div>

      {showWithdraw && (
        <div className="divide-y divide-ink/6">
          <Row label="출금한 금액" value={-s.withdrawn} tone="minus" />
          <Row
            label="아직 안 찾은 금액"
            value={s.remaining}
            tone={s.remaining < 0 ? "warn" : "strong"}
            sub={s.remaining < 0 ? "번 금액보다 많이 출금했습니다" : undefined}
          />
        </div>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  sub,
  tone = "normal",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "normal" | "minus" | "strong" | "warn";
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p
          className={cn(
            "text-[13px] font-semibold",
            tone === "strong" ? "text-ink" : "text-ink-3",
          )}
        >
          {label}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-ink-4">{sub}</p>}
      </div>
      <span
        className={cn(
          "tnum shrink-0 font-bold",
          tone === "minus" && "text-ink-3",
          tone === "warn" && "text-danger",
          tone === "strong" && "text-[17px] font-extrabold text-brand-600",
          tone === "normal" && "text-[15px]",
        )}
      >
        {value < 0 ? `−${won(-value)}` : won(value)}
        <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
      </span>
    </div>
  );
}
