import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Modal, AlertBox } from "../components/UIComponents";

export function Roteiros() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  // --- ESTADOS DE DADOS ---
  const [roteiros, setRoteiros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [todasLojas, setTodasLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- DIAS DA SEMANA ---
  const DIAS_SEMANA = [
    { label: "SEG", full: "Segunda" },
    { label: "TER", full: "Terça" },
    { label: "QUA", full: "Quarta" },
    { label: "QUI", full: "Quinta" },
    { label: "SEX", full: "Sexta" },
    { label: "SAB", full: "Sábado" },
    { label: "DOM", full: "Domingo" },
  ];

  // diasPendentes: { [roteiroId]: string[] } — alterações locais antes de salvar
  const [diasPendentes, setDiasPendentes] = useState({});
  const [salvandoDias, setSalvandoDias] = useState({});

  const getDiasRoteiro = (roteiro) => {
    if (diasPendentes[roteiro.id] !== undefined) return diasPendentes[roteiro.id];
    return roteiro.diasSemana || [];
  };

  const toggleDia = (roteiroId, dia) => {
    setDiasPendentes((prev) => {
      const atual = prev[roteiroId] !== undefined
        ? prev[roteiroId]
        : (roteiros.find((r) => r.id === roteiroId)?.diasSemana || []);
      const novo = atual.includes(dia)
        ? atual.filter((d) => d !== dia)
        : [...atual, dia];
      return { ...prev, [roteiroId]: novo };
    });
  };

  const salvarDias = async (roteiroId) => {
    const dias = diasPendentes[roteiroId];
    if (dias === undefined) return;
    try {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}`, { diasSemana: dias });
      setDiasPendentes((prev) => {
        const c = { ...prev };
        delete c[roteiroId];
        return c;
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao salvar dias do roteiro.");
    } finally {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  // --- ESTADOS DE MODAL ---
  const [showModalCriarRoteiro, setShowModalCriarRoteiro] = useState(false);
  const [showModalAdicionarLoja, setShowModalAdicionarLoja] = useState(false);
  const [novoNomeRoteiro, setNovoNomeRoteiro] = useState("");
  const [novosDiasRoteiro, setNovosDiasRoteiro] = useState([]);
  const [roteiroParaAdicionar, setRoteiroParaAdicionar] = useState(null);
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    roteiro: null,
    loading: false,
  });

  // --- ESTADOS DE DRAG & DROP ---
  const [draggedLoja, setDraggedLoja] = useState(null);
  const [draggedFromRoteiro, setDraggedFromRoteiro] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);

  // Depende de usuario?.role para esperar o AuthContext hidratar do localStorage
  useEffect(() => {
    if (usuario === undefined) return; // ainda inicializando
    carregarDadosIniciais();
  }, [usuario?.role]);

  const carregarDadosIniciais = async () => {
    try {
      setLoading(true);
      const promises = [
        api.get("/roteiros/com-status"),
        api.get("/lojas"),
          usuario?.role === "ADMIN"
            ? api.get("/usuarios/funcionarios")
            : Promise.resolve({ data: [] }),
      ];
      const [resRoteiros, resLojas, resFuncionarios] = await Promise.all(promises);
      setRoteiros(resRoteiros.data || []);
      setTodasLojas(resLojas.data || []);
      setFuncionarios(resFuncionarios.data || []);
    } catch (err) {
      setError("Erro ao carregar dados dos roteiros.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES ---
  const handleCriarRoteiro = async () => {
    try {
      await api.post("/roteiros", { nome: novoNomeRoteiro, diasSemana: novosDiasRoteiro });
      setNovoNomeRoteiro("");
      setNovosDiasRoteiro([]);
      setShowModalCriarRoteiro(false);
      setSuccess("Roteiro criado com sucesso!");
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao criar roteiro.");
    }
  };

  const handleMoverLoja = async (lojaId, origemId, destinoId) => {
    try {
      await api.post("/roteiros/mover-loja", {
        lojaId,
        roteiroOrigemId: origemId,
        roteiroDestinoId: destinoId,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao mover loja.");
    }
  };

  const handleReordenarLoja = async (roteiroId, lojaId, novaOrdem) => {
    try {
      await api.patch(`/roteiros/${roteiroId}/reordenar-loja`, {
        lojaId,
        novaOrdem,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao reordenar loja.");
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    const roteiro = modalFinalizar.roteiro;
    if (!roteiro) return;

    try {
      setError("");
      setSuccess("");
      setModalFinalizar((prev) => ({ ...prev, loading: true }));

      const res = await api.post(`/roteiros/${roteiro.id}/finalizar`);
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomesPendentes = pendencias
          .map((item) => item.maquinaNome)
          .slice(0, 4)
          .join(", ");
        const sufixoMais =
          pendencias.length > 4 ? ` e mais ${pendencias.length - 4}` : "";
        setSuccess(
          `Roteiro finalizado com pendências: ${nomesPendentes}${sufixoMais}. Alerta WhatsApp: ${res?.data?.alertaWhatsApp?.status || "não enviado"}.`,
        );
      } else {
        setSuccess("Roteiro finalizado com sucesso!");
      }

      setModalFinalizar({
        aberto: false,
        etapa: 1,
        roteiro: null,
        loading: false,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao finalizar roteiro.");
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = (roteiro) => {
    setModalFinalizar({
      aberto: true,
      etapa: 1,
      roteiro,
      loading: false,
    });
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({
      aberto: false,
      etapa: 1,
      roteiro: null,
      loading: false,
    });
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  // --- DRAG AND DROP HANDLERS ---
  const onDragStart = (loja, roteiroId) => {
    if (usuario?.role !== "ADMIN") return;
    setDraggedLoja(loja);
    setDraggedFromRoteiro(roteiroId);
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    setDraggedOverIndex(index);
  };

  const onDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const onDrop = (e, roteiroDestinoId, dropIndex = null) => {
    e.preventDefault();
    setDraggedOverIndex(null);
    
    if (!draggedLoja) return;

    // Se é o mesmo roteiro, reordenar
    if (draggedFromRoteiro === roteiroDestinoId && dropIndex !== null) {
      handleReordenarLoja(roteiroDestinoId, draggedLoja.id, dropIndex);
    } 
    // Se é roteiro diferente, mover
    else if (draggedFromRoteiro !== roteiroDestinoId) {
      handleMoverLoja(draggedLoja.id, draggedFromRoteiro, roteiroDestinoId);
    }
    
    setDraggedLoja(null);
    setDraggedFromRoteiro(null);
  };

  if (loading)
    return (
      <div className="p-20 text-center font-bold">Carregando roteiros...</div>
    );

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🗺️ Gestão de Roteiros</h1>
          {usuario?.role === "ADMIN" && (
            <button
              onClick={() => setShowModalCriarRoteiro(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-shadow shadow-md"
            >
              + Novo Roteiro
            </button>
          )}
        </div>

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

        {/* Funcionários veem só os roteiros atribuídos a eles */}
        {usuario?.role !== "ADMIN" && roteiros.filter(r => String(r.funcionarioId) === String(usuario?.id)).length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700 font-medium mb-6">
            Nenhum roteiro atribuído a você no momento.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(usuario?.role === "ADMIN"
            ? roteiros
            : roteiros.filter(r => String(r.funcionarioId) === String(usuario?.id))
          ).map((roteiro) => (
            <div
              key={roteiro.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, roteiro.id)}
              className={`rounded-xl shadow-lg p-6 border-2 transition-all 
                ${roteiro.status === "finalizado" ? "bg-green-50 border-green-600" : "bg-white border-transparent"}
                ${draggedLoja && draggedFromRoteiro !== roteiro.id ? "border-blue-400 border-dashed bg-blue-50" : ""}
              `}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  {roteiro.nome}
                  {roteiro.status === "finalizado" && (
                    <span className="ml-2 px-2 py-1 rounded-full bg-green-200 text-green-800 text-xs font-bold uppercase">
                      Finalizado
                    </span>
                  )}
                </h2>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${roteiro.funcionarioId ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                >
                  {roteiro.funcionarioId ? "Ativo" : "Pendente"}
                </span>
              </div>

              {/* Seção de Funcionário */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1">
                  RESPONSÁVEL
                </label>
                {usuario?.role === "ADMIN" ? (
                  <select
                    className="w-full p-2 text-sm border rounded bg-gray-50"
                    value={String(roteiro.funcionarioId || "")}
                    onChange={async (e) => {
                      const rawId = e.target.value;
                      // IDs são UUID — não converter para número
                      const funcionarioId = rawId || null;
                      const f = funcionarios.find((x) => String(x.id) === rawId);
                      const funcionarioNome = f?.nome || "";

                      // Atualização optimista para não flickar o select
                      setRoteiros((prev) =>
                        prev.map((r) =>
                          r.id === roteiro.id
                            ? { ...r, funcionarioId, funcionarioNome }
                            : r
                        )
                      );

                      try {
                        await api.post(`/roteiros/${roteiro.id}/iniciar`, {
                          funcionarioId,
                          funcionarioNome,
                        });
                        setSuccess(`Funcionário ${funcionarioNome || "removido"} atribuído com sucesso.`);
                        // Recarregar dados do backend para garantir persistência
                        carregarDadosIniciais();
                      } catch (err) {
                        setError("Erro ao atribuir funcionário ao roteiro.");
                        // Reverter se falhou
                        setRoteiros((prev) =>
                          prev.map((r) =>
                            r.id === roteiro.id
                              ? { ...r, funcionarioId: roteiro.funcionarioId, funcionarioNome: roteiro.funcionarioNome }
                              : r
                          )
                        );
                      }
                    }}
                  >
                    <option value="">Selecione um funcionário</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">
                    {roteiro.funcionarioNome || "Não atribuído"}
                  </p>
                )}
              </div>

              {/* Seção Dias da Semana */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  DIAS DA SEMANA
                </label>
                <div className="flex flex-wrap gap-1">
                  {DIAS_SEMANA.map(({ label, full }) => {
                    const selecionado = getDiasRoteiro(roteiro).includes(label);
                    return (
                      <button
                        key={label}
                        title={full}
                        disabled={usuario?.role !== "ADMIN"}
                        onClick={() => toggleDia(roteiro.id, label)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors border
                          ${selecionado
                            ? "bg-[#24094E] text-white border-[#24094E]"
                            : "bg-gray-100 text-gray-400 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"}
                          ${usuario?.role !== "ADMIN" ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {usuario?.role === "ADMIN" && diasPendentes[roteiro.id] !== undefined && (
                  <button
                    onClick={() => salvarDias(roteiro.id)}
                    disabled={salvandoDias[roteiro.id]}
                    className="mt-2 w-full py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {salvandoDias[roteiro.id] ? "Salvando..." : "Salvar dias"}
                  </button>
                )}
              </div>

              {/* Lista de Lojas */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-400">
                    LOJAS NO DIA
                  </span>
                  {usuario?.role === "ADMIN" && (
                    <button
                      onClick={() => {
                        setRoteiroParaAdicionar(roteiro);
                        setShowModalAdicionarLoja(true);
                      }}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
                <div className="min-h-[120px] bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {roteiro.lojas?.length > 0 ? (
                    roteiro.lojas
                      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                      .map((loja, index) => (
                        <div
                          key={loja.id}
                          draggable={usuario?.role === "ADMIN"}
                          onDragStart={() => onDragStart(loja, roteiro.id)}
                          onDragOver={(e) => onDragOver(e, index)}
                          onDragLeave={onDragLeave}
                          onDrop={(e) => onDrop(e, roteiro.id, index)}
                          className={`bg-white p-3 rounded-md border shadow-sm mb-2 text-sm flex items-center gap-2 transition-colors
                            ${usuario?.role === "ADMIN" ? "cursor-move hover:border-blue-300" : ""}
                            ${draggedOverIndex === index && draggedFromRoteiro === roteiro.id ? "border-blue-500 border-2 bg-blue-50" : "border-gray-200"}
                          `}
                        >
                          <span className="text-gray-400">☰</span>
                          <span className="bg-[#24094E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          🏪 {loja.nome}
                        </div>
                      ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 opacity-30">
                      <span className="text-2xl">📦</span>
                      <p className="text-[10px] font-bold">VAZIO</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação com lógica dinâmica */}
              <div className="flex gap-2 mt-auto">
                {!roteiro.status || roteiro.status === "pendente" ? (
                  <>
                    <button
                      onClick={() =>
                        navigate(`/roteiros/${roteiro.id}/executar`)
                      }
                      className="flex-1 bg-[#24094E] text-white py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors"
                    >
                      {roteiro.funcionarioId ? "Continuar" : "Começar Rota"}
                    </button>
                    {roteiro.funcionarioId && (
                      <button
                        onClick={() => abrirModalFinalizacao(roteiro)}
                        className="bg-green-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                      >
                        Finalizar
                      </button>
                    )}
                  </>
                ) : roteiro.status === "finalizado" ? (
                  <button
                    disabled
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm cursor-default opacity-90"
                  >
                    Finalizado
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL CRIAR ROTEIRO */}
      {showModalCriarRoteiro && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Criar Novo Roteiro</h2>
            <input
              autoFocus
              className="w-full p-3 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Roteiro Norte - Seg"
              value={novoNomeRoteiro}
              onChange={(e) => setNovoNomeRoteiro(e.target.value)}
            />
            <label className="text-xs font-bold text-gray-400 block mb-2">
              DIAS DA SEMANA
            </label>
            <div className="flex flex-wrap gap-2 mb-5">
              {DIAS_SEMANA.map(({ label, full }) => {
                const selecionado = novosDiasRoteiro.includes(label);
                return (
                  <button
                    key={label}
                    title={full}
                    type="button"
                    onClick={() =>
                      setNovosDiasRoteiro((prev) =>
                        prev.includes(label)
                          ? prev.filter((d) => d !== label)
                          : [...prev, label]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors
                      ${selecionado
                        ? "bg-[#24094E] text-white border-[#24094E]"
                        : "bg-gray-100 text-gray-500 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModalCriarRoteiro(false); setNovosDiasRoteiro([]); }}
                className="flex-1 py-3 text-gray-500 font-bold"
              >
                Voltar
              </button>
              <button
                onClick={handleCriarRoteiro}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR LOJA (Simplificado) */}
      {showModalAdicionarLoja && roteiroParaAdicionar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              Adicionar Loja a {roteiroParaAdicionar.nome}
            </h2>
            <div className="overflow-y-auto space-y-2 mb-4">
              {todasLojas.map((loja) => (
                <button
                  key={loja.id}
                  onClick={() => {
                    handleMoverLoja(loja.id, null, roteiroParaAdicionar.id);
                    setShowModalAdicionarLoja(false);
                  }}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-xl border flex justify-between items-center group"
                >
                  <span className="font-medium text-sm">🏪 {loja.nome}</span>
                  <span className="text-blue-500 opacity-0 group-hover:opacity-100 font-bold text-xs">
                    + ADICIONAR
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModalAdicionarLoja(false)}
              className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
              ? `Deseja finalizar o roteiro ${modalFinalizar.roteiro?.nome || ""}?`
              : "Confirma novamente a finalização deste roteiro?"}
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
                {modalFinalizar.loading
                  ? "Finalizando..."
                  : "Finalizar Roteiro"}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
