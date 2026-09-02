import { showToast, formatCurrency } from './utils.js';

// Número de WhatsApp oficial para recibir reportes de pago y renovaciones
const ADMIN_WHATSAPP_PHONE = '584264617572';

// Configuración inicial por defecto de la licencia
let currentLicenseConfig = {
    username: 'total-repuestos',
    password: 'hdf378nr',
    license_key: 'OMG-7J66-BT4Q-6LWQ-GQPX-CN5L-9QAZ',
    app_name: 'WEBSITE'
};

const LICENSE_STORAGE_KEY = 'omega_pos_license_data';
let isCheckingLicense = false;
let checkTimer = null;
let lastKnownLicense = null;
let isBannerDismissedInSession = false;

/**
 * Obtiene la tasa oficial BCV actual para el cálculo de Bolívares
 */
function getCurrentBcvRate() {
    if (typeof window.oficialRate === 'number' && window.oficialRate > 0) {
        return window.oficialRate;
    }
    const bcvEl = document.getElementById('sidebarBcvRate');
    if (bcvEl && bcvEl.textContent) {
        const cleaned = bcvEl.textContent.replace('Bs', '').trim().replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
}

/**
 * Formatea una fecha a DD/MM/YYYY
 */
function formatLicenseDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'No especificada';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Carga la configuración local de la licencia desde el servidor o caché
 */
async function loadLicenseConfig() {
    try {
        const res = await fetch('/api/license', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.config) {
                currentLicenseConfig = data.config;
                localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(currentLicenseConfig));
                return currentLicenseConfig;
            }
        }
    } catch (e) {
        console.warn('Aviso: No se pudo obtener /api/license, usando respaldo local:', e.message);
    }

    const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (stored) {
        try {
            currentLicenseConfig = JSON.parse(stored);
        } catch (_) { }
    }
    return currentLicenseConfig;
}

/**
 * Actualiza la interfaz gráfica según el estado de la licencia
 */
function updateLicenseUI(licenseData, statusInfo) {
    const lockOverlay = document.getElementById('licenseLockOverlay');
    const warningBanner = document.getElementById('licenseWarningBanner');
    const warningText = document.getElementById('licenseWarningText');
    const warningWhatsappBtn = document.getElementById('licenseWarningWhatsappBtn');

    const lockTitle = document.getElementById('licenseLockTitle');
    const lockSubtitle = document.getElementById('licenseLockSubtitle');
    const lockUsername = document.getElementById('lockUsername');
    const lockExpiration = document.getElementById('lockExpirationDate');
    const lockStatus = document.getElementById('lockServerStatus');
    const lockFeeUsd = document.getElementById('licenseFeeAmount');
    const lockFeeBs = document.getElementById('licenseFeeAmountBs');
    const lockWhatsAppBtn = document.getElementById('btnLockWhatsApp');

    const user = licenseData?.username || currentLicenseConfig.username || 'total-repuestos';
    const token = licenseData?.license_key || currentLicenseConfig.license_key || 'N/A';
    const feeVal = licenseData ? (parseFloat(licenseData.monthly_fee) || 0) : 0;
    
    // Cálculo en Dólares y Bolívares a Tasa BCV
    const bcvRate = getCurrentBcvRate();
    const feeBsVal = feeVal * bcvRate;
    const feeUsdStr = `$ ${formatCurrency(feeVal)} USD`;
    const feeBsStr = bcvRate > 0 ? `Bs ${formatCurrency(feeBsVal)}` : '';
    const feeFullStr = bcvRate > 0 ? `${feeUsdStr} (≈ ${feeBsStr} @ Tasa BCV)` : feeUsdStr;

    const expDate = licenseData?.expiration_date ? new Date(licenseData.expiration_date) : null;
    const expFormatted = formatLicenseDate(expDate);

    // 1. CASO BLOQUEO TOTAL (Inactivo, Vencido o No Registrado)
    if (statusInfo.isLocked) {
        if (warningBanner) warningBanner.style.display = 'none';
        if (lockOverlay) {
            lockOverlay.style.display = 'flex';

            if (lockUsername) lockUsername.textContent = user;
            if (lockExpiration) lockExpiration.textContent = expFormatted;
            
            // Mostrar ambos montos (USD y Bolívares)
            if (lockFeeUsd) lockFeeUsd.textContent = feeUsdStr;
            if (lockFeeBs) {
                lockFeeBs.textContent = bcvRate > 0 ? `≈ ${feeBsStr} (Tasa BCV)` : '';
                lockFeeBs.style.display = bcvRate > 0 ? 'block' : 'none';
            }

            if (statusInfo.reason === 'deleted') {
                if (lockTitle) lockTitle.textContent = 'LICENCIA ELIMINADA / REVOCADA';
                if (lockSubtitle) lockSubtitle.textContent = 'Esta licencia no figura en el servidor central. Comuníquese con el administrador para habilitar un nuevo servicio.';
                if (lockStatus) lockStatus.textContent = 'Eliminada / No Registrada';
            } else if (statusInfo.reason === 'disabled') {
                if (lockTitle) lockTitle.textContent = 'SERVICIO SUSPENDIDO';
                if (lockSubtitle) lockSubtitle.textContent = 'El acceso a este sistema ha sido inhabilitado desde el panel de administración.';
                if (lockStatus) lockStatus.textContent = 'Inhabilitado';
            } else {
                if (lockTitle) lockTitle.textContent = 'LICENCIA VENCIDA';
                if (lockSubtitle) lockSubtitle.textContent = 'El ciclo de 30 días de la mensualidad ha finalizado. Cancele su cuota para reactivar el servicio.';
                if (lockStatus) lockStatus.textContent = 'Mensualidad Vencida';
            }

            if (lockWhatsAppBtn) {
                const msg = `Hola, me comunico del comercio "${user}" (Licencia: ${token}) para reportar el pago de mi mensualidad de ${feeFullStr}.\n\nPor favor adjunto el capture de pantalla del pago para la reactivación del servicio TOTAL REPUESTOS C&S.`;
                lockWhatsAppBtn.href = `https://wa.me/${ADMIN_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
            }
        }
        return;
    }

    // Si NO está bloqueado, ocultar la pantalla de bloqueo
    if (lockOverlay) lockOverlay.style.display = 'none';

    // 2. CASO AVISO PREVENTIVO DE VENCIMIENTO (3 a 5 días restantes)
    if (statusInfo.isExpiringSoon) {
        if (warningBanner) {
            if (!isBannerDismissedInSession) {
                warningBanner.style.display = 'block';
                warningBanner.classList.remove('exiting');
            } else {
                warningBanner.style.display = 'none';
            }
            const diasTexto = statusInfo.daysRemaining === 1 ? '1 día' : `${statusInfo.daysRemaining} días`;
            const feeAviso = feeVal > 0 ? ` (Mensualidad: ${feeFullStr})` : '';
            if (warningText) {
                warningText.textContent = `Aviso de Pago: Su licencia vence en ${diasTexto} (${expFormatted})${feeAviso}. Renueve a tiempo para evitar cortes de servicio.`;
            }
            if (warningWhatsappBtn) {
                const msg = `Hola, me comunico del comercio "${user}" (Licencia: ${token}) para gestionar la renovación de mi licencia que vence el ${expFormatted}${feeAviso}.\n\nPor favor adjunto el capture del comprobante de pago.`;
                warningWhatsappBtn.href = `https://wa.me/${ADMIN_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
            }
        }
        return;
    }

    // 3. CASO ACTIVO Y AL DÍA
    if (warningBanner) warningBanner.style.display = 'none';
}

/**
 * Consulta en tiempo real el estado de la licencia en la base de datos de Supabase Admin
 */
export async function checkLicenseStatusLive(silent = false) {
    if (isCheckingLicense && silent) return;
    isCheckingLicense = true;

    try {
        const config = await loadLicenseConfig();
        const client = window._supabaseAdmin;

        if (!client) {
            console.warn('Supabase Admin client no disponible para validación de licencia.');
            isCheckingLicense = false;
            return;
        }

        // 1. Buscar prioritariamente por clave de licencia
        let { data: licenses, error } = await client
            .from('licenses')
            .select('*')
            .eq('license_key', config.license_key.trim())
            .limit(1);

        // 2. Si no se encontró por token, buscar por username
        if ((!licenses || licenses.length === 0) && config.username) {
            const res = await client
                .from('licenses')
                .select('*')
                .eq('username', config.username.trim())
                .limit(1);
            licenses = res.data;
            error = res.error;
        }

        if (error) {
            console.warn('Error al consultar licencia en Supabase:', error.message);
            isCheckingLicense = false;
            return;
        }

        if (!licenses || licenses.length === 0) {
            // Licencia eliminada o inexistente en servidor
            lastKnownLicense = null;
            updateLicenseUI(null, { isLocked: true, isExpiringSoon: false, reason: 'deleted' });
            isCheckingLicense = false;
            return;
        }

        const lic = licenses[0];
        lastKnownLicense = lic;

        const isActive = (lic.is_active !== false && lic.is_active !== 0);
        const expDate = lic.expiration_date ? new Date(lic.expiration_date) : null;
        const now = new Date();

        let isExpired = false;
        let daysRemaining = 999;

        if (expDate && !isNaN(expDate.getTime())) {
            isExpired = now.getTime() > expDate.getTime();
            const diffMs = expDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }

        // Si está inactivo o vencido -> Bloqueado
        if (!isActive) {
            updateLicenseUI(lic, { isLocked: true, isExpiringSoon: false, reason: 'disabled' });
        } else if (isExpired) {
            updateLicenseUI(lic, { isLocked: true, isExpiringSoon: false, reason: 'expired' });
        } else if (daysRemaining <= 5 && daysRemaining >= 0) {
            // Próximo a vencer (<= 5 días o <= 3 días)
            updateLicenseUI(lic, { isLocked: false, isExpiringSoon: true, daysRemaining });
        } else {
            // Activa y sin avisos
            updateLicenseUI(lic, { isLocked: false, isExpiringSoon: false, daysRemaining });
        }

    } catch (e) {
        console.warn('Excepción al validar licencia:', e.message);
    } finally {
        isCheckingLicense = false;
    }
}

/**
 * Inicializa el sistema de control y monitoreo de licencias
 */
export function initLicenseManager() {
    console.log('🛡️ Inicializando Sistema de Monitoreo de Licencias OMEGASYNC...');

    // 1. Verificación inicial inmediata
    checkLicenseStatusLive(false);

    // 2. Monitoreo en segundo plano cada 4 segundos (Polling rápido para respuesta inmediata ante suspensión o renovación)
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(() => {
        checkLicenseStatusLive(true);
    }, 4000);

    // 3. Verificación al cambiar de pestaña o volver a enfocar la app
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkLicenseStatusLive(true);
        }
    });
    window.addEventListener('focus', () => checkLicenseStatusLive(true));

    // 4. Suscripción en tiempo real a Supabase Realtime (si está habilitado)
    try {
        const client = window._supabaseAdmin;
        if (client && typeof client.channel === 'function') {
            client
                .channel('realtime:licenses_monitor')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, (payload) => {
                    console.log('📡 Notificación en tiempo real recibida de Supabase:', payload);
                    checkLicenseStatusLive(false);
                })
                .subscribe();
        }
    } catch (e) {
        console.warn('Aviso: Suscripción en vivo no activa:', e);
    }

    // 5. Botón manual de "Verificar Reactivación (En Línea)" en la pantalla de bloqueo
    const btnRecheck = document.getElementById('btnLockRecheck');
    if (btnRecheck) {
        btnRecheck.addEventListener('click', async () => {
            const spinner = document.getElementById('recheckSpinner');
            const btnText = document.getElementById('recheckBtnText');
            const originalText = btnText ? btnText.textContent : 'Verificar Reactivación';

            if (spinner) spinner.style.display = 'inline-block';
            if (btnText) btnText.textContent = 'Verificando con Servidor...';
            btnRecheck.disabled = true;

            await checkLicenseStatusLive(false);

            setTimeout(() => {
                if (spinner) spinner.style.display = 'none';
                if (btnText) btnText.textContent = originalText;
                btnRecheck.disabled = false;

                const lockOverlay = document.getElementById('licenseLockOverlay');
                if (!lockOverlay || lockOverlay.style.display === 'none') {
                    showToast('¡Licencia reactivada exitosamente! Bienvenido nuevamente.', 'success', 4000);
                } else {
                    showToast('El servicio aún figura como suspendido o vencido en el servidor. Comuníquese por WhatsApp.', 'error', 4000);
                }
            }, 800);
        });
    }

    // 6. Botón manual para cerrar temporalmente el aviso en esta sesión
    const btnDismissBanner = document.getElementById('btnDismissWarningBanner');
    const warningBanner = document.getElementById('licenseWarningBanner');
    if (btnDismissBanner && warningBanner) {
        btnDismissBanner.addEventListener('click', () => {
            isBannerDismissedInSession = true;
            warningBanner.classList.add('exiting');
            setTimeout(() => {
                warningBanner.style.display = 'none';
                warningBanner.classList.remove('exiting');
            }, 250);
        });
    }
}
