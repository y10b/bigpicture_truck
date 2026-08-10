import { cn } from "@/components/ui";

/**
 * 화면이 오기 전 자리를 잡아 두는 회색 상자.
 * 탭을 누른 즉시 뭔가 바뀌어야 "먹통"으로 느끼지 않습니다.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-ink/8", className)}
      aria-hidden
    />
  );
}

/** 카드 한 장 크기의 자리표시자 */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-card p-4">
      <Skeleton className="h-3.5 w-24" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-3", i === lines - 1 ? "w-1/2" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

/** 화면 전체 자리표시자 — 라우트 전환 중에 보여줍니다. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-6 w-40" />

      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
        <div className="bg-ink/90 px-4 py-5">
          <Skeleton className="h-3 w-20 bg-white/15" />
          <Skeleton className="mt-2.5 h-8 w-44 bg-white/15" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-ink/8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-3 py-3">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="mt-2 h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonCard lines={4} />
      <SkeletonCard lines={2} />
    </div>
  );
}
