import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/evaluation': 'Self-Evaluation',
  '/team-status': 'Team Status',
  '/hr-admin': 'HR Admin',
  '/login': 'Login',
};

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
  const location = useLocation();
  
  // If custom items provided, use those
  if (items && items.length > 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <Link 
          to="/" 
          className="text-white/60 hover:text-white transition-colors flex items-center gap-1"
        >
          <Home className="w-3.5 h-3.5" />
        </Link>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-white/40" />
            {item.href && index < items.length - 1 ? (
              <Link 
                to={item.href} 
                className="text-white/60 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-white font-medium">{item.label}</span>
            )}
          </div>
        ))}
      </nav>
    );
  }

  // Auto-generate from current route
  const currentLabel = routeLabels[location.pathname] || 'Page';
  const isHome = location.pathname === '/' || location.pathname === '/dashboard';

  if (isHome) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <span className="text-white font-medium flex items-center gap-1.5">
          <Home className="w-3.5 h-3.5" />
          Dashboard
        </span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link 
        to="/" 
        className="text-white/60 hover:text-white transition-colors flex items-center gap-1"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-white/40" />
      <span className="text-white font-medium">{currentLabel}</span>
    </nav>
  );
};
