"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMember, type MemberState } from "../member-actions";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  RequiredLegend,
  cn,
} from "@/components/ui";
import TempPasswordBox from "@/components/TempPasswordBox";

function hyphenate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={disabled || pending}>
      {pending ? "만드는 중…" : "계정 만들기"}
    </Button>
  );
}

export default function MemberCreateForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<MemberState, FormData>(createMember, {});

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [autoPw, setAutoPw] = useState(true);
  const [password, setPassword] = useState("");

  const phoneDigits = phone.replace(/\D/g, "");
  const nameOk = name.trim().length > 0;
  const phoneOk = phoneDigits.length >= 10;
  const pwOk = autoPw || password.length >= 6;
  const canSubmit = nameOk && phoneOk && pwOk;

  // 만들고 나면 폼을 접고 발급 결과만 보여줍니다.
  useEffect(() => {
    if (!state.ok) return;
    setName("");
    setPhone("");
    setPassword("");
    setRole("employee");
    setAutoPw(true);
    setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <div className="space-y-2.5">
        {state.ok && state.tempPassword && (
          <TempPasswordBox password={state.tempPassword} />
        )}
        {state.ok && state.message && !state.tempPassword && (
          <Alert tone="brand">{state.message}</Alert>
        )}
        <Button variant="dark" size="lg" className="w-full" onClick={() => setOpen(true)}>
          + 직원 계정 추가
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <form action={action} className="space-y-3.5">
        <RequiredLegend />

        <Field label="이름" required>
          <Input
            name="name"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="휴대폰번호" required hint="로그인 아이디">
          <Input
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(hyphenate(e.target.value))}
            className="tnum"
          />
          {phone.length > 0 && !phoneOk && (
            <span className="mt-1 block text-[12px] font-medium text-danger">
              번호를 끝까지 입력해 주세요.
            </span>
          )}
        </Field>

        <div>
          <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
            권한 <span className="text-danger">*</span>
          </span>
          <input type="hidden" name="role" value={role} />
          <div className="grid grid-cols-2 gap-2">
            {(["employee", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "h-11 rounded-xl border-2 text-[14px] font-bold transition-all",
                  role === r
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink/10 bg-card text-ink-3",
                )}
              >
                {r === "employee" ? "직원" : "관리자"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
            초기 비밀번호 <span className="text-danger">*</span>
          </span>
          <label className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-paper-2/50 px-3.5 py-3">
            <input
              type="checkbox"
              checked={autoPw}
              onChange={(e) => setAutoPw(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-brand-500)]"
            />
            <span className="text-[14px] font-semibold">
              임시 비밀번호 자동 발급
            </span>
          </label>

          {autoPw ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
              만들고 나면 화면에 임시 비밀번호가 뜹니다. 직원에게 알려주시면
              됩니다.
            </p>
          ) : (
            <div className="mt-2">
              <Input
                name="password"
                placeholder="6자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {password.length > 0 && password.length < 6 && (
                <span className="mt-1 block text-[12px] font-medium text-danger">
                  6자 이상으로 정해 주세요.
                </span>
              )}
            </div>
          )}
        </div>

        <Field label="메모" optional hint="차량번호 등">
          <Input name="memo" placeholder="예: 12가3456 / 1톤" maxLength={60} />
        </Field>

        {state.error && <Alert>{state.error}</Alert>}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            취소
          </Button>
          <div className="flex-1">
            <Submit disabled={!canSubmit} />
          </div>
        </div>
      </form>
    </Card>
  );
}
