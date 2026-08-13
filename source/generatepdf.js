import { showToast, formatCurrency, formatInteger } from '../utils.js';

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
        fetch('source/factura.html'),
        fetch('source/factura.css')
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

    // Establecer el título de la página, que se usará como nombre de archivo sugerido
    const titleTag = doc.querySelector('title');
    if (titleTag) {
        titleTag.textContent = `factura-${venta.id}`;
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

    // --- LLENAR LA SECCIÓN DE MÉTODOS DE PAGO ---
    const tipoPagoContainer = doc.querySelector('#tipoPagoContainer');
    let paymentMethodsHtml = '';
    try {
        const pagos = JSON.parse(venta.tipo_pago);
        if (Array.isArray(pagos) && pagos.length > 0) {
            paymentMethodsHtml = pagos.map(p => `<span class="payment-method-badge">Tipo de pago: ${p.metodo}</span>`).join('');
            paymentMethodsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 5px;">${paymentMethodsHtml}</div>`;
        } else {
            paymentMethodsHtml = `<span class="payment-method-badge">Tipo de pago: ${venta.tipo_pago || 'N/A'}</span>`;
        }
    } catch (e) {
        paymentMethodsHtml = `<span class="payment-method-badge">Tipo de pago: ${venta.tipo_pago || 'N/A'}</span>`;
    }
    if (tipoPagoContainer) {
        tipoPagoContainer.innerHTML = `<label>MÉTODOS DE PAGO:</label>${paymentMethodsHtml}`;
    }

    // --- LLENAR LA TABLA DE PRODUCTOS ---
    const tableBody = doc.querySelector('#tableBody');
    if (!tableBody) throw new Error('El elemento #tableBody no fue encontrado en la plantilla de la factura.');
    // Asegurarse de que el tbody esté completamente vacío antes de añadir filas.
    // La lógica de abajo añade una fila por cada producto en venta.detalles.
    // Si aparecen filas extra, revisar la plantilla 'factura.html' por <tr> estáticos fuera del #tableBody
    // o el CSS por estilos que creen la ilusión de filas vacías.
    tableBody.innerHTML = ''; 

    const style = doc.createElement('style');
    style.textContent = `
        @page {
            size: auto;
            margin: 10mm;
        }
        /* Forzar color de texto a negro para datos de cliente y productos */
        input,
        #tableBody td div {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: #000 !important;
        }
        /* Ocultar el icono de calendario en el input de fecha para la impresión */
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
            display: none;
            -webkit-appearance: none;
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
        .payment-method-badge {
            display: inline-block;
            background-color: #e0e0e0; /* Light grey background */
            color: #333; /* Dark text */
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75em; /* Smaller font size */
            white-space: nowrap; /* Prevent breaking */
            margin: 2px; /* Small margin between badges */
        }
        /* HACK: Cubierta para tapar el pie de página del navegador (URL, fecha, etc.) */
        @media print {
            .print-footer-cover {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 15mm; /* Altura para cubrir el pie de página, ajustar si es necesario */
                background-color: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .payment-method-badge {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background-color: #e0e0e0 !important;
                color: #333 !important;
            }
        }
    `;
    doc.head.appendChild(style);

    venta.detalles.forEach(item => {
        const precioUnitarioBs = formatCurrency(item.precio_unitario * saleRate);
        const subtotalBs = formatCurrency(item.cantidad * item.precio_unitario * saleRate);
        const producto = productosCache.find(p => p.codigo === item.producto_codigo);
        const marca = producto ? (producto.marca || '') : '';

        const row = doc.createElement('tr');
        row.innerHTML = `
            <td><div class="codigo">${item.producto_codigo || ''}</div></td>
            <td><div class="text-left descripcion">${item.producto_nombre || ''}</div></td>
            <td><div>${marca}</div></td>
            <td><div class="precioBS">${precioUnitarioBs}</div></td>
            <td><div class="subtotalBS">${subtotalBs}</div></td>
            <td><div class="uds">${formatInteger(item.cantidad)}</div></td>
            <td class="no-print"></td>
        `;
        tableBody.appendChild(row);
    });

    // Añadir el elemento que cubrirá el pie de página
    const footerCover = doc.createElement('div');
    footerCover.className = 'print-footer-cover';
    doc.body.appendChild(footerCover);

    doc.querySelector('#totalBS')?.setAttribute('value', formatCurrency(parseFloat(venta.total_bs)));

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

export async function generarInventarioPDF(productosCache = []) {
    console.log('Iniciando preparación de PDF de inventario...');

    const [htmlResponse, cssResponse] = await Promise.all([
        fetch('source/inventario_pdf.html'),
        fetch('source/inventario_pdf.css')
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

    // Establecer el título de la página, que se usará como nombre de archivo sugerido
    const titleTagInv = doc.querySelector('title');
    if (titleTagInv) {
        titleTagInv.textContent = 'inventario_actual';
    }

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

    // Añadir el elemento que cubrirá el pie de página
    const footerCover = doc.createElement('div');
    footerCover.className = 'print-footer-cover';
    doc.body.appendChild(footerCover);

    const table = doc.querySelector('#itemsTable');
    const templateTbody = table.querySelector('tbody');
    if (templateTbody) templateTbody.remove();

    const grouped = {};
    productosCache.forEach(p => {
        const cat = p.categoria && p.categoria.trim() !== '' ? p.categoria : 'Sin Categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    for (const categoria of sortedCategories) {
        const categoryTbody = doc.createElement('tbody');
        categoryTbody.className = 'category-group-tbody';

        const catRow = doc.createElement('tr');
        catRow.className = 'category-header-row';
        catRow.innerHTML = `<td colspan="4">${categoria}</td>`;
        categoryTbody.appendChild(catRow);

        const prods = grouped[categoria].sort((a, b) => a.nombre.localeCompare(b.nombre));
        prods.forEach(item => {
            const row = doc.createElement('tr');
            row.innerHTML = `
                <td><div>${item.codigo || ''}</div></td>
                <td><div class="text-left">${item.nombre || ''}</div></td>
                <td><div>${formatInteger(item.cantidad)}</div></td>
                <td class="checkbox-cell"></td>
            `;
            categoryTbody.appendChild(row);
        });
        table.appendChild(categoryTbody);
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