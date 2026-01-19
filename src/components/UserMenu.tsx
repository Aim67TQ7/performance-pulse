import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, ChevronDown } from 'lucide-react';

export const UserMenu = () => {
  const { employee } = useAuth();

  if (!employee) {
    return null;
  }

  const initials = `${employee.name_first?.[0] || ''}${employee.name_last?.[0] || ''}`.toUpperCase();
  const fullName = `${employee.name_first || ''} ${employee.name_last || ''}`.trim();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2 hover:bg-white/10">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {initials || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate text-white">
            {fullName}
          </span>
          <ChevronDown className="h-4 w-4 text-white/60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover border shadow-lg z-50">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fullName}</p>
            <p className="text-xs text-muted-foreground">{employee.user_email}</p>
          </div>
        </DropdownMenuLabel>
        {(employee.job_title || employee.department) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              {employee.job_title && (
                <p className="text-xs text-muted-foreground">{employee.job_title}</p>
              )}
              {employee.department && (
                <p className="text-xs text-muted-foreground">{employee.department}</p>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
