import { generarFacturaPDF, generarInventarioPDF } from './source/generatepdf.js';
import { showToast, showConfirmation, formatCurrency, formatInteger } from './utils.js';

// Conexión a Supabase
const SUPABASE_URL = 'https://tqlbmcqkottvclikpxur.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gq9mJ5Qo9MIa-k0pRTB7hQ_Rda5qtBX';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- INICIO: Lógica para autocompletar y formato de datos del cliente ---
const inputCedula = document.getElementById('cliCedula');
const selectTipoCedula = document.getElementById('cliTipoCedula');
const btnBuscarCliente = document.getElementById('btnBuscarCliente');

/**
 * Descompone un número telefónico venezolano en código de área y 7 dígitos.
 * Soporta formatos como '04141234567', '584141234567', '+584141234567', etc.
 */
const parseTelefonoVE = (rawPhone) => {
    if (!rawPhone) return { cod: '0414', num: '' };
    let cleaned = String(rawPhone).replace(/\D/g, '');
    if (cleaned.startsWith('58') && cleaned.length >= 12) {
        cleaned = '0' + cleaned.substring(2);
    }
    const codigosValidos = ['0414', '0424', '0426', '0416', '0422', '0412'];
    for (const cod of codigosValidos) {
        if (cleaned.startsWith(cod)) {
            return { cod: cod, num: cleaned.substring(cod.length).slice(0, 7) };
        }
    }
    if (cleaned.length >= 4) {
        const potentialCod = cleaned.slice(0, 4);
        if (codigosValidos.includes(potentialCod)) {
            return { cod: potentialCod, num: cleaned.slice(4, 11) };
        }
    }
    return { cod: '0414', num: cleaned.slice(0, 7) };
};

/**
 * Convierte un número telefónico venezolano al formato internacional de WhatsApp (ej: '584141234567').
 */
const formatTelefonoWhatsApp = (rawPhone) => {
    if (!rawPhone) return '';
    let cleaned = String(rawPhone).replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '58' + cleaned.substring(1);
    } else if (cleaned.length === 10 && !cleaned.startsWith('58')) {
        cleaned = '58' + cleaned;
    }
    return cleaned;
};

/**
 * Busca el cliente más reciente en la base de datos por su cédula
 * y autocompleta los campos del formulario de venta si lo encuentra.
 */
const buscarClientePorCedula = async () => {
    // Asegurarse de que los elementos existan antes de usarlos.
    if (!selectTipoCedula || !inputCedula) return;

    const tipoCedula = selectTipoCedula.value;
    const numeroCedula = inputCedula.value.trim();

    const nombreInput = document.getElementById('cliNombre');
    const codTelefonoSelect = document.getElementById('cliCodTelefono');
    const telefonoInput = document.getElementById('cliTelefono');
    const direccionInput = document.getElementById('cliDireccion');

    if (!nombreInput || !telefonoInput || !direccionInput) return;

    // No buscar si el campo de cédula está vacío o es muy corto
    if (numeroCedula.length < 7) {
        // Si el campo se vacía, limpiar los otros campos para permitir un nuevo ingreso
        nombreInput.value = '';
        if (codTelefonoSelect) codTelefonoSelect.value = '0414';
        telefonoInput.value = '';
        direccionInput.value = '';
        return;
    }

    const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;

    try {
        const { data: venta, error } = await _supabase
            .from('ventas')
            .select('cliente_nombre, cliente_telefono, cliente_direccion')
            .eq('cliente_cedula', cedulaCompleta)
            .order('id', { ascending: false }) // Usar el ID de venta para obtener el más reciente
            .limit(1)
            .single();

        // El código de error 'PGRST116' significa que no se encontró ninguna fila, lo cual es esperado.
        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (venta) {
            // Cliente encontrado: rellenar los campos del formulario
            nombreInput.value = venta.cliente_nombre || '';
            const parsed = parseTelefonoVE(venta.cliente_telefono);
            if (codTelefonoSelect) codTelefonoSelect.value = parsed.cod;
            telefonoInput.value = parsed.num;
            direccionInput.value = venta.cliente_direccion || '';
            showToast('Cliente encontrado. Datos cargados automáticamente.', 'success');
        } else {
            // Cliente no encontrado: limpiar campos para un nuevo registro y notificar
            nombreInput.value = '';
            if (codTelefonoSelect) codTelefonoSelect.value = '0414';
            telefonoInput.value = '';
            direccionInput.value = '';
            showToast('Cliente no registrado. Puede ingresarlo como nuevo.', 'info');
        }
    } catch (err) {
        console.error('Error al buscar cliente por cédula:', err);
        showToast('Ocurrió un error al intentar buscar el cliente.', 'error');
    }
};

if (inputCedula && selectTipoCedula && btnBuscarCliente) {
    // Restricción de formato para el input de cédula
    inputCedula.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });

    // Disparar la búsqueda con el botón, que es más amigable en móviles
    btnBuscarCliente.addEventListener('click', buscarClientePorCedula);

    // También permitir la búsqueda con la tecla Enter para mejorar la UX en escritorio
    inputCedula.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevenir que el formulario se envíe
            buscarClientePorCedula();
        }
    });

    // Disparar la búsqueda si se cambia el tipo de cédula (V, E, J, G)
    selectTipoCedula.addEventListener('change', buscarClientePorCedula);
}

const inputTelefono = document.getElementById('cliTelefono');
if (inputTelefono) {
    inputTelefono.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 7);
    });
}

const editInputTelefono = document.getElementById('editCliTelefono');
if (editInputTelefono) {
    editInputTelefono.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 7);
    });
}
// --- FIN: Lógica para autocompletar y formato de datos del cliente ---

// --- NAVEGACIÓN MODULAR DINÁMICA ---
const navButtons = document.querySelectorAll('.sidebar-menu .nav-btn');
const contentOverlay = document.getElementById('content-overlay');
const visorModulos = document.getElementById('visor-modulos');

// Mapeo de nombres de botones a nombres de archivos y funciones de inicialización
const vistas = {
    'inicio': { file: 'inicio.html', init: null },
    'inventario de productos': { file: 'inventario.html', init: () => initVistaInventario() },
    'caja': { file: 'caja.html', init: () => initVistaCaja() },
    'ventas': { file: 'ventas.html', init: () => initVistaVentas() },
    'devoluciones': { file: 'devoluciones.html', init: () => initVistaDevoluciones() },
    'reportes': { file: 'reportes.html', init: () => initVistaReportes() },
    'ajustes': { file: 'ajustes.html', init: () => initVistaAjustes() }
};

function toggleSidebar() {
    document.body.classList.toggle('sidebar-visible');
}

let isNavigating = false;

async function cargarVista(nombreVista) {
    if (isNavigating) return;
    isNavigating = true;

    const vista = vistas[nombreVista];
    if (!vista) {
        if (visorModulos) {
            visorModulos.innerHTML = `<div class="welcome-container"><h1>Error 404</h1><p>La vista "${nombreVista}" no fue encontrada.</p></div>`;
        }
        isNavigating = false;
        return;
    }

    // 1. Iniciar la animación de desvanecimiento
    if (visorModulos) visorModulos.classList.add('loading');

    // 2. Esperar a que termine la animación de desvanecimiento
    await new Promise(resolve => setTimeout(resolve, 150)); // Debe coincidir con la duración de la transición en CSS

    try {
        const response = await fetch(`vistas/${vista.file}`);
        if (!response.ok) throw new Error(`No se pudo cargar ${vista.file}`);

        const html = await response.text();
        if (visorModulos) visorModulos.innerHTML = html;

        // Inyectar el botón para mostrar/ocultar la barra lateral
        const header = visorModulos ? visorModulos.querySelector('header') : null;
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.innerHTML = '&#9776;'; // Icono de hamburguesa
        toggleBtn.onclick = toggleSidebar;

        if (header) {
            header.insertBefore(toggleBtn, header.firstChild);
        } else if (visorModulos) {
            visorModulos.insertBefore(toggleBtn, visorModulos.firstChild);
        }

        // Si hay una función de inicialización, la llamamos
        if (vista.init) {
            await vista.init();
        }

        // Si la barra lateral está visible (indicando que estamos en móvil), la cerramos
        if (document.body.classList.contains('sidebar-visible')) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Error al cargar la vista:', error);
        if (visorModulos) {
            visorModulos.innerHTML = `<div class="welcome-container"><h1>Error</h1><p>No se pudo cargar el módulo. Revisa la consola para más detalles.</p></div>`;
        }
    } finally {
        // 3. Quitar la clase para que el nuevo contenido aparezca con una animación de fundido
        if (visorModulos) visorModulos.classList.remove('loading');
        isNavigating = false;
    }
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const nombreVista = btn.textContent.trim().toLowerCase();
        cargarVista(nombreVista);
    });
});

// --- LÓGICA DE LA APLICACIÓN (COPIADA Y ADAPTADA) ---

// Conexión a Socket.io protegida contra fallos
const socket = (typeof io === 'function') ? io() : { on: () => { }, emit: () => { } };
if (typeof socket.on === 'function') {
    socket.on('connect', () => console.log('Conectado a Socket.IO'));
    socket.on('actualizacion-dato', (data) => {
        const activeNav = document.querySelector('.nav-btn.active');
        if (!activeNav) return;
        const vistaActiva = activeNav.textContent.trim().toLowerCase();
        if (data.type === 'products' && (vistaActiva === 'inventario de productos' || vistaActiva === 'caja')) {
            cargarVista(vistaActiva);
        }
        if (data.type === 'brands') {
            const modalProd = document.getElementById('modalProducto');
            if (modalProd && modalProd.classList.contains('active')) {
                loadExistingBrands();
            }
            if (vistaActiva === 'inventario de productos') loadProducts();
        }
        if (data.type === 'categories' && (vistaActiva === 'inventario de productos')) {
            cargarVista(vistaActiva);
        }
        if (data.type === 'ventas' && vistaActiva === 'ventas') {
            cargarVista(vistaActiva);
        }
        if (data.type === 'devoluciones' && vistaActiva === 'devoluciones') {
            cargarVista(vistaActiva);
        }
    });
}

// Variables de estado globales
let productoSeleccionado = null;
let modoEdicion = false;
let categoriaSeleccionadaId = null;
let categoriasCache = [];
let marcasCache = [];
let marcaSeleccionadaId = null;
let pendingAction = null, pendingActionId = null;
let productosCache = [];
let productosParaLlevar = [];
let ventasCache = [];
let oficialRate = 0, paraleloRate = 0;
let totalVentaActual = 0; // Para almacenar el total de la venta actual en el modal
let totalVentaEfectivo = 0; // Para almacenar el total de la venta en efectivo
let reportCharts = {}; // Para almacenar instancias de los gráficos de reportes

const BORRAR_PASS = 'DESTROID_DATA'; // Contraseña para acciones de borrado
const TASA_SETTINGS_KEY = 'tasaSettings';
const THEME_KEY = 'appTheme';
let tasaSettings = {
    oficial: { mode: 'automatico', value: 0 },
    paralelo: { mode: 'automatico', value: 0 }
};

// Cargar ajustes de tasa desde localStorage al iniciar la aplicación
const storedTasaSettings = localStorage.getItem(TASA_SETTINGS_KEY);
if (storedTasaSettings) {
    try {
        tasaSettings = JSON.parse(storedTasaSettings);
    } catch (e) {
        console.error("Error al analizar los ajustes de tasa guardados:", e);
    }
}

const METODOS_DE_PAGO = ['Pago Móvil', 'Binance', 'Dólares en efectivo', 'Bolívares en efectivo', 'Zelle'];

// Helper para peticiones HTTP con timeout (evita bloqueos o congelamientos)
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

// --- TASAS DE CAMBIO ---
async function obtenerTasas() {
    const fetchOficial = async () => {
        if (tasaSettings.oficial.mode === 'manual' && tasaSettings.oficial.value > 0) return tasaSettings.oficial.value;
        const res = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial', {}, 4000);
        if (!res.ok) throw new Error('Fallo al obtener tasa oficial');
        const data = await res.json();
        return parseFloat(data.promedio) || 0;
    };

    const fetchParalelo = async () => {
        if (tasaSettings.paralelo.mode === 'manual' && tasaSettings.paralelo.value > 0) return tasaSettings.paralelo.value;
        const res = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/paralelo', {}, 4000);
        if (!res.ok) throw new Error('Fallo al obtener tasa paralelo');
        const data = await res.json();
        return parseFloat(data.promedio) || 0;
    };

    try {
        const [oficial, paralelo] = await Promise.all([fetchOficial(), fetchParalelo()]);
        if (oficial > 0) oficialRate = oficial;
        if (paralelo > 0) paraleloRate = paralelo;
    } catch (error) {
        console.warn("Aviso al obtener tasas de cambio (usando respaldo):", error.message);
        if (!oficialRate) oficialRate = tasaSettings.oficial.value || 0;
        if (!paraleloRate) paraleloRate = tasaSettings.paralelo.value || 0;
    } finally {
        const bcvEl = document.getElementById('sidebarBcvRate');
        const parEl = document.getElementById('sidebarParallelRate');
        if (bcvEl && oficialRate > 0) bcvEl.textContent = `Bs ${oficialRate.toFixed(2)}`;
        if (parEl && paraleloRate > 0) parEl.textContent = `Bs ${paraleloRate.toFixed(2)}`;
    }
}

// --- LÓGICA DE VISTAS ESPECÍFICAS ---

// INVENTARIO
function initVistaInventario() {
    loadProducts();
    document.getElementById('productSearch')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) { renderProducts(productosCache); return; }
        renderProducts(productosCache.filter(p => p.nombre.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term)));
    });

    document.querySelectorAll('.inventory-edit-btn').forEach((btn) => {
        btn.addEventListener('click', handleEditarProducto);
    });

    document.querySelectorAll('.inventory-delete-btn').forEach((btn) => {
        btn.addEventListener('click', handleEliminarProducto);
    });

    document.querySelectorAll('.inventory-print-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Generando PDF...';
            try {
                await generarInventarioPDF(productosCache);
            } catch (error) {
                console.error('Error al generar el PDF de inventario:', error);
                showToast('No se pudo generar el PDF.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });
}

async function loadProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">Cargando productos...</p>';
    await obtenerTasas();
    try {
        const { data: products, error } = await _supabase.from('productos').select('*').order('nombre');

        if (error) {
            console.error('Supabase error loading productos:', error);
            container.innerHTML = `<p style="color: var(--btn-red);">Error cargando productos: ${error.message || JSON.stringify(error)}</p>`;
            productosCache = []; // Ensure cache is empty on error
            return;
        }

        // The data will be an array, even if it's empty. No need for a !products check.
        productosCache = products || [];

    } catch (err) {
        console.error('Fatal error loading productos from Supabase:', err);
        container.innerHTML = `<p style="color: var(--btn-red);">Excepción al cargar productos: ${err.message || JSON.stringify(err)}</p>`;
        productosCache = [];
        return;
    }
    renderProducts(productosCache);
}

function renderProducts(productsToRender) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    if (!productsToRender || productsToRender.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No se encontraron productos.</p>';
    } else {
        const grouped = {};
        productsToRender.forEach(p => {
            const cat = p.categoria && p.categoria.trim() !== '' ? p.categoria : 'Sin Categoría';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });

        const finalHtml = Object.entries(grouped).map(([categoria, prods]) => {
            const prodsHtml = prods.map(p => {
                const precioVentaBsBcv = formatCurrency(p.precio_venta_dolares_bcv * oficialRate);
                const precioCostoBsBcv = formatCurrency(p.precio_costo_dolares_bcv * oficialRate);
                return `
                    <div class="product-card" data-codigo="${p.codigo}">
                        <div class="field-group"><label>código</label><div class="product-card-value">${p.codigo}</div></div>
                        <div class="field-group"><label>nombre</label><div class="product-card-value">${p.nombre}</div></div>
                        <div class="field-group"><label>marca</label><div class="product-card-value">${p.marca || ''}</div></div>
                        <div class="field-group"><label>ubicación</label><div class="product-card-value">${p.ubicacion || ''}</div></div>
                        <div class="field-group"><label>cantidad</label><div class="product-card-value">${formatInteger(p.cantidad)}</div></div>
                        <div class="field-group"><label>precio costo $ bcv</label><div class="product-card-value" style="color: var(--btn-green); font-weight: bold;">${formatCurrency(p.precio_costo_dolares_bcv)}</div></div>
                        <div class="field-group"><label>precio venta $ bcv</label><div class="product-card-value" style="color: var(--btn-green); font-weight: bold;">${formatCurrency(p.precio_venta_dolares_bcv)}</div></div>
                        <div class="field-group"><label>costo $ efectivo</label><div class="product-card-value" style="color: var(--btn-orange); font-weight: bold;">${formatCurrency(p.costo_$_efectivo)}</div></div>
                        <div class="field-group"><label>venta $ efectivo</label><div class="product-card-value" style="color: var(--btn-orange); font-weight: bold;">${formatCurrency(p.venta_$_efectivo)}</div></div>
                        <div class="field-group"><label>precio costo bs (bcv)</label><div class="product-card-value" style="color: var(--text-primary); font-weight: bold;">${precioCostoBsBcv}</div></div>
                        <div class="field-group"><label>precio venta bs (bcv)</label><div class="product-card-value" style="color: var(--text-primary); font-weight: bold;">${precioVentaBsBcv}</div></div>
                    </div>`;
            }).join('');
            return `
                <div class="category-box">
                    <h3 class="category-box-title">${categoria}</h3>
                    <div class="products-grid">${prodsHtml}</div>
                </div>`;
        }).join('');
        container.innerHTML = finalHtml;
    }
    let totalInvertido = 0, stockTotal = 0;
    productosCache.forEach(p => {
        totalInvertido += (p.cantidad || 0) * (p.precio_costo_dolares_bcv || 0);
        stockTotal += (p.cantidad || 0);
    });
    const totalInvEl = document.getElementById('totalInvertido');
    if (totalInvEl) totalInvEl.textContent = `$ ${formatCurrency(totalInvertido)}`;
    const stockTotEl = document.getElementById('stockTotal');
    if (stockTotEl) stockTotEl.textContent = formatInteger(stockTotal);
}
 
function parseSafeFloat(val, defaultVal = 0) {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    const str = String(val).trim().replace(/%/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? defaultVal : num;
}

function calcularPreciosPorcentaje(precioProv, porcDesc, porcGanancia, rateOficial = oficialRate, rateParalelo = paraleloRate) {
    const prov = parseSafeFloat(precioProv, 0);
    const desc = parseSafeFloat(porcDesc, 0);
    const gan = parseSafeFloat(porcGanancia, 0);

    const costoEfectivo = prov * (1 - (desc / 100));
    const ventaEfectivo = costoEfectivo * (1 + (gan / 100));
    let costoUsdBcv = costoEfectivo;
    let ventaUsdBcv = ventaEfectivo;

    const effOficial = (rateOficial > 0) ? rateOficial : ((typeof tasaSettings !== 'undefined' && tasaSettings?.oficial?.value > 0) ? tasaSettings.oficial.value : 0);
    const effParalelo = (rateParalelo > 0) ? rateParalelo : ((typeof tasaSettings !== 'undefined' && tasaSettings?.paralelo?.value > 0) ? tasaSettings.paralelo.value : 0);

    const pRate = (effParalelo > 0) ? effParalelo : (effOficial > 0 ? effOficial : 1);
    const oRate = (effOficial > 0) ? effOficial : (effParalelo > 0 ? effParalelo : 1);

    if (oRate > 0 && pRate > 0) {
        const costoBsBcv = costoEfectivo * pRate;
        costoUsdBcv = costoBsBcv / oRate;
        ventaUsdBcv = costoUsdBcv * (1 + (gan / 100));
    }

    return {
        costoEfectivo: Math.round(costoEfectivo * 100) / 100,
        ventaEfectivo: Math.round(ventaEfectivo * 100) / 100,
        costoUsdBcv: Math.round(costoUsdBcv * 100) / 100,
        ventaUsdBcv: Math.round(ventaUsdBcv * 100) / 100
    };
}

function actualizarResultadosCalculadora() {
    let precioProv = parseSafeFloat(document.getElementById('calcCostoUsdt')?.value, 0);
    if (precioProv <= 0) {
        precioProv = parseSafeFloat(document.getElementById('prodCostoDolaresEfectivo')?.value, 0) ||
            parseSafeFloat(document.getElementById('prodCostoDolaresBcv')?.value, 0);
        if (precioProv > 0) {
            const inputCosto = document.getElementById('calcCostoUsdt');
            if (inputCosto) inputCosto.value = precioProv;
        }
    }

    const porcProv = parseSafeFloat(document.getElementById('calcDescuento')?.value, 0);
    const porcVenta = parseSafeFloat(document.getElementById('calcGanancia')?.value, 0);

    if (precioProv > 0) {
        const calculados = calcularPreciosPorcentaje(precioProv, porcProv, porcVenta);
        const resCostoEf = document.getElementById('resCostoEfectivo');
        const resCostoBcv = document.getElementById('resCostoBcv');
        const resVentaBcv = document.getElementById('resVentaBcv');
        const resVentaEf = document.getElementById('resVentaUsdt');
        const calcResults = document.getElementById('calculator-results');

        if (resCostoEf) resCostoEf.textContent = `$ ${formatCurrency(calculados.costoEfectivo)}`;
        if (resCostoBcv) resCostoBcv.textContent = `$ ${formatCurrency(calculados.costoUsdBcv)}`;
        if (resVentaBcv) resVentaBcv.textContent = `$ ${formatCurrency(calculados.ventaUsdBcv)}`;
        if (resVentaEf) resVentaEf.textContent = `$ ${formatCurrency(calculados.ventaEfectivo)}`;
        if (calcResults) calcResults.style.display = 'block';

        const prodCostoEf = document.getElementById('prodCostoDolaresEfectivo');
        const prodVentaEf = document.getElementById('prodUsdt');
        const prodCostoBcv = document.getElementById('prodCostoDolaresBcv');
        const prodVentaBcv = document.getElementById('prodVentaDolaresBcv');

        if (prodCostoEf) prodCostoEf.value = calculados.costoEfectivo;
        if (prodVentaEf) prodVentaEf.value = calculados.ventaEfectivo;
        if (prodCostoBcv) prodCostoBcv.value = calculados.costoUsdBcv;
        if (prodVentaBcv) prodVentaBcv.value = calculados.ventaUsdBcv;

        return calculados;
    }
    return null;
}

async function handleEditarProducto() {
    if (!productoSeleccionado) {
        showToast('Selecciona un producto para editar.', 'error');
        return;
    }

    // Asegurar que el modal del producto esté preparado (botón Gestionar, listeners, etc.)
    await setupProductModal();

    // Cargar listas y marcas, luego fijar la marca seleccionada
    await actualizarSelectProductos();
    await loadExistingBrands();
    document.getElementById('prodMarca').value = productoSeleccionado.marca || '';

    // Abrir el modal y prepararlo para la edición
    const modal = document.getElementById('modalProducto');
    modal.querySelector('h3').textContent = 'Editar Producto';
    document.getElementById('prodCodigo').readOnly = false; // Permitir la edición del código al editar
    // Poblar campos comunes y marcar que estamos editando
    document.getElementById('prodEditCodigo').value = productoSeleccionado.codigo;
    document.getElementById('prodCodigo').value = productoSeleccionado.codigo;
    document.getElementById('prodCategoria').value = productoSeleccionado.categoria;
    document.getElementById('prodNombre').value = productoSeleccionado.nombre;

    // --- INICIO: Lógica de cantidad para EDICIÓN ---
    const cantidadContainer = document.getElementById('prodCantidadContainer');
    cantidadContainer.style.gridTemplateColumns = '1fr 1fr'; // Mostrar dos columnas

    document.getElementById('cantidadActualGroup').style.display = 'block';
    document.getElementById('prodCantidadActual').value = productoSeleccionado.cantidad ?? 0;

    document.getElementById('cantidadIngresarGroup').style.display = 'block';
    document.getElementById('labelCantidadIngresar').textContent = 'Cantidad que Ingresa';
    document.getElementById('prodCantidad').value = 0; // Iniciar en 0 para sumar
    // --- FIN: Lógica de cantidad para EDICIÓN ---

    document.getElementById('prodUbicacion').value = productoSeleccionado.ubicacion || '';

    // Poblar SIEMPRE los campos manuales de precios
    document.getElementById('prodCostoDolaresBcv').value = productoSeleccionado.precio_costo_dolares_bcv ?? '';
    document.getElementById('prodCostoDolaresEfectivo').value = productoSeleccionado.costo_$_efectivo ?? '';
    document.getElementById('prodVentaDolaresBcv').value = productoSeleccionado.precio_venta_dolares_bcv ?? '';
    document.getElementById('prodUsdt').value = productoSeleccionado.venta_$_efectivo ?? '';

    // Poblar SIEMPRE los campos de la calculadora si existen o autocompletar con costo si no existen
    const costoCalc = (productoSeleccionado.calc_costo_$_efectivo !== null && productoSeleccionado.calc_costo_$_efectivo !== undefined)
        ? productoSeleccionado.calc_costo_$_efectivo
        : (productoSeleccionado.costo_$_efectivo || productoSeleccionado.precio_costo_dolares_bcv || '');

    document.getElementById('calcCostoUsdt').value = costoCalc;
    document.getElementById('calcDescuento').value = (productoSeleccionado.calc_descuento !== null && productoSeleccionado.calc_descuento !== undefined) ? productoSeleccionado.calc_descuento : '';
    document.getElementById('calcGanancia').value = (productoSeleccionado.calc_ganancia !== null && productoSeleccionado.calc_ganancia !== undefined) ? productoSeleccionado.calc_ganancia : '';

    const modo = productoSeleccionado.modo_creacion || 'manual';
    const tieneDatosCalc = (productoSeleccionado.calc_costo_$_efectivo != null || productoSeleccionado.calc_descuento != null || productoSeleccionado.calc_ganancia != null);
    const isCalcMode = (modo === 'calculator' || modo === 'calculadora' || tieneDatosCalc);

    if (isCalcMode) {
        setProductModalMode('calculator');
        actualizarResultadosCalculadora();
    } else {
        setProductModalMode('manual');
    }

    // Finalmente, mostrar el modal
    modal.classList.add('active');
}

async function handleEliminarProducto() {
    if (!productoSeleccionado) { showToast('Selecciona un producto.', 'error'); return; }
    showConfirmation(`¿Eliminar "${productoSeleccionado.nombre}"?`, async () => {
        await _supabase.from('productos').delete().eq('codigo', productoSeleccionado.codigo);
        productoSeleccionado = null;
        loadProducts();
        socket.emit('cambio-dato', { type: 'products' });
        showToast('Eliminado.', 'success');
    });
}

// CAJA
async function initVistaCaja() {
    await initCajaData();
    renderCajaProductos(productosCache);
    renderizarParaLlevar(); // Renderiza el carrito una vez al cargar la vista

    // --- INICIO: Nueva lógica de acordeón dinámico con animación ---
    const accordions = document.querySelectorAll('.accordion-header');

    // Asignar IDs para estilos específicos
    if (accordions.length > 0) accordions[0].id = 'header-disponibles';
    if (accordions.length > 1) accordions[1].id = 'header-cargados';

    // Abrir el primer acordeón ('Productos Disponibles') por defecto.
    accordions.forEach((acc, index) => {
        const content = acc.nextElementSibling;
        if (index === 0) {
            acc.classList.add('active');
            content.classList.add('active');
            content.style.maxHeight = (content.scrollHeight + 100) + 'px';
        } else {
            acc.classList.remove('active');
            content.classList.remove('active');
            content.style.maxHeight = null;
        }
    });

    accordions.forEach(clickedAccordion => {
        clickedAccordion.addEventListener('click', () => {
            const content = clickedAccordion.nextElementSibling;

            // Si ya está activo, no hacer nada.
            if (content.classList.contains('active')) return;

            // Cerrar todos los demás acordeones
            accordions.forEach(acc => {
                const otherContent = acc.nextElementSibling;
                acc.classList.remove('active');
                otherContent.classList.remove('active');
                otherContent.style.maxHeight = null;
            });

            // Abrir el que se clickeó
            clickedAccordion.classList.add('active');
            content.classList.add('active');
            content.style.maxHeight = (content.scrollHeight + 100) + 'px';
        });
    });

    // Añadir clase para animar la entrada de botones en móvil (efecto 'bajar')
    const cajaActionsEl = document.querySelector('.caja-actions');
    if (cajaActionsEl) {
        cajaActionsEl.classList.add('responsive-animate');
        // activar la clase 'loaded' en el siguiente tick para disparar la transición
        requestAnimationFrame(() => setTimeout(() => cajaActionsEl.classList.add('loaded'), 50));
    }
    // --- FIN: Nueva lógica de acordeón dinámico con animación ---

    document.getElementById('cajaProductSearch')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filteredProducts = productosCache.filter(p =>
            p.nombre.toLowerCase().includes(term) ||
            p.codigo.toLowerCase().includes(term)
        );
        renderCajaProductos(filteredProducts);
    });
}

async function initCajaData() {
    const { data } = await _supabase.from('productos').select('*').order('nombre');
    productosCache = data || [];
    if (oficialRate === 0) await obtenerTasas();
}

function renderCajaProductos(productsToRender) {
    const container = document.getElementById('cajaProductosDisponibles');
    if (!container) return;

    if (!productsToRender || productsToRender.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">No se encontraron productos.</p>';
        return;
    }

    // Agrupar productos por categoría
    const grouped = {};
    productsToRender.forEach(p => {
        const cat = p.categoria && p.categoria.trim() !== '' ? p.categoria : 'Sin Categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    const finalHtml = Object.entries(grouped).map(([categoria, prods]) => {
        const prodsHtml = prods.map(p => {
            const precioVentaBsBcv = formatCurrency(p.precio_venta_dolares_bcv * oficialRate);
            const precioVentaDolares = formatCurrency(p.precio_venta_dolares_bcv);
            return `
                <div class="product-card-caja-vertical">
                    <div class="caja-v-item">
                        <label>Código</label>
                        <span>${p.codigo}</span>
                    </div>
                    <div class="caja-v-item">
                        <label>Nombre</label>
                        <span>${p.nombre}</span>
                    </div>
                    <div class="caja-v-item">
                        <label>Precio de venta Bs (BCV)</label>
                        <span style="color: var(--text-primary); font-weight: bold;">${precioVentaBsBcv}</span>
                    </div>
                    <div class="caja-v-item">
                        <label>Precio Dólares (BCV)</label>
                        <span style="color: var(--btn-green); font-weight: bold;">${precioVentaDolares}</span>
                    </div>
                    <div class="caja-v-item">
                        <label>Precio en Efectivo</label>
                        <span style="color: var(--btn-orange); font-weight: bold;">${formatCurrency(p.venta_$_efectivo)}</span>
                    </div>
                    <div class="caja-v-item">
                        <label>Stock Disponible</label>
                        <span>${p.cantidad}</span>
                    </div>
                    <div class="caja-v-actions">
                        <label>Cantidad a llevar</label>
                        <div class="caja-v-action-group">
                            <div class="quantity-control">
                                <button type="button" class="quantity-btn minus" data-codigo="${p.codigo}">-</button>
                                <input type="number" class="caja-input-cant" id="cant_${p.codigo}" value="1" min="1" max="${p.cantidad}">
                                <button type="button" class="quantity-btn plus" data-codigo="${p.codigo}">+</button>
                            </div>
                            <button class="action-btn btn-add" data-codigo="${p.codigo}">Agregar</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="caja-category-box">
                <h3 class="caja-category-box-title">${categoria}</h3>
                <div class="caja-products-grid">${prodsHtml}</div>
            </div>`;
    }).join('');

    container.innerHTML = finalHtml;
}

function agregarAParaLlevar(codigo) {
    const producto = productosCache.find(p => p.codigo === codigo);
    if (!producto) return;
    const cantInput = document.getElementById(`cant_${codigo}`);
    const cantidadAgregar = parseInt(cantInput.value, 10);

    if (isNaN(cantidadAgregar) || cantidadAgregar <= 0) { showToast('Cantidad no válida.', 'error'); return; }
    if (cantidadAgregar > producto.cantidad) { showToast(`Stock insuficiente. Disponible: ${producto.cantidad}`, 'error'); return; }

    const existente = productosParaLlevar.find(item => item.codigo === codigo);
    if (existente) {
        if (existente.cantidadLlevar + cantidadAgregar > producto.cantidad) { showToast('Excede el stock.', 'error'); return; }
        existente.cantidadLlevar += cantidadAgregar;
    } else {
        productosParaLlevar.push({ ...producto, cantidadLlevar: cantidadAgregar });
    }
    renderizarParaLlevar();
    showToast(`Agregado: ${producto.nombre}`, 'info');
}

function renderizarParaLlevar() {
    const container = document.getElementById('cajaProductosParaLlevar');
    if (!container) return;
    container.innerHTML = '';

    const totalArticulosEl = document.getElementById('cajaTotalArticulos');
    const totalBcvEl = document.getElementById('cajaTotalBcv');
    const totalBcvBsEl = document.getElementById('cajaTotalBcvBs');
    const totalEfectivoEl = document.getElementById('cajaTotalEfectivoUsd');

    if (productosParaLlevar.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">No hay productos en el carrito.</p>';
        if (totalArticulosEl) totalArticulosEl.textContent = '0';
        if (totalBcvEl) totalBcvEl.textContent = '$ 0.00';
        if (totalBcvBsEl) totalBcvBsEl.textContent = 'Bs 0.00';
        if (totalEfectivoEl) totalEfectivoEl.textContent = '$ 0.00';
        return;
    }

    let totalArticulos = 0, totalBcv = 0, totalEfectivo = 0;
    productosParaLlevar.forEach(item => {
        // CORRECCIÓN: Usar precio_venta_dolares_bcv en lugar de precio_usdt
        const subtotalDolaresBcv = item.precio_venta_dolares_bcv * item.cantidadLlevar;
        const subtotalDolaresEfectivo = item.venta_$_efectivo * item.cantidadLlevar;
        const subtotalBolivares = formatCurrency(subtotalDolaresBcv * oficialRate); // Usar tasa oficial para consistencia visual

        totalArticulos += item.cantidadLlevar;
        totalBcv += subtotalDolaresBcv;
        totalEfectivo += subtotalDolaresEfectivo;
        const card = document.createElement('div');
        card.className = 'product-card-caja-list'; // Usar la misma clase de lista
        card.innerHTML = `
            <div class="caja-list-info">
                <span class="caja-list-nombre">${item.nombre}</span>
                <div class="caja-v-item">
                    <label>Subtotal Dólares BCV</label>
                    <span style="color: var(--btn-green); font-weight: bold;">${formatCurrency(subtotalDolaresBcv)}</span>
                </div>
                <div class="caja-v-item">
                    <label>Subtotal Bolívares</label>
                    <span style="color: var(--text-primary); font-weight: bold;">${subtotalBolivares}</span>
                </div>
                <div class="caja-v-item">
                    <label>Subtotal Dólares en Efectivo</label>
                    <span style="color: var(--btn-orange); font-weight: bold;">${formatCurrency(subtotalDolaresEfectivo)}</span>
                </div>
            </div>
            <div class="caja-list-actions">
                <div class="quantity-control">
                    <button type="button" class="quantity-btn minus" data-codigo-llevar-control="${item.codigo}">-</button>
                    <input type="number" class="caja-input-cant" value="${item.cantidadLlevar}" data-codigo-llevar="${item.codigo}" min="1" ${!item.esAdicional ? `max="${item.cantidad}"` : ''}>
                    <button type="button" class="quantity-btn plus" data-codigo-llevar-control="${item.codigo}">+</button>
                </div>
                <button class="action-btn btn-del btn-del-small" data-codigo-quitar="${item.codigo}">Quitar</button>
            </div>`;
        container.appendChild(card);
    });

    // CORRECCIÓN: Se usa la tasa oficial (BCV) para que coincida con la etiqueta "Total Bolívares (BCV)" y los subtotales.
    const totalBcvBs = totalBcv * oficialRate;

    if (totalArticulosEl) totalArticulosEl.textContent = formatInteger(totalArticulos);
    if (totalBcvEl) totalBcvEl.textContent = `$ ${formatCurrency(totalBcv)}`;
    if (totalBcvBsEl) totalBcvBsEl.textContent = `Bs ${formatCurrency(totalBcvBs)}`;
    if (totalEfectivoEl) totalEfectivoEl.textContent = `$ ${formatCurrency(totalEfectivo)}`;
}

function actualizarCantidadLlevar(codigo, val) {
    const item = productosParaLlevar.find(p => p.codigo === codigo);
    if (!item) return;
    const nuevaCantidad = parseInt(val, 10);
    if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) return;
    if (!item.esAdicional && nuevaCantidad > item.cantidad) { showToast('Stock excedido.', 'error'); renderizarParaLlevar(); return; }
    item.cantidadLlevar = nuevaCantidad;
    renderizarParaLlevar();
}

function quitarDeParaLlevar(codigo) {
    productosParaLlevar = productosParaLlevar.filter(item => item.codigo !== codigo);
    renderizarParaLlevar();
}

/**
 * Calcula los tres montos de visualización para una venta o devolución
 * (Total USD BCV, Total BS BCV, Total USD Efectivo) con lógica consistente.
 */
function calcularTotalesVenta(v) {
    const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];

    let pagos = [];
    try {
        const rawPagos = typeof v.tipo_pago === 'string' ? JSON.parse(v.tipo_pago) : v.tipo_pago;
        if (Array.isArray(rawPagos)) {
            pagos = rawPagos;
        }
    } catch (e) { }

    let sumBs = 0;
    let sumUsdEfectivo = 0;

    const totalUsd = parseFloat(v.total_usd || v.totalUsd || 0);
    const totalBs = parseFloat(v.total_bs || v.totalBs || 0);
    const saleRate = (totalUsd > 0 && totalBs > 0) ? (totalBs / totalUsd) : oficialRate;

    pagos.forEach(p => {
        const isBs = p.moneda === 'BS' || metodosEnBolivares.includes(p.metodo);
        if (isBs) {
            let valBs = 0;
            if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                valBs = parseFloat(p.monto_original);
            } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                valBs = parseFloat(p.monto) * saleRate;
            }
            sumBs += valBs;
        } else {
            let valUsd = 0;
            if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                valUsd = parseFloat(p.monto_original);
            } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                valUsd = parseFloat(p.monto);
            }
            sumUsdEfectivo += valUsd;
        }
    });

    let totalUsdBcvDisplay = '$ 0.00';
    let totalBsBcvDisplay = 'Bs 0.00';
    let totalUsdEfectivoDisplay = '$ 0.00';

    const hasBs = sumBs > 0.0001;
    const hasEfectivo = sumUsdEfectivo > 0.0001;

    if (hasEfectivo && !hasBs) {
        // Si el pago fue 100% en divisas / efectivo
        totalUsdEfectivoDisplay = `$ ${formatCurrency(sumUsdEfectivo || totalUsd)}`;
    } else if (hasBs && !hasEfectivo) {
        // Si el pago fue 100% en bolívares (BCV)
        totalUsdBcvDisplay = `$ ${formatCurrency(totalUsd)}`;
        totalBsBcvDisplay = `Bs ${formatCurrency(sumBs || totalBs || (totalUsd * saleRate))}`;
    } else if (hasEfectivo && hasBs) {
        // Si el pago fue mixto:
        // Columna Total BS (BCV) muestra EXACTAMENTE la parte pagada en bolívares
        // Columna Total USD (Efectivo) muestra EXACTAMENTE el restante pagado en divisas/efectivo
        totalBsBcvDisplay = `Bs ${formatCurrency(sumBs)}`;
        totalUsdEfectivoDisplay = `$ ${formatCurrency(sumUsdEfectivo)}`;
    } else {
        // Fallback para ventas sin desglose detallado
        const tipoPagoStr = typeof v.tipo_pago === 'string' ? v.tipo_pago : JSON.stringify(v.tipo_pago || '');
        const pagoEnEfectivoLegacy = pagos.some(p => metodosEnEfectivo.includes(p.metodo)) || metodosEnEfectivo.some(m => tipoPagoStr.includes(m));
        if (pagoEnEfectivoLegacy) {
            totalUsdEfectivoDisplay = `$ ${formatCurrency(totalUsd)}`;
        } else {
            totalUsdBcvDisplay = `$ ${formatCurrency(totalUsd)}`;
            totalBsBcvDisplay = `Bs ${formatCurrency(totalBs || (totalUsd * saleRate))}`;
        }
    }

    return { totalUsdBcvDisplay, totalBsBcvDisplay, totalUsdEfectivoDisplay, pagos, sumBs, sumUsdEfectivo };
}

/**
 * Genera el HTML de los badges de métodos de pago con montos formateados.
 */
function formatTipoPagoBadges(tipoPagoRaw, totalBs = 0, totalUsd = 1) {
    let pagos = [];
    try {
        const parsedPagos = typeof tipoPagoRaw === 'string' ? JSON.parse(tipoPagoRaw) : tipoPagoRaw;
        if (Array.isArray(parsedPagos) && parsedPagos.length > 0) {
            pagos = parsedPagos;
            const rate = (parseFloat(totalBs) > 0 && parseFloat(totalUsd) > 0) ? (parseFloat(totalBs) / parseFloat(totalUsd)) : oficialRate;
            const pagosHtml = pagos.map(p => {
                const isBs = p.moneda === 'BS' || ['Pago Móvil', 'Bolívares en efectivo'].includes(p.metodo);
                let displayMonto = '';
                if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                    displayMonto = isBs ? `Bs ${formatCurrency(parseFloat(p.monto_original))}` : `$ ${formatCurrency(parseFloat(p.monto_original))}`;
                } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                    displayMonto = isBs ? `Bs ${formatCurrency(parseFloat(p.monto) * rate)}` : `$ ${formatCurrency(parseFloat(p.monto))}`;
                }
                return `<span class="detalle-venta-badge" style="white-space: nowrap;">${p.metodo}${displayMonto ? ': ' + displayMonto : ''}</span>`;
            }).join('');
            return `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">${pagosHtml}</div>`;
        }
    } catch (e) { }
    return `<span class="detalle-venta-badge">${tipoPagoRaw || 'N/A'}</span>`;
}

// VENTAS
function initVistaVentas() {
    cargarHistorialVentas();
    document.getElementById('ventasSearch')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) { renderizarTablaVentas(ventasCache); return; }
        const filtradas = ventasCache.filter(v => {
            const matchNombre = v.cliente_nombre.toLowerCase().includes(term);
            const matchId = v.id.toString().includes(term);
            const matchFecha = new Date(v.fecha).toLocaleString().toLowerCase().includes(term);
            const matchDetalle = v.detalles?.some(d => d.producto_nombre.toLowerCase().includes(term) || d.producto_codigo.toLowerCase().includes(term));
            const matchPago = typeof v.tipo_pago === 'string' && v.tipo_pago.toLowerCase().includes(term);
            return matchNombre || matchId || matchFecha || matchDetalle || matchPago;
        });
        renderizarTablaVentas(filtradas);
    });
}
async function cargarHistorialVentas() {
    const container = document.getElementById('ventasAccordionContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); padding: 20px; text-align: center;">Cargando historial...</p>`;

    const { data: ventas, error: ventasError } = await _supabase.from('ventas').select('*').order('id', { ascending: false });
    const { data: detalles, error: detError } = await _supabase.from('detalle_ventas').select('*');

    if (ventasError || detError) {
        container.innerHTML = `<p style="color: var(--btn-red); padding: 20px; text-align: center;">Error al cargar ventas.</p>`;
        return;
    }

    ventasCache = ventas.map(v => {
        const itemsVenta = detalles.filter(d => d.venta_id === v.id);
        return { ...v, detalles: itemsVenta };
    });

    renderizarTablaVentas(ventasCache);
}

function renderizarTablaVentas(listaVentas) {
    const container = document.getElementById('ventasAccordionContainer');
    if (!container) return;
    container.innerHTML = '';

    if (listaVentas.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); padding: 20px; text-align: center;">No hay ventas que coincidan con la búsqueda.</p>`;
        const countEl = document.getElementById('totalVentasCount');
        if (countEl) countEl.textContent = '0';
        const usdEl = document.getElementById('totalVentasUsd');
        if (usdEl) usdEl.textContent = '$ 0.00';
        return;
    }

    // 1. Agrupar ventas por mes
    const ventasPorMes = listaVentas.reduce((acc, venta) => {
        const fecha = new Date(venta.fecha);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`; // 'YYYY-MM'
        if (!acc[mesKey]) acc[mesKey] = [];
        acc[mesKey].push(venta);
        return acc;
    }, {});

    const sortedMonths = Object.keys(ventasPorMes).sort((a, b) => b.localeCompare(a));

    // 2. Renderizar acordeón de meses
    sortedMonths.forEach((mesKey, monthIndex) => {
        const ventasDelMes = ventasPorMes[mesKey];
        const [year, month] = mesKey.split('-');
        const nombreMes = new Date(year, month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const totalVentasMes = ventasDelMes.length;
        const totalUsdMes = ventasDelMes.reduce((sum, v) => sum + (parseFloat(v.total_usd || 0)), 0);

        const monthGroup = document.createElement('div');
        monthGroup.className = 'venta-month-group';

        const monthHeader = document.createElement('div');
        monthHeader.className = 'venta-month-header';
        monthHeader.innerHTML = `
            <div class="fecha-titulo">${nombreMes}</div>
            <div class="fecha-resumen">
                <span>Ventas Totales: ${totalVentasMes}</span>
                <span>Monto Total: $ ${formatCurrency(totalUsdMes)}</span>
            </div>
            <div class="fecha-icono">▼</div>`;

        const monthContent = document.createElement('div');
        monthContent.className = 'venta-month-content';

        // Expandir el primer mes (el más reciente) por defecto
        if (monthIndex === 0) {
            monthHeader.classList.add('active');
            monthContent.classList.add('active');
            monthContent.style.maxHeight = 'none';
        } else {
            monthContent.classList.remove('active');
            monthContent.style.maxHeight = '0px';
        }

        monthHeader.addEventListener('click', () => {
            const isActive = monthHeader.classList.toggle('active');
            if (isActive) {
                monthContent.classList.add('active');
                monthContent.style.maxHeight = (monthContent.scrollHeight + 500) + 'px';
                setTimeout(() => {
                    if (monthHeader.classList.contains('active')) {
                        monthContent.style.maxHeight = 'none';
                    }
                }, 400);
            } else {
                monthContent.style.maxHeight = monthContent.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    monthContent.classList.remove('active');
                    monthContent.style.maxHeight = '0px';
                });
            }
        });

        // 3. Agrupar ventas del mes por día
        const ventasPorDia = ventasDelMes.reduce((acc, venta) => {
            const fechaKey = new Date(venta.fecha).toISOString().split('T')[0];
            if (!acc[fechaKey]) acc[fechaKey] = [];
            acc[fechaKey].push(venta);
            return acc;
        }, {});

        const sortedDays = Object.keys(ventasPorDia).sort((a, b) => new Date(b) - new Date(a));

        // 4. Renderizar acordeón de días dentro del mes
        sortedDays.forEach((diaKey, dayIndex) => {
            const ventasDelDia = ventasPorDia[diaKey];
            const fechaFormateada = new Date(ventasDelDia[0].fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
            const totalVentasDia = ventasDelDia.length;
            const totalUsdDia = ventasDelDia.reduce((sum, v) => sum + (parseFloat(v.total_usd || 0)), 0);

            const dayGroup = document.createElement('div');
            dayGroup.className = 'venta-date-group';

            const dayHeader = document.createElement('div');
            dayHeader.className = 'venta-date-header';
            dayHeader.innerHTML = `
                <div class="fecha-titulo">${fechaFormateada}</div>
                <div class="fecha-resumen">
                    <span>Ventas: ${totalVentasDia}</span>
                    <span>Total: $ ${formatCurrency(totalUsdDia)}</span>
                </div>
                <div class="fecha-icono">▼</div>`;

            const dayContent = document.createElement('div');
            dayContent.className = 'venta-date-content';

            // Expandir el primer día del primer mes por defecto
            if (monthIndex === 0 && dayIndex === 0) {
                dayHeader.classList.add('active');
                dayContent.classList.add('active');
                dayContent.style.maxHeight = 'none';
            } else {
                dayContent.classList.remove('active');
                dayContent.style.maxHeight = '0px';
            }

            dayHeader.addEventListener('click', () => {
                const isActive = dayHeader.classList.toggle('active');
                if (isActive) {
                    dayContent.classList.add('active');
                    dayContent.style.maxHeight = (dayContent.scrollHeight + 150) + 'px';
                    setTimeout(() => {
                        if (dayHeader.classList.contains('active')) {
                            dayContent.style.maxHeight = 'none';
                        }
                    }, 380);
                } else {
                    dayContent.style.maxHeight = dayContent.scrollHeight + 'px';
                    requestAnimationFrame(() => {
                        dayContent.classList.remove('active');
                        dayContent.style.maxHeight = '0px';
                    });
                }
            });

            const table = document.createElement('table');
            table.className = 'tabla-ventas-container';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th><th>Hora</th><th>Cliente</th><th>WhatsApp</th><th>Cédula</th><th>Teléfono</th>
                        <th>Tipo Pago</th><th>Productos</th><th>Total USD (BCV)</th><th>Total BS (BCV)</th><th>Total USD (Efectivo)</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody></tbody>`;
            const tbody = table.querySelector('tbody');
            let rowsHtml = []; // Array para almacenar las cadenas HTML de las filas
            ventasDelDia.forEach(v => {
                const horaFormateada = new Date(v.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const detallesAgrupados = {};
                v.detalles.forEach(d => {
                    const key = d.producto_codigo || d.producto_nombre;
                    if (detallesAgrupados[key]) {
                        detallesAgrupados[key].cantidad += parseInt(d.cantidad, 10) || 0;
                    } else {
                        detallesAgrupados[key] = { ...d, cantidad: parseInt(d.cantidad, 10) || 0 };
                    }
                });

                const totalProductosUnicos = Object.keys(detallesAgrupados).length;
                let productosHtml;

                if (totalProductosUnicos > 0) {
                    productosHtml = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
                            <span style="font-weight: 500;">${totalProductosUnicos} producto(s)</span>
                            <button class="action-btn btn-blue btn-ver-detalles-venta venta-accion-btn" data-venta-id="${v.id}">Ver Detalles</button>
                        </div>
                    `;
                } else {
                    productosHtml = '<span class="detalle-venta-badge">Sin productos</span>';
                }

                let pagos = []; // Definir fuera del try para que sea accesible
                const tipoPagoHtml = formatTipoPagoBadges(v.tipo_pago, v.total_bs, v.total_usd);
                const { totalUsdBcvDisplay, totalBsBcvDisplay, totalUsdEfectivoDisplay } = calcularTotalesVenta(v);

                let statusBadge = '';
                if (v.estado_pago === 'pendiente') {
                    statusBadge = `<br><span class="detalle-venta-badge" style="background-color: var(--btn-orange); color: white; font-weight: bold;">DEBE</span>`;
                }

                let whatsappButtonHtml = '';
                if (v.cliente_telefono && v.cliente_telefono.trim() !== '') {
                    const cleanedPhone = formatTelefonoWhatsApp(v.cliente_telefono);
                    if (cleanedPhone.length >= 12 && cleanedPhone.startsWith('58')) {
                        const message = `Hola ${v.cliente_nombre} esta es tu factura`;
                        const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
                        whatsappButtonHtml = `
                            <a href="${whatsappUrl}" target="_blank" class="btn-whatsapp" title="Enviar WhatsApp a ${v.cliente_nombre}">
                                <img src="/imagen/what.png" alt="WhatsApp">
                            </a>`;
                    }
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: bold; color: var(--btn-yellow);">#${v.id}</td>
                    <td>${horaFormateada}</td>
                    <td>${v.cliente_nombre}${statusBadge}</td>
                    <td>${whatsappButtonHtml}</td>
                    <td>${v.cliente_cedula}</td>
                    <td>${v.cliente_telefono}</td>
                    <td>${tipoPagoHtml}</td>
                    <td>${productosHtml}</td>
                    <td style="font-weight: bold;">${totalUsdBcvDisplay}</td>
                    <td style="font-weight: bold;">${totalBsBcvDisplay}</td>
                    <td style="font-weight: bold; color: var(--btn-orange);">${totalUsdEfectivoDisplay}</td>`;

                let accionesHtml = `<button class="btn-pdf venta-accion-btn" data-venta-id="${v.id}">PDF</button>`;
                if (v.estado_pago === 'pendiente') {
                    accionesHtml += `<button class="action-btn btn-blue btn-abonar-venta venta-accion-btn" data-venta-id="${v.id}">Abonar</button>`;
                }
                accionesHtml += `<button class="btn-edit-venta venta-accion-btn" data-venta-id="${v.id}">Editar</button><button class="action-btn btn-del btn-delete-venta venta-accion-btn" data-venta-id="${v.id}">Eliminar</button>`;
                rowsHtml.push(`<tr>${tr.innerHTML}<td class="celda-acciones"><div class="venta-acciones">${accionesHtml}</div></td></tr>`);
            });
            tbody.innerHTML = rowsHtml.join(''); // Asignar todas las filas de una vez
            dayContent.appendChild(table);
            dayGroup.appendChild(dayHeader);
            dayGroup.appendChild(dayContent);
            monthContent.appendChild(dayGroup);
        });

        monthGroup.appendChild(monthHeader);
        monthGroup.appendChild(monthContent);
        container.appendChild(monthGroup);
    });

    const sumaTotalUsd = listaVentas.reduce((sum, v) => sum + (parseFloat(v.total_usd || 0)), 0);
    const countEl = document.getElementById('totalVentasCount');
    if (countEl) countEl.textContent = formatInteger(listaVentas.length);
    const totalUsdEl = document.getElementById('totalVentasUsd');
    if (totalUsdEl) totalUsdEl.textContent = `$ ${formatCurrency(sumaTotalUsd)}`;
}

async function _deleteSaleAndRestoreStock(ventaParaEliminar) {
    // 1. Restaurar stock
    for (const detalle of ventaParaEliminar.detalles) {
        // No intentar restaurar stock para items sin código o cantidad (ej. adicionales)
        if (!detalle.producto_codigo || !detalle.cantidad) continue;

        const { data: productoActual, error: fetchError } = await _supabase
            .from('productos')
            .select('cantidad')
            .eq('codigo', detalle.producto_codigo)
            .single();

        if (fetchError) {
            // Si el producto ya no existe, no podemos restaurar stock, pero podemos continuar eliminando la venta.
            console.warn(`Producto con código ${detalle.producto_codigo} no encontrado. No se restaurará stock para este item.`);
        } else {
            const nuevoStock = productoActual.cantidad + detalle.cantidad;
            const { error: updateError } = await _supabase
                .from('productos')
                .update({ cantidad: nuevoStock })
                .eq('codigo', detalle.producto_codigo);

            if (updateError) {
                throw new Error(`Fallo al actualizar el stock para ${detalle.producto_codigo}.`);
            }
        }
    }

    // 2. Eliminar detalles de la venta
    const { error: detalleError } = await _supabase
        .from('detalle_ventas')
        .delete()
        .eq('venta_id', ventaParaEliminar.id);

    if (detalleError) throw new Error('Fallo al eliminar los detalles de la venta.');

    // 3. Eliminar la venta principal
    const { error: ventaError } = await _supabase.from('ventas').delete().eq('id', ventaParaEliminar.id);
    if (ventaError) throw new Error('Fallo al eliminar la venta principal.');

    // 4. Reiniciar la secuencia del ID para reutilizar IDs si se borra el último
    const { error: resetError } = await _supabase.rpc('reset_ventas_id_sequence');
    if (resetError) {
        // No es un error crítico, pero es bueno saberlo.
        console.warn('No se pudo reiniciar la secuencia de IDs de ventas. Asegúrate de que la función "reset_ventas_id_sequence" exista en tu base de datos.', resetError);
    }
}

async function handleDeleteSale(ventaId) {
    const ventaParaEliminar = ventasCache.find(v => v.id == ventaId);
    if (!ventaParaEliminar) {
        showToast('No se encontró la venta para eliminar.', 'error');
        return;
    }

    showConfirmation(`¿Eliminar permanentemente la venta #${ventaId}? Esta acción restaurará el stock y no se puede deshacer.`, async () => {
        try {
            await _deleteSaleAndRestoreStock(ventaParaEliminar);

            showToast(`Venta #${ventaId} eliminada y stock restaurado.`, 'success');

            cargarHistorialVentas();
            socket.emit('cambio-dato', { type: 'ventas' });
            socket.emit('cambio-dato', { type: 'products' });

        } catch (error) {
            console.error('Error durante el proceso de eliminación de venta:', error);
            showToast(error.message, 'error');
        }
    });
}

function handleAbrirModalDetallesVenta(ventaId) {
    const venta = ventasCache.find(v => v.id == ventaId);
    if (!venta) {
        showToast('Venta no encontrada', 'error');
        return;
    }

    const modal = document.getElementById('modalVentaDetalles');
    document.getElementById('detallesVentaIdDisplay').textContent = `#${venta.id}`;

    const detallesContainer = document.getElementById('detallesVentaProductos');

    const detallesAgrupados = {};
    if (venta.detalles && Array.isArray(venta.detalles)) {
        venta.detalles.forEach(d => {
            const key = d.producto_codigo || d.producto_nombre;
            if (detallesAgrupados[key]) {
                detallesAgrupados[key].cantidad += parseInt(d.cantidad, 10) || 0;
            } else {
                detallesAgrupados[key] = { ...d, cantidad: parseInt(d.cantidad, 10) || 0 };
            }
        });
    }

    let productosListHtml = '';
    if (Object.keys(detallesAgrupados).length > 0) {
        productosListHtml = '<ul style="list-style-type: none; padding-left: 0; margin: 0;">' +
            Object.values(detallesAgrupados).map(d =>
                `<li style="padding: 6px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                    <span><strong>${d.producto_nombre}</strong> (x${d.cantidad})</span>
                    <span style="color: var(--text-muted);">$ ${formatCurrency(d.precio_unitario * d.cantidad)}</span>
                 </li>`
            ).join('') +
            '</ul>';
    } else {
        productosListHtml = '<p style="color: var(--text-muted); margin: 0;">No hay detalles de productos para esta venta.</p>';
    }

    let pagosBreakdownHtml = '';
    try {
        const parsedPagos = JSON.parse(venta.tipo_pago);
        if (Array.isArray(parsedPagos) && parsedPagos.length > 0) {
            const itemsHtml = parsedPagos.map(p => {
                const isBs = p.moneda === 'BS' || ['Pago Móvil', 'Bolívares en efectivo'].includes(p.metodo);
                let montoStr = '';
                if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                    montoStr = isBs ? `Bs ${formatCurrency(parseFloat(p.monto_original))}` : `$ ${formatCurrency(parseFloat(p.monto_original))}`;
                } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                    const saleBs = parseFloat(venta.total_bs) || 0;
                    const saleUsd = parseFloat(venta.total_usd) || 1;
                    const rate = saleBs > 0 ? (saleBs / saleUsd) : oficialRate;
                    montoStr = isBs ? `Bs ${formatCurrency(parseFloat(p.monto) * rate)}` : `$ ${formatCurrency(parseFloat(p.monto))}`;
                }
                return `<li style="padding: 4px 0; display: flex; justify-content: space-between;">
                    <span style="font-weight: 500;">${p.metodo}</span>
                    <span style="font-weight: bold; color: ${isBs ? 'var(--btn-blue)' : 'var(--btn-green)'};">${montoStr}</span>
                </li>`;
            }).join('');
            pagosBreakdownHtml = `
                <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-color);">Desglose de Pago:</div>
                    <ul style="list-style-type: none; padding-left: 0; margin: 0;">${itemsHtml}</ul>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-color); font-size: 0.85rem;">
                        <span>Total Venta USD: <strong>$ ${formatCurrency(parseFloat(venta.total_usd || 0))}</strong></span>
                        <span>Total Venta BS: <strong>Bs ${formatCurrency(parseFloat(venta.total_bs || 0))}</strong></span>
                    </div>
                </div>
            `;
        }
    } catch (e) { /* no-op */ }

    detallesContainer.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-color);">Productos:</div>
        ${productosListHtml}
        ${pagosBreakdownHtml}
    `;

    modal.classList.add('active');
}

async function handleAbrirModalAbono(ventaId) {
    const venta = ventasCache.find(v => v.id == ventaId);
    if (!venta) {
        showToast('Venta no encontrada en caché.', 'error');
        return;
    }

    await obtenerTasas(); // Asegurar que las tasas estén frescas

    // Calcular el monto ya pagado
    let totalYaPagado = 0;
    try {
        const pagosExistentes = JSON.parse(venta.tipo_pago);
        if (Array.isArray(pagosExistentes)) {
            totalYaPagado = pagosExistentes.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
        }
    } catch (e) {
        console.warn("No se pudieron analizar los pagos existentes para la venta #" + ventaId);
    }
    totalYaPagado = parseFloat(totalYaPagado.toFixed(2));

    const totalDeLaVenta = parseFloat(venta.total_usd);
    const faltanteActual = totalDeLaVenta - totalYaPagado;

    // Poblar el resumen del modal de abono
    document.getElementById('abonoVentaId').value = venta.id;
    document.getElementById('abonoVentaIdDisplay').textContent = `#${venta.id}`;
    document.getElementById('abonoTotalVenta').textContent = `$ ${formatCurrency(totalDeLaVenta)}`;
    document.getElementById('abonoTotalPagado').textContent = `$ ${formatCurrency(totalYaPagado)}`;
    document.getElementById('abonoTotalVentaBs').textContent = `Bs ${formatCurrency(totalDeLaVenta * oficialRate)}`;
    document.getElementById('abonoTotalPagadoBs').textContent = `Bs ${formatCurrency(totalYaPagado * oficialRate)}`;
    document.getElementById('abonoFaltante').textContent = `$ ${formatCurrency(faltanteActual)}`;
    document.getElementById('abonoFaltanteBs').textContent = `Bs ${formatCurrency(faltanteActual * oficialRate)}`;

    // Generar inputs para los métodos de pago
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];
    const paymentContainer = document.getElementById('abonoPaymentMethodsContainer');
    paymentContainer.innerHTML = METODOS_DE_PAGO.map(metodo => {
        const id = `abono_${metodo.toLowerCase().replace(/ /g, '_').replace('ó', 'o')}`;
        const isBsMethod = metodosEnBolivares.includes(metodo);
        const currencyLabel = isBsMethod ? 'Bs' : '$';

        return `
            <div class="payment-method-row">
                <div class="payment-method-selector">
                    <input type="checkbox" id="check_${id}" data-abono-method-id="${id}">
                    <label for="check_${id}">${metodo} (${currencyLabel})</label>
                </div>
                <div class="payment-method-input" id="input_container_${id}" style="display: none;">
                    <input type="number" class="abono-payment-amount-input" step="0.01" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
                    <button type="button" class="action-btn btn-blue btn-fill-remaining" data-target-id="${id}">FULL</button>
                </div>
            </div>
        `;
    }).join('');

    // Resetear el estado del formulario
    const form = document.getElementById('formAbonoVenta');
    form.reset();

    // Añadir listeners para este modal
    const updateAbonoHandler = () => updateAbonoSummary(totalDeLaVenta, totalYaPagado);
    form.querySelectorAll('.abono-payment-amount-input').forEach(input => {
        input.addEventListener('input', updateAbonoHandler);
    });
    form.querySelectorAll('[data-abono-method-id]').forEach(check => {
        check.addEventListener('change', (e) => {
            const id = e.target.dataset.abonoMethodId;
            const inputContainer = document.getElementById(`input_container_${id}`);
            const amountInput = document.getElementById(`amount_${id}`);
            inputContainer.style.display = e.target.checked ? 'flex' : 'none';
            if (!e.target.checked) amountInput.value = '';
            updateAbonoHandler();
        });
    });

    updateAbonoSummary(totalDeLaVenta, totalYaPagado); // Llamada inicial para establecer el estado del botón
    document.getElementById('modalAbonoVenta').classList.add('active');
}

function updateAbonoSummary(totalDeLaVenta, totalYaPagado) {
    let nuevoAbonoUsd = Array.from(document.querySelectorAll('.abono-payment-amount-input'))
        .reduce((sum, input) => {
            const container = input.closest('.payment-method-input');
            if (container && container.style.display !== 'none') {
                const val = parseFloat(input.value) || 0;
                if (input.dataset.currency === 'BS' && oficialRate > 0) {
                    return sum + (val / oficialRate);
                }
                return sum + val;
            }
            return sum;
        }, 0);

    nuevoAbonoUsd = parseFloat(nuevoAbonoUsd.toFixed(2));
    const faltanteFinal = totalDeLaVenta - totalYaPagado - nuevoAbonoUsd;

    const abonoBsEl = document.getElementById('abonoNuevoTotalBs');
    if (abonoBsEl) abonoBsEl.textContent = `Bs ${formatCurrency(nuevoAbonoUsd * oficialRate)}`;
    const abonoUsdEl = document.getElementById('abonoNuevoTotal');
    if (abonoUsdEl) abonoUsdEl.textContent = `$ ${formatCurrency(nuevoAbonoUsd)}`;

    const btnConfirmar = document.getElementById('btnConfirmarAbono');
    if (!btnConfirmar) return;

    if (faltanteFinal < -0.01) { // Se pagó de más
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto excede la deuda';
    } else if (Math.abs(faltanteFinal) < 0.01) { // Se saldó la deuda
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pago Final';
    } else { // Aún queda deuda
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Abono';
    }

    if (nuevoAbonoUsd <= 0) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Ingrese un monto';
    }
}

async function handleConfirmarAbono(e) {
    e.preventDefault();
    const btn = document.getElementById('btnConfirmarAbono');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    const ventaId = document.getElementById('abonoVentaId').value;

    try {
        // 1. Obtener los nuevos pagos
        const nuevosPagos = [];
        document.querySelectorAll('#abonoPaymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
            const id = check.dataset.abonoMethodId;
            const amountInput = document.getElementById(`amount_${id}`);
            const inputCurrency = amountInput.dataset.currency;
            let amount = parseFloat(amountInput.value) || 0;
            let amountInUsd = amount;

            if (inputCurrency === 'BS' && oficialRate > 0) {
                amountInUsd = amount / oficialRate;
            }

            if (amountInUsd > 0) {
                nuevosPagos.push({
                    metodo: amountInput.dataset.methodName,
                    monto: amountInUsd
                });
            }
        });

        if (nuevosPagos.length === 0) {
            throw new Error('Debe registrar al menos un nuevo pago.');
        }

        // 2. Obtener los datos de la venta actual
        const { data: ventaActual, error: fetchError } = await _supabase
            .from('ventas')
            .select('total_usd, tipo_pago')
            .eq('id', ventaId)
            .single();

        if (fetchError) throw fetchError;

        // 3. Fusionar pagos
        let pagosExistentes = [];
        try {
            const parsed = JSON.parse(ventaActual.tipo_pago);
            if (Array.isArray(parsed)) {
                pagosExistentes = parsed;
            }
        } catch (err) {
            console.warn("No se pudieron analizar los pagos existentes, se comenzará de nuevo. Valor original:", ventaActual.tipo_pago);
        }

        const todosLosPagos = [...pagosExistentes, ...nuevosPagos];
        const nuevoTotalPagado = todosLosPagos.reduce((sum, p) => sum + p.monto, 0);

        // 4. Determinar el nuevo estado del pago
        const totalDeLaVenta = parseFloat(ventaActual.total_usd);
        const nuevoEstadoPago = (nuevoTotalPagado + 0.01) >= totalDeLaVenta ? 'pagado' : 'pendiente';

        // 5. Actualizar la venta en la base de datos
        const { error: updateError } = await _supabase
            .from('ventas')
            .update({
                tipo_pago: JSON.stringify(todosLosPagos),
                estado_pago: nuevoEstadoPago
            })
            .eq('id', ventaId);

        if (updateError) throw updateError;

        // 6. Finalizar
        showToast('Abono registrado con éxito.', 'success');
        document.getElementById('modalAbonoVenta').classList.remove('active');
        cargarHistorialVentas(); // Refrescar la vista de ventas
        socket.emit('cambio-dato', { type: 'ventas' });

    } catch (error) {
        console.error('Error al confirmar abono:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function updateEditPaymentSummary() {
    const totalBcvAmount = parseFloat(document.getElementById('editVentaTotalUsd').value) || 0;
    const totalEfectivoAmount = parseFloat(document.getElementById('editVentaTotalEfectivo')?.value) || 0;
    if (totalBcvAmount === 0 && totalEfectivoAmount === 0) return;

    const activeMethodNames = [];
    document.querySelectorAll('#editPaymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
        const id = check.dataset.editMethodId;
        const amountInput = document.getElementById(`amount_${id}`);
        if (amountInput) {
            activeMethodNames.push(amountInput.dataset.methodName);
        }
    });

    const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
    const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
    const currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
    const totalTargetUsd = useEfectivoTotal ? (totalEfectivoAmount > 0 ? totalEfectivoAmount : totalBcvAmount) : totalBcvAmount;

    let totalPagadoUsd = Array.from(document.querySelectorAll('.edit-payment-amount-input'))
        .reduce((sum, input) => {
            const container = input.closest('.payment-method-input');
            if (container && container.style.display !== 'none') {
                const val = parseFloat(input.value) || 0;
                if (input.dataset.currency === 'BS') {
                    return sum + (currentRate > 0 ? (val / currentRate) : 0);
                }
                return sum + val;
            }
            return sum;
        }, 0);

    const faltante = totalTargetUsd - totalPagadoUsd;

    const editUsdEl = document.getElementById('editModalTotalUsd');
    if (editUsdEl) editUsdEl.textContent = `$ ${formatCurrency(totalTargetUsd)}`;
    const editBsEl = document.getElementById('editModalTotalBs');
    if (editBsEl) editBsEl.textContent = `Bs ${formatCurrency(totalTargetUsd * currentRate)}`;

    const totalPagadoEl = document.getElementById('editModalTotalPagado');
    if (totalPagadoEl) totalPagadoEl.textContent = `$ ${formatCurrency(totalPagadoUsd)}`;
    const totalPagadoBsEl = document.getElementById('editModalTotalPagadoBs');
    if (totalPagadoBsEl) totalPagadoBsEl.textContent = `Bs ${formatCurrency(totalPagadoUsd * currentRate)}`;
    const faltanteEl = document.getElementById('editModalFaltante');
    if (faltanteEl) faltanteEl.textContent = `$ ${formatCurrency(Math.abs(faltante))}`;
    const faltanteBsEl = document.getElementById('editModalFaltanteBs');
    if (faltanteBsEl) faltanteBsEl.textContent = `Bs ${formatCurrency(Math.abs(faltante) * currentRate)}`;

    const faltanteLabel = document.getElementById('editFaltanteLabel');
    const btnConfirmar = document.getElementById('btnConfirmarEdicionVenta');
    const pagoPendiente = document.getElementById('editPagoPendienteCheckbox')?.checked || false; // Leer checkbox

    if (faltanteLabel) faltanteLabel.style.color = 'var(--btn-red)';
    if (faltanteEl) faltanteEl.style.color = 'var(--btn-red)';
    if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-red)';

    if (!btnConfirmar) return;

    if (pagoPendiente) {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Guardar como Pendiente';
        if (faltanteLabel) {
            faltanteLabel.textContent = 'Crédito Pendiente';
            faltanteLabel.style.color = 'var(--btn-orange)';
        }
        if (faltanteEl) faltanteEl.style.color = 'var(--btn-orange)';
        if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-orange)';
    } else if (faltante < -0.01) { // Sobrante
        if (faltanteLabel) faltanteLabel.textContent = '¡Sobrante!';
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto excede el total';
    } else if (Math.abs(faltante) < 0.01) { // Completo
        if (faltanteLabel) {
            faltanteLabel.textContent = 'Completo';
            faltanteLabel.style.color = 'var(--btn-green)';
        }
        if (faltanteEl) faltanteEl.style.color = 'var(--btn-green)';
        if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-green)';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Guardar Cambios';
    } else { // Faltante
        if (faltanteLabel) faltanteLabel.textContent = 'Faltante';
        btnConfirmar.disabled = true; // Deshabilitar si el pago está incompleto y no es crédito
        btnConfirmar.textContent = 'Monto no coincide';
    }
}

async function handleAbrirModalEditarVenta(venta) {
    if (!venta) return;
    await obtenerTasas();

    const totalDeLaVenta = parseFloat(venta.total_usd);

    // --- INICIO: Calcular el total en efectivo para esta venta específica ---
    let totalEfectivoDeLaVenta = 0;
    if (venta.detalles && venta.detalles.length > 0) {
        totalEfectivoDeLaVenta = venta.detalles.reduce((acc, detalle) => {
            const producto = productosCache.find(p => p.codigo === detalle.producto_codigo);
            if (producto) {
                // Si el producto está en caché, usar su precio de venta en efectivo
                return acc + (producto.venta_$_efectivo * detalle.cantidad);
            }
            // Fallback para productos no encontrados en caché (ej. 'adicionales')
            // Para estos, el precio en efectivo es el mismo que el precio unitario (BCV) guardado.
            return acc + (detalle.precio_unitario * detalle.cantidad);
        }, 0);
    }
    totalEfectivoDeLaVenta = parseFloat(totalEfectivoDeLaVenta.toFixed(2));
    // --- FIN: Calcular el total en efectivo ---

    // 1. Poblar datos del cliente y totales
    document.getElementById('editVentaId').value = venta.id;
    document.getElementById('editVentaTotalUsd').value = totalDeLaVenta;
    // --- INICIO: Guardar el total en efectivo en un input oculto ---
    let editVentaTotalEfectivoInput = document.getElementById('editVentaTotalEfectivo');
    if (!editVentaTotalEfectivoInput) {
        editVentaTotalEfectivoInput = document.createElement('input');
        editVentaTotalEfectivoInput.type = 'hidden';
        editVentaTotalEfectivoInput.id = 'editVentaTotalEfectivo';
        document.getElementById('formEditarVenta').appendChild(editVentaTotalEfectivoInput);
    }
    editVentaTotalEfectivoInput.value = totalEfectivoDeLaVenta;
    // --- FIN: Guardar el total en efectivo ---
    document.getElementById('editVentaIdDisplay').textContent = `#${venta.id}`;
    document.getElementById('editCliNombre').value = venta.cliente_nombre;
    if (venta.cliente_cedula && venta.cliente_cedula.includes('-')) {
        const [tipo, ...numero] = venta.cliente_cedula.split('-');
        document.getElementById('editCliTipoCedula').value = tipo;
        document.getElementById('editCliCedula').value = numero.join('-');
    } else {
        document.getElementById('editCliTipoCedula').value = 'V';
        document.getElementById('editCliCedula').value = venta.cliente_cedula || '';
    }
    const parsedEditTel = parseTelefonoVE(venta.cliente_telefono);
    const editCodSelect = document.getElementById('editCliCodTelefono');
    if (editCodSelect) editCodSelect.value = parsedEditTel.cod;
    document.getElementById('editCliTelefono').value = parsedEditTel.num;
    document.getElementById('editCliDireccion').value = venta.cliente_direccion || '';
    document.getElementById('editModalTotalUsd').textContent = `$ ${formatCurrency(totalDeLaVenta)}`;
    document.getElementById('editModalTotalBs').textContent = `Bs ${formatCurrency(totalDeLaVenta * oficialRate)}`;

    // --- NUEVO: Añadir checkbox de pago pendiente ---
    const modal = document.getElementById('modalEditarVenta');
    const footer = modal.querySelector('.modal-footer, .modal-buttons');
    if (footer) {
        let leftActionsContainer = footer.querySelector('.modal-left-actions');
        if (!leftActionsContainer) {
            leftActionsContainer = document.createElement('div');
            leftActionsContainer.className = 'modal-left-actions';
            leftActionsContainer.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin-right: auto;';
            footer.insertBefore(leftActionsContainer, footer.firstChild);
        }

        if (!leftActionsContainer.querySelector('#editPagoPendienteContainer')) {
            const pendienteContainer = document.createElement('div');
            pendienteContainer.id = 'editPagoPendienteContainer';
            pendienteContainer.className = 'checkbox-action-container';
            pendienteContainer.innerHTML = `
                <input type="checkbox" id="editPagoPendienteCheckbox" class="pago-pendiente-check">
                <label for="editPagoPendienteCheckbox" style="font-weight: 600; cursor: pointer; user-select: none; color: var(--btn-orange);">Pago pendiente (crédito)</label>
            `;
            leftActionsContainer.appendChild(pendienteContainer);
        }
    }
    const chkPendiente = document.getElementById('editPagoPendienteCheckbox');
    if (chkPendiente) {
        chkPendiente.checked = venta.estado_pago === 'pendiente';
    }

    // 2. Generar inputs de pago
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];
    const paymentContainer = document.getElementById('editPaymentMethodsContainer');
    paymentContainer.innerHTML = METODOS_DE_PAGO.map(metodo => {
        const id = `edit_${metodo.toLowerCase().replace(/ /g, '_').replace('ó', 'o')}`;
        // Ensure 'ó' is replaced correctly for consistency
        const isBsMethod = metodosEnBolivares.includes(metodo);
        const currencyLabel = isBsMethod ? 'Bs' : '$';
        return `
            <div class="payment-method-row">
                <div class="payment-method-selector">
                    <input type="checkbox" id="check_${id}" data-edit-method-id="${id}">
                    <label for="check_${id}">${metodo} (${currencyLabel})</label>
                </div>
                <div class="payment-method-input" id="input_container_${id}" style="display: none;">
                    <input type="number" class="edit-payment-amount-input" step="0.01" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
                    <button type="button" class="action-btn btn-blue btn-fill-remaining" data-target-id="${id}">FULL</button>
                </div>
            </div>
        `;
    }).join('');

    // 3. Poblar con los pagos existentes
    let pagosExistentes = [];
    try {
        const parsed = JSON.parse(venta.tipo_pago);
        if (Array.isArray(parsed)) pagosExistentes = parsed;
    } catch (e) { /* no-op */ }

    pagosExistentes.forEach(pago => {
        const metodoNormalizado = pago.metodo.toLowerCase().replace(/ /g, '_').replace('ó', 'o');
        const id = `edit_${metodoNormalizado}`;
        const check = document.getElementById(`check_${id}`);
        const amountInput = document.getElementById(`amount_${id}`);

        if (check && amountInput) {
            check.checked = true;
            document.getElementById(`input_container_${id}`).style.display = 'flex';

            if (amountInput.dataset.currency === 'BS') {
                const saleBs = parseFloat(venta.total_bs) || 0;
                const saleUsd = parseFloat(venta.total_usd) || 1;
                const rate = saleBs > 0 ? (saleBs / saleUsd) : oficialRate;
                amountInput.value = (pago.monto_original !== undefined && pago.monto_original !== null) ? parseFloat(pago.monto_original) : parseFloat((pago.monto * rate).toFixed(2));
            } else {
                amountInput.value = (pago.monto_original !== undefined && pago.monto_original !== null) ? parseFloat(pago.monto_original) : parseFloat(pago.monto);
            }
        }
    });

    // 4. Añadir listeners
    const modalBody = document.getElementById('formEditarVenta');
    const updateHandler = (e) => {
        // MODIFICADO: también actualizar al cambiar el checkbox
        if (e.target.classList.contains('edit-payment-amount-input') || e.target.id === 'editPagoPendienteCheckbox') {
            updateEditPaymentSummary();
        }
    };
    // MODIFICADO: usar 'change' para el checkbox y 'input' para los montos
    modalBody.removeEventListener('input', modalBody.updateHandler); // Evitar duplicados
    modalBody.removeEventListener('change', modalBody.updateHandler); // Evitar duplicados
    modalBody.addEventListener('input', updateHandler);
    modalBody.addEventListener('change', updateHandler);
    modalBody.updateHandler = updateHandler;

    modalBody.querySelectorAll('[data-edit-method-id]').forEach(check => {
        const newCheck = check.cloneNode(true);
        check.parentNode.replaceChild(newCheck, check);
        newCheck.addEventListener('change', (e) => {
            const id = e.target.dataset.editMethodId;
            const inputContainer = document.getElementById(`input_container_${id}`);
            const amountInput = document.getElementById(`amount_${id}`);
            inputContainer.style.display = e.target.checked ? 'flex' : 'none';
            if (!e.target.checked) amountInput.value = '';
            updateEditPaymentSummary();
        });
    });

    // 5. Abrir modal y calcular resumen inicial
    updateEditPaymentSummary();
    document.getElementById('modalEditarVenta').classList.add('active');
}

// NUEVA FUNCIÓN para obtener colores del gráfico según el tema
function getChartColors() {
    const currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
    if (currentTheme === 'light') {
        return {
            backgroundColor: [
                'rgba(37, 99, 235, 0.8)', 'rgba(22, 163, 74, 0.8)', 'rgba(234, 179, 8, 0.8)',
                'rgba(220, 38, 38, 0.8)', 'rgba(147, 51, 234, 0.8)', 'rgba(234, 88, 12, 0.8)'
            ],
            borderColor: [
                '#2563eb', '#16a34a', '#eab308',
                '#dc2626', '#9333ea', '#ea580c'
            ],
            ticksColor: 'rgba(33, 37, 41, 0.9)',
            gridColor: 'rgba(0, 0, 0, 0.1)',
            tooltip: {
                backgroundColor: '#fff',
                titleColor: '#333',
                bodyColor: '#333',
                borderColor: '#ddd',
                borderWidth: 1
            }
        };
    }
    // Colores por defecto (tema oscuro)
    return {
        backgroundColor: [
            'rgba(37, 99, 235, 0.7)', 'rgba(22, 163, 74, 0.7)', 'rgba(234, 179, 8, 0.7)',
            'rgba(220, 38, 38, 0.7)', 'rgba(147, 51, 234, 0.7)', 'rgba(234, 88, 12, 0.7)'
        ],
        borderColor: [
            '#2563eb', '#16a34a', '#eab308',
            '#dc2626', '#9333ea', '#ea580c'
        ],
        ticksColor: 'rgba(248, 250, 252, 0.7)',
        gridColor: 'rgba(99, 99, 99, 0.2)',
        tooltip: {
            backgroundColor: '#111',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#333',
            borderWidth: 1
        }
    };
}

// REPORTES
async function initVistaReportes() {
    try {
        const [ventasRes, productosRes] = await Promise.all([
            _supabase.from('ventas').select('*, detalles:detalle_ventas(*)').order('fecha', { ascending: false }),
            _supabase.from('productos').select('codigo, precio_costo_dolares_bcv, precio_venta_dolares_bcv')
        ]);

        if (ventasRes.error) throw ventasRes.error;
        if (productosRes.error) throw productosRes.error;

        const ventas = ventasRes.data || [];
        const productosMap = new Map((productosRes.data || []).map(p => [p.codigo, p]));

        if (ventas.length === 0) {
            const header = document.querySelector('#visor-modulos header');
            const container = document.querySelector('#visor-modulos .report-grid');
            if (container) container.innerHTML = '<p class="loading-text" style="grid-column: 1 / -1;">No hay datos de ventas para generar reportes.</p>';
            return;
        }

        // --- INICIO: Lógica de filtros de fecha mejorada ---
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        const years = [...new Set(ventas.map(v => new Date(v.fecha).getFullYear()))].sort((a, b) => b - a);
        if (years.length === 0 || !years.includes(currentYear)) {
            years.unshift(currentYear);
        }
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const yearOptions = years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');
        const monthOptions = months.map((m, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${m}</option>`).join('');

        const reportCards = {
            'diario': document.getElementById('reporte-diario'),
            'semanal': document.getElementById('reporte-semanal'),
            'mensual': document.getElementById('reporte-mensual'),
            'anual': document.getElementById('reporte-anual')
        };

        // Inyectar los nuevos filtros con mejor estilo
        if (reportCards.diario) {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            let dayOptions = '';
            for (let i = 1; i <= daysInMonth; i++) dayOptions += `<option value="${i}" ${i === currentDay ? 'selected' : ''}>${i}</option>`;
            reportCards.diario.insertAdjacentHTML('afterbegin', `<div class="report-filter-group"><label>Seleccionar Día:</label><div class="filter-controls"><select id="diario-selector-dia" class="report-selector">${dayOptions}</select><select id="diario-selector-mes" class="report-selector">${monthOptions}</select><select id="diario-selector-anho" class="report-selector">${yearOptions}</select></div></div>`);
        }
        if (reportCards.semanal) {
            const weekOptions = [1, 2, 3, 4, 5].map(w => `<option value="${w}">Semana ${w}</option>`).join('');
            reportCards.semanal.insertAdjacentHTML('afterbegin', `<div class="report-filter-group"><label>Seleccionar Semana:</label><div class="filter-controls"><select id="semanal-selector-semana" class="report-selector">${weekOptions}</select><select id="semanal-selector-mes" class="report-selector">${monthOptions}</select><select id="semanal-selector-anho" class="report-selector">${yearOptions}</select></div></div>`);
        }
        if (reportCards.mensual) {
            reportCards.mensual.insertAdjacentHTML('afterbegin', `<div class="report-filter-group"><label>Seleccionar Mes:</label><div class="filter-controls"><select id="mensual-selector-mes" class="report-selector">${monthOptions}</select><select id="mensual-selector-anho" class="report-selector">${yearOptions}</select></div></div>`);
        }
        if (reportCards.anual) {
            reportCards.anual.insertAdjacentHTML('afterbegin', `<div class="report-filter-group"><label>Seleccionar Año:</label><div class="filter-controls"><select id="anual-selector" class="report-selector">${yearOptions}</select></div></div>`);
        }

        const updateReport = (periodo) => {
            let startDate, endDate;

            switch (periodo) {
                case 'diario': {
                    const day = document.getElementById('diario-selector-dia')?.value;
                    const month = document.getElementById('diario-selector-mes')?.value;
                    const year = document.getElementById('diario-selector-anho')?.value;
                    if (!day || !month || !year) return;
                    startDate = new Date(year, month, day);
                    endDate = new Date(year, month, parseInt(day) + 1);
                    break;
                }
                case 'semanal': {
                    const week = parseInt(document.getElementById('semanal-selector-semana')?.value);
                    const month = document.getElementById('semanal-selector-mes')?.value;
                    const year = document.getElementById('semanal-selector-anho')?.value;
                    if (!week || month == null || !year) return;

                    const startDay = (week - 1) * 7 + 1;
                    const endDay = week * 7;
                    const lastDayOfMonth = new Date(year, parseInt(month) + 1, 0).getDate();

                    startDate = new Date(year, month, startDay);
                    endDate = new Date(year, month, Math.min(endDay, lastDayOfMonth) + 1);

                    // Si la semana 5 empieza después del fin de mes, no hay datos.
                    if (startDay > lastDayOfMonth) {
                        generarReporteParaPeriodo(periodo, [], productosMap);
                        return;
                    }
                    break;
                }
                case 'mensual': {
                    const month = document.getElementById('mensual-selector-mes')?.value;
                    const year = document.getElementById('mensual-selector-anho')?.value;
                    if (month == null || !year) return;
                    startDate = new Date(year, month, 1);
                    endDate = new Date(year, parseInt(month) + 1, 1);
                    break;
                }
                case 'anual': {
                    const year = document.getElementById('anual-selector')?.value;
                    if (!year) return;
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(parseInt(year) + 1, 0, 1);
                    break;
                }
                default: return;
            }

            const filteredVentas = ventas.filter(v => {
                const ventaDate = new Date(v.fecha);
                return ventaDate >= startDate && ventaDate < endDate;
            });
            generarReporteParaPeriodo(periodo, filteredVentas, productosMap);
        };

        const updateDaySelector = () => {
            const diaSelect = document.getElementById('diario-selector-dia');
            const mes = document.getElementById('diario-selector-mes')?.value;
            const anho = document.getElementById('diario-selector-anho')?.value;
            if (!diaSelect || mes == null || !anho) return;

            const daysInMonth = new Date(anho, parseInt(mes) + 1, 0).getDate();
            const currentVal = parseInt(diaSelect.value);

            let dayOptions = '';
            for (let i = 1; i <= daysInMonth; i++) dayOptions += `<option value="${i}">${i}</option>`;
            diaSelect.innerHTML = dayOptions;

            diaSelect.value = (currentVal <= daysInMonth) ? currentVal : daysInMonth;
            updateReport('diario');
        };

        // Asignar eventos a los nuevos selectores
        document.getElementById('diario-selector-dia')?.addEventListener('change', () => updateReport('diario'));
        document.getElementById('diario-selector-mes')?.addEventListener('change', updateDaySelector);
        document.getElementById('diario-selector-anho')?.addEventListener('change', updateDaySelector);

        document.getElementById('semanal-selector-semana')?.addEventListener('change', () => updateReport('semanal'));
        document.getElementById('semanal-selector-mes')?.addEventListener('change', () => updateReport('semanal'));
        document.getElementById('semanal-selector-anho')?.addEventListener('change', () => updateReport('semanal'));

        document.getElementById('mensual-selector-mes')?.addEventListener('change', () => updateReport('mensual'));
        document.getElementById('mensual-selector-anho')?.addEventListener('change', () => updateReport('mensual'));
        document.getElementById('anual-selector')?.addEventListener('change', () => updateReport('anual'));

        // Generar reportes iniciales
        updateReport('diario');
        updateReport('semanal');
        updateReport('mensual');
        updateReport('anual');
        // --- FIN: Lógica de filtros de fecha mejorada ---

    } catch (error) {
        console.error('Error al generar reportes:', error);
        const visor = document.getElementById('visor-modulos');
        if (visor) visor.innerHTML = `<div class="welcome-container"><h1>Error en Reportes</h1><p>No se pudieron cargar los datos para los reportes: ${error.message}</p></div>`;
    }
}

function generarReporteParaPeriodo(periodo, ventas, productosMap) {
    const usdEl = document.getElementById(`${periodo}-total-usd`);
    const bsEl = document.getElementById(`${periodo}-total-bs`);
    const divisasEl = document.getElementById(`${periodo}-total-divisas`);
    const gananciaEl = document.getElementById(`${periodo}-total-ganancia`);
    const breakdownContainer = document.getElementById(`${periodo}-metodos-pago`);
    const chartCanvas = document.getElementById(`${periodo}-chart`);

    if (!usdEl || !bsEl || !gananciaEl || !breakdownContainer || !chartCanvas) return;

    // Destruir el gráfico anterior si existe para evitar conflictos
    if (reportCharts[periodo]) {
        reportCharts[periodo].destroy();
    }

    const chartContainer = chartCanvas.parentElement;
    if (!ventas || ventas.length === 0) {
        usdEl.textContent = `$ ${formatCurrency(0)}`;
        bsEl.textContent = `Bs ${formatCurrency(0)}`;
        if (divisasEl) divisasEl.textContent = `$ ${formatCurrency(0)}`;
        gananciaEl.textContent = `$ ${formatCurrency(0)}`;
        breakdownContainer.innerHTML = '<p class="loading-text">No hay ventas en este período.</p>';
        if (chartContainer) chartContainer.style.display = 'none'; // Ocultar si no hay datos
        return;
    }
    if (chartContainer) chartContainer.style.display = 'block'; // Mostrar si hay datos

    const metodosBsKeys = ['Pago Móvil', 'Bolívares en efectivo'];
    const breakdownBs = {
        'Pago Móvil': { count: 0, totalBs: 0, totalUsd: 0 },
        'Bolívares en efectivo': { count: 0, totalBs: 0, totalUsd: 0 }
    };

    const breakdownDivisas = {
        'Dólares en efectivo': { count: 0, totalUsd: 0 },
        'Binance': { count: 0, totalUsd: 0 },
        'Zelle': { count: 0, totalUsd: 0 }
    };

    let totalVentasUsd = 0;
    let totalVentasBs = 0;
    let totalProfit = 0;

    for (const venta of ventas) {
        const ventaUsd = parseFloat(venta.total_usd || 0);
        const ventaBs = parseFloat(venta.total_bs || 0);
        const saleRate = (ventaUsd > 0 && ventaBs > 0) ? (ventaBs / ventaUsd) : oficialRate;

        totalVentasUsd += ventaUsd;
        totalVentasBs += ventaBs;

        let pagos = [];
        try {
            const parsed = typeof venta.tipo_pago === 'string' ? JSON.parse(venta.tipo_pago) : venta.tipo_pago;
            if (Array.isArray(parsed) && parsed.length > 0) {
                pagos = parsed;
            }
        } catch (e) { }

        if (pagos.length === 0) {
            const raw = String(venta.tipo_pago || '');
            if (raw.includes('Bolívares') || raw.includes('Pago Móvil')) {
                breakdownBs['Pago Móvil'].count++;
                breakdownBs['Pago Móvil'].totalBs += ventaBs;
                breakdownBs['Pago Móvil'].totalUsd += ventaUsd;
            } else {
                breakdownDivisas['Dólares en efectivo'].count++;
                breakdownDivisas['Dólares en efectivo'].totalUsd += ventaUsd;
            }
        } else {
            pagos.forEach(p => {
                const metodo = p.metodo || 'Dólares en efectivo';
                const isBs = p.moneda === 'BS' || metodosBsKeys.includes(metodo);

                if (isBs) {
                    let valBs = 0;
                    let valUsd = 0;
                    if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                        valBs = parseFloat(p.monto_original);
                        valUsd = parseFloat(p.monto || (valBs / saleRate));
                    } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                        valUsd = parseFloat(p.monto);
                        valBs = valUsd * saleRate;
                    }

                    const key = (metodo === 'Bolívares en efectivo') ? 'Bolívares en efectivo' : 'Pago Móvil';
                    breakdownBs[key].count++;
                    breakdownBs[key].totalBs += valBs;
                    breakdownBs[key].totalUsd += valUsd;
                } else {
                    let valUsd = 0;
                    if (p.monto_original !== undefined && p.monto_original !== null && !isNaN(parseFloat(p.monto_original))) {
                        valUsd = parseFloat(p.monto_original);
                    } else if (p.monto !== undefined && p.monto !== null && !isNaN(parseFloat(p.monto))) {
                        valUsd = parseFloat(p.monto);
                    }

                    let key = 'Dólares en efectivo';
                    if (metodo.includes('Binance')) key = 'Binance';
                    else if (metodo.includes('Zelle')) key = 'Zelle';

                    breakdownDivisas[key].count++;
                    breakdownDivisas[key].totalUsd += valUsd;
                }
            });
        }

        if (venta.detalles) {
            for (const detalle of venta.detalles) {
                const producto = productosMap ? productosMap.get(detalle.producto_codigo) : null;
                const precioVenta = parseFloat(detalle.precio_unitario || 0);
                let costo = 0;
                if (producto) {
                    if (detalle.tipo_precio_usado === 'EFECTIVO') {
                        costo = parseFloat(producto['costo_$_efectivo'] || producto['calc_costo_$_efectivo'] || producto.precio_costo_dolares_bcv || 0);
                    } else {
                        costo = parseFloat(producto.precio_costo_dolares_bcv || 0);
                    }
                }
                const gananciaPorUnidad = Math.max(0, precioVenta - costo);
                totalProfit += gananciaPorUnidad * (parseInt(detalle.cantidad, 10) || 1);
            }
        }
    }

    const totalBsSum = breakdownBs['Pago Móvil'].totalBs + breakdownBs['Bolívares en efectivo'].totalBs;
    const totalBsUsdEquiv = breakdownBs['Pago Móvil'].totalUsd + breakdownBs['Bolívares en efectivo'].totalUsd;
    const totalDivisasUsd = breakdownDivisas['Dólares en efectivo'].totalUsd + breakdownDivisas['Binance'].totalUsd + breakdownDivisas['Zelle'].totalUsd;

    usdEl.textContent = `$ ${formatCurrency(totalVentasUsd)}`;
    bsEl.textContent = `Bs ${formatCurrency(totalBsSum)}`;
    if (divisasEl) divisasEl.textContent = `$ ${formatCurrency(totalDivisasUsd)}`;
    gananciaEl.textContent = `$ ${formatCurrency(totalProfit)}`;

    // Renderizar la tabla de desglose estructurada en dos grupos
    const table = document.createElement('table');
    table.className = 'breakdown-table';
    table.innerHTML = `
        <thead>
            <tr style="background: var(--bg-hover);">
                <th colspan="3" style="font-size: 0.85rem; font-weight: bold; color: var(--btn-blue); text-transform: uppercase;">
                    🇻🇪 Pagos en Bolívares (BCV)
                </th>
            </tr>
            <tr>
                <th>Método</th>
                <th style="text-align: right;">Total BS</th>
                <th style="text-align: right;">Equiv. USD</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Pago Móvil (${formatInteger(breakdownBs['Pago Móvil'].count)} trans.)</td>
                <td style="text-align: right; font-weight: 600;">Bs ${formatCurrency(breakdownBs['Pago Móvil'].totalBs)}</td>
                <td style="text-align: right; color: var(--text-muted);">$ ${formatCurrency(breakdownBs['Pago Móvil'].totalUsd)}</td>
            </tr>
            <tr>
                <td>Bolívares en efectivo (${formatInteger(breakdownBs['Bolívares en efectivo'].count)} trans.)</td>
                <td style="text-align: right; font-weight: 600;">Bs ${formatCurrency(breakdownBs['Bolívares en efectivo'].totalBs)}</td>
                <td style="text-align: right; color: var(--text-muted);">$ ${formatCurrency(breakdownBs['Bolívares en efectivo'].totalUsd)}</td>
            </tr>
            <tr style="border-top: 2px solid var(--border-color); background: rgba(59, 130, 246, 0.08);">
                <td style="font-weight: bold; color: var(--btn-blue);">Subtotal Bolívares</td>
                <td style="text-align: right; font-weight: bold; color: var(--btn-blue);">Bs ${formatCurrency(totalBsSum)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--btn-blue);">$ ${formatCurrency(totalBsUsdEquiv)}</td>
            </tr>
        </tbody>
        <thead>
            <tr style="background: var(--bg-hover);">
                <th colspan="3" style="font-size: 0.85rem; font-weight: bold; color: var(--btn-orange); text-transform: uppercase; padding-top: 15px;">
                    💵 Pagos en Dólares Físico / DIGITALES
                </th>
            </tr>
            <tr>
                <th>Método</th>
                <th style="text-align: right;" colspan="2">Total USD ($)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Dólares en efectivo (${formatInteger(breakdownDivisas['Dólares en efectivo'].count)} trans.)</td>
                <td style="text-align: right; font-weight: 600; color: var(--btn-orange);" colspan="2">$ ${formatCurrency(breakdownDivisas['Dólares en efectivo'].totalUsd)}</td>
            </tr>
            <tr>
                <td>Binance (${formatInteger(breakdownDivisas['Binance'].count)} trans.)</td>
                <td style="text-align: right; font-weight: 600; color: var(--btn-orange);" colspan="2">$ ${formatCurrency(breakdownDivisas['Binance'].totalUsd)}</td>
            </tr>
            <tr>
                <td>Zelle (${formatInteger(breakdownDivisas['Zelle'].count)} trans.)</td>
                <td style="text-align: right; font-weight: 600; color: var(--btn-orange);" colspan="2">$ ${formatCurrency(breakdownDivisas['Zelle'].totalUsd)}</td>
            </tr>
            <tr style="border-top: 2px solid var(--border-color); background: rgba(249, 115, 22, 0.08);">
                <td style="font-weight: bold; color: var(--btn-orange);">Subtotal Divisas / Físico</td>
                <td style="text-align: right; font-weight: bold; color: var(--btn-orange);" colspan="2">$ ${formatCurrency(totalDivisasUsd)}</td>
            </tr>
        </tbody>
    `;

    breakdownContainer.innerHTML = '';
    breakdownContainer.appendChild(table);

    // Renderizar el gráfico de barras con los 5 métodos
    const chartLabels = [
        'Pago Móvil',
        'Bolívares en efectivo',
        'Dólares en efectivo',
        'Binance',
        'Zelle'
    ];
    const chartData = [
        breakdownBs['Pago Móvil'].totalUsd,
        breakdownBs['Bolívares en efectivo'].totalUsd,
        breakdownDivisas['Dólares en efectivo'].totalUsd,
        breakdownDivisas['Binance'].totalUsd,
        breakdownDivisas['Zelle'].totalUsd
    ];

    const chartColors = getChartColors();
    const ctx = chartCanvas.getContext('2d');
    reportCharts[periodo] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Total Recaudado (USD Equiv)',
                data: chartData,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.7)',
                    'rgba(14, 165, 233, 0.7)',
                    'rgba(249, 115, 22, 0.7)',
                    'rgba(234, 179, 8, 0.7)',
                    'rgba(168, 85, 247, 0.7)'
                ],
                borderColor: [
                    '#3b82f6',
                    '#0ea5e9',
                    '#f97316',
                    '#eab308',
                    '#a855f7'
                ],
                borderWidth: 1.5
            }]
        },
        options: {
            indexAxis: 'y', // Gráfico de barras horizontales
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: chartColors.tooltip.backgroundColor,
                    titleColor: chartColors.tooltip.titleColor,
                    bodyColor: chartColors.tooltip.bodyColor,
                    borderColor: chartColors.tooltip.borderColor,
                    borderWidth: chartColors.tooltip.borderWidth,
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: (context) => `Total: $ ${formatCurrency(context.parsed.x)}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: chartColors.ticksColor,
                        font: { size: 10 }
                    },
                    grid: { color: chartColors.gridColor }
                },
                y: {
                    ticks: {
                        color: chartColors.ticksColor,
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// DEVOLUCIONES
async function initVistaDevoluciones() {
    // Cargar el caché de productos para poder verificar si un producto es retornable.
    // Esto es crucial para evitar errores de clave foránea con productos adicionales o eliminados.
    if (productosCache.length === 0) {
        try {
            const { data, error } = await _supabase.from('productos').select('*');
            if (error) throw error;
            productosCache = data || [];
        } catch (error) {
            console.error("Error al precargar el caché de productos para devoluciones:", error);
            showToast('No se pudo cargar la lista de productos, la función de devolución puede fallar.', 'error');
        }
    }

    document.getElementById('btnBuscarVenta')?.addEventListener('click', buscarVentaParaDevolucion);
    document.getElementById('devolucionVentaSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar que el formulario se envíe si hay uno
            buscarVentaParaDevolucion();
        }
    });
    cargarHistorialDevoluciones();
}

async function buscarVentaParaDevolucion() {
    const ventaId = document.getElementById('devolucionVentaSearch')?.value.trim();
    const container = document.getElementById('devolucionResultContainer');
    if (!container) return;

    if (!ventaId) {
        showToast('Por favor, introduce un ID de venta.', 'info');
        return;
    }

    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando venta...</p>';

    const { data: venta, error } = await _supabase
        .from('ventas')
        .select('*, detalles:detalle_ventas(*)')
        .eq('id', ventaId)
        .single();

    if (error || !venta) {
        container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--btn-red);">No se encontró la venta con ID #${ventaId}.</p>`;
        return;
    }

    const { data: devolucionesExistentes } = await _supabase
        .from('devoluciones')
        .select('producto_codigo, cantidad_devuelta')
        .eq('venta_id', ventaId);

    const devolucionesMap = (devolucionesExistentes || []).reduce((acc, dev) => {
        acc[dev.producto_codigo] = (acc[dev.producto_codigo] || 0) + dev.cantidad_devuelta;
        return acc;
    }, {});

    renderizarVentaParaDevolucion(venta, devolucionesMap);
}

function renderizarVentaParaDevolucion(venta, devolucionesMap) {
    const container = document.getElementById('devolucionResultContainer');
    if (!container) return;

    let itemsHtml = venta.detalles.map((item, index) => {
        // Usar el índice del array como fallback para una clave única si item.id es nulo.
        // Esto previene IDs duplicados en el HTML si múltiples detalles de venta tienen un ID nulo.
        const uniqueKey = item.id !== null && item.id !== undefined ? item.id : `idx-${index}`;

        const productoEnCache = productosCache.find(p => p.codigo === item.producto_codigo);
        const cantidadYaDevuelta = devolucionesMap[item.producto_codigo] || 0;
        const cantidadMaxADevolver = item.cantidad - cantidadYaDevuelta;

        if (cantidadMaxADevolver <= 0) {
            return `
                <div class="devolucion-item-card disabled">
                    <div class="item-info">
                        <strong>${item.producto_nombre} ${productoEnCache ? `(${productoEnCache.marca || 'N/A'})` : ''}</strong>
                        <span>Código: ${item.producto_codigo}</span>
                        <span>Vendido: ${item.cantidad}</span>
                    </div>
                    <div class="item-status">
                        <p>Todas las unidades de este producto ya han sido devueltas.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="devolucion-item-card" id="devolucion-item-${uniqueKey}" data-producto-codigo="${item.producto_codigo}" data-max-cantidad="${cantidadMaxADevolver}">
                <div class="item-selection">
                    <input type="checkbox" class="devolucion-item-checkbox" data-unique-key="${uniqueKey}">
                </div>
                <div class="item-info">
                    <strong>${item.producto_nombre}</strong>
                    <span>Código: ${item.producto_codigo}</span>
                    <span>Vendido: ${item.cantidad} | Ya Devuelto: ${cantidadYaDevuelta}</span>
                </div>
                <div class="item-actions">
                    <div class="field-group">
                        <label for="cantidad-devuelta-${uniqueKey}">Cant. a Devolver</label>
                        <input type="number" class="cantidad-a-devolver" id="cantidad-devuelta-${uniqueKey}" min="1" max="${cantidadMaxADevolver}" value="1">
                    </div>
                    <div class="field-group" style="flex-grow: 1;">
                        <label for="motivo-${uniqueKey}">Motivo de la devolución</label>
                        <input type="text" class="motivo-devolucion" id="motivo-${uniqueKey}">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="venta-info-header">
            <h3>Venta #${venta.id}</h3>
            <p>Cliente: ${venta.cliente_nombre} - Fecha: ${new Date(venta.fecha).toLocaleString()}</p>
        </div>
        <div class="devolucion-actions-summary">
            <button id="btnRegistrarDevolucion" data-venta-id="${venta.id}" class="action-btn btn-green">Registrar Devolución</button>
        </div>
        <div class="devolucion-items-container">
            ${itemsHtml}
        </div>
    `;
}

async function handleRegistrarDevolucion(ventaId) {
    const itemsSeleccionados = document.querySelectorAll('.devolucion-item-checkbox:checked');
    const venta = ventasCache.find(v => v.id == ventaId);

    if (itemsSeleccionados.length === 0) {
        showToast('No has seleccionado ningún producto para devolver.', 'info');
        return;
    }

    const devolucionesParaProcesar = [];
    let errorValidacion = false;

    // Determinar si es una devolución completa
    const allReturnableItems = document.querySelectorAll('.devolucion-item-card:not(.disabled)');
    let isFullReturn = allReturnableItems.length > 0 && itemsSeleccionados.length === allReturnableItems.length;

    // Calcular la tasa de cambio de la venta original para registrar los montos devueltos
    const saleRate = (venta.total_usd > 0) ? (venta.total_bs / venta.total_usd) : oficialRate;

    itemsSeleccionados.forEach(checkbox => {
        if (errorValidacion) return;

        const uniqueKey = checkbox.dataset.uniqueKey;
        const detalleVenta = venta.detalles.find((d, i) => {
            const key = d.id !== null && d.id !== undefined ? d.id : `idx-${i}`;
            return String(key) === String(uniqueKey);
        });

        if (!detalleVenta) {
            showToast(`Error interno: no se encontró el detalle de venta para la clave ${uniqueKey}.`, 'error');
            errorValidacion = true;
            return;
        }

        const itemCard = document.getElementById(`devolucion-item-${uniqueKey}`);
        const productoCodigo = itemCard.dataset.productoCodigo;
        const maxCantidad = parseInt(itemCard.dataset.maxCantidad, 10);

        // Verificar si el producto existe en el caché de productos antes de procesar la devolución
        const productoEnCache = productosCache.find(p => p.codigo === productoCodigo);
        if (!productoEnCache) {
            showToast(`El producto con código ${productoCodigo} no existe en el inventario y no puede ser devuelto.`, 'error');
            errorValidacion = true;
            return;
        }

        const cantidadInput = document.getElementById(`cantidad-devuelta-${uniqueKey}`);
        const motivoInput = document.getElementById(`motivo-${uniqueKey}`);

        const cantidadADevolver = parseInt(cantidadInput.value, 10);
        const motivo = motivoInput.value.trim();

        if (isNaN(cantidadADevolver) || cantidadADevolver <= 0) {
            showToast(`La cantidad a devolver para el producto ${productoCodigo} debe ser mayor que cero.`, 'error');
            errorValidacion = true;
        } else if (cantidadADevolver > maxCantidad) {
            showToast(`No puedes devolver más de ${maxCantidad} unidades del producto ${productoCodigo}.`, 'error');
            errorValidacion = true;
        } else if (cantidadADevolver < maxCantidad) {
            // Si incluso un artículo no se devuelve en su totalidad, no es una devolución completa.
            isFullReturn = false;
        } else if (!motivo) {
            showToast(`Debes especificar un motivo para la devolución del producto ${productoCodigo}.`, 'error');
            errorValidacion = true;
        } else {
            const monto_usd_devolucion = cantidadADevolver * detalleVenta.precio_unitario;
            const monto_bs_devolucion = monto_usd_devolucion * saleRate;

            const metaObj = {
                cedula: venta.cliente_cedula || '',
                telefono: venta.cliente_telefono || '',
                tipo_pago: venta.tipo_pago || '',
                total_usd: venta.total_usd,
                total_bs: venta.total_bs
            };
            const motivoConMeta = `${motivo} [[meta:${JSON.stringify(metaObj)}]]`;

            devolucionesParaProcesar.push({
                venta_id: ventaId,
                producto_codigo: productoCodigo,
                producto_nombre: detalleVenta.producto_nombre, // Guardar el nombre para el historial
                cantidad_devuelta: cantidadADevolver,
                motivo: motivoConMeta,
                cliente_nombre: venta.cliente_nombre,
                monto_usd_devolucion: monto_usd_devolucion,
                monto_bs_devolucion: monto_bs_devolucion,
                fecha_devolucion: new Date().toISOString()
            });
        }
    });

    if (errorValidacion) return;

    if (isFullReturn) {
        showConfirmation('Está devolviendo todos los productos. La venta original se eliminará y el stock se restaurará. ¿Continuar?', async () => {
            const btn = document.getElementById('btnRegistrarDevolucion');
            const originalText = btn ? btn.textContent : 'Registrar';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Procesando...';
            }
            try {
                // 1. Registrar las devoluciones para mantener el historial
                const { error: devolucionError } = await _supabase.from('devoluciones').insert(devolucionesParaProcesar);
                if (devolucionError) throw devolucionError;

                // 2. Eliminar la venta y restaurar el stock de todos sus productos
                await _deleteSaleAndRestoreStock(venta);

                showToast('Devolución total registrada. La venta ha sido eliminada.', 'success');
                const resContainer = document.getElementById('devolucionResultContainer');
                if (resContainer) resContainer.innerHTML = ''; // Limpiar la vista
                cargarHistorialDevoluciones(); // Recargar el historial de devoluciones
                socket.emit('cambio-dato', { type: 'products' });
                socket.emit('cambio-dato', { type: 'devoluciones' });
                socket.emit('cambio-dato', { type: 'ventas' }); // Notificar que una venta fue eliminada
            } catch (error) {
                console.error('Error en devolución total:', error);
                showToast(`Error: ${error.message}`, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            }
        });
    } else { // Lógica para devolución parcial
        const btn = document.getElementById('btnRegistrarDevolucion');
        const originalText = btn ? btn.textContent : 'Registrar';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
        }
        try {
            const { error: devolucionError } = await _supabase.from('devoluciones').insert(devolucionesParaProcesar);
            if (devolucionError) throw devolucionError;

            for (const dev of devolucionesParaProcesar) {
                const { data: producto, error: productoError } = await _supabase.from('productos').select('cantidad').eq('codigo', dev.producto_codigo).single();
                if (productoError) throw new Error(`No se pudo obtener el stock para ${dev.producto_codigo}.`);
                const nuevoStock = producto.cantidad + dev.cantidad_devuelta;
                const { error: updateError } = await _supabase.from('productos').update({ cantidad: nuevoStock }).eq('codigo', dev.producto_codigo);
                if (updateError) throw updateError;
            }
            showToast('Devolución parcial registrada y stock actualizado.', 'success');
            buscarVentaParaDevolucion();
            cargarHistorialDevoluciones();
            socket.emit('cambio-dato', { type: 'products' });
            socket.emit('cambio-dato', { type: 'devoluciones' });
        } catch (error) {
            console.error('Error en devolución parcial:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }
}

/**
 * Agrupa las filas de devoluciones para que los productos devueltos
 * en una misma operación se muestren en una sola tarjeta de devolución.
 */
function agruparDevoluciones(lista) {
    const grupos = [];

    lista.forEach(item => {
        let motivoLimpio = item.motivo || '';
        let meta = {};
        const metaMatch = (item.motivo || '').match(/\[\[meta:(.*?)\]\]/);
        if (metaMatch) {
            try {
                meta = JSON.parse(metaMatch[1]);
                motivoLimpio = (item.motivo || '').replace(/\[\[meta:.*?\]\]/, '').trim();
            } catch (e) { }
        }
        item.motivo = motivoLimpio;
        item.cliente_cedula = meta.cedula || '';
        item.cliente_telefono = meta.telefono || '';
        item.tipo_pago = meta.tipo_pago || '';

        if ((!item.cliente_cedula || !item.cliente_telefono || !item.tipo_pago) && item.venta_id) {
            const venta = (typeof ventasCache !== 'undefined') ? ventasCache.find(v => String(v.id) === String(item.venta_id)) : null;
            if (venta) {
                if (!item.cliente_cedula) item.cliente_cedula = venta.cliente_cedula || '';
                if (!item.cliente_telefono) item.cliente_telefono = venta.cliente_telefono || '';
                if (!item.tipo_pago) item.tipo_pago = venta.tipo_pago || '';
            }
        }

        const itemFecha = new Date(item.fecha_devolucion).getTime();

        // Buscar un grupo existente que pertenezca a la misma operación de devolución:
        // Criterio: coincidir en fecha (dentro de 10 seg), mismo cliente y misma venta
        const grupoExistente = grupos.find(g => {
            const grupoFecha = new Date(g.fecha_devolucion).getTime();
            const diffSegundos = Math.abs(itemFecha - grupoFecha) / 1000;
            const mismoCliente = (g.cliente_nombre || '').trim().toLowerCase() === (item.cliente_nombre || '').trim().toLowerCase();
            const mismaVenta = (item.venta_id && g.venta_id) ? String(item.venta_id) === String(g.venta_id) : true;

            return mismoCliente && mismaVenta && diffSegundos <= 10;
        });

        if (grupoExistente) {
            grupoExistente.items.push(item);
            grupoExistente.totalItems += parseInt(item.cantidad_devuelta, 10) || 0;
            grupoExistente.totalUsd += parseFloat(item.monto_usd_devolucion || 0);
            grupoExistente.totalBs += parseFloat(item.monto_bs_devolucion || 0);
            if (item.id && (!grupoExistente.id || item.id < grupoExistente.id)) {
                grupoExistente.id = item.id;
            }
            if (!grupoExistente.venta_id && item.venta_id) {
                grupoExistente.venta_id = item.venta_id;
            }
            if (!grupoExistente.cliente_cedula && item.cliente_cedula) {
                grupoExistente.cliente_cedula = item.cliente_cedula;
            }
            if (!grupoExistente.cliente_telefono && item.cliente_telefono) {
                grupoExistente.cliente_telefono = item.cliente_telefono;
            }
            if (!grupoExistente.tipo_pago && item.tipo_pago) {
                grupoExistente.tipo_pago = item.tipo_pago;
            }
        } else {
            grupos.push({
                id: item.id,
                venta_id: item.venta_id,
                cliente_nombre: item.cliente_nombre,
                cliente_cedula: item.cliente_cedula || '',
                cliente_telefono: item.cliente_telefono || '',
                tipo_pago: item.tipo_pago || '',
                fecha_devolucion: item.fecha_devolucion,
                totalItems: parseInt(item.cantidad_devuelta, 10) || 0,
                totalUsd: parseFloat(item.monto_usd_devolucion || 0),
                totalBs: parseFloat(item.monto_bs_devolucion || 0),
                items: [item]
            });
        }
    });

    return grupos;
}

async function cargarHistorialDevoluciones() {
    const container = document.getElementById('historialDevolucionesContent');
    if (!container) return;
    container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-muted);">Cargando historial...</p>';

    const { data, error } = await _supabase.from('devoluciones').select(`*`).order('fecha_devolucion', { ascending: false }).order('id', { ascending: false });

    if (error) { container.innerHTML = `<p style="color: var(--btn-red);">Error al cargar el historial.</p>`; return; }
    if (!data || data.length === 0) { container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-muted);">No hay devoluciones registradas.</p>'; return; }

    const grupos = agruparDevoluciones(data);

    // Renderizar los paneles desplegables agrupados
    const historialHtml = grupos.map(grupo => {
        const ventaIdDisplay = (grupo.venta_id && grupo.venta_id !== 'null') ? ` (Venta #${grupo.venta_id})` : '';
        const fechaDevolucionFormateada = new Date(grupo.fecha_devolucion).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const { totalUsdBcvDisplay, totalBsBcvDisplay, totalUsdEfectivoDisplay } = calcularTotalesVenta({
            tipo_pago: grupo.tipo_pago,
            total_usd: grupo.totalUsd,
            total_bs: grupo.totalBs
        });

        const tipoPagoHtml = formatTipoPagoBadges(grupo.tipo_pago, grupo.totalBs, grupo.totalUsd);

        const itemsHtml = grupo.items.map(item => `
            <div class="historial-devolucion-item-detalle">
                <div class="historial-producto">
                    <strong>${item.producto_nombre || 'Nombre no registrado'} (x${item.cantidad_devuelta})</strong>
                    <p class="historial-motivo">Motivo: ${item.motivo || 'No especificado'}</p>
                    <span class="historial-fecha-detalle">Código: ${item.producto_codigo || 'N/A'}</span>
                </div>
                <div class="historial-montos-detalle">
                    <span>$ ${formatCurrency(item.monto_usd_devolucion || 0)}</span>
                    <span>Bs ${formatCurrency(item.monto_bs_devolucion || 0)}</span>
                </div>
            </div>
        `).join('');

        return `
            <div class="devolucion-group">
                <div class="devolucion-group-header">
                    <div class="devolucion-card-topbar">
                        <div class="devolucion-card-tags">
                            <span class="devolucion-badge-id">Devolución #${grupo.id || 'N/A'}${ventaIdDisplay}</span>
                            <span class="devolucion-badge-fecha">📅 ${fechaDevolucionFormateada}</span>
                        </div>
                        <div class="devolucion-card-top-right">
                            <span class="devolucion-badge-items">${grupo.totalItems} ${grupo.totalItems === 1 ? 'item devuelto' : 'items devueltos'}</span>
                            <span class="devolucion-header-icono">▼</span>
                        </div>
                    </div>

                    <div class="devolucion-card-client-section">
                        <div class="devolucion-cliente-title">
                            <span class="devolucion-cliente-avatar">👤</span>
                            <strong class="historial-cliente">${grupo.cliente_nombre || 'Cliente General'}</strong>
                        </div>
                        <div class="devolucion-client-chips">
                            ${grupo.cliente_cedula ? `<span class="dev-chip dev-chip-cedula"><strong>CI:</strong> ${grupo.cliente_cedula}</span>` : ''}
                            ${grupo.cliente_telefono ? `<span class="dev-chip dev-chip-telefono"><strong>Tlf:</strong> ${grupo.cliente_telefono}</span>` : ''}
                        </div>
                        ${tipoPagoHtml ? `<div class="devolucion-payment-chips">${tipoPagoHtml}</div>` : ''}
                    </div>

                    <div class="devolucion-card-totals-box">
                        <div class="dev-total-row">
                            <span class="dev-total-label">Total USD (BCV):</span>
                            <span class="dev-total-value dev-val-bcv-usd">${totalUsdBcvDisplay}</span>
                        </div>
                        <div class="dev-total-row">
                            <span class="dev-total-label">Total BS (BCV):</span>
                            <span class="dev-total-value dev-val-bcv-bs">${totalBsBcvDisplay}</span>
                        </div>
                        <div class="dev-total-row">
                            <span class="dev-total-label">Total USD (Efectivo):</span>
                            <span class="dev-total-value dev-val-efectivo">${totalUsdEfectivoDisplay}</span>
                        </div>
                    </div>
                </div>
                <div class="devolucion-group-content">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = historialHtml;

    // Añadir lógica para el acordeón
    container.querySelectorAll('.devolucion-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const group = header.closest('.devolucion-group');
            const isActive = group.classList.toggle('active');
            const content = group.querySelector('.devolucion-group-content');
            if (content) {
                if (isActive) {
                    // Se suma holgura suficiente para padding y elementos dinámicos
                    content.style.maxHeight = (content.scrollHeight + 150) + 'px';
                } else {
                    content.style.maxHeight = null;
                }
            }
        });
    });
}

function setProductModalMode(mode) {
    const form = document.getElementById('formProducto');
    const manualPriceFields = document.querySelectorAll('.manual-price-field');
    const calcContainer = document.getElementById('calculator-container');
    const btnManual = document.getElementById('btnModoManual');
    const btnCalc = document.getElementById('btnModoCalculadora');

    const isCalc = (mode === 'calculator' || mode === 'calculadora');

    if (isCalc) {
        if (form) form.dataset.mode = 'calculator';
        manualPriceFields.forEach(el => el.style.display = 'none');
        if (calcContainer) calcContainer.style.display = 'block';
        if (btnManual) btnManual.classList.remove('active');
        if (btnCalc) btnCalc.classList.add('active');

        // Recalcular inmediatamente si ya hay valores
        const precioProv = parseSafeFloat(document.getElementById('calcCostoUsdt')?.value, 0);
        if (precioProv > 0) {
            actualizarResultadosCalculadora();
        }
    } else { // default to manual
        if (form) form.dataset.mode = 'manual';
        manualPriceFields.forEach(el => el.style.display = 'flex');
        if (calcContainer) calcContainer.style.display = 'none';
        if (btnManual) btnManual.classList.add('active');
        if (btnCalc) btnCalc.classList.remove('active');
    }
}

function updatePaymentSummary() {
    // --- Determinar el total aplicable y la tasa activa (BCV o Efectivo/Paralelo) ---
    const activeMethodNames = [];
    document.querySelectorAll('#paymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
        const id = check.dataset.methodId;
        const amountInput = document.getElementById(`amount_${id}`);
        if (amountInput) {
            activeMethodNames.push(amountInput.dataset.methodName);
        }
    });

    const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
    const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
    const currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
    const totalDeVentaApplicable = useEfectivoTotal ? totalVentaEfectivo : totalVentaActual;

    let totalPagadoUsd = Array.from(document.querySelectorAll('.payment-amount-input'))
        .reduce((sum, input) => {
            const container = input.closest('.payment-method-input');
            // Solo sumar si el contenedor está visible (es decir, su checkbox está marcado)
            if (container && container.style.display !== 'none') {
                const val = parseFloat(input.value) || 0;
                if (input.dataset.currency === 'BS') {
                    // Convertir Bs a USD usando la tasa correspondiente (Paralelo si hay método efectivo activo, BCV si es solo Bs)
                    return sum + (currentRate > 0 ? (val / currentRate) : 0);
                }
                return sum + val; // Ya está en USD
            }
            return sum;
        }, 0);

    const faltante = totalDeVentaApplicable - totalPagadoUsd;

    // --- Etiquetas y totales en el modal ---
    const totalUsdLabel = document.getElementById('modalTotalUsdLabel');
    const totalUsdValue = document.getElementById('modalTotalUsd');
    const totalBsRow = document.getElementById('modalTotalBsRow');
    const totalBsLabel = document.getElementById('modalTotalBsLabel');
    const totalBsValue = document.getElementById('modalTotalBs');
    const totalEfectivoRow = document.getElementById('modalTotalEfectivoRow');

    if (useEfectivoTotal) {
        if (totalUsdLabel) totalUsdLabel.textContent = 'Total a Pagar $ (efectivo):';
        if (totalUsdValue) totalUsdValue.textContent = `$ ${formatCurrency(totalVentaEfectivo)}`;
        if (totalBsRow) totalBsRow.style.display = 'flex';
        if (totalBsLabel) totalBsLabel.textContent = 'Total a Pagar Bs (paralelo):';
        if (totalBsValue) totalBsValue.textContent = `Bs ${formatCurrency(totalVentaEfectivo * currentRate)}`;
        if (totalEfectivoRow) totalEfectivoRow.style.display = 'none';
    } else {
        if (totalUsdLabel) totalUsdLabel.textContent = 'Total a Pagar $ (bcv):';
        if (totalUsdValue) totalUsdValue.textContent = `$ ${formatCurrency(totalVentaActual)}`;
        if (totalBsRow) totalBsRow.style.display = 'flex';
        if (totalBsLabel) totalBsLabel.textContent = 'Total a Pagar bs (bcv):';
        if (totalBsValue) totalBsValue.textContent = `Bs ${formatCurrency(totalVentaActual * oficialRate)}`;
        if (totalEfectivoRow) totalEfectivoRow.style.display = 'flex';
    }

    const totalPagadoEl = document.getElementById('modalTotalPagado');
    if (totalPagadoEl) totalPagadoEl.textContent = `$ ${formatCurrency(totalPagadoUsd)}`;
    const faltanteEl = document.getElementById('modalFaltante');
    if (faltanteEl) faltanteEl.textContent = `$ ${formatCurrency(Math.abs(faltante))}`;
    const faltanteBsEl = document.getElementById('modalFaltanteBs');
    if (faltanteBsEl) faltanteBsEl.textContent = `Bs ${formatCurrency(Math.abs(faltante) * currentRate)}`;

    const faltanteLabel = document.getElementById('faltanteLabel');
    const btnConfirmar = document.getElementById('btnConfirmarVenta');
    const pagoPendiente = document.getElementById('pagoPendienteCheckbox')?.checked || false;

    // Resetear estilos
    if (faltanteLabel) faltanteLabel.style.color = 'var(--btn-red)';
    if (faltanteEl) faltanteEl.style.color = 'var(--btn-red)';
    if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-red)';

    if (!btnConfirmar) return;

    if (pagoPendiente) {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Guardar como Pendiente';
        if (faltanteLabel) {
            faltanteLabel.textContent = 'Crédito Pendiente';
            faltanteLabel.style.color = 'var(--btn-orange)';
        }
        if (faltanteEl) faltanteEl.style.color = 'var(--btn-orange)';
        if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-orange)';
    } else if (faltante < -0.01) { // Sobrante
        if (faltanteLabel) faltanteLabel.textContent = '¡Sobrante!';
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto excede el total';
    } else if (Math.abs(faltante) < 0.01) { // Completo
        if (faltanteLabel) {
            faltanteLabel.textContent = 'Completo';
            faltanteLabel.style.color = 'var(--btn-green)';
        }
        if (faltanteEl) faltanteEl.style.color = 'var(--btn-green)';
        if (faltanteBsEl) faltanteBsEl.style.color = 'var(--btn-green)';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Procesar Pago';
    } else { // Faltante
        if (faltanteLabel) faltanteLabel.textContent = 'Faltante';
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto no coincide';
    }
}
// --- INICIO: Lógica de Tema (Claro/Oscuro) ---
function aplicarTema(theme) {
    document.documentElement.dataset.theme = theme;
}

function guardarYAplicarTema(theme) {
    localStorage.setItem(THEME_KEY, theme);
    aplicarTema(theme);
}

async function proceedWithReset() {
    const btn = document.getElementById('btnReiniciarVentas');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Borrando...';

    try {
        // 1. Borrar todos los detalles de ventas
        const { error: detError } = await _supabase.from('detalle_ventas').delete().neq('id', -1);
        if (detError) throw new Error(`Error al borrar detalles de ventas: ${detError.message}`);

        // 2. Borrar todas las devoluciones
        const { error: devError } = await _supabase.from('devoluciones').delete().neq('id', -1);
        if (devError) throw new Error(`Error al borrar devoluciones: ${devError.message}`);

        // 3. Borrar todas las ventas
        const { error: venError } = await _supabase.from('ventas').delete().neq('id', -1);
        if (venError) throw new Error(`Error al borrar ventas: ${venError.message}`);

        // 4. Llamar a la función para reiniciar la secuencia del ID
        const { error: rpcError } = await _supabase.rpc('reset_ventas_id_sequence');
        if (rpcError) {
            throw new Error(`Error al reiniciar el contador de IDs: ${rpcError.message}. Asegúrate de que la función 'reset_ventas_id_sequence' exista en la base de datos.`);
        }

        showToast('¡Éxito! Todos los datos de ventas han sido borrados y los IDs se han reiniciado.', 'success', 5000);

        // Recargar vistas relevantes si están activas
        const vistaActiva = document.querySelector('.nav-btn.active').textContent.trim().toLowerCase();
        if (['ventas', 'reportes', 'devoluciones'].includes(vistaActiva)) {
            cargarVista(vistaActiva);
        }

    } catch (error) {
        console.error('Error al reiniciar las ventas:', error);
        showToast(error.message, 'error', 7000);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function handleReiniciarVentas() {
    const confirmed = await showToast(
        '¿Estás SEGURO de que quieres borrar TODAS las ventas, devoluciones y reiniciar los IDs? Esta acción es IRREVERSIBLE.',
        'confirm'
    );

    if (!confirmed) {
        showToast('Operación cancelada.', 'info');
        return;
    }

    const password = prompt("Para confirmar, ingresa la contraseña de seguridad:");

    if (password === null) {
        showToast('Operación cancelada.', 'info');
        return;
    }

    if (password === BORRAR_PASS) {
        await proceedWithReset();
    } else {
        showToast('Contraseña incorrecta. La operación ha sido cancelada.', 'error');
    }
}

function cargarAjustesTema() {
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        const currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
        themeSwitch.checked = currentTheme === 'light';
    }
}
// --- FIN: Lógica de Tema ---

// AJUSTES
function initVistaAjustes() {
    cargarAjustesTasa();
    cargarAjustesTema();

    // Evento para el toggle de Tema
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        themeSwitch.addEventListener('change', function () {
            const newTheme = this.checked ? 'light' : 'dark';
            guardarYAplicarTema(newTheme);
            // Si la vista de reportes está activa, la recargamos para actualizar los gráficos
            if (document.querySelector('.nav-btn.active').textContent.trim().toLowerCase() === 'reportes') {
                cargarVista('reportes');
            }
        });
    }

    // Evento para el toggle de Tasa Oficial
    document.getElementById('tasaOficialModo')?.addEventListener('change', function () {
        const container = document.getElementById('manualOficialRateContainer');
        if (container) container.style.display = this.checked ? 'block' : 'none';
    });
    // Evento para el toggle de Tasa Paralelo
    document.getElementById('tasaParaleloModo')?.addEventListener('change', function () {
        const container = document.getElementById('manualParaleloRateContainer');
        if (container) container.style.display = this.checked ? 'block' : 'none';
    });

    document.getElementById('guardarAjustesTasa')?.addEventListener('click', () => {
        const oficialModoEl = document.getElementById('tasaOficialModo');
        const oficialValEl = document.getElementById('manualOficialRate');
        const paraleloModoEl = document.getElementById('tasaParaleloModo');
        const paraleloValEl = document.getElementById('manualParaleloRate');

        const newSettings = {
            oficial: {
                mode: oficialModoEl?.checked ? 'manual' : 'automatico',
                value: parseFloat(oficialValEl?.value) || 0
            },
            paralelo: {
                mode: paraleloModoEl?.checked ? 'manual' : 'automatico',
                value: parseFloat(paraleloValEl?.value) || 0
            }
        };
        localStorage.setItem(TASA_SETTINGS_KEY, JSON.stringify(newSettings));
        tasaSettings = newSettings;
        showToast('Ajustes guardados.', 'success');
        obtenerTasas(); // Actualizar tasas inmediatamente
    });

    // --- INICIO: Lógica para reiniciar ventas ---
    const settingsCard = document.querySelector('.settings-card');
    if (settingsCard && !document.getElementById('btnReiniciarVentas')) {
        const dangerZoneHtml = `
            <div class="setting-item" style="border-top: 2px solid var(--btn-blue); padding-top: 20px; margin-top: 20px; background-color: rgba(37, 99, 235, 0.05);">
                <div class="setting-label">
                    <h4 style="color: var(--btn-blue);">Seguridad</h4>
                    <p>Esta acción borrará permanentemente todo el historial de ventas y devoluciones para reiniciar los IDs.</p>
                </div>
                <div class="setting-control">
                    <button id="btnReiniciarVentas" class="action-btn btn-blue">Reiniciar Base de Datos de Ventas</button>
                </div>
            </div>
        `;
        const settingsFooter = settingsCard.querySelector('.settings-footer');
        if (settingsFooter) {
            settingsFooter.insertAdjacentHTML('beforebegin', dangerZoneHtml);
        } else {
            settingsCard.innerHTML += dangerZoneHtml;
        }
        document.getElementById('btnReiniciarVentas')?.addEventListener('click', handleReiniciarVentas);
    }
    // --- FIN: Lógica para reiniciar ventas ---
}

function cargarAjustesTasa() {
    const guardado = localStorage.getItem(TASA_SETTINGS_KEY);
    if (guardado) {
        try {
            tasaSettings = JSON.parse(guardado);
        } catch (e) {
            console.error("Error al leer ajustes guardados:", e);
        }
    }

    // Configurar Tasa Oficial
    const ofModo = document.getElementById('tasaOficialModo');
    const ofVal = document.getElementById('manualOficialRate');
    const ofCont = document.getElementById('manualOficialRateContainer');
    if (ofModo) ofModo.checked = tasaSettings.oficial.mode === 'manual';
    if (ofVal) ofVal.value = tasaSettings.oficial.value;
    if (ofCont) ofCont.style.display = tasaSettings.oficial.mode === 'manual' ? 'block' : 'none';

    // Configurar Tasa Paralelo
    const parModo = document.getElementById('tasaParaleloModo');
    const parVal = document.getElementById('manualParaleloRate');
    const parCont = document.getElementById('manualParaleloRateContainer');
    if (parModo) parModo.checked = tasaSettings.paralelo.mode === 'manual';
    if (parVal) parVal.value = tasaSettings.paralelo.value;
    if (parCont) parCont.style.display = tasaSettings.paralelo.mode === 'manual' ? 'block' : 'none';
}

// --- LÓGICA DE MODALES GLOBALES Y EVENTOS ---

// Delegación de eventos para elementos cargados dinámicamente
document.addEventListener('click', (e) => {
    // Modales
    // --- INICIO: Delegación de eventos para seleccionar productos en Inventario ---
    const productCard = e.target.closest('.products-grid .product-card');
    if (productCard) {
        const vistaActiva = document.querySelector('.nav-btn.active')?.textContent.trim().toLowerCase();
        if (vistaActiva === 'inventario de productos') {
            if (modoEdicion) return;

            // Deseleccionar el anterior
            const selectedCard = document.querySelector('.product-card.selected');
            if (selectedCard) selectedCard.classList.remove('selected');

            // Seleccionar el nuevo
            productCard.classList.add('selected');
            const pCodigo = productCard.dataset.codigo;
            productoSeleccionado = productosCache.find(p => p.codigo === pCodigo);
        }
    }
    // --- FIN: Delegación de eventos para seleccionar productos en Inventario ---
    if (e.target.matches('[data-modal-target]')) {
        const modalId = e.target.dataset.modalTarget;
        const modal = document.getElementById(modalId);
        if (modal) {
            if (modalId === 'modalCategoria') initModalCategorias();
            if (modalId === 'modalProducto') initModalProducto();
            modal.classList.add('active');
        }
    }
    if (e.target.matches('[data-modal-close]')) {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
    }

    // Botones de la vista CAJA
    if (e.target.matches('#btnCajaLimpiar')) {
        showConfirmation('¿Estás seguro de que quieres limpiar la caja?', () => {
            productosParaLlevar = [];
            renderizarParaLlevar();
            showToast('Caja limpiada.', 'success');
        });
    }
    if (e.target.matches('#btnCajaVender')) {
        handleAbrirModalVenta();
    }

    // Botones de agregar al carrito
    if (e.target.matches('.caja-v-actions .btn-add')) {
        const codigo = e.target.dataset.codigo;
        if (codigo) agregarAParaLlevar(codigo);
    }
    // Botones de quitar del carrito
    if (e.target.matches('[data-codigo-quitar]')) {
        const codigo = e.target.dataset.codigoQuitar;
        if (codigo) quitarDeParaLlevar(codigo);
    }

    // --- INICIO: Lógica para el botón "FULL" en modales de pago ---
    if (e.target.matches('.btn-fill-remaining')) {
        const button = e.target;
        const modal = button.closest('.modal-overlay');
        if (!modal) return;

        const targetId = button.dataset.targetId;
        const targetInput = document.getElementById(`amount_${targetId}`);
        if (!targetInput) return;

        let totalAmount = 0;
        let inputSelector = '';
        let summaryUpdater = () => { };
        let currentRate = (oficialRate > 0 ? oficialRate : 1);

        if (modal.id === 'modalVenta') {
            const activeMethodNames = [];
            modal.querySelectorAll('.payment-method-selector input[type="checkbox"]:checked').forEach(check => {
                const id = check.dataset.methodId;
                const amountInput = document.getElementById(`amount_${id}`);
                if (amountInput) {
                    activeMethodNames.push(amountInput.dataset.methodName);
                }
            });

            const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
            const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
            currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
            totalAmount = useEfectivoTotal ? totalVentaEfectivo : totalVentaActual;
            inputSelector = '.payment-amount-input';
            summaryUpdater = updatePaymentSummary;
        } else if (modal.id === 'modalEditarVenta') {
            const totalBcvAmount = parseFloat(document.getElementById('editVentaTotalUsd').value) || 0;
            const totalEfectivoAmount = parseFloat(document.getElementById('editVentaTotalEfectivo')?.value) || 0;

            const activeMethodNames = [];
            modal.querySelectorAll('.payment-method-selector input[type="checkbox"]:checked').forEach(check => {
                const id = check.dataset.editMethodId;
                const amountInput = document.getElementById(`amount_${id}`);
                if (amountInput) {
                    activeMethodNames.push(amountInput.dataset.methodName);
                }
            });

            const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
            const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
            currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
            totalAmount = useEfectivoTotal ? (totalEfectivoAmount > 0 ? totalEfectivoAmount : totalBcvAmount) : totalBcvAmount;
            inputSelector = '.edit-payment-amount-input';
            summaryUpdater = updateEditPaymentSummary;
        } else if (modal.id === 'modalAbonoVenta') {
            const faltanteText = document.getElementById('abonoFaltante').textContent;
            totalAmount = parseFloat(faltanteText.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            inputSelector = '.abono-payment-amount-input';
            const ventaTotal = parseFloat(document.getElementById('abonoTotalVenta').textContent.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            const yaPagado = parseFloat(document.getElementById('abonoTotalPagado').textContent.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            const ventaTotalBs = parseFloat(document.getElementById('abonoTotalVentaBs').textContent.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            currentRate = (ventaTotal > 0 && ventaTotalBs > 0) ? (ventaTotalBs / ventaTotal) : ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1));
            summaryUpdater = () => updateAbonoSummary(ventaTotal, yaPagado);
        }

        if (totalAmount <= 0 || !inputSelector) return;

        let totalPaidByOthers = Array.from(modal.querySelectorAll(inputSelector))
            .filter(input => input.id !== targetInput.id)
            .reduce((sum, input) => {
                const container = input.closest('.payment-method-input');
                if (container && container.style.display !== 'none') {
                    const val = parseFloat(input.value) || 0;
                    if (input.dataset.currency === 'BS' && currentRate > 0) {
                        return sum + (val / currentRate);
                    }
                    return sum + val;
                }
                return sum;
            }, 0);

        totalPaidByOthers = parseFloat(totalPaidByOthers.toFixed(2));
        const remainingAmountUsd = parseFloat((totalAmount - totalPaidByOthers).toFixed(2));

        if (remainingAmountUsd >= 0) {
            if (targetInput.dataset.currency === 'BS' && currentRate > 0) {
                targetInput.value = (remainingAmountUsd * currentRate).toFixed(2);
            } else {
                targetInput.value = remainingAmountUsd.toFixed(2);
            }
            summaryUpdater();
        }
    }
    // --- FIN: Lógica para el botón "FULL" en modales de pago ---
    // Boton de generar PDF en la vista de ventas
    if (e.target.matches('.btn-pdf')) { // Manejar la generación de PDF de forma asíncrona
        handlePdfButtonClick(e.target);
    }

    // Botones de cantidad (+/-) en la vista de Caja
    if (e.target.matches('.quantity-btn[data-codigo]')) {
        const codigo = e.target.dataset.codigo;
        const input = document.getElementById(`cant_${codigo}`);
        if (!input) return;

        let currentValue = parseInt(input.value, 10);
        const max = parseInt(input.max, 10);

        if (e.target.classList.contains('plus') && currentValue < max) {
            input.value = currentValue + 1;
        } else if (e.target.classList.contains('minus') && currentValue > 1) {
            input.value = currentValue - 1;
        }
    }

    // Botones de cantidad (+/-) en la vista de Productos Cargados
    if (e.target.matches('.quantity-btn[data-codigo-llevar-control]')) {
        const codigo = e.target.dataset.codigoLlevarControl;
        const input = e.target.parentElement.querySelector(`input[data-codigo-llevar="${codigo}"]`);
        if (!input) return;

        let currentValue = parseInt(input.value, 10);
        const item = productosParaLlevar.find(p => p.codigo === codigo);
        if (!item) return;

        const max = item.esAdicional ? 9999 : item.cantidad;

        if (e.target.classList.contains('plus')) {
            if (currentValue < max) {
                const newValue = currentValue + 1;
                input.value = newValue;
                actualizarCantidadLlevar(codigo, newValue);
            }
        } else if (e.target.classList.contains('minus')) {
            if (currentValue > 1) {
                const newValue = currentValue - 1;
                input.value = newValue;
                actualizarCantidadLlevar(codigo, newValue);
            }
        }
    }

    // Botón para ver detalles de una venta (YA NO PIDE CONTRASEÑA)
    if (e.target.matches('.btn-ver-detalles-venta')) {
        const ventaId = e.target.dataset.ventaId;
        if (ventaId) handleAbrirModalDetallesVenta(ventaId);
    }

    // Botones de acción en la vista de devoluciones (requieren contraseña)
    if (e.target.id === 'btnRegistrarDevolucion') {
        pendingAction = 'registrar_devolucion';
        pendingActionId = e.target.dataset.ventaId;
        document.getElementById('modalPasswordVenta').classList.add('active');
        document.getElementById('adminPassword').focus();
    }

    // Botón para editar una venta (abre modal de contraseña)
    if (e.target.matches('.btn-edit-venta')) {
        const ventaId = e.target.dataset.ventaId;
        if (ventaId) {
            pendingAction = 'edit';
            pendingActionId = ventaId;
            const modal = document.getElementById('modalPasswordVenta');
            if (modal) {
                modal.classList.add('active');
                document.getElementById('adminPassword').focus();
            }
        }
    }

    // Botón para registrar un abono a una venta (AHORA PIDE CONTRASEÑA)
    if (e.target.matches('.btn-abonar-venta')) {
        const ventaId = e.target.dataset.ventaId;
        if (ventaId) {
            pendingAction = 'abonar'; // Nueva acción pendiente
            pendingActionId = ventaId;
            const modal = document.getElementById('modalPasswordVenta');
            if (modal) {
                modal.classList.add('active');
                document.getElementById('adminPassword').focus();
            }
        }
    }

    // Botón para ver detalles de una venta (YA NO PIDE CONTRASEÑA)
    if (e.target.matches('.btn-ver-detalles-venta')) {
        const ventaId = e.target.dataset.ventaId;
        if (ventaId) {
            handleAbrirModalDetallesVenta(ventaId);
        }
    }

    // Botón para eliminar una venta (abre modal de contraseña)
    if (e.target.matches('.btn-delete-venta')) {
        const ventaId = e.target.dataset.ventaId;
        if (ventaId) {
            pendingAction = 'delete';
            pendingActionId = ventaId;
            const modal = document.getElementById('modalPasswordVenta');
            if (modal) {
                modal.classList.add('active');
                document.getElementById('adminPassword').focus();
            }
        }
    }

    // Toggle para modos de carga de producto
    if (e.target.closest('#btnModoManual')) {
        setProductModalMode('manual');
    } else if (e.target.closest('#btnModoCalculadora')) {
        setProductModalMode('calculator');
        actualizarResultadosCalculadora();
    }

    // Botón para calcular precios en el modal de nuevo producto
    if (e.target.closest('#btnCalcularPrecios')) {
        setProductModalMode('calculator');
        const calculados = actualizarResultadosCalculadora();
        if (!calculados) {
            showToast('Ingresa un precio de proveedor válido mayor a 0.', 'error');
            return;
        }
        showToast('Precios calculados y aplicados.', 'success');
    }
});

document.addEventListener('change', (e) => {
    if (e.target.matches('[data-codigo-llevar]')) {
        const codigo = e.target.dataset.codigoLlevar;
        actualizarCantidadLlevar(codigo, e.target.value);
    }

    // Checkbox de método de pago
    if (e.target.matches('[data-method-id]')) {
        const id = e.target.dataset.methodId;
        const inputContainer = document.getElementById(`input_container_${id}`);
        const amountInput = document.getElementById(`amount_${id}`);
        inputContainer.style.display = e.target.checked ? 'flex' : 'none';
        if (!e.target.checked) amountInput.value = '';
        updatePaymentSummary();
    }

    if (e.target.matches('#pagoPendienteCheckbox')) {
        updatePaymentSummary();
    }
});

/**
 * Maneja el clic en el botón de PDF para generar una factura.
 * Proporciona feedback visual y manejo de errores.
 * @param {HTMLElement} btn El botón de PDF que fue clickeado.
 */
async function handlePdfButtonClick(btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando...';

    const ventaId = btn.dataset.ventaId;
    const venta = ventasCache.find(v => v.id == ventaId);
    if (!venta) {
        showToast('No se encontró la venta para generar el PDF.', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }

    const tasaFinal = (paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : (tasaSettings.paralelo.value || 1));
    try {
        await generarFacturaPDF(venta, tasaFinal, productosCache);
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        showToast('Error al generar el PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Modal de Venta
async function handleAbrirModalVenta() {
    if (productosParaLlevar.length === 0) {
        showToast('La caja está vacía.', 'error');
        return;
    }
    await obtenerTasas();

    totalVentaActual = productosParaLlevar.reduce((acc, item) => acc + (item.precio_venta_dolares_bcv * item.cantidadLlevar), 0);
    const totalBs = totalVentaActual * oficialRate;
    totalVentaEfectivo = productosParaLlevar.reduce((acc, item) => acc + (item.venta_$_efectivo * item.cantidadLlevar), 0);
    // Definir qué métodos de pago son en Bolívares y cuáles en Dólares
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];

    const paymentContainer = document.getElementById('paymentMethodsContainer');
    if (paymentContainer) {
        paymentContainer.innerHTML = METODOS_DE_PAGO.map(metodo => {
            const id = metodo.toLowerCase().replace(/ /g, '_').replace('ó', 'o');
            const isBsMethod = metodosEnBolivares.includes(metodo);
            const currencyLabel = isBsMethod ? 'Bs' : '$';
            const inputStep = isBsMethod ? '0.01' : '0.01'; // Ambos pueden tener decimales

            return `
                <div class="payment-method-row">
                    <div class="payment-method-selector">
                        <input type="checkbox" id="check_${id}" data-method-id="${id}">
                        <label for="check_${id}">${metodo} (${currencyLabel})</label>
                    </div>
                    <div class="payment-method-input" id="input_container_${id}" style="display: none;">
                        <input type="number" class="payment-amount-input" step="${inputStep}" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
                        <button type="button" class="action-btn btn-blue btn-fill-remaining" data-target-id="${id}">FULL</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Resetear la visibilidad y etiquetas de los totales al abrir el modal.
    const lblUsd = document.getElementById('modalTotalUsdLabel');
    if (lblUsd) lblUsd.textContent = 'Total a Pagar $ (bcv):';
    const rowUsd = document.getElementById('modalTotalUsdRow');
    if (rowUsd) rowUsd.style.display = 'flex';
    const rowBs = document.getElementById('modalTotalBsRow');
    if (rowBs) rowBs.style.display = 'flex';
    const rowEf = document.getElementById('modalTotalEfectivoRow');
    if (rowEf) rowEf.style.display = 'flex';

    const formCliente = document.getElementById('formDatosCliente');
    if (formCliente) formCliente.reset();
    document.querySelectorAll('.payment-amount-input').forEach(input => input.value = '');
    document.querySelectorAll('.payment-method-selector input[type="checkbox"]').forEach(check => check.checked = false);
    document.querySelectorAll('.payment-method-input').forEach(container => container.style.display = 'none');

    const totalUsd = totalVentaActual;
    const modalUsd = document.getElementById('modalTotalUsd');
    if (modalUsd) modalUsd.textContent = `$ ${formatCurrency(totalUsd)}`;
    const modalBs = document.getElementById('modalTotalBs');
    if (modalBs) modalBs.textContent = `Bs ${formatCurrency(totalBs)}`;
    const modalDol = document.getElementById('modalTotal$');
    if (modalDol) modalDol.textContent = `$ ${formatCurrency(totalVentaEfectivo)}`;
    const lblTasa = document.getElementById('lblTasaBcvBase');
    if (lblTasa) lblTasa.textContent = formatCurrency(oficialRate);
    const lblTasaPar = document.getElementById('lblTasaParaleloBase');
    if (lblTasaPar) lblTasaPar.textContent = formatCurrency(paraleloRate);

    const modal = document.getElementById('modalVenta');
    if (!modal) return;
    const footer = modal.querySelector('.modal-footer, .modal-buttons');

    // Contenedor para acciones del lado izquierdo del footer del modal
    let leftActionsContainer = footer.querySelector('.modal-left-actions');
    if (!leftActionsContainer) {
        leftActionsContainer = document.createElement('div');
        leftActionsContainer.className = 'modal-left-actions';
        leftActionsContainer.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin-right: auto;';
        footer.insertBefore(leftActionsContainer, footer.firstChild);
    }

    // Checkbox para "Emitir Factura"
    if (!leftActionsContainer.querySelector('#emitirFacturaContainer')) {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.id = 'emitirFacturaContainer';
        checkboxContainer.className = 'checkbox-action-container';
        checkboxContainer.innerHTML = `
            <input type="checkbox" id="emitirFacturaCheckbox">
            <label for="emitirFacturaCheckbox" style="font-weight: 600; cursor: pointer; user-select: none;">Emitir factura</label>
        `;
        leftActionsContainer.appendChild(checkboxContainer);
    }

    // Checkbox para "Pago Pendiente"
    if (!leftActionsContainer.querySelector('#pagoPendienteContainer')) {
        const pendienteContainer = document.createElement('div');
        pendienteContainer.id = 'pagoPendienteContainer';
        pendienteContainer.className = 'checkbox-action-container';
        pendienteContainer.innerHTML = `
            <input type="checkbox" id="pagoPendienteCheckbox" class="pago-pendiente-check">
            <label for="pagoPendienteCheckbox" style="font-weight: 600; cursor: pointer; user-select: none; color: var(--btn-orange);">Pago pendiente (crédito)</label>
        `;
        leftActionsContainer.appendChild(pendienteContainer);
    }

    const chkFactura = document.getElementById('emitirFacturaCheckbox');
    if (chkFactura) chkFactura.checked = false;
    const chkPendiente = document.getElementById('pagoPendienteCheckbox');
    if (chkPendiente) chkPendiente.checked = false;

    // Añadir listener de input para recalcular en el modal
    const modalBody = modal.querySelector('.modal-body');
    modalBody.removeEventListener('input', updatePaymentSummary); // Evitar duplicados
    modalBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('payment-amount-input')) updatePaymentSummary();
    });

    updatePaymentSummary();
    modal.classList.add('active');
}

document.getElementById('formDatosCliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('cliNombre').value.trim();
    const tipoCedula = document.getElementById('cliTipoCedula').value;
    const numeroCedula = document.getElementById('cliCedula').value.trim();
    const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;

    const codTelefono = document.getElementById('cliCodTelefono')?.value || '0414';
    const numTelefono = document.getElementById('cliTelefono')?.value.trim() || '';
    const telefono = numTelefono ? `${codTelefono}${numTelefono}` : '';
    const direccion = document.getElementById('cliDireccion').value.trim();

    if (numeroCedula.length > 10) { showToast('La cédula no puede exceder los 10 dígitos.', 'error'); return; }
    if (numTelefono && numTelefono.length > 7) { showToast('El teléfono no puede exceder los 7 dígitos tras el código.', 'error'); return; }

    const activeMethodNames = [];
    document.querySelectorAll('#paymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
        const id = check.dataset.methodId;
        const amountInput = document.getElementById(`amount_${id}`);
        if (amountInput) {
            activeMethodNames.push(amountInput.dataset.methodName);
        }
    });

    const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
    const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
    const currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
    const totalDeVentaApplicable = useEfectivoTotal ? totalVentaEfectivo : totalVentaActual;

    const pagos = [];
    document.querySelectorAll('.payment-method-selector input[type="checkbox"]:checked').forEach(check => {
        const id = check.dataset.methodId;
        const amountInput = document.getElementById(`amount_${id}`); // Input de monto
        const inputCurrency = amountInput.dataset.currency; // 'USD' o 'BS'
        let amount = parseFloat(amountInput.value) || 0;
        let amountInUsd = amount;

        if (inputCurrency === 'BS') {
            amountInUsd = currentRate > 0 ? (amount / currentRate) : 0; // Convertir Bs a USD con la tasa activa
        }

        if (amountInUsd > 0) {
            pagos.push({
                metodo: amountInput.dataset.methodName,
                monto: amountInUsd, // Monto equivalente en USD
                monto_original: amount, // Monto exacto ingresado en moneda original (ej. 5000 en Bs o 15 en USD)
                moneda: inputCurrency // 'BS' o 'USD'
            });
        }
    });

    if (pagos.length === 0) {
        showToast('Debes agregar al menos un método de pago con un monto.', 'error');
        return;
    }

    const tipoPago = JSON.stringify(pagos);

    const btnSubmit = document.getElementById('btnConfirmarVenta');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando...';

    try {
        const emitirFactura = document.getElementById('emitirFacturaCheckbox')?.checked || false;
        const pagoPendiente = document.getElementById('pagoPendienteCheckbox')?.checked || false;

        const totalPagadoValidacion = pagos.reduce((sum, p) => sum + p.monto, 0);

        // Solo validar la coincidencia de pago si NO es un pago pendiente
        if (!pagoPendiente && Math.abs(totalDeVentaApplicable - totalPagadoValidacion) > 0.01) {
            showToast('El total pagado no coincide con el total de la venta. Revisa los montos.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Procesar Pago';
            return;
        }

        const totalUsd = totalDeVentaApplicable; // Usar el total aplicable (BCV o Efectivo)
        const totalBs = totalUsd * currentRate; // El total en BS se basa en la tasa aplicable

        const ventaInsertData = { cliente_nombre: nombre, cliente_cedula: cedulaCompleta, cliente_telefono: telefono, cliente_direccion: direccion, tipo_pago: tipoPago, total_usd: totalUsd, total_bs: totalBs, estado_pago: pagoPendiente ? 'pendiente' : 'pagado' };

        const { data: ventaData, error: ventaError } = await _supabase
            .from('ventas')
            .insert([ventaInsertData])
            .select()
            .single();
        if (ventaError) throw ventaError;
        const ventaId = ventaData.id;

        for (const item of productosParaLlevar) {
            // CORRECCIÓN: Guardar el precio_unitario correcto y un tipo de precio consistente
            let priceToStoreInDetails;
            if (useEfectivoTotal) {
                priceToStoreInDetails = item.venta_$_efectivo;
            } else {
                priceToStoreInDetails = item.precio_venta_dolares_bcv;
            }

            const { error: detalleError } = await _supabase.from('detalle_ventas').insert([{ venta_id: ventaId, producto_codigo: item.codigo, producto_nombre: item.nombre, cantidad: item.cantidadLlevar, precio_unitario: priceToStoreInDetails, tipo_precio_usado: useEfectivoTotal ? 'EFECTIVO' : 'BCV' }]);
            if (detalleError) throw detalleError;
            if (!item.esAdicional) {
                const nuevoStock = item.cantidad - item.cantidadLlevar;
                await _supabase.from('productos').update({ cantidad: nuevoStock }).eq('codigo', item.codigo);
            }
        }

        // Actualizar el caché de productos localmente para reflejar el nuevo stock
        productosParaLlevar.forEach(itemVendido => {
            if (!itemVendido.esAdicional) {
                const productoEnCache = productosCache.find(p => p.codigo === itemVendido.codigo);
                if (productoEnCache) {
                    productoEnCache.cantidad -= itemVendido.cantidadLlevar;
                }
            }
        });

        if (emitirFactura) {
            const ventaCompleta = {
                ...ventaData,
                detalles: productosParaLlevar.map(item => ({
                    producto_codigo: item.codigo,
                    producto_nombre: item.nombre,
                    cantidad: item.cantidadLlevar,
                    // CORRECCIÓN: Pasar el precio_unitario correcto al PDF
                    precio_unitario: priceToStoreInDetails, // Pass the stored price
                }))
            };
            await generarFacturaPDF(ventaCompleta, paraleloRate, productosCache);
        }

        showToast('¡Venta registrada con éxito!', 'success');
        document.getElementById('modalVenta').classList.remove('active');
        document.getElementById('formDatosCliente').reset();
        productosParaLlevar = [];
        renderizarParaLlevar();
        socket.emit('cambio-dato', { type: 'products' });
        socket.emit('cambio-dato', { type: 'ventas' });

        // Refrescar la vista actual de forma inteligente
        const vistaActiva = document.querySelector('.nav-btn.active').textContent.trim().toLowerCase();
        if (vistaActiva === 'caja') {
            renderCajaProductos(productosCache); // Re-renderiza solo la lista de productos disponibles
        } else if (vistaActiva === 'inventario de productos') {
            loadProducts(); // Recarga los productos en la vista de inventario
        }

    } catch (error) {
        console.error(error);
        showToast("Error al registrar venta: " + error.message, 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Procesar Pago';
    }
});

// Modal Categorías
async function initModalCategorias() {
    await cargarCategorias();
    const modal = document.getElementById('modalCategoria');

    // Evitar agregar listeners múltiples veces
    if (modal.dataset.listenersAttached) {
        return;
    }
    modal.dataset.listenersAttached = 'true';

    document.getElementById('catBuscar').addEventListener('input', (e) => renderizarListaCategorias(e.target.value));

    document.getElementById('btnAgregarCat').addEventListener('click', async () => {
        const nombre = document.getElementById('catNombre').value.trim();
        if (!nombre) {
            showToast('El nombre de la categoría no puede estar vacío.', 'error');
            return;
        }
        await _supabase.from('categorias').insert([{ nombre }]);
        document.getElementById('catNombre').value = '';
        cargarCategorias();
        socket.emit('cambio-dato', { type: 'categories' });
        showToast('Categoría agregada.', 'success');
    });

    document.getElementById('btnEditarCat').addEventListener('click', async () => {
        const catId = document.getElementById('catId').value;
        const nuevoNombre = document.getElementById('catNombre').value.trim();

        if (!catId) {
            showToast('Selecciona una categoría para editar.', 'error');
            return;
        }
        if (!nuevoNombre) {
            showToast('El nombre de la categoría no puede estar vacío.', 'error');
            return;
        }

        const categoriaAntigua = categoriasCache.find(c => c.id == catId);
        if (!categoriaAntigua) {
            showToast('Categoría no encontrada en caché.', 'error');
            return;
        }

        showConfirmation(`¿Confirmas el cambio de nombre a "${nuevoNombre}"?`, async () => {
            const { error } = await _supabase.from('categorias').update({ nombre: nuevoNombre }).eq('id', catId);
            if (error) {
                showToast(`Error al editar: ${error.message}`, 'error');
                return;
            }

            // Actualizar la categoría en los productos que la usan
            const { error: updateProdError } = await _supabase.from('productos').update({ categoria: nuevoNombre }).eq('categoria', categoriaAntigua.nombre);
            if (updateProdError) {
                console.error('Error al actualizar productos con la nueva categoría:', updateProdError);
                showToast(`Categoría actualizada, pero hubo un error al actualizar productos asociados: ${updateProdError.message}`, 'warning');
            }

            document.getElementById('catNombre').value = '';
            document.getElementById('catId').value = '';
            categoriaSeleccionadaId = null;
            cargarCategorias();
            socket.emit('cambio-dato', { type: 'categories' });
            socket.emit('cambio-dato', { type: 'products' }); // Emitir también un cambio en productos
            showToast('Categoría actualizada.', 'success');
        });
    });

    document.getElementById('btnEliminarCat').addEventListener('click', async () => {
        const catId = document.getElementById('catId').value;
        if (!catId) {
            showToast('Selecciona una categoría para eliminar.', 'error');
            return;
        }
        const categoriaSeleccionada = categoriasCache.find(c => c.id == catId);
        if (!categoriaSeleccionada) return;

        showConfirmation(`¿Eliminar la categoría "${categoriaSeleccionada.nombre}"?`, async () => {
            const { error } = await _supabase.from('categorias').delete().eq('id', catId);
            if (error) {
                showToast(`Error al eliminar: ${error.message}`, 'error');
                return;
            }
            document.getElementById('catNombre').value = '';
            document.getElementById('catId').value = '';
            categoriaSeleccionadaId = null;
            cargarCategorias();
            socket.emit('cambio-dato', { type: 'categories' });
            showToast('Categoría eliminada.', 'success');
        });
    });
}
async function cargarCategorias(filtro = '') {
    const { data } = await _supabase.from('categorias').select('*');
    if (data) {
        categoriasCache = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
        renderizarListaCategorias(filtro);
    }
}

function renderizarListaCategorias(filtro = '') {
    const lista = document.getElementById('listaCategorias');
    if (!lista) return;
    lista.innerHTML = '';
    const categoriasFiltradas = categoriasCache.filter(c => c.nombre.toLowerCase().includes(filtro.toLowerCase()));

    if (categoriasFiltradas.length === 0) {
        lista.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 10px;">No hay categorías para mostrar.</li>';
        return;
    }

    categoriasFiltradas.forEach(c => {
        const li = document.createElement('li');
        li.className = `cat-item ${categoriaSeleccionadaId === c.id ? 'selected' : ''}`;
        li.textContent = c.nombre;
        li.onclick = () => {
            document.querySelectorAll('#listaCategorias .cat-item').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            categoriaSeleccionadaId = c.id;
            document.getElementById('catNombre').value = c.nombre;
            document.getElementById('catId').value = c.id;
        };
        lista.appendChild(li);
    });
}

// --- INICIO: Funciones para Gestionar Marcas ---
async function initModalMarcas() {
    await cargarMarcas();
    const modal = document.getElementById('modalMarca');

    if (modal.dataset.listenersAttached) return;
    modal.dataset.listenersAttached = 'true';

    // Añadir listeners de cierre específicos para este modal dinámico
    modal.addEventListener('click', (e) => {
        if (e.target.matches('#modalMarca')) { // Si se hace clic en el overlay
            modal.classList.remove('active');
        }
    });
    document.getElementById('closeModalMarcaBtn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('marcaBuscar').addEventListener('input', (e) => renderizarListaMarcas(e.target.value));

    document.getElementById('btnAgregarMarca').addEventListener('click', async () => {
        const nombre = document.getElementById('marcaNombre').value.trim();
        if (!nombre) {
            showToast('El nombre de la marca no puede estar vacío.', 'error');
            return;
        }
        // Verificar si la marca ya existe en el caché
        if (marcasCache.some(m => m.nombre.toLowerCase() === nombre.toLowerCase())) {
            showToast('Esa marca ya existe.', 'error');
            return;
        }

        // Persistir la marca en localStorage (usamos la tabla 'productos' como fuente primaria)
        try {
            const localKey = 'marcas_local_v1';
            const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
            const newLocal = { id: 'local-' + Date.now(), nombre };
            stored.push(newLocal);
            localStorage.setItem(localKey, JSON.stringify(stored));
            marcasCache.push(newLocal);
        } catch (err) {
            console.warn('Error al guardar marca en localStorage:', err);
            marcasCache.push({ id: 'local-' + Date.now(), nombre });
        }

        marcasCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
        document.getElementById('marcaNombre').value = '';

        // Actualizar la UI de la lista de gestión
        renderizarListaMarcas();

        // Actualizar el <select> en el modal de producto directamente desde el caché actualizado
        const select = document.getElementById('prodMarca');
        if (select) {
            const previouslySelectedValue = select.value;
            select.innerHTML = '<option value="">-- Sin Marca --</option>';
            marcasCache.forEach(brand => select.add(new Option(brand.nombre, brand.nombre)));
            select.value = previouslySelectedValue;
        }

        socket.emit('cambio-dato', { type: 'brands' });
        showToast('Marca agregada.', 'success');
    });

    document.getElementById('btnEditarMarca').addEventListener('click', async () => {
        const nombreAntiguo = document.getElementById('marcaId').value; // Puede ser id o nombre
        const nuevoNombre = document.getElementById('marcaNombre').value.trim();

        if (!nombreAntiguo) {
            showToast('Selecciona una marca para editar.', 'error');
            return;
        }
        if (!nuevoNombre || nuevoNombre === nombreAntiguo) {
            showToast('Ingresa un nombre nuevo y diferente.', 'error');
            return;
        }

        showConfirmation(`¿Cambiar la marca "${nombreAntiguo}" a "${nuevoNombre}" en todos los productos?`, async () => {
            // Actualizar la marca en todos los productos que la usan
            const { error: prodError } = await _supabase
                .from('productos')
                .update({ marca: nuevoNombre })
                .eq('marca', nombreAntiguo);

            if (prodError) {
                showToast(`Error al actualizar productos: ${prodError.message}`, 'error');
                return;
            }

            // Actualizar marcas guardadas en localStorage (si las hay)
            try {
                const localKey = 'marcas_local_v1';
                const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
                const idx = stored.findIndex(s => s.nombre === nombreAntiguo || String(s.id) === String(nombreAntiguo));
                if (idx !== -1) {
                    stored[idx].nombre = nuevoNombre;
                    localStorage.setItem(localKey, JSON.stringify(stored));
                }
            } catch (e) {
                console.warn('No se pudo actualizar marca en localStorage:', e);
            }

            // Actualizar el caché localmente
            const oldBrandIndex = marcasCache.findIndex(m => m.nombre.toLowerCase() === nombreAntiguo.toLowerCase());
            if (oldBrandIndex !== -1) {
                const newNameExists = marcasCache.some(m => m.nombre.toLowerCase() === nuevoNombre.toLowerCase() && m.nombre.toLowerCase() !== nombreAntiguo.toLowerCase());
                if (newNameExists) {
                    marcasCache.splice(oldBrandIndex, 1);
                } else {
                    marcasCache[oldBrandIndex].nombre = nuevoNombre;
                }
            }

            marcasCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
            document.getElementById('marcaNombre').value = '';
            document.getElementById('marcaId').value = '';
            marcaSeleccionadaId = null;

            // Actualizar las UIs desde el caché modificado
            renderizarListaMarcas();
            const select = document.getElementById('prodMarca');
            if (select) {
                const previouslySelectedValue = select.value === nombreAntiguo ? nuevoNombre : select.value;
                select.innerHTML = '<option value="">-- Sin Marca --</option>';
                marcasCache.forEach(brand => select.add(new Option(brand.nombre, brand.nombre)));
                select.value = previouslySelectedValue;
            }

            socket.emit('cambio-dato', { type: 'brands' });
            showToast('Marca actualizada.', 'success');
        });
    });

    document.getElementById('btnEliminarMarca').addEventListener('click', async () => {
        const marcaIdOrName = document.getElementById('marcaId').value; // Puede ser id o nombre
        if (!marcaIdOrName) {
            showToast('Selecciona una marca para eliminar.', 'error');
            return;
        }

        showConfirmation(`¿Eliminar la marca "${marcaIdOrName}"? Los productos asociados quedarán sin marca.`, async () => {
            // Actualizar los productos para quitarles la marca
            const { error: prodError } = await _supabase
                .from('productos')
                .update({ marca: '' }) // O null, dependiendo del diseño de la DB
                .eq('marca', marcaIdOrName);

            if (prodError) {
                showToast(`Error al eliminar marca de los productos: ${prodError.message}`, 'error');
                return;
            }

            // Eliminar de localStorage (si existe) y del caché
            try {
                const localKey = 'marcas_local_v1';
                const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
                const filtered = stored.filter(s => !(s.nombre === marcaIdOrName || String(s.id) === String(marcaIdOrName)));
                localStorage.setItem(localKey, JSON.stringify(filtered));
            } catch (e) {
                console.warn('No se pudo actualizar localStorage al eliminar marca:', e);
            }
            marcasCache = marcasCache.filter(m => !(m.nombre === marcaIdOrName || String(m.id) === String(marcaIdOrName)));
            renderizarListaMarcas();
            const select = document.getElementById('prodMarca');
            if (select) {
                const prev = select.value;
                select.innerHTML = '<option value="">-- Sin Marca --</option>';
                marcasCache.forEach(brand => select.add(new Option(brand.nombre, brand.nombre)));
                select.value = prev;
            }

            document.getElementById('marcaNombre').value = '';
            document.getElementById('marcaId').value = '';
            marcaSeleccionadaId = null;
            await loadExistingBrands();
            socket.emit('cambio-dato', { type: 'brands' });
            showToast('Marca eliminada.', 'success');
        });
    });
}
// --- FIN: Funciones para Gestionar Marcas ---

/**
 * Transforma el select de marca en un input con datalist y añade el botón "Gestionar".
 */
async function setupProductModal() {
    const prodMarcaSelect = document.getElementById('prodMarca');
    if (!prodMarcaSelect) return;

    const marcaFieldGroup = prodMarcaSelect.closest('.field-group');
    if (!marcaFieldGroup) return;

    // Si el wrapper con el botón ya existe, no hacer nada.
    if (marcaFieldGroup.querySelector('.field-group-horizontal')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'field-group-horizontal';

    // Mover el select existente dentro del wrapper para preservar listeners
    prodMarcaSelect.parentNode.insertBefore(wrapper, prodMarcaSelect);
    wrapper.appendChild(prodMarcaSelect);

    const gestionarBtn = document.createElement('button');
    gestionarBtn.id = 'btnGestionarMarcas';
    gestionarBtn.type = 'button';
    gestionarBtn.className = 'action-btn btn-blue';
    gestionarBtn.textContent = 'Gestionar';
    gestionarBtn.onclick = () => { initModalMarcas(); document.getElementById('modalMarca').classList.add('active'); };

    wrapper.appendChild(gestionarBtn);
}

// Modal Producto
async function initModalProducto() {
    // Preparar la estructura del modal (botón "Gestionar") antes de cargar opciones
    await setupProductModal();
    // Cargar ambas listas desplegables en paralelo para mayor rapidez
    await Promise.all([actualizarSelectProductos(), loadExistingBrands()]);

    const form = document.getElementById('formProducto');

    form.closest('.modal').querySelector('h3').textContent = 'Cargar Nuevo Producto';

    // Resetear el campo de marca y el input para nueva marca (solo para nuevo producto)
    document.getElementById('prodMarca').value = ''; // Resetear la selección de marca

    document.getElementById('prodEditCodigo').value = ''; // Limpiar el código de edición
    document.getElementById('prodCodigo').readOnly = false; // Allow editing code for new products

    // --- INICIO: Lógica de cantidad para NUEVO producto ---
    const cantidadContainer = document.getElementById('prodCantidadContainer');
    cantidadContainer.style.gridTemplateColumns = '1fr'; // Mostrar una sola columna

    document.getElementById('cantidadActualGroup').style.display = 'none';

    const cantidadIngresarGroup = document.getElementById('cantidadIngresarGroup');
    cantidadIngresarGroup.style.display = 'block';
    document.getElementById('labelCantidadIngresar').textContent = 'Cantidad a Ingresar';
    // --- FIN: Lógica de cantidad para NUEVO producto ---

    if (form) {
        setProductModalMode('manual');
        form.reset(); // Limpiar el formulario
        const calcCosto = document.getElementById('calcCostoUsdt');
        const calcDesc = document.getElementById('calcDescuento');
        const calcGan = document.getElementById('calcGanancia');
        if (calcCosto) calcCosto.value = '';
        if (calcDesc) calcDesc.value = '';
        if (calcGan) calcGan.value = '';
        const calcRes = document.getElementById('calculator-results');
        if (calcRes) calcRes.style.display = 'none';
    }
}

/**
 * Carga las marcas directamente desde la tabla de productos.
 * @param {string} filtro - Texto para filtrar la lista renderizada.
 */
async function cargarMarcas(filtro = '') {
    try {
        // Obtener marcas únicas desde la tabla de productos
        const { data, error } = await _supabase
            .from('productos')
            .select('marca');

        if (error) {
            throw new Error(`Error al leer marcas de productos: ${error.message}`);
        }

        const marcasUnicas = [...new Set((data || []).map(p => p.marca).filter(m => m && m.trim() !== ''))];
        marcasCache = marcasUnicas.sort((a, b) => a.localeCompare(b)).map(nombre => ({ id: nombre, nombre: nombre }));

        // Merge marcas guardadas en localStorage
        try {
            const localKey = 'marcas_local_v1';
            const localStored = JSON.parse(localStorage.getItem(localKey) || '[]');
            if (Array.isArray(localStored) && localStored.length > 0) {
                localStored.forEach(ls => {
                    if (!marcasCache.some(m => m.nombre.toLowerCase() === ls.nombre.toLowerCase())) {
                        marcasCache.push({ id: ls.id || ('local-' + Date.now()), nombre: ls.nombre });
                    }
                });
            }
        } catch (e) {
            console.warn('Error al leer marcas locales desde localStorage:', e);
        }

        marcasCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (err) {
        console.error("Error en la función cargarMarcas:", err);
        showToast(err.message, 'error');
        marcasCache = []; // En caso de error, vaciar el caché.
    }

    renderizarListaMarcas(filtro);
}

function renderizarListaMarcas(filtro = '') {
    const lista = document.getElementById('listaMarcas');
    if (!lista) return;
    lista.innerHTML = '';
    const marcasFiltradas = marcasCache.filter(m => m.nombre.toLowerCase().includes(filtro.toLowerCase()));

    if (marcasFiltradas.length === 0) {
        lista.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 10px;">No hay marcas para mostrar.</li>';
        return;
    }

    marcasFiltradas.forEach(m => {
        const li = document.createElement('li');
        li.className = `cat-item ${marcaSeleccionadaId === m.id ? 'selected' : ''}`;
        li.textContent = m.nombre;
        li.onclick = () => {
            document.querySelectorAll('#listaMarcas .cat-item').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            marcaSeleccionadaId = m.id;
            document.getElementById('marcaNombre').value = m.nombre;
            document.getElementById('marcaId').value = m.id;
        };
        lista.appendChild(li);
    });
}

/**
 * Carga las marcas existentes y las popula en el datalist del formulario de producto.
 */
async function loadExistingBrands() {
    const select = document.getElementById('prodMarca');
    if (!select || select.tagName !== 'SELECT') return;

    const previouslySelectedValue = select.value;
    select.innerHTML = '<option value="">-- Sin Marca --</option>';

    // `cargarMarcas` obtiene las marcas únicas de la tabla 'productos'
    await cargarMarcas();

    if (marcasCache && marcasCache.length > 0) {
        marcasCache.forEach(brand => {
            select.add(new Option(brand.nombre, brand.nombre));
        });
        // Restaurar el valor seleccionado previamente si todavía existe en la lista
        select.value = previouslySelectedValue;
    }
}

async function actualizarSelectProductos() {
    if (categoriasCache.length === 0) await cargarCategorias();
    const select = document.getElementById('prodCategoria');
    select.innerHTML = '<option value="">Selecciona...</option>';
    categoriasCache.forEach(c => select.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`);
}

// --- INICIALIZACIÓN DE LA APP ---

document.addEventListener('DOMContentLoaded', () => {
    // Detectar Android y marcar el body para reglas CSS específicas
    try {
        if (navigator && /Android/i.test(navigator.userAgent || '')) {
            document.body.classList.add('platform-android');
        }
    } catch (e) {
        // No bloquear si falla la detección
        console.warn('Detección de plataforma falló:', e);
    }
    // --- LÓGICA DE AUTENTICACIÓN Y UI DE USUARIO ---
    const username = localStorage.getItem('usuario');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!username) {
        // Si no hay un nombre de usuario en localStorage, redirigir al login.
        // Esto previene el acceso directo al dashboard sin haber iniciado sesión.
        // Se asume que la página de login es 'index.html' o la raíz.
        window.location.href = '/';
        return; // Detener la ejecución para evitar cargar el resto del dashboard
    } else {
        // Si hay un usuario, mostrar su nombre.
        if (usernameDisplay) {
            usernameDisplay.textContent = username;
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            window.location.href = '/';
        });
    }

    // --- INICIO: HTML para el nuevo modal de marcas ---
    const modalMarcaHtml = `
    <div class="modal-overlay" id="modalMarca" data-modal-close>
        <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Gestionar Marcas</h3>
                <button id="closeModalMarcaBtn" class="action-btn btn-del">&times;</button>
            </div>
            <div class="modal-form">
                <div class="field-group">
                    <label for="marcaNombre">Nombre de la Marca</label>
                    <input type="text" id="marcaNombre"><input type="hidden" id="marcaId">
                </div>
                <div class="modal-buttons categoria-management" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: center;">
                    <button id="btnAgregarMarca" class="action-btn btn-green">Agregar</button>
                    <button id="btnEditarMarca" class="action-btn btn-edit">Editar</button>
                    <button id="btnEliminarMarca" class="action-btn btn-del">Eliminar</button>
                    <input type="text" id="marcaBuscar" placeholder="Buscar marca..." style="grid-column: 1 / -1; width: 100%; padding-left: 12px;">
                </div>
                <ul id="listaMarcas" class="cat-list"></ul>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalMarcaHtml);
    // --- FIN: HTML para el nuevo modal de marcas ---

    // --- LÓGICA DE LA BARRA LATERAL RESPONSIVA ---
    const sidebarOverlay = document.getElementById('content-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // --- MANEJADOR DE ANIMACIÓN SUAVE PARA MENÚS DESPLEGABLES (<details>) ---
    document.addEventListener('click', (e) => {
        const summary = e.target.closest('details.tools-dropdown > summary, details > summary');
        if (!summary) return;
        const details = summary.parentElement;
        if (details && details.hasAttribute('open') && !details.classList.contains('is-closing')) {
            e.preventDefault();
            details.classList.add('is-closing');
            setTimeout(() => {
                details.removeAttribute('open');
                details.classList.remove('is-closing');
            }, 140);
        }
    });

    // --- SOPORTE DE INSTALACIÓN PWA (Android / iOS / Desktop) ---
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        const btnInstalar = document.getElementById('btnInstalarPwa');
        if (btnInstalar) {
            btnInstalar.style.display = 'inline-flex';
        }
    });

    document.addEventListener('click', async (e) => {
        const installBtn = e.target.closest('#btnInstalarPwa');
        if (!installBtn) return;
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('¡TOTAL REPUESTOS C&S instalada!', 'success');
            }
            deferredInstallPrompt = null;
        } else {
            showToast('Para instalar en Android: pulsa el menú (⋮) en tu navegador y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".', 'info');
        }
    });

    window.addEventListener('appinstalled', () => {
        showToast('¡TOTAL REPUESTOS C&S instalada correctamente en tu dispositivo!', 'success');
        deferredInstallPrompt = null;
    });

    obtenerTasas();
    setInterval(obtenerTasas, 300000); // Actualizar cada 5 minutos

    // Cargar la vista de inicio por defecto
    cargarVista('inicio');

    // Listener para el formulario de nuevo producto (se define una sola vez)
    const formProducto = document.getElementById('formProducto');
    if (formProducto) {
        formProducto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editCodigo = document.getElementById('prodEditCodigo').value;
            let mode = formProducto.dataset.mode || 'manual';

            let precioCostoDolaresBcv, precioVentaDolaresBcv, ventaDolaresEfectivo, costoDolaresEfectivo;
            let calc_costo_$_efectivo = null, calc_descuento = null, calc_ganancia = null;

            const valCalcCosto = parseSafeFloat(document.getElementById('calcCostoUsdt')?.value, 0);
            const valCalcDesc = parseSafeFloat(document.getElementById('calcDescuento')?.value, 0);
            const valCalcGan = parseSafeFloat(document.getElementById('calcGanancia')?.value, 0);

            // Si está en modo calculadora o si el usuario llenó datos en la calculadora
            if (mode === 'calculator' || (valCalcCosto > 0 && mode !== 'manual')) {
                mode = 'calculator';
                let precioProv = valCalcCosto;

                // Si precioProv está vacío o es 0, buscar en los campos manuales como respaldo
                if (precioProv <= 0) {
                    precioProv = parseSafeFloat(document.getElementById('prodCostoDolaresEfectivo')?.value, 0) ||
                        parseSafeFloat(document.getElementById('prodCostoDolaresBcv')?.value, 0);
                }

                if (precioProv <= 0) {
                    showToast('Ingresa un precio de proveedor válido mayor a 0.', 'error');
                    return;
                }

                const porcProv = valCalcDesc;
                const porcVenta = valCalcGan;

                const calculados = calcularPreciosPorcentaje(precioProv, porcProv, porcVenta);
                costoDolaresEfectivo = calculados.costoEfectivo;
                ventaDolaresEfectivo = calculados.ventaEfectivo;
                precioCostoDolaresBcv = calculados.costoUsdBcv;
                precioVentaDolaresBcv = calculados.ventaUsdBcv;

                calc_costo_$_efectivo = precioProv;
                calc_descuento = porcProv;
                calc_ganancia = porcVenta;

                // Sincronizar también inputs manuales
                const prodCostoEf = document.getElementById('prodCostoDolaresEfectivo');
                const prodVentaEf = document.getElementById('prodUsdt');
                const prodCostoBcv = document.getElementById('prodCostoDolaresBcv');
                const prodVentaBcv = document.getElementById('prodVentaDolaresBcv');
                if (prodCostoEf) prodCostoEf.value = costoDolaresEfectivo;
                if (prodVentaEf) prodVentaEf.value = ventaDolaresEfectivo;
                if (prodCostoBcv) prodCostoBcv.value = precioCostoDolaresBcv;
                if (prodVentaBcv) prodVentaBcv.value = precioVentaDolaresBcv;
            } else { // manual
                precioCostoDolaresBcv = parseSafeFloat(document.getElementById('prodCostoDolaresBcv').value, 0);
                costoDolaresEfectivo = parseSafeFloat(document.getElementById('prodCostoDolaresEfectivo').value, 0);
                precioVentaDolaresBcv = parseSafeFloat(document.getElementById('prodVentaDolaresBcv').value, 0);
                ventaDolaresEfectivo = parseSafeFloat(document.getElementById('prodUsdt').value, 0);

                if (precioVentaDolaresBcv <= 0 || precioCostoDolaresBcv < 0 || ventaDolaresEfectivo <= 0 || costoDolaresEfectivo < 0) {
                    showToast('Los precios de venta deben ser mayores a cero y los costos no pueden ser negativos.', 'error');
                    return;
                }

                calc_costo_$_efectivo = valCalcCosto > 0 ? valCalcCosto : (editCodigo && productoSeleccionado ? (productoSeleccionado.calc_costo_$_efectivo ?? null) : null);
                calc_descuento = !isNaN(valCalcDesc) && valCalcDesc > 0 ? valCalcDesc : (editCodigo && productoSeleccionado ? (productoSeleccionado.calc_descuento ?? null) : null);
                calc_ganancia = !isNaN(valCalcGan) && valCalcGan > 0 ? valCalcGan : (editCodigo && productoSeleccionado ? (productoSeleccionado.calc_ganancia ?? null) : null);
            }

            // Determinar la cantidad final
            let cantidadFinal;
            if (editCodigo) {
                const cantidadActual = parseInt(document.getElementById('prodCantidadActual').value, 10) || 0;
                const cantidadIngresada = parseInt(document.getElementById('prodCantidad').value, 10) || 0;
                cantidadFinal = cantidadActual + cantidadIngresada;
            } else {
                cantidadFinal = parseInt(document.getElementById('prodCantidad').value, 10) || 0;
            }

            const marcaFinal = document.getElementById('prodMarca').value || '';

            const nuevoCodigo = document.getElementById('prodCodigo').value.trim();
            if (!nuevoCodigo) {
                showToast('El código del producto es obligatorio.', 'error');
                return;
            }

            const productData = {
                codigo: nuevoCodigo,
                categoria: document.getElementById('prodCategoria').value,
                nombre: document.getElementById('prodNombre').value.trim(),
                marca: marcaFinal,
                ubicacion: document.getElementById('prodUbicacion').value.trim(),
                cantidad: cantidadFinal,
                precio_costo_dolares_bcv: parseFloat(precioCostoDolaresBcv) || 0,
                precio_venta_dolares_bcv: parseFloat(precioVentaDolaresBcv) || 0,
                'venta_$_efectivo': parseFloat(ventaDolaresEfectivo) || 0,
                'costo_$_efectivo': parseFloat(costoDolaresEfectivo) || 0,
                modo_creacion: mode,
                'calc_costo_$_efectivo': calc_costo_$_efectivo !== null ? (parseFloat(calc_costo_$_efectivo) || 0) : null,
                calc_descuento: calc_descuento !== null ? (parseFloat(calc_descuento) || 0) : null,
                calc_ganancia: calc_ganancia !== null ? (parseFloat(calc_ganancia) || 0) : null
            };

            let error;
            if (editCodigo) {
                // Si estamos editando y el código ha cambiado, verificar que el nuevo no exista
                if (editCodigo !== nuevoCodigo) {
                    const { data: existingRows } = await _supabase.from('productos').select('codigo').eq('codigo', nuevoCodigo);
                    if (existingRows && existingRows.length > 0) {
                        showToast(`El código '${nuevoCodigo}' ya está en uso.`, 'error');
                        return;
                    }
                }
                const { error: updateError } = await _supabase.from('productos').update(productData).eq('codigo', editCodigo);
                error = updateError;
            } else {
                // Si es un producto nuevo, verificar que el código no exista
                const { data: existingRows } = await _supabase.from('productos').select('codigo').eq('codigo', nuevoCodigo);
                if (existingRows && existingRows.length > 0) {
                    showToast(`El código '${nuevoCodigo}' ya está en uso.`, 'error');
                    return;
                }
                const { error: insertError } = await _supabase.from('productos').insert([productData]);
                error = insertError;
            }

            if (error) {
                showToast(`Error al guardar el producto: ${error.message}`, 'error');
                return;
            }

            // Actualizar el cache local si se editó
            if (editCodigo) {
                const idx = productosCache.findIndex(p => p.codigo === editCodigo);
                if (idx !== -1) {
                    productosCache[idx] = { ...productosCache[idx], ...productData };
                }
                if (productoSeleccionado && productoSeleccionado.codigo === editCodigo) {
                    productoSeleccionado = { ...productoSeleccionado, ...productData };
                }
            }

            document.getElementById('formProducto').reset();
            document.getElementById('modalProducto').classList.remove('active');
            showToast(editCodigo ? 'Producto actualizado con éxito.' : 'Producto guardado con éxito.', 'success');

            loadProducts();

            socket.emit('cambio-dato', { type: 'products' });
        });

        // Escuchar cambios en los inputs de la calculadora para recalcular en tiempo real
        ['calcCostoUsdt', 'calcDescuento', 'calcGanancia'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    actualizarResultadosCalculadora();
                });
            }
        });
    } else {
        console.error("Error: El formulario con id 'formProducto' no fue encontrado al cargar la página.");
    }

    // Listener para el formulario de producto adicional (se define una sola vez)
    const formAdicional = document.getElementById('formAdicional');
    if (formAdicional) {
        formAdicional.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('adicNombre').value.trim();
            let codigo = document.getElementById('adicCodigo').value.trim() || ('ADIC-' + Math.floor(1000 + Math.random() * 9000));
            const cantidad = parseInt(document.getElementById('adicCantidad').value, 10);
            const precioVenta = parseFloat(document.getElementById('adicPrecioVenta').value);

            // Para un producto adicional, el costo y la venta son iguales para simplificar
            productosParaLlevar.push({
                nombre,
                codigo,
                cantidad: 9999,
                precio_venta_dolares_bcv: precioVenta,
                precio_costo_dolares_bcv: precioVenta,
                venta_$_efectivo: precioVenta,
                costo_$_efectivo: precioVenta,
                cantidadLlevar: cantidad,
                esAdicional: true
            });

            renderizarParaLlevar();
            document.getElementById('formAdicional').reset();
            document.getElementById('modalAdicional').classList.remove('active');
            showToast('Adicional agregado a la caja.', 'success');
        });
    } else {
        console.error("Error: El formulario con id 'formAdicional' no fue encontrado al cargar la página.");
    }

    // Listener para el formulario de abono a venta (se define una sola vez)
    const formAbonoVenta = document.getElementById('formAbonoVenta');
    if (formAbonoVenta) {
        formAbonoVenta.addEventListener('submit', handleConfirmarAbono);
    }

    // --- INICIO: Lógica para editar ventas ---
    const formPasswordVenta = document.getElementById('formPasswordVenta');
    if (formPasswordVenta) {
        formPasswordVenta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formPasswordVenta.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Verificando...';

            const password = document.getElementById('adminPassword').value.trim();
            const username = localStorage.getItem('usuario');

            if (!pendingAction || !pendingActionId) {
                showToast('Acción no definida. Inténtalo de nuevo.', 'error');
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Contraseña incorrecta.');
                }

                // Contraseña correcta
                document.getElementById('modalPasswordVenta').classList.remove('active');
                document.getElementById('adminPassword').value = '';

                if (pendingAction === 'edit') {
                    const venta = ventasCache.find(v => v.id == pendingActionId);
                    if (!venta) {
                        showToast('Error: No se encontró la venta para editar.', 'error');
                        return;
                    }
                    handleAbrirModalEditarVenta(venta);
                } else if (pendingAction === 'delete') {
                    handleDeleteSale(pendingActionId);
                } else if (pendingAction === 'abonar') {
                    handleAbrirModalAbono(pendingActionId);
                } else if (pendingAction === 'registrar_devolucion') {
                    handleRegistrarDevolucion(pendingActionId);
                }

            } catch (err) {
                console.error('Error verificando contraseña:', err);
                showToast(err.message, 'error');
                document.getElementById('adminPassword').focus();
                document.getElementById('adminPassword').value = '';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Verificar y Editar';
                pendingAction = null;
                pendingActionId = null;
            }
        });
    }

    const formEditarVenta = document.getElementById('formEditarVenta');
    if (formEditarVenta) {
        formEditarVenta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnConfirmarEdicionVenta');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const ventaId = document.getElementById('editVentaId').value;
            const totalBcvAmount = parseFloat(document.getElementById('editVentaTotalUsd').value) || 0;
            const totalEfectivoAmount = parseFloat(document.getElementById('editVentaTotalEfectivo')?.value) || 0;
            const tipoCedula = document.getElementById('editCliTipoCedula').value;
            const numeroCedula = document.getElementById('editCliCedula').value.trim();
            const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;

            const pagoPendiente = document.getElementById('editPagoPendienteCheckbox')?.checked || false; // Obtener estado del checkbox

            const activeMethodNames = [];
            document.querySelectorAll('#editPaymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
                const id = check.dataset.editMethodId;
                const amountInput = document.getElementById(`amount_${id}`);
                if (amountInput) {
                    activeMethodNames.push(amountInput.dataset.methodName);
                }
            });

            const metodosEnEfectivo = ['Binance', 'Dólares en efectivo', 'Zelle'];
            const useEfectivoTotal = activeMethodNames.some(name => metodosEnEfectivo.includes(name));
            const currentRate = useEfectivoTotal ? ((paraleloRate > 0) ? paraleloRate : (oficialRate > 0 ? oficialRate : 1)) : ((oficialRate > 0) ? oficialRate : 1);
            const totalDeLaVenta = useEfectivoTotal ? (totalEfectivoAmount > 0 ? totalEfectivoAmount : totalBcvAmount) : totalBcvAmount;

            // Recolectar los nuevos datos de pago
            const nuevosPagos = [];
            document.querySelectorAll('#editPaymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
                const id = check.dataset.editMethodId;
                const amountInput = document.getElementById(`amount_${id}`);
                let amount = parseFloat(amountInput.value) || 0;
                let amountInUsd = amount;

                if (amountInput.dataset.currency === 'BS') {
                    amountInUsd = currentRate > 0 ? (amount / currentRate) : 0;
                }

                if (amountInUsd > 0) {
                    nuevosPagos.push({
                        metodo: amountInput.dataset.methodName,
                        monto: amountInUsd
                    });
                }
            });

            const nuevoTotalPagado = nuevosPagos.reduce((sum, p) => sum + p.monto, 0);

            // Validación: si no es crédito, el pago debe ser completo.
            if (!pagoPendiente && Math.abs(totalDeLaVenta - nuevoTotalPagado) > 0.01) {
                showToast('El total pagado no coincide. Revise los montos o marque como "pago pendiente".', 'error');
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            const editCodTelefono = document.getElementById('editCliCodTelefono')?.value || '0414';
            const editNumTelefono = document.getElementById('editCliTelefono')?.value.trim() || '';
            const editTelefono = editNumTelefono ? `${editCodTelefono}${editNumTelefono}` : '';

            const nuevoEstadoPago = pagoPendiente ? 'pendiente' : 'pagado';

            const updatedData = {
                cliente_nombre: document.getElementById('editCliNombre').value.trim(),
                cliente_cedula: cedulaCompleta,
                cliente_telefono: editTelefono,
                cliente_direccion: document.getElementById('editCliDireccion').value.trim(),
                tipo_pago: JSON.stringify(nuevosPagos),
                total_usd: totalDeLaVenta,
                total_bs: totalDeLaVenta * currentRate,
                estado_pago: nuevoEstadoPago
            };

            try {
                const { error } = await _supabase.from('ventas').update(updatedData).eq('id', ventaId);
                if (error) throw error;

                showToast('Venta actualizada con éxito.', 'success');
                document.getElementById('modalEditarVenta').classList.remove('active');

                cargarHistorialVentas();
                socket.emit('cambio-dato', { type: 'ventas' });

            } catch (error) {
                console.error('Error al actualizar la venta:', error);
                showToast(`Error al guardar los cambios: ${error.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }
    // --- FIN: Lógica para editar ventas ---
});