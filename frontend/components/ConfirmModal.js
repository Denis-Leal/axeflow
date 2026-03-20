/**
 * components/ConfirmModal.js — AxeFlow
 *
 * Modal de confirmação reutilizável no padrão visual do sistema.
 * Substitui window.confirm() e window.alert() em toda a aplicação.
 *
 * Uso básico (confirmação):
 *   <ConfirmModal
 *     aberto={modalAberto}
 *     titulo="Cancelar inscrição"
 *     mensagem="Tem certeza que deseja cancelar a inscrição de Denis?"
 *     onConfirmar={() => fazerAlgo()}
 *     onCancelar={() => setModalAberto(false)}
 *   />
 *
 * Uso como alerta (só botão OK, sem cancelar):
 *   <ConfirmModal
 *     aberto={alertAberto}
 *     titulo="Inscrição reativada"
 *     mensagem="Denis foi reativado como confirmado."
 *     apenasOk
 *     onConfirmar={() => setAlertAberto(false)}
 *   />
 *
 * Props:
 *   aberto       {boolean}   — controla visibilidade
 *   titulo       {string}    — título do modal
 *   mensagem     {string}    — texto descritivo
 *   onConfirmar  {function}  — callback ao clicar em confirmar/OK
 *   onCancelar   {function}  — callback ao clicar em cancelar ou fechar (opcional se apenasOk)
 *   apenasOk     {boolean}   — se true, exibe só botão OK (modo alerta)
 *   tipoBotao    {string}    — 'perigo' | 'sucesso' | 'padrao' (cor do botão de confirmar)
 *   labelConfirmar {string}  — texto do botão de confirmar (padrão: "Confirmar")
 *   labelCancelar  {string}  — texto do botão de cancelar (padrão: "Cancelar")
 */

import { useEffect } from 'react';

export default function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  onConfirmar,
  onCancelar,
  apenasOk       = false,
  tipoBotao      = 'perigo',
  labelConfirmar = apenasOk ? 'OK' : 'Confirmar',
  labelCancelar  = 'Cancelar',
}) {
  // Fecha com Escape
  useEffect(() => {
    if (!aberto) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (apenasOk) onConfirmar?.();
        else onCancelar?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [aberto, apenasOk, onConfirmar, onCancelar]);

  if (!aberto) return null;

  // Cores do botão de confirmação por tipo
  const corBotao = {
    perigo:  { bg: 'rgba(239,68,68,0.9)',    hover: '#ef4444',  text: '#fff' },
    sucesso: { bg: 'rgba(16,185,129,0.9)',   hover: '#10b981',  text: '#fff' },
    padrao:  { bg: 'var(--cor-acento)',       hover: '#f0d060',  text: '#1a0a2e' },
  }[tipoBotao] || { bg: 'var(--cor-acento)', hover: '#f0d060', text: '#1a0a2e' };

  return (
    /* Overlay */
    <div
      onClick={() => { if (apenasOk) onConfirmar?.(); else onCancelar?.(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
    >
      {/* Card do modal — impede propagação do clique do overlay */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cor-card)',
          border: '1px solid var(--cor-borda)',
          borderRadius: '16px',
          padding: '1.75rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Título */}
        <h5 style={{
          fontFamily: 'Cinzel, serif',
          color: 'var(--cor-acento)',
          fontSize: '1rem',
          marginBottom: '0.75rem',
          margin: '0 0 0.75rem 0',
        }}>
          {titulo}
        </h5>

        {/* Mensagem */}
        <p style={{
          color: 'var(--cor-texto-suave)',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          margin: '0 0 1.5rem 0',
          whiteSpace: 'pre-line',  /* respeita \n na mensagem */
        }}>
          {mensagem}
        </p>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {!apenasOk && (
            <button
              onClick={onCancelar}
              className="btn-outline-gold"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}
            >
              {labelCancelar}
            </button>
          )}
          <button
            onClick={onConfirmar}
            style={{
              background: corBotao.bg,
              color: corBotao.text,
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1.5rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              fontFamily: 'Lato, sans-serif',
            }}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}