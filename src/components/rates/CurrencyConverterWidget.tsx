'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, DollarSign, Coins, Calculator, Sparkles } from 'lucide-react';

interface CurrencyConverterWidgetProps {
  dolarBlueVenta: number;
  usdtBinanceVenta: number;
  usdtLemonVenta: number;
}

export function CurrencyConverterWidget({
  dolarBlueVenta = 1570,
  usdtBinanceVenta = 1595,
  usdtLemonVenta = 1595
}: CurrencyConverterWidgetProps) {
  const [amount, setAmount] = useState<string>('100000');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');

  const numAmount = parseFloat(amount) || 0;

  // Conversión según la moneda base elegida
  const arsValue = currency === 'ARS' ? numAmount : numAmount * dolarBlueVenta;
  const usdBlueValue = currency === 'USD' ? numAmount : (dolarBlueVenta > 0 ? numAmount / dolarBlueVenta : 0);
  const usdtBinanceValue = currency === 'USD' ? (dolarBlueVenta > 0 ? (numAmount * dolarBlueVenta) / usdtBinanceVenta : 0) : (usdtBinanceVenta > 0 ? numAmount / usdtBinanceVenta : 0);
  const usdtLemonValue = currency === 'USD' ? (dolarBlueVenta > 0 ? (numAmount * dolarBlueVenta) / usdtLemonVenta : 0) : (usdtLemonVenta > 0 ? numAmount / usdtLemonVenta : 0);

  const toggleCurrency = () => {
    if (currency === 'ARS') {
      setCurrency('USD');
      setAmount((numAmount / dolarBlueVenta).toFixed(2));
    } else {
      setCurrency('ARS');
      setAmount((numAmount * dolarBlueVenta).toFixed(0));
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-[#1B362A]/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#D0A96B] font-serif">
          <Calculator className="h-3.5 w-3.5" />
          <span>Conversor Rápido en Vivo</span>
        </div>
        <button
          onClick={toggleCurrency}
          className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-[#08130E] border border-[#1B362A] text-zinc-300 hover:text-[#D0A96B] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeftRight className="h-3 w-3 text-[#D0A96B]" />
          Modo: Base {currency}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
        {/* Input Monto Base */}
        <div className="relative">
          <span className="absolute left-2.5 top-2.5 text-xs font-bold text-zinc-400 font-mono">
            {currency === 'ARS' ? '$' : 'u$s'}
          </span>
          <Input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="pl-7 h-9 bg-[#08130E] border-[#1B362A] text-white font-mono text-xs font-bold rounded-xl"
          />
        </div>

        {/* Resultado ARS */}
        <div className="p-2.5 rounded-xl bg-[#08130E] border border-[#1B362A] flex justify-between items-center text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">En ARS:</span>
          <span className="font-mono font-bold text-white">${Math.round(arsValue).toLocaleString('es-AR')}</span>
        </div>

        {/* Resultado USD Blue */}
        <div className="p-2.5 rounded-xl bg-[#08130E] border border-[#1B362A] flex justify-between items-center text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D0A96B] font-mono">u$s Blue:</span>
          <span className="font-mono font-bold text-[#D0A96B]">u$s {usdBlueValue.toFixed(2)}</span>
        </div>

        {/* Resultado USDT Binance */}
        <div className="p-2.5 rounded-xl bg-[#08130E] border border-[#1B362A] flex justify-between items-center text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">USDT P2P:</span>
          <span className="font-mono font-bold text-amber-400">₮ {usdtBinanceValue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
