Orario Docente V16.8.2

EMAIL AUTOMATICHE BREVO
- Usa BREVO_API_KEY dalle variabili protette Netlify.
- Mittente predefinito: Orario Docente <scuole@orariodocente.it>.
- Approvazione scuola: genera codice, collega l'account come amministratore e invia automaticamente l'email.
- Il pannello mostra se l'email è stata inviata.
- Aggiunto pulsante "Reinvia email" per scuole già approvate.
- Anche l'attivazione manuale prova a inviare l'email.
- Se Brevo non risponde, la scuola resta comunque approvata e il pannello segnala l'errore.

Variabili opzionali:
BREVO_SENDER_EMAIL
BREVO_SENDER_NAME

Sicurezza:
- BREVO_API_KEY non è presente nel codice.
- PLATFORM_ADMIN_KEY resta letta solo lato server.
