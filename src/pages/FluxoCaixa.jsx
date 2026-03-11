import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function FluxoCaixa() {
  const { usuario } = useAuth();
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    dataInicio: formatDate(new Date(new Date().setDate(new Date().getDate() - 7))),
    dataFim: formatDate(new Date()),
    lojaId: "",
    status: "todos"
  });
  const [resumo, setResumo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lojas, setLojas] = useState([]);

  useEffect(() => {
    carregarLojas();
  }, []);

  useEffect(() => {
    carregarFluxos();
    carregarResumo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const carregarLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setLojas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const carregarFluxos = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("dataInicio", filtros.dataInicio);
      params.append("dataFim", filtros.dataFim);
      if (filtros.lojaId) params.append("lojaId", filtros.lojaId);
      if (filtros.status !== "todos") params.append("status", filtros.status);

      const response = await api.get(`/fluxo-caixa?${params}`);
      setFluxos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar fluxo de caixa:", error);
      setError("Erro ao carregar dados do fluxo de caixa");
    } finally {
      setLoading(false);
    }
  };

  const carregarResumo = async () => {
    try {
      const params = new URLSearchParams();
      params.append("dataInicio", filtros.dataInicio);
      params.append("dataFim", filtros.dataFim);
      if (filtros.lojaId) params.append("lojaId", filtros.lojaId);

      const response = await api.get(`/fluxo-caixa/resumo?${params}`);
      setResumo(response.data);
    } catch (error) {
      console.error("Erro ao carregar resumo:", error);
    }
  };

  const conferirFluxo = async (fluxoId, valorRetirado, conferencia, observacoes, valorEsperado) => {
    try {
      setError("");
      setSuccess("");

      const payload = {
        valorRetirado: parseFloat(valorRetirado),
        conferencia,
        observacoes: observacoes || null
      };

      // Se valorEsperado foi fornecido, incluir no payload
      if (valorEsperado !== undefined && valorEsperado !== null) {
        payload.valorEsperado = parseFloat(valorEsperado);
      }

      const response = await api.put(`/fluxo-caixa/${fluxoId}`, payload);

      if (response.status === 200) {
        setSuccess("✅ Conferência registrada com sucesso!");
        await carregarFluxos();
        await carregarResumo();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      console.error("Erro ao conferir:", error);
      setError("❌ Erro ao conferir fluxo de caixa: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="💰 Fluxo de Caixa"
          subtitle="Controle e conferência de retiradas de dinheiro das máquinas"
          icon="💰"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        {/* Resumo/Cards */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="stat-card bg-linear-to-br from-yellow-500/10 to-yellow-500/5">
              <div className="text-3xl mb-2">⏳</div>
              <div className="text-2xl font-bold text-gray-900">
                {resumo.totalPendentes || 0}
              </div>
              <div className="text-sm text-gray-600">Pendentes</div>
            </div>

            <div className="stat-card bg-linear-to-br from-green-500/10 to-green-500/5">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-gray-900">
                {resumo.totalBateu || 0}
              </div>
              <div className="text-sm text-gray-600">Bateu</div>
            </div>

            <div className="stat-card bg-linear-to-br from-red-500/10 to-red-500/5">
              <div className="text-3xl mb-2">❌</div>
              <div className="text-2xl font-bold text-gray-900">
                {resumo.totalNaoBateu || 0}
              </div>
              <div className="text-sm text-gray-600">Não Bateu</div>
            </div>

            <div className="stat-card bg-linear-to-br from-blue-500/10 to-blue-500/5">
              <div className="text-3xl mb-2">💵</div>
              <div className="text-xl font-bold text-gray-900">
                R$ {(resumo.valorTotalRetirado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-600">Total Retirado</div>
            </div>

            <div className="stat-card bg-linear-to-br from-purple-500/10 to-purple-500/5">
              <div className="text-3xl mb-2">📊</div>
              <div className={`text-xl font-bold ${(resumo.diferencaTotal || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(resumo.diferencaTotal || 0) >= 0 ? '+' : ''}R$ {Math.abs(resumo.diferencaTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-600">Diferença</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="card-gradient mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                value={filtros.lojaId}
                onChange={(e) => setFiltros(prev => ({ ...prev, lojaId: e.target.value }))}
                className="select-field"
              >
                <option value="">Todas as lojas</option>
                {lojas.map(loja => (
                  <option key={loja.id} value={loja.id}>{loja.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros(prev => ({ ...prev, status: e.target.value }))}
                className="select-field"
              >
                <option value="todos">Todos</option>
                <option value="pendente">⏳ Pendentes</option>
                <option value="bateu">✅ Bateu</option>
                <option value="nao_bateu">❌ Não Bateu</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Fluxos */}
        <div className="card-gradient">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              Retiradas de Dinheiro ({fluxos.length})
            </h3>
            <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
              <span className="text-blue-600">💡</span>
              <span>
                Ao editar uma conferência, você pode ajustar tanto o <strong className="text-yellow-700">Valor Esperado</strong> (🟡) 
                quanto o <strong className="text-blue-700">Valor Retirado</strong> (🔵). 
                Use quando houver erros de cálculo ou descontos não contabilizados.
              </span>
            </p>
          </div>

          {loading ? (
            <PageLoader />
          ) : fluxos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600 font-medium">
                Nenhuma retirada de dinheiro encontrada no período selecionado.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                As movimentações marcadas como "Retirada de Dinheiro" aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loja / Máquina
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Funcionário
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Esperado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Retirado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fluxos.map(fluxo => (
                    <ItemFluxoCaixa
                      key={fluxo.id}
                      fluxo={fluxo}
                      onConferir={conferirFluxo}
                      isAdmin={usuario?.role === "ADMIN"}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

// Componente Item da Tabela
function ItemFluxoCaixa({ fluxo, onConferir, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [formConferencia, setFormConferencia] = useState({
    valorRetirado: fluxo.valorRetirado || "",
    valorEsperado: fluxo.valorEsperado || fluxo.movimentacao?.valorFaturado || "",
    conferencia: fluxo.conferencia || "pendente",
    observacoes: fluxo.observacoes || ""
  });

  const handleSalvar = () => {
    if (!formConferencia.valorRetirado || formConferencia.valorRetirado === "") {
      alert("⚠️ Digite o valor retirado");
      return;
    }

    if (!formConferencia.valorEsperado || formConferencia.valorEsperado === "") {
      alert("⚠️ Digite o valor esperado");
      return;
    }

    if (formConferencia.conferencia === "pendente") {
      alert("⚠️ Selecione se o valor bateu ou não bateu");
      return;
    }

    onConferir(
      fluxo.id,
      formConferencia.valorRetirado,
      formConferencia.conferencia,
      formConferencia.observacoes,
      formConferencia.valorEsperado
    );
    setEditando(false);
  };

  const valorEsperado = editando 
    ? parseFloat(formConferencia.valorEsperado) || 0 
    : (fluxo.valorEsperado || fluxo.movimentacao?.valorFaturado || 0);
  const valorRetirado = parseFloat(formConferencia.valorRetirado) || (fluxo.valorRetirado ? parseFloat(fluxo.valorRetirado) : null);
  const diferenca = valorRetirado !== null ? valorRetirado - valorEsperado : 0;

  const getStatusBadge = (status) => {
    switch (status) {
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      case "bateu":
        return "bg-green-100 text-green-800";
      case "nao_bateu":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pendente":
        return "⏳";
      case "bateu":
        return "✅";
      case "nao_bateu":
        return "❌";
      default:
        return "❓";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "bateu":
        return "Bateu";
      case "nao_bateu":
        return "Não Bateu";
      default:
        return status;
    }
  };

  return (
    <tr className={`${fluxo.conferencia === "bateu" ? "bg-green-50" : fluxo.conferencia === "nao_bateu" ? "bg-red-50" : ""} hover:bg-gray-50 transition-colors`}>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(fluxo.movimentacao.dataColeta).toLocaleDateString("pt-BR")}
      </td>
      <td className="px-4 py-4 text-sm text-gray-900">
        <div className="font-semibold">{fluxo.movimentacao.maquina.loja.nome}</div>
        <div className="text-xs text-gray-600">
          {[
            fluxo.movimentacao.maquina.loja.endereco,
            fluxo.movimentacao.maquina.loja.numero && `nº ${fluxo.movimentacao.maquina.loja.numero}`,
            fluxo.movimentacao.maquina.loja.bairro
          ].filter(Boolean).join(", ")}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <strong>{fluxo.movimentacao.maquina.nome}</strong> ({fluxo.movimentacao.maquina.codigo})
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div>{fluxo.movimentacao.usuario.nome}</div>
        <div className="text-xs text-gray-500">{fluxo.movimentacao.usuario.email}</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
        {editando ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-semibold">Esperado:</label>
            <input
              type="number"
              step="0.01"
              value={formConferencia.valorEsperado}
              onChange={(e) => setFormConferencia(prev => ({
                ...prev,
                valorEsperado: e.target.value
              }))}
              placeholder="0.00"
              className="w-32 px-2 py-1 border-2 border-yellow-500 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span>R$ {valorEsperado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            {fluxo.valorEsperado && Math.abs(fluxo.valorEsperado - (fluxo.movimentacao?.valorFaturado || 0)) > 0.01 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Valor ajustado manualmente">
                ✏️ Editado
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
        {editando ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-semibold">Retirado:</label>
            <input
              type="number"
              step="0.01"
              value={formConferencia.valorRetirado}
              onChange={(e) => setFormConferencia(prev => ({
                ...prev,
                valorRetirado: e.target.value
              }))}
              placeholder="0.00"
              className="w-32 px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        ) : fluxo.valorRetirado !== null ? (
          <div>
            <div className="font-bold text-gray-900">
              R$ {fluxo.valorRetirado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            {diferenca !== 0 && (
              <div className={`text-xs font-semibold ${diferenca > 0 ? "text-green-600" : "text-red-600"}`}>
                ({diferenca > 0 ? "+" : ""}R$ {Math.abs(diferenca).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic">-</span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
        {editando ? (
          <select
            value={formConferencia.conferencia}
            onChange={(e) => setFormConferencia(prev => ({
              ...prev,
              conferencia: e.target.value
            }))}
            className="px-3 py-1 border-2 border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="pendente">⏳ Pendente</option>
            <option value="bateu">✅ Bateu</option>
            <option value="nao_bateu">❌ Não Bateu</option>
          </select>
        ) : (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(fluxo.conferencia)}`}>
            {getStatusIcon(fluxo.conferencia)} {getStatusText(fluxo.conferencia)}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
        {isAdmin ? (
          editando ? (
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSalvar}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold"
              >
                ✅ Salvar
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setFormConferencia({
                    valorRetirado: fluxo.valorRetirado || "",
                    valorEsperado: fluxo.movimentacao?.valorFaturado || "",
                    conferencia: fluxo.conferencia || "pendente",
                    observacoes: fluxo.observacoes || ""
                  });
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-xs font-semibold"
              >
                ❌ Cancelar
              </button>
            </div>
          ) : fluxo.conferencia === "pendente" ? (
            <button
              onClick={() => setEditando(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-xs font-semibold"
            >
              📝 Conferir
            </button>
          ) : (
            <button
              onClick={() => setEditando(true)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs font-semibold"
            >
              ✏️ Editar
            </button>
          )
        ) : (
          <span className="text-gray-400 text-xs italic">Somente admin</span>
        )}
      </td>
    </tr>
  );
}

// Função auxiliar para formatar data
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
