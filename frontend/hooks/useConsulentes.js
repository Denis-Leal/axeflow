import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { listConsulentes, updateConsulente, getRankingConsulentes, deleteConsulente } from '../services/api';

export function useConsulentes() {
  const [consulentes, setConsulentes]           = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [ranking, setRanking]                   = useState([]);
  const [loadingRanking, setLoadingRanking]     = useState(false);
  const [rankingCarregado, setRankingCarregado] = useState(false);
  const [error, setError]                       = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await listConsulentes();
        setConsulentes(res.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadRanking = useCallback(async () => {
    if (rankingCarregado || loadingRanking) return;
    setLoadingRanking(true);
    try {
      const res = await getRankingConsulentes();
      setRanking(res.data);
      setRankingCarregado(true);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingRanking(false);
    }
  }, [rankingCarregado, loadingRanking]);

  const editarConsulente = useCallback(async (id, dados) => {
    const res = await updateConsulente(id, dados)
    setConsulentes(prev => prev.map(c => c.id === id ? res.data : c));
    return res.data;
  }, []);

  const deletarConsulente = useCallback(async (id) => {
    await deleteConsulente(id);
    setConsulentes(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    consulentes, loading, error,
    ranking, loadingRanking, rankingCarregado,
    loadRanking,
    editarConsulente,
    deletarConsulente,
  };
}