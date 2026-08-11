export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('exiting');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

export function showConfirmation(message, onConfirm) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast confirm';
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    const btnContainer = document.createElement('div');
    btnContainer.className = 'toast-buttons';
    const btnYes = document.createElement('button');
    btnYes.textContent = 'Sí';
    btnYes.className = 'action-btn btn-red';
    const btnNo = document.createElement('button');
    btnNo.textContent = 'No';
    btnNo.className = 'action-btn';
    btnNo.style.backgroundColor = '#475569';
    const closeToast = () => { toast.classList.add('exiting'); toast.addEventListener('animationend', () => toast.remove()); };
    btnYes.onclick = () => { onConfirm(); closeToast(); };
    btnNo.onclick = closeToast;
    btnContainer.append(btnYes, btnNo);
    toast.append(messageEl, btnContainer);
    container.appendChild(toast);
}