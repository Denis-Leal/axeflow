/**
 * hooks/useConsulentes.js — AxeFlow
 *
 * Dependências: services/api (getRankingConsulentes, listConsulentes)
 * Impacto: pages/consulentes.js — remove fetch inline
 *
 * Lista carrega imediatamente.
 * Ranking é lazy: só dispara ao chamar loadRanking().
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useConsulentes() {
  const [consulentes, setConsulentes]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [ranking, setRanking]               = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingCarregado, setRankingCarregado] = useState(false);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/consulentes');
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
      const res = await api.get('/consulentes/ranking');
      setRanking(res.data);
      setRankingCarregado(true);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingRanking(false);
    }
  }, [rankingCarregado, loadingRanking]);

  return {
    consulentes, loading, error,
    ranking, loadingRanking, rankingCarregado,
    loadRanking,
  };
}