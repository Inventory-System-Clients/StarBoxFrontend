// Exemplo de endpoint para registrar movimentação em Node.js/Express

import express from "express";
const router = express.Router();

// POST /movimentacoes
router.post("/movimentacoes", async (req, res) => {
  try {
    const {
      maquinaId,
      roteiroId,
      totalPre,
      abastecidas,
      fichas,
      contadorIn,
      contadorOut,
      quantidade_notas_entrada,
      valor_entrada_maquininha_pix,
      retiradaEstoque,
      retiradaProduto,
      observacoes,
      produtos
    } = req.body;

    // Validação básica dos campos obrigatórios
    if (!maquinaId || !roteiroId) {
      return res.status(400).json({ error: "maquinaId e roteiroId são obrigatórios" });
    }
    // Adicione outras validações conforme necessário

    // Lógica para registrar a movimentação no banco de dados
    // Exemplo:
    // await Movimentacao.create({ ...req.body });

    // Após registrar, atualizar status da máquina/loja/roteiro se necessário
    // ...

    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao registrar movimentação" });
  }
});

export default router;

// Observações:
// - Certifique-se de que os nomes dos campos no req.body batem com os enviados pelo frontend.
// - Retorne mensagens de erro detalhadas no status 400 para facilitar o debug.
// - Atualize o status das entidades após registrar a movimentação, se necessário.
