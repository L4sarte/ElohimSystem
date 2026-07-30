'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { setManualRate, clearManualRate } from '@/app/actions/rates';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, Settings, Sliders, RefreshCw, AlertCircle, 
  Check, ShieldAlert, Globe, Lock 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeRateWidgetProps {
  role: UserRole;
  onRateChange?: () => void; // Callback opcional para avisar a otros componentes que el dólar cambió
}

export function ExchangeRateWidget({ role, onRateChange }: ExchangeRateWidgetProps) {
  const { rate, isManual, loading, error, refresh } = useExchangeRate();
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializar input con el valor actual del rate
  useEffect(() => {
    if (rate) {
      setCustomValue(rate.toString());
    }
  }, [rate, isOpen]);

  // Cerrar popover al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customValue);
    if (!val || val <= 0) {
      setSaveError('El valor debe ser un número positivo.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const res = await setManualRate(role, val);
    setSaving(false);
    if (res.success) {
      await refresh();
      setIsOpen(false);
      if (onRateChange) onRateChange();
    } else {
      setSaveError(res.error || 'Error al guardar la cotización');
    }
  };

  const handleRelease = async () => {
    setSaving(true);
    setSaveError(null);

    const res = await clearManualRate(role);
    setSaving(false);
    if (res.success) {
      await refresh();
      setIsOpen(false);
      if (onRateChange) onRateChange();
    } else {
      setSaveError(res.error || 'Error al liberar la cotización');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      
      {/* BOTÓN PRINCIPAL DEL WIDGET */}
      <div 
        onClick={() => role === 'admin' && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-all select-none backdrop-blur-sm",
          role === 'admin' ? "cursor-pointer hover:border-slate-300 dark:hover:border-[#1B362A] hover:bg-slate-50/50 dark:hover:bg-[#13261E]/50" : "",
          isManual 
            ? "border-amber-200 bg-amber-50/30 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/15 dark:text-amber-400"
            : "border-slate-200 bg-slate-50/30 text-slate-700 dark:border-[#1B362A] dark:bg-[#13261E]/30 dark:text-zinc-300"
        )}
      >
        <span className={cn(
          "flex h-2 w-2 rounded-full",
          isManual ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"
        )} />
        
        <div className="flex flex-col text-left leading-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            Dólar Blue
          </span>
          <span className="text-sm font-black tracking-tight mt-0.5">
            {loading ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> ...
              </span>
            ) : error ? (
              <span className="text-rose-500 text-xs">Error API</span>
            ) : (
              `$${rate?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200 dark:border-[#1B362A]">
          <span className={cn(
            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
            isManual 
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
          )}>
            {isManual ? 'Manual' : 'En vivo'}
          </span>
          
          {role === 'admin' && (
            <Settings className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors" />
          )}
        </div>
      </div>

      {/* PANEL POPUP DE AJUSTE (Solo Admin) */}
      {isOpen && role === 'admin' && (
        <div className="absolute right-0 mt-2.5 w-72 z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-[#1B362A] dark:bg-[#08130E] animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleOverride} className="space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-900">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#D0A96B]" />
                Ajuste cambiario
              </h4>
              <span className="text-[10px] rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-800 dark:bg-[#D0A96B]/10 dark:text-[#D0A96B] uppercase">
                Admin
              </span>
            </div>

            {saveError && (
              <div className="flex gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 p-2.5 text-[11px] text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Cotización Manual (ARS)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">$</span>
                <Input
                  type="number"
                  placeholder="Ej. 1350"
                  required
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="pl-7 text-sm font-semibold font-mono"
                  disabled={saving}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Esta cotización congelará el cálculo del dólar de referencia en todo el sistema.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="w-full bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 dark:bg-violet-500 dark:hover:bg-[#D0A96B] text-[#08130E] cursor-pointer justify-center text-xs font-semibold"
              >
                {saving ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Congelar Cotización
              </Button>
              
              {isManual && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={handleRelease}
                  size="sm"
                  className="w-full text-xs font-semibold justify-center cursor-pointer border-slate-200 hover:bg-slate-50 dark:border-[#1B362A] dark:hover:bg-[#13261E]"
                >
                  <Globe className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  Volver a Dólar en Vivo
                </Button>
              )}
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
