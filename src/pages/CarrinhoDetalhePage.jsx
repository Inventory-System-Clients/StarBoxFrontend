import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export default function CarrinhoDetalhePage() {
  const { funcionarioId } = useParams();
  const navigate = useNavigate();
  const [funcionario, setFuncionario] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [funcRes, carrinhoRes] = await Promise.all([
          api.get(`/usuarios/${funcionarioId}`),
          api.get(`/usuarios/${funcionarioId}/carrinho`),
        ]);
        setFuncionario(funcRes.data);
        setCarrinho(carrinhoRes.data || []);
      } catch (err) {
        setFuncionario(null);
        setCarrinho([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [funcionarioId]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Detalhes do Carrinho"
          subtitle={
            funcionario
              ? `Funcionário: ${funcionario.nome} (${funcionario.email})`
              : "Funcionário não encontrado"
          }
          icon="🛒"
        />
        <button
          className="mb-4 text-indigo-600 hover:underline"
          onClick={() => navigate(-1)}
        >
          ← Voltar
        </button>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          {carrinho.length === 0 ? (
            <p className="text-gray-500 text-center">Carrinho vazio.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {carrinho.map((item) => (
                <li
                  key={item.pecaId || item.Peca?.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold text-gray-800">
                      {item.Peca?.nome ||
                        item.peca?.nome ||
                        `Peça ID: ${item.pecaId}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      Código: {item.Peca?.codigo || item.peca?.codigo || "N/A"}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    Quantidade: <strong>{item.quantidade}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
