import { useEffect, useRef, type RefObject } from 'react'

export function useClickAway(ref: RefObject<HTMLElement | null>, onClickAway: () => void) {
  const cb = useRef(onClickAway)
  useEffect(() => { cb.current = onClickAway }, [onClickAway])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref])
}
