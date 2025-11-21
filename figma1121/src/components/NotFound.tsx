import { Link } from 'react-router';
import { Button } from './ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-gray-900 mb-2">404</h1>
        <h2 className="text-gray-700 mb-4">页面未找到</h2>
        <p className="text-gray-500 mb-6">抱歉，您访问的页面不存在</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4 mr-2" />
            返回上一页
          </Button>
          <Link to="/">
            <Button>
              <Home className="size-4 mr-2" />
              回到首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
