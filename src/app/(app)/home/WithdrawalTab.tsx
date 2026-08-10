"use client";

import { useState, useTransition } from "react";
import { addWithdrawal, deleteWithdrawal } from "../withdrawal-actions";
import { Alert, Button, Field, Input, cn } from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { prettyDate, won } from "@/lib/format";
import type { Withdrawal } from "@/lib/types";

/**
 * 정산 입력 카드의 세 번째 탭.
 * 이번 주에 얼마 벌었고 얼마 찾아갔는지, 남은 게 얼마인지 한 화면에서 보고
 * 그 자리에서 출금을 기록합니다.
 */
export default function WithdrawalTab({
  workDate,
  withdrawals,
  weekTotal,
  weekWithdrawn,
  remaining,
  isLastWorkdayOfWeek,
}: {
  workDate: string;
  /** 이번 주(월~일) 출금 기록 전체 */
  withdrawals: Withdrawal[];
  weekTotal: number;
  weekWithdrawn: number;
  remaining: number;
  isLastWorkdayOfWeek: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [amount, setAmount] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [pending, startTransition] = useTransition();

  return (
    <div className="p-4">
      {/* 이번 주 세 가지 숫자 */}
      <div className="grid grid-cols-3 divide-x divide-ink/8 rounded-xl border border-ink/10 bg-paper-2/40">
        <Cell label="이번 주 매출" value={weekTotal} />
        <Cell label="출금한 금액" value={weekWithdrawn} />
        <Cell label="아직 안 찾음" value={remaining} strong />
      </div>

      {isLastWorkdayOfWeek && remaining > 0 && (
        <div className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed font-bold text-accent-deep">
            이번 주 마지막 근무일입니다. 출금하고 금액을 남겨 주세요.
          </p>
        </div>
      )}

      {/* 이번 주 출금 기록 */}
      <div className="mt-4">
        <p className="mb-2 text-[13px] font-bold text-ink-2">
          이번 주 출금 기록{" "}
          <span className="tnum font-semibold text-ink-4">
            {withdrawals.length}
          </span>
        </p>

        {withdrawals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/12 py-5 text-center text-[13px] text-ink-4">
            아직 출금 기록이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-ink/6 rounded-xl border border-ink/10">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-3.5 py-2.5 transition-opacity",
                  pending && "opacity-40",
                )}
              >
                <div className="min-w-0">
                  <p className="tnum text-[14px] font-bold">
                    {won(w.amount)}원
                    <span className="ml-1.5 text-[12px] font-semibold text-ink-4">
                      {prettyDate(w.work_date)}
                    </span>
                  </p>
                  {w.memo && (
                    <p className="mt-0.5 truncate text-[12px] text-ink-4">
                      {w.memo}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    startTransition(() => {
                      void deleteWithdrawal(w.id);
                    })
                  }
                  className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-4 transition-colors active:bg-ink/5"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 입력 */}
      <div className="mt-4">
        {open ? (
          <form
            key={resetKey}
            action={(fd) => {
              setError(undefined);
              fd.set("work_date", workDate);
              startTransition(async () => {
                const res = await addWithdrawal(fd);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setAmount(0);
                setResetKey((k) => k + 1);
                setOpen(false);
              });
            }}
            className="space-y-3"
          >
            <Field label="출금액" required hint={prettyDate(workDate)}>
              {/* 폼이 resetKey 로 다시 마운트되면서 defaultValue 를 새로 읽습니다 */}
              <MoneyInput
                name="amount"
                autoFocus
                defaultValue={amount || undefined}
                onValueChange={setAmount}
              />
            </Field>

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmount(remaining);
                  setResetKey((k) => k + 1);
                }}
                className="w-full rounded-lg border border-ink/12 bg-card py-2 text-[12px] font-bold text-ink-3 transition-colors active:bg-paper-2"
              >
                남은 금액 전부 ({won(remaining)}원) 넣기
              </button>
            )}

            <Field label="메모" optional>
              <Input name="memo" placeholder="예: 계좌이체 / 현금" maxLength={60} />
            </Field>

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
              <Button
                type="submit"
                className="flex-1"
                disabled={amount === 0 || pending}
              >
                {pending ? "저장 중…" : "출금 기록"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant={isLastWorkdayOfWeek && remaining > 0 ? "primary" : "outline"}
            size="lg"
            className="w-full"
            onClick={() => setOpen(true)}
          >
            + 출금 기록하기
          </Button>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const negative = value < 0;
  return (
    <div className="px-2.5 py-3">
      <p className="text-[11px] font-semibold text-ink-4">{label}</p>
      <p
        className={cn(
          "tnum mt-1 text-[15px] leading-tight font-extrabold",
          negative ? "text-danger" : strong ? "text-brand-600" : "text-ink",
        )}
      >
        {negative ? `−${won(-value)}` : won(value)}
        <span className="ml-0.5 text-[10px] font-semibold text-ink-4">원</span>
      </p>
    </div>
  );
}
