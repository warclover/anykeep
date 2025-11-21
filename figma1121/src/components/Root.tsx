import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Home, Search, Folder, Settings, BarChart3, Plus, Menu, X, LogOut, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { AddCollectionDialog } from './AddCollectionDialog';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('anykeep_auth');
    toast.success('已退出登录');
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/search', icon: Search, label: '搜索' },
    { path: '/collections', icon: Folder, label: '收藏夹' },
    { path: '/statistics', icon: BarChart3, label: '数据' },
    { path: '/settings', icon: Settings, label: '设置' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <header className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white">AnyKeep</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowMobileMenu(false)} />
      )}

      {/* Sidebar - Desktop / Mobile Drawer */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 hidden md:block">
          <h1 className="text-gray-900 dark:text-white">AnyKeep</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">智能收藏管理</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setShowMobileMenu(false)}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Icon className="size-5 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start hidden md:flex"
            onClick={() => {
              console.log('Theme button clicked, current theme:', theme);
              toggleTheme();
            }}
          >
            {theme === 'light' ? (
              <>
                <Moon className="size-5 mr-2" />
                深色模式
              </>
            ) : (
              <>
                <Sun className="size-5 mr-2" />
                浅色模式
              </>
            )}
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              setShowAddDialog(true);
              setShowMobileMenu(false);
            }}
          >
            <Plus className="size-5 mr-2" />
            添加收藏
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="size-5 mr-2" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={`w-full flex flex-col items-center gap-1 h-auto py-2 ${
                    isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      <AddCollectionDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <Toaster />
    </div>
  );
}