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

type Mode = "single" | "bulk";
type Kind = "credit" | "cod";

export default function EntryComposer({ workDate }: { workDate: string }) {
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
          하루치 한번에
        </ModeTab>
      </div>

      <form ref={formRef} action={submit} className="space-y-4 p-4" key={resetKey}>
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
              : "하루치 저장하기"}
        </Button>

        {!canSubmit && (
          <p className="-mt-2 text-center text-[12px] text-ink-4">
            {mode === "single"
              ? "운임을 입력하면 저장할 수 있습니다."
              : "건수와 금액을 입력하면 저장할 수 있습니다."}
          </p>
        )}
      </form>
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
        "flex-1 rounded-lg py-2.5 text-[14px] font-bold transition-colors",
        active
          ? "bg-card text-ink shadow-[0_1px_3px_rgba(20,22,26,0.10)]"
          : "text-ink-4",
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
