import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { Modal, AlertBox } from "../components/UIComponents";

export default function RoteiroExecucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [erroCarregamentoInicial, setErroCarregamentoInicial] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    loading: false,
  });

  useEffect(() => {
    carregarRoteiro();
  }, [id]);

  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      setErroCarregamentoInicial("");
      const res = await api.get(`/roteiros/${id}/executar`);
      setRoteiro(res.data);
      console.log("Roteiro carregado:", res.data);
    } catch (err) {
      setErroCarregamentoInicial("Erro ao buscar roteiro.");
    } finally {
      setLoading(false);
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    if (!roteiro) return;

    try {
      setError("");
      setSuccess("");
      setModalFinalizar((prev) => ({ ...prev, loading: true }));

      const res = await api.post(`/roteiros/${id}/finalizar`);
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomes = pendencias.map((p) => p.maquinaNome).join(", ");
        const envioWhatsApp = res?.data?.alertaWhatsApp?.status;
        setSuccess(
          `Roteiro finalizado com pendências: ${nomes}. Alerta WhatsApp: ${envioWhatsApp || "não enviado"}.`,
        );
      } else {
        setSuccess("Roteiro finalizado com sucesso!");
      }

      setModalFinalizar({ aberto: false, etapa: 1, loading: false });
      await carregarRoteiro();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao finalizar roteiro.");
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = () => {
    setModalFinalizar({ aberto: true, etapa: 1, loading: false });
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({ aberto: false, etapa: 1, loading: false });
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  if (loading)
    return <div className="p-20 text-center font-bold">Carregando...</div>;
  if (erroCarregamentoInicial)
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AlertBox type="error" message={erroCarregamentoInicial} />
      </div>
    );
  if (!roteiro)
    return (
      <div className="p-20 text-center font-bold">Roteiro não encontrado.</div>
    );

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1
          className={`text-2xl font-bold mb-6 flex items-center gap-2 ${roteiro.status === "finalizado" ? "text-green-600" : ""}`}
        >
          Execução do Roteiro: {roteiro.nome}
          {roteiro.status === "finalizado" && (
            <span className="ml-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
              Finalizado
            </span>
          )}
        </h1>
        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">
            Selecione uma loja para movimentar:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roteiro.lojas && roteiro.lojas.length > 0 ? (
              roteiro.lojas.map((loja) => (
                <button
                  key={loja.id}
                  onClick={() => setLojaSelecionada(loja)}
                  className={`p-4 rounded-lg shadow border-2 font-bold text-lg transition-all flex flex-col items-start 
                    ${lojaSelecionada?.id === loja.id ? "border-blue-600" : "border-transparent"}
                    ${loja.status === "finalizado" ? "bg-green-100 border-green-600 text-green-700" : "bg-white"}`}
                >
                  <span>🏪 {loja.nome}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {loja.cidade}, {loja.estado}
                  </span>
                  {loja.status === "finalizado" && (
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                      Finalizada
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="col-span-2 text-center text-gray-400">
                Nenhuma loja disponível neste roteiro.
              </div>
            )}
          </div>
        </div>
        {lojaSelecionada && (
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <h3 className="text-xl font-bold mb-4">
              Máquinas da loja: {lojaSelecionada.nome}
            </h3>
            <div className="space-y-3">
              {lojaSelecionada.maquinas &&
              lojaSelecionada.maquinas.length > 0 ? (
                lojaSelecionada.maquinas.map((maquina) => (
                  <button
                    key={maquina.id}
                    className={`p-3 rounded border font-medium w-full text-left transition-all flex items-center gap-2 
                      ${maquina.status === "finalizado" ? "bg-green-100 border-green-600 text-green-700" : "bg-gray-50 hover:border-blue-600"}
                      ${roteiro.status === "finalizado" ? "opacity-70 cursor-not-allowed" : ""}`}
                    onClick={() => {
                      if (roteiro.status === "finalizado") return;
                      navigate(
                        `/roteiros/${roteiro.id}/lojas/${lojaSelecionada.id}/maquinas/${maquina.id}/movimentacao`,
                      );
                    }}
                    disabled={roteiro.status === "finalizado"}
                  >
                    <span>🖲️ {maquina.nome}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({maquina.tipo})
                    </span>
                    {maquina.status === "finalizado" && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                        Finalizada
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-gray-400">
                  Nenhuma máquina cadastrada nesta loja.
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          {roteiro.status !== "finalizado" && (
            <button
              className="bg-green-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-green-700"
              onClick={abrirModalFinalizacao}
            >
              Finalizar Rota
            </button>
          )}
          <button
            className="bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-bold"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>

        <Modal
          isOpen={modalFinalizar.aberto}
          onClose={fecharModalFinalizacao}
          title={
            modalFinalizar.etapa === 1
              ? "Confirmar finalização"
              : "Confirmação final"
          }
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              {modalFinalizar.etapa === 1
                ? "Deseja realmente finalizar esta rota?"
                : "Confirma novamente: finalizar agora este roteiro?"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalFinalizacao}
                disabled={modalFinalizar.loading}
              >
                Cancelar
              </button>
              {modalFinalizar.etapa === 1 ? (
                <button
                  className="btn-primary"
                  onClick={avancarConfirmacaoFinalizacao}
                >
                  Continuar
                </button>
              ) : (
                <button
                  className="btn-danger"
                  onClick={executarFinalizacaoRoteiro}
                  disabled={modalFinalizar.loading}
                >
                  {modalFinalizar.loading ? "Finalizando..." : "Finalizar Rota"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      </main>
      <Footer />
    </div>
  );
}
