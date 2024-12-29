// Importar módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const pdfParse = require('pdf-parse'); // Para extrair texto do PDF
require('dotenv').config();
// Configurar o app Express
const app = express();

// Configurar body-parser para uploads binários
app.use(bodyParser.raw({ type: 'application/pdf', limit: '10mb' })); // Limite de 10MB para o PDF

// Criar rota para receber o PDF
app.post('/upload-pdf', async (req, res) => {
    try {
        // Verificar se o arquivo foi enviado
        if (!req.body || req.body.length === 0) {
            return res.status(400).send('Nenhum arquivo enviado.');
        }

        console.log('Arquivo recebido:', req.body); // Detalhes do arquivo enviado

        // Extrair texto do PDF
        const data = await pdfParse(req.body);

        // Retornar o texto extraído
        const API_KEY = process.env.API_KEY;
        const prompt = `Conseguiria me passar informações sobre esse curriculo?

          - Nome do candidato

          - Telefone

          - email

          - Posição desejada

          - Experiencias

          - Educação`;
    
        const payload = {
          model: "gpt-4o-mini",
          store: true,
          messages: [
            { role: "user", content: `${prompt}\n\n${data.text}` }
          ]
        };
    
        const url = `https://api.openai.com/v1/chat/completions`;
    
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
          },
          body: JSON.stringify(payload),
        });
    
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const dataResponse = await response.json();
        const summary = dataResponse.choices[0].message.content;
        res.send(summary);
    } catch (err) {
        res.status(500).send({ error: 'Erro ao processar o PDF', details: err.message });
    }
});

// Configurar porta
const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
