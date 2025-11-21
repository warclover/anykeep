import { useState } from 'react';
import { mockCollections, platformNames, platformColors } from '../utils/mockData';
import { CollectionCard } from './CollectionCard';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Search, Grid, List, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';

export function Home() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const filteredCollections = selectedPlatform
    ? mockCollections.filter((c) => c.platform === selectedPlatform)
    : mockCollections;

  const platforms = Array.from(new Set(mockCollections.map((c) => c.platform)));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h2 className="text-gray-900 dark:text-white">我的收藏</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">共 {filteredCollections.length} 条收藏</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input
            placeholder="搜索收藏内容、标签或作者..."
            className="pl-10"
          />
        </div>

        {/* Platform Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={selectedPlatform === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPlatform(null)}
          >
            全部
          </Button>
          {platforms.map((platform) => (
            <Button
              key={platform}
              variant={selectedPlatform === platform ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPlatform(platform)}
            >
              {platformNames[platform]}
            </Button>
          ))}
        </div>
      </header>

      {/* Collections Grid/List */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredCollections.map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <CollectionCard collection={collection} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCollections.map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                  <div className="flex gap-3 md:gap-4">
                    <img
                      src={collection.coverImage}
                      alt={collection.title}
                      className="w-20 h-16 md:w-32 md:h-24 object-cover rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="text-gray-900 dark:text-white line-clamp-1 text-sm md:text-base">{collection.title}</h3>
                        <Badge variant="outline" className={`${platformColors[collection.platform]} text-xs flex-shrink-0`}>
                          {platformNames[collection.platform]}
                        </Badge>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm line-clamp-2 mb-2">
                        {collection.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {collection.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}