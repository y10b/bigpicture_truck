"use client";

import { useActionState, useEffect, useState } from "react";
import { updateMyInfoAction, type InfoState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Profile } from "@/lib/types";

/**
 * 차량·계좌는 본인이 제일 정확히 압니다.
 * 평소에는 읽기로 두고, 고칠 때만 칸이 열리게 합니다 —
 * 늘 입력칸이 떠 있으면 실수로 지워지는 일이 생깁니다.
 */
export default function MyInfoForm({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<InfoState, FormData>(
    updateMyInfoAction,
    {},
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const has =
    profile.vehicle_no || profile.vehicle_type || profile.bank_account;

  if (!editing) {
    return (
      <div className="mt-4 border-t border-ink/8 pt-4">
        {has ? (
          <dl className="space-y-2">
            {(profile.vehicle_no || profile.vehicle_type) && (
              <Row
                label="차량"
                value={[profile.vehicle_no, profile.vehicle_type]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
            {profile.bank_account && (
              <Row label="계좌" value={profile.bank_account} tnum />
            )}
          </dl>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-4">
            차량번호와 계좌를 넣어 두시면 정산할 때 확인이 빨라집니다.
          </p>
        )}

        <button
          onClick={() => setEditing(true)}
          className="mt-3 w-full rounded-xl border border-ink/12 py-2.5 text-[13px] font-bold text-ink-3 transition-colors active:bg-paper-2"
        >
          {has ? "차량 · 계좌 고치기" : "차량 · 계좌 입력하기"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-ink/8 pt-4">
      <Field label="차량번호" optional>
        <Input
          name="vehicle_no"
          defaultValue={profile.vehicle_no ?? ""}
          placeholder="예: 서울89자6412"
          maxLength={20}
          autoFocus
        />
      </Field>

      <Field label="차종" optional>
        <Input
          name="vehicle_type"
          defaultValue={profile.vehicle_type ?? ""}
          placeholder="예: 1톤 냉장"
          maxLength={30}
        />
      </Field>

      <Field label="계좌" optional hint="급여를 받으실 계좌입니다">
        <Input
          name="bank_account"
          defaultValue={profile.bank_account ?? ""}
          placeholder="예: 국민 123456-78-901234"
          maxLength={60}
        />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setEditing(false)}
        >
          취소
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  tnum,
}: {
  label: string;
  value: string;
  tnum?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[12px] font-semibold text-ink-4">{label}</dt>
      <dd
        className={`truncate text-[13px] font-semibold ${tnum ? "tnum" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
