const STATUS_CONCLUIDO = new Set([
  "concluido",
  "concluida",
  "finalizado",
  "finalizada",
  "feito",
]);

const normalizarTexto = (valor) => String(valor || "").trim();

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
    normalizarListaNomes(data.lojasFeitas || data.lojasConcluidas || [], "nome"),
  );
  const lojasNaoFeitas = new Set(
    normalizarListaNomes(data.lojasNaoFeitas || data.lojasPendentes || [], "nome"),
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
    const nomeMaquina = normalizarTexto(item?.maquinaNome || item?.maquina?.nome);

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

export const somarPeluciasUsadasMovimentacoes = (movimentacoes, usuarioId = null) => {
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
      mov?.abastecidas || mov?.quantidadeAdicionada || mov?.totalAbastecido || 0,
    );

    return total + (Number.isFinite(quantidadeAbastecida) ? quantidadeAbastecida : 0);
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

  const lista = toArray(estoqueUsuarioData?.estoque || estoqueUsuarioData?.produtos || estoqueUsuarioData);

  return lista.reduce((total, item) => {
    const quantidade = Number(
      item?.quantidadeAtual || item?.quantidade || item?.saldo || 0,
    );
    return total + (Number.isFinite(quantidade) ? quantidade : 0);
  }, 0);
};

const formatarLista = (itens) => {
  const lista = toArray(itens).filter(Boolean);
  if (lista.length === 0) return "Nenhum";
  return lista.join(", ");
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
}) => {
  const totalUsadas = Number.isFinite(Number(totalPeluciasUsadas))
    ? Number(totalPeluciasUsadas)
    : null;
  const saldoEstoque = Number.isFinite(Number(saldoPeluciasEstoque))
    ? Number(saldoPeluciasEstoque)
    : null;

  return [
    "STAR BOX",
    "*Resumo de Finalizacao de Roteiro*",
    "___________________________________",
    `Roteiro: ${normalizarTexto(roteiroNome) || "-"}`,
    `Lojas feitas: ${formatarLista(lojasFeitas)}`,
    `Lojas nao feitas: ${formatarLista(lojasNaoFeitas)}`,
    `Maquinas feitas: ${formatarLista(maquinasFeitas)}`,
    `Maquinas nao feitas: ${formatarLista(maquinasNaoFeitas)}`,
    `Total de pelucias usadas na rota: ${totalUsadas !== null ? totalUsadas : "Nao informado"}`,
    `Pelucias restantes no estoque do usuario: ${saldoEstoque !== null ? saldoEstoque : "Nao informado"}`,
    `Despesa total: ${formatarMoedaBRL(despesaTotal)}`,
    `Sobra valor despesa: ${formatarMoedaBRL(sobraValorDespesa)}`,
    `Manutencoes realizadas: ${formatarLista(manutencoesRealizadas)}`,
    `Manutencoes nao realizadas: ${formatarLista(manutencoesNaoRealizadas)}`,
  ].join("\n");
};

export const abrirWhatsAppComMensagem = (mensagem, popupReservado = null) => {
  const textoCodificado = encodeURIComponent(String(mensagem || ""));
  const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  const whatsappUrl = isMobile
    ? `https://wa.me/?text=${textoCodificado}`
    : `https://web.whatsapp.com/send?text=${textoCodificado}`;

  if (popupReservado && !popupReservado.closed) {
    popupReservado.location.href = whatsappUrl;
    popupReservado.focus?.();
    return true;
  }

  const novaAba = window.open(whatsappUrl, "_blank");
  if (novaAba && !novaAba.closed) {
    novaAba.focus?.();
    return true;
  }

  return false;
};
