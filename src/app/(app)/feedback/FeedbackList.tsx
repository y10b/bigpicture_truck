"use client";

import { useState } from "react";
import type { Feedback } from "../feedback-actions";
import { Badge, Card, cn } from "@/components/ui";
import { prettyDate, won } from "@/lib/format";

type Row = { report_date: string; content: Feedback; created_at: string };

const km = (m: number) => `${Math.round(m / 100) / 10}km`;

/** +12% / −8% 처럼 어제 대비 변화 */
function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "tnum rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        up ? "bg-brand-50 text-brand-600" : "bg-danger-soft text-danger",
      )}
    >
      {label} {up ? "▲" : "▼"}
      {Math.abs(value)}%
    </span>
  );
}

export default function FeedbackList({
  rows,
  today,
  hasToday,
  yesterday,
}: {
  rows: Row[];
  today: string;
  hasToday: boolean;
  yesterday: string;
}) {
  // 가장 최근 것은 펼쳐 두고, 나머지는 접습니다.
  const [open, setOpen] = useState<string | null>(rows[0]?.report_date ?? null);

  return (
    <div className="space-y-2.5">
      {!hasToday && (
        <Card className="border-accent/40 bg-accent-soft/50 px-4 py-3">
          <p className="text-[13px] leading-relaxed font-semibold text-accent-deep">
            오늘 마감을 아직 안 하셨습니다. 정산입력에서 하루 마감을 저장하면
            오늘 피드백이 생깁니다.
          </p>
        </Card>
      )}

      {rows.map((r) => {
        const f = r.content;
        // 형식이 바뀌기 전에 만들어진 것이 섞여 있을 수 있습니다.
        const facts = f.facts ?? {
          total: 0, count: 0, meters: 0,
          perKm: null, perCount: null,
          vsYesterdayTotal: null, vsYesterdayMeters: null,
        };
        const isOpen = open === r.report_date;
        const isToday = r.report_date === today;

        return (
          <Card key={r.report_date} className="overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : r.report_date)}
              className="w-full px-4 py-3.5 text-left transition-colors active:bg-paper-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold">
                  {prettyDate(r.report_date)}
                </span>
                {isToday && <Badge tone="accent">오늘</Badge>}
                {r.report_date === yesterday && <Badge>어제</Badge>}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={cn(
                    "ml-auto shrink-0 text-ink-4 transition-transform",
                    isOpen && "rotate-180",
                  )}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              <p className="mt-1 text-[14px] leading-snug font-bold text-brand-700">
                {f.headline}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="tnum text-[12px] font-bold text-ink-2">
                  {won(facts.total)}원
                </span>
                <span className="text-[12px] text-ink-4">·</span>
                <span className="tnum text-[12px] text-ink-3">
                  {facts.count}건
                </span>
                {facts.meters > 0 && (
                  <>
                    <span className="text-[12px] text-ink-4">·</span>
                    <span className="tnum text-[12px] text-ink-3">
                      {km(facts.meters)}
                    </span>
                  </>
                )}
                <Delta value={facts.vsYesterdayTotal} label="매출" />
                <Delta value={facts.vsYesterdayMeters} label="거리" />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-ink/8 px-4 py-3.5">
                {/* 우리가 직접 계산한 수치 — AI가 지어낸 값이 아닙니다 */}
                <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-paper-2/60 p-3">
                  <Fact label="1km당 매출" value={facts.perKm ? `${won(facts.perKm)}원` : "거리 기록 없음"} />
                  <Fact label="건당 단가" value={facts.perCount ? `${won(facts.perCount)}원` : "-"} />
                  <Fact label="주행거리" value={facts.meters > 0 ? km(facts.meters) : "기록 없음"} />
                  <Fact label="건수" value={`${facts.count}건`} />
                </div>

                {f.good?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] font-bold text-brand-600">잘한 점</p>
                    <ul className="mt-1 space-y-1">
                      {f.good.map((t, i) => (
                        <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2">
                          <span aria-hidden className="text-brand-500">·</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {f.improve?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] font-bold text-accent-deep">다음엔 이렇게</p>
                    <ul className="mt-1 space-y-1">
                      {f.improve.map((t, i) => (
                        <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-ink-2">
                          <span aria-hidden className="text-accent-deep">·</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-ink-4">{label}</p>
      <p className="tnum mt-0.5 text-[14px] font-extrabold">{value}</p>
    </div>
  );
}
