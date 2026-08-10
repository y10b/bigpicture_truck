import { PageSkeleton } from "@/components/Skeleton";

/**
 * 라우트 전환 중 즉시 보여줄 화면.
 * 이 파일이 있어야 탭을 누른 순간 바로 반응합니다.
 * (없으면 서버 응답이 올 때까지 화면이 그대로 멈춰 있어 느리게 느껴집니다)
 */
export default function Loading() {
  return <PageSkeleton />;
}
