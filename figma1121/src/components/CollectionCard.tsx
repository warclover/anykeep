import { Collection, platformNames, platformColors } from '../utils/mockData';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Clock, User } from 'lucide-react';

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <div className="aspect-video relative">
        <img
          src={collection.coverImage}
          alt={collection.title}
          className="w-full h-full object-cover"
        />
        <Badge
          variant="secondary"
          className={`absolute top-2 right-2 ${platformColors[collection.platform]} text-white`}
        >
          {platformNames[collection.platform]}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="text-gray-900 dark:text-white line-clamp-2 mb-2 min-h-[3rem]">
          {collection.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
          {collection.description}
        </p>
        
        {/* AI Tags */}
        {collection.aiTags && (
          <div className="flex items-center gap-1 flex-wrap mb-3">
            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-xs">
              AI
            </Badge>
            {collection.aiTags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
          <div className="flex items-center gap-1">
            <User className="size-3" />
            <span>{collection.author}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="size-3" />
            <span>{formatDate(collection.createdAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}