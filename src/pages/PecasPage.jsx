import React, { useState, useEffect, useCallback } from "react";
import { pecasAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

function PecasPage() {
  const { usuario } = useAuth();

  // --- Estados ---
  const [pecas, setPecas] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", categoria: "", quantidade: 0 });

  // --- Permissões ---
  const temPermissaoEscrita =
    usuario?.role === "admin" || usuario?.role === "gerente";
  const podeUsarCarrinho = true; // Ajuste conforme necessário

  // --- Carregamento de Dados ---
  const fetchPecas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pecasAPI.listar(); // Certifique-se que pecasAPI.listar existe
      setPecas(data || []);
    } catch (err) {
      console.error("Erro ao buscar peças:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPecas();
  }, [fetchPecas]);

  // --- Lógica do Formulário (CRUD) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editId) {
        await pecasAPI.atualizar(editId, form);
      } else {
        await pecasAPI.criar(form);
      }
      setForm({ nome: "", categoria: "", quantidade: 0 });
      setEditId(null);
      await fetchPecas();
    } catch (err) {
      alert("Erro ao salvar peça.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (peca) => {
    setEditId(peca.id);
    setForm({
      nome: peca.nome,
      categoria: peca.categoria,
      quantidade: peca.quantidade,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deseja realmente excluir esta peça?")) return;
    try {
      await pecasAPI.deletar(id);
      await fetchPecas();
    } catch (err) {
      alert("Erro ao excluir peça.");
    }
  };

  // --- Lógica do Carrinho ---
  const adicionarAoCarrinho = (peca) => {
    setCarrinho((prev) => {
      const itemExistente = prev.find((item) => item.id === peca.id);
      let novoCarrinho;
      if (itemExistente) {
        if (itemExistente.quantidade >= peca.quantidade) {
          alert("Limite de estoque atingido no carrinho.");
          return prev;
        }
        novoCarrinho = prev.map((item) =>
          item.id === peca.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item,
        );
      } else {
        novoCarrinho = [...prev, { ...peca, quantidade: 1 }];
      }
      // Salva carrinho no localStorage
      localStorage.setItem("carrinhoFuncionario", JSON.stringify(novoCarrinho));
      return novoCarrinho;
    });
  };

  const removerDoCarrinho = (id) => {
    setCarrinho((prev) => {
      const novoCarrinho = prev.filter((item) => item.id !== id);
      localStorage.setItem("carrinhoFuncionario", JSON.stringify(novoCarrinho));
      return novoCarrinho;
    });
  };

  // Ao carregar a página, recupera carrinho do localStorage
  useEffect(() => {
    const carrinhoSalvo = localStorage.getItem("carrinhoFuncionario");
    if (carrinhoSalvo) {
      setCarrinho(JSON.parse(carrinhoSalvo));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Gestão de Peças</h1>
          <p className="text-gray-600">
            Controle de estoque e retiradas para manutenção.
          </p>
        </header>

        {/* Formulário de Cadastro/Edição */}
        {temPermissaoEscrita && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">
              {editId ? "Editar Peça" : "Cadastrar Nova Peça"}
            </h2>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Nome da Peça"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Categoria (ex: Elétrica)"
                value={form.categoria}
                onChange={(e) =>
                  setForm({ ...form, categoria: e.target.value })
                }
                required
              />
              <input
                className="border rounded-lg px-3 py-2"
                type="number"
                min="0"
                value={form.quantidade}
                onChange={(e) =>
                  setForm({ ...form, quantidade: Number(e.target.value) })
                }
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex-1"
                >
                  {loading
                    ? "Processando..."
                    : editId
                      ? "Atualizar"
                      : "Cadastrar"}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(null);
                      setForm({ nome: "", categoria: "", quantidade: 0 });
                    }}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Tabela de Peças */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">
                  Nome
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">
                  Categoria
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">
                  Estoque
                </th>
                {podeUsarCarrinho && (
                  <th className="px-6 py-4 text-right">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pecas.map((peca) => (
                <tr
                  key={peca.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {peca.nome}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {peca.categoria}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 ${peca.quantidade < 5 ? "text-red-500 font-bold" : "text-gray-600"}`}
                  >
                    {peca.quantidade} un
                  </td>
                  {podeUsarCarrinho && (
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => adicionarAoCarrinho(peca)}
                        disabled={peca.quantidade === 0}
                        className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded border border-blue-600 text-xs font-bold disabled:opacity-50"
                      >
                        + Carrinho
                      </button>
                      {temPermissaoEscrita && (
                        <>
                          <button
                            onClick={() => handleEdit(peca)}
                            className="text-yellow-600 hover:bg-yellow-50 px-3 py-1 rounded border border-yellow-600 text-xs font-bold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(peca.id)}
                            className="text-red-600 hover:bg-red-50 px-3 py-1 rounded border border-red-600 text-xs font-bold"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Carrinho de Compras */}
        {podeUsarCarrinho && (
          <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 p-6 mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🛒 Peças Selecionadas ({carrinho.length})
            </h2>
            {carrinho.length === 0 ? (
              <p className="text-gray-400 italic">
                Nenhum item selecionado para a manutenção.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 border rounded-lg bg-blue-50"
                    >
                      <div>
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <p className="text-xs text-gray-500">
                          Qtd a retirar: {item.quantidade}
                        </p>
                      </div>
                      <button
                        onClick={() => removerDoCarrinho(item.id)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-transform active:scale-95"
                    disabled={loading}
                    onClick={async () => {
                      if (!window.confirm("Confirmar retirada das peças?"))
                        return;
                      try {
                        setLoading(true);
                        const payload = {
                          lojaId: usuario?.lojaId || 1,
                          usuarioId: usuario?.id,
                          produtos: carrinho.map((item) => ({
                            produtoId: item.id,
                            quantidade: item.quantidade,
                            tipoMovimentacao: "saida",
                          })),
                          observacao: "Retirada via carrinho",
                          dataMovimentacao: new Date(),
                        };

                        await fetch("/api/movimentacaoEstoqueLoja", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });

                        setCarrinho([]);
                        alert("Retirada registrada com sucesso!");
                        await fetchPecas();
                      } catch (err) {
                        alert("Erro ao registrar retirada.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    {loading ? "Salvando..." : "Finalizar Retirada"}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default PecasPage;
