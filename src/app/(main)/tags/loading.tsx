import { Skeleton } from "@/components/ui/skeleton";

export default function TagsLoading() {
  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* 页面标题骨架 */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* 筛选器骨架 */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* 标签云骨架 */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 30 }).map((_, i) => {
          // 随机宽度模拟不同长度的标签
          const widths = ["w-16", "w-20", "w-24", "w-28", "w-14", "w-18"];
          const heights = ["h-7", "h-8", "h-9"];
          return (
            <Skeleton
              key={i}
              className={`${widths[i % widths.length]} ${heights[i % heights.length]} rounded-full`}
            />
          );
        })}
      </div>

      {/* 标签列表骨架（备选视图） */}
      <div className="space-y-2 hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
