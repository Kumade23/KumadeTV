const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');

const app = express();

let cachedData = []

app.use(express.static('public'));  // Servire la pagina HTML e lo script JS

// Endpoint per restituire i dati
app.get('/api/scrape', (req, res) => {
    res.json(cachedData);
});

// Endpoint per aggiornare i dati con una richiesta POST
app.post('/api/scrape', async (req, res) => {
    try {
        const response = await axios.get('https://sub7goal.live/');
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);
        const link = $('a[href^="https://anonpaste.pw/v/"]').attr('href');

        if (!link) {
            return res.status(404).json({ error: 'Link non trovato' });
        }

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(link, { waitUntil: 'networkidle2' });
        await page.waitForSelector('body');

        const paragraphs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('p')).map(p => p.textContent);
        });

        let content = paragraphs.join('\n');
        const sections = content.split(/\n\s*\n/);

        let formattedData = [];

        sections.forEach(section => {
            const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (lines.length >= 3) {
                const name = lines[0];
                const time = lines[1];

                lines.slice(2).forEach(linkLine => {
                    if (linkLine.startsWith('1: ')) {
                        const url = linkLine.split(' ')[1];
                        const languageMatch = linkLine.match(/\((.*?)\)/);
                        const language = languageMatch ? languageMatch[0] : '';
                        formattedData.push({
                            "name": `${name} (${time}) - ${language}`,
                            "url": url,
                            "isHost": "true"
                        });
                    }
                });
            }
        });

        await browser.close();

        cachedData = {
            "name": "DAZN X",
            "author": "@Kumade23",
            "image": "http://telegra.ph/file/445fc5e7aac0f1e0fa03d.jpg",
            "info": "EVENTI DEL GIORNO",
            "stations": formattedData 
        }; 

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

app.listen(3000, () => {
    console.log('Server avviato su http://localhost:3000');
});
