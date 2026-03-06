import { CarrinhoPeca, Usuario, Peca } from "../models/index.js";
import { Op } from "sequelize";

// Listar peças do carrinho do usuário
export const listarCarrinho = async (req, res) => {
  try {
    const usuarioId = String(req.params.id);
    console.log('[listarCarrinho] usuarioId:', usuarioId, 'req.usuario.id:', req.usuario.id);
    // Permitir apenas ADMIN, GERENCIADOR ou o próprio usuário
    if (
      req.usuario.role !== "ADMIN" &&
      req.usuario.role !== "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const itens = await CarrinhoPeca.findAll({
      where: { usuarioId },
      include: [{ model: Peca }],
    });
    console.log('[listarCarrinho] Itens encontrados:', itens.length);
    res.json(itens);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar carrinho" });
  }
};

// Adicionar peça ao carrinho
export const adicionarAoCarrinho = async (req, res) => {
  try {
    const usuarioId = String(req.params.id);
    const { pecaId, quantidade } = req.body;
    // Permitir ADMIN, GERENCIADOR ou o próprio FUNCIONARIO
    if (
      req.usuario.role !== "ADMIN" &&
      req.usuario.role !== "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    // GERENCIADOR só pode manipular carrinho de FUNCIONARIO
    if (
      req.usuario.role === "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId
    ) {
      const usuarioAlvo = await Usuario.findByPk(usuarioId);
      if (!usuarioAlvo || usuarioAlvo.role !== "FUNCIONARIO") {
        return res.status(403).json({ error: "Só pode manipular carrinho de FUNCIONARIO" });
      }
    }
    let item = await CarrinhoPeca.findOne({ where: { usuarioId, pecaId } });
    if (item) {
      item.quantidade += quantidade;
      await item.save();
    } else {
      item = await CarrinhoPeca.create({ usuarioId, pecaId, quantidade });
    }
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar ao carrinho" });
  }
};

// Remover peça do carrinho
export const removerDoCarrinho = async (req, res) => {
  try {
    const usuarioId = String(req.params.id);
    const pecaId = req.params.pecaId;
    // Permitir ADMIN, GERENCIADOR ou o próprio FUNCIONARIO
    if (
      req.usuario.role !== "ADMIN" &&
      req.usuario.role !== "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    // GERENCIADOR só pode manipular carrinho de FUNCIONARIO
    if (
      req.usuario.role === "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId
    ) {
      const usuarioAlvo = await Usuario.findByPk(usuarioId);
      if (!usuarioAlvo || usuarioAlvo.role !== "FUNCIONARIO") {
        return res.status(403).json({ error: "Só pode manipular carrinho de FUNCIONARIO" });
      }
    }
    const item = await CarrinhoPeca.findOne({ where: { usuarioId, pecaId } });
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    await item.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover do carrinho" });
  }
};

// Adicionar peça ao carrinho do usuário autenticado (rota /pecas/:pecaId/carrinho)
export const adicionarPecaAoCarrinho = async (req, res) => {
  try {
    const pecaId = req.params.pecaId;
    const { quantidade } = req.body;
    const usuarioId = req.usuario.id; // Pega do token JWT

    console.log('[adicionarPecaAoCarrinho] pecaId:', pecaId, 'usuarioId:', usuarioId, 'quantidade:', quantidade);

    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({ error: "Quantidade inválida" });
    }

    let item = await CarrinhoPeca.findOne({ where: { usuarioId, pecaId } });
    if (item) {
      item.quantidade += quantidade;
      await item.save();
      console.log('[adicionarPecaAoCarrinho] Item atualizado:', item.toJSON());
    } else {
      item = await CarrinhoPeca.create({ usuarioId, pecaId, quantidade });
      console.log('[adicionarPecaAoCarrinho] Item criado:', item.toJSON());
    }
    res.status(201).json(item);
  } catch (error) {
    console.error("[adicionarPecaAoCarrinho] Erro:", error);
    res.status(500).json({ error: "Erro ao adicionar ao carrinho" });
  }
};

// Remover peça do carrinho do usuário autenticado (rota /pecas/:pecaId/carrinho)
export const removerPecaDoCarrinho = async (req, res) => {
  try {
    const pecaId = req.params.pecaId;
    const usuarioId = req.usuario.id; // Pega do token JWT

    const item = await CarrinhoPeca.findOne({ where: { usuarioId, pecaId } });
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    
    await item.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error("[removerPecaDoCarrinho] Erro:", error);
    res.status(500).json({ error: "Erro ao remover do carrinho" });
  }
};
