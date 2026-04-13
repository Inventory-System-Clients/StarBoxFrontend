const STATUS_CONCLUIDO = new Set([
  "concluido",
  "concluida",
  "finalizado",
  "finalizada",
  "feito",
]);

const ESTOQUE_INICIAL_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:estoque-inicial:";
const KM_INICIAL_PILOTAGEM_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:km-inicial-pilotagem:";
const KM_INICIAL_PILOTAGEM_ATIVA_STORAGE_PREFIX =
  "starbox:pilotagem:km-inicial:";
const MANUTENCAO_RESUMO_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:manutencao-resumo:";
const MOVIMENTACOES_WHATSAPP_LOJA_STORAGE_PREFIX =
  "starbox:roteiro:movimentacoes-whatsapp-loja:";

const normalizarTexto = (valor) => String(valor || "").trim();

const montarChaveEstoqueInicialRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${ESTOQUE_INICIAL_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

export const obterEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const quantidade = Number(payload?.quantidadeInicial);
    return Number.isFinite(quantidade) ? quantidade : null;
  } catch {
    return null;
  }
};

export const salvarEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  quantidadeInicial,
  sobrescrever = false,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  const quantidade = Number(quantidadeInicial);

  if (!chave || !Number.isFinite(quantidade)) return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        quantidadeInicial: quantidade,
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveKmInicialPilotagemRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${KM_INICIAL_PILOTAGEM_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

export const obterKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const kmInicial = Number(payload?.kmInicial);
    return Number.isFinite(kmInicial) ? kmInicial : null;
  } catch {
    return null;
  }
};

export const salvarKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  kmInicial,
  sobrescrever = false,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  const kmInicialNumero = Number(kmInicial);

  if (!chave || !Number.isFinite(kmInicialNumero)) return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        kmInicial: kmInicialNumero,
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const usuarioNormalizado = normalizarTexto(usuarioId);
  const veiculoNormalizado = normalizarTexto(veiculoId);

  if (!usuarioNormalizado || !veiculoNormalizado) return "";
  return `${KM_INICIAL_PILOTAGEM_ATIVA_STORAGE_PREFIX}${usuarioNormalizado}:${veiculoNormalizado}`;
};

export const obterKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const kmInicial = Number(payload?.kmInicial);
    return Number.isFinite(kmInicial) ? kmInicial : null;
  } catch {
    return null;
  }
};

export const salvarKmInicialPilotagemAtiva = ({
  usuarioId,
  veiculoId,
  kmInicial,
}) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  const kmInicialNumero = Number(kmInicial);

  if (!chave || !Number.isFinite(kmInicialNumero)) return false;

  try {
    window.localStorage.setItem(
      chave,
      JSON.stringify({
        kmInicial: kmInicialNumero,
        usuarioId: String(usuarioId),
        veiculoId: String(veiculoId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveManutencaoResumoRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${MANUTENCAO_RESUMO_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

const montarChaveMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);
  const lojaNormalizada = normalizarTexto(lojaId);

  if (!roteiroNormalizado || !usuarioNormalizado || !lojaNormalizada) return "";
  return `${MOVIMENTACOES_WHATSAPP_LOJA_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}:${lojaNormalizada}`;
};

export const obterMovimentacoesWhatsAppPendentesLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  if (!chave) return [];

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return [];

    const payload = JSON.parse(bruto);
    const itens = Array.isArray(payload?.itens) ? payload.itens : [];

    return itens
      .map((item) => ({
        maquinaId: normalizarTexto(item?.maquinaId),
        maquinaNome: normalizarTexto(item?.maquinaNome),
        mensagem: String(item?.mensagem || "").trim(),
        createdAt: item?.createdAt || null,
      }))
      .filter((item) => item.mensagem);
  } catch {
    return [];
  }
};

export const salvarMovimentacaoWhatsAppPendenteLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
  maquinaId,
  maquinaNome,
  mensagem,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  const mensagemNormalizada = String(mensagem || "").trim();

  if (!chave || !mensagemNormalizada) return false;

  try {
    const itensAtuais = obterMovimentacoesWhatsAppPendentesLoja({
      roteiroId,
      usuarioId,
      lojaId,
    });

    itensAtuais.push({
      maquinaId: normalizarTexto(maquinaId),
      maquinaNome: normalizarTexto(maquinaNome),
      mensagem: mensagemNormalizada,
      createdAt: new Date().toISOString(),
    });

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        lojaId: String(lojaId),
        itens: itensAtuais,
        updatedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerMovimentacoesWhatsAppPendentesLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

export const montarMensagemMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const itens = obterMovimentacoesWhatsAppPendentesLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });

  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0].mensagem;

  return itens
    .map((item) => item.mensagem)
    .join("\n\n====================\n\n");
};

export const obterManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const totalRealizadas = Number(payload?.totalRealizadas);
    const lojasComManutencao = Array.isArray(payload?.lojasComManutencao)
      ? payload.lojasComManutencao.filter(Boolean)
      : [];
    const lojasSemManutencao = Array.isArray(payload?.lojasSemManutencao)
      ? payload.lojasSemManutencao.filter(Boolean)
      : [];

    return {
      totalRealizadas: Number.isFinite(totalRealizadas)
        ? Math.max(0, totalRealizadas)
        : 0,
      lojasComManutencao: Array.from(new Set(lojasComManutencao)),
      lojasSemManutencao: Array.from(new Set(lojasSemManutencao)),
      updatedAt: payload?.updatedAt || null,
    };
  } catch {
    return null;
  }
};

export const salvarManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  resumo,
  sobrescrever = true,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave || !resumo || typeof resumo !== "object") return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    const totalRealizadas = Number(resumo?.totalRealizadas);
    const lojasComManutencao = Array.isArray(resumo?.lojasComManutencao)
      ? resumo.lojasComManutencao.filter(Boolean)
      : [];
    const lojasSemManutencao = Array.isArray(resumo?.lojasSemManutencao)
      ? resumo.lojasSemManutencao.filter(Boolean)
      : [];

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        totalRealizadas: Number.isFinite(totalRealizadas)
          ? Math.max(0, totalRealizadas)
          : 0,
        lojasComManutencao: Array.from(new Set(lojasComManutencao)),
        lojasSemManutencao: Array.from(new Set(lojasSemManutencao)),
        updatedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const toArray = (valor) => {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === "object") {
    const valores = Object.values(valor);
    if (Array.isArray(valores) && valores.length > 0) return valores;
  }
  if (!valor) return [];
  if (Array.isArray(valor?.rows)) return valor.rows;
  if (Array.isArray(valor?.movimentacoes)) return valor.movimentacoes;
  return [];
};

const statusConcluido = (status) =>
  STATUS_CONCLUIDO.has(normalizarTexto(status).toLowerCase());

const normalizarListaNomes = (lista, chavePadrao = "nome") => {
  const nomes = lista
    .map((item) => {
      if (typeof item === "string") return normalizarTexto(item);
      if (!item || typeof item !== "object") return "";

      return normalizarTexto(
        item[chavePadrao] ||
          item.nome ||
          item.lojaNome ||
          item.maquinaNome ||
          item.descricao,
      );
    })
    .filter(Boolean);

  return Array.from(new Set(nomes));
};

export const extrairResumoExecucaoRoteiro = ({ roteiro, finalizacaoData }) => {
  const data = finalizacaoData || {};

  const lojasFeitas = new Set(
    normalizarListaNomes(
      data.lojasFeitas || data.lojasConcluidas || [],
      "nome",
    ),
  );
  const lojasNaoFeitas = new Set(
    normalizarListaNomes(
      data.lojasNaoFeitas || data.lojasPendentes || [],
      "nome",
    ),
  );

  const maquinasFeitas = new Set(
    normalizarListaNomes(
      data.maquinasFeitas || data.maquinasConcluidas || [],
      "maquinaNome",
    ),
  );
  const maquinasNaoFeitas = new Set(
    normalizarListaNomes(
      data.maquinasNaoFeitas || data.maquinasPendentes || [],
      "maquinaNome",
    ),
  );

  const pendencias = toArray(data.pendencias);
  for (const item of pendencias) {
    const nomeLoja = normalizarTexto(item?.lojaNome || item?.loja?.nome);
    const nomeMaquina = normalizarTexto(
      item?.maquinaNome || item?.maquina?.nome,
    );

    if (nomeLoja) lojasNaoFeitas.add(nomeLoja);
    if (nomeMaquina) maquinasNaoFeitas.add(nomeMaquina);
  }

  const lojasRoteiro = toArray(roteiro?.lojas);
  for (const loja of lojasRoteiro) {
    const nomeLoja = normalizarTexto(loja?.nome);
    if (!nomeLoja) continue;

    if (statusConcluido(loja?.status)) {
      lojasFeitas.add(nomeLoja);
      lojasNaoFeitas.delete(nomeLoja);
    } else if (!lojasFeitas.has(nomeLoja)) {
      lojasNaoFeitas.add(nomeLoja);
    }

    const maquinasLoja = toArray(loja?.maquinas);
    for (const maquina of maquinasLoja) {
      const nomeMaquina = normalizarTexto(
        maquina?.nome || maquina?.codigo || maquina?.maquinaNome,
      );
      if (!nomeMaquina) continue;

      if (statusConcluido(maquina?.status)) {
        maquinasFeitas.add(nomeMaquina);
        maquinasNaoFeitas.delete(nomeMaquina);
      } else if (!maquinasFeitas.has(nomeMaquina)) {
        maquinasNaoFeitas.add(nomeMaquina);
      }
    }
  }

  for (const nomeFeita of lojasFeitas) lojasNaoFeitas.delete(nomeFeita);
  for (const nomeFeita of maquinasFeitas) maquinasNaoFeitas.delete(nomeFeita);

  return {
    lojasFeitas: Array.from(lojasFeitas),
    lojasNaoFeitas: Array.from(lojasNaoFeitas),
    maquinasFeitas: Array.from(maquinasFeitas),
    maquinasNaoFeitas: Array.from(maquinasNaoFeitas),
  };
};

export const somarPeluciasUsadasMovimentacoes = (
  movimentacoes,
  usuarioId = null,
) => {
  const usuarioNormalizado =
    usuarioId === null || usuarioId === undefined ? null : String(usuarioId);

  return toArray(movimentacoes).reduce((total, mov) => {
    const movUsuarioId = String(
      mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
    );

    if (usuarioNormalizado && movUsuarioId !== usuarioNormalizado) {
      return total;
    }

    const quantidadeAbastecida = Number(
      mov?.abastecidas ||
        mov?.quantidadeAdicionada ||
        mov?.totalAbastecido ||
        0,
    );

    return (
      total + (Number.isFinite(quantidadeAbastecida) ? quantidadeAbastecida : 0)
    );
  }, 0);
};

export const somarSaldoEstoqueUsuario = (estoqueUsuarioData) => {
  const totalDireto = Number(
    estoqueUsuarioData?.totalUnidades ??
      estoqueUsuarioData?.totais?.totalUnidades ??
      estoqueUsuarioData?.resumo?.totalUnidades,
  );

  if (Number.isFinite(totalDireto)) {
    return totalDireto;
  }

  const lista = toArray(
    estoqueUsuarioData?.estoque ||
      estoqueUsuarioData?.produtos ||
      estoqueUsuarioData,
  );

  return lista.reduce((total, item) => {
    const quantidade = Number(
      item?.quantidadeAtual || item?.quantidade || item?.saldo || 0,
    );
    return total + (Number.isFinite(quantidade) ? quantidade : 0);
  }, 0);
};

export const extrairKmMovimentacoesRoteiro = (
  movimentacoes,
  { usuarioId = null, veiculoId = null, roteiroId = null } = {},
) => {
  const usuarioNormalizado =
    usuarioId === null || usuarioId === undefined ? null : String(usuarioId);
  const veiculoNormalizado =
    veiculoId === null || veiculoId === undefined ? null : String(veiculoId);
  const roteiroNormalizado =
    roteiroId === null || roteiroId === undefined ? null : String(roteiroId);

  const listaFiltrada = toArray(movimentacoes).filter((mov) => {
    const tipo = normalizarTexto(mov?.tipo).toLowerCase();
    if (tipo !== "retirada" && tipo !== "devolucao") return false;

    const movUsuarioId = String(
      mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
    );
    const movVeiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "");
    const movRoteiroId = String(mov?.roteiroId || mov?.roteiro?.id || "");

    if (usuarioNormalizado && movUsuarioId !== usuarioNormalizado) return false;
    if (veiculoNormalizado && movVeiculoId !== veiculoNormalizado) return false;
    if (
      roteiroNormalizado &&
      movRoteiroId &&
      movRoteiroId !== roteiroNormalizado
    ) {
      return false;
    }

    return true;
  });

  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    const dataA = new Date(
      a?.dataHora || a?.createdAt || a?.updatedAt || 0,
    ).getTime();
    const dataB = new Date(
      b?.dataHora || b?.createdAt || b?.updatedAt || 0,
    ).getTime();

    if (dataA !== dataB) return dataA - dataB;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });

  const primeiraRetirada = listaOrdenada.find(
    (mov) => normalizarTexto(mov?.tipo).toLowerCase() === "retirada",
  );
  const ultimaDevolucao = [...listaOrdenada]
    .reverse()
    .find((mov) => normalizarTexto(mov?.tipo).toLowerCase() === "devolucao");

  const parseKmPorTipo = (mov, tipo) => {
    const chavesPreferenciais =
      tipo === "retirada"
        ? [
            mov?.kmInicial,
            mov?.quilometragemInicial,
            mov?.kmRetirada,
            mov?.odometroInicial,
            mov?.km,
            mov?.quilometragem,
            mov?.odometro,
          ]
        : [
            mov?.kmFinal,
            mov?.quilometragemFinal,
            mov?.kmDevolucao,
            mov?.odometroFinal,
            mov?.km,
            mov?.quilometragem,
            mov?.odometro,
          ];

    const numero = Number(
      chavesPreferenciais.find(
        (valor) => valor !== null && valor !== undefined && valor !== "",
      ),
    );
    return Number.isFinite(numero) ? numero : null;
  };

  return {
    kmInicial: parseKmPorTipo(primeiraRetirada, "retirada"),
    kmFinal: parseKmPorTipo(ultimaDevolucao, "devolucao"),
  };
};

const formatarLista = (itens) => {
  const lista = toArray(itens).filter(Boolean);
  if (lista.length === 0) return "Nenhum";
  return lista.join(", ");
};

const extrairNomePonto = (item) => {
  if (!item || typeof item !== "object") return "";

  return normalizarTexto(
    item.pontoNome ||
      item.lojaNome ||
      item.loja?.nome ||
      item.ponto?.nome ||
      item.localNome ||
      item.local?.nome,
  );
};

const montarResumoManutencoesPorPonto = (manutencoes = []) => {
  const contadorPorPonto = new Map();

  for (const item of toArray(manutencoes)) {
    const nomePonto = extrairNomePonto(item);
    if (!nomePonto) continue;

    const quantidadeAtual = contadorPorPonto.get(nomePonto) || 0;
    contadorPorPonto.set(nomePonto, quantidadeAtual + 1);
  }

  return Array.from(contadorPorPonto.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([nomePonto, quantidade]) => `${nomePonto} (${quantidade})`);
};

const formatarMoedaBRL = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "Nao informado";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const montarMensagemFinalizacaoRoteiro = ({
  roteiroNome,
  possuiVeiculoAssociado = true,
  kmInicialVeiculo,
  kmFinalVeiculo,
  lojasFeitas,
  lojasNaoFeitas,
  maquinasFeitas,
  maquinasNaoFeitas,
  totalPeluciasUsadas,
  saldoPeluciasEstoque,
  despesaTotal,
  sobraValorDespesa,
  manutencoesRealizadas,
  manutencoesNaoRealizadas,
  totalManutencoesRealizadas,
  lojasComManutencao,
  lojasSemManutencao,
  resumoConsumoProdutos,
  maquinasComEdicao,
}) => {
  const totalUsadas = Number.isFinite(Number(totalPeluciasUsadas))
    ? Number(totalPeluciasUsadas)
    : null;
  const saldoEstoque = Number.isFinite(Number(saldoPeluciasEstoque))
    ? Number(saldoPeluciasEstoque)
    : null;
  const kmInicial = Number.isFinite(Number(kmInicialVeiculo))
    ? Number(kmInicialVeiculo)
    : null;
  const kmFinal = Number.isFinite(Number(kmFinalVeiculo))
    ? Number(kmFinalVeiculo)
    : null;
  const kmRodado =
    kmInicial !== null && kmFinal !== null
      ? Math.max(0, kmFinal - kmInicial)
      : null;
  const manutencoesFeitasBrutas = toArray(manutencoesRealizadas).filter(
    Boolean,
  );
  const manutencoesNaoFeitasBrutas = toArray(manutencoesNaoRealizadas).filter(
    Boolean,
  );
  const manutencoesFeitasLista = normalizarListaNomes(
    manutencoesFeitasBrutas,
    "descricao",
  );
  const manutencoesNaoFeitasLista = normalizarListaNomes(
    manutencoesNaoFeitasBrutas,
    "descricao",
  );
  const totalManutencoesFeitas = Number.isFinite(
    Number(totalManutencoesRealizadas),
  )
    ? Number(totalManutencoesRealizadas)
    : manutencoesFeitasLista.length;
  const lojasComManutencaoLista = normalizarListaNomes(
    toArray(lojasComManutencao),
    "nome",
  );
  const manutencoesNaoFeitasPorPonto = montarResumoManutencoesPorPonto(
    manutencoesNaoFeitasBrutas,
  );
  const consumoResumo =
    resumoConsumoProdutos && typeof resumoConsumoProdutos === "object"
      ? {
          estoqueInicialTotal: Number(
            resumoConsumoProdutos.estoqueInicialTotal,
          ),
          estoqueFinalTotal: Number(resumoConsumoProdutos.estoqueFinalTotal),
          consumoTotalProdutos: Number(
            resumoConsumoProdutos.consumoTotalProdutos,
          ),
        }
      : null;
  const consumoResumoValido =
    consumoResumo &&
    Number.isFinite(consumoResumo.estoqueInicialTotal) &&
    Number.isFinite(consumoResumo.estoqueFinalTotal) &&
    Number.isFinite(consumoResumo.consumoTotalProdutos);
  const maquinasComEdicaoLista = normalizarListaNomes(
    toArray(maquinasComEdicao),
    "nome",
  );
  const linhasKm = possuiVeiculoAssociado
    ? [
        `KM inicial (retirada): ${kmInicial !== null ? kmInicial : "Nao informado"}`,
        `KM final (devolucao): ${kmFinal !== null ? kmFinal : "Nao informado"}`,
        `KM rodado: ${kmRodado !== null ? kmRodado : "Nao informado"}`,
      ]
    : [];

  return [
    "STAR BOX",
    "*Resumo de Finalizacao de Roteiro*",
    "___________________________________",
    `Roteiro: ${normalizarTexto(roteiroNome) || "-"}`,
    ...linhasKm,
    `Pontos feitos: ${formatarLista(lojasFeitas)}`,
    `Pontos nao feitos: ${formatarLista(lojasNaoFeitas)}`,
    `Maquinas feitas: ${formatarLista(maquinasFeitas)}`,
    `Maquinas nao feitas: ${formatarLista(maquinasNaoFeitas)}`,
    ...(consumoResumoValido
      ? [
          `Estoque inicial: ${consumoResumo.estoqueInicialTotal} produtos`,
          `Estoque final: ${consumoResumo.estoqueFinalTotal} produtos`,
          `Total gasto na rota: ${consumoResumo.consumoTotalProdutos} produtos`,
        ]
      : ["Resumo de consumo indisponivel para esta finalizacao."]),
    `Despesa total: ${formatarMoedaBRL(despesaTotal)}`,
    `Sobra valor despesa: ${formatarMoedaBRL(sobraValorDespesa)}`,
    `Total de manutencoes realizadas: ${totalManutencoesFeitas}`,
    `Lojas com manutencao realizada: ${formatarLista(lojasComManutencaoLista)}`,

    `Manutencoes realizadas (${manutencoesFeitasLista.length}): ${formatarLista(manutencoesFeitasLista)}`,

    `Manutencoes nao realizadas (${manutencoesNaoFeitasLista.length}): ${formatarLista(manutencoesNaoFeitasLista)}`,
    `Manutencoes nao realizadas por ponto: ${formatarLista(manutencoesNaoFeitasPorPonto)}`,
    ...(maquinasComEdicaoLista.length > 0
      ? [
          `Rota finalizada com edicao na maquina: ${formatarLista(maquinasComEdicaoLista)}`,
        ]
      : []),
  ].join("\n");
};

export const abrirWhatsAppComMensagem = (mensagem, popupReservado = null) => {
  const textoCodificado = encodeURIComponent(String(mensagem || ""));
  const userAgent = String(
    navigator.userAgent || navigator.vendor || window?.opera || "",
  );
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      userAgent,
    ) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
  const isAndroid = /Android/i.test(userAgent);

  const redirecionarSeAindaVisivel = (url, delay) => {
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = url;
      }
    }, delay);
  };

  if (isMobile) {
    if (popupReservado && !popupReservado.closed) {
      popupReservado.close();
    }
    if (isAndroid) {
      window.location.href = `intent://send?text=${textoCodificado}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      redirecionarSeAindaVisivel(
        `intent://send?text=${textoCodificado}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`,
        700,
      );
      redirecionarSeAindaVisivel(
        `https://wa.me/?text=${textoCodificado}`,
        1800,
      );
      return true;
    }
    window.location.href = `whatsapp://send?text=${textoCodificado}`;
    redirecionarSeAindaVisivel(`https://wa.me/?text=${textoCodificado}`, 1200);
    return true;
  }

  if (popupReservado && !popupReservado.closed) {
    popupReservado.location.href = `https://web.whatsapp.com/send?text=${textoCodificado}`;
    popupReservado.focus?.();
    return true;
  }

  const novaAba = window.open(
    `https://web.whatsapp.com/send?text=${textoCodificado}`,
    "_blank",
  );
  if (novaAba && !novaAba.closed) {
    novaAba.focus?.();
    return true;
  }

  return false;
};
