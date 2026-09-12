ORARIO DOCENTE V16.7

Correzioni:
1. La schermata "Completa il tuo profilo" è realmente one-shot.
   - Se un account possiede già nome/cognome/full_name, non viene più mostrata.
   - Gli account provenienti dalle versioni precedenti vengono marcati automaticamente come profilo completato.
   - Dopo il primo salvataggio i dati si modificano soltanto da Profilo.
   - Non è più obbligatorio avere sia nome che cognome per evitare un loop del popup.

2. Importazione del proprio orario dalla scuola.
   - Il pannello compare ogni volta che è effettivamente presente un orario scuola con docenti.
   - Non dipende più da flag temporanei schoolCloudReady/schoolCode.
   - Dopo il caricamento del contesto cloud il pannello viene ridisegnato esplicitamente.
   - Resta il selettore della dicitura ufficiale (es. AMABILE R.) e il pulsante Importa il mio orario dalla scuola.

3. Versione visibile.
   - In fondo alla pagina compare V16.7 per capire immediatamente se il browser sta mostrando l'ultimo deploy.

TEST:
- login Roberto
- non deve aprirsi il popup profilo se i dati sono già stati salvati
- Orario scuola: deve comparire "Il mio orario dalla scuola"
- selezionare AMABILE R. e importare
- Il mio orario deve mostrare soltanto le classi di Roberto
