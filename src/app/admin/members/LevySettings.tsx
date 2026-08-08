"use client";

import { useState, useTransition } from "react";
import { updateLevySettings } from "../settings-actions";
import { Alert, Button, Card, CardHeader, Field, cn } from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { won } from "@/lib/format";

export default function LevySettings({
  amount,
  daysPerWeek,
}: {
  amount: number;
  daysPerWeek: number;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(daysPerWeek);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="사납금 설정"
        desc={`그 주에 일한 앞 ${daysPerWeek}일에만 부과 · 더 나온 날은 면제`}
        right={
          !open ? (
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-lg border border-ink/12 bg-card px-2.5 py-1.5 text-[12px] font-bold text-ink-2"
            >
              변경
            </button>
          ) : null
        }
      />

      {!open ? (
        <div className="px-4 pb-4">
          <p className="tnum text-[20px] font-extrabold">
            {won(amount)}
            <span className="ml-1 text-[13px] font-semibold text-ink-4">
              원 × 주 {daysPerWeek}일까지
            </span>
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
            평일·주말을 가리지 않고 그 주에 일한 순서로 앞 {daysPerWeek}일에
            붙습니다. 평일 하루 쉬고 주말에 대신 나오면 그 주말도 사납금이
            붙고, {daysPerWeek}일을 채운 뒤 더 나온 날은 면제됩니다.
          </p>
          {saved && (
            <div className="mt-2">
              <Alert tone="brand">저장했습니다.</Alert>
            </div>
          )}
        </div>
      ) : (
        <form
          action={(fd) => {
            setError(undefined);
            fd.set("levy_days_per_week", String(days));
            startTransition(async () => {
              const res = await updateLevySettings(fd);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            });
          }}
          className="space-y-3.5 px-4 pb-4"
        >
          <Field label="하루 단가" required>
            <MoneyInput name="levy_amount" defaultValue={amount} autoFocus />
          </Field>

          <div>
            <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
              주당 부과 일수 <span className="text-danger">*</span>
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDays(n)}
                  className={cn(
                    "h-11 rounded-xl border-2 text-[14px] font-bold transition-all",
                    days === n
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink/10 bg-card text-ink-3",
                  )}
                >
                  {n}일
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
              그 주에 일한 날을 날짜순으로 세어 앞 {days}일까지만 사납금이
              붙습니다.
            </p>
          </div>

          <p className="text-[12px] leading-relaxed text-ink-4">
            바꾸면 <b>지난 기간 정산까지 전부</b> 새 기준으로 다시 계산됩니다.
          </p>

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDays(daysPerWeek);
                setOpen(false);
              }}
            >
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
