import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para hacer draggable cualquier modal.
 * - `style`       → aplicar al contenedor del modal custom (fixed+flex)
 * - `dialogStyle` → aplicar al <DialogContent> de Radix (sobreescribe su translate -50%)
 * - `handleProps` → esparcir en el elemento que actúa de agarradera (title / header)
 *
 * Cuando `open` pasa a false el modal vuelve al centro.
 */
export function useDraggable(open?: boolean) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });

  // Mantener ref sincronizado con state (para onMouseDown estable)
  useEffect(() => { posRef.current = pos; }, [pos]);

  // Resetear al cerrar
  useEffect(() => {
    if (open === false) setPos({ x: 0, y: 0 });
  }, [open]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Solo botón primario; ignorar clics en botones / inputs dentro del header
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a")) return;

    e.preventDefault();
    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;

    const onMove = (ev: MouseEvent) => {
      setPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return {
    /** Para modal custom (centrado por flex) */
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` } as React.CSSProperties,
    /** Para DialogContent de Radix (centrado por translate-50%) */
    dialogStyle: {
      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
    } as React.CSSProperties,
    /** Esparcir en el handle: onMouseDown + cursor move */
    handleProps: {
      onMouseDown,
      style: { cursor: "move", userSelect: "none" } as React.CSSProperties,
      title: "Arrastrá para mover",
    },
  };
}
