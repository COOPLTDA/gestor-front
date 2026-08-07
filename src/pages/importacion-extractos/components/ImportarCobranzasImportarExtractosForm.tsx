// components/tabs/ImportarCobranzasImportarExtractosForm.tsx
import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import type { TipoCobro } from "./ImportarCobranzasTabs";
import { ImportarCobranzasModalSuccess } from "./ImportarCobranzasModalSuccess";
import { ImportarCobranzasModalError } from "./ImportarCobranzasModalError";
import { ImportarCobranzasModalConfirm } from "./ImportarCobranzasModalConfirm";

interface ExisteImportState {
  existe: boolean;
  cantidad: number;
  conciliados: number;
  forzados: number;
}

interface Props {
  tiposCobro: TipoCobro[];
  onAfterImport: (params: { codigo_cobranza: string; fecha: string }) => void;
}

export function ImportarCobranzasImportarExtractosForm({
  tiposCobro,
  onAfterImport,
}: Props) {
  const [tipoImport, setTipoImport] = useState("");
  const [fechaImport, setFechaImport] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [existeImport, setExisteImport] = useState<ExisteImportState>({
    existe: false,
    cantidad: 0,
    conciliados: 0,
    forzados: 0,
  });
  
  const [verificandoExistencia, setVerificandoExistencia] = useState(false);

  const [importando, setImportando] = useState(false);

  // Modales
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Verifica existencia cuando cambia tipo o fecha
  useEffect(() => {
    if (tipoImport && fechaImport) {
      verificarExistencia(tipoImport, fechaImport);
    } else {
      setExisteImport({ existe: false, cantidad: 0, conciliados: 0, forzados: 0 });
    }
  }, [tipoImport, fechaImport]);

  async function verificarExistencia(codigo_cobranza: string, fecha: string) {
    setVerificandoExistencia(true);
    const params = new URLSearchParams({ codigo_cobranza, fecha }).toString();
    const res = await fetchWithAuth(`/api/gestor/extractos/existe?${params}`);
    setVerificandoExistencia(false);

    if (res.success) {
      setExisteImport(res.data || { existe: false, cantidad: 0, conciliados: 0, forzados: 0 });
    } else {
      setExisteImport({ existe: false, cantidad: 0, conciliados: 0, forzados: 0 });
    }
  }

  function onArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMessage("Solo se permiten archivos en formato .xlsx. Guardá el archivo como Excel (xlsx) antes de importar.");
      setErrorOpen(true);
      e.target.value = "";
      return;
    }
    setArchivo(file);
  }

  function handleImportClick() {
    // Validaciones iniciales
    if (!tipoImport || !fechaImport || !archivo) {
      setErrorMessage("Debe seleccionar tipo de cobro, fecha y archivo.");
      setErrorOpen(true);
      return;
    }

    if (existeImport.existe) {
      // Abrimos modal de confirmación
      setConfirmOpen(true);
      return;
    }

    // Si no hay registros previos → importamos directo
    doImport();
  }

  async function doImport() {
    if (!tipoImport || !fechaImport || !archivo) return; // sanity check

    const formData = new FormData();
    formData.append("codigo_cobranza", tipoImport);
    formData.append("fecha", fechaImport);
    formData.append("file", archivo);

    setImportando(true);
    const res = await fetchWithAuth("/api/gestor/extractos/importar", {
      method: "POST",
      body: formData,
    });
    setImportando(false);

    if (!res.success) {
      setErrorMessage(res.message || "Error en la importación");
      setErrorOpen(true);
      return;
    }

    // OK
    setSuccessMessage(res.message || "Importación realizada correctamente");
    setSuccessOpen(true);

    // Aviso al contenedor para refrescar tabla + filtros
    onAfterImport({ codigo_cobranza: tipoImport, fecha: fechaImport });
  }

  function handleConfirmCancel() {
    setConfirmOpen(false);
  }

  function handleConfirmAccept() {
    setConfirmOpen(false);
    doImport();
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold mb-1">
            Tipo de cobro
          </label>
          <select
            className="border rounded-md p-2 w-full text-sm"
            value={tipoImport}
            onChange={(e) => setTipoImport(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {tiposCobro.map((t) => (
              <option key={t.codigo_cobranza} value={t.codigo_cobranza}>
                {t.nombre_cobranza}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Fecha del extracto
          </label>
          <input
            type="date"
            className="border rounded-md p-2 w-full text-sm"
            value={fechaImport}
            onChange={(e) => setFechaImport(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Archivo Excel
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={onArchivoChange}
            className="text-sm"
          />
        </div>
      </div>

      {verificandoExistencia && (
        <p className="text-xs text-muted-foreground">
          Verificando importaciones existentes...
        </p>
      )}

      {existeImport.existe && (
        <p className="text-sm text-orange-700 bg-orange-100 border border-orange-300 rounded-md p-2">
          Ya existen <strong>{existeImport.cantidad}</strong> registros para este
          tipo de cobro y fecha. Si importás nuevamente, se reemplazarán por
          completo.
        </p>
      )}

      {(existeImport.conciliados > 0 || existeImport.forzados > 0) && (
        <p className="text-sm font-bold text-red-700 bg-red-100 border border-red-300 rounded-md p-2 mt-1">
          Existen registros conciliados ({existeImport.conciliados} normal
          {existeImport.forzados > 0 ? `, ${existeImport.forzados} forzado${existeImport.forzados > 1 ? "s" : ""}` : ""}
          ). <strong>La importación no está permitida.</strong>
        </p>
      )}


      <div className="flex justify-end">
        <Button
          onClick={handleImportClick}
          disabled={importando}
          className="inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {importando ? "Importando..." : "Validar e importar"}
        </Button>
      </div>

      {/* Modales */}
      <ImportarCobranzasModalConfirm
        open={confirmOpen}
        title="Reemplazar registros existentes"
        message={`Ya existen ${existeImport.cantidad} registros para ese tipo de cobro y fecha. Si continuás, se eliminarán y se volverán a importar desde el archivo seleccionado.`}
        confirmLabel="Sí, reemplazar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmAccept}
        onCancel={handleConfirmCancel}
      />

      <ImportarCobranzasModalSuccess
        open={successOpen}
        title="Importación exitosa"
        message={successMessage}
        onClose={() => setSuccessOpen(false)}
      />

      <ImportarCobranzasModalError
        open={errorOpen}
        title="Error en la importación"
        message={errorMessage}
        onClose={() => setErrorOpen(false)}
      />
    </div>
  );
}
