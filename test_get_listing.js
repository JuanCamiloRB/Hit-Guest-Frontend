const https = require('https');

function fetch(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    const headers = {
        "Authorization": "Bearer Gn7mHH2Pt9pcA1WrbzMua4M0uve4abDTCR1s9jnJff091bb8",
        "Accept": "application/json"
    };

    console.log("Fetching listings...");
    const listData = await fetch("https://www.kunas.co/api/v1/listings", { headers });
    console.log("ListData:", listData);
}

run().catch(console.error);
