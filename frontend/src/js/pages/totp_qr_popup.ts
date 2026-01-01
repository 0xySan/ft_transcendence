// TOTP QR Popup Logic
// Expects: ?uuid=... (method id)

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const uuid = params.get('uuid');
    const qrContainer = document.getElementById('qr-code-container');
    if (!uuid) return;

    // Request QR matrix from opener
    window.opener?.postMessage({ type: 'request-totp-qr-matrix', uuid }, '*');

    function renderQrMatrix(qrMatrix: string[]) {
        if (!qrMatrix || !qrContainer) return;

        // Build ASCII QR with single-character modules to reduce size
        // Use double-width modules so blocks are square without scaling
        const lines = qrMatrix.map((row: string) =>
            row.replace(/0/g, '  ').replace(/1/g, '██')
        ).join('\n');

        // Clear container and insert styled <pre> for tight rendering
        qrContainer.innerHTML = '';
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.padding = '0';
        pre.style.fontFamily = 'monospace';
        pre.style.whiteSpace = 'pre';
        pre.style.letterSpacing = '0';
        // Make font smaller and line-height equal to font-size to remove gaps
        pre.style.fontSize = '6px';
        pre.style.lineHeight = '7px';
        // Ensure no transform so rendering stays crisp and square
        pre.style.transform = '';
        pre.textContent = lines;
        qrContainer.appendChild(pre);
    }

    window.addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'totp-qr-matrix') return;
        // Accept the QR matrix regardless of uuid, as only one popup is expected at a time
        if (event.data.matrix) {
            renderQrMatrix(event.data.matrix);
        }
    });

    const inputsContainer = document.getElementById('totp-code-inputs') as HTMLElement;
    const errorDiv = document.getElementById('totp-error') as HTMLElement;
    const digitInputs: HTMLInputElement[] = [];

    if (inputsContainer) {
        const found = Array.from(inputsContainer.querySelectorAll<HTMLInputElement>('input.otp-input'));
        found.forEach((inp, idx) => {
            digitInputs.push(inp);
            // allow only digits
            inp.addEventListener('input', (e) => {
                const v = inp.value.replace(/\D/g, '');
                inp.value = v.slice(-1);
                if (inp.value && idx < digitInputs.length - 1) {
                    digitInputs[idx + 1].focus();
                    digitInputs[idx + 1].select();
                }
                // If all inputs are filled, auto-validate
                const allFilled = digitInputs.length > 0 && digitInputs.every(i => i.value && i.value.trim().length === 1);
                if (allFilled) getCodeAndValidate();
            });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !inp.value && idx > 0) {
                    digitInputs[idx - 1].focus();
                    digitInputs[idx - 1].value = '';
                }
                if (e.key === 'ArrowLeft' && idx > 0) {
                    digitInputs[idx - 1].focus();
                }
                if (e.key === 'ArrowRight' && idx < digitInputs.length - 1) {
                    digitInputs[idx + 1].focus();
                }
            });
            // Handle paste per input
            inp.addEventListener('paste', (e: ClipboardEvent) => {
                const text = e.clipboardData?.getData('text') || '';
                const digits = text.replace(/\D/g, '');
                if (!digits) return;
                e.preventDefault();
                for (let i = 0; i < digitInputs.length; i++) {
                    digitInputs[i].value = digits[i] || '';
                }
                // focus the next empty or last
                const next = digitInputs.find(i => !i.value) || digitInputs[digitInputs.length - 1];
                next.focus();
                // After paste, attempt auto-validate
                const allFilled = digitInputs.length > 0 && digitInputs.every(i => i.value && i.value.trim().length === 1);
                if (allFilled) getCodeAndValidate();
            });
        });
        // focus first input
        if (digitInputs.length > 0) digitInputs[0].focus();
    }

    async function getCodeAndValidate() {
        const code = digitInputs.map(i => i.value || '').join('');
        if (!/^[0-9]{6}$/.test(code)) {
            if (errorDiv) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code format.';
            }
            return;
        }
        if (errorDiv) errorDiv.style.display = 'none';
        const res = await fetch('/api/users/twofa/totp/validate', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ twofa_uuid: uuid, totp_code: code })
        });
        if (res.ok) {
            // Notify opener that TOTP setup completed so parent can refresh UI
            try {
                if (window.opener && typeof window.opener.postMessage === 'function') {
                    window.opener.postMessage({ type: 'TWOFA_CREATION_SUCCESS' }, window.location.origin);
                }
            } catch (err) {
                // ignore — best-effort notification
            }
            window.close();
        } else {
            if (errorDiv) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code.';
            }
        }
    }

    // No manual validate button — validation runs automatically when inputs are complete.
});
