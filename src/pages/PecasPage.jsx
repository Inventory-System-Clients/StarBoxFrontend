import React, { useState, useEffect } from "react";
import { pecasAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function PecasPage() {
  const { usuario } = useAuth();
  const [pecas, setPecas] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", categoria: "", quantidade: 0 });

  // Carregar dados iniciais
  useEffect(() => {
    fetchPecas();
  }, []);

  const fetchPecas = async () => {
    try {
      const data = await pecasAPI.getAll();
      setPecas(data);
    } catch (error) {
      console.error("Erro ao buscar peças:", error);
      setPecas([]);
    }
  };

  // --- Lógica de CRUD ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editId) {
        await pecasAPI.update(editId, form);
      } else {
        await pecasAPI.create(form);
      }
      await fetchPecas(); // Atualiza a lista
      setForm({ nome: "", categoria: "", quantidade: 0 });
      setEditId(null);
    } catch (error) {
      alert("Erro ao salvar peça.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (peca) => {
    setForm({
      nome: peca.nome,
      categoria: peca.categoria,
      quantidade: peca.quantidade,
    });
    setEditId(peca.id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // UX: sobe para o formulário
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deseja realmente excluir esta peça?")) return;
    setLoading(true);
    try {
      await pecasAPI.delete(id);
      await fetchPecas();
    } catch (error) {
      alert("Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica do Carrinho ---

  const adicionarAoCarrinho = (peca) => {
    setCarrinho((prev) => {
      const itemExistente = prev.find((item) => item.id === peca.id);
      
      // Validação: não adicionar mais que o estoque disponível
      if (itemExistente && itemExistente.quantidade >= peca.quantidade) {
        alert("Quantidade máxima em estoque atingida!");
        return prev;
      }

      if (itemExistente) {
        return prev.map((item) =>
          item.id === peca.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...prev, { ...peca, quantidade: 1 }];
    });
  };

  const removerDoCarrinho = (pecaId) => {
    setCarrinho((prev) => prev.filter((item) => item.id !== pecaId));
  };

  const temPermissaoEscrita = usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR";
  const podeUsarCarrinho = usuario?.role === "MANUTENCAO" || temPermissaoEscrita;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="container mx-auto py-8 px-4 flex-grow">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            🛠️ Gerenciamento de Peças
          </h1>
          <p className="text-gray-600">
            Visualize o estoque e gerencie os itens para manutenção.
          </p>
        </header>

        {/* Formulário de Admin */}
        {temPermissaoEscrita && (
          <section className="mb-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-bold mb-4">
              {editId ? "✏️ Editar Peça" : "➕ Cadastrar Nova Peça"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Nome da peça"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Categoria (ex: Elétrica)"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                required
              />
              <input
                className="border rounded-lg px-3 py-2"
                type="number"
                min="0"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex-1"
                >
                  {loading ? "Processando..." : editId ? "Atualizar" : "Cadastrar"}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={() => { setEditId(null); setForm({ nome: "", categoria: "", quantidade: 0 }); }}
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
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">Nome</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">Categoria</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700 uppercase">Estoque</th>
                {podeUsarCarrinho && <th className="px-6 py-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pecas.map((peca) => (
                <tr key={peca.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{peca.nome}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{peca.categoria}</span>
                  </td>
                  <td className={`px-6 py-4 ${peca.quantidade < 5 ? 'text-red-500 font-bold' : 'text-gray-600'}`}>
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
                          <button onClick={() => handleEdit(peca)} className="text-yellow-600 hover:bg-yellow-50 px-3 py-1 rounded border border-yellow-600 text-xs font-bold">
                            Editar
                          </button>
                          <button onClick={() => handleDelete(peca.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded border border-red-600 text-xs font-bold">
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

        {/* Carrinho */}
        {podeUsarCarrinho && (
          <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🛒 Peças Selecionadas ({carrinho.length})
            </h2>
            {carrinho.length === 0 ? (
              <p className="text-gray-400 italic">Nenhum item selecionado para a manutenção.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carrinho.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg bg-blue-50">
                    <div>
                      <p className="font-bold text-gray-800">{item.nome}</p>
                      <p className="text-xs text-gray-500">Qtd: {item.quantidade}</p>
                    </div>
                    <button onClick={() => removerDoCarrinho(item.id)} className="text-red-500 hover:text-red-700 font-bold">
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}