import { useState, useEffect } from "react";
import api from "../services/api";
import { buscarRoteiros } from "../services/roteiros";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { RelatorioTodasLojas } from "../components/RelatorioTodasLojas";

const TODAS_LOJAS_VALUE = "__TODAS_AS_LOJAS__";

export function Relatorios() {
  const [dashboard, setDashboard] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [roteiros, setRoteiros] = useState([]);
  const [roteiroSelecionado, setRoteiroSelecionado] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [comissaoData, setComissaoData] = useState(null);
  const [lucroData, setLucroData] = useState(null);
  const [movimentacoesData, setMovimentacoesData] = useState(null);
  const [produtosPrecos, setProdutosPrecos] = useState({});
  const [abaTicketPremio, setAbaTicketPremio] = useState("loja");
  const [error, setError] = useState("");
  const [gastosFixosLoja, setGastosFixosLoja] = useState([]);
  const [comparativoMensal, setComparativoMensal] = useState(null);

  // Buscar lista de lojas
  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data);
    } catch (error) {
      setError(
        "Erro ao carregar lojas: " +
          (error.response?.data?.error || error.message),
      );
      setLojas([]);
    } finally {
      setLoadingLojas(false);
    }
  };

  // Buscar dados do dashboard
  const carregarDashboard = async (lojaId, dataInicio, dataFim) => {
    try {
      const response = await api.get("/relatorios/dashboard", {
        params: {
          lojaId,
          dataInicio,
          dataFim,
        },
      });
      setDashboard(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setDashboard(null);
    }
  };

  useEffect(() => {
    carregarLojas();
    // Carregar roteiros
    buscarRoteiros()
      .then(setRoteiros)
      .catch(() => setRoteiros([]));
    definirDatasDefault && definirDatasDefault();
  }, []);

  const handleImprimir = () => {
    window.print();
  };

  const definirDatasDefault = () => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(seteDiasAtras.toISOString().split("T")[0]);
  };

  const formatarDataISO = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  const obterMesmoDiaNoMesAnterior = (dataTexto) => {
    const dataBase = new Date(`${dataTexto}T00:00:00`);
    if (Number.isNaN(dataBase.getTime())) return dataTexto;

    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth();
    const dia = dataBase.getDate();
    const ultimoDiaMesAnterior = new Date(ano, mes, 0).getDate();
    const diaAjustado = Math.min(dia, ultimoDiaMesAnterior);

    return formatarDataISO(new Date(ano, mes - 1, diaAjustado));
  };

  const toNumber = (valor) => Number(valor || 0);

  const calcularValorFichasRelatorio = (dadosRelatorio) => {
    const totalFichas = toNumber(dadosRelatorio?.totais?.fichas);
    const valorFicha = toNumber(dadosRelatorio?.loja?.valorFichaPadrao || 2.5);
    return totalFichas * valorFicha;
  };

  const calcularValorConsolidadoRelatorio = (dadosRelatorio) => {
    if (dadosRelatorio?.totais?.valorBrutoConsolidadoLojaMaquinas != null) {
      return toNumber(dadosRelatorio.totais.valorBrutoConsolidadoLojaMaquinas);
    }
    const valorTrocadora =
      toNumber(dadosRelatorio?.totais?.valorDinheiroLoja) +
      toNumber(dadosRelatorio?.totais?.valorCartaoPixLoja);
    const valorBrutoMaquinas = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.reduce(
          (acc, maquina) =>
            acc +
            toNumber(maquina?.totais?.dinheiro) +
            toNumber(maquina?.totais?.cartaoPix),
          0,
        )
      : 0;
    return valorTrocadora + valorBrutoMaquinas;
  };

  const calcularLucroLiquidoRelatorio = (dadosRelatorio) => {
    if (dadosRelatorio?.totais?.valorLiquidoConsolidadoLojaMaquinas != null) {
      return toNumber(
        dadosRelatorio.totais.valorLiquidoConsolidadoLojaMaquinas,
      );
    }
    const valorTrocadoraLiquido =
      toNumber(dadosRelatorio?.totais?.valorDinheiroLoja) +
      toNumber(dadosRelatorio?.totais?.valorCartaoPixLiquidoLoja);
    const valorLiquidoMaquinas = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.reduce(
          (acc, maquina) =>
            acc +
            toNumber(maquina?.totais?.dinheiro) +
            toNumber(maquina?.totais?.cartaoPixLiquido),
          0,
        )
      : 0;
    const gastoTotal = toNumber(dadosRelatorio?.totais?.gastoTotalPeriodo);
    return valorTrocadoraLiquido + valorLiquidoMaquinas - gastoTotal;
  };

  const calcularCustoSaidaProdutosRelatorio = (dadosRelatorio) => {
    if (
      Array.isArray(dadosRelatorio?.maquinas) &&
      dadosRelatorio.maquinas.length
    ) {
      return dadosRelatorio.maquinas.reduce(
        (acc, maquina) => acc + toNumber(maquina?.totais?.custoProdutosSairam),
        0,
      );
    }
    return toNumber(dadosRelatorio?.totais?.gastoProdutosTotalPeriodo);
  };

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarPercentualComparacao = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarDataExibicao = (dataTexto) => {
    const [ano, mes, dia] = String(dataTexto || "").split("-");
    if (!ano || !mes || !dia) return dataTexto || "-";
    return `${dia}/${mes}/${ano}`;
  };

  const obterClassesStatusComparacao = (status) => {
    if (status === "melhor")
      return {
        card: "bg-emerald-50 border-emerald-300",
        texto: "text-emerald-700",
        icone: "▲",
      };
    if (status === "pior")
      return {
        card: "bg-red-50 border-red-300",
        texto: "text-red-700",
        icone: "▼",
      };
    return {
      card: "bg-slate-50 border-slate-300",
      texto: "text-slate-700",
      icone: "●",
    };
  };

  const montarIndicadorComparacao = (
    valorAtual,
    valorAnterior,
    melhorQuando = "maior",
  ) => {
    const atual = toNumber(valorAtual);
    const anterior = toNumber(valorAnterior);
    const diferenca = atual - anterior;

    let percentual = 0;
    if (Math.abs(anterior) > 0.0001) {
      percentual = (diferenca / Math.abs(anterior)) * 100;
    } else if (Math.abs(atual) > 0.0001) {
      percentual = 100;
    }

    const direcao =
      diferenca > 0.0001 ? "acima" : diferenca < -0.0001 ? "abaixo" : "igual";

    let status = "igual";
    if (direcao !== "igual") {
      if (melhorQuando === "menor") {
        status = diferenca < 0 ? "melhor" : "pior";
      } else {
        status = diferenca > 0 ? "melhor" : "pior";
      }
    }

    return {
      atual,
      anterior,
      diferenca,
      percentual,
      direcao,
      status,
    };
  };

  const gerarRelatorio = async () => {
    if (!dataInicio || !dataFim || (!lojaSelecionada && !roteiroSelecionado)) {
      setError("Por favor, preencha todos os campos obrigatórios");
      return;
    }
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    if (fim < inicio) {
      setError("A data final não pode ser anterior à data inicial");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setRelatorio(null);
      setDashboard(null);
      setComissaoData(null);
      setLucroData(null);
      setMovimentacoesData(null);
      setAbaTicketPremio("loja");
      setGastosFixosLoja([]);
      setComparativoMensal(null);
      if (lojaSelecionada === TODAS_LOJAS_VALUE) {
        const response = await api.get("/relatorios/todas-lojas", {
          params: { dataInicio, dataFim },
        });

        let comparativoMensal = null;
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);

          const responseMesAnterior = await api.get("/relatorios/todas-lojas", {
            params: {
              dataInicio: dataInicioMesAnterior,
              dataFim: dataFimMesAnterior,
            },
          });

          const totaisAtual = response.data?.totais || {};
          const totaisAnterior = responseMesAnterior.data?.totais || {};

          const valorConsolidadoAtual =
            toNumber(totaisAtual.lucroBrutoTotal) ||
            toNumber(totaisAtual.dinheiroTotal) +
              toNumber(totaisAtual.cartaoPixTotal);

          const valorConsolidadoAnterior =
            toNumber(totaisAnterior.lucroBrutoTotal) ||
            toNumber(totaisAnterior.dinheiroTotal) +
              toNumber(totaisAnterior.cartaoPixTotal);

          comparativoMensal = {
            periodoAtual: {
              inicio: dataInicio,
              fim: dataFim,
            },
            periodoAnterior: {
              inicio: dataInicioMesAnterior,
              fim: dataFimMesAnterior,
            },
            metricas: [
              {
                chave: "lucroLiquidoTotal",
                titulo: "Lucro Líquido Total",
                icone: "📉",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.lucroLiquidoTotal),
                  toNumber(totaisAnterior.lucroLiquidoTotal),
                  "maior",
                ),
              },
              {
                chave: "valorFichasTotal",
                titulo: "Valor das Fichas (Estimado)",
                icone: "🎟️",
                observacao:
                  "Estimado com valor médio de R$ 2,50 por ficha no consolidado.",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.fichasTotal) * 2.5,
                  toNumber(totaisAnterior.fichasTotal) * 2.5,
                  "maior",
                ),
              },
              {
                chave: "valorConsolidado",
                titulo: "Valor Consolidado",
                icone: "💰",
                indicador: montarIndicadorComparacao(
                  valorConsolidadoAtual,
                  valorConsolidadoAnterior,
                  "maior",
                ),
              },
              {
                chave: "custoSaidaProdutos",
                titulo: "Custo de Saída dos Produtos",
                icone: "💸",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.custoProdutosTotal),
                  toNumber(totaisAnterior.custoProdutosTotal),
                  "menor",
                ),
              },
            ],
          };
        } catch (erroComparativoTodasLojas) {
          console.warn(
            "Não foi possível gerar comparativo de todas as lojas com o mês passado:",
            erroComparativoTodasLojas,
          );
        }

        setRelatorio({
          ...response.data,
          comparativoMensal,
        });
      } else if (roteiroSelecionado) {
        // Buscar relatório de roteiro inteiro
        const response = await api.get("/relatorios/roteiro", {
          params: { roteiroId: roteiroSelecionado, dataInicio, dataFim },
        });
        setRelatorio({ tipo: "roteiro", ...response.data });
      } else if (lojaSelecionada) {
        // Buscar relatório de loja + dashboard + comissão + produtos em paralelo
        const [impressaoRes, comissaoRes, lucroRes, movRes, produtosRes] =
          await Promise.all([
            api.get("/relatorios/impressao", {
              params: { lojaId: lojaSelecionada, dataInicio, dataFim },
            }),
            api
              .get("/movimentacoes/relatorio/comissao-dia", {
                params: { lojaId: lojaSelecionada, data: dataFim },
              })
              .catch(() => ({ data: null })),
            api
              .get("/movimentacoes/relatorio/lucro-dia", {
                params: { lojaId: lojaSelecionada, data: dataFim },
              })
              .catch((err) => {
                console.error(
                  "Erro lucro-dia:",
                  err.response?.data || err.message,
                );
                return { data: null };
              }),
            api
              .get("/movimentacoes/relatorio/movimentacoes-dia", {
                params: { lojaId: lojaSelecionada, data: dataFim },
              })
              .catch(() => ({ data: null })),
            api.get("/produtos").catch(() => ({ data: [] })),
          ]);
        // Também carregar dashboard
        await carregarDashboard(lojaSelecionada, dataInicio, dataFim);

        // Criar mapa de preços dos produtos (id -> {preco, custoUnitario})
        const produtosMap = {};
        const produtosList = Array.isArray(produtosRes.data)
          ? produtosRes.data
          : produtosRes.data?.produtos || produtosRes.data?.rows || [];
        produtosList.forEach((p) => {
          produtosMap[p.id] = {
            nome: p.nome || "",
            preco: Number(p.preco || 0),
            custoUnitario: Number(p.custoUnitario || 0),
          };
        });
        setProdutosPrecos(produtosMap);

        // Enriquecer produtosSairam com preços dos produtos
        const dados = impressaoRes.data;
        if (dados.produtosSairam) {
          dados.produtosSairam = dados.produtosSairam.map((p) => ({
            ...p,
            preco: p.preco || produtosMap[p.id]?.preco || 0,
            custoUnitario:
              p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
            valorUnitario:
              p.preco ||
              p.valorUnitario ||
              p.custoUnitario ||
              produtosMap[p.id]?.preco ||
              produtosMap[p.id]?.custoUnitario ||
              0,
          }));
        }
        if (dados.maquinas) {
          dados.maquinas = dados.maquinas.map((m) => ({
            ...m,
            produtosSairam:
              m.produtosSairam?.map((p) => ({
                ...p,
                preco: p.preco || produtosMap[p.id]?.preco || 0,
                custoUnitario:
                  p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
                valorUnitario:
                  p.preco ||
                  p.valorUnitario ||
                  p.custoUnitario ||
                  produtosMap[p.id]?.preco ||
                  produtosMap[p.id]?.custoUnitario ||
                  0,
              })) || [],
          }));
        }

        setRelatorio(dados);
        setComissaoData(comissaoRes.data);
        setLucroData(lucroRes.data);

        // Buscar gastos fixos da loja
        try {
          const gastosFixosResponse = await api.get(
            `/gastos-fixos-loja/${lojaSelecionada}`,
          );
          setGastosFixosLoja(
            Array.isArray(gastosFixosResponse.data)
              ? gastosFixosResponse.data
              : [],
          );
        } catch (erroGastosFixos) {
          console.warn(
            "Não foi possível buscar gastos fixos:",
            erroGastosFixos,
          );
          setGastosFixosLoja([]);
        }

        // Comparativo com mês passado
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);
          const responseMesAnterior = await api.get("/relatorios/impressao", {
            params: {
              lojaId: lojaSelecionada,
              dataInicio: dataInicioMesAnterior,
              dataFim: dataFimMesAnterior,
            },
          });
          const relatorioMesAnterior = responseMesAnterior.data;
          if (relatorioMesAnterior) {
            setComparativoMensal({
              periodoAtual: { inicio: dataInicio, fim: dataFim },
              periodoAnterior: {
                inicio: dataInicioMesAnterior,
                fim: dataFimMesAnterior,
              },
              metricas: [
                {
                  chave: "lucroLiquido",
                  titulo: "Lucro Líquido",
                  icone: "📉",
                  indicador: montarIndicadorComparacao(
                    calcularLucroLiquidoRelatorio(dados),
                    calcularLucroLiquidoRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "valorFichas",
                  titulo: "Valor das Fichas",
                  icone: "🎟️",
                  indicador: montarIndicadorComparacao(
                    calcularValorFichasRelatorio(dados),
                    calcularValorFichasRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "valorConsolidado",
                  titulo: "Valor Consolidado",
                  icone: "💰",
                  indicador: montarIndicadorComparacao(
                    calcularValorConsolidadoRelatorio(dados),
                    calcularValorConsolidadoRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "custoSaidaProdutos",
                  titulo: "Custo de Saída dos Produtos",
                  icone: "💸",
                  indicador: montarIndicadorComparacao(
                    calcularCustoSaidaProdutosRelatorio(dados),
                    calcularCustoSaidaProdutosRelatorio(relatorioMesAnterior),
                    "menor",
                  ),
                },
              ],
            });
          }
        } catch (erroComparativo) {
          console.warn("Não foi possível gerar comparativo:", erroComparativo);
        }

        // Agregar movimentações por máquina (dinheiro, cartão/pix)
        if (movRes.data) {
          const movs = Array.isArray(movRes.data)
            ? movRes.data
            : movRes.data.movimentacoes || [];
          const porMaquina = {};
          movs.forEach((mov) => {
            const mId = mov.maquinaId;
            if (!porMaquina[mId])
              porMaquina[mId] = { dinheiro: 0, pixCartao: 0 };
            porMaquina[mId].dinheiro += Number(
              mov.quantidade_notas_entrada || 0,
            );
            porMaquina[mId].pixCartao += Number(
              mov.valor_entrada_maquininha_pix || 0,
            );
          });
          setMovimentacoesData(porMaquina);
        }
      }
    } catch (error) {
      let errorMessage = "Erro ao gerar relatório. Tente novamente.";
      if (error.response?.status === 404) {
        errorMessage =
          "⚠️ Endpoint não encontrado. O servidor pode estar atualizando. Aguarde alguns minutos e tente novamente.";
      } else if (error.response?.status === 500) {
        errorMessage = `⚠️ Erro no servidor: ${error.response?.data?.error || "Erro interno no servidor"}. Verifique se há dados para o período selecionado.`;
      } else if (error.response?.status === 400) {
        errorMessage = `⚠️ Requisição inválida: ${error.response?.data?.error || "Verifique os campos preenchidos"}`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "⚠️ Erro de conexão. Verifique sua internet.";
      }
      setError(errorMessage);
      setRelatorio(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  const gastosFixosComValor = gastosFixosLoja
    .map((item) => ({
      id: item.id,
      nome: String(item.nome || "").trim(),
      valor: Number(item.valor || 0),
    }))
    .filter((item) => item.nome.length > 0 && item.valor > 0);

  const totalGastosFixosDaLoja = gastosFixosComValor.reduce(
    (acc, item) => acc + item.valor,
    0,
  );

  if (loadingLojas) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📄 Relatório de Impressão"
          subtitle="Gere relatórios detalhados de movimentações por loja"
          icon="📊"
        />

        {/* Formulário de Filtros */}
        <div className="card mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🗂️ Roteiro
              </label>
              <select
                value={roteiroSelecionado}
                onChange={(e) => {
                  setRoteiroSelecionado(e.target.value);
                  setLojaSelecionada("");
                }}
                className="input-field w-full"
                disabled={lojaSelecionada === TODAS_LOJAS_VALUE}
              >
                <option value="">Selecione um roteiro (opcional)</option>
                {roteiros.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => {
                  setLojaSelecionada(e.target.value);
                  setRoteiroSelecionado("");
                }}
                className="input-field w-full"
                disabled={!!roteiroSelecionado}
              >
                <option value="">Selecione uma loja</option>
                <option value={TODAS_LOJAS_VALUE}>Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">⚠️ {error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "⏳ Gerando..." : "📊 Gerar Relatório"}
            </button>
            <button
              onClick={handleImprimir}
              disabled={!relatorio}
              className="btn-secondary"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Gerando relatório...</p>
          </div>
        )}

        {/* Relatório */}
        {relatorio && !loading && relatorio.tipo === "todas-lojas" && (
          <RelatorioTodasLojas relatorio={relatorio} />
        )}

        {relatorio && !loading && relatorio.tipo !== "todas-lojas" && (
          <div className="space-y-6">
            {/* Aviso de diferença de fichas */}
            {relatorio.avisoFichas && (
              <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded mb-4">
                <strong>Aviso:</strong> {relatorio.avisoFichas}
              </div>
            )}

            {/* Cards de Totais Gerais - Resumo Geral da Loja */}
            <div className="card bg-linear-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">📊</span>
                Resumo Geral da Loja
              </h3>
              <div className="flex flex-wrap gap-4 sm:gap-4">
                {/* Quantidade de Fichas + Valor das Fichas */}
                <div className="card bg-linear-to-br from-blue-400 to-blue-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎟️</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {dashboard?.totais
                      ? Number(dashboard.totais.fichas || 0).toLocaleString(
                          "pt-BR",
                        )
                      : Number(relatorio.totais?.fichas || 0).toLocaleString(
                          "pt-BR",
                        )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Quantidade de Fichas
                  </div>
                  <div className="text-2xl sm:text-3xl mb-2 mt-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      const totalFichas = relatorio.totais?.fichas || 0;
                      const valorFicha =
                        relatorio.loja?.valorFichaPadrao || 2.5;
                      return (totalFichas * valorFicha).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor das Fichas
                  </div>
                </div>

                {/* Valor Vindo da Trocadora */}
                <div className="flex flex-col card bg-linear-to-br from-yellow-500 to-orange-600 text-white items-center justify-center">
                  <div className="text-2xl sm:text-3xl mb-2">🏪</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(
                      Number(relatorio.totais?.valorDinheiroLoja || 0) +
                      Number(relatorio.totais?.valorCartaoPixLoja || 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor Vindo da Trocadora
                  </div>
                  <div className="flex gap-3 items-end mt-2">
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">💵</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorDinheiroLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Dinheiro
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">🟢</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorCartaoPixLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Cartão / Pix (Bruto)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Valor Bruto das Máquinas */}
                <div className="card bg-linear-to-br from-yellow-300 to-yellow-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      if (relatorio.totais?.valorBrutoMaquinas != null) {
                        return Number(
                          relatorio.totais.valorBrutoMaquinas,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                      }
                      let v = 0;
                      if (relatorio.maquinas?.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          v +=
                            Number(m.totais?.dinheiro || 0) +
                            Number(m.totais?.cartaoPix || 0);
                        });
                      }
                      return v.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor Bruto das Máquinas
                  </div>
                </div>

                {/* Bruto Consolidado */}
                <div className="card bg-linear-to-br from-yellow-500 to-orange-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💰</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      if (
                        relatorio.totais?.valorBrutoConsolidadoLojaMaquinas !=
                        null
                      ) {
                        return Number(
                          relatorio.totais.valorBrutoConsolidadoLojaMaquinas,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                      }
                      const valorTrocadora =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(relatorio.totais?.valorCartaoPixLoja || 0);
                      let brutoMaq = 0;
                      if (relatorio.maquinas?.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          brutoMaq +=
                            Number(m.totais?.dinheiro || 0) +
                            Number(m.totais?.cartaoPix || 0);
                        });
                      }
                      return (valorTrocadora + brutoMaq).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Bruto Consolidado (Loja + Máquinas)
                  </div>
                </div>

                {/* Taxa Média de Cartão */}
                <div className="card bg-linear-to-br from-pink-500 to-fuchsia-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💳</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {Number(
                      relatorio.totais?.percentualTaxaCartaoMedia || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    %
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Taxa Média de Cartão
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    R${" "}
                    {Number(relatorio.totais?.taxaDeCartao || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    em taxas de cartão no período
                  </div>
                </div>

                {/* Cartão/Pix Líquido */}
                <div className="card bg-linear-to-br from-cyan-500 to-blue-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">✅</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Cartão / Pix Líquido (Loja)
                  </div>
                  <div className="text-xl sm:text-2xl font-bold mt-4">
                    R${" "}
                    {(() => {
                      if (relatorio.totais?.valorLiquidoMaquinas != null) {
                        return Number(
                          relatorio.totais.valorLiquidoMaquinas,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                      }
                      let v = 0;
                      if (relatorio.maquinas?.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          v += Number(m.totais?.cartaoPixLiquido || 0);
                        });
                      }
                      return v.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Cartão / Pix Líquido (Máquinas)
                  </div>
                </div>

                {/* Produtos Entraram */}
                <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📥</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosEntraram || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Entraram
                  </div>
                </div>

                {/* Ticket por Prêmio (Total) */}
                <div className="card bg-linear-to-br from-indigo-500 to-indigo-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.ticketPorPremioTotal || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Ticket por Prêmio (Total)
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    Fórmula: Faturamento Bruto ÷ Produtos Saíram
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    {`R$ ${Number(relatorio.totais?.valorTotalLojaBruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${(relatorio.totais?.produtosSairam || 0).toLocaleString("pt-BR")} saídas`}
                  </div>
                </div>

                {/* Custo Total de Produtos + Produtos Saíram */}
                <div className="card bg-linear-to-br from-yellow-100 to-yellow-400 text-yellow-900 border-yellow-400 border-2">
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      let custo = 0;
                      if (relatorio.maquinas?.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          custo += Number(m.totais?.custoProdutosSairam || 0);
                        });
                      }
                      return custo.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Custo Total de Produtos
                  </div>
                  <div className="text-2xl sm:text-3xl mb-2 mt-3">📤</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosSairam || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Saíram
                  </div>
                </div>

                {/* Gastos Variáveis */}
                <div className="card bg-linear-to-br from-fuchsia-500 to-purple-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧾</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoVariavelTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gastos Variáveis
                  </div>
                </div>

                {/* Gastos Fixos da Loja (Detalhado) */}
                <div className="card bg-linear-to-br from-violet-500 to-purple-800 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🏷️</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(totalGastosFixosDaLoja || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 },
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gastos Fixos da Loja
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
                    {gastosFixosComValor.length > 0 ? (
                      gastosFixosComValor.map((gasto) => (
                        <div
                          key={`${gasto.id || gasto.nome}`}
                          className="truncate"
                        >
                          {gasto.nome}: R${" "}
                          {Number(gasto.valor || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      ))
                    ) : (
                      <div>Sem gastos fixos com valor maior que zero</div>
                    )}
                  </div>
                </div>

                {/* Gasto Total */}
                <div className="card bg-linear-to-br from-rose-500 to-red-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧮</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gasto Total
                  </div>
                </div>

                {/* Lucro Líquido */}
                <div className="card bg-linear-to-br from-emerald-600 to-green-800 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      if (
                        relatorio.totais?.valorLiquidoConsolidadoLojaMaquinas !=
                        null
                      ) {
                        const valorTrocadoraLiquido =
                          Number(relatorio.totais?.valorDinheiroLoja || 0) +
                          Number(
                            relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                          );
                        let dinheiroMaq = 0,
                          cartaoMaqLiq = 0;
                        if (relatorio.maquinas?.length > 0) {
                          relatorio.maquinas.forEach((m) => {
                            dinheiroMaq += Number(m.totais?.dinheiro || 0);
                            cartaoMaqLiq += Number(
                              m.totais?.cartaoPixLiquido || 0,
                            );
                          });
                        }
                        return Number(
                          relatorio.totais.valorLiquidoConsolidadoLojaMaquinas,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                      }
                      const valorTrocadoraLiquido =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(
                          relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                        );
                      let dinheiroMaq = 0,
                        cartaoMaqLiq = 0;
                      if (relatorio.maquinas?.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaq += Number(m.totais?.dinheiro || 0);
                          cartaoMaqLiq += Number(
                            m.totais?.cartaoPixLiquido || 0,
                          );
                        });
                      }
                      const receitaLiquida =
                        valorTrocadoraLiquido + dinheiroMaq + cartaoMaqLiq;
                      const gastoTotal = Number(
                        relatorio.totais?.gastoTotalPeriodo || 0,
                      );
                      return (receitaLiquida - gastoTotal).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Lucro Líquido
                  </div>
                </div>
              </div>
            </div>

            {/* Comparativo com Mês Passado */}
            {comparativoMensal && (
              <div className="card bg-linear-to-r from-slate-50 to-indigo-50 border-2 border-indigo-200">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">📈</span>
                  Comparativo com o Mês Passado (mesmos dias)
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 mb-4">
                  Atual:{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.inicio)}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.fim)} |
                  Mês passado:{" "}
                  {formatarDataExibicao(
                    comparativoMensal.periodoAnterior?.inicio,
                  )}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAnterior?.fim)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(comparativoMensal.metricas || []).map((metrica) => {
                    const indicador = metrica.indicador || {};
                    const classes = obterClassesStatusComparacao(
                      indicador.status,
                    );
                    const sinalPercentual =
                      indicador.percentual > 0.0001
                        ? "+"
                        : indicador.percentual < -0.0001
                          ? "-"
                          : "";
                    const sinalDiferenca =
                      indicador.diferenca > 0.0001
                        ? "+"
                        : indicador.diferenca < -0.0001
                          ? "-"
                          : "";
                    const textoStatus =
                      indicador.status === "melhor"
                        ? "Melhor"
                        : indicador.status === "pior"
                          ? "Pior"
                          : "Igual";
                    return (
                      <div
                        key={metrica.chave}
                        className={`rounded-xl border-2 p-4 ${classes.card}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                            {metrica.icone} {metrica.titulo}
                          </h4>
                          <span
                            className={`text-xs font-bold ${classes.texto}`}
                          >
                            {classes.icone} {textoStatus}
                          </span>
                        </div>
                        <p
                          className={`text-sm font-bold mt-2 ${classes.texto}`}
                        >
                          {sinalPercentual}
                          {formatarPercentualComparacao(
                            Math.abs(indicador.percentual || 0),
                          )}
                          %{" "}
                          {indicador.direcao === "igual"
                            ? "igual ao"
                            : `${indicador.direcao} do`}{" "}
                          mês passado
                        </p>
                        <p className="text-xs text-gray-700 mt-2">
                          Atual: R$ {formatarMoeda(indicador.atual)}
                        </p>
                        <p className="text-xs text-gray-700">
                          Mês passado: R$ {formatarMoeda(indicador.anterior)}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-1 ${classes.texto}`}
                        >
                          Diferença: {sinalDiferenca}R${" "}
                          {formatarMoeda(Math.abs(indicador.diferenca || 0))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!roteiroSelecionado && (
              <div className="card bg-linear-to-r from-indigo-50 to-violet-100 border-2 border-violet-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">🎯</span>
                    Aba de Ticket por Prêmio
                  </h3>
                  <div className="flex gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => setAbaTicketPremio("loja")}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                        abaTicketPremio === "loja"
                          ? "bg-violet-600 text-white"
                          : "bg-white text-violet-700 border border-violet-300"
                      }`}
                    >
                      Loja (Total)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaTicketPremio("maquinas")}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                        abaTicketPremio === "maquinas"
                          ? "bg-violet-600 text-white"
                          : "bg-white text-violet-700 border border-violet-300"
                      }`}
                    >
                      Máquinas
                    </button>
                  </div>
                </div>

                {abaTicketPremio === "loja"
                  ? (() => {
                      const faturamentoBruto = Number(
                        relatorio?.ticketPremio?.faturamentoBruto ||
                          relatorio?.totais?.faturamentoBrutoConsolidado ||
                          dashboard?.totais?.faturamento ||
                          0,
                      );
                      const saidasPremio = Number(
                        relatorio?.ticketPremio?.produtosSairam ||
                          relatorio?.totais?.saidasPremioTotal ||
                          relatorio?.totais?.produtosSairam ||
                          0,
                      );
                      const ticketPorPremio = Number(
                        relatorio?.ticketPremio?.ticketPorPremio ||
                          relatorio?.totais?.ticketPorPremioTotal ||
                          (saidasPremio > 0
                            ? faturamentoBruto / saidasPremio
                            : 0),
                      );

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-linear-to-br from-blue-500 to-indigo-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Faturamento Bruto
                            </div>
                            <div className="text-2xl font-bold mt-1">
                              R${" "}
                              {faturamentoBruto.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </div>

                          <div className="bg-linear-to-br from-red-500 to-rose-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Produtos Saíram
                            </div>
                            <div className="text-2xl font-bold mt-1">
                              {saidasPremio.toLocaleString("pt-BR")}
                            </div>
                          </div>

                          <div className="bg-linear-to-br from-violet-500 to-indigo-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Ticket por Prêmio (Total)
                            </div>
                            <div className="text-3xl font-black mt-1">
                              R${" "}
                              {ticketPorPremio.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs opacity-90 mt-2">
                              Fórmula: Faturamento Bruto ÷ Produtos Saíram
                            </div>
                            <div className="text-xs opacity-90 mt-1">
                              R${" "}
                              {faturamentoBruto.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              / {saidasPremio.toLocaleString("pt-BR")} saídas
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  : (() => {
                      const linhas = (
                        relatorio?.ticketPremioMaquinas ||
                        relatorio?.maquinas?.map((item) => ({
                          maquinaId: item?.maquina?.id,
                          maquinaNome: item?.maquina?.nome,
                          maquinaCodigo: item?.maquina?.codigo,
                          faturamentoBruto:
                            Number(item?.totais?.faturamentoBruto || 0) ||
                            Number(item?.totais?.dinheiro || 0) +
                              Number(item?.totais?.cartaoPix || 0),
                          produtosSairam: Number(
                            item?.totais?.produtosSairam || 0,
                          ),
                          ticketPorPremio:
                            Number(item?.totais?.ticketPorPremio || 0) ||
                            (Number(item?.totais?.produtosSairam || 0) > 0
                              ? (Number(item?.totais?.faturamentoBruto || 0) ||
                                  Number(item?.totais?.dinheiro || 0) +
                                    Number(item?.totais?.cartaoPix || 0)) /
                                Number(item?.totais?.produtosSairam || 0)
                              : 0),
                        })) ||
                        []
                      ).sort(
                        (a, b) =>
                          Number(b?.ticketPorPremio || 0) -
                          Number(a?.ticketPorPremio || 0),
                      );

                      if (!linhas.length) {
                        return (
                          <div className="text-center py-6 text-gray-600">
                            Nenhuma máquina com dados para Ticket por Prêmio.
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white rounded-xl overflow-hidden border border-violet-200">
                            <thead className="bg-violet-100 text-violet-900">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-bold">
                                  Máquina
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Faturamento Bruto
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Produtos Saíram
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Ticket/Prêmio
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {linhas.map((linha) => (
                                <tr
                                  key={
                                    linha.maquinaId ||
                                    `${linha.maquinaNome}-${linha.maquinaCodigo}`
                                  }
                                  className="border-t border-violet-100"
                                >
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                    {linha.maquinaNome || "Máquina"}
                                    {linha.maquinaCodigo
                                      ? ` (${linha.maquinaCodigo})`
                                      : ""}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-800">
                                    R${" "}
                                    {Number(
                                      linha.faturamentoBruto || 0,
                                    ).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-800">
                                    {Number(
                                      linha.produtosSairam || 0,
                                    ).toLocaleString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-bold text-violet-700">
                                    R${" "}
                                    {Number(
                                      linha.ticketPorPremio || 0,
                                    ).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
              </div>
            )}

            {/* Detalhamento por máquina */}
            {relatorio.maquinas && relatorio.maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-linear-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <span className="text-3xl sm:text-4xl">🎰</span>
                    <span className="wrap-break-word">
                      RELATÓRIO DETALHADO POR MÁQUINA
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm opacity-90 mt-2">
                    Visualize abaixo as informações detalhadas de cada máquina
                    desta loja no período selecionado
                  </p>
                </div>

                {relatorio.maquinas.map((maquina, index) => (
                  <div
                    key={maquina.maquina.id}
                    className="card border-4 border-indigo-300 shadow-2xl page-break-before"
                  >
                    {/* Header da Máquina com destaque */}
                    <div className="bg-linear-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                            🎰 {maquina.maquina.nome || `Máquina ${index + 1}`}
                          </h3>
                          <p className="text-sm sm:text-lg opacity-90">
                            📋 Código:{" "}
                            <span className="font-mono font-bold">
                              {maquina.maquina.codigo}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg">
                            <div className="text-xs sm:text-sm opacity-90">
                              Máquina
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {index + 1}/{relatorio.maquinas.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totais da Máquina em destaque */}
                    <div className="mb-4 sm:mb-6">
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">📊</span>
                        <span className="text-sm sm:text-base">
                          Resumo de Movimentações desta Máquina
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-4 sm:gap-6">
                        {/* Fichas da máquina */}
                        <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎫
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {Number(maquina.totais.fichas || 0).toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Fichas
                          </div>
                        </div>
                        {/* Dinheiro máquina */}
                        <div className="bg-linear-to-br from-yellow-400 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💵
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.dinheiro || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Dinheiro
                          </div>
                        </div>
                        {/* Cartão/Pix Bruto + Líquido */}
                        <div className="bg-linear-to-br from-cyan-400 to-cyan-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟢
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.cartaoPix || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Cartão / Pix (Bruto)
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 opacity-90 font-semibold">
                            R${" "}
                            {Number(
                              maquina.totais.cartaoPixLiquido || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[10px] sm:text-xs text-center opacity-80">
                            Líquido
                          </div>
                        </div>
                        {/* Produtos Saíram */}
                        <div className="bg-linear-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📤
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {Number(
                              maquina.totais.produtosSairam || 0,
                            ).toLocaleString("pt-BR")}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        {/* Produtos Entraram */}
                        <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📥
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {Number(
                              maquina.totais.produtosEntraram || 0,
                            ).toLocaleString("pt-BR")}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Entraram
                          </div>
                        </div>
                        {/* Movimentações */}
                        <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🔄
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.movimentacoes || 0}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Movimentações
                          </div>
                        </div>
                        {/* Custo dos produtos que saíram */}
                        <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            ➖💸
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.custoProdutosSairam || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Custo dos Produtos que Saíram
                          </div>
                        </div>
                        {/* Lucro da Máquina */}
                        <div className="bg-linear-to-br from-yellow-500 to-orange-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💰
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const fichas = Number(maquina.totais.fichas || 0);
                              const valorFicha = Number(
                                maquina.maquina?.valorFicha ||
                                  relatorio.loja?.valorFichaPadrao ||
                                  2.5,
                              );
                              return (fichas * valorFicha).toLocaleString(
                                "pt-BR",
                                { minimumFractionDigits: 2 },
                              );
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro da Máquina
                          </div>
                        </div>
                        {/* Lucro Líquido da Máquina */}
                        <div className="bg-linear-to-br from-green-700 to-green-400 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟩
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.lucroLiquido || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro Líquido da Máquina
                          </div>
                        </div>
                        {/* Ticket por Prêmio */}
                        <div className="bg-linear-to-br from-indigo-600 to-blue-700 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎯
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.ticketPorPremio || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Ticket por Prêmio
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            Faturamento Bruto ÷ Produtos Saíram
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            {`R$ ${Number(maquina.totais.faturamentoBruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${Number(maquina.totais.produtosSairam || 0).toLocaleString("pt-BR")} saídas`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Produtos da Máquina */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Produtos que Saíram */}
                      <div className="bg-red-50 p-3 sm:p-5 rounded-xl border-2 border-red-200">
                        <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-red-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📤</span>
                          <span className="text-sm sm:text-base">
                            Produtos que SAÍRAM
                          </span>
                          <span className="ml-auto bg-white text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosSairam}
                          </span>
                        </h4>
                        {maquina.produtosSairam &&
                        maquina.produtosSairam.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosSairam
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-red-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                        {/* Custo unitário e total do produto */}
                                        {produto.custoUnitario !== undefined &&
                                          Number(produto.custoUnitario) > 0 && (
                                            <div className="text-xs text-gray-700 mt-1">
                                              💲 Custo unitário: R${" "}
                                              {Number(
                                                produto.custoUnitario,
                                              ).toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2,
                                              })}{" "}
                                              | Custo total:{" "}
                                              <span className="font-bold">
                                                R${" "}
                                                {(
                                                  Number(
                                                    produto.custoUnitario,
                                                  ) *
                                                  Number(
                                                    produto.quantidade || 0,
                                                  )
                                                ).toLocaleString("pt-BR", {
                                                  minimumFractionDigits: 2,
                                                })}
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    <div className="bg-red-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg">
                            <p className="text-6xl mb-2">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto saiu
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Produtos que Entraram */}
                      <div className="bg-green-50 p-3 sm:p-5 rounded-xl border-2 border-green-200">
                        <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-green-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📥</span>
                          <span className="text-sm sm:text-base">
                            Produtos que ENTRARAM
                          </span>
                          <span className="ml-auto bg-white text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosEntraram}
                          </span>
                        </h4>
                        {maquina.produtosEntraram &&
                        maquina.produtosEntraram.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosEntraram
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-green-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-green-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                            <p className="text-4xl sm:text-6xl mb-2">📭</p>
                            <p className="text-sm sm:text-base text-gray-500 font-medium">
                              Nenhum produto entrou
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separador entre máquinas */}
                    {index < relatorio.maquinas.length - 1 && (
                      <div className="mt-8 pt-6 border-t-4 border-dashed border-gray-300">
                        <p className="text-center text-gray-500 text-sm font-medium">
                          ⬇️ Próxima Máquina ⬇️
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Gráfico de saída por máquina */}
            {relatorio.graficoSaidaPorMaquina &&
              relatorio.graficoSaidaPorMaquina.length > 0 && (
                <div className="card bg-linear-to-r from-blue-50 to-blue-100 border-2 border-blue-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    Gráfico: Saída de Produtos por Máquina
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    {(() => {
                      const maxSairam = Math.max(
                        ...relatorio.graficoSaidaPorMaquina.map(
                          (i) => i.produtosSairam,
                        ),
                        1,
                      );
                      const MAX_BAR_HEIGHT = 200;
                      return relatorio.graficoSaidaPorMaquina.map((item) => {
                        const barHeight = Math.max(
                          (item.produtosSairam / maxSairam) * MAX_BAR_HEIGHT,
                          4,
                        );
                        return (
                          <div
                            key={item.maquina}
                            className="flex flex-col items-center"
                          >
                            <div className="font-bold text-lg text-blue-700">
                              {item.maquina}
                            </div>
                            <div
                              className="w-12 flex items-end"
                              style={{ height: MAX_BAR_HEIGHT }}
                            >
                              <div
                                style={{
                                  height: `${barHeight}px`,
                                  background: "#1976d2",
                                  width: "100%",
                                  borderRadius: 4,
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.produtosSairam} saíram
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            {/* Gráfico de saída por produto */}
            {relatorio.graficoSaidaPorProduto &&
              relatorio.graficoSaidaPorProduto.length > 0 && (
                <div className="card bg-linear-to-r from-green-50 to-green-100 border-2 border-green-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📦</span>
                    Gráfico: Saída de Produtos por Tipo
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    {(() => {
                      const maxQtd = Math.max(
                        ...relatorio.graficoSaidaPorProduto.map(
                          (i) => i.quantidade,
                        ),
                        1,
                      );
                      const MAX_BAR_HEIGHT = 200;
                      return relatorio.graficoSaidaPorProduto.map((item) => {
                        const barHeight = Math.max(
                          (item.quantidade / maxQtd) * MAX_BAR_HEIGHT,
                          4,
                        );
                        return (
                          <div
                            key={item.produto}
                            className="flex flex-col items-center"
                          >
                            <div className="font-bold text-lg text-green-700">
                              {item.produto}
                            </div>
                            <div
                              className="w-12 flex items-end"
                              style={{ height: MAX_BAR_HEIGHT }}
                            >
                              <div
                                style={{
                                  height: `${barHeight}px`,
                                  background: "#43a047",
                                  width: "100%",
                                  borderRadius: 4,
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.quantidade} saíram
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            {/* Consolidado Geral de Produtos */}
            <div className="card bg-linear-to-r from-amber-50 to-orange-100 border-2 border-orange-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Consolidado Geral de Produtos
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Resumo de todos os produtos (todas as máquinas somadas)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos que Saíram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📤</span>
                    Produtos que Saíram (Total Geral)
                  </h4>
                  {relatorio.produtosSairam &&
                  relatorio.produtosSairam.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosSairam
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-red-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto saiu</p>
                    </div>
                  )}
                </div>

                {/* Produtos que Entraram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📥</span>
                    Produtos que Entraram (Total Geral)
                  </h4>
                  {relatorio.produtosEntraram &&
                  relatorio.produtosEntraram.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosEntraram
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto entrou</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dias sem movimentação por loja (roteiro) */}
            {relatorio && relatorio.lojas && roteiroSelecionado && (
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4">
                  Dias sem movimentação por loja
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-xs">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border px-2 py-1">Loja</th>
                        <th className="border px-2 py-1">
                          Dias sem movimentação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.lojas.map((loja, idx) => (
                        <tr key={loja.id || loja.nome || idx}>
                          <td className="border px-2 py-1 font-semibold">
                            {loja.nome || `Loja ${idx + 1}`}
                          </td>
                          <td className="border px-2 py-1">
                            {loja.diasSemMovimentacao &&
                            loja.diasSemMovimentacao.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {loja.diasSemMovimentacao.map((dia, i) => (
                                  <span
                                    key={dia + "-" + i}
                                    className="bg-red-200 text-red-800 rounded px-2 py-0.5 text-xs font-bold"
                                  >
                                    {dia}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="bg-green-100 text-green-800 rounded px-2 py-0.5 text-xs">
                                Sem dias sem movimentação
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado Vazio */}
        {!relatorio && !loading && !error && (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-600 text-lg">
              Selecione uma loja e o período para gerar o relatório
            </p>
          </div>
        )}
      </div>

      <Footer />

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          .no-print, nav, footer {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-linear-to-br, .bg-linear-to-r {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600,
          .from-indigo-500, .to-indigo-500 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-blue-50, .bg-red-50, .bg-green-50, .bg-purple-50, .bg-gray-50 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .border-blue-200, .border-red-200, .border-green-200, .border-purple-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

export default Relatorios;
// Fim do componente Relatorios
