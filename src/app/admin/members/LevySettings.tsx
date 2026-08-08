"use client";

import { useState, useTransition } from "react";
import { updateWeekdayLevy } from "../settings-actions";
import { Alert, Button, Card, CardHeader, Field } from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { won } from "@/lib/format";

export default function LevySettings({ current }: { current: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="상납금 설정"
        desc="평일 근무 하루당 · 토·일은 면제"
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
            {won(current)}
            <span className="ml-1 text-[13px] font-semibold text-ink-4">
              원 / 평일 1일
            </span>
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
            startTransition(async () => {
              const res = await updateWeekdayLevy(fd);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            });
          }}
          className="space-y-3 px-4 pb-4"
        >
          <Field label="평일 하루당 상납금" required>
            <MoneyInput name="weekday_levy" defaultValue={current} autoFocus />
          </Field>
          <p className="text-[12px] leading-relaxed text-ink-4">
            바꾸면 <b>지난 기간 정산까지 전부</b> 새 단가로 다시 계산됩니다.
          </p>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
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
