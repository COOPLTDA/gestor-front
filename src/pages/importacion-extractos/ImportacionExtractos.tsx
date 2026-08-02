// pages/ImportacionExtractos.tsx
import React from "react";
import { ImportarCobranzasTabs } from "./components/ImportarCobranzasTabs";

export default function ImportacionExtractos() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Importación de Extractos Bancarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Importá extractos de cobranzas desde archivos Excel y consultá los movimientos
          ya cargados en el sistema.
        </p>
      </div>

      <ImportarCobranzasTabs />
    </div>
  );
}
