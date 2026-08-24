import { filtrarProductosFuzzy } from './test_new_fuzzy.js';

const inventory = [
    { id: 1, nombre: 'amortiguador delantero izquierdo y derecho de fiesta power', codigo: 'AM-FIESTA-01', marca: 'Motorcraft', categoria: 'Suspension', ubicacion: 'A-1' },
    { id: 2, nombre: 'filtro de aceite aveo corsa optra spark', codigo: 'FL-002', marca: 'Millard', categoria: 'Filtros', ubicacion: 'B-2' },
    { id: 3, nombre: 'pastillas de freno delantera toyota corolla yaris', codigo: 'PF-003', marca: 'Brembo', categoria: 'Frenos', ubicacion: 'C-3' },
    { id: 4, nombre: 'bomba de agua chevrolet aveo 1.6', codigo: 'BA-004', marca: 'GMB', categoria: 'Motor', ubicacion: 'D-4' },
    { id: 5, nombre: 'kit de tiempo optra design limited', codigo: 'KT-005', marca: 'Gates', categoria: 'Motor', ubicacion: 'E-5' },
    { id: 6, nombre: 'electroventilador ford fiesta move max power', codigo: 'EL-FIESTA-02', marca: 'Bosch', categoria: 'Electrico', ubicacion: 'A-2' },
    { id: 7, nombre: 'tripoides y puntas de tripoide fiesta ka ecosport', codigo: 'TR-1029', marca: 'NKN', categoria: 'Tren Delantero', ubicacion: 'B-1' },
    { id: 8, nombre: 'bujias punta de platino chevrolet corsa spark cruze', codigo: 'BJ-099', marca: 'NGK', categoria: 'Encendido', ubicacion: 'C-1' }
];

const testQueries = [
    'fiesta',
    'esta',
    'iesta',
    'fista',
    'fiest',
    'amortiguador',
    'amortigudor',
    'amrtg',
    'power fiesta',
    'AM-FIESTA',
    'fl 002',
    'brembo',
    'brenbo',
    'suspension',
    'suspencion',
    'A-1',
    'optra',
    'optra kit',
    'spark bujias'
];

for (const q of testQueries) {
    const results = filtrarProductosFuzzy(inventory, q);
    console.log(`Query: "${q}" -> ${results.length} resultados: ${results.map(r => r.nombre.slice(0, 30) + '...').join(' | ')}`);
}
