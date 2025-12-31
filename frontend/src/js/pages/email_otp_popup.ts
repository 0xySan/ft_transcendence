// Email OTP Popup Logic

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const twoFaToken = params.get('twoFaToken');
    const emailInput = document.getElementById('email-address-input') as HTMLInputElement;
    const sendBtn = document.getElementById('send-email-otp-btn') as HTMLButtonElement;
    const validateBtn = document.getElementById('validate-email-otp-btn') as HTMLButtonElement;
    const otpContainer = document.getElementById('email-otp-container') as HTMLElement;
    const otpInputs = Array.from(document.querySelectorAll<HTMLInputElement>('#email-otp-container .otp-input'));
    const errorDiv = document.getElementById('email-otp-error') as HTMLElement;
    const sendMsgDiv = document.getElementById('email-otp-send-msg') as HTMLElement;

    // Helper: validate email
    function isValidEmail(email: string) {
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    }


    if (sendBtn && emailInput && otpContainer && validateBtn) {
        let timer: number | null = null;
        let cooldown = 60; // seconds
        let firstSend = true;
        let methodUuid: string | undefined = undefined;

        function startCooldown() {
            let remaining = cooldown;
            sendBtn.disabled = true;
            updateSendBtnText(remaining);
            timer = window.setInterval(() => {
                remaining--;
                updateSendBtnText(remaining);
                if (remaining <= 0) {
                    clearInterval(timer!);
                    timer = null;
                    sendBtn.disabled = false;
                    sendBtn.textContent = firstSend ? 'Send Email' : 'Resend';
                }
            }, 1000);
        }

        function updateSendBtnText(remaining: number) {
            sendBtn.textContent = (firstSend ? 'Send Email' : 'Resend') + ` (${remaining}s)`;
        }

        sendBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            errorDiv.style.display = 'none';
            sendMsgDiv.style.display = 'none';
            if (!isValidEmail(email)) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid email address.';
                return;
            }
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            // 1. Create email OTP method via the generic 2FA creation endpoint
            const createOtpMethodIfNeeded = () => {
                if (methodUuid) return Promise.resolve(methodUuid);
                const body: any = { methods: [{ methodType: 0, params: { email } }] };
                if (twoFaToken) body.twoFaToken = twoFaToken;
                return fetch('/api/users/twofa/', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
                .then(res => {
                    if (!res.ok) throw new Error('Failed to create 2FA method.');
                    return res.json();
                })
                .then(data => {
                    // Expecting { results: [ { methodId, success, ... } ] }
                    const first = data && data.results && data.results[0];
                    if (!first) throw new Error('Unexpected response creating 2FA method.');
                    if (first.success === false) {
                        throw new Error(first.message || 'Server reported failure creating 2FA method.');
                    }
                    const id = first.methodId || first.method_id || first.methodId;
                    if (!id) throw new Error('Failed to get OTP method id from creation response.');
                    methodUuid = id;
                    return methodUuid;
                });
            };

            try {
                await createOtpMethodIfNeeded();
            } catch (err: any) {
                errorDiv.style.display = '';
                errorDiv.textContent = err?.message || 'Failed to create email OTP method.';
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Email';
                return;
            }
            // 2. Send email with code using UUID returned from creation
            const sendRes = await fetch(`/api/users/twofa/email/send`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: methodUuid })
            });
            if (!sendRes.ok) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Failed to send email.';
                sendBtn.disabled = false;
                sendBtn.textContent = firstSend ? 'Send Email' : 'Resend';
                return;
            }
            sendMsgDiv.style.display = '';
            sendMsgDiv.textContent = 'Email sent! Please check your inbox.';
            // Show OTP inputs, label and enable them
            if (otpContainer) otpContainer.style.display = '';
            const otpLabel = document.getElementById('email-otp-label') as HTMLElement | null;
            if (otpLabel) otpLabel.style.display = '';
            if (validateBtn) validateBtn.style.display = '';
            otpInputs.forEach(i => { i.disabled = false; i.value = ''; });
            if (otpInputs[0]) otpInputs[0].focus();
            validateBtn.disabled = false;
            // After first send, block email input and change button to 'Resend'
            if (firstSend) {
                emailInput.disabled = true;
                firstSend = false;
            }
            startCooldown();
        });
        // OTP inputs behavior: focus move, backspace, paste, enter
        otpInputs.forEach((input, idx) => {
            input.disabled = true;
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 1);
                if (target.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
                tryAutoSubmit();
            });

            input.addEventListener('keydown', (e) => {
                const ev = e as KeyboardEvent;
                if (ev.key === 'Backspace' && !input.value && idx > 0) {
                    otpInputs[idx - 1].focus();
                } else if (ev.key === 'Enter') {
                    submitOtp();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
                const chars = paste.replace(/[^0-9A-Za-z]/g, '').slice(0, otpInputs.length).split('');
                chars.forEach((ch, i) => { if (otpInputs[i]) otpInputs[i].value = ch; });
                const next = Math.min(chars.length, otpInputs.length - 1);
                if (otpInputs[next]) otpInputs[next].focus();
                tryAutoSubmit();
            });
        });

        function tryAutoSubmit() {
            if (otpInputs.every(i => i.value.length === 1)) submitOtp();
        }

        async function submitOtp() {
            errorDiv.style.display = 'none';
            if (!methodUuid) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'No OTP method created.';
                return;
            }
            const code = otpInputs.map(i => i.value).join('');
            if (!/^[A-Za-z0-9]{6}$/.test(code)) {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code format.';
                return;
            }
            validateBtn.disabled = true;
            const res = await fetch('/api/users/twofa/email/validate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: methodUuid, code })
            });
            if (res.ok) {
                window.close();
            } else {
                errorDiv.style.display = '';
                errorDiv.textContent = 'Invalid code.';
                validateBtn.disabled = false;
                otpInputs.forEach(i => i.value = '');
                if (otpInputs[0]) otpInputs[0].focus();
            }
        }

        validateBtn.addEventListener('click', submitOtp);
    }
});
