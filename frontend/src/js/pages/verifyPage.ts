export {};

const params = new URLSearchParams(window.location.search);
const user: string | null = params.get('user');
const token: string | null = params.get('token');

let verifyTitle: HTMLElement | null = document.getElementById('verify-title');
let verifyParagraph: HTMLParagraphElement | null = document.getElementById('verify-p') as HTMLParagraphElement | null;

function setMessage(title: string, paragraph: string, colorVar: string) {
	if (verifyTitle) {
		verifyTitle.textContent = title;
		verifyTitle.style.color = `rgb(var(${colorVar}))`;
	}
	if (verifyParagraph) {
		verifyParagraph.textContent = paragraph;
		verifyParagraph.style.color = `rgb(var(${colorVar}))`;
	}
}

if (!user || !token) {
	setMessage(
		"Verification Error",
		"Invalid verification link. Please check your email and try again.",
		"--red"
	);
} else {
	fetch('/api/users/accounts/verify', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ user, token })
	})
	.then(async res => {
		const data = await res.json();
		if (res.ok) {
			setMessage(
				"Verification Successful!",
				"Your email has been verified. You can now log in to your account.",
				"--green"
			);
		} else {
			setMessage(
				"Verification Failed",
				data.message || "An error occurred during verification. Please try again.",
				"--yellow"
			);
		}
	})
	.catch(err => {
		console.error('Verification error:', err);
		setMessage(
			"Verification Error",
			"An unexpected error occurred. Please try again later.",
			"--red"
		);
	});
}
