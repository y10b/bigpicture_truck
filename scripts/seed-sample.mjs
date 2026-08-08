#!/usr/bin/env node
/**
 * 화면 확인용 샘플 직원 + 한 달치 정산 데이터를 넣습니다.
 *
 *   node scripts/seed-sample.mjs           # 넣기
 *   node scripts/seed-sample.mjs --clean   # 샘플 전부 지우기
 *
 * 샘플 계정은 010-9000-000X 로만 만들기 때문에,
 * 실제 직원 계정과 섞일 일이 없고 --clean 으로 깨끗이 지워집니다.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLEAN = process.argv.includes("--clean");

/* ── 환경변수 ────────────────────────────────────────── */
const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "bigpicture.local";
if (!URL || !KEY) {
  console.error("✖ .env.local 에 Supabase 설정이 없습니다.");
  process.exit(1);
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const api = async (p, init = {}) => {
  const res = await fetch(`${URL}${p}`, { ...init, headers: { ...H, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${p} → ${res.status}\n${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
};

/* ── 샘플 직원 ───────────────────────────────────────── */
const SAMPLES = [
  { name: "김성호", phone: "01090000001", memo: "12가3456 / 1톤", temp: false },
  { name: "박준영", phone: "01090000002", memo: "34나7890 / 1.4톤", temp: false },
  // 이 분은 임시 비밀번호 상태 그대로 둡니다 (강제 변경 화면 확인용)
  { name: "이태우", phone: "01090000003", memo: "56다1234 / 2.5톤", temp: true },
];
const SAMPLE_PASSWORD = "bp111111";

/* ── 정리 ────────────────────────────────────────────── */
async function clean() {
  console.log("▸ 샘플 계정 정리");
  const users = await api(`/auth/v1/admin/users?page=1&per_page=500`);
  let removed = 0;
  for (const s of SAMPLES) {
    const u = users.users?.find((x) => x.email === `${s.phone}@${DOMAIN}`);
    if (!u) continue;
    // profiles / entries 는 on delete cascade 로 같이 지워집니다.
    await api(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    console.log(`  ✓ ${s.name} 삭제`);
    removed++;
  }
  console.log(removed ? `\n샘플 ${removed}명과 정산 내역을 지웠습니다.\n` : "\n지울 샘플이 없습니다.\n");
}

/* ── 날짜 유틸 (한국 시간 기준) ───────────────────────── */
const todayKST = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 월요일 시작 기준 그 주의 월요일 */
const startOfWeek = (date) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
};

/** 평일(월~금)이면 상납금 대상 */
const isLevyDay = (date) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};
const WEEKDAY_LEVY = 100_000;

/* ── 무작위 ──────────────────────────────────────────── */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
/** 운임은 천원 단위로 떨어지게 */
const fare = () => rand(20, 60) * 1000;
const chance = (p) => Math.random() < p;

/**
 * 하루치 정산을 만듭니다.
 * 신용 · 착불 · 추가금이 골고루 섞이고, 하루 합계는 반드시 25만원을 넘깁니다.
 */
function buildDay(userId, workDate) {
  const MIN_TOTAL = 250_000;
  // 실제 운임처럼 천원 단위로 떨어지게. 날마다 편차는 크게.
  const target = rand(MIN_TOTAL / 1000, 720) * 1000;
  const rows = [];
  let total = 0;

  // 다섯 날에 한 번쯤은 "하루치 한번에" 방식으로 적은 것처럼
  if (chance(0.18)) {
    const count = rand(7, 16);
    const credit = Math.round((target * rand(45, 65)) / 100 / 1000) * 1000;
    const cod = Math.round(((target - credit) * rand(70, 95)) / 100 / 1000) * 1000;
    // 남은 금액을 추가금으로 (천원 단위 유지)
    const extra = Math.max(0, Math.round((target - credit - cod) / 1000) * 1000);
    rows.push({
      user_id: userId,
      work_date: workDate,
      mode: "bulk",
      count,
      credit,
      cod,
      extra,
      memo: chance(0.3) ? "하루치 정산" : null,
    });
    return rows;
  }

  // 기본은 건별 입력
  const MEMOS = [
    null, null, null, null,
    "대기 30분", "왕복", "새벽 배송", "냉장", "파렛트 2개", "지방 장거리",
  ];

  while (total < MIN_TOTAL || (total < target && rows.length < 18)) {
    const isCredit = chance(0.55); // 신용이 조금 더 많게
    const amount = fare();
    const extra = chance(0.32) ? rand(5, 20) * 1000 : 0;

    rows.push({
      user_id: userId,
      work_date: workDate,
      mode: "single",
      count: 1,
      credit: isCredit ? amount : 0,
      cod: isCredit ? 0 : amount,
      extra,
      memo: MEMOS[rand(0, MEMOS.length - 1)],
    });
    total += amount + extra;
  }

  return rows;
}

/* ── 시드 ────────────────────────────────────────────── */
async function seed() {
  console.log("▸ 기존 샘플이 있으면 먼저 정리");
  await clean();

  const today = todayKST();
  const DAYS = 30;
  const allRows = [];
  const allWithdrawals = [];

  for (const s of SAMPLES) {
    console.log(`\n▸ ${s.name} (${s.phone})`);

    const user = await api(`/auth/v1/admin/users`, {
      method: "POST",
      body: JSON.stringify({
        email: `${s.phone}@${DOMAIN}`,
        password: SAMPLE_PASSWORD,
        email_confirm: true,
        user_metadata: { name: s.name, phone: s.phone },
      }),
    });

    await api(`/rest/v1/profiles`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: user.id,
        name: s.name,
        phone: s.phone,
        role: "employee",
        memo: s.memo,
        must_change_password: s.temp,
      }),
    });
    console.log(`  ✓ 계정 생성${s.temp ? " (임시 비밀번호 상태)" : ""}`);

    let sum = 0;
    let minDay = Infinity;
    // 주별로 모아 두었다가 그 주 마지막 근무일에 출금 기록을 남깁니다.
    const byWeek = new Map();

    for (let i = DAYS - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const rows = buildDay(user.id, date);
      const dayTotal = rows.reduce((a, r) => a + r.credit + r.cod + r.extra, 0);
      sum += dayTotal;
      minDay = Math.min(minDay, dayTotal);
      allRows.push(...rows);

      const wk = startOfWeek(date);
      const acc = byWeek.get(wk) ?? { net: 0, lastDay: date };
      acc.net += dayTotal - (isLevyDay(date) ? WEEKDAY_LEVY : 0);
      acc.lastDay = date;
      byWeek.set(wk, acc);
    }

    // 이번 주는 아직 진행 중이라 출금 전으로 둡니다.
    const thisWeek = startOfWeek(today);
    let withdrawnSum = 0;
    for (const [wk, acc] of byWeek) {
      if (wk === thisWeek) continue;
      // 실제로는 딱 떨어지게 안 찾아가므로 만원 단위로 조금 남깁니다.
      const amount = Math.floor((acc.net * rand(88, 100)) / 100 / 10000) * 10000;
      if (amount <= 0) continue;
      withdrawnSum += amount;
      allWithdrawals.push({
        user_id: user.id,
        work_date: acc.lastDay,
        amount,
        memo: chance(0.4) ? "주간 정산 출금" : null,
      });
    }
    console.log(
      `  ✓ ${DAYS}일치 · 매출 ${sum.toLocaleString("ko-KR")}원 · 최저일 ${minDay.toLocaleString("ko-KR")}원`,
    );
    console.log(`  ✓ 출금 ${withdrawnSum.toLocaleString("ko-KR")}원`);
  }

  console.log(`\n▸ 정산 ${allRows.length}건 저장`);
  for (let i = 0; i < allRows.length; i += 500) {
    await api(`/rest/v1/entries`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(allRows.slice(i, i + 500)),
    });
    process.stdout.write(`  ${Math.min(i + 500, allRows.length)}/${allRows.length}\r`);
  }

  if (allWithdrawals.length) {
    console.log(`\n▸ 출금 ${allWithdrawals.length}건 저장`);
    await api(`/rest/v1/withdrawals`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(allWithdrawals),
    });
  }

  console.log(`\n\n${"─".repeat(52)}
 샘플 데이터 완료

   직원 3명 · 최근 ${DAYS}일 · 정산 ${allRows.length}건
   샘플 로그인 비밀번호: ${SAMPLE_PASSWORD}

   ${SAMPLES.map((s) => `${s.name}  ${s.phone.replace(/(...)(....)(....)/, "$1-$2-$3")}${s.temp ? "  ← 임시 비번 상태" : ""}`).join("\n   ")}

 지울 때: node scripts/seed-sample.mjs --clean
${"─".repeat(52)}
`);
}

await (CLEAN ? clean() : seed());
