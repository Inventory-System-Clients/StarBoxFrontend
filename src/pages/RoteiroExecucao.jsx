import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { Modal, AlertBox } from "../components/UIComponents";
import ManutencaoModal from "../components/ManutencaoModal";
import { useAuth } from "../contexts/AuthContext";

export default function RoteiroExecucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
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

  // Estados para manutenção
  const [manutencaoPendente, setManutencaoPendente] = useState(null);
  const [modalManutencao, setModalManutencao] = useState(false);

  // Estados para controle de ordem
  const [modalJustificativa, setModalJustificativa] = useState({
    aberto: false,
    lojaId: null,
    lojaNome: "",
    lojaIdEsperada: null,
    lojaEsperadaNome: "",
    justificativa: "",
  });

  const lojaEstaConcluida = (status) =>
    ["concluido", "concluida", "finalizado", "finalizada"].includes(
      String(status || "").toLowerCase(),
    );

  useEffect(() => {
    carregarRoteiro();
  }, [id]);

  // Efeito para selecionar automaticamente a loja quando volta da movimentação
  useEffect(() => {
    if (roteiro && location.state?.lojaId) {
      const loja = roteiro.lojas?.find((l) => l.id === location.state.lojaId);
      if (loja) {
        setLojaSelecionada(loja);
        // Limpar o state para não manter o lojaId em navegações futuras
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [roteiro, location.state]);

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

  const verificarManutencoesPendentes = async (lojaId) => {
    try {
      const res = await api.get(`/manutencoes`, {
        params: {
          lojaId,
          status: "pendente",
        },
      });
      const manutencoesPendentes = res.data || [];

      if (manutencoesPendentes.length > 0) {
        // Pega a primeira manutenção pendente
        setManutencaoPendente(manutencoesPendentes[0]);
        setModalManutencao(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao verificar manutenções:", err);
      return false;
    }
  };

  const handleSelecionarLoja = async (loja) => {
    // Verificar ordem das lojas
    if (roteiro?.lojas) {
      const lojasOrdenadas = [...roteiro.lojas].sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0),
      );
      const proximaLoja = lojasOrdenadas.find(
        (l) => !lojaEstaConcluida(l.status),
      );

      // Se não é a próxima loja na ordem e ainda tem lojas pendentes antes
      if (
        proximaLoja &&
        proximaLoja.id !== loja.id &&
        !lojaEstaConcluida(loja.status)
      ) {
        setModalJustificativa({
          aberto: true,
          lojaId: loja.id,
          lojaNome: loja.nome,
          lojaIdEsperada: proximaLoja.id,
          lojaEsperadaNome: proximaLoja.nome,
          justificativa: "",
        });
        return;
      }
    }

    setLojaSelecionada(loja);

    // Verificar se há manutenções pendentes nesta loja
    if (loja && loja.id) {
      await verificarManutencoesPendentes(loja.id);
    }
  };

  const confirmarSelecaoComJustificativa = async () => {
    if (!modalJustificativa.justificativa.trim()) {
      setError("Por favor, informe o motivo de pular a loja anterior.");
      return;
    }

    try {
      // Salvar justificativa via API
      await api.post(`/roteiros/${id}/justificar-ordem`, {
        lojaId: modalJustificativa.lojaId,
        lojaIdEsperada: modalJustificativa.lojaIdEsperada,
        justificativa: modalJustificativa.justificativa,
      });

      const loja = roteiro.lojas.find(
        (l) => l.id === modalJustificativa.lojaId,
      );
      setLojaSelecionada(loja);

      // Verificar manutenções
      if (loja && loja.id) {
        await verificarManutencoesPendentes(loja.id);
      }

      setModalJustificativa({
        aberto: false,
        lojaId: null,
        lojaNome: "",
        lojaIdEsperada: null,
        lojaEsperadaNome: "",
        justificativa: "",
      });
    } catch (err) {
      setError("Erro ao salvar justificativa.");
    }
  };

  const handleManutencaoConcluida = async () => {
    setSuccess("Manutenção processada com sucesso!");
    setModalManutencao(false);
    setManutencaoPendente(null);
    // Recarregar roteiro para atualizar status
    await carregarRoteiro();
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

  const observacaoAdmin = String(roteiro.observacao || "").trim();

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
        {observacaoAdmin && (
          <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-1">
              Observações do Admin
            </h3>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">
              {observacaoAdmin}
            </p>
          </section>
        )}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">
            Selecione uma loja para movimentar:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roteiro.lojas && roteiro.lojas.length > 0 ? (
              [...roteiro.lojas]
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((loja, index) => (
                  <button
                    key={loja.id}
                    onClick={() => handleSelecionarLoja(loja)}
                    className={`p-4 rounded-lg shadow border-2 font-bold text-lg transition-all flex flex-col items-start 
                      ${lojaSelecionada?.id === loja.id ? "border-blue-600" : "border-transparent"}
                      ${lojaEstaConcluida(loja.status) ? "bg-green-100 border-green-600 text-green-700" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="bg-[#24094E] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span>🏪 {loja.nome}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-9">
                      {loja.cidade}, {loja.estado}
                    </span>
                    {lojaEstaConcluida(loja.status) && (
                      <span className="mt-1 ml-9 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                        Concluída
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

        <Modal
          isOpen={modalJustificativa.aberto}
          onClose={() =>
            setModalJustificativa({
              aberto: false,
              lojaId: null,
              lojaNome: "",
              lojaIdEsperada: null,
              lojaEsperadaNome: "",
              justificativa: "",
            })
          }
          title="Justificar alteração de ordem"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-yellow-800 font-semibold mb-2">
                ⚠️ Você está pulando a ordem das lojas!
              </p>
              <p className="text-sm text-yellow-700">
                Loja esperada:{" "}
                <span className="font-bold">
                  {modalJustificativa.lojaEsperadaNome}
                </span>
              </p>
              <p className="text-sm text-yellow-700">
                Loja selecionada:{" "}
                <span className="font-bold">{modalJustificativa.lojaNome}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Por que você está pulando a ordem?
              </label>
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="4"
                placeholder="Ex: A loja estava fechada, problema de acesso, etc."
                value={modalJustificativa.justificativa}
                onChange={(e) =>
                  setModalJustificativa((prev) => ({
                    ...prev,
                    justificativa: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() =>
                  setModalJustificativa({
                    aberto: false,
                    lojaId: null,
                    lojaNome: "",
                    lojaIdEsperada: null,
                    lojaEsperadaNome: "",
                    justificativa: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarSelecaoComJustificativa}
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>

        <ManutencaoModal
          isOpen={modalManutencao}
          onClose={() => setModalManutencao(false)}
          manutencao={manutencaoPendente}
          lojaId={lojaSelecionada?.id}
          usuarioId={usuario?.id}
          usuarioNome={usuario?.nome}
          onManutencaoConcluida={handleManutencaoConcluida}
        />
      </main>
      <Footer />
    </div>
  );
}
