const fetch = require('node-fetch');

const SUPABASE_URL = 'https://tqlbmcqkottvclikpxur.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gq9mJ5Qo9MIa-k0pRTB7hQ_Rda5qtBX';

async function testUpdate() {
    try {
        // Obtenemos un producto para ver sus datos
        const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const prods = await res.json();
        const prod = prods[0];
        console.log('Testing with product:', prod.codigo);

        // Probemos un update con los datos calculados exactamente como se hace en app.js
        const updatePayload = {
            categoria: prod.categoria,
            nombre: prod.nombre,
            marca: prod.marca,
            ubicacion: prod.ubicacion,
            cantidad: prod.cantidad,
            precio_costo_dolares_bcv: 10.5,
            precio_venta_dolares_bcv: 15.2,
            'venta_$_efectivo': 15.0,
            'costo_$_efectivo': 10.0,
            modo_creacion: 'calculator',
            'calc_costo_$_efectivo': 10.0,
            calc_descuento: 0,
            calc_ganancia: 50
        };

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/productos?codigo=eq.${prod.codigo}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(updatePayload)
        });

        console.log('Update status:', updateRes.status);
        const updateData = await updateRes.json();
        console.log('Update result:', updateData);
    } catch (e) {
        console.error('Error in testUpdate:', e);
    }
}

testUpdate();
