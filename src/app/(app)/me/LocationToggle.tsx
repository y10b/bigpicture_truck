"use client";

import { useState, useTransition } from "react";
import { setShareLocation } from "../location-actions";
import { Alert, Card, CardHeader, cn } from "@/components/ui";

/**
 * 위치 공유 스위치.
 * 회사 폰이고 동의도 받았지만, 본인이 끌 수 있는 자리는 있어야 합니다.
 */
export default function LocationToggle({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="위치 공유"
        desc="근무시간(오전 8시 ~ 밤 10시)에만 켜집니다"
      />
      <div className="px-4 pb-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const next = !value;
            setValue(next);
            setError(undefined);
            startTransition(async () => {
              const res = await setShareLocation(next);
              if (!res.ok) {
                setValue(!next);
                setError(res.error);
              }
            });
          }}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-paper-2/50 px-3.5 py-3"
        >
          <span className="min-w-0 text-left">
            <span className="block text-[14px] font-bold">
              {value ? "공유 중" : "공유 안 함"}
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-4">
              {value
                ? "배차와 정산 확인을 위해 관리자가 현재 위치를 봅니다. 밤 10시 이후에는 보내지 않습니다."
                : "위치를 보내지 않습니다. 저장돼 있던 마지막 위치도 지웠습니다."}
            </span>
          </span>
          <span
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              value ? "bg-brand-500" : "bg-ink/20",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
                value ? "left-6" : "left-1",
              )}
            />
          </span>
        </button>

        {error && (
          <div className="mt-2">
            <Alert>{error}</Alert>
          </div>
        )}
      </div>
    </Card>
  );
}
