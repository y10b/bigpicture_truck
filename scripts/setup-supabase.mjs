#!/usr/bin/env node
/**
 * Supabase 프로젝트를 이 앱에 맞게 한 번에 세팅합니다.
 *
 *   node scripts/setup-supabase.mjs --name "홍길동" --phone 01012345678 --password 비밀번호
 *
 * 토큰은 인자로 받지 않고 아래 순서로 찾습니다 (셸 기록에 안 남게):
 *   1) 환경변수 SUPABASE_ACCESS_TOKEN
 *   2) 프로젝트 루트의 .supabase-token 파일
 *
 * 하는 일:
 *   1. 접근 가능한 프로젝트 목록을 가져와 대상 프로젝트를 고릅니다
 *   2. anon / service_role 키를 조회합니다
 *   3. supabase/schema.sql 을 실행합니다 (테이블·RLS·집계 함수)
 *   4. 관리자 계정을 만들고 profiles 에 admin 으로 등록합니다
 *   5. .env.local 을 씁니다
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const API = "https://api.supabase.com";

/* ── 인자 파싱 ───────────────────────────────────────── */
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, "");
  if (k) args[k] = process.argv[i + 1];
}

const die = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
const step = (msg) => console.log(`\n▸ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

/* ── 토큰 확보 ───────────────────────────────────────── */
async function getToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const file = path.join(ROOT, ".supabase-token");
  if (existsSync(file)) return (await readFile(file, "utf8")).trim();
  die(
    "Access Token 을 찾을 수 없습니다.\n" +
      "  https://supabase.com/dashboard/account/tokens 에서 발급한 뒤\n" +
      `  ${file} 에 저장하거나 SUPABASE_ACCESS_TOKEN 환경변수로 넣어 주세요.`,
  );
}

async function mgmt(token, urlPath, init = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${urlPath} → ${res.status}\n${text.slice(0, 600)}`);
  }
  return text ? JSON.parse(text) : null;
}

/* ── 1. 프로젝트 선택 ────────────────────────────────── */
async function pickProject(token) {
  step("프로젝트 목록 조회");
  const projects = await mgmt(token, "/v1/projects");
  const usable = projects.filter((p) => p.status === "ACTIVE_HEALTHY" || !p.status);

  if (projects.length === 0) {
    die("접근 가능한 Supabase 프로젝트가 없습니다. 대시보드에서 먼저 프로젝트를 만들어 주세요.");
  }

  for (const p of projects) {
    console.log(`  · ${p.name}  (ref: ${p.id}, region: ${p.region}, status: ${p.status})`);
  }

  if (args.ref) {
    const found = projects.find((p) => p.id === args.ref);
    if (!found) die(`ref "${args.ref}" 에 해당하는 프로젝트가 없습니다.`);
    return found;
  }

  const pool = usable.length ? usable : projects;
  if (pool.length > 1) {
    die(
      `프로젝트가 ${pool.length}개입니다. 어느 것을 쓸지 --ref <프로젝트ref> 로 지정해 주세요.`,
    );
  }
  return pool[0];
}

/* ── 2. API 키 조회 ──────────────────────────────────── */
async function getKeys(token, ref) {
  step("API 키 조회");
  const keys = await mgmt(token, `/v1/projects/${ref}/api-keys?reveal=true`);
  const find = (n) => keys.find((k) => k.name === n || k.type === n)?.api_key;

  const anon = find("anon");
  const service = find("service_role");
  if (!anon || !service) {
    die(
      "anon / service_role 키를 읽지 못했습니다.\n" +
        `  받은 키 이름: ${keys.map((k) => k.name).join(", ")}`,
    );
  }
  ok("anon / service_role 확보");
  return { anon, service };
}

/* ── 3. 스키마 실행 ──────────────────────────────────── */
async function runSchema(token, ref) {
  step("스키마 실행 (테이블 · RLS · 집계 함수)");
  const sql = await readFile(path.join(ROOT, "supabase", "schema.sql"), "utf8");
  await mgmt(token, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
  ok("supabase/schema.sql 적용 완료");
}

/* ── 4. 관리자 계정 ──────────────────────────────────── */
async function createAdmin({ url, service, name, phone, password, domain }) {
  step(`관리자 계정 생성 (${name} / ${phone})`);
  const email = `${phone}@${domain}`;
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
  };

  // 이미 있으면 비밀번호만 갱신
  let userId;
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    }),
  });

  if (createRes.ok) {
    userId = (await createRes.json()).id;
    ok("Auth 유저 생성");
  } else {
    const body = await createRes.text();
    if (!/already|exists|registered/i.test(body)) {
      die(`Auth 유저 생성 실패 (${createRes.status})\n${body.slice(0, 500)}`);
    }
    const list = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=200`,
      { headers },
    ).then((r) => r.json());
    userId = list.users?.find((u) => u.email === email)?.id;
    if (!userId) die("이미 있는 계정인데 조회에 실패했습니다.");

    await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password, email_confirm: true }),
    });
    ok("이미 있는 계정이라 비밀번호만 갱신");
  }

  const profRes = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: userId, name, phone, role: "admin", active: true }),
  });
  if (!profRes.ok) {
    die(`profiles 등록 실패 (${profRes.status})\n${(await profRes.text()).slice(0, 500)}`);
  }
  ok("profiles 에 관리자로 등록");
  return userId;
}

/* ── 5. .env.local ───────────────────────────────────── */
async function writeEnv({ url, anon, service, domain }) {
  step(".env.local 작성");
  const body = [
    "# scripts/setup-supabase.mjs 가 자동 생성했습니다.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=${domain}`,
    "",
  ].join("\n");
  await writeFile(path.join(ROOT, ".env.local"), body, "utf8");
  ok(".env.local 저장");
}

/* ── main ────────────────────────────────────────────── */
const token = await getToken();
const name = args.name ?? "관리자";
const phone = String(args.phone ?? "").replace(/\D/g, "");
const password = args.password ?? "";
const domain = args.domain ?? "bigpicture.local";

if (phone.length < 10) die("--phone 010... 형태로 휴대폰번호를 넣어 주세요.");
if (password.length < 6) die("--password 는 6자 이상이어야 합니다.");

const project = await pickProject(token);
console.log(`\n  대상 프로젝트: ${project.name} (${project.id})`);

const url = `https://${project.id}.supabase.co`;
const { anon, service } = await getKeys(token, project.id);

await runSchema(token, project.id);
await createAdmin({ url, service, name, phone, password, domain });
await writeEnv({ url, anon, service, domain });

console.log(`
${"─".repeat(56)}
 완료했습니다.

   주소      ${url}
   로그인    ${phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")}
   비밀번호  ${password}

 이제 npm run dev 로 접속해서 로그인하세요.
 .supabase-token 파일은 지우셔도 됩니다.
${"─".repeat(56)}
`);
