export function normalizarTextoBusqueda(texto) {
    if (!texto) return '';
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Elimina tildes y diacríticos
        .replace(/[^a-z0-9\s-]/g, ' ')   // Mantiene letras, números, espacios y guiones
        .replace(/\s+/g, ' ')
        .trim();
}

export function calcularDistanciaLevenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = [];
    for (let i = 0; i <= b.length; i++) row[i] = i;

    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            let val;
            if (a.charAt(i - 1) === b.charAt(j - 1)) {
                val = row[j - 1];
            } else {
                val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }
    return row[b.length];
}

function esSubsecuenciaEnPalabra(sub, str) {
    if (sub.length < 3 || str.length < sub.length) return false;
    let subIdx = 0;
    for (let i = 0; i < str.length && subIdx < sub.length; i++) {
        if (str[i] === sub[subIdx]) {
            subIdx++;
        }
    }
    return subIdx === sub.length;
}

/**
 * Evalúa el puntaje de coincidencia de un token (término buscado) contra una palabra del producto.
 * Retorna un puntaje numérico (0 si no coincide).
 */
function puntajeCoincidenciaPalabra(token, palabra) {
    if (!token || !palabra) return 0;

    const cleanToken = token.replace(/-/g, '');
    const cleanPalabra = palabra.replace(/-/g, '');

    // 1. Coincidencia exacta (con o sin guiones)
    if (palabra === token || cleanPalabra === cleanToken) {
        return 100;
    }

    const lenToken = token.length;
    const lenPalabra = palabra.length;

    // Reglas para tokens de 1 solo carácter (evitar falsos positivos masivos)
    if (lenToken === 1) {
        if (palabra.startsWith(token)) return 60;
        return 0;
    }

    // Reglas para tokens de 2 caracteres
    if (lenToken === 2) {
        if (palabra.startsWith(token) || cleanPalabra.startsWith(cleanToken)) return 75;
        if (palabra.includes(token) || cleanPalabra.includes(cleanToken)) return 50;
        return 0;
    }

    // 2. Prefijo exacto (la palabra empieza con el token, ej: "amort" en "amortiguador")
    if (palabra.startsWith(token) || cleanPalabra.startsWith(cleanToken)) {
        const ratio = lenToken / lenPalabra;
        return 70 + Math.round(ratio * 20); // 70 - 90
    }

    // 3. Subcadena exacta dentro de la palabra (ej: "esta" o "iesta" en "fiesta")
    if (palabra.includes(token) || cleanPalabra.includes(cleanToken)) {
        const ratio = lenToken / lenPalabra;
        return 55 + Math.round(ratio * 20); // 55 - 75
    }

    // 4. Tolerancia a errores tipográficos (Levenshtein)
    const diffLen = Math.abs(lenToken - lenPalabra);

    // Distancia Levenshtein en palabras de longitud similar
    if (diffLen <= 2) {
        const dist = calcularDistanciaLevenshtein(token, palabra);
        if (dist === 1) {
            // 1 error (ej: "fista" vs "fiesta", "iesta" vs "fiesta", "fest" vs "fiest")
            return 60;
        }
        if (dist === 2 && lenToken >= 5 && lenPalabra >= 5) {
            // 2 errores en palabras medianas/largas (ej: "amortigudor" vs "amortiguador")
            return 40;
        }
    }

    // Subcadenas con Levenshtein para palabras largas (ej: "amortigudor" vs "amortiguadores")
    if (lenPalabra > lenToken && lenToken >= 4) {
        let mejorDistSub = 999;
        for (let i = 0; i <= lenPalabra - lenToken; i++) {
            const sub = palabra.substr(i, lenToken);
            const dist = calcularDistanciaLevenshtein(token, sub);
            if (dist < mejorDistSub) mejorDistSub = dist;
        }
        if (mejorDistSub === 1) {
            return 45;
        }
    }

    // 5. Subsecuencia difusa estrictamente dentro de la misma palabra (ej: "amrtg" en "amortiguador")
    if (lenToken >= 3 && (esSubsecuenciaEnPalabra(token, palabra) || esSubsecuenciaEnPalabra(cleanToken, cleanPalabra))) {
        const ratio = lenToken / lenPalabra;
        return 30 + Math.round(ratio * 15); // 30 - 45
    }

    return 0;
}

/**
 * Calcula el mejor puntaje de un token en un campo de texto con varias palabras.
 */
function evaluarPuntajeTokenEnCampo(token, campoTexto, pesoCampo = 1.0) {
    if (!token || !campoTexto) return 0;
    
    // Si el campo completo coincide exactamente
    if (campoTexto === token || campoTexto.replace(/-/g, '') === token.replace(/-/g, '')) {
        return 120 * pesoCampo;
    }

    // Coincidencia exacta de subfrase en el campo (ej: "fiesta power" dentro de "amortiguador fiesta power")
    if (campoTexto.includes(token)) {
        return 95 * pesoCampo;
    }

    // Coincidencia compacta para códigos (ej: "am104" en "am-104")
    const campoCompacto = campoTexto.replace(/[\s-]/g, '');
    const tokenCompacto = token.replace(/[\s-]/g, '');
    if (tokenCompacto.length >= 2 && campoCompacto.includes(tokenCompacto)) {
        return 90 * pesoCampo;
    }

    // Separar en palabras considerando espacios y guiones
    const palabras = campoTexto.split(/[\s]+/).filter(Boolean);
    let mejorPuntaje = 0;

    for (const palabra of palabras) {
        const score = puntajeCoincidenciaPalabra(token, palabra);
        if (score > mejorPuntaje) {
            mejorPuntaje = score;
        }
    }

    return mejorPuntaje * pesoCampo;
}

/**
 * Filtra y ordena un arreglo de productos utilizando búsqueda inteligente, difusa y con ranking de relevancia.
 * Busca en nombre, código, marca, categoría y ubicación.
 * @param {Array} productos
 * @param {string} query
 * @returns {Array}
 */
export function filtrarProductosFuzzy(productos, query) {
    if (!Array.isArray(productos) || productos.length === 0) return [];
    if (!query || !query.trim()) return productos;

    const cleanQuery = normalizarTextoBusqueda(query);
    const tokens = cleanQuery.split(' ').filter(t => t.length > 0);
    if (tokens.length === 0) return productos;

    const productosConScore = [];

    for (const p of productos) {
        const campoNombre = normalizarTextoBusqueda(p.nombre || '');
        const campoCodigo = normalizarTextoBusqueda(p.codigo || '');
        const campoMarca = normalizarTextoBusqueda(p.marca || '');
        const campoCategoria = normalizarTextoBusqueda(p.categoria || '');
        const campoUbicacion = normalizarTextoBusqueda(p.ubicacion || '');

        let matchTodosTokens = true;
        let scoreTotal = 0;

        for (const token of tokens) {
            const scoreCodigo = evaluarPuntajeTokenEnCampo(token, campoCodigo, 1.4);
            const scoreNombre = evaluarPuntajeTokenEnCampo(token, campoNombre, 1.2);
            const scoreMarca = evaluarPuntajeTokenEnCampo(token, campoMarca, 1.1);
            const scoreCategoria = evaluarPuntajeTokenEnCampo(token, campoCategoria, 1.0);
            const scoreUbicacion = evaluarPuntajeTokenEnCampo(token, campoUbicacion, 1.0);

            // El mejor puntaje que obtuvo este token en cualquiera de los campos
            const mejorScoreToken = Math.max(scoreCodigo, scoreNombre, scoreMarca, scoreCategoria, scoreUbicacion);

            // Si el token no coincidió en ningún campo con suficiente confianza, el producto queda descartado (AND lógico)
            if (mejorScoreToken <= 0) {
                matchTodosTokens = false;
                break;
            }

            scoreTotal += mejorScoreToken;
        }

        if (matchTodosTokens) {
            // Bonus adicional si el texto completo del nombre o código contiene la consulta completa consecutiva
            if (campoNombre.includes(cleanQuery) || campoCodigo.includes(cleanQuery)) {
                scoreTotal += 60;
            }
            productosConScore.push({ producto: p, score: scoreTotal });
        }
    }

    // Ordenar de mayor a menor relevancia
    productosConScore.sort((a, b) => b.score - a.score);

    return productosConScore.map(item => item.producto);
}
