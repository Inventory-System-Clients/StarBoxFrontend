import { useState, useEffect } from "react";
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
  const podeVerCamposFinanceirosEObservacao = !isFuncionarioAbastecedor;

  // Estados para formulário
  const [formData, setFormData] = useState({
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
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
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
    retiradaDinheiro: false,
  });
  const [produtos, setProdutos] = useState([]);
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resumoCalculo, setResumoCalculo] = useState(null);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);
  const [isPrimeiraMovimentacao, setIsPrimeiraMovimentacao] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [maqRes, prodRes, ultimoProdRes, movRes] = await Promise.all([
          api.get(`/maquinas/${maquinaId}`),
          api.get("/produtos"),
          api
            .get(`/maquinas/${maquinaId}/ultimo-produto`)
            .catch(() => ({ data: { produtoId: null } })),
          api
            .get(`/movimentacoes?maquinaId=${maquinaId}&limite=1`)
            .catch(() => ({ data: [] })),
        ]);
        setMaquina(maqRes.data);
        setProdutos(prodRes.data);

        const movimentacoesMaquina = Array.isArray(movRes.data)
          ? movRes.data
          : [];
        const primeiraMovimentacao = movimentacoesMaquina.length === 0;
        setIsPrimeiraMovimentacao(primeiraMovimentacao);
        const capacidadePadrao = Number(
          maqRes.data?.capacidadePadrao ?? maqRes.data?.capacidade ?? 0,
        );

        setFormData((prev) => ({
          ...prev,
          produto_id: ultimoProdRes.data?.produtoId || prev.produto_id,
          quantidadeAtualMaquina:
            primeiraMovimentacao &&
            prev.quantidadeAtualMaquina === "" &&
            capacidadePadrao > 0
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
  }, [maquinaId, usuario]);

  useEffect(() => {
    if (!isFuncionarioAbastecedor) return;

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
        setSugestaoAbastecimento(null);
        return;
      }

      const contadorOutDigitalReferencia = formData.contadorOutDigital;

      const params = { maquinaId };
      if (!isFuncionarioAbastecedor && !formData.ignoreInOut) {
        if (contadorOutDigitalReferencia !== "") {
          params.contadorOut = contadorOutDigitalReferencia;
        }
      }

      try {
        const res = await api.get(
          `/maquinas/${maquinaId}/calcular-quantidade`,
          {
            params,
          },
        );

        const quantidadeCalculada =
          res.data.quantidadeAtual >= 0 ? res.data.quantidadeAtual : 0;

        setResumoCalculo(res.data);
        setSugestaoAbastecimento(res.data.sugestaoAbastecimento ?? null);

        const temContadoresDigitados =
          !isFuncionarioAbastecedor &&
          !isPrimeiraMovimentacao &&
          !formData.ignoreInOut &&
          contadorOutDigitalReferencia !== "";

        if (temContadoresDigitados) {
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina: quantidadeCalculada,
          }));
        }
      } catch {
        setResumoCalculo(null);
        setSugestaoAbastecimento(null);
      }
    }

    atualizarCalculos();
  }, [
    maquina,
    maquinaId,
    isFuncionarioAbastecedor,
    isPrimeiraMovimentacao,
    formData.contadorOutDigital,
    formData.ignoreInOut,
  ]);

  // Sugestão de abastecimento usando backend
  const [sugestaoAbastecimento, setSugestaoAbastecimento] = useState(null);
  useEffect(() => {
    if (isFuncionarioAbastecedor) {
      setAlertaDivergencia(null);
      return;
    }

    const contadorOutDigitado = parseInt(formData.contadorOutDigital, 10);
    const totalPreInformado = parseInt(formData.quantidadeAtualMaquina, 10);

    if (!resumoCalculo) {
      setAlertaDivergencia(null);
      return;
    }

    if (
      !formData.ignoreInOut &&
      formData.contadorOutDigital !== "" &&
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
      formData.contadorOutDigital !== "" &&
      formData.quantidadeAtualMaquina !== "" &&
      !Number.isNaN(totalPreInformado)
    ) {
      const totalPreEsperado = parseInt(
        resumoCalculo.totalPreEsperado ?? resumoCalculo.quantidadeAtual ?? 0,
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
    formData.contadorOutDigital,
    formData.quantidadeAtualMaquina,
    formData.ignoreInOut,
  ]);

  useEffect(() => {
    async function calcularSugestao() {
      if (isFuncionarioAbastecedor) {
        setSugestaoAbastecimento(null);
        return;
      }

      if (!resumoCalculo) {
        setSugestaoAbastecimento(null);
        return;
      }

      setSugestaoAbastecimento(resumoCalculo.sugestaoAbastecimento ?? null);
    }

    calcularSugestao();
  }, [isFuncionarioAbastecedor, resumoCalculo]);

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

  const abrirWhatsAppComMensagem = (mensagem) => {
    const textoCodificado = encodeURIComponent(mensagem);
    const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

    // No desktop, usar WhatsApp Web evita abrir automaticamente no app Business.
    const whatsappUrl = isMobile
      ? `https://wa.me/?text=${textoCodificado}`
      : `https://web.whatsapp.com/send?text=${textoCodificado}`;

    const link = document.createElement("a");
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const obterResumoContadores = () => {
    const inAnterior = Number(resumoCalculo?.contadorInSugerido || 0);
    const outAnterior = Number(
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

  const handleEnviarResumoWhatsApp = () => {
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

    const lojaCodigo = String(maquina?.loja?.id || lojaId || "")
      .slice(0, 8)
      .toUpperCase();
    const lojaNome = maquina?.loja?.nome || "Loja sem nome";
    const dataMovimentacao = new Date().toLocaleString("pt-BR");
    const nomeUsuario = usuario?.nome || "Usuário";
    const codigoMaquina = maquina?.codigo || "-";
    const nomeMaquina = maquina?.nome || "Máquina";
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
          `Jogado.......: ${formatarMoeda(jogado)}`,
          "Cliente....: 0,00",
          `Liquido.....: ${formatarMoeda(saldo)}`,
          `Especie.....: ${formatarMoeda(saldo)}`,
        ];

    const mensagem = [
      "STAR BOX",
      `*${lojaCodigo} | ${lojaNome}*`,
      `Data: ${dataMovimentacao}`,
      `Lançado por: ${nomeUsuario}`,
      "___________________________________",
      `${codigoMaquina} | ${nomeMaquina}`,
      `Produto abastecido: ${nomeProdutoAbastecido}${
        quantidadeAbastecidaInformada > 0
          ? ` (Qtd: ${formatarInteiro(quantidadeAbastecidaInformada)})`
          : ""
      }`,
      `E  ${formatarInteiro(inAnterior)}  ${formatarInteiro(inAtual)}  ____ R$${formatarMoeda(diferencaIn)}`,
      `S  ${formatarInteiro(outAnterior)}  ${formatarInteiro(outAtual)}  ____ ${formatarInteiro(quantidadeSaiu)}`,
      ...blocoFinanceiro,
    ].join("\n");

    abrirWhatsAppComMensagem(mensagem);

    setSuccess("Resumo pronto! Escolha o contato no WhatsApp e envie.");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const deveIgnorarContadores =
        isFuncionarioAbastecedor || Boolean(formData.ignoreInOut);
      const parseContadorOpcional = (valor) => {
        if (valor === "" || valor === null || valor === undefined) return null;
        const numero = parseInt(valor, 10);
        return Number.isNaN(numero) ? null : numero;
      };

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

      const produtosParaEnviar = [
        {
          produtoId: formData.produto_id,
          quantidadeSaiu: 0,
          quantidadeAbastecida: parseInt(formData.quantidadeAdicionada) || 0,
          retiradaProduto: parseInt(formData.retiradaProduto) || 0,
          retiradaProdutoDevolverEstoque:
            formData.retiradaProdutoDevolverEstoque || false,
        },
      ];

      const payload = {
        maquinaId: maquinaId,
        roteiroId: roteiroId,
        totalPre: parseInt(formData.quantidadeAtualMaquina) || 0,
        abastecidas: parseInt(formData.quantidadeAdicionada) || 0,
        fichas: parseInt(formData.fichas) || 0,
        contadorIn: deveIgnorarContadores
          ? null
          : (contadorInManualInformado ?? contadorInDigitalInformado),
        contadorOut: deveIgnorarContadores
          ? null
          : (contadorOutManualInformado ?? contadorOutDigitalInformado),
        contadorInDigital: deveIgnorarContadores
          ? null
          : contadorInDigitalInformado,
        contadorOutDigital: deveIgnorarContadores
          ? null
          : contadorOutDigitalInformado,
        quantidade_notas_entrada: podeVerCamposFinanceirosEObservacao && formData.quantidade_notas_entrada
          ? parseFloat(formData.quantidade_notas_entrada)
          : null,
        valor_entrada_maquininha_pix: podeVerCamposFinanceirosEObservacao && formData.valor_entrada_maquininha_pix
          ? parseFloat(formData.valor_entrada_maquininha_pix)
          : null,
        ignoreInOut: isFuncionarioAbastecedor
          ? true
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
        retiradaDinheiro: isFuncionarioAbastecedor
          ? false
          : formData.retiradaDinheiro || false,
      };

      const enviarMovimentacao = (confirmarUsoEstoqueLoja = false) =>
        api.post("/movimentacoes", {
          ...payload,
          confirmarUsoEstoqueLoja,
        });

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
          `Voce possui saldo no estoque pessoal para alguns produtos:\n\n${resumoDetalhes}\n\nDeseja retirar do estoque da loja mesmo assim?`,
        );

        if (!confirmar) {
          setError("Movimentacao cancelada. Origem de estoque nao confirmada.");
          return;
        }

        await enviarMovimentacao(true);
      }

      setSuccess("Movimentação registrada com sucesso!");
      setTimeout(() => {
        navigate(`/roteiros/${roteiroId}/executar`, {
          replace: true,
          state: { lojaId: lojaId },
        });
      }, 1200);
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao registrar movimentação.");
    }
  };

  if (loading)
    return <div className="p-20 text-center font-bold">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-100 t                                                                                                                                              ext-[#24094E]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="card-gradient mb-6">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isFuncionarioAbastecedor ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📥 Contador IN Digital (Entrada)
                    </label>
                    <input
                      type="number"
                      name="contadorInDigital"
                      value={formData.contadorInDigital}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Número do contador IN Digital da máquina
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📤 Contador OUT Digital (Saída)
                    </label>
                    <input
                      type="number"
                      name="contadorOutDigital"
                      value={formData.contadorOutDigital}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Número do contador OUT Digital da máquina
                    </p>
                  </div>
                </div>
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
                    Usar contador IN/OUT manual
                  </label>
                </div>
                {formData.usarContadorManual && !formData.ignoreInOut && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📥 Contador IN Manual
                      </label>
                      <input
                        type="number"
                        name="contadorInManual"
                        value={formData.contadorInManual}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador IN manual (opcional)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📤 Contador OUT Manual
                      </label>
                      <input
                        type="number"
                        name="contadorOutManual"
                        value={formData.contadorOutManual}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador OUT manual (opcional)
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
                      Era para ter na máquina: {resumoCalculo.totalPreEsperado ?? 0}
                    </p>
                    <p className="text-xs text-indigo-700">
                      Sugestão de abastecimento: {sugestaoAbastecimento ?? 0}
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
                        OUT digitado ({alertaDivergencia.contadorOutDigitado}) está abaixo do OUT sugerido acumulado (
                        {alertaDivergencia.contadorOutSugerido}).
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-700">
                        Era para ter {alertaDivergencia.totalPreEsperado} na máquina, mas foi informado {alertaDivergencia.totalPreInformado}.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  Perfil Funcionário Abastecedor: IN/OUT é ignorado automaticamente nesta movimentação.
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
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quantos produtos tem agora
                </p>
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
                    Devolver retirada para o estoque da loja
                  </span>
                </label>
              </div>
              {podeVerCamposFinanceirosEObservacao && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💵 Valor em Notas (R$)
                    </label>
                    <input
                      type="number"
                      name="quantidade_notas_entrada"
                      value={formData.quantidade_notas_entrada}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Valor total em dinheiro (notas) inserido na máquina
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💳 Valor Digital (Pix/Maquininha) (R$)
                    </label>
                    <input
                      type="number"
                      name="valor_entrada_maquininha_pix"
                      value={formData.valor_entrada_maquininha_pix}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Valor total recebido via pagamento digital (Pix/Maquininha)
                    </p>
                  </div>
                </>
              )}
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
                Produto *
              </label>
              <select
                name="produto_id"
                value={formData.produto_id}
                onChange={handleChange}
                className="select-field"
                required
              >
                <option value="">Selecione um produto</option>
                {produtos.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.nome}
                  </option>
                ))}
              </select>
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
                <option value="loja">Estoque da loja</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Ao escolher estoque da loja, pode ser solicitada confirmação.
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
              <div className="p-4 bg-linear-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaDinheiro"
                    checked={formData.retiradaDinheiro}
                    onChange={handleChange}
                    className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-green-900 flex items-center gap-2">
                      💰 Retirada de Dinheiro
                    </span>
                    <p className="text-xs text-green-700 mt-1">
                      Marque esta opção se você está retirando dinheiro desta
                      máquina. Esta movimentação aparecerá na aba "Fluxo de Caixa"
                      para conferência pelo administrador.
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
              <button
                type="button"
                onClick={handleEnviarResumoWhatsApp}
                className="w-full md:w-auto px-4 py-2 rounded-lg font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors text-center"
              >
                <span className="md:hidden">Enviar para o WhatsApp</span>
                <span className="hidden md:inline">
                  Enviar informações para o WhatsApp
                </span>
              </button>
              <button type="submit" className="btn-primary w-full md:w-auto">
                Registrar Movimentação
              </button>
            </div>
            {error && <div className="text-red-600 mt-2">{error}</div>}
            {success && <div className="text-green-600 mt-2">{success}</div>}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
