import { lazy, Suspense } from "react";
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ROUTES } from "./constants/api";

// ─────────────────────────────────────────
// LAZY LOADING — el bundle inicial carga solo lo necesario
// ─────────────────────────────────────────
const Login                = lazy(() => import("./pages/auth/Login"));
const AppLayout            = lazy(() => import("./components/layout/AppLayout"));
const Dashboard            = lazy(() => import("./pages/Dashboard"));
const Pedidos              = lazy(() => import("./pages/pedidos/Pedidos"));
const PedidosERP           = lazy(() => import("./pages/pedidos/PedidosERP"));
const Usuarios             = lazy(() => import("./pages/usuarios/Usuarios"));
const Roles                = lazy(() => import("./pages/Roles"));
const Reportes             = lazy(() => import("./pages/Reportes"));
const Contactos            = lazy(() => import("./pages/Contactos"));
const Recibos              = lazy(() => import("./pages/recibos/Recibos"));
const Parametros           = lazy(() => import("./pages/Parametros"));
const Importadores         = lazy(() => import("./pages/Importadores"));
const ImportacionExtractos = lazy(() => import("./pages/importacion-extractos/ImportacionExtractos"));
const ResetPassword        = lazy(() => import("./pages/ResetPassword"));
const MobileUsuarios       = lazy(() => import("./pages/mobile/MobileUsuarios"));
const MobileRoles          = lazy(() => import("./pages/mobile/MobileRoles"));
const MobileParametros     = lazy(() => import("./pages/mobile/MobileParametros"));
const Fichajes             = lazy(() => import("./pages/fichajes/Fichajes"));
const Biblia               = lazy(() => import("./pages/biblia/BibliaPage").then(m => ({ default: m.BibliaPage })));
const BibliaReporte        = lazy(() => import("./pages/biblia/reporte/ReportePage").then(m => ({ default: m.ReportePage })));
const BibliaMantenimiento  = lazy(() => import("./pages/biblia/mantenimiento/MantenimientoPage").then(m => ({ default: m.MantenimientoPage })));
const Zonificacion         = lazy(() => import("./pages/zonificacion/ZonificacionPage").then(m => ({ default: m.ZonificacionPage })));

// ─────────────────────────────────────────
// TOASTER
// ─────────────────────────────────────────
import { Toaster } from "@/components/ui/toaster";

// ─────────────────────────────────────────
// ROUTE GUARDS
// ─────────────────────────────────────────
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

const PublicRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isAuthenticated ? <Navigate to={ROUTES.DASHBOARD} replace /> : <Outlet />;
};

// Cache de rutas permitidas para rol 'usuario' (evita re-fetch en cada navegación)
let _cachedRoutes: string[] | null = null;
let _cachedUserId: number | null = null;

// Bloquea acceso a rutas que el usuario no tiene habilitadas
const PermissionRoute = () => {
  const { loading, user } = useAuth();
  const location = useLocation();

  // admin y avanzado tienen acceso completo — no necesitan verificación por ruta
  const isUnrestricted = user?.role === "admin" || user?.role === "avanzado";

  const [allowedRoutes, setAllowedRoutes] = useState<string[] | null>(
    isUnrestricted ? [] : (_cachedUserId === user?.id ? _cachedRoutes : null)
  );

  useEffect(() => {
    if (isUnrestricted || !user) return;
    if (_cachedRoutes !== null && _cachedUserId === user.id) {
      setAllowedRoutes(_cachedRoutes);
      return;
    }
    fetchWithAuth("/api/gestor/menu")
      .then(r => r.json())
      .then((data: any) => {
        if (data.success) {
          const routes: string[] = data.data.flatMap(
            (cat: any) => cat.items.map((item: any) => item.ruta as string)
          );
          _cachedRoutes = routes;
          _cachedUserId = user.id;
          setAllowedRoutes(routes);
        } else {
          setAllowedRoutes([]);
        }
      })
      .catch(() => setAllowedRoutes([]));
  }, [user?.id]);

  if (loading) return <PageLoader />;

  // admin / avanzado: acceso irrestricto
  if (isUnrestricted) return <Outlet />;

  // rol 'usuario': esperar fetch del menú
  if (allowedRoutes === null) return <PageLoader />;

  const path = location.pathname.replace(/\/$/, "");
  if (path === "/app" || path === "/app/dashboard") return <Outlet />;

  const allowed = allowedRoutes.some(
    ruta => ruta && (path === ruta || path.startsWith(ruta + "/"))
  );
  return allowed ? <Outlet /> : <Navigate to={ROUTES.DASHBOARD} replace />;
};

// ─────────────────────────────────────────
// PAGE LOADER
// ─────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─────────────────────────────────────────
// APP
// ─────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Rutas públicas */}
              <Route element={<PublicRoute />}>
                <Route path={ROUTES.LOGIN} element={<Login />} />
              </Route>

              {/* Reset password — accesible sin autenticación */}
              <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />

              {/* Rutas protegidas */}
              <Route path={ROUTES.APP} element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route element={<PermissionRoute />}>
                  <Route index element={<Navigate to="dashboard" replace />} />

                  <Route path="dashboard"             element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="pedidos"               element={<ErrorBoundary><Pedidos /></ErrorBoundary>} />
                  <Route path="pedidos-erp"           element={<ErrorBoundary><PedidosERP /></ErrorBoundary>} />
                  <Route path="usuarios"              element={<ErrorBoundary><Usuarios /></ErrorBoundary>} />
                  <Route path="contactos"             element={<ErrorBoundary><Contactos /></ErrorBoundary>} />
                  <Route path="roles"                 element={<ErrorBoundary><Roles /></ErrorBoundary>} />
                  <Route path="reportes"              element={<ErrorBoundary><Reportes /></ErrorBoundary>} />
                  <Route path="recibos"               element={<ErrorBoundary><Recibos /></ErrorBoundary>} />
                  <Route path="parametros"            element={<ErrorBoundary><Parametros /></ErrorBoundary>} />
                  <Route path="importadores"          element={<ErrorBoundary><Importadores /></ErrorBoundary>} />
                  <Route path="importacion-extractos" element={<ErrorBoundary><ImportacionExtractos /></ErrorBoundary>} />

                  {/* Aliases por compatibilidad */}
                  <Route path="Recibos"               element={<Navigate to="../recibos" replace />} />
                  <Route path="ImportacionExtractos"  element={<Navigate to="../importacion-extractos" replace />} />

                  <Route path="fichajes"              element={<ErrorBoundary><Fichajes /></ErrorBoundary>} />

                  <Route path="biblia"               element={<ErrorBoundary><Biblia /></ErrorBoundary>} />
                  <Route path="biblia/reporte"       element={<ErrorBoundary><BibliaReporte /></ErrorBoundary>} />
                  <Route path="biblia/mantenimiento" element={<ErrorBoundary><BibliaMantenimiento /></ErrorBoundary>} />

                  <Route path="zonificacion"         element={<ErrorBoundary><Zonificacion /></ErrorBoundary>} />

                  {/* Mobile */}
                  <Route path="mobile/usuarios"   element={<ErrorBoundary><MobileUsuarios /></ErrorBoundary>} />
                  <Route path="mobile/roles"      element={<ErrorBoundary><MobileRoles /></ErrorBoundary>} />
                  <Route path="mobile/parametros" element={<ErrorBoundary><MobileParametros /></ErrorBoundary>} />

                  {/* Catch-all dentro de /app */}
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Route>{/* fin PermissionRoute */}
                </Route>
              </Route>

              {/* Redirects globales */}
              <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
            </Routes>
          </Suspense>
        </Router>

        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
