(() => {
    const button = document.getElementById('copy');
    const command = document.getElementById('command');
    const feedback = document.getElementById('copy-feedback');
    if (!button || !command) return;
    button.addEventListener('click', async () => {
        const text = command.textContent.trim();
        try {
            await navigator.clipboard.writeText(text);
            feedback.textContent = 'Copié ! Dans Termux : appui long → Coller, puis Entrée.';
        } catch (_error) {
            const range = document.createRange();
            range.selectNodeContents(command);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            feedback.textContent = 'Le texte est sélectionné : copie-le à la main.';
        }
    });
})();
