import { Roteiro, Loja, Maquina } from "../models/index.js";
import MovimentacaoStatusDiario from "../models/MovimentacaoStatusDiario.js";
import { Op } from "sequelize";

// Retorna para um roteiro e período, as lojas e os dias sem movimentação
export async function getRelatorioRoteiroPeriodo(req, res) {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim } = req.query;
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: "dataInicio e dataFim são obrigatórios" });
    }
    const roteiro = await Roteiro.findByPk(id, {
      include: [
        {
          model: Loja,
          as: "lojas",
          include: [
            {
              model: Maquina,
              as: "maquinas",
              attributes: ["id", "nome"],
            },
          ],
        },
      ],
    });
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });

    // Gera lista de datas do período
    const datas = [];
    let d = new Date(dataInicio);
    const end = new Date(dataFim);
    while (d <= end) {
      datas.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    // Busca status de movimentação para todas as lojas/maquinas do roteiro no período
    const status = await MovimentacaoStatusDiario.findAll({
      where: {
        roteiro_id: id,
        data: { [Op.between]: [dataInicio, dataFim] },
        concluida: true,
      },
    });

    // Para cada loja, para cada dia, verifica se houve movimentação
    const lojasInfo = roteiro.lojas.map(loja => {
      const diasSemMov = datas.filter(date => {
        // Pelo menos uma máquina da loja teve movimentação neste dia?
        const alguma = loja.maquinas.some(maquina =>
          status.some(s => s.maquina_id === maquina.id && s.data === date)
        );
        return !alguma;
      });
      return {
        id: loja.id,
        nome: loja.nome,
        diasSemMovimentacao: diasSemMov,
      };
    });

    res.json({
      roteiro: { id: roteiro.id, nome: roteiro.nome },
      periodo: { dataInicio, dataFim },
      lojas: lojasInfo,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar relatório do roteiro" });
  }
}
