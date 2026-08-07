import React, { useEffect, useState } from "react";
import {
  User, RefreshCw, FileDown
} from "lucide-react";
import { ModalConfirmacion, ModalResultado } from "./components/ModalConfirmarEnvioERP";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

const DIAS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
];
const DIAS_MAP: Record<string, string> = Object.fromEntries(DIAS.map(d => [d.value, d.label]));

// --- CORRECCIÓN: fecha local (no UTC) ---
function formatDateTime(fecha?: string, hora?: string) {
  if (!fecha) return "-";

  // Si la fecha viene con T y Z, es un ISO string
  if (/^\d{4}-\d{2}-\d{2}T/.test(fecha)) {
    // Extraer solo la parte YYYY-MM-DD
    const cleanDate = fecha.slice(0, 10); // "2025-10-28"
    const [y, m, d] = cleanDate.split("-");
    let hh = "00", mm = "00";
    if (hora && hora.includes(":")) {
      [hh, mm] = hora.split(":");
    }
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }

  // Si es tipo YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split("-");
    let hh = "00", mm = "00";
    if (hora && hora.includes(":")) {
      [hh, mm] = hora.split(":");
    }
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }

  // En cualquier otro caso, limpiar T/Z/segundos si existen
  let cleaned = fecha.replace(/[Tt]/, " ").replace(/(\.\d+)?Z$/, "");
  cleaned = cleaned.split(":").slice(0, 2).join(":"); // Solo hh:mm
  return `${cleaned} ${hora || ""}`.trim();
}


function formatCurrency(num?: number) {
  if (num == null) return "-";
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

interface Pedido {
  id_pedido: number;
  fecha: string;
  hora: string;
  clienteId: string;
  nombre_cliente?: string;
  nombre_contacto?: string;
  celular_contacto?: string;
  estado: string;
  total_pedido?: number;
  diaDeVisita?: string;
  fecha_reconfirmado?: string;
  hora_reconfirmado?: string;
}

const PedidosERP: React.FC = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtered, setFiltered] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Pedido | "total_pedido" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultadoOpen, setResultadoOpen] = useState(false);
  const [resultadoSuccess, setResultadoSuccess] = useState(false);
  const [resultadoEnviados, setResultadoEnviados] = useState<{clienteId: string | number, id_pedido: string | number}[]>([]);
  const [resultadoErrores, setResultadoErrores] = useState<{clienteId: string | number, id_pedido: string | number, error: string}[]>([]);
  const [enviando, setEnviando] = useState(false);

  // --- Fetch pedidos reconfirmados ---
  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      selectedDias.forEach(d => params.append("dias", d));
      const response = await fetchWithAuth(`/api/gestor/pedidos-reconfirmados?${params.toString()}`);
      const result = await response.json();
      setPedidos(result.data || []);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtros y sort ---
  useEffect(() => {
    let temp = [...pedidos];
    if (search.trim()) {
      const s = search.toLowerCase();
      temp = temp.filter(p =>
        (p.clienteId && p.clienteId.toLowerCase().includes(s)) ||
        (p.nombre_cliente && p.nombre_cliente.toLowerCase().includes(s)) ||
        (p.nombre_contacto && p.nombre_contacto.toLowerCase().includes(s))
      );
    }
    if (selectedDias.length > 0 && !selectedDias.includes("todos")) {
      temp = temp.filter(p => selectedDias.includes(String(p.diaDeVisita || "")));
    }
    if (sortBy) {
      temp.sort((a, b) => {
        let vA: any = a[sortBy as keyof Pedido];
        let vB: any = b[sortBy as keyof Pedido];
        if (sortBy === "total_pedido") {
          vA = a.total_pedido || 0;
          vB = b.total_pedido || 0;
        }
        if (typeof vA === "string") vA = vA.toLowerCase();
        if (typeof vB === "string") vB = vB.toLowerCase();
        if (vA < vB) return sortDir === "asc" ? -1 : 1;
        if (vA > vB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFiltered(temp);
  }, [search, pedidos, sortBy, sortDir, selectedDias]);

  useEffect(() => { fetchPedidos(); }, [selectedDias]);

  // --- Columnas redimensionables ---
  const resizableCol = "resize-x overflow-auto min-w-[80px]";
  const resizableColLong = "resize-x overflow-auto min-w-[170px]";
  const resizableColDay = "resize-x overflow-auto min-w-[90px]";

  // --- Sort handler ---
  const handleSort = (col: keyof Pedido | "total_pedido") => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  // --- Selección múltiple ---
  const toggleRow = (id: number) => {
    setSelectedRows(rows =>
      rows.includes(id) ? rows.filter(r => r !== id) : [...rows, id]
    );
  };

  const toggleAllRows = () => {
    if (selectedRows.length === filtered.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filtered.map(p => p.id_pedido));
    }
  };

  // --- Modern UX: click llama a modal de confirmación ---
  const onEnviarClick = () => {
    if (selectedRows.length === 0) return;
    setConfirmOpen(true);
  };

  // --- Confirmar envío a ERP ---
  const handleEnviarERP = async () => {
    setEnviando(true);
    setConfirmOpen(false);
    setResultadoEnviados([]);
    setResultadoErrores([]);
    try {
      const res = await fetchWithAuth("/api/gestor/pedidos-reconfirmados/enviar-erp", {
        method: "POST",
        body: JSON.stringify({ pedidos: selectedRows })
      });
      const data = await res.json();

      // Analizar éxito/errores detallados
      if (data.success) {
        // Intentamos obtener los pedidos enviados OK y sus clienteId
        let enviadosDetalle = (data.logs || []).map((l: any) => ({
          id_pedido: l.pedido,
          clienteId: l.bodySent?.clienteId || l.bodySent?.clienteid || "-"
        }));
        setResultadoEnviados(enviadosDetalle);
        setResultadoSuccess(true);
        setResultadoOpen(true);
        setSelectedRows([]);
        fetchPedidos();
      } else {
        // Analizamos los errores por pedido si los logs existen
        let erroresDetalle = [];
        if (data.logs && Array.isArray(data.logs)) {
          erroresDetalle = data.logs
            .filter((l: any) => l.erpResp?.success === false || l.status !== 200)
            .map((l: any) => ({
              id_pedido: l.pedido,
              clienteId: l.bodySent?.clienteId || l.bodySent?.clienteid || "-",
              error: l.erpResp?.error || l.erpResp?.message || data.error || "Error desconocido"
            }));
        } else {
          // Error general
          erroresDetalle = selectedRows.map(id => ({
            id_pedido: id,
            clienteId: "-",
            error: data.error || "Error desconocido"
          }));
        }
        setResultadoErrores(erroresDetalle);
        setResultadoSuccess(false);
        setResultadoOpen(true);
        fetchPedidos();
      }
    } catch (err: any) {
      // Red error general
      const erroresDetalle = selectedRows.map(id => ({
        id_pedido: id,
        clienteId: "-",
        error: err.message || "Error desconocido"
      }));
      setResultadoErrores(erroresDetalle);
      setResultadoSuccess(false);
      setResultadoOpen(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex flex-col gap-2">
        <div className="flex flex-row items-end gap-3 w-full">
          {/* Filtro cliente */}
          <div className="flex-1 min-w-[270px] max-w-[370px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Buscar cliente (ID, nombre, contacto)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ej: 000451, Juan, Pérez"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          {/* Filtro días */}
          <div className="flex flex-col min-w-[360px] flex-[2]">
            <span className="block text-xs font-medium text-gray-700 mb-1">Días:</span>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <label className="flex items-center px-2 py-1 rounded-full border text-xs cursor-pointer select-none bg-gray-100">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={selectedDias.length === DIAS.length}
                  onChange={() =>
                    setSelectedDias(selectedDias.length === DIAS.length ? [] : DIAS.map(d => d.value))
                  }
                />
                Todos
              </label>
              {DIAS.map(d => (
                <label
                  key={d.value}
                  className={`flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer select-none ${selectedDias.includes(d.value) ? "bg-blue-50 ring-2 ring-blue-400" : "bg-white"}`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={selectedDias.includes(d.value)}
                    onChange={() =>
                      setSelectedDias(prev =>
                        prev.includes(d.value)
                          ? prev.filter(x => x !== d.value)
                          : [...prev, d.value]
                      )
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          {/* Botón actualizar */}
          <div className="flex flex-col justify-end ml-auto">
            <button
              onClick={fetchPedidos}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cantidad de pedidos encontrados */}
      <div className="text-sm text-gray-700 font-medium px-1">
        {loading ? "Cargando pedidos..." : `${filtered.length} pedidos en estado Confirmado`}
      </div>

      {/* Tabla y acciones */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pedidos Listos para Enviar a ERP</h2>
          <button
            onClick={onEnviarClick}
            className={`flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium ${selectedRows.length === 0 || enviando ? "opacity-50 pointer-events-none" : ""}`}
            title="Enviar seleccionados a ERP"
            disabled={selectedRows.length === 0 || enviando}
            >
            <FileDown className="w-5 h-5 mr-2" />
            {enviando ? "Enviando..." : `Enviar a ERP (${selectedRows.length})`}
         </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-lg text-gray-600">Cargando pedidos...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay pedidos Confirmados para enviar
              </h3>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <colgroup>
                <col className="w-[40px]" />
                <col className={resizableCol} />
                <col className={resizableColLong} />
                <col className={resizableColDay} />
                <col className={resizableCol} />
                <col className={resizableCol} />
                <col className={resizableCol} />
                <col className={resizableCol} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs font-semibold text-gray-600 text-center resize-x overflow-auto min-w-[40px]">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === filtered.length && filtered.length > 0}
                      onChange={toggleAllRows}
                    />
                  </th>
                  <Th col="clienteId" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">ID Cliente</Th>
                  <Th col="nombre_cliente" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Cliente</Th>
                  <Th col="diaDeVisita" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Día Visita</Th>
                  <Th col="celular_contacto" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Celular</Th>
                  <Th col="nombre_contacto" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Contacto</Th>
                  <Th col="fecha_reconfirmado" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Fecha Confirmación</Th>
                  <Th col="total_pedido" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Total</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((pedido) => (
                  <tr key={pedido.id_pedido} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(pedido.id_pedido)}
                        onChange={() => toggleRow(pedido.id_pedido)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">{pedido.clienteId}</td>
                    <td className="px-4 py-3 text-center">{pedido.nombre_cliente || "-"}</td>
                    <td className="px-4 py-3 text-center">{DIAS_MAP[pedido.diaDeVisita || ""] || "-"}</td>
                    <td className="px-4 py-3 text-center">{pedido.celular_contacto || "-"}</td>
                    <td className="px-4 py-3 text-center">{pedido.nombre_contacto || "-"}</td>
                    <td className="px-4 py-3 text-center">{formatDateTime(pedido.fecha_reconfirmado, pedido.hora_reconfirmado)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(pedido.total_pedido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de confirmación */}
      <ModalConfirmacion
        open={confirmOpen}
        message={`¿Enviar ${selectedRows.length} pedido(s) al ERP?`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleEnviarERP}
        loading={enviando}
      />
      {/* Modal de resultado */}
      <ModalResultado
        open={resultadoOpen}
        success={resultadoSuccess}
        enviados={resultadoEnviados}
        errores={resultadoErrores}
        onClose={() => setResultadoOpen(false)}
      />

    </div>
  );
};

// --- Componente TH ordenable ---
type ThProps = {
  col: keyof Pedido | "total_pedido",
  sortBy: string,
  sortDir: "asc" | "desc",
  onSort: (col: any) => void,
  className?: string,
  children: React.ReactNode
};
const Th: React.FC<ThProps> = ({ col, sortBy, sortDir, onSort, className = "", children }) => (
  <th
    className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-blue-700 ${className} resize-x overflow-auto`}
    onClick={() => onSort(col)}
  >
    <span className="flex items-center justify-center">
      {children}
      {sortBy === col && (
        <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
      )}
    </span>
  </th>
);

export default PedidosERP;
