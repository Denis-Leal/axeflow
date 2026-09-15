import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';

import { useAgendamentos } from '../hooks/useAgendamentos';
import { useAtendimentos } from '../hooks/useAtendimentos';
import { useIsMobile } from '../hooks/useMediaQuery';

import { handleApiError } from '../services/errorHandler';
import { formatPhone } from '../utils/format';

import {
  createConsulente,
  getMe,
  listConsulentes,

  listContasReceber,
  createContaReceber,
  getContaReceber,

  listPagamentos,
  createPagamento,

  gerarRecibo,
  getReciboPdf,
  listFormasPagamento,
} from '../services/api';


/* ============================================================
   UTILITÁRIOS
============================================================ */

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });


function isoDate(dt) {
  return dt ? String(dt).slice(0, 10) : '';
}


function isoTime(dt) {
  return dt ? String(dt).slice(11, 16) : '';
}


function formatDateTime(dt) {
  if (!dt) return '-';

  const raw = String(dt);
  const d = raw.slice(0, 10).split('-').reverse().join('/');
  const h = raw.slice(11, 16);

  return `${d} ${h}`;
}


function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}


function formatarData(data) {
  if (!data) return '-';

  return new Date(data).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}


function statusBadge(status) {
  const map = {
    agendado: ['badge-confirmado', 'Agendado'],
    concluido: ['badge-concluida', 'Concluído'],
    cancelado: ['badge-cancelado', 'Cancelado'],
  };

  const [classe, label] =
    map[status] || ['badge-cancelado', status];

  return (
    <span className={`badge-status ${classe}`}>
      {label}
    </span>
  );
}


function statusFinanceiroBadge(status) {
  const map = {
    pendente: ['badge-cancelado', 'Pendente'],
    parcial: ['badge-confirmado', 'Parcial'],
    pago: ['badge-concluida', 'Pago'],
    cancelado: ['badge-cancelado', 'Cancelado'],
  };

  const [classe, label] =
    map[status] || ['badge-cancelado', status || '-'];

  return (
    <span className={`badge-status ${classe}`}>
      {label}
    </span>
  );
}


/* ============================================================
   PREVIEW DO VALOR DO AGENDAMENTO
============================================================ */

function calcularPreview(tipo, form) {
  if (!tipo) return null;

  if (tipo.tipo_cobranca === 'servico') {
    return {
      duracao: null,
      valor: Number(tipo.valor || 0),
    };
  }

  if (!form.hora_inicio || !form.hora_fim) {
    return null;
  }

  const inicio = new Date(
    `${form.data || '2000-01-01'}T${form.hora_inicio}:00`
  );

  const fim = new Date(
    `${form.data || '2000-01-01'}T${form.hora_fim}:00`
  );

  const horas = (fim - inicio) / 3600000;

  if (horas <= 0) return null;

  return {
    duracao: horas,
    valor: Number(tipo.valor || 0) * horas,
  };
}


/* ============================================================
   MODAL DE AGENDAMENTO
============================================================ */

function AgendamentoModal({
  agendamento,
  tipos,
  consulentes,
  onClose,
  onSave,
  onConsulenteCriado,
}) {
  const [form, setForm] = useState({
    consulente_id: agendamento?.consulente_id || '',
    atendimento_tipo_id:
      agendamento?.atendimento_tipo_id || '',
    data: isoDate(agendamento?.inicio) || '',
    hora_inicio: isoTime(agendamento?.inicio) || '',
    hora_fim: isoTime(agendamento?.fim) || '',
    observacoes: agendamento?.observacoes || '',
  });

  const [novoConsulente, setNovoConsulente] = useState({
    aberto: false,
    nome: '',
    telefone: '',
  });

  const [salvando, setSalvando] = useState(false);

  const tiposDisponiveis = useMemo(() => {
    if (!agendamento?.atendimento_tipo) {
      return tipos;
    }

    if (
      tipos.some(
        (t) => t.id === agendamento.atendimento_tipo.id
      )
    ) {
      return tipos;
    }

    return [
      ...tipos,
      agendamento.atendimento_tipo,
    ];
  }, [agendamento, tipos]);

  const tipoSelecionado = tiposDisponiveis.find(
    (t) => t.id === form.atendimento_tipo_id
  );

  const preview = calcularPreview(
    tipoSelecionado,
    form
  );

  useEffect(() => {
    if (
      tipoSelecionado?.tipo_cobranca === 'servico'
    ) {
      setForm((v) => ({
        ...v,
        hora_fim: '',
      }));
    }
  }, [tipoSelecionado?.tipo_cobranca]);

  const criarNovoConsulente = async () => {
    if (!novoConsulente.nome.trim()) {
      toast.error('Informe o nome do consulente.');
      return;
    }

    try {
      const res = await createConsulente({
        nome: novoConsulente.nome.trim(),
        telefone:
          novoConsulente.telefone.trim() || null,
        source: 'cadastro_manual',
      });

      await onConsulenteCriado();

      setForm((v) => ({
        ...v,
        consulente_id: res.data.id,
      }));

      setNovoConsulente({
        aberto: false,
        nome: '',
        telefone: '',
      });

      toast.success('Consulente cadastrado');
    } catch (err) {
      toast.error(
        handleApiError(
          err,
          'Cadastrar consulente'
        )
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.consulente_id ||
      !form.atendimento_tipo_id ||
      !form.data ||
      !form.hora_inicio
    ) {
      return;
    }

    if (
      tipoSelecionado?.tipo_cobranca === 'hora' &&
      !form.hora_fim
    ) {
      return;
    }

    setSalvando(true);

    try {
      await onSave({
        consulente_id: form.consulente_id,
        atendimento_tipo_id:
          form.atendimento_tipo_id,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim:
          tipoSelecionado?.tipo_cobranca === 'hora'
            ? form.hora_fim
            : null,
        observacoes:
          form.observacoes.trim() || null,
      });

      toast.success(
        agendamento
          ? 'Agendamento atualizado'
          : 'Agendamento criado'
      );

      onClose();
    } catch (err) {
      toast.error(
        handleApiError(
          err,
          'Salvar agendamento'
        )
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--cor-card)',
          border: '1px solid var(--cor-borda)',
          borderRadius: 12,
          padding: '1.5rem',
          width: '100%',
          maxWidth: 640,
        }}
      >
        <h5
          style={{
            fontFamily: 'Cinzel',
            color: 'var(--cor-acento)',
            marginBottom: '1rem',
          }}
        >
          {agendamento
            ? 'Editar Agendamento'
            : 'Novo Agendamento'}
        </h5>

        <div
          style={{
            display: 'grid',
            gap: '0.85rem',
          }}
        >
          <div>
            <label className="form-label-custom">
              Consulente
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.5rem',
              }}
            >
              <select
                className="form-control-custom"
                value={form.consulente_id}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    consulente_id:
                      e.target.value,
                  }))
                }
                required
              >
                <option value="">
                  Selecione
                </option>

                {consulentes.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.nome}
                    {c.telefone
                      ? ` - ${formatPhone(
                          c.telefone
                        )}`
                      : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-outline-gold"
                onClick={() =>
                  setNovoConsulente((v) => ({
                    ...v,
                    aberto: !v.aberto,
                  }))
                }
              >
                <i className="bi bi-person-plus" />
              </button>
            </div>
          </div>

          {novoConsulente.aberto && (
            <div
              style={{
                border:
                  '1px solid var(--cor-borda)',
                borderRadius: 8,
                padding: '0.85rem',
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.5rem',
                }}
              >
                <input
                  className="form-control-custom"
                  placeholder="Nome do consulente"
                  value={novoConsulente.nome}
                  onChange={(e) =>
                    setNovoConsulente(
                      (v) => ({
                        ...v,
                        nome: e.target.value,
                      })
                    )
                  }
                />

                <input
                  className="form-control-custom"
                  placeholder="Telefone"
                  value={
                    novoConsulente.telefone
                  }
                  onChange={(e) =>
                    setNovoConsulente(
                      (v) => ({
                        ...v,
                        telefone:
                          e.target.value,
                      })
                    )
                  }
                />

                <button
                  type="button"
                  className="btn-gold"
                  onClick={
                    criarNovoConsulente
                  }
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="form-label-custom">
              Tipo de atendimento
            </label>

            <select
              className="form-control-custom"
              value={
                form.atendimento_tipo_id
              }
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  atendimento_tipo_id:
                    e.target.value,
                }))
              }
              required
            >
              <option value="">
                Selecione
              </option>

              {tiposDisponiveis.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.nome} -{' '}
                  {money(t.valor)}
                  {t.tipo_cobranca ===
                  'hora'
                    ? ' / hora'
                    : ''}
                  {t.ativo === false
                    ? ' (inativo)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <label className="form-label-custom">
                Data
              </label>

              <input
                className="form-control-custom"
                type="date"
                value={form.data}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    data: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div>
              <label className="form-label-custom">
                {tipoSelecionado?.tipo_cobranca ===
                'hora'
                  ? 'Hora inicial'
                  : 'Hora'}
              </label>

              <input
                className="form-control-custom"
                type="time"
                value={form.hora_inicio}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    hora_inicio:
                      e.target.value,
                  }))
                }
                required
              />
            </div>

            {tipoSelecionado?.tipo_cobranca ===
              'hora' && (
              <div>
                <label className="form-label-custom">
                  Hora final
                </label>

                <input
                  className="form-control-custom"
                  type="time"
                  value={form.hora_fim}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      hora_fim:
                        e.target.value,
                    }))
                  }
                  required
                />
              </div>
            )}
          </div>

          {tipoSelecionado && (
            <div
              style={{
                background:
                  'rgba(212,175,55,0.08)',
                border:
                  '1px solid rgba(212,175,55,0.25)',
                borderRadius: 8,
                padding: '0.75rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                color: 'var(--cor-texto)',
              }}
            >
              <span>
                {tipoSelecionado.tipo_cobranca ===
                'hora'
                  ? 'Por hora'
                  : 'Por serviço'}
              </span>

              {preview?.duracao && (
                <span>
                  Duração:{' '}
                  {preview.duracao.toLocaleString(
                    'pt-BR'
                  )}
                  h
                </span>
              )}

              <strong
                style={{
                  color:
                    'var(--cor-acento)',
                }}
              >
                Valor:{' '}
                {preview
                  ? money(preview.valor)
                  : money(
                      tipoSelecionado.valor
                    )}
              </strong>
            </div>
          )}

          <div>
            <label className="form-label-custom">
              Observações
            </label>

            <textarea
              className="form-control-custom"
              rows={3}
              value={form.observacoes}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  observacoes:
                    e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '1.25rem',
          }}
        >
          <button
            type="button"
            className="btn-outline-gold"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            className="btn-gold"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando...'
              : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}


/* ============================================================
   MODAL FINANCEIRO DO AGENDAMENTO
============================================================ */

function FinanceiroAgendamentoModal({
  aberto,
  conta,
  pagamentos,
  formas,
  agendamento,
  onFechar,
  onCriarCobranca,
  onPagar,
  onRecibo,
}) {
  if (!aberto) return null;

  const valorAgendamento = Number(
    agendamento?.valor ||
      conta?.valor ||
      0
  );

  const totalPago = pagamentos.reduce(
    (total, pagamento) =>
      total + Number(pagamento.valor || 0),
    0
  );

  const restante = Math.max(
    valorAgendamento - totalPago,
    0
  );

  const semCobranca = conta?.inexistente;

  return (
    <div
      className="modal d-block"
      style={{
        background: 'rgba(0,0,0,.65)',
        zIndex: 1050,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onFechar();
        }
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content card-custom">
          <div className="modal-header">
            <div>
              <h5 className="modal-title">
                Financeiro
              </h5>

              <small>
                {agendamento?.consulente ?.nome || 'Agendamento'}
              </small>
            </div>

            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onFechar}
            />
          </div>

          <div className="modal-body">
            {semCobranca ? (
              <>
                <div className="alert alert-secondary">
                  Este agendamento ainda não
                  possui uma conta a receber.
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <small>
                      Atendimento
                    </small>

                    <div className="fw-semibold">
                      {agendamento
                        ?.atendimento_tipo
                        ?.nome || '—'}
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <small>
                      Valor
                    </small>

                    <div className="fw-semibold">
                      {formatarMoeda(
                        valorAgendamento
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    className="btn btn-gold"
                    onClick={
                      onCriarCobranca
                    }
                  >
                    <i className="bi bi-receipt me-1" />
                    Gerar cobrança
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-4">
                    <small >
                      Valor
                    </small>

                    <div className="fs-5 fw-semibold">
                      {formatarMoeda(
                        conta.valor
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <small >
                      Pago
                    </small>

                    <div className="fs-5 fw-semibold">
                      {formatarMoeda(
                        totalPago
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <small >
                      Restante
                    </small>

                    <div className="fs-5 fw-semibold">
                      {formatarMoeda(
                        restante
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <strong>
                    Status:
                  </strong>{' '}
                  {statusFinanceiroBadge(
                    conta.status
                  )}
                </div>

                <h6>Pagamentos</h6>

                {pagamentos.length === 0 ? (
                  <div className="py-3">
                    Nenhum pagamento registrado.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-custom">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Forma</th>
                          <th>Valor</th>
                          <th>Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {pagamentos.map(
                          (pagamento) => {
                            const forma =
                              formas.find(
                                (item) =>
                                  String(
                                    item.id
                                  ) ===
                                  String(
                                    pagamento.forma_pagamento_id
                                  )
                              );

                            return (
                              <tr
                                key={
                                  pagamento.id
                                }
                              >
                                <td>
                                  {formatarData(
                                    pagamento.data_pagamento
                                  )}
                                </td>

                                <td>
                                  {forma?.nome ||
                                    '—'}
                                </td>

                                <td>
                                  {formatarMoeda(
                                    pagamento.valor
                                  )}
                                </td>

                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-gold"
                                    onClick={() => onRecibo(pagamento.id, pagamento.recibo_id)}
                                  >
                                    <i className={`bi ${pagamento.recibo_id ? 'bi-file-earmark-pdf' : 'bi-receipt'} me-1`} />
                                    {pagamento.recibo_id ? 'Ver recibo' : 'Recibo'}
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {conta.status !== 'pago' &&
                  conta.status !== 'cancelado' && (
                    <button
                      className="btn btn-gold mt-3"
                      onClick={onPagar}
                    >
                      <i className="bi bi-cash-coin me-1" />
                      Registrar pagamento
                    </button>
                  )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-outline-gold"
              onClick={onFechar}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   MODAL DE PAGAMENTO
============================================================ */

function PagamentoAgendamentoModal({
  aberto,
  conta,
  formas,
  onFechar,
  onSucesso,
}) {
  const [formaPagamentoId, setFormaPagamentoId] =
    useState('');

  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] =
    useState('');

  const [salvando, setSalvando] =
    useState(false);

  useEffect(() => {
    if (!aberto) return;

    setFormaPagamentoId(
      formas.find((forma) => forma.ativo)
        ?.id || ''
    );

    setValor('');
    setObservacoes('');
  }, [aberto, formas]);

  if (!aberto || !conta) {
    return null;
  }

  const totalConta = Number(
    conta.valor || 0
  );

  const salvar = async (e) => {
    e.preventDefault();

    const valorPagamento = Number(
      String(valor).replace(',', '.')
    );

    if (!formaPagamentoId) {
      toast.error(
        'Selecione a forma de pagamento.'
      );
      return;
    }

    if (
      !valorPagamento ||
      valorPagamento <= 0
    ) {
      toast.error(
        'Informe um valor válido.'
      );
      return;
    }

    setSalvando(true);

    try {
      await createPagamento(
        conta.id,
        {
          forma_pagamento_id:
            formaPagamentoId,
          valor: valorPagamento,
          ...(observacoes.trim()
            ? {
                observacoes:
                  observacoes.trim(),
              }
            : {}),
        }
      );

      toast.success(
        'Pagamento registrado.'
      );

      onSucesso();
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível registrar o pagamento.'
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <form
        onSubmit={salvar}
        style={{
          background: 'var(--cor-card)',
          border:
            '1px solid var(--cor-borda)',
          borderRadius: 12,
          padding: '1.5rem',
          width: '100%',
          maxWidth: 480,
        }}
      >
        <h5
          style={{
            fontFamily: 'Cinzel',
            color: 'var(--cor-acento)',
            marginBottom: '1.25rem',
          }}
        >
          Registrar pagamento
        </h5>

        <div
          style={{
            display: 'grid',
            gap: '1rem',
          }}
        >
          <div>
            <label className="form-label-custom">
              Forma de pagamento
            </label>

            <select
              className="form-control-custom"
              value={formaPagamentoId}
              onChange={(e) =>
                setFormaPagamentoId(
                  e.target.value
                )
              }
              required
            >
              <option value="">
                Selecione
              </option>

              {formas
                .filter(
                  (forma) => forma.ativo
                )
                .map((forma) => (
                  <option
                    key={forma.id}
                    value={forma.id}
                  >
                    {forma.nome}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="form-label-custom">
              Valor
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              max={totalConta}
              className="form-control-custom"
              value={valor}
              onChange={(e) =>
                setValor(
                  e.target.value
                )
              }
              required
            />

            <small >
              Valor da conta:{' '}
              {formatarMoeda(
                totalConta
              )}
            </small>
          </div>

          <div>
            <label className="form-label-custom">
              Observações
            </label>

            <textarea
              className="form-control-custom"
              rows={3}
              maxLength={2000}
              value={observacoes}
              onChange={(e) =>
                setObservacoes(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent:
              'flex-end',
            gap: '0.75rem',
            marginTop: '1.25rem',
          }}
        >
          <button
            type="button"
            className="btn-outline-gold"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-gold"
            disabled={salvando}
          >
            {salvando
              ? 'Registrando...'
              : 'Registrar pagamento'}
          </button>
        </div>
      </form>
    </div>
  );
}


/* ============================================================
   CARD MOBILE
============================================================ */

function AgendamentoCard({
  item,
  podeGerenciar,
  contaFinanceira,
  onEdit,
  onCancelar,
  onConcluir,
  onFinanceiro,
}) {
  const tipo = item.atendimento_tipo;
  const consulente = item.consulente;

  return (
    <div
      style={{
        background: 'var(--cor-card)',
        border:
          '1px solid var(--cor-borda)',
        borderRadius: 10,
        padding: '0.85rem',
        marginBottom: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          gap: '0.75rem',
        }}
      >
        <div>
          <strong>
            {consulente?.nome ||
              'Consulente'}
          </strong>

          <div
            style={{
              color:
                'var(--cor-texto-suave)',
              fontSize: '0.8rem',
            }}
          >
            {tipo?.nome ||
              'Atendimento'}
          </div>
        </div>

        {statusBadge(item.status)}
      </div>

      <div
        style={{
          marginTop: '0.65rem',
        }}
      >
        {contaFinanceira ? (
          <span className="badge-status">
            Financeiro:{' '}
            {contaFinanceira.status}
          </span>
        ) : (
          <span
            style={{
              color:
                'var(--cor-texto-suave)',
              fontSize: '0.8rem',
            }}
          >
            Sem cobrança
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: '0.75rem',
          color:
            'var(--cor-texto-suave)',
          display: 'grid',
          gap: '0.25rem',
          fontSize: '0.85rem',
        }}
      >
        <span>
          <i className="bi bi-clock me-1" />
          {formatDateTime(item.inicio)}

          {tipo?.tipo_cobranca ===
            'hora' &&
            ` até ${isoTime(
              item.fim
            )}`}
        </span>

        <span>
          <i className="bi bi-cash-coin me-1" />
          {money(item.valor)}
        </span>

        {consulente?.telefone && (
          <span>
            <i className="bi bi-telephone me-1" />
            {formatPhone(
              consulente.telefone
            )}
          </span>
        )}
      </div>

      {podeGerenciar && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.75rem',
          }}
        >
          <button
            className="btn-outline-gold"
            onClick={() =>
              onEdit(item)
            }
          >
            <i className="bi bi-pencil me-1" />
            Editar
          </button>

          {item.status ===
            'agendado' && (
            <button
              className="btn-outline-gold"
              onClick={() =>
                onConcluir(item)
              }
            >
              <i className="bi bi-check2 me-1" />
              Concluir
            </button>
          )}

          {item.status ===
            'agendado' && (
            <button
              className="btn-outline-gold"
              onClick={() =>
                onCancelar(item)
              }
              style={{
                color: '#ef4444',
                borderColor:
                  'rgba(239,68,68,0.45)',
              }}
            >
              <i className="bi bi-x-lg me-1" />
              Cancelar
            </button>
          )}

          <button
            type="button"
            className="btn-outline-gold"
            onClick={() =>
              onFinanceiro(item)
            }
          >
            <i className="bi bi-cash-coin me-1" />
            Financeiro
          </button>
        </div>
      )}
    </div>
  );
}


/* ============================================================
   PÁGINA
============================================================ */

export default function AgendamentosPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [status, setStatus] =
    useState('');

  const [user, setUser] =
    useState(null);

  const [carregandoUsuario, setCarregandoUsuario] =
    useState(true);

  const [consulentes, setConsulentes] =
    useState([]);

  const [busca, setBusca] =
    useState('');

  const [modalForm, setModalForm] =
    useState(null);

  const [modalConfirm, setModalConfirm] =
    useState({
      aberto: false,
    });


  /* ========================================================
     ESTADO FINANCEIRO
  ======================================================== */

  const [contasFinanceiras, setContasFinanceiras] =
    useState([]);

  const [formasPagamento, setFormasPagamento] =
    useState([]);

  const [contaFinanceira, setContaFinanceira] =
    useState(null);

  const [pagamentosFinanceiros, setPagamentosFinanceiros] =
    useState([]);

  const [modalFinanceiro, setModalFinanceiro] =
    useState(false);

  const [modalPagamento, setModalPagamento] =
    useState(false);

  const [carregandoFinanceiro, setCarregandoFinanceiro] =
    useState(false);


  const podeGerenciarAgendamentos =
    ['admin', 'operador'].includes(
      user?.role
    );


  /* ========================================================
     AGENDAMENTOS
  ======================================================== */

  const {
    agendamentos,
    loading,
    criar,
    atualizar,
    cancelar,
    concluir,
  } = useAgendamentos(
    status || null
  );

  const {
    atendimentos: tiposAtivos,
  } = useAtendimentos({
    ativos: true,
  });


  /* ========================================================
     FINANCEIRO
  ======================================================== */

  const carregarFinanceiro =
    async () => {
      try {
        const [
          contasResponse,
          formasResponse,
        ] = await Promise.all([
          listContasReceber(),
          listFormasPagamento(true),
        ]);

        setContasFinanceiras(
          contasResponse.data || []
        );

        setFormasPagamento(
          formasResponse.data || []
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.detail ||
            'Não foi possível carregar os dados financeiros.'
        );
      }
    };


  const abrirFinanceiroAgendamento =
    async (agendamento) => {
      setCarregandoFinanceiro(true);

      try {
        let conta =
          contasFinanceiras.find(
            (item) =>
              String(
                item.agendamento_id
              ) ===
              String(
                agendamento.id
              )
          );

        /*
         * Se não encontrou no cache,
         * consulta a lista novamente.
         */
        if (!conta) {
          const response =
            await listContasReceber();

          const contas =
            response.data || [];

          setContasFinanceiras(
            contas
          );

          conta =
            contas.find(
              (item) =>
                String(
                  item.agendamento_id
                ) ===
                String(
                  agendamento.id
                )
            );
        }


        /*
         * Ainda não existe cobrança.
         */
        if (!conta) {
          setContaFinanceira({
            inexistente: true,
            agendamento,
          });

          setPagamentosFinanceiros(
            []
          );

          setModalFinanceiro(true);

          return;
        }


        const [
          contaResponse,
          pagamentosResponse,
        ] = await Promise.all([
          getContaReceber(
            conta.id
          ),
          listPagamentos(
            conta.id
          ),
        ]);

        setContaFinanceira(
          contaResponse.data
        );

        setPagamentosFinanceiros(
          pagamentosResponse.data ||
            []
        );

        setModalFinanceiro(true);
      } catch (error) {
        toast.error(
          error.response?.data
            ?.detail ||
            'Não foi possível carregar o financeiro.'
        );
      } finally {
        setCarregandoFinanceiro(
          false
        );
      }
    };


  const criarCobrancaAgendamento =
    async () => {
      if (
        !contaFinanceira?.agendamento
      ) {
        return;
      }

      try {
        const response =
          await createContaReceber({
            agendamento_id:
              contaFinanceira
                .agendamento.id,
          });

        const conta =
          response.data;

        setContaFinanceira(
          conta
        );

        setPagamentosFinanceiros(
          []
        );

        setContasFinanceiras(
          (atual) => [
            ...atual,
            conta,
          ]
        );

        toast.success(
          'Conta a receber criada.'
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.detail ||
            'Não foi possível criar a cobrança.'
        );
      }
    };


  const atualizarFinanceiro =
    async () => {
      if (
        !contaFinanceira ||
        contaFinanceira.inexistente
      ) {
        return;
      }

      try {
        const [
          contaResponse,
          pagamentosResponse,
        ] = await Promise.all([
          getContaReceber(
            contaFinanceira.id
          ),
          listPagamentos(
            contaFinanceira.id
          ),
        ]);

        setContaFinanceira(
          contaResponse.data
        );

        setPagamentosFinanceiros(
          pagamentosResponse.data ||
            []
        );

        /*
         * Atualiza também o cache
         * utilizado nos cards.
         */
        setContasFinanceiras(
          (atual) =>
            atual.map((conta) =>
              String(conta.id) ===
              String(
                contaResponse
                  .data.id
              )
                ? contaResponse.data
                : conta
            )
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.detail ||
            'Não foi possível atualizar o financeiro.'
        );
      }
    };


  /* ========================================================
     CONSULENTES
  ======================================================== */

  const carregarConsulentes =
    async () => {
      try {
        const res =
          await listConsulentes();

        setConsulentes(
          res.data || []
        );
      } catch (err) {
        toast.error(
          handleApiError(
            err,
            'Carregar consulentes'
          )
        );
      }
    };


  /* ========================================================
     AUTENTICAÇÃO
  ======================================================== */

  useEffect(() => {
    const token =
      localStorage.getItem(
        'token'
      );

    if (!token) {
      router.replace('/login');
      return;
    }

    getMe()
      .then((r) => {
        setUser(r.data);

        if (
          ['admin', 'operador'].includes(
            r.data?.role
          )
        ) {
          carregarConsulentes();
        }
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => {
        setCarregandoUsuario(
          false
        );
      });
  }, [router]);


  useEffect(() => {
    if (
      !carregandoUsuario &&
      user &&
      !podeGerenciarAgendamentos
    ) {
      toast.error(
        'Você não tem permissão para acessar esta página'
      );

      router.replace('/');
    }
  }, [
    carregandoUsuario,
    user,
    podeGerenciarAgendamentos,
    router,
  ]);


  /* ========================================================
     ACTION=NOVO
  ======================================================== */

  useEffect(() => {
    if (!router.isReady) return;

    if (
      router.query.action ===
      'novo'
    ) {
      setModalForm({});
    }
  }, [
    router.isReady,
    router.query.action,
  ]);


  /* ========================================================
     CARREGAR FINANCEIRO
  ======================================================== */

  useEffect(() => {
    if (
      carregandoUsuario ||
      !user ||
      !podeGerenciarAgendamentos
    ) {
      return;
    }

    carregarFinanceiro();
  }, [
    carregandoUsuario,
    user,
    podeGerenciarAgendamentos,
  ]);


  /* ========================================================
     FILTRO
  ======================================================== */

  const filtrados = useMemo(
    () =>
      agendamentos.filter(
        (item) => {
          const alvo =
            `${item.consulente?.nome || ''} ${
              item.atendimento_tipo
                ?.nome || ''
            }`.toLowerCase();

          return alvo.includes(
            busca.toLowerCase()
          );
        }
      ),
    [agendamentos, busca]
  );


  /* ========================================================
     LOADING
  ======================================================== */

  if (
    carregandoUsuario ||
    !user
  ) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems:
            'center',
          justifyContent:
            'center',
        }}
      >
        <div className="spinner-gold" />
      </div>
    );
  }


  if (
    !podeGerenciarAgendamentos
  ) {
    return null;
  }


  const podeGerenciar =
    ['admin', 'operador'].includes(
      user?.role
    );


  /* ========================================================
     SALVAR AGENDAMENTO
  ======================================================== */

  const handleSave = (data) =>
    modalForm?.id
      ? atualizar(
          modalForm.id,
          data
        )
      : criar(data);


  /* ========================================================
     CONFIRMAR STATUS
  ======================================================== */

  const confirmarStatus = (
    item,
    acao
  ) => {
    const concluindo =
      acao === 'concluir';

    setModalConfirm({
      aberto: true,

      titulo: concluindo
        ? 'Concluir agendamento'
        : 'Cancelar agendamento',

      mensagem: `${
        concluindo
          ? 'Concluir'
          : 'Cancelar'
      } o agendamento de ${
        item.consulente?.nome ||
        'consulente'
      } em ${formatDateTime(
        item.inicio
      )}?`,

      labelConfirmar:
        concluindo
          ? 'Concluir'
          : 'Cancelar',

      tipoBotao:
        concluindo
          ? 'sucesso'
          : 'perigo',

      onConfirmar:
        async () => {
          setModalConfirm({
            aberto: false,
          });

          try {
            await (
              concluindo
                ? concluir(
                    item.id
                  )
                : cancelar(
                    item.id
                  )
            );

            toast.success(
              concluindo
                ? 'Agendamento concluído'
                : 'Agendamento cancelado'
            );
          } catch (err) {
            toast.error(
              handleApiError(
                err,
                'Alterar agendamento'
              )
            );
          }
        },
    });
  };


  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <>
      <Head>
        <title>
          Agendamentos | AxeFlow
        </title>
      </Head>


      {/* ======================================================
          MODAL AGENDAMENTO
      ====================================================== */}

      {modalForm !== null && (
        <AgendamentoModal
          agendamento={
            modalForm?.id
              ? modalForm
              : null
          }
          tipos={tiposAtivos}
          consulentes={
            consulentes
          }
          onClose={() =>
            setModalForm(null)
          }
          onSave={handleSave}
          onConsulenteCriado={
            carregarConsulentes
          }
        />
      )}


      {/* ======================================================
          CONTEÚDO
      ====================================================== */}

      <div
        style={{
          display: 'flex',
        }}
      >
        <Sidebar />

        <div className="main-content">
          <div className="topbar">
            <div>
              <h5
                style={{
                  fontFamily:
                    'Cinzel',
                  color:
                    'var(--cor-acento)',
                  margin: 0,
                }}
              >
                Agendamentos
              </h5>

              <small
                style={{
                  color:
                    'var(--cor-texto-suave)',
                }}
              >
                {agendamentos.length}{' '}
                registro(s)
              </small>
            </div>

            {podeGerenciar && (
              <button
                className="btn-gold"
                onClick={() =>
                  setModalForm({})
                }
              >
                <i className="bi bi-plus-lg me-1" />
                Novo Agendamento
              </button>
            )}
          </div>


          <div className="page-content">
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom:
                  '1rem',
              }}
            >
              <input
                className="form-control-custom"
                placeholder="Buscar por consulente ou atendimento..."
                value={busca}
                onChange={(e) =>
                  setBusca(
                    e.target.value
                  )
                }
                style={{
                  maxWidth: 360,
                }}
              />

              <select
                className="form-control-custom"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value
                  )
                }
                style={{
                  maxWidth: 180,
                }}
              >
                <option value="">
                  Todos
                </option>

                <option value="agendado">
                  Agendados
                </option>

                <option value="concluido">
                  Concluídos
                </option>

                <option value="cancelado">
                  Cancelados
                </option>
              </select>
            </div>


            {/* ==================================================
                MOBILE
            ================================================== */}

            {isMobile ? (
              filtrados.length ? (
                filtrados.map(
                  (item) => {
                    const contaFinanceira =
                      contasFinanceiras.find(
                        (conta) =>
                          String(
                            conta.agendamento_id
                          ) ===
                          String(
                            item.id
                          )
                      );

                    return (
                      <AgendamentoCard
                        key={item.id}
                        item={item}
                        podeGerenciar={
                          podeGerenciar
                        }
                        contaFinanceira={
                          contaFinanceira
                        }
                        onEdit={
                          setModalForm
                        }
                        onCancelar={(
                          i
                        ) =>
                          confirmarStatus(
                            i,
                            'cancelar'
                          )
                        }
                        onConcluir={(
                          i
                        ) =>
                          confirmarStatus(
                            i,
                            'concluir'
                          )
                        }
                        onFinanceiro={
                          abrirFinanceiroAgendamento
                        }
                      />
                    );
                  }
                )
              ) : (
                <div className="empty-state">
                  <i className="bi bi-calendar-check d-block" />
                  <p>
                    Nenhum agendamento
                    encontrado
                  </p>
                </div>
              )
            ) : (

              /* =================================================
                 DESKTOP
              ================================================= */

              <div className="card-custom">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>
                        Consulente
                      </th>

                      <th>
                        Atendimento
                      </th>

                      <th>
                        Data e horário
                      </th>

                      <th>
                        Valor
                      </th>

                      <th>
                        Financeiro
                      </th>

                      <th>
                        Status
                      </th>

                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtrados.map(
                      (item) => {
                        const contaFinanceira =
                          contasFinanceiras.find(
                            (conta) =>
                              String(
                                conta.agendamento_id
                              ) ===
                              String(
                                item.id
                              )
                          );

                        return (
                          <tr
                            key={item.id}
                          >
                            <td>
                              <strong>
                                {item
                                  .consulente
                                  ?.nome ||
                                  '-'}
                              </strong>

                              <div
                                style={{
                                  color:
                                    'var(--cor-texto-suave)',
                                  fontSize:
                                    '0.78rem',
                                }}
                              >
                                {formatPhone(
                                  item
                                    .consulente
                                    ?.telefone
                                )}
                              </div>
                            </td>

                            <td>
                              {item
                                .atendimento_tipo
                                ?.nome ||
                                '-'}

                              <div
                                style={{
                                  color:
                                    'var(--cor-texto-suave)',
                                  fontSize:
                                    '0.78rem',
                                }}
                              >
                                {item
                                  .atendimento_tipo
                                  ?.tipo_cobranca ===
                                'hora'
                                  ? 'Por hora'
                                  : 'Por serviço'}
                              </div>
                            </td>

                            <td>
                              {formatDateTime(
                                item.inicio
                              )}

                              {item
                                .atendimento_tipo
                                ?.tipo_cobranca ===
                                'hora' && (
                                <div
                                  style={{
                                    color:
                                      'var(--cor-texto-suave)',
                                    fontSize:
                                      '0.78rem',
                                  }}
                                >
                                  até{' '}
                                  {isoTime(
                                    item.fim
                                  )}
                                </div>
                              )}
                            </td>

                            <td>
                              {money(
                                item.valor
                              )}
                            </td>

                            <td>
                              {contaFinanceira ? (
                                statusFinanceiroBadge(
                                  contaFinanceira.status
                                )
                              ) : (
                                <span
                                  style={{
                                    color:
                                      'var(--cor-texto-suave)',
                                    fontSize:
                                      '0.8rem',
                                  }}
                                >
                                  Sem cobrança
                                </span>
                              )}
                            </td>

                            <td>
                              {statusBadge(
                                item.status
                              )}
                            </td>

                            <td>
                              {podeGerenciar && (
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    gap:
                                      '0.4rem',
                                    justifyContent:
                                      'flex-end',
                                  }}
                                >
                                  <button
                                    className="btn-outline-gold"
                                    onClick={() =>
                                      setModalForm(
                                        item
                                      )
                                    }
                                    title="Editar"
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>

                                  {item.status ===
                                    'agendado' && (
                                    <button
                                      className="btn-outline-gold"
                                      onClick={() =>
                                        confirmarStatus(
                                          item,
                                          'concluir'
                                        )
                                      }
                                      title="Concluir"
                                    >
                                      <i className="bi bi-check2" />
                                    </button>
                                  )}

                                  {item.status ===
                                    'agendado' && (
                                    <button
                                      className="btn-outline-gold"
                                      onClick={() =>
                                        confirmarStatus(
                                          item,
                                          'cancelar'
                                        )
                                      }
                                      style={{
                                        color:
                                          '#ef4444',
                                        borderColor:
                                          'rgba(239,68,68,0.45)',
                                      }}
                                      title="Cancelar"
                                    >
                                      <i className="bi bi-x-lg" />
                                    </button>
                                  )}

                                  <button
                                    className="btn-outline-gold"
                                    onClick={() =>
                                      abrirFinanceiroAgendamento(
                                        item
                                      )
                                    }
                                    title="Financeiro"
                                    disabled={
                                      carregandoFinanceiro
                                    }
                                  >
                                    <i className="bi bi-cash-coin" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {!filtrados.length && (
                      <tr>
                        <td colSpan="7">
                          <div className="empty-state">
                            <i className="bi bi-calendar-check d-block" />
                            <p>
                              Nenhum agendamento
                              encontrado
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* ======================================================
          NAVEGAÇÃO MOBILE
      ====================================================== */}

      <BottomNav />


      {/* ======================================================
          MODAL FINANCEIRO
      ====================================================== */}

      <FinanceiroAgendamentoModal
        aberto={modalFinanceiro}
        conta={contaFinanceira}
        pagamentos={
          pagamentosFinanceiros
        }
        formas={formasPagamento}
        agendamento={
          contaFinanceira?.agendamento ||
          null
        }
        onFechar={() => {
          setModalFinanceiro(
            false
          );

          setContaFinanceira(
            null
          );

          setPagamentosFinanceiros(
            []
          );
        }}
        onCriarCobranca={
          criarCobrancaAgendamento
        }
        onPagar={() => {
          setModalFinanceiro(
            false
          );

          setModalPagamento(
            true
          );
        }}
        onRecibo={async (pagamentoId, reciboIdExistente) => {
          let janela = null;

          try {
            janela = window.open('', '_blank');

            let reciboId = reciboIdExistente;
            let numero = null;

            // Ainda não existe recibo: gera.
            if (!reciboId) {
              const reciboResponse = await gerarRecibo(pagamentoId);

              reciboId = reciboResponse.data.id;
              numero = reciboResponse.data.numero;
            }

            // Recibo já existente ou recém-gerado:
            // apenas abre o PDF.
            const pdfResponse = await getReciboPdf(reciboId);

            const blob = new Blob(
              [pdfResponse.data],
              { type: 'application/pdf' }
            );

            const url = window.URL.createObjectURL(blob);

            if (janela) {
              janela.location.href = url;
            } else {
              window.open(url, '_blank');
            }

            // Toast somente quando o recibo foi realmente criado agora.
            if (numero) {
              toast.success(`Recibo ${numero} gerado.`);
            }

            setTimeout(() => {
              window.URL.revokeObjectURL(url);
            }, 60000);

          } catch (error) {
            if (janela) {
              janela.close();
            }

            toast.error(
              error.response?.data?.detail ||
              'Não foi possível abrir o recibo.'
            );
          }
        }}
      />


      {/* ======================================================
          MODAL PAGAMENTO
      ====================================================== */}

      <PagamentoAgendamentoModal
        aberto={modalPagamento}
        conta={contaFinanceira}
        formas={formasPagamento}
        onFechar={() =>
          setModalPagamento(
            false
          )
        }
        onSucesso={async () => {
          setModalPagamento(
            false
          );

          await atualizarFinanceiro();

          setModalFinanceiro(
            true
          );
        }}
      />


      {/* ======================================================
          MODAL CONFIRMAÇÃO
      ====================================================== */}

      <ConfirmModal
        aberto={
          modalConfirm.aberto
        }
        titulo={
          modalConfirm.titulo
        }
        mensagem={
          modalConfirm.mensagem
        }
        labelConfirmar={
          modalConfirm.labelConfirmar
        }
        tipoBotao={
          modalConfirm.tipoBotao
        }
        onConfirmar={
          modalConfirm.onConfirmar
        }
        onCancelar={() =>
          setModalConfirm({
            aberto: false,
          })
        }
      />
    </>
  );
}