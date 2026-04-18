/**
 * hooks/useMembros.js — AxeFlow
 *
 * Dependências: services/api (getMe, listMembros, createMembro, updateMembro)
 * Impacto: pages/membros.js — remove todo fetch inline
 *
 * Duas abas, dois endpoints distintos:
 *   - lista     → /membros       (carrega imediatamente)
 *   - desempenho → /membros/ranking (lazy: só carrega ao chamar loadRanking())
 */
import { useState, useEffect, useCallback } from 'react';
import { getMe, listMembros, createMembro, updateMembro } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import api from '../services/api';

export function useMembros() {
  const [membros, setMembros]   = useState([]);
  const [me, setMe]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Ranking — lazy
  const [ranking, setRanking]               = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingCarregado, setRankingCarregado] = useState(false);

  // Carrega lista + me em paralelo
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, listRes] = await Promise.all([getMe(), listMembros()]);
      setMe(meRes.data);
      setMembros(listRes.data);
    } catch (err) {
      // Fallback: ao menos expõe o próprio usuário
      try {
        const meRes = await getMe();
        setMe(meRes.data);
        setMembros([meRes.data]);
      } catch {
        setError('Erro ao carregar membros.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lazy: só executa na primeira chamada
  const loadRanking = useCallback(async () => {
    if (rankingCarregado) return;
    setLoadingRanking(true);
    try {
      const res = await api.get('/membros/ranking');
      setRanking(res.data);
      setRankingCarregado(true);
    } catch {
      setRankingCarregado(true); // falha silenciosa — exibe vazio
    } finally {
      setLoadingRanking(false);
    }
  }, [rankingCarregado]);

  const convidar = useCallback(async (form) => {
    await createMembro(form);
    const res = await listMembros();
    setMembros(res.data);
    setRankingCarregado(false); // invalida cache do ranking
  }, []);

  const editar = useCallback(async (id, form) => {
    const payload = { ...form };
    if (!payload.senha) delete payload.senha;
    await updateMembro(id, payload);
    const res = await listMembros();
    setMembros(res.data);
    setRankingCarregado(false);
  }, []);

  return {
    me, membros, loading, error,
    ranking, loadingRanking, rankingCarregado,
    loadRanking,
    convidar, editar,
    reload: load,
  };
}