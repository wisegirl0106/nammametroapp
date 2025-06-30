// chatbot.js
const http = require('http');

async function askMetroBot(question) {
    const data = JSON.stringify({
        model: "llama3",
        prompt: question,
        stream: false
    });

    const options = {
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const lines = body.trim().split('\n');
                    const responses = lines.map(line => JSON.parse(line).response).join('');
                    resolve(responses.trim());
                } catch (err) {
                    console.error("Parsing error:", err);
                    reject("MetroBot had trouble replying.");
                }
            });
        });

        req.on('error', (err) => {
            console.error("Error contacting Ollama:", err);
            reject("MetroBot is offline or busy.");
        });

        req.write(data);
        req.end();
    });
}

module.exports = { askMetroBot };