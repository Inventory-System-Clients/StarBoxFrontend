
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
      alert("Não é possível adicionar ao carrinho: peça zerada no estoque.");
      return;
    }
    // Desconta do estoque local
    setPecas((prev) => prev.map(item => item.id === peca.id ? { ...item, quantidade: item.quantidade - 1 } : item));
    // Salva no backend
    if (usuario && usuario.id) {
      const url = `/usuarios/${usuario.id}/carrinho`;
      const body = {
        pecaId: String(peca.id),
        quantidade: 1,
      };
      const token = localStorage.getItem("token");
      console.log("[Carrinho] Adicionando peça:", {
        usuarioId: usuario.id,
        url,
        body,
        token,
        baseURL: api.defaults.baseURL,
      });
      try {
        const response = await api.post(url, body);
        console.log("[Carrinho] Resposta backend:", response);
        // Atualiza carrinho após adicionar
        const resCarrinho = await api.get(`/usuarios/${usuario.id}/carrinho`);
        setCarrinho(resCarrinho.data || []);
      } catch (err) {
        if (err.response) {
          console.error("[Carrinho] Erro backend:", {
            status: err.response.status,
            data: err.response.data,
            url,
            body,
            token,
            baseURL: api.defaults.baseURL,
          });
        } else {
          console.error("[Carrinho] Erro desconhecido:", err);
        }
      }
    }
  };

  // Remove peça do carrinho do usuário e devolve ao estoque (backend)
  const removerDoCarrinho = async (pecaId) => {
    const item = carrinho.find((i) => i.pecaId === pecaId || i.id === pecaId);
    if (!item) {
      console.warn("[removerDoCarrinho] Peça não encontrada no carrinho", { pecaId, carrinho });
      return;
    }
    if (usuario && usuario.id && item.pecaId) {
      const url = `/usuarios/${usuario.id}/carrinho/${item.pecaId}/devolver`;
      console.log("[removerDoCarrinho] PATCH", { url, usuarioId: usuario.id, item });
      try {
        await api.patch(url);
        // Atualiza lista de peças e carrinho após devolução
        const [resPecas, resCarrinho] = await Promise.all([
          api.get("/pecas"),
          api.get(`/usuarios/${usuario.id}/carrinho`)
        ]);
        setPecas(resPecas.data || []);
        setCarrinho(resCarrinho.data || []);
      } catch (err) {
        console.error("[removerDoCarrinho] Erro ao chamar PATCH", { url, usuarioId: usuario.id, item, error: err, response: err?.response });
        alert("Erro ao remover peça do carrinho");
      }
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
              onClick={() => window.location.href = "/pecas/nova"}
            >
              + Nova Peça
            </button>
          )}
        </div>
        <p className="text-gray-600 mb-4">
          Aqui você pode visualizar, cadastrar e gerenciar peças do estoque. Funcionários de manutenção podem adicionar peças ao carrinho para uso em roteiros.
        </p>

        <div className="overflow-x-auto bg-white rounded-xl shadow p-4 border border-gray-100 mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                {(usuario?.role === "MANUTENCAO" || usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR") && (
                  <th className="px-4 py-2"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pecas.map((peca) => (
                <tr key={peca.id}>
                  <td className="px-4 py-2 font-semibold text-gray-800">{peca.nome}</td>
                  <td className="px-4 py-2 text-gray-700">{peca.categoria}</td>
                  <td className="px-4 py-2 text-gray-700">{peca.quantidade}</td>
                  {(usuario?.role === "MANUTENCAO" || usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR") && (
                    <td className="px-4 py-2">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold"
                        onClick={() => adicionarAoCarrinho(peca)}
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
        {(usuario?.role === "MANUTENCAO" || usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR") && (
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🛒 Meu Carrinho</h2>
            {carrinho.length === 0 ? (
              <p className="text-gray-500">Nenhuma peça no carrinho.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carrinho.map((item) => (
                    <tr key={item.id || item.pecaId}>
                      <td className="px-4 py-2 font-semibold text-gray-800">{item.nome && item.nome.trim() !== '' ? item.nome : 'Peça desconhecida'}</td>
                      <td className="px-4 py-2 text-gray-700">{item.categoria}</td>
                      <td className="px-4 py-2 text-gray-700">{item.quantidade}</td>
                      <td className="px-4 py-2">
                        <button
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold"
                          onClick={() => removerDoCarrinho(item.id)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
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
