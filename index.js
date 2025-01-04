// Importar módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const pdfParse = require('pdf-parse'); // Para extrair texto do PDF
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors'); 
require('dotenv').config();
const cron = require('node-cron');


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
        const prompt = `Extraia um JSON com informações desse curriculo

          - Nome do candidato

          - Telefone

          - email

          - Posição desejada

          - Experiencias

          - Educação
           **Exemplo de saída correta é apenas o JSON, exemplo: **: ` + "```json"+`
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

async function fetchAndSendOnlinePlayers() {
  const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  const discordToken = process.env.DISCORD_API_KEY;; // Replace with your Discord bot token
  const discordChannelId = '1324898801776857199'; // Replace with your Discord channel ID

  discordClient.once('ready', () => {
    console.log('Discord bot is ready!');
  });

  discordClient.login(discordToken);

  try {
    // const playersToCheck = ['Frost Club', 'Pablo Alencar', 'Cheloko Rawexp']; // Replace with actual player names
    const response = await axios.get(`https://api.tibiadata.com/v4/guild/Eagle Eye`);
    const onlinePlayers = response.data.guild.members;
    const TibiaClass = { 'Elite Knight': '🛡️', 'Master Sorcerer': '🔥' , 'Royal Paladin': '🏹' , 'Elder Druid': '🌱' }; 
    const newOnline = [];
    onlinePlayers.sort((a, b) => b.level - a.level);

    for (const player of onlinePlayers) {
      if (player.level < 1000 && player.status === 'online') {

          newOnline.push(`\n${TibiaClass[player.vocation]} ${player.name} (${player.level})`);
      }
    }

    // Send message to Discord for each new online player
    const channel = await discordClient.channels.fetch(discordChannelId);
    // for (const player of newOnline) {
    await channel.send(`\n ### Dominados ~~Eagles~~ Online  (${newOnline.length}):  \n-# Membros abaixo do **LVL 1000**`);

    const chunkSize = 45;
    for (let i = 0; i < newOnline.length; i += chunkSize) {
      const chunk = newOnline.slice(i, i + chunkSize);
      await channel.send("```" + `${chunk.join(' ')}` + "```");
    }
  } catch (error) {
    console.error('Error fetching character data:', error);
  }
}

// Schedule the cron job to run every 5 minutes
// cron.schedule('*/1 * * * *', fetchAndSendOnlinePlayers);

// Your existing route
app.get('/hunteds/online', async (req, res) => {
  await fetchAndSendOnlinePlayers();
  res.send('Online players fetched and sent to Discord.');
});

function transformTextToJson(part) {

  const jsonContent = JSON.parse(part.replace(/```json\n|\n```/g, ''));
  return jsonContent;
}


// Configurar porta
const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
