const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const app = express();

let cachedData = [];

app.use(express.static('public'));  // Servire la pagina HTML e lo script JS

// Funzione per generare un'immagine 640x640 con il nome del gruppo
function generateImageWithText(text, outputPath) {
    const width = 640;  // Larghezza dell'immagine
    const height = 640;  // Altezza dell'immagine
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Sfondo semplice
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, width, height);

    // Testo centrato
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const buffer = canvas.toBuffer('image/png');

    // Creare la directory se non esiste
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
}

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

        let groups = [];

        sections.forEach((section, index) => {
            const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (lines.length >= 3) {
                const groupName = lines[0];  // Usa la prima riga come nome del gruppo
                const time = lines[1];

                const stations = [];

                lines.slice(2).forEach(linkLine => {
                    if (linkLine.startsWith('1: ')) {
                        const url = linkLine.split(' ')[1];
                        const languageMatch = linkLine.match(/\((.*?)\)/);
                        const language = languageMatch ? languageMatch[0] : '';
                        stations.push({
                            "name": `${groupName} (${time}) - ${language}`,
                            "url": url,
                            "isHost": "true"
                        });
                    }
                });

                if (stations.length > 0) {
                    const imagePath = `./public/images/group_${index}.png`;
                    generateImageWithText(groupName, imagePath);
                    groups.push({
                        "name": groupName,
                        "image": `https://kumadetv.onrender.com/images/group_${index}.png`,
                        "stations": stations
                    });
                }
            }
        });

        await browser.close();

        cachedData = {
            "name": "DAZN X",
            "author": "@Kumade23",
            "image": "http://telegra.ph/file/445fc5e7aac0f1e0fa03d.jpg",
            "info": "",
            "groups": groups
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
