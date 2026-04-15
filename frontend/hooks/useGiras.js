/**
 * hooks/useGiras.js — AxeFlow
 * Hook de dados para giras. Separa fetch de renderização.
 */
import { useState, useEffect, useCallback } from 'react';
import { listGiras, getMe } from '../services/api';

export function useGiras() {
  const [giras, setGiras]   = useState([]);
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [girasRes, meRes] = await Promise.all([listGiras(), getMe()]);
      setGiras(girasRes.data);
      setUser(meRes.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { giras, user, loading, error, reload: load };
}