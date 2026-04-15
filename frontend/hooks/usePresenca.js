/**
 * hooks/usePresenca.js — AxeFlow
 * Hook para presença de membros em uma gira.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function usePresenca(giraId, acesso) {
  const [presencas, setPresencas]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [updating, setUpdating]     = useState({});

  const endpoint = acesso === 'fechada'
    ? `/membros/giras/${giraId}/presenca-membros`
    : `/membros/giras/${giraId}/presenca-membros-publica`;

  const load = useCallback(async () => {
    if (!giraId) return;
    setLoading(true);
    try {
      const res = await api.get(endpoint);
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
      await api.post(`/membros/giras/${giraId}/presenca-membros/${membroId}`, { status });
      setPresencas(prev => prev.map(m =>
        m.membro_id === membroId ? { ...m, status } : m
      ));
    } finally {
      setUpdating(prev => ({ ...prev, [membroId]: false }));
    }
  }, [giraId]);

  return { presencas, loading, updating, update, reload: load };
}