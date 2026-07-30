'use client';

import { useUserStore } from '@/hooks/use-user-store';
import { Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoleSelector() {
  const { role, setRole } = useUserStore();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/50 p-1 dark:border-[#1B362A] dark:bg-[#13261E]/50 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setRole('admin')}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 cursor-pointer select-none",
          role === 'admin'
            ? "bg-[#D0A96B] text-[#08130E] text-white shadow-sm dark:bg-violet-500"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
        )}
      >
        <Shield className="h-3 w-3" />
        Admin
      </button>
      <button
        type="button"
        onClick={() => setRole('seller')}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 cursor-pointer select-none",
          role === 'seller'
            ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
        )}
      >
        <User className="h-3 w-3" />
        Vendedor (Seller)
      </button>
    </div>
  );
}
