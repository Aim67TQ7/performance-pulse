import { ArrowLeft } from 'lucide-react';
import { UserMenu } from './UserMenu';

export const FloatingNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <a 
          href="https://gate.buntinggpt.com" 
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Gate
        </a>
        <UserMenu />
      </div>
    </nav>
  );
};
