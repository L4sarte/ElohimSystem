'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { loginAction } from '@/app/actions/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    const res = await loginAction(formData);

    if (res.success) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.error || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08130E] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* GLOW DECORATIVO DORADO Y ESMERALDA */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D0A96B]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        
        {/* LOGO CORPORATIVO Y TITULO */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-[#13261E] border border-[#1B362A] shadow-2xl">
            <Image 
              src="/logo-elohim.png" 
              alt="Elohim Import ERP" 
              width={160} 
              height={50} 
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
              Elohim Import ERP
            </h1>
            <p className="text-xs text-zinc-400 mt-1 flex items-center justify-center gap-1 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-[#D0A96B]" />
              Acceso Seguro al Sistema de Gestión
            </p>
          </div>
        </div>

        {/* TARJETA DE LOGIN */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 backdrop-blur-md rounded-2xl shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-white font-serif">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Ingresa tus credenciales corporativas autorizadas.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* MENSAJE DE ERROR */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-shake">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* INPUT EMAIL */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#D0A96B]" /> Email Corporativo *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="usuario@elohimimport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-[#1B362A] bg-[#08130E] text-white placeholder:text-zinc-600 focus:border-[#D0A96B] font-mono text-xs rounded-xl"
                />
              </div>

              {/* INPUT CONTRASEÑA */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#D0A96B]" /> Contraseña *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-[#1B362A] bg-[#08130E] text-white placeholder:text-zinc-600 focus:border-[#D0A96B] font-mono text-xs rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* BOTÓN INGRESAR */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#D0A96B] to-[#E5C158] hover:from-[#E5C158] hover:to-[#D0A96B] text-[#08130E] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D0A96B]/20 rounded-xl cursor-pointer mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-[#08130E]" /> Validando Credenciales...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Ingresar al Sistema
                  </span>
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* FOOTER CORPORATIVO */}
        <p className="text-[10px] text-center text-zinc-500 font-mono">
          Elohim Import ERP v2.5 • Acceso Encriptado de Grado Financiero
        </p>

      </div>

    </div>
  );
}
