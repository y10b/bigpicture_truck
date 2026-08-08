"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/app/(app)/me/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SetupForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const tooShort = pw.length > 0 && pw.length < 6;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 6 && pw === confirm && !pending;

  useEffect(() => {
    if (done) router.replace("/");
  }, [done, router]);

  return (
    <form
      action={(fd) => {
        setError(undefined);
        startTransition(async () => {
          const res = await changePasswordAction({}, fd);
          if (res.error) setError(res.error);
          else setDone(true);
        });
      }}
      className="space-y-3.5"
    >
      <Field label="새 비밀번호" required hint="6자 이상">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {tooShort && (
          <span className="mt-1 block text-[12px] font-medium text-danger">
            6자 이상으로 정해 주세요.
          </span>
        )}
      </Field>

      <Field label="새 비밀번호 확인" required>
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && (
          <span className="mt-1 block text-[12px] font-medium text-danger">
            두 비밀번호가 서로 다릅니다.
          </span>
        )}
      </Field>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {pending ? "저장 중…" : done ? "완료!" : "이 비밀번호로 시작하기"}
      </Button>
    </form>
  );
}
