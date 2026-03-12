import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";

const INTERVALO_ALERTA_PERSISTENTE_DIAS = 45;
const STATUS_CONCLUIDOS = ["feito", "concluida"];

const statusEhConcluido = (status) =>
  STATUS_CONCLUIDOS.includes(String(status || "").toLowerCase());

function Manutencoes() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";

  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filtroLoja, setFiltroLoja] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("nao_concluidas");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const [showNovaManutencao, setShowNovaManutencao] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState({
    lojaId: "",
    maquinaId: "",
    funcionarioId: "",
    destinatarioWhatsAppId: "",
    descricao: "",
  });

  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [destinatariosWhatsApp, setDestinatariosWhatsApp] = useState([]);
  const [origemDestinatarioPadrao, setOrigemDestinatarioPadrao] = useState("");

  const [detalhe, setDetalhe] = useState(null);
  const [editando, setEditando] = useState(false);
  const [editData, setEditData] = useState({
    funcionarioId: "",
    status: "",
    descricao: "",
  });

  const carregarManutencoes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/manutencoes");
      setManutencoes(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar manutenções:", err?.response?.data || err);
      setError(err?.response?.data?.error || "Erro ao buscar manutenções.");
    } finally {
      setLoading(false);
    }
  };

  const carregarDadosFormulario = async () => {
    try {
      const [lojasRes, maquinasRes, funcionariosRes] = await Promise.all([
        api.get("/lojas"),
        api.get("/maquinas"),
        api.get("/usuarios/funcionarios"),
      ]);

      setLojas(lojasRes.data || []);
      setMaquinas(maquinasRes.data || []);
      setFuncionarios(funcionariosRes.data || []);
    } catch (err) {
      console.error(
        "Erro ao carregar dados auxiliares:",
        err?.response?.data || err,
      );
      setError("Erro ao carregar lojas, máquinas e funcionários.");
    }
  };

  const carregarDestinatariosWhatsApp = async (lojaId) => {
    if (!lojaId) {
      setDestinatariosWhatsApp([]);
      setOrigemDestinatarioPadrao("");
      setNovaManutencao((d) => ({
        ...d,
        destinatarioWhatsAppId: "",
      }));
      return;
    }

    try {
      const res = await api.get("/manutencao-whatsapp-prompts/destinatarios", {
        params: { lojaId },
      });

      const lista = Array.isArray(res.data?.funcionarios)
        ? res.data.funcionarios
        : [];

      setDestinatariosWhatsApp(lista);
      setOrigemDestinatarioPadrao(res.data?.origemPadrao || "");

      const defaultId = res.data?.defaultFuncionarioId
        ? String(res.data.defaultFuncionarioId)
        : "";

      setNovaManutencao((d) => ({
        ...d,
        destinatarioWhatsAppId: defaultId,
      }));
    } catch (err) {
      console.error(
        "Erro ao carregar destinatarios de WhatsApp:",
        err?.response?.data || err,
      );

      const fallback = (funcionarios || []).map((f) => ({
        id: f.id,
        nome: f.nome,
        telefone: f.telefone || null,
      }));

      setDestinatariosWhatsApp(fallback);
      setOrigemDestinatarioPadrao("");
      setNovaManutencao((d) => ({
        ...d,
        destinatarioWhatsAppId: "",
      }));
    }
  };

  useEffect(() => {
    carregarManutencoes();
  }, []);

  useEffect(() => {
    if (showNovaManutencao && isAdmin) {
      carregarDadosFormulario();
    }
  }, [showNovaManutencao, isAdmin]);

  const maquinasFiltradas = useMemo(() => {
    if (!novaManutencao.lojaId) return [];
    return maquinas.filter((m) => m.lojaId === novaManutencao.lojaId);
  }, [maquinas, novaManutencao.lojaId]);

  const lojasFiltro = useMemo(() => {
    return Array.from(
      new Set(manutencoes.map((m) => m.loja?.nome).filter(Boolean)),
    );
  }, [manutencoes]);

  const statusFiltro = useMemo(() => {
    return Array.from(
      new Set(manutencoes.map((m) => m.status).filter(Boolean)),
    );
  }, [manutencoes]);

  const filtradas = useMemo(() => {
    const dataInicioMs = filtroDataInicio
      ? new Date(`${filtroDataInicio}T00:00:00`).getTime()
      : null;
    const dataFimMs = filtroDataFim
      ? new Date(`${filtroDataFim}T23:59:59.999`).getTime()
      : null;

    return manutencoes.filter((m) => {
      if (!isAdmin) {
        if (m.funcionarioId !== usuario?.id) return false;
      }

      const dataManutencaoMs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(dataManutencaoMs)) return false;

      const okLoja = !filtroLoja || m.loja?.nome === filtroLoja;
      const okStatus =
        filtroStatus === "nao_concluidas"
          ? !statusEhConcluido(m.status)
          : !filtroStatus || m.status === filtroStatus;
      const okDataInicio =
        dataInicioMs === null || dataManutencaoMs >= dataInicioMs;
      const okDataFim = dataFimMs === null || dataManutencaoMs <= dataFimMs;

      return okLoja && okStatus && okDataInicio && okDataFim;
    });
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroLoja,
    filtroStatus,
    isAdmin,
    manutencoes,
    usuario?.id,
  ]);

  const manutencoesPersistentes = useMemo(() => {
    if (!isAdmin) return [];

    const limiteIntervaloMs =
      INTERVALO_ALERTA_PERSISTENTE_DIAS * 24 * 60 * 60 * 1000;

    const concluidas = manutencoes.filter(
      (m) => (m.status === "feito" || m.status === "concluida") && m.maquinaId,
    );

    const agrupadasPorMaquina = concluidas.reduce((acc, manutencao) => {
      const chave = String(manutencao.maquinaId);
      if (!acc[chave]) acc[chave] = [];
      acc[chave].push(manutencao);
      return acc;
    }, {});

    const persistentes = Object.values(agrupadasPorMaquina)
      .filter((lista) => lista.length > 1)
      .map((lista) => {
        const ordenadas = [...lista].sort((a, b) => {
          const dataA = new Date(a.concluidoEm || a.createdAt).getTime();
          const dataB = new Date(b.concluidoEm || b.createdAt).getTime();
          return dataB - dataA;
        });

        const dataAtualTs = new Date(
          ordenadas[0].concluidoEm || ordenadas[0].createdAt,
        ).getTime();
        const dataUltimaTs = new Date(
          ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        ).getTime();

        if (!Number.isFinite(dataAtualTs) || !Number.isFinite(dataUltimaTs)) {
          return null;
        }

        const intervaloEntreManutencoesMs = Math.abs(
          dataAtualTs - dataUltimaTs,
        );

        if (intervaloEntreManutencoesMs > limiteIntervaloMs) {
          return null;
        }

        return {
          maquinaId: ordenadas[0].maquinaId,
          maquinaNome: ordenadas[0].maquina?.codigo || "Máquina sem código",
          lojaNome: ordenadas[0].loja?.nome || "Loja não informada",
          dataAtual: ordenadas[0].concluidoEm || ordenadas[0].createdAt,
          dataUltima: ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.dataAtual).getTime() - new Date(a.dataAtual).getTime(),
      );

    return persistentes;
  }, [isAdmin, manutencoes]);

  const formatarDataHora = (valor) => {
    if (!valor) return "-";
    return new Date(valor).toLocaleString("pt-BR");
  };

  const resetFormularioNovaManutencao = () => {
    setShowNovaManutencao(false);
    setNovaManutencao({
      lojaId: "",
      maquinaId: "",
      funcionarioId: "",
      destinatarioWhatsAppId: "",
      descricao: "",
    });
    setDestinatariosWhatsApp([]);
    setOrigemDestinatarioPadrao("");
  };

  const abrirFormularioNovaManutencao = () => {
    setNovaManutencao({
      lojaId: "",
      maquinaId: "",
      funcionarioId: "",
      destinatarioWhatsAppId: "",
      descricao: "",
    });
    setDestinatariosWhatsApp([]);
    setOrigemDestinatarioPadrao("");
    setShowNovaManutencao(true);
  };

  const handleNovaManutencao = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload = {
        descricao: novaManutencao.descricao,
        lojaId: novaManutencao.lojaId,
        maquinaId: novaManutencao.maquinaId,
        funcionarioId: novaManutencao.funcionarioId || null,
      };

      const manutencaoRes = await api.post("/manutencoes", payload);

      let mensagemPosCadastro = "Manutenção criada com sucesso!";

      try {
        const promptRes = await api.post("/manutencao-whatsapp-prompts/gerar", {
          lojaId: novaManutencao.lojaId,
          maquinaId: novaManutencao.maquinaId,
          manutencaoId: manutencaoRes?.data?.id || null,
          descricao: novaManutencao.descricao,
          funcionarioId: novaManutencao.destinatarioWhatsAppId || null,
        });

        const whatsappUrl = promptRes?.data?.whatsappUrl;
        if (whatsappUrl) {
          const popup = window.open(
            whatsappUrl,
            "_blank",
            "noopener,noreferrer",
          );

          if (!popup) {
            window.location.href = whatsappUrl;
          }
        }

        if (promptRes?.data?.aviso) {
          mensagemPosCadastro = `Manutenção criada com sucesso. ${promptRes.data.aviso}`;
        }
      } catch (promptErr) {
        console.error(
          "Erro ao gerar prompt de WhatsApp da manutenção:",
          promptErr?.response?.data || promptErr,
        );
        mensagemPosCadastro =
          "Manutenção criada com sucesso, mas não foi possível preparar o WhatsApp.";
      }

      resetFormularioNovaManutencao();
      setSuccess(mensagemPosCadastro);
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao criar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!detalhe) return;
    if (!window.confirm("Tem certeza que deseja excluir esta manutenção?"))
      return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.delete(`/manutencoes/${detalhe.id}`);
      setDetalhe(null);
      setSuccess("Manutenção excluída com sucesso!");
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao excluir manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = () => {
    setEditData({
      funcionarioId: detalhe?.funcionarioId || "",
      status: detalhe?.status || "pendente",
      descricao: detalhe?.descricao || "",
    });
    setEditando(true);
  };

  const handleEditSave = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/manutencoes/${detalhe.id}`, editData);
      setEditando(false);
      setDetalhe(null);
      setSuccess("Manutenção atualizada com sucesso!");
      await carregarManutencoes();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao atualizar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const marcarComoFeita = async () => {
    if (!detalhe) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/manutencoes/${detalhe.id}`, { status: "feito" });
      setDetalhe(null);
      setSuccess("Manutenção marcada como feita!");
      await carregarManutencoes();
    } catch (err) {
      setError(
        err?.response?.data?.error || "Erro ao marcar manutenção como feita.",
      );
    } finally {
      setLoading(false);
    }
  };

  const concluirManutencaoDaLinha = async (manutencao) => {
    if (!manutencao?.id) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/manutencoes/${manutencao.id}`, { status: "feito" });
      setSuccess("Manutenção marcada como feita!");
      await carregarManutencoes();
    } catch (err) {
      setError(
        err?.response?.data?.error || "Erro ao marcar manutenção como feita.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Manutenções"
          subtitle="Acompanhe todas as manutenções registradas"
          icon="🛠️"
        />

        {isAdmin && (
          <div className="mb-4">
            <button
              className="btn-primary"
              onClick={abrirFormularioNovaManutencao}
            >
              Nova Manutenção
            </button>
          </div>
        )}

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

        <div className="mb-4 flex flex-wrap gap-4">
          <select
            className="input-field"
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value)}
          >
            <option value="">Todas as lojas</option>
            {lojasFiltro.map((loja) => (
              <option key={loja} value={loja}>
                {loja}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="nao_concluidas">Não concluídas</option>
            <option value="">Todos os status</option>
            {statusFiltro.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Data inicial
            </label>
            <input
              className="input-field"
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              max={filtroDataFim || undefined}
              aria-label="Filtrar data inicial"
              title="Data inicial"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Data final
            </label>
            <input
              className="input-field"
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              min={filtroDataInicio || undefined}
              aria-label="Filtrar data final"
              title="Data final"
            />
          </div>
        </div>

        {showNovaManutencao && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
              onSubmit={handleNovaManutencao}
            >
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                type="button"
                onClick={resetFormularioNovaManutencao}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Nova Manutenção</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Loja</label>
                  <select
                    className="input-field w-full"
                    value={novaManutencao.lojaId}
                    onChange={(e) => {
                      const lojaId = e.target.value;
                      setNovaManutencao((d) => ({
                        ...d,
                        lojaId,
                        maquinaId: "",
                      }));
                      carregarDestinatariosWhatsApp(lojaId);
                    }}
                    required
                  >
                    <option value="">Selecione</option>
                    {lojas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Máquina</label>
                  <select
                    className="input-field w-full"
                    value={novaManutencao.maquinaId}
                    onChange={(e) =>
                      setNovaManutencao((d) => ({
                        ...d,
                        maquinaId: e.target.value,
                      }))
                    }
                    required
                    disabled={!novaManutencao.lojaId}
                  >
                    <option value="">Selecione</option>
                    {maquinasFiltradas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.codigo}{m.nome ? ` - ${m.nome}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">
                    Funcionário (opcional)
                  </label>
                  <select
                    className="input-field w-full"
                    value={novaManutencao.funcionarioId}
                    onChange={(e) =>
                      setNovaManutencao((d) => ({
                        ...d,
                        funcionarioId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">
                    Enviar WhatsApp para
                  </label>
                  <select
                    className="input-field w-full"
                    value={novaManutencao.destinatarioWhatsAppId}
                    onChange={(e) =>
                      setNovaManutencao((d) => ({
                        ...d,
                        destinatarioWhatsAppId: e.target.value,
                      }))
                    }
                    disabled={!novaManutencao.lojaId}
                  >
                    <option value="">Selecione</option>
                    {destinatariosWhatsApp.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                        {f.telefone ? ` - ${f.telefone}` : " - sem telefone"}
                      </option>
                    ))}
                  </select>
                  {origemDestinatarioPadrao === "roteiro_da_loja" && (
                    <p className="text-xs text-green-700 mt-1">
                      Padrão automático: funcionário responsável pelo roteiro da
                      loja.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea
                    className="input-field w-full"
                    value={novaManutencao.descricao}
                    onChange={(e) =>
                      setNovaManutencao((d) => ({
                        ...d,
                        descricao: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <button className="btn-primary w-full mt-2" type="submit">
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Descrição
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Data/Hora
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Loja
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Máquina
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Concluída por
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Concluída em
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filtradas.map((m) => (
                  <tr
                    key={m.id}
                    className={
                      `hover:bg-blue-50 cursor-pointer` +
                      (isAdmin &&
                      (m.status === "feito" || m.status === "concluida")
                        ? " bg-green-100"
                        : "")
                    }
                    onClick={() => setDetalhe(m)}
                  >
                    <td className="px-4 py-2">{m.descricao}</td>
                    <td className="px-4 py-2">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">{m.loja?.nome || "-"}</td>
                    <td className="px-4 py-2">{m.maquina?.codigo || "-"}{m.maquina?.nome ? ` - ${m.maquina.nome}` : ''}</td>
                    <td className="px-4 py-2 font-bold">
                      {m.status === "feito" || m.status === "concluida" ? (
                        <span className="text-green-700">{m.status}</span>
                      ) : (
                        m.status
                      )}
                    </td>
                    <td className="px-4 py-2">{m.concluidoPor?.nome || "-"}</td>
                    <td className="px-4 py-2">
                      {formatarDataHora(m.concluidoEm)}
                    </td>
                    <td className="px-4 py-2">
                      {m.status !== "feito" && m.status !== "concluida" ? (
                        <button
                          className="btn-success text-xs px-3 py-1"
                          onClick={(event) => {
                            event.stopPropagation();
                            concluirManutencaoDaLinha(m);
                          }}
                        >
                          Concluir
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-8">
                      Nenhuma manutenção encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && manutencoesPersistentes.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h3 className="text-lg font-bold text-amber-900">
              ⚠️ Manutenções persistentes
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Estas máquinas tiveram mais de uma manutenção concluída em até{" "}
              {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias. Isso pode indicar que a
              manutenção anterior não resolveu o problema.
            </p>

            <div className="mt-3 space-y-3">
              {manutencoesPersistentes.map((item) => (
                <div
                  key={item.maquinaId}
                  className="rounded-md border border-amber-200 bg-white p-3"
                >
                  <div className="font-semibold text-gray-900">
                    {item.maquinaNome} - {item.lojaNome}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    <strong>Data da última manutenção:</strong>{" "}
                    {formatarDataHora(item.dataUltima)}
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>Data da manutenção de agora:</strong>{" "}
                    {formatarDataHora(item.dataAtual)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {detalhe && !editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                onClick={() => setDetalhe(null)}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Detalhes da Manutenção</h3>

              <div className="space-y-2">
                <div>
                  <strong>Descrição:</strong> {detalhe.descricao}
                </div>
                <div>
                  <strong>Data/Hora:</strong>{" "}
                  {new Date(detalhe.createdAt).toLocaleString("pt-BR")}
                </div>
                <div>
                  <strong>Status:</strong> {detalhe.status}
                </div>
                <div>
                  <strong>Concluída por:</strong>{" "}
                  {detalhe.concluidoPor?.nome || "-"}
                </div>
                <div>
                  <strong>Concluída em:</strong>{" "}
                  {formatarDataHora(detalhe.concluidoEm)}
                </div>
                <div>
                  <strong>Loja:</strong> {detalhe.loja?.nome || "-"}
                </div>
                <div>
                  <strong>Máquina:</strong> {detalhe.maquina?.codigo || "-"}{detalhe.maquina?.nome ? ` - ${detalhe.maquina.nome}` : ''}
                </div>

                {/* Explicações dos funcionários */}
                {(detalhe.explicacao_nao_fazer ||
                  detalhe.explicacao_sem_peca) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📝 Explicações dos Funcionários
                    </h4>

                    {detalhe.explicacao_nao_fazer && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-orange-800 mb-1">
                          Por que não foi feita:
                        </p>
                        <p className="text-sm text-gray-700">
                          {detalhe.explicacao_nao_fazer}
                        </p>
                        {detalhe.verificadoPor && (
                          <p className="text-xs text-gray-500 mt-1">
                            - {detalhe.verificadoPor.nome} (
                            {formatarDataHora(detalhe.verificadoEm)})
                          </p>
                        )}
                      </div>
                    )}

                    {detalhe.explicacao_sem_peca && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">
                          Por que não usou peças:
                        </p>
                        <p className="text-sm text-gray-700">
                          {detalhe.explicacao_sem_peca}
                        </p>
                        {detalhe.concluidoPor && (
                          <p className="text-xs text-gray-500 mt-1">
                            - {detalhe.concluidoPor.nome} (
                            {formatarDataHora(detalhe.concluidoEm)})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                {isAdmin && (
                  <button className="btn-primary" onClick={handleEditOpen}>
                    Editar
                  </button>
                )}
                {isAdmin && (
                  <button className="btn-danger" onClick={handleDelete}>
                    Excluir
                  </button>
                )}
                {!isAdmin &&
                  detalhe.status !== "feito" &&
                  detalhe.status !== "concluida" && (
                    <button className="btn-success" onClick={marcarComoFeita}>
                      Marcar como Feita
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {detalhe && editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
              onSubmit={handleEditSave}
            >
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                type="button"
                onClick={() => setEditando(false)}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h3 className="text-xl font-bold mb-4">Editar Manutenção</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">
                    Funcionário
                  </label>
                  <select
                    className="input-field w-full"
                    value={editData.funcionarioId}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        funcionarioId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Status</label>
                  <select
                    className="input-field w-full"
                    value={editData.status}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, status: e.target.value }))
                    }
                  >
                    <option value="pendente">pendente</option>
                    <option value="em_andamento">em_andamento</option>
                    <option value="feito">feito</option>
                    <option value="concluida">concluida</option>
                    <option value="cancelada">cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea
                    className="input-field w-full"
                    value={editData.descricao}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, descricao: e.target.value }))
                    }
                  />
                </div>

                <button className="btn-primary w-full mt-2" type="submit">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Manutencoes;
