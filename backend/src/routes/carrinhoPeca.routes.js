import express from "express";
import {
  listarCarrinho,
  listarMeuCarrinho,
  adicionarAoCarrinho,
  adicionarAoMeuCarrinho,
  removerDoCarrinho,
  removerDoMeuCarrinho,
} from "../controllers/carrinhoPecaController.js";
import { autenticar } from "../middlewares/auth.js";

const router = express.Router();

// Rotas para gerenciar carrinho de qualquer usuário (ADMIN/GERENCIADOR)
router.get("/:id/carrinho", autenticar, listarCarrinho);
router.post("/:id/carrinho", autenticar, adicionarAoCarrinho);
router.delete("/:id/carrinho/:pecaId", autenticar, removerDoCarrinho);

export default router;
