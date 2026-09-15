import { useCallback, useEffect, useState } from 'react';
import {
  cancelarAgendamento,
  concluirAgendamento,
  createAgendamento,
  listAgendamentos,
  updateAgendamento,
} from '../services/api';

export function useAgendamentos(status = null) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAgendamentos(status);
      setAgendamentos(res.data || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  const criar = useCallback(async (data) => {
    const res = await createAgendamento(data);
    await reload();
    return res.data;
  }, [reload]);

  const atualizar = useCallback(async (id, data) => {
    const res = await updateAgendamento(id, data);
    await reload();
    return res.data;
  }, [reload]);

  const cancelar = useCallback(async (id) => {
    const res = await cancelarAgendamento(id);
    await reload();
    return res.data;
  }, [reload]);

  const concluir = useCallback(async (id) => {
    const res = await concluirAgendamento(id);
    await reload();
    return res.data;
  }, [reload]);

  return { agendamentos, loading, error, reload, criar, atualizar, cancelar, concluir };
}
