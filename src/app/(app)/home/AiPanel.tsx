"use client";

import { useState, useTransition } from "react";
import { getCoach, type Coach } from "../ai-actions";
import { Alert, Button, Card } from "@/components/ui";
import { won } from "@/lib/format";

/**
 * 오늘 목표를 잡아 주는 카드.
 * 전 직원 평균과 본인 흐름을 견줘 오늘 얼마를 벌면 되는지 알려 줍니다.
 *
 * 하루 마감 뒤의 되짚어 보기는 여기가 아니라 피드백 탭에서 합니다.
 * 결과는 DB에 하루 한 번만 저장되므로, 다시 열어봐도 추가 비용이 없습니다.
 */
export default function AiPanel({
  isToday,
  initialCoach,
}: {
  isToday: boolean;
  initialCoach: Coach | null;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [error, setError] = useState<string>();
  const [busy, startTransition] = useTransition();

  const loadCoach = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await getCoach();
      if (res.ok && res.data) setCoach(res.data);
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
            하루 마감을 저장하면 피드백 탭에 정리해 드립니다
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

        {!isToday && (
          <p className="py-2 text-center text-[13px] text-ink-4">
            오늘 목표는 오늘 날짜에서만 볼 수 있습니다.
          </p>
        )}

        {error && <Alert>{error}</Alert>}
      </div>
    </Card>
  );
}
