/**
 * contexts/GiraContext.js — AxeFlow
 *
 * Contexto global para a "gira ativa": a gira em que o usuário está
 * trabalhando no momento (registrando consumos, movimentando estoque, etc).
 *
 * Persiste no localStorage sob a chave 'gira_ativa' para sobreviver
 * a recarregamentos de página.
 *
 * ALTERAÇÃO: exposto também `atualizarStatusGira` para que a tela de
 * consumo possa marcar a gira como 'concluida' localmente sem precisar
 * recarregar dados do servidor — evita inconsistência de UI pós-finalização.
 *
 * Uso em qualquer componente:
 *   const { giraAtual, setGiraAtual, atualizarStatusGira, limparGiraAtual } = useGiraAtual();
 *
 * Estrutura de giraAtual:
 *   {
 *     id:     string (UUID),
 *     titulo: string,
 *     data:   string (YYYY-MM-DD),
 *     status: string ('aberta' | 'fechada' | 'concluida'),
 *     acesso: string ('publica' | 'fechada'),
 *   }
 */

import { createContext, useContext, useState, useEffect } from 'react';

// ── Chave de persistência no localStorage ─────────────────────────────────────
const LS_KEY = 'gira_ativa';

// ── Criação do contexto ───────────────────────────────────────────────────────
const GiraContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function GiraProvider({ children }) {
  // Inicializa com null — o useEffect abaixo restaura do localStorage
  const [giraAtual, setGiraAtualState] = useState(null);

  // Restaura gira ativa do localStorage ao montar (apenas no browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const salva = localStorage.getItem(LS_KEY);
      if (salva) setGiraAtualState(JSON.parse(salva));
    } catch {
      // JSON corrompido — ignora silenciosamente
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  // Setter que persiste no localStorage ao mesmo tempo
  const setGiraAtual = (gira) => {
    setGiraAtualState(gira);
    if (typeof window !== 'undefined') {
      if (gira) {
        localStorage.setItem(LS_KEY, JSON.stringify(gira));
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }
  };

  /**
   * Atualiza apenas o status da gira ativa sem substituir o objeto inteiro.
   * Útil para marcar como 'concluida' após finalizar sem precisar recarregar.
   *
   * @param {string} novoStatus - 'aberta' | 'fechada' | 'concluida'
   */
  const atualizarStatusGira = (novoStatus) => {
    if (!giraAtual) return;
    const giraAtualizada = { ...giraAtual, status: novoStatus };
    setGiraAtual(giraAtualizada);
  };

  // Limpa a gira ativa (ex: logout, ou ao sair voluntariamente)
  const limparGiraAtual = () => setGiraAtual(null);

  return (
    <GiraContext.Provider value={{ giraAtual, setGiraAtual, atualizarStatusGira, limparGiraAtual }}>
      {children}
    </GiraContext.Provider>
  );
}

// ── Hook de consumo ───────────────────────────────────────────────────────────
export function useGiraAtual() {
  const ctx = useContext(GiraContext);
  if (!ctx) throw new Error('useGiraAtual deve ser usado dentro de GiraProvider');
  return ctx;
}