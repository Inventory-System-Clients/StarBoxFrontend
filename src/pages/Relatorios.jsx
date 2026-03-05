import { useState, useEffect } from "react";
import api from "../services/api";
import { buscarRoteiros, buscarRelatorioRoteiroPeriodo } from "../services/roteiros";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

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
  const [error, setError] = useState("");

  // Buscar lista de lojas
  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data);
    } catch (error) {
      setError("Erro ao carregar lojas: " + (error.response?.data?.error || error.message));
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
    buscarRoteiros().then(setRoteiros).catch(() => setRoteiros([]));
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
      if (roteiroSelecionado) {
        // Buscar relatório de roteiro inteiro
        const response = await api.get("/relatorios/roteiro", {
          params: { roteiroId: roteiroSelecionado, dataInicio, dataFim },
        });
        setRelatorio({ tipo: "roteiro", ...response.data });
      } else if (lojaSelecionada) {
        // Buscar relatório de loja + dashboard + comissão + produtos em paralelo
        const [impressaoRes, comissaoRes, lucroRes, movRes, produtosRes] = await Promise.all([
          api.get("/relatorios/impressao", {
            params: { lojaId: lojaSelecionada, dataInicio, dataFim },
          }),
          api.get("/movimentacoes/relatorio/comissao-dia", {
            params: { lojaId: lojaSelecionada, data: dataFim },
          }).catch(() => ({ data: null })),
          api.get("/movimentacoes/relatorio/lucro-dia", {
            params: { lojaId: lojaSelecionada, data: dataFim },
          }).catch(err => { console.error('Erro lucro-dia:', err.response?.data || err.message); return { data: null }; }),
          api.get("/movimentacoes/relatorio/movimentacoes-dia", {
            params: { lojaId: lojaSelecionada, data: dataFim },
          }).catch(() => ({ data: null })),
          api.get("/produtos").catch(() => ({ data: [] })),
        ]);
        // Também carregar dashboard
        await carregarDashboard(lojaSelecionada, dataInicio, dataFim);
        
        // Criar mapa de preços dos produtos (id -> {preco, custoUnitario})
        const produtosMap = {};
        const produtosList = Array.isArray(produtosRes.data) ? produtosRes.data : (produtosRes.data?.produtos || produtosRes.data?.rows || []);
        produtosList.forEach(p => {
          produtosMap[p.id] = {
            nome: p.nome || '',
            preco: Number(p.preco || 0),
            custoUnitario: Number(p.custoUnitario || 0),
          };
        });
        setProdutosPrecos(produtosMap);
        
        // Enriquecer produtosSairam com preços dos produtos
        const dados = impressaoRes.data;
        if (dados.produtosSairam) {
          dados.produtosSairam = dados.produtosSairam.map(p => ({
            ...p,
            preco: p.preco || produtosMap[p.id]?.preco || 0,
            custoUnitario: p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
            valorUnitario: p.preco || p.valorUnitario || p.custoUnitario || produtosMap[p.id]?.preco || produtosMap[p.id]?.custoUnitario || 0,
          }));
        }
        if (dados.maquinas) {
          dados.maquinas = dados.maquinas.map(m => ({
            ...m,
            produtosSairam: m.produtosSairam?.map(p => ({
              ...p,
              preco: p.preco || produtosMap[p.id]?.preco || 0,
              custoUnitario: p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
              valorUnitario: p.preco || p.valorUnitario || p.custoUnitario || produtosMap[p.id]?.preco || produtosMap[p.id]?.custoUnitario || 0,
            })) || [],
          }));
        }
        
        setRelatorio(dados);
        // DEBUG: ver campos dos produtos
        console.log('produtosSairam consolidado (enriquecido):', dados?.produtosSairam);
        if (dados?.maquinas?.[0]?.produtosSairam) {
          console.log('produtosSairam máquina[0] (enriquecido):', dados.maquinas[0].produtosSairam);
        }
        console.log('produtosMap (preços):', produtosMap);
        console.log('lucroData:', lucroRes.data);
        setComissaoData(comissaoRes.data);
        setLucroData(lucroRes.data);
        // Agregar movimentações por máquina (dinheiro, cartão/pix)
        if (movRes.data) {
          const movs = Array.isArray(movRes.data) ? movRes.data : (movRes.data.movimentacoes || []);
          const porMaquina = {};
          movs.forEach(mov => {
            const mId = mov.maquinaId;
            if (!porMaquina[mId]) porMaquina[mId] = { dinheiro: 0, pixCartao: 0 };
            porMaquina[mId].dinheiro += Number(mov.quantidade_notas_entrada || 0);
            porMaquina[mId].pixCartao += Number(mov.valor_entrada_maquininha_pix || 0);
          });
          setMovimentacoesData(porMaquina);
        }
      }
    } catch (error) {
      let errorMessage = "Erro ao gerar relatório. Tente novamente.";
      if (error.response?.status === 404) {
        errorMessage = "⚠️ Endpoint não encontrado. O servidor pode estar atualizando. Aguarde alguns minutos e tente novamente.";
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
              <label className="block text-sm font-medium text-gray-700 mb-2">🗂️ Roteiro</label>
              <select
                value={roteiroSelecionado}
                onChange={e => {
                  setRoteiroSelecionado(e.target.value);
                  setLojaSelecionada("");
                }}
                className="input-field w-full"
              >
                <option value="">Selecione um roteiro (opcional)</option>
                {roteiros.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">🏪 Loja</label>
              <select
                value={lojaSelecionada}
                onChange={e => {
                  setLojaSelecionada(e.target.value);
                  setRoteiroSelecionado("");
                }}
                className="input-field w-full"
                disabled={!!roteiroSelecionado}
              >
                <option value="">Selecione uma loja</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>{loja.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data Inicial *</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data Final *</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
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
        {relatorio && !loading && (
          <div className="space-y-6">
            {/* Cards de Totais Gerais - endpoint lucro-dia (fallback: dashboard) */}
            {(lucroData || dashboard) && (
              <div className="card bg-linear-to-r from-purple-50 to-purple-100 border-2 border-purple-300 mb-8">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">📊</span>
                  Resumo Geral da Loja
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Dinheiro + Cartão/Pix */}
                  <div className="card bg-linear-to-br from-cyan-400 to-green-600 text-white relative">
                    <div className="text-2xl sm:text-3xl mb-2">💵💳</div>
                    <div className="text-2xl sm:text-3xl font-bold">
                      R$ {Number(lucroData?.receitaBruta || dashboard?.totais?.faturamento || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs sm:text-sm opacity-90">
                      <span className="bg-white/30 rounded px-2 py-0.5">Dinheiro: R$ {Number(lucroData?.detalhesReceita?.dinheiro || dashboard?.totais?.dinheiro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span className="bg-white/30 rounded px-2 py-0.5">Cartão/Pix: R$ {Number(lucroData?.detalhesReceita?.pixCartao || dashboard?.totais?.pix || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-xs sm:text-sm opacity-80 mt-1">Total recebido em dinheiro, cartão e pix</div>
                  </div>
                  {/* Produtos que saíram (valor total) */}
                  <div className="card bg-linear-to-br from-red-500 to-red-600 text-white relative">
                    <div className="text-2xl sm:text-3xl mb-2">📤</div>
                    {(() => {
                      const getPreco = (p) => Number(p.preco || p.valorUnitario || p.custoUnitario || p.valor || 0);

                      // Total saíram: soma authoritative dos totais de cada máquina
                      const totalSairam = relatorio.maquinas?.reduce(
                        (acc, m) => acc + (Number(m.totais?.produtosSairam) || 0), 0
                      ) || 0;

                      // Agregar todos os produtos que saíram com preço para calcular preço médio ponderado
                      const mapaAgregado = {};
                      const fontes = [
                        ...(relatorio.produtosSairam || []),
                        ...(relatorio.maquinas?.flatMap(m => m.produtosSairam || []) || []),
                      ];
                      fontes.forEach(p => {
                        const key = p.id || p.nome;
                        if (!key) return;
                        if (!mapaAgregado[key]) mapaAgregado[key] = { ...p, quantidade: 0 };
                        mapaAgregado[key].quantidade += Number(p.quantidade) || 0;
                      });
                      // Fallback: se nenhum produto encontrado nas listas, usar produtosPrecos (mapa de /produtos)
                      let produtosAgregados = Object.values(mapaAgregado);
                      if (produtosAgregados.length === 0) {
                        produtosAgregados = Object.entries(produtosPrecos).map(([id, p]) => ({
                          id,
                          nome: p.nome || id,
                          preco: p.preco,
                          custoUnitario: p.custoUnitario,
                          quantidade: 0,
                        }));
                      }

                      // Preço médio ponderado: Σ(qty × preco) / Σ(qty)
                      // Se qtd não disponível: 1 produto → preço direto; N produtos → média simples
                      const somaQty = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0), 0);
                      const somaValor = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0) * getPreco(p), 0);
                      let precoMedio = 0;
                      if (somaQty > 0) {
                        precoMedio = somaValor / somaQty;
                      } else if (produtosAgregados.length === 1) {
                        precoMedio = getPreco(produtosAgregados[0]);
                      } else if (produtosAgregados.length > 1) {
                        precoMedio = produtosAgregados.reduce((s, p) => s + getPreco(p), 0) / produtosAgregados.length;
                      }

                      const totalValor = totalSairam * precoMedio;

                      return (
                        <>
                          <div className="text-2xl sm:text-3xl font-bold">
                            R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2 text-xs opacity-90">
                            <span className="bg-white/30 rounded px-2 py-0.5">
                              {totalSairam} unid. × R$ {precoMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (preço médio)
                            </span>
                          </div>
                          {produtosAgregados.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 text-xs opacity-80">
                              {produtosAgregados.map(p => (
                                <span key={p.id || p.nome} className="bg-white/20 rounded px-2 py-0.5">
                                  {p.nome}: R$ {getPreco(p).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs sm:text-sm opacity-80 mt-1">Valor total dos produtos que saíram (gasto)</div>
                        </>
                      );
                    })()}
                  </div>
                </div>


                {/* Lucro - Custo: resumo simples */}
                <div className="mt-8 space-y-4">
                  {(() => {
                    const receita = Number(dashboard?.totais?.faturamento || lucroData?.receitaBruta || 0);
                    // Custo produtos = totalSairam × preço médio (mesma lógica do card acima)
                    const getPreco = (p) => Number(p.preco || p.valorUnitario || p.custoUnitario || 0);
                    const totalSairam = relatorio.maquinas?.reduce(
                      (acc, m) => acc + (Number(m.totais?.produtosSairam) || 0), 0
                    ) || 0;
                    const fontes = [
                      ...(relatorio.produtosSairam || []),
                      ...(relatorio.maquinas?.flatMap(m => m.produtosSairam || []) || []),
                    ];
                    const mapaAgregado = {};
                    fontes.forEach(p => {
                      const key = p.id || p.nome;
                      if (!key) return;
                      if (!mapaAgregado[key]) mapaAgregado[key] = { ...p, quantidade: 0 };
                      mapaAgregado[key].quantidade += Number(p.quantidade) || 0;
                    });
                    let produtosAgregados = Object.values(mapaAgregado);
                    if (produtosAgregados.length === 0) {
                      produtosAgregados = Object.entries(produtosPrecos).map(([id, p]) => ({
                        id, nome: p.nome || id, preco: p.preco, custoUnitario: p.custoUnitario, quantidade: 0,
                      }));
                    }
                    const somaQty = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0), 0);
                    const somaValor = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0) * getPreco(p), 0);
                    let precoMedio = 0;
                    if (somaQty > 0) precoMedio = somaValor / somaQty;
                    else if (produtosAgregados.length === 1) precoMedio = getPreco(produtosAgregados[0]);
                    else if (produtosAgregados.length > 1) precoMedio = produtosAgregados.reduce((s, p) => s + getPreco(p), 0) / produtosAgregados.length;
                    const custoProdutos = totalSairam * precoMedio;
                    const custosAdicionais = typeof relatorio._custos === 'number' ? relatorio._custos : 0;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/80 rounded-xl p-3 text-center border border-purple-200">
                          <div className="text-lg font-bold text-green-700">R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-600 mt-0.5">💰 Receita Bruta</div>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 text-center border border-purple-200">
                          <div className="text-lg font-bold text-red-600">− R$ {custoProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-600 mt-0.5">🧸 Custo Produtos</div>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 text-center border border-purple-200">
                          <div className="text-lg font-bold text-red-600">− R$ {custosAdicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-600 mt-0.5">📋 Fixos / Variáveis</div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Custos adicionais manuais */}
                    <div className="card bg-linear-to-br from-gray-100 to-gray-300 text-gray-900 flex flex-col justify-between">
                      <label className="font-bold mb-2">Custos Adicionais (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={typeof relatorio._custos === 'number' ? relatorio._custos : ''}
                        onChange={e => {
                          const valor = parseFloat(e.target.value) || 0;
                          setRelatorio(prev => ({ ...prev, _custos: valor }));
                        }}
                        className="input-field w-full text-lg font-bold"
                        placeholder="Ex.: aluguel, luz, etc."
                      />
                      <span className="text-xs text-gray-600 mt-1">Custos extras não incluídos no sistema (subtraídos do lucro abaixo)</span>
                    </div>

                    {/* Lucro líquido final */}
                    <div className="card bg-linear-to-br from-yellow-500 to-orange-600 text-white flex flex-col justify-between">
                      <div className="text-2xl sm:text-3xl mb-2">💰</div>
                      <div className="text-2xl sm:text-3xl font-bold">
                        {(() => {
                          // Receita = dinheiro + cartão/pix
                          const receita = Number(dashboard?.totais?.faturamento || lucroData?.receitaBruta || 0);

                          // Custo produtos = totalSairam × preço médio (mesma lógica do card acima)
                          const getPreco = (p) => Number(p.preco || p.valorUnitario || p.custoUnitario || 0);
                          const totalSairam = relatorio.maquinas?.reduce(
                            (acc, m) => acc + (Number(m.totais?.produtosSairam) || 0), 0
                          ) || 0;
                          const fontes = [
                            ...(relatorio.produtosSairam || []),
                            ...(relatorio.maquinas?.flatMap(m => m.produtosSairam || []) || []),
                          ];
                          const mapaAgregado = {};
                          fontes.forEach(p => {
                            const key = p.id || p.nome;
                            if (!key) return;
                            if (!mapaAgregado[key]) mapaAgregado[key] = { ...p, quantidade: 0 };
                            mapaAgregado[key].quantidade += Number(p.quantidade) || 0;
                          });
                          let produtosAgregados = Object.values(mapaAgregado);
                          if (produtosAgregados.length === 0) {
                            produtosAgregados = Object.entries(produtosPrecos).map(([id, p]) => ({
                              id, nome: p.nome || id, preco: p.preco, custoUnitario: p.custoUnitario, quantidade: 0,
                            }));
                          }
                          const somaQty = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0), 0);
                          const somaValor = produtosAgregados.reduce((s, p) => s + (Number(p.quantidade) || 0) * getPreco(p), 0);
                          let precoMedio = 0;
                          if (somaQty > 0) precoMedio = somaValor / somaQty;
                          else if (produtosAgregados.length === 1) precoMedio = getPreco(produtosAgregados[0]);
                          else if (produtosAgregados.length > 1) precoMedio = produtosAgregados.reduce((s, p) => s + getPreco(p), 0) / produtosAgregados.length;

                          const custoProdutos = totalSairam * precoMedio;
                          const custosExtra = typeof relatorio._custos === 'number' ? relatorio._custos : 0;
                          const lucroFinal = receita - custoProdutos - custosExtra;
                          return (
                            <>
                              <span>Lucro Líquido: </span>
                              <span className={lucroFinal >= 0 ? 'text-white' : 'text-red-200'}>
                                R$ {lucroFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-xs sm:text-sm opacity-80 mt-2">
                        <div>= receita − custo produtos − fixos/variáveis</div>
                      </div>
                    </div>
                  </div>
                </div>
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                        {/* Dinheiro máquina */}
                        <div className="bg-linear-to-br from-yellow-400 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💵
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const fromImpressao = Number(maquina.totais.dinheiro || 0);
                              if (fromImpressao > 0) return fromImpressao.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                              // Fallback: dashboard.performanceMaquinas (soma de quantidade_notas_entrada por máquina)
                              const perf = dashboard?.performanceMaquinas?.find(p => p.nome === maquina.maquina.nome);
                              return Number(perf?.dinheiro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Dinheiro
                          </div>
                        </div>
                        {/* Cartão/Pix máquina */}
                        <div className="bg-linear-to-br from-cyan-400 to-cyan-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟢
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const fromImpressao = Number(maquina.totais.cartaoPix || 0);
                              if (fromImpressao > 0) return fromImpressao.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                              // Fallback: dashboard.performanceMaquinas (soma de valor_entrada_maquininha_pix por máquina)
                              const perf = dashboard?.performanceMaquinas?.find(p => p.nome === maquina.maquina.nome);
                              return Number(perf?.pix || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Cartão / Pix
                          </div>
                        </div>
                        {/* Produtos que saíram */}
                        <div className="bg-linear-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📤
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosSairam.toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        {/* Produtos que entraram */}
                        <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📥
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosEntraram.toLocaleString(
                              "pt-BR",
                            )}
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
                            {maquina.totais.movimentacoes}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Movimentações
                          </div>
                        </div>
                        {/* Lucro da máquina */}
                        <div className="bg-linear-to-br from-yellow-500 to-orange-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💰
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              // Buscar receita real da máquina via comissaoData
                              const det = comissaoData?.detalhesPorMaquina?.find(d => d.maquinaId === maquina.maquina.id);
                              if (det) {
                                const receita = Number(det.receitaTotal || 0);
                                const comissao = Number(det.comissaoTotal || 0);
                                return (receita - comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                              }
                              return Number(0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro da Máquina
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
                        const maxSairam = Math.max(...relatorio.graficoSaidaPorMaquina.map(i => i.produtosSairam), 1);
                        const MAX_BAR_HEIGHT = 200;
                        return relatorio.graficoSaidaPorMaquina.map((item) => {
                          const barHeight = Math.max((item.produtosSairam / maxSairam) * MAX_BAR_HEIGHT, 4);
                          return (
                            <div
                              key={item.maquina}
                              className="flex flex-col items-center"
                            >
                              <div className="font-bold text-lg text-blue-700">
                                {item.maquina}
                              </div>
                              <div className="w-12 flex items-end" style={{ height: MAX_BAR_HEIGHT }}>
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
                        const maxQtd = Math.max(...relatorio.graficoSaidaPorProduto.map(i => i.quantidade), 1);
                        const MAX_BAR_HEIGHT = 200;
                        return relatorio.graficoSaidaPorProduto.map((item) => {
                          const barHeight = Math.max((item.quantidade / maxQtd) * MAX_BAR_HEIGHT, 4);
                          return (
                            <div
                              key={item.produto}
                              className="flex flex-col items-center"
                            >
                              <div className="font-bold text-lg text-green-700">
                                {item.produto}
                              </div>
                              <div className="w-12 flex items-end" style={{ height: MAX_BAR_HEIGHT }}>
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
                <h3 className="text-lg font-bold mb-4">Dias sem movimentação por loja</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-xs">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border px-2 py-1">Loja</th>
                        <th className="border px-2 py-1">Dias sem movimentação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.lojas.map((loja, idx) => (
                        <tr key={loja.id || loja.nome || idx}>
                          <td className="border px-2 py-1 font-semibold">{loja.nome || `Loja ${idx + 1}`}</td>
                          <td className="border px-2 py-1">
                            {loja.diasSemMovimentacao && loja.diasSemMovimentacao.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {loja.diasSemMovimentacao.map((dia, i) => (
                                  <span key={dia + '-' + i} className="bg-red-200 text-red-800 rounded px-2 py-0.5 text-xs font-bold">
                                    {dia}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="bg-green-100 text-green-800 rounded px-2 py-0.5 text-xs">Sem dias sem movimentação</span>
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
