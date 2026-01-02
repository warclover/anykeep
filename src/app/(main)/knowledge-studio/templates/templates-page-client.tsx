"use client";

/**
 * Knowledge Studio - 模板管理客户端组件
 * @description Phase 3 存根 - 自定义模板 CRUD
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Settings, Share2 } from "lucide-react";

export function TemplatesPageClient() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模板管理</h1>
          <p className="text-muted-foreground">
            创建和管理自定义报告模板，定制专属的知识生成流程
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-yellow-600 border-yellow-600"
          >
            Phase 3 开发中
          </Badge>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </div>
      </div>

      {/* 功能预览卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义变量</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              支持文本、数字、下拉选择等多种变量类型，灵活定制 Prompt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">版本管理</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              自动保存版本历史，支持回滚到任意历史版本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">模板分享</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              分享模板给好友，发现社区优质公开模板
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 模板列表占位 */}
      <Card>
        <CardHeader>
          <CardTitle>我的模板</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">模板编辑器开发中</h3>
            <p className="text-muted-foreground mt-2">
              Phase 3 将实现完整的模板创建、编辑和分享功能
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
