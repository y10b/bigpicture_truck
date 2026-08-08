"use client";

import { useState, useTransition } from "react";
import { addWithdrawal, deleteWithdrawal } from "../withdrawal-actions";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  cn,
} from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { prettyDate, won } from "@/lib/format";
import type { Withdrawal } from "@/lib/types";

export default function WithdrawalPanel({
  workDate,
  withdrawals,
  remaining,
  isLastWorkdayOfWeek,
}: {
  workDate: string;
  withdrawals: Withdrawal[];
  /** 이번 주 아직 안 찾은 금액 */
  remaining: number;
  isLastWorkdayOfWeek: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [amount, setAmount] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const dayTotal = withdrawals.reduce((a, w) => a + w.amount, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="출금"
        desc={
          isLastWorkdayOfWeek
            ? "이번 주 마지막 근무일입니다 — 출금하고 기록해 주세요"
            : "출금하셨다면 금액을 남겨 주세요"
        }
        right={
          dayTotal > 0 ? (
            <span className="tnum shrink-0 text-[15px] font-extrabold">
              {won(dayTotal)}
              <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
            </span>
          ) : null
        }
      />

      {/* 이번 주 남은 금액 안내 */}
      <div
        className={cn(
          "mx-4 mb-3 rounded-xl px-3.5 py-2.5",
          isLastWorkdayOfWeek && remaining > 0
            ? "bg-accent-soft"
            : "bg-paper-2/70",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-semibold text-ink-3">
            이번 주 아직 안 찾은 금액
          </span>
          <span
            className={cn(
              "tnum text-[16px] font-extrabold",
              remaining < 0 ? "text-danger" : "text-ink",
            )}
          >
            {remaining < 0 ? `−${won(-remaining)}` : won(remaining)}
            <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
          </span>
        </div>
      </div>

      {/* 기록된 출금 */}
      {withdrawals.length > 0 && (
        <ul className="divide-y divide-ink/6 border-t border-ink/8">
          {withdrawals.map((w) => (
            <li
              key={w.id}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-2.5 transition-opacity",
                pending && "opacity-40",
              )}
            >
              <div className="min-w-0">
                <p className="tnum text-[14px] font-bold">{won(w.amount)}원</p>
                {w.memo && (
                  <p className="mt-0.5 truncate text-[12px] text-ink-4">{w.memo}</p>
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

      {/* 입력 */}
      <div className="border-t border-ink/8 p-4">
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
    </Card>
  );
}
