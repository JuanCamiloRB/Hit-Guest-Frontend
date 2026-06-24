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

    console.log("Fetching properties...");
    let res = await fetch("https://www.kunas.co/api/v1/properties", { headers });
    let propArr = Array.isArray(res.data.data) ? res.data.data : res.data;
    if (propArr.length > 0) {
        let firstProp = propArr[0].uuid;
        console.log("First property uuid:", firstProp);
        let listRes = await fetch(`https://www.kunas.co/api/v1/listings?property_uuid=${firstProp}`, { headers });
        console.log("Status for property_uuid:", listRes.status);
    }
}

run().catch(console.error);
