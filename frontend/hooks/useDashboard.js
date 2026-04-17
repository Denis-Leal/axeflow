/**
 * hooks/useDashboard.js — AxeFlow
 * Agrega dados do dashboard: giras + presenças de membros.
 */
import { useState, useEffect, useCallback } from 'react';
import { listGiras, getMe, getPresencaMembros, getPresencaMembrosPublica, confirmarPresencaMembro, confirmarPresencaMembroPublica } from '../services/api';

export function useDashboard() {
  const [giras, setGiras]     = useState([]);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // giraId → status do usuário nessa gira
  const [presencasFechadas, setPresencasFechadas] = useState({});
  const [presencasPublicas, setPresencasPublicas] = useState({});
  const [membrosPublicas, setMembrosPublicas]     = useState({});
  const [confirmando, setConfirmando]             = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [girasRes, meRes] = await Promise.all([listGiras(), getMe()]);
      const g = girasRes.data;
      const u = meRes.data;
      setGiras(g);
      setUser(u);

      const ativas = g.filter(x => x.status !== 'concluida');
      const fechadas = ativas.filter(x => x.acesso === 'fechada');
      const publicas = ativas.filter(x => x.acesso === 'publica');

      if (fechadas.length) {
        const results = await Promise.all(
          fechadas.map(x =>
            getPresencaMembros(x.id)
              .then(r => ({ id: x.id, membros: r.data }))
              .catch(() => null)
          )
        );
        const map = {};
        results.filter(Boolean).forEach(({ id, membros }) => {
          const eu = membros.find(m => m.membro_id === u.id);
          map[id] = eu?.status || 'pendente';
        });
        setPresencasFechadas(map);
      }

      if (publicas.length) {
        const results = await Promise.all(
          publicas.map(x =>
            getPresencaMembrosPublica(x.id)
              .then(r => ({ id: x.id, membros: r.data }))
              .catch(() => null)
          )
        );
        const pmap = {};
        const cmap = {};
        results.filter(Boolean).forEach(({ id, membros }) => {
          const eu = membros.find(m => m.membro_id === u.id);
          pmap[id] = eu?.status || 'pendente';
          cmap[id] = {
            total: membros.length,
            confirmados: membros.filter(m => m.status === 'confirmado').length,
          };
        });
        setPresencasPublicas(pmap);
        setMembrosPublicas(cmap);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmarFechada = useCallback(async (giraId) => {
    if (confirmando[giraId]) return;
    setConfirmando(p => ({ ...p, [giraId]: true }));
    try {
      const { data } = await confirmarPresencaMembro(giraId);
      setPresencasFechadas(p => ({ ...p, [giraId]: data.status }));
    } finally {
      setConfirmando(p => ({ ...p, [giraId]: false }));
    }
  }, [confirmando]);

  const confirmarPublica = useCallback(async (giraId) => {
    if (confirmando[giraId]) return;
    setConfirmando(p => ({ ...p, [giraId]: true }));
    try {
      const { data } = await confirmarPresencaMembroPublica(giraId);
      setPresencasPublicas(p => ({ ...p, [giraId]: data.status }));
      setMembrosPublicas(p => {
        const atual = p[giraId] || { total: 0, confirmados: 0 };
        const delta = data.status === 'confirmado' ? 1 : -1;
        return { ...p, [giraId]: { ...atual, confirmados: Math.max(0, atual.confirmados + delta) } };
      });
    } finally {
      setConfirmando(p => ({ ...p, [giraId]: false }));
    }
  }, [confirmando]);

  return {
    giras, user, loading,
    presencasFechadas, presencasPublicas, membrosPublicas,
    confirmando, confirmarFechada, confirmarPublica,
    reload: load,
  };
}