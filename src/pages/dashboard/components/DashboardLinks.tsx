import React, { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, ExternalLink,
  Link2, Globe, FileText, BarChart2, Settings, BookOpen, Wrench, HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

interface DashLink {
  id: number;
  titulo: string;
  url: string;
  descripcion: string | null;
  icono: string | null;
  categoria: string | null;
  orden: number;
  creador_nombre: string | null;
}

interface FormState {
  titulo: string;
  url: string;
  descripcion: string;
  icono: string;
  categoria: string;
  orden: number;
}

const ICONOS = [
  { key: 'Link2',     label: 'Enlace',      Icon: Link2 },
  { key: 'Globe',     label: 'Web',         Icon: Globe },
  { key: 'FileText',  label: 'Documento',   Icon: FileText },
  { key: 'BarChart2', label: 'Reporte',     Icon: BarChart2 },
  { key: 'Settings',  label: 'Sistema',     Icon: Settings },
  { key: 'BookOpen',  label: 'Manual',      Icon: BookOpen },
  { key: 'Wrench',    label: 'Herramienta', Icon: Wrench },
  { key: 'HelpCircle',label: 'Ayuda',       Icon: HelpCircle },
];

const ICONO_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICONOS.map(({ key, Icon }) => [key, Icon])
);

function getIcon(name: string | null): React.ElementType {
  return (name && ICONO_MAP[name]) ? ICONO_MAP[name] : Link2;
}

const INITIAL_FORM: FormState = {
  titulo: '', url: '', descripcion: '', icono: 'Link2', categoria: '', orden: 0,
};

export default function DashboardLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'avanzado';

  const [links, setLinks] = useState<DashLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DashLink | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { cargarLinks(); }, []);

  async function cargarLinks() {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/gestor/dashboard-home/links');
      if (res.success) setLinks(res.data as DashLink[]);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingLink(null);
    setForm({ ...INITIAL_FORM, orden: links.length });
    setModalOpen(true);
  }

  function openEdit(link: DashLink) {
    setEditingLink(link);
    setForm({
      titulo: link.titulo,
      url: link.url,
      descripcion: link.descripcion ?? '',
      icono: link.icono ?? 'Link2',
      categoria: link.categoria ?? '',
      orden: link.orden,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.url.trim()) return;
    setFormLoading(true);
    try {
      const body = {
        titulo: form.titulo.trim(),
        url: form.url.trim(),
        descripcion: form.descripcion.trim() || null,
        icono: form.icono,
        categoria: form.categoria.trim() || null,
        orden: form.orden,
      };

      const res = editingLink
        ? await fetchWithAuth(`/api/gestor/dashboard-home/links/${editingLink.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await fetchWithAuth('/api/gestor/dashboard-home/links', {
            method: 'POST',
            body: JSON.stringify(body),
          });

      if (res.success) {
        await cargarLinks();
        setModalOpen(false);
        toast({ title: editingLink ? 'Link actualizado' : 'Link creado' });
      } else {
        toast({ title: 'Error', description: res.message as string, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el link', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(link: DashLink) {
    if (!confirm(`¿Eliminar "${link.titulo}"?`)) return;
    try {
      const res = await fetchWithAuth(`/api/gestor/dashboard-home/links/${link.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setLinks(prev => prev.filter(l => l.id !== link.id));
        toast({ title: 'Link eliminado' });
      }
    } catch {
      // silencioso
    }
  }

  // Agrupar por categoría
  const porCategoria: Record<string, DashLink[]> = {};
  for (const link of links) {
    const cat = link.categoria || 'General';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(link);
  }
  const categorias = Object.keys(porCategoria);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border/60 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          Links útiles
        </h2>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openCreate}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </Button>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ maxHeight: '360px' }}>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
        ) : links.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Link2 className="w-7 h-7 mx-auto mb-2 opacity-25" />
            {canEdit ? 'Agregá links útiles para tu equipo' : 'No hay links disponibles'}
          </div>
        ) : (
          categorias.map(cat => (
            <div key={cat}>
              {categorias.length > 1 && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                  {cat}
                </p>
              )}
              <div className="space-y-1">
                {porCategoria[cat].map(link => {
                  const Icon = getIcon(link.icono);
                  return (
                    <div
                      key={link.id}
                      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-blue-600 transition-colors flex items-center gap-1"
                        >
                          <span className="truncate">{link.titulo}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" />
                        </a>
                        {link.descripcion && (
                          <p className="text-xs text-muted-foreground truncate">{link.descripcion}</p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => openEdit(link)}
                            className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(link)}
                            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal crear/editar link */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-foreground">
                {editingLink ? 'Editar link' : 'Nuevo link'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Título *</label>
                <Input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Nombre del link"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">URL *</label>
                <Input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  required
                  type="url"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción breve (opcional)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Categoría</label>
                  <Input
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ej: Recursos"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Orden</label>
                  <Input
                    type="number"
                    value={form.orden}
                    onChange={e => setForm(f => ({ ...f, orden: Number(e.target.value) }))}
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Ícono</label>
                <div className="flex flex-wrap gap-2">
                  {ICONOS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icono: key }))}
                      title={label}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                        form.icono === key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading || !form.titulo.trim() || !form.url.trim()}
                >
                  {formLoading ? 'Guardando...' : editingLink ? 'Guardar cambios' : 'Crear link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
