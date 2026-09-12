ORARIO DOCENTE V16.7.2

BASE STABILE: V16.7.1 / V16.7.

NON TOCCATO:
- pulsante "Importa il mio orario dalla scuola"
- selettore docente ufficiale
- AMABILE R.
- classi dinamiche sotto l'orario
- parsing/importazione orario
- Orario scuola
- orari e griglia

CORREZIONE UNICA:
Il profilo e l'orario personale vengono ora salvati anche in Netlify Blobs con chiave basata sull'EMAIL dell'utente.

Motivo:
con il login Google, user_metadata di Netlify Identity non stava risultando affidabile al nuovo accesso.
Per questo l'app mostrava di nuovo "Completa il tuo profilo" e sembrava aver perso tutto.

Da V16.7.2:
- Salva e continua -> salva il profilo persistente per email
- Importa orario -> l'autosave salva anche l'orario persistente per email
- logout/login Google -> rilegge il profilo persistente prima di mostrare l'app
- profileCompleted resta salvato nel backend
- Identity metadata resta solo come copia di compatibilità

TEST:
1. Pubblicare V16.7.2
2. Accedere con Google come Roberto
3. Inserire i dati UNA SOLA VOLTA e salvare
4. Importare AMABILE R.
5. Uscire
6. Rientrare con Google
7. Non deve comparire onboarding e deve ritrovare profilo/orario/classi.
