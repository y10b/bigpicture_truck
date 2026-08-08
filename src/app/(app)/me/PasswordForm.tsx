"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type PwState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? "변경 중…" : "비밀번호 변경"}
    </Button>
  );
}

export default function PasswordForm() {
  const [state, action] = useActionState<PwState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <Field label="새 비밀번호" hint="6자 이상">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="새 비밀번호 확인">
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="brand">비밀번호를 변경했습니다.</Alert>}
      <Submit />
    </form>
  );
}
