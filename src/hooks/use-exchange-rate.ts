'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentRate } from '@/app/actions/rates';
import { useUserStore } from './use-user-store';
import { toast } from 'sonner';

export function useExchangeRate() {
  const { exchangeRate, isRateManual, setExchangeRate } = useUserStore();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchRate = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const res = await getCurrentRate();

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Error al obtener la cotización activa');
      }

      setExchangeRate(res.data.value_ars, res.data.type === 'manual');
      setError(null);

      // Notificar si se activó la cotización de respaldo (Fallback)
      if (res.data.type === 'fallback' || res.data.is_fallback) {
        toast.warning('Usando tipo de cambio de respaldo', {
          description: `API cambiaria no disponible. Tasa fija de respaldo: $${res.data.value_ars} ARS`,
          duration: 5000,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión con la API cambiaria';
      setError(msg);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
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
    refresh: fetchRate,
  };
}
