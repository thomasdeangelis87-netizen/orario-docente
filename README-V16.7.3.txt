ORARIO DOCENTE V16.7.3

Base: V16.7.2, mantenendo il salvataggio persistente per email.

NOVITÀ 1 — PROFILO GIÀ NELLA REGISTRAZIONE
- Premendo "Crea un account" si inseriscono prima:
  Nome, Cognome, Materia insegnata, Classe di concorso.
- Poi si apre la registrazione Netlify Identity email/password.
- Al primo accesso quei dati vengono applicati e salvati automaticamente.
- Se l'utente cambia dispositivo prima del primo login, resta disponibile il normale onboarding di sicurezza.

NOVITÀ 2 — NESSUN DATO THOMAS COME ESEMPIO
- rimossi placeholder "Thomas" e "De Angelis"
- rimossa la classe personale 5° BE dagli esempi visibili
- i dati reali di Thomas restano solo nel suo account dedicato, non nell'interfaccia degli altri utenti

NOVITÀ 3 — COMPRESENZE
- l'import personale non cerca più soltanto e.teacher === docente
- importa anche celle come:
  "MAIORINO F. + BRIENZA"
  "MAIORINO F. / BRIENZA"
  "MAIORINO F. & BRIENZA"
- quindi Francesco Maiorino riceve sia le ore da solo sia le ore in compresenza.
- il filtro usa delimitatori, evitando semplici corrispondenze casuali per sottostringa.

NON MODIFICATI:
- collegamento scuola
- selettore docente ufficiale
- classi dinamiche sotto Il mio orario
- salvataggio persistente V16.7.2
- griglia e orari
