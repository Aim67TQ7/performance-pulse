import { BuntingGPTBrand } from './BuntingGPTBrand';
import { UserMenu } from './UserMenu';
import { Breadcrumbs } from './Breadcrumbs';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface FloatingNavProps {
  breadcrumbs?: BreadcrumbItem[];
}

export const FloatingNav = ({ breadcrumbs }: FloatingNavProps = {}) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A2E] border-b border-white/10">
      <div className="container flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <BuntingGPTBrand />
          <div className="hidden sm:block">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
        <UserMenu />
      </div>
    </nav>
  );
};
