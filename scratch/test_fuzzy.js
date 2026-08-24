import { filtrarProductosFuzzy } from '../utils.js';

const sampleProducts = [
    { id: 1, nombre: 'amortiguador delantero izquierdo y derecho de fiesta power', codigo: 'AM-FIESTA-01', marca: 'Motorcraft', categoria: 'Suspension', ubicacion: 'A-1' },
    { id: 2, nombre: 'filtro de aceite aveo corsa optra spark', codigo: 'FL-002', marca: 'Millard', categoria: 'Filtros', ubicacion: 'B-2' },
    { id: 3, nombre: 'pastillas de freno delantera toyota corolla yaris', codigo: 'PF-003', marca: 'Brembo', categoria: 'Frenos', ubicacion: 'C-3' },
    { id: 4, nombre: 'bomba de agua chevrolet aveo 1.6', codigo: 'BA-004', marca: 'GMB', categoria: 'Motor', ubicacion: 'D-4' },
    { id: 5, nombre: 'kit de tiempo optra design limited', codigo: 'KT-005', marca: 'Gates', categoria: 'Motor', ubicacion: 'E-5' }
];

console.log("--- BUSQUEDA 'fiesta' ---");
console.log(filtrarProductosFuzzy(sampleProducts, 'fiesta').map(p => p.nombre));

console.log("\n--- BUSQUEDA 'esta' ---");
console.log(filtrarProductosFuzzy(sampleProducts, 'esta').map(p => p.nombre));

console.log("\n--- BUSQUEDA 'iesta' ---");
console.log(filtrarProductosFuzzy(sampleProducts, 'iesta').map(p => p.nombre));
