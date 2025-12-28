// Backup Codes Popup Logic
// Expects: ?codes=... (array of codes)

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const codesParam = params.get('codes');
    const codes = codesParam ? JSON.parse(codesParam) : [];
    const listDiv = document.getElementById('backup-codes-list');
    if (listDiv && Array.isArray(codes)) {
        listDiv.innerHTML = '<ul>' + codes.map((c: string) => `<li><code>${c}</code></li>`).join('') + '</ul>';
    }
    const closeBtn = document.getElementById('close-backup-codes-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => window.close());
    }
});
