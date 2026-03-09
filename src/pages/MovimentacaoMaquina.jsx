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
  const isFuncionarioNormal = usuario?.role === "FUNCIONARIO";
  const isFuncionarioTodasLojas = usuario?.role === "FUNCIONARIO_TODAS_LOJAS";

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
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });
  const [produtos, setProdutos] = useState([]);
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resumoCalculo, setResumoCalculo] = useState(null);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);

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
  }, [maquinaId, usuario]);

  useEffect(() => {
    if (!isFuncionarioNormal) return;

    setFormData((prev) => ({
      ...prev,
      contadorInManual: "",
      contadorOutManual: "",
      contadorInDigital: "",
      contadorOutDigital: "",
      ignoreInOut: true,
    }));
  }, [isFuncionarioNormal]);

  // Cálculo automático usando histórico de movimentações e contadores projetados
  useEffect(() => {
    async function atualizarCalculos() {
      if (!maquina || !maquinaId) {
        setResumoCalculo(null);
        setSugestaoAbastecimento(null);
        return;
      }

      const contadorInReferencia =
        formData.contadorInManual !== ""
          ? formData.contadorInManual
          : formData.contadorInDigital;
      const contadorOutReferencia =
        formData.contadorOutManual !== ""
          ? formData.contadorOutManual
          : formData.contadorOutDigital;

      const params = { maquinaId };
      if (!isFuncionarioNormal && !formData.ignoreInOut) {
        if (contadorInReferencia !== "")
          params.contadorIn = contadorInReferencia;
        if (contadorOutReferencia !== "") {
          params.contadorOut = contadorOutReferencia;
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
          !isFuncionarioNormal &&
          !formData.ignoreInOut &&
          contadorInReferencia !== "" &&
          contadorOutReferencia !== "";

        if (temContadoresDigitados) {
          setFormData((prev) => ({
            ...prev,
            quantidadeAtualMaquina: quantidadeCalculada,
          }));
        }
      } catch (err) {
        setResumoCalculo(null);
        setSugestaoAbastecimento(null);
      }
    }

    atualizarCalculos();
  }, [
    maquina,
    maquinaId,
    isFuncionarioNormal,
    formData.contadorInManual,
    formData.contadorOutManual,
    formData.contadorInDigital,
    formData.contadorOutDigital,
    formData.ignoreInOut,
  ]);

  // Sugestão de abastecimento usando backend
  const [sugestaoAbastecimento, setSugestaoAbastecimento] = useState(null);
  useEffect(() => {
    const contadorOutReferencia =
      formData.contadorOutManual !== ""
        ? formData.contadorOutManual
        : formData.contadorOutDigital;

    const contadorOutDigitado = parseInt(contadorOutReferencia, 10);
    const totalPreInformado = parseInt(formData.quantidadeAtualMaquina, 10);

    if (isFuncionarioNormal || !resumoCalculo) {
      setAlertaDivergencia(null);
      return;
    }

    if (
      !formData.ignoreInOut &&
      contadorOutReferencia !== "" &&
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
      contadorOutReferencia !== "" &&
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
    isFuncionarioNormal,
    resumoCalculo,
    formData.contadorOutManual,
    formData.contadorOutDigital,
    formData.quantidadeAtualMaquina,
    formData.ignoreInOut,
  ]);

  useEffect(() => {
    async function calcularSugestao() {
      if (isFuncionarioNormal) return;

      if (!resumoCalculo) {
        setSugestaoAbastecimento(null);
        return;
      }

      setSugestaoAbastecimento(resumoCalculo.sugestaoAbastecimento ?? null);
    }

    calcularSugestao();
  }, [isFuncionarioNormal, resumoCalculo]);

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
      const deveIgnorarContadores = isFuncionarioNormal || formData.ignoreInOut;

      const produtosParaEnviar = [
        {
          produtoId: formData.produto_id,
          quantidadeSaiu: 0,
          quantidadeAbastecida: parseInt(formData.quantidadeAdicionada) || 0,
          retiradaProduto: parseInt(formData.retiradaProduto) || 0,
        },
      ];
      await api.post("/movimentacoes", {
        maquinaId: maquinaId,
        roteiroId: roteiroId,
        totalPre: parseInt(formData.quantidadeAtualMaquina) || 0,
        abastecidas: parseInt(formData.quantidadeAdicionada) || 0,
        fichas: parseInt(formData.fichas) || 0,
        contadorIn: deveIgnorarContadores
          ? null
          : formData.contadorInManual === ""
            ? null
            : parseInt(formData.contadorInManual),
        contadorOut: deveIgnorarContadores
          ? null
          : formData.contadorOutManual === ""
            ? null
            : parseInt(formData.contadorOutManual),
        quantidade_notas_entrada: formData.quantidade_notas_entrada
          ? parseFloat(formData.quantidade_notas_entrada)
          : null,
        valor_entrada_maquininha_pix: formData.valor_entrada_maquininha_pix
          ? parseFloat(formData.valor_entrada_maquininha_pix)
          : null,
        ignoreInOut: Boolean(formData.ignoreInOut),
        retiradaEstoque: formData.retiradaEstoque,
        retiradaProduto: parseInt(formData.retiradaProduto) || 0,
        observacoes: formData.observacao || "",
        produtos: produtosParaEnviar,
      });
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
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
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
            {!isFuncionarioNormal ? (
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
                      required={
                        isFuncionarioTodasLojas && !formData.ignoreInOut
                      }
                      disabled={formData.ignoreInOut}
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
                      required={
                        isFuncionarioTodasLojas && !formData.ignoreInOut
                      }
                      disabled={formData.ignoreInOut}
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
                      {resumoCalculo.totalPreEsperado ?? 0}
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
                  Para o perfil de funcionário, os campos IN/OUT não precisam
                  ser digitados nesta movimentação.
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
                onClick={() =>
                  navigate(`/roteiros/${roteiroId}/executar`, {
                    state: { lojaId: lojaId },
                  })
                }
                className="btn-secondary"
              >
                Voltar
              </button>
              <button type="submit" className="btn-primary">
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
