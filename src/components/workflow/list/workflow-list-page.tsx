"use client";

import { useState } from "react";
import { useWorkflowList, useExecutionHistory } from "@/hooks/workflow";
import { WorkflowCard } from "./workflow-card";
import { WorkflowResultCard } from "../result/workflow-result-card";
import { WorkflowExecutionProgress } from "../execution/workflow-execution-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Zap, User, History, Loader2 } from "lucide-react";
import type { FC } from "react";

export const WorkflowListPageClient: FC = () => {
  const { workflows, isLoading: isLoadingWorkflows } = useWorkflowList();
  const { executions, isLoading: isLoadingHistory } = useExecutionHistory({
    limit: 10,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"workflows" | "history">(
    "workflows",
  );
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(
    null,
  );

  // 筛选工作流
  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const builtinWorkflows = filteredWorkflows.filter(
    (w) => w.category === "builtin",
  );
  const customWorkflows = filteredWorkflows.filter(
    (w) => w.category === "user_defined",
  );

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作流管理</h1>
          <p className="text-muted-foreground">
            自动化执行多个 AI Skills，提升效率
          </p>
        </div>
      </div>

      {/* 搜索和标签 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工作流..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList>
            <TabsTrigger value="workflows" className="gap-1">
              <Zap className="h-3 w-3" />
              工作流
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-3 w-3" />
              执行历史
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 内容区 */}
      {activeTab === "workflows" && (
        <div className="space-y-6">
          {isLoadingWorkflows ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "未找到匹配的工作流" : "暂无可用工作流"}
            </div>
          ) : (
            <>
              {/* 预设工作流 */}
              {builtinWorkflows.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    预设工作流
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {builtinWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onExecutionStart={setActiveExecutionId}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 自定义工作流 */}
              {customWorkflows.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    我的工作流
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onExecutionStart={setActiveExecutionId}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无执行记录
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {executions.map((execution) => (
                <WorkflowResultCard
                  key={execution.id}
                  execution={execution}
                  onViewDetail={setActiveExecutionId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 执行进度抽屉 */}
      <Sheet
        open={!!activeExecutionId}
        onOpenChange={(open) => !open && setActiveExecutionId(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>执行进度</SheetTitle>
          </SheetHeader>
          {activeExecutionId && (
            <div className="mt-4">
              <WorkflowExecutionProgress
                executionId={activeExecutionId}
                onClose={() => setActiveExecutionId(null)}
                compact
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
