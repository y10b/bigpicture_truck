"use client";

import { useEffect, useRef, useState } from "react";

/* 카카오 지도 SDK 는 타입 선언이 없어 최소한으로만 열어 둡니다. */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

/**
 * SDK 는 페이지당 한 번만 받아옵니다.
 * 지도를 여러 개 그리거나 화면을 다시 그려도 script 태그가 늘어나지 않습니다.
 * services 는 좌표를 주소로 바꾸는 데 씁니다.
 */
let sdkPromise: Promise<void> | null = null;
export function loadKakaoSdk(appKey: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps?.services) return resolve();
    const script = document.createElement("script");
    // autoload=false 로 받아 두고, 우리가 원할 때 maps.load 로 켭니다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () =>
      reject(new Error("카카오 지도를 불러오지 못했습니다"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** 긴 광역단체 이름은 줄여야 한 줄에 들어갑니다. */
const SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  강원도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

function tidy(address: string) {
  const [first, ...rest] = address.split(" ");
  return [SHORT[first] ?? first, ...rest].join(" ");
}

type Coord = { id: string; lat: number; lng: number };

/**
 * 좌표를 사람이 읽는 주소로 바꿔 줍니다.
 * 도로명이 있으면 도로명, 없으면 지번을 씁니다.
 *
 * 같은 자리에 계속 서 있는 차가 많아서, 소수점 4자리(약 10m)까지 같으면
 * 이미 받아 둔 주소를 그대로 씁니다. 1분마다 새로고침해도 요청이 늘지 않습니다.
 */
export function useAddresses(points: Coord[]) {
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!appKey || points.length === 0) return;
    let alive = true;

    loadKakaoSdk(appKey)
      .then(() => {
        if (!alive) return;
        const kakao = window.kakao;
        const geocoder = new kakao.maps.services.Geocoder();

        for (const p of points) {
          const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
          const hit = cache.current.get(key);
          if (hit) {
            setAddresses((m) => (m[p.id] === hit ? m : { ...m, [p.id]: hit }));
            continue;
          }
          geocoder.coord2Address(p.lng, p.lat, (res: any[], status: string) => {
            if (!alive || status !== kakao.maps.services.Status.OK) return;
            const found = res?.[0];
            // 도로명이 있으면 도로명, 없으면 지번.
            // 지번은 뒤에 붙는 번지수를 떼야 "서울 중구 봉래동2가" 처럼 읽힙니다.
            const road = found?.road_address?.address_name;
            const jibun = found?.address?.address_name?.replace(
              /\s\d+(-\d+)?$/,
              "",
            );
            const text = road || jibun;
            if (!text) return;
            const pretty = tidy(text);
            cache.current.set(key, pretty);
            setAddresses((m) => ({ ...m, [p.id]: pretty }));
          });
        }
      })
      .catch(() => {
        /* 주소는 있으면 좋은 정보라, 못 받아와도 화면은 그대로 둡니다 */
      });

    return () => {
      alive = false;
    };
  }, [points]);

  return addresses;
}
