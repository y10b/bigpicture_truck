"use client";

import { useRef, useState, useTransition } from "react";
import { addBulkEntry, addSingleEntry } from "../entry-actions";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  RequiredLegend,
  cn,
} from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { won } from "@/lib/format";
import type { Withdrawal } from "@/lib/types";
import WithdrawalTab from "./WithdrawalTab";

type Mode = "single" | "bulk" | "withdraw";
type Kind = "credit" | "cod";

export default function EntryComposer({
  workDate,
  withdrawals,
  weekTotal,
  weekWithdrawn,
  remaining,
  isLastWorkdayOfWeek,
}: {
  workDate: string;
  withdrawals: Withdrawal[];
  weekTotal: number;
  weekWithdrawn: number;
  remaining: number;
  isLastWorkdayOfWeek: boolean;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [kind, setKind] = useState<Kind>("credit");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showExtra, setShowExtra] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // 버튼 활성화 판단에 쓰는 현재 입력값
  const [amount, setAmount] = useState(0); // 건별 운임
  const [extra, setExtra] = useState(0);
  const [count, setCount] = useState(0); // 일괄 건수
  const [credit, setCredit] = useState(0);
  const [cod, setCod] = useState(0);

  const clear = () => {
    setAmount(0);
    setExtra(0);
    setCount(0);
    setCredit(0);
    setCod(0);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(undefined);
    clear();
    setResetKey((k) => k + 1);
  };

  // 건별은 운임이, 일괄은 건수와 금액이 있어야 저장할 수 있습니다.
  const canSubmit =
    mode === "single" ? amount > 0 : count > 0 && credit + cod + extra > 0;

  const previewTotal =
    mode === "single" ? amount + extra : credit + cod + extra;

  function submit(formData: FormData) {
    setError(undefined);
    formData.set("work_date", workDate);
    if (mode === "single") formData.set("kind", kind);

    startTransition(async () => {
      const run = mode === "single" ? addSingleEntry : addBulkEntry;
      const res = await run(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      formRef.current?.reset();
      clear();
      // MoneyInput 은 내부 state 라서 key 를 바꿔 초기화합니다.
      setResetKey((k) => k + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <Card className="overflow-hidden">
      {/* 입력 방식 전환 */}
      <div className="flex gap-1 border-b border-ink/8 bg-paper-2/60 p-1.5">
        <ModeTab active={mode === "single"} onClick={() => switchMode("single")}>
          건별 입력
        </ModeTab>
        <ModeTab active={mode === "bulk"} onClick={() => switchMode("bulk")}>
          하루 마감
        </ModeTab>
        <ModeTab active={mode === "withdraw"} onClick={() => switchMode("withdraw")}>
          일주일 출금
        </ModeTab>
      </div>

      {mode === "withdraw" && (
        <WithdrawalTab
          workDate={workDate}
          withdrawals={withdrawals}
          weekTotal={weekTotal}
          weekWithdrawn={weekWithdrawn}
          remaining={remaining}
          isLastWorkdayOfWeek={isLastWorkdayOfWeek}
        />
      )}

      {mode !== "withdraw" && (
      <form ref={formRef} action={submit} className="space-y-4 p-4" key={resetKey}>
        {/* 두 방식이 같은 것이라는 걸 안 적어두면 뭘 골라야 하나 고민하게 됩니다 */}
        <div className="rounded-xl bg-paper-2/70 px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            <b>건별 입력</b>과 <b>하루 마감</b>은 적는 방법만 다르고{" "}
            <b className="text-brand-600">결과는 똑같습니다.</b> 편한 쪽으로 쓰시면
            됩니다.
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
            {mode === "single"
              ? "지금은 건별 입력 — 한 건 끝날 때마다 바로 적는 방식입니다."
              : "지금은 하루 마감 — 일 다 끝내고 하루치를 한 번에 적는 방식입니다."}
          </p>
        </div>

        <RequiredLegend />

        {mode === "single" ? (
          <>
            <div>
              <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
                결제 구분 <span className="text-danger">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <KindChip
                  active={kind === "credit"}
                  onClick={() => setKind("credit")}
                  dot="bg-brand-400"
                >
                  신용
                </KindChip>
                <KindChip
                  active={kind === "cod"}
                  onClick={() => setKind("cod")}
                  dot="bg-accent"
                >
                  착불
                </KindChip>
              </div>
            </div>

            <Field label="운임" required hint="이 건의 금액">
              <MoneyInput name="amount" onValueChange={setAmount} />
            </Field>

            <Field label="추가금" optional hint="대기료 등">
              <MoneyInput name="extra" onValueChange={setExtra} />
            </Field>
          </>
        ) : (
          <>
            <Field label="건수" required hint="오늘 총 몇 건">
              <div className="relative">
                <Input
                  name="count"
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
                    e.target.value = digits;
                    setCount(digits ? Number(digits) : 0);
                  }}
                  className="tnum pr-9 text-right text-[17px] font-semibold"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] font-medium text-ink-4">
                  건
                </span>
              </div>
            </Field>

            <div>
              <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
                금액 <span className="text-danger">*</span>
                <span className="ml-1 text-[12px] font-normal text-ink-4">
                  신용·착불 중 하나 이상
                </span>
              </span>
              <div className="grid grid-cols-2 gap-3">
                <Field label="신용">
                  <MoneyInput name="credit" onValueChange={setCredit} />
                </Field>
                <Field label="착불">
                  <MoneyInput name="cod" onValueChange={setCod} />
                </Field>
              </div>
            </div>

            <Field label="추가금 합계" optional>
              <MoneyInput name="extra" onValueChange={setExtra} />
            </Field>
          </>
        )}

        <Field label="메모" optional>
          <Input name="memo" placeholder="예: 부산 왕복 / 대기 30분" maxLength={100} />
        </Field>

        {/* 지출·운행시간은 순전히 선택입니다. 안 적어도 정산은 그대로 됩니다. */}
        <div className="rounded-xl border border-ink/10 bg-paper-2/40">
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
                지출 · 운행시간
                <span className="rounded px-1 py-px text-[11px] font-bold text-ink-4 ring-1 ring-ink/10">
                  선택
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-4">
                적으면 AI가 그날 운행이 효율적이었는지 알려줍니다. 안 적어도
                정산에는 지장 없습니다.
              </span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "shrink-0 text-ink-4 transition-transform",
                showExtra && "rotate-180",
              )}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showExtra && (
            <div className="grid grid-cols-2 gap-3 border-t border-ink/8 p-3.5">
              <Field label="지출" hint="충전·주유·톨">
                <MoneyInput name="expense" />
              </Field>
              <Field label="운행시간">
                <div className="relative">
                  <Input
                    name="minutes"
                    inputMode="numeric"
                    placeholder="0"
                    onChange={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
                    }}
                    className="tnum pr-9 text-right text-[17px] font-semibold"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] font-medium text-ink-4">
                    분
                  </span>
                </div>
              </Field>
            </div>
          )}
        </div>

        {/* 저장하기 전에 합계를 미리 보여줍니다 */}
        <div className="flex items-baseline justify-between rounded-xl bg-paper-2/70 px-3.5 py-3">
          <span className="text-[13px] font-semibold text-ink-3">합계</span>
          <span className="tnum text-[19px] font-extrabold">
            {won(previewTotal)}
            <span className="ml-0.5 text-[13px] font-semibold text-ink-4">원</span>
          </span>
        </div>

        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="brand">저장했습니다 👍</Alert>}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit || pending}
        >
          {pending
            ? "저장 중…"
            : mode === "single"
              ? "이 건 추가하기"
              : "하루 마감 저장하기"}
        </Button>

        {!canSubmit && (
          <p className="-mt-2 text-center text-[12px] text-ink-4">
            {mode === "single"
              ? "운임을 입력하면 저장할 수 있습니다."
              : "건수와 금액을 입력하면 저장할 수 있습니다."}
          </p>
        )}
      </form>
      )}
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg py-2.5 text-[13px] font-bold whitespace-nowrap transition-colors",
        // 지금 어느 탭에 있는지 글자색과 테두리로 바로 알 수 있게 합니다.
        "border",
        active
          ? "border-brand-400 bg-card text-brand-600 shadow-[0_1px_3px_rgba(20,22,26,0.10)]"
          : "border-transparent text-ink-4",
      )}
    >
      {children}
    </button>
  );
}

function KindChip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-[15px] font-bold transition-all",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-ink/10 bg-card text-ink-3",
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
      {children}
    </button>
  );
}
