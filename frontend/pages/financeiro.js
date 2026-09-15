// pages/financeiro.js

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { toast } from 'react-toastify';

import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';

import {
  listContasReceber,
  getContaReceber,
  createContaReceber,
  listPagamentos,
  createPagamento,
  gerarRecibo,

  listFormasPagamento,
  createFormaPagamento,
  updateFormaPagamento,
  deleteFormaPagamento,

  listAgendamentos,
} from '../services/api';

function formatarMoeda(valor) {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
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

function badgeStatus(status) {
  const config = {
    pendente: {
      texto: 'Pendente',
      classe: 'badge-status badge-status-warning',
    },
    parcial: {
      texto: 'Parcial',
      classe: 'badge-status badge-status-info',
    },
    pago: {
      texto: 'Pago',
      classe: 'badge-status badge-status-success',
    },
    cancelado: {
      texto: 'Cancelado',
      classe: 'badge-status badge-status-danger',
    },
  };

  const item = config[status] || {
    texto: status || '-',
    classe: 'badge-status',
  };

  return (
    <span className={item.classe}>
      {item.texto}
    </span>
  );
}

function ModalPagamento({
  aberto,
  conta,
  formas,
  onFechar,
  onSucesso,
}) {
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !conta) return;

    setFormaPagamentoId(formas[0]?.id || '');
    setValor('');
    setObservacoes('');
  }, [aberto, conta, formas]);

  if (!aberto || !conta) return null;

  const valorConta = Number(conta.valor || 0);

  const enviar = async (e) => {
    e.preventDefault();

    const valorPagamento = Number(
      String(valor).replace(',', '.')
    );

    if (!formaPagamentoId) {
      toast.error('Selecione a forma de pagamento.');
      return;
    }

    if (!valorPagamento || valorPagamento <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    setSalvando(true);

    try {
      await createPagamento(conta.id, {
        forma_pagamento_id: formaPagamentoId,
        valor: valorPagamento,
        ...(observacoes.trim()
          ? { observacoes: observacoes.trim() }
          : {}),
      });

      toast.success('Pagamento registrado.');
      onSucesso();
    } catch (error) {
      const mensagem =
        error.response?.data?.detail ||
        'Não foi possível registrar o pagamento.';

      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.65)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content card-custom">
          <form onSubmit={enviar}>
            <div className="modal-header">
              <h5 className="modal-title">
                Registrar pagamento
              </h5>

              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onFechar}
              />
            </div>

            <div className="modal-body">
              <div className="mb-3">
                <small className="text-muted">
                  Conta
                </small>

                <div className="fw-semibold">
                  {conta.descricao || 'Conta a receber'}
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <small className="text-muted">
                    Valor
                  </small>

                  <div className="fw-semibold">
                    {formatarMoeda(valorConta)}
                  </div>
                </div>

                <div className="col-6">
                  <small className="text-muted">
                    Status
                  </small>

                  <div>
                    {badgeStatus(conta.status)}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Forma de pagamento
                </label>

                <select
                  className="form-control-custom"
                  value={formaPagamentoId}
                  onChange={(e) =>
                    setFormaPagamentoId(e.target.value)
                  }
                  required
                >
                  <option value="">
                    Selecione...
                  </option>

                  {formas
                    .filter((forma) => forma.ativo)
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

              <div className="mb-3">
                <label className="form-label">
                  Valor do pagamento
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="form-control-custom"
                  value={valor}
                  onChange={(e) =>
                    setValor(e.target.value)
                  }
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  Observações
                </label>

                <textarea
                  className="form-control-custom"
                  rows="3"
                  maxLength="2000"
                  value={observacoes}
                  onChange={(e) =>
                    setObservacoes(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-gold"
                onClick={onFechar}
                disabled={salvando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-gold"
                disabled={salvando}
              >
                {salvando
                  ? 'Registrando...'
                  : 'Registrar pagamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModalDetalhesConta({
  aberto,
  conta,
  pagamentos,
  formas,
  onFechar,
  onPagar,
  onRecibo,
}) {
  if (!aberto || !conta) return null;

  const totalPago = pagamentos.reduce(
    (total, pagamento) =>
      total + Number(pagamento.valor || 0),
    0
  );

  const restante = Math.max(
    Number(conta.valor || 0) - totalPago,
    0
  );

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.65)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content card-custom">
          <div className="modal-header">
            <div>
              <h5 className="modal-title">
                Detalhes da cobrança
              </h5>

              <small className="text-muted">
                {conta.descricao}
              </small>
            </div>

            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onFechar}
            />
          </div>

          <div className="modal-body">
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="small text-muted">
                  Valor
                </div>

                <div className="fs-5 fw-semibold">
                  {formatarMoeda(conta.valor)}
                </div>
              </div>

              <div className="col-md-4">
                <div className="small text-muted">
                  Pago
                </div>

                <div className="fs-5 fw-semibold">
                  {formatarMoeda(totalPago)}
                </div>
              </div>

              <div className="col-md-4">
                <div className="small text-muted">
                  Restante
                </div>

                <div className="fs-5 fw-semibold">
                  {formatarMoeda(restante)}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <strong>Status:</strong>{' '}
              {badgeStatus(conta.status)}
            </div>

            <h6 className="mt-4 mb-3">
              Pagamentos
            </h6>

            {pagamentos.length === 0 ? (
              <div className="text-muted py-3">
                Nenhum pagamento registrado.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-custom align-middle">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Valor</th>
                      <th>Observações</th>
                      <th className="text-end">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagamentos.map((pagamento) => {
                      const forma = formas.find(
                        (item) =>
                          item.id === pagamento.forma_pagamento_id
                      );

                      return (
                        <tr key={pagamento.id}>
                          <td>
                            {formatarData(
                              pagamento.data_pagamento
                            )}
                          </td>

                          <td>
                            {forma?.nome || '—'}
                          </td>

                          <td>
                            {formatarMoeda(
                              pagamento.valor
                            )}
                          </td>

                          <td>
                            {pagamento.observacoes || '—'}
                          </td>

                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-gold"
                              onClick={() =>
                                onRecibo(pagamento.id)
                              }
                            >
                              Recibo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {conta.status !== 'pago' &&
              conta.status !== 'cancelado' && (
                <div className="mt-4">
                  <button
                    className="btn btn-gold"
                    onClick={onPagar}
                  >
                    Registrar pagamento
                  </button>
                </div>
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

function ModalFormaPagamento({
  aberto,
  forma,
  onFechar,
  onSucesso,
}) {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(forma?.nome || '');
  }, [forma, aberto]);

  if (!aberto) return null;

  const salvar = async (e) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error('Informe o nome da forma de pagamento.');
      return;
    }

    setSalvando(true);

    try {
      if (forma) {
        await updateFormaPagamento(forma.id, {
          nome: nome.trim(),
        });

        toast.success('Forma de pagamento atualizada.');
      } else {
        await createFormaPagamento({
          nome: nome.trim(),
          ativo: true,
        });

        toast.success('Forma de pagamento criada.');
      }

      onSucesso();
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível salvar a forma de pagamento.'
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.65)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content card-custom">
          <form onSubmit={salvar}>
            <div className="modal-header">
              <h5 className="modal-title">
                {forma
                  ? 'Editar forma de pagamento'
                  : 'Nova forma de pagamento'}
              </h5>

              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onFechar}
              />
            </div>

            <div className="modal-body">
              <label className="form-label">
                Nome
              </label>

              <input
                className="form-control-custom"
                maxLength="100"
                value={nome}
                onChange={(e) =>
                  setNome(e.target.value)
                }
                required
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-gold"
                onClick={onFechar}
                disabled={salvando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-gold"
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Financeiro() {
  const [contas, setContas] = useState([]);
  const [formas, setFormas] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  const [statusFiltro, setStatusFiltro] = useState('');

  const [carregando, setCarregando] = useState(true);

  const [contaSelecionada, setContaSelecionada] =
    useState(null);

  const [pagamentos, setPagamentos] = useState([]);

  const [modalDetalhes, setModalDetalhes] =
    useState(false);

  const [modalPagamento, setModalPagamento] =
    useState(false);

  const [modalForma, setModalForma] =
    useState(false);

  const [formaEditando, setFormaEditando] =
    useState(null);

  const [confirmarDesativacao, setConfirmarDesativacao] =
    useState(null);

  const carregar = async () => {
    setCarregando(true);

    try {
      const [
        contasResponse,
        formasResponse,
        agendamentosResponse,
      ] = await Promise.all([
        listContasReceber(statusFiltro || undefined),
        listFormasPagamento(),
        listAgendamentos(),
      ]);

      setContas(contasResponse.data || []);
      setFormas(formasResponse.data || []);
      setAgendamentos(agendamentosResponse.data || []);
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível carregar o financeiro.'
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [statusFiltro]);

  const agendamentoPorId = useMemo(() => {
    const mapa = new Map();

    agendamentos.forEach((agendamento) => {
      mapa.set(String(agendamento.id), agendamento);
    });

    return mapa;
  }, [agendamentos]);

  const resumo = useMemo(() => {
    const resultado = {
      pendente: 0,
      parcial: 0,
      pago: 0,
      totalPendente: 0,
      totalPago: 0,
    };

    contas.forEach((conta) => {
      const valor = Number(conta.valor || 0);

      if (conta.status === 'pendente') {
        resultado.pendente += 1;
        resultado.totalPendente += valor;
      }

      if (conta.status === 'parcial') {
        resultado.parcial += 1;
        resultado.totalPendente += valor;
      }

      if (conta.status === 'pago') {
        resultado.pago += 1;
        resultado.totalPago += valor;
      }
    });

    return resultado;
  }, [contas]);

  const abrirConta = async (conta) => {
    try {
      const [contaResponse, pagamentosResponse] =
        await Promise.all([
          getContaReceber(conta.id),
          listPagamentos(conta.id),
        ]);

      setContaSelecionada(contaResponse.data);
      setPagamentos(pagamentosResponse.data || []);
      setModalDetalhes(true);
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível carregar a cobrança.'
      );
    }
  };

  const abrirPagamento = () => {
    setModalDetalhes(false);
    setModalPagamento(true);
  };

  const recarregarConta = async () => {
    if (!contaSelecionada) return;

    try {
      const [contaResponse, pagamentosResponse] =
        await Promise.all([
          getContaReceber(contaSelecionada.id),
          listPagamentos(contaSelecionada.id),
        ]);

      setContaSelecionada(contaResponse.data);
      setPagamentos(pagamentosResponse.data || []);
      setModalPagamento(false);
      setModalDetalhes(true);

      await carregar();
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível atualizar a cobrança.'
      );
    }
  };

  const emitirRecibo = async (pagamentoId) => {
    try {
      const response = await gerarRecibo(pagamentoId);

      toast.success(
        `Recibo ${response.data.numero} gerado.`
      );

      if (contaSelecionada) {
        await abrirConta(contaSelecionada);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível gerar o recibo.'
      );
    }
  };

  const desativarForma = async () => {
    if (!confirmarDesativacao) return;

    try {
      await deleteFormaPagamento(
        confirmarDesativacao.id
      );

      toast.success(
        'Forma de pagamento desativada.'
      );

      setConfirmarDesativacao(null);
      await carregar();
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível remover a forma de pagamento.'
      );
    }
  };

  return (
    <>
      <Head>
        <title>Financeiro | AxeFlow</title>
      </Head>

      <div style={{ display: 'flex' }}>
        <Sidebar />

        <main className="main-content">
          <div className="topbar">
            <div>
              <h5
                style={{
                  fontFamily: 'Cinzel',
                  color: 'var(--cor-acento)',
                  margin: 0,
                }}
              >
                Financeiro
              </h5>

              <small
                style={{
                  color: 'var(--cor-texto-suave)',
                }}
              >
                Contas a receber e pagamentos
              </small>
            </div>
          </div>

          <div className="page-content">
            {/* RESUMO */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-lg-3">
                <div className="card-custom p-3 h-100">
                  <small className="text-muted">
                    Pendentes
                  </small>

                  <div className="fs-4 fw-semibold">
                    {resumo.pendente}
                  </div>

                  <small>
                    {formatarMoeda(
                      resumo.totalPendente
                    )}
                  </small>
                </div>
              </div>

              <div className="col-6 col-lg-3">
                <div className="card-custom p-3 h-100">
                  <small className="text-muted">
                    Parciais
                  </small>

                  <div className="fs-4 fw-semibold">
                    {resumo.parcial}
                  </div>
                </div>
              </div>

              <div className="col-6 col-lg-3">
                <div className="card-custom p-3 h-100">
                  <small className="text-muted">
                    Pagas
                  </small>

                  <div className="fs-4 fw-semibold">
                    {resumo.pago}
                  </div>

                  <small>
                    {formatarMoeda(
                      resumo.totalPago
                    )}
                  </small>
                </div>
              </div>

              <div className="col-6 col-lg-3">
                <div className="card-custom p-3 h-100">
                  <small className="text-muted">
                    Total de contas
                  </small>

                  <div className="fs-4 fw-semibold">
                    {contas.length}
                  </div>
                </div>
              </div>
            </div>

            {/* CONTAS */}
            <div className="card-custom p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h6 className="mb-0">
                    Contas a receber
                  </h6>
                </div>

                <select
                  className="form-control-custom"
                  style={{ width: 180 }}
                  value={statusFiltro}
                  onChange={(e) =>
                    setStatusFiltro(e.target.value)
                  }
                >
                  <option value="">
                    Todos os status
                  </option>
                  <option value="pendente">
                    Pendentes
                  </option>
                  <option value="parcial">
                    Parciais
                  </option>
                  <option value="pago">
                    Pagas
                  </option>
                </select>
              </div>

              {carregando ? (
                <div className="text-center py-5">
                  Carregando...
                </div>
              ) : contas.length === 0 ? (
                <div className="text-muted py-4">
                  Nenhuma conta encontrada.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-custom align-middle">
                    <thead>
                      <tr>
                        <th>Consulente</th>
                        <th>Descrição</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th className="text-end">
                          Ações
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {contas.map((conta) => {
                        const agendamento =
                          agendamentoPorId.get(
                            String(conta.agendamento_id)
                          );

                        const consulente =
                          agendamento?.consulente;

                        return (
                          <tr key={conta.id}>
                            <td>
                              {consulente?.nome ||
                                conta.consulente_id}
                            </td>

                            <td>
                              {conta.descricao || '—'}
                            </td>

                            <td>
                              {formatarData(
                                conta.data_vencimento
                              )}
                            </td>

                            <td>
                              {formatarMoeda(
                                conta.valor
                              )}
                            </td>

                            <td>
                              {badgeStatus(conta.status)}
                            </td>

                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-outline-gold"
                                onClick={() =>
                                  abrirConta(conta)
                                }
                              >
                                Detalhes
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* FORMAS DE PAGAMENTO */}
            <div className="card-custom p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h6 className="mb-0">
                    Formas de pagamento
                  </h6>

                  <small className="text-muted">
                    Formas utilizadas para registrar pagamentos.
                  </small>
                </div>

                <button
                  className="btn btn-gold"
                  onClick={() => {
                    setFormaEditando(null);
                    setModalForma(true);
                  }}
                >
                  Nova forma
                </button>
              </div>

              {formas.length === 0 ? (
                <div className="text-muted py-3">
                  Nenhuma forma de pagamento cadastrada.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-custom align-middle">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th className="text-end">
                          Ações
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {formas.map((forma) => (
                        <tr key={forma.id}>
                          <td>{forma.nome}</td>

                          <td>
                            {forma.ativo ? (
                              <span className="badge-status badge-status-success">
                                Ativa
                              </span>
                            ) : (
                              <span className="badge-status">
                                Inativa
                              </span>
                            )}
                          </td>

                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                className="btn btn-sm btn-outline-gold"
                                onClick={() => {
                                  setFormaEditando(forma);
                                  setModalForma(true);
                                }}
                              >
                                Editar
                              </button>

                              {forma.ativo && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setConfirmarDesativacao(
                                      forma
                                    )
                                  }
                                >
                                  Desativar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <BottomNav />

      <ModalDetalhesConta
        aberto={modalDetalhes}
        conta={contaSelecionada}
        pagamentos={pagamentos}
        formas={formas}
        onFechar={() => setModalDetalhes(false)}
        onPagar={abrirPagamento}
        onRecibo={emitirRecibo}
      />

      <ModalPagamento
        aberto={modalPagamento}
        conta={contaSelecionada}
        formas={formas}
        onFechar={() => setModalPagamento(false)}
        onSucesso={recarregarConta}
      />

      <ModalFormaPagamento
        aberto={modalForma}
        forma={formaEditando}
        onFechar={() => setModalForma(false)}
        onSucesso={async () => {
          setModalForma(false);
          setFormaEditando(null);
          await carregar();
        }}
      />

      <ConfirmModal
        aberto={!!confirmarDesativacao}
        titulo="Desativar forma de pagamento"
        mensagem={
          confirmarDesativacao
            ? `Tem certeza que deseja desativar "${confirmarDesativacao.nome}"?`
            : ''
        }
        onConfirmar={desativarForma}
        onCancelar={() =>
          setConfirmarDesativacao(null)
        }
      />
    </>
  );
}