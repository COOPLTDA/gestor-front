import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";

const MESES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function formatMes(yyyymm: string | number): string {
  const n     = Number(yyyymm);
  const year  = Math.floor(n / 100);
  const month = n % 100;
  return `${MESES_ES[month - 1]} ${year}`;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// ── Iconos inline ────────────────────────────────────────────
const IconCheck = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconX = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconAlert = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const IconInfo = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
  </svg>
);
const IconHistory = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const Spinner = ({ sm }: { sm?: boolean }) => (
  <svg className={`animate-spin ${sm ? "w-4 h-4" : "w-8 h-8"} text-blue-500`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

type Version = {
  id: number;
  mes: number;
  username: string;
  fecha_ejecucion: string;
  fecha_version: string;
  tipo: "normal" | "clonar";
  deleted_rows: number;
  inserted_rows: number;
};

type Estado =
  | "idle"
  | "verificando"
  | "confirmando_normal"
  | "confirmando_clonar"
  | "ejecutando"
  | "ok"
  | "confirmando_restaurar"
  | "restaurando"
  | "ok_restaurar"
  | "error";

// ── Modal shell ──────────────────────────────────────────────
function Modal({ onClose, closeable, children }: { onClose: () => void; closeable: boolean; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!closeable) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeable, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeable ? onClose : undefined} />
      <div ref={panelRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ icon, iconBg, title, subtitle, onClose, closeable }: {
  icon?: React.ReactNode; iconBg?: string; title: string; subtitle?: string; onClose: () => void; closeable: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
      {icon && <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-slate-800 leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {closeable && (
        <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 transition shrink-0" aria-label="Cerrar">
          <IconX />
        </button>
      )}
    </div>
  );
}

function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5 space-y-4 overflow-y-auto">{children}</div>;
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2 justify-end bg-slate-50/60">{children}</div>;
}

const BtnPrimary = ({ onClick, disabled = false, danger = false, children }: { onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) => (
  <button onClick={onClick} disabled={disabled}
    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-40 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
    {children}
  </button>
);

const BtnSecondary = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
    {children}
  </button>
);

// ── Componente principal ─────────────────────────────────────
export default function MigrarObjetivosView() {
  const { state } = usePresupuesto();
  const mes = state.mesObjetivo;
  const periodoLabel = mes ? formatMes(mes) : "—";

  const [estado,              setEstado]              = useState<Estado>("idle");
  const [ultimoPeriodoOrigen, setUltimoPeriodoOrigen] = useState<number | null>(null);
  const [porcentaje,          setPorcentaje]          = useState<string>("0");
  const [resultado,           setResultado]           = useState<{ deletedRows: number; insertedRows: number } | null>(null);
  const [errorMsg,            setErrorMsg]            = useState("");

  const [versiones,        setVersiones]        = useState<Version[]>([]);
  const [loadingVersiones, setLoadingVersiones] = useState(false);
  const [versionSeleccionada, setVersionSeleccionada] = useState<Version | null>(null);

  const modalAbierto = estado !== "idle";
  const bloqueado    = estado === "ejecutando" || estado === "verificando" || estado === "restaurando";

  const cerrarModal = useCallback(() => {
    if (bloqueado) return;
    setEstado("idle");
    setVersionSeleccionada(null);
  }, [bloqueado]);

  const cargarVersiones = useCallback(async () => {
    if (!mes) return;
    setLoadingVersiones(true);
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.VERSIONES(mes));
      const json = await res.json();
      if (json.success) setVersiones(json.data.versiones ?? []);
    } catch { /* silencioso */ }
    setLoadingVersiones(false);
  }, [mes]);

  useEffect(() => {
    setEstado("idle");
    setUltimoPeriodoOrigen(null);
    setPorcentaje("0");
    setResultado(null);
    setErrorMsg("");
    setVersiones([]);
    setVersionSeleccionada(null);
    cargarVersiones();
  }, [mes]);

  const handleMigrarClick = useCallback(async () => {
    if (!mes) return;
    setEstado("verificando");
    setErrorMsg("");
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.CHECK(mes));
      const json = await res.json();
      if (!json.success) { setErrorMsg(json.message || "Error al verificar."); setEstado("error"); return; }

      if (json.data.tieneObjetivos) {
        setEstado("confirmando_normal");
      } else {
        const res2  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.PERIODOS_DATOS);
        const json2 = await res2.json();
        const periodos: number[] = json2.success ? json2.data.periodos : [];
        setUltimoPeriodoOrigen(periodos[0] ?? null);
        setEstado("confirmando_clonar");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red.");
      setEstado("error");
    }
  }, [mes]);

  const handleEjecutarNormal = useCallback(async () => {
    setEstado("ejecutando");
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.BASE, { method: "POST", body: JSON.stringify({ mes }) });
      const json = await res.json();
      if (!json.success) { setErrorMsg(json.message || "Error."); setEstado("error"); return; }
      setResultado(json.data);
      setEstado("ok");
      cargarVersiones();
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red.");
      setEstado("error");
    }
  }, [mes, cargarVersiones]);

  const handleEjecutarClonar = useCallback(async () => {
    setEstado("ejecutando");
    const pct = parseFloat(porcentaje) || 0;
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.CLONAR, {
        method: "POST",
        body: JSON.stringify({ mesObjetivo: mes, mesOrigen: ultimoPeriodoOrigen, porcentaje: pct })
      });
      const json = await res.json();
      if (!json.success) { setErrorMsg(json.message || "Error."); setEstado("error"); return; }
      setResultado(json.data);
      setEstado("ok");
      cargarVersiones();
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red.");
      setEstado("error");
    }
  }, [mes, ultimoPeriodoOrigen, porcentaje, cargarVersiones]);

  const abrirRestaurar = useCallback((v: Version) => {
    setVersionSeleccionada(v);
    setEstado("confirmando_restaurar");
  }, []);

  const handleEjecutarRestaurar = useCallback(async () => {
    if (!versionSeleccionada || !mes) return;
    setEstado("restaurando");
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.MIGRAR.RESTAURAR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, logId: versionSeleccionada.id })
      });
      const json = await res.json();
      if (!json.success) { setErrorMsg(json.message || "Error al restaurar."); setEstado("error"); return; }
      setResultado(json.data);
      setEstado("ok_restaurar");
      cargarVersiones();
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red.");
      setEstado("error");
    }
  }, [mes, versionSeleccionada, cargarVersiones]);

  const pct      = parseFloat(porcentaje);
  const pctValido = !isNaN(pct) && pct !== 0;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── TARJETA MIGRACIÓN ── */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Migrar Objetivos</h2>
          <p className="text-slate-500 text-sm">Período seleccionado: <strong>{periodoLabel}</strong></p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Esta acción reemplaza todos los registros de <strong>{periodoLabel}</strong> en el Presupuesto.
        </div>

        <button
          onClick={handleMigrarClick}
          disabled={!mes}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
        >
          Ejecutar migración
        </button>
      </div>

      {/* ── TARJETA VERSIONES ── */}
      {mes && (
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <IconHistory />
            <h3 className="text-base font-semibold">Versiones guardadas — {periodoLabel}</h3>
            {loadingVersiones && <Spinner sm />}
          </div>

          {!loadingVersiones && versiones.length === 0 && (
            <p className="text-sm text-slate-400 italic">No hay versiones guardadas para este período.</p>
          )}

          {versiones.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                    <th className="p-2 border text-left">Fecha / hora</th>
                    <th className="p-2 border text-left">Usuario</th>
                    <th className="p-2 border text-center">Tipo</th>
                    <th className="p-2 border text-right">Registros</th>
                    <th className="p-2 border" />
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border text-slate-700">{formatFecha(v.fecha_ejecucion)}</td>
                      <td className="p-2 border text-slate-600">{v.username}</td>
                      <td className="p-2 border text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${v.tipo === "normal" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          {v.tipo === "normal" ? "Normal" : "Clonar"}
                        </span>
                      </td>
                      <td className="p-2 border text-right text-slate-600">{v.inserted_rows.toLocaleString()}</td>
                      <td className="p-2 border text-center">
                        <button
                          onClick={() => abrirRestaurar(v)}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-900 text-white rounded transition"
                        >
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ────────────────────────────────────── */}
      {modalAbierto && (
        <Modal onClose={cerrarModal} closeable={!bloqueado}>

          {/* VERIFICANDO */}
          {estado === "verificando" && (
            <ModalBody>
              <div className="flex flex-col items-center gap-4 py-6">
                <Spinner />
                <p className="text-sm font-medium text-slate-600">Verificando período {periodoLabel}…</p>
              </div>
            </ModalBody>
          )}

          {/* CONFIRMANDO — con objetivos */}
          {estado === "confirmando_normal" && (
            <>
              <ModalHeader icon={<IconInfo />} iconBg="bg-blue-100 text-blue-600" title="Confirmar migración" subtitle={periodoLabel} onClose={cerrarModal} closeable />
              <ModalBody>
                <p className="text-sm text-slate-700">
                  Se eliminarán los registros existentes de <strong>{periodoLabel}</strong> en el Presupuesto y se insertarán los objetivos calculados.
                </p>
                <p className="text-xs text-red-600 font-medium">Esta acción no se puede deshacer (se guardará una versión para rollback).</p>
              </ModalBody>
              <ModalFooter>
                <BtnSecondary onClick={cerrarModal}>Cancelar</BtnSecondary>
                <BtnPrimary onClick={handleEjecutarNormal} danger>Sí, ejecutar</BtnPrimary>
              </ModalFooter>
            </>
          )}

          {/* CONFIRMANDO CLONAR — sin objetivos */}
          {estado === "confirmando_clonar" && (
            <>
              <ModalHeader icon={<IconAlert />} iconBg="bg-amber-100 text-amber-600" title="Sin objetivos definidos" subtitle={periodoLabel} onClose={cerrarModal} closeable />
              <ModalBody>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                  El período <strong>{periodoLabel}</strong> no tiene objetivos definidos. Se usarán los objetivos de{" "}
                  <strong>{ultimoPeriodoOrigen ? formatMes(ultimoPeriodoOrigen) : "—"}</strong>{" "}
                  (último período con datos) para generar los registros en el Presupuesto.
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Ajuste porcentual{" "}
                    <span className="text-slate-400 font-normal text-xs">(opcional — ej: 5 o -10)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" value={porcentaje} onChange={e => setPorcentaje(e.target.value)}
                      className="w-28 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  {pctValido && (
                    <p className="text-xs text-blue-700">
                      Los importes se {pct > 0 ? "incrementarán" : "reducirán"} un{" "}
                      <strong>{Math.abs(pct)}%</strong> respecto al período origen.
                    </p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <BtnSecondary onClick={cerrarModal}>Cancelar</BtnSecondary>
                <BtnPrimary onClick={handleEjecutarClonar} disabled={!ultimoPeriodoOrigen}>Confirmar y migrar</BtnPrimary>
              </ModalFooter>
            </>
          )}

          {/* EJECUTANDO */}
          {(estado === "ejecutando") && (
            <ModalBody>
              <div className="flex flex-col items-center gap-4 py-6">
                <Spinner />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Ejecutando migración…</p>
                  <p className="text-xs text-slate-400 mt-1">Por favor esperá, no cerrés esta ventana.</p>
                </div>
              </div>
            </ModalBody>
          )}

          {/* CONFIRMANDO RESTAURAR */}
          {estado === "confirmando_restaurar" && versionSeleccionada && (
            <>
              <ModalHeader icon={<IconAlert />} iconBg="bg-amber-100 text-amber-600" title="Restaurar versión" subtitle={periodoLabel} onClose={cerrarModal} closeable />
              <ModalBody>
                <div className="bg-slate-50 border rounded-lg p-4 space-y-1 text-sm">
                  <p><span className="text-slate-500">Fecha:</span> <strong>{formatFecha(versionSeleccionada.fecha_ejecucion)}</strong></p>
                  <p><span className="text-slate-500">Usuario:</span> <strong>{versionSeleccionada.username}</strong></p>
                  <p><span className="text-slate-500">Tipo:</span> <strong>{versionSeleccionada.tipo === "normal" ? "Migración normal" : "Clonar"}</strong></p>
                  <p><span className="text-slate-500">Registros:</span> <strong>{versionSeleccionada.inserted_rows.toLocaleString()}</strong></p>
                </div>
                <p className="text-xs text-red-600 font-medium">
                  Esta acción reemplazará los datos actuales de <strong>{periodoLabel}</strong> con los de esta versión.
                </p>
              </ModalBody>
              <ModalFooter>
                <BtnSecondary onClick={cerrarModal}>Cancelar</BtnSecondary>
                <BtnPrimary onClick={handleEjecutarRestaurar} danger>Sí, restaurar</BtnPrimary>
              </ModalFooter>
            </>
          )}

          {/* RESTAURANDO */}
          {estado === "restaurando" && (
            <ModalBody>
              <div className="flex flex-col items-center gap-4 py-6">
                <Spinner />
                <p className="text-sm font-medium text-slate-600">Restaurando versión…</p>
              </div>
            </ModalBody>
          )}

          {/* OK MIGRACIÓN */}
          {estado === "ok" && resultado && (
            <>
              <ModalHeader icon={<IconCheck />} iconBg="bg-green-100 text-green-600" title="Migración completada" subtitle={periodoLabel} onClose={cerrarModal} closeable />
              <ModalBody>
                <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-1">
                  <p className="text-sm text-slate-700">Registros eliminados: <strong className="text-slate-900">{resultado.deletedRows.toLocaleString()}</strong></p>
                  <p className="text-sm text-slate-700">Registros insertados: <strong className="text-slate-900">{resultado.insertedRows.toLocaleString()}</strong></p>
                  <p className="text-xs text-slate-500 mt-1">Se guardó una versión para rollback.</p>
                </div>
              </ModalBody>
              <ModalFooter><BtnPrimary onClick={cerrarModal}>Cerrar</BtnPrimary></ModalFooter>
            </>
          )}

          {/* OK RESTAURACIÓN */}
          {estado === "ok_restaurar" && resultado && (
            <>
              <ModalHeader icon={<IconCheck />} iconBg="bg-green-100 text-green-600" title="Versión restaurada" subtitle={periodoLabel} onClose={cerrarModal} closeable />
              <ModalBody>
                <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-1">
                  <p className="text-sm text-slate-700">Registros reemplazados: <strong className="text-slate-900">{resultado.insertedRows.toLocaleString()}</strong></p>
                </div>
              </ModalBody>
              <ModalFooter><BtnPrimary onClick={cerrarModal}>Cerrar</BtnPrimary></ModalFooter>
            </>
          )}

          {/* ERROR */}
          {estado === "error" && (
            <>
              <ModalHeader icon={<IconX />} iconBg="bg-red-100 text-red-500" title="Error" onClose={cerrarModal} closeable />
              <ModalBody><p className="text-sm text-red-700">{errorMsg}</p></ModalBody>
              <ModalFooter><BtnSecondary onClick={cerrarModal}>Cerrar</BtnSecondary></ModalFooter>
            </>
          )}

        </Modal>
      )}
    </div>
  );
}
