"use client";

import { useEffect, useRef } from "react";
import { markNoticesSeen } from "./actions";

/** 화면에 아무것도 그리지 않고, 목록을 연 순간 읽음 처리만 합니다. */
export default function MarkSeen() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markNoticesSeen();
  }, []);

  return null;
}
