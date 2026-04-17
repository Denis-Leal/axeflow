/**
 * hooks/useGiras.js — AxeFlow
 * Hook de dados para giras. Separa fetch de renderização.
 */
import { useState, useEffect, useCallback } from 'react';
import api, { listGiras, getGira, getMe, getGiraPublica } from '../services/api';

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

  export function useGiraPublica(slug) {
  const [gira, setGira] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
    console.log("Gira publica: ", gira)
  useEffect(() => {
    if (!slug) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await getGiraPublica(slug);
        setGira(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  return { gira, loading, error };
}