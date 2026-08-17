/**
 * 위치를 보내는 시간대 (한국 시간).
 *
 * 앱과 서버가 같은 기준을 봐야 해서 여기 한 곳에 둡니다.
 * ("use server" 파일은 async 함수만 내보낼 수 있어 상수를 못 둡니다)
 */
export const TRACK_FROM_HOUR = 8;
export const TRACK_TO_HOUR = 22;

/** 지금이 근무시간인지 (한국 시간 기준) */
export function isWithinTrackingHours(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return hour >= TRACK_FROM_HOUR && hour < TRACK_TO_HOUR;
}
