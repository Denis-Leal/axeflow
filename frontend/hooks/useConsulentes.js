import { useState, useEffect, useCallback, useRef } from 'react';
import { listConsulentes, updateConsulente, getRankingConsulentes, deleteConsulente } from '../services/api';

export function useConsulentes() {
  const [consulentes, setConsulentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingCarregado, setRankingCarregado] = useState(false);
  const [error, setError] = useState(null);
  const [rankingError, setRankingError] = useState(null);
  const alive = useRef(false);
  const listVersion = useRef(0);
  const rankingVersion = useRef(0);
  const rankingAttempted = useRef(false);
  const rankingPending = useRef(false);

  const reload = useCallback(async () => {
    const version = ++listVersion.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listConsulentes();
      if (alive.current && version === listVersion.current) setConsulentes(res.data);
    } catch (err) {
      if (alive.current && version === listVersion.current) setError(err);
    } finally {
      if (alive.current && version === listVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
      ++listVersion.current;
      ++rankingVersion.current;
      rankingPending.current = false;
      rankingAttempted.current = false;
    };
  }, [reload]);

  // One automatic attempt per mount. Failures retry only on explicit user action.
  const loadRanking = useCallback(async (retry = false) => {
    if (rankingPending.current || (rankingAttempted.current && !retry)) return;
    rankingAttempted.current = true;
    rankingPending.current = true;
    const version = ++rankingVersion.current;
    setLoadingRanking(true);
    setRankingError(null);
    try {
      const res = await getRankingConsulentes();
      if (alive.current && version === rankingVersion.current) {
        setRanking(res.data);
        setRankingCarregado(true);
      }
    } catch (err) {
      if (alive.current && version === rankingVersion.current) setRankingError(err);
    } finally {
      if (alive.current && version === rankingVersion.current) {
        rankingPending.current = false;
        setLoadingRanking(false);
      }
    }
  }, []);

  const editarConsulente = useCallback(async (id, dados) => {
    const res = await updateConsulente(id, dados);
    if (alive.current) {
      ++listVersion.current;
      setLoading(false);
      setConsulentes(prev => prev.map(c => c.id === id ? res.data : c));
    }
    return res.data;
  }, []);

  const deletarConsulente = useCallback(async (id) => {
    await deleteConsulente(id);
    if (alive.current) {
      ++listVersion.current;
      ++rankingVersion.current;
      rankingPending.current = false;
      setLoading(false);
      setLoadingRanking(false);
      setConsulentes(prev => prev.filter(c => c.id !== id));
      setRanking(prev => prev.filter(c => c.id !== id));
    }
  }, []);

  return {
    consulentes, loading, error, reload,
    ranking, loadingRanking, rankingCarregado, rankingError,
    loadRanking, editarConsulente, deletarConsulente,
  };
}
