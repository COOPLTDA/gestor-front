import { Button } from '@/components/ui/button';
import type { RangoVentas } from '@/services/zonificacionApi';
import { exportExcel } from '../lib/exportExcel';
import type { Filtros, Pdv, Zona } from '../types';

interface ExportExcelButtonProps {
  zonas: Zona[];
  currentData: Pdv[];
  allData: Pdv[];
  filtros: Filtros;
  excluidos: Pdv[];
  rangoVentas: RangoVentas;
  onError: (message: string) => void;
  onSuccess: (filename: string) => void;
}

export function ExportExcelButton({ zonas, currentData, allData, filtros, excluidos, rangoVentas, onError, onSuccess }: ExportExcelButtonProps) {
  function handleClick() {
    try {
      const fname = exportExcel({ zonas, currentData, allData, filtros, excluidos, rangoVentas });
      onSuccess(fname);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <Button size="sm" disabled={zonas.length === 0} onClick={handleClick}>
      Exportar Excel
    </Button>
  );
}
