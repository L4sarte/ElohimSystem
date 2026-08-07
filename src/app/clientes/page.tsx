'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getClientsDetailed, createClient, updateClient, getClientPurchaseHistory } from '@/app/actions/clients';
import { getOlfactoryMatchForClient, OlfactoryMatchResult } from '@/app/actions/crm';
import { usePosStore } from '@/hooks/use-pos-store';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Search, Plus, Edit, Clock, Mail, Phone, User, 
  X, Check, RefreshCw, AlertCircle, Sparkles, Tag, ShoppingBag, 
  ShoppingCart, Droplet, ArrowRight, Flame 
} from 'lucide-react';
import { SmartRecommendations } from '@/components/crm/SmartRecommendations';
import { getProducts } from '@/app/actions/products';
import { Product } from '@/types';
import Link from 'next/link';

const AVAILABLE_NOTES = ['Cítrico', 'Amaderado', 'Gourmand', 'Floral', 'Especiado', 'Cuero', 'Oriental', 'Fresco', 'Vainilla', 'Tabaco', 'Bergamota', 'Sándalo', 'Cedro'];

export default function ClientesPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();
  const router = useRouter();
  const addItemToCart = usePosStore((state) => state.addItem);

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');

  // Modales Formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  
  // Panel Lateral (Sheet)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'purchases' | 'match'>('purchases');
  
  // Historial de compras
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Match Olfativo
  const [matches, setMatches] = useState<OlfactoryMatchResult[]>([]);
  const [loadingMatch, setLoadingMatch] = useState(false);

  // Formulario
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    const [clientsRes, productsRes] = await Promise.all([
      getClientsDetailed(role),
      getProducts(role)
    ]);
    if (clientsRes.success && clientsRes.data) {
      setClients(clientsRes.data);
    } else {
      setError(clientsRes.error || 'Error al cargar clientes');
    }
    if (productsRes.success && productsRes.data) {
      setAllProducts(productsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [role]);

  const handleOpenForm = (client: any | null = null) => {
    if (client) {
      setEditingClient(client);
      setFormName(client.name);
      setFormPhone(client.phone || '');
      setFormEmail(client.email || '');
      setFormNotes(client.preferred_notes || []);
    } else {
      setEditingClient(null);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormNotes([]);
    }
    setIsFormOpen(true);
  };

  const handleToggleNote = (note: string) => {
    setFormNotes(prev => 
      prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSubmitting(true);
    setError(null);

    const clientData = {
      name: formName.trim(),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      preferred_notes: formNotes
    };

    let res;
    if (editingClient) {
      res = await updateClient(role, editingClient.id, clientData);
    } else {
      res = await createClient(role, clientData);
    }

    setSubmitting(false);

    if (res.success) {
      setIsFormOpen(false);
      fetchClients();
    } else {
      setError(res.error || 'Error al procesar cliente');
    }
  };

  const handleOpenHistory = async (client: any) => {
    setHistoryClient(client);
    setIsHistoryOpen(true);
    setActiveTab('purchases');
    setLoadingHistory(true);
    setPurchaseHistory([]);
    setMatches([]);
    
    // Cargar historial de compras
    const res = await getClientPurchaseHistory(role, client.id);
    setLoadingHistory(false);
    
    if (res.success && res.data) {
      setPurchaseHistory(res.data);
    }

    // Cargar match olfativo automáticamente
    fetchOlfactoryMatch(client.id);
  };

  const fetchOlfactoryMatch = async (clientId: string) => {
    setLoadingMatch(true);
    const matchRes = await getOlfactoryMatchForClient(role, clientId);
    setLoadingMatch(false);

    if (matchRes.success && matchRes.data) {
      setMatches(matchRes.data);
    }
  };

  const handleSendToPos = (product: any) => {
    addItemToCart(product);
    router.push('/pos');
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getNoteBadgeColor = (note: string) => {
    switch (note) {
      case 'Cítrico': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'Amaderado': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Gourmand': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'Floral': return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'Especiado': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'Cuero': return 'bg-stone-500/10 text-stone-300 border-stone-500/30';
      case 'Oriental': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Fresco': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default: return 'bg-zinc-800 text-zinc-300 border-[#1B362A]';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-violet-500/20">
                <User className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                CRM de Clientes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
              Gestión de Clientes y Perfiles Olfativos
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              CRM comercial. Administra perfiles olfativos y ejecuta recomendaciones inteligentes cruzadas con el inventario.
            </p>
          </div>
        </div>

        {/* MOTOR DE RECOMENDACIONES INTELIGENTES (HOT LEADS CRM) */}
        <div className="mb-8">
          <SmartRecommendations products={allProducts} />
        </div>

        {/* BARRA DE BÚSQUEDA Y ALTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[#13261E]/90 p-4 rounded-2xl border border-[#1B362A] shadow-xl mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              className="pl-9 bg-[#08130E] border-[#1B362A]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={() => handleOpenForm()} 
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white cursor-pointer shadow-md shadow-violet-600/20 font-bold text-xs"
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar Cliente
          </Button>
        </div>

        {/* TABLA DE CLIENTES */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-medium text-zinc-400">Cargando clientes...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchClients} className="mt-2">Reintentar</Button>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <User className="h-10 w-10 text-zinc-700" />
                <h3 className="font-bold text-white">Sin clientes</h3>
                <p className="text-sm text-zinc-400 max-w-sm">No se encontraron clientes en el sistema.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4 pl-6">Cliente</th>
                    <th className="p-4">Contacto</th>
                    <th className="p-4">Perfil Olfativo</th>
                    <th className="p-4 text-emerald-400">Total Compras (ARS)</th>
                    <th className="p-4 text-[#D0A96B] font-mono">VibePoints</th>
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-[#13261E]/50 transition-colors">
                      
                      {/* Nombre */}
                      <td className="p-4 pl-6 font-bold text-white font-serif">
                        {client.name}
                      </td>

                      {/* Contacto */}
                      <td className="p-4 space-y-1">
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
                            <Phone className="h-3 w-3 text-zinc-500" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                            <Mail className="h-3 w-3 text-zinc-500" />
                            <span>{client.email}</span>
                          </div>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-xs text-zinc-500 italic">Sin datos de contacto</span>
                        )}
                      </td>

                      {/* Perfil Olfativo */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {client.preferred_notes && client.preferred_notes.length > 0 ? (
                            client.preferred_notes.map((note: string) => (
                              <span 
                                key={note} 
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getNoteBadgeColor(note)}`}
                              >
                                {note}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Sin notas asignadas</span>
                          )}
                        </div>
                      </td>

                      {/* Total gastado */}
                      <td className="p-4 font-mono font-bold text-emerald-400">
                        ${Number(client.total_spent_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* VibePoints */}
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-extrabold px-2.5 py-1 rounded-full bg-[#D0A96B]/10 text-[#E5C158] border border-[#D0A96B]/30">
                          <Sparkles className="h-3.5 w-3.5 text-[#D0A96B]" />
                          {client.points_balance || 0} pts
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenHistory(client)}
                            className="text-[#D0A96B] hover:text-[#E5C158] hover:bg-[#D0A96B]/10 cursor-pointer"
                            title="Ver Historial & Match Olfativo"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenForm(client)}
                            className="text-zinc-400 hover:text-white cursor-pointer"
                            title="Editar perfil"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* MODAL DE EDICIÓN / CREACIÓN DE CLIENTE */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#08130E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmitForm}>
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#D0A96B]" />
                    {editingClient ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="mt-1 text-xs text-zinc-400">
                  Ingresa los datos personales y selecciona sus familias/notas aromáticas preferidas.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nombre Completo *</label>
                  <Input
                    required
                    placeholder="Ej. Juan Pérez"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-[#13261E] border-[#1B362A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Teléfono</label>
                    <Input
                      placeholder="+54 9..."
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="bg-[#13261E] border-[#1B362A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Email</label>
                    <Input
                      type="email"
                      placeholder="perez@mail.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="bg-[#13261E] border-[#1B362A]"
                    />
                  </div>
                </div>

                {/* Perfil Olfativo Grid */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B] block">
                    Notas & Familias Olfativas Preferidas
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-[#13261E]/60 border border-[#1B362A] rounded-xl p-3 max-h-48 overflow-y-auto">
                    {AVAILABLE_NOTES.map(note => {
                      const selected = formNotes.includes(note);
                      return (
                        <button
                          key={note}
                          type="button"
                          onClick={() => handleToggleNote(note)}
                          className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-left ${
                            selected
                              ? 'bg-[#D0A96B] text-[#08130E] border-violet-500 text-white font-bold shadow-sm shadow-violet-600/30'
                              : 'bg-[#08130E] border-[#1B362A] text-zinc-400 hover:border-[#1B362A] hover:text-white'
                          }`}
                        >
                          <span>{note}</span>
                          {selected && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#13261E]/40 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white font-bold text-xs shadow-md shadow-violet-600/20"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Cliente'
                  )}
                </Button>
              </CardFooter>
            </form>
          </div>
        </div>
      )}

      {/* PANEL LATERAL (SHEET): HISTORIAL Y MATCH OLFATIVO */}
      {isHistoryOpen && historyClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg h-full bg-[#08130E] border-l border-[#1B362A] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
            
            {/* Header del Sheet con Pestañas */}
            <div className="border-b border-[#1B362A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-white font-serif">
                    {historyClient.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Perfil de Cliente & Asesoría Olfativa</p>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Pestañas de Selección: Historial vs Match Olfativo */}
              <div className="grid grid-cols-2 gap-2 bg-[#13261E]/90 p-1 rounded-xl border border-[#1B362A]">
                <button
                  onClick={() => setActiveTab('purchases')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'purchases'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Clock className="h-4 w-4 text-indigo-400" />
                  Historial Compras
                </button>

                <button
                  onClick={() => setActiveTab('match')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'match'
                      ? 'bg-[#D0A96B] text-[#08130E] text-white shadow-md shadow-violet-600/30'
                      : 'text-zinc-400 hover:text-[#E5C158]'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Match Inteligente
                </button>
              </div>
            </div>

            {/* CUERPO DE PESTAÑAS */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* PESTAÑA 1: HISTORIAL DE COMPRAS */}
              {activeTab === 'purchases' && (
                <>
                  {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                      <span className="text-xs text-zinc-400">Cargando compras...</span>
                    </div>
                  ) : purchaseHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-zinc-500">
                      <ShoppingBag className="h-8 w-8 opacity-45 text-zinc-600" />
                      <span className="text-xs">No registra compras en este ERP.</span>
                    </div>
                  ) : (
                    purchaseHistory.map(sale => (
                      <div 
                        key={sale.id}
                        className="rounded-2xl border border-[#1B362A] bg-[#13261E]/60 p-4 space-y-3 shadow-md"
                      >
                        <div className="flex justify-between items-start text-xs border-b border-[#1B362A] pb-2">
                          <div>
                            <div className="font-bold text-zinc-200">
                              Venta #{sale.id.split('-')[0].toUpperCase()}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              {new Date(sale.created_at).toLocaleString('es-AR')}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-black text-emerald-400 font-mono">
                              ${Number(sale.total_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[9px] text-zinc-500 font-mono">
                              u$s {Number(sale.total_usd_equivalent).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                          {sale.sale_items.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-xs">
                              <div>
                                <span className="font-bold text-white">
                                  {item.products?.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 ml-1">
                                  ({item.products?.brand}) x {item.quantity}
                                  {item.products?.type === 'decant_liquid' ? ' ml' : ' ud'}
                                </span>
                              </div>
                              <span className="font-mono text-zinc-400">
                                ${Number((item.price_ars_at_moment || item.price_ars || 0) * item.quantity).toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>

                      </div>
                    ))
                  )}
                </>
              )}

              {/* PESTAÑA 2: MOTOR DE MATCH OLFATIVO */}
              {activeTab === 'match' && (
                <div className="space-y-4">
                  
                  {/* Resumen de preferencias del cliente */}
                  <div className="p-3.5 rounded-xl bg-violet-950/30 border border-[#1B362A] text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#E5C158]">
                      <Flame className="h-4 w-4 text-[#D0A96B]" />
                      Preferencias de {historyClient.name}:
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {historyClient.preferred_notes && historyClient.preferred_notes.length > 0 ? (
                        historyClient.preferred_notes.map((n: string) => (
                          <span key={n} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D0A96B] text-[#08130E]/30 text-violet-200 border border-[#D0A96B]/40">
                            {n}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">No se cargaron preferencias. Edita el cliente para seleccionarlas.</span>
                      )}
                    </div>
                  </div>

                  {loadingMatch ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <RefreshCw className="h-7 w-7 animate-spin text-[#D0A96B]" />
                      <span className="text-xs font-semibold text-zinc-400">Analizando coincidencia olfativa de inventario...</span>
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500 gap-2 border border-[#1B362A] rounded-2xl bg-[#13261E]/40 p-4">
                      <AlertCircle className="h-8 w-8 text-zinc-600" />
                      <span className="text-xs font-bold text-zinc-300">Sin coincidencias exactas en stock</span>
                      <span className="text-[11px] text-zinc-500">No hay productos en stock con las notas preferidas o sin disponibilidad actual.</span>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 flex items-center justify-between">
                        <span>Recomendados ({matches.length})</span>
                        <span className="text-emerald-400 text-[10px]">✔ Stock Disponible</span>
                      </div>

                      {matches.map((m, idx) => (
                        <div 
                          key={m.product.id}
                          className="p-4 rounded-2xl border border-[#1B362A] bg-[#13261E]/90 shadow-xl space-y-3 transition-all hover:border-[#D0A96B]/40"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-serif font-bold text-sm text-white">
                                  {m.product.name}
                                </h4>
                                {m.isDecantLiquid ? (
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    Decant Líquido
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                    Botella Sellada
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5">
                                Marca: <strong className="text-zinc-200">{m.product.brand}</strong> • Familia: <strong className="text-[#E5C158]">{m.product.olfactory_family || 'N/D'}</strong>
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <div className="text-xs font-black text-white">
                                ${m.product.base_price_ars.toLocaleString('es-AR')}
                              </div>
                              <div className="text-[9px] text-zinc-500">
                                Stock: {m.product.stock_quantity} {m.isDecantLiquid ? 'ml' : 'uds'}
                              </div>
                            </div>
                          </div>

                          {/* Notas Olfativas con coincidencias destacadas */}
                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold uppercase text-zinc-500 tracking-wider">Notas Aromáticas:</span>
                            <div className="flex flex-wrap gap-1">
                              {m.allNotes.map(n => {
                                const isMatch = m.matchingNotes.some(mn => mn.toLowerCase() === n.toLowerCase());
                                return (
                                  <span
                                    key={n}
                                    className={`text-[9px] px-2 py-0.5 rounded-md font-semibold ${
                                      isMatch
                                        ? 'bg-[#D0A96B] text-[#08130E]/30 text-violet-200 border border-violet-500/50 font-bold shadow-sm shadow-violet-500/20'
                                        : 'bg-zinc-800/60 text-zinc-400 border border-[#1B362A]/50'
                                    }`}
                                  >
                                    {n} {isMatch && '★'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* BOTÓN LLEVAR AL POS */}
                          <Button
                            onClick={() => handleSendToPos(m.product)}
                            className="w-full bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white font-bold text-xs h-9 cursor-pointer shadow-md shadow-violet-600/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Llevar al POS para Cobrar <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Footer del Sheet */}
            <div className="border-t border-[#1B362A] p-4 bg-[#13261E]/40">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                onClick={() => setIsHistoryOpen(false)}
              >
                Cerrar Panel
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
