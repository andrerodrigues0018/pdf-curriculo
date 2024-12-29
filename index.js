// Importar módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const pdfParse = require('pdf-parse'); // Para extrair texto do PDF
const cors = require('cors'); 
require('dotenv').config();
// Configurar o app Express
const app = express();
app.use(cors());

// Configurar body-parser para uploads binários
app.use(bodyParser.raw({ type: 'application/pdf', limit: '10mb' })); // Limite de 10MB para o PDF

// Criar rota para receber o PDF
app.post('/upload-pdf', async (req, res) => {
    try {
        // Verificar se o arquivo foi enviado
        if (!req.body || req.body.length === 0) {
            return res.status(400).send('Nenhum arquivo enviado.');
        }

        // console.log('Arquivo recebido:', req.body); // Detalhes do arquivo enviado

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

          - Educação
           **Exemplo de saída correta**: ` + "```json"+`
          {
            "nome": "Fulano de Tal",
            "telefone": "(11) 99999-9999",
            "email": "fulano@example,
            "posicao": "Desenvolvedor Full Stack",
            "experiencias": [
              { titulo: "Desenvolvedor Front-end", empresa: "Empresa X", periodo: "2019-2021", local: "São Paulo" },
              { titulo: "Desenvolvedor Back-end", empresa: "Empresa Y", periodo: "2017-2019", local: "São Paulo" }
            ],
            "educacao": [
              { curso: "Ciência da Computação", instituicao: "Universidade Z", data: "2013-2017" }
            ]
          }
          ` ;
    
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
        const summary = transformTextToJson(dataResponse.choices[0].message.content);
        res.send(summary);
    } catch (err) {
        res.status(500).send({ error: 'Erro ao processar o PDF', details: err.message });
    }
});

function transformTextToJson(part) {

  const jsonContent = JSON.parse(part.replace(/```json\n|\n```/g, ''));
  return jsonContent;
}


// Configurar porta
const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
