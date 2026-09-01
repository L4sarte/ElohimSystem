'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/hooks/use-cart-store';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { 
  ShoppingBag, Search, Sparkles, MessageCircle, Menu, X, 
  MapPin, Phone, AtSign, ArrowRight, ShieldCheck, Heart 
} from 'lucide-react';

interface StorefrontHeaderProps {
  settings?: SystemSettingsData;
}

export function StorefrontHeader({ settings = DEFAULT_SYSTEM_SETTINGS }: StorefrontHeaderProps) {
  const { getTotalItems, toggleDrawer } = useCartStore();
  const totalCartItems = getTotalItems();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* BARRA SUPERIOR DE ANUNCIOS Y ATENCIÓN */}
      <div className="bg-[#13261E] border-b border-[#1B362A] text-[11px] text-zinc-300 py-1.5 px-4">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">Alta Perfumería de Nicho & Decants 100% Originales</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-zinc-400 font-mono text-[10px]">
            {settings.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-[#D0A96B]" />
                {settings.phone}
              </span>
            )}
            {settings.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-indigo-400" />
                {settings.city}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* HEADER PRINCIPAL GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/90 backdrop-blur-md transition-all">
        <div className="container mx-auto max-w-6xl flex h-16 sm:h-20 items-center justify-between px-4 sm:px-6">
          
          {/* LOGO & BRANDING */}
          <div className="flex items-center gap-3">
            <Link href="/tienda" className="flex items-center gap-3 group">
              <img
                src={settings.logo_url || '/logo-elohim.png'}
                alt={settings.trade_name}
                className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="hidden md:block">
                <div className="text-base font-black uppercase tracking-wider text-white font-serif">
                  {settings.trade_name}
                </div>
                <div className="text-[10px] text-[#D0A96B] font-mono tracking-widest uppercase">
                  Boutique Online
                </div>
              </div>
            </Link>
          </div>

          {/* NAVEGACIÓN DESKTOP */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-300">
            <Link href="/tienda" className="hover:text-[#D0A96B] transition-colors">
              Catálogo Completo
            </Link>
            <Link href="/tienda?type=decant_liquid" className="hover:text-[#D0A96B] transition-colors flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Decants
            </Link>
            <Link href="/tienda?type=bottle" className="hover:text-[#D0A96B] transition-colors">
              Botellas Selladas
            </Link>
            <Link href="#contacto" className="hover:text-[#D0A96B] transition-colors">
              Showroom & Contacto
            </Link>
          </nav>

          {/* ACCIONES DERECHA: BOTÓN DE CARRITO */}
          <div className="flex items-center gap-3">
            
            {/* BOTÓN CARRITO */}
            <button
              onClick={toggleDrawer}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#13261E] border border-[#1B362A] hover:border-[#D0A96B]/60 text-white transition-all cursor-pointer shadow-md group"
              title="Ver Carrito de Compras"
            >
              <div className="relative">
                <ShoppingBag className="h-5 w-5 text-[#D0A96B] group-hover:scale-110 transition-transform" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#D0A96B] text-[10px] font-black text-[#08130E] animate-in zoom-in">
                    {totalCartItems}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold hidden sm:inline text-zinc-200">
                Mi Carrito
              </span>
            </button>

            {/* BOTÓN MENÚ MOBILE */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-[#13261E] border border-[#1B362A] text-zinc-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>

        {/* MENÚ DESPLEGABLE MOBILE */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#13261E] border-b border-[#1B362A] p-4 space-y-3 animate-in slide-in-from-top-4 duration-200 text-xs font-bold uppercase tracking-wider">
            <Link 
              href="/tienda" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-[#D0A96B]"
            >
              Catálogo Completo
            </Link>
            <Link 
              href="/tienda?type=decant_liquid" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-[#D0A96B]"
            >
              Decants Fraccionados
            </Link>
            <Link 
              href="/tienda?type=bottle" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-[#D0A96B]"
            >
              Botellas Selladas
            </Link>
            <Link 
              href="#contacto" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-[#D0A96B]"
            >
              Ubicación & Contacto
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
