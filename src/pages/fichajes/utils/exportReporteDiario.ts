import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";

type VendedorReporte = {
  codigoEmpleado: string;
  nombreVendedor: string;
  zona: string;
  primerCheckin:  string | null;
  primerCheckinEsValido: boolean | null;
  primerCheckinValido: string | null;
  ultimoCheckout: string | null;
  minJornada:     number | null;
  minClientes:    number;
  minPromedio:    number | null;
  minPromTraslado: number | null;
  carteraTotal:   number;
  carteraVisitados: number;
  fueraRuta:      number;
  pendientes:     number;
  chkValidos:     number;
  chkInvalidos:   number;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

function fmtMin(m: number | null): string {
  if (m == null || m <= 0) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}min` : `${min} min`;
}

// ─────────────────────────────────────────────────────────────
// GRÁFICO DE BARRAS AGRUPADAS (Canvas 2D nativo)
// ─────────────────────────────────────────────────────────────

function drawBarChart(rows: VendedorReporte[], fecha: string): string {
  const W = 1200, H = 520;
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const MARGIN = { top: 60, right: 30, bottom: 100, left: 55 };
  const chartW = W - MARGIN.left - MARGIN.right;
  const chartH = H - MARGIN.top - MARGIN.bottom;

  // Datos
  const SERIES = [
    { key: "carteraVisitados" as keyof VendedorReporte, label: "Visitados",     color: "#10b981" },
    { key: "fueraRuta"        as keyof VendedorReporte, label: "Fuera de ruta", color: "#3b82f6" },
    { key: "pendientes"       as keyof VendedorReporte, label: "Pendientes",    color: "#f59e0b" },
  ];
  const nVend   = rows.length;
  const nSeries = SERIES.length;
  const groupW  = chartW / nVend;
  const barW    = Math.min(24, (groupW - 10) / nSeries);
  const groupGap = (groupW - barW * nSeries) / 2;
  const maxVal  = Math.max(
    ...rows.flatMap(r => SERIES.map(s => Number(r[s.key] ?? 0))),
    1
  );
  const yScale  = chartH / (maxVal * 1.15);

  // Título
  ctx.fillStyle = "#1f2937";
  ctx.font      = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Clientes por vendedor — ${fecha}`, W / 2, 28);

  // Leyenda
  const legendX = MARGIN.left;
  SERIES.forEach((s, i) => {
    const lx = legendX + i * 160;
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, 42, 14, 10);
    ctx.fillStyle = "#374151";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.label, lx + 18, 52);
  });

  // Ejes
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth   = 1;

  // Gridlines + labels eje Y
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const y    = MARGIN.top + chartH - (i / ticks) * chartH;
    const val  = Math.round((i / ticks) * maxVal * 1.15);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + chartW, y);
    ctx.strokeStyle = i === 0 ? "#9ca3af" : "#e5e7eb";
    ctx.stroke();
    ctx.fillStyle  = "#6b7280";
    ctx.font       = "10px sans-serif";
    ctx.textAlign  = "right";
    ctx.fillText(String(val), MARGIN.left - 6, y + 4);
  }

  // Barras + etiquetas X
  rows.forEach((row, vi) => {
    const gx = MARGIN.left + vi * groupW + groupGap;

    SERIES.forEach((s, si) => {
      const val = Number(row[s.key] ?? 0);
      const bx  = gx + si * barW;
      const bh  = val * yScale;
      const by  = MARGIN.top + chartH - bh;

      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.roundRect?.(bx, by, barW - 2, bh, [2, 2, 0, 0]);
      ctx.fill();

      // Valor encima
      if (val > 0) {
        ctx.fillStyle  = "#374151";
        ctx.font       = "9px sans-serif";
        ctx.textAlign  = "center";
        ctx.fillText(String(val), bx + (barW - 2) / 2, by - 3);
      }
    });

    // Nombre vendedor (rotado 35°)
    const labelX = MARGIN.left + vi * groupW + groupW / 2;
    const labelY = MARGIN.top + chartH + 8;
    ctx.save();
    ctx.translate(labelX, labelY);
    ctx.rotate(Math.PI / 5);
    ctx.fillStyle  = "#374151";
    ctx.font       = "10px sans-serif";
    ctx.textAlign  = "left";
    const name = row.nombreVendedor.length > 18
      ? row.nombreVendedor.slice(0, 18) + "…"
      : row.nombreVendedor;
    ctx.fillText(name, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL("image/png").split(",")[1];
}

// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function exportReporteDiario(params: {
  fecha: string;
  zona: string[];
  supervisor: string[];
  vendedor: string[];
  umbral: string;
}) {
  const { fecha, zona, supervisor, vendedor, umbral } = params;
  const umbralMin = timeToMin(umbral) ?? 525;

  // 1. Fetch data
  const qp = new URLSearchParams({ fecha, umbral });
  if (zona.length)       qp.set("zona",       zona.join(","));
  if (supervisor.length) qp.set("supervisor",  supervisor.join(","));
  if (vendedor.length)   qp.set("vendedor",    vendedor.join(","));

  const res  = await fetchWithAuth(`${API.FICHAJES.ANALYTICS_REPORTE}?${qp}`);
  const json = await res.json() as any;
  if (!json.success) throw new Error(json.message ?? "Error cargando reporte");
  const rows: VendedorReporte[] = json.data;

  if (rows.length === 0) throw new Error("Sin datos para exportar");

  // 2. Generar imagen del gráfico
  const chartBase64 = drawBarChart(rows, fecha);

  // 3. Construir Excel con ExcelJS
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "DistriGestion";

  // ── Hoja de datos ──────────────────────────────────────────
  const ws = wb.addWorksheet("Reporte Diario");

  // Título
  ws.mergeCells("A1:Q1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `Reporte Diario de Fichajes — ${fecha}`;
  titleCell.font  = { bold: true, size: 14, color: { argb: "FF1F2937" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  // Encabezados
  const headers = [
    "Cód", "Vendedor", "Zona", "1er Checkin Válido",
    "1er Checkin", "Último Checkout", "Tiempo Jornada",
    "Tiempo en Clientes", "Prom. x Cliente", "Prom Traslado",
    "Cartera Total", "Visitados Cartera", "Válidos Cartera", "Inválidos Cartera",
    "Fuera de Ruta", "Pendientes", "Total",
  ];

  ws.columns = [
    { key: "cod",         width: 7  },
    { key: "nombre",      width: 28 },
    { key: "zona",        width: 16 },
    { key: "checkinVal",  width: 16 },
    { key: "checkin",     width: 12 },
    { key: "checkout",    width: 14 },
    { key: "jornada",     width: 14 },
    { key: "enCli",       width: 16 },
    { key: "prom",        width: 15 },
    { key: "promTraslado",width: 15 },
    { key: "total",       width: 12 },
    { key: "visit",       width: 10 },
    { key: "chkVal",      width: 12 },
    { key: "chkInval",    width: 13 },
    { key: "fuera",       width: 12 },
    { key: "pend",        width: 10 },
    { key: "totalGral",   width: 10 },
  ];

  const hdrRow = ws.addRow(headers);
  hdrRow.height = 22;
  hdrRow.eachCell((cell, col) => {
    cell.font  = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
    };
  });

  // Datos
  const FILL_ALT = "FFF1F5F9";
  rows.forEach((r, idx) => {
    const totalFila = r.carteraVisitados + r.fueraRuta;
    const row = ws.addRow([
      r.codigoEmpleado,
      r.nombreVendedor,
      r.zona,
      r.primerCheckinValido ?? "—",
      r.primerCheckin  ?? "—",
      r.ultimoCheckout ?? "—",
      fmtMin(r.minJornada),
      fmtMin(r.minClientes),
      fmtMin(r.minPromedio),
      fmtMin(r.minPromTraslado),
      r.carteraTotal,
      r.carteraVisitados,
      r.chkValidos,
      r.chkInvalidos,
      r.fueraRuta,
      r.pendientes,
      totalFila,
    ]);
    row.height = 17;
    const bg = idx % 2 === 0 ? "FFFFFFFF" : FILL_ALT;
    row.eachCell((cell, col) => {
      cell.font      = { size: 9, color: { argb: "FF1F2937" } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", horizontal: col <= 3 ? "left" : "center" };
      cell.border    = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    });
    // Fondo del "1er Checkin Válido" según puntualidad (misma lógica que la vista web)
    if (r.primerCheckinValido) {
      const aTiempo = (timeToMin(r.primerCheckinValido) ?? Infinity) <= umbralMin;
      const cellCheckinValido = row.getCell(4);
      cellCheckinValido.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: aTiempo ? "FFD1FAE5" : "FFFEF3C7" },
      };
      cellCheckinValido.font = {
        size: 9,
        bold: true,
        color: { argb: aTiempo ? "FF065F46" : "FF92400E" },
      };
    }

    // Fondo del "1er Checkin" según validez
    if (r.primerCheckin && r.primerCheckinEsValido != null) {
      const cellCheckin = row.getCell(5);
      cellCheckin.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: r.primerCheckinEsValido ? "FFD1FAE5" : "FFFECACA" },
      };
      cellCheckin.font = {
        size: 9,
        bold: true,
        color: { argb: r.primerCheckinEsValido ? "FF065F46" : "FF991B1B" },
      };
    }

    // Color en columnas numéricas
    const setColor = (colIdx: number, argb: string) => {
      const cell = row.getCell(colIdx);
      cell.font = { size: 9, bold: true, color: { argb } };
    };
    if (r.carteraVisitados > 0) setColor(12, "FF065F46");
    if (r.chkValidos > 0)       setColor(13, "FF065F46");
    if (r.chkInvalidos > 0)     setColor(14, "FFB91C1C");
    if (r.fueraRuta > 0)        setColor(15, "FF1D4ED8");
    if (r.pendientes > 0)       setColor(16, "FF92400E");
  });

  // Fila de totales
  ws.addRow([]);
  const totRow = ws.addRow([
    "", "TOTALES", "",
    "", "", "", "",
    fmtMin(rows.reduce((s, r) => s + r.minClientes, 0)),
    "", "",
    rows.reduce((s, r) => s + r.carteraTotal, 0),
    rows.reduce((s, r) => s + r.carteraVisitados, 0),
    rows.reduce((s, r) => s + r.chkValidos, 0),
    rows.reduce((s, r) => s + r.chkInvalidos, 0),
    rows.reduce((s, r) => s + r.fueraRuta, 0),
    rows.reduce((s, r) => s + r.pendientes, 0),
    rows.reduce((s, r) => s + r.carteraVisitados + r.fueraRuta, 0),
  ]);
  totRow.height = 20;
  totRow.eachCell(cell => {
    cell.font = { bold: true, size: 9, color: { argb: "FF1F2937" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = { top: { style: "medium", color: { argb: "FF9CA3AF" } } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // ── Leyenda de colores ──────────────────────────────────────
  ws.addRow([]);
  const legendTitleRow = ws.addRow(["Referencias"]);
  legendTitleRow.getCell(1).font = { bold: true, size: 10, color: { argb: "FF1F2937" } };

  const legend: { color: string; text: string }[] = [
    { color: "FFD1FAE5", text: "1er Checkin Válido = llegó a tiempo  /  1er Checkin = ese primer checkin fue válido" },
    { color: "FFFEF3C7", text: "1er Checkin Válido = llegó tarde" },
    { color: "FFFECACA", text: "1er Checkin = ese primer checkin fue inválido" },
  ];
  legend.forEach(({ color, text }) => {
    const r = ws.addRow(["", text]);
    r.height = 15;
    const swatch = r.getCell(1);
    swatch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    swatch.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
    r.getCell(2).font = { size: 9, color: { argb: "FF374151" } };
    ws.mergeCells(r.number, 2, r.number, 6);
  });

  const legend2Row = ws.addRow([]);
  legend2Row.height = 4;
  const legendTexto: string[] = [
    "Válidos Cartera (verde): clientes de la cartera visitados con checkin válido.",
    "Inválidos Cartera (rojo): clientes de la cartera visitados, pero con checkin inválido.",
    "Fuera de Ruta (azul): clientes visitados que no pertenecen a la cartera asignada.",
    "Pendientes (marrón): clientes de la cartera que no fueron visitados.",
    "Total = Visitados Cartera + Fuera de Ruta.",
  ];
  legendTexto.forEach(text => {
    const r = ws.addRow(["", text]);
    r.height = 14;
    r.getCell(2).font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
    ws.mergeCells(r.number, 2, r.number, 6);
  });

  // ── Hoja de gráfico ────────────────────────────────────────
  const wsChart = wb.addWorksheet("Gráfico");
  wsChart.mergeCells("A1:M1");
  const chartTitle = wsChart.getCell("A1");
  chartTitle.value = `Distribución de clientes por vendedor — ${fecha}`;
  chartTitle.font  = { bold: true, size: 13, color: { argb: "FF1F2937" } };
  chartTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsChart.getRow(1).height = 26;
  wsChart.addRow([]);

  const imageId = wb.addImage({ base64: chartBase64, extension: "png" });
  wsChart.addImage(imageId, { tl: { col: 0, row: 2 }, ext: { width: 1200, height: 520 } });

  // Ajustar filas para que el gráfico quepa
  for (let i = 3; i < 38; i++) wsChart.getRow(i).height = 15;

  // 4. Descargar
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = `reporte_fichajes_${fecha}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
