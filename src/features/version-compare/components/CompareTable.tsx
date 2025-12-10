/**
 * v3对比v4 - 对比结果表格
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import {
  Folder,
  Target,
  Clock,
  Layers,
  Brain,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { VersionResult } from "../types";

interface CompareTableProps {
  results: VersionResult[];
}

const tierColors: Record<string, string> = {
  T1: "bg-green-100 text-green-700 border-green-200",
  T2: "bg-yellow-100 text-yellow-700 border-yellow-200",
  T3: "bg-red-100 text-red-700 border-red-200",
};

const versionColors: Record<string, string> = {
  v3: "bg-gray-100 text-gray-700",
  "v4.1": "bg-blue-100 text-blue-700",
  "v4.2": "bg-green-100 text-green-700",
};

export function CompareTable({ results }: CompareTableProps) {
  if (results.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            输入书签信息并点击「开始对比」查看结果
          </p>
        </CardContent>
      </Card>
    );
  }

  // 找出最佳结果（置信度最高）
  const bestResult = results.reduce((best, curr) =>
    curr.confidence > best.confidence ? curr : best,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Table className="w-4 h-4" />
          对比结果
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-28">
                  指标
                </th>
                {results.map((r) => (
                  <th
                    key={r.version}
                    className={`text-center py-3 px-2 ${
                      r.version === bestResult.version ? "bg-primary/5" : ""
                    }`}
                  >
                    <Badge className={versionColors[r.version]}>
                      {r.version.toUpperCase()}
                    </Badge>
                    {r.version === bestResult.version && (
                      <span className="ml-1 text-xs text-primary">★</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 推荐文件夹 */}
              <tr className="border-b">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    推荐文件夹
                  </div>
                </td>
                {results.map((r) => (
                  <td
                    key={r.version}
                    className={`text-center py-3 px-2 ${
                      r.version === bestResult.version ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className="font-medium text-sm">{r.folderName}</span>
                  </td>
                ))}
              </tr>

              {/* 置信度 */}
              <tr className="border-b">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    置信度
                  </div>
                </td>
                {results.map((r) => (
                  <td
                    key={r.version}
                    className={`text-center py-3 px-2 ${
                      r.version === bestResult.version ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-lg font-bold ${
                          r.confidence >= 80
                            ? "text-green-600"
                            : r.confidence >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {r.confidence}%
                      </span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.confidence >= 80
                              ? "bg-green-500"
                              : r.confidence >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${r.confidence}%` }}
                        />
                      </div>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 耗时 */}
              <tr className="border-b">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    耗时
                  </div>
                </td>
                {results.map((r) => {
                  const minTime = Math.min(
                    ...results.map((x) => x.executionTime),
                  );
                  const isFastest = r.executionTime === minTime;
                  return (
                    <td
                      key={r.version}
                      className={`text-center py-3 px-2 ${
                        r.version === bestResult.version ? "bg-primary/5" : ""
                      }`}
                    >
                      <span
                        className={`font-medium ${isFastest ? "text-green-600" : ""}`}
                      >
                        {r.executionTime}ms
                      </span>
                      {isFastest && results.length > 1 && (
                        <span className="ml-1 text-xs text-green-600">⚡</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* 分层 */}
              <tr className="border-b">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    分层
                  </div>
                </td>
                {results.map((r) => (
                  <td
                    key={r.version}
                    className={`text-center py-3 px-2 ${
                      r.version === bestResult.version ? "bg-primary/5" : ""
                    }`}
                  >
                    <Badge className={tierColors[r.tier]}>{r.tier}</Badge>
                  </td>
                ))}
              </tr>

              {/* AI 调用 */}
              <tr>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    AI 调用
                  </div>
                </td>
                {results.map((r) => (
                  <td
                    key={r.version}
                    className={`text-center py-3 px-2 ${
                      r.version === bestResult.version ? "bg-primary/5" : ""
                    }`}
                  >
                    {r.aiCalled ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-green-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
