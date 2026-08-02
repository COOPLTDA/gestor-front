import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { Search, MinusCircle, X, CheckCircle2} from "lucide-react";


export interface PedidoDetalleItem {
  articuloid: string;
  nombreArticulo: string;
  cantidad: number;
  lista: number;
  descuento: number;
  precio_unitario: number;
  precio_base?: number;
  imp_interno?: number;
  precios?: number[];
  impInternos?: number[];
  ivas?: number[];
  rentabilidad?: number;
  _rowId?: string; 
}



interface PedidoDetalleModalProps {
  pedido: {
    id_pedido: number;
    clienteId: string;
    nombre_cliente: string;
  };
  onClose: () => void;
  onSave: () => void;
}

const defaultItem: PedidoDetalleItem = {
  articuloid: "",
  nombreArticulo: "",
  cantidad: 1,
  lista: 1,
  descuento: 0,
  precio_unitario: 0,
};

function formatCurrency(n: number | string) {
  const num = Number(n);
  if (isNaN(num)) return "-";
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

// ----------- Helper de Artículos (sin cambios relevantes) -----------
// [Mantén igual la lógica de ArticuloHelper]
const ArticuloHelper: React.FC<{
  open: boolean;
  onSelect: (a: any, lista: number) => void;
  onClose: () => void;
}> = ({ open, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [listaSel, setListaSel] = useState(1);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleBuscar() {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/distrigestion/articulos?search=${encodeURIComponent(search)}&lista=${listaSel}`);
      const data = await res.json();
      setArticulos(data.data || []);
    } finally {
      setLoading(false);
    }
  }
  

  useEffect(() => {
    if (!open) return;
    setArticulos([]);
  }, [open]);
  

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative border">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-red-700 font-bold" onClick={onClose}>
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Search className="w-6 h-6" />
          Buscar Artículo
        </h3>
        <div className="flex gap-2 mb-3">
        <input
            className="border px-2 py-2 rounded-lg w-full focus:ring-2 focus:ring-blue-200"
            placeholder="Código, descripción, división, línea, rubro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleBuscar(); }}   // 👈 Buscar con Enter
          />
          <button
            onClick={handleBuscar}                                           // 👈 Botón Buscar
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 font-medium"
          >
            Buscar
          </button>
          <select
            className="border rounded-lg px-2 py-2"
            value={listaSel}
            onChange={e => setListaSel(Number(e.target.value))}
          >
            {[1,2,3,4,5,6].map(n => (
              <option key={n} value={n}>Lista {n}</option>
            ))}
          </select>
        </div>
        <div className="overflow-y-auto max-h-72">
          {loading ? (
            <div className="py-6 text-center text-blue-500">Cargando...</div>
          ) : (
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-center">Código</th>
                  <th className="px-2 py-1 text-center">Descripción</th>
                  <th className="px-2 py-1 text-center">Lista</th>
                  <th className="px-2 py-1 text-center">Precio</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {articulos.map(a => (
                  <tr key={a.articuloid}>
                    <td className="px-2 py-1 text-center">{a.articuloid}</td>
                    <td className="px-2 py-1">{a.nombreArticulo}</td>
                    <td className="px-2 py-1 text-center">#{listaSel}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(a.precios[listaSel-1])}</td>
                    <td>
                      <button
                        className="bg-blue-600 text-white rounded px-2 py-1 text-xs hover:bg-blue-700"
                        onClick={() => onSelect(a, listaSel)}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
                {articulos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-3">No hay coincidencias</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
// ---------------------------------------------------------------------

const columns = [
  { key: "articuloid", label: "Artículo" },
  { key: "nombreArticulo", label: "Descripción" },
  { key: "cantidad", label: "Cant." },
  { key: "lista", label: "Lista" },
  { key: "descuento", label: "Desc %" },
  { key: "precio_unitario", label: "Precio Unit." },
  { key: "total", label: "Total" },
  { key: "rentabilidad", label: "Rent. %" },
];

const PedidoDetalleModal: React.FC<PedidoDetalleModalProps> = ({
  pedido,
  onClose,
  onSave,
}) => {
  const [items, setItems] = useState<PedidoDetalleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nuevo, setNuevo] = useState<PedidoDetalleItem>({ ...defaultItem });
  const [showHelper, setShowHelper] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [preciosArticuloSeleccionado, setPreciosArticuloSeleccionado] = useState<number[]>([]);
  const [impInternosSel, setImpInternosSel] = useState<number[]>([]);
  const [ivasSel, setIvasSel] = useState<number[]>([]);
  const [filtroTabla, setFiltroTabla] = useState("");


    useEffect(() => {
      let cancelado = false;
      async function cargarDetalle() {
        try {
          const res = await fetchWithAuth(`/api/distrigestion/pedidos/${pedido.id_pedido}/detalle`);
          const data = await res.json();
          if (cancelado) return;
    
          const itemsCargados = Array.isArray(data.data) ? data.data : [];
          const itemsConRent = (itemsCargados as PedidoDetalleItem[]).map((it, index) => ({
            ...it,
            _rowId: `${it.articuloid}-${index}`,
            rentabilidad: getItemRentabilidad(it),
          }));                  
          
          setItems(
            [...itemsConRent].sort((a, b) =>
              a.articuloid.localeCompare(b.articuloid)
            )
          );          
        } catch (err) {
          console.error("Error cargando detalle", err);
        } finally {
          if (!cancelado) setLoading(false);
        }
      }
    
      setLoading(true);
      cargarDetalle();
      return () => { cancelado = true; };
    }, [pedido.id_pedido]);
  


  function handleItemChange(
    rowId: string,
    key: keyof PedidoDetalleItem,
    value: string | number
  )   {
  
    // --- Cambio de lista ---
    if (key === "lista") {
      const nuevaLista = Number(value);

      setItems((currs) =>
        currs.map((curr): PedidoDetalleItem => {
          if (curr._rowId !== rowId) return curr;      

          const precios = curr.precios || [];
          const imps = curr.impInternos || [];
          const ivas = curr.ivas || [];
          const tieneListas = Array.isArray(precios) && precios.length >= 7; // incluye lista O

          if (tieneListas) {
            const precio1 = precios[0] || 0;
            const imp1 = imps[0] || 0;

            const precioN = precios[nuevaLista - 1] ?? curr.precio_base ?? 0;
            const impN = imps[nuevaLista - 1] ?? curr.imp_interno ?? 0;
            const ivaN = ivas[nuevaLista - 1] ?? 1.21;

            // Descuento automático
            let descuentoCalculado = 0;
            const base1 = precio1 - imp1;
            const baseN = precioN - impN;
            if (nuevaLista !== 1 && base1 > 0) {
              descuentoCalculado = +(100 - ((baseN * 100) / base1)).toFixed(2);
            }

            // Precio final
            let precioFinal = 0;
            if (impN > 0) {
              precioFinal = ((precioN - impN) * ivaN) + impN;
            } else {
              precioFinal = precioN * ivaN;
            }

            const rentabilidad = getItemRentabilidad({
              ...curr,
              lista: nuevaLista,
              descuento: nuevaLista === 1 ? 0 : descuentoCalculado,
              precios,
              impInternos: imps,
            });

            return {
              ...curr,
              lista: nuevaLista,
              descuento: nuevaLista === 1 ? 0 : descuentoCalculado,
              precio_unitario: precioFinal,
              precio_base: precioN,
              imp_interno: impN,
              rentabilidad,
            };
          }
  
          // Si no tiene listas → fetch
          fetchWithAuth(`/api/distrigestion/articulos?search=${curr.articuloid}`)
            .then((res) => res.json())
            .then((data) => {
              const art = data.data?.find((a: any) => a.articuloid === curr.articuloid);
              if (art && art.precios && art.precios.length >= 7) {
                const precios = art.precios;
                const imps = art.impInternos || [];
                const ivas = art.ivas || [];
  
                const precioN = precios[nuevaLista - 1] ?? 0;
                const impN = imps[nuevaLista - 1] ?? 0;
                const ivaN = ivas[nuevaLista - 1] ?? 1.21;
  
                const base1 = precios[0] - imps[0];
                const baseN = precioN - impN;
                let descuentoCalculado = 0;
                if (nuevaLista !== 1 && base1 > 0) {
                  descuentoCalculado = +(100 - ((baseN * 100) / base1)).toFixed(2);
                }
  
                let precioFinal = 0;
                if (impN > 0) {
                  precioFinal = ((precioN - impN) * ivaN) + impN;
                } else {
                  precioFinal = precioN * ivaN;
                }
  
                const rentabilidad = getItemRentabilidad({
                  ...curr,
                  lista: nuevaLista,
                  precios,
                  impInternos: imps,
                });
  
                setItems((prev) =>
                  prev.map((x) =>
                    x._rowId === curr._rowId
                      ? {
                          ...x,
                          precios,
                          impInternos: imps,
                          ivas,
                          lista: nuevaLista,
                          descuento: nuevaLista === 1 ? 0 : descuentoCalculado,
                          precio_unitario: precioFinal,
                          precio_base: precioN,
                          imp_interno: impN,
                          rentabilidad,
                        }
                      : x
                  )
                );
              }
            });
  
          return { ...curr, lista: nuevaLista, descuento: 0 };
        })
      );
      return;
    }
  
      // --- Cambio de cantidad o descuento ---
      setItems((its) =>
        its.map((it): PedidoDetalleItem => {
          if (it._rowId !== rowId) return it;      

          // --- Cuando cambia el descuento ---
          if (key === "descuento") {
            if (it.lista !== 1) return it; // solo lista 1 editable
            const v = +(Number(value).toFixed(2));
          
            const precioBase = it.precio_base ?? (it.precio_unitario - (it.imp_interno || 0));
            const impInt = it.imp_interno ?? 0;
            const iva = it.ivas?.[it.lista - 1] ?? 1.21;
          
            const precioConDesc = precioBase * (1 - (v || 0) / 100);
            const nuevoPrecioFinal = (precioConDesc * iva) + impInt;
          
            // recalcular rentabilidad actualizada
            const rentabilidad = getItemRentabilidad({
              ...it,
              descuento: v,
            });
          
            return {
              ...it,
              descuento: isNaN(v) ? 0 : v,
              precio_unitario: nuevoPrecioFinal,
              rentabilidad,
            };
          }
          

          // --- Cuando cambia la cantidad ---
          if (key === "cantidad") {
            const nuevaCant = Number(value);
            const rentabilidad = getItemRentabilidad(it);
            return { ...it, cantidad: nuevaCant, rentabilidad };
          }

          return { ...it, [key]: value };
        })
      );


  }
  
  
  
  
  async function handleSave() {
    // 1. Traer los precios faltantes (si corresponde)
    const itemsConPrecios = await Promise.all(
      items.map(async (it) => {
        // Si ya tiene precios, usarlo
        if (Array.isArray(it.precios) && it.precios.length >= 6) {
          return it;
        }
        // Sino, buscar los precios (1 solo fetch por ítem)
        const res = await fetchWithAuth(`/api/distrigestion/articulos?search=${it.articuloid}`);
        const data = await res.json();
        const art = data.data?.find((a: any) => a.articuloid === it.articuloid);
        if (art && art.precios && art.precios.length >= 6) {
          return { ...it, precios: art.precios };
        }
        return it;
      })
    );
  
    // 2. Recalcular el descuento en todos los items con lista ≠ 1
    const itemsAEnviar = itemsConPrecios.map((it) => {
      let rentabilidad = getItemRentabilidad(it);
      if (isNaN(rentabilidad)) rentabilidad = 0;
    
      if (it.lista !== 1 && Array.isArray(it.precios) && it.precios[0]) {
        const precioLista1 = it.precios[0];
        const precioListaActual = it.precios[it.lista - 1];
        let descuentoCalculado = 0;
        if (precioLista1 && precioLista1 > 0) {
          descuentoCalculado = +(100 * (1 - precioListaActual / precioLista1)).toFixed(2);
        }
        return {
          ...it,
          rentabilidad,
          descuento: descuentoCalculado,
        };
      }
    
      return { ...it, rentabilidad };
    });
    

    // 3. Guardar normalmente
    fetchWithAuth(`/api/distrigestion/pedidos/${pedido.id_pedido}/detalle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemsAEnviar, rentabilidadTotal: totalRentabilidad }),
    })
      .then((res) => res.json())
      .then((data) => {
        setShowSuccess(true);
      });

  }
  

  function handleAdd() {
    if (!nuevo.articuloid) return;
    setItems(arr => [
      ...arr,
      { ...nuevo, _rowId: `NEW-${nuevo.articuloid}-${Date.now()}` }
    ]);    
    setNuevo({ ...defaultItem });
    setPreciosArticuloSeleccionado([]);
  }

  function handleRemove(rowId: string) {
    setItems(prev => prev.filter(it => it._rowId !== rowId));
  }  

  function handleHelperSelect(a: any, lista: number) {
    // Traemos base, imp interno e IVA de la lista elegida
    const precioBase = a.precios?.[lista - 1] || 0;          // precio “de lista” (sin IVA, con imp internos aparte)
    const impInt     = a.impInternos?.[lista - 1] || 0;
    const iva        = a.ivas?.[lista - 1] || 1.21;
  
    // Precio final = ((precioBase - impInt) * IVA) + impInt
    const precioFinal = ((precioBase - impInt) * iva) + impInt;
  
    setNuevo({
      articuloid: a.articuloid,
      nombreArticulo: a.nombreArticulo,
      cantidad: 1,
      lista,
      descuento: 0,                          // en lista 1 es editable; en otras listas se calcula aparte pero no se aplica al precio
      precio_unitario: precioFinal,
      precio_base: precioBase,
      imp_interno: impInt,
      precios: a.precios || [],
      impInternos: a.impInternos || [],
      ivas: a.ivas || [],
    });
  
    // Guardamos arrays para la fila de alta (nuevo)
    setPreciosArticuloSeleccionado(a.precios || []);
    setImpInternosSel(a.impInternos || []);
    setIvasSel(a.ivas || []);
  
    setShowHelper(false);
  }
  
  

  const descuentoDisabled = (item: PedidoDetalleItem) => item.lista !== 1;

    // --- Cálculo total del ítem ---
    // Lista 1 → aplica descuento manual sobre el precio base
    // Lista ≠ 1 → muestra descuento automático pero no lo aplica
    const getRowTotal = (it: PedidoDetalleItem) => {
      // --- Obtención de valores base ---
      const precioBase = it.precio_base ?? (it.precio_unitario - (it.imp_interno || 0));
      const impInt = it.imp_interno ?? 0;
      const iva = (it as any).iva ?? 1.21; // fallback

      let precioFinalUnitario = 0;

      if (it.lista === 1) {
          // Lista 1: el precio_unitario ya incluye IVA e impInterno.
          // Solo aplicamos el descuento sobre ese precio final.
          precioFinalUnitario = it.precio_unitario;
        } else {
          // Precio lista N (ya con descuento implícito)
          if (impInt > 0) {
            precioFinalUnitario = ((precioBase - impInt) * iva) + impInt;
          } else {
            precioFinalUnitario = precioBase * iva;
          }
      }
      

        return it.cantidad * precioFinalUnitario;
      };

      // --- Cálculo de rentabilidad por artículo ---
      const getItemRentabilidad = (it: PedidoDetalleItem): number => {
        if (!Array.isArray(it.precios) || it.precios.length < 7) return 0; // debe existir lista O
      
        const listaX = it.lista - 1;
        const precioListaX = it.precios?.[listaX] ?? 0;
        const impX = it.impInternos?.[listaX] ?? 0;
        const precioListaO = it.precios?.[6] ?? 0; // lista O = precio compra
      
        if (precioListaX <= 0) return 0;
      
        // base neta de venta (sin imp interno)
        let baseVenta = precioListaX - impX;
      
        // si es lista 1 y tiene descuento manual, aplicarlo
        if (it.lista === 1 && it.descuento && it.descuento > 0) {
          baseVenta = baseVenta * (1 - it.descuento / 100);
        }
      
        const baseCompra = precioListaO;
        const rent = ((baseVenta - baseCompra) / baseVenta) * 100;
      
        return +rent.toFixed(2);
      };
      



      const total = items.reduce(
        (ac, it) => ac + getRowTotal(it),
        0
      );

        // --- Rentabilidad total del pedido (reactiva) ---
        const totalRentabilidad = React.useMemo(() => {
          const { sumBaseX, sumO } = items.reduce(
            (acc, it) => {
              const precioX = it.precios?.[it.lista - 1] ?? 0;
              const impX    = it.impInternos?.[it.lista - 1] ?? 0;
              const precioO = it.precios?.[6] ?? 0;

              let baseXUnit = Math.max(0, precioX - impX);

              // aplicar descuento si es lista 1
              if (it.lista === 1 && it.descuento && it.descuento > 0) {
                baseXUnit = baseXUnit * (1 - it.descuento / 100);
              }

              // 🔹 usar totales (base * cantidad)
              acc.sumBaseX += baseXUnit * (it.cantidad ?? 1);
              acc.sumO     += Math.max(0, precioO) * (it.cantidad ?? 1);

              return acc;
            },
            { sumBaseX: 0, sumO: 0 }
          );

          return sumBaseX > 0
            ? +(((sumBaseX - sumO) / sumBaseX) * 100).toFixed(2)
            : 0;
        }, [items]);

        // --- Items filtrados para la tabla (solo visual) ---
        const itemsFiltrados = React.useMemo(() => {
          if (!filtroTabla.trim()) return items;

          const f = filtroTabla.toLowerCase();

          return items.filter(it =>
            it.articuloid.toLowerCase().includes(f) ||
            (it.nombreArticulo ?? "").toLowerCase().includes(f)
          );
        }, [items, filtroTabla]);




  const SuccessModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="bg-black/30 absolute inset-0" />
      <div className="bg-white border border-green-200 rounded-2xl shadow-xl p-8 flex flex-col items-center max-w-sm w-full gap-4 z-50">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <h3 className="text-2xl font-semibold text-green-700 text-center">¡Pedido actualizado correctamente!</h3>
        <button
          className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium mt-2 shadow hover:bg-green-700"
          onClick={() => {
            setShowSuccess(false);
            onClose();
            setTimeout(() => onSave(), 120);
          }}
        >
          OK
        </button>
      </div>
    </div>
  );

  // ------------------- RENDER -------------------
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-10 relative border border-blue-100 transition-all animate-fadeIn flex flex-col"
          style={{
            maxHeight: "80vh",
            minWidth: 880,
            justifyContent: "flex-start",
          }}
        >
          <button
            className="absolute top-5 right-5 text-gray-400 hover:text-red-700 font-bold"
            onClick={onClose}
          >
            <X className="w-8 h-8" />
          </button>
          <h2 className="text-3xl font-semibold mb-6 flex items-center gap-3 text-blue-700">
            {/* HEADER DEL MODAL */}
            <div className="mb-4">
              <div className="flex items-center gap-3 text-blue-700">
                <span className="bg-blue-100 rounded-full px-3 py-1 text-sm font-mono">
                  Cliente {pedido.clienteId}
                </span>
                <span className="text-xl font-semibold text-gray-700">
                  {pedido.nombre_cliente}
                </span>
              </div>

              {/* BUSCADOR DE LA TABLA */}
              <div className="mt-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar artículo o descripción..."
                  value={filtroTabla}
                  onChange={(e) => setFiltroTabla(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setFiltroTabla("");
                    }
                  }}
                  className="
                    border rounded-md
                    px-3 py-1.5
                    text-sm
                    w-72
                    focus:ring-2 focus:ring-blue-200
                  "
                />
              </div>
            </div>
          </h2>
          {/* Tabla con columnas ordenables */}
          <div
            className="flex-1 w-full"
            style={{
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="rounded-xl border border-gray-100 shadow-sm mb-4 bg-blue-50/20 flex-1"
              style={{
                overflowY: "auto",
                maxHeight: 336,
                minHeight: 0,
                marginBottom: 0,
              }}
            >
              <table className="min-w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "55px" }} />
                  <col style={{ width: "65px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "90px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-blue-50 text-blue-900">
                    {columns.map(col => (
                      <th
                        key={col.key}
                        className="text-center cursor-pointer select-none group"
                      >
                        <span className="inline-flex items-center">
                          {col.label}
                        </span>
                      </th>
                    ))}
                    <th className="text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && loading && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-blue-600 font-medium">
                        Cargando detalle del pedido...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-gray-500 italic">
                        No hay artículos cargados.
                      </td>
                    </tr>
                  )}
                  {itemsFiltrados.length === 0 && items.length > 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-gray-500 italic">
                        No hay resultados para "{filtroTabla}"
                      </td>
                    </tr>
                  )}
                  {itemsFiltrados.map((it) => (
                    <tr key={it._rowId} className="hover:bg-blue-100/50 transition">
                      <td className="px-1 py-1 text-center">
                        <input value={it.articuloid} className="border rounded px-1 bg-gray-100 w-full text-center" disabled />
                      </td>
                      <td className="px-1 py-1">
                        <input value={it.nombreArticulo || ""} className="border rounded px-1 bg-gray-100 w-full" disabled />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          value={it.cantidad}
                          min={1}
                          className="border rounded px-1 w-full text-center"
                          onChange={(e) =>
                            handleItemChange(it._rowId!, "cantidad", Number(e.target.value))
                          }                                                                          
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <select
                          value={it.lista}
                          onChange={(e) =>
                            handleItemChange(it._rowId!, "lista", Number(e.target.value))
                          }                                                                          
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          value={it.descuento}
                          min={0}
                          max={100}
                          className="border rounded px-1 w-full text-center"
                          onChange={(e) =>
                            handleItemChange(it._rowId!, "descuento", Number(e.target.value))
                          }                          
                          disabled={it.lista !== 1}
                        />
                      </td>
                      <td className="px-1 py-1 text-right">
                        <input
                          value={formatCurrency(it.precio_unitario)}
                          className="border rounded px-1 w-full bg-green-50 text-right font-normal"
                          disabled
                        />
                      </td>
                      <td className="px-1 py-1 text-right font-bold">
                        <span className="block w-full rounded bg-blue-50 px-2 py-0.5 text-right font-bold">
                          {formatCurrency(getRowTotal(it))}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-right text-sm text-blue-700 font-semibold">
                        {Number((it.rentabilidad ?? getItemRentabilidad(it)) || 0).toFixed(2)}%
                      </td>
                      <td className="px-1 py-1 text-center align-middle">
                        <button
                          className="bg-red-600 text-white rounded-full p-1 hover:bg-red-700 flex items-center justify-center mx-auto"
                          onClick={() => handleRemove(it._rowId!)}
                          title="Quitar"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FILA PARA AGREGAR NUEVO ITEM */}
            <div
              className="flex items-center gap-2 px-2 py-2"
              style={{
                background: "#ffe6c4",
                borderRadius: "0 0 16px 16px",
                marginTop: 6,
                marginBottom: 2,
              }}
            >
              <button
                className="text-blue-600 hover:text-blue-900"
                title="Buscar artículo"
                onClick={() => setShowHelper(true)}
                style={{ marginLeft: 0 }}
              >
                <Search className="w-5 h-5" />
              </button>
              <input value={nuevo.articuloid} className="border rounded px-1" style={{ width: 95 }} readOnly />
              <input value={nuevo.nombreArticulo} className="border rounded px-1" style={{ width: 250 }} readOnly />
              <input
                type="number"
                value={nuevo.cantidad}
                min={1}
                className="border rounded px-1 text-center"
                onChange={e => setNuevo(n => ({ ...n, cantidad: Number(e.target.value) }))}
                style={{ width: 48 }}
              />
              <select
                value={nuevo.lista}
                className="border rounded px-1 text-center"
                onChange={e => {
                  const v = Number(e.target.value); // nueva lista
                  setNuevo(n => {
                    // Arrays que guardamos al seleccionar el artículo en el helper
                    const precioBase = preciosArticuloSeleccionado?.[v - 1] ?? n.precio_base ?? 0;
                    const impInt     = impInternosSel?.[v - 1] ?? n.imp_interno ?? 0;
                    const iva        = ivasSel?.[v - 1] ?? 1.21;
                
                    // Descuento automático (si lista != 1):
                    //   100 - (( (precioX - impX) * 100 ) / (precio1 - imp1))
                    let descuentoCalculado = 0;
                    if (v !== 1 && preciosArticuloSeleccionado?.[0]) {
                      const base1 = (preciosArticuloSeleccionado[0] - (impInternosSel?.[0] ?? 0));
                      const baseN = (precioBase - impInt);
                      if (base1 > 0) {
                        descuentoCalculado = +(100 - ((baseN * 100) / base1)).toFixed(2);
                      }
                    }
                
                    //   ((precioX - impX) * IVA) + impX
                    // Precio final a mostrar según imp interno
                    let precioFinal = 0;
                    if (impInt > 0) {
                      precioFinal = ((precioBase - impInt) * iva) + impInt;
                    } else {
                      precioFinal = precioBase * iva;
                    }

                    return {
                      ...n,
                      lista: v,
                      descuento: v !== 1 ? descuentoCalculado : 0,  // si vuelve a 1 => 0
                      precio_unitario: precioFinal,
                      precio_base: precioBase,
                      imp_interno: impInt,
                    };
                  });
                }}
                
                
                style={{ width: 54 }}
              >
                {[1,2,3,4,5,6].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                type="number"
                value={nuevo.descuento}
                min={0}
                max={100}
                step={0.01} // 👈 permite pasos de 0.01 con flechas
                className="border rounded px-1 text-center"
                onChange={e =>
                  setNuevo(n => ({
                    ...n,
                    descuento: +Number(e.target.value).toFixed(2), // 👈 fuerza 2 decimales exactos
                  }))
                }
                style={{ width: 65 }}
                disabled={nuevo.lista !== 1}
              />
              <input
                value={formatCurrency(nuevo.precio_unitario)}
                className="border rounded px-1 bg-green-50 text-right"
                disabled
                style={{ width: 99 }}
              />
              <span
                className="block rounded bg-blue-50 text-right font-bold"
                style={{ width: 108, padding: "4px 8px" }}
              >
                {formatCurrency(
                  nuevo.lista === 1
                    ? nuevo.cantidad * nuevo.precio_unitario * (1 - Number(nuevo.descuento || 0) / 100)
                    : nuevo.cantidad * nuevo.precio_unitario
                )}
              </span>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                onClick={handleAdd}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Footer con total y botones */}
          <div className="flex items-center justify-between w-full mt-2 pt-2" style={{ borderTop: "1px solid #eef2ff" }}>
          <span className="text-xl font-bold text-blue-900">
            Total Pedido: {formatCurrency(total)}
          </span>
          <span className="text-lg font-semibold text-green-700">
            Rentabilidad Total: {totalRentabilidad.toFixed(2)}%
          </span>
            <div className="flex gap-3">
              <button className="bg-gray-300 px-4 py-2 rounded-lg shadow" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow-md hover:bg-blue-700"
                onClick={handleSave}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
          {/* Helper modal */}
          <ArticuloHelper
            open={showHelper}
            onClose={() => setShowHelper(false)}
            onSelect={handleHelperSelect}
          />
        </div>
      </div>
      {showSuccess && <SuccessModal />}
    </>
  );
};

export default PedidoDetalleModal;