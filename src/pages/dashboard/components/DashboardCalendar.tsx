import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Clock, Users, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

interface Tarea {
  id: number;
  user_id: number;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  color: string;
  tipo: 'personal' | 'compartida';
  usuarios_compartidos: number[] | null;
  creador_nombre: string;
}

interface UsuarioBasico {
  id: number;
  nombre: string;
  activo: number;
}

interface FormState {
  titulo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  color: string;
  tipo: 'personal' | 'compartida';
  usuarios_compartidos: number[];
}

const COLORES = [
  { key: 'blue',   bg: 'bg-blue-500',   ring: 'ring-blue-500',   label: 'Azul' },
  { key: 'green',  bg: 'bg-green-500',  ring: 'ring-green-500',  label: 'Verde' },
  { key: 'red',    bg: 'bg-red-500',    ring: 'ring-red-500',    label: 'Rojo' },
  { key: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-500', label: 'Naranja' },
  { key: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-500', label: 'Violeta' },
  { key: 'pink',   bg: 'bg-pink-500',   ring: 'ring-pink-500',   label: 'Rosa' },
  { key: 'yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-400', label: 'Amarillo' },
];

const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500',
  orange: 'bg-orange-500', purple: 'bg-purple-500', pink: 'bg-pink-500', yellow: 'bg-yellow-400',
};

const COLOR_BORDER_L: Record<string, string> = {
  blue: 'border-l-blue-500', green: 'border-l-green-500', red: 'border-l-red-500',
  orange: 'border-l-orange-500', purple: 'border-l-purple-500', pink: 'border-l-pink-500', yellow: 'border-l-yellow-400',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type TareaStatus = 'now' | 'soon' | 'today' | 'past' | null;
const DEFAULT_TAREA_DURATION_MIN = 60;
type TareaStatusInfo = { status: TareaStatus; soonInMin: number | null };

function getTareaStatus(t: Tarea, today: string): TareaStatusInfo {
  if (t.fecha.slice(0, 10) !== today) return { status: null, soonInMin: null };
  if (!t.hora_inicio) return { status: 'today', soonInMin: null };
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [h, m] = t.hora_inicio.split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin = t.hora_fin
    ? (() => {
        const [hf, mf] = t.hora_fin!.split(':').map(Number);
        return hf * 60 + mf;
      })()
    : startMin + DEFAULT_TAREA_DURATION_MIN;

  // Si cruza medianoche (ej: 23:00 -> 00:30), desplazamos el fin al "día siguiente".
  const normalizedEndMin = t.hora_fin && endMin < startMin ? endMin + 24 * 60 : endMin;
  const normalizedNowMin = nowMin < startMin && normalizedEndMin > 24 * 60 ? nowMin + 24 * 60 : nowMin;

  if (normalizedNowMin > normalizedEndMin) return { status: 'past', soonInMin: null };
  if (normalizedNowMin >= startMin) return { status: 'now', soonInMin: null };

  const soonInMin = startMin - normalizedNowMin;
  if (soonInMin <= 60) return { status: 'soon', soonInMin: Math.max(1, soonInMin) };
  return { status: 'today', soonInMin: null };
}

function TareaStatusBadge({ status, soonInMin }: { status: TareaStatus; soonInMin?: number | null }) {
  if (!status || status === 'past') return null;
  if (status === 'now') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        En curso
      </span>
    );
  }
  if (status === 'soon' && soonInMin !== null && soonInMin !== undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
        <Clock className="w-2.5 h-2.5" />
        En {soonInMin} min
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
      Hoy
    </span>
  );
}

const INITIAL_FORM: FormState = {
  titulo: '', descripcion: '', fecha: '', hora_inicio: '', hora_fin: '',
  color: 'blue', tipo: 'personal', usuarios_compartidos: [],
};

export default function DashboardCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [today, setToday] = useState(() => todayStr());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const previousTodayRef = useRef(today);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [usuariosLoaded, setUsuariosLoaded] = useState(false);

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    const scheduleNextDayUpdate = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const msUntilNextMidnight = nextMidnight.getTime() - now.getTime();
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setToday(todayStr());
        scheduleNextDayUpdate();
      }, msUntilNextMidnight + 1000);
    };

    scheduleNextDayUpdate();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setSelectedDay(prev => (prev === previousTodayRef.current ? today : prev));
    previousTodayRef.current = today;
  }, [today]);

  const mesStr = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentMonth]);

  const cargarTareas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/distrigestion/dashboard-home/tareas?mes=${mesStr}`);
      if (res.success) {
        setTareas((res.data as any[]).map((t: any) => ({
          ...t,
          fecha: t.fecha ? String(t.fecha).slice(0, 10) : t.fecha,
          usuarios_compartidos: t.usuarios_compartidos
            ? (typeof t.usuarios_compartidos === 'string'
                ? JSON.parse(t.usuarios_compartidos)
                : t.usuarios_compartidos)
            : null,
        })));
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [mesStr]);

  useEffect(() => { cargarTareas(); }, [cargarTareas]);

  // Grid del calendario: lunes a domingo
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 0=Dom→6, 1=Lun→0, 2=Mar→1, ...
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const tareasPorDia = useMemo(() => {
    const map: Record<string, Tarea[]> = {};
    for (const t of tareas) {
      const d = t.fecha.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [tareas]);

  const selectedDayTareas = useMemo(
    () => (selectedDay ? tareasPorDia[selectedDay] || [] : []),
    [selectedDay, tareasPorDia]
  );

  function openCreate(fecha?: string) {
    setEditingTarea(null);
    setForm({ ...INITIAL_FORM, fecha: fecha ?? selectedDay ?? today });
    setModalOpen(true);
  }

  function openEdit(t: Tarea) {
    setEditingTarea(t);
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion ?? '',
      fecha: t.fecha.slice(0, 10),
      hora_inicio: t.hora_inicio ?? '',
      hora_fin: t.hora_fin ?? '',
      color: t.color,
      tipo: t.tipo,
      usuarios_compartidos: t.usuarios_compartidos ?? [],
    });
    setModalOpen(true);
  }

  async function loadUsuarios() {
    if (usuariosLoaded) return;
    try {
      const res = await fetchWithAuth('/api/distrigestion/users');
      if (res.success) {
        setUsuarios(((res.data as any[]) || []).filter((u: any) => u.activo));
        setUsuariosLoaded(true);
      }
    } catch {
      // silencioso
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.fecha) return;
    setFormLoading(true);
    try {
      const body = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
        color: form.color,
        tipo: form.tipo,
        usuarios_compartidos:
          form.tipo === 'compartida' && form.usuarios_compartidos.length
            ? form.usuarios_compartidos
            : null,
      };

      const res = editingTarea
        ? await fetchWithAuth(`/api/distrigestion/dashboard-home/tareas/${editingTarea.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await fetchWithAuth('/api/distrigestion/dashboard-home/tareas', {
            method: 'POST',
            body: JSON.stringify(body),
          });

      if (res.success) {
        setModalOpen(false);
        await cargarTareas();
        toast({ title: editingTarea ? 'Tarea actualizada' : 'Tarea creada' });
      } else {
        toast({ title: 'Error', description: res.message as string, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la tarea', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(t: Tarea) {
    if (!confirm(`¿Eliminar "${t.titulo}"?`)) return;
    try {
      const res = await fetchWithAuth(`/api/distrigestion/dashboard-home/tareas/${t.id}`, { method: 'DELETE' });
      if (res.success) {
        setTareas(prev => prev.filter(x => x.id !== t.id));
        toast({ title: 'Tarea eliminada' });
      } else {
        toast({ title: 'Error', description: res.message as string, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  }

  const mesLabel = currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const selectedDayLabel = selectedDay
    ? new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border/60">
      {/* Header del mes */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <button
          onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h2 className="font-semibold text-sm text-foreground capitalize">{mesLabel}</h2>
        <button
          onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Cabecera días */}
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground font-medium py-2 border-b border-border/40">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 p-1.5 gap-0.5">
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="h-8" />;
          const dayTareas = tareasPorDia[day] || [];
          const isToday = day === today;
          const isSelected = day === selectedDay;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={`h-8 rounded-md p-0.5 flex flex-col items-center transition-colors hover:bg-blue-50 ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
            >
              <span
                className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : 'text-foreground'
                }`}
              >
                {new Date(day + 'T00:00:00').getDate()}
              </span>
              {dayTareas.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {dayTareas.slice(0, 3).map(t => (
                    <span key={t.id} className={`w-1 h-1 rounded-full ${COLOR_BG[t.color] ?? 'bg-gray-400'}`} />
                  ))}
                  {dayTareas.length > 3 && (
                    <span className="text-[8px] text-muted-foreground leading-none">+{dayTareas.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel tareas de HOY — siempre visible */}
      {(() => {
        const todayTareas = tareasPorDia[today] || [];
        const showSelectedOther = selectedDay && selectedDay !== today;
        return (
          <>
            <div className="border-t border-border/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                  <h3 className="text-xs font-semibold text-foreground">Tareas de hoy</h3>
                  {todayTareas.length > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                      {todayTareas.length}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => openCreate(today)} className="h-6 text-[11px] gap-1 shrink-0 px-2">
                  <Plus className="w-3 h-3" />
                  Nueva
                </Button>
              </div>

              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
              ) : todayTareas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sin tareas para hoy</p>
              ) : (
                <div className="space-y-1">
                  {todayTareas.map(t => {
                    const statusInfo = getTareaStatus(t, today);
                    const { status, soonInMin } = statusInfo;
                    return (
                      <div
                        key={t.id}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border-l-[3px] ${
                          status === 'now'
                            ? 'bg-green-50/60 border-l-green-500'
                            : status === 'soon'
                            ? 'bg-orange-50/60 border-l-orange-400'
                            : `bg-muted/40 ${COLOR_BORDER_L[t.color] ?? 'border-l-gray-300'}`
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-medium text-foreground leading-tight">{t.titulo}</p>
                            <TareaStatusBadge status={status} soonInMin={soonInMin} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {t.hora_inicio && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {t.hora_inicio}{t.hora_fin ? ` - ${t.hora_fin}` : ''}
                              </span>
                            )}
                            {t.tipo === 'compartida' && (
                              <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" />
                                Compartida
                                {t.user_id !== user?.id && (
                                  <span className="text-muted-foreground ml-1">por {t.creador_nombre}</span>
                                )}
                              </span>
                            )}
                          </div>
                          {t.descripcion && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.descripcion}</p>
                          )}
                        </div>
                        {t.user_id === user?.id && (
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={() => openEdit(t)} className="p-1 text-muted-foreground hover:text-blue-600 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(t)} className="p-1 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel del día seleccionado (solo si es distinto de hoy) */}
            {showSelectedOther && (
              <div className="border-t border-border/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-foreground capitalize truncate">{selectedDayLabel}</h3>
                  <Button size="sm" variant="outline" onClick={() => openCreate(selectedDay!)} className="h-6 text-[11px] gap-1 shrink-0 px-2">
                    <Plus className="w-3 h-3" />
                    Nueva
                  </Button>
                </div>
                {selectedDayTareas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin tareas para este día</p>
                ) : (
                  <div className="space-y-1">
                    {selectedDayTareas.map(t => (
                      <div
                        key={t.id}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border-l-[3px] bg-muted/40 ${COLOR_BORDER_L[t.color] ?? 'border-l-gray-300'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground leading-tight">{t.titulo}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {t.hora_inicio && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {t.hora_inicio}{t.hora_fin ? ` - ${t.hora_fin}` : ''}
                              </span>
                            )}
                            {t.tipo === 'compartida' && (
                              <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" />
                                Compartida
                                {t.user_id !== user?.id && (
                                  <span className="text-muted-foreground ml-1">por {t.creador_nombre}</span>
                                )}
                              </span>
                            )}
                          </div>
                          {t.descripcion && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.descripcion}</p>
                          )}
                        </div>
                        {t.user_id === user?.id && (
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={() => openEdit(t)} className="p-1 text-muted-foreground hover:text-blue-600 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(t)} className="p-1 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Modal crear/editar tarea */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-foreground">
                {editingTarea ? 'Editar tarea' : 'Nueva tarea'}
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
                  placeholder="Nombre de la tarea"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-xs font-medium text-foreground mb-1 block">Fecha *</label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Desde</label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Hasta</label>
                  <Input
                    type="time"
                    value={form.hora_fin}
                    onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles opcionales..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Color</label>
                <div className="flex gap-2">
                  {COLORES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c.key }))}
                      title={c.label}
                      className={`w-6 h-6 rounded-full transition-transform ${c.bg} ${
                        form.color === c.key ? `ring-2 ring-offset-1 ${c.ring} scale-110` : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Tipo</label>
                <div className="flex gap-2">
                  {(['personal', 'compartida'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, tipo, usuarios_compartidos: [] }));
                        if (tipo === 'compartida') loadUsuarios();
                      }}
                      className={`px-3 py-1 rounded-full text-xs border capitalize transition-colors ${
                        form.tipo === tipo
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo === 'compartida' && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Compartir con</label>
                  <div className="border border-border rounded-md max-h-32 overflow-y-auto divide-y divide-border/50">
                    {usuarios.filter(u => u.id !== user?.id).map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.usuarios_compartidos.includes(u.id)}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              usuarios_compartidos: e.target.checked
                                ? [...f.usuarios_compartidos, u.id]
                                : f.usuarios_compartidos.filter(id => id !== u.id),
                            }))
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-foreground">{u.nombre}</span>
                      </label>
                    ))}
                    {usuarios.filter(u => u.id !== user?.id).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Sin otros usuarios</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={formLoading || !form.titulo.trim()}>
                  {formLoading ? 'Guardando...' : editingTarea ? 'Guardar cambios' : 'Crear tarea'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
