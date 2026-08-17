"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { loadKakaoSdk } from "@/components/kakao-sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 핀 아래 작게 붙는 글자 (예: "12분 전 · 34km") */
  caption?: string;
  /** 최근 위치인지 — 오래된 건 흐리게 그립니다 */
  fresh?: boolean;
};

/** 이름표가 그려진 핀. 마커 이미지 대신 HTML 을 얹어 글자까지 한 번에 보여 줍니다. */
function pinHtml(p: MapPoint) {
  const tone = p.fresh
    ? "background:#4a8f3a;box-shadow:0 2px 8px rgba(74,143,58,.45)"
    : "background:#9aa0a6;box-shadow:0 2px 6px rgba(0,0,0,.25)";
  const escape = (s: string) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
    );
  // 위치 보정은 CustomOverlay 의 xAnchor/yAnchor 가 합니다.
  // 여기서 또 translate 를 걸면 핀이 실제 지점에서 밀립니다.
  return `
    <div style="text-align:center;white-space:nowrap;pointer-events:none">
      <div style="${tone};color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800;line-height:1.2">
        ${escape(p.name)}
      </div>
      ${
        p.caption
          ? `<div style="margin-top:2px;display:inline-block;background:rgba(255,255,255,.92);border-radius:6px;padding:1px 6px;font-size:10px;font-weight:700;color:#4a4a4a">${escape(p.caption)}</div>`
          : ""
      }
      <div style="width:2px;height:10px;margin:0 auto;${tone};box-shadow:none"></div>
      <div style="width:8px;height:8px;margin:0 auto;border-radius:999px;${tone}"></div>
    </div>`;
}

/**
 * 직원들이 지금 어디 있는지 한눈에 보는 지도.
 * 핀이 여러 개면 전부 들어오도록 화면을 맞춥니다.
 */
export default function KakaoMap({
  points,
  className,
  /** 지도 밖에서 특정 직원을 고르면 그쪽으로 움직입니다 */
  focusId,
}: {
  points: MapPoint[];
  className?: string;
  focusId?: string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  /** 어떤 사람들이 찍혀 있었는지 — 이게 바뀔 때만 화면을 다시 맞춥니다 */
  const fittedRef = useRef<string>("");
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);

  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

  // 1) SDK 를 받아 지도를 한 번 만듭니다.
  useEffect(() => {
    if (!appKey) {
      setError("카카오 지도 키가 설정되지 않았습니다");
      return;
    }
    let alive = true;
    loadKakaoSdk(appKey)
      .then(() => {
        if (!alive || !boxRef.current || mapRef.current) return;
        const kakao = window.kakao;
        mapRef.current = new kakao.maps.Map(boxRef.current, {
          // 첫 화면은 서울 시청. 핀이 있으면 바로 아래에서 다시 맞춥니다.
          center: new kakao.maps.LatLng(37.5665, 126.978),
          level: 9,
        });
        setReady(true);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [appKey]);

  // 2) 핀을 다시 그립니다. 위치가 1분마다 갱신되므로 통째로 지우고 새로 얹습니다.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = points.map((p) => {
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: pinHtml(p),
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: p.fresh ? 2 : 1,
      });
      overlay.setMap(map);
      return overlay;
    });

    // 1분마다 위치가 갱신되는데 그때마다 화면을 다시 맞추면
    // 관리자가 확대해 둔 걸 계속 빼앗깁니다. 사람이 늘거나 줄 때만 맞춥니다.
    const sig = points.map((p) => p.id).join("|");
    if (sig !== fittedRef.current) {
      fittedRef.current = sig;
      if (points.length === 1) {
        map.setCenter(new kakao.maps.LatLng(points[0].lat, points[0].lng));
        map.setLevel(5);
      } else if (points.length > 1) {
        const bounds = new kakao.maps.LatLngBounds();
        points.forEach((p) =>
          bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)),
        );
        map.setBounds(bounds, 40, 40, 40, 40);
      }
    }
  }, [ready, points]);

  // 3) 목록에서 누른 사람에게로 이동
  useEffect(() => {
    if (!ready || !focusId || !mapRef.current) return;
    const p = points.find((x) => x.id === focusId);
    if (!p) return;
    const kakao = window.kakao;
    mapRef.current.setLevel(4);
    mapRef.current.panTo(new kakao.maps.LatLng(p.lat, p.lng));
  }, [ready, focusId, points]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed border-ink/12 px-4 text-center text-[13px] text-ink-4",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-ink/10", className)}>
      <div ref={boxRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-2 text-[13px] text-ink-4">
          지도를 불러오는 중…
        </div>
      )}
    </div>
  );
}
