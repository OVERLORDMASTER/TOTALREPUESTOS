import { generarFacturaPDF, generarInventarioPDF } from './source/generatepdf.js';
import { showToast, showConfirmation, formatCurrency, formatInteger } from './utils.js';

// --- INICIO: Lógica para autocompletar datos del cliente ---
const inputCedula = document.getElementById('cliCedula');
const selectTipoCedula = document.getElementById('cliTipoCedula');
const btnBuscarCliente = document.getElementById('btnBuscarCliente');

/**
 * Busca el cliente más reciente en la base de datos por su cédula
 * y autocompleta los campos del formulario de venta si lo encuentra.
 */
const buscarClientePorCedula = async () => {
    // Asegurarse de que los elementos existan antes de usarlos.
    if (!selectTipoCedula || !inputCedula) return;

    const tipoCedula = selectTipoCedula.value;
    const numeroCedula = inputCedula.value.trim();

    // No buscar si el campo de cédula está vacío o es muy corto
    if (numeroCedula.length < 7) {
        // Si el campo se vacía, limpiar los otros campos para permitir un nuevo ingreso
        document.getElementById('cliNombre').value = '';
        document.getElementById('cliTelefono').value = '';
        document.getElementById('cliDireccion').value = '';
        return;
    }

    const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;

    // Feedback visual para el usuario mientras se realiza la búsqueda
    const nombreInput = document.getElementById('cliNombre');
    const telefonoInput = document.getElementById('cliTelefono');
    const direccionInput = document.getElementById('cliDireccion');
    
    const originalPlaceholders = {
        nombre: nombreInput.placeholder,
        telefono: telefonoInput.placeholder,
        direccion: direccionInput.placeholder
    };

    nombreInput.placeholder = 'Buscando cliente...';
    telefonoInput.placeholder = '...';
    direccionInput.placeholder = '...';

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
            telefonoInput.value = venta.cliente_telefono || '';
            direccionInput.value = venta.cliente_direccion || '';
            showToast('Cliente encontrado. Datos cargados automáticamente.', 'success');
        } else {
            // Cliente no encontrado: limpiar campos para un nuevo registro y notificar
            nombreInput.value = '';
            telefonoInput.value = '';
            direccionInput.value = '';
            showToast('Cliente no registrado. Puede ingresarlo como nuevo.', 'info');
        }
    } catch (err) {
        console.error('Error al buscar cliente por cédula:', err);
        showToast('Ocurrió un error al intentar buscar el cliente.', 'error');
    } finally {
        // Restaurar los placeholders originales en todos los casos
        nombreInput.placeholder = originalPlaceholders.nombre;
        telefonoInput.placeholder = originalPlaceholders.telefono;
        direccionInput.placeholder = originalPlaceholders.direccion;
    }
};

if (inputCedula && selectTipoCedula && btnBuscarCliente) {
    // Restricción de formato para el input de cédula
    inputCedula.addEventListener('input', function() {
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
// --- FIN: Lógica para autocompletar datos del cliente ---

const inputTelefono = document.getElementById('cliTelefono');
if (inputTelefono) {
    inputTelefono.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 16);
    });
}

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

async function cargarVista(nombreVista) {
    const vista = vistas[nombreVista];
    if (!vista) {
        visorModulos.innerHTML = `<div class="welcome-container"><h1>Error 404</h1><p>La vista "${nombreVista}" no fue encontrada.</p></div>`;
        return;
    }

    // 1. Iniciar la animación de desvanecimiento
    visorModulos.classList.add('loading');

    // 2. Esperar a que termine la animación de desvanecimiento
    await new Promise(resolve => setTimeout(resolve, 200)); // Debe coincidir con la duración de la transición en CSS

    try {
        const response = await fetch(`vistas/${vista.file}`);
        if (!response.ok) throw new Error(`No se pudo cargar ${vista.file}`);
        
        const html = await response.text();
        visorModulos.innerHTML = html;

        // Inyectar el botón para mostrar/ocultar la barra lateral
        const header = visorModulos.querySelector('header');
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.innerHTML = '&#9776;'; // Icono de hamburguesa
        toggleBtn.onclick = toggleSidebar;

        if (header) {
            // Insertar el botón al principio del header, antes del título
            header.insertBefore(toggleBtn, header.firstChild);
        } else {
            // Si no hay header (ej. en la vista de 'inicio'), lo insertamos al principio
            // del visor de módulos. El CSS se encargará de posicionarlo de forma absoluta.
            visorModulos.insertBefore(toggleBtn, visorModulos.firstChild);
        }

        // Si hay una función de inicialización, la llamamos
        if (vista.init) {
            vista.init();
        }

        // Si la barra lateral está visible (indicando que estamos en móvil), la cerramos
        if (document.body.classList.contains('sidebar-visible')) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Error al cargar la vista:', error);
        visorModulos.innerHTML = `<div class="welcome-container"><h1>Error</h1><p>No se pudo cargar el módulo. Revisa la consola para más detalles.</p></div>`;
    } finally {
        // 3. Quitar la clase para que el nuevo contenido aparezca con una animación de fundido
        visorModulos.classList.remove('loading');
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

// Conexión a Socket.io
const socket = io();
socket.on('connect', () => console.log('Conectado a Socket.IO'));
socket.on('actualizacion-dato', (data) => {
    // Recargar la vista actual si es relevante
    const vistaActiva = document.querySelector('.nav-btn.active').textContent.trim().toLowerCase();
    if (data.type === 'products' && (vistaActiva === 'inventario de productos' || vistaActiva === 'caja')) {
        cargarVista(vistaActiva);
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

// Conexión a Supabase
const SUPABASE_URL = 'https://tqlbmcqkottvclikpxur.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gq9mJ5Qo9MIa-k0pRTB7hQ_Rda5qtBX';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de estado globales
let productoSeleccionado = null;
let modoEdicion = false;
let categoriaSeleccionadaId = null;
let categoriasCache = [];
let pendingAction = null, pendingActionId = null;
let productosCache = [];
let productosParaLlevar = [];
let ventasCache = [];
let oficialRate = 0, paraleloRate = 0;
let totalVentaActual = 0; // Para almacenar el total de la venta actual en el modal
let reportCharts = {}; // Para almacenar instancias de los gráficos de reportes

const TASA_SETTINGS_KEY = 'tasaSettings';
const THEME_KEY = 'appTheme';
let tasaSettings = {
    oficial: { mode: 'automatico', value: 0 },
    paralelo: { mode: 'automatico', value: 0 }
};

const METODOS_DE_PAGO = ['Pago Móvil', 'Binance', 'Dólares en efectivo', 'Bolívares en efectivo', 'Zelle'];

// --- TASAS DE CAMBIO ---
async function obtenerTasas() {
    const fetchOficial = async () => {
        if (tasaSettings.oficial.mode === 'manual' && tasaSettings.oficial.value > 0) return tasaSettings.oficial.value;
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!res.ok) throw new Error('Fallo al obtener tasa oficial');
        const data = await res.json();
        return data.promedio;
    };

    const fetchParalelo = async () => {
        if (tasaSettings.paralelo.mode === 'manual' && tasaSettings.paralelo.value > 0) return tasaSettings.paralelo.value;
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
        if (!res.ok) throw new Error('Fallo al obtener tasa paralelo');
        const data = await res.json();
        return data.promedio;
    };

    try {
        const [oficial, paralelo] = await Promise.all([fetchOficial(), fetchParalelo()]);
        oficialRate = oficial;
        paraleloRate = paralelo;

        document.getElementById('sidebarBcvRate').textContent = `Bs ${oficialRate.toFixed(2)}`;
        document.getElementById('sidebarParallelRate').textContent = `Bs ${paraleloRate.toFixed(2)}`;
    } catch (error) {
        console.error("Error obteniendo divisas:", error);
        if (!oficialRate) oficialRate = tasaSettings.oficial.value || 0;
        if (!paraleloRate) paraleloRate = tasaSettings.paralelo.value || 0;
        document.getElementById('sidebarBcvRate').textContent = `Bs ${oficialRate.toFixed(2)}`;
        document.getElementById('sidebarParallelRate').textContent = `Bs ${paraleloRate.toFixed(2)}`;
    }
}

// --- LÓGICA DE VISTAS ESPECÍFICAS ---

// INVENTARIO
function initVistaInventario() {
    loadProducts();
    document.getElementById('productSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) { renderProducts(productosCache); return; }
        renderProducts(productosCache.filter(p => p.nombre.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term)));
    });
    document.getElementById('btnEditar').addEventListener('click', handleEditarProducto);
    document.getElementById('btnEliminar').addEventListener('click', handleEliminarProducto);
    document.getElementById('btnPrintInventory').addEventListener('click', async () => {
        const btn = document.getElementById('btnPrintInventory');
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
}

async function loadProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">Cargando productos...</p>';
    await obtenerTasas();
    const { data: products, error } = await _supabase.from('productos').select('*').order('nombre');
    if (error) { container.innerHTML = `<p style="color: var(--btn-red);">Error: ${error.message}</p>`; return; }
    productosCache = products || [];
    renderProducts(productosCache);
}

function renderProducts(productsToRender) {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (productsToRender.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No se encontraron productos.</p>';
    }

    const grouped = {};
    productsToRender.forEach(p => {
        const cat = p.categoria && p.categoria.trim() !== '' ? p.categoria : 'Sin Categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    for (const [categoria, prods] of Object.entries(grouped)) {
        const categoryBox = document.createElement('div');
        categoryBox.className = 'category-box';
        const titleEl = document.createElement('h3');
        titleEl.className = 'category-box-title';
        titleEl.textContent = categoria;
        categoryBox.appendChild(titleEl);
        const gridEl = document.createElement('div');
        gridEl.className = 'products-grid';

        prods.forEach(p => {
            const precioVentaBsBcv = formatCurrency(p.precio_venta_dolares_bcv * oficialRate);
            const precioCostoBsBcv = formatCurrency(p.precio_costo_dolares_bcv * oficialRate);
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.codigo = p.codigo;
            card.innerHTML = `
                <div class="field-group"><label>código</label><div class="product-card-value">${p.codigo}</div></div>
                <div class="field-group"><label>nombre</label><div class="product-card-value">${p.nombre}</div></div>
                <div class="field-group"><label>marca</label><div class="product-card-value">${p.marca || ''}</div></div>
                <div class="field-group"><label>ubicación</label><div class="product-card-value">${p.ubicacion || ''}</div></div>
                <div class="field-group"><label>cantidad</label><div class="product-card-value">${formatInteger(p.cantidad)}</div></div>
                                <div class="field-group"><label>precio $ en efectivo</label><div class="product-card-value" style="color: var(--btn-green); font-weight: bold;">${formatCurrency(p.precio_usdt)}</div></div>
                <div class="field-group"><label>precio venta $ bcv</label><div class="product-card-value" style="color: var(--btn-green); font-weight: bold;">${formatCurrency(p.precio_venta_dolares_bcv)}</div></div>
                <div class="field-group"><label>precio venta bs (bcv)</label><div class="product-card-value" style="color: var(--btn-edit-text); font-weight: bold;">${precioVentaBsBcv}</div></div>
                <div class="field-group"><label>precio costo $ bcv</label><div class="product-card-value" style="color: var(--btn-green); font-weight: bold;">${formatCurrency(p.precio_costo_dolares_bcv)}</div></div>
                <div class="field-group"><label>precio costo bs (bcv)</label><div class="product-card-value" style="color: var(--btn-edit-text); font-weight: bold;">${precioCostoBsBcv}</div></div>`;

            card.addEventListener('click', () => {
                if (modoEdicion) return;
                document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                productoSeleccionado = p;
            });
            gridEl.appendChild(card);
        });
        categoryBox.appendChild(gridEl);
        container.appendChild(categoryBox);
    }

    let totalInvertido = 0, stockTotal = 0;
    productosCache.forEach(p => {
        totalInvertido += p.cantidad * p.precio_costo_dolares_bcv;
        stockTotal += p.cantidad;
    });
    document.getElementById('totalInvertido').textContent = `$ ${formatCurrency(totalInvertido)}`;
    document.getElementById('stockTotal').textContent = formatInteger(stockTotal);
}

async function handleEditarProducto() {
    if (!productoSeleccionado) {
        showToast('Selecciona un producto para editar.', 'error');
        return;
    }

    // Asegurarse de que las categorías estén cargadas en el menú desplegable
    await actualizarSelectProductos();

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
    document.getElementById('prodCantidadActual').value = productoSeleccionado.cantidad;

    document.getElementById('cantidadIngresarGroup').style.display = 'block';
    document.getElementById('labelCantidadIngresar').textContent = 'Cantidad que Ingresa';
    document.getElementById('prodCantidad').value = 0; // Iniciar en 0 para sumar
    // --- FIN: Lógica de cantidad para EDICIÓN ---

    document.getElementById('prodUbicacion').value = productoSeleccionado.ubicacion || '';
    document.getElementById('prodMarca').value = productoSeleccionado.marca || '';

    // Poblar el resto de los campos
    const modo = productoSeleccionado.modo_creacion || 'manual';

    setProductModalMode(modo); // Cambia la UI directamente

    if (modo === 'calculadora') {
        // Poblar campos de la calculadora
        document.getElementById('calcCostoUsdt').value = productoSeleccionado.calc_costo_usdt || 0;
        document.getElementById('calcDescuento').value = productoSeleccionado.calc_descuento || 0;
        document.getElementById('calcGanancia').value = productoSeleccionado.calc_ganancia || 0;

        // Simular clic en 'Calcular Precios' para mostrar los resultados pre-calculados
        // y dar contexto inmediato al usuario.
        document.getElementById('btnCalcularPrecios').click();

    } else { // modo 'manual'
        // Poblar campos de precios manuales
        document.getElementById('prodCostoDolaresBcv').value = productoSeleccionado.precio_costo_dolares_bcv;
        document.getElementById('prodVentaDolaresBcv').value = productoSeleccionado.precio_venta_dolares_bcv;
        document.getElementById('prodUsdt').value = productoSeleccionado.precio_usdt;
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
        const icon = acc.querySelector('.accordion-icon');
        if (index === 0) {
            content.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            icon.textContent = '▲';
        } else {
            content.classList.remove('active');
            content.style.maxHeight = null;
            icon.textContent = '▼';
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
                otherContent.classList.remove('active');
                otherContent.style.maxHeight = null;
                acc.querySelector('.accordion-icon').textContent = '▼';
            });

            // Abrir el que se clickeó
            content.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            clickedAccordion.querySelector('.accordion-icon').textContent = '▲';
        });
    });
    // --- FIN: Nueva lógica de acordeón dinámico con animación ---

    document.getElementById('cajaProductSearch').addEventListener('input', (e) => {
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
    container.innerHTML = '';
    if (productsToRender.length === 0) { 
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

    for (const [categoria, prods] of Object.entries(grouped)) {
        const categoryBox = document.createElement('div');
        categoryBox.className = 'caja-category-box'; // Nueva clase para la caja de categoría en caja
        const titleEl = document.createElement('h3');
        titleEl.className = 'caja-category-box-title'; // Nueva clase para el título de categoría en caja
        titleEl.textContent = categoria;
        categoryBox.appendChild(titleEl);

        const productsGrid = document.createElement('div');
        productsGrid.className = 'caja-products-grid'; // Nueva clase para la cuadrícula de productos dentro de una categoría en caja

        prods.forEach(p => {
            const precioVentaBsBcv = formatCurrency(p.precio_venta_dolares_bcv * oficialRate);
            const precioVentaDolares = formatCurrency(p.precio_venta_dolares_bcv);
            const card = document.createElement('div');
            card.className = 'product-card-caja-vertical'; // Clase existente para la tarjeta vertical
            card.innerHTML = `
                <div class="caja-v-item">
                    <label>Código</label>
                    <span>${p.codigo}</span>
                </div>
                <div class="caja-v-item">
                    <label>Nombre</label>
                    <span>${p.nombre}</span>
                </div>
                <div class="caja-v-item">
                    <label>Precio Bs (BCV)</label>
                    <span style="color: var(--btn-edit-text); font-weight: bold;">${precioVentaBsBcv}</span>
                </div>
                <div class="caja-v-item">
                    <label>Precio Dólares (BCV)</label>
                    <span style="color: var(--btn-green); font-weight: bold;">${precioVentaDolares}</span>
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
            `;
            productsGrid.appendChild(card);
        });
        categoryBox.appendChild(productsGrid);
        container.appendChild(categoryBox);
    };
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

    if (productosParaLlevar.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">No hay productos en el carrito.</p>';
        if (totalArticulosEl) totalArticulosEl.textContent = '0';
        if (totalBcvEl) totalBcvEl.textContent = '$ 0.00';
        if (totalBcvBsEl) totalBcvBsEl.textContent = 'Bs 0.00';
        return;
    }

    let totalArticulos = 0, totalBcv = 0;
    productosParaLlevar.forEach(item => {
        // CORRECCIÓN: Usar precio_venta_dolares_bcv en lugar de precio_usdt
        const subtotalUSD = item.precio_venta_dolares_bcv * item.cantidadLlevar;
        const subtotalBS = formatCurrency(subtotalUSD * oficialRate); // Usar tasa oficial para consistencia visual

        totalArticulos += item.cantidadLlevar;
        totalBcv += subtotalUSD;
        const card = document.createElement('div');
        card.className = 'product-card-caja-list'; // Usar la misma clase de lista
        card.innerHTML = `
            <div class="caja-list-info">
                <span class="caja-list-nombre">${item.nombre}</span>
                <div class="caja-v-item">
                    <label>Subtotal Bs</label>
                    <span style="color: var(--btn-edit-text); font-weight: bold;">${subtotalBS}</span>
                </div>
                <div class="caja-v-item">
                    <label>Subtotal $</label>
                    <span style="color: var(--btn-green); font-weight: bold;">${formatCurrency(subtotalUSD)}</span>
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

// VENTAS
function initVistaVentas() {
    // Reemplazar la tabla estática por un contenedor para el acordeón dinámico
    const contentArea = document.querySelector('#visor-modulos .content-area');
    const oldTable = contentArea ? contentArea.querySelector('.tabla-ventas-container') : null;
    if (oldTable) {
        const accordionContainer = document.createElement('div');
        accordionContainer.id = 'ventasAccordionContainer';
        oldTable.parentNode.replaceChild(accordionContainer, oldTable);
    }

    cargarHistorialVentas();
    document.getElementById('ventasSearch').addEventListener('input', (e) => {
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
        document.getElementById('totalVentasCount').textContent = '0';
        document.getElementById('totalVentasUsd').textContent = '$ 0.00';
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
        if (monthIndex > 0) {
            monthContent.style.display = 'none';
        } else {
            monthHeader.classList.add('active');
            monthHeader.querySelector('.fecha-icono').textContent = '▲';
        }

        monthHeader.addEventListener('click', () => {
            const isActive = monthHeader.classList.toggle('active');
            monthContent.style.display = isActive ? 'block' : 'none';
            monthHeader.querySelector('.fecha-icono').textContent = isActive ? '▲' : '▼';
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
            const fechaFormateada = new Date(ventasDelDia[0].fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
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
                dayHeader.querySelector('.fecha-icono').textContent = '▲';
            } else {
                dayContent.style.display = 'none';
            }

            dayHeader.addEventListener('click', () => {
                const isActive = dayHeader.classList.toggle('active');
                dayContent.style.display = isActive ? 'block' : 'none';
                dayHeader.querySelector('.fecha-icono').textContent = isActive ? '▲' : '▼';
            });

            const table = document.createElement('table');
            table.className = 'tabla-ventas-container';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th><th>Hora</th><th>Cliente</th><th>Cédula</th><th>Teléfono</th>
                        <th>Tipo Pago</th><th>Productos</th><th>Total USD</th><th>Total BS</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody></tbody>`;
            const tbody = table.querySelector('tbody');

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

                let tipoPagoHtml = '';
                try {
                    const pagos = JSON.parse(v.tipo_pago);
                    if (Array.isArray(pagos) && pagos.length > 0) {
                        // Crear una lista vertical de métodos de pago sin montos
                        const pagosHtml = pagos.map(p => `<span class="detalle-venta-badge">Tipo de pago: ${p.metodo}</span>`).join('');
                        tipoPagoHtml = `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">${pagosHtml}</div>`;
                    } else { throw new Error("No es un array"); }
                } catch (e) {
                    tipoPagoHtml = `<span class="detalle-venta-badge">Tipo de pago: ${v.tipo_pago || 'N/A'}</span>`;
                }

                let statusBadge = '';
                if (v.estado_pago === 'pendiente') {
                    statusBadge = `<br><span class="detalle-venta-badge" style="background-color: var(--btn-orange); color: white; font-weight: bold;">DEBE</span>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: bold; color: var(--btn-yellow);">#${v.id}</td>
                    <td>${horaFormateada}</td>
                    <td>${v.cliente_nombre}${statusBadge}</td>
                    <td>${v.cliente_cedula}</td>
                    <td>${v.cliente_telefono}</td>
                    <td>${tipoPagoHtml}</td>
                    <td>${productosHtml}</td>
                    <td style="font-weight: bold;">$ ${formatCurrency(parseFloat(v.total_usd))}</td>
                    <td style="font-weight: bold;">Bs ${formatCurrency(parseFloat(v.total_bs))}</td>`;
                
                let accionesHtml = `<button class="btn-pdf venta-accion-btn" data-venta-id="${v.id}">PDF</button>`;
                if (v.estado_pago === 'pendiente') {
                    accionesHtml += `<button class="action-btn btn-blue btn-abonar-venta venta-accion-btn" data-venta-id="${v.id}">Abonar</button>`;
                }
                accionesHtml += `<button class="btn-edit-venta venta-accion-btn" data-venta-id="${v.id}">Editar</button><button class="action-btn btn-del btn-delete-venta venta-accion-btn" data-venta-id="${v.id}">Eliminar</button>`;
                tr.innerHTML += `<td class="venta-acciones">${accionesHtml}</td>`;
                tbody.appendChild(tr);
            });

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
    document.getElementById('totalVentasCount').textContent = formatInteger(listaVentas.length);
    document.getElementById('totalVentasUsd').textContent = `$ ${formatCurrency(sumaTotalUsd)}`;
}

async function handleDeleteSale(ventaId) {
    const ventaParaEliminar = ventasCache.find(v => v.id == ventaId);
    if (!ventaParaEliminar) {
        showToast('No se encontró la venta para eliminar.', 'error');
        return;
    }

    showConfirmation(`¿Eliminar permanentemente la venta #${ventaId}? Esta acción restaurará el stock y no se puede deshacer.`, async () => {
        try {
            // 1. Restaurar stock
            for (const detalle of ventaParaEliminar.detalles) {
                const { data: productoActual, error: fetchError } = await _supabase
                    .from('productos')
                    .select('cantidad')
                    .eq('codigo', detalle.producto_codigo)
                    .single();

                if (fetchError) {
                    throw new Error(`No se pudo encontrar el producto ${detalle.producto_codigo} para restaurar stock.`);
                }

                const nuevoStock = productoActual.cantidad + detalle.cantidad;
                const { error: updateError } = await _supabase
                    .from('productos')
                    .update({ cantidad: nuevoStock })
                    .eq('codigo', detalle.producto_codigo);

                if (updateError) {
                    throw new Error(`Fallo al actualizar el stock para ${detalle.producto_codigo}.`);
                }
            }

            // 2. Eliminar detalles de la venta
            const { error: detalleError } = await _supabase
                .from('detalle_ventas')
                .delete()
                .eq('venta_id', ventaId);

            if (detalleError) throw new Error('Fallo al eliminar los detalles de la venta.');

            // 3. Eliminar la venta principal
            const { error: ventaError } = await _supabase
                .from('ventas')
                .delete()
                .eq('id', ventaId);

            if (ventaError) throw new Error('Fallo al eliminar la venta principal.');

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
    venta.detalles.forEach(d => {
        const key = d.producto_codigo || d.producto_nombre;
        if (detallesAgrupados[key]) {
            detallesAgrupados[key].cantidad += parseInt(d.cantidad, 10) || 0;
        } else {
            detallesAgrupados[key] = { ...d, cantidad: parseInt(d.cantidad, 10) || 0 };
        }
    });

    if (Object.keys(detallesAgrupados).length > 0) {
        // Usar un estilo de lista más limpio
        detallesContainer.innerHTML = '<ul style="list-style-type: none; padding-left: 0; margin: 0;">' + 
            Object.values(detallesAgrupados).map(d => 
                `<li style="padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <strong>${d.producto_nombre}</strong> (x${d.cantidad})
                 </li>`
            ).join('') + 
        '</ul>';
        // Quitar el borde del último elemento
        detallesContainer.querySelector('li:last-child').style.borderBottom = 'none';
    } else {
        detallesContainer.innerHTML = 'No hay detalles de productos para esta venta.';
    }

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
        const id = `abono_${metodo.toLowerCase().replace(/ /g, '_').replace('ó','o')}`;
        const isBsMethod = metodosEnBolivares.includes(metodo);
        const currencyLabel = isBsMethod ? 'Bs' : '$';
        const placeholderText = `Monto en ${currencyLabel}`;

        return `
            <div class="payment-method-row">
                <div class="payment-method-selector">
                    <input type="checkbox" id="check_${id}" data-abono-method-id="${id}">
                    <label for="check_${id}">${metodo} (${currencyLabel})</label>
                </div>
                <div class="payment-method-input" id="input_container_${id}" style="display: none;">
                    <input type="number" class="abono-payment-amount-input" step="0.01" placeholder="${placeholderText}" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
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

    document.getElementById('abonoNuevoTotalBs').textContent = `Bs ${formatCurrency(nuevoAbonoUsd * oficialRate)}`;
    document.getElementById('abonoNuevoTotal').textContent = `$ ${formatCurrency(nuevoAbonoUsd)}`;
    
    const btnConfirmar = document.getElementById('btnConfirmarAbono');

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
                    monto: parseFloat(amountInUsd.toFixed(2))
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
    const totalVenta = parseFloat(document.getElementById('editVentaTotalUsd').value) || 0;
    if (totalVenta === 0) return;

    let totalPagadoUsd = Array.from(document.querySelectorAll('.edit-payment-amount-input'))
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
    
    totalPagadoUsd = parseFloat(totalPagadoUsd.toFixed(2));
    const faltante = totalVenta - totalPagadoUsd;

    document.getElementById('editModalTotalPagado').textContent = `$ ${formatCurrency(totalPagadoUsd)}`;
    document.getElementById('editModalFaltante').textContent = `$ ${formatCurrency(Math.abs(faltante))}`;

    document.getElementById('editModalFaltanteBs').textContent = `Bs ${formatCurrency(Math.abs(faltante) * oficialRate)}`;
    const faltanteLabel = document.getElementById('editFaltanteLabel');
    const btnConfirmar = document.getElementById('btnConfirmarEdicionVenta');

    faltanteLabel.style.color = 'var(--btn-red)';
    document.getElementById('editModalFaltante').style.color = 'var(--btn-red)';

    if (faltante < -0.01) { // Sobrante
        faltanteLabel.textContent = '¡Sobrante!';
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto excede el total';
    } else if (Math.abs(faltante) < 0.01) { // Completo
        faltanteLabel.textContent = 'Completo';
        faltanteLabel.style.color = 'var(--btn-green)';
        document.getElementById('editModalFaltante').style.color = 'var(--btn-green)';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Guardar Cambios';
    } else { // Faltante
        faltanteLabel.textContent = 'Faltante';
        btnConfirmar.disabled = false; // Permitir guardar con deuda (pendiente)
        btnConfirmar.textContent = 'Guardar como Pendiente';
    }
}

async function handleAbrirModalEditarVenta(venta) {
    if (!venta) return;
    await obtenerTasas();

    const totalDeLaVenta = parseFloat(venta.total_usd);

    // 1. Poblar datos del cliente y totales
    document.getElementById('editVentaId').value = venta.id;
    document.getElementById('editVentaTotalUsd').value = totalDeLaVenta;
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
    document.getElementById('editCliTelefono').value = venta.cliente_telefono;
    document.getElementById('editCliDireccion').value = venta.cliente_direccion || '';
    document.getElementById('editModalTotalUsd').textContent = `$ ${formatCurrency(totalDeLaVenta)}`;
    document.getElementById('editModalTotalBs').textContent = `Bs ${formatCurrency(totalDeLaVenta * oficialRate)}`;

    // 2. Generar inputs de pago
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];
    const paymentContainer = document.getElementById('editPaymentMethodsContainer');
    paymentContainer.innerHTML = METODOS_DE_PAGO.map(metodo => {
        const id = `edit_${metodo.toLowerCase().replace(/ /g, '_').replace('ó','o')}`;
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
                    <input type="number" class="edit-payment-amount-input" step="0.01" placeholder="Monto en ${currencyLabel}" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
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
        const metodoNormalizado = pago.metodo.toLowerCase().replace(/ /g, '_').replace('ó','o');
        const id = `edit_${metodoNormalizado}`;
        const check = document.getElementById(`check_${id}`);
        const amountInput = document.getElementById(`amount_${id}`);
        
        if (check && amountInput) {
            check.checked = true;
            document.getElementById(`input_container_${id}`).style.display = 'flex';
            
            if (amountInput.dataset.currency === 'BS') {
                amountInput.value = (pago.monto * oficialRate).toFixed(2);
            } else {
                amountInput.value = pago.monto.toFixed(2);
            }
        }
    });

    // 4. Añadir listeners
    const modalBody = document.getElementById('formEditarVenta');
    const updateHandler = (e) => {
        if (e.target.classList.contains('edit-payment-amount-input')) {
            updateEditPaymentSummary();
        }
    };
    modalBody.removeEventListener('input', modalBody.updateHandler);
    modalBody.addEventListener('input', updateHandler);
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
        if(visor) visor.innerHTML = `<div class="welcome-container"><h1>Error en Reportes</h1><p>No se pudieron cargar los datos para los reportes: ${error.message}</p></div>`;
    }
}

function generarReporteParaPeriodo(periodo, ventas, productosMap) {
    const usdEl = document.getElementById(`${periodo}-total-usd`);
    const bsEl = document.getElementById(`${periodo}-total-bs`);
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
        usdEl.textContent = `$${formatCurrency(0)}`;
        bsEl.textContent = `Bs ${formatCurrency(0)}`;
        gananciaEl.textContent = `$${formatCurrency(0)}`;
        breakdownContainer.innerHTML = '<p class="loading-text">No hay ventas en este período.</p>';
        if (chartContainer) chartContainer.style.display = 'none'; // Ocultar si no hay datos
        return;
    }
    if (chartContainer) chartContainer.style.display = 'block'; // Mostrar si hay datos

    let totalUsd = 0, totalBs = 0, totalProfit = 0;
    const porMetodo = {};

    for (const venta of ventas) {
        totalUsd += parseFloat(venta.total_usd || 0);
        totalBs += parseFloat(venta.total_bs || 0);

        try {
            const pagos = JSON.parse(venta.tipo_pago);
            if (Array.isArray(pagos) && pagos.length > 0) {
                pagos.forEach(pago => {
                    const metodo = pago.metodo || 'No especificado';
                    const montoUsd = parseFloat(pago.monto || 0);
                    if (!porMetodo[metodo]) {
                        porMetodo[metodo] = { totalUsd: 0, count: 0 };
                    }
                    porMetodo[metodo].totalUsd += montoUsd;
                    porMetodo[metodo].count++;
                });
            } else {
                throw new Error('No es un array de pagos válido.');
            }
        } catch (e) {
            // Fallback para datos antiguos o mal formados (ej. una sola cadena de texto)
            const metodo = venta.tipo_pago || 'No especificado';
            const montoUsd = parseFloat(venta.total_usd || 0);
            if (!porMetodo[metodo]) {
                porMetodo[metodo] = { totalUsd: 0, count: 0 };
            }
            porMetodo[metodo].totalUsd += montoUsd;
            porMetodo[metodo].count++;
        }

        if (venta.detalles) {
            for (const detalle of venta.detalles) {
                const producto = productosMap.get(detalle.producto_codigo);
                if (producto && producto.precio_costo_dolares_bcv != null && producto.precio_venta_dolares_bcv != null) {
                    const gananciaPorUnidad = producto.precio_venta_dolares_bcv - producto.precio_costo_dolares_bcv;
                    totalProfit += gananciaPorUnidad * detalle.cantidad;
                }
            }
        }
    }

    usdEl.textContent = `$${formatCurrency(totalUsd)}`;
    bsEl.textContent = `Bs ${formatCurrency(totalBs)}`;
    gananciaEl.textContent = `$${formatCurrency(totalProfit)}`;

    // Renderizar la tabla de desglose
    const table = document.createElement('table');
    table.className = 'breakdown-table';
    table.innerHTML = `<thead><tr><th>Método de Pago</th><th style="text-align: right;">Total USD</th><th style="text-align: right;">Total BS</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    
    for (const [metodo, data] of Object.entries(porMetodo).sort((a, b) => b[1].totalUsd - a[1].totalUsd)) {
        const row = document.createElement('tr');
        const totalBsMetodo = data.totalUsd * oficialRate;
        row.innerHTML = `
            <td>${metodo} (${formatInteger(data.count)} transacciones)</td>
            <td>$${formatCurrency(data.totalUsd)}</td>
            <td>Bs ${formatCurrency(totalBsMetodo)}</td>
        `;
        tbody.appendChild(row);
    }

    breakdownContainer.innerHTML = '';
    breakdownContainer.appendChild(table);

    // Renderizar el gráfico de barras
    const sortedMetodos = Object.entries(porMetodo).sort((a, b) => b[1].totalUsd - a[1].totalUsd);
    const chartLabels = sortedMetodos.map(([metodo]) => metodo);
    const chartData = sortedMetodos.map(([, data]) => data.totalUsd);

    const chartColors = getChartColors();
    const ctx = chartCanvas.getContext('2d');
    reportCharts[periodo] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Total Ventas (USD)',
                data: chartData,
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
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
                        label: (context) => `Total: ${formatCurrency(context.parsed.x)}`
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
function initVistaDevoluciones() {
    document.getElementById('btnBuscarVenta').addEventListener('click', buscarVentaParaDevolucion);
    document.getElementById('devolucionVentaSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar que el formulario se envíe si hay uno
            buscarVentaParaDevolucion();
        }
    });
    cargarHistorialDevoluciones();
}

async function buscarVentaParaDevolucion() {
    const ventaId = document.getElementById('devolucionVentaSearch').value.trim();
    const container = document.getElementById('devolucionResultContainer');
    
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

    let itemsHtml = venta.detalles.map(item => {
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
            <div class="devolucion-item-card" id="devolucion-item-${item.id}" data-producto-codigo="${item.producto_codigo}" data-max-cantidad="${cantidadMaxADevolver}">
                <div class="item-selection">
                    <input type="checkbox" class="devolucion-item-checkbox" data-detalle-id="${item.id}">
                </div>
                <div class="item-info">
                    <strong>${item.producto_nombre}</strong>
                    <span>Código: ${item.producto_codigo}</span>
                    <span>Vendido: ${item.cantidad} | Ya Devuelto: ${cantidadYaDevuelta}</span>
                </div>
                <div class="item-actions">
                    <div class="field-group">
                        <label for="cantidad-devuelta-${item.id}">Cant. a Devolver</label>
                        <input type="number" class="cantidad-a-devolver" id="cantidad-devuelta-${item.id}" min="1" max="${cantidadMaxADevolver}" value="1">
                    </div>
                    <div class="field-group" style="flex-grow: 1;">
                        <label for="motivo-${item.id}">Motivo de la devolución</label>
                        <input type="text" class="motivo-devolucion" id="motivo-${item.id}" placeholder="Ej: Producto defectuoso">
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
            <button id="btnAnularVentaCompleta" data-venta-id="${venta.id}" class="action-btn btn-del">Anular Venta Completa</button>
            <button id="btnRegistrarDevolucionesSeleccionadas" data-venta-id="${venta.id}" class="action-btn btn-orange">Registrar Devoluciones Seleccionadas</button>
        </div>
        <div class="devolucion-items-container">
            ${itemsHtml}
        </div>
    `;
}

async function handleAnularVentaCompleta(ventaId) {
    const ventaParaAnular = ventasCache.find(v => v.id == ventaId);
    if (!ventaParaAnular) {
        showToast('No se encontró la venta para anular.', 'error');
        return;
    }
    // Reutilizamos la lógica de handleDeleteSale, ya que anular una venta completa
    // tiene el mismo efecto: restaurar stock y eliminar el registro de la venta.
    // El mensaje de confirmación de handleDeleteSale es apropiado.
    await handleDeleteSale(ventaId);
}

async function handleRegistrarDevolucionesSeleccionadas(ventaId) {
    const itemsSeleccionados = document.querySelectorAll('.devolucion-item-checkbox:checked');
    if (itemsSeleccionados.length === 0) {
        showToast('No has seleccionado ningún producto para devolver.', 'info');
        return;
    }

    const devolucionesParaProcesar = [];
    let errorValidacion = false;

    itemsSeleccionados.forEach(checkbox => {
        if (errorValidacion) return;

        const detalleId = checkbox.dataset.detalleId;
        const itemCard = document.getElementById(`devolucion-item-${detalleId}`);
        const productoCodigo = itemCard.dataset.productoCodigo;
        const maxCantidad = parseInt(itemCard.dataset.maxCantidad, 10);

        const cantidadInput = document.getElementById(`cantidad-devuelta-${detalleId}`);
        const motivoInput = document.getElementById(`motivo-${detalleId}`);
        
        const cantidadADevolver = parseInt(cantidadInput.value, 10);
        const motivo = motivoInput.value.trim();

        if (isNaN(cantidadADevolver) || cantidadADevolver <= 0) {
            showToast(`La cantidad a devolver para el producto ${productoCodigo} debe ser mayor que cero.`, 'error');
            errorValidacion = true;
        } else if (cantidadADevolver > maxCantidad) {
            showToast(`No puedes devolver más de ${maxCantidad} unidades del producto ${productoCodigo}.`, 'error');
            errorValidacion = true;
        } else if (!motivo) {
            showToast(`Debes especificar un motivo para la devolución del producto ${productoCodigo}.`, 'error');
            errorValidacion = true;
        } else {
            devolucionesParaProcesar.push({
                venta_id: ventaId,
                producto_codigo: productoCodigo,
                cantidad_devuelta: cantidadADevolver,
                motivo: motivo
            });
        }
    });

    if (errorValidacion) return;

    const btn = document.getElementById('btnRegistrarDevolucionesSeleccionadas');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        // Registrar todas las devoluciones
        const { error: devolucionError } = await _supabase.from('devoluciones').insert(devolucionesParaProcesar);
        if (devolucionError) throw devolucionError;

        // Actualizar el stock para cada producto devuelto
        for (const dev of devolucionesParaProcesar) {
            const { data: producto, error: productoError } = await _supabase.from('productos').select('cantidad').eq('codigo', dev.producto_codigo).single();
            if (productoError) throw new Error(`No se pudo obtener el stock actual del producto ${dev.producto_codigo}.`);

            const nuevoStock = producto.cantidad + dev.cantidad_devuelta;
            const { error: updateError } = await _supabase.from('productos').update({ cantidad: nuevoStock }).eq('codigo', dev.producto_codigo);
            if (updateError) throw updateError;
        }

        showToast('Devoluciones registradas y stock actualizado.', 'success');
        buscarVentaParaDevolucion(); // Recargar la vista de la venta
        cargarHistorialDevoluciones(); // Recargar el historial
        socket.emit('cambio-dato', { type: 'products' });
        socket.emit('cambio-dato', { type: 'devoluciones' });

    } catch (error) {
        console.error('Error al registrar las devoluciones:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function cargarHistorialDevoluciones() {
    const container = document.getElementById('historialDevolucionesContent');
    if (!container) return;
    container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-muted);">Cargando historial...</p>';

    const { data, error } = await _supabase.from('devoluciones').select(`*, productos (nombre)`).order('fecha_devolucion', { ascending: false }).limit(50);

    if (error) { container.innerHTML = `<p style="color: var(--btn-red);">Error al cargar el historial.</p>`; return; }
    if (!data || data.length === 0) { container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-muted);">No hay devoluciones registradas.</p>'; return; }

    const historialHtml = data.map(dev => `
        <div class="historial-devolucion-item">
            <div class="historial-info">
                <span class="historial-fecha">${new Date(dev.fecha_devolucion).toLocaleString()}</span>
                <strong>${(dev.productos ? dev.productos.nombre : 'Producto no encontrado')} (x${dev.cantidad_devuelta})</strong>
                <span class="historial-venta-id">Venta ID: #${dev.venta_id}</span>
            </div>
            <p class="historial-motivo">Motivo: ${dev.motivo}</p>
        </div>
    `).join('');

    container.innerHTML = historialHtml;
}

function setProductModalMode(mode) {
    const form = document.getElementById('formProducto');
    const manualPriceFields = document.querySelectorAll('.manual-price-field');
    const calcContainer = document.getElementById('calculator-container');
    const calcResults = document.getElementById('calculator-results');
    const btnManual = document.getElementById('btnModoManual');
    const btnCalc = document.getElementById('btnModoCalculadora');

    if (mode === 'calculator') {
        form.dataset.mode = 'calculator';
        manualPriceFields.forEach(el => el.style.display = 'none');
        calcContainer.style.display = 'block';
        calcResults.style.display = 'none'; // Ocultar resultados al cambiar de modo
        btnManual.classList.remove('active');
        btnCalc.classList.add('active');
    } else { // default to manual
        form.dataset.mode = 'manual';
        manualPriceFields.forEach(el => el.style.display = 'flex');
        calcContainer.style.display = 'none';
        btnManual.classList.add('active');
        btnCalc.classList.remove('active');
    }
}

function updatePaymentSummary() {
    let totalPagadoUsd = Array.from(document.querySelectorAll('.payment-amount-input'))
        .reduce((sum, input) => {
            const container = input.closest('.payment-method-input');
            // Solo sumar si el contenedor está visible (es decir, su checkbox está marcado)
            if (container && container.style.display !== 'none') {
                const val = parseFloat(input.value) || 0;
                if (input.dataset.currency === 'BS') {
                    // Convertir Bs a USD para la suma total
                    return sum + parseFloat((val / oficialRate).toFixed(2)); // Redondear a 2 decimales
                }
                return sum + val; // Ya está en USD
            }
            return sum;
        }, 0);
    totalPagadoUsd = parseFloat(totalPagadoUsd.toFixed(6)); // Asegurar precisión consistente para el total pagado
    
    // Redondear el total pagado a 2 decimales para la comparación
    totalPagadoUsd = parseFloat(totalPagadoUsd.toFixed(2));

    const faltante = totalVentaActual - totalPagadoUsd;

    document.getElementById('modalTotalPagado').textContent = `$ ${formatCurrency(totalPagadoUsd)}`;
    document.getElementById('modalFaltante').textContent = `$ ${formatCurrency(Math.abs(faltante))}`;
    document.getElementById('modalFaltanteBs').textContent = `Bs ${formatCurrency(parseFloat((Math.abs(faltante) * oficialRate).toFixed(2)))}`;

    const faltanteLabel = document.getElementById('faltanteLabel');
    const faltanteValue = document.getElementById('modalFaltante');
    const faltanteBsValue = document.getElementById('modalFaltanteBs');
    const btnConfirmar = document.getElementById('btnConfirmarVenta');
    const pagoPendiente = document.getElementById('pagoPendienteCheckbox')?.checked || false;

    // Resetear estilos
    faltanteLabel.style.color = 'var(--btn-red)';
    faltanteValue.style.color = 'var(--btn-red)';
    faltanteBsValue.style.color = 'var(--btn-red)';

    if (pagoPendiente) {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Guardar como Pendiente';
        faltanteLabel.textContent = 'Crédito Pendiente';
        faltanteLabel.style.color = 'var(--btn-orange)';
        faltanteValue.style.color = 'var(--btn-orange)';
        faltanteBsValue.style.color = 'var(--btn-orange)';
    } else if (faltante < -0.01) { // Sobrante
        faltanteLabel.textContent = '¡Sobrante!';
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Monto excede el total';
        showToast('El monto pagado excede el total de la venta.', 'error', 2000); // Mensaje explícito
    } else if (Math.abs(faltante) < 0.01) { // Completo
        faltanteLabel.textContent = 'Completo';
        faltanteLabel.style.color = 'var(--btn-green)';
        faltanteValue.style.color = 'var(--btn-green)';
        faltanteBsValue.style.color = 'var(--btn-green)';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Procesar Pago';
    } else { // Faltante
        faltanteLabel.textContent = 'Faltante';
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
        themeSwitch.addEventListener('change', function() {
            const newTheme = this.checked ? 'light' : 'dark';
            guardarYAplicarTema(newTheme);
            // Si la vista de reportes está activa, la recargamos para actualizar los gráficos
            if (document.querySelector('.nav-btn.active').textContent.trim().toLowerCase() === 'reportes') {
                cargarVista('reportes');
            }
        });
    }

    // Evento para el toggle de Tasa Oficial
    document.getElementById('tasaOficialModo').addEventListener('change', function() {
        document.getElementById('manualOficialRateContainer').style.display = this.checked ? 'block' : 'none';
    });
    // Evento para el toggle de Tasa Paralelo
    document.getElementById('tasaParaleloModo').addEventListener('change', function() {
        document.getElementById('manualParaleloRateContainer').style.display = this.checked ? 'block' : 'none';
    });

    document.getElementById('guardarAjustesTasa').addEventListener('click', () => {
        const newSettings = {
            oficial: {
                mode: document.getElementById('tasaOficialModo').checked ? 'manual' : 'automatico',
                value: parseFloat(document.getElementById('manualOficialRate').value) || 0
            },
            paralelo: {
                mode: document.getElementById('tasaParaleloModo').checked ? 'manual' : 'automatico',
                value: parseFloat(document.getElementById('manualParaleloRate').value) || 0
            }
        };
        localStorage.setItem(TASA_SETTINGS_KEY, JSON.stringify(newSettings));
        tasaSettings = newSettings;
        showToast('Ajustes guardados.', 'success');
        obtenerTasas(); // Actualizar tasas inmediatamente
    });
}

function cargarAjustesTasa() {
    const guardado = localStorage.getItem(TASA_SETTINGS_KEY);
    if (guardado) tasaSettings = JSON.parse(guardado);

    // Configurar Tasa Oficial
    document.getElementById('tasaOficialModo').checked = tasaSettings.oficial.mode === 'manual';
    document.getElementById('manualOficialRate').value = tasaSettings.oficial.value;
    document.getElementById('manualOficialRateContainer').style.display = tasaSettings.oficial.mode === 'manual' ? 'block' : 'none';

    // Configurar Tasa Paralelo
    document.getElementById('tasaParaleloModo').checked = tasaSettings.paralelo.mode === 'manual';
    document.getElementById('manualParaleloRate').value = tasaSettings.paralelo.value;
    document.getElementById('manualParaleloRateContainer').style.display = tasaSettings.paralelo.mode === 'manual' ? 'block' : 'none';
}

// --- LÓGICA DE MODALES GLOBALES Y EVENTOS ---

// Delegación de eventos para elementos cargados dinámicamente
document.addEventListener('click', (e) => {
    // Modales
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

    // --- INICIO: Lógica para modal de pago múltiple ---
    if (e.target.matches('.btn-fill-remaining')) {
        const id = e.target.dataset.targetId;
        const amountInput = document.getElementById(`amount_${id}`);
        const inputCurrency = amountInput.dataset.currency; // 'USD' o 'BS'
        
        // 1. Calcular el total pagado en USD de los OTROS campos
        let totalPagadoSinActualUsd = Array.from(document.querySelectorAll('.payment-amount-input'))
            .filter(input => input.id !== `amount_${id}`)
            .reduce((sum, input) => {
                const container = input.closest('.payment-method-input');
                if (container && container.style.display !== 'none') {
                    const val = parseFloat(input.value) || 0;
                    if (input.dataset.currency === 'BS' && oficialRate > 0) {
                        return sum + (val / oficialRate); // Convertir Bs a USD
                    } else {
                        return sum + val; // Ya está en USD
                    }
                }
                return sum;
            }, 0);
        totalPagadoSinActualUsd = parseFloat(totalPagadoSinActualUsd.toFixed(2)); // Redondear a 2 decimales
        
        // 2. Calcular el monto faltante en USD
        const faltanteUsd = parseFloat((totalVentaActual - totalPagadoSinActualUsd).toFixed(2));
        
        // 3. Llenar el campo actual con el monto faltante en la moneda correcta
        if (faltanteUsd > 0) {
            if (inputCurrency === 'BS' && oficialRate > 0) {
                // Se calcula el valor en Bolívares y se redondea a 2 decimales para el input.
                amountInput.value = parseFloat((faltanteUsd * oficialRate).toFixed(2)).toFixed(2);
            } else {
                // Se usa el valor en Dólares y se redondea a 2 decimales para el input.
                amountInput.value = faltanteUsd.toFixed(2); // Asegurar string con 2 decimales
            }
            updatePaymentSummary();
        }
    }
    // --- FIN: Lógica para modal de pago múltiple ---
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
    if (e.target.id === 'btnAnularVentaCompleta' || e.target.id === 'btnRegistrarDevolucionesSeleccionadas') {
        pendingAction = e.target.id === 'btnAnularVentaCompleta' ? 'anular_venta' : 'registrar_devoluciones';
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
    if (e.target.matches('#btnModoManual')) {
        setProductModalMode('manual');
    } else if (e.target.matches('#btnModoCalculadora')) {
        setProductModalMode('calculator');
    }

    // Botón para calcular precios en el modal de nuevo producto
    if (e.target.matches('#btnCalcularPrecios')) {
        const costoProductoUsdt = parseFloat(document.getElementById('calcCostoUsdt').value) || 0;
        const descuento = parseFloat(document.getElementById('calcDescuento').value) || 0;
        const ganancia = parseFloat(document.getElementById('calcGanancia').value) || 0;
        const tasaBinance = paraleloRate;
        const tasaBcv = oficialRate;

        if (costoProductoUsdt <= 0 || ganancia < 0 || tasaBinance <= 0 || tasaBcv <= 0) {
            showToast('Costo, ganancia y tasas son requeridos.', 'error');
            return;
        }

        const valorConDescuento = costoProductoUsdt * (1 - (descuento / 100));
        const costoEnBolivares = valorConDescuento * tasaBinance; // Esto es USDT * Tasa Paralelo
        const precioCostoDolaresBcv = costoEnBolivares / tasaBcv; // Esto es Costo en Bs / Tasa Oficial
        const precioVentaDolaresBcv = precioCostoDolaresBcv * (1 + (ganancia / 100)); // Esto es Costo $BCV * (1 + Ganancia %)
        const precioUsdt = valorConDescuento; // Esto es Costo $USDT con descuento

        // Mostrar resultados en el cuadro de resultados
        document.getElementById('resCostoBcv').textContent = `$ ${formatCurrency(precioCostoDolaresBcv)}`;
        document.getElementById('resVentaBcv').textContent = `$ ${formatCurrency(precioVentaDolaresBcv)}`;
        document.getElementById('resVentaUsdt').textContent = `$ ${formatCurrency(precioUsdt)}`;
        document.getElementById('calculator-results').style.display = 'block';

        showToast('Precios calculados. Revisa los resultados.', 'success');
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
    if (venta && paraleloRate) {
        try {
            await generarFacturaPDF(venta, paraleloRate, productosCache);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            showToast('Error al generar el PDF.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    } else {
        showToast('No se encontró la venta para generar el PDF o la tasa paralela no está disponible.', 'error');
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
    totalVentaActual = parseFloat(totalVentaActual.toFixed(2)); // Redondear a 2 decimales para el total de la venta
    const totalBs = totalVentaActual * oficialRate;
    
    // Definir qué métodos de pago son en Bolívares y cuáles en Dólares
    const metodosEnBolivares = ['Pago Móvil', 'Bolívares en efectivo'];

    const paymentContainer = document.getElementById('paymentMethodsContainer');
    paymentContainer.innerHTML = METODOS_DE_PAGO.map(metodo => {
        const id = metodo.toLowerCase().replace(/ /g, '_').replace('ó','o');
        const isBsMethod = metodosEnBolivares.includes(metodo);
        const currencyLabel = isBsMethod ? 'Bs' : '$';
        const inputStep = isBsMethod ? '0.01' : '0.01'; // Ambos pueden tener decimales
        const placeholderText = `Monto en ${currencyLabel}`;

        return `
            <div class="payment-method-row">
                <div class="payment-method-selector">
                    <input type="checkbox" id="check_${id}" data-method-id="${id}">
                    <label for="check_${id}">${metodo} (${currencyLabel})</label>
                </div>
                <div class="payment-method-input" id="input_container_${id}" style="display: none;">
                    <input type="number" class="payment-amount-input" step="${inputStep}" placeholder="${placeholderText}" id="amount_${id}" data-method-name="${metodo}" data-currency="${isBsMethod ? 'BS' : 'USD'}">
                    <button type="button" class="action-btn btn-blue btn-fill-remaining" data-target-id="${id}">FULL</button>
                </div>
            </div>
        `;
    }).join('');

    // Añadir listener de 'blur' a los inputs de monto para formatear a dos decimales
    // y asegurar que el valor sea '0.00' si se deja vacío.
    document.querySelectorAll('.payment-amount-input').forEach(input => {
        input.addEventListener('blur', () => {
            let value = parseFloat(input.value);
            if (!isNaN(value)) {
                input.value = value.toFixed(2);
            } else if (input.value.trim() === '') {
                input.value = '0.00'; // Si se deja vacío, mostrar '0.00'
            }
            updatePaymentSummary(); // Recalcular el resumen después de formatear
        });
    });

    document.getElementById('formDatosCliente').reset();
    document.querySelectorAll('.payment-amount-input').forEach(input => input.value = '');
    document.querySelectorAll('.payment-method-selector input[type="checkbox"]').forEach(check => check.checked = false);
    document.querySelectorAll('.payment-method-input').forEach(container => container.style.display = 'none');

    const totalUsd = totalVentaActual;
    document.getElementById('modalTotalUsd').textContent = `$ ${formatCurrency(totalUsd)}`;
    document.getElementById('modalTotalBs').textContent = `Bs ${formatCurrency(totalBs)}`;
    document.getElementById('lblTasaBcvBase').textContent = formatCurrency(oficialRate);
    document.getElementById('lblTasaUsdtRef').textContent = formatCurrency(paraleloRate);

    const modal = document.getElementById('modalVenta');
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
        checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        checkboxContainer.innerHTML = `
            <input type="checkbox" id="emitirFacturaCheckbox" style="width: 18px; height: 18px; cursor: pointer;">
            <label for="emitirFacturaCheckbox" style="font-weight: 600; cursor: pointer; user-select: none;">Emitir factura</label>
        `;
        leftActionsContainer.appendChild(checkboxContainer);
    }

    // Checkbox para "Pago Pendiente"
    if (!leftActionsContainer.querySelector('#pagoPendienteContainer')) {
        const pendienteContainer = document.createElement('div');
        pendienteContainer.id = 'pagoPendienteContainer';
        pendienteContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        pendienteContainer.innerHTML = `
            <input type="checkbox" id="pagoPendienteCheckbox" style="width: 18px; height: 18px; cursor: pointer;">
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

    modal.classList.add('active');
}

document.getElementById('formDatosCliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('cliNombre').value.trim();
    const tipoCedula = document.getElementById('cliTipoCedula').value;
    const numeroCedula = document.getElementById('cliCedula').value.trim();
    const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;
    const telefono = document.getElementById('cliTelefono').value.trim();
    const direccion = document.getElementById('cliDireccion').value.trim();

    if (numeroCedula.length > 10) { showToast('La cédula no puede exceder los 10 dígitos.', 'error'); return; }
    if (telefono.length > 16) { showToast('El teléfono no puede exceder los 16 dígitos.', 'error'); return; }

    const pagos = [];
    document.querySelectorAll('.payment-method-selector input[type="checkbox"]:checked').forEach(check => {
        const id = check.dataset.methodId;
        const amountInput = document.getElementById(`amount_${id}`); // Input de monto
        const inputCurrency = amountInput.dataset.currency; // 'USD' o 'BS'
        let amount = parseFloat(amountInput.value) || 0;
        let amountInUsd = amount;

        if (inputCurrency === 'BS') {
            amountInUsd = amount / oficialRate; // Convertir Bs a USD
        }

        if (amountInUsd > 0) {
            pagos.push({
                metodo: amountInput.dataset.methodName,
                monto: amountInUsd // Siempre guardar el monto en USD
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
        if (!pagoPendiente && Math.abs(totalVentaActual - totalPagadoValidacion) > 0.01) {
            showToast('El total pagado no coincide con el total de la venta. Revisa los montos.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Procesar Pago';
            return;
        }

        const totalUsd = totalVentaActual;
        const totalBs = totalUsd * oficialRate;

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
            const { error: detalleError } = await _supabase.from('detalle_ventas').insert([{ venta_id: ventaId, producto_codigo: item.codigo, producto_nombre: item.nombre, cantidad: item.cantidadLlevar, precio_unitario: item.precio_venta_dolares_bcv, tipo_precio_usado: 'BCV' }]);
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
                    precio_unitario: item.precio_venta_dolares_bcv,
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
    lista.innerHTML = '';
    categoriasCache.filter(c => c.nombre.toLowerCase().includes(filtro.toLowerCase())).forEach(c => {
        const li = document.createElement('li');
        li.className = `cat-item ${categoriaSeleccionadaId === c.id ? 'selected' : ''}`;
        li.textContent = c.nombre;
        li.onclick = () => {
            document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            categoriaSeleccionadaId = c.id;
            document.getElementById('catNombre').value = c.nombre;
            document.getElementById('catId').value = c.id;
        };
        lista.appendChild(li);
    });
}

// Modal Producto
async function initModalProducto() {
    await actualizarSelectProductos();
    
    // Resetear a modo manual cada vez que se abre el modal
    const form = document.getElementById('formProducto');
    form.closest('.modal').querySelector('h3').textContent = 'Cargar Nuevo Producto';
    
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

    // --- LÓGICA DE LA BARRA LATERAL RESPONSIVA ---
    const sidebarOverlay = document.getElementById('content-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

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
            const mode = formProducto.dataset.mode || 'manual';

            let precioCostoDolaresBcv, precioVentaDolaresBcv, precioUsdt;
            let calc_costo_usdt = null, calc_descuento = null, calc_ganancia = null;

            if (mode === 'calculator') {
                const costoProductoUsdt = parseFloat(document.getElementById('calcCostoUsdt').value) || 0;
                const descuento = parseFloat(document.getElementById('calcDescuento').value) || 0;
                const ganancia = parseFloat(document.getElementById('calcGanancia').value) || 0;
                if (costoProductoUsdt <= 0 || ganancia < 0 || paraleloRate <= 0 || oficialRate <= 0) {
                    showToast('Costo, ganancia y tasas son requeridos.', 'error'); return;
                }
                const valorConDescuento = costoProductoUsdt * (1 - (descuento / 100)); // Costo USDT con descuento
                const costoEnBolivares = valorConDescuento * paraleloRate;
                precioCostoDolaresBcv = costoEnBolivares / oficialRate;
                precioVentaDolaresBcv = precioCostoDolaresBcv * (1 + (ganancia / 100));
                precioUsdt = valorConDescuento;
                calc_costo_usdt = costoProductoUsdt;
                calc_descuento = descuento;
                calc_ganancia = ganancia;
            } else { // manual
                precioCostoDolaresBcv = parseFloat(document.getElementById('prodCostoDolaresBcv').value) || 0;
                precioVentaDolaresBcv = parseFloat(document.getElementById('prodVentaDolaresBcv').value) || 0;
                precioUsdt = parseFloat(document.getElementById('prodUsdt').value) || 0;
                if (precioVentaDolaresBcv <= 0 || precioCostoDolaresBcv < 0 || precioUsdt <= 0) {
                    showToast('Todos los precios deben ser mayores a cero.', 'error'); return;
                }
            }

            // Determinar la cantidad final
            let cantidadFinal;
            if (editCodigo) {
                const cantidadActual = parseInt(document.getElementById('prodCantidadActual').value, 10) || 0;
                const cantidadIngresada = parseInt(document.getElementById('prodCantidad').value, 10) || 0;
                cantidadFinal = cantidadActual + cantidadIngresada;
            } else {
                cantidadFinal = parseInt(document.getElementById('prodCantidad').value, 10);
            }

            const productData = {
                categoria: document.getElementById('prodCategoria').value,
                nombre: document.getElementById('prodNombre').value,
                marca: document.getElementById('prodMarca').value.trim(),
                ubicacion: document.getElementById('prodUbicacion').value.trim(),
                cantidad: cantidadFinal,
                precio_costo_dolares_bcv: precioCostoDolaresBcv,
                precio_venta_dolares_bcv: precioVentaDolaresBcv,
                precio_usdt: precioUsdt,
                modo_creacion: mode,
                calc_costo_usdt: calc_costo_usdt,
                calc_descuento: calc_descuento,
                calc_ganancia: calc_ganancia
            };

            const nuevoCodigo = document.getElementById('prodCodigo').value.trim();
            if (!nuevoCodigo) {
                showToast('El código del producto es obligatorio.', 'error');
                return;
            }
            productData.codigo = nuevoCodigo;

            let error;
            if (editCodigo) {
                // Si estamos editando y el código ha cambiado, verificar que el nuevo no exista
                if (editCodigo !== nuevoCodigo) {
                    const { data: existing } = await _supabase.from('productos').select('codigo').eq('codigo', nuevoCodigo).single();
                    if (existing) {
                        showToast(`El código '${nuevoCodigo}' ya está en uso.`, 'error');
                        return;
                    }
                }
                const { error: updateError } = await _supabase.from('productos').update(productData).eq('codigo', editCodigo);
                error = updateError;
            } else {
                // Si es un producto nuevo, verificar que el código no exista
                const { data: existing } = await _supabase.from('productos').select('codigo').eq('codigo', nuevoCodigo).single();
                if (existing) {
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

            document.getElementById('formProducto').reset();
            document.getElementById('modalProducto').classList.remove('active');
            showToast(editCodigo ? 'Producto actualizado con éxito.' : 'Producto guardado con éxito.', 'success');
    
            if (document.querySelector('.nav-btn.active').textContent.trim().toLowerCase() === 'inventario de productos') {
                loadProducts();
            }
    
            socket.emit('cambio-dato', { type: 'products' });
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
    
            // Usamos el mismo precio para ambas tasas para simplificar
            productosParaLlevar.push({ nombre, codigo, cantidad: 9999, precio_venta_dolares_bcv: precioVenta, precio_costo_dolares_bcv: precioVenta, precio_usdt: precioVenta, cantidadLlevar: cantidad, esAdicional: true });
            
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
                } else if (pendingAction === 'anular_venta') {
                    handleAnularVentaCompleta(pendingActionId); // Llama a la función directamente
                } else if (pendingAction === 'registrar_devoluciones') {
                    handleRegistrarDevolucionesSeleccionadas(pendingActionId); // Llama a la función directamente
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
            const totalDeLaVenta = parseFloat(document.getElementById('editVentaTotalUsd').value);
            const tipoCedula = document.getElementById('editCliTipoCedula').value;
            const numeroCedula = document.getElementById('editCliCedula').value.trim();
            const cedulaCompleta = `${tipoCedula}-${numeroCedula}`;

            // Recolectar los nuevos datos de pago
            const nuevosPagos = [];
            document.querySelectorAll('#editPaymentMethodsContainer input[type="checkbox"]:checked').forEach(check => {
                const id = check.dataset.editMethodId;
                const amountInput = document.getElementById(`amount_${id}`);
                let amount = parseFloat(amountInput.value) || 0;
                let amountInUsd = amount;

                if (amountInput.dataset.currency === 'BS' && oficialRate > 0) {
                    amountInUsd = amount / oficialRate;
                }

                if (amountInUsd > 0) {
                    nuevosPagos.push({
                        metodo: amountInput.dataset.methodName,
                        monto: parseFloat(amountInUsd.toFixed(2))
                    });
                }
            });

            const nuevoTotalPagado = nuevosPagos.reduce((sum, p) => sum + p.monto, 0);
            const nuevoEstadoPago = (nuevoTotalPagado + 0.01) >= totalDeLaVenta ? 'pagado' : 'pendiente';

            const updatedData = {
                cliente_nombre: document.getElementById('editCliNombre').value.trim(),
                cliente_cedula: cedulaCompleta,
                cliente_telefono: document.getElementById('editCliTelefono').value.trim(),
                cliente_direccion: document.getElementById('editCliDireccion').value.trim(),
                tipo_pago: JSON.stringify(nuevosPagos),
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