import React, { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  BarChart3, ShoppingCart, MessageSquare, Shield, TrendingUp, Home, X, Settings,
  ChevronDown, ChevronRight, Target, LucideLayoutDashboard, Repeat, UserPlus, Users,
  RefreshCw, XCircle, Search, Truck, PackageSearch, LayoutDashboard, ShoppingBag,
  Smartphone, Headset, ShieldEllipsis, HandCoins, FileCog, ReceiptCent, BriefcaseIcon,
  ScanFace, UserRoundCheck, BookOpen, Wrench,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

const appName = (import.meta.env.VITE_APP_NAME as string | undefined) || "CoopGestion";
const appNameAccent = appName.slice(-Math.ceil(appName.length / 2));
const appNamePrefix = appName.slice(0, appName.length - appNameAccent.length);

// Convierte kebab-case a PascalCase para que funcionen iconos guardados en la DB
// como "scan-face" o "user-round-check" independientemente del formato.
function kebabToPascal(s: string): string {
  return s.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
}

const ICONS: Record<string, React.ElementType> = {
  BarChart3, ShoppingCart, MessageSquare, Users, Shield, TrendingUp, Home, X,
  Settings, ChevronDown, ChevronRight, Target, LucideLayoutDashboard, Repeat,
  UserPlus, RefreshCw, XCircle, Search, Truck, PackageSearch, LayoutDashboard,
  ShoppingBag, Smartphone, Headset, ShieldEllipsis, HandCoins, FileCog,
  ReceiptCent, BriefcaseIcon, ScanFace, UserRoundCheck, BookOpen, Wrench,
};

function resolveIcon(name: string): React.ElementType {
  return ICONS[name] ?? ICONS[kebabToPascal(name)] ?? Home;
}

interface MenuItem {
  clave: string;
  nombre: string;
  ruta: string;
  icon: string;
}

interface CategoriaMenu {
  clave: string;
  label: string;
  color: string;
  icon: string;
  orden: number;
  items: MenuItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated, loading } = useAuth();
  const [menu, setMenu]         = useState<CategoriaMenu[]>([]);
  const [error, setError]       = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery]       = useState("");
  const location  = useLocation();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const searchRef  = useRef<HTMLInputElement | null>(null);

  // Fetch del menú
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setError("");
        const res = await fetchWithAuth("/api/gestor/menu");
        if (!res.ok) throw new Error("Error cargando menú");
        const json = await res.json();
        setMenu(json.data || []);
      } catch (e: any) {
        setError(e.message);
      }
    };
    if (isAuthenticated) fetchMenu();
  }, [isAuthenticated]);

  // Cierra sidebar al cambiar de ruta
  useEffect(() => {
    onClose();
    setQuery("");
    // eslint-disable-next-line
  }, [location.pathname]);

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const toggleExpand = (clave: string) =>
    setExpanded((prev) => ({ ...prev, [clave]: !prev[clave] }));

  // Resultados filtrados (búsqueda en nombre del item y label de categoría)
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: { item: MenuItem; catLabel: string; catIcon: string }[] = [];
    for (const cat of menu) {
      for (const item of cat.items) {
        if (
          item.nombre.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q)
        ) {
          results.push({ item, catLabel: cat.label, catIcon: cat.icon });
        }
      }
    }
    return results;
  }, [query, menu]);

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Cargando menú...</div>;
  if (error)   return <div className="text-destructive p-4 text-sm">{error}</div>;

  return (
    <aside
      ref={sidebarRef}
      className={`
        fixed z-30 inset-y-0 left-0 w-64 h-screen flex flex-col
        bg-card border-r border-border shadow-md
        transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:shadow-none
      `}
      style={{ minWidth: 256, maxWidth: 256 }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0 relative bg-accent/40">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground leading-none">
          {appNamePrefix}<span className="text-primary">{appNameAccent}</span>
        </h2>
        <p className="font-display text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mt-1.5">
          Sistema Empresarial
        </p>
        <button
          className="absolute top-3 right-3 p-1 rounded-full bg-muted hover:bg-accent lg:hidden"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Buscador */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el menú..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Acceso fijo al Inicio */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0">
        <Link
          to="/app/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            location.pathname === '/app/dashboard'
              ? 'bg-accent text-primary border-l-4 border-primary'
              : 'text-foreground/80 hover:bg-accent/60 hover:text-primary'
          }`}
        >
          <Home className={`w-4 h-4 shrink-0 ${location.pathname === '/app/dashboard' ? 'text-primary' : 'text-muted-foreground'}`} />
          Inicio
        </Link>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">

        {/* ── Resultados de búsqueda ── */}
        {query.trim() ? (
          searchResults.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map(({ item, catLabel, catIcon }) => {
                const ItemIcon = resolveIcon(item.icon);
                const CatIcon  = resolveIcon(catIcon);
                const isActive = location.pathname === item.ruta;
                return (
                  <Link
                    key={item.clave}
                    to={item.ruta}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-accent text-primary font-semibold border-l-4 border-primary"
                        : "hover:bg-accent/60 text-foreground/80 hover:text-primary"
                    }`}
                  >
                    <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className="truncate leading-tight">{item.nombre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CatIcon className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{catLabel}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin resultados</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">"{query}"</p>
            </div>
          )
        ) : (

          /* ── Menú normal (categorías colapsables) ── */
          <div className="space-y-4">
            {menu.map((cat) => {
              const Icon      = resolveIcon(cat.icon);
              const isOpenCat = expanded[cat.clave];
              return (
                <div key={cat.clave}>
                  <button
                    onClick={() => toggleExpand(cat.clave)}
                    className="flex items-center justify-between w-full px-2 py-2 rounded-md hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex items-center">
                      <Icon className="w-4 h-4 mr-2 text-primary" />
                      <span className="font-medium text-foreground text-sm">{cat.label}</span>
                    </div>
                    {isOpenCat
                      ? <ChevronDown  className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>

                  <ul className={`ml-6 mt-1 space-y-1 overflow-hidden transition-all duration-300 ${
                    isOpenCat ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}>
                    {cat.items.map((item) => {
                      const ItemIcon = resolveIcon(item.icon);
                      const isActive = location.pathname === item.ruta;
                      return (
                        <li key={item.clave}>
                          <Link
                            to={item.ruta}
                            className={`flex items-center py-2 px-3 rounded-md text-sm transition-all duration-150 ${
                              isActive
                                ? "bg-accent text-primary font-semibold border-l-4 border-primary"
                                : "hover:bg-accent/60 hover:text-primary text-foreground/80"
                            }`}
                          >
                            <ItemIcon className={`w-4 h-4 mr-2 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            {item.nombre}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
