Orario Docente V16.8.1

PANNELLO AMMINISTRATORE SISTEMA
- /admin.html è ora separato dall'accesso docente.
- Per entrare basta la sola PLATFORM_ADMIN_KEY.
- Non serve Netlify Identity / login docente.
- Dopo l'accesso appare un pannello di controllo.
- Il pannello mostra le richieste di accreditamento.
- Da lì si approva la scuola e si genera il codice scuola.
- Resta disponibile l'attivazione manuale.

Sicurezza:
- La chiave non viene salvata in localStorage/sessionStorage.
- Rimane solo nella memoria della pagina fino a "Esci" o chiusura/refresh.

PASSO FUTURO:
- verifica automatica scuola (codice meccanografico, dominio istituzionale, fonti ufficiali)
- auto-approvazione solo se i controlli sono positivi
- revisione manuale per i casi dubbi.
