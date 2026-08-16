function construirNombreArchivoFactura(venta) {
    const nombre = (venta.cliente_nombre || 'Consumidor Final').trim();
    const cedula = (venta.cliente_cedula || '').trim();

    let cleanNombre = nombre.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
    let cleanCedula = cedula.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');

    if (!cleanNombre) cleanNombre = 'Consumidor_Final';

    if (cleanCedula) {
        return `${cleanNombre}_${cleanCedula}`;
    }
    return `${cleanNombre}`;
}

const tests = [
    { venta: { cliente_nombre: 'Jose Perez', cliente_cedula: 'V-30405992' }, expected: 'Jose_Perez_V-30405992' },
    { venta: { cliente_nombre: 'TOTAL REPUESTOS CARS & SERVICES C.A.', cliente_cedula: 'J-12345678-9' }, expected: 'TOTAL_REPUESTOS_CARS_&_SERVICES_C.A._J-12345678-9' },
    { venta: { cliente_nombre: '', cliente_cedula: '' }, expected: 'Consumidor_Final' },
    { venta: { cliente_nombre: 'Maria Rodriguez', cliente_cedula: '' }, expected: 'Maria_Rodriguez' }
];

let allPassed = true;
for (const t of tests) {
    const result = construirNombreArchivoFactura(t.venta);
    console.log(`Input: ${JSON.stringify(t.venta)} => "${result}"`);
    if (result !== t.expected) {
        console.error(`❌ FAILED: Expected "${t.expected}", got "${result}"`);
        allPassed = false;
    }
}

if (allPassed) {
    console.log('✅ ALL PDF FILENAME TESTS PASSED!');
}
