"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function hyphenate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "확인 중…" : "로그인"}
    </Button>
  );
}

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {
    error: initialError,
  });
  const [phone, setPhone] = useState("");

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label="휴대폰번호">
          <Input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(hyphenate(e.target.value))}
            className="tnum tracking-wide"
          />
        </Field>

        <Field label="비밀번호">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
          />
        </Field>

        {state.error && <Alert>{state.error}</Alert>}

        <SubmitButton />
      </form>
    </Card>
  );
}
