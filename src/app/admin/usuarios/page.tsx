'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Users, ShieldCheck, ShieldAlert, UserCheck, 
  Search, RefreshCw, AlertCircle, Sparkles, UserPlus, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { getUsers, updateUserRole, UserProfile } from '@/app/actions/users';

export default function UsuariosPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsersList = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getUsers(role);
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setError(res.error || 'Error al cargar la lista de usuarios');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsersList();
  }, [role]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'seller') => {
    setUpdatingUserId(userId);
    const res = await updateUserRole(role, userId, newRole);
    setUpdatingUserId(null);

    if (res.success) {
      toast.success(`Rol del usuario actualizado a "${newRole === 'admin' ? 'Administrador' : 'Vendedor'}"`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } else {
      toast.error(res.error || 'Error al cambiar el rol del usuario');
      fetchUsersList();
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#08130E] flex flex-col items-center justify-center text-center p-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md space-y-3 shadow-xl">
          <ShieldAlert className="h-10 w-10 mx-auto" />
          <h2 className="text-lg font-bold">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400">La gestión de usuarios y asignación de roles es exclusiva para administradores.</p>
          <Link href="/">
            <Button variant="outline" className="mt-2 border-[#1B362A] text-zinc-300">
              Volver al Inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Inicio</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-amber-400">
                <Users className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Gestión de Usuarios & Roles
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">
        
        {/* ENCABEZADO Y CONTROLES */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#13261E] p-6 rounded-2xl border border-[#1B362A] shadow-xl">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Permisos & Control de Acceso RLS
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
              Usuarios Registrados en Elohim ERP
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Administración centralizada de cuentas de personal, vendedores y permisos administrativos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsersList}
              className="border-[#1B362A] bg-[#08130E] text-zinc-300 hover:bg-[#13261E] cursor-pointer"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin text-[#D0A96B]' : ''}`} /> Actualizar
            </Button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y METRICAS RAPIDAS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#13261E]/80 p-4 rounded-xl border border-[#1B362A] gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar usuario por correo o ID..."
              className="pl-9 bg-[#08130E] border-[#1B362A] text-white placeholder:text-zinc-500 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
            <span className="bg-[#08130E] px-3 py-1.5 rounded-lg border border-[#1B362A]">
              Total Usuarios: <strong className="text-white">{users.length}</strong>
            </span>
            <span className="bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-500/20">
              Admins: <strong className="text-purple-300">{users.filter((u) => u.role === 'admin').length}</strong>
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              Vendedores: <strong className="text-emerald-300">{users.filter((u) => u.role === 'seller').length}</strong>
            </span>
          </div>
        </div>

        {/* TABLA DE DATOS DE USUARIOS */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-medium text-zinc-400">Cargando directorio de usuarios...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchUsersList} className="mt-2 border-[#1B362A]">Reintentar</Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Users className="h-10 w-10 text-zinc-600" />
                <h3 className="font-bold text-white font-serif">Sin Usuarios Encontrados</h3>
                <p className="text-xs text-zinc-400 max-w-sm">No existen cuentas registradas que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#08130E]/60 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4 pl-6">Usuario / Correo Electrónico</th>
                    <th className="p-4">Identificador Supabase</th>
                    <th className="p-4">Fecha Alta</th>
                    <th className="p-4 text-center">Rol Actual</th>
                    <th className="p-4 text-right pr-6">Acción / Cambiar Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B362A] text-xs font-mono">
                  {filteredUsers.map((userItem) => {
                    const isAdmin = userItem.role === 'admin';
                    const isUpdating = updatingUserId === userItem.id;

                    return (
                      <tr key={userItem.id} className="hover:bg-[#1B362A]/40 transition-colors">
                        
                        {/* Email */}
                        <td className="p-4 pl-6 font-semibold text-white flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <span>{userItem.email}</span>
                        </td>

                        {/* ID */}
                        <td className="p-4 text-zinc-400 text-[11px]">
                          {userItem.id}
                        </td>

                        {/* Fecha Alta */}
                        <td className="p-4 text-zinc-400 text-[11px]">
                          {new Date(userItem.created_at).toLocaleDateString('es-AR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>

                        {/* Badge de Rol */}
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                            isAdmin
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          }`}>
                            <Shield className="h-3 w-3" />
                            {isAdmin ? 'Administrador' : 'Vendedor'}
                          </span>
                        </td>

                        {/* Dropdown de Modificación de Rol */}
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            {isUpdating ? (
                              <RefreshCw className="h-4 w-4 animate-spin text-[#D0A96B]" />
                            ) : (
                            <select
                              value={userItem.role}
                              disabled={updatingUserId !== null}
                              onChange={(e) => handleRoleChange(userItem.id, e.target.value as 'admin' | 'seller')}
                              className="bg-[#08130E] border border-[#1B362A] text-white text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D0A96B] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="seller">👤 Asignar Vendedor</option>
                              <option value="admin">👑 Asignar Administrador</option>
                            </select>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

    </div>
  );
}
