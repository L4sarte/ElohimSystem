'use client';

import { useEffect, useRef } from 'react';

export interface BarcodeScannerOptions {
  maxIntervalMs?: number; // Tiempo máximo permitido entre teclas (defecto: 35ms)
  minLength?: number;     // Longitud mínima del código de barras (defecto: 3)
}

/**
 * Custom Hook que detecta lecturas de escáneres de código de barras por hardware.
 * Los lectores emiten secuencias ultrarrápidas de teclas (<35ms entre caracteres)
 * y finalizan con un evento 'Enter'.
 *
 * Optimizado para rendimiento: utiliza un ref para el callback onScan evitando
 * desmontar y re-registrar el event listener en cada render del componente consumidor.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {}
) {
  const { maxIntervalMs = 35, minLength = 3 } = options;
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Mantener actualizado el callback sin invalidar el listener global
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas de control / modificación
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
        return;
      }

      const currentTime = performance.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Si la tecla presionada es 'Enter'
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          const scannedCode = bufferRef.current.trim();
          bufferRef.current = '';
          if (scannedCode) {
            onScanRef.current(scannedCode);
          }
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // Si el tiempo transcurrido es mayor al intervalo de ráfaga del escáner, reiniciar buffer (tecleo manual)
      if (timeDiff > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Concatenar caracteres imprimibles de 1 carácter
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [maxIntervalMs, minLength]);
}
