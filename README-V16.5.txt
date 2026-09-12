ORARIO DOCENTE V16.5

Correzione decisiva importazione docente:
- corretto bug: schoolData.teachers contiene oggetti {name, subject}; le versioni precedenti li confrontavano come stringhe e quindi il match falliva
- il pannello "Il mio orario dalla scuola" ora compare sempre a un docente collegato se esiste un orario scuola pubblicato
- aggiunto menu con tutti i docenti dell'orario ufficiale
- il docente può associare una volta il proprio account alla dicitura esatta del file (es. Roberto Amabile -> AMABILE R.)
- l'associazione viene salvata nel profilo online
- il nome profilo NON deve essere alterato per imitare il formato Excel
- importazione usa il nome ufficiale scelto e salva l'orario personale online
- gestiti anche eventuali impegni multipli nella stessa ora

TEST:
1. Accedere come Roberto Amabile.
2. Aprire Orario scuola.
3. Nel riquadro "Il mio orario dalla scuola", scegliere AMABILE R.
4. Premere "Importa il mio orario dalla scuola".
5. Aprire "Il mio orario".
