import { useState, useRef, useCallback, useEffect } from 'react'

// Búsqueda con debounce genérica: mantiene query/resultados/loading, cancela
// la búsqueda anterior si se escribe de nuevo antes de que dispare, y limpia
// el timer pendiente al desmontar. `searchFn` debe ser una referencia estable
// (función importada a nivel de módulo, no una closure que cambie por render).
export function useDebouncedSearch<T>(searchFn: (query: string) => Promise<T[]>, delayMs = 300) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const search = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 1) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try { setResults(await searchFn(value)) }
      catch { setResults([]) }
      setLoading(false)
    }, delayMs)
  }, [searchFn, delayMs])

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery('')
    setResults([])
  }, [])

  return { query, results, loading, search, clear, setResults }
}
