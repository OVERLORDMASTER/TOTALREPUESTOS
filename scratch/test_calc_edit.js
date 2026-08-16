const fetch = require('node-fetch');

const SUPABASE_URL = 'https://tqlbmcqkottvclikpxur.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gq9mJ5Qo9MIa-k0pRTB7hQ_Rda5qtBX';

function calcularPreciosPorcentaje(precioProv, porcDesc, porcGanancia, rateOficial = 36.5, rateParalelo = 40.0) {
    const costoEfectivo = precioProv * (1 - (porcDesc / 100));
    const ventaEfectivo = costoEfectivo * (1 + (porcGanancia / 100));
    let costoUsdBcv = costoEfectivo;
    let ventaUsdBcv = ventaEfectivo;
    
    const pRate = (rateParalelo > 0) ? rateParalelo : (rateOficial > 0 ? rateOficial : 1);
    const oRate = (rateOficial > 0) ? rateOficial : (rateParalelo > 0 ? rateParalelo : 1);
    
    if (oRate > 0 && pRate > 0) {
        const costoBsBcv = costoEfectivo * pRate;
        costoUsdBcv = costoBsBcv / oRate;
        ventaUsdBcv = costoUsdBcv * (1 + (porcGanancia / 100));
    }

    return {
        costoEfectivo,
        ventaEfectivo,
        costoUsdBcv,
        ventaUsdBcv
    };
}

async function testEditProductCalculator() {
    console.log('--- TEST: Edit Product with Percentage/Calculator ---');
    
    // 1. Simular cálculo con precioProv = 12, descuento = 5%, ganancia = 30%
    const calculados = calcularPreciosPorcentaje(12, 5, 30, 36.5, 40.0);
    console.log('Resultados de cálculo:', calculados);

    // 2. Probar actualización en Supabase de un producto de prueba
    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?limit=1`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const prods = await res.json();
    const prod = prods[0];
    console.log('Target product code:', prod.codigo);

    const updatePayload = {
        nombre: prod.nombre,
        categoria: prod.categoria,
        marca: prod.marca,
        ubicacion: prod.ubicacion,
        cantidad: prod.cantidad,
        precio_costo_dolares_bcv: parseFloat(calculados.costoUsdBcv.toFixed(4)),
        precio_venta_dolares_bcv: parseFloat(calculados.ventaUsdBcv.toFixed(4)),
        'costo_$_efectivo': parseFloat(calculados.costoEfectivo.toFixed(4)),
        'venta_$_efectivo': parseFloat(calculados.ventaEfectivo.toFixed(4)),
        modo_creacion: 'calculator',
        'calc_costo_$_efectivo': 12,
        calc_descuento: 5,
        calc_ganancia: 30
    };

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/productos?codigo=eq.${prod.codigo}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(updatePayload)
    });

    console.log('PATCH Status:', patchRes.status);
    const patchedData = await patchRes.json();
    console.log('Saved product result in DB:', patchedData[0]);

    if (patchRes.status === 200 && patchedData[0]?.calc_ganancia === 30) {
        console.log('✅ TEST PASSED: Product with percentage calculation edited and persisted successfully!');
    } else {
        console.error('❌ TEST FAILED');
    }
}

testEditProductCalculator();
