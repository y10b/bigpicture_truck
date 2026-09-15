import "server-only";
import { createSign } from "node:crypto";

/**
 * FCM 으로 알림을 밀어 줍니다.
 *
 * 구글 라이브러리를 쓰지 않고 직접 토큰을 받아 옵니다 —
 * 서비스 계정 키로 JWT 를 만들어 액세스 토큰과 바꾸는 게 전부라,
 * 서버리스 함수에 무거운 의존성을 얹을 이유가 없습니다.
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as ServiceAccount;
    return {
      project_id: json.project_id,
      client_email: json.client_email,
      // 환경변수에 넣을 때 줄바꿈이 \n 문자열로 들어가는 경우가 많습니다.
      private_key: json.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

const base64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64url");

/** 액세스 토큰은 1시간 살아 있으므로 함수 인스턴스 안에서 재사용합니다. */
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount) {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`토큰 발급 실패: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };

  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cached.token;
}

export type PushMessage = {
  title: string;
  body: string;
  /** 누르면 열릴 앱 안 주소 (예: "/admin/attendance") */
  link?: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  /** 더 이상 쓸 수 없는 토큰 — 지워야 합니다 */
  deadTokens: string[];
};

/**
 * 여러 기기로 같은 알림을 보냅니다.
 *
 * FCM v1 에는 한 번에 여러 토큰으로 보내는 API 가 없어 토큰마다 한 번씩 부릅니다.
 * 우리 인원(10여 명)에서는 이게 가장 단순하고 충분히 빠릅니다.
 */
export async function sendPush(
  tokens: string[],
  message: PushMessage,
): Promise<PushResult> {
  const sa = serviceAccount();
  if (!sa || tokens.length === 0) {
    return { sent: 0, failed: 0, deadTokens: [] };
  }

  const token = await accessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const results = await Promise.allSettled(
    tokens.map(async (to) => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: to,
            notification: { title: message.title, body: message.body },
            data: message.link ? { link: message.link } : undefined,
            android: {
              priority: "HIGH",
              notification: {
                // 알림 표시줄 아이콘·색을 로컬 알림과 같게 맞춥니다.
                icon: "ic_stat_notify",
                color: "#4a8f3a",
                default_sound: true,
              },
            },
          },
        }),
      });

      if (res.ok) return { ok: true as const, to };

      // 404/403 은 토큰이 죽은 것 — 지워야 다음부터 헛되이 부르지 않습니다.
      const dead = res.status === 404 || res.status === 403;
      return { ok: false as const, to, dead };
    }),
  );

  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (const r of results) {
    if (r.status === "rejected") {
      failed++;
      continue;
    }
    if (r.value.ok) sent++;
    else {
      failed++;
      if (r.value.dead) deadTokens.push(r.value.to);
    }
  }

  return { sent, failed, deadTokens };
}

/** 설정이 끝났는지 — 화면에서 안내 문구를 바꾸는 데 씁니다. */
export function pushConfigured() {
  return serviceAccount() !== null;
}
