// Endpoint para relatório consolidado de roteiros
import { Op } from "sequelize";
import { Roteiro, Loja, Maquina, Movimentacao } from "../models/index.js";

export async function relatorioPorRoteiro(req, res) {
  try {
    const { roteiroId, dataInicio, dataFim } = req.query;
    if (!roteiroId || !dataInicio || !dataFim) {
      return res.status(400).json({ error: "roteiroId, dataInicio e dataFim são obrigatórios" });
    }
    const roteiro = await Roteiro.findByPk(roteiroId, {
      include: [{ model: Loja, as: "lojas", attributes: ["id", "nome"] }],
    });
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);
    // Para cada loja do roteiro, buscar movimentações
    const lojasDetalhes = await Promise.all(
      roteiro.lojas.map(async (loja) => {
        // Buscar todas movimentações da loja no período
        const maquinas = await Maquina.findAll({ where: { lojaId: loja.id }, attributes: ["id"] });
        const maquinaIds = maquinas.map((m) => m.id);
        const movimentacoes = await Movimentacao.findAll({
          where: {
            maquinaId: { [Op.in]: maquinaIds },
            dataColeta: { [Op.between]: [inicio, fim] },
          },
        });
        // Soma dos campos relevantes
        const totais = {
          fichas: 0,
          sairam: 0,
          abastecidas: 0,
          movimentacoes: movimentacoes.length,
        };
        movimentacoes.forEach((m) => {
          totais.fichas += m.fichas || 0;
          totais.sairam += m.sairam || 0;
          totais.abastecidas += m.abastecidas || 0;
        });
        // Dias do período
        const diasPeriodo = [];
        let d = new Date(inicio);
        while (d <= fim) {
          diasPeriodo.push(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 1);
        }
        // Dias com movimentação
        const diasComMov = new Set(movimentacoes.map((m) => m.dataColeta.toISOString().slice(0, 10)));
        const diasSemMov = diasPeriodo.filter((dia) => !diasComMov.has(dia));
        return {
          loja: { id: loja.id, nome: loja.nome },
          totais,
          diasSemMovimentacao: diasSemMov,
        };
      })
    );
    // Soma geral do roteiro
    const totaisRoteiro = lojasDetalhes.reduce(
      (acc, l) => {
        acc.fichas += l.totais.fichas;
        acc.sairam += l.totais.sairam;
        acc.abastecidas += l.totais.abastecidas;
        acc.movimentacoes += l.totais.movimentacoes;
        return acc;
      },
      { fichas: 0, sairam: 0, abastecidas: 0, movimentacoes: 0 }
    );
    res.json({
      roteiro: { id: roteiro.id, nome: roteiro.nome },
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      totaisRoteiro,
      lojas: lojasDetalhes,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar relatório de roteiro", message: error.message });
  }
}
