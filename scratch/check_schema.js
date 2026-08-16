const fetch = require('node-fetch');

const SUPABASE_URL = 'https://tqlbmcqkottvclikpxur.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gq9mJ5Qo9MIa-k0pRTB7hQ_Rda5qtBX';

async function check() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?limit=5`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await res.json();
        console.log('Sample product keys:', Object.keys(data[0] || {}));
        console.log('Sample product:', data[0]);
    } catch (e) {
        console.error(e);
    }
}
check();
