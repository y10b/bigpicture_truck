/** 휴대폰번호에서 숫자만 남깁니다. */
export function normalizePhone(input: string) {
  return input.replace(/\D/g, "");
}

/** 010-1234-5678 형태로 보기 좋게. */
export function prettyPhone(phone: string) {
  const d = normalizePhone(phone);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

export const AUTH_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "bigpicture.local";

/** 휴대폰번호 → Supabase Auth 가 요구하는 이메일 형태로 변환 (메일 발송 없음). */
export function phoneToEmail(phone: string) {
  return `${normalizePhone(phone)}@${AUTH_EMAIL_DOMAIN}`;
}

/** 1234567 → "1,234,567" */
export function won(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("ko-KR");
}

/** 1234567 → "123만" 처럼 짧게 (그래프 축·요약 카드용) */
export function shortWon(n: number | null | undefined) {
  const v = n ?? 0;
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  return v.toLocaleString("ko-KR");
}

const KST = "Asia/Seoul";

/** 한국 시간 기준 오늘 날짜를 YYYY-MM-DD 로. */
export function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** YYYY-MM-DD 에 일수를 더합니다 (UTC 기준 계산이라 DST 영향 없음). */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 해당 날짜가 속한 달의 1일. */
export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/** 해당 날짜가 속한 주의 월요일. (한 주는 월요일 시작 ~ 일요일 끝) */
export function startOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  const backToMonday = day === 0 ? 6 : day - 1;
  return addDays(date, -backToMonday);
}

/** 해당 날짜가 속한 주의 일요일. */
export function endOfWeek(date: string) {
  return addDays(startOfWeek(date), 6);
}

/** 해당 날짜가 속한 달의 말일. */
export function endOfMonth(date: string) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-08-08" → "8월 8일 (금)" */
export function prettyDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
}

/** "2026-08-08" → "8/8" (그래프 축용) */
export function tickDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** "2026-08" → "2026년 8월" */
export function prettyMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** ISO 타임스탬프 → "8월 8일 14:30" (KST) */
export function prettyDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** from~to 사이의 모든 날짜를 채운 배열 (그래프에서 빈 날 0으로 표시) */
export function dateRange(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
