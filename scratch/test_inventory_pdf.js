import fs from 'fs';

// Mock test for PDF inventory filtering and rendering
const sampleProducts = [
    { id: 1, nombre: 'amortiguador fiesta power', codigo: 'AM-01', categoria: 'Suspension', cantidad: 5, precio_costo_dolares_bcv: 15.5, precio_venta_dolares_bcv: 25.0 },
    { id: 2, nombre: 'filtro de aceite aveo', codigo: 'FL-02', categoria: 'Filtros', cantidad: 0, precio_costo_dolares_bcv: 3.0, precio_venta_dolares_bcv: 6.0 },
    { id: 3, nombre: 'pastillas de freno corolla', codigo: 'PF-03', categoria: 'Frenos', cantidad: 12, precio_costo_dolares_bcv: 10.0, precio_venta_dolares_bcv: 18.0 },
    { id: 4, nombre: 'bomba de agua aveo 1.6', codigo: 'BA-04', categoria: 'Motor', cantidad: 0, precio_costo_dolares_bcv: 20.0, precio_venta_dolares_bcv: 35.0 }
];

function testFilter(tipoFiltro) {
    let productosAImprimir = [];
    if (tipoFiltro === 'agotados') {
        productosAImprimir = sampleProducts.filter(p => (Number(p.cantidad) || 0) <= 0);
    } else if (tipoFiltro === 'todos') {
        productosAImprimir = [...sampleProducts];
    } else {
        productosAImprimir = sampleProducts.filter(p => (Number(p.cantidad) || 0) > 0);
    }
    return productosAImprimir;
}

console.log("=== TEST DISPONIBLES ===");
const disp = testFilter('disponibles');
console.log(disp.map(p => `${p.codigo}: ${p.nombre} (Stock: ${p.cantidad}, Costo: $${p.precio_costo_dolares_bcv}, Venta: $${p.precio_venta_dolares_bcv})`));

console.log("\n=== TEST TODOS ===");
const todos = testFilter('todos');
console.log(todos.map(p => `${p.codigo}: ${p.nombre} (Stock: ${p.cantidad}, Costo: $${p.precio_costo_dolares_bcv}, Venta: $${p.precio_venta_dolares_bcv})`));

console.log("\n=== TEST AGOTADOS ===");
const agotados = testFilter('agotados');
console.log(agotados.map(p => `${p.codigo}: ${p.nombre} (Stock: ${p.cantidad}, Costo: $${p.precio_costo_dolares_bcv}, Venta: $${p.precio_venta_dolares_bcv})`));
