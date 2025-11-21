import { folders, mockCollections } from '../utils/mockData';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Folder, Plus, MoreVertical } from 'lucide-react';
import { Link } from 'react-router';

export function Collections() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900 dark:text-white">收藏夹</h2>
          <Button size="sm">
            <Plus className="size-4 mr-2" />
            <span className="hidden md:inline">新建文件夹</span>
            <span className="md:hidden">新建</span>
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">按文件夹整理你的收藏内容</p>
      </header>

      {/* Folders Grid */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {folders.map((folder) => {
            const folderCollections = mockCollections.filter(
              (c) => c.folder === folder.name
            );
            return (
              <Card key={folder.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl md:text-3xl">{folder.icon}</div>
                      <div>
                        <h3 className="text-gray-900 text-sm md:text-base">{folder.name}</h3>
                        <p className="text-gray-500 text-xs md:text-sm">{folder.count} 条收藏</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="size-4" />
                    </Button>
                  </div>

                  {/* Preview Images */}
                  {folderCollections.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {folderCollections.slice(0, 3).map((collection) => (
                        <img
                          key={collection.id}
                          src={collection.coverImage}
                          alt={collection.title}
                          className="w-full h-16 md:h-20 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Collections */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-3 md:mb-4">最近添加</h3>
          <div className="space-y-3">
            {mockCollections.slice(0, 5).map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <img
                        src={collection.coverImage}
                        alt={collection.title}
                        className="w-12 h-12 md:w-16 md:h-16 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-gray-900 dark:text-white line-clamp-1 text-sm md:text-base">{collection.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Folder className="size-3 text-gray-400" />
                          <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">{collection.folder}</span>
                        </div>
                      </div>
                      <div className="hidden md:flex gap-1 flex-wrap">
                        {collection.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}