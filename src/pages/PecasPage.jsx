import React, { useState } from "react";
import api from "../services/api";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function PecasPage() {
  const { usuario } = useAuth();
  const [pecas, setPecas] = useState([]);
  // Buscar peças reais do backend ao carregar a página
  useEffect(() => {
    async function fetchPecas() {
      try {
        const res = await api.get("/pecas");
        setPecas(res.data);
      } catch (err) {
        setPecas([]);
        console.error("Erro ao buscar peças do backend:", err);
      }
    }
    fetchPecas();
  }, []);
  const [carrinho, setCarrinho] = useState([]);

  // Carregar carrinho do backend ao atualizar a página
  useEffect(() => {
    async function fetchCarrinho() {
      if (usuario && usuario.id) {
        try {
          const res = await api.get(`/usuarios/${usuario.id}/carrinho`);
          console.log("[PecasPage] Carrinho recebido:", res.data);
          setCarrinho(res.data || []);
        } catch (err) {
          setCarrinho([]);
          console.error("Erro ao buscar carrinho do backend:", err);
        }
      }
    }
    fetchCarrinho();
  }, [usuario]);

  // Adiciona peça ao carrinho do usuário
  const adicionarAoCarrinho = async (peca) => {
    if (!peca || peca.quantidade === 0) {
      alert(
        "Não é possível adicionar ao carrinho: peça sem estoque disponível.",
      );
      return;
    }

    if (!usuario || !usuario.id) {
      alert("Usuário não autenticado");
      return;
    }

    try {
      await api.post(`/usuarios/${usuario.id}/carrinho`, {
        pecaId: peca.id,
        quantidade: 1,
      });

      // Atualizar listas após adicionar
      const [resPecas, resCarrinho] = await Promise.all([
        api.get("/pecas"),
        api.get(`/usuarios/${usuario.id}/carrinho`),
      ]);
      setPecas(resPecas.data || []);
      setCarrinho(resCarrinho.data || []);
      alert("Peça adicionada ao carrinho com sucesso!");
    } catch (err) {
      console.error("[adicionarAoCarrinho] Erro:", err.response?.data || err);
      alert(err.response?.data?.error || "Erro ao adicionar peça ao carrinho");

      // Recarregar peças para garantir estado correto
      try {
        const resPecas = await api.get("/pecas");
        setPecas(resPecas.data || []);
      } catch (e) {
        console.error("Erro ao recarregar peças:", e);
      }
    }
  };

  // Remove peça do carrinho do usuário e devolve ao estoque (backend)
  const removerDoCarrinho = async (itemId) => {
    const item = carrinho.find((i) => i.pecaId === itemId || i.id === itemId);
    if (!item) {
      console.warn("[removerDoCarrinho] Peça não encontrada no carrinho", {
        itemId,
        carrinho,
      });
      return;
    }

    // Usa o pecaId correto do item encontrado
    const pecaId = item.pecaId || item.id;
    if (!usuario || !usuario.id || !pecaId) {
      console.error("[removerDoCarrinho] Dados insuficientes", {
        usuario,
        pecaId,
      });
      return;
    }

    if (
      !window.confirm(
        "Deseja realmente remover esta peça do carrinho? Ela será devolvida ao estoque.",
      )
    ) {
      return;
    }

    const url = `/usuarios/${usuario.id}/carrinho/${pecaId}`;
    console.log("[removerDoCarrinho] DELETE", {
      url,
      usuarioId: usuario.id,
      pecaId,
      item,
    });
    try {
      await api.delete(url);
      // Atualiza lista de peças e carrinho após devolução
      const [resPecas, resCarrinho] = await Promise.all([
        api.get("/pecas"),
        api.get(`/usuarios/${usuario.id}/carrinho`),
      ]);
      setPecas(resPecas.data || []);
      setCarrinho(resCarrinho.data || []);
      alert("Peça removida e devolvida ao estoque!");
    } catch (err) {
      console.error("[removerDoCarrinho] Erro ao chamar DELETE", {
        url,
        pecaId,
        item,
        error: err,
        response: err?.response,
      });
      alert(err.response?.data?.error || "Erro ao remover peça do carrinho");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            🛠️ Peças
          </h1>
          {(usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR") && (
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold shadow text-sm"
              onClick={() => (window.location.href = "/pecas/nova")}
            >
              + Nova Peça
            </button>
          )}
        </div>
        <p className="text-gray-600 mb-4">
          Aqui você pode visualizar, cadastrar e gerenciar peças do estoque.
          Funcionários podem adicionar peças ao carrinho para uso em roteiros.
        </p>

        <div className="overflow-x-auto bg-white rounded-xl shadow p-4 border border-gray-100 mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Nome
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Categoria
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantidade
                </th>
                {(usuario?.role === "FUNCIONARIO" ||
                  usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
                  usuario?.role === "MANUTENCAO" ||
                  usuario?.role === "ADMIN" ||
                  usuario?.role === "GERENCIADOR") && (
                  <th className="px-4 py-2"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pecas.map((peca) => (
                <tr key={peca.id}>
                  <td className="px-4 py-2 font-semibold text-gray-800">
                    {peca.nome}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{peca.categoria}</td>
                  <td className="px-4 py-2 text-gray-700">{peca.quantidade}</td>
                  {(usuario?.role === "FUNCIONARIO" ||
                    usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
                    usuario?.role === "MANUTENCAO" ||
                    usuario?.role === "ADMIN" ||
                    usuario?.role === "GERENCIADOR") && (
                    <td className="px-4 py-2">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold"
                        onClick={() => adicionarAoCarrinho(peca)}
                        title="Adicionar peça ao carrinho"
                      >
                        Adicionar ao Carrinho
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Carrinho do usuário */}
        {(usuario?.role === "FUNCIONARIO" ||
          usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
          usuario?.role === "MANUTENCAO" ||
          usuario?.role === "ADMIN" ||
          usuario?.role === "GERENCIADOR") && (
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🛒 Meu Carrinho
            </h2>

            {carrinho.length === 0 ? (
              <p className="text-gray-500">Nenhuma peça no carrinho.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoria
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Qtd
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carrinho.map((item) => {
                    const pecaId = item.pecaId || item.id;
                    const peca = item.Peca || item; // Acessa dados do relacionamento Sequelize
                    return (
                      <tr key={pecaId}>
                        <td className="px-4 py-2 font-semibold text-gray-800">
                          {peca.nome || "Peça desconhecida"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {peca.categoria || "-"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {item.quantidade}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold"
                            onClick={() => removerDoCarrinho(pecaId)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
