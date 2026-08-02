import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import {
  PresupuestoProvider,
  usePresupuesto
} from "@/contexts/PresupuestoEnroContext";
import { CatalogosProvider, Catalogo } from "@/contexts/CatalogosContext";
import { Button } from "@/components/ui/button";
import PresupuestoEnroTabs from "./PresupuestoEnroTabs";

const MESES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function PresupuestoEnroPage() {
  const { state, dispatch } = usePresupuesto();

  const [loadingInit, setLoadingInit] = useState(true);
  const [tabsPermitidos, setTabsPermitidos] = useState<string[]>([]);
  const [nivelEdicion, setNivelEdicion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [activeValidacionTab, setActiveValidacionTab] = useState<string>("");
  const [vista, setVista] = useState<"preparacion" | "validacion" | "migrar">("preparacion");

  const [catalogosIniciales, setCatalogosIniciales] = useState<Catalogo | null>(null);

  const [exportDialog, setExportDialog] = useState(false);
  const [exportSoloFiltros, setExportSoloFiltros] = useState(true);

  // Selector de período: año + mes
  const [years, setYears]       = useState<number[]>([]);
  const [yearSel, setYearSel]   = useState<number>(0);
  const [monthSel, setMonthSel] = useState<number>(0);

  // Actualiza mesObjetivo en contexto cuando cambia año o mes — solo si ambos están seleccionados
  useEffect(() => {
    if (!yearSel || !monthSel) return;
    const yyyymm = `${yearSel}${String(monthSel).padStart(2, "0")}`;
    dispatch({
      type: "SET_FILTROS",
      payload: { mesObjetivo: yyyymm, proveedor: "", division: "" }
    });
  }, [yearSel, monthSel]);

  // ================= CARGA INICIAL INDEPENDIENTE =================
  // Cada request actualiza su estado al llegar — el más lento (catalogos)
  // no bloquea al resto. Tabs y años son rápidos y aparecen primero.

  useEffect(() => {
    // Tabs — rápido, necesario para mostrar tabs y botón Migrar
    fetchWithAuth(API.PRESUPUESTO_ENRO.TABS)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const tabs = data.data.tabs;
        setTabsPermitidos(tabs);
        setNivelEdicion(data.data.nivelEdicion || null);
        setActiveTab(tabs[0] || "");
        setActiveValidacionTab(tabs[0] || "");
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false));

    // Años — rápido (tabla indexada pequeña)
    fetchWithAuth(API.PRESUPUESTO_ENRO.PERIODOS_ANOS)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success && data.data.years.length > 0) {
          setYears(data.data.years);
        }
      })
      .catch(() => {});

    // Catálogos — lento (clientes/proveedores/etc.), llega después;
    // la página ya es usable sin él hasta que se resuelva
    fetchWithAuth(API.PRESUPUESTO_ENRO.CATALOGOS)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setCatalogosIniciales(data.data);
      })
      .catch(() => {});
  }, []);

  // ================= RENDER =================
  // La página se muestra siempre — el loading es inline, no bloquea

  return (
    <CatalogosProvider initialData={catalogosIniciales}>
      <div className="space-y-6 px-8 pb-8 pt-0 bg-slate-50 min-h-screen">

        {/* ================= PERÍODO ================= */}

        <Card>
          <CardContent className="p-6 flex items-end justify-between gap-6">

            <div className="flex items-end gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Período Objetivo *</label>
                <div className="flex gap-2">
                  <select
                    value={yearSel}
                    onChange={e => setYearSel(Number(e.target.value))}
                    className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={0}>Año</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={monthSel}
                    onChange={e => setMonthSel(Number(e.target.value))}
                    className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={0}>Mes</option>
                    {MESES_ES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* BOTÓN EXPORTAR */}
            {!loadingInit && state.mesObjetivo && activeTab && (
              <Button
                variant="outline"
                onClick={() => {
                  if (vista === "preparacion") {
                    setExportSoloFiltros(true);
                    setExportDialog(true);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent("export-presupuesto", {
                        detail: { nivel: activeValidacionTab }
                      })
                    );
                  }
                }}
              >
                Exportar Excel
              </Button>
            )}

            {/* DIALOG EXPORTAR */}
            {exportDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setExportDialog(false)}
                />
                <div className="relative bg-white rounded-lg shadow-xl p-6 w-96 space-y-5">
                  <h3 className="text-base font-semibold text-slate-800">Exportar Excel</h3>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-700">
                      <input
                        type="radio"
                        name="expScope"
                        className="mt-0.5"
                        checked={exportSoloFiltros}
                        onChange={() => setExportSoloFiltros(true)}
                      />
                      <span>
                        <span className="font-medium">Solo datos filtrados</span>
                        <span className="block text-slate-500 text-xs mt-0.5">
                          Exporta únicamente las zonas, supervisores o vendedores actualmente visibles
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-700">
                      <input
                        type="radio"
                        name="expScope"
                        className="mt-0.5"
                        checked={!exportSoloFiltros}
                        onChange={() => setExportSoloFiltros(false)}
                      />
                      <span>
                        <span className="font-medium">Todos los datos</span>
                        <span className="block text-slate-500 text-xs mt-0.5">
                          Exporta todos los registros ignorando los filtros de columnas
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setExportDialog(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("export-presupuesto", {
                            detail: { nivel: activeTab, soloFiltros: exportSoloFiltros }
                          })
                        );
                        setExportDialog(false);
                      }}
                    >
                      Exportar
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* ================= CONTENIDO ================= */}

        <PresupuestoEnroTabs
          tabsPermitidos={tabsPermitidos}
          nivelEdicion={nivelEdicion}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeValidacionTab={activeValidacionTab}
          setActiveValidacionTab={setActiveValidacionTab}
          vista={vista}
          setVista={setVista}
          loadingInit={loadingInit}
        />

      </div>
    </CatalogosProvider>
  );
}

export default function PresupuestoEnro() {
  return (
    <PresupuestoProvider>
      <PresupuestoEnroPage />
    </PresupuestoProvider>
  );
}
