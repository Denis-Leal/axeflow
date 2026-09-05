/**
 * hooks/usePresenca.js — AxeFlow
 * Hook para presença de membros em uma gira.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPresencaMembros, getPresencaMembrosPublica, updatePresencaMembro } from '../services/api';

export function usePresenca(giraId, acesso) {
  const [presencas, setPresencas]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [updating, setUpdating]     = useState({});

  const endpoint = acesso === 'fechada' ? getPresencaMembros : getPresencaMembrosPublica;

  const load = useCallback(async () => {
    if (!giraId || !acesso) return;
    setLoading(true);
    try {
      const res = await endpoint(giraId);
      setPresencas(res.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [giraId, endpoint]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (membroId, status) => {
    setUpdating(prev => ({ ...prev, [membroId]: true }));
    try {
      await updatePresencaMembro(giraId, membroId, status);
      setPresencas(prev => prev.map(m =>
        m.membro_id === membroId ? { ...m, status } : m
      ));
    } finally {
      setUpdating(prev => ({ ...prev, [membroId]: false }));
    }
  }, [giraId]);

  return { presencas, loading, updating, update, reload: load };
}