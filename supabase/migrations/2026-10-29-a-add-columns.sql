-- 1단계: 칸 두 개를 더하기만 합니다. 지우거나 바꾸는 것은 없습니다.
--   cash    = 개인 거래(현금). 제3자 없이 고객과 1:1 로 직접 받은 현금
--   taxable = 세금 신고 대상 여부. 관리자가 직접 체크합니다
alter table public.entries
  add column if not exists cash integer not null default 0 check (cash >= 0);

alter table public.entries
  add column if not exists taxable boolean not null default false;

comment on column public.entries.cash is
  '개인 거래(현금). 제3자 없이 고객과 1:1 로 직접 받은 현금입니다.';
comment on column public.entries.taxable is
  '세금 신고 대상 여부. 어떤 거래가 대상인지는 회사가 판단할 일이라
   앱이 유형으로 자동 분류하지 않습니다. 관리자만 바꿀 수 있습니다.';

notify pgrst, 'reload schema';
