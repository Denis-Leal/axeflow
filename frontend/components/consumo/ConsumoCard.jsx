/**
 * components/consumo/ConsumoCard.jsx — AxeFlow
 * Card mobile de consumo registrado na gira.
 */
import { useState } from 'react';
import { Badge, Button } from '../ui';
import { editarConsumo } from '../../services/api';
import { handleApiError } from '../../services/errorHandler';

const LABEL_STATUS = {
  PENDENTE:   { label: 'Aguardando fechamento', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  PROCESSADO: { label: 'Registrado no estoque', cor: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  CANCELADO:  { label: 'Cancelado',             cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
};

const LABEL_ORIGEM = {
  TERREIRO: { label: 'Item do terreiro', emoji: '🏛️', cor: '#60a5fa' },
  MEDIUM:   { label: 'Meu item (médium)', emoji: '🙋', cor: '#a78bfa' },
};

export default function ConsumoCard({ consumo, giraId, onSaved, setModal, fecharModal }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty]         = useState(consumo.quantity);
  const [saving, setSaving]   = useState(false);

  const consumoId = typeof consumo.id === 'object' ? consumo.id.id : consumo.id;
  const origem    = LABEL_ORIGEM[consumo.source] || {};
  const status    = LABEL_STATUS[consumo.status] || {};

  const handleSave = async () => {
    setSaving(true);
    try {
      await editarConsumo(giraId, consumoId, { quantity: parseInt(qty) });
      setEditing(false);
      onSaved();
    } catch (err) {
      setModal({
        aberto: true,
        titulo: 'Erro ao editar consumo',
        mensagem: handleApiError(err, 'Editar consumo'),
        tipoBotao: 'primary',
        onConfirmar: () => fecharModal(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'var(--cor-card)', border: '1px solid var(--cor-borda)',
      borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ padding: '0.85rem 1rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: '0.92rem', color: 'var(--cor-texto)' }}>
            {consumo.item_name || '—'}
          </strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
            {consumo.medium_nome || '—'}
          </div>
        </div>
        <Badge bg={status.bg} color={status.cor} style={{ border: `1px solid ${status.cor}30`, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
          {status.label}
        </Badge>
      </div>

      {/* Detalhes */}
      <div style={{ padding: '0.4rem 1rem', display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>
        <div>
          <div style={{ marginBottom: '2px' }}>Quantidade</div>
          {editing ? (
            <input
              type="number" min="1" value={qty} autoFocus
              onChange={e => setQty(e.target.value)}
              className="form-control-custom"
              style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.85rem', textAlign: 'center' }}
            />
          ) : (
            <strong style={{ color: 'var(--cor-texto)', fontSize: '0.95rem' }}>{consumo.quantity}</strong>
          )}
        </div>
        <div>
          <div style={{ marginBottom: '2px' }}>Origem</div>
          <span style={{ color: origem.cor, fontWeight: 600, fontSize: '0.8rem' }}>
            {origem.emoji} {origem.label}
          </span>
        </div>
      </div>

      {/* Ações — apenas PENDENTE */}
      {consumo.status === 'PENDENTE' && (
        <div style={{ padding: '0.5rem 1rem 0.85rem', display: 'flex', gap: '0.4rem' }}>
          {editing ? (
            <>
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={saving}
                style={{ flex: 1, justifyContent: 'center' }}>
                <i className="bi bi-floppy" /> Salvar
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => { setEditing(false); setQty(consumo.quantity); }}
                style={{ padding: '0.3rem 0.6rem' }}>
                <i className="bi bi-x-circle" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}
              style={{ width: '100%', justifyContent: 'center' }}>
              <i className="bi bi-pencil" /> Editar quantidade
            </Button>
          )}
        </div>
      )}
    </div>
  );
}