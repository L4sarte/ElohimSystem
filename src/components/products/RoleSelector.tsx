'use client';

import { useUserStore } from '@/hooks/use-user-store';
import { Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoleSelector() {
  const { role, setRole } = useUserStore();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#1B362A] bg-[#13261E]/80 p-1 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setRole('admin')}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 cursor-pointer select-none",
          role === 'admin'
            ? "bg-[#D0A96B] text-[#08130E] font-black shadow-sm"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-[#1B362A]/60"
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
            ? "bg-indigo-600 text-white font-black shadow-sm"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-[#1B362A]/60"
        )}
      >
        <User className="h-3 w-3" />
        Vendedor
      </button>
    </div>
  );
}
