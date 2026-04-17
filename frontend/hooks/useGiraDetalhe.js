import { useEffect, useState } from 'react';
import {
  cancelarInscricao,
  getGira,
  getMe,
  getPresencaMembros,
  getPresencaMembrosPublica,
  listInscricoes,
  reativarInscricao,
  updatePresenca,
  updatePresencaMembro,
} from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { selectInscricoes, selectIsAdmin } from '../selectors/giraDetalheSelectors';
import { buildGiraDetalheViewModel } from '../viewModels/giraDetalheViewModel';

function createInitialModal() {
  return {
    aberto: false,
    titulo: '',
    mensagem: '',
    apenasOk: false,
    tipoBotao: 'perigo',
    labelConfirmar: 'Confirmar',
    onConfirmar: null,
  };
}

export function useGiraDetalhe(giraId, router) {
  const [rawGira, setRawGira] = useState(null);
  const [rawInscricoes, setRawInscricoes] = useState([]);
  const [rawMembrosPresenca, setRawMembrosPresenca] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [ordenar, setOrdenar] = useState('posicao');
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [promovido, setPromovido] = useState(null);
  const [modal, setModal] = useState(createInitialModal());

  const [inscricoesLoading, setInscricoesLoading] = useState(true);
  const [membrosLoading, setMembrosLoading] = useState(true);
  const [membrosUpdating, setMembrosUpdating] = useState({});

  const fecharModal = () => {
    setModal((current) => ({ ...current, aberto: false, onConfirmar: null }));
  };

  const abrirModalInformativo = (titulo, mensagem, tipoBotao = 'perigo') => {
    setModal({
      aberto: true,
      titulo,
      mensagem,
      apenasOk: true,
      tipoBotao,
      labelConfirmar: 'OK',
      onConfirmar: fecharModal,
    });
  };

  useEffect(() => {
    if (!giraId || !router?.isReady) return;

    let active = true;

    async function carregar() {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        if (active) setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [giraRes, inscricoesRes, meRes] = await Promise.all([
          getGira(giraId),
          listInscricoes(giraId),
          getMe(),
        ]);

        if (!active) return;

        const gira = giraRes.data;
        setRawGira(gira);
        setRawInscricoes(Array.isArray(inscricoesRes.data) ? inscricoesRes.data : []);
        setInscricoesLoading(true);
        setUserRole(meRes.data?.role || '');

        try {
          const membrosRes = gira.acesso === 'fechada'
            ? await getPresencaMembros(giraId)
            : await getPresencaMembrosPublica(giraId);

          if (active) {
            setRawMembrosPresenca(Array.isArray(membrosRes.data) ? membrosRes.data : []);
            setMembrosLoading(true);
          }
        } catch {
          if (active) setRawMembrosPresenca([]);
          if (active) setMembrosLoading(false);
        }
      } catch {
        if (active) router.push('/giras');
      } finally {
        if (active) setLoading(false);
        if (active) setInscricoesLoading(false);
        if (active) setMembrosLoading(false);
      }
    }

    carregar();

    return () => {
      active = false;
    };
  }, [giraId, router?.isReady]);

  const copyLink = async () => {
    if (!rawGira?.slug_publico) return;

    const link = `${window.location.origin}/public/${rawGira.slug_publico}`;

    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt('Copie o link abaixo:', link);
    }
  };

  const handlePresenca = async (inscricaoId, status) => {
    try {
      await updatePresenca(inscricaoId, status);
      setRawInscricoes((current) =>
        current.map((item) => (item.id === inscricaoId ? { ...item, status } : item))
      );
    } catch (error) {
      abrirModalInformativo(
        'Erro ao atualizar presenca',
        handleApiError(error, 'Atualizar presenca')
      );
    }
  };

  const handlePresencaMembro = async (membroId, status) => {
    setMembrosUpdating((prev) => ({ ...prev, [membroId]: true }));
    try {
      await updatePresencaMembro(giraId, membroId, status);
      setRawMembrosPresenca((current) =>
        current.map((item) => (item.membro_id === membroId ? { ...item, status } : item))
      );
    } catch (error) {
      abrirModalInformativo(
        'Erro ao atualizar presenca do membro',
        handleApiError(error, 'Atualizar presenca do membro')
      );
    } finally {
      setMembrosUpdating((prev) => ({ ...prev, [membroId]: false }));
    }
  };

  const handleCancelar = (inscricaoId, nome) => {
    setModal({
      aberto: true,
      titulo: 'Cancelar inscricao',
      mensagem: `Tem certeza que deseja cancelar a inscricao de "${nome}"?\n\nEsta acao nao pode ser desfeita.`,
      apenasOk: false,
      tipoBotao: 'perigo',
      labelConfirmar: 'Cancelar inscricao',
      onConfirmar: async () => {
        fecharModal();

        try {
          const { data } = await cancelarInscricao(inscricaoId);

          setRawInscricoes((current) =>
            current.map((item) => (item.id === inscricaoId ? { ...item, status: 'cancelado' } : item))
          );

          if (data?.promovido) {
            setRawInscricoes((current) =>
              current.map((item) =>
                item.consulente_telefone === data.promovido.telefone && item.status === 'lista_espera'
                  ? { ...item, status: 'confirmado' }
                  : item
              )
            );
            setPromovido(data.promovido);
          }
        } catch (error) {
          abrirModalInformativo('Erro ao cancelar', handleApiError(error, 'Cancelar inscricao'));
        }
      },
    });
  };

  const handleReativar = (inscricaoId, nome) => {
    setModal({
      aberto: true,
      titulo: 'Reativar inscricao',
      mensagem: `Reativar a inscricao de "${nome}"?\n\nSe houver vaga, voltara como confirmado. Se lotada, entrara na fila de espera.`,
      apenasOk: false,
      tipoBotao: 'sucesso',
      labelConfirmar: 'Reativar',
      onConfirmar: async () => {
        fecharModal();

        try {
          const { data } = await reativarInscricao(inscricaoId);

          setRawInscricoes((current) =>
            current.map((item) => (item.id === inscricaoId ? { ...item, status: data.status } : item))
          );

          abrirModalInformativo(
            data.status === 'confirmado' ? 'Inscricao reativada' : 'Adicionado a fila',
            data.mensagem,
            data.status === 'confirmado' ? 'sucesso' : 'padrao'
          );
        } catch (error) {
          abrirModalInformativo('Erro ao reativar', handleApiError(error, 'Reativar inscricao'));
        }
      },
    });
  };

  const { vm, metricas } = buildGiraDetalheViewModel({
    gira: rawGira,
    inscricoes: rawInscricoes,
    membrosPresenca: rawMembrosPresenca,
    linkCopiado,
    promovido,
  });
  const lista = selectInscricoes(vm, { filtro, ordenar });

  const state = {
    loading,
    filtro,
    ordenar,
    linkCopiado,
    modal,
    inscricoesLoading,
    membrosLoading,
  };

  const actions = {
    setFiltro,
    setOrdenar,
    priorizarAlertas: () => setOrdenar('alerta'),
    copyLink,
    fecharModal,
    limparPromovido: () => setPromovido(null),
    marcarPresenca: handlePresenca,
    cancelarInscricao: handleCancelar,
    reativarInscricao: handleReativar,
    updateMembro: handlePresencaMembro,
    };
    
  return {
    state,
    actions,
    derived: {
      vm,
      metricas,
      isAdmin: selectIsAdmin(userRole),
      lista,
      membrosPresenca: rawMembrosPresenca,
      membrosUpdating,
    },
  };
}
