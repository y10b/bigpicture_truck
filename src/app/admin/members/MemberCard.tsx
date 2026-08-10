"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteMember,
  resetMemberPassword,
  setMemberActive,
  setMemberRole,
  updateMember,
} from "../member-actions";
import { Alert, Badge, Button, Card, Field, Input, cn } from "@/components/ui";
import TempPasswordBox from "@/components/TempPasswordBox";
import { prettyPhone, won } from "@/lib/format";
import type { Profile } from "@/lib/types";
import type { Settlement } from "@/lib/settlement";

export default function MemberCard({
  profile,
  stat,
  isMe,
}: {
  profile: Profile;
  /** 이번 달 정산 요약 (기록이 없으면 undefined) */
  stat?: Settlement;
  isMe: boolean;
}) {
  const [panel, setPanel] = useState<
    null | "edit" | "password" | "delete" | "role"
  >(null);
  const [issued, setIssued] = useState<string>();
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(undefined), 2500);
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        !profile.active && "opacity-70",
        // 목록에서 내 계정을 한눈에 찾을 수 있게 테두리를 살립니다.
        isMe && "border-brand-400 ring-1 ring-brand-400/30",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Link
          href={`/admin/members/${profile.id}`}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-extrabold text-white",
            profile.active ? "bg-brand-500" : "bg-ink-4",
          )}
        >
          {profile.name.slice(-2)}
        </Link>

        <Link href={`/admin/members/${profile.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-extrabold">{profile.name}</span>
            {isMe && <Badge tone="accent">나</Badge>}
            {profile.role === "admin" && <Badge tone="brand">관리자</Badge>}
            {!profile.active && <Badge tone="danger">비활성</Badge>}
            {profile.must_change_password && <Badge tone="accent">임시 비번</Badge>}
          </div>
          <p className="tnum mt-0.5 text-[12px] text-ink-3">
            {prettyPhone(profile.phone)}
          </p>
          {(profile.vehicle_no || profile.vehicle_type) && (
            <p className="mt-0.5 truncate text-[12px] text-ink-4">
              🚚 {[profile.vehicle_no, profile.vehicle_type].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.bank_account && (
            <p className="tnum mt-0.5 truncate text-[12px] text-ink-4">
              💳 {profile.bank_account}
            </p>
          )}
          {profile.memo && (
            <p className="mt-0.5 truncate text-[12px] text-ink-4">{profile.memo}</p>
          )}
          {stat && stat.total > 0 ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="tnum text-[12px] font-bold text-ink-2">
                이번 달 {won(stat.total)}원
                <span className="font-semibold text-ink-4">
                  {" "}
                  · {stat.workedDays}일 근무
                </span>
              </p>
              <p className="tnum text-[12px] font-semibold text-ink-3">
                출금 {won(stat.withdrawn)}원
              </p>
              <p
                className={cn(
                  "tnum text-[12px] font-bold",
                  stat.remaining < 0 ? "text-danger" : "text-ink-3",
                )}
              >
                미출금 {stat.remaining < 0 ? `−${won(-stat.remaining)}` : won(stat.remaining)}원
              </p>
            </div>
          ) : (
            <p className="mt-1.5 text-[12px] font-semibold text-ink-4">
              이번 달 기록 없음
            </p>
          )}
        </Link>
      </div>

      {/* 관리 버튼 */}
      <div className="flex divide-x divide-ink/8 border-t border-ink/8 text-[12px] font-bold text-ink-3">
        <button
          className="flex-1 py-2.5 transition-colors active:bg-paper-2"
          onClick={() => setPanel(panel === "edit" ? null : "edit")}
        >
          정보 수정
        </button>
        <button
          className="flex-1 py-2.5 transition-colors active:bg-paper-2"
          onClick={() => setPanel(panel === "password" ? null : "password")}
        >
          비밀번호
        </button>
        <button
          disabled={isMe}
          className="flex-1 py-2.5 transition-colors active:bg-paper-2 disabled:opacity-35"
          onClick={() => setPanel(panel === "role" ? null : "role")}
        >
          권한
        </button>
      </div>

      <div className="flex divide-x divide-ink/8 border-t border-ink/8 text-[12px] font-bold text-ink-3">
        <button
          disabled={isMe || pending}
          className="flex-1 py-2.5 transition-colors active:bg-paper-2 disabled:opacity-35"
          onClick={() =>
            startTransition(async () => {
              const res = await setMemberActive(profile.id, !profile.active);
              if (res.ok) flash(profile.active ? "비활성 처리했습니다." : "다시 활성화했습니다.");
              else setError(res.error);
            })
          }
        >
          {profile.active ? "비활성" : "활성화"}
        </button>
        <button
          disabled={isMe}
          className="flex-1 py-2.5 text-danger transition-colors active:bg-danger-soft disabled:opacity-35"
          onClick={() => setPanel(panel === "delete" ? null : "delete")}
        >
          삭제
        </button>
      </div>

      {(note || error) && (
        <div className="px-4 pt-3">
          {note && <Alert tone="brand">{note}</Alert>}
          {error && <Alert>{error}</Alert>}
        </div>
      )}

      {panel === "edit" && (
        <div className="border-t border-ink/8 bg-paper-2/50 p-4">
          <form
            action={(fd) => {
              fd.set("id", profile.id);
              startTransition(async () => {
                const res = await updateMember(fd);
                if (res.ok) {
                  setPanel(null);
                  flash("수정했습니다.");
                } else setError(res.error);
              });
            }}
            className="space-y-3"
          >
            <Field label="이름" required>
              <Input name="name" defaultValue={profile.name} />
            </Field>

            <Field label="휴대폰번호" required hint="로그인 아이디">
              <Input
                name="phone"
                type="tel"
                inputMode="numeric"
                defaultValue={prettyPhone(profile.phone)}
                className="tnum"
              />
              <span className="mt-1 block text-[12px] leading-relaxed text-ink-4">
                업무용 폰 말고 <b className="text-ink-3">본인 실제 번호</b>로 두세요.
                바꾸면 다음 로그인부터 새 번호를 씁니다.
              </span>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="차량번호" optional>
                <Input
                  name="vehicle_no"
                  defaultValue={profile.vehicle_no ?? ""}
                  placeholder="12가3456"
                  maxLength={20}
                />
              </Field>
              <Field label="차종" optional>
                <Input
                  name="vehicle_type"
                  defaultValue={profile.vehicle_type ?? ""}
                  placeholder="1톤 냉장"
                  maxLength={30}
                />
              </Field>
            </div>

            <Field label="계좌" optional hint="급여 입금용">
              <Input
                name="bank_account"
                defaultValue={profile.bank_account ?? ""}
                placeholder="국민 123456-01-234567"
                maxLength={60}
              />
            </Field>

            <Field label="메모" optional>
              <Input name="memo" defaultValue={profile.memo ?? ""} maxLength={60} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setPanel(null)}>
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                저장
              </Button>
            </div>
          </form>
        </div>
      )}

      {panel === "password" && (
        <div className="border-t border-ink/8 bg-paper-2/50 p-4">
          <PasswordPanel
            name={profile.name}
            issued={issued}
            pending={pending}
            onCancel={() => {
              setPanel(null);
              setIssued(undefined);
            }}
            onReset={(pw) =>
              startTransition(async () => {
                setError(undefined);
                const res = await resetMemberPassword(profile.id, pw);
                if (res.ok) setIssued(res.tempPassword);
                else setError(res.error);
              })
            }
          />
        </div>
      )}

      {panel === "role" && (
        <div className="border-t border-ink/8 bg-paper-2/50 p-4">
          <p className="text-[13px] leading-relaxed text-ink-3">
            지금은 <b>{profile.role === "admin" ? "관리자" : "직원"}</b>입니다.
            {profile.role === "employee"
              ? " 관리자로 올리면 전 직원의 정산과 공지를 관리할 수 있게 됩니다."
              : " 직원으로 내리면 관리자 화면에 못 들어갑니다. 본인 정산 입력은 그대로 됩니다."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPanel(null)}>
              취소
            </Button>
            <Button
              variant={profile.role === "employee" ? "primary" : "outline"}
              className="flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(undefined);
                  const next = profile.role === "admin" ? "employee" : "admin";
                  const res = await setMemberRole(profile.id, next);
                  if (res.ok) {
                    setPanel(null);
                    flash(
                      next === "admin"
                        ? "관리자로 변경했습니다."
                        : "직원으로 변경했습니다.",
                    );
                  } else setError(res.error);
                })
              }
            >
              {profile.role === "admin" ? "직원으로 내리기" : "관리자로 올리기"}
            </Button>
          </div>
        </div>
      )}

      {panel === "delete" && (
        <div className="border-t border-ink/8 bg-danger-soft/60 p-4">
          <p className="text-[13px] leading-relaxed font-semibold text-danger">
            {profile.name}님의 계정과 <b>모든 정산 내역</b>이 영구 삭제됩니다.
            <br />
            그만두신 분이면 삭제 대신 <b>비활성</b>을 권합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPanel(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteMember(profile.id);
                  if (!res.ok) setError(res.error);
                })
              }
            >
              영구 삭제
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PasswordPanel({
  name,
  issued,
  pending,
  onCancel,
  onReset,
}: {
  name: string;
  issued?: string;
  pending: boolean;
  onCancel: () => void;
  onReset: (pw?: string) => void;
}) {
  const [manual, setManual] = useState(false);
  const [pw, setPw] = useState("");

  // 발급이 끝나면 결과만 보여줍니다.
  if (issued) {
    return (
      <div className="space-y-3">
        <TempPasswordBox password={issued} name={name} />
        <Button variant="outline" className="w-full" onClick={onCancel}>
          확인했습니다
        </Button>
      </div>
    );
  }

  if (manual) {
    return (
      <div className="space-y-3">
        <Field label="새 비밀번호" required hint="6자 이상">
          <Input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="직원에게 알려줄 비밀번호"
            autoFocus
          />
        </Field>
        <p className="text-[12px] text-ink-4">
          직원이 로그인하면 본인 비밀번호를 정하는 화면이 먼저 뜹니다.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setManual(false)}>
            뒤로
          </Button>
          <Button
            className="flex-1"
            disabled={pending || pw.length < 6}
            onClick={() => onReset(pw)}
          >
            {pending ? "변경 중…" : "변경"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[13px] leading-relaxed text-ink-3">
        비밀번호를 잊으셨나요? 임시 비밀번호를 새로 발급해 알려주세요.
      </p>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => onReset()}
      >
        {pending ? "발급 중…" : "임시 비밀번호 발급"}
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          취소
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setManual(true)}>
          직접 정하기
        </Button>
      </div>
    </div>
  );
}
