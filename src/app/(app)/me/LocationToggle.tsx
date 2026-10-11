"use client";

import { useState, useTransition } from "react";
import { setShareLocation } from "../location-actions";
import { Alert, Card, CardHeader, cn } from "@/components/ui";
import { MANDATORY_TO_HOUR, TRACK_TO_HOUR } from "@/lib/tracking";

/**
 * 위치 공유 스위치.
 *
 * 오후 5시까지는 회사 규정이라 꺼도 보내집니다. 그래서 이 스위치는
 * '저녁에도 보낼지' 를 정하는 것입니다 — 끄면 다 꺼지는 줄 알면 안 되니
 * 무엇이 달라지는지 화면에 분명히 적어 둡니다.
 */
export default function LocationToggle({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="위치 공유"
        desc={`근무시간(오전 8시 ~ 밤 ${TRACK_TO_HOUR - 12}시)에만 켜집니다`}
      />
      <div className="px-4 pb-4">
        <div className="mb-3 rounded-xl bg-accent-soft px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed font-bold text-accent-deep">
            오후 {MANDATORY_TO_HOUR - 12}시까지는 꺼 두셔도 위치가 갑니다.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-accent-deep/80">
            배송 중에 사고가 나거나 급한 일이 생겼을 때 어디 계신지 바로 알아야
            해서입니다. 아래 스위치는 <b>오후 {MANDATORY_TO_HOUR - 12}시 이후</b>에만
            적용됩니다.
          </p>
        </div>
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
              {value
                ? `오후 ${MANDATORY_TO_HOUR - 12}시 이후에도 공유`
                : `오후 ${MANDATORY_TO_HOUR - 12}시까지만 공유`}
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-4">
              {value
                ? `밤 ${TRACK_TO_HOUR - 12}시까지 위치가 갑니다. 그 뒤로는 보내지 않습니다.`
                : `오후 ${MANDATORY_TO_HOUR - 12}시가 지나면 위치를 보내지 않습니다.`}
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
