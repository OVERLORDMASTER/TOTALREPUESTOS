/**
 * Muestra un mensaje de notificación (toast) en la interfaz de usuario.
 * @param {string} message El mensaje a mostrar.
 * @param {'success'|'error'|'info'|'confirm'} type El tipo de mensaje (determina el estilo).
 * @param {number} duration La duración en milisegundos antes de que el toast desaparezca (solo para tipos no 'confirm').
 * @returns {Promise<boolean>} Resuelve a true si se confirma, false si se cancela (solo para tipo 'confirm').
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.warn('Toast container not found. Message:', message);
        return Promise.resolve(false);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    if (type === 'confirm') {
        return new Promise((resolve) => {
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Confirmar';
            confirmBtn.className = 'action-btn btn-green';
            confirmBtn.style.marginRight = '8px';
            confirmBtn.onclick = () => {
                toast.classList.add('exiting');
                toast.addEventListener('animationend', () => toast.remove());
                resolve(true);
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.className = 'action-btn btn-del';
            cancelBtn.onclick = () => {
                toast.classList.add('exiting');
                toast.addEventListener('animationend', () => toast.remove());
                resolve(false);
            };

            const btnContainer = document.createElement('div');
            btnContainer.className = 'toast-buttons';
            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(cancelBtn);
            toast.appendChild(btnContainer);
        });
    } else {
        setTimeout(() => {
            toast.classList.add('exiting');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
        return Promise.resolve(true); // For non-confirm toasts, always resolve true
    }
}

/**
 * Muestra un diálogo de confirmación.
 * @param {string} message El mensaje de confirmación.
 * @param {Function} onConfirm La función a ejecutar si el usuario confirma.
 */
export async function showConfirmation(message, onConfirm) {
    const confirmed = await showToast(message, 'confirm');
    if (confirmed) {
        onConfirm();
    }
}

/**
 * Formatea un número como moneda con separador de miles (punto) y dos decimales (coma).
 * Ej: 1234.56 -> 1.234,56
 */
export function formatCurrency(number) {
    const val = Number.isFinite(Number(number)) ? Number(number) : 0;
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export function formatInteger(number) {
    const val = Number.isFinite(Number(number)) ? Math.round(Number(number)) : 0;
    return new Intl.NumberFormat('es-VE').format(val);
}