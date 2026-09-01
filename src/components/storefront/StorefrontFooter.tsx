'use client';

import React from 'react';
import Link from 'next/link';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { 
  ShieldCheck, Truck, CreditCard, Sparkles, MapPin, 
  Phone, Mail, AtSign, Clock, Heart 
} from 'lucide-react';

interface StorefrontFooterProps {
  settings?: SystemSettingsData;
}

export function StorefrontFooter({ settings = DEFAULT_SYSTEM_SETTINGS }: StorefrontFooterProps) {
  return (
    <footer id="contacto" className="bg-[#08130E] border-t border-[#1B362A] text-zinc-400 text-xs">
      
      {/* BENEFICIOS DESTACADOS */}
      <div className="border-b border-[#1B362A] bg-[#13261E]/60 py-8 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
          
          <div className="flex items-center sm:items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B362A] text-[#D0A96B]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white uppercase text-xs font-serif">100% Originales</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Fragancias de nicho y diseñador garantizadas.</p>
            </div>
          </div>

          <div className="flex items-center sm:items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B362A] text-[#D0A96B]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white uppercase text-xs font-serif">Envíos a Todo el País</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Embalaje reforzado y seguro de transporte.</p>
            </div>
          </div>

          <div className="flex items-center sm:items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B362A] text-[#D0A96B]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white uppercase text-xs font-serif">Múltiples Medios de Pago</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Transferencia, efectivo y medios digitales.</p>
            </div>
          </div>

          <div className="flex items-center sm:items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B362A] text-[#D0A96B]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white uppercase text-xs font-serif">Decants de Calidad</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Fraccionado milimétrico en atomizadores de vidrio.</p>
            </div>
          </div>

        </div>
      </div>

      {/* CUERPO PRINCIPAL DEL FOOTER */}
      <div className="container mx-auto max-w-6xl py-12 px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUMNA 1: MARCA Y SLOGAN */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img
              src={settings.logo_url || '/logo-elohim.png'}
              alt={settings.trade_name}
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <div className="font-black text-white text-base uppercase font-serif tracking-wider">
                {settings.trade_name}
              </div>
              <div className="text-[10px] text-[#D0A96B] font-mono uppercase">
                Alta Perfumería
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
            {settings.slogan || 'Especialistas en fragancias de autor, perfumes de nicho y decants de alta gama fraccionados con precisión.'}
          </p>

          {settings.cuit_tax_id && (
            <div className="text-[10px] font-mono text-zinc-500">
              CUIT: {settings.cuit_tax_id}
            </div>
          )}
        </div>

        {/* COLUMNA 2: NAVEGACIÓN RÁPIDA */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-widest font-serif text-[#D0A96B]">
            Explorar Tienda
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/tienda" className="hover:text-white transition-colors">
                • Catálogo Completo de Fragancias
              </Link>
            </li>
            <li>
              <Link href="/tienda?type=decant_liquid" className="hover:text-white transition-colors">
                • Decants Fraccionados (5ml / 10ml)
              </Link>
            </li>
            <li>
              <Link href="/tienda?type=bottle" className="hover:text-white transition-colors">
                • Botellas Selladas de Colección
              </Link>
            </li>
            <li>
              <Link href="/catalogo" className="hover:text-white transition-colors">
                • Vidriera Digital Rápida
              </Link>
            </li>
          </ul>
        </div>

        {/* COLUMNA 3: ATENCIÓN & UBICACIÓN */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-widest font-serif text-[#D0A96B]">
            Showroom & Atención
          </h4>
          <div className="space-y-2 text-xs">
            {settings.address && (
              <div className="flex items-start gap-2 text-zinc-300">
                <MapPin className="h-4 w-4 text-[#D0A96B] shrink-0 mt-0.5" />
                <span>{settings.address} {settings.city ? `(${settings.city})` : ''}</span>
              </div>
            )}
            {settings.phone && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>WhatsApp: {settings.phone}</span>
              </div>
            )}
            {settings.email && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                <span>{settings.email}</span>
              </div>
            )}
            {settings.instagram_handle && (
              <div className="flex items-center gap-2 text-zinc-300">
                <AtSign className="h-4 w-4 text-pink-400 shrink-0" />
                <span>Instagram: {settings.instagram_handle}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* COPYRIGHT & ERP BADGE */}
      <div className="border-t border-[#1B362A] bg-[#08130E] py-4 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-zinc-500 font-mono">
          <div>
            © {new Date().getFullYear()} {settings.company_name || settings.trade_name}. Todos los derechos reservados.
          </div>
          <div>
            VibeScent ERP • E-Commerce Boutique
          </div>
        </div>
      </div>

    </footer>
  );
}
