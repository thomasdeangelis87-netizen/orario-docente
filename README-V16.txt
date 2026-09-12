ORARIO DOCENTE V16 — SCUOLA CONDIVISA NEL CLOUD

NOVITÀ
- Backend centrale con Netlify Functions + Netlify Blobs.
- Il codice scuola collega un docente a un istituto reale attivo.
- Ruoli: Docente, Referente orario, Amministratore scuola.
- Referenti/amministratori possono pubblicare l'orario generale una volta sola.
- I docenti collegati scaricano automaticamente l'ultima versione condivisa.
- Area scuola separata: /area-scuola.html
- Amministrazione piattaforma: /admin.html
- Portale accreditamento: /scuole.html

FLUSSO
1. La scuola invia la richiesta su /scuole.html.
2. L'amministratore della piattaforma verifica la richiesta in Netlify Forms.
3. Da /admin.html attiva la scuola e genera il codice.
4. Il primo amministratore della scuola entra in /area-scuola.html.
5. Può autorizzare docenti/referenti via email.
6. Da Orario Docente > Orario scuola il referente carica l'Excel completo.
7. L'orario viene salvato nel cloud e diventa disponibile a tutti gli utenti collegati.

IMPORTANTE PER IL DEPLOY V16
La V16 usa funzioni serverless e @netlify/blobs. A differenza delle versioni statiche precedenti, il semplice drag&drop della sola cartella pubblica non è sufficiente a costruire le funzioni con le dipendenze.
È consigliato collegare il progetto a un repository Git oppure usare Netlify CLI / una build Netlify del progetto completo, includendo package.json, netlify.toml e netlify/functions.

CONFIGURAZIONE
Impostare in Netlify una variabile d'ambiente:
PLATFORM_ADMIN_KEY = una chiave segreta lunga e casuale
La chiave serve soltanto alla pagina /admin.html per attivare le scuole verificate.

SICUREZZA
- Le API richiedono un utente Netlify Identity autenticato.
- Un utente che conosce il codice scuola entra come Docente.
- Solo Referente orario e Amministratore scuola possono pubblicare l'orario.
- Solo l'Amministratore scuola può assegnare ruoli di gestione.
- Il file Excel viene trasformato nel browser in dati strutturati; nel cloud viene salvato l'orario strutturato, non necessariamente il file Excel originale.
