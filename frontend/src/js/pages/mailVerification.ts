export {};

const emailSpanElement = document.getElementById('verification-email') as HTMLSpanElement | null;

/** Populate the verification email span with the user's email from localStorage
 * 
 */
function populateVerificationEmail(): void {
    const userEmail = localStorage.getItem('userEmailForVerification') || '[ADDRESS]';
    localStorage.removeItem('userEmailForVerification');
    // Update the span element with the user's email
    if (emailSpanElement) {
        emailSpanElement.textContent = userEmail;
    }
}

populateVerificationEmail();