import { useParams, useNavigate } from 'react-router';
import { mockCollections, platformNames, platformColors } from '../utils/mockData';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ArrowLeft, ExternalLink, Trash2, Edit, Sparkles, Folder, Calendar, User } from 'lucide-react';

export function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const collection = mockCollections.find((c) => c.id === id);

  if (!collection) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">收藏内容不存在</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-gray-900 dark:text-white flex-1">收藏详情</h2>
          <Button variant="outline" size="sm" className="hidden md:flex">
            <Edit className="size-4 mr-2" />
            编辑
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="size-4 md:hidden" />
            <span className="hidden md:inline ml-2">编辑</span>
          </Button>
          <Button variant="outline" size="sm">
            <Trash2 className="size-4 md:mr-2" />
            <span className="hidden md:inline">删除</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Cover Image */}
        <div className="aspect-video w-full mb-4 md:mb-6 rounded-lg overflow-hidden">
          <img
            src={collection.coverImage}
            alt={collection.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Title and Platform */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-start justify-between gap-3 md:gap-4 mb-3">
            <h1 className="text-gray-900 dark:text-white">{collection.title}</h1>
            <Badge
              variant="secondary"
              className={`${platformColors[collection.platform]} text-white flex-shrink-0 text-xs md:text-sm`}
            >
              {platformNames[collection.platform]}
            </Badge>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">{collection.description}</p>
        </div>

        {/* AI Summary */}
        {collection.aiSummary && (
          <Card className="mb-4 md:mb-6 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="size-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-900 dark:text-purple-300 mb-1 text-sm md:text-base">AI智能摘要</p>
                  <p className="text-purple-700 dark:text-purple-400 text-xs md:text-sm">{collection.aiSummary}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <User className="size-5 text-gray-400" />
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">作者</p>
                  <p className="text-gray-900 dark:text-white text-sm md:text-base">{collection.author}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-gray-400" />
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">收藏时间</p>
                  <p className="text-gray-900 dark:text-white text-sm md:text-base">{formatDate(collection.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {collection.folder && (
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-3">
                  <Folder className="size-5 text-gray-400" />
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">文件夹</p>
                    <p className="text-gray-900 dark:text-white text-sm md:text-base">{collection.folder}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <ExternalLink className="size-5 text-gray-400" />
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">内容类型</p>
                  <p className="text-gray-900 dark:text-white text-sm md:text-base">
                    {collection.type === 'article' && '文章'}
                    {collection.type === 'video' && '视频'}
                    {collection.type === 'image' && '图片'}
                    {collection.type === 'product' && '商品'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tags */}
        <div className="mb-4 md:mb-6">
          <h3 className="text-gray-900 dark:text-white mb-3">标签</h3>
          <div className="flex gap-2 flex-wrap">
            {collection.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs md:text-sm">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* AI Tags */}
        {collection.aiTags && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-gray-900 dark:text-white">AI智能标签</h3>
            </div>
            <div className="flex gap-2 flex-wrap">
              {collection.aiTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-xs md:text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button className="flex-1" asChild>
            <a href={collection.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 mr-2" />
              <span className="hidden md:inline">在{platformNames[collection.platform]}中打开</span>
              <span className="md:hidden">打开原文</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}