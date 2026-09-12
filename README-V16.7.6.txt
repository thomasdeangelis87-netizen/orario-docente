ORARIO DOCENTE — V16.7.6

Patch stabilità cloud scuola sul dominio ufficiale.

Novità:
- lettura Netlify Blobs con consistenza strong per scuola/orario condiviso;
- retry automatico una volta sulle risposte cloud 5xx durante il caricamento scuola;
- se l'account è già collegato allo stesso codice scuola, il pulsante aggiorna i dati senza rifare l'iscrizione;
- join-school reso idempotente per account già collegati alla stessa scuola;
- messaggi di errore cloud mostrano anche il dettaglio backend, utile per diagnosi;
- nessuna modifica alla logica di importazione personale, compresenze e profili;
- cache PWA aggiornata a V16.7.6.

Test consigliato dopo il deploy:
1. aprire orariodocente.it in una nuova scheda;
2. entrare con Francesco Maiorino;
3. aprire Orario scuola;
4. verificare che docenti/classi/impegni vengano caricati;
5. se necessario premere Collega scuola sul codice già presente: ora esegue un refresh dei dati invece di ricreare il collegamento.
