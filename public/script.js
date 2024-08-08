document.getElementById('scrapeButton').addEventListener('click', async () => {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = 'Esecuzione in corso...';

    try {
        const response = await fetch('/playlist', { method: 'POST' });
        if (response.ok) {
            statusMessage.textContent = 'Dati aggiornati con successo!';
        } else {
            statusMessage.textContent = 'Errore durante l\'aggiornamento dei dati.';
        }
    } catch (error) {
        statusMessage.textContent = 'Errore: ' + error.message;
    }
});
