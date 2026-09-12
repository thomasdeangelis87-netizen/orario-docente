ORARIO DOCENTE V15 — PORTALE SCUOLE

Novità principali:
- nuova pagina pubblica /scuole.html per l'accreditamento degli istituti;
- form dedicato a Dirigente, DSGA, segreteria, referente orario o docente delegato;
- raccolta codice meccanografico, dati scuola e referente;
- caricamento del file dell'orario completo (.xlsx, .xls o .pdf);
- honeypot anti-spam per Netlify Forms;
- pagina di conferma /grazie-scuola.html;
- link “Sei una scuola? Accreditati” nella schermata di accesso;
- link “Portale scuole” nella barra strumenti dell'app;
- service worker aggiornato alla V15.

FLUSSO PREVISTO
1) La scuola invia la richiesta dal Portale Scuole.
2) La richiesta compare nelle Forms del progetto Netlify.
3) La richiesta viene verificata.
4) Nella fase backend successiva verrà creato lo spazio scuola e assegnato il codice univoco.
5) Il referente potrà caricare/sostituire l'orario generale e i docenti collegati potranno ricevere gli aggiornamenti.

IMPORTANTE
Questa V15 realizza davvero il flusso di ACCREDITAMENTO e RACCOLTA RICHIESTE su Netlify Forms.
Non realizza ancora il database condiviso dell'orario scuola: quello è il passaggio backend successivo.
