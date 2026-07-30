'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getMonthlyProjection, setMonthlyGoal, MonthlyProjectionData } from '@/app/actions/goals';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Target, RefreshCw, TrendingUp, Flame, Calendar, DollarSign, 
  CheckCircle, AlertTriangle, Settings, X, Sparkles 
} from 'lucide-react';

export function MonthlyGoalsWidget() {
  const { role } = useUserStore();
  const [projection, setProjection] = useState<MonthlyProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Configuración de Metas
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [inputRevGoal, setInputRevGoal] = useState('');
  const [inputProfitGoal, setInputProfitGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  const fetchProjection = async () => {
    setLoading(true);
    setError(null);
    const res = await getMonthlyProjection(role);
    if (res.success && res.data) {
      setProjection(res.data);
    } else {
      setError(res.error || 'Error al cargar proyecciones del mes');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchProjection();
    }
  }, [role]);

  const handleOpenModal = () => {
    if (projection) {
      setInputRevGoal(projection.revenueGoalArs.toString());
      setInputProfitGoal(projection.netProfitGoalArs.toString());
    } else {
      setInputRevGoal('5000000');
      setInputProfitGoal('2000000');
    }
    setGoalError(null);
    setIsConfigModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projection) return;

    const valRev = parseFloat(inputRevGoal);
    const valProfit = parseFloat(inputProfitGoal);

    if (isNaN(valRev) || isNaN(valProfit) || valRev <= 0 || valProfit <= 0) {
      setGoalError('Ingresa montos numéricos positivos para las metas.');
      return;
    }

    setSavingGoal(true);
    setGoalError(null);

    const res = await setMonthlyGoal(role, projection.periodMonth, valRev, valProfit);
    setSavingGoal(false);

    if (res.success) {
      setIsConfigModalOpen(false);
      fetchProjection();
    } else {
      setGoalError(res.error || 'Error al guardar metas del mes');
    }
  };

  if (role !== 'admin') return null;

  return (
    <div className="space-y-4">
      
      <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
        
        <CardHeader className="border-b border-[#1B362A] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
                <Target className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
                  Metas Mensuales & Run Rate Proyectado
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Monitoreo predictivo de facturación y margen neto con cálculo diario en tiempo real.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenModal}
                className="h-8 text-xs cursor-pointer border-[#1B362A] bg-[#08130E] font-bold text-[#D0A96B] hover:bg-zinc-800"
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Configurar Meta
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={fetchProjection}
                className="text-zinc-400 hover:text-white cursor-pointer"
                title="Actualizar Run Rate"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#D0A96B]' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-zinc-400 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#D0A96B]" />
              Calculando proyecciones y avance de metas...
            </div>
          ) : error || !projection ? (
            <div className="text-xs text-rose-400 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              {error || 'No se pudieron calcular las proyecciones'}
            </div>
          ) : (
            <>
              {/* BARRAS DE PROGRESO DE METAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Meta de Facturación */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">Facturación Actual vs Meta</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${projection.currentRevenueArs.toLocaleString('es-AR')} / ${projection.revenueGoalArs.toLocaleString('es-AR')} ARS
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-[#08130E] border border-[#1B362A] overflow-hidden p-0.5">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, projection.revenueProgressPercent)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Avance: <strong>{projection.revenueProgressPercent}%</strong></span>
                    <span>Meta: 100%</span>
                  </div>
                </div>

                {/* Meta de Ganancia Neta */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">Ganancia Neta vs Meta</span>
                    <span className="font-mono font-bold text-[#D0A96B]">
                      ${projection.currentNetProfitArs.toLocaleString('es-AR')} / ${projection.netProfitGoalArs.toLocaleString('es-AR')} ARS
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-[#08130E] border border-[#1B362A] overflow-hidden p-0.5">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, projection.profitProgressPercent)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Avance: <strong>{projection.profitProgressPercent}%</strong></span>
                    <span>Meta: 100%</span>
                  </div>
                </div>

              </div>

              {/* CARD DE RUN RATE PREDICTIVO Y STATUS */}
              <div className="p-4 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-serif">
                      Proyección Run Rate (Día {projection.currentDay} de {projection.totalDaysInMonth})
                    </span>
                  </div>

                  {projection.status === 'on_track' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="h-3 w-3" /> Ritmo Óptimo ({projection.runRatePercent}%)
                    </span>
                  )}
                  {projection.status === 'warning' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <AlertTriangle className="h-3 w-3" /> En Riesgo ({projection.runRatePercent}%)
                    </span>
                  )}
                  {projection.status === 'behind' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <Flame className="h-3 w-3" /> Retrasado ({projection.runRatePercent}%)
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  A este ritmo comercial, cerrarás el mes con una facturación estimada de <strong className="text-emerald-400 font-mono">${projection.runRateRevenueArs.toLocaleString('es-AR')} ARS</strong> ({projection.runRatePercent}% de tu meta).
                  {projection.remainingDays > 0 && projection.dailyRevenueNeeded > 0 ? (
                    <> Para alcanzar el 100%, necesitás facturar en promedio <strong className="text-amber-400 font-mono">${projection.dailyRevenueNeeded.toLocaleString('es-AR')} ARS diarios</strong> durante los últimos {projection.remainingDays} días del mes.</>
                  ) : (
                    <> ¡Felicidades! Has superado la meta del mes en curso.</>
                  )}
                </p>
              </div>

            </>
          )}
        </CardContent>

      </Card>

      {/* MODAL CONFIGURACIÓN DE META DEL MES */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#08130E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveGoal}>
              
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#D0A96B]" />
                    Configurar Meta del Mes
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="mt-1 text-xs text-zinc-400">
                  Ajusta los objetivos comerciales en ARS para el período {projection?.periodMonth}.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                {goalError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{goalError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Meta de Facturación Bruta (ARS) *
                  </label>
                  <Input
                    required
                    type="number"
                    placeholder="Ej. 5000000"
                    value={inputRevGoal}
                    onChange={(e) => setInputRevGoal(e.target.value)}
                    className="bg-[#13261E] border-[#1B362A] text-emerald-300 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Meta de Ganancia Neta (ARS) *
                  </label>
                  <Input
                    required
                    type="number"
                    placeholder="Ej. 2000000"
                    value={inputProfitGoal}
                    onChange={(e) => setInputProfitGoal(e.target.value)}
                    className="bg-[#13261E] border-[#1B362A] text-[#E5C158] font-mono font-bold"
                  />
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#13261E]/40 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfigModalOpen(false)}
                  disabled={savingGoal}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingGoal}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white font-bold text-xs shadow-md shadow-violet-600/20"
                >
                  {savingGoal ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando Meta...
                    </>
                  ) : (
                    'Guardar Meta del Mes'
                  )}
                </Button>
              </CardFooter>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
