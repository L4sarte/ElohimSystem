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
  const totalCartItems = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );
  const toggleDrawer = useCartStore((state) => state.toggleDrawer);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* BARRA SUPERIOR DE ANUNCIOS Y ATENCIÓN */}
      <div className="bg-erp-surface border-b border-erp-border text-[11px] text-zinc-300 py-1.5 px-4">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">Alta Perfumería de Nicho & Decants 100% Originales</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            {settings.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-erp-gold" />
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
      <header className="sticky top-0 z-40 w-full border-b border-erp-border bg-erp-bg/90 backdrop-blur-md transition-all">
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
                <div className="text-[11px] text-erp-gold font-mono tracking-widest uppercase">
                  Boutique Online
                </div>
              </div>
            </Link>
          </div>

          {/* NAVEGACIÓN DESKTOP */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-300">
            <Link href="/tienda" className="hover:text-erp-gold transition-colors">
              Catálogo Completo
            </Link>
            <Link href="/tienda?type=decant_liquid" className="hover:text-erp-gold transition-colors flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Decants
            </Link>
            <Link href="/tienda?type=bottle" className="hover:text-erp-gold transition-colors">
              Botellas Selladas
            </Link>
            <Link href="#contacto" className="hover:text-erp-gold transition-colors">
              Showroom & Contacto
            </Link>
          </nav>

          {/* ACCIONES DERECHA: BOTÓN DE CARRITO */}
          <div className="flex items-center gap-3">
            
            {/* BOTÓN CARRITO */}
            <button
              onClick={toggleDrawer}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-erp-surface border border-erp-border hover:border-erp-gold/60 text-white transition-all cursor-pointer shadow-md group"
              title="Ver Carrito de Compras"
            >
              <div className="relative">
                <ShoppingBag className="h-5 w-5 text-erp-gold group-hover:scale-110 transition-transform" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-erp-gold text-[11px] font-black text-erp-bg animate-in zoom-in">
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
              className="md:hidden p-2 rounded-xl bg-erp-surface border border-erp-border text-zinc-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>

        {/* MENÚ DESPLEGABLE MOBILE */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-erp-surface border-b border-erp-border p-4 space-y-3 animate-in slide-in-from-top-4 duration-200 text-xs font-bold uppercase tracking-wider">
            <Link 
              href="/tienda" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-erp-gold"
            >
              Catálogo Completo
            </Link>
            <Link 
              href="/tienda?type=decant_liquid" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-erp-gold"
            >
              Decants Fraccionados
            </Link>
            <Link 
              href="/tienda?type=bottle" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-erp-gold"
            >
              Botellas Selladas
            </Link>
            <Link 
              href="#contacto" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-zinc-200 hover:text-erp-gold"
            >
              Ubicación & Contacto
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
