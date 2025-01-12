// Importar módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const pdfParse = require('pdf-parse'); // Para extrair texto do PDF
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors'); 
require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis('rediss://red-cu1egud2ng1s73ebc2hg:kKHb8DsqAP2c9dRQ9yZT4gwfp671JrUq@oregon-redis.render.com:6379');


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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndSendOnlinePlayers() {
  const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  const discordToken = process.env.DISCORD_API_KEY;

  discordClient.once('ready', () => {
    console.log('Discord bot is ready!');
  });

  discordClient.login(discordToken);

  try {
    const response = await axios.get(`https://api.tibiadata.com/v4/guild/Eagle Eye`);
    const onlinePlayers = response.data.guild.members;
    const TibiaClass = { 'Elite Knight': '🛡️', 'Master Sorcerer': '🔥' , 'Royal Paladin': '🏹' , 'Elder Druid': '🌱' }; 
    const newOnline = [];
    const newDeaths = [];
    onlinePlayers.sort((a, b) => b.level - a.level);

    const chunkSize = 20;
    for (let i = 0; i < onlinePlayers.length; i += chunkSize) {
      const chunk = onlinePlayers.slice(i, i + chunkSize);

      const playerPromises = chunk.map(async (player) => {
        const deaths = await getCharacterDeaths(player.name);

        if (deaths.length) {
          for (const death of deaths) {
            newDeaths.push(death);
          }
        }

        if (player.status === 'online') {
          newOnline.push(`\n${TibiaClass[player.vocation]} ${player.name} (${player.level})`);
        }
      });

      await Promise.all(playerPromises);
    }

    sendDiscordOnlineMessage(newOnline, discordClient);
    await sendDiscordDeathsMessage(newDeaths, discordClient);
  } catch (error) {
    console.error('Error fetching character data:', error.message);
    console.error('Error details:', error.response ? error.response.data : error);
  }
}

async function sendDiscordOnlineMessage(newOnline, discordClient) {
  const discordChannelId = '1324898801776857199';

  const channel = await discordClient.channels.fetch(discordChannelId);
  await channel.send(`\n ### Dominados ~~Eagles~~ Online  (${newOnline.length}):  \n-# Todos os membros da guild Eagle Online`);

  const chunkSize = 45;
  for (let i = 0; i < newOnline.length; i += chunkSize) {
    const chunk = newOnline.slice(i, i + chunkSize);
    await channel.send("```" + `${chunk.join(' ')}` + "```");
  }
}

async function sendDiscordDeathsMessage(dominadosMortos, discordClient) {
  const discordChannelId = '1325235117136023552'; // Replace with your Discord channel ID

  const channel = await discordClient.channels.fetch(discordChannelId);
  const playerPromises = dominadosMortos.map(async (death) => {
    
    await channel.send(`\n### 🚨🚨🚨 ATENÇÃO!! 1 minuto de silencio para: 🚨🚨🚨\n👼 Player: **${death.playerName}**\n🎯 Level: **${death.level}** \n🏷️ Reason: **${death.reason}** \n⏰ Time: **${death.time}**\n-# 🪦 **RIP**! Sentiremos sempre sua falta!`);
  });

  await Promise.all(playerPromises);


  
}


app.get('/character/:name', async (req, res) => {
  const characterName = req.params.name;
  
  try {
    const retorno = await getCharacterDeaths(characterName, res);    
    res.json(retorno);
  } catch (error) {
    console.error('Error fetching character data', error);
    res.status(500).send('Error fetching character data');
  }
});

async function getCharacterDeaths(characterName){
  try {
    const response = await axios.get(`https://api.tibiadata.com/v4/character/${encodeURIComponent(characterName)}`);
    const characterData = response.data.character;
    if(!characterData.deaths || characterData.deaths.length === 0){
      return [];
    }

    const deaths = characterData.deaths;
    // List deaths
    const deathList = []

    for (const death of deaths) {
      const ISODate = new Date(new Date(death.time).getTime() - 3 * 60 * 60 * 1000).toISOString()
      const deathKey = `${characterName}:${ISODate}`;
      const existingDeath = await redis.exists(deathKey);
      if (!existingDeath) {
        const deathFormatted = await {
          playerName: characterName,
          time: ISODate,
          level: death.level,
          reason: death.reason,
        }
        await deathList.push(deathFormatted)
        await redis.hmset(deathKey, deathFormatted);
      }
    }
    return deathList;
  } catch (error) {
    console.error('Error fetching character data:', error.message);
    console.error('Error details:', error.response ? error.response.data : error);
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
