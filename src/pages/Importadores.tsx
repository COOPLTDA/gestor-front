import React, { useEffect, useState } from "react";
import {
  Save, X, Plus, Trash2, Settings2, CheckCircle2, AlertCircle,
  Pencil, Check, GripVertical, Tag, Filter,
} from "lucide-react";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { useDraggable } from "@/hooks/useDraggable";
import { useModalEscClose } from "@/hooks/useModalEscClose";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TipoCobro {
  codigo_cobranza: string;
  nombre_cobranza: string;
}

interface ColumnaGlobal {
  id: number;
  nombre: string;
  orden: number;
}

type OperadorFiltro =
  | "CONTIENE"
  | "IGUAL QUE"
  | "ENTRE"
  | "EN LOS VALORES"
  | "MAYOR QUE"
  | "MENOR QUE"
  | "MAYOR O IGUAL QUE"
  | "MENOR O IGUAL QUE";

type ConectorFiltro = "Y" | "O";

interface CondicionFiltro {
  id: string;
  columna: string;
  operador: OperadorFiltro;
  valor: string;
  valor2: string;
  valores: string[];
  conector: ConectorFiltro;
}

const OPERADORES: OperadorFiltro[] = [
  "CONTIENE",
  "IGUAL QUE",
  "ENTRE",
  "EN LOS VALORES",
  "MAYOR QUE",
  "MENOR QUE",
  "MAYOR O IGUAL QUE",
  "MENOR O IGUAL QUE",
];

// columnas_extra almacenado como objeto: { nombreGlobal: headerExcel }
interface Importador {
  id: number | null;
  codigo_cobranza: string;
  nombre_cobranza?: string;
  fila_inicial: number;
  columna_inicial: number;
  col_operacion: string;
  col_documento: string;
  col_importe: string;
  columnas_extra: Record<string, string>; // nombreGlobal → headerExcel
  filtros_importacion: CondicionFiltro[];
}

const emptyImportador: Importador = {
  id: null,
  codigo_cobranza: "",
  fila_inicial: 1,
  columna_inicial: 1,
  col_operacion: "",
  col_documento: "",
  col_importe: "",
  columnas_extra: {},
  filtros_importacion: [],
};

function parseMapeo(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p)) return p;
  } catch { /* noop */ }
  return {};
}

function parseFiltros(raw: string | null | undefined): CondicionFiltro[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
  } catch { /* noop */ }
  return [];
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Importadores() {
  const [tiposCobro, setTiposCobro]       = useState<TipoCobro[]>([]);
  const [formatos, setFormatos]           = useState<any[]>([]);
  const [listaFinal, setListaFinal]       = useState<any[]>([]);
  const [columnasGlobales, setColumnasGlobales] = useState<ColumnaGlobal[]>([]);

  // Modal importador
  const [modalOpen, setModalOpen]         = useState(false);
  const [form, setForm]                   = useState<Importador>(emptyImportador);
  const [guardando, setGuardando]         = useState(false);
  const [errorModal, setErrorModal]       = useState<string | null>(null);

  // Estado para inputs de "EN LOS VALORES" (por condición id)
  const [valEnInput, setValEnInput]       = useState<Record<string, string>>({});

  // Gestión columnas globales (inline en la página)
  const [nuevaColumna, setNuevaColumna]   = useState("");
  const [editandoId, setEditandoId]       = useState<number | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [errorColumnas, setErrorColumnas] = useState<string | null>(null);

  const { style, handleProps } = useDraggable(modalOpen);
  useModalEscClose(modalOpen, () => setModalOpen(false));

  // ── Carga inicial ────────────────────────────────────────────────────────

  async function cargarTiposCobro() {
    const res = await fetchWithAuth("/api/distrigestion/tiposCobroConcilia");
    if (res.success) setTiposCobro(res.data);
  }
  async function cargarFormatos() {
    const res = await fetchWithAuth("/api/distrigestion/importadores?soloActivos=0");
    if (res.success) setFormatos(res.data);
  }
  async function cargarColumnasGlobales() {
    const res = await fetchWithAuth("/api/distrigestion/columnas-extra");
    if (res.success) setColumnasGlobales(res.data);
  }

  useEffect(() => {
    cargarTiposCobro();
    cargarFormatos();
    cargarColumnasGlobales();
  }, []);

  useEffect(() => {
    const merged = tiposCobro.map((t) => {
      const found = formatos.find((f) => f.codigo_cobranza === t.codigo_cobranza);
      return found
        ? { ...found, nombre_cobranza: t.nombre_cobranza }
        : { ...emptyImportador, codigo_cobranza: t.codigo_cobranza, nombre_cobranza: t.nombre_cobranza };
    });
    setListaFinal(merged);
  }, [tiposCobro, formatos]);

  // ── Columnas globales: CRUD inline ───────────────────────────────────────

  async function agregarColumnaGlobal() {
    setErrorColumnas(null);
    const nombre = nuevaColumna.trim();
    if (!nombre) return;
    const res = await fetchWithAuth("/api/distrigestion/columnas-extra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, orden: columnasGlobales.length }),
    });
    if (!res.success) { setErrorColumnas(res.message); return; }
    setNuevaColumna("");
    cargarColumnasGlobales();
  }

  async function guardarEdicionColumna(id: number) {
    const nombre = editandoNombre.trim();
    if (!nombre) return;
    await fetchWithAuth(`/api/distrigestion/columnas-extra/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    setEditandoId(null);
    cargarColumnasGlobales();
  }

  async function eliminarColumnaGlobal(id: number) {
    await fetchWithAuth(`/api/distrigestion/columnas-extra/${id}`, { method: "DELETE" });
    cargarColumnasGlobales();
  }

  // ── Modal importador ─────────────────────────────────────────────────────

  function abrirEditar(item: any) {
    setForm({
      ...item,
      columnas_extra: parseMapeo(item.columnas_extra),
      filtros_importacion: parseFiltros(item.filtros_importacion),
    });
    setValEnInput({});
    setErrorModal(null);
    setModalOpen(true);
  }

  function setMapeo(nombreGlobal: string, headerExcel: string) {
    setForm((f) => ({
      ...f,
      columnas_extra: { ...f.columnas_extra, [nombreGlobal]: headerExcel },
    }));
  }

  // ── Filtros: helpers ─────────────────────────────────────────────────────

  function agregarCondicion() {
    const nueva: CondicionFiltro = {
      id: crypto.randomUUID(),
      columna: "operacion",
      operador: "CONTIENE",
      valor: "",
      valor2: "",
      valores: [],
      conector: "Y",
    };
    setForm((f) => ({ ...f, filtros_importacion: [...f.filtros_importacion, nueva] }));
  }

  function eliminarCondicion(id: string) {
    setForm((f) => ({ ...f, filtros_importacion: f.filtros_importacion.filter((c) => c.id !== id) }));
    setValEnInput((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function actualizarCondicion(id: string, campo: keyof CondicionFiltro, valor: unknown) {
    setForm((f) => ({
      ...f,
      filtros_importacion: f.filtros_importacion.map((c) =>
        c.id === id ? { ...c, [campo]: valor } : c
      ),
    }));
  }

  function agregarValorEN(id: string, valor: string) {
    setForm((f) => ({
      ...f,
      filtros_importacion: f.filtros_importacion.map((c) =>
        c.id === id && !c.valores.includes(valor) ? { ...c, valores: [...c.valores, valor] } : c
      ),
    }));
    setValEnInput((prev) => ({ ...prev, [id]: "" }));
  }

  function quitarValorEN(id: string, valor: string) {
    setForm((f) => ({
      ...f,
      filtros_importacion: f.filtros_importacion.map((c) =>
        c.id === id ? { ...c, valores: c.valores.filter((v) => v !== valor) } : c
      ),
    }));
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  async function guardar() {
    setErrorModal(null);
    if (!form.col_importe.trim()) {
      setErrorModal("La columna Importe es obligatoria.");
      return;
    }

    // Limpiar entradas vacías del mapeo
    const mapeoLimpio: Record<string, string> = {};
    for (const [k, v] of Object.entries(form.columnas_extra)) {
      if (v.trim()) mapeoLimpio[k] = v.trim();
    }

    const payload = {
      codigo_cobranza:      form.codigo_cobranza,
      fila_inicial:         form.fila_inicial,
      columna_inicial:      form.columna_inicial,
      col_operacion:        form.col_operacion.trim(),
      col_documento:        form.col_documento.trim(),
      col_importe:          form.col_importe.trim(),
      columnas_extra:       Object.keys(mapeoLimpio).length > 0 ? JSON.stringify(mapeoLimpio) : null,
      filtros_importacion:  form.filtros_importacion.length > 0 ? JSON.stringify(form.filtros_importacion) : null,
    };

    setGuardando(true);
    const res = form.id
      ? await fetchWithAuth(`/api/distrigestion/importadores/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetchWithAuth(`/api/distrigestion/importadores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    setGuardando(false);

    if (!res.success) { setErrorModal(res.message || "Error al guardar"); return; }
    setModalOpen(false);
    cargarFormatos();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const configurados = listaFinal.filter((i) => i.id).length;

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">

      {/* ── Título ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuración de Importadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define cómo se leen los archivos Excel por tipo de cobro
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-slate-700">{configurados}</span>
          <span className="text-slate-400 text-sm"> / {listaFinal.length}</span>
          <p className="text-xs text-slate-400">configurados</p>
        </div>
      </div>

      {/* ── Columnas adicionales globales ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Columnas adicionales</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Definí los nombres de visualización que aparecerán en la tabla de extractos.
          Luego, en cada importador, indicás cómo se llama esa columna en ese Excel específico.
        </p>

        {/* Lista de columnas globales */}
        <div className="space-y-2 mb-4">
          {columnasGlobales.length === 0 && (
            <p className="text-sm text-slate-400 italic">Sin columnas definidas aún.</p>
          )}
          {columnasGlobales.map((col) => (
            <div key={col.id} className="flex items-center gap-2 group">
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              {editandoId === col.id ? (
                <>
                  <input
                    className="border rounded-lg px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editandoNombre}
                    autoFocus
                    onChange={(e) => setEditandoNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") guardarEdicionColumna(col.id); if (e.key === "Escape") setEditandoId(null); }}
                  />
                  <button onClick={() => guardarEdicionColumna(col.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditandoId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-700 px-2 py-1 rounded bg-slate-50 border border-slate-200">
                    {col.nombre}
                  </span>
                  <button
                    onClick={() => { setEditandoId(col.id); setEditandoNombre(col.nombre); }}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => eliminarColumnaGlobal(col.id)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Agregar columna nueva */}
        <div className="flex gap-2">
          <input
            className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nueva columna, ej: Sucursal, Referencia..."
            value={nuevaColumna}
            onChange={(e) => setNuevaColumna(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") agregarColumnaGlobal(); }}
          />
          <button
            onClick={agregarColumnaGlobal}
            disabled={!nuevaColumna.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        {errorColumnas && (
          <p className="text-xs text-red-600 mt-2">{errorColumnas}</p>
        )}
      </section>

      {/* ── Cards de importadores ── */}
      <section>
        <h2 className="font-semibold text-slate-700 mb-3">Importadores por tipo de cobro</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listaFinal.map((it) => {
            const mapeo = parseMapeo(it.columnas_extra);
            const colsMapeadas = Object.keys(mapeo).filter((k) => mapeo[k]);
            const filtros = parseFiltros(it.filtros_importacion);
            const configurado = !!it.id;

            return (
              <button
                key={it.codigo_cobranza}
                onClick={() => abrirEditar(it)}
                className={`text-left w-full rounded-xl border p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  configurado
                    ? "bg-white border-slate-200 hover:border-blue-300"
                    : "bg-slate-50 border-dashed border-slate-300 hover:border-blue-400 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-slate-800 leading-tight">{it.nombre_cobranza}</h3>
                  {configurado ? (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Activo
                    </span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      <AlertCircle className="w-3 h-3" /> Sin configurar
                    </span>
                  )}
                </div>

                {configurado ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="grid grid-cols-2 gap-x-3 text-slate-500">
                      <span>Fila: <strong className="text-slate-700">{it.fila_inicial}</strong></span>
                      <span>Col: <strong className="text-slate-700">{it.columna_inicial}</strong></span>
                    </div>
                    <div className="border-t pt-1.5 space-y-1 text-slate-500">
                      <div className="flex justify-between"><span>Operación</span><span className="font-mono text-slate-600 truncate max-w-[110px]">{it.col_operacion}</span></div>
                      <div className="flex justify-between"><span>Documento</span><span className="font-mono text-slate-600 truncate max-w-[110px]">{it.col_documento}</span></div>
                      <div className="flex justify-between"><span>Importe</span><span className="font-mono text-slate-600 truncate max-w-[110px]">{it.col_importe}</span></div>
                    </div>
                    {colsMapeadas.length > 0 && (
                      <div className="border-t pt-1.5">
                        <div className="flex flex-wrap gap-1">
                          {colsMapeadas.slice(0, 3).map((k) => (
                            <span key={k} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 font-medium truncate max-w-[80px]">
                              {k}
                            </span>
                          ))}
                          {colsMapeadas.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">+{colsMapeadas.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {filtros.length > 0 && (
                      <div className="border-t pt-1.5 flex items-center gap-1 text-orange-600">
                        <Filter className="w-3 h-3" />
                        <span>{filtros.length} filtro{filtros.length !== 1 ? "s" : ""} de importación</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                    <Settings2 className="w-4 h-4" />
                    <span>Clic para configurar</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Modal de configuración ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div
            style={style}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div {...handleProps} className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Configurar importador</h2>
                <p className="text-sm text-slate-500">{form.nombre_cobranza}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="overflow-y-auto flex-1 p-5 space-y-6">

              {/* Estructura */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Estructura del archivo</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fila de encabezados</label>
                    <input
                      type="number" min={1}
                      className="border rounded-lg p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.fila_inicial}
                      onChange={(e) => setForm({ ...form, fila_inicial: Number(e.target.value) })}
                    />
                    <p className="text-xs text-slate-400 mt-1">Fila donde están los títulos</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Columna inicial</label>
                    <input
                      type="number" min={1}
                      className="border rounded-lg p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.columna_inicial}
                      onChange={(e) => setForm({ ...form, columna_inicial: Number(e.target.value) })}
                    />
                    <p className="text-xs text-slate-400 mt-1">Desde qué columna empezar</p>
                  </div>
                </div>
              </section>

              {/* Columnas de conciliación */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Columnas de conciliación</h3>
                <p className="text-xs text-slate-400 mb-3">Nombre exacto del encabezado en el Excel</p>
                <div className="space-y-3">
                  {[
                    { key: "col_operacion" as const, label: "Operación",  hint: "Ej: Nro. Operación" },
                    { key: "col_documento" as const, label: "Documento",  hint: "Ej: Documento / DNI" },
                    { key: "col_importe"   as const, label: "Importe",    hint: "Ej: Importe Acreditado" },
                  ].map(({ key, label, hint }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {label} <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="border rounded-lg p-2 w-full text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={hint}
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Mapeo de columnas adicionales */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Columnas adicionales</h3>
                {columnasGlobales.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No hay columnas adicionales definidas. Agregalas en la sección superior de la página.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-3">
                      Para cada columna global, indicá el nombre exacto del encabezado en este Excel.
                      Dejá vacío si este Excel no tiene esa columna.
                    </p>
                    <div className="space-y-2">
                      {columnasGlobales.map((col) => (
                        <div key={col.id} className="grid grid-cols-2 gap-3 items-center">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-700">{col.nombre}</span>
                          </div>
                          <input
                            className="border rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Header en el Excel..."
                            value={form.columnas_extra[col.nombre] ?? ""}
                            onChange={(e) => setMapeo(col.nombre, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* ── Filtros de importación ── */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-orange-500" />
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Filtros de importación</h3>
                  </div>
                  <button
                    type="button"
                    onClick={agregarCondicion}
                    className="flex items-center gap-1 text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar condición
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Los registros del Excel que cumplan estas condiciones serán <strong>omitidos</strong> durante la importación.
                </p>

                {form.filtros_importacion.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    Sin filtros definidos. Todos los registros válidos serán importados.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {form.filtros_importacion.map((cond, idx) => {
                      // Columnas disponibles: estándar + adicionales con mapeo
                      const extrasDisponibles = columnasGlobales
                        .filter((col) => form.columnas_extra[col.nombre]?.trim())
                        .map((col) => col.nombre);

                      return (
                        <div key={cond.id}>
                          {/* Fila de condición */}
                          <div className="flex items-start gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            {/* Columna */}
                            <select
                              className="border rounded px-1.5 py-1 text-xs min-w-[100px] bg-white"
                              value={cond.columna}
                              onChange={(e) => actualizarCondicion(cond.id, "columna", e.target.value)}
                            >
                              <optgroup label="Estándar">
                                <option value="operacion">Operación</option>
                                <option value="documento">Documento</option>
                                <option value="importe">Importe</option>
                              </optgroup>
                              {extrasDisponibles.length > 0 && (
                                <optgroup label="Adicionales">
                                  {extrasDisponibles.map((nombre) => (
                                    <option key={nombre} value={nombre}>{nombre}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>

                            {/* Operador */}
                            <select
                              className="border rounded px-1.5 py-1 text-xs min-w-[130px] bg-white"
                              value={cond.operador}
                              onChange={(e) => actualizarCondicion(cond.id, "operador", e.target.value as OperadorFiltro)}
                            >
                              {OPERADORES.map((op) => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>

                            {/* Valor(es) */}
                            <div className="flex-1 min-w-0">
                              {cond.operador === "ENTRE" ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="border rounded px-1.5 py-1 text-xs w-full bg-white"
                                    placeholder="Desde"
                                    value={cond.valor}
                                    onChange={(e) => actualizarCondicion(cond.id, "valor", e.target.value)}
                                  />
                                  <span className="text-xs text-slate-400 shrink-0">y</span>
                                  <input
                                    className="border rounded px-1.5 py-1 text-xs w-full bg-white"
                                    placeholder="Hasta"
                                    value={cond.valor2}
                                    onChange={(e) => actualizarCondicion(cond.id, "valor2", e.target.value)}
                                  />
                                </div>
                              ) : cond.operador === "EN LOS VALORES" ? (
                                <div>
                                  {cond.valores.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {cond.valores.map((v) => (
                                        <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                          {v}
                                          <button onClick={() => quitarValorEN(cond.id, v)} className="hover:text-red-600 ml-0.5">
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-1">
                                    <input
                                      className="border rounded px-1.5 py-1 text-xs flex-1 bg-white"
                                      placeholder="Valor... (Enter para agregar)"
                                      value={valEnInput[cond.id] ?? ""}
                                      onChange={(e) => setValEnInput((prev) => ({ ...prev, [cond.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const v = (valEnInput[cond.id] ?? "").trim();
                                          if (v) agregarValorEN(cond.id, v);
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const v = (valEnInput[cond.id] ?? "").trim();
                                        if (v) agregarValorEN(cond.id, v);
                                      }}
                                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <input
                                  className="border rounded px-1.5 py-1 text-xs w-full bg-white"
                                  placeholder="Valor..."
                                  value={cond.valor}
                                  onChange={(e) => actualizarCondicion(cond.id, "valor", e.target.value)}
                                />
                              )}
                            </div>

                            {/* Eliminar */}
                            <button
                              onClick={() => eliminarCondicion(cond.id)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Conector entre condiciones */}
                          {idx < form.filtros_importacion.length - 1 && (
                            <div className="flex items-center gap-2 px-3 py-1">
                              <div className="flex-1 border-t border-dashed border-slate-200" />
                              <div className="flex gap-1">
                                {(["Y", "O"] as ConectorFiltro[]).map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => actualizarCondicion(cond.id, "conector", c)}
                                    className={`px-2 py-0.5 text-xs rounded font-semibold transition-colors ${
                                      cond.conector === c
                                        ? "bg-slate-700 text-white"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    }`}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                              <div className="flex-1 border-t border-dashed border-slate-200" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {errorModal && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errorModal}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-5 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-100 text-slate-600">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {guardando ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
