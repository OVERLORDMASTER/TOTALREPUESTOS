import { showToast } from './utils.js';

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
    doc.querySelector('#fechaHora')?.setAttribute('value', new Date(venta.fecha).toISOString().slice(0, 16));
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
        const precioUnitarioBs = (item.precio_unitario * saleRate).toFixed(2);
        const subtotalBs = (item.cantidad * item.precio_unitario * saleRate).toFixed(2);
        const producto = productosCache.find(p => p.codigo === item.producto_codigo);
        const marca = producto ? (producto.marca || '') : '';

        const row = doc.createElement('tr');
        row.innerHTML = `
            <td><div class="codigo">${item.producto_codigo || ''}</div></td>
            <td><div class="text-left descripcion">${item.producto_nombre || ''}</div></td>
            <td><div class="marca">${marca}</div></td>
            <td><div class="precioBS">${precioUnitarioBs}</div></td>
            <td><div class="subtotalBS">${subtotalBs}</div></td>
            <td><div class="uds">${item.cantidad}</div></td>
        `;
        tableBody.appendChild(row);
    });

    doc.querySelector('#totalBS')?.setAttribute('value', parseFloat(venta.total_bs).toFixed(2));

    doc.querySelectorAll('.no-print, .page-number, #page-number').forEach(el => el.remove());
    doc.querySelectorAll('script').forEach(el => el.remove());

    const finalHtml = doc.documentElement.outerHTML;

    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
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
            } catch (e) {
                console.error('Error al intentar imprimir:', e);
                showToast('Error al abrir el diálogo de impresión.', 'error');
                reject(e);
            } finally {
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