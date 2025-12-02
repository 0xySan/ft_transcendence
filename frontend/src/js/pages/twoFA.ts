export {};

declare function addListener(target: EventTarget, event: string, handler: EventListenerOrEventListenerObject): void;
declare function translatePage(language: string): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;

addListener(document, 'DOMContentLoaded', () => {
	const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));

	inputs.forEach((input, index) => {
		addListener(input, 'input', (e) => {
			const target = e.target as HTMLInputElement;
			const value = target.value;

			// Only keep one numeric character
			target.value = value.replace(/[^0-9]/g, '').slice(0, 1);

			// Move to next input if filled
			if (target.value && index < inputs.length - 1) {
				inputs[index + 1].focus();
			}

			// If all are filled, you can trigger verification here
			if (inputs.every((i) => i.value.length === 1)) {
				const code = inputs.map((i) => i.value).join('');
				console.log('2FA code:', code);
				// trigger your verification logic here
			}
		});

		addListener(input, 'keydown', (e) => {
			const event = e as KeyboardEvent
			// Move backward on Backspace if empty
			if (event.key === 'Backspace' && !input.value && index > 0) {
				inputs[index - 1].focus();
			}
		});

		addListener(input, 'paste', (e) => {
			const event = e as ClipboardEvent;
			e.preventDefault();
			const paste = event.clipboardData?.getData('text') ?? '';
			
			// Check if paste contains only numbers
			const onlyNumbers = /^\d+$/.test(paste);
			if (!onlyNumbers) return;

			// Limit to number of inputs
			const digits = paste.slice(0, inputs.length);
			if (!digits.length) return;

			digits.split('').forEach((char, i) => {
				if (inputs[i]) inputs[i].value = char;
			});

			// Focus last filled or next empty input
			const nextIndex = Math.min(digits.length, inputs.length - 1);
			inputs[nextIndex].focus();

			if (digits.length === inputs.length) {
				console.log('2FA code:', digits);
			}
		});
	});
});
