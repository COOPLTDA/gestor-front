import { useEffect, useState } from 'react';
import { fetchPdv, type RangoVentas } from '@/services/zonificacionApi';
import type { Pdv } from '../types';

export function usePdvData(rango: RangoVentas) {
  const [data, setData] = useState<Pdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPdv(rango)
      .then((pdv) => { if (!cancelled) setData(pdv); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango.desde, rango.hasta]);

  return { data, loading, error };
}
