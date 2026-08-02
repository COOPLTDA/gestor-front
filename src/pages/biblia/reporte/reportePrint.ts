import type { GrupoDireccion } from '@/pages/biblia/types/biblia'
import type { ResumenChofer } from '@/services/bibliaApi'
import { formatCurrency } from '@/pages/biblia/utils/bibliaUtils'
import * as XLSX from 'xlsx'

export const printStyles = `
  @page { size: landscape; margin: 8mm; }
  @media print {
    html, body { height: auto; overflow: visible; }
    table { font-size: 10pt !important; width: 100% !important; }
    th { font-size: 9pt !important; padding: 2px 4px !important; }
    td { padding: 1px 4px !important; }
    .print\\:text-xs { font-size: 9pt !important; }
    .print\\:mb-4 { margin-bottom: 2mm !important; }
    .print\\:break-inside-avoid { page-break-inside: avoid; }
    input { border: 0 !important; background: transparent !important; padding: 0 !important; color: #000 !important; }
  }
`

export function handlePrint() {
  window.print()
}

export function handlePrintBiblia(grupos: GrupoDireccion[], subtitulo: string, showDireccion = true) {
  const w = window.open('', '_blank')
  if (!w) return
  const TABLE_HEADER = `<tr><th>NOMBRE FLETERO</th><th>CÓDIGO DE DESPACHO</th><th>N° PREP</th><th>IMPORTE</th><th>CANT. PED.</th><th>CANT. CLI.</th></tr>`
  w.document.write(`
    <html><head><title>Reporte por dirección</title>
    <style>
      @page { size: portrait; margin: 8mm; }
      body { font-family: sans-serif; font-size: 10pt; margin: 0; padding: 8mm; }
      .seccion { padding: 0; }
      .seccion + .seccion { break-before: page; page-break-before: always; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      th { background: #eee; font-size: 8pt; padding: 3px 4px; border: 1px solid #999; text-align: left; }
      td { padding: 2px 4px; border: 1px solid #999; }
      td:last-child, th:last-child { text-align: right; }
      th:nth-child(3) { text-align: center; }
      th:nth-child(4) { text-align: right; }
      .c { text-align: center; }
      .r { text-align: right; }
      .sin-asignar { background: #fdd; }
    </style></head><body>
  `)
  if (!showDireccion) {
    w.document.write(`<div class="seccion">
      <h2 style="margin:0 0 1mm;font-size:12pt;">Reporte personalizado</h2>
      <p style="margin:0 0 4mm;font-size:10pt;color:#555;">${subtitulo}&nbsp;</p>
      <table>${TABLE_HEADER}`)
  }
  for (let gi = 0; gi < grupos.length; gi++) {
    const grupo = grupos[gi]
    if (showDireccion) {
      w.document.write(`<div class="seccion">
        <h2 style="margin:0 0 1mm;font-size:12pt;">${subtitulo}</h2>
        <p style="margin:0 0 4mm;font-size:10pt;color:#555;">${grupo.direccion}</p>
        <table>${TABLE_HEADER}`)
    }
    const sorted = [...grupo.repartos].sort((a, b) => a.chofer_nombre.localeCompare(b.chofer_nombre))
    const choferGrupos: { nombre: string; repartos: typeof sorted }[] = []
    for (const r of sorted) {
      if (!choferGrupos.length || choferGrupos[choferGrupos.length - 1].nombre !== r.chofer_nombre)
        choferGrupos.push({ nombre: r.chofer_nombre, repartos: [r] })
      else
        choferGrupos[choferGrupos.length - 1].repartos.push(r)
    }
    for (const cg of choferGrupos) {
      cg.repartos.forEach((r, i) => {
        const sinAsignar = r.caso === 'sin_asignar'
        w.document.write(`<tr${sinAsignar ? ' class="sin-asignar"' : ''}>
          ${i === 0 ? `<td rowspan="${cg.repartos.length}" style="vertical-align:middle;font-weight:bold;">${cg.nombre}</td>` : ''}
          <td>${r.nombre}</td>
          <td class="c">${r.tipo_agrupa_direccion + r.tipo_consolidado + r.tipo_individual}</td>
          <td class="r">${formatCurrency(r.total_importe)}</td>
          <td class="r">${r.total_pedidos}</td>
          <td>${r.total_clientes}</td>
        </tr>`)
      })
    }
    if (showDireccion) w.document.write('</table></div>')
  }
  if (!showDireccion) w.document.write('</table></div>')
  w.document.write('</body></html>')
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}

export function handlePrintResumen(entries: ResumenChofer[], bibliaFecha: string, tituloCustom?: string) {
  const w = window.open('', '_blank')
  if (!w) return
  const fechaLabel = new Date(bibliaFecha + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const h2Text = tituloCustom ?? `Resumen biblia — ${fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1)}`
  const grandTotal = entries.reduce((s, e) => s + e.total_importe, 0)
  let cardsHtml = ''
  for (const e of entries) {
    const pesoKg = e.total_peso
    const volM3 = e.total_volumen
    const stats = [
      `<span><b>${e.total_pedidos}</b> ped</span>`,
      `<span><b>${e.total_clientes}</b> cli</span>`,
      pesoKg > 0 ? `<span><b>${pesoKg.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> kg</span>` : '',
      volM3 > 0 ? `<span><b>${volM3.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b> m³</span>` : '',
    ].filter(Boolean).join('')
    const codigos = e.codigos_despacho.map(c => `<span class="cod">${c}</span>`).join('')
    const prepsHtml = e.preps.map(p =>
      `<div class="prep-row"><span class="dot estado-${(p.estado ?? '').replace(/ /g, '-')}"></span><span class="prep-cod">${p.codigo_envio ?? `#${p.id}`}</span><span class="prep-imp">${formatCurrency(p.importe_total)}</span></div>`
    ).join('')
    cardsHtml += `<div class="card">
      <div class="card-header"><div><div class="chofer-nombre">${e.chofer_nombre}</div><div class="chofer-codigo">${e.chofer_codigo}</div></div><span class="badge">${e.preps.length}p</span></div>
      <div class="importe">${formatCurrency(e.total_importe)}</div>
      <div class="stats">${stats}</div>
      ${e.codigos_despacho.length > 0 ? `<div class="codigos">${codigos}</div>` : ''}
      <div class="preps">${prepsHtml}</div>
    </div>`
  }
  w.document.write(`<html><head><title>Resumen biblia — ${fechaLabel}</title><style>
    @page{size:landscape;margin:8mm}body{font-family:sans-serif;font-size:9pt;margin:0;padding:4mm}
    h2{margin:0 0 1mm;font-size:11pt}p{margin:0 0 3mm;font-size:9pt;color:#555}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
    .card{border:1px solid #ccc;border-radius:4px;padding:6px;break-inside:avoid}
    .card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px}
    .chofer-nombre{font-weight:bold;font-size:8.5pt}.chofer-codigo{font-size:7pt;color:#999;font-family:monospace}
    .badge{font-size:7pt;background:#f0f0f0;color:#666;padding:1px 4px;border-radius:8px}
    .importe{font-size:11pt;font-weight:bold;color:#16803b;margin:2px 0}
    .stats{display:flex;flex-wrap:wrap;gap:4px;font-size:7.5pt;color:#666;margin-bottom:3px}.stats b{color:#333}
    .codigos{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:3px}
    .cod{font-family:monospace;font-size:7pt;background:#e8f0fe;color:#1a56db;padding:1px 3px;border-radius:2px}
    .preps{border-top:1px solid #eee;padding-top:3px}
    .prep-row{display:flex;align-items:center;gap:4px;font-size:7.5pt;margin-bottom:1px}
    .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#aaa}
    .estado-pendiente{background:#94a3b8}.estado-en-preparacion{background:#f59e0b}
    .estado-completada,.estado-completo{background:#10b981}.estado-remitido{background:#0ea5e9}.estado-eliminado{background:#ef4444}
    .prep-cod{font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .prep-imp{font-weight:500;white-space:nowrap}
  </style></head><body>
  <h2>${h2Text}</h2>
  <p>${entries.length} chofer${entries.length !== 1 ? 'es' : ''} · ${formatCurrency(grandTotal)}</p>
  <div class="grid">${cardsHtml}</div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}

export function handleExportExcel(grupos: GrupoDireccion[], fecha: string, formato: 'actual' | 'biblia', showDireccion = true) {
  let HEADERS: string[]
  let data: unknown[][]
  let colWidths: { wch: number }[]
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  if (formato === 'biblia') {
    HEADERS = ['NOMBRE FLETERO', 'CÓDIGO DE DESPACHO', 'N° PREP', 'IMPORTE', 'CANT. PED.', 'CANT. CLI.']
    data = [HEADERS]
    let rowIdx = 1 // fila 0 = headers
    for (const grupo of grupos) {
      if (showDireccion) { data.push([]); rowIdx++; data.push([grupo.direccion, '', '', '', '', '']); rowIdx++ }
      const sorted = [...grupo.repartos].sort((a, b) => a.chofer_nombre.localeCompare(b.chofer_nombre))
      let prevChofer = ''
      let choferStart = rowIdx
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i]
        const firstDeChofer = r.chofer_nombre !== prevChofer
        if (firstDeChofer && i > 0) {
          if (rowIdx - 1 > choferStart) merges.push({ s: { r: choferStart, c: 0 }, e: { r: rowIdx - 1, c: 0 } })
          choferStart = rowIdx
        }
        prevChofer = r.chofer_nombre
        data.push([
          firstDeChofer ? r.chofer_nombre : '',
          r.nombre,
          r.tipo_agrupa_direccion + r.tipo_consolidado + r.tipo_individual,
          r.total_importe,
          r.total_pedidos,
          r.total_clientes,
        ])
        rowIdx++
      }
      if (rowIdx - 1 > choferStart) merges.push({ s: { r: choferStart, c: 0 }, e: { r: rowIdx - 1, c: 0 } })
    }
    colWidths = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
  } else {
    HEADERS = ['NOMBRE FLETERO', 'NRO', 'CÓDIGO DE DESPACHO', 'AGRUP. DIR.', 'CONSOLIDADO', 'INDIVIDUAL', 'IMPORTE', 'CANT. PED.', 'CANT. CLIENTES']
    data = [HEADERS]
    for (const grupo of grupos) {
      data.push([])
      data.push(['', '', grupo.direccion, '', '', '', '', '', ''])
      for (const r of grupo.repartos) {
        data.push([r.chofer_nombre, r.codigo_numerico, r.nombre, r.tipo_agrupa_direccion, r.tipo_consolidado, r.tipo_individual, r.total_importe, r.total_pedidos, r.total_clientes])
      }
    }
    colWidths = [{ wch: 22 }, { wch: 8 }, { wch: 26 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 14 }, { wch: 12 }, { wch: 15 }]
  }

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = colWidths
  if (formato === 'biblia' && merges.length > 0) ws['!merges'] = merges
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Reporte ${fecha}`)
  XLSX.writeFile(wb, `reporte-por-direccion-${fecha}-${formato === 'biblia' ? 'biblia' : 'actual'}.xlsx`)
}

export function handleExportExcelResumen(entries: ResumenChofer[], titulo: string, fecha: string) {
  const HEADERS = ['CHOFER', 'CÓDIGO', 'PREPS', 'IMPORTE', 'PEDIDOS', 'CLIENTES', 'PESO (kg)', 'VOLUMEN (m³)', 'CÓDIGOS DE DESPACHO']
  const data: unknown[][] = [HEADERS]
  for (const e of entries) {
    data.push([
      e.chofer_nombre,
      e.chofer_codigo,
      e.preps.length,
      e.total_importe,
      e.total_pedidos,
      e.total_clientes,
      e.total_peso,
      e.total_volumen,
      e.codigos_despacho.join(', '),
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 7 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
  XLSX.writeFile(wb, `reporte-resumen-${fecha}.xlsx`)
}
