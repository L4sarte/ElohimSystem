'use client';

/**
 * Gráfico de facturación/ganancias del panel admin.
 * Aislado en su propio módulo para poder cargarlo con next/dynamic (ssr: false):
 * recharts pesa ~100KB+ y no aporta nada al HTML inicial del dashboard.
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity } from 'lucide-react';

export interface SalesByDatePoint {
  date: string;
  Ventas: number;
  Ganancias: number;
  GananciaReal?: number;
  GananciaNeta?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const ventas = data?.Ventas ?? payload[0]?.value;
    const gananciaReal = data?.Ganancias ?? payload[1]?.value;
    const gananciaNeta = data?.GananciaNeta !== undefined ? data?.GananciaNeta : payload[2]?.value;

    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[220px]">
        <p className="font-serif font-bold text-erp-gold border-b border-erp-border pb-1">Día: {label}</p>
        <p className="text-zinc-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-erp-gold"></span> Facturación:
          </span>
          <span className="font-mono text-erp-gold font-bold">${Number(ventas || 0).toLocaleString('es-AR')}</span>
        </p>
        <p className="text-zinc-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Ganancia Comercial:
          </span>
          <span className="font-mono text-emerald-400 font-bold">${Number(gananciaReal || 0).toLocaleString('es-AR')}</span>
        </p>
        {gananciaNeta !== undefined && (
          <p className="text-zinc-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-400"></span> Ganancia Neta:
            </span>
            <span className="font-mono text-teal-300 font-bold">${Number(gananciaNeta || 0).toLocaleString('es-AR')}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function AdminSalesChart({ data }: { data: SalesByDatePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 border border-dashed border-erp-border rounded-2xl bg-erp-bg/50 my-4">
        <Activity className="h-10 w-10 text-erp-gold/50" />
        <div className="text-sm font-bold text-white font-serif">Sin movimientos registrados</div>
        <div className="text-xs text-zinc-400 max-w-xs">No se registran transacciones en el período seleccionado.</div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
          <YAxis tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            formatter={(value) => <span className="text-zinc-400">{value}</span>}
          />
          <Bar name="Facturación" dataKey="Ventas" fill="#D0A96B" radius={[4, 4, 0, 0]} barSize={16} />
          <Bar name="Ganancia Comercial Real" dataKey="Ganancias" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
          <Bar name="Ganancia Neta Final" dataKey="GananciaNeta" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
