'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, RefreshCw, DollarSign, Wallet, Clock, Zap
} from 'lucide-react';
import { CurrencyConverterWidget } from '@/components/rates/CurrencyConverterWidget';

interface RateItem {
  compra: number;
  venta: number;
}

interface RatesData {
  blue: RateItem;
  binance: RateItem;
  lemon: RateItem;
}

const DEFAULT_RATES: RatesData = {
  blue: { compra: 1550, venta: 1570 },
  binance: { compra: 1593, venta: 1595 },
  lemon: { compra: 1530, venta: 1595 }
};

export function ExchangeRatesWidget() {
  const [rates, setRates] = useState<RatesData>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchRates = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }

    try {
      const [resBlue, resBinance, resLemon] = await Promise.allSettled([
        fetch('https://dolarapi.com/v1/dolares/blue').then(res => res.ok ? res.json() : null),
        fetch('https://criptoya.com/api/binance/usdt/ars').then(res => res.ok ? res.json() : null),
        fetch('https://criptoya.com/api/lemoncash/usdt/ars').then(res => res.ok ? res.json() : null)
      ]);

      if (!isMountedRef.current) return;

      setRates(prev => {
        const updated = { ...prev };

        // 1. Dólar Blue
        if (resBlue.status === 'fulfilled' && resBlue.value) {
          const c = Number(resBlue.value.compra);
          const v = Number(resBlue.value.venta);
          if (!isNaN(c) && c > 0 && !isNaN(v) && v > 0) {
            updated.blue = { compra: c, venta: v };
          }
        }

        // 2. USDT Binance
        if (resBinance.status === 'fulfilled' && resBinance.value) {
          const c = Number(resBinance.value.bid);
          const v = Number(resBinance.value.ask);
          if (!isNaN(c) && c > 0 && !isNaN(v) && v > 0) {
            updated.binance = { compra: c, venta: v };
          }
        }

        // 3. USDT Lemon
        if (resLemon.status === 'fulfilled' && resLemon.value) {
          const c = Number(resLemon.value.bid);
          const v = Number(resLemon.value.ask);
          if (!isNaN(c) && c > 0 && !isNaN(v) && v > 0) {
            updated.lemon = { compra: c, venta: v };
          }
        }

        return updated;
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error al consultar cotizaciones:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchRates();

    // Auto-refresh cada 3 minutos (180,000 ms)
    const interval = setInterval(() => {
      fetchRates();
    }, 180000);

    return () => clearInterval(interval);
  }, [fetchRates]);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '$0,00';
    return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // SKELETON LOADER CON SHIMMER
  if (loading) {
    return (
      <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl p-5 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#1B362A]"></div>
            <div className="h-5 w-40 rounded-md bg-[#1B362A]"></div>
          </div>
          <div className="h-8 w-24 rounded-lg bg-[#1B362A]"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-2">
              <div className="h-4 w-24 bg-[#1B362A] rounded"></div>
              <div className="h-6 w-32 bg-[#1B362A] rounded"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      
      {/* HEADER DEL WIDGET */}
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between border-b border-[#1B362A]/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-[#D0A96B]">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
              Cotizaciones Mercado ARS (En Vivo)
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </CardTitle>
            {lastUpdated && (
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3 text-zinc-500" />
                Actualizado {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} hs
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRates(true)}
          disabled={refreshing}
          className="h-8 text-xs font-bold border-[#1B362A] bg-[#08130E] text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-[#D0A96B] ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </CardHeader>

      {/* CUADRÍCULA DE COTIZACIONES */}
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          {/* 1. DÓLAR BLUE */}
          <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] hover:border-[#D0A96B]/40 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-[#1B362A]/60">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white font-serif">Dólar Blue</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-mono">
                Informal
              </span>
            </div>

            <div className="pt-2.5 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-[10px] uppercase tracking-wider">Compra:</span>
                <span className="font-semibold text-zinc-300">{formatCurrency(rates.blue.compra)}</span>
              </div>
              <div className="flex justify-between items-center text-[#D0A96B] font-bold text-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E5C158] font-sans">Venta (Ref):</span>
                <span className="text-base text-[#D0A96B] font-black">{formatCurrency(rates.blue.venta)}</span>
              </div>
            </div>
          </div>

          {/* 2. USDT BINANCE */}
          <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] hover:border-[#D0A96B]/40 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-[#1B362A]/60">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white font-serif">USDT Binance</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-mono">
                P2P
              </span>
            </div>

            <div className="pt-2.5 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-[10px] uppercase tracking-wider">Compra (Bid):</span>
                <span className="font-semibold text-zinc-300">{formatCurrency(rates.binance.compra)}</span>
              </div>
              <div className="flex justify-between items-center text-[#D0A96B] font-bold text-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E5C158] font-sans">Venta (Ask):</span>
                <span className="text-base text-[#D0A96B] font-black">{formatCurrency(rates.binance.venta)}</span>
              </div>
            </div>
          </div>

          {/* 3. USDT LEMON CASH */}
          <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] hover:border-[#D0A96B]/40 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-[#1B362A]/60">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-lime-500/10 text-lime-400">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white font-serif">USDT Lemon</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-400 uppercase font-mono">
                Crypto Wallet
              </span>
            </div>

            <div className="pt-2.5 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span className="text-[10px] uppercase tracking-wider">Compra (Bid):</span>
                <span className="font-semibold text-zinc-300">{formatCurrency(rates.lemon.compra)}</span>
              </div>
              <div className="flex justify-between items-center text-[#D0A96B] font-bold text-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E5C158] font-sans">Venta (Ask):</span>
                <span className="text-base text-[#D0A96B] font-black">{formatCurrency(rates.lemon.venta)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MINI WIDGET CONVERSOR RÁPIDO EN VIVO */}
        <CurrencyConverterWidget 
          dolarBlueVenta={rates.blue.venta}
          usdtBinanceVenta={rates.binance.venta}
          usdtLemonVenta={rates.lemon.venta}
        />
      </CardContent>

    </Card>
  );
}
