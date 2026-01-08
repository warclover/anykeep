import { Suspense } from "react";
import { WorkflowListPageClient } from "@/components/workflow/list/workflow-list-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "工作流管理 - AnyKeep",
  description: "管理和执行自动化工作流",
};

export default function WorkflowsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<WorkflowListSkeleton />}>
        <WorkflowListPageClient />
      </Suspense>
    </div>
  );
}

function WorkflowListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
