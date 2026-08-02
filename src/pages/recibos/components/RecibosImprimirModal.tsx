// src/pages/recibos/components/RecibosImprimirModal.tsx
import React, { useState } from "react";
import { Printer, X, FileText, FileDown } from "lucide-react";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HojaRuta } from "../Recibos";
import type { ReciboValor } from "./RecibosTabla";
import type { ConciliadoValor } from "../Recibos";

interface Props {
  onClose: () => void;
  datosDG: ReciboValor[];
  datosFiltrados: ReciboValor[];
  conciliados: Record<number, ConciliadoValor>;
  hojasSeleccionadas: HojaRuta[];
  hojaUnica: HojaRuta | null;
  esMultipleHDR: boolean;
  seleccionados: Set<number>;
}

const RecibosImprimirModal: React.FC<Props> = ({
  onClose,
  datosDG,
  datosFiltrados,
  conciliados,
  hojasSeleccionadas,
  hojaUnica,
  esMultipleHDR,
  seleccionados,
}) => {
  const { user } = useAuth();
  const [scope, setScope] = useState<"todo" | "visible" | "marcados">("visible");
  const [accion, setAccion] = useState<"imprimir" | "pdf">("imprimir");

  useModalEscClose(true, onClose);
  const { style, handleProps } = useDraggable();

  const formatMoneda = (n: number | null | undefined) => {
    if (n == null) return "";
    return Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  };

  const formatFecha = (f: string | undefined) =>
    f ? f.slice(0, 10) : "";

  function getRows(): ReciboValor[] {
    if (scope === "todo") return datosDG;
    if (scope === "marcados") return datosDG.filter((r) => seleccionados.has(r.valorId));
    return datosFiltrados;
  }

  // ─── PDF AUTOMÁTICO con jsPDF ──────────────────────────────────────
  function generarPDF() {
    const rows = getRows();
    const now = new Date();
    const fechaHoraStr = now.toLocaleDateString("es-AR") + " " + now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const usuarioStr = user?.nombre || user?.username || "—";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // ── Encabezado HDR ──
    const margenIzq = 14;
    let y = 14;

    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175); // blue-800
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de Recibos — Hoja de Ruta", margenIzq, y);
    y += 7;

    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81); // gray-700
    doc.setFont("helvetica", "normal");

    if (!esMultipleHDR && hojaUnica) {
      const info = [
        `HDR: ${hojaUnica.hoja_ruta}`,
        `Fecha: ${formatFecha(hojaUnica.fecha)}`,
        `Código: ${hojaUnica.vendedor || "—"}`,
        `Chofer: ${hojaUnica.chofer || "—"}`,
        `Total cobrado: ${formatMoneda(Number(hojaUnica.total))}`,
        `Registros: ${rows.length}`,
      ];
      doc.text(info.join("   |   "), margenIzq, y);
    } else {
      const hdrsStr = hojasSeleccionadas.map((h) => h.hoja_ruta).join(", ");
      const totalGeneral = rows.reduce((s, r) => s + Number(r.monto), 0);
      doc.text(`HDRs: ${hdrsStr}   |   Total cobrado: ${formatMoneda(totalGeneral)}   |   Registros: ${rows.length}`, margenIzq, y);
    }
    y += 2;

    // ── Tabla ──
    const estadoLabel: Record<string, string> = { enviado: "Enviado", pendiente: "Pendiente", error: "Error" };
    const choferMap = Object.fromEntries(hojasSeleccionadas.map((h) => [h.hoja_ruta, h.chofer || "—"]));

    const totalMonto = rows.reduce((s, r) => s + Number(r.monto), 0);
    const totalConc = rows.reduce((s, r) => {
      const c = conciliados[r.valorId];
      return s + (c?.importe ? Number(c.importe) : 0);
    }, 0);

    const totalRowStyle = { fontStyle: "bold" as const, fillColor: [243, 244, 246] as [number, number, number] };
    // Con columnas extra HDR+Chofer el colSpan del TOTAL cambia de 9 a 11
    const totalColSpan = esMultipleHDR ? 11 : 9;

    const body: any[] = rows.map((r) => {
      const conc = conciliados[r.valorId];
      const hojaRuta = (r as any).hojaRuta ?? "";
      const fila: any[] = [];
      if (esMultipleHDR) {
        fila.push(hojaRuta, choferMap[hojaRuta] ?? "—");
      }
      fila.push(
        estadoLabel[r.estado] ?? r.estado,
        `${r.empresa_nombre} (${r.empresa_division})`,
        r.recibo,
        formatFecha(r.fecha),
        r.clienteId,
        r.nombre_cliente,
        r.documento,
        r.codigo,
        r.observacion || "",
        formatMoneda(r.monto),
        conc?.operacion || "",
        conc?.documento || "",
        conc?.importe ? formatMoneda(Number(conc.importe)) : "",
      );
      return fila;
    });

    // Fila de totales al final del body para garantizar que se renderice
    body.push([
      { content: "TOTAL", colSpan: totalColSpan, styles: { ...totalRowStyle, halign: "right" } },
      { content: formatMoneda(totalMonto), styles: { ...totalRowStyle, halign: "right" } },
      { content: "", styles: totalRowStyle },
      { content: "", styles: totalRowStyle },
      { content: formatMoneda(totalConc), styles: { ...totalRowStyle, halign: "right" } },
    ]);

    // Cabeceras y estilos de columna según modo
    const head = esMultipleHDR
      ? [["HDR", "Chofer", "Estado", "Empresa", "Recibo", "Fecha", "Cliente", "Nombre", "Documento", "Tipo", "Observación", "Monto", "Operación conc.", "Doc. conc.", "Importe conc."]]
      : [["Estado", "Empresa", "Recibo", "Fecha", "Cliente", "Nombre", "Documento", "Tipo", "Observación", "Monto", "Operación conc.", "Doc. conc.", "Importe conc."]];

    const colOffset = esMultipleHDR ? 2 : 0;
    const columnStyles: Record<number, any> = {
      [0 + colOffset]: { cellWidth: 14 },   // Estado
      [1 + colOffset]: { cellWidth: 30 },   // Empresa
      [2 + colOffset]: { cellWidth: 14 },   // Recibo
      [3 + colOffset]: { cellWidth: 17 },   // Fecha
      [4 + colOffset]: { cellWidth: 14 },   // Cliente
      [5 + colOffset]: { cellWidth: 28 },   // Nombre
      [6 + colOffset]: { cellWidth: 18 },   // Documento
      [7 + colOffset]: { cellWidth: 10 },   // Tipo
      [8 + colOffset]: { cellWidth: 26 },   // Observación
      [9 + colOffset]: { cellWidth: 20, halign: "right" },  // Monto
      [10 + colOffset]: { cellWidth: 22 }, // Operación conc.
      [11 + colOffset]: { cellWidth: 18 }, // Doc. conc.
      [12 + colOffset]: { cellWidth: 20, halign: "right" }, // Importe conc.
    };
    if (esMultipleHDR) {
      columnStyles[0] = { cellWidth: 14 }; // HDR
      columnStyles[1] = { cellWidth: 20 }; // Chofer
    }

    autoTable(doc, {
      startY: y + 4,
      head,
      body,
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: "bold", fontSize: 6.5 },
      columnStyles,
      didDrawPage: (data) => {
        // Footer en cada página
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Impreso por: ${usuarioStr}  ·  ${fechaHoraStr}`,
          margenIzq,
          pageHeight - 8
        );
        doc.text(
          `Página ${(doc as any).internal.getCurrentPageInfo().pageNumber} de ${doc.getNumberOfPages()}`,
          pageWidth - margenIzq,
          pageHeight - 8,
          { align: "right" }
        );
      },
    });

    // Nombre de archivo
    const fecha = formatFecha(hojaUnica?.fecha) || now.toISOString().slice(0, 10);
    const chofer = (hojaUnica?.chofer || (esMultipleHDR ? "MultiHDR" : "HDR"))
      .replace(/[^a-zA-Z0-9_\-]/g, "_");
    const hdr = hojaUnica?.hoja_ruta || "Recibos";
    doc.save(`Recibos_${hdr}_${fecha}_${chofer}.pdf`);
  }

  // ─── IMPRIMIR con ventana nueva ────────────────────────────────────
  function imprimirVentana() {
    const rows = getRows();
    const now = new Date();
    const fechaHoraStr = now.toLocaleDateString("es-AR") + " " + now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const usuarioStr = user?.nombre || user?.username || "—";

    const estadoLabel: Record<string, string> = { enviado: "Enviado", pendiente: "Pendiente", error: "Error" };

    let hdrInfo = "";
    if (!esMultipleHDR && hojaUnica) {
      hdrInfo = `
        <div class="hdr-meta">
          <span><b>HDR:</b> ${hojaUnica.hoja_ruta}</span>
          <span><b>Fecha:</b> ${formatFecha(hojaUnica.fecha)}</span>
          <span><b>Código:</b> ${hojaUnica.vendedor || "—"}</span>
          <span><b>Chofer:</b> ${hojaUnica.chofer || "—"}</span>
          <span><b>Total cobrado:</b> ${formatMoneda(Number(hojaUnica.total))}</span>
          <span><b>Registros:</b> ${rows.length}</span>
        </div>`;
    } else {
      const totalGeneral = rows.reduce((s, r) => s + Number(r.monto), 0);
      const hdrsStr = hojasSeleccionadas.map((h) => h.hoja_ruta).join(", ");
      hdrInfo = `
        <div class="hdr-meta">
          <span><b>HDRs:</b> ${hdrsStr}</span>
          <span><b>Total cobrado:</b> ${formatMoneda(totalGeneral)}</span>
          <span><b>Registros:</b> ${rows.length}</span>
        </div>`;
    }

    const choferMap = Object.fromEntries(hojasSeleccionadas.map((h) => [h.hoja_ruta, h.chofer || "—"]));
    const totalColspan = esMultipleHDR ? 11 : 9;

    const totalMonto = rows.reduce((s, r) => s + Number(r.monto), 0);
    const totalConc = rows.reduce((s, r) => {
      const c = conciliados[r.valorId];
      return s + (c?.importe ? Number(c.importe) : 0);
    }, 0);

    const tbodyRows = rows.map((r) => {
      const conc = conciliados[r.valorId];
      const estadoColor = r.estado === "enviado" ? "#16a34a" : r.estado === "error" ? "#dc2626" : "#b45309";
      const hojaRuta = (r as any).hojaRuta ?? "";
      const extraCols = esMultipleHDR
        ? `<td>${hojaRuta}</td><td>${choferMap[hojaRuta] ?? "—"}</td>`
        : "";
      return `<tr>
        ${extraCols}
        <td style="color:${estadoColor};font-weight:600">${estadoLabel[r.estado] ?? r.estado}</td>
        <td>${r.empresa_nombre} (${r.empresa_division})</td>
        <td>${r.recibo}</td>
        <td>${formatFecha(r.fecha)}</td>
        <td>${r.clienteId}</td>
        <td>${r.nombre_cliente}</td>
        <td>${r.documento}</td>
        <td>${r.codigo}</td>
        <td>${r.observacion || ""}</td>
        <td class="num">${formatMoneda(r.monto)}</td>
        <td>${conc?.operacion || ""}</td>
        <td>${conc?.documento || ""}</td>
        <td class="num">${conc?.importe ? formatMoneda(Number(conc.importe)) : ""}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Recibos HDR</title>
<style>
  @page {
    size: A4 landscape;
    margin: 1.5cm 1cm 2cm 1cm;
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-size: 8pt; color: #666;
    }
    @bottom-left {
      content: "Impreso por: ${usuarioStr}  ·  ${fechaHoraStr}";
      font-size: 8pt; color: #666;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #111; }
  .hdr-meta {
    display: flex; flex-wrap: wrap; gap: 6px 18px;
    font-size: 8pt; color: #374151;
    border: 1px solid #d1d5db; border-radius: 4px;
    padding: 5px 10px; margin-bottom: 10px; background: #f9fafb;
  }
  table { border-collapse: collapse; width: 100%; table-layout: auto; }
  thead { display: table-header-group; }
  thead tr { background: #e5e7eb; }
  th { border: 1px solid #9ca3af; padding: 3px 5px; font-size: 7.5pt; font-weight: bold; text-align: left; white-space: nowrap; }
  td { border: 1px solid #d1d5db; padding: 2px 5px; font-size: 7.5pt; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fafb; }
  .num { text-align: right; white-space: nowrap; }
  tfoot tr td { border-top: 2px solid #6b7280; font-weight: bold; background: #f3f4f6; }
</style>
</head>
<body>
  ${hdrInfo}
  <table>
    <thead>
      <tr>
        ${esMultipleHDR ? "<th>HDR</th><th>Chofer</th>" : ""}
        <th>Estado</th><th>Empresa</th><th>Recibo</th><th>Fecha</th>
        <th>Cliente</th><th>Nombre</th><th>Documento</th><th>Tipo</th>
        <th>Observación</th><th class="num">Monto</th>
        <th>Operación conc.</th><th>Doc. conc.</th><th class="num">Importe conc.</th>
      </tr>
    </thead>
    <tbody>${tbodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="${totalColspan}" class="num">TOTAL</td>
        <td class="num">${formatMoneda(totalMonto)}</td>
        <td></td><td></td>
        <td class="num">${formatMoneda(totalConc)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) {
      alert("No se pudo abrir la ventana. Permitir ventanas emergentes.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handleEjecutar() {
    if (accion === "pdf") {
      generarPDF();
    } else {
      imprimirVentana();
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>

        <h2 {...handleProps} className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-600" />
          Imprimir detalle HDR
        </h2>

        {/* ── Datos a imprimir ── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos a imprimir</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="todo"
                checked={scope === "todo"}
                onChange={() => setScope("todo")}
                className="accent-blue-600"
              />
              <span>
                Todo
                <span className="ml-1 text-gray-400 text-xs">({datosDG.length} registros)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="visible"
                checked={scope === "visible"}
                onChange={() => setScope("visible")}
                className="accent-blue-600"
              />
              <span>
                Solo visible
                <span className="ml-1 text-gray-400 text-xs">({datosFiltrados.length} registros)</span>
                {datosFiltrados.length === datosDG.length && (
                  <span className="ml-1 text-gray-400 text-xs italic">— sin filtros activos</span>
                )}
              </span>
            </label>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${seleccionados.size === 0 ? "opacity-40 cursor-not-allowed" : ""}`}>
              <input
                type="radio"
                name="scope"
                value="marcados"
                checked={scope === "marcados"}
                onChange={() => setScope("marcados")}
                className="accent-blue-600"
                disabled={seleccionados.size === 0}
              />
              <span>
                Solo registros marcados
                <span className="ml-1 text-gray-400 text-xs">({seleccionados.size} marcados)</span>
                {seleccionados.size === 0 && (
                  <span className="ml-1 text-gray-400 text-xs italic">— ninguno seleccionado</span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* ── Acción ── */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acción</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="accion"
                value="imprimir"
                checked={accion === "imprimir"}
                onChange={() => setAccion("imprimir")}
                className="accent-blue-600"
              />
              <span className="flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-gray-500" />
                Imprimir
                <span className="text-gray-400 text-xs ml-1">— abre diálogo de impresora</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="accion"
                value="pdf"
                checked={accion === "pdf"}
                onChange={() => setAccion("pdf")}
                className="accent-blue-600"
              />
              <span className="flex items-center gap-1">
                <FileDown className="w-3.5 h-3.5 text-gray-500" />
                Guardar PDF
                <span className="text-gray-400 text-xs ml-1">— descarga automática</span>
              </span>
            </label>
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleEjecutar}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            {accion === "pdf"
              ? <><FileDown className="w-4 h-4" /> Guardar PDF</>
              : <><Printer className="w-4 h-4" /> Imprimir</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecibosImprimirModal;
