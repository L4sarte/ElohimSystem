'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/hooks/use-user-store';
import { useOmnibarStore } from '@/hooks/use-omnibar-store';
import { getNavigationCategoriesForRole, isRouteActive } from '@/config/navigation';
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'elohim_erp_sidebar_collapsed';

export function Sidebar() {
  const pathname = usePathname();
  const role = useUserStore((state) => state.role);
  const openOmnibar = useOmnibarStore((state) => state.openOmnibar);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (saved === 'true') {
        setCollapsed(true);
      }
    } catch {
      // Ignorar restricciones de localStorage en modo privado
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignorar errores de almacenamiento
      }
      return next;
    });
  };

  const navCategories = getNavigationCategoriesForRole(role);

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <div
        className={`flex flex-col h-full bg-erp-surface border-r border-erp-border text-zinc-100 transition-all duration-200 ${
          isCompact ? 'w-20' : 'w-64'
        }`}
      >
        {/* CABECERA CON LOGO Y CONTROL DE COLAPSO */}
        <div className="p-3.5 border-b border-erp-border flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={() => isMobileDrawer && setMobileOpen(false)}
            className={`flex items-center gap-2.5 cursor-pointer min-w-0 ${
              isCompact ? 'justify-center w-full' : ''
            }`}
            title="Ir al Dashboard Principal"
          >
            <img
              src="/logo-elohim.png"
              alt="Elohim Import ERP"
              className="h-8 w-auto object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {!isCompact && (
              <span className="text-xs font-extrabold tracking-wider text-erp-gold uppercase truncate font-serif">
                Elohim ERP
              </span>
            )}
          </Link>

          {isMobileDrawer ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-erp-bg/60 transition-colors cursor-pointer"
              aria-label="Cerrar menú lateral"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={toggleCollapsed}
              title={isCompact ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              className="text-zinc-400 hover:text-erp-gold p-1.5 rounded-lg hover:bg-erp-bg/60 transition-colors cursor-pointer shrink-0"
              aria-label={isCompact ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            >
              {isCompact ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* DISPARADOR DE LA BARRA DE COMANDOS GLOBAL (OMNIBAR Ctrl+K) */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              openOmnibar();
            }}
            title="Búsqueda Global y Comandos Rápidos (Ctrl+K)"
            className={`w-full flex items-center rounded-xl bg-erp-bg/70 hover:bg-erp-bg border border-erp-border hover:border-erp-gold/40 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer group ${
              isCompact ? 'justify-center p-2.5' : 'justify-between px-3 py-2 text-xs'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search className="h-3.5 w-3.5 text-erp-gold shrink-0 group-hover:scale-110 transition-transform" />
              {!isCompact && (
                <span className="truncate font-medium">Buscar o saltar a...</span>
              )}
            </span>
            {!isCompact && (
              <kbd className="px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-[10px] font-mono text-erp-gold shrink-0">
                Ctrl+K
              </kbd>
            )}
          </button>
        </div>

        {/* CATEGORÍAS DE NAVEGACIÓN */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {navCategories.map((category) => (
            <div key={category.id} className="space-y-1">
              {!isCompact ? (
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 px-3 py-1 font-serif">
                  {category.title}
                </div>
              ) : (
                <div className="h-px bg-erp-border/60 my-2 mx-2" />
              )}

              {category.items.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(pathname, item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={isCompact ? `${item.name} — ${item.description}` : item.description}
                    className={`flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                      isCompact
                        ? 'justify-center p-2.5'
                        : 'justify-between px-3 py-2.5'
                    } ${
                      active
                        ? 'bg-secondary text-erp-gold border border-erp-gold/40 shadow-sm shadow-erp-gold/10'
                        : 'text-zinc-300 hover:bg-secondary/60 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                          active ? 'text-erp-gold' : item.color
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.name}</span>}
                    </div>

                    {!isCompact && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.shortcutHint && !active && (
                          <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-erp-bg/60 border border-erp-border/70 text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300">
                            {item.shortcutHint}
                          </kbd>
                        )}
                        {active && <ChevronRight className="h-3.5 w-3.5 text-erp-gold" />}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* PIE DEL SIDEBAR */}
        <div
          className={`p-3 border-t border-erp-border bg-erp-bg/60 text-[11px] text-zinc-400 flex items-center ${
            isCompact ? 'flex-col gap-2 justify-center' : 'justify-between'
          }`}
        >
          {!isCompact && (
            <div className="min-w-0">
              <div className="font-bold text-white font-serif truncate">Elohim Import ERP</div>
              <div className="text-zinc-500 font-mono text-[10px]">
                Rol: <span className="text-erp-gold uppercase">{role === 'admin' ? 'Admin' : 'Vendedor'}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openOmnibar()}
              title="Abrir paleta de comandos (Ctrl+K / ⌘K)"
              className="px-1.5 py-1 rounded-lg bg-erp-surface border border-erp-border text-erp-gold hover:border-erp-gold/50 font-mono text-[11px] cursor-pointer transition-colors"
            >
              ⌘K
            </button>
            <button
              type="button"
              onClick={() => logoutAction()}
              title="Cerrar Sesión Segura"
              className="p-1.5 rounded-lg bg-erp-surface border border-erp-border text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex shrink-0">{renderSidebarBody(false)}</aside>

      {/* HAMBURGUESA MOBILE */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl bg-erp-surface border border-erp-border text-erp-gold shadow-lg cursor-pointer"
          title="Abrir menú de navegación"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* DRAWER MOBILE OVERLAY */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
