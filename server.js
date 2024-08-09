const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');
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

// Endpoint per restituire il JSON statico
app.get('/url', (req, res) => {
    const staticData = {
        "name": "Kumade TV",
        "author": "@Kumade23",
        "image": "https://telegra.ph/file/033790d0e590f180ed10e.png",
        "info": "",
        "telegram": "t.me/Kumade23",
        "url": "",
        "groups": [
            {
                "name": "ENTRA",
                "image": "https://telegra.ph/file/033790d0e590f180ed10e.png",
                "info": "ENTER",
                "url": "https://kumadetv.onrender.com/playlist",
                "import": false
            }
        ]
    };

    res.json(staticData);
});

// Endpoint per aggiornare i dati tramite scraping
app.post('/playlist', async (req, res) => {
    try {
        const response = await axios.get('https://calcio.run/streaming-gratis-calcio-1.php');
        const htmlContent = response.data;
        const $ = cheerio.load(htmlContent);
        const groups = {};

        $('li').each((i, element) => {
            const titleElement = $(element).find('.kode_ticket_text h6');
            const event1Element = $(element).find('.ticket_title h2').first();
            const event2Element = $(element).find('.ticket_title h2').last();
            const timeElement = $(element).find('.kode_ticket_text p');
            const linkElement = $(element).find('.ticket_btn a');

            const title = titleElement.length ? titleElement.text().trim() : null;
            const event1 = event1Element.length ? event1Element.text().trim() : null;
            const event2 = event2Element.length ? event2Element.text().trim() : null;
            const time = timeElement.length ? timeElement.text().trim() : null;
            const link = linkElement.length ? linkElement.attr('href').trim() : null;

            if (title && event1 && event2 && time && link) {
                if (!groups[title]) {
                    groups[title] = {
                        name: title,
                        image: `https://kumadetv.onrender.com/images/group_${i}.png`,
                        stations: []
                    };
                }

                groups[title].stations.push({
                    name: `${event1} - ${event2} - ${time}`,
                    url: link,
                    isHost: "true"
                });

                const imagePath = `./public/images/group_${i}.png`;
                generateImageWithText(title, imagePath);
            }
        });

        const result = {
            name: "Kumade TV",
            author: "@Kumade23",
            image: "https://telegra.ph/file/033790d0e590f180ed10e.png",
            info: "",
            groups: Object.values(groups)
        };

        cachedData = result;

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
