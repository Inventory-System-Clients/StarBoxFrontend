import { useState, useEffect } from "react";
import { Modal } from "./UIComponents";
import api from "../services/api";

/**
 * Modal para lidar com manutenções pendentes durante execução de roteiro
 * @param {Object} props
 * @param {boolean} props.isOpen - Se o modal está aberto
 * @param {Function} props.onClose - Callback para fechar o modal
 * @param {Object} props.manutencao - Objeto da manutenção pendente
 * @param {number} props.lojaId - ID da loja
 * @param {number} props.usuarioId - ID do funcionário/usuário
 * @param {Function} props.onManutencaoConcluida - Callback após conclusão
 */
export default function ManutencaoModal({
  isOpen,
  onClose,
  manutencao,
  lojaId,
  usuarioId,
  onManutencaoConcluida,
}) {
  console.log('🔧 ManutencaoModal props:', { isOpen, usuarioId, manutencao: manutencao?.id });
  
  const [etapa, setEtapa] = useState("escolha"); // 'escolha', 'fazer', 'nao-fazer'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estado para fazer manutenção
  const [pecaSelecionada, setPecaSelecionada] = useState("");
  const [explicacaoSemPeca, setExplicacaoSemPeca] = useState("");
  const [pecasCarrinho, setPecasCarrinho] = useState([]);
  const [carregandoCarrinho, setCarregandoCarrinho] = useState(false);

  // Estado para não fazer manutenção
  const [explicacaoNaoFazer, setExplicacaoNaoFazer] = useState("");

  const resetarModal = () => {
    console.log('🔄 Resetando modal');
    setEtapa("escolha");
    setPecaSelecionada("");
    setExplicacaoSemPeca("");
    setExplicacaoNaoFazer("");
    setError("");
  };

  useEffect(() => {
    if (isOpen && usuarioId) {
      console.log('🔔 Modal aberto para usuário:', usuarioId);
      resetarModal();
      carregarCarrinho();
    } else if (!isOpen) {
      // Limpar ao fechar
      resetarModal();
      setPecasCarrinho([]);
    }
  }, [isOpen, usuarioId, manutencao?.id]);

  const carregarCarrinho = async () => {
    try {
      setCarregandoCarrinho(true);
      console.log('🛒 Carregando carrinho do usuário:', usuarioId);
      const res = await api.get(`/usuarios/${usuarioId}/carrinho`);
      console.log('📦 Peças do carrinho recebidas:', res.data);
      setPecasCarrinho(res.data || []);
    } catch (err) {
      console.error("❌ Erro ao carregar carrinho:", err);
      console.error("Response:", err?.response?.data);
      setPecasCarrinho([]);
    } finally {
      setCarregandoCarrinho(false);
    }
  };

  const handleFazerManutencao = async () => {
    // Validar
    if (pecaSelecionada !== "nao-usar" && !pecaSelecionada) {
      setError("Selecione uma peça ou 'Não usar peças'");
      return;
    }

    // Se não usar peça, a explicação é obrigatória
    if (pecaSelecionada === "nao-usar" && (!explicacaoSemPeca || explicacaoSemPeca.trim().length === 0)) {
      setError("Digite a explicação de porque não usou peças (obrigatório)");
      return;
    }

    if (explicacaoSemPeca.length > 100) {
      setError("A observação deve ter no máximo 100 caracteres");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        status: "feito",
        pecaId: pecaSelecionada !== "nao-usar" ? pecaSelecionada : null,
        explicacao_sem_peca: explicacaoSemPeca.trim() ? explicacaoSemPeca : null,
        concluidoPorId: usuarioId,
      };

      await api.put(`/manutencoes/${manutencao.id}/concluir`, payload);

      // Se usou uma peça, tentar remover do carrinho
      if (pecaSelecionada && pecaSelecionada !== "nao-usar") {
        try {
          await api.delete(`/usuarios/${usuarioId}/carrinho/${pecaSelecionada}`);
        } catch (carrinhoErr) {
          // Erro 403 = backend ainda não deployado; ignora silenciosamente
          if (carrinhoErr?.response?.status !== 403) {
            console.error("Erro ao remover peça do carrinho:", carrinhoErr);
          }
        }
      }

      onManutencaoConcluida?.();
      resetarModal();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao concluir manutenção");
    } finally {
      setLoading(false);
    }
  };

  const handleNaoFazerManutencao = async () => {
    if (!explicacaoNaoFazer || explicacaoNaoFazer.trim().length === 0) {
      setError("Digite a explicação de porque não fez a manutenção (obrigatório)");
      return;
    }

    if (explicacaoNaoFazer.length > 100) {
      setError("A explicação deve ter no máximo 100 caracteres");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        explicacao_nao_fazer: explicacaoNaoFazer,
        verificadoPorId: usuarioId,
      };

      await api.put(`/manutencoes/${manutencao.id}/nao-fazer`, payload);

      onManutencaoConcluida?.();
      resetarModal();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    resetarModal();
    onClose();
  };

  if (!manutencao) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        etapa === "escolha"
          ? "⚠️ Manutenção Pendente"
          : etapa === "fazer"
            ? "🔧 Fazer Manutenção"
            : "📝 Não Fazer Manutenção"
      }
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {etapa === "escolha" && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-bold text-yellow-800 mb-2">
                Esta loja tem uma manutenção pendente:
              </p>
              <p className="text-sm text-gray-700">
                <strong>Descrição:</strong> {manutencao.descricao}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Máquina:</strong> {manutencao.maquina?.nome || "-"}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Loja:</strong> {manutencao.loja?.nome || "-"}
              </p>
            </div>

            <p className="text-gray-700">
              Você deseja fazer esta manutenção agora ou prosseguir sem fazê-la?
            </p>

            <div className="flex flex-col gap-3 mt-6">
              <button
                className="btn-primary w-full"
                onClick={() => setEtapa("fazer")}
              >
                🔧 Fazer Manutenção
              </button>
              <button
                className="btn-secondary w-full"
                onClick={() => setEtapa("nao-fazer")}
              >
                ⏭️ Não Fazer Agora (Explicar)
              </button>
            </div>
          </>
        )}

        {etapa === "fazer" && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-bold text-blue-800 mb-2">
                Fazer manutenção: {manutencao.descricao}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Qual peça do seu carrinho você vai usar?
              </label>
              {carregandoCarrinho ? (
                <p className="text-sm text-gray-500">Carregando carrinho...</p>
              ) : (
                <>
                  <select
                    className="input-field w-full"
                    value={pecaSelecionada}
                    onChange={(e) => {
                      setPecaSelecionada(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="">Selecione uma peça</option>
                    {pecasCarrinho.map((peca) => {
                      // Tentar múltiplos campos para o ID da peça
                      const idPeca = peca.pecaId || peca.id || peca.Peca?.id;
                      const nomePeca = peca.nome || peca.Peca?.nome || peca.peca?.nome || "Peça desconhecida";
                      const qtd = peca.quantidade || 0;
                      
                      console.log('🔧 Peça no select:', { idPeca, nomePeca, qtd, peca });
                      
                      return (
                        <option key={idPeca} value={idPeca}>
                          {nomePeca} - Qtd: {qtd}
                        </option>
                      );
                    })}
                    <option value="nao-usar">❌ Não usar peças</option>
                  </select>
                  
                  {pecasCarrinho.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-2">
                      ⚠️ Você não tem peças no carrinho. Peça ao admin para adicionar peças.
                    </p>
                  )}
                  
                  {pecasCarrinho.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ℹ️ Você tem {pecasCarrinho.length} peça(s) disponível(eis) no carrinho
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {pecaSelecionada === "nao-usar" 
                  ? "Por que não vai usar peças? (máx. 100 caracteres) *" 
                  : "Observações sobre a manutenção (máx. 100 caracteres)"}
              </label>
              <textarea
                className="input-field w-full"
                rows="3"
                maxLength={100}
                value={explicacaoSemPeca}
                onChange={(e) => {
                  setExplicacaoSemPeca(e.target.value);
                  setError("");
                }}
                placeholder={pecaSelecionada === "nao-usar" 
                  ? "Ex: A peça necessária não está disponível no momento..." 
                  : "Ex: Máquina estava com problema no botão..."}
              />
              <p className="text-xs text-gray-500 mt-1">
                {explicacaoSemPeca.length}/100 caracteres
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setEtapa("escolha");
                  setPecaSelecionada("");
                  setExplicacaoSemPeca("");
                  setError("");
                }}
                disabled={loading}
              >
                ← Voltar
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleFazerManutencao}
                disabled={loading || !pecaSelecionada}
              >
                {loading ? "Processando..." : "✅ Concluir Manutenção"}
              </button>
            </div>
          </>
        )}

        {etapa === "nao-fazer" && (
          <>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-bold text-orange-800 mb-2">
                Você optou por NÃO fazer a manutenção agora
              </p>
              <p className="text-sm text-gray-700">
                É obrigatório explicar o motivo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Por que não fez a manutenção? (máx. 100 caracteres) *
              </label>
              <textarea
                className="input-field w-full"
                rows="3"
                maxLength={100}
                value={explicacaoNaoFazer}
                onChange={(e) => {
                  setExplicacaoNaoFazer(e.target.value);
                  setError("");
                }}
                placeholder="Ex: Não tinha a ferramenta necessária no momento..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {explicacaoNaoFazer.length}/100 caracteres
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setEtapa("escolha");
                  setExplicacaoNaoFazer("");
                  setError("");
                }}
                disabled={loading}
              >
                ← Voltar
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleNaoFazerManutencao}
                disabled={loading || !explicacaoNaoFazer.trim()}
              >
                {loading ? "Processando..." : "✅ Confirmar"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
