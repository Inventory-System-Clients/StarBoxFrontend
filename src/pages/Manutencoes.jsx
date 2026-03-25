import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";

const INTERVALO_ALERTA_PERSISTENTE_DIAS = 45;
const STATUS_CONCLUIDOS = ["feito", "concluida"];

const statusEhConcluido = (status) =>
  STATUS_CONCLUIDOS.includes(String(status || "").toLowerCase());

const manutencaoAtribuidaAoUsuario = (manutencao, usuarioId) =>
  String(manutencao?.funcionarioId || "") === String(usuarioId || "");

const abrirWhatsAppEmNovaAba = ({ whatsappUrl, popupReservado }) => {
  if (!whatsappUrl) {
    if (popupReservado && !popupReservado.closed) {
      popupReservado.close();
    }
    return false;
  }

  if (popupReservado && !popupReservado.closed) {
    popupReservado.location.href = whatsappUrl;
    popupReservado.focus?.();
    return true;
  }

  const novaAba = window.open(whatsappUrl, "_blank");
  if (novaAba && !novaAba.closed) {
    novaAba.focus?.();
    return true;
  }

  return false;
};

const montarMensagemDetalhesManutencao = (detalhe) => {
  if (!detalhe) return "";

  const dataHora = detalhe?.createdAt
    ? new Date(detalhe.createdAt).toLocaleString("pt-BR")
    : "-";
  const concluidaEm = detalhe?.concluidoEm
    ? new Date(detalhe.concluidoEm).toLocaleString("pt-BR")
    : "-";
  const lojaNome = detalhe?.loja?.nome || "-";
  const maquinaCodigo = detalhe?.maquina?.codigo || "-";
  const maquinaNome = detalhe?.maquina?.nome || "-";
  const funcionarioNome = detalhe?.funcionario?.nome || "-";
  const concluidaPor = detalhe?.concluidoPor?.nome || "-";
  const status = detalhe?.status || "-";
  const descricao = detalhe?.descricao || "-";

  return [
    "STAR BOX",
    "*Detalhes da Manutenção*",
    "___________________________________",
    `Descrição: ${descricao}`,
    `Data/Hora: ${dataHora}`,
    `Status: ${status}`,
    `Responsável: ${funcionarioNome}`,
    `Concluída por: ${concluidaPor}`,
    `Concluída em: ${concluidaEm}`,
    `Loja: ${lojaNome}`,
    `Máquina: ${maquinaCodigo} - ${maquinaNome}`,
  ].join("\n");
};

const normalizarTextoBusca = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

function CampoSelectDigitavel({
  id,
  label,
  value,
  options,
  onValueChange,
  placeholder = "Digite para buscar",
  required = false,
  disabled = false,
}) {
  const [textoBusca, setTextoBusca] = useState("");

  useEffect(() => {
    const valorAtual = String(value || "");
    const opcaoSelecionada = options.find(
      (opcao) => opcao.value === valorAtual,
    );
    setTextoBusca(opcaoSelecionada?.label || "");
  }, [options, value]);

  const listaId = `${id}-opcoes`;

  const obterOpcaoPorTexto = (texto) => {
    const termo = normalizarTextoBusca(texto);
    if (!termo) return null;

    return (
      options.find((opcao) => normalizarTextoBusca(opcao.label) === termo) ||
      null
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        type="text"
        className="input-field w-full"
        value={textoBusca}
        onChange={(event) => {
          const valorDigitado = event.target.value;
          setTextoBusca(valorDigitado);

          if (!valorDigitado.trim()) {
            onValueChange("");
            return;
          }

          const opcao = obterOpcaoPorTexto(valorDigitado);
          if (opcao) {
            onValueChange(opcao.value);
          }
        }}
        onBlur={(event) => {
          const valorDigitado = event.target.value;
          const opcao = obterOpcaoPorTexto(valorDigitado);

          if (opcao) {
            if (String(value || "") !== opcao.value) {
              onValueChange(opcao.value);
            }
            setTextoBusca(opcao.label);
            return;
          }

          if (!valorDigitado.trim()) {
            onValueChange("");
            setTextoBusca("");
            return;
          }

          const opcaoSelecionada = options.find(
            (item) => item.value === String(value || ""),
          );
          setTextoBusca(opcaoSelecionada?.label || "");
        }}
        list={listaId}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />

      <datalist id={listaId}>
        {options.map((opcao) => (
          <option key={opcao.value} value={opcao.label} />
        ))}
      </datalist>
    </div>
  );
}

function Manutencoes() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";

  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filtroLoja, setFiltroLoja] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("nao_concluidas");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const [showNovaManutencao, setShowNovaManutencao] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState({
    lojaId: "",
    maquinaId: "",
    funcionarioId: "",
    destinatarioWhatsAppId: "",
    descricao: "",
  });

  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [destinatariosWhatsApp, setDestinatariosWhatsApp] = useState([]);

  const [detalhe, setDetalhe] = useState(null);
  const [editando, setEditando] = useState(false);
  const [editData, setEditData] = useState({
    funcionarioId: "",
    status: "",
    descricao: "",
  });
  const [manutencaoParaConcluir, setManutencaoParaConcluir] = useState(null);
  const [observacaoConclusao, setObservacaoConclusao] = useState("");

  const carregarManutencoes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/manutencoes");
      setManutencoes(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar manutenções:", err?.response?.data || err);
      setError(err?.response?.data?.error || "Erro ao buscar manutenções.");
    } finally {
      setLoading(false);
    }
  };

  const carregarDadosFormulario = async () => {
    try {
      const [lojasRes, maquinasRes, funcionariosRes] = await Promise.all([
        api.get("/lojas"),
        api.get("/maquinas"),
        api.get("/usuarios/funcionarios"),
      ]);

      setLojas(lojasRes.data || []);
      setMaquinas(maquinasRes.data || []);
      setFuncionarios(funcionariosRes.data || []);
    } catch (err) {
      console.error(
        "Erro ao carregar dados auxiliares:",
        err?.response?.data || err,
      );
      setError("Erro ao carregar lojas, máquinas e funcionários.");
    }
  };

  const carregarDestinatariosWhatsApp = async (lojaId) => {
    if (!lojaId) {
      setDestinatariosWhatsApp([]);
      setNovaManutencao((d) => ({
        ...d,
        destinatarioWhatsAppId: "",
      }));
      return;
    }

    try {
      const res = await api.get("/manutencao-whatsapp-prompts/destinatarios", {
        params: { lojaId },
      });

      const lista = Array.isArray(res.data?.funcionarios)
        ? res.data.funcionarios
        : [];

      setDestinatariosWhatsApp(lista);
      setNovaManutencao((dadosAtuais) => {
        const destinatarioAtual = String(
          dadosAtuais.destinatarioWhatsAppId || "",
        );

        if (!destinatarioAtual) {
          return dadosAtuais;
        }

        const destinatarioAindaExiste = lista.some(
          (destinatario) =>
            String(destinatario.id) === String(destinatarioAtual),
        );

        if (destinatarioAindaExiste) {
          return dadosAtuais;
        }

        return {
          ...dadosAtuais,
          destinatarioWhatsAppId: "",
        };
      });
    } catch (err) {
      console.error(
        "Erro ao carregar destinatarios de WhatsApp:",
        err?.response?.data || err,
      );

      const fallback = (funcionarios || []).map((f) => ({
        id: f.id,
        nome: f.nome,
        telefone: f.telefone || null,
      }));

      setDestinatariosWhatsApp(fallback);
      setNovaManutencao((dadosAtuais) => {
        const destinatarioAtual = String(
          dadosAtuais.destinatarioWhatsAppId || "",
        );

        if (!destinatarioAtual) {
          return dadosAtuais;
        }

        const destinatarioAindaExiste = fallback.some(
          (destinatario) =>
            String(destinatario.id) === String(destinatarioAtual),
        );

        if (destinatarioAindaExiste) {
          return dadosAtuais;
        }

        return {
          ...dadosAtuais,
          destinatarioWhatsAppId: "",
        };
      });
    }
  };

  useEffect(() => {
    carregarManutencoes();
  }, []);

  useEffect(() => {
    if (showNovaManutencao && isAdmin) {
      carregarDadosFormulario();
    }
  }, [showNovaManutencao, isAdmin]);

  const maquinasFiltradas = useMemo(() => {
    if (!novaManutencao.lojaId) return [];
    return maquinas.filter(
      (m) => String(m.lojaId) === String(novaManutencao.lojaId),
    );
  }, [maquinas, novaManutencao.lojaId]);

  const opcoesLojas = useMemo(
    () =>
      lojas.map((loja) => ({
        value: String(loja.id),
        label: loja.nome,
      })),
    [lojas],
  );

  const opcoesMaquinas = useMemo(
    () =>
      maquinasFiltradas.map((maquina) => ({
        value: String(maquina.id),
        label: `${maquina.codigo}${maquina.nome ? ` - ${maquina.nome}` : ""}`,
      })),
    [maquinasFiltradas],
  );

  const opcoesFuncionarios = useMemo(
    () =>
      funcionarios.map((funcionario) => ({
        value: String(funcionario.id),
        label: funcionario.nome,
      })),
    [funcionarios],
  );

  const opcoesDestinatariosWhatsApp = useMemo(
    () =>
      destinatariosWhatsApp.map((destinatario) => ({
        value: String(destinatario.id),
        label: `${destinatario.nome}${
          destinatario.telefone
            ? ` - ${destinatario.telefone}`
            : " - sem telefone"
        }`,
      })),
    [destinatariosWhatsApp],
  );

  const lojasFiltro = useMemo(() => {
    return Array.from(
      new Set(manutencoes.map((m) => m.loja?.nome).filter(Boolean)),
    );
  }, [manutencoes]);

  const statusFiltro = useMemo(() => {
    return Array.from(
      new Set(manutencoes.map((m) => m.status).filter(Boolean)),
    );
  }, [manutencoes]);

  const filtradas = useMemo(() => {
    const dataInicioMs = filtroDataInicio
      ? new Date(`${filtroDataInicio}T00:00:00`).getTime()
      : null;
    const dataFimMs = filtroDataFim
      ? new Date(`${filtroDataFim}T23:59:59.999`).getTime()
      : null;

    return manutencoes.filter((m) => {
      if (!isAdmin) {
        if (!manutencaoAtribuidaAoUsuario(m, usuario?.id)) return false;
      }

      const dataManutencaoMs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(dataManutencaoMs)) return false;

      const okLoja = !filtroLoja || m.loja?.nome === filtroLoja;
      const okStatus =
        filtroStatus === "nao_concluidas"
          ? !statusEhConcluido(m.status)
          : !filtroStatus || m.status === filtroStatus;
      const okDataInicio =
        dataInicioMs === null || dataManutencaoMs >= dataInicioMs;
      const okDataFim = dataFimMs === null || dataManutencaoMs <= dataFimMs;

      return okLoja && okStatus && okDataInicio && okDataFim;
    });
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroLoja,
    filtroStatus,
    isAdmin,
    manutencoes,
    usuario?.id,
  ]);

  const manutencoesPersistentes = useMemo(() => {
    const manutencoesBase = isAdmin
      ? manutencoes
      : manutencoes.filter((m) => manutencaoAtribuidaAoUsuario(m, usuario?.id));

    const limiteIntervaloMs =
      INTERVALO_ALERTA_PERSISTENTE_DIAS * 24 * 60 * 60 * 1000;

    const concluidas = manutencoesBase.filter(
      (m) => (m.status === "feito" || m.status === "concluida") && m.maquinaId,
    );

    const agrupadasPorMaquina = concluidas.reduce((acc, manutencao) => {
      const chave = String(manutencao.maquinaId);
      if (!acc[chave]) acc[chave] = [];
      acc[chave].push(manutencao);
      return acc;
    }, {});

    const persistentes = Object.values(agrupadasPorMaquina)
      .filter((lista) => lista.length > 1)
      .map((lista) => {
        const ordenadas = [...lista].sort((a, b) => {
          const dataA = new Date(a.concluidoEm || a.createdAt).getTime();
          const dataB = new Date(b.concluidoEm || b.createdAt).getTime();
          return dataB - dataA;
        });

        const dataAtualTs = new Date(
          ordenadas[0].concluidoEm || ordenadas[0].createdAt,
        ).getTime();
        const dataUltimaTs = new Date(
          ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        ).getTime();

        if (!Number.isFinite(dataAtualTs) || !Number.isFinite(dataUltimaTs)) {
          return null;
        }

        const intervaloEntreManutencoesMs = Math.abs(
          dataAtualTs - dataUltimaTs,
        );

        if (intervaloEntreManutencoesMs > limiteIntervaloMs) {
          return null;
        }

        return {
          maquinaId: ordenadas[0].maquinaId,
          maquinaNome: ordenadas[0].maquina?.codigo || "Máquina sem código",
          lojaNome: ordenadas[0].loja?.nome || "Loja não informada",
          dataAtual: ordenadas[0].concluidoEm || ordenadas[0].createdAt,
          dataUltima: ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.dataAtual).getTime() - new Date(a.dataAtual).getTime(),
      );

    return persistentes;
  }, [isAdmin, manutencoes, usuario?.id]);

  const formatarDataHora = (valor) => {
    if (!valor) return "-";
    return new Date(valor).toLocaleString("pt-BR");
  };

  const resetFormularioNovaManutencao = () => {
    setShowNovaManutencao(false);
    setNovaManutencao({
      lojaId: "",
      maquinaId: "",
      funcionarioId: "",
      destinatarioWhatsAppId: "",
      descricao: "",
    });
    setDestinatariosWhatsApp([]);
  };

  const abrirFormularioNovaManutencao = () => {
    setNovaManutencao({
      lojaId: "",
      maquinaId: "",
      funcionarioId: "",
      destinatarioWhatsAppId: "",
      descricao: "",
    });
    setDestinatariosWhatsApp([]);
    setShowNovaManutencao(true);
  };

  const limparCamposNovaManutencao = () => {
    setNovaManutencao({
      lojaId: "",
      maquinaId: "",
      funcionarioId: "",
      destinatarioWhatsAppId: "",
      descricao: "",
    });
    setDestinatariosWhatsApp([]);
    setError("");
  };

  const handleNovaManutencao = async (event) => {
    event.preventDefault();

    if (!novaManutencao.lojaId) {
      setError("Selecione uma loja válida na lista.");
      return;
    }

    if (!novaManutencao.maquinaId) {
      setError("Selecione uma máquina válida na lista.");
      return;
    }

    // Reserva a aba durante o clique para evitar bloqueio e nao trocar a aba atual.
    const popupReservado = window.open("about:blank", "_blank");

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload = {
        descricao: novaManutencao.descricao,
        lojaId: novaManutencao.lojaId,
        maquinaId: novaManutencao.maquinaId,
        funcionarioId: novaManutencao.funcionarioId || null,
      };

      const manutencaoRes = await api.post("/manutencoes", payload);

      let mensagemPosCadastro = "Manutenção criada com sucesso!";

      try {
        const promptRes = await api.post("/manutencao-whatsapp-prompts/gerar", {
          lojaId: novaManutencao.lojaId,
          maquinaId: novaManutencao.maquinaId,
          manutencaoId: manutencaoRes?.data?.id || null,
          descricao: novaManutencao.descricao,
          funcionarioId: novaManutencao.destinatarioWhatsAppId || null,
        });

        const whatsappUrl = promptRes?.data?.whatsappUrl;
        const abriuWhatsApp = abrirWhatsAppEmNovaAba({
          whatsappUrl,
          popupReservado,
        });

        if (!abriuWhatsApp) {
          mensagemPosCadastro =
            "Manutenção criada com sucesso, mas o navegador bloqueou a nova aba do WhatsApp. Libere pop-up para o StarBox.";
        }

        if (promptRes?.data?.aviso) {
          mensagemPosCadastro = !abriuWhatsApp
            ? `${mensagemPosCadastro} ${promptRes.data.aviso}`
            : `Manutenção criada com sucesso. ${promptRes.data.aviso}`;
        }
      } catch (promptErr) {
        console.error(
          "Erro ao gerar prompt de WhatsApp da manutenção:",
          promptErr?.response?.data || promptErr,
        );
        if (popupReservado && !popupReservado.closed) {
          popupReservado.close();
        }
        mensagemPosCadastro =
          "Manutenção criada com sucesso, mas não foi possível preparar o WhatsApp.";
      }

      resetFormularioNovaManutencao();
      setSuccess(mensagemPosCadastro);
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao criar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!detalhe) return;
    if (!window.confirm("Tem certeza que deseja excluir esta manutenção?"))
      return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.delete(`/manutencoes/${detalhe.id}`);
      setDetalhe(null);
      setSuccess("Manutenção excluída com sucesso!");
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao excluir manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = () => {
    if (!funcionarios.length) {
      carregarDadosFormulario();
    }

    setEditData({
      funcionarioId: String(detalhe?.funcionarioId || ""),
      status: detalhe?.status || "pendente",
      descricao: detalhe?.descricao || "",
    });
    setEditando(true);
  };

  const handleEditSave = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/manutencoes/${detalhe.id}`, editData);
      setEditando(false);
      setDetalhe(null);
      setSuccess("Manutenção atualizada com sucesso!");
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao atualizar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const abrirConclusaoManutencao = (manutencao) => {
    if (!manutencao?.id) return;

    setError("");
    setSuccess("");
    setObservacaoConclusao("");
    setManutencaoParaConcluir(manutencao);
  };

  const fecharConclusaoManutencao = () => {
    setManutencaoParaConcluir(null);
    setObservacaoConclusao("");
  };

  const concluirManutencao = async (manutencao) => {
    if (!manutencao?.id) return;

    const observacaoLimpa = String(observacaoConclusao || "").trim();
    if (!observacaoLimpa) {
      setError("Observação é obrigatória ao concluir manutenção sem peça.");
      return;
    }

    if (observacaoLimpa.length > 100) {
      setError("A observação deve ter no máximo 100 caracteres.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/manutencoes/${manutencao.id}/concluir`, {
        status: "feito",
        concluidoPorId: usuario?.id || null,
        explicacao_sem_peca: observacaoLimpa,
      });
      if (detalhe?.id === manutencao.id) {
        setDetalhe(null);
      }
      fecharConclusaoManutencao();
      setSuccess("Manutenção marcada como feita!");
      await carregarManutencoes();
    } catch (err) {
      setError(
        err?.response?.data?.error || "Erro ao marcar manutenção como feita.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarDetalhesWhatsApp = () => {
    if (!detalhe) return;

    setError("");
    const mensagem = montarMensagemDetalhesManutencao(detalhe);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    const abriuWhatsApp = abrirWhatsAppEmNovaAba({
      whatsappUrl,
      popupReservado: null,
    });

    if (!abriuWhatsApp) {
      setError(
        "Não foi possível abrir o WhatsApp agora. Verifique o bloqueador de pop-up do navegador.",
      );
      return;
    }

    setSuccess(
      "Detalhes preparados no WhatsApp. Agora é só escolher o contato e enviar.",
    );
  };

  const concluirManutencaoDaLinha = (manutencao) => {
    abrirConclusaoManutencao(manutencao);
  };

  const marcarComoFeita = () => {
    if (!detalhe) return;
    abrirConclusaoManutencao(detalhe);
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Manutenções"
          subtitle="Acompanhe todas as manutenções registradas"
          icon="🛠️"
        />

        {isAdmin && (
          <div className="mb-4">
            <button
              className="btn-primary"
              onClick={abrirFormularioNovaManutencao}
            >
              Nova Manutenção
            </button>
          </div>
        )}

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        <div className="mb-4 flex flex-wrap gap-4">
          <select
            className="input-field"
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value)}
          >
            <option value="">Todas as lojas</option>
            {lojasFiltro.map((loja) => (
              <option key={loja} value={loja}>
                {loja}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="nao_concluidas">Não concluídas</option>
            <option value="">Todos os status</option>
            {statusFiltro.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Data inicial
            </label>
            <input
              className="input-field"
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              max={filtroDataFim || undefined}
              aria-label="Filtrar data inicial"
              title="Data inicial"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Data final
            </label>
            <input
              className="input-field"
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              min={filtroDataInicio || undefined}
              aria-label="Filtrar data final"
              title="Data final"
            />
          </div>
        </div>

        {showNovaManutencao && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
              onSubmit={handleNovaManutencao}
            >
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                type="button"
                onClick={resetFormularioNovaManutencao}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Nova Manutenção</h3>

              <div className="space-y-4">
                <CampoSelectDigitavel
                  id="nova-manutencao-loja"
                  label="Loja"
                  value={novaManutencao.lojaId}
                  options={opcoesLojas}
                  onValueChange={(lojaId) => {
                    setNovaManutencao((dadosAtuais) => ({
                      ...dadosAtuais,
                      lojaId,
                      maquinaId: "",
                    }));
                    carregarDestinatariosWhatsApp(lojaId);
                  }}
                  placeholder="Digite o nome da loja"
                  required
                />

                <CampoSelectDigitavel
                  id="nova-manutencao-maquina"
                  label="Máquina"
                  value={novaManutencao.maquinaId}
                  options={opcoesMaquinas}
                  onValueChange={(maquinaId) =>
                    setNovaManutencao((dadosAtuais) => ({
                      ...dadosAtuais,
                      maquinaId,
                    }))
                  }
                  placeholder="Digite código ou nome da máquina"
                  required
                  disabled={!novaManutencao.lojaId}
                />

                <CampoSelectDigitavel
                  id="nova-manutencao-funcionario"
                  label="Funcionário (opcional)"
                  value={novaManutencao.funcionarioId}
                  options={opcoesFuncionarios}
                  onValueChange={(funcionarioId) =>
                    setNovaManutencao((dadosAtuais) => ({
                      ...dadosAtuais,
                      funcionarioId,
                    }))
                  }
                  placeholder="Digite o nome do funcionário"
                />

                <div>
                  <CampoSelectDigitavel
                    id="nova-manutencao-destinatario"
                    label="Enviar WhatsApp para"
                    value={novaManutencao.destinatarioWhatsAppId}
                    options={opcoesDestinatariosWhatsApp}
                    onValueChange={(destinatarioWhatsAppId) =>
                      setNovaManutencao((dadosAtuais) => ({
                        ...dadosAtuais,
                        destinatarioWhatsAppId,
                      }))
                    }
                    placeholder="Digite nome ou telefone do destinatário"
                    disabled={!novaManutencao.lojaId}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea
                    className="input-field w-full"
                    value={novaManutencao.descricao}
                    onChange={(e) =>
                      setNovaManutencao((d) => ({
                        ...d,
                        descricao: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    className="w-full rounded-lg border border-gray-300 bg-red-500 px-4 py-2 font-semibold text-black hover:bg-red-60
                    03"
                    type="button"
                    onClick={limparCamposNovaManutencao}
                  >
                    Limpar campos
                  </button>
                  <button className="btn-primary w-full" type="submit">
                    Cadastrar
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Descrição
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Data/Hora
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Loja
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Máquina
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Concluída por
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Concluída em
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filtradas.map((m) => (
                  <tr
                    key={m.id}
                    className={
                      `hover:bg-blue-50 cursor-pointer` +
                      (isAdmin &&
                      (m.status === "feito" || m.status === "concluida")
                        ? " bg-green-100"
                        : "")
                    }
                    onClick={() => setDetalhe(m)}
                  >
                    <td className="px-4 py-2">{m.descricao}</td>
                    <td className="px-4 py-2">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">{m.loja?.nome || "-"}</td>
                    <td className="px-4 py-2">
                      {m.maquina?.codigo || "-"}
                      {m.maquina?.nome ? ` - ${m.maquina.nome}` : ""}
                    </td>
                    <td className="px-4 py-2 font-bold">
                      {m.status === "feito" || m.status === "concluida" ? (
                        <span className="text-green-700">{m.status}</span>
                      ) : (
                        m.status
                      )}
                    </td>
                    <td className="px-4 py-2">{m.concluidoPor?.nome || "-"}</td>
                    <td className="px-4 py-2">
                      {formatarDataHora(m.concluidoEm)}
                    </td>
                    <td className="px-4 py-2">
                      {(m.status !== "feito" && m.status !== "concluida") &&
                      (isAdmin || manutencaoAtribuidaAoUsuario(m, usuario?.id)) ? (
                        <button
                          className="btn-success text-xs px-3 py-1"
                          onClick={(event) => {
                            event.stopPropagation();
                            concluirManutencaoDaLinha(m);
                          }}
                        >
                          Concluir
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-8">
                      Nenhuma manutenção encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {manutencoesPersistentes.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h3 className="text-lg font-bold text-amber-900">
              ⚠️ Manutenções persistentes
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Estas máquinas tiveram mais de uma manutenção concluída em até{" "}
              {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias. Isso pode indicar que a
              manutenção anterior não resolveu o problema.
            </p>

            <div className="mt-3 space-y-3">
              {manutencoesPersistentes.map((item) => (
                <div
                  key={item.maquinaId}
                  className="rounded-md border border-amber-200 bg-white p-3"
                >
                  <div className="font-semibold text-gray-900">
                    {item.maquinaNome} - {item.lojaNome}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    <strong>Data da última manutenção:</strong>{" "}
                    {formatarDataHora(item.dataUltima)}
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>Data da manutenção de agora:</strong>{" "}
                    {formatarDataHora(item.dataAtual)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {detalhe && !editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                onClick={() => setDetalhe(null)}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Detalhes da Manutenção</h3>

              <div className="space-y-2">
                <div>
                  <strong>Descrição:</strong> {detalhe.descricao}
                </div>
                <div>
                  <strong>Data/Hora:</strong>{" "}
                  {new Date(detalhe.createdAt).toLocaleString("pt-BR")}
                </div>
                <div>
                  <strong>Status:</strong> {detalhe.status}
                </div>
                <div>
                  <strong>Concluída por:</strong>{" "}
                  {detalhe.concluidoPor?.nome || "-"}
                </div>
                <div>
                  <strong>Concluída em:</strong>{" "}
                  {formatarDataHora(detalhe.concluidoEm)}
                </div>
                <div>
                  <strong>Loja:</strong> {detalhe.loja?.nome || "-"}
                </div>
                <div>
                  <strong>Máquina:</strong> {detalhe.maquina?.codigo || "-"}
                  {detalhe.maquina?.nome ? ` - ${detalhe.maquina.nome}` : ""}
                </div>

                {/* Explicações dos funcionários */}
                {(detalhe.explicacao_nao_fazer ||
                  detalhe.explicacao_sem_peca) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📝 Explicações dos Funcionários
                    </h4>

                    {detalhe.explicacao_nao_fazer && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-orange-800 mb-1">
                          Por que não foi feita:
                        </p>
                        <p className="text-sm text-gray-700">
                          {detalhe.explicacao_nao_fazer}
                        </p>
                        {detalhe.verificadoPor && (
                          <p className="text-xs text-gray-500 mt-1">
                            - {detalhe.verificadoPor.nome} (
                            {formatarDataHora(detalhe.verificadoEm)})
                          </p>
                        )}
                      </div>
                    )}

                    {detalhe.explicacao_sem_peca && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">
                          Por que não usou peças:
                        </p>
                        <p className="text-sm text-gray-700">
                          {detalhe.explicacao_sem_peca}
                        </p>
                        {detalhe.concluidoPor && (
                          <p className="text-xs text-gray-500 mt-1">
                            - {detalhe.concluidoPor.nome} (
                            {formatarDataHora(detalhe.concluidoEm)})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-6">
                <button
                  className="btn-success w-full sm:w-auto"
                  onClick={handleEnviarDetalhesWhatsApp}
                >
                  Enviar para WhatsApp
                </button>
                {isAdmin && (
                  <button
                    className="btn-primary w-full sm:w-auto"
                    onClick={handleEditOpen}
                  >
                    Editar
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="btn-danger w-full sm:w-auto"
                    onClick={handleDelete}
                  >
                    Excluir
                  </button>
                )}
                {!isAdmin &&
                  detalhe.status !== "feito" &&
                  detalhe.status !== "concluida" &&
                  manutencaoAtribuidaAoUsuario(detalhe, usuario?.id) && (
                    <button
                      className="btn-success w-full sm:w-auto"
                      onClick={marcarComoFeita}
                    >
                      Marcar como Feita
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {manutencaoParaConcluir && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                type="button"
                onClick={fecharConclusaoManutencao}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-3">Concluir manutenção</h3>

              <p className="text-sm text-gray-600 mb-3">
                Como esta conclusão está sendo feita sem registrar peça, informe
                a observação obrigatória.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Observação (obrigatória, máx. 100 caracteres)
                </label>
                <textarea
                  className="input-field w-full"
                  value={observacaoConclusao}
                  onChange={(event) =>
                    setObservacaoConclusao(event.target.value.slice(0, 100))
                  }
                  placeholder="Ex.: manutenção concluída sem uso de peça"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={fecharConclusaoManutencao}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-success w-full"
                  onClick={() => concluirManutencao(manutencaoParaConcluir)}
                >
                  Confirmar conclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {detalhe && editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
              onSubmit={handleEditSave}
            >
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                type="button"
                onClick={() => setEditando(false)}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Editar Manutenção</h3>

              <div className="space-y-4">
                <CampoSelectDigitavel
                  id="editar-manutencao-funcionario"
                  label="Funcionário"
                  value={editData.funcionarioId}
                  options={opcoesFuncionarios}
                  onValueChange={(funcionarioId) =>
                    setEditData((dadosAtuais) => ({
                      ...dadosAtuais,
                      funcionarioId,
                    }))
                  }
                  placeholder="Digite o nome do funcionário"
                />

                <div>
                  <label className="block text-sm font-medium">Status</label>
                  <select
                    className="input-field w-full"
                    value={editData.status}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, status: e.target.value }))
                    }
                  >
                    <option value="pendente">pendente</option>
                    <option value="em_andamento">em_andamento</option>
                    <option value="feito">feito</option>
                    <option value="concluida">concluida</option>
                    <option value="cancelada">cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea
                    className="input-field w-full"
                    value={editData.descricao}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, descricao: e.target.value }))
                    }
                  />
                </div>

                <button className="btn-primary w-full mt-2" type="submit">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Manutencoes;
