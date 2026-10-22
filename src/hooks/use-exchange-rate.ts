'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentRate } from '@/app/actions/rates';
import { useUserStore } from './use-user-store';
import { toast } from 'sonner';

// Promesa compartida a nivel módulo para deduplicar requests simultáneas de múltiples componentes
let activeRateFetchPromise: Promise<void> | null = null;

export function useExchangeRate() {
  const exchangeRate = useUserStore((state) => state.exchangeRate);
  const isRateManual = useUserStore((state) => state.isRateManual);
  const setExchangeRate = useUserStore((state) => state.setExchangeRate);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchRate = useCallback(async (forceRefresh = false) => {
    // Si ya hay un fetch en curso, reusar la misma promesa para evitar N llamadas HTTP paralelas
    if (activeRateFetchPromise && !forceRefresh) {
      return activeRateFetchPromise;
    }

    if (isMountedRef.current) setLoading(true);

    activeRateFetchPromise = (async () => {
      try {
        const res = await getCurrentRate();

        if (!res.success || !res.data) {
          throw new Error(res.error || 'Error al obtener la cotización activa');
        }

        setExchangeRate(res.data.value_ars, res.data.type === 'manual');
        if (isMountedRef.current) setError(null);

        // Notificar si se activó la cotización de respaldo (Fallback)
        if (res.data.type === 'fallback' || res.data.is_fallback) {
          toast.warning('Usando tipo de cambio de respaldo', {
            description: `API cambiaria no disponible. Tasa fija de respaldo: $${res.data.value_ars} ARS`,
            duration: 5000,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error de conexión con la API cambiaria';
        if (isMountedRef.current) setError(msg);
      } finally {
        if (isMountedRef.current) setLoading(false);
        activeRateFetchPromise = null;
      }
    })();

    return activeRateFetchPromise;
  }, [setExchangeRate]);

  useEffect(() => {
    // Carga inicial solo si no ha sido cargada previamente en el store global
    if (exchangeRate === null) {
      fetchRate();
    }
  }, [exchangeRate, fetchRate]);

  return {
    rate: exchangeRate,
    isManual: isRateManual,
    loading,
    error,
    refresh: () => fetchRate(true),
  };
}
