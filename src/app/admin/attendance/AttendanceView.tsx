"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLeave, removeLeave } from "@/app/(app)/leave-actions";
import MonthGrid, { type DayCell } from "@/components/MonthGrid";
import { Alert, Badge, Button, Card, CardHeader, cn } from "@/components/ui";
import { prettyDate, prettyMonth, won } from "@/lib/format";
import type { Profile } from "@/lib/types";

export type WorkedRow = {
  user_id: string;
  work_date: string;
  count: number;
  total: number;
};
export type AttendanceRow = {
  user_id: string;
  work_date: string;
  first_open_at: string;
};
export type LeaveRow = {
  id: string;
  user_id: string;
  leave_date: string;
  memo: string | null;
};

/** "08:12" 처럼 한국 시각으로 */
function hhmm(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function AttendanceView({
  month,
  today,
  meId,
  profiles,
  worked,
  attendance,
  leaves,
  yearLeaves,
}: {
  month: string;
  today: string;
  meId: string;
  profiles: Profile[];
  worked: WorkedRow[];
  attendance: AttendanceRow[];
  leaves: LeaveRow[];
  yearLeaves: { user_id: string; leave_date: string }[];
}) {
  const router = useRouter();
  const [who, setWho] = useState<string | null>(null); // null = 전체 보기
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const goMonth = (ym: string) => {
    setDay(null);
    router.push(`/admin/attendance?month=${ym}`);
  };

  /* ── 날짜별로 묶어 둡니다 ─────────────────────────── */
  const workedKey = useMemo(
    () => new Set(worked.map((w) => `${w.user_id}|${w.work_date}`)),
    [worked],
  );
  const openedKey = useMemo(
    () => new Map(attendance.map((a) => [`${a.user_id}|${a.work_date}`, a])),
    [attendance],
  );
  const leaveKey = useMemo(
    () => new Map(leaves.map((l) => [`${l.user_id}|${l.leave_date}`, l])),
    [leaves],
  );

  const byDate = useMemo(() => {
    const m = new Map<
      string,
      { worked: string[]; opened: string[]; leave: string[] }
    >();
    const touch = (d: string) =>
      m.get(d) ?? m.set(d, { worked: [], opened: [], leave: [] }).get(d)!;
    for (const w of worked) touch(w.work_date).worked.push(w.user_id);
    for (const a of attendance) {
      const slot = touch(a.work_date);
      if (!slot.worked.includes(a.user_id)) slot.opened.push(a.user_id);
    }
    for (const l of leaves) touch(l.leave_date).leave.push(l.user_id);
    return m;
  }, [worked, attendance, leaves]);

  const nameOf = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.name])),
    [profiles],
  );

  /* ── 달력 한 칸 ───────────────────────────────────── */
  const cell = (date: string): DayCell => {
    const future = date > today;

    if (who) {
      const k = `${who}|${date}`;
      if (leaveKey.has(k)) return { tone: "leave", mark: "월차", onClick: () => setDay(date), selected: day === date };
      if (workedKey.has(k)) return { tone: "worked", mark: "근무", onClick: () => setDay(date), selected: day === date };
      if (openedKey.has(k)) return { tone: "opened", mark: "출근", onClick: () => setDay(date), selected: day === date };
      return {
        tone: future ? undefined : "absent",
        onClick: () => setDay(date),
        selected: day === date,
      };
    }

    const d = byDate.get(date);
    const n = d?.worked.length ?? 0;
    const leaveN = d?.leave.length ?? 0;
    if (!d || (n === 0 && leaveN === 0 && (d.opened?.length ?? 0) === 0)) {
      return {
        tone: future ? undefined : "absent",
        onClick: () => setDay(date),
        selected: day === date,
      };
    }
    return {
      tone: n > 0 ? "worked" : leaveN > 0 ? "leave" : "opened",
      mark: n > 0 ? `${n}명` : leaveN > 0 ? "월차" : `${d.opened.length}명`,
      onClick: () => setDay(date),
      selected: day === date,
    };
  };

  /* ── 직원별 이번 달 집계 ──────────────────────────── */
  const perPerson = useMemo(() => {
    const year = month.slice(0, 4);
    return profiles
      .map((p) => {
        const days = worked.filter((w) => w.user_id === p.id).length;
        const opened = attendance.filter((a) => a.user_id === p.id).length;
        const leave = leaves.find((l) => l.user_id === p.id) ?? null;
        const yearUsed = yearLeaves.filter((l) => l.user_id === p.id).length;
        const total = worked
          .filter((w) => w.user_id === p.id)
          .reduce((a, w) => a + w.total, 0);
        return { p, days, opened, leave, yearUsed, year, total };
      })
      .sort((a, b) => b.days - a.days || a.p.name.localeCompare(b.p.name));
  }, [profiles, worked, attendance, leaves, yearLeaves, month]);

  const selected = day ? byDate.get(day) : undefined;
  const notCome = day
    ? profiles.filter(
        (p) =>
          !selected?.worked.includes(p.id) &&
          !selected?.opened.includes(p.id) &&
          !selected?.leave.includes(p.id),
      )
    : [];

  /* ── 오늘 현황 (맨 위 요약) ───────────────────────── */
  const todaySlot = byDate.get(today);
  const isThisMonth = today.startsWith(month);

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">출근 · 월차</h1>

      {isThisMonth && (
        <Card className="overflow-hidden">
          <div className="bg-ink px-4 py-3.5 text-paper">
            <p className="text-[12px] font-semibold text-paper/60">오늘 출근</p>
            <p className="tnum mt-1 text-[26px] leading-none font-extrabold">
              {(todaySlot?.worked.length ?? 0) + (todaySlot?.opened.length ?? 0)}
              <span className="ml-1 text-[13px] font-semibold text-paper/70">
                / {profiles.length}명
              </span>
            </p>
          </div>
          <div className="space-y-2 px-4 py-3">
            <Line
              label="앱을 켠 사람"
              names={[
                ...(todaySlot?.worked ?? []),
                ...(todaySlot?.opened ?? []),
              ].map((id) => nameOf.get(id) ?? "?")}
              tone="brand"
              empty="아직 아무도 앱을 켜지 않았습니다"
            />
            <Line
              label="마감까지 끝낸 사람"
              names={(todaySlot?.worked ?? []).map((id) => nameOf.get(id) ?? "?")}
              tone="ink"
              empty="아직 마감한 사람이 없습니다"
            />
            {(todaySlot?.leave.length ?? 0) > 0 && (
              <Line
                label="월차"
                names={(todaySlot?.leave ?? []).map((id) => nameOf.get(id) ?? "?")}
                tone="accent"
                empty=""
              />
            )}
          </div>
        </Card>
      )}

      {/* 누구를 볼지 */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          <Chip active={who === null} onClick={() => setWho(null)}>
            전체
          </Chip>
          {profiles.map((p) => (
            <Chip key={p.id} active={who === p.id} onClick={() => setWho(p.id)}>
              {p.name}
              {p.id === meId && " (나)"}
            </Chip>
          ))}
        </div>
      </div>

      <Card className={cn("p-4", pending && "opacity-50")}>
        <MonthGrid month={month} onMonthChange={goMonth} cell={cell} />

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-ink/8 pt-3">
          <Legend className="bg-brand-500" label={who ? "마감함" : "마감한 인원"} />
          <Legend className="bg-brand-100" label="앱만 켬 (마감 안 함)" />
          <Legend className="bg-accent" label="월차" />
        </div>

        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </Card>

      {/* 고른 날 자세히 */}
      {day && (
        <Card className="overflow-hidden">
          <CardHeader
            title={prettyDate(day)}
            desc={who ? nameOf.get(who) : "그날 누가 나왔는지"}
            right={
              <button
                onClick={() => setDay(null)}
                className="rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-4 active:bg-ink/5"
              >
                닫기
              </button>
            }
          />
          <div className="space-y-3 px-4 py-3.5">
            <DayGroup
              title="마감까지 끝냄"
              ids={selected?.worked ?? []}
              nameOf={nameOf}
              openedKey={openedKey}
              day={day}
              tone="worked"
            />
            <DayGroup
              title="앱은 켰는데 마감 안 함"
              ids={selected?.opened ?? []}
              nameOf={nameOf}
              openedKey={openedKey}
              day={day}
              tone="opened"
            />
            <DayGroup
              title="월차"
              ids={selected?.leave ?? []}
              nameOf={nameOf}
              openedKey={openedKey}
              day={day}
              tone="leave"
            />

            {notCome.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-ink-4">안 나옴</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {notCome.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 rounded-lg bg-ink/5 px-2 py-1 text-[12px] font-semibold text-ink-3"
                    >
                      {p.name}
                      <button
                        title="이 사람 월차로 등록"
                        onClick={() =>
                          startTransition(async () => {
                            setError(undefined);
                            const fd = new FormData();
                            fd.set("leave_date", day);
                            fd.set("user_id", p.id);
                            const res = await addLeave(fd);
                            if (!res.ok) setError(res.error);
                          })
                        }
                        className="text-[11px] font-bold text-brand-600"
                      >
                        + 월차
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 직원별 현황 */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`${prettyMonth(month)} 직원별 현황`}
          desc="출근 일수는 하루 마감을 한 날로 셉니다"
        />
        <ul className="divide-y divide-ink/6">
          {perPerson.map(({ p, days, opened, leave, yearUsed, year, total }) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold">{p.name}</span>
                {p.id === meId && <Badge tone="brand">나</Badge>}
                {/* 아직 안 쓴 건 정상이라 눈에 띄게 하지 않습니다 */}
                {leave ? (
                  <Badge tone="brand">{prettyDate(leave.leave_date)} 월차</Badge>
                ) : (
                  <Badge>월차 아직</Badge>
                )}
                <span className="tnum ml-auto text-[15px] font-extrabold">
                  {days}
                  <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                    일
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="tnum text-[12px] text-ink-4">
                  {won(total)}원
                  {opened > days && ` · 앱만 켠 날 ${opened - days}일`}
                  {` · ${year}년 월차 ${yearUsed}회`}
                </p>
                {leave && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        setError(undefined);
                        const res = await removeLeave(leave.id);
                        if (!res.ok) setError(res.error);
                      })
                    }
                    className="ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-ink-4 active:bg-ink/5"
                  >
                    월차 취소
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-ink-4">
        달력에서 날짜를 누르면 그날 누가 나왔는지 볼 수 있습니다.
        <br />
        안 나온 사람 옆 &lsquo;+ 월차&rsquo; 를 누르면 대신 등록됩니다.
      </p>
    </div>
  );
}

/* ── 작은 조각들 ────────────────────────────────────── */

function Chip({
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
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors",
        active
          ? "bg-ink text-paper"
          : "border border-ink/12 bg-card text-ink-3 active:bg-paper-2",
      )}
    >
      {children}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-4">
      <span className={`h-2.5 w-2.5 rounded-[4px] ${className}`} />
      {label}
    </span>
  );
}

function Line({
  label,
  names,
  tone,
  empty,
}: {
  label: string;
  names: string[];
  tone: "brand" | "ink" | "accent";
  empty: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-bold text-ink-4">
        {label} <span className="tnum">{names.length}</span>
      </p>
      {names.length === 0 ? (
        <p className="mt-0.5 text-[12px] text-ink-4">{empty}</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {names.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className={cn(
                "rounded-lg px-2 py-1 text-[12px] font-bold",
                tone === "brand" && "bg-brand-50 text-brand-700",
                tone === "ink" && "bg-ink text-paper",
                tone === "accent" && "bg-accent-soft text-accent-deep",
              )}
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DayGroup({
  title,
  ids,
  nameOf,
  openedKey,
  day,
  tone,
}: {
  title: string;
  ids: string[];
  nameOf: Map<string, string>;
  openedKey: Map<string, AttendanceRow>;
  day: string;
  tone: "worked" | "opened" | "leave";
}) {
  if (ids.length === 0) return null;
  return (
    <div>
      <p className="text-[12px] font-bold text-ink-4">
        {title} <span className="tnum">{ids.length}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const a = openedKey.get(`${id}|${day}`);
          return (
            <span
              key={id}
              className={cn(
                "rounded-lg px-2 py-1 text-[12px] font-bold",
                tone === "worked" && "bg-brand-500 text-white",
                tone === "opened" && "bg-brand-100 text-brand-700",
                tone === "leave" && "bg-accent text-ink",
              )}
            >
              {nameOf.get(id) ?? "?"}
              {a && (
                <span className="tnum ml-1 text-[10px] font-semibold opacity-75">
                  {hhmm(a.first_open_at)}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
