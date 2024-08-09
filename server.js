const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const session = require('express-session');

const app = express();
let cachedData = [];

// Configurazione middleware
app.use(express.json());  // Per analizzare il body delle richieste POST in formato JSON
app.use(express.static('public'));  // Servire i file statici dalla cartella "public"

// Configurazione delle sessioni
app.use(session({
    secret: 'mySecretKey',  // Cambia questa chiave con una chiave segreta sicura
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Cambia a true se usi HTTPS
}));

// Funzione per generare un'immagine 640x640 con il nome del gruppo
registerFont(path.join(__dirname, 'public/fonts/NotoColorEmoji-Regular.ttf'), { family: 'Noto Color Emoji' });

function generateImageWithText(text, outputPath) {
    const width = 640;
    const height = 640;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#00deff';
    ctx.fillRect(0, 0, width, height);

    function calculateFontSize(text, maxWidth, maxHeight) {
        let fontSize = 50;
        let textWidth, textHeight;
        ctx.font = `bold ${fontSize}px "Noto Color Emoji"`;

        do {
            const metrics = ctx.measureText(text);
            textWidth = metrics.width;
            textHeight = fontSize * 1.2;
            fontSize -= 1;

            ctx.font = `bold ${fontSize}px "Noto Color Emoji"`;
        } while ((textWidth > maxWidth || textHeight > maxHeight) && fontSize > 0);

        return fontSize;
    }

    const fontSize = calculateFontSize(text, width * 0.9, height * 0.9);

    ctx.font = `bold ${fontSize}px "Noto Color Emoji"`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const buffer = canvas.toBuffer('image/png');

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
}

// Middleware per verificare l'autenticazione
function checkAuth(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/');
    }
}

// Endpoint per gestire il login
app.post('/', (req, res) => {
    const { username, password } = req.body;

    // Verifica delle credenziali (qui è hardcoded per semplicità)
    if (username === 'admin' && password === 'password123') {
        req.session.loggedIn = true;
        return res.json({ success: true });
    } else {
        return res.json({ success: false });
    }
});

// Servire la pagina principale dopo il login
app.get('/scrape', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scrape.html'));
});

// Endpoint per restituire i dati (potrebbe essere utilizzato in futuro per mostrare i dati nella pagina principale)
app.get('/playlist', (req, res) => {
    res.json(cachedData);
});

// Endpoint per aggiornare i dati tramite scraping
app.post('/playlist', async (req, res) => {
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
                const groupName = lines[0];
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
            "name": "Kumade TV",
            "author": "@Kumade23",
            "image": "https://telegra.ph/file/033790d0e590f180ed10e.png",
            "info": "",
            "groups": groups
        };

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Endpoint per il logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Errore nel logout' });
        }
        res.redirect('/');
    });
});

// Avviare il server
app.listen(3000, () => {
    console.log('Server avviato su http://localhost:3000');
});
