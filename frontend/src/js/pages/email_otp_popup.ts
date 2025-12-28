// Email OTP Popup Logic
// Expects: ?uuid=... (method id)

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const uuid = params.get('uuid');
    const validateBtn = document.getElementById('validate-email-otp-btn') as HTMLButtonElement;
    const input = document.getElementById('email-otp-input') as HTMLInputElement;
    const errorDiv = document.getElementById('email-otp-error') as HTMLElement;
    if (validateBtn && input && uuid) {
        validateBtn.addEventListener('click', async () => {
            const code = input.value.trim();
            if (!/^[A-Za-z0-9]{6,8}$/.test(code)) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code format.';
                return;
            }
            errorDiv.style.display = 'none';
            const res = await fetch('/api/users/twofa/email/validate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, code })
            });
            if (res.ok) {
                window.close();
            } else {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code.';
            }
        });
    }
});
