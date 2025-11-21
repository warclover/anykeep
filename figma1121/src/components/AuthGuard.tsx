import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated (for demo, check localStorage)
    const authToken = localStorage.getItem('anykeep_auth');
    
    if (!authToken && location.pathname !== '/login') {
      // Not authenticated, redirect to login
      navigate('/login', { replace: true });
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate, location]);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
