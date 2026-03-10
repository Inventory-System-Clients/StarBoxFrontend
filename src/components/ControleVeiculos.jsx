import React, { useState, useContext, useEffect } from "react";
import Swal from "sweetalert2";
import { AuthContext } from "../contexts/AuthContext";
import { reconhecerAlertaRevisao } from "../services/revisoesVeiculos";

import api from "../services/api";
const emojiVeiculo = (tipo, emoji) => emoji || (tipo === "moto" ? "🏍️" : "🚗");
export default function ControleVeiculos({
  veiculos = [],
  onRefresh,
  loading,
}) {
  const { usuario } = useContext(AuthContext);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [form, setForm] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    modo: "trabalho",
    combustivel: "5",
    limpeza: "esta limpo",
  });
  const [formFinalizar, setFormFinalizar] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    combustivel: "5",
    limpeza: "esta limpo",
  });

  const handleReconhecerAlerta = async (veiculoId) => {
    try {
      await reconhecerAlertaRevisao(veiculoId);
      Swal.fire({
        icon: "success",
        title: "Alerta Reconhecido",
        text: "O alerta de revisão foi reconhecido com sucesso",
        confirmButtonColor: "#62A1D9",
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao reconhecer alerta:", error);
      // Não mostrar erro se funcionalidade não está disponível ainda
      if (error?.message?.includes("ainda não disponível")) {
        Swal.fire({
          icon: "info",
          title: "Funcionalidade em Desenvolvimento",
          text: error.message,
          confirmButtonColor: "#62A1D9",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Não foi possível reconhecer o alerta",
          confirmButtonColor: "#62A1D9",
        });
      }
    }
  };

  const abrirModal = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setForm({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      modo: "trabalho",
      combustivel: "5",
      limpeza: "esta limpo",
    });
    setModalAberto(true);
  };

  const abrirModalFinalizar = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setFormFinalizar({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      combustivel: "5",
      limpeza: "esta limpo",
    });
    setModalFinalizarAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setVeiculoSelecionado(null);
  };
  const fecharModalFinalizar = () => {
    setModalFinalizarAberto(false);
    setVeiculoSelecionado(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleFormFinalizarChange = (e) => {
    const { name, value } = e.target;
    setFormFinalizar((prev) => ({ ...prev, [name]: value }));
  };

  // Exemplo: para atualizar o status do veículo na API, use fetch/axios e depois onRefresh()
  const pilotarVeiculo = async () => {
    if (!veiculoSelecionado || salvando) return;
    setSalvando(true);
    try {
      const kmValue = form.km === "" ? 0 : parseInt(form.km, 10);
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        ...veiculoSelecionado,
        emUso: true,
        km: kmValue,
        estado: form.estado,
        modo: form.modo,
        nivelCombustivel: getCombustivelLabel(form.combustivel),
        nivelLimpeza: form.limpeza,
      });
      // Registrar movimentação de retirada
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        tipo: "retirada",
        gasolina: form.combustivel
          ? getCombustivelLabel(form.combustivel)
          : undefined,
        nivel_limpeza: form.limpeza,
        estado: form.estado,
        modo: form.modo,
        obs: form.obs || undefined,
        km: kmValue,
      });
      if (onRefresh) onRefresh();
      fecharModal();
    } catch (error) {
      console.error("Erro ao pilotar:", error);
      Swal.fire("Erro", "Não foi possível iniciar o uso do veículo.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const finalizarVeiculo = async () => {
    if (!veiculoSelecionado || finalizando) return;
    setFinalizando(true);
    try {
      const kmValue =
        formFinalizar.km === "" ? 0 : parseInt(formFinalizar.km, 10);
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        ...veiculoSelecionado,
        emUso: false,
        km: kmValue,
        estado: formFinalizar.estado,
        nivelCombustivel: getCombustivelLabel(formFinalizar.combustivel),
        nivelLimpeza: formFinalizar.limpeza,
      });
      // Registrar movimentação de devolução
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        tipo: "devolucao",
        gasolina: formFinalizar.combustivel
          ? getCombustivelLabel(formFinalizar.combustivel)
          : undefined,
        nivel_limpeza: formFinalizar.limpeza,
        estado: formFinalizar.estado,
        modo: veiculoSelecionado.modo,
        obs: formFinalizar.obs || undefined,
        km: kmValue,
      });
      if (onRefresh) onRefresh();
      Swal.fire({
        icon: "success",
        title: `${usuario?.nome || "Funcionário"} guardou ${veiculoSelecionado?.nome}`,
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
      fecharModalFinalizar();
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      Swal.fire("Erro", "Não foi possível finalizar o veículo.", "error");
    } finally {
      setFinalizando(false);
    }
  };

  // Função para exibir o texto do combustível
  function getCombustivelLabel(valor) {
    switch (valor) {
      case "5":
        return "5 palzinhos";
      case "4":
        return "4 palzinhos";
      case "3":
        return "3 palzinhos";
      case "2":
        return "2 palzinhos";
      case "1":
        return "1 palzinho";
      case "0":
        return "Vazio";
      default:
        return valor;
    }
  }

  const [ultimasMovs, setUltimasMovs] = useState({});

  useEffect(() => {
    // Busca a última movimentação de cada veículo
    async function fetchUltimasMovs() {
      try {
        const { data } = await api.get("/movimentacao-veiculos/ultimas");
        // Espera que a API retorne um objeto { [veiculoId]: movimentacao }
        setUltimasMovs(data || {});
      } catch (error) {
        setUltimasMovs({});
        console.error("Erro ao buscar últimas movimentações:", error);
      }
    }
    fetchUltimasMovs();
  }, [veiculos]);

  if (loading) return <div className="p-6">Carregando veículos...</div>;

  // Contar veículos com alerta de revisão
  const veiculosComAlerta = veiculos.filter(v => v.alertaRevisaoPendente);
  const totalAlertas = veiculosComAlerta.length;

  const reconhecerTodosAlertas = async () => {
    try {
      await Promise.all(
        veiculosComAlerta.map(v => reconhecerAlertaRevisao(v.id))
      );
      Swal.fire({
        icon: "success",
        title: "Alertas Reconhecidos",
        text: `${totalAlertas} alerta(s) reconhecido(s) com sucesso`,
        confirmButtonColor: "#62A1D9",
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao reconhecer alertas:", error);
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: "Não foi possível reconhecer todos os alertas",
        confirmButtonColor: "#62A1D9",
      });
    }
  };

  return (
    <div className="p-6">
      {/* Banner de Alertas no Topo */}
      {totalAlertas > 0 && (
        <div className="mb-6 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl p-6 shadow-xl border-2 border-orange-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">⚠️</span>
                <h3 className="text-2xl font-bold">
                  {totalAlertas} veículo{totalAlertas > 1 ? 's' : ''} precisa{totalAlertas === 1 ? '' : 'm'} de revisão
                </h3>
              </div>
              <p className="text-sm mb-3 leading-relaxed">
                Os seguintes veículos atingiram a quilometragem de revisão:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {veiculosComAlerta.map(v => (
                  <li key={v.id}>
                    <strong>{v.nome}</strong> - {v.km?.toLocaleString('pt-BR')} km
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={reconhecerTodosAlertas}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold py-3 px-6 rounded-lg transition-colors shadow-lg whitespace-nowrap"
            >
              OK, Reconhecer Todos
            </button>
          </div>
        </div>
      )}
      
      {/* Lista de Veículos */}
      <div className="flex flex-wrap gap-6">{veiculos.map((veiculo) => {
        const mov = ultimasMovs[veiculo.id];
        const isRuim = mov?.estado?.toLowerCase() === "ruim";
        const precisaLimpar = mov?.nivel_limpeza
          ?.toLowerCase()
          .includes("precisa");
        let cardClass = veiculo.emUso
          ? "filter grayscale opacity-70"
          : "bg-white";
        if (isRuim && precisaLimpar) {
          cardClass += " bg-red-100 border-2 border-red-400";
        } else if (isRuim) {
          cardClass += " bg-red-100 border-2 border-red-400";
        } else if (precisaLimpar) {
          cardClass += " bg-yellow-100 border-2 border-yellow-400";
        }
        return (
          <div
            key={veiculo.id}
            className={`rounded-lg shadow-md p-4 w-64 transition-all relative ${cardClass}`}
          >
            {/* Alerta de Revisão Pendente */}
            {veiculo.alertaRevisaoPendente && (
              <div className="mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-3 shadow-lg border-2 border-orange-600">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">⚠️</span>
                      <span className="font-bold text-sm">REVISÃO NECESSÁRIA</span>
                    </div>
                    <p className="text-xs leading-tight">
                      Este veículo atingiu {veiculo.km?.toLocaleString('pt-BR')} km e precisa de revisão!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleReconhecerAlerta(veiculo.id)}
                  className="mt-2 w-full bg-white text-orange-600 hover:bg-orange-50 text-xs font-bold py-1.5 px-3 rounded transition-colors"
                >
                  OK, Entendi
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-2xl mb-2">
              <span>{emojiVeiculo(veiculo.tipo, veiculo.emoji)}</span>
              <span className="font-bold text-lg">{veiculo.nome}</span>
            </div>
            <div className="text-gray-600 text-sm mb-2">
              Modelo: {veiculo.modelo}
            </div>
            <div className="flex gap-4 mb-2">
              <div>
                <div className="text-xs text-gray-500">Estado</div>
                <div>{veiculo.estado}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Km</div>
                <div>{veiculo.km}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Gasolina</div>
                <div>
                  {veiculo.nivelCombustivel || veiculo.combustivel || "-"}
                </div>
              </div>
            </div>
            {!veiculo.emUso ? (
              <button
                className="mt-2 px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50"
                onClick={() => abrirModal(veiculo)}
                disabled={veiculo.emUso}
              >
                Pilotar
              </button>
            ) : (
              <>
                <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                  Em uso
                </div>
                <button
                  className="mt-2 px-4 py-1 bg-[#733D38] text-white rounded hover:bg-[#A6806A]"
                  onClick={() => abrirModalFinalizar(veiculo)}
                >
                  Finalizar
                </button>
              </>
            )}
          </div>
        );
      })}
      </div>
      {/* Modal Finalizar */}
      {modalFinalizarAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Finalizar uso de {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={formFinalizar.estado}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Sem avaria</option>
                <option value="Ruim">Com avaria</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={formFinalizar.obs}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km final</label>
              <input
                name="km"
                type="number"
                value={formFinalizar.km}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={formFinalizar.combustivel}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="5">5 palzinhos</option>
                <option value="4">4 palzinhos</option>
                <option value="3">3 palzinhos</option>
                <option value="2">2 palzinhos</option>
                <option value="1">1 palzinho</option>
                <option value="0">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={formFinalizar.limpeza}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-[#A6806A] text-white rounded hover:bg-[#733D38]"
                onClick={fecharModalFinalizar}
                disabled={finalizando}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={finalizarVeiculo}
                disabled={finalizando}
              >
                {finalizando ? "Finalizando..." : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Pilotar {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Sem avaria</option>
                <option value="Ruim">Com avaria</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km inicial</label>
              <input
                name="km"
                type="number"
                value={form.km}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Modo</label>
              <select
                name="modo"
                value={form.modo}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="trabalho">Trabalho</option>
                <option value="emprestado">Emprestado</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={form.combustivel}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="5">5 palzinhos</option>
                <option value="4">4 palzinhos</option>
                <option value="3">3 palzinhos</option>
                <option value="2">2 palzinhos</option>
                <option value="1">1 palzinho</option>
                <option value="0">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={form.limpeza}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-[#A6806A] text-white rounded hover:bg-[#733D38]"
                onClick={fecharModal}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={pilotarVeiculo}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Pilotar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
