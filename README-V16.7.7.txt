Orario Docente V16.7.7

Correzione backend Netlify Blobs:
- aggiornata l'inizializzazione getStore() alla firma corrente supportata da Netlify:
  getStore({ name: 'orario-docente-cloud', consistency: 'strong' })
- applicata sia a _lib.js sia a profile.js
- aggiunto health check del Blob store
- nessuna modifica alla logica di orario personale, compresenze, import scuola o profili

Test consigliato dopo il deploy:
1. Aprire https://orariodocente.it/.netlify/functions/health
2. Deve comparire blobs:"ok" e version:"16.7.7"
3. Entrare con Francesco Maiorino e aprire Orario scuola
4. Verificare che tornino docenti, classi e impegni condivisi
