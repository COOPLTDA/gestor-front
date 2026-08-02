import React, { useState } from "react";
import * as XLSX from "xlsx";
import { X, FileDown, FileText } from "lucide-react";

import type { HojaRuta } from "../Recibos";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

/* ================================================================
   ✅ Definimos el type acá — Ya no depende de Recibos.ts
================================================================ */
export interface ResumenHDRData {
  tipos: string[];
  empresas: string[];
  divisionesPorEmpresa: Record<string, string[]>;
  tipoNombres: Record<string, string>;
  matrizEmpresa: Record<string, Record<string, number>>;
  matrizEmpresaDivision: Record<string, Record<string, number>>;
  totalGeneral: number;
}

interface Props {
  onClose: () => void;
  hojaSeleccionada: HojaRuta | null;
  resumenHDR: ResumenHDRData | null;
  formatMoneda: (n: number) => string;
}

const RecibosResumenHDR: React.FC<Props> = ({
  onClose,
  hojaSeleccionada,
  resumenHDR,
  formatMoneda,
}) => {
  const [expandido, setExpandido] = useState(false);
  useModalEscClose(true, onClose);
  const { style, handleProps } = useDraggable();
  if (!resumenHDR) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 text-center">
          <h2 {...handleProps} className="text-lg font-bold mb-4 flex items-center gap-2 justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
            {hojaSeleccionada?.hoja_ruta || ""} — Cargando resumen…
          </h2>

          <p className="text-gray-600 mb-4">
            Obteniendo datos del HDR para generar el resumen.
          </p>

          <button
            onClick={onClose}
            className="mt-3 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const getNombreTipo = (codigo: string): string =>
    resumenHDR.tipoNombres[codigo.trim().toUpperCase()] || codigo;

  const exportarXLSX = () => {
    const rows: any[] = [];

    if (!expandido) {
      resumenHDR.tipos.forEach((tipo: string) => {
        const fila: any = {
          "Tipo de Cobro": getNombreTipo(tipo),
        };

        let totalTipo = 0;
        resumenHDR.empresas.forEach((emp: string) => {
          const v = resumenHDR.matrizEmpresa[tipo][emp] || 0;
          fila[emp] = v;
          totalTipo += v;
        });

        fila["Total Tipo Cobr."] = totalTipo;
        rows.push(fila);
      });

      const totalRow: any = { "Tipo de Cobro": "TOTAL HDR" };
      resumenHDR.empresas.forEach((emp: string) => {
        const totalCol = resumenHDR.tipos.reduce(
          (acc: number, tipo: string) =>
            acc + (resumenHDR.matrizEmpresa[tipo][emp] || 0),
          0
        );
        totalRow[emp] = totalCol;
      });
      totalRow["Total Tipo Cobr."] = resumenHDR.totalGeneral;
      rows.push(totalRow);
    } else {
      resumenHDR.tipos.forEach((tipo: string) => {
        const fila: any = {
          "Tipo de Cobro": getNombreTipo(tipo),
        };

        let totalTipo = 0;
        resumenHDR.empresas.forEach((emp: string) => {
          const divs = resumenHDR.divisionesPorEmpresa[emp] || [];
          let totalEmp = 0;

          divs.forEach((div: string) => {
            const key = `${emp}|||${div}`;
            const v = resumenHDR.matrizEmpresaDivision[tipo]?.[key] || 0;
            fila[`${emp} - ${div}`] = v;
            totalEmp += v;
          });

          fila[`${emp} - TOTAL`] = totalEmp;
          totalTipo += totalEmp;
        });

        fila["Total Tipo Cobr."] = totalTipo;
        rows.push(fila);
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen HDR");

    XLSX.writeFile(
      wb,
      `Resumen_HDR_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 relative overflow-auto max-h-[85vh]">

        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div {...handleProps} className="flex items-center mb-4 justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {hojaSeleccionada?.hoja_ruta} —{" "}
            {hojaSeleccionada?.fecha?.slice(0, 10)} — {hojaSeleccionada?.vendedor} {hojaSeleccionada?.chofer}
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => setExpandido((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              {expandido ? "Ver por empresa" : "Ver por división"}
            </button>

            <button
              onClick={exportarXLSX}
              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700"
            >
              <FileDown className="w-4 h-4" /> Exportar XLSX
            </button>
          </div>
        </div>

        {/* TABLA */}
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">

          {!expandido ? (
            <table className="w-full table-auto text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-center">
                  <th className="border px-3 py-2 text-left">Tipo de Cobro</th>
                  {resumenHDR.empresas.map((emp: string) => (
                    <th key={emp} className="border px-2 py-2">
                      {emp}
                    </th>
                  ))}
                  <th className="border px-2 py-2 bg-gray-50">Tot. Tipo Cobr.</th>
                </tr>
              </thead>

              <tbody>
                {resumenHDR.tipos.map((tipo: string) => {
                  const totalTipo = resumenHDR.empresas.reduce(
                    (acc: number, emp: string) =>
                      acc + (resumenHDR.matrizEmpresa[tipo][emp] || 0),
                    0
                  );

                  return (
                    <tr key={tipo}>
                      <td className="border px-3 py-1.5">{getNombreTipo(tipo)}</td>

                      {resumenHDR.empresas.map((emp: string) => (
                        <td key={emp} className="border px-2 py-1.5 text-right">
                          {formatMoneda(
                            resumenHDR.matrizEmpresa[tipo][emp] || 0
                          )}
                        </td>
                      ))}

                      <td className="border px-3 py-1.5 text-right font-bold text-blue-700">
                        {formatMoneda(totalTipo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* FOOTER */}
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border px-3 py-1.5 text-right">TOTAL HDR</td>

                  {resumenHDR.empresas.map((emp: string) => {
                    const totalCol = resumenHDR.tipos.reduce(
                      (acc: number, tipo: string) =>
                        acc + (resumenHDR.matrizEmpresa[tipo][emp] || 0),
                      0
                    );

                    return (
                      <td
                        key={emp}
                        className="border px-2 py-1.5 text-right text-green-700"
                      >
                        {formatMoneda(totalCol)}
                      </td>
                    );
                  })}

                  <td className="border px-3 py-1.5 text-right text-green-700">
                    {formatMoneda(resumenHDR.totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            /*  VISTA EXPANDIDA */
            <table className="w-full table-auto text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-center">
                  <th rowSpan={2} className="border px-3 py-2 text-left">
                    Tipo de Cobro
                  </th>

                  {resumenHDR.empresas.map((emp: string) => {
                    const divs = resumenHDR.divisionesPorEmpresa[emp] || [];
                    return (
                      <th
                        key={emp}
                        colSpan={divs.length}
                        className="border px-2 py-2"
                      >
                        {emp}
                      </th>
                    );
                  })}

                  <th rowSpan={2} className="border px-2 py-2 bg-gray-50">
                    Tot. Tipo Cobr.
                  </th>
                </tr>

                <tr className="bg-gray-50 text-center">
                  {resumenHDR.empresas.flatMap((emp: string) =>
                    (resumenHDR.divisionesPorEmpresa[emp] || []).map(
                      (div: string) => (
                        <th key={`${emp}-${div}`} className="border px-2 py-1.5">
                          {div}
                        </th>
                      )
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {resumenHDR.tipos.map((tipo: string) => {
                  let totalTipo = 0;

                  return (
                    <tr key={tipo}>
                      <td className="border px-3 py-1.5">
                        {getNombreTipo(tipo)}
                      </td>

                      {resumenHDR.empresas.map((emp: string) => {
                        const divs = resumenHDR.divisionesPorEmpresa[emp] || [];
                        return divs.map((div: string) => {
                          const key = `${emp}|||${div}`;
                          const v =
                            resumenHDR.matrizEmpresaDivision[tipo]?.[key] || 0;
                          totalTipo += v;

                          return (
                            <td
                              key={`${tipo}-${emp}-${div}`}
                              className="border px-2 py-1.5 text-right"
                            >
                              {formatMoneda(v)}
                            </td>
                          );
                        });
                      })}

                      <td className="border px-3 py-1.5 text-right font-bold text-blue-700">
                        {formatMoneda(totalTipo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border px-3 py-1.5 text-right">TOTAL HDR</td>

                  {resumenHDR.empresas.flatMap((emp: string) =>
                    (resumenHDR.divisionesPorEmpresa[emp] || []).map(
                      (div: string) => {
                        const key = `${emp}|||${div}`;
                        const totalDiv = resumenHDR.tipos.reduce(
                          (acc: number, tipo: string) =>
                            acc +
                            (resumenHDR.matrizEmpresaDivision[tipo]?.[key] ||
                              0),
                          0
                        );

                        return (
                          <td
                            className="border px-2 py-1.5 text-right text-green-700"
                            key={`TOTAL-${emp}-${div}`}
                          >
                            {formatMoneda(totalDiv)}
                          </td>
                        );
                      }
                    )
                  )}

                  <td className="border px-3 py-1.5 text-right text-green-800">
                    {formatMoneda(resumenHDR.totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecibosResumenHDR;
