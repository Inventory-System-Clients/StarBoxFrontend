import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Modal, AlertBox } from "../components/UIComponents";
import {
  abrirWhatsAppComMensagem,
  extrairKmMovimentacoesRoteiro,
  extrairResumoExecucaoRoteiro,
  montarMensagemFinalizacaoRoteiro,
  obterManutencaoResumoSnapshotRoteiro,
  salvarManutencaoResumoSnapshotRoteiro,
  obterKmInicialPilotagemAtiva,
  obterEstoqueInicialSnapshotRoteiro,
  obterKmInicialPilotagemSnapshotRoteiro,
  removerEstoqueInicialSnapshotRoteiro,
  removerKmInicialPilotagemSnapshotRoteiro,
  salvarEstoqueInicialSnapshotRoteiro,
  salvarKmInicialPilotagemSnapshotRoteiro,
  somarSaldoEstoqueUsuario,
} from "../lib/roteiroFinalizacaoWhatsApp";

export function Roteiros() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isGestorRoteiro =
    usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR";
  const LIMITE_OBSERVACAO_ROTEIRO = 1000;
  const ORCAMENTO_DIARIO_PADRAO = 2000;
  const STATUS_ROTEIRO_FINALIZADO = new Set([
    "finalizado",
    "finalizada",
    "concluido",
    "concluida",
  ]);
  const STATUS_ROTEIRO_PENDENTE = new Set([
    "pendente",
    "em_andamento",
    "em-andamento",
    "aberto",
    "nao_iniciado",
    "não_iniciado",
  ]);

  // --- ESTADOS DE DADOS ---
  const [roteiros, setRoteiros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [todasLojas, setTodasLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- DIAS DA SEMANA ---
  const DIAS_SEMANA = [
    { label: "SEG", full: "Segunda" },
    { label: "TER", full: "Terça" },
    { label: "QUA", full: "Quarta" },
    { label: "QUI", full: "Quinta" },
    { label: "SEX", full: "Sexta" },
    { label: "SAB", full: "Sábado" },
    { label: "DOM", full: "Domingo" },
  ];

  // diasPendentes: { [roteiroId]: string[] } — alterações locais antes de salvar
  const [diasPendentes, setDiasPendentes] = useState({});
  const [salvandoDias, setSalvandoDias] = useState({});

  const getDiasRoteiro = (roteiro) => {
    if (diasPendentes[roteiro.id] !== undefined)
      return diasPendentes[roteiro.id];
    return roteiro.diasSemana || [];
  };

  const toggleDia = (roteiroId, dia) => {
    setDiasPendentes((prev) => {
      const atual =
        prev[roteiroId] !== undefined
          ? prev[roteiroId]
          : roteiros.find((r) => r.id === roteiroId)?.diasSemana || [];
      const novo = atual.includes(dia)
        ? atual.filter((d) => d !== dia)
        : [...atual, dia];
      return { ...prev, [roteiroId]: novo };
    });
  };

  const salvarDias = async (roteiroId) => {
    const dias = diasPendentes[roteiroId];
    if (dias === undefined) return;
    try {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}`, { diasSemana: dias });
      setDiasPendentes((prev) => {
        const c = { ...prev };
        delete c[roteiroId];
        return c;
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao salvar dias do roteiro.");
    } finally {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  // --- ESTADOS DE MODAL ---
  const [showModalCriarRoteiro, setShowModalCriarRoteiro] = useState(false);
  const [showModalAdicionarLoja, setShowModalAdicionarLoja] = useState(false);
  const [novoNomeRoteiro, setNovoNomeRoteiro] = useState("");
  const [novoVeiculoId, setNovoVeiculoId] = useState("");
  const [novosDiasRoteiro, setNovosDiasRoteiro] = useState([]);
  const [novaObservacaoRoteiro, setNovaObservacaoRoteiro] = useState("");
  const [filtroNomeRoteiro, setFiltroNomeRoteiro] = useState("");
  const [roteiroParaAdicionar, setRoteiroParaAdicionar] = useState(null);
  const [filtroLojaAdicionar, setFiltroLojaAdicionar] = useState("");
  const [observacoesPendentes, setObservacoesPendentes] = useState({});
  const [salvandoObservacao, setSalvandoObservacao] = useState({});
  const [orcamentosPendentes, setOrcamentosPendentes] = useState({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState({});
  const [apagandoRoteiros, setApagandoRoteiros] = useState({});
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    roteiro: null,
    loading: false,
  });

  // --- ESTADOS DE DRAG & DROP ---
  const [draggedLoja, setDraggedLoja] = useState(null);
  const [draggedFromRoteiro, setDraggedFromRoteiro] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);

  const isRoteiroFinalizado = (roteiro) =>
    STATUS_ROTEIRO_FINALIZADO.has(
      String(roteiro?.status || "")
        .trim()
        .toLowerCase(),
    );

  const isRoteiroPendenteOuEmAndamento = (roteiro) => {
    const status = String(roteiro?.status || "")
      .trim()
      .toLowerCase();

    if (!status) return true;
    if (STATUS_ROTEIRO_PENDENTE.has(status)) return true;
    return !isRoteiroFinalizado(roteiro);
  };

  const getRoteiroById = (roteiroId) =>
    roteiros.find((item) => String(item.id) === String(roteiroId));

  const roteiroTemVeiculoAssociado = (roteiroAtual) =>
    Boolean(
      String(roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "").trim(),
    );

  const normalizarIdOpcional = (valor) => {
    const texto = String(valor || "").trim();
    return texto || null;
  };

  const getVeiculoLabel = (veiculo) => {
    const nome = String(veiculo?.nome || "").trim();
    const modelo = String(veiculo?.modelo || "").trim();

    if (!nome && !modelo) return "Veículo sem identificação";
    return [nome, modelo].filter(Boolean).join(" - ");
  };

  const getVeiculoResumoRoteiro = (roteiro) => {
    if (!roteiro?.veiculo) return "Sem veículo associado";
    return getVeiculoLabel(roteiro.veiculo);
  };

  const getMensagemErroVeiculo = (err, fallback) => {
    const mensagemBackend = String(err?.response?.data?.error || "");
    const mensagemNormalizada = mensagemBackend
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (
      err?.response?.status === 404 &&
      mensagemNormalizada.includes("veiculo nao encontrado")
    ) {
      return "Veículo não encontrado. Selecione um veículo válido e tente novamente.";
    }

    return mensagemBackend || fallback;
  };

  const formatarMoedaBRL = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const getOrcamentoNumericoRoteiro = (roteiro) => {
    const valor = Number(roteiro?.orcamentoDiario);
    return Number.isFinite(valor) ? valor : ORCAMENTO_DIARIO_PADRAO;
  };

  const getOrcamentoRoteiro = (roteiro) => {
    if (orcamentosPendentes[roteiro.id] !== undefined) {
      return orcamentosPendentes[roteiro.id];
    }
    return getOrcamentoNumericoRoteiro(roteiro).toFixed(2);
  };

  const handleOrcamentoChange = (roteiroId, valor) => {
    setOrcamentosPendentes((prev) => ({
      ...prev,
      [roteiroId]: valor,
    }));
  };

  const salvarOrcamentoDiario = async (roteiroId) => {
    const orcamentoDigitado = orcamentosPendentes[roteiroId];
    if (orcamentoDigitado === undefined) return;

    const orcamentoNormalizado = String(orcamentoDigitado)
      .trim()
      .replace(",", ".");
    const valorInformado =
      orcamentoNormalizado === ""
        ? ORCAMENTO_DIARIO_PADRAO
        : Number(orcamentoNormalizado);

    if (!Number.isFinite(valorInformado) || valorInformado < 0) {
      setError("Informe um orçamento diário válido.");
      return;
    }

    const valorOrcamento = Number(valorInformado.toFixed(2));
    const roteiroAtual = getRoteiroById(roteiroId);
    const orcamentoAtual = Number(
      getOrcamentoNumericoRoteiro(roteiroAtual).toFixed(2),
    );

    if (valorOrcamento === orcamentoAtual) {
      setOrcamentosPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      return;
    }

    try {
      setSalvandoOrcamento((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}/orcamento-diario`, {
        orcamentoDiario: valorOrcamento,
      });

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiroId
            ? { ...item, orcamentoDiario: valorOrcamento }
            : item,
        ),
      );

      setOrcamentosPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      setSuccess("Orçamento diário salvo com sucesso!");
    } catch {
      setError("Erro ao salvar orçamento diário do roteiro.");
    } finally {
      setSalvandoOrcamento((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  const getObservacaoRoteiro = (roteiro) => {
    if (observacoesPendentes[roteiro.id] !== undefined) {
      return observacoesPendentes[roteiro.id];
    }
    return roteiro.observacao || "";
  };

  const handleObservacaoChange = (roteiroId, valor) => {
    const valorLimitado = valor.slice(0, LIMITE_OBSERVACAO_ROTEIRO);
    setObservacoesPendentes((prev) => ({
      ...prev,
      [roteiroId]: valorLimitado,
    }));
  };

  const salvarObservacao = async (roteiroId) => {
    const observacaoDigitada = observacoesPendentes[roteiroId];
    if (observacaoDigitada === undefined) return;

    const roteiroAtual = getRoteiroById(roteiroId);
    const observacaoAtualNormalizada = String(
      roteiroAtual?.observacao || "",
    ).trim();
    const observacaoNormalizada = observacaoDigitada.trim();
    const observacaoPayload = observacaoNormalizada || null;

    if (observacaoNormalizada === observacaoAtualNormalizada) {
      setObservacoesPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      return;
    }

    try {
      setSalvandoObservacao((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}`, {
        observacao: observacaoPayload,
      });

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiroId
            ? { ...item, observacao: observacaoPayload }
            : item,
        ),
      );

      setObservacoesPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      setSuccess("Observação do roteiro salva com sucesso!");
    } catch {
      setError("Erro ao salvar observação do roteiro.");
    } finally {
      setSalvandoObservacao((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  const normalizarTextoFiltro = (texto = "") =>
    String(texto)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const termoBuscaLoja = normalizarTextoFiltro(filtroLojaAdicionar);
  const idsLojasNoRoteiro = new Set(
    (roteiroParaAdicionar?.lojas || []).map((l) => String(l.id)),
  );
  const lojasFiltradasParaAdicionar = todasLojas.filter((loja) => {
    // Excluir lojas já presentes no roteiro
    if (idsLojasNoRoteiro.has(String(loja.id))) return false;

    if (!termoBuscaLoja) return true;

    const textoBuscaLoja = [
      loja?.nome,
      loja?.codigo,
      loja?.cidade,
      loja?.bairro,
      loja?.id,
    ]
      .filter(Boolean)
      .map((campo) => normalizarTextoFiltro(campo))
      .join(" ");

    return textoBuscaLoja.includes(termoBuscaLoja);
  });

  const roteirosDoUsuario = isGestorRoteiro
    ? roteiros
    : roteiros.filter((r) => String(r.funcionarioId) === String(usuario?.id));

  const termoBuscaRoteiro = normalizarTextoFiltro(filtroNomeRoteiro);
  const roteirosFiltrados = roteirosDoUsuario.filter((roteiro) =>
    normalizarTextoFiltro(roteiro?.nome || "").includes(termoBuscaRoteiro),
  );

  // Depende de usuario?.role para esperar o AuthContext hidratar do localStorage
  useEffect(() => {
    if (usuario === undefined) return; // ainda inicializando
    carregarDadosIniciais();
  }, [usuario?.role]);

  const carregarDadosIniciais = async () => {
    try {
      setLoading(true);
      const promises = [
        api.get("/roteiros/com-status"),
        api.get("/lojas"),
        isGestorRoteiro
          ? api.get("/usuarios/funcionarios")
          : Promise.resolve({ data: [] }),
        isGestorRoteiro ? api.get("/veiculos") : Promise.resolve({ data: [] }),
      ];
      const [resRoteiros, resLojas, resFuncionarios, resVeiculos] =
        await Promise.all(promises);
      setRoteiros(resRoteiros.data || []);
      setTodasLojas(resLojas.data || []);
      setFuncionarios(resFuncionarios.data || []);
      setVeiculos(resVeiculos.data || []);
    } catch (err) {
      setError("Erro ao carregar dados dos roteiros.");
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarVeiculoRoteiro = async (roteiro, valorSelecionado) => {
    const veiculoId = normalizarIdOpcional(valorSelecionado);
    const veiculoIdAnterior = normalizarIdOpcional(roteiro?.veiculoId);
    const veiculoSelecionado =
      veiculos.find((item) => String(item.id) === String(veiculoId)) || null;

    if (veiculoId === veiculoIdAnterior) return;

    setRoteiros((prev) =>
      prev.map((item) =>
        item.id === roteiro.id
          ? { ...item, veiculoId, veiculo: veiculoSelecionado }
          : item,
      ),
    );

    try {
      await api.patch(`/roteiros/${roteiro.id}`, {
        veiculoId,
      });

      setSuccess(
        veiculoSelecionado
          ? `Veículo ${getVeiculoLabel(veiculoSelecionado)} associado com sucesso.`
          : "Veículo removido do roteiro com sucesso.",
      );
      carregarDadosIniciais();
    } catch (err) {
      setError(
        getMensagemErroVeiculo(err, "Erro ao atualizar veículo do roteiro."),
      );

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiro.id
            ? {
                ...item,
                veiculoId: veiculoIdAnterior,
                veiculo: roteiro.veiculo || null,
              }
            : item,
        ),
      );
    }
  };

  const usuarioTemPilotagemAtiva = async (
    validarParaTodosPerfis = false,
    roteiroAtual = null,
  ) => {
    if (
      !validarParaTodosPerfis &&
      usuario?.role !== "FUNCIONARIO_TODAS_LOJAS"
    ) {
      return true;
    }

    try {
      const [ultimasMovRes, veiculosRes] = await Promise.all([
        api.get("/movimentacao-veiculos/ultimas"),
        api.get("/veiculos"),
      ]);

      const usuarioId = String(usuario?.id || "").trim();
      const veiculoRoteiroId = String(
        roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "",
      ).trim();

      if (!usuarioId) return false;

      if (veiculoRoteiroId) {
        const kmInicialLocal = obterKmInicialPilotagemAtiva({
          usuarioId,
          veiculoId: veiculoRoteiroId,
        });

        if (Number.isFinite(kmInicialLocal)) {
          return true;
        }
      }

      const veiculosLista = Array.isArray(veiculosRes.data)
        ? veiculosRes.data
        : [];

      const ultimasMovObj = ultimasMovRes.data || {};
      const ultimasMovimentacoes = Array.isArray(ultimasMovObj)
        ? ultimasMovObj
        : Object.values(ultimasMovObj);

      const temRetiradaAtiva = ultimasMovimentacoes.some((mov) => {
        const usuarioMovId = String(
          mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
        ).trim();
        const tipoMov = String(mov?.tipo || "").toLowerCase();
        const veiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "").trim();
        const veiculo = veiculosLista.find((v) => String(v.id) === veiculoId);

        return (
          usuarioMovId === usuarioId &&
          tipoMov === "retirada" &&
          (!veiculoRoteiroId || veiculoId === veiculoRoteiroId) &&
          Boolean(veiculo?.emUso)
        );
      });

      // Fallback defensivo para APIs que já expõem vínculo de usuário no veículo.
      const temVinculoDiretoNoVeiculo = veiculosLista.some((veiculo) => {
        const usuarioVeiculoId = String(
          veiculo?.usuario?.id ||
            veiculo?.usuarioId ||
            veiculo?.funcionarioId ||
            veiculo?.condutorId ||
            "",
        ).trim();
        const veiculoId = String(veiculo?.id || "").trim();

        return (
          Boolean(veiculo?.emUso) &&
          usuarioVeiculoId === usuarioId &&
          (!veiculoRoteiroId || veiculoId === veiculoRoteiroId)
        );
      });

      return temRetiradaAtiva || temVinculoDiretoNoVeiculo;
    } catch (err) {
      console.error("Erro ao validar pilotagem ativa:", err);
      setError(
        "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
      );
      return false;
    }
  };

  const iniciarOuContinuarRoteiro = async (roteiroId) => {
    setError("");

    const roteiroAtual = (Array.isArray(roteiros) ? roteiros : []).find(
      (item) => String(item?.id) === String(roteiroId),
    );

    if (roteiroTemVeiculoAssociado(roteiroAtual)) {
      const podeProsseguir = await usuarioTemPilotagemAtiva(false, roteiroAtual);
      if (!podeProsseguir) {
        const mensagemBloqueio =
          "Voce precisa iniciar a pilotagem de um veiculo antes de comecar o roteiro. Voce sera redirecionado para a aba de veiculos.";

        setError(mensagemBloqueio);
        window.alert(mensagemBloqueio);
        navigate("/veiculos", {
          state: {
            origem: "roteiros",
            retornarPara: "/roteiros",
          },
        });
        return;
      }
    }

    const usuarioReferenciaId = String(usuario?.id || "").trim();
    const snapshotExistente = obterEstoqueInicialSnapshotRoteiro({
      roteiroId,
      usuarioId: usuarioReferenciaId,
    });
    let kmInicialSnapshotExistente = obterKmInicialPilotagemSnapshotRoteiro({
      roteiroId,
      usuarioId: usuarioReferenciaId,
    });

    if (!Number.isFinite(snapshotExistente) && usuarioReferenciaId) {
      try {
        const estoqueRes = await api.get("/estoque-usuarios/me");
        const saldoAtual = somarSaldoEstoqueUsuario(estoqueRes.data);

        salvarEstoqueInicialSnapshotRoteiro({
          roteiroId,
          usuarioId: usuarioReferenciaId,
          quantidadeInicial: saldoAtual,
          sobrescrever: false,
        });
      } catch {
        // Se falhar a captura inicial, seguimos com a navegação.
      }
    }

    if (!Number.isFinite(kmInicialSnapshotExistente) && usuarioReferenciaId) {
      const kmInicialPilotagemAtiva = obterKmInicialPilotagemAtiva({
        usuarioId: usuarioReferenciaId,
        veiculoId: roteiroAtual?.veiculoId,
      });

      if (Number.isFinite(kmInicialPilotagemAtiva)) {
        salvarKmInicialPilotagemSnapshotRoteiro({
          roteiroId,
          usuarioId: usuarioReferenciaId,
          kmInicial: kmInicialPilotagemAtiva,
          sobrescrever: false,
        });
        kmInicialSnapshotExistente = kmInicialPilotagemAtiva;
      }
    }

    if (!Number.isFinite(kmInicialSnapshotExistente) && usuarioReferenciaId) {
      try {
        const ultimasRes = await api.get("/movimentacao-veiculos/ultimas");
        const ultimasObj = ultimasRes?.data || {};
        const ultimasMovs = Array.isArray(ultimasObj)
          ? ultimasObj
          : Object.values(ultimasObj);

        const retiradaAtiva = ultimasMovs.find((mov) => {
          const tipoMov = String(mov?.tipo || "").toLowerCase();
          const usuarioMovId = String(
            mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
          );
          const veiculoMovId = String(mov?.veiculoId || mov?.veiculo?.id || "");
          const veiculoRoteiroId = String(roteiroAtual?.veiculoId || "");

          if (tipoMov !== "retirada") return false;
          if (usuarioMovId !== usuarioReferenciaId) return false;
          if (veiculoRoteiroId && veiculoMovId !== veiculoRoteiroId)
            return false;
          return true;
        });

        const kmInicialPilotagem = Number(
          retiradaAtiva?.kmInicial ??
            retiradaAtiva?.quilometragemInicial ??
            retiradaAtiva?.kmRetirada ??
            retiradaAtiva?.odometroInicial ??
            retiradaAtiva?.km,
        );

        if (Number.isFinite(kmInicialPilotagem)) {
          salvarKmInicialPilotagemSnapshotRoteiro({
            roteiroId,
            usuarioId: usuarioReferenciaId,
            kmInicial: kmInicialPilotagem,
            sobrescrever: false,
          });
        }
      } catch {
        // Sem bloqueio de fluxo caso a captura do KM inicial falhe.
      }
    }

    if (usuarioReferenciaId) {
      const statusRoteiro = String(roteiroAtual?.status || "")
        .trim()
        .toLowerCase();
      const statusNaoIniciado = new Set([
        "",
        "pendente",
        "aberto",
        "nao_iniciado",
        "não_iniciado",
      ]);
      const deveReiniciarContador = statusNaoIniciado.has(statusRoteiro);
      const lojasRoteiro = Array.isArray(roteiroAtual?.lojas)
        ? roteiroAtual.lojas
        : [];
      const lojasSemManutencao = Array.from(
        new Set(
          lojasRoteiro
            .map((loja) => String(loja?.nome || "").trim())
            .filter(Boolean),
        ),
      );

      salvarManutencaoResumoSnapshotRoteiro({
        roteiroId,
        usuarioId: usuarioReferenciaId,
        resumo: {
          totalRealizadas: 0,
          lojasComManutencao: [],
          lojasSemManutencao,
        },
        sobrescrever: deveReiniciarContador,
      });
    }

    navigate(`/roteiros/${roteiroId}/executar`);
  };

  const exigirFinalizarPilotagemAntesDaRota = async (roteiroId) => {
    const roteiroAtual = getRoteiroById(roteiroId);
    if (!roteiroTemVeiculoAssociado(roteiroAtual)) {
      return true;
    }

    const temPilotagemAtiva = await usuarioTemPilotagemAtiva(true, roteiroAtual);
    if (!temPilotagemAtiva) return true;

    const mensagemBloqueio =
      "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

    setError(mensagemBloqueio);
    navigate("/veiculos", {
      state: {
        origem: "roteiros-finalizacao",
        retornarPara: "/roteiros",
        roteiroIdParaFinalizar: roteiroId,
        alertaFinalizarVeiculo: mensagemBloqueio,
        alertaFinalizarVeiculoToken: `${Date.now()}-${roteiroId}`,
      },
    });

    return false;
  };

  // --- AÇÕES ---
  const handleCriarRoteiro = async () => {
    try {
      const observacaoNormalizada = novaObservacaoRoteiro.trim();
      const veiculoId = normalizarIdOpcional(novoVeiculoId);
      const payload = {
        nome: novoNomeRoteiro,
        diasSemana: novosDiasRoteiro,
        veiculoId,
      };

      // Observação é opcional na criação: só envia se houver texto.
      if (observacaoNormalizada) {
        payload.observacao = observacaoNormalizada;
      }

      await api.post("/roteiros", payload);
      setNovoNomeRoteiro("");
      setNovoVeiculoId("");
      setNovosDiasRoteiro([]);
      setNovaObservacaoRoteiro("");
      setShowModalCriarRoteiro(false);
      setSuccess("Roteiro criado com sucesso!");
      carregarDadosIniciais();
    } catch (err) {
      setError(getMensagemErroVeiculo(err, "Erro ao criar roteiro."));
    }
  };

  const handleExcluirRoteiro = async (roteiro) => {
    const confirmar = window.confirm(
      `Deseja realmente apagar o roteiro "${roteiro.nome}"? Essa ação não pode ser desfeita.`,
    );

    if (!confirmar) return;

    try {
      setError("");
      setSuccess("");
      setApagandoRoteiros((prev) => ({ ...prev, [roteiro.id]: true }));

      const response = await api.delete(`/roteiros/${roteiro.id}`);
      const mensagem =
        response?.data?.message ||
        response?.data?.mensagem ||
        "Roteiro apagado com sucesso.";

      setRoteiros((prev) => prev.filter((r) => r.id !== roteiro.id));
      setSuccess(mensagem);
    } catch (err) {
      const status = err?.response?.status;
      const mensagemBackend = err?.response?.data?.error;

      if (status === 401) {
        setError("Sessão expirada. Faça login novamente.");
      } else if (status === 403) {
        setError("Você não tem permissão para apagar roteiros.");
      } else if (status === 404) {
        setError("Roteiro não encontrado. A lista foi atualizada.");
        setRoteiros((prev) => prev.filter((r) => r.id !== roteiro.id));
      } else if (status === 500) {
        setError(mensagemBackend || "Erro ao apagar roteiro.");
      } else {
        setError(mensagemBackend || "Não foi possível apagar o roteiro.");
      }
    } finally {
      setApagandoRoteiros((prev) => ({ ...prev, [roteiro.id]: false }));
    }
  };

  const handleMoverLoja = async (lojaId, origemId, destinoId) => {
    const roteiroOrigem = origemId ? getRoteiroById(origemId) : null;
    const roteiroDestino = getRoteiroById(destinoId);

    if (
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      setError(
        "Roteiro finalizado não permite adicionar, remover ou mover pontos.",
      );
      return;
    }

    try {
      await api.post("/roteiros/mover-loja", {
        lojaId,
        roteiroOrigemId: origemId,
        roteiroDestinoId: destinoId,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao mover ponto.");
    }
  };

  const handleReordenarLoja = async (roteiroId, lojaId, novaOrdem) => {
    const roteiro = getRoteiroById(roteiroId);
    if (isRoteiroFinalizado(roteiro)) {
      setError("Roteiro finalizado não permite reordenar pontos.");
      return;
    }

    try {
      await api.patch(`/roteiros/${roteiroId}/reordenar-loja`, {
        lojaId,
        novaOrdem,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao reordenar ponto.");
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    const roteiro = modalFinalizar.roteiro;
    if (!roteiro) return;

    const podeFinalizar = await exigirFinalizarPilotagemAntesDaRota(roteiro.id);
    if (!podeFinalizar) {
      setModalFinalizar({
        aberto: false,
        etapa: 1,
        roteiro: null,
        loading: false,
      });
      return;
    }

    const extrairNumero = (...valores) => {
      for (const valor of valores) {
        const numero = Number(valor);
        if (Number.isFinite(numero)) return numero;
      }
      return null;
    };

    const montarMensagemWhatsAppFinalizacao = async (finalizacaoData) => {
      const normalizarListaResumo = (lista) => {
        if (!Array.isArray(lista)) return [];

        const itensNormalizados = lista
          .map((item) => {
            if (typeof item === "string") {
              const valor = item.trim();
              return valor ? valor : null;
            }

            if (!item || typeof item !== "object") return null;

            const descricao = String(
              item.nome ||
                item.descricao ||
                item.manutencaoNome ||
                item.maquinaNome ||
                "",
            ).trim();
            const pontoNome = String(
              item.pontoNome ||
                item.lojaNome ||
                item.loja?.nome ||
                item.ponto?.nome ||
                "",
            ).trim();

            if (!descricao && !pontoNome) return null;

            return {
              ...item,
              descricao,
              pontoNome,
            };
          })
          .filter(Boolean);

        const chaves = new Set();
        return itensNormalizados.filter((item) => {
          const chave =
            typeof item === "string"
              ? `str:${item}`
              : `obj:${String(item.id || "")}:${item.descricao || ""}:${item.pontoNome || ""}`;

          if (chaves.has(chave)) return false;
          chaves.add(chave);
          return true;
        });
      };

      const resumoExecucao = extrairResumoExecucaoRoteiro({
        roteiro,
        finalizacaoData,
      });

      const usuarioReferenciaId = String(
        finalizacaoData?.funcionarioId ||
          finalizacaoData?.funcionario?.id ||
          roteiro?.funcionarioId ||
          usuario?.id ||
          "",
      ).trim();

      const kmInicialPilotagemSnapshot = obterKmInicialPilotagemSnapshotRoteiro(
        {
          roteiroId: roteiro?.id,
          usuarioId: usuarioReferenciaId,
        },
      );

      let totalPeluciasUsadas = extrairNumero(
        finalizacaoData?.totalPeluciasUsadas,
        finalizacaoData?.totalPeluciasUtilizadas,
        finalizacaoData?.peluciasUsadas,
        finalizacaoData?.totais?.peluciasUsadas,
      );

      let saldoPeluciasEstoque = extrairNumero(
        finalizacaoData?.saldoPeluciasEstoqueUsuario,
        finalizacaoData?.saldoEstoqueUsuario,
        finalizacaoData?.peluciasRestantesEstoqueUsuario,
        finalizacaoData?.totais?.saldoEstoqueUsuario,
      );

      if (saldoPeluciasEstoque === null) {
        try {
          if (!usuarioReferenciaId) {
            throw new Error("usuario de referencia ausente");
          }

          const estoqueResUsuario = await api.get(
            `/estoque-usuarios/${usuarioReferenciaId}`,
          );
          saldoPeluciasEstoque = somarSaldoEstoqueUsuario(
            estoqueResUsuario.data,
          );
        } catch {
          if (
            usuarioReferenciaId &&
            String(usuario?.id || "") === usuarioReferenciaId
          ) {
            try {
              const estoqueResMe = await api.get("/estoque-usuarios/me");
              saldoPeluciasEstoque = somarSaldoEstoqueUsuario(
                estoqueResMe.data,
              );
            } catch {
              saldoPeluciasEstoque = null;
            }
          } else {
            saldoPeluciasEstoque = null;
          }
        }
      }

      let saldoPeluciasInicial = obterEstoqueInicialSnapshotRoteiro({
        roteiroId: roteiro?.id,
        usuarioId: usuarioReferenciaId,
      });

      if (saldoPeluciasInicial === null) {
        saldoPeluciasInicial = extrairNumero(
          finalizacaoData?.saldoPeluciasInicialUsuario,
          finalizacaoData?.saldoInicialEstoqueUsuario,
          finalizacaoData?.peluciasIniciaisRoteiro,
          finalizacaoData?.peluciasInicioRoteiro,
          finalizacaoData?.estoqueInicialUsuario,
          finalizacaoData?.totais?.saldoPeluciasInicialUsuario,
          finalizacaoData?.totais?.saldoInicialEstoqueUsuario,
          finalizacaoData?.totais?.peluciasIniciaisRoteiro,
          roteiro?.saldoPeluciasInicialUsuario,
          roteiro?.saldoInicialEstoqueUsuario,
          roteiro?.peluciasIniciaisRoteiro,
          roteiro?.peluciasInicioRoteiro,
          roteiro?.estoqueInicialUsuario,
        );
      }

      if (saldoPeluciasInicial !== null && saldoPeluciasEstoque !== null) {
        totalPeluciasUsadas = Math.max(
          0,
          saldoPeluciasInicial - saldoPeluciasEstoque,
        );
      }

      const despesaTotal = extrairNumero(
        finalizacaoData?.despesaTotal,
        finalizacaoData?.totalDespesas,
        finalizacaoData?.totalGastoHoje,
        finalizacaoData?.totais?.despesaTotal,
        roteiro?.totalGastoHoje,
      );

      const sobraValorDespesa = extrairNumero(
        finalizacaoData?.sobraValorDespesa,
        finalizacaoData?.saldoDespesa,
        finalizacaoData?.saldoGastoHoje,
        finalizacaoData?.totais?.sobraValorDespesa,
        roteiro?.saldoGastoHoje,
      );

      let manutencoesRealizadas = normalizarListaResumo(
        finalizacaoData?.manutencoesRealizadas ||
          finalizacaoData?.manutencoesConcluidas ||
          finalizacaoData?.totais?.manutencoesRealizadas ||
          [],
      );

      let manutencoesNaoRealizadas = normalizarListaResumo(
        finalizacaoData?.manutencoesNaoRealizadas ||
          finalizacaoData?.manutencoesPendentes ||
          finalizacaoData?.pendenciasManutencao ||
          [],
      );

      const lojasRoteiroNomes = Array.from(
        new Set(
          (Array.isArray(roteiro?.lojas) ? roteiro.lojas : [])
            .map((loja) => String(loja?.nome || "").trim())
            .filter(Boolean),
        ),
      );
      let lojasComManutencao = [];
      let lojasSemManutencao = [...lojasRoteiroNomes];
      let totalManutencoesRealizadas = 0;

      const snapshotManutencao = obterManutencaoResumoSnapshotRoteiro({
        roteiroId: roteiro?.id,
        usuarioId: usuarioReferenciaId,
      });

      if (snapshotManutencao) {
        lojasComManutencao = Array.isArray(snapshotManutencao.lojasComManutencao)
          ? snapshotManutencao.lojasComManutencao
          : [];
        lojasSemManutencao = Array.isArray(snapshotManutencao.lojasSemManutencao)
          ? snapshotManutencao.lojasSemManutencao
          : lojasSemManutencao;
        totalManutencoesRealizadas = Number(snapshotManutencao.totalRealizadas || 0);
      }

      try {
        const manutRes = await api.get("/manutencoes", {
          params: {
            roteiroId: roteiro?.id,
          },
        });

        const listaManut = Array.isArray(manutRes.data)
          ? manutRes.data
          : manutRes.data?.rows || [];

        const relacionadasRoteiro = listaManut.filter((item) => {
          const rotaId = String(item?.roteiroId || item?.roteiro?.id || "");
          return rotaId && rotaId === String(roteiro?.id || "");
        });

        const inicioSemanaAtual = new Date();
        inicioSemanaAtual.setHours(0, 0, 0, 0);
        inicioSemanaAtual.setDate(
          inicioSemanaAtual.getDate() - inicioSemanaAtual.getDay(),
        );

        const relacionadasRoteiroSemanaAtual = relacionadasRoteiro.filter(
          (item) => {
            const status = String(item?.status || "").toLowerCase();
            const dataReferencia = [
              "feito",
              "concluida",
              "concluido",
              "finalizada",
              "finalizado",
            ].includes(status)
              ? item?.concluidoEm || item?.updatedAt || item?.createdAt
              : item?.createdAt || item?.updatedAt || item?.verificadoEm;

            const dataMs = new Date(dataReferencia).getTime();
            if (!Number.isFinite(dataMs)) return false;

            return dataMs >= inicioSemanaAtual.getTime();
          },
        );

        const feitas = relacionadasRoteiroSemanaAtual.filter((item) => {
          const status = String(item?.status || "").toLowerCase();
          return [
            "feito",
            "concluida",
            "concluido",
            "finalizada",
            "finalizado",
          ].includes(status);
        });

        const pendentes = relacionadasRoteiroSemanaAtual.filter((item) => {
          const status = String(item?.status || "").toLowerCase();
          return ![
            "feito",
            "concluida",
            "concluido",
            "finalizada",
            "finalizado",
          ].includes(status);
        });

        // Fonte de verdade: quando a API responde, o resumo deve refletir
        // exclusivamente o estado real das manutencoes do roteiro/pontos.
        manutencoesRealizadas = normalizarListaResumo(feitas);
        manutencoesNaoRealizadas = normalizarListaResumo(pendentes);
        totalManutencoesRealizadas = feitas.length;
        lojasComManutencao = Array.from(
          new Set(
            feitas
              .map((item) =>
                String(item?.loja?.nome || item?.lojaNome || "").trim(),
              )
              .filter(Boolean),
          ),
        );
        lojasSemManutencao = lojasRoteiroNomes.filter(
          (nomeLoja) => !lojasComManutencao.includes(nomeLoja),
        );
      } catch (err) {
        if ([401, 403].includes(err?.response?.status)) {
          throw err;
        }
        // Sem fallback adicional.
      }

      let kmInicialVeiculo = Number.isFinite(kmInicialPilotagemSnapshot)
        ? kmInicialPilotagemSnapshot
        : null;
      let kmFinalVeiculo = null;
      let fonteKmInicial = Number.isFinite(kmInicialPilotagemSnapshot)
        ? "snapshot_pilotagem_usuario"
        : "indefinida";
      let fonteKmFinal = "indefinida";

      try {
        const movVeiculoRes = await api.get("/movimentacao-veiculos", {
          params: {
            roteiroId: roteiro.id,
          },
        });

        const listaMovimentacoesVeiculo = Array.isArray(movVeiculoRes.data)
          ? movVeiculoRes.data
          : movVeiculoRes.data?.rows || movVeiculoRes.data?.movimentacoes || [];

        const resumoKm = extrairKmMovimentacoesRoteiro(
          listaMovimentacoesVeiculo,
          {
            usuarioId: usuario?.id,
            veiculoId: roteiro?.veiculoId || roteiro?.veiculo?.id,
            roteiroId: roteiro.id,
          },
        );

        if (kmInicialVeiculo === null && Number.isFinite(resumoKm.kmInicial)) {
          kmInicialVeiculo = resumoKm.kmInicial;
          fonteKmInicial = "movimentacao_veiculo_retirada";
        }

        if (Number.isFinite(resumoKm.kmFinal)) {
          kmFinalVeiculo = resumoKm.kmFinal;
          fonteKmFinal = "movimentacao_veiculo_devolucao";
        }
      } catch {
        if (kmInicialVeiculo === null) {
          fonteKmInicial = "erro_busca_movimentacao";
        }
        fonteKmFinal = "erro_busca_movimentacao";
      }

      if (kmFinalVeiculo === null) {
        const kmFinalFallback = extrairNumero(
          finalizacaoData?.kmFinalVeiculo,
          finalizacaoData?.kmFinal,
          finalizacaoData?.quilometragemFinal,
          finalizacaoData?.totais?.kmFinalVeiculo,
        );

        if (kmFinalFallback !== null) {
          kmFinalVeiculo = kmFinalFallback;
          fonteKmFinal = "finalizacao_data";
        }
      }

      if (kmInicialVeiculo === null) {
        fonteKmInicial =
          fonteKmInicial === "indefinida"
            ? "sem_dados_km_inicial"
            : fonteKmInicial;
      }

      if (kmFinalVeiculo === null) {
        fonteKmFinal =
          fonteKmFinal === "indefinida" ? "sem_dados_km_final" : fonteKmFinal;
      }

      if (import.meta.env.DEV) {
        console.log("[ResumoFinalizacao][KM][Roteiros]", {
          roteiroId: roteiro?.id,
          usuarioId: usuarioReferenciaId,
          veiculoId: roteiro?.veiculoId || roteiro?.veiculo?.id || null,
          kmInicialVeiculo,
          kmFinalVeiculo,
          fonteKmInicial,
          fonteKmFinal,
          kmInicialSnapshot: kmInicialPilotagemSnapshot,
        });
      }

      return montarMensagemFinalizacaoRoteiro({
        roteiroNome: roteiro?.nome,
        possuiVeiculoAssociado: roteiroTemVeiculoAssociado(roteiro),
        kmInicialVeiculo,
        kmFinalVeiculo,
        lojasFeitas: resumoExecucao.lojasFeitas,
        lojasNaoFeitas: resumoExecucao.lojasNaoFeitas,
        maquinasFeitas: resumoExecucao.maquinasFeitas,
        maquinasNaoFeitas: resumoExecucao.maquinasNaoFeitas,
        totalPeluciasUsadas,
        saldoPeluciasEstoque,
        despesaTotal,
        sobraValorDespesa,
        manutencoesRealizadas,
        manutencoesNaoRealizadas,
        totalManutencoesRealizadas,
        lojasComManutencao,
        lojasSemManutencao,
        resumoConsumoProdutos:
          saldoPeluciasInicial !== null && saldoPeluciasEstoque !== null
            ? {
                estoqueInicialTotal: saldoPeluciasInicial,
                estoqueFinalTotal: saldoPeluciasEstoque,
                consumoTotalProdutos: Math.max(
                  0,
                  saldoPeluciasInicial - saldoPeluciasEstoque,
                ),
              }
            : null,
      });
    };

    const popupReservado = window.open("about:blank", "_blank");

    try {
      setError("");
      setSuccess("");
      setModalFinalizar((prev) => ({ ...prev, loading: true }));

      const res = await api.post(`/roteiros/${roteiro.id}/finalizar`);
      const usuarioReferenciaId = String(
        roteiro?.funcionarioId || usuario?.id || "",
      ).trim();
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomesPendentes = pendencias
          .map((item) => item.maquinaNome)
          .slice(0, 4)
          .join(", ");
        const sufixoMais =
          pendencias.length > 4 ? ` e mais ${pendencias.length - 4}` : "";
        setSuccess(
          `Roteiro finalizado com pendências: ${nomesPendentes}${sufixoMais}. Alerta WhatsApp: ${res?.data?.alertaWhatsApp?.status || "não enviado"}.`,
        );
      } else {
        setSuccess("Roteiro finalizado com sucesso!");
      }

      const mensagemWhatsApp = await montarMensagemWhatsAppFinalizacao(
        res?.data,
      );
      const abriuWhatsApp = abrirWhatsAppComMensagem(
        mensagemWhatsApp,
        popupReservado,
      );
      if (!abriuWhatsApp) {
        setSuccess(
          "Roteiro finalizado, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
        );
      }

      removerEstoqueInicialSnapshotRoteiro({
        roteiroId: roteiro.id,
        usuarioId: usuarioReferenciaId,
      });
      removerKmInicialPilotagemSnapshotRoteiro({
        roteiroId: roteiro.id,
        usuarioId: usuarioReferenciaId,
      });

      setModalFinalizar({
        aberto: false,
        etapa: 1,
        roteiro: null,
        loading: false,
      });
      carregarDadosIniciais();
    } catch (err) {
      if (popupReservado && !popupReservado.closed) {
        popupReservado.close();
      }
      setError(err?.response?.data?.error || "Erro ao finalizar roteiro.");
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = async (roteiro) => {
    const podeFinalizar = await exigirFinalizarPilotagemAntesDaRota(roteiro.id);
    if (!podeFinalizar) return;

    setModalFinalizar({
      aberto: true,
      etapa: 1,
      roteiro,
      loading: false,
    });
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({
      aberto: false,
      etapa: 1,
      roteiro: null,
      loading: false,
    });
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  // --- DRAG AND DROP HANDLERS ---
  const onDragStart = (loja, roteiroId) => {
    if (!isGestorRoteiro) return;
    const roteiroOrigem = getRoteiroById(roteiroId);
    if (isRoteiroFinalizado(roteiroOrigem)) return;

    setDraggedLoja(loja);
    setDraggedFromRoteiro(roteiroId);
  };

  const onDragOver = (e, index, roteiroDestinoId) => {
    const roteiroOrigem = getRoteiroById(draggedFromRoteiro);
    const roteiroDestino = getRoteiroById(roteiroDestinoId);

    if (
      !isGestorRoteiro ||
      !draggedLoja ||
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      return;
    }

    e.preventDefault();
    setDraggedOverIndex(index);
  };

  const onDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const onDrop = (e, roteiroDestinoId, dropIndex = null) => {
    e.preventDefault();
    setDraggedOverIndex(null);

    if (!isGestorRoteiro) return;

    if (!draggedLoja) return;

    const roteiroOrigem = getRoteiroById(draggedFromRoteiro);
    const roteiroDestino = getRoteiroById(roteiroDestinoId);

    if (
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      setError(
        "Roteiro finalizado não permite adicionar, remover ou mover pontos.",
      );
      setDraggedLoja(null);
      setDraggedFromRoteiro(null);
      return;
    }

    // Se é o mesmo roteiro, reordenar
    if (draggedFromRoteiro === roteiroDestinoId && dropIndex !== null) {
      handleReordenarLoja(roteiroDestinoId, draggedLoja.id, dropIndex);
    }
    // Se é roteiro diferente, mover
    else if (draggedFromRoteiro !== roteiroDestinoId) {
      handleMoverLoja(draggedLoja.id, draggedFromRoteiro, roteiroDestinoId);
    }

    setDraggedLoja(null);
    setDraggedFromRoteiro(null);
  };

  if (loading)
    return (
      <div className="p-20 text-center font-bold">Carregando roteiros...</div>
    );

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🗺️ Gestão de Rotas</h1>
          {isGestorRoteiro && (
            <button
              onClick={() => setShowModalCriarRoteiro(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-shadow shadow-md"
            >
              + Nova Rota
            </button>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Buscar rota por nome
          </label>
          <input
            type="text"
            value={filtroNomeRoteiro}
            onChange={(e) => setFiltroNomeRoteiro(e.target.value)}
            placeholder="Digite o nome do roteiro..."
            className="w-full max-w-md p-3 border rounded-xl bg-white focus:ring-2 focus:ring-[#24094E] outline-none"
          />
        </div>

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

        {/* Funcionários veem só os roteiros atribuídos a eles */}
        {!isGestorRoteiro && roteirosDoUsuario.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700 font-medium mb-6">
            Nenhuma rota atribuída a você no momento.
          </div>
        )}

        {roteirosDoUsuario.length > 0 && roteirosFiltrados.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600 font-medium mb-6">
            Nenhuma rota encontrada com esse nome.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roteirosFiltrados.map((roteiro) => (
            <div
              key={roteiro.id}
              onDragOver={(e) => {
                if (!isGestorRoteiro || isRoteiroFinalizado(roteiro)) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!isGestorRoteiro || isRoteiroFinalizado(roteiro)) return;
                onDrop(e, roteiro.id);
              }}
              className={`rounded-xl shadow-lg p-6 border-2 transition-all 
                ${roteiro.status === "finalizado" ? "bg-green-50 border-green-600" : "bg-white border-transparent"}
                ${draggedLoja && draggedFromRoteiro !== roteiro.id && !isRoteiroFinalizado(roteiro) ? "border-blue-400 border-dashed bg-blue-50" : ""}
              `}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  {roteiro.nome}
                  {roteiro.status === "finalizado" && (
                    <span className="ml-2 px-2 py-1 rounded-full bg-green-200 text-green-800 text-xs font-bold uppercase">
                      Finalizado
                    </span>
                  )}
                </h2>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${roteiro.funcionarioId ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                >
                  {roteiro.funcionarioId ? "Ativo" : "Pendente"}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                🚗 {getVeiculoResumoRoteiro(roteiro)}
              </p>

              {/* Seção de Funcionário */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1">
                  RESPONSÁVEL
                </label>
                {isGestorRoteiro ? (
                  <select
                    className="w-full p-2 text-sm border rounded bg-gray-50"
                    value={String(roteiro.funcionarioId || "")}
                    onChange={async (e) => {
                      const rawId = e.target.value;
                      // IDs são UUID — não converter para número
                      const funcionarioId = normalizarIdOpcional(rawId);
                      const veiculoId = normalizarIdOpcional(roteiro.veiculoId);
                      const f = funcionarios.find(
                        (x) => String(x.id) === rawId,
                      );
                      const funcionarioNome = f?.nome || "";

                      // Atualização optimista para não flickar o select
                      setRoteiros((prev) =>
                        prev.map((r) =>
                          r.id === roteiro.id
                            ? { ...r, funcionarioId, funcionarioNome }
                            : r,
                        ),
                      );

                      try {
                        await api.post(`/roteiros/${roteiro.id}/iniciar`, {
                          funcionarioId,
                          funcionarioNome,
                          veiculoId,
                        });
                        setSuccess(
                          `Funcionário ${funcionarioNome || "removido"} atribuído com sucesso.`,
                        );
                        // Recarregar dados do backend para garantir persistência
                        carregarDadosIniciais();
                      } catch (err) {
                        setError(
                          getMensagemErroVeiculo(
                            err,
                            "Erro ao atribuir funcionário ao roteiro.",
                          ),
                        );
                        // Reverter se falhou
                        setRoteiros((prev) =>
                          prev.map((r) =>
                            r.id === roteiro.id
                              ? {
                                  ...r,
                                  funcionarioId: roteiro.funcionarioId,
                                  funcionarioNome: roteiro.funcionarioNome,
                                }
                              : r,
                          ),
                        );
                      }
                    }}
                  >
                    <option value="">Selecione um funcionário</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">
                    {roteiro.funcionarioNome || "Não atribuído"}
                  </p>
                )}
              </div>

              {/* Seção de Veículo */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1">
                  VEÍCULO
                </label>
                {isGestorRoteiro ? (
                  <select
                    className="w-full p-2 text-sm border rounded bg-gray-50"
                    value={String(roteiro.veiculoId || "")}
                    onChange={(e) =>
                      handleAtualizarVeiculoRoteiro(roteiro, e.target.value)
                    }
                  >
                    <option value="">Sem veículo</option>
                    {veiculos.map((veiculo) => (
                      <option key={veiculo.id} value={String(veiculo.id)}>
                        {getVeiculoLabel(veiculo)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">
                    {getVeiculoResumoRoteiro(roteiro)}
                  </p>
                )}
              </div>

              {/* Seção Dias da Semana */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  DIAS DA SEMANA
                </label>
                <div className="flex flex-wrap gap-1">
                  {DIAS_SEMANA.map(({ label, full }) => {
                    const selecionado = getDiasRoteiro(roteiro).includes(label);
                    return (
                      <button
                        key={label}
                        title={full}
                        disabled={!isGestorRoteiro}
                        onClick={() => toggleDia(roteiro.id, label)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors border
                          ${
                            selecionado
                              ? "bg-[#24094E] text-white border-[#24094E]"
                              : "bg-gray-100 text-gray-400 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"
                          }
                          ${!isGestorRoteiro ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {isGestorRoteiro && diasPendentes[roteiro.id] !== undefined && (
                  <button
                    onClick={() => salvarDias(roteiro.id)}
                    disabled={salvandoDias[roteiro.id]}
                    className="mt-2 w-full py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {salvandoDias[roteiro.id] ? "Salvando..." : "Salvar dias"}
                  </button>
                )}
              </div>

              {/* Seção Orçamento Diário */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  ORÇAMENTO DIÁRIO
                </label>
                {isGestorRoteiro ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                        value={getOrcamentoRoteiro(roteiro)}
                        onChange={(e) =>
                          handleOrcamentoChange(roteiro.id, e.target.value)
                        }
                      />
                      {orcamentosPendentes[roteiro.id] !== undefined && (
                        <button
                          onClick={() => salvarOrcamentoDiario(roteiro.id)}
                          disabled={salvandoOrcamento[roteiro.id]}
                          className="whitespace-nowrap py-2 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {salvandoOrcamento[roteiro.id]
                            ? "Salvando..."
                            : "Salvar orçamento"}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Valor padrão: {formatarMoedaBRL(ORCAMENTO_DIARIO_PADRAO)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-green-700">
                    {formatarMoedaBRL(getOrcamentoNumericoRoteiro(roteiro))}
                  </p>
                )}
              </div>

              {/* Seção de Observação */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  OBSERVAÇÃO DO ROTEIRO
                </label>
                {isGestorRoteiro ? (
                  <>
                    <textarea
                      name="observacao"
                      rows="3"
                      className="w-full p-2 text-sm border rounded bg-gray-50 resize-y focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: conferir máquina M003, levar peças de reposição..."
                      value={getObservacaoRoteiro(roteiro)}
                      onChange={(e) =>
                        handleObservacaoChange(roteiro.id, e.target.value)
                      }
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-500">
                        {getObservacaoRoteiro(roteiro).length}/
                        {LIMITE_OBSERVACAO_ROTEIRO}
                      </span>
                      {observacoesPendentes[roteiro.id] !== undefined && (
                        <button
                          onClick={() => salvarObservacao(roteiro.id)}
                          disabled={salvandoObservacao[roteiro.id]}
                          className="py-1 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {salvandoObservacao[roteiro.id]
                            ? "Salvando..."
                            : "Salvar observação"}
                        </button>
                      )}
                    </div>
                  </>
                ) : roteiro.observacao?.trim() ? (
                  <p className="text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
                    {roteiro.observacao}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Sem observação cadastrada.
                  </p>
                )}
              </div>

              {/* Lista de Pontos */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-400">
                    PONTOS NO DIA
                  </span>
                  {isGestorRoteiro && !isRoteiroFinalizado(roteiro) && (
                    <button
                      onClick={() => {
                        setRoteiroParaAdicionar(roteiro);
                        setFiltroLojaAdicionar("");
                        setShowModalAdicionarLoja(true);
                      }}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
                <div className="min-h-30 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {roteiro.lojas?.length > 0 ? (
                    roteiro.lojas
                      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                      .map((loja, index) => (
                        <div
                          key={loja.id}
                          draggable={
                            isGestorRoteiro && !isRoteiroFinalizado(roteiro)
                          }
                          onDragStart={() => onDragStart(loja, roteiro.id)}
                          onDragOver={(e) => onDragOver(e, index, roteiro.id)}
                          onDragLeave={onDragLeave}
                          onDrop={(e) => onDrop(e, roteiro.id, index)}
                          className={`bg-white p-3 rounded-md border shadow-sm mb-2 text-sm flex items-center gap-2 transition-colors
                            ${isGestorRoteiro && !isRoteiroFinalizado(roteiro) ? "cursor-move hover:border-blue-300" : ""}
                            ${draggedOverIndex === index && draggedFromRoteiro === roteiro.id ? "border-blue-500 border-2 bg-blue-50" : "border-gray-200"}
                          `}
                        >
                          <span className="text-gray-400">☰</span>
                          <span className="bg-[#24094E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          🏪 {loja.nome}
                        </div>
                      ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 opacity-30">
                      <span className="text-2xl">📦</span>
                      <p className="text-[10px] font-bold">VAZIO</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação com lógica dinâmica */}
              <div className="flex gap-2 mt-auto">
                {isRoteiroPendenteOuEmAndamento(roteiro) ? (
                  <>
                    <button
                      onClick={() => iniciarOuContinuarRoteiro(roteiro.id)}
                      className="flex-1 bg-[#24094E] text-white py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors"
                    >
                      {roteiro.funcionarioId ? "Continuar" : "Começar Rota"}
                    </button>
                    {roteiro.funcionarioId && (
                      <button
                        onClick={() => abrirModalFinalizacao(roteiro)}
                        className="bg-green-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                      >
                        Finalizar
                      </button>
                    )}
                    {isGestorRoteiro && (
                      <button
                        onClick={() => handleExcluirRoteiro(roteiro)}
                        disabled={Boolean(apagandoRoteiros[roteiro.id])}
                        className="bg-red-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {apagandoRoteiros[roteiro.id]
                          ? "Apagando..."
                          : "Apagar"}
                      </button>
                    )}
                  </>
                ) : isRoteiroFinalizado(roteiro) ? (
                  <>
                    <button
                      onClick={() =>
                        navigate(`/roteiros/${roteiro.id}/executar`)
                      }
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                    >
                      Abrir Rota
                    </button>
                    {isGestorRoteiro && (
                      <button
                        onClick={() => handleExcluirRoteiro(roteiro)}
                        disabled={Boolean(apagandoRoteiros[roteiro.id])}
                        className="bg-red-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {apagandoRoteiros[roteiro.id]
                          ? "Apagando..."
                          : "Apagar"}
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL CRIAR ROTEIRO */}
      {showModalCriarRoteiro && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Criar Novo Roteiro</h2>
            <input
              autoFocus
              className="w-full p-3 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Roteiro Norte - Seg"
              value={novoNomeRoteiro}
              onChange={(e) => setNovoNomeRoteiro(e.target.value)}
            />
            <label className="text-xs font-bold text-gray-400 block mb-2">
              DIAS DA SEMANA
            </label>
            <div className="flex flex-wrap gap-2 mb-5">
              {DIAS_SEMANA.map(({ label, full }) => {
                const selecionado = novosDiasRoteiro.includes(label);
                return (
                  <button
                    key={label}
                    title={full}
                    type="button"
                    onClick={() =>
                      setNovosDiasRoteiro((prev) =>
                        prev.includes(label)
                          ? prev.filter((d) => d !== label)
                          : [...prev, label],
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors
                      ${
                        selecionado
                          ? "bg-[#24094E] text-white border-[#24094E]"
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="text-xs font-bold text-gray-400 block mb-2">
              VEÍCULO (OPCIONAL)
            </label>
            <select
              className="w-full p-3 border rounded-xl mb-4 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={novoVeiculoId}
              onChange={(e) => setNovoVeiculoId(e.target.value)}
            >
              <option value="">Sem veículo</option>
              {veiculos.map((veiculo) => (
                <option key={veiculo.id} value={String(veiculo.id)}>
                  {getVeiculoLabel(veiculo)}
                </option>
              ))}
            </select>
            <label className="text-xs font-bold text-gray-400 block mb-2">
              Observação do roteiro (opcional)
            </label>
            <textarea
              name="observacao"
              rows="4"
              className="w-full p-3 border rounded-xl mb-1 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
              placeholder="Ex: conferir máquina M003, levar peças de reposição..."
              value={novaObservacaoRoteiro}
              onChange={(e) =>
                setNovaObservacaoRoteiro(
                  e.target.value.slice(0, LIMITE_OBSERVACAO_ROTEIRO),
                )
              }
            />
            <p className="text-xs text-gray-500 mb-4">
              {novaObservacaoRoteiro.length}/{LIMITE_OBSERVACAO_ROTEIRO}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModalCriarRoteiro(false);
                  setNovoVeiculoId("");
                  setNovosDiasRoteiro([]);
                  setNovaObservacaoRoteiro("");
                }}
                className="flex-1 py-3 text-gray-500 font-bold"
              >
                Voltar
              </button>
              <button
                onClick={handleCriarRoteiro}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR PONTO (Simplificado) */}
      {showModalAdicionarLoja && roteiroParaAdicionar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              Adicionar Ponto a {roteiroParaAdicionar.nome}
            </h2>
            <div className="mb-3">
              <input
                autoFocus
                type="text"
                value={filtroLojaAdicionar}
                onChange={(e) => setFiltroLojaAdicionar(e.target.value)}
                placeholder="Buscar ponto por nome, cidade, bairro ou código..."
                className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#24094E] outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {lojasFiltradasParaAdicionar.length} ponto
                {lojasFiltradasParaAdicionar.length === 1 ? "" : "s"} disponível
                {lojasFiltradasParaAdicionar.length === 1 ? "" : "is"} para
                adicionar
              </p>
            </div>
            {isRoteiroFinalizado(roteiroParaAdicionar) && (
              <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                Esta rota está finalizada. Não é permitido adicionar pontos.
              </div>
            )}
            <div className="overflow-y-auto space-y-2 mb-4">
              {lojasFiltradasParaAdicionar.length > 0 ? (
                lojasFiltradasParaAdicionar.map((loja) => (
                  <button
                    key={loja.id}
                    onClick={() => {
                      handleMoverLoja(loja.id, null, roteiroParaAdicionar.id);
                      setFiltroLojaAdicionar("");
                      setRoteiroParaAdicionar(null);
                      setShowModalAdicionarLoja(false);
                    }}
                    disabled={isRoteiroFinalizado(roteiroParaAdicionar)}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-xl border flex justify-between items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium text-sm">🏪 {loja.nome}</span>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 font-bold text-xs">
                      + ADICIONAR
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  {filtroLojaAdicionar
                    ? "Nenhum ponto encontrado para este filtro."
                    : "Todos os pontos já foram adicionados a este roteiro."}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setFiltroLojaAdicionar("");
                setRoteiroParaAdicionar(null);
                setShowModalAdicionarLoja(false);
              }}
              className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalFinalizar.aberto}
        onClose={fecharModalFinalizacao}
        title={
          modalFinalizar.etapa === 1
            ? "Confirmar finalização"
            : "Confirmação final"
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {modalFinalizar.etapa === 1
              ? `Deseja finalizar o roteiro ${modalFinalizar.roteiro?.nome || ""}?`
              : "Confirma novamente a finalização deste roteiro?"}
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={fecharModalFinalizacao}
              disabled={modalFinalizar.loading}
            >
              Cancelar
            </button>
            {modalFinalizar.etapa === 1 ? (
              <button
                className="btn-primary"
                onClick={avancarConfirmacaoFinalizacao}
              >
                Continuar
              </button>
            ) : (
              <button
                className="btn-danger"
                onClick={executarFinalizacaoRoteiro}
                disabled={modalFinalizar.loading}
              >
                {modalFinalizar.loading
                  ? "Finalizando..."
                  : "Finalizar Roteiro"}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
