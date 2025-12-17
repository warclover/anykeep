"use client";

/**
 * 分类系统 A/B 对比测试页面
 *
 * 功能：
 * 1. 从待分类中选取书签进行测试
 * 2. 同时使用 V4.2 和 Lite V2 进行分类
 * 3. 对比分析准确率、置信度、耗时
 * 4. 用户标记正确/错误，统计真实准确率
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
// Tabs 组件暂时未使用，保留以备后续扩展
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  RefreshCw,
  Play,
  AlertCircle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Bookmark {
  id: number;
  title: string;
  url: string;
  ai_tags: string[] | null;
  embedding: number[] | null;
  folder_id: number | null;
}

interface ClassificationResult {
  version: "v4.2" | "lite-v2";
  action: "auto_classify" | "suggest" | "to_inbox";
  folderId?: number;
  folderName?: string;
  confidence: number;
  reason: string;
  latencyMs: number;
  error?: string;
}

interface ComparisonResult {
  bookmark: Bookmark;
  v42Result: ClassificationResult | null;
  liteResult: ClassificationResult | null;
  userVerdict?: {
    v42Correct?: boolean;
    liteCorrect?: boolean;
  };
}

interface AccuracyStats {
  total: number;
  verified: number;
  correct: number;
  accuracy: number;
  avgConfidence: number;
  avgLatency: number;
}

// ============================================================
// Component
// ============================================================

export default function ClassificationComparePage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [testSize, setTestSize] = useState<number>(10);
  const [progress, setProgress] = useState(0);

  const supabase = createClient();

  // 加载待分类书签
  const loadInboxBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // 获取待分类文件夹
      const { data: inboxFolder } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("is_system", true)
        .eq("name", "待分类")
        .single();

      if (!inboxFolder) return;

      // 获取待分类中的书签
      const { data: bookmarksData } = await supabase
        .from("bookmarks")
        .select("id, title, url, ai_tags, embedding, folder_id")
        .eq("user_id", user.user.id)
        .eq("folder_id", inboxFolder.id)
        .not("embedding", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      setBookmarks((bookmarksData as Bookmark[]) || []);
    } catch (error) {
      console.error("加载书签失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadInboxBookmarks();
  }, [loadInboxBookmarks]);

  // 运行对比测试
  const runComparison = async () => {
    if (bookmarks.length === 0) return;

    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const testBookmarks = bookmarks.slice(0, testSize);
    const newResults: ComparisonResult[] = [];

    for (let i = 0; i < testBookmarks.length; i++) {
      const bookmark = testBookmarks[i];
      setProgress(((i + 1) / testBookmarks.length) * 100);

      // 并行调用两个分类 API
      const [v42Result, liteResult] = await Promise.all([
        classifyWithV42(bookmark),
        classifyWithLiteV2(bookmark),
      ]);

      newResults.push({
        bookmark,
        v42Result,
        liteResult,
      });

      setResults([...newResults]);

      // 稍微延迟，避免过快
      await new Promise((r) => setTimeout(r, 100));
    }

    setIsRunning(false);
  };

  // V4.2 分类
  const classifyWithV42 = async (
    bookmark: Bookmark,
  ): Promise<ClassificationResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch("/api/dev/classification-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v4.2",
          bookmarkId: bookmark.id,
          embedding: bookmark.embedding,
          tags: bookmark.ai_tags || [],
          title: bookmark.title,
        }),
      });

      const data = await response.json();
      return {
        version: "v4.2",
        action: data.action || "to_inbox",
        folderId: data.folderId,
        folderName: data.folderName,
        confidence: data.confidence || 0,
        reason: data.reason || "",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        version: "v4.2",
        action: "to_inbox",
        confidence: 0,
        reason: "",
        latencyMs: Date.now() - startTime,
        error: String(error),
      };
    }
  };

  // Lite V2 分类
  const classifyWithLiteV2 = async (
    bookmark: Bookmark,
  ): Promise<ClassificationResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch("/api/dev/classification-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "lite-v2",
          bookmarkId: bookmark.id,
          embedding: bookmark.embedding,
          tags: bookmark.ai_tags || [],
          title: bookmark.title,
        }),
      });

      const data = await response.json();
      return {
        version: "lite-v2",
        action: data.action || "to_inbox",
        folderId: data.folderId,
        folderName: data.folderName,
        confidence: data.confidence || 0,
        reason: data.reason || "",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        version: "lite-v2",
        action: "to_inbox",
        confidence: 0,
        reason: "",
        latencyMs: Date.now() - startTime,
        error: String(error),
      };
    }
  };

  // 标记验证结果
  const markVerdict = (
    index: number,
    version: "v4.2" | "lite-v2",
    isCorrect: boolean,
  ) => {
    setResults((prev) => {
      const updated = [...prev];
      if (!updated[index].userVerdict) {
        updated[index].userVerdict = {};
      }
      if (version === "v4.2") {
        updated[index].userVerdict!.v42Correct = isCorrect;
      } else {
        updated[index].userVerdict!.liteCorrect = isCorrect;
      }
      return updated;
    });
  };

  // 计算统计数据
  const calculateStats = (version: "v4.2" | "lite-v2"): AccuracyStats => {
    const relevantResults = results.filter((r) =>
      version === "v4.2" ? r.v42Result : r.liteResult,
    );

    const verified = relevantResults.filter((r) =>
      version === "v4.2"
        ? r.userVerdict?.v42Correct !== undefined
        : r.userVerdict?.liteCorrect !== undefined,
    );

    const correct = verified.filter((r) =>
      version === "v4.2"
        ? r.userVerdict?.v42Correct
        : r.userVerdict?.liteCorrect,
    );

    const confidences = relevantResults.map((r) =>
      version === "v4.2" ? r.v42Result!.confidence : r.liteResult!.confidence,
    );

    const latencies = relevantResults.map((r) =>
      version === "v4.2" ? r.v42Result!.latencyMs : r.liteResult!.latencyMs,
    );

    return {
      total: relevantResults.length,
      verified: verified.length,
      correct: correct.length,
      accuracy:
        verified.length > 0 ? (correct.length / verified.length) * 100 : 0,
      avgConfidence:
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0,
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
    };
  };

  const v42Stats = calculateStats("v4.2");
  const liteStats = calculateStats("lite-v2");

  // 计算一致性（两个版本结果相同的比例）
  const agreementRate =
    results.length > 0
      ? (results.filter(
          (r) =>
            r.v42Result?.folderId === r.liteResult?.folderId &&
            r.v42Result?.action === r.liteResult?.action,
        ).length /
          results.length) *
        100
      : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">分类系统 A/B 对比测试</h1>
          <p className="text-muted-foreground">
            对比 V4.2 和 Lite V2 的分类准确率
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          开发工具
        </Badge>
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">测试配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">测试数量:</span>
              <Select
                value={String(testSize)}
                onValueChange={(v) => setTestSize(Number(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 条</SelectItem>
                  <SelectItem value="10">10 条</SelectItem>
                  <SelectItem value="20">20 条</SelectItem>
                  <SelectItem value="50">50 条</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              待分类书签: {bookmarks.length} 条可用
            </div>

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={loadInboxBookmarks}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>

            <Button
              onClick={runComparison}
              disabled={isRunning || bookmarks.length === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              开始测试
            </Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>测试进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 统计概览 */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* V4.2 统计 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="default">V4.2</Badge>
                当前版本
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">验证准确率</span>
                <span className="font-bold">
                  {v42Stats.verified > 0
                    ? `${v42Stats.accuracy.toFixed(1)}%`
                    : "待验证"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均置信度</span>
                <span>{v42Stats.avgConfidence.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均耗时</span>
                <span>{v42Stats.avgLatency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已验证</span>
                <span>
                  {v42Stats.correct}/{v42Stats.verified}/{v42Stats.total}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Lite V2 统计 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="secondary">Lite V2</Badge>
                轻量版
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">验证准确率</span>
                <span className="font-bold">
                  {liteStats.verified > 0
                    ? `${liteStats.accuracy.toFixed(1)}%`
                    : "待验证"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均置信度</span>
                <span>{liteStats.avgConfidence.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均耗时</span>
                <span>{liteStats.avgLatency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已验证</span>
                <span>
                  {liteStats.correct}/{liteStats.verified}/{liteStats.total}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 对比统计 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                对比分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">结果一致率</span>
                <span className="font-bold">{agreementRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">准确率差异</span>
                <span
                  className={
                    v42Stats.accuracy >= liteStats.accuracy
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {(v42Stats.accuracy - liteStats.accuracy).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">耗时差异</span>
                <span
                  className={
                    v42Stats.avgLatency <= liteStats.avgLatency
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {(v42Stats.avgLatency - liteStats.avgLatency).toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">测试样本</span>
                <span>{results.length} 条</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 详细结果表格 */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">详细结果</CardTitle>
            <CardDescription>
              点击 ✓ 或 ✗ 标记分类是否正确，用于计算真实准确率
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">书签</TableHead>
                  <TableHead>V4.2 结果</TableHead>
                  <TableHead>V4.2 验证</TableHead>
                  <TableHead>Lite V2 结果</TableHead>
                  <TableHead>Lite V2 验证</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={result.bookmark.id}>
                    {/* 书签信息 */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm line-clamp-2">
                          {result.bookmark.title}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(result.bookmark.ai_tags || [])
                            .slice(0, 3)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </TableCell>

                    {/* V4.2 结果 */}
                    <TableCell>
                      {result.v42Result ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                result.v42Result.action === "auto_classify"
                                  ? "default"
                                  : result.v42Result.action === "suggest"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {result.v42Result.action === "auto_classify"
                                ? "自动"
                                : result.v42Result.action === "suggest"
                                  ? "建议"
                                  : "待分类"}
                            </Badge>
                            <span className="text-sm">
                              {result.v42Result.confidence}%
                            </span>
                          </div>
                          {result.v42Result.folderName && (
                            <div className="text-sm text-muted-foreground">
                              → {result.v42Result.folderName}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.v42Result.latencyMs}ms
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* V4.2 验证按钮 */}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={
                            result.userVerdict?.v42Correct === true
                              ? "default"
                              : "outline"
                          }
                          className="h-8 w-8 p-0"
                          onClick={() => markVerdict(index, "v4.2", true)}
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            result.userVerdict?.v42Correct === false
                              ? "default"
                              : "outline"
                          }
                          className="h-8 w-8 p-0"
                          onClick={() => markVerdict(index, "v4.2", false)}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>

                    {/* Lite V2 结果 */}
                    <TableCell>
                      {result.liteResult ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                result.liteResult.action === "auto_classify"
                                  ? "default"
                                  : result.liteResult.action === "suggest"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {result.liteResult.action === "auto_classify"
                                ? "自动"
                                : result.liteResult.action === "suggest"
                                  ? "建议"
                                  : "待分类"}
                            </Badge>
                            <span className="text-sm">
                              {result.liteResult.confidence}%
                            </span>
                          </div>
                          {result.liteResult.folderName && (
                            <div className="text-sm text-muted-foreground">
                              → {result.liteResult.folderName}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.liteResult.latencyMs}ms
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Lite V2 验证按钮 */}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={
                            result.userVerdict?.liteCorrect === true
                              ? "default"
                              : "outline"
                          }
                          className="h-8 w-8 p-0"
                          onClick={() => markVerdict(index, "lite-v2", true)}
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            result.userVerdict?.liteCorrect === false
                              ? "default"
                              : "outline"
                          }
                          className="h-8 w-8 p-0"
                          onClick={() => markVerdict(index, "lite-v2", false)}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {results.length === 0 && !isRunning && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-medium">准备就绪</h3>
                <p className="text-sm text-muted-foreground">
                  {bookmarks.length > 0
                    ? `已加载 ${bookmarks.length} 条待分类书签，点击"开始测试"运行对比`
                    : "待分类中没有可测试的书签"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
