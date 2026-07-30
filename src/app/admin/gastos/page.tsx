'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { 
  getExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense, 
  OperatingExpense, 
  OperatingExpenseInput 
} from '@/app/actions/expenses';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Plus, Edit, Trash2, RefreshCw, AlertCircle, 
  ShieldAlert, DollarSign, Calendar, Layers, FileText, Check, X, Landmark 
} from 'lucide-react';
import Link from 'next/link';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';

const CATEGORIES = ['Marketing', 'Alquiler', 'Servicios', 'Logística', 'Honorarios', 'Varios'];

export default function GastosPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OperatingExpense | null>(null);

  const [category, setCategory] = useState<string>('Varios');
  const [amountArs, setAmountArs] = useState<string>('');
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);

  const fetchExpensesList = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const [res, resAcc] = await Promise.all([
      getExpenses(role),
      getTreasuryAccounts()
    ]);

    if (res.success && res.data) {
      setExpenses(res.data);
    } else {
      setError(res.error || 'Error al cargar los gastos operativos.');
    }

    if (resAcc.success && resAcc.data) {
      setTreasuryAccounts(resAcc.data);
      if (resAcc.data.length > 0 && !selectedTreasuryAccountId) {
        setSelectedTreasuryAccountId(resAcc.data[0].id);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchExpensesList();
  }, [role]);

  const handleOpenForm = (item?: OperatingExpense) => {
    if (item) {
      setEditingItem(item);
      setCategory(item.category || 'Varios');
      setAmountArs(item.amount_ars.toString());
      setAmountUsd(item.amount_usd ? item.amount_usd.toString() : '');
      setDescription(item.description);
      setExpenseDate(item.expense_date);
    } else {
      setEditingItem(null);
      setCategory('Varios');
      setAmountArs('');
      setAmountUsd('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto operativo?')) return;
    const res = await deleteExpense(role, id);
    if (res.success) {
      fetchExpensesList();
    } else {
      alert(res.error || 'Error al eliminar el gasto');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: OperatingExpenseInput = {
      category,
      amount_ars: parseFloat(amountArs) || 0,
      amount_usd: parseFloat(amountUsd) || 0,
      description: description.trim(),
      expense_date: expenseDate,
      treasury_account_id: selectedTreasuryAccountId
    };

    let res;
    if (editingItem) {
      res = await updateExpense(role, editingItem.id, input);
    } else {
      res = await createExpense(role, input);
    }

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchExpensesList();
    } else {
      setError(res.error || 'Error al guardar el gasto');
    }
  };

  // Denegar acceso a vendedores
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Volver</span>
            </Link>
            <RoleSelector />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/5 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold text-rose-800 dark:text-rose-400">Acceso Restringido</CardTitle>
              <CardDescription className="dark:text-rose-500/80">
                La gestión de gastos operativos y costos fijos es exclusiva para administradores.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full justify-center">
                  Volver al Dashboard
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  const totalOpexArs = expenses.reduce((acc, curr) => acc + Number(curr.amount_ars || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-md shadow-rose-500/20">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Gastos Operativos (OPEX)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Gestor de Gastos Operativos y Costos Fijos
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Registra alquileres, marketing, servicios y honorarios para calcular la Ganancia Neta exacta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right pr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total OPEX Registrado</span>
              <span className="text-base font-black text-rose-600 font-mono">${totalOpexArs.toLocaleString('es-AR')} ARS</span>
            </div>
            <Button 
              onClick={() => handleOpenForm()} 
              className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm font-bold"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Registrar Gasto
            </Button>
          </div>
        </div>

        {/* DATA TABLE DE GASTOS */}
        <Card className="border-slate-200 dark:border-[#1B362A]">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-rose-600" />
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando registro de gastos...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2">
                <AlertCircle className="h-10 w-10 text-rose-600" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchExpensesList} className="mt-2">Reintentar</Button>
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Layers className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Sin Gastos Registrados</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">No hay compras o gastos fijos ingresados en la plataforma aún.</p>
                <Button onClick={() => handleOpenForm()} className="mt-2 bg-rose-600 text-white">Registrar Primer Gasto</Button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-4 pl-6">Fecha</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Descripción</th>
                    <th className="p-4 text-right font-mono">Monto ARS</th>
                    <th className="p-4 text-right font-mono">Monto USD</th>
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors">
                      
                      {/* Fecha */}
                      <td className="p-4 pl-6 font-mono text-xs font-semibold text-slate-600 dark:text-zinc-400">
                        {new Date(e.expense_date).toLocaleDateString('es-AR')}
                      </td>

                      {/* Categoría */}
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
                          {e.category}
                        </span>
                      </td>

                      {/* Descripción */}
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        {e.description}
                      </td>

                      {/* Monto ARS */}
                      <td className="p-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        ${Number(e.amount_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Monto USD */}
                      <td className="p-4 text-right font-mono text-xs text-slate-400">
                        {e.amount_usd ? `u$s ${Number(e.amount_usd).toFixed(2)}` : '-'}
                      </td>

                      {/* Acciones */}
                      <td className="p-4 pr-6 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleOpenForm(e)}
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          title="Editar gasto"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(e.id)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* MODAL ALTA / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmitForm}>
              <CardHeader className="border-b border-slate-100 dark:border-zinc-900 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-rose-600" />
                    {editingItem ? 'Editar Gasto Operativo' : 'Registrar Gasto Operativo'}
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="mt-1">
                  Ingresa los detalles del costo financiero u operativo para la analítica.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                {/* Cuenta de Origen en Tesorería */}
                {!editingItem && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B] flex items-center gap-1">
                      <Landmark className="h-3.5 w-3.5" /> Cuenta de Origen (Egreso de Tesorería) *
                    </label>
                    <select
                      value={selectedTreasuryAccountId}
                      onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white font-bold"
                    >
                      {treasuryAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          🏦 {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Categoría *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-input/40 dark:bg-input/10 dark:text-white font-semibold"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Fecha del Gasto *</label>
                    <Input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Monto ARS ($) *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amountArs}
                      onChange={(e) => setAmountArs(e.target.value)}
                      className="h-10 font-mono text-sm font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Monto USD (Opcional)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                      className="h-10 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Descripción / Concepto *</label>
                  <Input
                    required
                    placeholder="Ej. Campaña publicitaria Instagram / Alquiler local..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

              </CardContent>

              <CardFooter className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-3 bg-slate-50/50 dark:bg-[#13261E]/20 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-bold shadow-md"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Gasto'
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
