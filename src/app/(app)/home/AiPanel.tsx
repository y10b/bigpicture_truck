"use client";

import { useState, useTransition } from "react";
import {
  getCoach,
  getDailyReport,
  type Coach,
  type DailyReport,
} from "../ai-actions";
import { Alert, Button, Card, cn } from "@/components/ui";
import { won } from "@/lib/format";

/**
 * AI 도움말.
 * - 오늘 목표: 전 직원 평균과 본인 흐름을 견줘 오늘 목표를 잡아 줍니다.
 * - 마감 보고: 그날 적은 메모·지출·시간을 읽고 되짚어 줍니다.
 *
 * 결과는 DB에 하루 한 번만 저장되므로, 다시 열어봐도 추가 비용이 없습니다.
 */
export default function AiPanel({
  workDate,
  isToday,
  hasEntries,
  initialCoach,
  initialReport,
}: {
  workDate: string;
  isToday: boolean;
  hasEntries: boolean;
  initialCoach: Coach | null;
  initialReport: DailyReport | null;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string>();
  const [busy, startTransition] = useTransition();

  const loadCoach = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await getCoach();
      if (res.ok && res.data) setCoach(res.data);
      else setError(res.error);
    });

  const loadReport = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await getDailyReport(workDate);
      if (res.ok && res.data) setReport(res.data);
      else setError(res.error);
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink/8 bg-ink px-4 py-3 text-paper">
        <span aria-hidden className="text-[15px]">
          ✨
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold">AI 도움말</p>
          <p className="text-[11px] text-paper/55">
            전 직원 기록을 바탕으로 알려드립니다
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* 오늘 목표 — 오늘 날짜에서만 */}
        {isToday && (
          <section>
            {coach ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                <p className="text-[14px] leading-snug font-extrabold text-brand-700">
                  {coach.headline}
                </p>

                <div className="mt-2.5 flex items-baseline gap-1.5 border-y border-brand-200/70 py-2.5">
                  <span className="text-[12px] font-semibold text-brand-700/70">
                    오늘 목표
                  </span>
                  <span className="tnum ml-auto text-[22px] leading-none font-extrabold text-brand-700">
                    {won(coach.targetTotal)}
                    <span className="ml-0.5 text-[12px] font-semibold">원</span>
                  </span>
                </div>

                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
                  {coach.reason}
                </p>

                {coach.tips?.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {coach.tips.map((t, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2"
                      >
                        <span aria-hidden className="text-brand-500">
                          ·
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={loadCoach}
              >
                {busy ? "생각하는 중…" : "오늘 얼마를 목표로 할까요?"}
              </Button>
            )}
          </section>
        )}

        {/* 마감 보고 */}
        {hasEntries && (
          <section>
            {report ? (
              <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-3.5">
                <p className="text-[14px] leading-snug font-extrabold">
                  {report.headline}
                </p>

                {report.good?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] font-bold text-brand-600">잘한 점</p>
                    <ul className="mt-1 space-y-1">
                      {report.good.map((t, i) => (
                        <li
                          key={i}
                          className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2"
                        >
                          <span aria-hidden className="text-brand-500">
                            ·
                          </span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.improve?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] font-bold text-accent-deep">
                      다음엔 이렇게
                    </p>
                    <ul className="mt-1 space-y-1">
                      {report.improve.map((t, i) => (
                        <li
                          key={i}
                          className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2"
                        >
                          <span aria-hidden className="text-accent-deep">
                            ·
                          </span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.missing && (
                  <p className="mt-3 rounded-lg bg-card px-3 py-2 text-[12px] leading-relaxed text-ink-4">
                    💡 {report.missing}
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className={cn("w-full", isToday && "mt-1")}
                disabled={busy}
                onClick={loadReport}
              >
                {busy ? "읽어보는 중…" : "오늘 운행 되짚어 보기"}
              </Button>
            )}
          </section>
        )}

        {!isToday && !hasEntries && (
          <p className="py-2 text-center text-[13px] text-ink-4">
            이 날은 입력한 내역이 없습니다.
          </p>
        )}

        {error && <Alert>{error}</Alert>}
      </div>
    </Card>
  );
}
