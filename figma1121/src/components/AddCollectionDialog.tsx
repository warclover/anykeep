import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Sparkles, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface AddCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCollectionDialog({ open, onOpenChange }: AddCollectionDialogProps) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAdd = async () => {
    if (!url) {
      toast.error('请输入链接');
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      toast.success('收藏成功！', {
        description: 'AI 正在分析内容并生成标签...',
      });
      setUrl('');
      onOpenChange(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加收藏</DialogTitle>
          <DialogDescription>
            支持微信、小红书、B站、知乎等平台链接
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">内容链接</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                id="url"
                placeholder="粘贴链接或分享内容..."
                className="pl-10"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Platform Select */}
          <div className="space-y-2">
            <Label htmlFor="platform">平台</Label>
            <Select>
              <SelectTrigger id="platform">
                <SelectValue placeholder="自动识别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动识别</SelectItem>
                <SelectItem value="wechat">微信</SelectItem>
                <SelectItem value="xiaohongshu">小红书</SelectItem>
                <SelectItem value="bilibili">B站</SelectItem>
                <SelectItem value="zhihu">知乎</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Folder Select */}
          <div className="space-y-2">
            <Label htmlFor="folder">文件夹</Label>
            <Select>
              <SelectTrigger id="folder">
                <SelectValue placeholder="选择文件夹（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="f1">📚 产品学习</SelectItem>
                <SelectItem value="f2">💻 技术学习</SelectItem>
                <SelectItem value="f3">☕ 生活方式</SelectItem>
                <SelectItem value="f4">✈️ 旅行计划</SelectItem>
                <SelectItem value="f5">💼 职场技能</SelectItem>
                <SelectItem value="f6">📰 行业资讯</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AI Features Notice */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="size-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-900 text-sm">AI智能分析</p>
                <p className="text-purple-700 text-xs mt-1">
                  自动提取标题、摘要、封面图，并生成智能标签
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isAnalyzing}
          >
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={handleAdd}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="size-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              '添加收藏'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
