const sampleProducts = [
    { id: 1, nombre: 'amortiguador fiesta power', codigo: 'AM-01', categoria: 'Suspension', cantidad: 5, precio_costo_dolares_bcv: 15.5, precio_venta_dolares_bcv: 25.0 },
    { id: 2, nombre: 'filtro de aceite aveo', codigo: 'FL-02', categoria: 'Filtros', cantidad: 0, precio_costo_dolares_bcv: 3.0, precio_venta_dolares_bcv: 6.0 }
];

function generateRows(tipoFiltro) {
    const esConteoVacio = (tipoFiltro === 'conteo' || tipoFiltro === 'vacio');
    return sampleProducts.map(item => {
        const cantidadHtml = esConteoVacio ? '' : `${item.cantidad}`;
        return `<tr><td>${item.codigo}</td><td>${item.nombre}</td><td>${cantidadHtml}</td><td>$${item.precio_costo_dolares_bcv}</td><td>$${item.precio_venta_dolares_bcv}</td><td>[ ]</td></tr>`;
    });
}

console.log("=== CONTEO FISICO (CASILLA VACIA) ===");
console.log(generateRows('conteo').join('\n'));

console.log("\n=== FULL (CON STOCK) ===");
console.log(generateRows('full').join('\n'));
