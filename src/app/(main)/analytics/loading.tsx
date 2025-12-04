import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg border space-y-2"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border h-[300px]">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="flex items-end gap-2 h-[200px] justify-between">
            {[60, 80, 45, 90, 55, 70, 85].map((height, i) => (
              <Skeleton
                key={i}
                className="w-full rounded-t-md"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border h-[300px]">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="w-48 h-48 rounded-full mx-auto mt-4" />
        </div>
      </div>
    </div>
  );
}
