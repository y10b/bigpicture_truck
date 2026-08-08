import { won } from "@/lib/format";
import { Card, cn } from "@/components/ui";
import type { Settlement } from "@/lib/settlement";

/**
 * 매출에서 상납금을 빼 실제로 손에 쥐는 금액을 보여줍니다.
 * 출금 기록이 있는 화면에서는 남은 금액까지 이어서 보여줍니다.
 */
export default function SettlementCard({
  label,
  s,
  levyRate,
  showWithdraw = true,
  className,
}: {
  label: string;
  s: Settlement;
  levyRate: number;
  showWithdraw?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="bg-ink px-4 py-4 text-paper">
        <span className="text-[12px] font-semibold text-paper/60">{label}</span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="tnum text-[32px] leading-none font-extrabold tracking-tight">
            {won(s.net)}
          </span>
          <span className="text-[15px] font-semibold text-paper/60">원</span>
        </div>
        <p className="mt-1 text-[12px] font-medium text-paper/50">
          실수령 · 상납금 뺀 금액
        </p>
      </div>

      <div className="divide-y divide-ink/6">
        <Row label="매출 합계" value={s.total} sub={`근무 ${s.workedDays}일`} />
        <Row
          label="상납금"
          value={-s.levy}
          sub={`평일 ${s.levyDays}일 × ${won(levyRate)}원 · 주말 면제`}
          tone="minus"
        />
        {showWithdraw && (
          <>
            <Row label="출금한 금액" value={-s.withdrawn} tone="minus" />
            <Row
              label="아직 안 찾은 금액"
              value={s.remaining}
              tone={s.remaining < 0 ? "warn" : "strong"}
              sub={
                s.remaining < 0
                  ? "실수령보다 많이 출금했습니다"
                  : undefined
              }
            />
          </>
        )}
      </div>
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
