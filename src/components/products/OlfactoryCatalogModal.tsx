'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { 
  getOlfactoryFamilies, getOlfactoryNotes, 
  createOlfactoryFamily, createOlfactoryNote 
} from '@/app/actions/olfactory';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, X, Plus, Search, Layers, Droplet, Check, Trash2, Tag 
} from 'lucide-react';
import { toast } from 'sonner';

interface OlfactoryCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshForm?: () => void;
}

export function OlfactoryCatalogModal({ isOpen, onClose, onRefreshForm }: OlfactoryCatalogModalProps) {
  const { role } = useUserStore();
  const [activeTab, setActiveTab] = useState<'families' | 'notes'>('families');

  const [families, setFamilies] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    const [resFam, resNotes] = await Promise.all([
      getOlfactoryFamilies(),
      getOlfactoryNotes()
    ]);
    if (resFam.success && resFam.data) setFamilies(resFam.data);
    if (resNotes.success && resNotes.data) setNotes(resNotes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setSubmitting(true);
    if (activeTab === 'families') {
      const res = await createOlfactoryFamily(role, newItemName.trim());
      if (res.success) {
        toast.success(`Familia "${newItemName}" agregada.`);
        setFamilies(prev => Array.from(new Set([...prev, newItemName.trim()])));
        setNewItemName('');
        onRefreshForm?.();
      } else {
        toast.error(res.error || 'No se pudo guardar la familia.');
      }
    } else {
      const res = await createOlfactoryNote(role, newItemName.trim());
      if (res.success) {
        toast.success(`Nota "${newItemName}" agregada.`);
        setNotes(prev => Array.from(new Set([...prev, newItemName.trim()])));
        setNewItemName('');
        onRefreshForm?.();
      } else {
        toast.error(res.error || 'No se pudo guardar la nota.');
      }
    }
    setSubmitting(false);
  };

  const filteredFamilies = families.filter(f => f.toLowerCase().includes(search.toLowerCase()));
  const filteredNotes = notes.filter(n => n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-lg bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* HEADER */}
        <CardHeader className="border-b border-[#1B362A] pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D0A96B]" />
              Gestor de Catálogo Olfativo
            </CardTitle>
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Administra las Familias y Notas Olfativas oficiales para el etiquetado de perfumes y decants.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* SELECTOR DE PESTAÑAS */}
          <div className="flex rounded-xl bg-[#08130E] border border-[#1B362A] p-1 gap-1">
            <button
              onClick={() => setActiveTab('families')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'families' 
                  ? 'bg-[#13261E] text-[#D0A96B] border border-[#D0A96B]/30 shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Familias ({families.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'notes' 
                  ? 'bg-[#13261E] text-[#D0A96B] border border-[#D0A96B]/30 shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Droplet className="h-3.5 w-3.5" />
              Notas Olfativas ({notes.length})
            </button>
          </div>

          {/* BUSCADOR & FORMULARIO DE ALTA */}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={activeTab === 'families' ? 'Ej: Amaderada Gourmand...' : 'Ej: Bergamota de Italia...'}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="bg-[#08130E] border-[#1B362A] text-white text-xs h-9 font-medium"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || !newItemName.trim()}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs h-9 px-3 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
          </form>

          {/* FILTRO BUSCADOR */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              type="text"
              placeholder={`Filtrar ${activeTab === 'families' ? 'familias' : 'notas'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-[#08130E]/60 border-[#1B362A] text-zinc-300 text-xs h-8"
            />
          </div>

          {/* LISTA DE ÍTEMS EN BADGES / CHIPS */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 block">
              Catálogo Actual
            </span>

            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400">Cargando catálogo...</div>
            ) : (activeTab === 'families' ? filteredFamilies : filteredNotes).length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 bg-[#08130E]/40 border border-dashed border-[#1B362A] rounded-xl">
                No se encontraron registros.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                {(activeTab === 'families' ? filteredFamilies : filteredNotes).map((item, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#08130E] border border-[#1B362A] text-xs font-semibold text-zinc-200 hover:border-[#D0A96B]/50 transition-colors"
                  >
                    <Tag className="h-3 w-3 text-[#D0A96B]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </CardContent>

        {/* FOOTER */}
        <div className="p-4 border-t border-[#1B362A] bg-[#08130E]/60 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-[#13261E] border border-[#1B362A] hover:bg-zinc-800 text-zinc-300 text-xs font-bold px-4 cursor-pointer"
          >
            Listo / Cerrar
          </Button>
        </div>

      </div>
    </div>
  );
}
