/**
 * hooks/useEstoque.js — AxeFlow
 *
 * Dependências: services/api (listarItens, criarItemTerreiro, criarItemMedium, criarItemMediumAdmin, registrarMovimentacao)
 * Impacto: pages/estoque.js
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listarItens,
  criarItemTerreiro,
  criarItemMedium,
  criarItemMediumAdmin,
  registrarMovimentacao,
} from '../services/api';
import { handleApiError } from '../services/errorHandler';

export function useEstoque() {
  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listarItens();
      setItens(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /**
   * criarItem — roteia para a função correta conforme owner e role.
   *
   * form.owner === 'terreiro'          → criarItemTerreiro   (admin only)
   * form.owner === 'medium' + isAdmin  → criarItemMediumAdmin(payload, form.medium_user_id)
   * form.owner === 'medium'            → criarItemMedium     (próprio usuário)
   */
  const criarItem = useCallback(async (form) => {
    const payload = {
      name:              form.name.trim(),
      category:          form.category,
      minimum_threshold: parseInt(form.minimum_threshold) || 0,
      unit_cost:         form.unit_cost ? parseFloat(form.unit_cost) : null,
    };

    if (form.owner === 'terreiro') {
      await criarItemTerreiro(payload);
    } else if (form.owner === 'medium' && form.medium_user_id) {
      await criarItemMediumAdmin(payload, form.medium_user_id);
    } else {
      await criarItemMedium(payload);
    }

    await reload();
    return payload.name;
  }, [reload]);

  const mover = useCallback(async (item_id, form) => {
    await registrarMovimentacao(item_id, {
      type:     form.type,
      quantity: parseInt(form.quantity),
      notes:    form.notes.trim() || null,
    });
    await reload();
  }, [reload]);

  return { itens, loading, error, reload, criarItem, mover };
}