import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function MovimentacaoMaquina() {
  const [showManutencao, setShowManutencao] = useState(false);
  const [manutencaoObs, setManutencaoObs] = useState("");
  const { roteiroId, lojaId, maquinaId } = useParams();
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
  });
  const [produtos, setProdutos] = useState([]);
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  // Cálculo automático da quantidade atual da máquina usando backend (prioriza digital)
  useEffect(() => {
    async function calcularBackend() {
      const inDigital = formData.contadorInDigital;
      const outDigital = formData.contadorOutDigital;
      if (
        inDigital !== "" &&
        outDigital !== "" &&
        maquina &&
        !formData.ignoreInOut
      ) {
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
          // fallback para cálculo local se erro
          const inVal = parseInt(inDigital) || 0;
          const outVal = parseInt(outDigital) || 0;
          const capacidade = parseInt(maquina.capacidadePadrao) || 0;
          const quantidadeAtual = capacidade - (outVal - inVal);
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina: quantidadeAtual >= 0 ? quantidadeAtual : 0,
          }));
        }
      }
    }
    calcularBackend();
  }, []);
  // ...existing code...

  // Modal de manutenção (fora do useEffect)
  const manutencaoModal = showManutencao && (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
        <button
          className="absolute top-2 right-2 text-gray-500 text-xl font-bold"
          onClick={() => setShowManutencao(false)}
        >
          ×
        </button>
        <h3 className="text-lg font-bold mb-4">Registrar Manutenção</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            setLoading(true);
            try {
              // Carrinho real do funcionário
              const carrinhoFuncionario = JSON.parse(
                localStorage.getItem("carrinhoFuncionario") || "[]",
              );
              const payload = {
                maquinaId: maquinaId,
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
          }}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Observação
          </label>
          <textarea
            value={manutencaoObs}
            onChange={(e) => setManutencaoObs(e.target.value)}
            className="input-field w-full"
            rows="3"
            placeholder="Descreva a manutenção realizada..."
          />
          {/* Lista de peças do carrinho do funcionário (real) */}
          <div className="mt-4">
            <h4 className="font-bold mb-2">Peças do Carrinho</h4>
            {(() => {
              const carrinhoFuncionario = JSON.parse(
                localStorage.getItem("carrinhoFuncionario") || "[]",
              );
              return carrinhoFuncionario.length > 0 ? (
                <ul className="mb-2">

                boxShadow: "0 2px 8px #e5393533",
                border: "none",
              }}
              onClick={() => setShowManutencao(true)}
            >
              Registrar Manutenção
            </button>
          </div>
          {showManutencao && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 text-xl font-bold"
                  onClick={() => setShowManutencao(false)}
                >
                  ×
                </button>
                <h3 className="text-lg font-bold mb-4">Registrar Manutenção</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    setSuccess("");
                    setLoading(true);
                    try {
                      // Aqui você pode buscar o carrinho do funcionário (exemplo: via API ou contexto)
                      // Para demo, simula carrinho
                      const carrinhoFuncionario =
                        window.carrinhoFuncionario || [];
                      const payload = {
                        maquinaId: maquinaId,
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
                  }}
                  className="space-y-4"
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observação
                  </label>
                  <textarea
                    value={manutencaoObs}
                    onChange={(e) => setManutencaoObs(e.target.value)}
                    className="input-field w-full"
                    rows="3"
                    placeholder="Descreva a manutenção realizada..."
                  />
                  {/* Lista de peças do carrinho do funcionário (simulado) */}
                  <div className="mt-4">
                    <h4 className="font-bold mb-2">Peças do Carrinho</h4>
                    {window.carrinhoFuncionario &&
                    window.carrinhoFuncionario.length > 0 ? (
                      <ul className="mb-2">
                        {window.carrinhoFuncionario.map((item) => (
                          <li key={item.id} className="text-sm text-gray-700">
                            {item.nome} - Qtd: {item.quantidade}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 italic">
                        Nenhuma peça no carrinho.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow"
                      disabled={loading}
                    >
                      {loading ? "Salvando..." : "Registrar Manutenção"}
                    </button>
                  </div>
                  {error && <div className="text-red-600 mt-2">{error}</div>}
                  {success && (
                    <div className="text-green-600 mt-2">{success}</div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Formulário de movimentação normal */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  Número do contador IN manual
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
                  Número do contador OUT manual
                </p>
              </div>
            </div>
            <div className="flex items-center mt-2 mb-4">
              <input
                type="checkbox"
                id="ignoreInOut"
                name="ignoreInOut"
                checked={formData.ignoreInOut || false}
                onChange={handleChange}
                className="mr-2"
              />
              <label htmlFor="ignoreInOut" className="text-sm text-gray-700">
                Não preciso informar IN/OUT nesta movimentação
              </label>
            </div>
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
            </div>
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
            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary"
              >
                Voltar
              </button>
              <button type="submit" className="btn-primary">
                Registrar Movimentação
              </button>
              <button
                type="button"
                style={{
                  backgroundColor: "#e53935",
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "0.5rem 1.5rem",
                  borderRadius: "0.5rem",
                  boxShadow: "0 2px 8px #e5393533",
                  border: "none",
                }}
                onClick={async () => {
                  setError("");
                  setSuccess("");
                  setLoading(true);
                  try {
                    // Monta payload mínimo necessário para o backend
                    const payload = {
                      maquinaId: maquinaId,
                      produtoId: formData.produto_id,
                      quantidadeAtualMaquina: formData.quantidadeAtualMaquina,
                      quantidadeAdicionada: formData.quantidadeAdicionada,
                      contadorInManual: formData.contadorInManual,
                      contadorOutManual: formData.contadorOutManual,
                      contadorInDigital: formData.contadorInDigital,
                      contadorOutDigital: formData.contadorOutDigital,
                      observacao: formData.observacao,
                      retiradaEstoque: formData.retiradaEstoque,
                      retiradaProduto: formData.retiradaProduto,
                      tipoOcorrencia: "Manutenção",
                      produtos: [
                        {
                          produtoId: formData.produto_id,
                          quantidadeSaiu: 0,
                          quantidadeAbastecida:
                            parseInt(formData.quantidadeAdicionada) || 0,
                          retiradaProduto:
                            parseInt(formData.retiradaProduto) || 0,
                        },
                      ],
                    };
                    await api.post(`/movimentacoes`, payload);
                    setSuccess("Manutenção registrada com sucesso!");
                  } catch (err) {
                    setError("Erro ao registrar manutenção.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Registrar Manutenção
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
