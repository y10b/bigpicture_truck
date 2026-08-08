import { randomInt } from "node:crypto";

/**
 * 임시 비밀번호를 만듭니다.
 *
 * 기사분들에게 전화로 불러주는 상황을 가정했습니다.
 *  - "bp" 로 시작해 우리 회사 발급본임을 알아보기 쉽고
 *  - 나머지는 숫자 6자리라 헷갈릴 글자(O/0, l/1)가 아예 없습니다.
 *
 * 예) bp407913
 */
export function generateTempPassword() {
  let digits = "";
  for (let i = 0; i < 6; i++) digits += randomInt(0, 10);
  return `bp${digits}`;
}
