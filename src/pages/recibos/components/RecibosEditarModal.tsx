// ============================================================
//  RecibosEditarModal.tsx  (VERSIÓN COMPLETA Y FINAL + MENSAJE ERROR)
//  Incluye:
//   ✔ Imp imputaciones con decimales
//   ✔ Importe valores con decimales
//   ✔ Totales
//   ✔ Modal secundario para elegir tipo de cobro
//   ✔ Input bloqueado + botón ⋯
//   ✔ Muestra response_json cuando estado = "error"
//   ✔ Se mantiene TODA TU LÓGICA ORIGINAL
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDraggable } from "@/hooks/useDraggable";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { Copy, Check, ArrowDownToLine } from "lucide-react";

// ======================= TIPOS =======================

interface TipoCobro {
  codigo: string;
  nombre: string;
}

interface Imputacion {
  id: number;
  tipo_doc: string;
  letra_doc: string | null;
  numero_doc: string | null;
  importe: number | string;
}

interface Valor {
  id: number;
  codigo_cobranza: string;
  descripcion: string | null;
  importe: number | string;
}

interface CabeceraRecibo {
  id: number;
  fecha: string;
  empresa: string;
  empresa_nombre?: string | null;
  empresa_division?: string | null;

  sucursal: string;
  clienteId: string;
  nombre_cliente?: string | null;

  numero_documento?: string | null;
  recibo: string;
  aCuenta: number;
  observacion: string | null;

  estado: "pendiente" | "enviado" | "error";
  response_json?: any;
}

interface Props {
  open: boolean;
  reciboId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  tiposCobro: TipoCobro[];
  readOnly?: boolean;
  conciliados?: Record<number, { extractoId: number | null; importe: number | null }>;
}

// ======================= UTILS =======================

function parseDecimal(v: string) {
  if (!v) return 0;
  const x = v.replace(",", ".").replace(/ /g, "");
  const n = Number(x);
  return isNaN(n) ? 0 : n;
}

const formatMoneda = (n: number) =>
  n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

const RecibosEditarModal: React.FC<Props> = ({
  open,
  reciboId,
  onClose,
  onUpdated,
  tiposCobro,
  readOnly = false,
  conciliados = {},
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cabecera, setCabecera] = useState<CabeceraRecibo | null>(null);
  const [imputaciones, setImputaciones] = useState<Imputacion[]>([]);
  const [valores, setValores] = useState<Valor[]>([]);
  const [aCuentaInput, setACuentaInput] = useState("0");

  const [toastOk, setToastOk] = useState(false);

  // Submodal elección de tipo de cobro
  const [modalTiposOpen, setModalTiposOpen] = useState(false);
  const [selValorId, setSelValorId] = useState<number | null>(null);

  const isReadOnly = readOnly || cabecera?.estado === "enviado";
  const { dialogStyle, handleProps } = useDraggable(open);
  const { dialogStyle: dialogStyleTipos, handleProps: handlePropsTipos } = useDraggable(modalTiposOpen);

  // ============================================================
  //  CARGA RECIBO
  // ============================================================

  useEffect(() => {
    if (!open || !reciboId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchWithAuth(`/api/gestor/recibos/${reciboId}`);
        if (!res.success) {
          setError(res.message || "Error cargando recibo.");
          return;
        }

        const d = res.data;

        // Cabecera
        setCabecera({
          id: d.id,
          fecha: d.fecha,
          empresa: d.empresa,
          empresa_nombre: d.empresa_nombre,
          empresa_division: d.empresa_division,
          sucursal: d.sucursal,
          clienteId: d.clienteId,
          nombre_cliente: d.nombre_cliente,
          numero_documento: d.numero_documento,
          recibo: d.recibo,
          aCuenta: Number(d.aCuenta || 0),
          observacion: d.observacion ?? null,
          estado: d.estado,
          response_json: d.response_json ?? null,
        });

        // Imputaciones
        setImputaciones(
          (d.imputaciones || []).map((i: any) => ({
            id: i.id,
            tipo_doc: i.tipo_doc,
            letra_doc: i.letra_doc,
            numero_doc: i.numero_doc,
            importe: Number(i.importe || 0),
          }))
        );

        // Valores
        setValores(
          (d.valores || []).map((v: any) => ({
            id: v.id,
            codigo_cobranza: v.codigo_cobranza ?? v.codigo,
            descripcion: v.descripcion ?? null,
            importe: Number(v.importe || 0),
          }))
        );

        setACuentaInput(String(d.aCuenta).replace(".", ","));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reciboId]);

  // ============================================================
  //  TOTALES
  // ============================================================

  const totalImputaciones = useMemo(
    () =>
      imputaciones.reduce(
        (acc, i) => acc + Number(parseFloat(String(i.importe)) || 0),
        0
      ),
    [imputaciones]
  );

  const totalValores = useMemo(
    () =>
      valores.reduce(
        (acc, v) => acc + Number(parseFloat(String(v.importe)) || 0),
        0
      ),
    [valores]
  );

  const aCuentaNum = useMemo(() => parseDecimal(aCuentaInput), [aCuentaInput]);
  const impMasACuenta = useMemo(() => totalImputaciones + aCuentaNum, [totalImputaciones, aCuentaNum]);
  const diferencia = useMemo(() => Math.round((impMasACuenta - totalValores) * 100) / 100, [impMasACuenta, totalValores]);

  // ============================================================
  //  GUARDAR
  // ============================================================

  const handleGuardar = async () => {
    if (!cabecera || !reciboId) return;
  
    setSaving(true);
  
    const payload = {
      aCuenta: parseDecimal(aCuentaInput),
      imputaciones: imputaciones.map((i) => ({
        id: i.id,
        importe: Number(parseFloat(String(i.importe)) || 0),
      })),
      valores: valores.map((v) => ({
        id: v.id,
        codigo_cobranza: v.codigo_cobranza,
        descripcion: v.descripcion,
        importe: Number(parseFloat(String(v.importe)) || 0),
      })),
    };
  
    const res = await fetchWithAuth(`/api/gestor/recibos/${reciboId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  
    setSaving(false);
  
    if (!res.success) {
      setError(res.message);
      return;
    }
  
    onUpdated();
    onClose();
  };
  

  // ============================================================
  //  SUBMODAL: elegir tipo de cobro
  // ============================================================

  const handleElegirTipoCobro = (codigo: string) => {
    if (!selValorId) return;

    setValores((prev) =>
      prev.map((v) =>
        v.id === selValorId ? { ...v, codigo_cobranza: codigo } : v
      )
    );

    setModalTiposOpen(false);
    setSelValorId(null);
  };

  // ============================================================
  //  COPIAR AL PORTAPAPELES
  // ============================================================

  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = (key: string, valor: number) => {
    const positivo = Math.abs(Math.round(valor * 100) / 100);
    navigator.clipboard.writeText(String(positivo).replace(".", ","));
    setCopiado(key);
    setTimeout(() => setCopiado(null), 1500);
  };

  const handlePasteImporte = (
    e: React.ClipboardEvent<HTMLInputElement>,
    onSet: (val: number) => void
  ) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").trim().replace(",", ".");
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) {
      onSet(parseFloat(num.toFixed(2)));
    }
  };

  // ============================================================
  //  RENDER
  // ============================================================

  return (
    <>
      {/* ===================== MODAL PRINCIPAL ===================== */}

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" style={dialogStyle}>
          <DialogHeader {...handleProps}>
            <DialogTitle>{readOnly ? "Ver recibo" : "Editar recibo"}</DialogTitle>
            <DialogDescription className="sr-only">
              Edición completa del recibo
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="py-10 text-center text-sm text-gray-600">
              Cargando recibo…
            </div>
          )}

          {!loading && cabecera && (
            <div className="space-y-4">
              {/* ================================================
                  CABECERA
              ================================================= */}
              <div className="grid md:grid-cols-2 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <div className="font-semibold text-slate-700">
                    Recibo {cabecera.recibo}
                  </div>
                  <div className="text-slate-600">
                    Cliente: {cabecera.clienteId} — {cabecera.nombre_cliente}
                  </div>
                  <div className="text-slate-600">
                    Fecha: {cabecera.fecha?.split("T")[0]}
                  </div>
                </div>

                <div>
                  <div className="text-slate-600">
                    Empresa: {cabecera.empresa_nombre} ({cabecera.empresa_division})
                  </div>
                  <div className="text-slate-600">
                    Sucursal: {cabecera.sucursal}
                  </div>
                  <div className="text-slate-600">
                    Estado: <strong>{cabecera.estado.toUpperCase()}</strong>
                  </div>
                </div>
              </div>

              {/* ================================================
                  MENSAJE DE ERROR (response_json) CUANDO ESTADO = "error"
              ================================================= */}
              {cabecera.estado === "error" &&
                cabecera.response_json &&
                (() => {
                  let msg = "";
                  const r = cabecera.response_json;

                  if (typeof r === "string") msg = r;
                  else if (r.raw) msg = r.raw;
                  else if (r.message) msg = r.message;
                  else msg = JSON.stringify(r, null, 2);

                  return (
                    <div className="border border-red-200 bg-red-50 text-xs text-red-800 rounded-lg p-3">
                      <div className="font-semibold mb-1">
                        Detalle del error de Envío:
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug">
                        {msg}
                      </pre>
                    </div>
                  );
                })()}

              {/* ================================================
                  IMPUTACIONES + VALORES
              ================================================= */}

              <div className="grid md:grid-cols-2 gap-4">
                {/* ---------------- IMPUTACIONES ---------------- */}
                <div className="border rounded-lg p-3 bg-white">
                  <h3 className="text-sm font-semibold mb-2">Imputaciones</h3>

                  <table className="min-w-full text-xs border border-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 border">Tipo</th>
                        <th className="px-2 py-1 border">Comprobante</th>
                        <th className="px-2 py-1 border text-right">Importe</th>
                      </tr>
                    </thead>

                    <tbody>
                      {imputaciones.map((i) => (
                        <tr key={i.id}>
                          <td className="px-2 py-1 border">{i.tipo_doc}</td>
                          <td className="px-2 py-1 border">
                            {[i.letra_doc, i.numero_doc].filter(Boolean).join(" ")}
                          </td>

                          <td className="px-2 py-1 border text-right">
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5 text-right text-xs"
                              disabled={isReadOnly}
                              value={String(i.importe).replace(".", ",")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw)) return;

                                setImputaciones((prev) =>
                                  prev.map((x) =>
                                    x.id === i.id ? { ...x, importe: raw } : x
                                  )
                                );
                              }}
                              onPaste={(e) =>
                                handlePasteImporte(e, (val) =>
                                  setImputaciones((prev) =>
                                    prev.map((x) =>
                                      x.id === i.id ? { ...x, importe: val } : x
                                    )
                                  )
                                )
                              }
                              onBlur={(e) => {
                                const raw = e.target.value || "0";
                                const normalize = raw.replace(",", ".");
                                let num = parseFloat(normalize);
                                if (isNaN(num)) num = 0;
                                num = parseFloat(num.toFixed(2));

                                setImputaciones((prev) =>
                                  prev.map((x) =>
                                    x.id === i.id ? { ...x, importe: num } : x
                                  )
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-2 py-1 border text-right">
                          Total imputado
                        </td>
                        <td className="px-2 py-1 border text-right font-semibold">
                          {formatMoneda(totalImputaciones)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* ---------------- VALORES ---------------- */}
                <div className="border rounded-lg p-3 bg-white">
                  <h3 className="text-sm font-semibold mb-2">
                    Valores (medios de pago)
                  </h3>

                  <table className="min-w-full text-xs border border-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 border">Tipo cobro</th>
                        <th className="px-2 py-1 border">Observación</th>
                        <th className="px-2 py-1 border text-right">Importe</th>
                      </tr>
                    </thead>

                    <tbody>
                      {valores.map((v) => {
                        const found = tiposCobro.find(
                          (t) => t.codigo === v.codigo_cobranza
                        );

                        const label = `${v.codigo_cobranza} – ${
                          found?.nombre || "Sin definir"
                        }`;

                        return (
                          <tr key={v.id}>
                            <td className="px-2 py-1 border">
                              <div className="flex gap-1 items-center">
                                <input
                                  className="w-full border rounded px-1 py-0.5 text-xs bg-slate-100"
                                  disabled
                                  value={label}
                                />

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="px-2"
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    setSelValorId(v.id);
                                    setModalTiposOpen(true);
                                  }}
                                >
                                  ⋯
                                </Button>
                              </div>
                            </td>

                            {/* Descripción */}
                            <td className="px-2 py-1 border">
                              <input
                                className="w-full border rounded px-1 py-0.5 text-xs"
                                disabled={isReadOnly}
                                value={v.descripcion ?? ""}
                                onChange={(e) =>
                                  setValores((prev) =>
                                    prev.map((x) =>
                                      x.id === v.id
                                        ? { ...x, descripcion: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>

                            {/* Importe */}
                            <td className="px-2 py-1 border text-right">
                              <div className="flex items-center gap-1">
                                <input
                                  className="w-full border rounded px-1 py-0.5 text-right text-xs"
                                  disabled={isReadOnly}
                                  value={String(v.importe).replace(".", ",")}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (!/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw)) return;

                                    setValores((prev) =>
                                      prev.map((x) =>
                                        x.id === v.id ? { ...x, importe: raw } : x
                                      )
                                    );
                                  }}
                                  onPaste={(e) =>
                                    handlePasteImporte(e, (val) =>
                                      setValores((prev) =>
                                        prev.map((x) =>
                                          x.id === v.id ? { ...x, importe: val } : x
                                        )
                                      )
                                    )
                                  }
                                  onBlur={(e) => {
                                    let raw = e.target.value || "0";
                                    raw = raw.replace(",", ".");
                                    let num = parseFloat(raw);
                                    if (isNaN(num)) num = 0;
                                    num = parseFloat(num.toFixed(2));

                                    setValores((prev) =>
                                      prev.map((x) =>
                                        x.id === v.id ? { ...x, importe: num } : x
                                      )
                                    );
                                  }}
                                />
                                {(() => {
                                  const conc = conciliados[v.id];
                                  if (!conc?.extractoId || conc.importe == null) return null;
                                  return (
                                    <button
                                      type="button"
                                      disabled={isReadOnly}
                                      onClick={() =>
                                        setValores((prev) =>
                                          prev.map((x) =>
                                            x.id === v.id
                                              ? { ...x, importe: parseFloat(Number(conc.importe).toFixed(2)) }
                                              : x
                                          )
                                        )
                                      }
                                      className="shrink-0 text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                      title={`Aplicar importe del extracto conciliado: ${formatMoneda(Number(conc.importe))}`}
                                    >
                                      <ArrowDownToLine className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-2 py-1 border text-right">
                          Total valores
                        </td>
                        <td className="px-2 py-1 border text-right font-semibold">
                          {formatMoneda(totalValores)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ================================================
                  A CUENTA
              ================================================= */}

              <div className="border rounded-lg p-3 bg-slate-50 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">A cuenta:</span>

                  <input
                    type="text"
                    className="border rounded px-2 py-1 text-right w-32"
                    disabled={isReadOnly}
                    value={aCuentaInput}
                    onChange={(e) => setACuentaInput(e.target.value)}
                  />
                </div>

                <div className="text-xs">

                </div>
              </div>

              {/* ================================================
                  ERROR (DEL MODAL / GUARDADO)
              ================================================= */}
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              {/* ================================================
                  TOTALES + BOTONES
              ================================================= */}
              <div className="flex items-end justify-between gap-4 pt-2">

                {/* Recuadro de totales */}
                <div className="border rounded-lg px-4 py-2 bg-slate-50 text-xs space-y-1 min-w-[280px]">
                  <div className="flex justify-between items-center gap-6">
                    <span className="text-slate-600">Imputaciones + A Cuenta:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{formatMoneda(impMasACuenta)}</span>
                      <button
                        type="button"
                        onClick={() => copiar("imp", impMasACuenta)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copiar importe"
                      >
                        {copiado === "imp" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className={`flex justify-between items-center gap-6 ${diferencia !== 0 ? "text-red-600 font-bold" : "text-slate-600"}`}>
                    <span>Diferencia:</span>
                    <div className="flex items-center gap-1">
                      <span>{formatMoneda(diferencia)}</span>
                      <button
                        type="button"
                        onClick={() => copiar("dif", diferencia)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copiar importe"
                      >
                        {copiado === "dif" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-6">
                    <span className="text-slate-600">Suma de Valores:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{formatMoneda(totalValores)}</span>
                      <button
                        type="button"
                        onClick={() => copiar("val", totalValores)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copiar importe"
                      >
                        {copiado === "val" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} disabled={saving}>
                    Cerrar
                  </Button>

                  {!readOnly && cabecera.estado !== "enviado" && (
                    <Button onClick={handleGuardar} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================== SUBMODAL TIPOS COBRO ===================== */}

      <Dialog open={modalTiposOpen} onOpenChange={setModalTiposOpen}>
        <DialogContent className="max-w-md" style={dialogStyleTipos}>
          <DialogHeader {...handlePropsTipos}>
            <DialogTitle>Seleccionar tipo de cobro</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2 mt-3">
            {tiposCobro.map((t) => (
              <Button
                key={t.codigo}
                variant="outline"
                onClick={() => handleElegirTipoCobro(t.codigo)}
                className="justify-start"
              >
                {t.codigo} – {t.nombre}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== TOAST OK ===================== */}
      {toastOk && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          Recibo actualizado correctamente
        </div>
      )}
    </>
  );
};

export default RecibosEditarModal;
