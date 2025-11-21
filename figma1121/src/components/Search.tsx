import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Search as SearchIcon, Sparkles, Filter } from 'lucide-react';
import { mockCollections, platformNames, platformColors } from '../utils/mockData';
import { Link } from 'react-router';
import { Card, CardContent } from './ui/card';

export function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(mockCollections);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults(mockCollections);
      return;
    }

    const filtered = mockCollections.filter(
      (c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ||
        c.aiTags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(filtered);
  };

  const recentSearches = ['产品设计', 'React 教程', '京都旅行', 'AI 工具'];
  const popularTags = ['产品设计', 'AI', '前端开发', '旅行攻略', '数据分析', '职场技能'];

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-gray-900 dark:text-white mb-4 md:mb-6">智能搜索</h2>
          
          {/* Search Input */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              placeholder="搜索收藏内容、标签、作者..."
              className="pl-12 pr-12 h-12 md:h-14 text-sm md:text-base"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
            >
              <Sparkles className={`size-5 ${isSemanticSearch ? 'text-purple-600' : 'text-gray-400'}`} />
            </Button>
          </div>

          {/* Semantic Search Toggle */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mb-6">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full md:w-auto"
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
            >
              <Sparkles className="size-4" />
              {isSemanticSearch ? 'AI语义搜索已开启' : '开启AI语义搜索'}
            </Button>
            {isSemanticSearch && (
              <span className="text-gray-500 text-xs md:text-sm">理解搜索意图，匹配相关内容</span>
            )}
          </div>

          {/* Recent Searches & Popular Tags */}
          {searchQuery === '' && (
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">最近搜索</p>
                <div className="flex gap-2 flex-wrap">
                  {recentSearches.map((term) => (
                    <Button
                      key={term}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(term)}
                    >
                      {term}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">热门标签</p>
                <div className="flex gap-2 flex-wrap">
                  {popularTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSearch(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Search Results */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-3xl mx-auto">
          {searchQuery && (
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
                找到 <span className="text-gray-900 dark:text-white">{searchResults.length}</span> 条结果
                {isSemanticSearch && (
                  <Badge variant="outline" className="ml-2 bg-purple-50 border-purple-200 text-purple-700 text-xs">
                    AI智能匹配
                  </Badge>
                )}
              </p>
            </div>
          )}

          <div className="space-y-3 md:space-y-4">
            {searchResults.map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex gap-3 md:gap-4">
                      <img
                        src={collection.coverImage}
                        alt={collection.title}
                        className="w-20 h-16 md:w-32 md:h-24 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-gray-900 dark:text-white line-clamp-2 text-sm md:text-base">{collection.title}</h3>
                          <Badge
                            variant="outline"
                            className={`${platformColors[collection.platform]} text-white flex-shrink-0 text-xs`}
                          >
                            {platformNames[collection.platform]}
                          </Badge>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm line-clamp-2 mb-3">
                          {collection.description}
                        </p>
                        {collection.aiSummary && isSemanticSearch && (
                          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-700 rounded p-2 mb-3">
                            <p className="text-purple-900 dark:text-purple-300 text-xs md:text-sm">
                              <Sparkles className="size-3 inline mr-1" />
                              AI摘要: {collection.aiSummary}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {collection.aiTags?.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
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