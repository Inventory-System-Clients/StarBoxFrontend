import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

import { useAuth } from "../contexts/AuthContext.jsx";

export default function MovimentacaoMaquina() {
  const { roteiroId, lojaId, maquinaId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isFuncionarioAbastecedor = usuario?.role === "FUNCIONARIO";
  const isPerfilFuncionario = [
    "FUNCIONARIO",
    "FUNCIONARIO_TODAS_LOJAS",
  ].includes(usuario?.role);
  const podeVerCamposFinanceirosEObservacao = !isFuncionarioAbastecedor;

  // Estados para formulário
  const [formData, setFormData] = useState({
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
    contadorInAnterior: "",
    contadorOutAnterior: "",
    contadorInManual: "",
    contadorOutManual: "",
    contadorInDigital: "",
    contadorOutDigital: "",
    observacao: "",
    retiradaEstoque: false,
    retiradaProduto: 0,
    retiradaProdutoDevolverEstoque: false,
    origemEstoque: "usuario",
    ignoreInOut: false,
    usarContadorManual: false,
    retiradaDinheiro: false,
  });
  const [produtos, setProdutos] = useState([]);
  const [produtoIdsEstoqueUsuario, setProdutoIdsEstoqueUsuario] = useState([]);
  const [produtoIdsEstoqueLoja, setProdutoIdsEstoqueLoja] = useState([]);
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resumoCalculo, setResumoCalculo] = useState(null);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);
  const [isPrimeiraMovimentacao, setIsPrimeiraMovimentacao] = useState(false);
  const [ultimaMovimentacaoData, setUltimaMovimentacaoData] = useState(null);
  const [ultimaMovimentacao, setUltimaMovimentacao] = useState(null);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [dadosConfirmacao, setDadosConfirmacao] = useState(null);

  const CONTADOR_TIPO_STORAGE_PREFIX = "starbox:maquina:contador-tipo:";

  const obterChaveTipoContadorMaquina = (idMaquina) =>
    `${CONTADOR_TIPO_STORAGE_PREFIX}${String(idMaquina || "").trim()}`;

  const obterTipoContadorSalvo = (idMaquina) => {
    const chave = obterChaveTipoContadorMaquina(idMaquina);
    if (!chave || chave.endsWith(":")) return null;

    try {
      const valor = String(window.localStorage.getItem(chave) || "")
        .trim()
        .toLowerCase();
      if (valor === "digital" || valor === "mecanico") return valor;
      return null;
    } catch {
      return null;
    }
  };

  const salvarTipoContadorMaquina = (idMaquina, tipo) => {
    const chave = obterChaveTipoContadorMaquina(idMaquina);
    const tipoNormalizado = String(tipo || "").trim().toLowerCase();

    if (
      !chave ||
      chave.endsWith(":") ||
      !["digital", "mecanico"].includes(tipoNormalizado)
    ) {
      return;
    }

    try {
      window.localStorage.setItem(chave, tipoNormalizado);
    } catch {
      // Sem bloqueio de fluxo caso o storage falhe.
    }
  };

  const inferirTipoContadorMovimentacao = (movimentacao) => {
    if (!movimentacao || typeof movimentacao !== "object") return null;

    const tipoTexto = String(
      movimentacao?.tipoContador ||
        movimentacao?.contadorTipo ||
        movimentacao?.modoContador ||
        "",
    )
      .trim()
      .toLowerCase();

    if (tipoTexto.includes("digital")) return "digital";
    if (tipoTexto.includes("mecan") || tipoTexto.includes("manual")) {
      return "mecanico";
    }

    if (
      movimentacao?.usarContadorDigital === true ||
      movimentacao?.contadorDigital === true
    ) {
      return "digital";
    }

    if (
      movimentacao?.usarContadorMecanico === true ||
      movimentacao?.contadorMecanico === true
    ) {
      return "mecanico";
    }

    return null;
  };

  const obterCamposContadorAtivo = (dadosForm) => {
    if (dadosForm?.usarContadorManual) {
      return {
        contadorInAtual: dadosForm?.contadorInManual,
        contadorOutAtual: dadosForm?.contadorOutManual,
        tipo: "digital",
      };
    }

    return {
      contadorInAtual: dadosForm?.contadorInDigital,
      contadorOutAtual: dadosForm?.contadorOutDigital,
      tipo: "mecanico",
    };
  };

  const toNumero = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  };

  const obterTotalPosUltimaMovimentacao = (movimentacao) => {
    if (!movimentacao) return null;

    const totalPosDireto = toNumero(
      movimentacao?.totalPos ??
        movimentacao?.totalAtual ??
        movimentacao?.quantidadeAtualMaquina ??
        movimentacao?.quantidadeAtual,
    );

    if (totalPosDireto !== null) return totalPosDireto;

    const totalPre = toNumero(movimentacao?.totalPre);
    const abastecidas = toNumero(movimentacao?.abastecidas) ?? 0;

    if (totalPre !== null) {
      return totalPre + abastecidas;
    }

    return null;
  };

  const obterContadorOutUltimoMovimento = (movimentacao) => {
    if (!movimentacao) return null;

    return toNumero(
      movimentacao?.contadorOut ??
        movimentacao?.contadorOutDigital ??
        movimentacao?.contadorSaida,
    );
  };

  const obterContadorOutAtualDigitado = (dadosForm) => {
    const camposContadorAtivo = obterCamposContadorAtivo(dadosForm);

    return toNumero(
      camposContadorAtivo?.contadorOutAtual ??
        dadosForm?.contadorOutManual ??
        dadosForm?.contadorOutDigital,
    );
  };

  const calcularQuantidadeAtualPelaSaida = ({
    dadosForm,
    resumo,
    primeiraMovimentacao,
    ultimaMov,
    maquinaAtual,
  }) => {
    const contadorOutAtual = obterContadorOutAtualDigitado(dadosForm);

    if (contadorOutAtual === null) return null;

    const contadorOutBase = primeiraMovimentacao
      ? toNumero(dadosForm?.contadorOutAnterior)
      : toNumero(
          resumo?.contadorOutUltimaMovimentacao ??
            obterContadorOutUltimoMovimento(ultimaMov) ??
            resumo?.contadorOutSugerido,
        );

    const capacidadePadraoMaquina = toNumero(
      maquinaAtual?.capacidadePadrao ?? maquinaAtual?.capacidade,
    );

    const totalPosUltimoMovimento = obterTotalPosUltimaMovimentacao(ultimaMov);
    const totalPosResumo = toNumero(resumo?.totalPosUltimaMovimentacao);

    // Prioridade: ultima movimentacao real > capacidade padrao > resumo da API.
    // Isso evita sugestao zerada quando a API retorna totalPosUltimaMovimentacao=0 de forma inconsistente.
    const totalPosUltima =
      totalPosUltimoMovimento !== null && totalPosUltimoMovimento > 0
        ? totalPosUltimoMovimento
        : capacidadePadraoMaquina !== null && capacidadePadraoMaquina > 0
          ? capacidadePadraoMaquina
          : totalPosResumo;

    if (contadorOutBase === null || totalPosUltima === null) return null;

    const quantidadeSaiuDesdeUltima = Math.max(
      0,
      contadorOutAtual - contadorOutBase,
    );

    return Math.max(0, totalPosUltima - quantidadeSaiuDesdeUltima);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [maqRes, prodRes, ultimoProdRes, movRes, estoqueUsuarioRes] =
          await Promise.all([
          api.get(`/maquinas/${maquinaId}`),
          api.get("/produtos"),
          api
            .get(`/maquinas/${maquinaId}/ultimo-produto`)
            .catch(() => ({ data: { produtoId: null } })),
          api
            .get(`/movimentacoes?maquinaId=${maquinaId}&limite=1`)
            .catch(() => ({ data: [] })),
          isPerfilFuncionario
            ? api
                .get("/estoque-usuarios/me")
                .catch(() => ({ data: { estoque: [] } }))
            : Promise.resolve({ data: { estoque: [] } }),
        ]);
        setMaquina(maqRes.data);

        const listaProdutos = Array.isArray(prodRes.data) ? prodRes.data : [];
        const estoqueUsuarioData = Array.isArray(estoqueUsuarioRes?.data?.estoque)
          ? estoqueUsuarioRes.data.estoque
          : Array.isArray(estoqueUsuarioRes?.data)
            ? estoqueUsuarioRes.data
            : [];

        const produtoIdsUsuario = estoqueUsuarioData
          .filter((item) => Number(item?.quantidade || 0) > 0)
          .map((item) => String(item.produtoId));

        setProdutos(listaProdutos);
        setProdutoIdsEstoqueUsuario(produtoIdsUsuario);

        const lojaDaMaquinaId =
          maqRes.data?.lojaId || maqRes.data?.loja?.id || lojaId || null;
        if (isPerfilFuncionario && lojaDaMaquinaId) {
          const estoqueLojaRes = await api
            .get(`/estoque-lojas/${lojaDaMaquinaId}`)
            .catch(() => ({ data: [] }));
          const estoqueLojaData = Array.isArray(estoqueLojaRes.data)
            ? estoqueLojaRes.data
            : [];
          const produtoIdsLoja = estoqueLojaData.map((item) =>
            String(item?.produtoId),
          );
          setProdutoIdsEstoqueLoja(produtoIdsLoja);
        } else {
          setProdutoIdsEstoqueLoja([]);
        }

        const produtosDisponiveisIniciais = isPerfilFuncionario
          ? listaProdutos.filter((produto) =>
              produtoIdsUsuario.includes(String(produto.id)),
            )
          : listaProdutos;

        const movimentacoesMaquina = Array.isArray(movRes.data)
          ? movRes.data
          : [];
        const ultimaMovimentacao = movimentacoesMaquina[0] || null;
        setUltimaMovimentacao(ultimaMovimentacao);
        const dataUltimaMovimentacao =
          ultimaMovimentacao?.dataColeta ||
          ultimaMovimentacao?.createdAt ||
          ultimaMovimentacao?.dataMovimentacao ||
          ultimaMovimentacao?.data ||
          null;

        setUltimaMovimentacaoData(dataUltimaMovimentacao);
        const capacidadePadrao = Number(
          maqRes.data?.capacidadePadrao ?? maqRes.data?.capacidade ?? 0,
        );
        const tipoContadorSalvo = obterTipoContadorSalvo(maquinaId);
        const tipoContadorInferido = inferirTipoContadorMovimentacao(
          ultimaMovimentacao,
        );
        const tipoContadorInicial =
          tipoContadorSalvo || tipoContadorInferido || "mecanico";
        const usarContadorDigitalInicial = tipoContadorInicial === "digital";

        setFormData((prev) => ({
          ...prev,
          produto_id: (() => {
            const ultimoProdutoId = ultimoProdRes.data?.produtoId;
            const produtoAnteriorValido = produtosDisponiveisIniciais.some(
              (produto) => String(produto.id) === String(prev.produto_id),
            )
              ? prev.produto_id
              : "";
            const ultimoProdutoValido = produtosDisponiveisIniciais.some(
              (produto) => String(produto.id) === String(ultimoProdutoId),
            )
              ? String(ultimoProdutoId)
              : "";

            return (
              ultimoProdutoValido ||
              produtoAnteriorValido ||
              String(produtosDisponiveisIniciais[0]?.id || "")
            );
          })(),
          usarContadorManual: usarContadorDigitalInicial,
          quantidadeAtualMaquina:
            prev.quantidadeAtualMaquina !== ""
              ? prev.quantidadeAtualMaquina
              : !ultimaMovimentacao && capacidadePadrao > 0
                ? String(capacidadePadrao)
                : prev.quantidadeAtualMaquina,
        }));
      } catch {
        setError("Erro ao carregar dados da máquina ou produtos.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [maquinaId, usuario, lojaId, isPerfilFuncionario]);

  const produtosDisponiveis = useMemo(() => {
    if (!isPerfilFuncionario) return produtos;

    const origemSelecionada = formData.origemEstoque || "usuario";
    const idsPermitidos =
      origemSelecionada === "loja"
        ? produtoIdsEstoqueLoja
        : produtoIdsEstoqueUsuario;

    return produtos.filter((produto) =>
      idsPermitidos.includes(String(produto.id)),
    );
  }, [
    produtos,
    formData.origemEstoque,
    isPerfilFuncionario,
    produtoIdsEstoqueUsuario,
    produtoIdsEstoqueLoja,
  ]);

  useEffect(() => {
    if (!formData.produto_id) return;

    const produtoAindaDisponivel = produtosDisponiveis.some(
      (produto) => String(produto.id) === String(formData.produto_id),
    );

    if (!produtoAindaDisponivel) {
      setFormData((prev) => ({
        ...prev,
        produto_id: "",
      }));
    }
  }, [produtosDisponiveis, formData.produto_id]);

  useEffect(() => {
    if (!isFuncionarioAbastecedor || isPrimeiraMovimentacao) return;

    setFormData((prev) => ({
      ...prev,
      contadorInManual: "",
      contadorOutManual: "",
      contadorInDigital: "",
      contadorOutDigital: "",
      usarContadorManual: false,
      ignoreInOut: true,
      retiradaEstoque: false,
      retiradaDinheiro: false,
    }));
  }, [isFuncionarioAbastecedor]);

  // Cálculo automático usando histórico de movimentações e contadores projetados
  useEffect(() => {
    async function atualizarCalculos() {
      if (!maquina || !maquinaId) {
        setResumoCalculo(null);
        return;
      }

      const camposContadorAtivo = obterCamposContadorAtivo(formData);
      const contadorInReferencia = camposContadorAtivo.contadorInAtual;
      const contadorOutReferencia = camposContadorAtivo.contadorOutAtual;

      const params = { maquinaId };
      if (!isFuncionarioAbastecedor && !formData.ignoreInOut) {
        if (contadorInReferencia !== "") {
          params.contadorIn = contadorInReferencia;
        }
        if (contadorOutReferencia !== "") {
          params.contadorOut = contadorOutReferencia;
        }
        if (isPrimeiraMovimentacao) {
          if (formData.contadorInAnterior !== "") {
            params.contadorInAnterior = formData.contadorInAnterior;
          }
          if (formData.contadorOutAnterior !== "") {
            params.contadorOutAnterior = formData.contadorOutAnterior;
          }
        }
      }

      try {
        const res = await api.get(
          `/maquinas/${maquinaId}/calcular-quantidade`,
          {
            params,
          },
        );

        const primeiraMovimentacaoAtual =
          typeof res.data?.primeiraMovimentacao === "boolean"
            ? res.data.primeiraMovimentacao
            : isPrimeiraMovimentacao;

        if (typeof res.data?.primeiraMovimentacao === "boolean") {
          setIsPrimeiraMovimentacao(res.data.primeiraMovimentacao);
        }

        const quantidadeCalculadaPorSaida = calcularQuantidadeAtualPelaSaida({
          dadosForm: formData,
          resumo: res.data,
          primeiraMovimentacao: primeiraMovimentacaoAtual,
          ultimaMov: ultimaMovimentacao,
          maquinaAtual: maquina,
        });

        const quantidadeCalculada =
          quantidadeCalculadaPorSaida !== null
            ? quantidadeCalculadaPorSaida
            : res.data.quantidadeAtual >= 0
              ? res.data.quantidadeAtual
              : 0;

        setResumoCalculo(res.data);

        const temContadoresDigitados =
          !isFuncionarioAbastecedor &&
          !formData.ignoreInOut &&
          contadorOutReferencia !== "" &&
          (!isPrimeiraMovimentacao || formData.contadorOutAnterior !== "");

        if (temContadoresDigitados) {
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina: quantidadeCalculada,
          }));
        }
      } catch {
        setResumoCalculo(null);
      }
    }

    atualizarCalculos();
  }, [
    maquina,
    maquinaId,
    isFuncionarioAbastecedor,
    isPrimeiraMovimentacao,
    formData.usarContadorManual,
    formData.contadorInAnterior,
    formData.contadorOutAnterior,
    formData.contadorInManual,
    formData.contadorOutManual,
    formData.contadorOutDigital,
    formData.contadorInDigital,
    formData.ignoreInOut,
    formData.contadorOutAnterior,
    ultimaMovimentacao,
  ]);

  const quantidadeAtualSugerida = useMemo(() => {
    const calculadaPorSaida = calcularQuantidadeAtualPelaSaida({
      dadosForm: formData,
      resumo: resumoCalculo,
      primeiraMovimentacao: isPrimeiraMovimentacao,
      ultimaMov: ultimaMovimentacao,
      maquinaAtual: maquina,
    });

    if (calculadaPorSaida !== null) {
      return Math.max(0, Math.round(calculadaPorSaida));
    }

    const fallback = Number(
      resumoCalculo?.totalPreEsperado ?? resumoCalculo?.quantidadeAtual,
    );

    return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : null;
  }, [
    formData,
    resumoCalculo,
    isPrimeiraMovimentacao,
    ultimaMovimentacao,
  ]);

  useEffect(() => {
    if (!maquina || !isPrimeiraMovimentacao) return;
    const capacidadePadrao = Number(
      maquina?.capacidadePadrao ?? maquina?.capacidade ?? 0,
    );

    if (formData.quantidadeAtualMaquina === "" && capacidadePadrao > 0) {
      setFormData((prev) => ({
        ...prev,
        quantidadeAtualMaquina: String(capacidadePadrao),
      }));
    }
  }, [maquina, isPrimeiraMovimentacao, formData.quantidadeAtualMaquina]);

  useEffect(() => {
    if (!isPrimeiraMovimentacao) return;
    setFormData((prev) => ({
      ...prev,
      ignoreInOut: false,
    }));
  }, [isPrimeiraMovimentacao]);

  useEffect(() => {
    const parseContadorOpcional = (valor) => {
      if (valor === "" || valor === null || valor === undefined) return null;
      const numero = parseInt(valor, 10);
      return Number.isNaN(numero) ? null : numero;
    };

    const camposContadorAtivo = obterCamposContadorAtivo(formData);

    const contadorInAtualInformado = parseContadorOpcional(
      camposContadorAtivo.contadorInAtual,
    );
    const contadorOutAtualInformado = parseContadorOpcional(
      camposContadorAtivo.contadorOutAtual,
    );

    const deveMarcarRetiradaDinheiro =
      !formData.ignoreInOut &&
      contadorInAtualInformado !== null &&
      contadorOutAtualInformado !== null;

    setFormData((prev) => {
      if (deveMarcarRetiradaDinheiro && !prev.retiradaDinheiro) {
        return { ...prev, retiradaDinheiro: true };
      }

      if (!deveMarcarRetiradaDinheiro && prev.retiradaDinheiro) {
        return { ...prev, retiradaDinheiro: false };
      }

      return prev;
    });
  }, [
    formData.contadorInManual,
    formData.contadorInDigital,
    formData.contadorOutManual,
    formData.contadorOutDigital,
    formData.ignoreInOut,
  ]);

  useEffect(() => {
    if (isFuncionarioAbastecedor) {
      setAlertaDivergencia(null);
      return;
    }

    const camposContadorAtivo = obterCamposContadorAtivo(formData);
    const contadorOutDigitado = parseInt(camposContadorAtivo.contadorOutAtual, 10);
    const totalPreInformado = parseInt(formData.quantidadeAtualMaquina, 10);

    if (!resumoCalculo) {
      setAlertaDivergencia(null);
      return;
    }

    if (
      !formData.ignoreInOut &&
      camposContadorAtivo.contadorOutAtual !== "" &&
      !Number.isNaN(contadorOutDigitado) &&
      contadorOutDigitado < (resumoCalculo.contadorOutSugerido || 0)
    ) {
      setAlertaDivergencia({
        tipo: "out_abaixo_sugerido",
        contadorOutDigitado,
        contadorOutSugerido: resumoCalculo.contadorOutSugerido || 0,
      });
      return;
    }

    if (
      !formData.ignoreInOut &&
      camposContadorAtivo.contadorOutAtual !== "" &&
      formData.quantidadeAtualMaquina !== "" &&
      !Number.isNaN(totalPreInformado)
    ) {
      const totalPreEsperado = parseInt(
        quantidadeAtualSugerida ?? resumoCalculo.quantidadeAtual ?? 0,
        10,
      );
      const diferenca = Math.abs(totalPreInformado - totalPreEsperado);

      if (diferenca > 0) {
        setAlertaDivergencia({
          tipo: "quantidade_divergente",
          totalPreInformado,
          totalPreEsperado,
          diferenca,
        });
        return;
      }
    }

    setAlertaDivergencia(null);
  }, [
    isFuncionarioAbastecedor,
    resumoCalculo,
    quantidadeAtualSugerida,
    formData.contadorOutDigital,
    formData.contadorOutManual,
    formData.usarContadorManual,
    formData.quantidadeAtualMaquina,
    formData.ignoreInOut,
  ]);

  const sugestaoAbastecimento = useMemo(() => {
    if (isFuncionarioAbastecedor) return null;

    const capacidadePadrao = Number(
      maquina?.capacidadePadrao ?? maquina?.capacidade ?? 0,
    );

    if (!Number.isFinite(capacidadePadrao) || capacidadePadrao <= 0) {
      return null;
    }

    const quantidadeAtualBase = Number(
      quantidadeAtualSugerida ?? resumoCalculo?.quantidadeAtual,
    );

    if (!Number.isFinite(quantidadeAtualBase)) {
      return null;
    }

    return Math.max(0, Math.round(capacidadePadrao - quantidadeAtualBase));
  }, [
    isFuncionarioAbastecedor,
    maquina?.capacidadePadrao,
    maquina?.capacidade,
    quantidadeAtualSugerida,
    resumoCalculo?.quantidadeAtual,
  ]);

  const parseNumeroOpcional = (valor) => {
    if (valor === "" || valor === null || valor === undefined) return null;
    const numero = Number(valor);
    return Number.isNaN(numero) ? null : numero;
  };

  const formatarInteiro = (valor) => {
    const numero = Number(valor || 0);
    return Math.round(numero).toLocaleString("pt-BR");
  };

  const formatarMoeda = (valor) => {
    const numero = Number(valor || 0);
    return numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatarValorConfirmacao = (valor) => {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
      return "-";
    }
    return formatarInteiro(valor);
  };

  const capacidadePadraoMaquina = useMemo(() => {
    const numero = Number(maquina?.capacidadePadrao ?? maquina?.capacidade ?? 0);
    return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : 0;
  }, [maquina?.capacidadePadrao, maquina?.capacidade]);

  const quantidadeAtualUltimaMovimentacao = useMemo(() => {
    const valorUltimaMovimentacao = toNumero(
      obterTotalPosUltimaMovimentacao(ultimaMovimentacao),
    );

    if (valorUltimaMovimentacao !== null) {
      return Math.max(0, Math.round(valorUltimaMovimentacao));
    }

    const valorResumo = toNumero(resumoCalculo?.totalPosUltimaMovimentacao);
    if (valorResumo !== null) {
      return Math.max(0, Math.round(valorResumo));
    }

    return null;
  }, [ultimaMovimentacao, resumoCalculo?.totalPosUltimaMovimentacao]);

  const quantidadeBaseAbastecedor = useMemo(() => {
    if (!isFuncionarioAbastecedor) return null;

    if (quantidadeAtualUltimaMovimentacao !== null) {
      if (capacidadePadraoMaquina > 0) {
        return Math.max(capacidadePadraoMaquina, quantidadeAtualUltimaMovimentacao);
      }

      return quantidadeAtualUltimaMovimentacao;
    }

    return capacidadePadraoMaquina > 0 ? capacidadePadraoMaquina : null;
  }, [
    isFuncionarioAbastecedor,
    capacidadePadraoMaquina,
    quantidadeAtualUltimaMovimentacao,
  ]);

  useEffect(() => {
    if (!isFuncionarioAbastecedor || quantidadeBaseAbastecedor === null) return;

    setFormData((prev) => {
      const valorPadrao = String(quantidadeBaseAbastecedor);
      if (String(prev.quantidadeAtualMaquina || "") === valorPadrao) {
        return prev;
      }

      return {
        ...prev,
        quantidadeAtualMaquina: valorPadrao,
      };
    });
  }, [isFuncionarioAbastecedor, quantidadeBaseAbastecedor]);

  const abrirWhatsAppComMensagem = (mensagem, popupReservado = null) => {
    const textoCodificado = encodeURIComponent(mensagem);
    const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

    // No desktop, usar WhatsApp Web evita abrir automaticamente no app Business.
    const whatsappUrl = isMobile
      ? `https://wa.me/?text=${textoCodificado}`
      : `https://web.whatsapp.com/send?text=${textoCodificado}`;

    if (popupReservado && !popupReservado.closed) {
      popupReservado.location.href = whatsappUrl;
      popupReservado.focus?.();
      return true;
    }

    const link = document.createElement("a");
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  };

  const obterResumoContadores = () => {
    const inAnteriorPrimeira = parseNumeroOpcional(formData.contadorInAnterior);
    const outAnteriorPrimeira = parseNumeroOpcional(
      formData.contadorOutAnterior,
    );

    const inAnterior = isPrimeiraMovimentacao
      ? (inAnteriorPrimeira ?? 0)
      : Number(resumoCalculo?.contadorInSugerido || 0);
    const outAnterior = isPrimeiraMovimentacao
      ? (outAnteriorPrimeira ?? 0)
      : Number(
          resumoCalculo?.contadorOutUltimaMovimentacao ??
            resumoCalculo?.contadorOutSugerido ??
            0,
        );

    const inManual = parseNumeroOpcional(formData.contadorInManual);
    const outManual = parseNumeroOpcional(formData.contadorOutManual);
    const inDigital = parseNumeroOpcional(formData.contadorInDigital);
    const outDigital = parseNumeroOpcional(formData.contadorOutDigital);

    const inAtualPreferencial = formData.usarContadorManual
      ? inManual
      : inDigital;
    const outAtualPreferencial = formData.usarContadorManual
      ? outManual
      : outDigital;

    const inAtual = inAtualPreferencial ?? inDigital ?? inManual ?? inAnterior;
    const outAtual =
      outAtualPreferencial ?? outDigital ?? outManual ?? outAnterior;

    return { inAnterior, inAtual, outAnterior, outAtual };
  };

  const montarDadosConfirmacao = () => {
    const { inAnterior, inAtual, outAnterior, outAtual } =
      obterResumoContadores();

    const diferencaIn = Math.max(0, Number(inAtual || 0) - Number(inAnterior || 0));
    const diferencaOut = Math.max(
      0,
      Number(outAtual || 0) - Number(outAnterior || 0),
    );

    return {
      inAnterior: Number(inAnterior || 0),
      inAtual: Number(inAtual || 0),
      outAnterior: Number(outAnterior || 0),
      outAtual: Number(outAtual || 0),
      diferencaIn,
      diferencaOut,
    };
  };

  const montarResumoWhatsApp = () => {
    const { inAnterior, inAtual, outAnterior, outAtual } =
      obterResumoContadores();

    const diferencaIn = Math.max(0, inAtual - inAnterior);
    const quantidadeSaiu = Math.max(0, outAtual - outAnterior);
    const saldo = diferencaIn;
    const valorJogada = Number(maquina?.valorFicha || 0);
    const jogado = valorJogada > 0 ? diferencaIn / valorJogada : 0;

    const produtoSelecionado = produtos.find(
      (p) => String(p.id) === String(formData.produto_id),
    );
    const precoProduto = Number(produtoSelecionado?.preco || 0);
    const valorMedioSaidaPorPelucia =
      quantidadeSaiu > 0 ? diferencaIn / quantidadeSaiu - precoProduto : 0;
    const valorJogadaMedia = 2;
    const jogadasMediasPorPelucia =
      quantidadeSaiu > 0 ? diferencaIn / valorJogadaMedia / quantidadeSaiu : 0;

    const lojaNome = maquina?.loja?.nome || "Ponto sem nome";
    const dataMovimentacao = new Date().toLocaleString("pt-BR");
    const dataUltimaMovimentacao = ultimaMovimentacaoData
      ? new Date(ultimaMovimentacaoData).toLocaleString("pt-BR")
      : "Sem movimentação anterior";
    const diasDesdeUltimaMovimentacao = ultimaMovimentacaoData
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(ultimaMovimentacaoData).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    const nomeUsuario = usuario?.nome || "Usuário";
    const codigoMaquina = maquina?.codigo || "-";
    const tipoMaquina = maquina?.tipo || "Máquina";
    const modeloMaquina = maquina?.modelo || null;
    const percentualComissao = Number(maquina?.comissaoLojaPercentual || 0);
    const percentualComissaoFormatado = percentualComissao.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );

    const linhaComissao = `Comissao a pagar (${percentualComissaoFormatado}%): R$${formatarMoeda((Math.max(0, Number(saldo || 0)) * percentualComissao) / 100)}`;
    const nomeProdutoAbastecido =
      produtoSelecionado?.nome || "Produto não informado";
    const quantidadeAbastecidaInformada =
      parseInt(formData.quantidadeAdicionada, 10) || 0;

    const blocoFinanceiro = isFuncionarioAbastecedor
      ? []
      : [
          `Saldo: R$${formatarMoeda(saldo)}`,
          `Jogadas medias por pelucia: ${formatarInteiro(jogadasMediasPorPelucia)}`,
          "___________________________________",
          "Qtde Maqs....: 01",
          `Entradas.....: ${formatarInteiro(diferencaIn)}`,
          `Saidas.......: ${formatarInteiro(quantidadeSaiu)}`,
          `Jogado.......: ${formatarInteiro(jogado)}`,
          "Cliente....: 0",
          `Liquido.....: ${formatarInteiro(saldo)}`,
          `Especie.....: ${formatarInteiro(saldo)}`,
        ];

    return [
      "STAR BOX",
      `*${lojaNome}*`,
      `Data: ${dataMovimentacao}`,
      `Última movimentação da máquina: ${dataUltimaMovimentacao}`,
      ...(diasDesdeUltimaMovimentacao !== null
        ? [`Cobrado com ${diasDesdeUltimaMovimentacao} dias`]
        : []),
      `Lançado por: ${nomeUsuario}`,
      "___________________________________",
      `${codigoMaquina} | ${tipoMaquina}${modeloMaquina ? ` | Modelo: ${modeloMaquina}` : ""}`,
      `Produto abastecido: ${nomeProdutoAbastecido}${
        quantidadeAbastecidaInformada > 0
          ? ` (Qtd: ${formatarInteiro(quantidadeAbastecidaInformada)})`
          : ""
      }`,
      `E  ${formatarInteiro(inAnterior)}  ${formatarInteiro(inAtual)}  ____ R$${formatarMoeda(diferencaIn)}`,
      `S  ${formatarInteiro(outAnterior)}  ${formatarInteiro(outAtual)}  ____ ${formatarInteiro(quantidadeSaiu)}`,
      ...(linhaComissao ? [linhaComissao] : []),
      ...blocoFinanceiro,
    ].join("\n");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (isFuncionarioAbastecedor && name === "quantidadeAtualMaquina") {
      return;
    }

    if (name === "usarContadorManual") {
      const vaiUsarDigital = Boolean(checked);
      const tipoContador = vaiUsarDigital ? "digital" : "mecanico";

      setFormData((prev) => ({
        ...prev,
        usarContadorManual: vaiUsarDigital,
      }));
      salvarTipoContadorMaquina(maquinaId, tipoContador);

      if (error) setError("");
      if (success) setSuccess("");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (error) setError("");
    if (success) setSuccess("");
  };

  const salvarMovimentacaoEEnviarWhatsApp = async () => {
    setError("");
    setSuccess("");
    try {
      const deveIgnorarContadores =
        (isFuncionarioAbastecedor && !isPrimeiraMovimentacao) ||
        Boolean(formData.ignoreInOut);
      const parseContadorOpcional = (valor) => {
        if (valor === "" || valor === null || valor === undefined) return null;
        const numero = parseInt(valor, 10);
        return Number.isNaN(numero) ? null : numero;
      };

      const contadorInAnteriorInformado = parseContadorOpcional(
        formData.contadorInAnterior,
      );
      const contadorOutAnteriorInformado = parseContadorOpcional(
        formData.contadorOutAnterior,
      );

      const contadorInManualInformado = parseContadorOpcional(
        formData.contadorInManual,
      );
      const contadorOutManualInformado = parseContadorOpcional(
        formData.contadorOutManual,
      );
      const contadorInDigitalInformado = parseContadorOpcional(
        formData.contadorInDigital,
      );
      const contadorOutDigitalInformado = parseContadorOpcional(
        formData.contadorOutDigital,
      );

      const camposContadorAtivo = obterCamposContadorAtivo(formData);
      const contadorInAtivoInformado = parseContadorOpcional(
        camposContadorAtivo.contadorInAtual,
      );
      const contadorOutAtivoInformado = parseContadorOpcional(
        camposContadorAtivo.contadorOutAtual,
      );

      const tipoContadorAtivo = camposContadorAtivo.tipo;

      const deveGerarFluxoCaixaAutomatico =
        !deveIgnorarContadores &&
        contadorInAtivoInformado !== null &&
        contadorOutAtivoInformado !== null;

      if (isPrimeiraMovimentacao) {
        if (deveIgnorarContadores) {
          setError(
            "Primeira movimentação exige os contadores. Desmarque a opção de ignorar IN/OUT.",
          );
          return;
        }

        if (
          contadorInAnteriorInformado === null ||
          contadorOutAnteriorInformado === null
        ) {
          setError(
            "Informe os contadores anteriores (IN e OUT) para a primeira movimentação.",
          );
          return;
        }

        if (
          contadorInAtivoInformado === null ||
          contadorOutAtivoInformado === null
        ) {
          setError(
            `Informe os contadores atuais (${tipoContadorAtivo === "digital" ? "digitais" : "mecânicos"}) de IN e OUT para a primeira movimentação.`,
          );
          return;
        }
      }

      const produtosParaEnviar = formData.produto_id
        ? [
            {
              produtoId: formData.produto_id,
              quantidadeSaiu: 0,
              quantidadeAbastecida: parseInt(formData.quantidadeAdicionada) || 0,
              retiradaProduto: parseInt(formData.retiradaProduto) || 0,
              retiradaProdutoDevolverEstoque:
                formData.retiradaProdutoDevolverEstoque || false,
            },
          ]
        : [];

      const quantidadeAdicionadaInformada =
        parseInt(formData.quantidadeAdicionada, 10) || 0;

      const estoqueAlvoAbastecedor =
        quantidadeBaseAbastecedor !== null
          ? quantidadeBaseAbastecedor
          : capacidadePadraoMaquina > 0
            ? capacidadePadraoMaquina
            : parseInt(formData.quantidadeAtualMaquina, 10) || 0;

      const quantidadeAdicionadaAjustada = isFuncionarioAbastecedor
        ? Math.max(0, quantidadeAdicionadaInformada)
        : quantidadeAdicionadaInformada;

      const totalPreAjustado = isFuncionarioAbastecedor
        ? Math.max(0, estoqueAlvoAbastecedor)
        : parseInt(formData.quantidadeAtualMaquina, 10) || 0;

      const payload = {
        maquinaId: maquinaId,
        roteiroId: roteiroId,
        totalPre: totalPreAjustado,
        abastecidas: quantidadeAdicionadaAjustada,
        fichas: parseInt(formData.fichas) || 0,
        contadorInAnterior: isPrimeiraMovimentacao
          ? contadorInAnteriorInformado
          : null,
        contadorOutAnterior: isPrimeiraMovimentacao
          ? contadorOutAnteriorInformado
          : null,
        contadorIn: deveIgnorarContadores ? null : contadorInAtivoInformado,
        contadorOut: deveIgnorarContadores ? null : contadorOutAtivoInformado,
        contadorInDigital: deveIgnorarContadores
          ? null
          : contadorInDigitalInformado,
        contadorOutDigital: deveIgnorarContadores
          ? null
          : contadorOutDigitalInformado,
        quantidade_notas_entrada: null,
        valor_entrada_maquininha_pix: null,
        ignoreInOut: isFuncionarioAbastecedor
          ? !isPrimeiraMovimentacao
          : Boolean(formData.ignoreInOut),
        retiradaEstoque: isFuncionarioAbastecedor
          ? false
          : formData.retiradaEstoque,
        origemEstoque: formData.origemEstoque || "usuario",
        retiradaProduto: parseInt(formData.retiradaProduto) || 0,
        observacoes: podeVerCamposFinanceirosEObservacao
          ? formData.observacao || ""
          : "",
        produtos: produtosParaEnviar,
        retiradaDinheiro: deveGerarFluxoCaixaAutomatico,
      };

      const enviarMovimentacao = (confirmarUsoEstoqueLoja = false) =>
        api.post("/movimentacoes", {
          ...payload,
          confirmarUsoEstoqueLoja,
        });

      const popupReservado = window.open("about:blank", "_blank");

      try {
        await enviarMovimentacao(false);
      } catch (postError) {
        const precisaConfirmarLoja =
          postError?.response?.status === 409 &&
          postError?.response?.data?.codigo === "CONFIRMAR_USO_ESTOQUE_LOJA";

        if (!precisaConfirmarLoja) {
          throw postError;
        }

        const detalhes = postError?.response?.data?.detalhes || [];
        const resumoDetalhes = detalhes
          .map((item) => {
            const nome = item.produtoNome || item.produtoId;
            return `- ${nome}: saldo pessoal ${item.saldoUsuario}`;
          })
          .join("\n");

        const confirmar = window.confirm(
          `Voce possui saldo no estoque pessoal para alguns produtos:\n\n${resumoDetalhes}\n\nDeseja retirar do estoque do ponto mesmo assim?`,
        );

        if (!confirmar) {
          if (popupReservado && !popupReservado.closed) {
            popupReservado.close();
          }
          setError("Movimentacao cancelada. Origem de estoque nao confirmada.");
          return;
        }

        await enviarMovimentacao(true);
      }

      const mensagemWhatsApp = montarResumoWhatsApp();
      const abriuWhatsApp = abrirWhatsAppComMensagem(
        mensagemWhatsApp,
        popupReservado,
      );

      if (!abriuWhatsApp) {
        setSuccess(
          "Movimentação registrada, mas o navegador bloqueou a abertura do WhatsApp.",
        );
      } else {
        setSuccess(
          "Movimentação registrada com sucesso e mensagem preparada no WhatsApp!",
        );
      }

      salvarTipoContadorMaquina(maquinaId, tipoContadorAtivo);
      setTimeout(() => {
        navigate(`/roteiros/${roteiroId}/executar`, {
          replace: true,
          state: { lojaId: lojaId, origemMovimentacao: true },
        });
      }, 1200);
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao registrar movimentação.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDadosConfirmacao(montarDadosConfirmacao());
    setConfirmacaoAberta(true);
  };

  const confirmarSalvarEEnviar = async () => {
    setConfirmacaoAberta(false);
    await salvarMovimentacaoEEnviarWhatsApp();
  };

  const resumoPreConfirmacao = useMemo(() => {
    return montarDadosConfirmacao();
  }, [
    formData.contadorInAnterior,
    formData.contadorOutAnterior,
    formData.contadorInManual,
    formData.contadorOutManual,
    formData.contadorInDigital,
    formData.contadorOutDigital,
    formData.usarContadorManual,
    formData.ignoreInOut,
    isPrimeiraMovimentacao,
    resumoCalculo,
  ]);

  if (loading)
    return <div className="p-20 text-center font-bold">Carregando...</div>;

  const deveExibirContadores =
    !isFuncionarioAbastecedor || isPrimeiraMovimentacao;
  const resumoContadoresPreview = obterResumoContadores();

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="card-gradient mb-6">
          {/* Bloco de informações da máquina */}
          {maquina && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex flex-col md:flex-row md:items-center md:gap-6">
              <div className="font-semibold text-gray-800">
                <span className="mr-2">🔢</span>
                <span className="mr-2">
                  Nº:{" "}
                  <span className="font-bold">
                    {maquina.codigo || maquina.numero || "-"}
                  </span>
                </span>
                <span className="mr-2">|</span>
                <span className="mr-2">
                  🖲️ Tipo:{" "}
                  <span className="font-bold">{maquina.tipo || "-"}</span>
                </span>
                <span className="mr-2">|</span>
                <span className="mr-2">
                  🎰 Nome:{" "}
                  <span className="font-bold">{maquina.nome || "-"}</span>
                </span>
              </div>
            </div>
          )}
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Registrar Movimentação
          </h3>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <strong>Como funciona:</strong> Informe quantos produtos tem AGORA
              na máquina (o sistema calcula o que saiu). Se abastecer, informe
              quantos foram adicionados.
            </p>
          </div>
          {isPrimeiraMovimentacao && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Primeira movimentação: informe os contadores anteriores e os
                atuais. O sistema criará dois registros automaticamente.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {deveExibirContadores ? (
              <>
                {isPrimeiraMovimentacao && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        🧾 Contador Entrada Anterior
                      </label>
                      <input
                        type="number"
                        name="contadorInAnterior"
                        value={formData.contadorInAnterior}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={isPrimeiraMovimentacao}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Contador Entrada antes da primeira movimentação
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        🧾 Contador Saída Anterior
                      </label>
                      <input
                        type="number"
                        name="contadorOutAnterior"
                        value={formData.contadorOutAnterior}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={isPrimeiraMovimentacao}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Contador Saída antes da primeira movimentação
                      </p>
                    </div>
                  </div>
                )}
                {!formData.usarContadorManual && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1">
                        Contador entrada anterior: {formatarValorConfirmacao(resumoContadoresPreview.inAnterior)}
                      </p>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📥 Contador Entrada Mecânico (Entrada)
                      </label>
                      <input
                        type="number"
                        name="contadorInDigital"
                        value={formData.contadorInDigital}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={
                          isPrimeiraMovimentacao &&
                          !formData.usarContadorManual &&
                          !formData.ignoreInOut
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Entrada Mecânico da máquina
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1">
                        OUT anterior: {formatarValorConfirmacao(resumoContadoresPreview.outAnterior)}
                      </p>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📤 Contador Saída Mecânico (Saída)
                      </label>
                      <input
                        type="number"
                        name="contadorOutDigital"
                        value={formData.contadorOutDigital}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={
                          isPrimeiraMovimentacao &&
                          !formData.usarContadorManual &&
                          !formData.ignoreInOut
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Saída Mecânico da máquina
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="usarContadorManual"
                    name="usarContadorManual"
                    checked={formData.usarContadorManual || false}
                    onChange={handleChange}
                    className="mr-2"
                    disabled={formData.ignoreInOut}
                  />
                  <label
                    htmlFor="usarContadorManual"
                    className="text-sm text-gray-700"
                  >
                    {formData.usarContadorManual
                      ? "Usando contador digital. Clique para usar contador mecânico"
                      : "Usando contador mecânico. Clique para usar contador digital"}
                  </label>
                </div>
                {formData.usarContadorManual && !formData.ignoreInOut && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1">
                        Contador entrada: {formatarValorConfirmacao(resumoContadoresPreview.inAnterior)}
                      </p>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📥 Contador Entrada Digital
                      </label>
                      <input
                        type="number"
                        name="contadorInManual"
                        value={formData.contadorInManual}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={
                          isPrimeiraMovimentacao &&
                          formData.usarContadorManual &&
                          !formData.ignoreInOut
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Entrada digital (opcional)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1">
                        OUT anterior: {formatarValorConfirmacao(resumoContadoresPreview.outAnterior)}
                      </p>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📤 Contador Saída Digital
                      </label>
                      <input
                        type="number"
                        name="contadorOutManual"
                        value={formData.contadorOutManual}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={
                          isPrimeiraMovimentacao &&
                          formData.usarContadorManual &&
                          !formData.ignoreInOut
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Saída digital (opcional)
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center mt-2 mb-4">
                  <input
                    type="checkbox"
                    id="ignoreInOut"
                    name="ignoreInOut"
                    checked={formData.ignoreInOut || false}
                    onChange={handleChange}
                    className="mr-2"
                    disabled={isPrimeiraMovimentacao}
                  />
                  <label
                    htmlFor="ignoreInOut"
                    className="text-sm text-gray-700"
                  >
                    Não preciso informar IN/OUT nesta movimentação
                  </label>
                </div>

                {resumoCalculo && (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-sm text-indigo-900 font-semibold">
                      Sugestões automáticas de contadores
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      OUT sugerido acumulado:{" "}
                      {resumoCalculo.contadorOutSugerido || 0}
                    </p>
                    <p className="text-xs text-indigo-700">
                      Era para ter na máquina:{" "}
                      {quantidadeAtualSugerida ?? 0}
                    </p>
                    <p className="text-xs text-indigo-700">
                      Sugestão de abastecimento: {sugestaoAbastecimento ?? 0}
                    </p>
                  </div>
                )}

                {!formData.ignoreInOut && resumoPreConfirmacao && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm font-semibold text-emerald-900">
                      Pré-cálculo antes de salvar
                    </p>
                    <p className="text-xs text-emerald-800 mt-1">
                      Jogou tanto antes: {formatarValorConfirmacao(resumoPreConfirmacao.inAnterior)} | Jogou tanto agora: {formatarValorConfirmacao(resumoPreConfirmacao.inAtual)} | Diferença de jogadas para o atual: {formatarValorConfirmacao(resumoPreConfirmacao.diferencaIn)}
                    </p>
                  </div>
                )}

                {alertaDivergencia && (
                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-xs font-bold text-yellow-800 mb-1">
                      Atenção: possível divergência de contagem
                    </p>
                    {alertaDivergencia.tipo === "out_abaixo_sugerido" ? (
                      <p className="text-xs text-yellow-700">
                        OUT digitado ({alertaDivergencia.contadorOutDigitado})
                        está abaixo do OUT sugerido acumulado (
                        {alertaDivergencia.contadorOutSugerido}).
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-700">
                        Era para ter {alertaDivergencia.totalPreEsperado} na
                        máquina, mas foi informado{" "}
                        {alertaDivergencia.totalPreInformado}.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  Perfil Funcionário Abastecedor: IN/OUT é ignorado
                  automaticamente nesta movimentação.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📦 Quantidade Atual na Máquina *
                </label>
                <input
                  type="number"
                  name="quantidadeAtualMaquina"
                  value={formData.quantidadeAtualMaquina}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="0"
                  min="0"
                  disabled={isFuncionarioAbastecedor}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isFuncionarioAbastecedor
                    ? "Para abastecedor, este campo usa a maior quantidade entre capacidade padrão e estoque atual da última movimentação"
                    : "Quantos produtos tem agora"}
                </p>
                {quantidadeAtualSugerida !== null && (
                  <p className="text-xs text-indigo-700 mt-1 font-semibold">
                    Sugestão automática: {quantidadeAtualSugerida} (pela saída do
                    contador OUT desde a última movimentação)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📦 Quantidade Adicionada
                </label>
                <input
                  type="number"
                  name="quantidadeAdicionada"
                  value={formData.quantidadeAdicionada}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quantos produtos foram adicionados
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ❌ Retirada de Produto
                </label>
                <input
                  type="number"
                  name="retiradaProduto"
                  value={formData.retiradaProduto}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quantidade de produtos retirados (não conta como saída
                  financeira)
                </p>
                <label className="flex items-center mt-2 gap-2">
                  <input
                    type="checkbox"
                    name="retiradaProdutoDevolverEstoque"
                    checked={formData.retiradaProdutoDevolverEstoque || false}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-xs text-green-700">
                    Devolver retirada para o estoque do ponto
                  </span>
                </label>
              </div>
            </div>
            {!isFuncionarioAbastecedor && (
              <div className="p-4 bg-linear-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaEstoque"
                    checked={formData.retiradaEstoque}
                    onChange={handleChange}
                    className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-orange-900">
                      📦 Retirada de Estoque (não conta como dinheiro)
                    </span>
                    <p className="text-xs text-orange-700 mt-1">
                      Marque esta opção quando estiver retirando produtos da
                      máquina sem que seja uma venda (exemplo: produtos
                      danificados, devolução, transferência). As fichas serão
                      automaticamente zeradas.
                    </p>
                  </div>
                </label>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Produto
              </label>
              <select
                name="produto_id"
                value={formData.produto_id}
                onChange={handleChange}
                className="select-field"
              >
                <option value="">Não usar nenhum produto</option>
                {produtosDisponiveis.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.nome}
                  </option>
                ))}
              </select>
              {isPerfilFuncionario && produtosDisponiveis.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  {formData.origemEstoque === "loja"
                    ? "Nenhum produto cadastrado no estoque desta loja."
                    : "Nenhum produto com saldo disponível no seu estoque."}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Origem do Estoque
              </label>
              <select
                name="origemEstoque"
                value={formData.origemEstoque || "usuario"}
                onChange={handleChange}
                className="select-field"
              >
                <option value="usuario">Meu estoque</option>
                <option value="loja">Estoque do ponto</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Ao escolher estoque do ponto, pode ser solicitada confirmação.
              </p>
            </div>
            {podeVerCamposFinanceirosEObservacao && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observação
                </label>
                <textarea
                  name="observacao"
                  value={formData.observacao}
                  onChange={handleChange}
                  className="input-field"
                  rows="2"
                  placeholder="Informações adicionais sobre a movimentação..."
                />
              </div>
            )}

            {!isFuncionarioAbastecedor && (
              <div className="p-4 bg-linear-to-r from-green-100 to-emerald-200 border-4 border-green-500 rounded-lg shadow-lg shadow-green-300/60 animate-pulse">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaDinheiro"
                    checked={formData.retiradaDinheiro}
                    onChange={handleChange}
                    className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-extrabold text-green-900 flex items-center gap-2">
                      💰 Retirada de Dinheiro
                      <span className="px-2 py-0.5 rounded-full bg-green-700 text-white text-[10px] tracking-wide uppercase animate-pulse">
                        Destaque
                      </span>
                    </span>
                    <p className="text-xs text-green-800 mt-1 font-medium">
                      Marque esta opção se você está retirando dinheiro desta
                      máquina. Esta movimentação aparecerá na aba "Fluxo de
                      Caixa" para conferência pelo administrador.
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() =>
                  navigate(`/roteiros/${roteiroId}/executar`, {
                    state: { lojaId: lojaId },
                  })
                }
                className="btn-secondary w-full md:w-auto"
              >
                Voltar
              </button>
              <button type="submit" className="btn-primary w-full md:w-auto">
                Salvar e Enviar no WhatsApp
              </button>
            </div>
            {error && <div className="text-red-600 mt-2">{error}</div>}
            {success && <div className="text-green-600 mt-2">{success}</div>}
          </form>

          {confirmacaoAberta && dadosConfirmacao && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-2xl p-5">
                <h4 className="text-lg font-bold text-gray-900 mb-3">
                  Confirmar movimentação
                </h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    Contador entrada preenchido: <strong>{formatarValorConfirmacao(dadosConfirmacao.inAtual)}</strong>
                  </p>
                  <p>
                    Contador saida preenchido: <strong>{formatarValorConfirmacao(dadosConfirmacao.outAtual)}</strong>
                  </p>
                  <p>
                    Jogou: <strong>{formatarValorConfirmacao(dadosConfirmacao.diferencaIn)}</strong>
                  </p>
                  <p>
                    Saiu: <strong>{formatarValorConfirmacao(dadosConfirmacao.diferencaOut)}</strong>
                  </p>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmacaoAberta(false)}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarSalvarEEnviar}
                    className="btn-primary w-full sm:w-auto"
                  >
                    Confirmar!
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
