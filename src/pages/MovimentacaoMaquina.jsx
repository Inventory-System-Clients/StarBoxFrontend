import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function MovimentacaoMaquina() {
  const [showManutencao, setShowManutencao] = useState(false);
  const [manutencaoObs, setManutencaoObs] = useState("");
  const { maquinaId } = useParams();
  const navigate = useNavigate();

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
    ignoreInOut: false,
    retiradaProdutoDevolverEstoque: false,
  });

  const [produtos, setProdutos] = useState([]);
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [maqRes, prodRes] = await Promise.all([
          api.get(`/maquinas/${maquinaId}`),
          api.get("/produtos"),
        ]);
        setMaquina(maqRes.data);
        setProdutos(prodRes.data);
      } catch (err) {
        setError("Erro ao carregar dados da máquina ou produtos.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [maquinaId]);

  // Cálculo automático
  useEffect(() => {
    async function calcularBackend() {
      const {
        contadorInDigital: inDigital,
        contadorOutDigital: outDigital,
        ignoreInOut,
      } = formData;
      if (inDigital !== "" && outDigital !== "" && maquina && !ignoreInOut) {
        try {
          const res = await api.get(
            `/maquinas/${maquinaId}/calcular-quantidade`,
            {
              params: {
                maquinaId,
                contadorIn: inDigital,
                contadorOut: outDigital,
              },
            },
          );
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina:
              res.data.quantidadeAtual >= 0 ? res.data.quantidadeAtual : 0,
          }));
        } catch (err) {
          const inVal = parseInt(inDigital) || 0;
          const outVal = parseInt(outDigital) || 0;
          const capacidade = parseInt(maquina.capacidadePadrao) || 0;
          const qtd = capacidade - (outVal - inVal);
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina: qtd >= 0 ? qtd : 0,
          }));
        }
      }
    }
    calcularBackend();
  }, [
    formData.contadorInDigital,
    formData.contadorOutDigital,
    formData.ignoreInOut,
    maquina,
    maquinaId,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Lógica de envio da movimentação normal aqui
  };

  // Função para salvar manutenção
  const handleSaveManutencao = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const carrinhoFuncionario = JSON.parse(
        localStorage.getItem("carrinhoFuncionario") || "[]",
      );
      const payload = {
        maquinaId,
        observacao: manutencaoObs,
        tipoOcorrencia: "Manutenção",
        produtos: carrinhoFuncionario.map((item) => ({
          produtoId: item.id,
          quantidadeSaiu: 0,
          quantidadeAbastecida: item.quantidade,
          retiradaProduto: 0,
        })),
      };
      await api.post(`/movimentacoes`, payload);
      setSuccess("Manutenção registrada com sucesso!");
      setShowManutencao(false);
    } catch (err) {
      setError("Erro ao registrar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  // Estados para seleção de peças no modal
  const [selectedPecaId, setSelectedPecaId] = useState("");
  const [selectedQtd, setSelectedQtd] = useState(1);
  const [carrinhoManutencao, setCarrinhoManutencao] = useState(() => {
    return JSON.parse(localStorage.getItem("carrinhoFuncionario") || "[]");
  });

  function handleAdicionarPecaModal() {
    if (
      !selectedPecaId ||
      !selectedQtd ||
      isNaN(selectedQtd) ||
      selectedQtd <= 0
    ) {
      alert("Selecione a peça e a quantidade.");
      return;
    }
    const peca = produtos.find((p) => String(p.id) === String(selectedPecaId));
    if (!peca) {
      alert("Peça não encontrada.");
      return;
    }
    let novoCarrinho = [...carrinhoManutencao];
    const existente = novoCarrinho.find(
      (item) => String(item.id) === String(peca.id),
    );
    if (existente) {
      existente.quantidade += parseInt(selectedQtd);
    } else {
      novoCarrinho.push({
        id: peca.id,
        nome: peca.nome,
        quantidade: parseInt(selectedQtd),
      });
    }
    setCarrinhoManutencao(novoCarrinho);
    localStorage.setItem("carrinhoFuncionario", JSON.stringify(novoCarrinho));
    setSelectedPecaId("");
    setSelectedQtd(1);
  }

  function handleRemoverPecaModal(id) {
    const novoCarrinho = carrinhoManutencao.filter((item) => item.id !== id);
    setCarrinhoManutencao(novoCarrinho);
    localStorage.setItem("carrinhoFuncionario", JSON.stringify(novoCarrinho));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md p-6 max-w-4xl mx-auto border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            ⚙️ Movimentação da Máquina: {maquina?.nome || "Carregando..."}
          </h2>

          {/* Botão para abrir manutenção */}
          <button
            onClick={() => setShowManutencao(true)}
            className="mb-6 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold"
          >
            🔧 Abrir Painel de Manutenção
          </button>

          {/* Modal de Manutenção */}
          {showManutencao && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Registrar Manutenção</h3>
                  <button
                    onClick={() => setShowManutencao(false)}
                    className="text-2xl"
                  >
                    &times;
                  </button>
                </div>
                <form onSubmit={handleSaveManutencao} className="space-y-4">
                  <textarea
                    value={manutencaoObs}
                    onChange={(e) => setManutencaoObs(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    rows="3"
                    placeholder="Descreva a manutenção..."
                  />
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-bold text-sm mb-2">
                      Peças usadas na manutenção:
                    </h4>
                    {carrinhoManutencao.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {carrinhoManutencao.map((item) => (
                          <li key={item.id} className="flex items-center gap-2">
                            • {item.nome} (Qtd: {item.quantidade})
                            <button
                              type="button"
                              className="text-red-500 text-xs font-bold"
                              onClick={() => handleRemoverPecaModal(item.id)}
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Nenhuma peça selecionada.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 bg-blue-50 p-3 rounded-lg">
                    <label className="font-bold text-sm">Adicionar Peça:</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border rounded p-2"
                        value={selectedPecaId}
                        onChange={(e) => setSelectedPecaId(e.target.value)}
                      >
                        <option value="">Selecione a peça</option>
                        {produtos &&
                          produtos.map((peca) => (
                            <option key={peca.id} value={peca.id}>
                              {peca.nome}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={selectedQtd}
                        placeholder="Qtd"
                        className="w-20 border rounded p-2"
                        onChange={(e) => setSelectedQtd(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="bg-green-600 text-white px-3 rounded font-bold"
                        onClick={handleAdicionarPecaModal}
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                  <button
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-2 rounded-lg font-bold"
                  >
                    {loading ? "Salvando..." : "Confirmar Manutenção"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">📥 Contador IN Digital</label>
                <input
                  type="number"
                  name="contadorInDigital"
                  value={formData.contadorInDigital}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="label">📤 Contador OUT Digital</label>
                <input
                  type="number"
                  name="contadorOutDigital"
                  value={formData.contadorOutDigital}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ignoreInOut"
                name="ignoreInOut"
                checked={formData.ignoreInOut}
                onChange={handleChange}
              />
              <label htmlFor="ignoreInOut" className="text-sm">
                Não preciso informar IN/OUT
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">📦 Qtd Atual na Máquina</label>
                <input
                  type="number"
                  name="quantidadeAtualMaquina"
                  value={formData.quantidadeAtualMaquina}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="label">📦 Qtd Adicionada</label>
                <input
                  type="number"
                  name="quantidadeAdicionada"
                  value={formData.quantidadeAdicionada}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="label">❌ Retirada de Produto</label>
                <input
                  type="number"
                  name="retiradaProduto"
                  value={formData.retiradaProduto}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4 border-t">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg"
              >
                Registrar Movimentação Normal
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="text-gray-500 underline text-sm"
              >
                Voltar
              </button>
            </div>
          </form>

          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          {success && (
            <p className="text-green-500 mt-4 text-center">{success}</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
