export type Role = "employee" | "admin";
export type EntryMode = "single" | "bulk";

export type Profile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  memo: string | null;
  /** 차량번호 (예: 12가3456) */
  vehicle_no: string | null;
  /** 차종 (예: 1톤 냉장) */
  vehicle_type: string | null;
  /** 급여 입금 계좌 */
  bank_account: string | null;
  notices_seen_at: string | null;
  /** 관리자가 발급한 임시 비밀번호를 아직 안 바꾼 상태 */
  must_change_password: boolean;
  /** 위치 공유 사용 여부. 끄면 앱이 위치를 보내지 않습니다. */
  share_location: boolean;
  created_at: string;
};

export type Entry = {
  id: string;
  user_id: string;
  work_date: string;
  mode: EntryMode;
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
  /** 지출 — 충전비·주유·톨 등 (선택). 매출/실수령 계산에는 넣지 않습니다. */
  expense: number;
  /** 운행 시간(분) (선택) */
  minutes: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyTotal = {
  user_id: string;
  work_date: string;
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
};

export type EntryLog = {
  id: string;
  entry_id: string | null;
  owner_id: string;
  /** 고친 사람. 계정이 지워졌으면 null */
  editor_id: string | null;
  action: "update" | "delete";
  before: unknown;
  after: unknown;
  created_at: string;
};

export type DriverLocation = {
  user_id: string;
  lat: number;
  lng: number;
  /** 위치 오차(m) */
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  /** 기기에서 위치를 잡은 시각 */
  recorded_at: string;
  updated_at: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  /** AI가 매긴 문단별 강조 서식. null 이면 body 를 그대로 보여줍니다. */
  blocks: unknown;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserTotals = {
  user_id: string;
  name: string;
  phone: string;
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
  /** 근무일수 */
  days: number;
  /** 기간 내 출금 합계 */
  withdrawn: number;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  work_date: string;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type DayTotals = {
  work_date: string;
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
  /** 선택 입력이라 0일 수 있습니다 */
  expense?: number;
  minutes?: number;
};
