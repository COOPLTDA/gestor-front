import { useEffect, useRef, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs";
import { Maximize2, Minimize2 } from "lucide-react";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";

import EmpresaTab from "./components/EmpresaTab";
import ZonaTab from "./components/ZonaTab";
import SupervisorTab from "./components/SupervisorTab";
import VendedorTab from "./components/VendedorTab";
import ClienteTab from "./components/ClienteTab";
import ValidacionNivelTab from "./components/ValidacionNivelTab";
import MigrarObjetivosView from "./components/MigrarObjetivosView";

const JERARQUIA = ["empresa", "zona", "supervisor", "vendedor", "cliente"];

function canEdit(nivel: string, nivelEdicion: string | null): boolean {
  if (!nivelEdicion) return false;
  return JERARQUIA.indexOf(nivel) >= JERARQUIA.indexOf(nivelEdicion);
}

/* ===================================================== */
/* ================= PREPARACIÓN ======================= */
/* ===================================================== */

function PreparacionTabs({
  nivelEdicion,
  activeTab,
  setActiveTab
}: {
  nivelEdicion: string | null;
  activeTab: string;
  setActiveTab: (v: string) => void;
}) {
  const { state, dispatch } = usePresupuesto();
  const fullscreen = state.fullscreen;

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "SET_FULLSCREEN", payload: false });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, dispatch]);

  return (
    <>
      {fullscreen && (
        <button
          onClick={() => dispatch({ type: "SET_FULLSCREEN", payload: false })}
          title="Salir de pantalla completa (Esc)"
          className="fixed top-3 right-4 z-[70] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 shadow"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-2">
          <TabsList className="bg-white shadow-sm border p-1 rounded-lg">

            {JERARQUIA.map(nivel => (
              <TabsTrigger
                key={nivel}
                value={nivel}
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow"
              >
                {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                {!canEdit(nivel, nivelEdicion) && nivelEdicion && (
                  <span className="ml-1 text-[10px] opacity-50" title="Solo lectura">🔒</span>
                )}
              </TabsTrigger>
            ))}

          </TabsList>

          {!fullscreen && (
            <button
              onClick={() => dispatch({ type: "SET_FULLSCREEN", payload: true })}
              title="Pantalla completa"
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <TabsContent value="empresa">
          <EmpresaTab readonly={!canEdit("empresa", nivelEdicion)} />
        </TabsContent>
        <TabsContent value="zona">
          <ZonaTab readonly={!canEdit("zona", nivelEdicion)} />
        </TabsContent>
        <TabsContent value="supervisor">
          <SupervisorTab readonly={!canEdit("supervisor", nivelEdicion)} />
        </TabsContent>
        <TabsContent value="vendedor">
          <VendedorTab readonly={!canEdit("vendedor", nivelEdicion)} />
        </TabsContent>
        <TabsContent value="cliente">
          <ClienteTab readonly={!canEdit("cliente", nivelEdicion)} />
        </TabsContent>

      </Tabs>
    </>
  );
}

/* ===================================================== */
/* ================= VALIDACIÓN ======================== */
/* ===================================================== */

function ValidacionTabs({
  nivelEdicion,
  activeValidacionTab,
  setActiveValidacionTab
}: {
  nivelEdicion: string | null;
  activeValidacionTab: string;
  setActiveValidacionTab: (v: string) => void;
}) {

  return (
    <Tabs
      value={activeValidacionTab}
      onValueChange={setActiveValidacionTab}
    >
      <TabsList className="bg-white shadow-sm border p-1 rounded-lg">

        {JERARQUIA.map(nivel => (
          <TabsTrigger
            key={nivel}
            value={nivel}
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
            {!canEdit(nivel, nivelEdicion) && nivelEdicion && (
              <span className="ml-1 text-[10px] opacity-50" title="Solo lectura">🔒</span>
            )}
          </TabsTrigger>
        ))}

      </TabsList>

      {JERARQUIA.map(nivel => (
        <TabsContent key={nivel} value={nivel}>
          <ValidacionNivelTab nivel={nivel} />
        </TabsContent>
      ))}

    </Tabs>
  );
}

/* ===================================================== */
/* ================= CONTENEDOR ======================== */
/* ===================================================== */

export default function PresupuestoEnroTabs({
  tabsPermitidos,
  nivelEdicion,
  activeTab,
  setActiveTab,
  activeValidacionTab,
  setActiveValidacionTab,
  vista,
  setVista,
  loadingInit
}: {
  tabsPermitidos: string[];
  nivelEdicion: string | null;
  activeTab: string;
  setActiveTab: (v: string) => void;
  activeValidacionTab: string;
  setActiveValidacionTab: (v: string) => void;
  vista: "preparacion" | "validacion" | "migrar";
  setVista: (v: "preparacion" | "validacion" | "migrar") => void;
  loadingInit: boolean;
}) {
  const { state } = usePresupuesto();
  const puedeMigrar = true;

  const prevMesRef = useRef<string>("");
  const [periodoLoading, setPeriodoLoading] = useState(false);

  useEffect(() => {
    if (state.mesObjetivo && state.mesObjetivo !== prevMesRef.current) {
      prevMesRef.current = state.mesObjetivo;
      setPeriodoLoading(true);
    }
  }, [state.mesObjetivo]);

  useEffect(() => {
    const handler = () => setPeriodoLoading(false);
    window.addEventListener("presupuesto-tab-loaded", handler);
    return () => window.removeEventListener("presupuesto-tab-loaded", handler);
  }, []);

  return (
    <div className="space-y-6">

      {/* ================= TABS PRINCIPALES ================= */}

      <div className="flex border-b border-slate-300">

        <button
          onClick={() => setVista("preparacion")}
          className={`px-6 py-3 text-sm font-semibold transition
            ${vista === "preparacion"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-600 hover:text-slate-900"
            }`}
        >
          Preparación
        </button>

        <button
          onClick={() => setVista("validacion")}
          className={`px-6 py-3 text-sm font-semibold transition
            ${vista === "validacion"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-600 hover:text-slate-900"
            }`}
        >
          Validación
        </button>

        {puedeMigrar && (
          <button
            onClick={() => setVista("migrar")}
            className={`px-6 py-3 text-sm font-semibold transition
              ${vista === "migrar"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            Migrar Objetivos
          </button>
        )}

      </div>

      {/* ================= CONTENIDO ================= */}

      {vista === "migrar" && puedeMigrar && (
        <MigrarObjetivosView />
      )}

      {vista !== "migrar" && !state.mesObjetivo && (
        <div className="bg-white rounded-lg border shadow-sm p-10 text-center text-muted-foreground">
          Seleccione un período para comenzar.
        </div>
      )}

      {vista !== "migrar" && state.mesObjetivo && (
        <>
          {periodoLoading && (
            <div className="bg-white rounded-lg border shadow-sm p-10 flex flex-col items-center justify-center gap-4 text-slate-500">
              <span className="text-sm font-medium">Cargando datos...</span>
              <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-blue-500 rounded-full animate-progress" />
              </div>
            </div>
          )}

          <div className={periodoLoading ? "hidden" : ""}>
            {vista === "preparacion" && (
              <PreparacionTabs
                nivelEdicion={nivelEdicion}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}

            {vista === "validacion" && (
              <ValidacionTabs
                nivelEdicion={nivelEdicion}
                activeValidacionTab={activeValidacionTab}
                setActiveValidacionTab={setActiveValidacionTab}
              />
            )}

          </div>
        </>
      )}

    </div>
  );
}
