import React, { useEffect, useMemo, useState } from "react";
import { UserPlus, Users, XCircle, Search, Pencil, FileDown } from "lucide-react";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import * as XLSX from "xlsx";

const DIAS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];
const DIAS_MAP: Record<string, string> = Object.fromEntries(DIAS.map(d => [d.value, d.label]));

type SortDir = "asc" | "desc";

interface Invitado {
  id_contacto: number;
  numero_celular: string;
  nombre_whatsapp: string;
  nombre_contacto: string;
  fecha_alta: string;
  ultima_interaccion: string;
  activo: number;
}

interface Cliente {
  id_contacto: number;
  idCliente: string;
  nombre_cliente: string;
  numero_celular: string;
  nombre_whatsapp: string;
  nombre_contacto: string;
  localidad: string;
  CanalVenta: string;
  diaDeVisita?: string;
  ultima_interaccion: string;
  activo: number;
}

const Contactos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"invitados" | "clientes">("invitados");
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Búsqueda y filtro
  const [searchInv, setSearchInv] = useState("");
  const [searchCli, setSearchCli] = useState("");
  const [colorFilter, setColorFilter] = useState<"todos" | "verde" | "amarillo" | "rojo">("todos");
  const [soloActivos, setSoloActivos] = useState(false);
  const [soloActivosClientes, setSoloActivosClientes] = useState(false);

  // Sorting
  const [sortInvBy, setSortInvBy] = useState<keyof Invitado | "">("");
  const [sortInvDir, setSortInvDir] = useState<SortDir>("asc");
  const [sortCliBy, setSortCliBy] = useState<keyof Cliente | "">("");
  const [sortCliDir, setSortCliDir] = useState<SortDir>("asc");

  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Modales
  const [showInvModal, setShowInvModal] = useState<{ invitado: Invitado } | null>(null);
  const [showCliModal, setShowCliModal] = useState<{ cliente: Cliente } | null>(null);

  const fetchContactos = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/distrigestion/contactos");
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setInvitados(data.data.invitados);
      setClientes(data.data.clientes);
    } catch (err: any) {
      setError(err.message || "Error al cargar contactos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setColorFilter("todos"); 
    fetchContactos();
  }, [activeTab]);

  const parseFecha = (str?: string) => {
    if (!str) return null;
  
    // Trim
    str = str.trim();
  
    // Formato DD/MM/YYYY o con hora (DD/MM/YYYY HH:mm:ss)
    if (str.includes("/")) {
      const [d, m, yRaw] = str.split("/");
      const y = Number(yRaw.split(" ")[0]);  // <-- CORRECCIÓN CLAVE
      return new Date(y, Number(m) - 1, Number(d));
    }
  
    // Caso ISO YYYY-MM-DD
    return new Date(str);
  };
  
  
  const getDaysDiff = (dateStr?: string) => {
    const fecha = parseFecha(dateStr);
    if (!fecha || isNaN(fecha.getTime())) return Infinity;
    const now = new Date();
    return Math.floor((now.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  };
  
  // NUEVA SEMAFORIZACION 2–4 semanas
  const getColorByInteraction = (dateStr?: string) => {
    const diffDays = getDaysDiff(dateStr);
    if (diffDays <= 7) return "verde";          // 0–7 días
    if (diffDays >= 8 && diffDays <= 28) return "amarillo"; // 2–4 semanas
    if (diffDays > 28) return "rojo";           // >4 semanas
    return "gris";
  };

  const exportarAExcel = (tipo: "invitados" | "clientes") => {
    const data =
      tipo === "invitados"
        ? invitadosFiltered.map((i) => ({
            Fecha_Alta: new Date(i.fecha_alta).toLocaleDateString(),
            Numero_Celular: i.numero_celular,
            Nombre_WhatsApp: i.nombre_whatsapp,
            Nombre_Contacto: i.nombre_contacto,
            Ultima_Interaccion: i.ultima_interaccion
              ? parseFecha(i.ultima_interaccion)?.toLocaleDateString() ?? "-"
              : "-",
            Activo: i.activo ? "Sí" : "No",
          }))
        : clientesFiltered.map((c) => ({
            ID_Cliente: c.idCliente,
            Cliente: c.nombre_cliente,
            Numero_Celular: c.numero_celular,
            Nombre_WhatsApp: c.nombre_whatsapp,
            Nombre_Contacto: c.nombre_contacto,
            Dia_Visita: DIAS_MAP[c.diaDeVisita || ""] || "-",
            Localidad: c.localidad,
            Canal_Venta: c.CanalVenta,
            Ultima_Interaccion: c.ultima_interaccion
              ? parseFecha(c.ultima_interaccion)?.toLocaleDateString()
              : "-",
            Activo: c.activo ? "Sí" : "No",
          }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tipo === "invitados" ? "Invitados" : "Clientes");
    XLSX.writeFile(
      workbook,
      `Contactos_${tipo}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const bgColorClass = (color: string) =>
    color === "verde"
      ? "bg-green-100 text-green-800"
      : color === "amarillo"
      ? "bg-yellow-100 text-yellow-800"
      : color === "rojo"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-700";

  const toggleSort = <T extends object>(
    col: keyof T,
    currentBy: string,
    currentDir: SortDir,
    setBy: (v: any) => void,
    setDir: (v: SortDir) => void
  ) => {
    if (currentBy === col) setDir(currentDir === "asc" ? "desc" : "asc");
    else {
      setBy(col);
      setDir("asc");
    }
  };

  const sortData = <T extends Record<string, any>>(rows: T[], by: string, dir: SortDir) => {
    if (!by) return rows;
    return [...rows].sort((a, b) => {
      let A = a[by], B = b[by];
      if (typeof A === "string") A = A.toLowerCase();
      if (typeof B === "string") B = B.toLowerCase();
      if (A < B) return dir === "asc" ? -1 : 1;
      if (A > B) return dir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const filterByColor = <T extends { ultima_interaccion?: string }>(rows: T[]) => {
    if (colorFilter === "todos") return rows;
    return rows.filter(r => getColorByInteraction(r.ultima_interaccion) === colorFilter);
  };

  const filterBySearch = <T extends Record<string, any>>(rows: T[], term: string) => {
    if (!term.trim()) return rows;
    const q = term.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v || "").toLowerCase().includes(q)));
  };

  const invitadosFiltered = useMemo(() => {
    let rows = sortData(invitados, sortInvBy, sortInvDir);
    rows = filterByColor(rows);
    rows = filterBySearch(rows, searchInv);
    if (soloActivos) rows = rows.filter((r) => r.activo === 1);
    return rows;
  }, [invitados, sortInvBy, sortInvDir, colorFilter, searchInv, soloActivos]);

  const clientesFiltered = useMemo(() => {
    let rows = sortData(clientes, sortCliBy, sortCliDir);
    rows = filterByColor(rows);
    rows = filterBySearch(rows, searchCli);
    if (soloActivosClientes) rows = rows.filter((r) => r.activo === 1);
    return rows;
  }, [clientes, sortCliBy, sortCliDir, colorFilter, searchCli, soloActivosClientes]);

  const totalPages = Math.max(1, Math.ceil(clientesFiltered.length / limit));
  const clientesPage = clientesFiltered.slice((page - 1) * limit, page * limit);

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-4">
        <div className="flex items-center space-x-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );

  const ColorFilter = ({
    label,
    color,
  }: {
    label: string;
    color: "verde" | "amarillo" | "rojo" | "todos";
  }) => (
    <button
      onClick={() => setColorFilter(color)}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
        colorFilter === color ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
      }`}
    >
      <span
        className={`inline-block w-3 h-3 rounded-full ${
          color === "verde"
            ? "bg-green-500"
            : color === "amarillo"
            ? "bg-yellow-400"
            : color === "rojo"
            ? "bg-red-500"
            : "bg-gray-400"
        }`}
      />
      {label}
    </button>
  );
  return (
    <div className="space-y-8">

      {/* === Solapas + Glosario === */}
      <div className="flex items-center justify-between mb-4 border-b border-gray-200">
        
        {/* Solapas */}
        <div className="flex items-center gap-2">
          {[
            { key: "invitados", label: "Invitados", count: invitados.length, icon: <UserPlus className="w-4 h-4 mr-1" /> },
            { key: "clientes", label: "Clientes", count: clientes.length, icon: <Users className="w-4 h-4 mr-1" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "invitados" | "clientes")}
              className={`flex items-center px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white border-x border-t border-gray-200 text-blue-600"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="ml-1 text-xs font-semibold text-gray-500">
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* Glosario de colores */}
        <div className="flex flex-col items-start gap-1 text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white/50 shadow-sm">
          <span className="font-medium text-gray-600 mb-1">Frecuencia de interacción</span>
          <div className="flex items-center gap-2">
            <ColorFilter label="Todos" color="todos" />
            <ColorFilter label="≤ 1 semana" color="verde" />
            <ColorFilter label="2–4 semanas" color="amarillo" />
            <ColorFilter label="> 4 semanas" color="rojo" />
          </div>
        </div>
      </div>

      {/* ===================== INVITADOS ===================== */}
      {activeTab === "invitados" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          
          {loading ? (
            <div className="p-8 text-center text-gray-600">Cargando invitados...</div>
          ) : (
            <>

              {/* Búsqueda + solo activos + exportar */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 w-full">

                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchInv}
                    onChange={(e) => setSearchInv(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />

                  <button
                    onClick={() => setSoloActivos((prev) => !prev)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      soloActivos
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {soloActivos ? "Ver todos" : "Solo activos"}
                  </button>

                  <button
                    onClick={() => exportarAExcel("invitados")}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    <FileDown className="w-4 h-4" /> Exportar
                  </button>

                </div>
              </div>

              {/* TABLA INVITADOS */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 w-[42px]"></th>

                      <Th col="fecha_alta" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Fecha Alta
                      </Th>

                      <Th col="numero_celular" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Número Celular
                      </Th>

                      <Th col="nombre_whatsapp" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Nombre WhatsApp
                      </Th>

                      <Th col="nombre_contacto" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Nombre Contacto
                      </Th>

                      <Th col="ultima_interaccion" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Última Interacción
                      </Th>

                      {/* NUEVA COLUMNA ACTIVO */}
                      <Th col="activo" sortBy={sortInvBy} sortDir={sortInvDir}
                        onSort={(c)=>toggleSort<Invitado>(c as keyof Invitado, sortInvBy, sortInvDir, setSortInvBy, setSortInvDir)}>
                        Activo
                      </Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {invitadosFiltered.map((i) => {
                      const color = getColorByInteraction(i.ultima_interaccion);
                      return (
                        <tr key={i.id_contacto} className="hover:bg-gray-50">

                          <td className="px-3 py-2 text-center">
                            <button
                              className="text-blue-700 hover:text-blue-900"
                              onClick={() => setShowInvModal({ invitado: i })}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          </td>

                          <td className="px-4 py-2">{new Date(i.fecha_alta).toLocaleDateString()}</td>
                          <td className="px-4 py-2">{i.numero_celular}</td>
                          <td className="px-4 py-2">{i.nombre_whatsapp}</td>
                          <td className="px-4 py-2">{i.nombre_contacto}</td>

                          <td className={`px-4 py-2 font-medium rounded ${bgColorClass(color)}`}>
                            {i.ultima_interaccion
                              ? parseFecha(i.ultima_interaccion)?.toLocaleDateString() 
                              : "-"}
                          </td>

                          {/* Activo */}
                          <td className="px-4 py-2 text-center">
                            {i.activo === 1 ? (
                              <span className="text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                                Activo
                              </span>
                            ) : (
                              <span className="text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
                                Inactivo
                              </span>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </div>
      )}

      {/* ===================== CLIENTES ===================== */}
      {activeTab === "clientes" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">

          {loading ? (
            <div className="p-8 text-center text-gray-600">Cargando clientes...</div>
          ) : (
            <>

              {/* Búsqueda + solo activos + exportar */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 w-full">

                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchCli}
                    onChange={(e) => setSearchCli(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />

                  <button
                    onClick={() => setSoloActivosClientes((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      soloActivosClientes
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {soloActivosClientes ? "Ver todos" : "Solo activos"}
                  </button>

                  <button
                    onClick={() => exportarAExcel("clientes")}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    <FileDown className="w-4 h-4" /> Exportar
                  </button>

                </div>
              </div>

              {/* TABLA CLIENTES */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">

                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 w-[42px]"></th>

                      <Th col="idCliente" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        ID
                      </Th>

                      <Th col="nombre_cliente" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Cliente
                      </Th>

                      <Th col="numero_celular" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Celular
                      </Th>

                      <Th col="nombre_whatsapp" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        WhatsApp
                      </Th>

                      <Th col="nombre_contacto" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Nombre Contacto
                      </Th>

                      <Th col="diaDeVisita" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Visita
                      </Th>

                      <Th col="localidad" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Localidad
                      </Th>

                      <Th col="CanalVenta" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Canal
                      </Th>

                      <Th col="ultima_interaccion" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Última Interacción
                      </Th>

                      {/* NUEVA COLUMNA ACTIVO */}
                      <Th col="activo" sortBy={sortCliBy} sortDir={sortCliDir}
                        onSort={(c)=>toggleSort<Cliente>(c as keyof Cliente, sortCliBy, sortCliDir, setSortCliBy, setSortCliDir)}>
                        Activo
                      </Th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {clientesPage.map((c) => {
                      const color = getColorByInteraction(c.ultima_interaccion);

                      return (
                        <tr key={c.id_contacto} className="hover:bg-gray-50">
                          
                          <td className="px-3 py-2 text-center">
                            <button
                              className="text-blue-700 hover:text-blue-900"
                              onClick={() => setShowCliModal({ cliente: c })}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          </td>

                          <td className="px-4 py-2">{c.idCliente}</td>
                          <td className="px-4 py-2">{c.nombre_cliente}</td>
                          <td className="px-4 py-2">{c.numero_celular}</td>
                          <td className="px-4 py-2">{c.nombre_whatsapp}</td>
                          <td className="px-4 py-2">{c.nombre_contacto}</td>
                          <td className="px-4 py-2">{DIAS_MAP[c.diaDeVisita || ""] || "-"}</td>
                          <td className="px-4 py-2">{c.localidad}</td>
                          <td className="px-4 py-2">{c.CanalVenta || "-"}</td>

                          <td className={`px-4 py-2 font-medium rounded ${bgColorClass(color)}`}>
                            {c.ultima_interaccion
                              ? parseFecha(c.ultima_interaccion)?.toLocaleDateString()
                              : "-"}
                          </td>

                          <td className="px-4 py-2 text-center">
                            {c.activo === 1 ? (
                              <span className="text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                                Activo
                              </span>
                            ) : (
                              <span className="text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
                                Inactivo
                              </span>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

              {/* PAGINACIÓN */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 text-sm text-gray-700 gap-3">

                <div className="flex items-center gap-2">
                  <span>Mostrar</span>

                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    {[15, 30, 45].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <span>por página</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                  >
                    ← Anterior
                  </button>

                  <span>Página {page} de {totalPages}</span>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Siguiente →
                  </button>
                </div>

              </div>

            </>
          )}

        </div>
      )}

      {/* === MODALES === */}
      {showInvModal && (
        <ModalActualizarInvitado
          invitado={showInvModal.invitado}
          onClose={() => setShowInvModal(null)}
          onUpdated={fetchContactos}
        />
      )}

      {showCliModal && (
        <ModalActualizarCliente
          cliente={showCliModal.cliente}
          onClose={() => setShowCliModal(null)}
          onUpdated={fetchContactos}
        />
      )}

    </div>
  );
};
// ===== Th ordenable =====
const Th: React.FC<{
  col: string;
  sortBy: string | "";
  sortDir: SortDir;
  onSort: (col: string) => void;
  children: React.ReactNode;
}> = ({ col, sortBy, sortDir, onSort, children }) => (
  <th
    className="px-4 py-2 text-left cursor-pointer select-none hover:text-blue-700"
    onClick={() => onSort(col)}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {sortBy === col && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
    </span>
  </th>
);



/* ============================================================
   =============== MODAL ACTUALIZAR INVITADO ==================
   ============================================================ */
const ModalActualizarInvitado: React.FC<{
  invitado: Invitado;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ invitado, onClose, onUpdated }) => {

  // Estado activo + nombre contacto
  const [activo, setActivo] = useState(invitado.activo === 1);
  const [nombreContacto, setNombreContacto] = useState(invitado.nombre_contacto || "");

  // Búsqueda de clientes
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [seleccion, setSeleccion] = useState<any | null>(null);
  const [error, setError] = useState<string>("");

  const buscar = async () => {
    setError("");
    if (!term.trim()) {
      setResultados([]);
      setSeleccion(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/distrigestion/clients?search=${encodeURIComponent(term)}&limit=50`
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "No se pudo obtener clientes");

      setResultados(Array.isArray(data.data) ? data.data : []);
    } catch (e: any) {
      setError(e.message || "Error buscando clientes");
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const guardarActivoYNombre = async () => {
    try {
      await fetchWithAuth(`/api/distrigestion/contactos/${invitado.id_contacto}/general`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activo: activo ? 1 : 0,
          nombre_contacto: nombreContacto,
        }),
      });

      onUpdated();
      onClose();
    } catch {
      alert("No se pudo actualizar el contacto");
    }
  };

  const confirmarAsignacion = async () => {
    if (!seleccion) return;

    try {
      await fetchWithAuth(`/api/distrigestion/contactos/${invitado.id_contacto}/asignar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idCliente: seleccion.idCliente }),
      });
      onUpdated();
      onClose();
    } catch {
      alert("No se pudo asignar el cliente");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl z-50">
        <h3 className="text-lg font-semibold mb-4">
          Actualizar invitado{" "}
          <span className="text-blue-600">
            {invitado.nombre_contacto ||
              invitado.nombre_whatsapp ||
              invitado.numero_celular}
          </span>
        </h3>

        {/* Estado + nombre */}
        <div className="flex flex-col gap-4 mb-5">

          {/* Activo */}
          <div className="flex items-center gap-3">
            <span className="font-medium">Activo:</span>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              <span>{activo ? "Sí" : "No"}</span>
            </label>
          </div>

          {/* Nombre contacto */}
          <div className="flex items-center gap-3">
            <span className="font-medium">Nombre contacto:</span>
            <input
              type="text"
              value={nombreContacto}
              onChange={(e) => setNombreContacto(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm"
            />
          </div>

          <button
            onClick={guardarActivoYNombre}
            className="ml-auto bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-lg"
          >
            Guardar cambios
          </button>
        </div>

        {/* Buscador de clientes */}
        <div className="border rounded-xl p-3">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por ID, nombre, tipo, localidad o dirección..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />

            <button
              onClick={buscar}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Buscar
            </button>
          </div>

          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

          {loading ? (
            <div className="text-center text-gray-600 py-4">Buscando...</div>
          ) : seleccion ? (
            <div className="border rounded-lg p-3 bg-blue-50/40">
              <div className="font-semibold mb-1">
                {seleccion.Cliente} — {seleccion.idCliente}
              </div>

              <div className="text-xs text-gray-700">
                Tipo: {seleccion.Tipo_Cliente || "-"} · Dirección:{" "}
                {[seleccion.calle, seleccion.altura, seleccion.localidad]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </div>

              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => setSeleccion(null)}
                  className="px-3 py-1 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cambiar
                </button>

                <button
                  onClick={confirmarAsignacion}
                  className="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  Confirmar asignación
                </button>
              </div>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded">
              {resultados.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  Sin resultados
                </div>
              ) : (
                resultados.map((cli: any) => {
                  const direccion = [cli.calle, cli.altura, cli.localidad]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div key={cli.idCliente} className="px-4 py-2 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            {cli.Cliente} — {cli.idCliente}
                          </div>
                          <div className="text-xs text-gray-600">
                            Tipo: {cli.Tipo_Cliente || "-"} · Dirección:{" "}
                            {direccion || "-"}
                          </div>
                        </div>
                        <button
                          onClick={() => setSeleccion(cli)}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};



/* ============================================================
   ================= MODAL ACTUALIZAR CLIENTE =================
   ============================================================ */
const ModalActualizarCliente: React.FC<{
  cliente: Cliente;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ cliente, onClose, onUpdated }) => {

  const [activo, setActivo] = useState(cliente.activo === 1);
  const [nombreContacto, setNombreContacto] = useState(cliente.nombre_contacto || "");
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      await fetchWithAuth(`/api/distrigestion/contactos/${cliente.id_contacto}/general`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activo: activo ? 1 : 0,
          nombre_contacto: nombreContacto,
        }),
      });

      onUpdated();
      onClose();
    } catch {
      alert("No se pudo actualizar el contacto");
    } finally {
      setGuardando(false);
    }
  };

  const desasignar = async () => {
    try {
      await fetchWithAuth(`/api/distrigestion/contactos/${cliente.id_contacto}/desasignar`, {
        method: "PUT",
      });
      onUpdated();
      onClose();
    } catch {
      alert("No se pudo desasignar el contacto");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg z-50">
        <h3 className="text-lg font-semibold mb-4">
          Actualizar cliente{" "}
          <span className="text-blue-600">
            {cliente.nombre_cliente || cliente.idCliente}
          </span>
        </h3>

        {/* Activo + nombre */}
        <div className="flex flex-col gap-4 mb-5">

          <div className="flex items-center gap-3">
            <span className="font-medium">Activo:</span>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              <span>{activo ? "Sí" : "No"}</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-medium">Nombre contacto:</span>
            <input
              type="text"
              value={nombreContacto}
              onChange={(e) => setNombreContacto(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm"
            />
          </div>

          <button
            disabled={guardando}
            onClick={guardarCambios}
            className="ml-auto bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {/* Desasignar */}
        <div className="border-t pt-4">
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Desasignar (volver a Invitado)
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                ¿Confirmás desasignar este contacto?
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmando(false)}
                  className="px-3 py-1 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancelar
                </button>

                <button
                  onClick={desasignar}
                  className="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Contactos;
