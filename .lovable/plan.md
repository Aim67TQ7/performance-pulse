

## Password Reset & Logo Update

### Overview

This plan addresses two changes:
1. Reset all employee email passwords to `1Bunting!`
2. Replace the red dot in the BuntingGPT branding with the new interlocking crescents logo

---

### Part 1: Reset All Passwords

The password reset functionality already exists in the system. The edge function at `/admin/set-default-passwords` can set a default password for all active employees with email addresses.

**Action Required:**

You'll need to trigger the password reset from the HR Admin page (Password Management section):
1. Go to `/hr-admin`
2. In the Password Management card, change the default password field to `1Bunting!`
3. Click "Set Default Password for All Employees"
4. Confirm the action
5. Enter the Supabase Service Role Key when prompted

Alternatively, if you want this to happen automatically in the code, I can update the default password value in the `PasswordManagement` component from `Welcome2Bunting!` to `1Bunting!`.

---

### Part 2: Replace Logo

**Current State:**
- The `BuntingGPTBrand` component shows a red circle (`<div className="rounded-full bg-[#E31B23]" />`) next to the "BuntingGPT" text
- This component is used in:
  - `FloatingNav.tsx` (navigation bar)
  - `Login.tsx` (login page, 2 places)
  - `ProtectedRoute.tsx` (loading screen)

**Changes:**

| File | Change |
|------|--------|
| Copy uploaded logo | Copy `Interlocking_Crescents_Logo_Design.png` to `src/assets/bunting-logo.png` |
| `src/components/BuntingGPTBrand.tsx` | Replace the red div with an `<img>` tag using the new logo |

**Updated Component:**

```tsx
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
```

---

### Part 3: Update Default Password Value

To ensure the Password Management UI shows the correct default:

| File | Change |
|------|--------|
| `src/components/admin/PasswordManagement.tsx` | Change default from `Welcome2Bunting!` to `1Bunting!` |

---

### Summary of Files

| File | Action |
|------|--------|
| `src/assets/bunting-logo.png` | Create (copy from uploaded image) |
| `src/components/BuntingGPTBrand.tsx` | Replace red div with logo image |
| `src/components/admin/PasswordManagement.tsx` | Update default password to `1Bunting!` |

---

### Post-Implementation

After these changes are made, you'll still need to manually trigger the password reset from the HR Admin page to actually reset all existing passwords in the database to `1Bunting!`. The code changes just update the default value shown in the UI.

