import { useCallback, useEffect, useState } from 'react';
import {
  createAtendimento,
  deleteAtendimento,
  listAtendimentos,
  updateAtendimento,
} from '../services/api';

export function useAtendimentos({ ativos = false } = {}) {
  const [atendimentos, setAtendimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAtendimentos(ativos);
      setAtendimentos(res.data || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [ativos]);

  useEffect(() => {
    reload();
  }, [reload]);

  const criar = useCallback(async (data) => {
    const res = await createAtendimento(data);
    await reload();
    return res.data;
  }, [reload]);

  const atualizar = useCallback(async (id, data) => {
    const res = await updateAtendimento(id, data);
    await reload();
    return res.data;
  }, [reload]);

  const remover = useCallback(async (id) => {
    const res = await deleteAtendimento(id);
    await reload();
    return res.data;
  }, [reload]);

  return { atendimentos, loading, error, reload, criar, atualizar, remover };
}
