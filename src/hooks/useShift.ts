import { useCallback } from 'react';

export interface ShiftContext {
  id: string;
  data: string;
  data_formatada: string;
  hospital: string;
  setor: string | null;
  tipo: string | null;
  status: 'active' | 'finished';
  criado_em: number;
}

export function useShift() {
  const getShift = useCallback((): ShiftContext | null => {
    const raw = localStorage.getItem("da_plantao_ativo");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }, []);

  const getTipo = useCallback((): string | null => {
    return localStorage.getItem("da_tipo_evolucao");
  }, []);

  const clearShift = useCallback(() => {
    localStorage.removeItem("da_plantao_ativo");
    localStorage.removeItem("da_tipo_evolucao");
  }, []);

  const updateShift = useCallback((updates: Partial<ShiftContext>) => {
    const current = getShift();
    if (!current) return;
    const updated = { ...current, ...updates };
    localStorage.setItem("da_plantao_ativo", JSON.stringify(updated));
  }, [getShift]);

  return {
    getShift,
    getTipo,
    clearShift,
    updateShift
  };
}
