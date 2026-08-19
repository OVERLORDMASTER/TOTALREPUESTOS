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

function construirNombreArchivoFactura(venta) {
    const nombre = (venta.cliente_nombre || 'Consumidor Final').trim();
    const cedula = (venta.cliente_cedula || '').trim();

    // Limpiar caracteres no permitidos en nombres de archivos
    let cleanNombre = nombre.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
    let cleanCedula = cedula.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');

    if (!cleanNombre) cleanNombre = 'Consumidor_Final';

    if (cleanCedula) {
        return `${cleanNombre}_${cleanCedula}`;
    }
    return `${cleanNombre}`;
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

    const nombreArchivo = construirNombreArchivoFactura(venta);
    const tituloOriginal = document.title;

    // Determinar el método de pago para elegir la plantilla correcta
    let pagos = [];
    try {
        pagos = JSON.parse(venta.tipo_pago);
    } catch (e) {
        // Fallback para formato antiguo (string simple)
    }
    const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
    const pagoEnEfectivo = Array.isArray(pagos) && pagos.some(p => metodosEnEfectivo.includes(p.metodo));
    const templateFileName = pagoEnEfectivo ? 'factura_USD.html' : 'factura.html';

    const [htmlResponse, cssResponse] = await Promise.all([
        fetch(`source/${templateFileName}`),
        fetch('source/factura.css')
    ]).catch(err => {
        showToast('Error de red al cargar recursos de factura.', 'error');
        console.error('Error de red:', err);
        throw err;
    });

    if (!htmlResponse.ok) {
        throw new Error(`No se pudo cargar ${templateFileName}: ${htmlResponse.statusText}`);
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

    // Establecer el título de la página interna del PDF
    let titleTag = doc.querySelector('title');
    if (!titleTag) {
        titleTag = doc.createElement('title');
        doc.head.appendChild(titleTag);
    }
    titleTag.textContent = nombreArchivo;

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

    // --- LLENAR LA SECCIÓN DE MÉTODOS DE PAGO ---
    const tipoPagoContainer = doc.querySelector('#tipoPagoContainer');
    let paymentMethodsHtml = '';
    try {
        pagos = JSON.parse(venta.tipo_pago);
        if (Array.isArray(pagos) && pagos.length > 0) {
            paymentMethodsHtml = pagos.map(p => {
                const isBs = p.moneda === 'BS' || ['Pago Móvil', 'Bolívares en efectivo'].includes(p.metodo);
                let displayMonto = '';
                if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                    displayMonto = isBs ? `Bs ${parseFloat(p.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${parseFloat(p.monto_original).toFixed(2)}`;
                } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                    displayMonto = isBs ? `Bs ${(parseFloat(p.monto) * saleRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${parseFloat(p.monto).toFixed(2)}`;
                }
                return `<span class="payment-method-badge">${p.metodo}${displayMonto ? ': ' + displayMonto : ''}</span>`;
            }).join('');
            paymentMethodsHtml = `<div class="payment-methods-list" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">${paymentMethodsHtml}</div>`;
        } else {
            // Fallback para formato antiguo (string simple)
            paymentMethodsHtml = `<span class="payment-method-badge">${venta.tipo_pago || 'N/A'}</span>`;
        }
    } catch (e) {
        // Si JSON.parse falla, es probable que sea el formato antiguo
        paymentMethodsHtml = `<span class="payment-method-badge">${venta.tipo_pago || 'N/A'}</span>`;
    }
    if (tipoPagoContainer) {
        tipoPagoContainer.innerHTML = `<label style="white-space: nowrap; margin-right: 8px;">MÉTODOS DE PAGO :</label>${paymentMethodsHtml}`;
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
        .payment-methods-list {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 12px;
            flex: 1;
        }
        .payment-method-badge {
            display: inline-flex;
            align-items: center;
            background-color: transparent !important;
            color: #111 !important;
            padding: 0;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            margin: 0;
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
                background-color: transparent !important;
                color: #000 !important;
                font-size: 13px !important;
                font-weight: 600 !important;
            }
        }
    `;
    doc.head.appendChild(style);

    // Normalizar detalles y filtrar filas vacías o placeholders
    const detallesArr = Array.isArray(venta.detalles) ? venta.detalles : [];
    const detallesValidos = detallesArr.filter(item => {
        if (!item || typeof item !== 'object') return false;
        const nombre = (item.producto_nombre || '').toString().trim();
        const codigo = (item.producto_codigo || '').toString().trim();
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precio_unitario) || 0;
        // Considerar válido si contiene nombre o código, o cantidad/precio mayor que cero
        return nombre !== '' || codigo !== '' || cantidad > 0 || precio > 0;
    });

    detallesValidos.forEach(item => {
        const qty = Number(item.cantidad) || 0;
        const precioUnitarioStored = Number(item.precio_unitario) || 0; // This now holds the correct price (BCV or Efectivo)
        const producto = productosCache.find(p => p.codigo === (item.producto_codigo || '')) || (item.producto_codigo ? productosCache.find(p => p.codigo && p.codigo.startsWith(item.producto_codigo)) : null); // Still useful for brand
        const marca = producto ? (producto.marca || 'N/A') : 'N/A'; // Brand is not stored in detalle_ventas

        let precioUnitarioDisplay, subtotalDisplay;

        if (pagoEnEfectivo) {
            // If paid in cash, item.precio_unitario already holds the cash price.
            precioUnitarioDisplay = formatCurrency(precioUnitarioStored);
            subtotalDisplay = formatCurrency(qty * precioUnitarioStored);
        } else {
            // Si el pago fue en bolívares, mostrar montos en bolívares
            precioUnitarioDisplay = formatCurrency(precioUnitarioStored * saleRate);
            subtotalDisplay = formatCurrency(qty * precioUnitarioStored * saleRate);
        }

        const row = doc.createElement('tr');
        row.innerHTML = `
            <td><div class="codigo">${item.producto_codigo || ''}</div></td>
            <td><div class="text-left descripcion">${item.producto_nombre || ''}</div></td>
            <td><div>${marca}</div></td>
            <td><div class="uds">${formatInteger(qty)}</div></td>
            <td><div class="precioBS">${precioUnitarioDisplay}</div></td>
            <td><div class="subtotalBS">${subtotalDisplay}</div></td>
            <td class="no-print"></td>
        `;
        tableBody.appendChild(row);
    });

    // Añadir el elemento que cubrirá el pie de página
    const footerCover = doc.createElement('div');
    footerCover.className = 'print-footer-cover';
    doc.body.appendChild(footerCover);

    // Establecer el valor total correcto (USD o BS)
    if (pagoEnEfectivo) {
        // Para la plantilla de USD, solo llenamos el total en USD
        doc.querySelector('#totalUSD')?.setAttribute('value', formatCurrency(parseFloat(venta.total_usd)));
    } else {
        // Para la plantilla de BCV, llenamos ambos totales
        doc.querySelector('#totalUSD')?.setAttribute('value', formatCurrency(parseFloat(venta.total_usd)));
        doc.querySelector('#totalBS')?.setAttribute('value', formatCurrency(parseFloat(venta.total_bs)));
    }

    // Eliminar scripts que puedan ejecutar código en el iframe (p. ej. addRow en DOMContentLoaded)
    doc.querySelectorAll('script').forEach(s => s.remove());

    const finalHtml = doc.documentElement.outerHTML;
    const iframe = document.createElement('iframe');

    return new Promise((resolve, reject) => {
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';

        // Modificar temporalmente el título del documento principal
        document.title = nombreArchivo;

        iframe.onload = function() {
            try {
                if (iframe.contentDocument) {
                    iframe.contentDocument.title = nombreArchivo;
                }
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
                    document.title = tituloOriginal;
                    if (iframe.parentElement) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
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
    let titleTagInv = doc.querySelector('title');
    if (!titleTagInv) {
        titleTagInv = doc.createElement('title');
        doc.head.appendChild(titleTagInv);
    }
    const fechaArchivo = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const nombreArchivoInv = `inventario_${fechaArchivo}`;
    titleTagInv.textContent = nombreArchivoInv;
    const tituloOriginal = document.title;

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
    const fechaEl = doc.querySelector('#fechaImpresion');
    if (fechaEl) {
        fechaEl.setAttribute('value', new Date().toLocaleString('es-VE'));
    }
    const totalProdEl = doc.querySelector('#totalProductos');
    if (totalProdEl) {
        totalProdEl.setAttribute('value', formatInteger(productosCache.length));
    }
    const totalUnidades = productosCache.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
    const totalUniEl = doc.querySelector('#totalUnidades');
    if (totalUniEl) {
        totalUniEl.setAttribute('value', formatInteger(totalUnidades));
    }

    // Añadir el elemento de la tabla
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
                <td><div style="font-weight: 600;">${formatInteger(item.cantidad)}</div></td>
                <td class="checkbox-cell"><span class="checkbox-box"></span></td>
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

        document.title = nombreArchivoInv;

        iframe.onload = function() {
            try {
                if (iframe.contentDocument) {
                    iframe.contentDocument.title = nombreArchivoInv;
                }
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                showToast('Se ha abierto el diálogo de impresión.', 'success');
                resolve();
            } catch (e) {
                reject(e);
            } finally {
                setTimeout(() => {
                    document.title = tituloOriginal;
                    if (iframe.parentElement) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
            }
        };

        iframe.srcdoc = finalHtml;
        document.body.appendChild(iframe);
    });
}