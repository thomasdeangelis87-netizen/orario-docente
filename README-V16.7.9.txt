Orario Docente V16.7.9

Modifica Portale Scuole:
- l'accreditamento richiede prima un account Orario Docente autenticato
- se il visitatore non è autenticato, il modulo di accreditamento resta nascosto
- vengono mostrati i pulsanti "Crea il tuo account" e "Ho già un account · Accedi"
- dopo l'accesso il modulo viene visualizzato
- l'email dell'account viene inserita automaticamente nella richiesta e non è modificabile
- il modulo blocca comunque l'invio se non esiste una sessione autenticata
- la pagina di conferma specifica che la richiesta è associata all'account
- nessuna modifica alla logica degli orari scuola/docente

Test:
1. Aprire /scuole.html da browser anonimo: deve apparire prima la registrazione/accesso.
2. Registrarsi/confermare l'email oppure accedere.
3. Tornare su /scuole.html: deve apparire il modulo con l'email account già compilata.
4. Inviare la richiesta.
