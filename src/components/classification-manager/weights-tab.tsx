import { Scale, Settings2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  CLASSIFICATION_THRESHOLDS,
  MATCHER_STRATEGY_CONFIG,
} from "@/lib/classification/constants/limits";
import { WEIGHT_LABELS, type WeightConfig } from "./types";
import type { useClassificationConfig } from "./hooks/use-classification-config";

type ConfigReturn = ReturnType<typeof useClassificationConfig>;

interface WeightsTabProps {
  config: Pick<ConfigReturn, "weights" | "adjustWeight" | "saveWeights">;
}

export function WeightsTab({ config }: WeightsTabProps) {
  const { weights, adjustWeight, saveWeights } = config;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-purple-500" />
            分类权重调整
          </CardTitle>
          <CardDescription>
            调整各匹配策略的权重占比（总和保持 100%）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(weights) as (keyof WeightConfig)[]).map((key) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{WEIGHT_LABELS[key].name}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="size-3.5 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{WEIGHT_LABELS[key].description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-medium text-purple-600">
                  {weights[key]}%
                </span>
              </div>
              <Slider
                value={[weights[key]]}
                onValueChange={(v) => adjustWeight(key, v[0])}
                max={80}
                min={10}
                step={5}
              />
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm text-gray-500">权重分布</Label>
            <div className="h-4 w-full flex rounded-full overflow-hidden">
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${weights.vector}%` }}
              />
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${weights.history}%` }}
              />
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${weights.ai}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                向量 {weights.vector}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                历史 {weights.history}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                AI {weights.ai}%
              </span>
            </div>
          </div>

          <Button onClick={saveWeights} className="w-full mt-4">
            保存权重配置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-purple-500" />
            当前配置概览
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">高置信度阈值</p>
              <p className="text-lg font-bold text-green-600">
                ≥{CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE}%
              </p>
              <p className="text-xs text-gray-400">自动归类</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">中置信度阈值</p>
              <p className="text-lg font-bold text-blue-600">
                {CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE}-
                {CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE - 1}%
              </p>
              <p className="text-xs text-gray-400">保存建议</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">低置信度阈值</p>
              <p className="text-lg font-bold text-yellow-600">
                &lt;{CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE}%
              </p>
              <p className="text-xs text-gray-400">放入待整理</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">k-NN 直接匹配</p>
              <p className="text-lg font-bold text-purple-600">
                ≥{MATCHER_STRATEGY_CONFIG.KNN_DIRECT.SIMILARITY_THRESHOLD * 100}
                %
              </p>
              <p className="text-xs text-gray-400">相似度阈值</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">匹配器权重</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>通用分类匹配</span>
                <span className="font-medium">
                  {MATCHER_STRATEGY_CONFIG.UNIVERSAL.WEIGHT * 100}%
                </span>
              </div>
              <Progress
                value={MATCHER_STRATEGY_CONFIG.UNIVERSAL.WEIGHT * 100}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>标签匹配</span>
                <span className="font-medium">
                  {MATCHER_STRATEGY_CONFIG.TAG.WEIGHT * 100}%
                </span>
              </div>
              <Progress
                value={MATCHER_STRATEGY_CONFIG.TAG.WEIGHT * 100}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>指纹匹配</span>
                <span className="font-medium">
                  {MATCHER_STRATEGY_CONFIG.FINGERPRINT.WEIGHT * 100}%
                </span>
              </div>
              <Progress
                value={MATCHER_STRATEGY_CONFIG.FINGERPRINT.WEIGHT * 100}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>查询扩展匹配</span>
                <span className="font-medium">
                  {MATCHER_STRATEGY_CONFIG.QUERY_EXPANSION.WEIGHT * 100}%
                </span>
              </div>
              <Progress
                value={MATCHER_STRATEGY_CONFIG.QUERY_EXPANSION.WEIGHT * 100}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
