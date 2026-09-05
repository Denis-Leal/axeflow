/**
 * AjeumPanel.js — AxeFlow
 *
 * Painel completo do Ajeum na página de detalhe da gira.
 *
 * FLUXO POR PERFIL:
 *
 *  Admin/Operador — sem Ajeum:
 *    Vê card com formulário inline para criar o Ajeum.
 *    Adiciona quantos itens quiser antes de salvar (Enter adiciona linha).
 *    Após salvar, o painel muda para o modo de gestão.
 *
 *  Admin/Operador — com Ajeum:
 *    Vê os itens com contagem de vagas.
 *    Pode adicionar itens novos via formulário no final da lista.
 *    Pode editar descrição/limite de cada item inline (lápis na linha).
 *    Pode deletar item (backend rejeita se há seleções ativas — exibe 409).
 *    Após a gira (concluída): confirma quem entregou ou não.
 *
 *  Membro comum — sem Ajeum:
 *    Não vê nada (retorna null).
 *
 *  Membro comum — com Ajeum:
 *    Vê os itens e pode selecionar/desmarcar.
 *    Não vê controles de edição.
 *
 * CONCORRÊNCIA:
 *   409 em selecionar → recarrega lista + avisa vaga preenchida
 *   409 em confirmar  → recarrega lista + avisa conflito de version
 *   409 em deletar    → exibe mensagem do backend (seleções ativas)
 *   409 em editar     → exibe mensagem do backend (limite < seleções)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  listAjeum, 
  createAjeum, 
  CreateAjeumItem, 
  selecionarItemAjeum, 
  deleteSelecaoAjeum,
  updateStatusSelecaoAjeum,
  updateAjeumItem,
  deleteAjeumItem
} from '../services/api';

// ── Paleta de cores por estado de seleção ─────────────────────────────────────
const CORES_STATUS = {
  confirmado:   { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  nao_entregue: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  selecionado:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
};

// ── Lista de unidades de medida ────────────────────────────────────────────────
const UNIDADES_MEDIDA = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'mg', label: 'mg' },
  { value: 'l', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'un', label: 'un.' },
  { value: 'pacote', label: 'pacote(s)' },
  { value: 'caixa', label: 'caixa(s)' },
  { value: 'garrafa', label: 'garrafa(s)' },
  { value: 'lata', label: 'lata(s)' },
  { value: 'duzia', label: 'dúzia(s)' },
];

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function estilosBadge(cor) {
  return {
    fontSize: '0.75rem', fontWeight: 600,
    background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text,
    borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap',
  };
}

function estilosBotao(cor, desabilitado = false) {
  return {
    background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text,
    borderRadius: '8px', padding: '0.35rem 0.9rem',
    cursor: desabilitado ? 'not-allowed' : 'pointer',
    fontSize: '0.82rem', fontWeight: 600, opacity: desabilitado ? 0.7 : 1,
    display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
  };
}

const estilosBotaoDesabilitado = {
  background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
  color: '#94a3b8', borderRadius: '8px', padding: '0.35rem 0.9rem',
  fontSize: '0.82rem', cursor: 'not-allowed', whiteSpace: 'nowrap',
};

// ── Componente: toast de feedback inline ──────────────────────────────────────
function ToastFeedback({ mensagem, tipo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const cor = tipo === 'erro'
    ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#ef4444' }
    : { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10b981' };

  return (
    <div style={{
      background: cor.bg, border: `1px solid ${cor.border}`,
      borderRadius: '8px', padding: '0.6rem 0.9rem',
      fontSize: '0.8rem', color: cor.text,
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      marginBottom: '0.75rem',
    }}>
      <i className={`bi bi-${tipo === 'erro' ? 'exclamation-circle' : 'check-circle'}`}></i>
      {mensagem}
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: cor.text }}>×</button>
    </div>
  );
}

// ── Componente: formulário de criação do Ajeum ────────────────────────────────
/**
 * Exibido quando não há Ajeum ainda.
 * Admin monta a lista de itens localmente e salva tudo de uma vez.
 * Enter na descrição de um item avança para a próxima linha.
 */
function FormCriarAjeum({ giraId, onCriado, exibirToast }) {
  const [itens, setItens] = useState([
    { descricao: '', quantidade_necessaria: 1, unidade: 'un' }
  ]);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const adicionarLinha = () => {
    setItens(prev => [
      ...prev,
      {
        descricao: '',
        quantidade_necessaria: 1,
        unidade: 'un',
      }
    ]);
  };

  const removerLinha = (idx) => {
    if (itens.length === 1) return;
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const atualizarLinha = (idx, campo, valor) => {
    setItens(prev =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, [campo]: valor }
          : item
      )
    );
  };

  const handleSalvar = async () => {
    const itensFiltrados = itens.filter(
      i => i.descricao.trim() !== ''
    );

    if (itensFiltrados.length === 0) {
      exibirToast(
        'Adicione pelo menos um item com descrição.',
        'erro'
      );
      return;
    }

    const invalido = itensFiltrados.find(
      i =>
        !i.quantidade_necessaria ||
        Number(i.quantidade_necessaria) <= 0 ||
        !i.unidade
    );

    if (invalido) {
      exibirToast(
        `"${invalido.descricao}" precisa de uma quantidade maior que zero e uma unidade.`,
        'erro'
      );
      return;
    }

    setSalvando(true);

    try {
      await createAjeum(giraId, {
        observacoes: observacoes.trim() || null,

        itens: itensFiltrados.map(i => ({
          descricao: i.descricao.trim(),
          quantidade_necessaria: Number(i.quantidade_necessaria),
          unidade: i.unidade,
        })),
      });

      exibirToast('Lista criada com sucesso!');
      onCriado();

    } catch (err) {
      if (err.response?.status === 409) {
        exibirToast(
          'Esta gira já tem uma lista. Recarregando...',
          'erro'
        );
        onCriado();

      } else if (err.response?.status === 400 ||
                 err.response?.status === 422) {
        exibirToast(
          err.response.data.detail || 'Dados inválidos.',
          'erro'
        );

      } else {
        exibirToast(
          'Erro ao criar lista. Tente novamente.',
          'erro'
        );
      }

    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ padding: '1.25rem' }}>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{
          fontSize: '0.78rem',
          color: 'var(--cor-texto-suave)',
          display: 'block',
          marginBottom: '0.35rem'
        }}>
          Observações
          <span style={{
            fontWeight: 400,
            marginLeft: '0.4rem',
            fontSize: '0.72rem'
          }}>
            (opcional — visível para todos os membros)
          </span>
        </label>

        <input
          className="form-control-custom"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Ex: Confiram os itens antes da gira"
          maxLength={1000}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 130px 36px',
        gap: '0.5rem',
        marginBottom: '0.4rem',
        padding: '0 0.25rem',
      }}>
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--cor-texto-suave)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Descrição
        </span>

        <span style={{
          fontSize: '0.72rem',
          color: 'var(--cor-texto-suave)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          textAlign: 'center',
        }}>
          Quantidade
        </span>

        <span style={{
          fontSize: '0.72rem',
          color: 'var(--cor-texto-suave)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Unidade
        </span>

        <span />
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        marginBottom: '0.75rem'
      }}>
        {itens.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 110px 130px 36px',
              gap: '0.5rem',
              alignItems: 'center'
            }}
          >
            <input
              className="form-control-custom ajeum-desc-input"
              value={item.descricao}
              onChange={e =>
                atualizarLinha(
                  idx,
                  'descricao',
                  e.target.value
                )
              }
              placeholder={`Item ${idx + 1}... ex: Bacon, Vela branca`}
              maxLength={255}
              style={{ fontSize: '0.88rem' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();

                  adicionarLinha();

                  setTimeout(() => {
                    const inputs =
                      document.querySelectorAll(
                        '.ajeum-desc-input'
                      );

                    if (inputs[idx + 1]) {
                      inputs[idx + 1].focus();
                    }
                  }, 30);
                }
              }}
            />

            <input
              type="number"
              className="form-control-custom"
              value={item.quantidade_necessaria}
              onChange={e =>
                atualizarLinha(
                  idx,
                  'quantidade_necessaria',
                  e.target.value
                )
              }
              min="0.001"
              step="0.001"
              style={{
                fontSize: '0.88rem',
                textAlign: 'center'
              }}
            />

            <select
              className="form-control-custom"
              value={item.unidade}
              onChange={e =>
                atualizarLinha(
                  idx,
                  'unidade',
                  e.target.value
                )
              }
              style={{ fontSize: '0.88rem' }}
            >
              {UNIDADES_MEDIDA.map(unidade => (
                <option
                  key={unidade.value}
                  value={unidade.value}
                >
                  {unidade.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => removerLinha(idx)}
              disabled={itens.length === 1}
              title="Remover linha"
              style={{
                background: 'transparent',
                border: `1px solid ${
                  itens.length === 1
                    ? 'rgba(148,163,184,0.2)'
                    : 'rgba(239,68,68,0.3)'
                }`,
                color: itens.length === 1
                  ? '#94a3b8'
                  : '#ef4444',
                borderRadius: '6px',
                width: '36px',
                height: '36px',
                cursor: itens.length === 1
                  ? 'not-allowed'
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
              }}
            >
              <i className="bi bi-x" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={adicionarLinha}
        style={{
          background: 'rgba(212,175,55,0.06)',
          border: '1px dashed rgba(212,175,55,0.35)',
          color: 'var(--cor-acento)',
          borderRadius: '8px',
          padding: '0.45rem 1rem',
          cursor: 'pointer',
          fontSize: '0.82rem',
          width: '100%',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
        }}
      >
        <i className="bi bi-plus-lg" />
        Adicionar item (ou pressione Enter)
      </button>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="btn-gold"
          style={{
            padding: '0.6rem 1.75rem'
          }}
        >
          {salvando ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Criando...
            </>
          ) : (
            <>
              <i className="bi bi-check-lg me-2" />
              Criar Lista
            </>
          )}
        </button>
      </div>

    </div>
  );
}

// ── Componente: adicionar item avulso ao Ajeum existente ──────────────────────
/**
 * Exibido no final da lista existente.
 * Permite adicionar um item por vez sem recriar tudo.
 * Começa colapsado (botão "+") e abre inline ao clicar.
 */
function FormAdicionarItem({ ajeum_id, onAdicionado, exibirToast }) {
  const [aberto,    setAberto]    = useState(false);
  const [descricao, setDescricao] = useState('');
  const [limite,    setLimite]    = useState(1);
  const [salvando,  setSalvando]  = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [unidade, setUnidade] = useState('un');

  const handleSalvar = async () => {
    if (!descricao.trim()) {
      exibirToast('Informe a descrição do item.', 'erro');
      return;
    }
    if (!quantidade || Number(quantidade) <= 0) {
      exibirToast(
        'A quantidade deve ser maior que zero.',
        'erro'
      );
      return;
    }

    setSalvando(true);
    try {
      // POST para criar o item avulso no Ajeum existente (api.post(`/ajeum/${ajeum_id}/itens`))
      await CreateAjeumItem(ajeum_id, {
        descricao: descricao.trim(),
        quantidade_necessaria: Number(quantidade),
        unidade: unidade,
      });
      setDescricao('');
      setLimite(1);
      setAberto(false);
      exibirToast(`"${descricao.trim()}" adicionado!`);
      onAdicionado();
    } catch (err) {
      if (err.response?.status === 400) {
        exibirToast(err.response.data.detail || 'Dados inválidos.', 'erro');
      } else {
        exibirToast('Erro ao adicionar item. Tente novamente.', 'erro');
      }
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          background: 'rgba(212,175,55,0.06)',
          border: '1px dashed rgba(212,175,55,0.35)',
          color: 'var(--cor-acento)', borderRadius: '8px',
          padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.82rem',
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}
      >
        <i className="bi bi-plus-lg"></i> Adicionar item à lista
      </button>
    );
  }

  return (
    <div style={{
      background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: '10px', padding: '0.85rem 1rem',
    }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--cor-acento)', fontWeight: 600, marginBottom: '0.6rem' }}>
        + Novo item
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 130px',
        gap: '0.5rem',
        marginBottom: '0.6rem'
      }}>
        <input
          className="form-control-custom"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Ex: Vela branca"
          maxLength={255}
          autoFocus
          style={{ fontSize: '0.88rem' }}
        />

        <input
          type="number"
          className="form-control-custom"
          value={quantidade}
          onChange={e => setQuantidade(e.target.value)}
          min="0.001"
          step="0.001"
          style={{
            fontSize: '0.88rem',
            textAlign: 'center'
          }}
        />

        <select
          className="form-control-custom"
          value={unidade}
          onChange={e => setUnidade(e.target.value)}
          style={{ fontSize: '0.88rem' }}
        >
          {UNIDADES_MEDIDA.map(u => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setAberto(false); setDescricao(''); setQuantidade(1); setUnidade('un'); }}
          className="btn-outline-gold"
          style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando || !descricao.trim()}
          className="btn-gold"
          style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
        >
          {salvando
            ? <span className="spinner-border spinner-border-sm" style={{ width: '0.75rem', height: '0.75rem' }} />
            : 'Adicionar'
          }
        </button>
      </div>
    </div>
  );
}

// ── Componente: card de um item do Ajeum ──────────────────────────────────────
function ItemCard({ item, isAdmin, giraConcluida, onSelecionar, onCancelar, onConfirmar, onEditar, onDeletar }) {
  const [carregando,   setCarregando]   = useState(false);
  // editando: null = não editando | { descricao, limite } = valores em edição
  const [editando,     setEditando]     = useState(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const [quantidadeSelecionar, setQuantidadeSelecionar] = useState('');
  const [selecionando, setSelecionando] = useState(false);

  const {
    id,
    descricao,
    quantidade_necessaria,
    unidade,
    quantidade_selecionada,
    quantidade_restante,
    meu_status,
    minha_selecao_id,
    minha_version,
  } = item;
  const lotado = quantidade_restante <= 0;
  const pct = Math.min(100, (quantidade_selecionada / quantidade_necessaria) * 100);

  // Guard de double-tap para ações do membro
  const handleAcao = async (fn) => {
    if (carregando) return;
    setCarregando(true);
    try { await fn(); } finally { setCarregando(false); }
  };

  const salvarEdicao = async () => {
  if (!editando.descricao.trim()) return;

  if (
    !editando.quantidade_necessaria ||
    Number(editando.quantidade_necessaria) <= 0
  ) {
    return;
  }

  setSalvandoEdit(true);

  try {
    await onEditar(id, {
      descricao: editando.descricao.trim(),
      quantidade_necessaria:
        Number(editando.quantidade_necessaria),
      unidade: editando.unidade,
    });

    setEditando(null);
  } finally {
    setSalvandoEdit(false);
  }
};

  const confirmarSelecao = async () => {
  const quantidade = Number(quantidadeSelecionar);

    if (!quantidade || quantidade <= 0) {
      return;
    }

    if (quantidade > quantidade_restante) {
      return;
    }

    await handleAcao(() =>
      onSelecionar(id, quantidade)
    );

    setQuantidadeSelecionar('');
    setSelecionando(false);
  };

  // ── Botão do membro (selecionar/cancelar/badges) ──────────────────────────
  const renderBotaoMembro = () => {
  if (giraConcluida || isAdmin) return null;

  if (meu_status === 'confirmado') {
    return (
      <span style={estilosBadge(CORES_STATUS.confirmado)}>
        ✓ Entregue
      </span>
    );
  }

  if (meu_status === 'nao_entregue') {
    return (
      <span style={estilosBadge(CORES_STATUS.nao_entregue)}>
        ✗ Não entregue
      </span>
    );
  }

  if (meu_status === 'selecionado') {
    return (
      <button
        onClick={() =>
          handleAcao(() =>
            onCancelar(minha_selecao_id)
          )
        }
        disabled={carregando}
        style={estilosBotao(
          CORES_STATUS.selecionado,
          carregando
        )}
        title="Clique para desmarcar"
      >
        {carregando ? (
          <span
            className="spinner-border spinner-border-sm"
            style={{
              width: '0.75rem',
              height: '0.75rem'
            }}
          />
        ) : (
          `✓ Vou levar ${formatQuantidade(
            item.minha_quantidade
          )} ${unidade} — desmarcar?`
        )}
      </button>
    );
  }

  if (lotado) {
    return (
      <button
        disabled
        style={estilosBotaoDesabilitado}
      >
        Já temos o suficiente
      </button>
    );
  }

  if (selecionando) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexWrap: 'wrap',
      }}>
        <input
          type="number"
          min="0.001"
          max={quantidade_restante}
          step="0.001"
          value={quantidadeSelecionar}
          onChange={e =>
            setQuantidadeSelecionar(e.target.value)
          }
          autoFocus
          placeholder={String(quantidade_restante)}
          style={{
            width: '90px',
            padding: '0.35rem 0.5rem',
            border: '1px solid var(--cor-borda)',
            borderRadius: '7px',
            background: 'var(--cor-card)',
            color: 'var(--cor-texto)',
            fontSize: '0.82rem',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              confirmarSelecao();
            }

            if (e.key === 'Escape') {
              setSelecionando(false);
              setQuantidadeSelecionar('');
            }
          }}
        />

        <span style={{
          fontSize: '0.78rem',
          color: 'var(--cor-texto-suave)',
        }}>
          {unidade}
        </span>

        <button
          onClick={confirmarSelecao}
          disabled={
            carregando ||
            !quantidadeSelecionar ||
            Number(quantidadeSelecionar) <= 0 ||
            Number(quantidadeSelecionar) > quantidade_restante
          }
          style={estilosBotao(
            CORES_STATUS.confirmado,
            carregando
          )}
        >
          {carregando ? (
            <span
              className="spinner-border spinner-border-sm"
              style={{
                width: '0.75rem',
                height: '0.75rem'
              }}
            />
          ) : (
            <>
              <i className="bi bi-check-lg" />
              Confirmar
            </>
          )}
        </button>

        <button
          onClick={() => {
            setSelecionando(false);
            setQuantidadeSelecionar('');
          }}
          disabled={carregando}
          style={{
            background: 'transparent',
            border: '1px solid var(--cor-borda)',
            color: 'var(--cor-texto-suave)',
            borderRadius: '7px',
            padding: '0.35rem 0.6rem',
            cursor: 'pointer',
            fontSize: '0.78rem',
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setQuantidadeSelecionar('');
        setSelecionando(true);
      }}
      disabled={carregando}
      style={estilosBotao(
        {
          text: '#10b981',
          border: 'rgba(16,185,129,0.35)',
          bg: 'rgba(16,185,129,0.12)'
        },
        carregando
      )}
    >
      + Vou levar
    </button>
  );
};
  // ── Painel de confirmação admin (pós-gira) ───────────────────────────────
  // Exibe uma linha por membro que selecionou o item.
  // Admin confirma ✓ Entregou ou ✗ Não entregou para cada um individualmente.
  // Membros com status terminal (confirmado/nao_entregue) mostram badge fixo.
  const renderBotoesAdmin = () => {
    if (!isAdmin || !giraConcluida) return null;
    // Só selecionadores com status 'selecionado' precisam de ação
    const pendentes = (item.selecionadores || []).filter(s => s.status === 'selecionado');
    if (pendentes.length === 0) return null;

    return (
      <div style={{
        marginTop: '0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '0.6rem',
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.1rem' }}>
          Confirmar entrega
        </div>
        {pendentes.map(sel => (
          <div key={sel.selecao_id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.5rem', flexWrap: 'wrap',
          }}>
            {/* Nome do membro */}
            <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto)', fontWeight: 500 }}>
              {sel.nome}
            </span>
            {/* Botões de confirmação */}
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                onClick={() => handleAcao(() => onConfirmar(sel.selecao_id, 'confirmado', sel.version))}
                disabled={carregando}
                title={`${sel.nome} entregou`}
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >✓ Entregou</button>
              <button
                onClick={() => handleAcao(() => onConfirmar(sel.selecao_id, 'nao_entregue', sel.version))}
                disabled={carregando}
                title={`${sel.nome} não entregou`}
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >✗ Não entregou</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Modo edição inline ────────────────────────────────────────────────────
  if (editando) {
    return (
      <div style={{
        background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.3)',
        borderRadius: '10px', padding: '0.75rem 1rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 110px 130px',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <input
            className="form-control-custom"
            value={editando.descricao}
            onChange={e =>
              setEditando(p => ({
                ...p,
                descricao: e.target.value
              }))
            }
            maxLength={255}
            autoFocus
            style={{ fontSize: '0.88rem' }}
          />

          <input
            type="number"
            className="form-control-custom"
            value={editando.quantidade_necessaria}
            onChange={e =>
              setEditando(p => ({
                ...p,
                quantidade_necessaria: e.target.value
              }))
            }
            min="0.001"
            step="0.001"
            style={{
              fontSize: '0.88rem',
              textAlign: 'center'
            }}
          />

          <select
            className="form-control-custom"
            value={editando.unidade}
            onChange={e =>
              setEditando(p => ({
                ...p,
                unidade: e.target.value
              }))
            }
            style={{ fontSize: '0.88rem' }}
          >
            {UNIDADES_MEDIDA.map(u => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={() => setEditando(null)} className="btn-outline-gold" style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}>
            Cancelar
          </button>
          <button
            onClick={salvarEdicao}
            disabled={salvandoEdit || !editando.descricao.trim()}
            className="btn-gold"
            style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
          >
            {salvandoEdit
              ? <span className="spinner-border spinner-border-sm" style={{ width: '0.7rem', height: '0.7rem' }} />
              : 'Salvar'
            }
          </button>
        </div>
      </div>
    );
  }

  // ── Modo normal ───────────────────────────────────────────────────────────
  return (
    <div style={{
      background: meu_status ? `${CORES_STATUS[meu_status]?.bg || 'transparent'}` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${meu_status ? CORES_STATUS[meu_status]?.border || 'var(--cor-borda)' : 'var(--cor-borda)'}`,
      borderRadius: '10px', padding: '0.85rem 1rem', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

        {/* Descrição */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--cor-texto)' }}>{descricao}</span>
        </div>

        {/* Contador */}
        <span style={{
            fontSize: '0.78rem',
            color: lotado
              ? '#ef4444'
              : 'var(--cor-texto-suave)',
            fontWeight: lotado ? 700 : 400,
            whiteSpace: 'nowrap',
            }}>
            {formatQuantidade(quantidade_selecionada)}
            {' / '}
            {formatQuantidade(quantidade_necessaria)}
            {' '}
            {unidade}
          </span>

        {/* Botão do membro */}
        {renderBotaoMembro()}

        {/* Controles de admin (editar + deletar) — apenas antes da gira concluir */}
        {isAdmin && !giraConcluida && (
          <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
            <button
              onClick={() => setEditando({ descricao, quantidade_necessaria, unidade })}
              title="Editar item"
              style={{
                background: 'transparent', border: '1px solid var(--cor-borda)',
                color: 'var(--cor-texto-suave)', borderRadius: '6px',
                padding: '0.2rem 0.45rem', cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              <i className="bi bi-pencil"></i>
            </button>
            <button
              onClick={() => onDeletar(id, descricao)}
              title={quantidade_selecionada > 0
                ? `Não é possível remover: ${quantidade_selecionada} seleção(ões) ativa(s)`
                : 'Remover item'
              }
              style={{
                background: 'transparent',
                border: `1px solid ${quantidade_selecionada > 0 ? 'rgba(148,163,184,0.2)' : 'rgba(239,68,68,0.3)'}`,
                color: quantidade_selecionada > 0 ? '#94a3b8' : '#ef4444',
                borderRadius: '6px', padding: '0.2rem 0.45rem',
                cursor: quantidade_selecionada > 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
              }}
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div style={{ marginTop: '0.5rem' }}>
        <div className="vagas-bar" style={{ height: '5px' }}>
          <div
            className="vagas-fill"
            style={{
              width: `${pct}%`,
              background: lotado ? 'linear-gradient(90deg, #ef4444, #f97316)' : undefined,
            }}
          />
        </div>
        {quantidade_restante > 0 && (
          <div style={{
            fontSize: '0.68rem',
            color: 'var(--cor-texto-suave)',
            marginTop: '2px',
          }}>
            Restam{' '}
            <strong>
              {formatQuantidade(quantidade_restante)} {unidade}
            </strong>
          </div>
        )}
      </div>

      {/* Lista de quem vai levar */}
      {item.selecionadores && item.selecionadores.length > 0 && (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {item.selecionadores.map((sel, idx) => {
            // Cor do chip varia pelo status da seleção
            const chipCor = sel.status === 'confirmado'
              ? { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  text: '#10b981' }
              : sel.status === 'nao_entregue'
              ? { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',  text: '#ef4444' }
              : { bg: 'rgba(212,175,55,0.08)',  border: 'rgba(212,175,55,0.2)',  text: '#d4af37' };

            return (
              <span
                key={idx}
                title={sel.status === 'confirmado' ? 'Entregou ✓' : sel.status === 'nao_entregue' ? 'Não entregou ✗' : 'Vai levar'}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  background: chipCor.bg,
                  border: `1px solid ${chipCor.border}`,
                  color: chipCor.text,
                  borderRadius: '20px',
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {/* Inicial do nome como avatar minimalista */}
                <span style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: chipCor.border,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, color: chipCor.text,
                  flexShrink: 0,
                }}>
                  {sel.nome.charAt(0).toUpperCase()}
                </span>
                {sel.nome.split(' ')[0]}
                {' '}
                {formatQuantidade(sel.quantidade)}
                {' '}
                {unidade}
                {sel.status === 'confirmado' && ' ✓'}
                {sel.status === 'nao_entregue' && ' ✗'}
              </span>
            );
          })}
        </div>
      )}

      {/* Botões de confirmação admin pós-gira */}
      {renderBotoesAdmin()}
    </div>
  );
}


function formatQuantidade(valor) {
  if (valor == null) return '';

  return Number(valor)
    .toLocaleString('pt-BR', {
      maximumFractionDigits: 3
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function AjeumPanel({ giraId, isAdmin, giraStatus }) {
  const [dados,   setDados]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const giraConcluida = giraStatus === 'concluida';

  // toast e fecharToast ANTES de carregar — carregar usa exibirToast internamente
  const exibirToast = useCallback((mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo });
  }, []);

  const fecharToast = useCallback(() => setToast(null), []);

  const carregar = useCallback(async () => {
    try {
      // GET do Ajeum da gira (api.get(`/giras/${giraId}/ajeum`)
      const res = await listAjeum(giraId); // gira sem Ajeum retorna 404
      setDados(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setDados(null); // gira sem Ajeum — estado vazio, não é erro
      } else {
        exibirToast('Erro ao carregar lista de itens.', 'erro');
      }
    } finally {
      setLoading(false);
    }
  }, [giraId, exibirToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelecionar = async (itemId, quantidade) => {
  try {
    await selecionarItemAjeum(itemId, {quantidade});

    await carregar();

    exibirToast('Item adicionado à sua lista!');

  } catch (err) {
    if (err.response?.status === 409) {
      await carregar();

      exibirToast(
        'A quantidade disponível mudou. A lista foi atualizada.',
        'erro'
      );

    } else if (
      err.response?.status === 400 ||
      err.response?.status === 422
    ) {
      exibirToast(
        err.response.data.detail ||
        'Não foi possível selecionar.',
        'erro'
      );

    } else {
      exibirToast(
        'Erro ao selecionar item. Tente novamente.',
        'erro'
      );
    }
  }
};

  const handleCancelar = async (selecaoId) => {
    try {
      // DELETE para remover a seleção do membro (api.delete(`/ajeum/selecoes/${selecaoId}`))
      await deleteSelecaoAjeum(selecaoId);
      await carregar();
      exibirToast('Seleção cancelada.');
    } catch (err) {
      if (err.response?.status === 400) {
        exibirToast(err.response.data.detail, 'erro');
      } else {
        exibirToast('Erro ao cancelar. Tente novamente.', 'erro');
      }
    }
  };

  const handleConfirmar = async (selecaoId, novoStatus, version) => {
    try {
      // PATCH para atualizar o status da seleção (confirmado / nao_entregue) (api.patch(`/ajeum/selecoes/${selecaoId}/confirmar`, { novo_status: novoStatus, version });)
      await updateStatusSelecaoAjeum(selecaoId, novoStatus, version);
      await carregar();
      exibirToast(novoStatus === 'confirmado' ? 'Entrega confirmada!' : 'Não-entrega registrada.');
    } catch (err) {
      if (err.response?.status === 409) {
        await carregar();
        exibirToast('Este registro foi modificado por outro usuário. A tela foi atualizada.', 'erro');
      } else if (err.response?.status === 400) {
        exibirToast(err.response.data.detail, 'erro');
      } else {
        exibirToast('Erro ao confirmar. Tente novamente.', 'erro');
      }
    }
  };

  const handleEditar = async (itemId, dadosEdicao) => {
    try {
      // PATCH para atualizar o item do Ajeum (api.patch(`/ajeum/itens/${itemId}`, dadosEdicao);)
      await updateAjeumItem(itemId, dadosEdicao);
      await carregar();
      exibirToast('Item atualizado.');
    } catch (err) {
      if (err.response?.status === 409) {
        // Limite menor que seleções ativas — backend retorna detail explicativo
        exibirToast(err.response.data.detail, 'erro');
      } else if (err.response?.status === 400) {
        exibirToast(err.response.data.detail || 'Dados inválidos.', 'erro');
      } else {
        exibirToast('Erro ao editar item. Tente novamente.', 'erro');
      }
      // Re-lança para que ItemCard mantenha o modo de edição aberto em caso de erro
      throw err;
    }
  };

  const handleDeletar = async (itemId, descricaoItem) => {
    try {
      // DELETE para remover o item do Ajeum (api.delete(`/ajeum/itens/${itemId}`);)
      await deleteAjeumItem(itemId);
      await carregar();
      exibirToast(`"${descricaoItem}" removido da lista.`);
    } catch (err) {
      if (err.response?.status === 409) {
        // Item com seleções ativas — backend retorna mensagem descritiva
        exibirToast(err.response.data.detail, 'erro');
      } else {
        exibirToast('Erro ao remover item. Tente novamente.', 'erro');
      }
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
        <div className="spinner-gold"></div>
      </div>
    );
  }

  // ── Render: sem Ajeum ─────────────────────────────────────────────────────
  if (!dados) {
    if (!isAdmin) return null; // membro não vê nada sem lista

    // Admin vê o formulário de criação
    return (
      <div className="card-custom mb-4">
        <div className="card-header">
          <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
            ✦ Ajeum — Lista de Itens
          </span>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
            Sem lista criada
          </span>
        </div>

        {toast && (
          <div style={{ padding: '0.75rem 1rem 0' }}>
            <ToastFeedback mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
          </div>
        )}

        <div style={{
          padding: '0.75rem 1.25rem 0',
          fontSize: '0.82rem', color: 'var(--cor-texto-suave)',
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}>
          <i className="bi bi-info-circle" style={{ color: 'var(--cor-acento)', flexShrink: 0, marginTop: '1px' }}></i>
          Monte a lista de itens que os membros precisam levar.
          Defina o limite de pessoas por item para controlar a quantidade.
        </div>

        <FormCriarAjeum
          giraId={giraId}
          onCriado={carregar}
          exibirToast={exibirToast}
        />
      </div>
    );
  }

  // ── Render: painel com itens ──────────────────────────────────────────────
  const totalItens        = dados.itens.length;
  const totalSelecionados = dados.itens.filter(i => i.meu_status === 'selecionado').length;
  const totalLotados      = dados.itens.filter(i => i.lotado && !i.meu_status).length;

  return (
    <div className="card-custom mb-4">
      {/* Header */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Ajeum — Lista de Itens
        </span>

        {totalSelecionados > 0 && (
          <span style={{ fontSize: '0.72rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '20px', padding: '1px 8px' }}>
            ✓ {totalSelecionados} item{totalSelecionados > 1 ? 'ns' : ''} na sua lista
          </span>
        )}

        {totalLotados > 0 && (
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '20px', padding: '1px 8px' }}>
            {totalLotados} esgotado{totalLotados > 1 ? 's' : ''}
          </span>
        )}

        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
          {totalItens} item{totalItens !== 1 ? 'ns' : ''}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ padding: '0.75rem 1rem 0' }}>
          <ToastFeedback mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
        </div>
      )}

      {/* Observações do Ajeum */}
      {dados.observacoes && (
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.82rem', color: 'var(--cor-texto-suave)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <i className="bi bi-info-circle" style={{ color: 'var(--cor-acento)', flexShrink: 0 }}></i>
          {dados.observacoes}
        </div>
      )}

      {/* Lista de itens */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {dados.itens.length === 0 && !isAdmin && (
          <div className="empty-state"><p>Nenhum item nesta lista.</p></div>
        )}

        {dados.itens.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            giraConcluida={giraConcluida}
            onSelecionar={handleSelecionar}
            onCancelar={handleCancelar}
            onConfirmar={handleConfirmar}
            onEditar={handleEditar}
            onDeletar={handleDeletar}
          />
        ))}

        {/* Formulário de adicionar item — apenas admin, antes da gira concluir */}
        {isAdmin && !giraConcluida && (
          <FormAdicionarItem
            ajeum_id={dados.id}
            onAdicionado={carregar}
            exibirToast={exibirToast}
          />
        )}
      </div>

      {/* Legenda para membros */}
      {dados.itens.length > 0 && !giraConcluida && !isAdmin && (
        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--cor-borda)', fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
          Clique em "+ Vou levar" para se comprometer a trazer o item. Você pode desmarcar até o dia da gira.
        </div>
      )}
    </div>
  );
}