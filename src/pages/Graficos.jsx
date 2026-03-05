import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts";

export function Graficos() {
  const [loading, setLoading] = useState(true);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dadosDashboard, setDadosDashboard] = useState(null);
  const [erro, setErro] = useState("");
  const [custosExtras, setCustosExtras] = useState(0);
  const [produtosPrecos, setProdutosPrecos] = useState({});

  // Faturamento real — usa o valor que o backend calcula diretamente
  const faturamentoReal = useMemo(() => {
    if (!dadosDashboard?.totais) return 0;
    return parseFloat(dadosDashboard.totais.faturamento || 0);
  }, [dadosDashboard]);

  // Custo produtos saídos = totais.saidas × preço médio dos produtos
  const custoProdutos = useMemo(() => {
    const totalSairam = parseInt(dadosDashboard?.totais?.saidas || 0);
    if (totalSairam === 0) return 0;
    const lista = Object.values(produtosPrecos);
    if (lista.length === 0) return 0;
    const getPreco = (p) => Number(p.preco || p.custoUnitario || 0);
    const somaPrecos = lista.reduce((s, p) => s + getPreco(p), 0);
    const precoMedio = somaPrecos / lista.length;
    return totalSairam * precoMedio;
  }, [dadosDashboard, produtosPrecos]);

  // Custo total = produtos saídos + custos fixos/variáveis digitados pelo usuário
  const custoTotal = useMemo(() => {
    return custoProdutos + custosExtras;
  }, [custoProdutos, custosExtras]);

  // Lucro Líquido = faturamento − custo produtos (saidas × preço médio) − fixos/variáveis digitados
  const lucroTotal = useMemo(() => {
    return faturamentoReal - custoProdutos - custosExtras;
  }, [faturamentoReal, custoProdutos, custosExtras]);

  // Dados do gráfico com custos extras incorporados (NUNCA altera faturamento) + lucro por dia
  const graficoComCustosExtras = useMemo(() => {
    if (!dadosDashboard?.graficoFinanceiro || dadosDashboard.graficoFinanceiro.length === 0) return [];
    if (custosExtras <= 0) {
      // Calcular lucro = faturamento - custo por dia
      return dadosDashboard.graficoFinanceiro.map(d => {
        const fatDia = parseFloat(d.faturamento) || 0;
        const custoDia = parseFloat(d.custo) || 0;
        return { ...d, lucro: Math.max(0, fatDia - custoDia) };
      });
    }
    // Adicionar custos extras distribuídos proporcionalmente, preservando faturamento
    const totalFat = dadosDashboard.graficoFinanceiro.reduce((s, d) => s + (parseFloat(d.faturamento) || 0), 0);
    return dadosDashboard.graficoFinanceiro.map(d => {
      const fatDia = parseFloat(d.faturamento) || 0;
      const proporcao = totalFat > 0 ? (fatDia / totalFat) : (1 / dadosDashboard.graficoFinanceiro.length);
      // IMPORTANTE: Preservar faturamento explicitamente ao somar custosExtras ao custo
      const custoDia = (parseFloat(d.custo) || 0) + (custosExtras * proporcao);
      return { ...d, faturamento: fatDia, custo: custoDia, lucro: Math.max(0, fatDia - custoDia) };
    });
  }, [dadosDashboard, custosExtras]);

  // Configuração inicial de datas (últimos 30 dias)
  useEffect(() => {
    carregarLojas();
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(trintaDiasAtras.toISOString().split("T")[0]);
  }, []);

  // Busca de Lojas para o Dropdown
  const carregarLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setLojas(response.data || []);
      if (response.data && response.data.length > 0) {
        setLojaSelecionada(response.data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      setErro("Erro ao carregar lista de lojas.");
    }
  };

  // Nova função otimizada: busca dados já processados do Backend
  const carregarDados = useCallback(async () => {
    if (!lojaSelecionada || !dataInicio || !dataFim) return;

    setErro("");
    setLoading(true);

    try {
      // Dashboard → faturamento/gráfico/totais (período). Produtos → preços para custo médio.
      const [response, produtosRes] = await Promise.all([
        api.get("/relatorios/dashboard", {
          params: { lojaId: lojaSelecionada, dataInicio, dataFim },
        }),
        api.get("/produtos").catch(() => ({ data: [] })),
      ]);

      const dados = response.data;

      // Salvar mapa de preços dos produtos
      const produtosList = Array.isArray(produtosRes.data)
        ? produtosRes.data
        : (produtosRes.data?.produtos || produtosRes.data?.rows || []);
      const pMap = {};
      produtosList.forEach(p => {
        pMap[p.id] = { nome: p.nome || '', preco: Number(p.preco || 0), custoUnitario: Number(p.custoUnitario || 0) };
      });
      setProdutosPrecos(pMap);

      console.log("Graficos - Totais:", JSON.stringify(dados.totais));
      console.log("Graficos - produtosPrecos:", pMap);

      // Custo do período para injetar no gráfico: saidas × preço médio
      const lista = Object.values(pMap);
      const getPreco = (p) => Number(p.preco || p.custoUnitario || 0);
      const precoMedio = lista.length > 0
        ? lista.reduce((s, p) => s + getPreco(p), 0) / lista.length
        : 0;
      const custoProdutosPeriodo = parseInt(dados.totais?.saidas || 0) * precoMedio;

      // Injetar coluna "custo" no graficoFinanceiro proporcional ao custoProdutos do período
      if (dados.graficoFinanceiro?.length > 0 && custoProdutosPeriodo > 0) {
        const totalFatGrafico = dados.graficoFinanceiro.reduce(
          (s, d) => s + (parseFloat(d.faturamento) || 0), 0
        );
        dados.graficoFinanceiro = dados.graficoFinanceiro.map(d => {
          const fatDia = parseFloat(d.faturamento) || 0;
          const prop = totalFatGrafico > 0 ? fatDia / totalFatGrafico : 1 / dados.graficoFinanceiro.length;
          return { ...d, custo: custoProdutosPeriodo * prop };
        });
      }

      setDadosDashboard(dados);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErro("Não foi possível carregar os dados do painel.");
      setDadosDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  // Atualiza quando filtros mudam
  useEffect(() => {
    if (lojaSelecionada && dataInicio && dataFim) {
      if (new Date(dataInicio) > new Date(dataFim)) {
        setErro("A data inicial não pode ser maior que a data final.");
        return;
      }
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, carregarDados]);

  // Formatação de Moeda
  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  // Calcula a margem de lucro para exibição (caso o backend não envie explicito)
  const calcularMargem = (lucro, faturamento) => {
    if (!faturamento || faturamento === 0) return 0;
    return ((lucro / faturamento) * 100).toFixed(1);
  };

  if (loading && !dadosDashboard) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50 bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Painel de Controle e Gráficos"
          subtitle="Visão estratégica do seu negócio"
          icon="📊"
        />

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
            <p className="font-bold">Atenção</p>
            <p>{erro}</p>
          </div>
        )}

        {dadosDashboard && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. KPI Cards - Indicadores Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Faturamento */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Faturamento
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(faturamentoReal)}
                    </h3>
                  </div>
                  <span className="p-2 bg-green-100 text-green-600 rounded-lg text-xl">
                    💰
                  </span>
                </div>
              </div>

              {/* Dinheiro */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Dinheiro
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(dadosDashboard?.totais?.dinheiro || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-yellow-100 text-yellow-600 rounded-lg text-xl">
                    💵
                  </span>
                </div>
              </div>

              {/* Pix */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-cyan-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Pix
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(dadosDashboard?.totais?.pix || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-cyan-100 text-cyan-600 rounded-lg text-xl">
                    🟢
                  </span>
                </div>
              </div>

              {/* Custos Totais */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Custos Totais
                    </p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">
                      {formatMoney(custoTotal)}
                    </h3>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs text-gray-500">
                      <span>🧸 Produtos saídos: {formatMoney(custoProdutos)}</span>
                      {custosExtras > 0 && <span>📋 Fixos/Variáveis: {formatMoney(custosExtras)}</span>}
                    </div>
                  </div>
                  <span className="p-2 bg-red-100 text-red-600 rounded-lg text-xl">
                    📉
                  </span>
                </div>
              </div>

              {/* Lucro Líquido */}
              <div className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${lucroTotal >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Lucro Líquido
                    </p>
                    <h3 className={`text-2xl font-bold mt-1 ${lucroTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatMoney(lucroTotal)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Margem: {calcularMargem(lucroTotal, faturamentoReal)}%
                    </p>
                    {/* Breakdown custos simples */}
                    {(custoProdutos > 0 || custosExtras > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-0.5 text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">Composição dos custos:</span>
                        {custoProdutos > 0 && (
                          <span>🧸 Produtos saídos: <strong className="text-red-600">{formatMoney(custoProdutos)}</strong></span>
                        )}
                        {custosExtras > 0 && (
                          <span>📋 Fixos/Variáveis: <strong className="text-red-600">{formatMoney(custosExtras)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`p-2 rounded-lg text-xl ${lucroTotal >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {lucroTotal >= 0 ? '📈' : '📉'}
                  </span>
                </div>
              </div>

              {/* Prêmios Entregues */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Prêmios Entregues
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {dadosDashboard.totais.saidas}
                    </h3>
                  </div>
                  <span className="p-2 bg-orange-100 text-orange-600 rounded-lg text-xl">
                    🧸
                  </span>
                </div>
              </div>
            </div>

            {/* Custos Variáveis / Fixos (input) */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-gray-400">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Custos Variáveis / Fixos (R$)
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custosExtras || ''}
                    onChange={e => setCustosExtras(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border text-lg font-bold"
                    placeholder="Digite custos extras (aluguel, etc)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Será somado aos custos e subtraído do lucro</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold mb-1">Composição dos Custos:</p>
                  <p>🧸 Produtos saídos: <strong>{formatMoney(custoProdutos)}</strong></p>
                  <p>📋 Fixos/Variáveis: <strong>{formatMoney(custosExtras)}</strong></p>
                  <p className="mt-1 pt-1 border-t font-bold">Total: {formatMoney(custoTotal)}</p>
                </div>
              </div>
            </div>

            {/* 2. Gráfico de Evolução Financeira */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📅</span>
                  Evolução Diária
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Faturamento total no período: <strong className="text-green-600">{formatMoney(faturamentoReal)}</strong>
                </p>
                <div className="h-80 w-full">
                  {(!graficoComCustosExtras || graficoComCustosExtras.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Sem dados para o período selecionado</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={graficoComCustosExtras}>
                      <defs>
                        <linearGradient
                          id="colorFat"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tickFormatter={(str) =>
                          new Date(str).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        }
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString("pt-BR")
                        }
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="faturamento"
                        name="Faturamento"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#colorFat)"
                      />
                      <Area
                        type="monotone"
                        dataKey="custo"
                        name="Custo"
                        stroke="#EF4444"
                        fillOpacity={0.3}
                        fill="#EF4444"
                      />
                      <Area
                        type="monotone"
                        dataKey="lucro"
                        name="Lucro"
                        stroke="#8B5CF6"
                        fillOpacity={0.2}
                        fill="#8B5CF6"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 3. Performance por Máquina */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🤖</span>
                  Performance por Máquina
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Total faturado: <strong className="text-green-600">{formatMoney(faturamentoReal)}</strong>
                </p>
                <div className="h-80 w-full">
                  {(!dadosDashboard.performanceMaquinas || dadosDashboard.performanceMaquinas.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Sem dados de máquinas para o período</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={dadosDashboard.performanceMaquinas}
                      layout="vertical"
                      margin={{ top: 5, right: 110, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        width={100}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        formatter={(value, name) => [
                          formatMoney(value),
                          "Faturamento",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="faturamento"
                        name="Faturamento"
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      >
                        <LabelList
                          dataKey="faturamento"
                          position="right"
                          formatter={(v) => formatMoney(v)}
                          style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Ranking de Produtos e Ocupação */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Produtos */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🏆</span>
                  Top Produtos Vendidos
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qtd
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Popularidade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(dadosDashboard.rankingProdutos || []).map((prod, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {idx + 1}. {prod.nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {prod.quantidade}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    (prod.quantidade /
                                      ((dadosDashboard.rankingProdutos?.[0]
                                        ?.quantidade) || 1)) *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status de Ocupação (Estoque) */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📦</span>
                  Nível de Estoque (%)
                </h3>
                <div className="h-80 w-full">
                  {(!dadosDashboard.performanceMaquinas || dadosDashboard.performanceMaquinas.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Sem dados de estoque</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={dadosDashboard.performanceMaquinas}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 10 }}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(val) => `${val}%`} />
                      <Bar
                        dataKey="ocupacao"
                        name="Ocupação"
                        radius={[4, 4, 0, 0]}
                      >
                        {(dadosDashboard.performanceMaquinas || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                (parseFloat(entry.ocupacao) || 0) < 30
                                  ? "#EF4444" // Crítico
                                  : (parseFloat(entry.ocupacao) || 0) < 60
                                    ? "#F59E0B" // Atenção
                                    : "#10B981" // Bom
                              }
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
