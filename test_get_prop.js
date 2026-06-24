const https = require('https');

function fetch(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, data }); }
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

    console.log("Fetching property 019ddbc1-1396-707a-bade-c7d7b5175730...");
    let res = await fetch("https://www.kunas.co/api/v1/properties/019ddbc1-1396-707a-bade-c7d7b5175730", { headers });
    console.log("Status:", res.status);
    console.log("Property Keys:", Object.keys(res.data.data || res.data));
    let prop = res.data.data || res.data;
    console.log("Has listings?", !!prop.listings);
    console.log("Has units?", !!prop.units);
}

run().catch(console.error);
