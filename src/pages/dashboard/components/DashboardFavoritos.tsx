import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Plus, X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Favorito {
  id: number;
  pagina_clave: string;
  pagina_nombre: string;
  pagina_ruta: string;
  pagina_icono: string | null;
  orden: number;
}

interface MenuItem {
  clave: string;
  nombre: string;
  ruta: string;
  icon: string | null;
}

function DynamicIcon({ name, className }: { name: string | null; className?: string }) {
  if (!name) return <Star className={className} />;
  const Icon = (LucideIcons as Record<string, any>)[name];
  if (!Icon) return <Star className={className} />;
  return <Icon className={className} />;
}

export default function DashboardFavoritos() {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    cargarFavoritos();
  }, []);

  async function cargarFavoritos() {
    try {
      const res = await fetchWithAuth('/api/distrigestion/dashboard-home/favoritos');
      if (res.success) setFavoritos(res.data as Favorito[]);
    } catch {
      // silencioso
    }
  }

  async function abrirModal() {
    setModalOpen(true);
    if (menuItems.length) return;
    setLoadingMenu(true);
    try {
      const res = await fetchWithAuth('/api/distrigestion/menu');
      if (res.success) {
        const items: MenuItem[] = (res.data as any[]).flatMap((cat: any) =>
          cat.items.map((item: any) => ({
            clave: item.clave,
            nombre: item.nombre,
            ruta: item.ruta,
            icon: item.icon || null,
          }))
        );
        setMenuItems(items);
      }
    } catch {
      // silencioso
    } finally {
      setLoadingMenu(false);
    }
  }

  async function toggleFavorito(item: MenuItem) {
    const esFavorito = favoritos.some(f => f.pagina_clave === item.clave);
    if (esFavorito) {
      await quitarFavorito(item.clave);
    } else {
      try {
        const res = await fetchWithAuth('/api/distrigestion/dashboard-home/favoritos', {
          method: 'POST',
          body: JSON.stringify({
            pagina_clave: item.clave,
            pagina_nombre: item.nombre,
            pagina_ruta: item.ruta,
            pagina_icono: item.icon,
          }),
        });
        if (res.success) setFavoritos(res.data as Favorito[]);
      } catch {
        // silencioso
      }
    }
  }

  async function quitarFavorito(clave: string) {
    try {
      const res = await fetchWithAuth(`/api/distrigestion/dashboard-home/favoritos/${clave}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setFavoritos(f => f.filter(x => x.pagina_clave !== clave));
      }
    } catch {
      // silencioso
    }
  }

  const favoritosSet = new Set(favoritos.map(f => f.pagina_clave));
  const filteredItems = menuItems.filter(item =>
    item.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
          Accesos rápidos
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={abrirModal}
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          Gestionar
        </Button>
      </div>

      {favoritos.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-5 text-muted-foreground text-sm">
          <Star className="w-4 h-4 opacity-40" />
          <span>Agregá páginas favoritas para acceder más rápido</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {favoritos.map(f => (
            <Link
              key={f.pagina_clave}
              to={f.pagina_ruta}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm text-foreground"
            >
              <DynamicIcon
                name={f.pagina_icono}
                className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-600 transition-colors"
              />
              <span>{f.pagina_nombre}</span>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  quitarFavorito(f.pagina_clave);
                }}
                className="ml-0.5 text-muted-foreground/40 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Link>
          ))}
        </div>
      )}

      {/* Modal gestionar favoritos */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-foreground">Gestionar favoritos</h3>
              <button
                onClick={() => { setModalOpen(false); setBusqueda(''); }}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar página..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              {loadingMenu ? (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando páginas...</p>
              ) : (
                <div className="space-y-0.5 max-h-72 overflow-y-auto">
                  {filteredItems.map(item => {
                    const esFav = favoritosSet.has(item.clave);
                    return (
                      <button
                        key={item.clave}
                        onClick={() => toggleFavorito(item)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          esFav
                            ? 'bg-yellow-50 text-yellow-800'
                            : 'hover:bg-muted/60 text-foreground'
                        }`}
                      >
                        <DynamicIcon name={item.icon} className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm flex-1">{item.nombre}</span>
                        {esFav && <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
