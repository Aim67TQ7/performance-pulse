import { cn } from '@/lib/utils';
import buntingLogo from '@/assets/bunting-logo.png';

interface BuntingGPTBrandProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BuntingGPTBrand = ({ 
  href = "https://gate.buntinggpt.com",
  size = 'md',
  className
}: BuntingGPTBrandProps) => {
  const sizes = {
    sm: { logo: 'w-6 h-6', text: 'text-base' },
    md: { logo: 'w-8 h-8', text: 'text-lg' },
    lg: { logo: 'w-10 h-10', text: 'text-xl' },
  };
  
  return (
    <a 
      href={href} 
      className={cn(
        "flex items-center gap-2 hover:opacity-80 transition-opacity",
        className
      )}
    >
      <img 
        src={buntingLogo} 
        alt="Bunting" 
        className={cn(sizes[size].logo, "object-contain")} 
      />
      <span className={cn(sizes[size].text, "font-semibold tracking-tight")}>
        <span className="text-white">Bunting</span>
        <span className="text-[#6B9BD2]">GPT</span>
      </span>
    </a>
  );
};
