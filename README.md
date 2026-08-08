<div align="center">
  <img src="public/logo.png" alt="BIG PICTURE" width="320" />
  <h1>BIG PICTURE 정산관리</h1>
  <p>화물 기사 일일 정산 관리 시스템 · 모바일 우선</p>
</div>

---

기사님들이 하루 운행을 끝내고 휴대폰으로 바로 정산을 입력하고, 관리자는 전 직원의 실적과 출금 현황을 한눈에 보는 웹앱입니다.

## 무엇을 하는가

**직원**
- 배송 **건별**로 하나씩 찍거나, 하루 끝나고 **한 번에 몰아서** 입력 — 편한 쪽으로
- 신용 · 착불 · 추가금을 넣으면 총액 자동 합산
- 평일 상납금을 뺀 **실수령**이 바로 보임
- 매주 마지막 근무일 **출금 기록**
- 내 정산 내역을 기간별 그래프로 확인 (본인 것만)
- 공지사항 열람 — 안 읽은 개수가 탭에 배지로

**관리자**
- 전 직원 매출 · 상납금 · 실수령 · 출금 · 미출금 현황
- 직원별 상세 내역과 입력 원본
- 직원 계정 생성 / 임시 비밀번호 발급 / 비활성 / 삭제
- 공지 작성 · 고정 · 수정
- 상납금 단가 설정
- 관리자도 직접 배송을 뛰므로 본인 정산 입력 가능

## 정산 규칙

| 항목 | 내용 |
|---|---|
| 매출 | 신용 + 착불 + 추가금 |
| 상납금 | 평일(월~금) 근무일 × 단가(기본 10만원) · **토·일 면제** |
| 실수령 | 매출 − 상납금 |
| 미출금 | 실수령 − 출금액 |
| 주 단위 | **월요일 시작 ~ 일요일 종료** |

지출(충전·주유·톨)과 운행시간은 **선택 입력**입니다. 적는 사람과 안 적는 사람의 실수령이 다른 기준으로 비교되면 안 되므로 정산에서 차감하지 않고, AI 조언 기능에서만 참고합니다.

## 기술 구성

| | |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 |
| DB / 인증 | Supabase (Postgres + Auth) |
| 그래프 | Recharts |
| AI | Google Gemini |
| 배포 | Vercel (서버리스) |

상주 서버가 없습니다. 모든 페이지와 서버 액션이 서버리스 함수로 돌고, DB 접근은 전부 HTTP 기반이라 커넥션 풀 문제가 없습니다.

### 인증

휴대폰번호 + 비밀번호로 로그인합니다. 내부적으로는 `01012345678@<도메인>` 형태로 Supabase Auth에 저장되며 메일은 발송되지 않습니다. 세션은 쿠키에 담기고 `src/proxy.ts`에서 갱신·보호됩니다.

관리자가 발급한 임시 비밀번호로 로그인하면 본인 비밀번호를 정하는 화면을 먼저 통과해야 앱을 쓸 수 있습니다.

### 권한 분리

권한은 화면이 아니라 **DB에서** 막습니다. 모든 테이블에 RLS가 걸려 있어, 직원은 자기 행만 읽고 쓸 수 있고 관리자 전용 집계 함수는 직원이 호출하면 빈 결과를 돌려줍니다.

### 집계는 DB에서

Supabase(PostgREST)는 한 번에 **1000행**까지만 돌려줍니다. 원본 `entries`를 통째로 가져와 앱에서 더하면 데이터가 쌓였을 때 합계가 조용히 틀어집니다. 그래서 모든 합계는 뷰(`v_daily_totals`)와 집계 함수(`admin_totals_by_*`)로 DB에서 계산해 소량만 받아옵니다.

## 시작하기

### 1. 의존성

```bash
npm install
```

### 2. Supabase 준비

[Access Token](https://supabase.com/dashboard/account/tokens)을 발급해 저장한 뒤 설정 스크립트를 돌리면 테이블 · RLS · 집계 함수 · 관리자 계정 · `.env.local`까지 한 번에 만들어집니다.

```bash
echo 'sbp_여기에토큰' > .supabase-token
node scripts/setup-supabase.mjs --name "홍길동" --phone 01012345678 --password 비밀번호
```

프로젝트가 여러 개면 `--ref <프로젝트ref>`로 지정하세요.

> 수동으로 하시려면 `supabase/schema.sql`을 SQL Editor에 붙여넣고 실행한 뒤, `.env.local.example`을 복사해 값을 채우면 됩니다.

### 3. 실행

```bash
npm run dev
```

http://localhost:3000 에서 발급한 휴대폰번호와 비밀번호로 로그인합니다.

### 4. 샘플 데이터 (선택)

화면을 둘러보려면 직원 3명과 한 달치 정산·출금을 넣어볼 수 있습니다.

```bash
node scripts/seed-sample.mjs          # 넣기
node scripts/seed-sample.mjs --clean  # 지우기
```

샘플 계정은 `010-9000-000X` 로만 만들어지므로 실제 직원과 섞이지 않습니다.

## 환경변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 (공개되어도 무방 — RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 · **절대 클라이언트에 노출 금지** |
| `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` | 휴대폰번호를 이메일로 바꿀 내부 도메인 |
| `GEMINI_API_KEY` | Google Gemini API 키 (AI 기능용) |

`.env*.local`, `.supabase-token`, `.supabase-db-password`는 커밋되지 않습니다.

## 구조

```
src/
├─ app/
│  ├─ (app)/          직원 화면 — 정산입력 · 내 내역 · 공지 · 내 정보
│  ├─ admin/          관리자 화면 — 대시보드 · 직원 · 공지 · 설정
│  ├─ login/          로그인
│  └─ password-setup/ 임시 비밀번호 교체 (통과해야 앱 진입)
├─ components/        공용 UI · 차트 · 달력
├─ lib/
│  ├─ supabase/       서버 · 브라우저 · 관리자 클라이언트
│  ├─ settlement.ts   상납금 · 실수령 계산
│  ├─ period.ts       기간 해석 · 일별 시리즈
│  └─ format.ts       금액 · 날짜 (한국 시간 기준)
└─ proxy.ts           세션 갱신 · 라우트 보호

supabase/schema.sql   테이블 · RLS · 집계 함수 (여러 번 실행해도 안전)
scripts/              Supabase 설정 · 샘플 데이터
```

## 디자인

로고(그래피티 `BIG PICTURE`)에서 뽑은 그린 · 옐로우 · 오프화이트 · 잉크 4색을 씁니다.

그래프 3계열(신용 · 착불 · 추가금)은 브랜드 색을 그대로 쓰지 않고 **색각이상 판별 검사를 통과한 별도 팔레트**를 씁니다. 적록색약에서도 세 계열이 구분됩니다.

모바일 우선입니다. 입력칸은 16px 이상이라 iOS에서 확대되지 않고, 하단 탭은 홈 인디케이터를 피하도록 여백을 둡니다.

## 라이선스

사내용 · 비공개 프로젝트입니다.
