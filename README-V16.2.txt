ORARIO DOCENTE V16.2

Correzione backend Cloud Scuole:
- migrazione delle funzioni alla sintassi moderna Netlify Functions v2
- Netlify Blobs inizializzato nel contesto della richiesta
- autenticazione server aggiornata con @netlify/identity
- messaggi diagnostici completi anche per gli errori Blobs
- health aggiornato a versione 16.2

Procedura:
1. Caricare il contenuto della cartella nel repository GitHub orario-docente.
2. Commit changes.
3. Attendere il deploy automatico Netlify.
4. Verificare /.netlify/functions/health: deve mostrare version 16.2.
5. Riprovare admin.html.
