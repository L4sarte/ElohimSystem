'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getKanbanOrders, createKanbanOrder, updateOrderStatus, deleteKanbanOrder, KanbanOrder, KanbanOrderStatus } from '@/app/actions/kanban';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  LayoutGrid, Plus, RefreshCw, AlertCircle, ArrowLeft, 
  Clock, Package, CheckCircle2, Truck, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, X, Sparkles, Phone
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const COLUMNS = [
  { id: 'pending', label: 'Por Cobrar / Confirmar', icon: Clock, color: 'text-[#D0A96B]', bg: 'bg-[#D0A96B]/10', border: 'border-[#D0A96B]/30' },
  { id: 'processing', label: 'Armando Paquete', icon: Package, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  { id: 'ready', label: 'Listo para Retiro / Envío', icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { id: 'delivered', label: 'Entregado', icon: CheckCircle2, color: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/50' },
];

export default function KanbanPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para Crear Pedido
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [totalArs, setTotalArs] = useState('');
  const [status, setStatus] = useState<KanbanOrderStatus>('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Estado para ConfirmModal de Eliminación
  const [deleteOrderInfo, setDeleteOrderInfo] = useState<{ id: string; name: string } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    const res = await getKanbanOrders(role);
    if (res.success && res.data) {
      setOrders(res.data);
    } else {
      setError(res.error || 'Error al cargar pedidos Kanban');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [role]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setFormError('Ingresa el nombre del cliente.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const valTotal = parseFloat(totalArs) || 0;
    const res = await createKanbanOrder(role, {
      client_name: clientName,
      product_details: productDetails,
      total_ars: valTotal,
      status,
      notes
    });

    setSaving(false);
    if (res.success) {
      setIsModalOpen(false);
      setClientName('');
      setProductDetails('');
      setTotalArs('');
      setNotes('');
      fetchOrders();
    } else {
      setFormError(res.error || 'Error al guardar pedido.');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: KanbanOrderStatus) => {
    // Actualización optimista local
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    const res = await updateOrderStatus(role, orderId, newStatus);
    if (!res.success) {
      fetchOrders();
      toast.error(res.error || 'Error al mover el pedido.');
    } else {
      toast.success('Estado del pedido actualizado.');
    }
  };

  const handleDeleteOrder = (orderId: string, name: string) => {
    setDeleteOrderInfo({ id: orderId, name });
  };

  const executeDeleteOrder = async () => {
    if (!deleteOrderInfo) return;
    const res = await deleteKanbanOrder(role, deleteOrderInfo.id);
    if (res.success) {
      toast.success(`Pedido de "${deleteOrderInfo.name}" eliminado.`);
      fetchOrders();
    } else {
      toast.error(res.error || 'Error al eliminar pedido.');
    }
    setDeleteOrderInfo(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-[#D0A96B]">
                <LayoutGrid className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Tablero Kanban Pedidos WhatsApp
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">
        
        {/* CABECERA Y ACCIONES */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Seguimiento de Pedidos por Redes & WhatsApp
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Organiza la preparación y despacho de pedidos informales en tiempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrders}
              className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin text-[#D0A96B]' : ''}`} /> Actualizar
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs cursor-pointer shadow-md shadow-[#D0A96B]/20"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo Pedido WhatsApp
            </Button>
          </div>
        </div>

        {/* GRILLA DE COLUMNAS KANBAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const Icon = col.icon;
            const colOrders = orders.filter((o) => o.status === col.id);

            return (
              <div key={col.id} className="flex flex-col bg-[#13261E]/80 border border-[#1B362A] rounded-2xl p-4 min-h-[650px] space-y-3 shadow-xl">
                
                {/* CABECERA DE COLUMNA */}
                <div className="flex items-center justify-between pb-3 border-b border-[#1B362A]">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${col.bg} ${col.color} border ${col.border}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs text-white uppercase tracking-wider font-serif">
                      {col.label}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#08130E] border border-[#1B362A] text-[11px] font-mono font-bold text-zinc-300">
                    {colOrders.length}
                  </span>
                </div>

                {/* LISTA DE TARJETAS DE PEDIDO */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colOrders.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-500 italic">
                      Sin pedidos en este estado
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <Card key={order.id} className="border border-[#1B362A] bg-[#08130E] rounded-xl shadow-md transition-all hover:border-[#D0A96B]/40 group space-y-2 p-3.5">
                        
                        {/* Nombre del Cliente */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white font-serif flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-[#D0A96B]" />
                            {order.client_name}
                          </span>
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.client_name)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity p-1"
                            title="Eliminar tarjeta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Detalle de Productos */}
                        {order.product_details && (
                          <p className="text-xs text-zinc-300 leading-snug bg-[#13261E]/60 p-2 rounded-lg border border-[#1B362A]">
                            {order.product_details}
                          </p>
                        )}

                        {/* Notas */}
                        {order.notes && (
                          <p className="text-[10px] text-zinc-400 italic">
                            💬 {order.notes}
                          </p>
                        )}

                        {/* Total en ARS & Mover Estado */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#1B362A]">
                          <div className="font-mono font-extrabold text-xs text-[#D0A96B]">
                            ${order.total_ars.toLocaleString('es-AR')} ARS
                          </div>

                          {/* Selector Rápido de Estado */}
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as KanbanOrderStatus)}
                            className="bg-[#13261E] border border-[#1B362A] text-white text-[10px] font-bold rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
                          >
                            <option value="pending">⏳ Por Cobrar</option>
                            <option value="processing">📦 Armando</option>
                            <option value="ready">🚀 Listo Envío</option>
                            <option value="delivered">✅ Entregado</option>
                          </select>
                        </div>

                      </Card>
                    ))
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </main>

      {/* MODAL CREAR PEDIDO DE WHATSAPP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleCreateOrder}>
              
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-[#D0A96B]" />
                    Nuevo Pedido (WhatsApp / IG)
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400">
                  Ingresa los detalles del pedido para añadir la tarjeta al tablero Kanban.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                {formError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Nombre del Cliente *
                  </label>
                  <Input
                    required
                    placeholder="Ej. Juan Pérez (WhatsApp 11-2233-4455)"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    disabled={saving}
                    className="bg-[#08130E] border-[#1B362A] text-white disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Detalle de Productos / Perfumes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. 1x Bleau Chanel 100ml + 1x Decant Sauvage 10ml"
                    value={productDetails}
                    onChange={(e) => setProductDetails(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-lg border border-[#1B362A] bg-[#08130E] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                      Monto Total (ARS)
                    </label>
                    <Input
                      type="number"
                      placeholder="Ej. 75000"
                      value={totalArs}
                      onChange={(e) => setTotalArs(e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-[#D0A96B] font-mono font-bold disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Estado Inicial
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as KanbanOrderStatus)}
                      disabled={saving}
                      className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                    >
                      <option value="pending">⏳ Por Cobrar</option>
                      <option value="processing">📦 Armando Paquete</option>
                      <option value="ready">🚀 Listo Envío</option>
                      <option value="delivered">✅ Entregado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Notas adicionales / Envío
                  </label>
                  <Input
                    placeholder="Ej. Pasa a retirar hoy 18hs por Palermo"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={saving}
                    className="bg-[#08130E] border-[#1B362A] text-zinc-300 disabled:opacity-50"
                  />
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Crear Tarjeta Kanban'
                  )}
                </Button>
              </CardFooter>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmModal
        isOpen={Boolean(deleteOrderInfo)}
        title="Eliminar Pedido Kanban"
        description={`¿Estás seguro de que deseas eliminar la tarjeta de pedido de "${deleteOrderInfo?.name}"? Esta acción se removerá del tablero.`}
        confirmText="Eliminar Pedido"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={executeDeleteOrder}
        onCancel={() => setDeleteOrderInfo(null)}
      />

    </div>
  );
}
