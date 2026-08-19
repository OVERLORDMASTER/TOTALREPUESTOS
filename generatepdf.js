/*
 * DEPRECADO: Este archivo ya no se utiliza.
 * La funcionalidad ha sido movida a /source/generatepdf.js
 */
/*
 * DEPRECADO: Este archivo ya no se utiliza.
 * La funcionalidad ha sido movida a /source/generatepdf.js
 */
import { showToast } from './utils.js';

// --- FUNCIONES DE FORMATO DE NÚMEROS ---
/**
 * Formatea un número como moneda con separador de miles (punto) y dos decimales (coma).
 * Ej: 1234.56 -> 1.234,56
 */
function formatCurrency(number) {
    const val = Number.isFinite(Number(number)) ? Number(number) : 0;
    const parts = val.toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intPart},${parts[1]}`;
}
function formatInteger(number) {
    const val = Number.isFinite(Number(number)) ? Math.round(Number(number)) : 0;
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Fetches an image from a URL and converts it to a Base64 data URL.
 * @param {string} url The URL of the image.
 * @returns {Promise<string|null>} A promise that resolves with the Base64 string or null on error.
 */
async function imageToBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error(`Fallo al obtener o convertir la imagen a base64: ${url}`, e);
        return null;
    }
}

function formatFechaHoraLocal(fechaInput) {
    const d = fechaInput ? new Date(fechaInput) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const year = validDate.getFullYear();
    const month = String(validDate.getMonth() + 1).padStart(2, '0');
    const day = String(validDate.getDate()).padStart(2, '0');
    const hours = String(validDate.getHours()).padStart(2, '0');
    const minutes = String(validDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export async function generarFacturaPDF(venta, paraleloRate, productosCache = []) {
    console.log('Iniciando preparación de HTML para impresión para la venta ID:', venta.id);

    const [htmlResponse, cssResponse] = await Promise.all([
        fetch('factura.html'),
        fetch('factura.css')
    ]).catch(err => {
        showToast('Error de red al cargar recursos de factura.', 'error');
        console.error('Error de red:', err);
        throw err;
    });

    if (!htmlResponse.ok) {
        throw new Error(`No se pudo cargar factura.html: ${htmlResponse.statusText}`);
    }
    if (!cssResponse.ok) {
        throw new Error(`No se pudo cargar factura.css: ${cssResponse.statusText}`);
    }

    const [htmlTemplate, cssTemplate] = await Promise.all([htmlResponse.text(), cssResponse.text()]);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTemplate, 'text/html');

    const styleElement = doc.createElement('style');
    styleElement.textContent = cssTemplate;
    doc.head.appendChild(styleElement);

    // Limpiar título de la página
    const titleTag = doc.querySelector('title');
    if (titleTag) {
        titleTag.textContent = '';
    }

    // Convertir el logo a Base64 y embeberlo
    try {
        const logoImg = doc.querySelector('.logo-section img');
        if (logoImg) {
            const logoUrl = new URL(logoImg.getAttribute('src'), window.location.href).href;
            const base64Logo = await imageToBase64(logoUrl);
            if (base64Logo) {
                logoImg.src = base64Logo;
            }
        }
    } catch (error) {
        console.error('Error al procesar el logo de la factura:', error);
    }

    // --- CONECTAR DATOS DE LA VENTA SIN MODIFICAR LA ESTRUCTURA ---
    const saleRate = venta.total_usd > 0 ? venta.total_bs / venta.total_usd : paraleloRate;
    const currentUser = localStorage.getItem('usuario') || 'Sistema';

    doc.querySelector('#invoiceId')?.setAttribute('value', `#${venta.id}`);
    doc.querySelector('#fechaHora')?.setAttribute('value', formatFechaHoraLocal(venta.fecha));
    doc.querySelector('#nombreCliente')?.setAttribute('value', venta.cliente_nombre || 'Consumidor Final');
    doc.querySelector('#cedula')?.setAttribute('value', venta.cliente_cedula || 'V-00000000');
    doc.querySelector('#direccion')?.setAttribute('value', venta.cliente_direccion || '');
    doc.querySelector('#vendedor')?.setAttribute('value', currentUser);
    doc.querySelector('#garantia')?.setAttribute('value', '');

    // Asignar tipo de pago manteniendo la estructura exacta de la etiqueta y valor
    const tipoPagoInput = doc.querySelector('#tipoPago');
    if (tipoPagoInput) {
        tipoPagoInput.setAttribute('value', venta.tipo_pago || '');
    } else {
        const tipoPagoContainer = doc.querySelector('#tipoPagoContainer');
        if (tipoPagoContainer) {
            tipoPagoContainer.innerHTML = `<label>TIPO DE PAGO :</label><input type="text" id="tipoPago" value="${venta.tipo_pago || ''}">`;
        }
    }

    // --- LLENAR LA TABLA DE PRODUCTOS ---
    const tableBody = doc.querySelector('#tableBody');
    if (!tableBody) throw new Error('El elemento #tableBody no fue encontrado en la plantilla de la factura.');
    tableBody.innerHTML = '';

    const style = doc.createElement('style');
    style.textContent = `
        @page {
            size: auto;
            margin: 10mm;
        }
        #tableBody td div {
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            text-align: center;
        }
        #tableBody td .text-left {
            text-align: left;
        }
    `;
    doc.head.appendChild(style);

    venta.detalles.dates?.forEach?.(item => {}) || venta.detalles.forEach(item => {
        const precioUnitarioBs = formatCurrency(item.precio_unitario * saleRate);
        const subtotalBs = formatCurrency(item.cantidad * item.precio_unitario * saleRate);
        const producto = productosCache.find(p => p.codigo === item.producto_codigo);
        const marca = producto ? (producto.marca || '') : '';

        const row = doc.createElement('tr');
        row.innerHTML = `
            <td><div class="codigo">${item.producto_codigo || ''}</div></td>
            <td><div class="uds">${formatInteger(item.cantidad)}</div></td>
            <td><div class="text-left descripcion">${item.producto_nombre || ''}</div></td>
            <td><div>${marca}</div></td>
            <td><div class="precioBS">${precioUnitarioBs}</div></td>
            <td><div class="subtotalBS">${subtotalBs}</div></td>
            <td class="no-print"></td>
        `;
        tableBody.appendChild(row);
    });

    doc.querySelector('#totalBS')?.setAttribute('value', formatCurrency(parseFloat(venta.total_bs)));

    const finalHtml = doc.documentElement.outerHTML;
    const iframe = document.createElement('iframe');

    return new Promise((resolve, reject) => {
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';

        iframe.onload = function() {
            // Envolver la lógica de impresión en un bloque try/finally
            // para asegurar la limpieza del iframe.
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                showToast('Se ha abierto el diálogo de impresión.', 'success');
                resolve();
            } catch (e) {
                console.error('Error durante el proceso de impresión:', e);
                showToast('No se pudo abrir el diálogo de impresión.', 'error');
                reject(e);
            } finally {
                // Eliminar el iframe después de un breve retraso para permitir
                // que el diálogo de impresión se procese correctamente.
                setTimeout(() => {
                    if (iframe.parentElement) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            }
        };

        iframe.srcdoc = finalHtml;
        document.body.appendChild(iframe);
    });
}

export async function generarInventarioPDF(productosCache = []) {
    console.log('Iniciando preparación de PDF de inventario...');

    const [htmlResponse, cssResponse] = await Promise.all([
        fetch('inventario_pdf.html'),
        fetch('inventario_pdf.css')
    ]).catch(err => {
        showToast('Error de red al cargar recursos del PDF.', 'error');
        console.error('Error de red:', err);
        throw err;
    });

    if (!htmlResponse.ok) throw new Error(`No se pudo cargar inventario_pdf.html: ${htmlResponse.statusText}`);
    if (!cssResponse.ok) throw new Error(`No se pudo cargar inventario_pdf.css: ${cssResponse.statusText}`);

    const [htmlTemplate, cssTemplate] = await Promise.all([htmlResponse.text(), cssResponse.text()]);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTemplate, 'text/html');

    const styleElement = doc.createElement('style');
    styleElement.textContent = cssTemplate;
    doc.head.appendChild(styleElement);

    // Convertir el logo a Base64 y embeberlo
    try {
        const logoImg = doc.querySelector('.logo-section img');
        if (logoImg) {
            const logoUrl = new URL(logoImg.getAttribute('src'), window.location.href).href;
            const base64Logo = await imageToBase64(logoUrl);
            if (base64Logo) logoImg.src = base64Logo;
        }
    } catch (error) {
        console.error('Error al procesar el logo del inventario:', error);
    }

    // Llenar información de resumen
    doc.querySelector('#fechaImpresion').textContent = new Date().toLocaleString('es-VE');
    doc.querySelector('#totalProductos').textContent = formatInteger(productosCache.length);
    const totalUnidades = productosCache.reduce((sum, p) => sum + p.cantidad, 0);
    doc.querySelector('#totalUnidades').textContent = formatInteger(totalUnidades);

    const tableBody = doc.querySelector('#tableBody');
    tableBody.innerHTML = '';

    const grouped = {};
    productosCache.forEach(p => {
        const cat = p.categoria && p.categoria.trim() !== '' ? p.categoria : 'Sin Categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    for (const categoria of sortedCategories) {
        const catRow = doc.createElement('tr');
        catRow.className = 'category-header-row';
        catRow.innerHTML = `<td colspan="4">${categoria}</td>`;
        tableBody.appendChild(catRow);

        const prods = grouped[categoria].sort((a, b) => a.nombre.localeCompare(b.nombre));
        prods.forEach(item => {
            const row = doc.createElement('tr');
            row.innerHTML = `
                <td><div>${item.codigo || ''}</div></td>
                <td><div class="text-left">${item.nombre || ''}</div></td>
                <td><div>${formatInteger(item.cantidad)}</div></td>
                <td class="checkbox-cell"></td>
            `;
            tableBody.appendChild(row);
        });
    }

    const finalHtml = doc.documentElement.outerHTML;
    const iframe = document.createElement('iframe');

    return new Promise((resolve, reject) => {
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';

        iframe.onload = function() {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                showToast('Se ha abierto el diálogo de impresión.', 'success');
                resolve();
            } catch (e) { reject(e); } finally {
                setTimeout(() => { if (iframe.parentElement) document.body.removeChild(iframe); }, 1000);
            }
        };

        iframe.srcdoc = finalHtml;
        document.body.appendChild(iframe);
    });
}