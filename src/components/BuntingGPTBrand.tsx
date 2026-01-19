import { cn } from '@/lib/utils';

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
    sm: { circle: 'w-5 h-5', text: 'text-base' },
    md: { circle: 'w-6 h-6', text: 'text-lg' },
    lg: { circle: 'w-8 h-8', text: 'text-xl' },
  };
  
  return (
    <a 
      href={href} 
      className={cn(
        "flex items-center gap-2 hover:opacity-80 transition-opacity",
        className
      )}
    >
      <div className={cn(sizes[size].circle, "rounded-full bg-[#E31B23]")} />
      <span className={cn(sizes[size].text, "font-semibold tracking-tight")}>
        <span className="text-white">Bunting</span>
        <span className="text-[#6B9BD2]">GPT</span>
      </span>
    </a>
  );
};
