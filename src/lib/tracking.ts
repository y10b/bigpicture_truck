/**
 * 위치를 보내는 시간대 (한국 시간).
 *
 * 앱과 서버가 같은 기준을 봐야 해서 여기 한 곳에 둡니다.
 * ("use server" 파일은 async 함수만 내보낼 수 있어 상수를 못 둡니다)
 */
export const TRACK_FROM_HOUR = 8;
export const TRACK_TO_HOUR = 22;

/**
 * 이 시각까지는 공유를 꺼 두셨어도 위치가 갑니다.
 *
 * 한창 배송 중인 시간에 사고가 나면 어디 계신지 바로 알아야 해서
 * 회사 규정으로 정해진 구간입니다. 그 뒤로는 본인 선택입니다.
 */
export const MANDATORY_TO_HOUR = 17;

/** 지금 몇 시인지 (한국 시간) */
export function hourKST(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}

/** 지금이 근무시간인지 (한국 시간 기준) */
export function isWithinTrackingHours(now = new Date()) {
  const hour = hourKST(now);
  return hour >= TRACK_FROM_HOUR && hour < TRACK_TO_HOUR;
}

/** 지금이 '꺼도 보내는' 구간인지 (근무 시작 ~ 오후 5시) */
export function isMandatoryNow(now = new Date()) {
  const hour = hourKST(now);
  return hour >= TRACK_FROM_HOUR && hour < MANDATORY_TO_HOUR;
}

/**
 * 지금 위치를 보내야 하는지.
 * 필수 구간이면 설정과 상관없이 보내고, 그 뒤로는 본인이 켜 둔 경우에만 보냅니다.
 */
export function shouldTrackNow(shareLocation: boolean, now = new Date()) {
  if (!isWithinTrackingHours(now)) return false;
  return isMandatoryNow(now) || shareLocation;
}
