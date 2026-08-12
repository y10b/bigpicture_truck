"use client";

import { useEffect, useState } from "react";
import { Card, cn } from "@/components/ui";

const APK_URL =
  "https://github.com/y10b/bigpicture_truck/releases/latest/download/app-release.apk";

type Platform = "android" | "ios" | "other";

/**
 * 설치 안내.
 * 기사분들이 링크 하나만 받으면 되게, 폰 종류를 알아서 가려 보여줍니다.
 * 안드로이드는 스토어 밖 앱이라 경고가 여러 번 뜨는데, 그걸 미리 알려주지
 * 않으면 "설치가 안 된다"는 전화를 받게 됩니다.
 */
export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /android/i.test(ua)
        ? "android"
        : /iphone|ipad|ipod/i.test(ua)
          ? "ios"
          : "other",
    );
    // 카카오톡·네이버 등 앱 안의 브라우저는 파일 내려받기가 막히는 일이 있습니다.
    setInApp(/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line/i.test(ua));
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드가 막혀 있으면 주소창을 직접 쓰시면 됩니다 */
    }
  };

  if (!platform) {
    return <div className="h-40 animate-pulse rounded-2xl bg-ink/5" />;
  }

  return (
    <div className="space-y-3">
      {/* 앱 안 브라우저 경고 — 여기서 막히는 분이 제일 많습니다 */}
      {inApp && platform === "android" && (
        <Card className="border-danger/30 bg-danger-soft p-4">
          <p className="text-[14px] leading-relaxed font-bold text-danger">
            지금 카카오톡 안에서 보고 계십니다
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-danger/85">
            이 상태로는 설치 파일이 안 받아집니다. 화면 오른쪽 위{" "}
            <b>⋮ (점 세 개)</b> 를 누르고 <b>다른 브라우저로 열기</b> 를 골라
            주세요.
          </p>
          <button
            onClick={copyLink}
            className="mt-3 w-full rounded-xl bg-danger py-3 text-[14px] font-bold text-white"
          >
            {copied ? "복사됐습니다 — 크롬에 붙여넣으세요" : "주소 복사하기"}
          </button>
        </Card>
      )}

      {platform === "android" && (
        <>
          <a href={APK_URL} download>
            <Card className="flex items-center gap-3 border-brand-300 bg-brand-50 px-4 py-4 transition-colors active:bg-brand-100">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v13M7 12l5 5 5-5M4 21h16" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-extrabold text-brand-700">
                  앱 내려받기
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-brand-600/80">
                  안드로이드용 · 약 3.5MB
                </p>
              </div>
            </Card>
          </a>

          <Card className="p-4">
            <p className="text-[14px] font-extrabold">설치하는 방법</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-4">
              스토어를 거치지 않는 앱이라 안드로이드가 경고를 몇 번 띄웁니다.
              문제 있는 게 아니니 아래대로 눌러 주세요.
            </p>

            <ol className="mt-3 space-y-3">
              <Step n={1} title="위 버튼을 눌러 내려받기">
                <b>&ldquo;이런 유형의 파일은 기기에 위험을 줄 수 있습니다&rdquo;</b>{" "}
                라고 나오면 <b>계속</b> 을 누르세요.
              </Step>
              <Step n={2} title="받은 파일 열기">
                알림창이나 <b>다운로드</b> 폴더에서 받은 파일을 누릅니다.
              </Step>
              <Step n={3} title="설치 허용하기">
                <b>&ldquo;이 출처의 앱 설치&rdquo;</b> 화면이 나오면{" "}
                <b>설정</b> 으로 가서 스위치를 켜고 뒤로 돌아옵니다.
              </Step>
              <Step n={4} title="설치 누르기">
                <b>&ldquo;알 수 없는 개발자&rdquo;</b> 경고가 나오면{" "}
                <b>세부정보 → 무시하고 설치</b> 를 누르세요.
              </Step>
            </ol>

            <div className="mt-3 rounded-xl bg-paper-2/70 px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-ink-3">
                <b>삼성 갤럭시</b>에서 설치가 아예 막히면, 설정 → 보안 및
                개인정보 보호 → <b>자동 차단</b> 을 잠시 꺼 주세요. 설치 후
                다시 켜셔도 됩니다.
              </p>
            </div>
          </Card>
        </>
      )}

      {platform === "ios" && (
        <Card className="p-4">
          <p className="text-[15px] font-extrabold">아이폰에 추가하기</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-4">
            아이폰은 애플 정책상 설치 파일을 바로 받을 수 없습니다. 대신 홈
            화면에 추가하면 앱과 똑같이 아이콘이 생기고 전체화면으로 열립니다.
          </p>

          <ol className="mt-3 space-y-3">
            <Step n={1} title="사파리로 열기">
              지금 사파리가 아니라면 사파리에서 이 주소를 다시 열어 주세요.
            </Step>
            <Step n={2} title="공유 버튼 누르기">
              화면 아래 가운데 <b>네모에 화살표</b> 모양을 누릅니다.
            </Step>
            <Step n={3} title="홈 화면에 추가">
              목록을 내려서 <b>홈 화면에 추가</b> 를 고르고{" "}
              <b>추가</b> 를 누르세요.
            </Step>
          </ol>

          <div className="mt-3 rounded-xl bg-paper-2/70 px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-ink-3">
              홈 화면 아이콘으로 열어야 주소창 없이 앱처럼 뜹니다. 사파리에서
              열면 주소창이 보입니다.
            </p>
          </div>
        </Card>
      )}

      {platform === "other" && (
        <Card className="p-4">
          <p className="text-[14px] font-bold">휴대폰에서 열어 주세요</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
            이 주소를 휴대폰으로 열면 설치 방법이 나옵니다. 컴퓨터에서는 그냥{" "}
            <a href="/home" className="font-bold text-brand-600 underline">
              바로 쓰기
            </a>{" "}
            를 눌러 웹으로 쓰셔도 됩니다.
          </p>
        </Card>
      )}

      <a
        href="/home"
        className={cn(
          "block rounded-2xl border border-ink/12 bg-card py-3.5 text-center",
          "text-[14px] font-bold text-ink-2 transition-colors active:bg-paper-2",
        )}
      >
        설치 없이 바로 쓰기
      </a>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-paper">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-bold">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{children}</p>
      </div>
    </li>
  );
}
