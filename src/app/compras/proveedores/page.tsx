'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getSuppliers, createSupplier, SupplierInput } from '@/app/actions/suppliers';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Search, Plus, Truck, Mail, Phone, User, 
  X, RefreshCw, AlertCircle, ShieldAlert, FileText, Building
} from 'lucide-react';
import Link from 'next/link';

export default function ProveedoresPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscador
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Alta
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    const res = await getSuppliers(role);
    if (res.success && res.data) {
      setSuppliers(res.data);
    } else {
      setError(res.error || 'Error al cargar los proveedores');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [role]);

  const handleOpenForm = () => {
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    const supplierData: SupplierInput = {
      name: name.trim(),
      contact_name: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined
    };

    const res = await createSupplier(role, supplierData);
    setSubmitting(false);

    if (res.success) {
      setIsFormOpen(false);
      fetchSuppliers();
    } else {
      setError(res.error || 'Error al crear el proveedor');
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Acceso denegado para vendedor
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
                La gestión de proveedores B2B es exclusiva para administradores.
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/compras"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Módulo Compras</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Truck className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Directorio B2B de Proveedores
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
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Gestión de Proveedores y Marcas B2B
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Directorio oficial de distibuidores, fabricantes de fragancias e insumos para perfumería.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/compras/nueva">
              <Button variant="outline" className="cursor-pointer">
                + Ingreso de Mercadería
              </Button>
            </Link>
            <Button 
              onClick={handleOpenForm} 
              className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white cursor-pointer shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar Proveedor
            </Button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#13261E] p-4 rounded-xl border border-slate-200 dark:border-[#1B362A] shadow-sm mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, contacto, teléfono o email..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={fetchSuppliers} className="cursor-pointer">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar Lista
          </Button>
        </div>

        {/* TABLA DE PROVEEDORES (Data Table Shadcn) */}
        <Card className="border-slate-200 dark:border-[#1B362A]">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando directorio de proveedores...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchSuppliers} className="mt-2">Reintentar</Button>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Truck className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Sin Proveedores</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">No se registraron proveedores en la base de datos.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-4 pl-6">Proveedor / Razón Social</th>
                    <th className="p-4">Contacto Principal</th>
                    <th className="p-4">Teléfono</th>
                    <th className="p-4">Email</th>
                    <th className="p-4 pr-6">Notas / Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                  {filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors">
                      
                      {/* Razón Social */}
                      <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building className="h-4 w-4 text-indigo-500 shrink-0" />
                        {sup.name}
                      </td>

                      {/* Contacto */}
                      <td className="p-4 text-slate-700 dark:text-zinc-300">
                        {sup.contact_name ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sup.contact_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin especificar</span>
                        )}
                      </td>

                      {/* Teléfono */}
                      <td className="p-4">
                        {sup.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 font-mono">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sup.phone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="p-4">
                        {sup.email ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sup.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Notas */}
                      <td className="p-4 pr-6 text-xs text-slate-500 dark:text-zinc-400 max-w-xs truncate">
                        {sup.notes || <span className="italic text-slate-400">Sin notas</span>}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* MODAL DE ALTA DE PROVEEDOR */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmitForm}>
              <CardHeader className="border-b border-slate-100 dark:border-zinc-900 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="h-5 w-5 text-indigo-600" />
                    Registrar Proveedor B2B
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="mt-1">
                  Ingresa los datos comerciales del distribuidor de perfumes o frascos insumo.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre / Razón Social *</label>
                  <Input
                    required
                    placeholder="Ej. Distribuidora Fragance SA"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Persona de Contacto</label>
                  <Input
                    placeholder="Ej. Roberto Gómez (Ejecutivo de ventas)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Teléfono</label>
                    <Input
                      placeholder="+54 11..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
                    <Input
                      type="email"
                      placeholder="ventas@proveedor.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Notas u Observaciones</label>
                  <Input
                    placeholder="Condiciones comerciales, plazos de entrega..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

              </CardContent>

              <CardFooter className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-3 bg-slate-50/50 dark:bg-[#13261E]/20 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 text-white cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Proveedor'
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
