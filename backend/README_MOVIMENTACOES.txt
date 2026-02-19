// Este arquivo é apenas um placeholder para você visualizar a estrutura do backend.
// O endpoint de movimentações não está presente aqui.
// Se o backend está rodando em outro repositório, é preciso garantir que o POST /movimentacoes existe e aceita os campos corretos.

// Exemplo de endpoint esperado no backend (Node/Express):

/*
router.post('/movimentacoes', async (req, res) => {
  const { maquinaId, roteiroId, ...outrosCampos } = req.body;
  if (!maquinaId || !roteiroId) {
    return res.status(400).json({ error: 'maquinaId e roteiroId são obrigatórios' });
  }
  // lógica para registrar movimentação...
  res.status(201).json({ success: true });
});
*/

// Certifique-se de que o backend está aceitando os campos enviados pelo frontend e retorne mensagens de erro detalhadas no 400.
