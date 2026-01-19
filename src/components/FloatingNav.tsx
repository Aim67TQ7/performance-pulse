import { BuntingGPTBrand } from './BuntingGPTBrand';
import { UserMenu } from './UserMenu';

export const FloatingNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A2E] border-b border-white/10">
      <div className="container flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <BuntingGPTBrand />
        <UserMenu />
      </div>
    </nav>
  );
};
