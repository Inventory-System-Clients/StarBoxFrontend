import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { Modal, AlertBox } from "../components/UIComponents";
import ManutencaoModal from "../components/ManutencaoModal";
import { useAuth } from "../contexts/AuthContext";
import {
  abrirWhatsAppComMensagem,
  extrairKmMovimentacoesRoteiro,
  extrairResumoExecucaoRoteiro,
  montarMensagemFinalizacaoRoteiro,
  obterKmInicialPilotagemAtiva,
  obterEstoqueInicialSnapshotRoteiro,
  obterKmInicialPilotagemSnapshotRoteiro,
  removerEstoqueInicialSnapshotRoteiro,
  removerKmInicialPilotagemSnapshotRoteiro,
  salvarEstoqueInicialSnapshotRoteiro,
  salvarKmInicialPilotagemSnapshotRoteiro,
  somarPeluciasUsadasMovimentacoes,
  somarSaldoEstoqueUsuario,
} from "../lib/roteiroFinalizacaoWhatsApp";

export default function RoteiroExecucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const CATEGORIAS_GASTO = [
    { value: "transporte", label: "Transporte" },
    { value: "estadia", label: "Estadia" },
    { value: "abastecimento", label: "Abastecimento" },
    { value: "alimentacao", label: "Alimentação" },
    { value: "outros", label: "Outros" },
  ];
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [erroCarregamentoInicial, setErroCarregamentoInicial] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    loading: false,
  });
  const [modalNovaManutencao, setModalNovaManutencao] = useState({
    aberto: false,
    loading: false,
  });
  const [novaManutencaoRoteiro, setNovaManutencaoRoteiro] = useState({
    maquinaId: "",
    descricao: "",
  });

  // Estados para manutenção
  const [manutencaoPendente, setManutencaoPendente] = useState(null);
  const [modalManutencao, setModalManutencao] = useState(false);
  const [manutencaoRecemCriada, setManutencaoRecemCriada] = useState(null);

  // Estados para controle de ordem
  const [modalJustificativa, setModalJustificativa] = useState({
    aberto: false,
    lojaId: null,
    lojaNome: "",
    lojaIdEsperada: null,
    lojaEsperadaNome: "",
    justificativa: "",
  });
  const [gastoForm, setGastoForm] = useState({
    categoria: "transporte",
    valor: "",
    quilometragem: "",
    litros: "",
    nivelCombustivel: "Cheio",
    observacao: "",
  });
  const [lancandoGasto, setLancandoGasto] = useState(false);

  const lojaEstaConcluida = (status) =>
    ["concluido", "concluida", "finalizado", "finalizada"].includes(
      String(status || "").toLowerCase(),
    );

  const roteiroEstaFinalizado = (status) =>
    ["finalizado", "finalizada", "concluido", "concluida"].includes(
      String(status || "").toLowerCase(),
    );

  const maquinaEstaConcluida = (status) =>
    ["finalizado", "finalizada", "concluido", "concluida"].includes(
      String(status || "").toLowerCase(),
    );

  const roteiroTemPendencias = (roteiroAtual) => {
    const lojas = Array.isArray(roteiroAtual?.lojas) ? roteiroAtual.lojas : [];
    return lojas.some((loja) => {
      const statusLojaConcluido = lojaEstaConcluida(loja?.status);
      const maquinas = Array.isArray(loja?.maquinas) ? loja.maquinas : [];

      if (!statusLojaConcluido) return true;
      return maquinas.some((maquina) => !maquinaEstaConcluida(maquina?.status));
    });
  };

  const roteiroTemVeiculoAssociado = (roteiroAtual) =>
    Boolean(
      String(roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "").trim(),
    );

  const formatarMoedaBRL = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const formatarDataHora = (dataIso) => {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) {
      return { data: "-", hora: "-" };
    }
    return {
      data: data.toLocaleDateString("pt-BR"),
      hora: data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const parseValorMonetario = (valorTexto) => {
    const texto = String(valorTexto || "").trim();
    if (!texto) return 0;
    return Number(texto.replace(",", "."));
  };

  const getLabelCategoriaGasto = (categoria) =>
    CATEGORIAS_GASTO.find((item) => item.value === categoria)?.label ||
    categoria ||
    "-";

  useEffect(() => {
    carregarRoteiro();
  }, [id]);

  // Efeito para selecionar automaticamente a loja quando volta da movimentação
  useEffect(() => {
    if (roteiro && location.state?.lojaId) {
      const loja = roteiro.lojas?.find((l) => l.id === location.state.lojaId);
      if (loja) {
        setLojaSelecionada(loja);
        // Limpar apenas o lojaId para preservar outros sinais de fluxo.
        const proximoState = { ...(location.state || {}) };
        delete proximoState.lojaId;
        navigate(location.pathname, {
          replace: true,
          state: Object.keys(proximoState).length > 0 ? proximoState : {},
        });
      }
    }
  }, [roteiro, location.state]);

  useEffect(() => {
    if (!roteiro || !roteiroEstaFinalizado(roteiro.status)) return;
    if (roteiroTemPendencias(roteiro)) return;
    if (!roteiroTemVeiculoAssociado(roteiro)) return;
    if (!location.state?.origemMovimentacao) return;
    if (location.state?.pilotagemFinalizada) return;

    const mensagemBloqueio =
      "Roteiro concluído automaticamente. Finalize primeiro a pilotagem do veículo para concluir o fechamento da rota.";

    setSuccess(
      "Roteiro concluído automaticamente. Você será redirecionado para finalizar o veículo.",
    );

    navigate("/veiculos", {
      state: {
        origem: "roteiros-finalizacao",
        retornarPara: `/roteiros/${id}/executar`,
        roteiroIdParaFinalizar: id,
        alertaFinalizarVeiculo: mensagemBloqueio,
        alertaFinalizarVeiculoToken: `${Date.now()}-${id}`,
        fluxoFinalizacaoAutomatica: true,
      },
    });
  }, [id, location.state, navigate, roteiro]);

  useEffect(() => {
    if (!location.state?.origemMovimentacao) return;
    carregarRoteiro();
  }, [location.state?.origemMovimentacao]);

  useEffect(() => {
    const roteiroIdState = String(location.state?.roteiroIdParaFinalizar || "");
    if (!location.state?.pilotagemFinalizada || roteiroIdState !== String(id)) {
      return;
    }

    setSuccess(
      "Veículo finalizado com sucesso. Confirme a finalização da rota para enviar o resumo no WhatsApp.",
    );
    setModalFinalizar({ aberto: true, etapa: 1, loading: false });

    const proximoState = { ...(location.state || {}) };
    delete proximoState.pilotagemFinalizada;
    delete proximoState.roteiroIdParaFinalizar;
    delete proximoState.fluxoFinalizacaoAutomatica;

    navigate(location.pathname, {
      replace: true,
      state: Object.keys(proximoState).length > 0 ? proximoState : {},
    });
  }, [id, location.pathname, location.state, navigate]);

  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      setErroCarregamentoInicial("");
      const res = await api.get(`/roteiros/${id}/executar`);
      setRoteiro(res.data);

      const usuarioReferenciaId = String(
        res?.data?.funcionarioId || usuario?.id || "",
      ).trim();
      let kmInicialSnapshotExistente = obterKmInicialPilotagemSnapshotRoteiro({
        roteiroId: id,
        usuarioId: usuarioReferenciaId,
      });
      const snapshotExistente = obterEstoqueInicialSnapshotRoteiro({
        roteiroId: id,
        usuarioId: usuarioReferenciaId,
      });

      if (!Number.isFinite(snapshotExistente) && usuarioReferenciaId) {
        try {
          const estoqueRes = await api.get("/estoque-usuarios/me");
          const saldoAtual = somarSaldoEstoqueUsuario(estoqueRes.data);

          salvarEstoqueInicialSnapshotRoteiro({
            roteiroId: id,
            usuarioId: usuarioReferenciaId,
            quantidadeInicial: saldoAtual,
            sobrescrever: false,
          });
        } catch {
          // Sem bloqueio de fluxo caso a captura inicial falhe.
        }
      }

      if (!Number.isFinite(kmInicialSnapshotExistente) && usuarioReferenciaId) {
        const kmInicialPilotagemAtiva = obterKmInicialPilotagemAtiva({
          usuarioId: usuarioReferenciaId,
          veiculoId: res?.data?.veiculoId || res?.data?.veiculo?.id,
        });

        if (Number.isFinite(kmInicialPilotagemAtiva)) {
          salvarKmInicialPilotagemSnapshotRoteiro({
            roteiroId: id,
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
            const veiculoMovId = String(
              mov?.veiculoId || mov?.veiculo?.id || "",
            );
            const veiculoRoteiroId = String(
              res?.data?.veiculoId || res?.data?.veiculo?.id || "",
            );

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
              roteiroId: id,
              usuarioId: usuarioReferenciaId,
              kmInicial: kmInicialPilotagem,
              sobrescrever: false,
            });
          }
        } catch {
          // Sem bloqueio de fluxo caso a captura do KM inicial falhe.
        }
      }

      console.log("Roteiro carregado:", res.data);
    } catch (err) {
      setErroCarregamentoInicial("Erro ao buscar roteiro.");
    } finally {
      setLoading(false);
    }
  };

  const verificarManutencoesPendentes = async (lojaId) => {
    try {
      const res = await api.get(`/manutencoes`, {
        params: {
          lojaId,
          status: "pendente",
        },
      });
      const manutencoesPendentes = res.data || [];

      if (manutencoesPendentes.length > 0) {
        // Pega a primeira manutenção pendente
        setManutencaoPendente(manutencoesPendentes[0]);
        setModalManutencao(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao verificar manutenções:", err);
      return false;
    }
  };

  const handleSelecionarLoja = async (loja) => {
    // Verificar ordem das lojas
    if (roteiro?.lojas) {
      const lojasOrdenadas = [...roteiro.lojas].sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0),
      );
      const proximaLoja = lojasOrdenadas.find(
        (l) => !lojaEstaConcluida(l.status),
      );

      // Se não é a próxima loja na ordem e ainda tem lojas pendentes antes
      if (
        proximaLoja &&
        proximaLoja.id !== loja.id &&
        !lojaEstaConcluida(loja.status)
      ) {
        setModalJustificativa({
          aberto: true,
          lojaId: loja.id,
          lojaNome: loja.nome,
          lojaIdEsperada: proximaLoja.id,
          lojaEsperadaNome: proximaLoja.nome,
          justificativa: "",
        });
        return;
      }
    }

    setLojaSelecionada(loja);
    setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
    setManutencaoRecemCriada(null);

    // Verificar se há manutenções pendentes nesta loja
    if (loja && loja.id) {
      await verificarManutencoesPendentes(loja.id);
    }
  };

  const confirmarSelecaoComJustificativa = async () => {
    if (!modalJustificativa.justificativa.trim()) {
      setError("Por favor, informe o motivo de pular o ponto anterior.");
      return;
    }

    try {
      // Salvar justificativa via API
      await api.post(`/roteiros/${id}/justificar-ordem`, {
        lojaId: modalJustificativa.lojaId,
        lojaIdEsperada: modalJustificativa.lojaIdEsperada,
        justificativa: modalJustificativa.justificativa,
      });

      const loja = roteiro.lojas.find(
        (l) => l.id === modalJustificativa.lojaId,
      );
      setLojaSelecionada(loja);

      // Verificar manutenções
      if (loja && loja.id) {
        await verificarManutencoesPendentes(loja.id);
      }

      setModalJustificativa({
        aberto: false,
        lojaId: null,
        lojaNome: "",
        lojaIdEsperada: null,
        lojaEsperadaNome: "",
        justificativa: "",
      });
    } catch (err) {
      setError("Erro ao salvar justificativa.");
    }
  };

  const handleManutencaoConcluida = async () => {
    setSuccess("Manutenção processada com sucesso!");
    setModalManutencao(false);

    if (
      manutencaoRecemCriada?.id &&
      manutencaoPendente?.id === manutencaoRecemCriada.id
    ) {
      setManutencaoRecemCriada(null);
    }

    setManutencaoPendente(null);
    // Recarregar roteiro para atualizar status
    await carregarRoteiro();
  };

  const abrirModalNovaManutencao = () => {
    setError("");
    setSuccess("");
    setManutencaoRecemCriada(null);
    setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
    setModalNovaManutencao({ aberto: true, loading: false });
  };

  const abrirManutencaoRecemCriada = () => {
    if (!manutencaoRecemCriada?.id) return;

    setError("");
    setManutencaoPendente(manutencaoRecemCriada);
    setModalManutencao(true);
  };

  const fecharModalNovaManutencao = () => {
    if (modalNovaManutencao.loading) return;
    setModalNovaManutencao({ aberto: false, loading: false });
  };

  const handleCriarManutencaoRoteiro = async () => {
    if (!lojaSelecionada?.id) {
      setError("Selecione uma loja para adicionar manutenção.");
      return;
    }

    const descricaoLimpa = String(novaManutencaoRoteiro.descricao || "").trim();
    if (!novaManutencaoRoteiro.maquinaId) {
      setError("Selecione a máquina da manutenção.");
      return;
    }
    if (!descricaoLimpa) {
      setError("Descreva o que precisa ser feito na manutenção.");
      return;
    }

    try {
      setModalNovaManutencao((prev) => ({ ...prev, loading: true }));
      setError("");
      setSuccess("");

      const maquinaIdSelecionada = novaManutencaoRoteiro.maquinaId;
      const resCriacao = await api.post("/manutencoes", {
        descricao: descricaoLimpa,
        lojaId: lojaSelecionada.id,
        maquinaId: maquinaIdSelecionada,
        funcionarioId: usuario?.id || null,
      });

      const payload = resCriacao?.data;
      const manutencaoCriadaResponse =
        payload?.manutencao && typeof payload.manutencao === "object"
          ? payload.manutencao
          : payload && typeof payload === "object" && payload.id
            ? payload
            : null;

      let manutencaoCriada = manutencaoCriadaResponse;

      if (!manutencaoCriada?.id) {
        const resPendentes = await api.get("/manutencoes", {
          params: {
            lojaId: lojaSelecionada.id,
            status: "pendente",
          },
        });

        const pendentes = Array.isArray(resPendentes?.data)
          ? resPendentes.data
          : [];
        manutencaoCriada =
          pendentes.find(
            (item) =>
              String(item?.maquinaId || item?.maquina_id || "") ===
                String(maquinaIdSelecionada || "") &&
              String(item?.descricao || "").trim() === descricaoLimpa,
          ) ||
          pendentes[0] ||
          null;
      }

      if (manutencaoCriada?.id) {
        const maquinaSelecionada = (lojaSelecionada?.maquinas || []).find(
          (item) =>
            String(item?.id || "") === String(maquinaIdSelecionada || ""),
        );

        setManutencaoRecemCriada({
          ...manutencaoCriada,
          descricao: manutencaoCriada.descricao || descricaoLimpa,
          loja: manutencaoCriada.loja || {
            id: lojaSelecionada.id,
            nome: lojaSelecionada?.nome || "-",
          },
          maquina:
            manutencaoCriada.maquina ||
            (maquinaSelecionada
              ? {
                  id: maquinaSelecionada.id,
                  codigo: maquinaSelecionada.codigo,
                  nome: maquinaSelecionada.nome,
                }
              : null),
        });
      } else {
        setManutencaoRecemCriada(null);
      }

      setSuccess(
        "Manutenção criada com sucesso! Clique em 'Fazer manutenção criada agora' para concluir agora.",
      );
      setModalNovaManutencao({ aberto: false, loading: false });
      setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
      await carregarRoteiro();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao criar manutenção.");
      setModalNovaManutencao((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleLancarGasto = async () => {
    const categoriasPermitidas = CATEGORIAS_GASTO.map((item) => item.value);
    if (!categoriasPermitidas.includes(gastoForm.categoria)) {
      setError("Categoria de gasto inválida.");
      return;
    }

    const valorNumerico = parseValorMonetario(gastoForm.valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setError("Informe um valor válido para o gasto.");
      return;
    }

    const observacaoNormalizada = String(gastoForm.observacao || "").trim();
    if (gastoForm.categoria === "outros" && !observacaoNormalizada) {
      setError("Observação é obrigatória quando a categoria for Outros.");
      return;
    }

    let quilometragemNumerica = null;
    let litrosNumericos = null;
    if (gastoForm.categoria === "abastecimento") {
      if (!roteiro?.veiculo?.id) {
        setError(
          "Este roteiro não possui veículo associado. Vincule um veículo antes de lançar abastecimento.",
        );
        return;
      }

      const kmDigitado = Number.parseInt(gastoForm.quilometragem, 10);
      if (!Number.isInteger(kmDigitado) || kmDigitado < 0) {
        setError(
          "Informe o KM do abastecimento (número inteiro maior ou igual a zero).",
        );
        return;
      }
      quilometragemNumerica = kmDigitado;

      const litrosDigitados = parseFloat(
        String(gastoForm.litros || "").replace(",", "."),
      );
      if (!Number.isFinite(litrosDigitados) || litrosDigitados <= 0) {
        setError(
          "Informe a quantidade de litros abastecidos (maior que zero).",
        );
        return;
      }
      litrosNumericos = litrosDigitados;
    }

    const saldoAtual = Number(roteiro?.saldoGastoHoje ?? 0);
    if (Number.isFinite(saldoAtual) && valorNumerico > saldoAtual) {
      setError(
        `Saldo diário insuficiente para este lançamento. Saldo disponível: ${formatarMoedaBRL(saldoAtual)}.`,
      );
      return;
    }

    try {
      setLancandoGasto(true);
      setError("");
      setSuccess("");

      const payload = {
        categoria: gastoForm.categoria,
        valor: valorNumerico,
        quilometragem: quilometragemNumerica,
        litros: litrosNumericos,
        nivelCombustivel:
          gastoForm.categoria === "abastecimento"
            ? gastoForm.nivelCombustivel
            : null,
        observacao: observacaoNormalizada || null,
      };

      const res = await api.post(`/roteiros/${id}/gastos`, payload);

      setSuccess(res?.data?.message || "Gasto diário registrado com sucesso.");
      setGastoForm((prev) => ({
        ...prev,
        valor: "",
        quilometragem: "",
        litros: "",
        observacao: "",
      }));
      await carregarRoteiro();
    } catch (err) {
      const mensagemErro =
        err?.response?.data?.error || "Erro ao registrar gasto diário.";
      const saldoDisponivelErro = err?.response?.data?.saldoDisponivel;
      if (typeof saldoDisponivelErro === "number") {
        setError(
          `${mensagemErro}. Saldo disponível: ${formatarMoedaBRL(saldoDisponivelErro)}.`,
        );
      } else {
        setError(mensagemErro);
      }
    } finally {
      setLancandoGasto(false);
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    if (!roteiro) return;

    const validarPilotagemAtivaUsuario = async () => {
      try {
        const [ultimasMovRes, veiculosRes] = await Promise.all([
          api.get("/movimentacao-veiculos/ultimas"),
          api.get("/veiculos"),
        ]);

        const usuarioId = String(usuario?.id || "");
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
          );
          const tipoMov = String(mov?.tipo || "").toLowerCase();
          const veiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "");
          const veiculo = veiculosLista.find((v) => String(v.id) === veiculoId);

          return (
            usuarioMovId === usuarioId &&
            tipoMov === "retirada" &&
            Boolean(veiculo?.emUso)
          );
        });

        const temVinculoDiretoNoVeiculo = veiculosLista.some((veiculo) => {
          const usuarioVeiculoId = String(
            veiculo?.usuario?.id ||
              veiculo?.usuarioId ||
              veiculo?.funcionarioId ||
              veiculo?.condutorId ||
              "",
          );

          return Boolean(veiculo?.emUso) && usuarioVeiculoId === usuarioId;
        });

        return temRetiradaAtiva || temVinculoDiretoNoVeiculo;
      } catch {
        setError(
          "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
        );
        return false;
      }
    };

    if (roteiroTemVeiculoAssociado(roteiro)) {
      const temPilotagemAtiva = await validarPilotagemAtivaUsuario();
      if (temPilotagemAtiva) {
        const mensagemBloqueio =
          "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

        setError(mensagemBloqueio);
        setModalFinalizar({ aberto: false, etapa: 1, loading: false });
        navigate("/veiculos", {
          state: {
            origem: "roteiros-finalizacao",
            retornarPara: `/roteiros/${id}/executar`,
            roteiroIdParaFinalizar: id,
            alertaFinalizarVeiculo: mensagemBloqueio,
            alertaFinalizarVeiculoToken: `${Date.now()}-${id}`,
          },
        });
        return;
      }
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

      const funcionarioDoRoteiro =
        finalizacaoData?.funcionarioId ||
        finalizacaoData?.funcionario?.id ||
        roteiro?.funcionarioId ||
        usuario?.id;
      const kmInicialPilotagemSnapshot = obterKmInicialPilotagemSnapshotRoteiro(
        {
          roteiroId: id,
          usuarioId: funcionarioDoRoteiro,
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
          if (!funcionarioDoRoteiro) {
            throw new Error("usuario de referencia ausente");
          }

          const estoqueResUsuario = await api.get(
            `/estoque-usuarios/${funcionarioDoRoteiro}`,
          );
          saldoPeluciasEstoque = somarSaldoEstoqueUsuario(
            estoqueResUsuario.data,
          );
        } catch {
          if (
            funcionarioDoRoteiro &&
            String(usuario?.id || "") === String(funcionarioDoRoteiro)
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
        roteiroId: id,
        usuarioId: funcionarioDoRoteiro,
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

      if (totalPeluciasUsadas === null || totalPeluciasUsadas <= 0) {
        try {
          const movRes = await api.get("/movimentacoes", {
            params: {
              roteiroId: id,
            },
          });

          const listaMov = Array.isArray(movRes.data)
            ? movRes.data
            : movRes.data?.rows || movRes.data?.movimentacoes || [];

          const totalPorMovimentacoes = somarPeluciasUsadasMovimentacoes(
            listaMov,
            funcionarioDoRoteiro,
          );

          if (
            Number.isFinite(totalPorMovimentacoes) &&
            totalPorMovimentacoes > 0
          ) {
            totalPeluciasUsadas = totalPorMovimentacoes;
          }
        } catch {
          // Sem fallback adicional.
        }
      }

      if (saldoPeluciasInicial !== null && saldoPeluciasEstoque !== null) {
        totalPeluciasUsadas = Math.max(
          0,
          saldoPeluciasInicial - saldoPeluciasEstoque,
        );
      } else if (
        saldoPeluciasInicial === null &&
        saldoPeluciasEstoque !== null &&
        totalPeluciasUsadas !== null
      ) {
        saldoPeluciasInicial = saldoPeluciasEstoque + totalPeluciasUsadas;
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

      try {
        const manutRes = await api.get("/manutencoes", {
          params: {
            roteiroId: id,
          },
        });

        const listaManut = Array.isArray(manutRes.data)
          ? manutRes.data
          : manutRes.data?.rows || [];

        const idsLojasRoteiro = new Set(
          (Array.isArray(roteiro?.lojas) ? roteiro.lojas : [])
            .map((loja) => String(loja?.id || ""))
            .filter(Boolean),
        );

        const relacionadasRoteiro = listaManut.filter((item) => {
          const rotaId = String(item?.roteiroId || item?.roteiro?.id || "");
          const lojaIdItem = String(item?.lojaId || item?.loja?.id || "");

          if (rotaId && rotaId === String(id)) return true;
          if (idsLojasRoteiro.has(lojaIdItem)) return true;
          return false;
        });

        const feitas = relacionadasRoteiro.filter((item) => {
          const status = String(item?.status || "").toLowerCase();
          return [
            "feito",
            "concluida",
            "concluido",
            "finalizada",
            "finalizado",
          ].includes(status);
        });

        const pendentes = relacionadasRoteiro.filter((item) => {
          const status = String(item?.status || "").toLowerCase();
          return ![
            "feito",
            "concluida",
            "concluido",
            "finalizada",
            "finalizado",
          ].includes(status);
        });

        manutencoesRealizadas = normalizarListaResumo([
          ...manutencoesRealizadas,
          ...feitas,
        ]);
        manutencoesNaoRealizadas = normalizarListaResumo([
          ...manutencoesNaoRealizadas,
          ...pendentes,
        ]);
      } catch {
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
            roteiroId: id,
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
            roteiroId: id,
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
        console.log("[ResumoFinalizacao][KM][RoteiroExecucao]", {
          roteiroId: id,
          usuarioId: funcionarioDoRoteiro,
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

      if (roteiroEstaFinalizado(roteiro?.status)) {
        const mensagemWhatsApp =
          await montarMensagemWhatsAppFinalizacao(roteiro);
        const abriuWhatsApp = abrirWhatsAppComMensagem(
          mensagemWhatsApp,
          popupReservado,
        );
        if (!abriuWhatsApp) {
          setSuccess(
            "Roteiro já finalizado. O navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
          );
        } else {
          setSuccess("Resumo do roteiro enviado para confirmação no WhatsApp.");
        }

        setModalFinalizar({ aberto: false, etapa: 1, loading: false });
        await carregarRoteiro();
        return;
      }

      const res = await api.post(`/roteiros/${id}/finalizar`);
      const usuarioReferenciaId = String(
        roteiro?.funcionarioId || usuario?.id || "",
      ).trim();
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomes = pendencias.map((p) => p.maquinaNome).join(", ");
        const envioWhatsApp = res?.data?.alertaWhatsApp?.status;
        setSuccess(
          `Roteiro finalizado com pendências: ${nomes}. Alerta WhatsApp: ${envioWhatsApp || "não enviado"}.`,
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
        roteiroId: id,
        usuarioId: usuarioReferenciaId,
      });
      removerKmInicialPilotagemSnapshotRoteiro({
        roteiroId: id,
        usuarioId: usuarioReferenciaId,
      });

      setModalFinalizar({ aberto: false, etapa: 1, loading: false });
      await carregarRoteiro();
    } catch (err) {
      if (popupReservado && !popupReservado.closed) {
        popupReservado.close();
      }
      setError(err?.response?.data?.error || "Erro ao finalizar roteiro.");
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = async () => {
    if (roteiroTemVeiculoAssociado(roteiro)) {
      try {
        const [ultimasMovRes, veiculosRes] = await Promise.all([
          api.get("/movimentacao-veiculos/ultimas"),
          api.get("/veiculos"),
        ]);

        const usuarioId = String(usuario?.id || "");
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
          );
          const tipoMov = String(mov?.tipo || "").toLowerCase();
          const veiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "");
          const veiculo = veiculosLista.find((v) => String(v.id) === veiculoId);

          return (
            usuarioMovId === usuarioId &&
            tipoMov === "retirada" &&
            Boolean(veiculo?.emUso)
          );
        });

        const temVinculoDiretoNoVeiculo = veiculosLista.some((veiculo) => {
          const usuarioVeiculoId = String(
            veiculo?.usuario?.id ||
              veiculo?.usuarioId ||
              veiculo?.funcionarioId ||
              veiculo?.condutorId ||
              "",
          );

          return Boolean(veiculo?.emUso) && usuarioVeiculoId === usuarioId;
        });

        if (temRetiradaAtiva || temVinculoDiretoNoVeiculo) {
          const mensagemBloqueio =
            "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

          setError(mensagemBloqueio);
          navigate("/veiculos", {
            state: {
              origem: "roteiros-finalizacao",
              retornarPara: `/roteiros/${id}/executar`,
              roteiroIdParaFinalizar: id,
              alertaFinalizarVeiculo: mensagemBloqueio,
              alertaFinalizarVeiculoToken: `${Date.now()}-${id}`,
            },
          });
          return;
        }
      } catch {
        setError(
          "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
        );
        return;
      }
    }

    setModalFinalizar({ aberto: true, etapa: 1, loading: false });
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({ aberto: false, etapa: 1, loading: false });
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  if (loading)
    return <div className="p-20 text-center font-bold">Carregando...</div>;
  if (erroCarregamentoInicial)
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AlertBox type="error" message={erroCarregamentoInicial} />
      </div>
    );
  if (!roteiro)
    return (
      <div className="p-20 text-center font-bold">Roteiro não encontrado.</div>
    );

  const observacaoAdmin = String(roteiro.observacao || "").trim();
  const veiculoResumo = roteiro?.veiculo
    ? [roteiro.veiculo.nome, roteiro.veiculo.modelo].filter(Boolean).join(" - ")
    : "Sem veículo associado";
  const orcamentoConvertido = Number(roteiro.orcamentoDiario);
  const totalGastoConvertido = Number(roteiro.totalGastoHoje);
  const saldoConvertido = Number(roteiro.saldoGastoHoje);

  const orcamentoDiario = Number.isFinite(orcamentoConvertido)
    ? orcamentoConvertido
    : 2000;
  const totalGastoHoje = Number.isFinite(totalGastoConvertido)
    ? totalGastoConvertido
    : 0;
  const saldoGastoHoje = Number.isFinite(saldoConvertido)
    ? saldoConvertido
    : orcamentoDiario - totalGastoHoje;
  const percentualSaldo =
    orcamentoDiario > 0 ? saldoGastoHoje / orcamentoDiario : 0;
  const percentualSaldoBarra = Math.max(
    0,
    Math.min(100, percentualSaldo * 100),
  );
  const saldoClassName =
    saldoGastoHoje <= 0
      ? "text-red-600"
      : percentualSaldo < 0.25
        ? "text-yellow-600"
        : "text-green-600";
  const kmObrigatorioPendente =
    gastoForm.categoria === "abastecimento" &&
    String(gastoForm.quilometragem || "").trim() === "";
  const litrosObrigatorioPendente =
    gastoForm.categoria === "abastecimento" &&
    String(gastoForm.litros || "").trim() === "";
  const observacaoObrigatoriaPendente =
    gastoForm.categoria === "outros" &&
    String(gastoForm.observacao || "").trim() === "";
  const gastosHojeOrdenados = [...(roteiro.gastosHoje || [])].sort(
    (a, b) => new Date(b.dataHora) - new Date(a.dataHora),
  );

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1
          className={`text-2xl font-bold mb-6 flex items-center gap-2 ${
            roteiroEstaFinalizado(roteiro.status) &&
            !roteiroTemPendencias(roteiro)
              ? "text-green-600"
              : ""
          }`}
        >
          Execução do Roteiro: {roteiro.nome}
          {roteiroEstaFinalizado(roteiro.status) &&
            !roteiroTemPendencias(roteiro) && (
              <span className="ml-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Finalizado
              </span>
            )}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          🚗 Veículo: {veiculoResumo}
        </p>
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
        {manutencaoRecemCriada?.id && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Manutenção criada nesta loja. Se quiser, finalize agora para já
              registrar peça/observação e disparar o WhatsApp.
            </p>
            <button
              className="btn-primary mt-3"
              onClick={abrirManutencaoRecemCriada}
            >
              Fazer manutenção criada agora
            </button>
          </div>
        )}
        {observacaoAdmin && (
          <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-1">
              Observações do Admin
            </h3>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">
              {observacaoAdmin}
            </p>
          </section>
        )}

        <section className="mb-8 bg-white rounded-xl shadow p-5 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold">💸 Gastos Diários do Roteiro</h2>
            <span className="text-xs bg-gray-100 px-3 py-1 rounded-full font-semibold text-gray-600">
              Lançamento de gastos disponível
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-700">
                Orçamento Diário
              </p>
              <p className="text-xl font-extrabold text-blue-800">
                {formatarMoedaBRL(orcamentoDiario)}
              </p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-700">
                Total Gasto Hoje
              </p>
              <p className="text-xl font-extrabold text-orange-800">
                {formatarMoedaBRL(totalGastoHoje)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-600">
                Saldo Disponível
              </p>
              <p className={`text-xl font-extrabold ${saldoClassName}`}>
                {formatarMoedaBRL(saldoGastoHoje)}
              </p>
            </div>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
            <div
              className={`h-full transition-all ${
                saldoGastoHoje <= 0
                  ? "bg-red-500"
                  : percentualSaldo < 0.25
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${percentualSaldoBarra}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Categoria
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={gastoForm.categoria}
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    categoria: e.target.value,
                    quilometragem:
                      e.target.value === "abastecimento"
                        ? prev.quilometragem
                        : "",
                  }))
                }
                disabled={lancandoGasto}
              >
                {CATEGORIAS_GASTO.map((categoria) => (
                  <option key={categoria.value} value={categoria.value}>
                    {categoria.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="w-full p-3 border rounded-lg bg-white"
                placeholder="Ex: 120.50"
                value={gastoForm.valor}
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    valor: e.target.value,
                  }))
                }
                disabled={lancandoGasto}
              />
            </div>
          </div>

          {gastoForm.categoria === "abastecimento" && (
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                KM do abastecimento *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className={`w-full p-3 border rounded-lg bg-white ${
                  kmObrigatorioPendente ? "border-red-400" : ""
                }`}
                placeholder="Obrigatório para abastecimento (ex: 105430)"
                value={gastoForm.quilometragem}
                required
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    quilometragem: e.target.value,
                  }))
                }
                disabled={lancandoGasto}
              />
              <p className="mt-1 text-xs text-red-600 font-semibold">
                Campo obrigatório quando a categoria for Abastecimento.
              </p>
            </div>
          )}

          {gastoForm.categoria === "abastecimento" && (
            <>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Litros abastecidos *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  inputMode="decimal"
                  className={`w-full p-3 border rounded-lg bg-white ${
                    litrosObrigatorioPendente ? "border-red-400" : ""
                  }`}
                  placeholder="Ex: 12.5"
                  value={gastoForm.litros}
                  required
                  onChange={(e) =>
                    setGastoForm((prev) => ({
                      ...prev,
                      litros: e.target.value,
                    }))
                  }
                  disabled={lancandoGasto}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nível após abastecimento
                </label>
                <select
                  className="w-full p-3 border rounded-lg bg-white"
                  value={gastoForm.nivelCombustivel}
                  onChange={(e) =>
                    setGastoForm((prev) => ({
                      ...prev,
                      nivelCombustivel: e.target.value,
                    }))
                  }
                  disabled={lancandoGasto}
                >
                  <option value="Cheio">Cheio</option>
                  <option value="3/4">3/4</option>
                  <option value="Meio tanque">Meio tanque</option>
                  <option value="1/4">1/4</option>
                  <option value="Reserva">Reserva</option>
                </select>
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {gastoForm.categoria === "outros"
                ? "Observação *"
                : "Observação (opcional)"}
            </label>
            <textarea
              rows="3"
              className={`w-full p-3 border rounded-lg bg-white resize-y ${
                observacaoObrigatoriaPendente ? "border-red-400" : ""
              }`}
              placeholder="Ex: Uber entre pontos"
              value={gastoForm.observacao}
              onChange={(e) =>
                setGastoForm((prev) => ({
                  ...prev,
                  observacao: e.target.value,
                }))
              }
              disabled={lancandoGasto}
            />
            {gastoForm.categoria === "outros" && (
              <p className="mt-1 text-xs text-red-600 font-semibold">
                Campo obrigatório quando a categoria for Outros.
              </p>
            )}
          </div>

          <div className="flex justify-end mb-4">
            <button
              className="bg-blue-600 text-white py-2 px-5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-60"
              onClick={handleLancarGasto}
              disabled={
                lancandoGasto ||
                kmObrigatorioPendente ||
                litrosObrigatorioPendente ||
                observacaoObrigatoriaPendente
              }
            >
              {lancandoGasto ? "Lançando..." : "Lançar gasto"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Categoria</th>
                  <th className="px-3 py-2 text-left font-bold">Valor</th>
                  <th className="px-3 py-2 text-left font-bold">KM</th>
                  <th className="px-3 py-2 text-left font-bold">Observação</th>
                  <th className="px-3 py-2 text-left font-bold">Funcionário</th>
                  <th className="px-3 py-2 text-left font-bold">Data</th>
                  <th className="px-3 py-2 text-left font-bold">Hora</th>
                </tr>
              </thead>
              <tbody>
                {gastosHojeOrdenados.length > 0 ? (
                  gastosHojeOrdenados.map((gasto) => {
                    const dataHoraFormatada = formatarDataHora(gasto.dataHora);
                    return (
                      <tr key={gasto.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {getLabelCategoriaGasto(gasto.categoria)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800">
                          {formatarMoedaBRL(gasto.valor)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.quilometragem ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.observacao?.trim() || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.usuario?.nome || usuario?.nome || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {dataHoraFormatada.data}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {dataHoraFormatada.hora}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-gray-500 italic"
                    >
                      Nenhum gasto lançado hoje para este roteiro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">
            Selecione uma loja para movimentar:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roteiro.lojas && roteiro.lojas.length > 0 ? (
              [...roteiro.lojas]
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((loja, index) => (
                  <button
                    key={loja.id}
                    onClick={() => handleSelecionarLoja(loja)}
                    className={`p-4 rounded-lg shadow border-2 font-bold text-lg transition-all flex flex-col items-start 
                      ${lojaSelecionada?.id === loja.id ? "border-blue-600" : "border-transparent"}
                      ${lojaEstaConcluida(loja.status) ? "bg-green-100 border-green-600 text-green-700" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="bg-[#24094E] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span>🏪 {loja.nome}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-9">
                      {loja.cidade}, {loja.estado}
                    </span>
                    {lojaEstaConcluida(loja.status) && (
                      <span className="mt-1 ml-9 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                        Concluída
                      </span>
                    )}
                  </button>
                ))
            ) : (
              <div className="col-span-2 text-center text-gray-400">
                Nenhuma loja disponível neste roteiro.
              </div>
            )}
          </div>
        </div>
        {lojaSelecionada && (
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <h3 className="text-xl font-bold mb-4">
              Máquinas da loja: {lojaSelecionada.nome}
            </h3>
            <div className="mb-4">
              <button
                className="bg-indigo-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-indigo-700"
                onClick={abrirModalNovaManutencao}
              >
                ➕ Adicionar manutenção
              </button>
            </div>
            <div className="space-y-3">
              {lojaSelecionada.maquinas &&
              lojaSelecionada.maquinas.length > 0 ? (
                lojaSelecionada.maquinas.map((maquina) =>
                  (() => {
                    const maquinaConcluida = maquinaEstaConcluida(
                      maquina.status,
                    );
                    return (
                      <button
                        key={maquina.id}
                        className={`p-3 rounded border font-medium w-full text-left transition-all flex items-center gap-2 
                      ${maquinaConcluida ? "bg-green-100 border-green-600 text-green-700" : "bg-gray-50 hover:border-blue-600"}
                      ${maquinaConcluida ? "opacity-70 cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (maquinaConcluida) return;
                          navigate(
                            `/roteiros/${roteiro.id}/lojas/${lojaSelecionada.id}/maquinas/${maquina.id}/movimentacao`,
                          );
                        }}
                        disabled={maquinaConcluida}
                      >
                        <span>🖲️ {maquina.nome}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({maquina.tipo})
                        </span>
                        {maquinaConcluida && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                            Finalizada
                          </span>
                        )}
                      </button>
                    );
                  })(),
                )
              ) : (
                <div className="text-gray-400">
                  Nenhuma máquina cadastrada nesta loja.
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          {(!roteiroEstaFinalizado(roteiro.status) ||
            roteiroTemPendencias(roteiro)) && (
            <button
              className="bg-green-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-green-700"
              onClick={abrirModalFinalizacao}
            >
              Finalizar Rota
            </button>
          )}
          <button
            className="bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-bold"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>

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
                ? "Deseja realmente finalizar esta rota?"
                : "Confirma novamente: finalizar agora este roteiro?"}
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
                  {modalFinalizar.loading ? "Finalizando..." : "Finalizar Rota"}
                </button>
              )}
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalJustificativa.aberto}
          onClose={() =>
            setModalJustificativa({
              aberto: false,
              lojaId: null,
              lojaNome: "",
              lojaIdEsperada: null,
              lojaEsperadaNome: "",
              justificativa: "",
            })
          }
          title="Justificar alteração de ordem"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-yellow-800 font-semibold mb-2">
                ⚠️ Você está pulando a ordem das lojas!
              </p>
              <p className="text-sm text-yellow-700">
                Loja esperada:{" "}
                <span className="font-bold">
                  {modalJustificativa.lojaEsperadaNome}
                </span>
              </p>
              <p className="text-sm text-yellow-700">
                Loja selecionada:{" "}
                <span className="font-bold">{modalJustificativa.lojaNome}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Por que você está pulando a ordem?
              </label>
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="4"
                placeholder="Ex: O ponto estava fechado, problema de acesso, etc."
                value={modalJustificativa.justificativa}
                onChange={(e) =>
                  setModalJustificativa((prev) => ({
                    ...prev,
                    justificativa: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() =>
                  setModalJustificativa({
                    aberto: false,
                    lojaId: null,
                    lojaNome: "",
                    lojaIdEsperada: null,
                    lojaEsperadaNome: "",
                    justificativa: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarSelecaoComJustificativa}
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalNovaManutencao.aberto}
          onClose={fecharModalNovaManutencao}
          title="Nova manutenção da loja"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Máquina
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={novaManutencaoRoteiro.maquinaId}
                onChange={(e) =>
                  setNovaManutencaoRoteiro((prev) => ({
                    ...prev,
                    maquinaId: e.target.value,
                  }))
                }
              >
                <option value="">Selecione uma máquina</option>
                {(lojaSelecionada?.maquinas || []).map((maquina) => (
                  <option key={maquina.id} value={maquina.id}>
                    {maquina.codigo || "-"}
                    {maquina.nome ? ` - ${maquina.nome}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Descrição da manutenção
              </label>
              <textarea
                rows="3"
                className="w-full p-3 border rounded-lg bg-white resize-y"
                placeholder="Descreva o que precisa ser feito..."
                value={novaManutencaoRoteiro.descricao}
                onChange={(e) =>
                  setNovaManutencaoRoteiro((prev) => ({
                    ...prev,
                    descricao: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalNovaManutencao}
                disabled={modalNovaManutencao.loading}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCriarManutencaoRoteiro}
                disabled={modalNovaManutencao.loading}
              >
                {modalNovaManutencao.loading
                  ? "Salvando..."
                  : "Criar manutenção"}
              </button>
            </div>
          </div>
        </Modal>

        <ManutencaoModal
          isOpen={modalManutencao}
          onClose={() => setModalManutencao(false)}
          manutencao={manutencaoPendente}
          lojaId={lojaSelecionada?.id}
          usuarioId={usuario?.id}
          usuarioNome={usuario?.nome}
          onManutencaoConcluida={handleManutencaoConcluida}
        />
      </main>
      <Footer />
    </div>
  );
}
