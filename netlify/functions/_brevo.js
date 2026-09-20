function env(name){
  try { return Netlify.env.get(name) || ''; }
  catch { return ''; }
}
function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export class SchoolEmailError extends Error {
  constructor(code,message,{status=0}={}){
    super(message);
    this.name='SchoolEmailError';
    this.code=code;
    this.status=status;
  }
}

export function schoolEmailConfiguration(){
  return {
    configured:!!env('BREVO_API_KEY'),
    senderEmail:env('BREVO_SENDER_EMAIL') || 'scuole@orariodocente.it',
    senderName:env('BREVO_SENDER_NAME') || 'Orario Docente'
  };
}

export async function sendSchoolApprovalEmail({to, schoolName, schoolCode, contactName='',accountLinked=true}) {
  const apiKey=env('BREVO_API_KEY');
  if(!apiKey) throw new SchoolEmailError('email_provider_not_configured','Servizio email non configurato su Netlify');
  if(!String(to||'').includes('@'))throw new SchoolEmailError('invalid_recipient','Indirizzo email destinatario non valido');

  const {senderEmail,senderName}=schoolEmailConfiguration();

  const safeSchool = escapeHtml(schoolName || 'la tua scuola');
  const safeCode = escapeHtml(schoolCode || '');
  const safeName = escapeHtml(contactName || '');
  const greeting = safeName ? `Ciao ${safeName},` : 'Buongiorno,';

  const htmlContent = `<!doctype html>
  <html lang="it"><body style="margin:0;background:#f4f8fc;font-family:Arial,sans-serif;color:#10233f">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px">
      <div style="background:#0b2a5b;color:#fff;border-radius:18px 18px 0 0;padding:24px">
        <h1 style="margin:0;font-size:24px">Orario Docente</h1>
        <p style="margin:8px 0 0">Accreditamento scuola approvato</p>
      </div>
      <div style="background:#fff;border:1px solid #dfe7f0;border-top:0;border-radius:0 0 18px 18px;padding:26px">
        <p>${greeting}</p>
        <p>la richiesta di accreditamento per <strong>${safeSchool}</strong> è stata approvata.</p>
        <p>${accountLinked
          ? 'Il tuo account è già stato associato alla scuola con ruolo di <strong>Amministratore</strong>: non devi inserire il codice per amministrarla.'
          : 'L’accreditamento è attivo. Completa la conferma del tuo account e accedi con questo indirizzo; il codice resta disponibile per il collegamento alla scuola.'}</p>
        <div style="background:#eef4fb;border-radius:14px;padding:18px;margin:22px 0;text-align:center">
          <div style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#5d6f86">Codice scuola</div>
          <div style="font-size:30px;font-weight:700;margin-top:7px">${safeCode}</div>
        </div>
        <p>Puoi accedere a <a href="https://orariodocente.it/" style="color:#0b2a5b;font-weight:700">orariodocente.it</a> con lo stesso account utilizzato per l'accreditamento.</p>
        <p>Il codice scuola può essere comunicato ai docenti autorizzati che devono collegarsi all'istituto.</p>
        <p style="margin-top:26px">Cordiali saluti,<br><strong>Orario Docente</strong></p>
      </div>
      <p style="font-size:12px;color:#6d7f94;text-align:center;margin-top:16px">Messaggio automatico inviato da scuole@orariodocente.it</p>
    </div>
  </body></html>`;

  let response;
  try{response=await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: contactName || undefined }],
      replyTo: { email: senderEmail, name: senderName },
      subject: 'Orario Docente – Scuola accreditata',
      htmlContent
    })
  });}catch(error){
    throw new SchoolEmailError('email_provider_unreachable','Servizio email temporaneamente non raggiungibile',{status:0,cause:error});
  }

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  if(!response.ok){
    console.error('Brevo delivery rejected',{status:response.status,code:data.code||'',message:String(data.message||'').slice(0,160)});
    throw new SchoolEmailError('email_provider_rejected',data.message || `Invio email rifiutato dal provider (HTTP ${response.status})`,{status:response.status});
  }
  return data;
}

export async function sendSchoolScheduleUpdateEmail({to, schoolName, validFrom='', contactName=''}) {
  const apiKey=env('BREVO_API_KEY');
  if(!apiKey) throw new SchoolEmailError('email_provider_not_configured','Servizio email non configurato su Netlify');
  if(!String(to||'').includes('@'))throw new SchoolEmailError('invalid_recipient','Indirizzo email destinatario non valido');

  const {senderEmail,senderName}=schoolEmailConfiguration();
  const safeSchool=escapeHtml(schoolName||'La tua scuola');
  const safeName=escapeHtml(contactName||'');
  const safeDate=escapeHtml(validFrom||'');
  const greeting=safeName?`Ciao ${safeName},`:'Buongiorno,';
  const dateLine=safeDate?`<p>Il nuovo orario è indicato come in vigore dal <strong>${safeDate}</strong>.</p>`:'';
  const htmlContent=`<!doctype html><html lang="it"><body style="margin:0;background:#f4f8fc;font-family:Arial,sans-serif;color:#10233f">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px">
      <div style="background:#0b2a5b;color:#fff;border-radius:18px 18px 0 0;padding:24px"><h1 style="margin:0;font-size:24px">Orario Docente</h1><p style="margin:8px 0 0">Nuovo orario disponibile</p></div>
      <div style="background:#fff;border:1px solid #dfe7f0;border-top:0;border-radius:0 0 18px 18px;padding:26px">
        <p>${greeting}</p><p><strong>${safeSchool}</strong> ha pubblicato un nuovo orario e gli impegni associati al tuo docente risultano modificati.</p>${dateLine}
        <p>Il tuo orario personale <strong>non è stato sostituito automaticamente</strong>. Accedi all’app, controlla le modifiche e premi “Aggiorna il mio orario” soltanto quando vuoi applicarle.</p>
        <p style="margin:26px 0"><a href="https://orariodocente.it/" style="display:inline-block;background:#0b2a5b;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Apri Orario Docente</a></p>
        <p>Cordiali saluti,<br><strong>Orario Docente</strong></p>
      </div>
    </div></body></html>`;

  let response;
  try{response=await fetch('https://api.brevo.com/v3/smtp/email',{
    method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},
    body:JSON.stringify({sender:{name:senderName,email:senderEmail},to:[{email:to,name:contactName||undefined}],replyTo:{email:senderEmail,name:senderName},subject:`Nuovo orario disponibile – ${schoolName||'Orario Docente'}`,htmlContent})
  })}catch(error){
    throw new SchoolEmailError('email_provider_unreachable','Servizio email temporaneamente non raggiungibile',{status:0,cause:error});
  }
  const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!response.ok){
    console.error('Brevo schedule update rejected',{status:response.status,code:data.code||'',message:String(data.message||'').slice(0,160)});
    throw new SchoolEmailError('email_provider_rejected',data.message||`Invio email rifiutato dal provider (HTTP ${response.status})`,{status:response.status});
  }
  return data;
}

export async function sendSchoolLinkRequestEmail({to,schoolName,teacherName='',teacherEmail=''}){
  const apiKey=env('BREVO_API_KEY');
  if(!apiKey)throw new SchoolEmailError('email_provider_not_configured','Servizio email non configurato su Netlify');
  if(!String(to||'').includes('@'))throw new SchoolEmailError('invalid_recipient','Indirizzo email destinatario non valido');
  const {senderEmail,senderName}=schoolEmailConfiguration();
  const safeSchool=escapeHtml(schoolName||'la scuola'),safeTeacher=escapeHtml(teacherName||teacherEmail||'Un docente'),safeEmail=escapeHtml(teacherEmail||'');
  const htmlContent=`<!doctype html><html lang="it"><body style="margin:0;background:#f4f8fc;font-family:Arial,sans-serif;color:#10233f">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px">
      <div style="background:#0b2a5b;color:#fff;border-radius:18px 18px 0 0;padding:24px"><h1 style="margin:0;font-size:24px">Orario Docente</h1><p style="margin:8px 0 0">Nuova richiesta di collegamento</p></div>
      <div style="background:#fff;border:1px solid #dfe7f0;border-top:0;border-radius:0 0 18px 18px;padding:26px">
        <p><strong>${safeTeacher}</strong>${safeEmail?` (${safeEmail})`:''} ha chiesto di collegarsi a <strong>${safeSchool}</strong>.</p>
        <p>Accedi al <strong>Portale scuola</strong>, apri “Richieste di collegamento” e scegli Approva oppure Rifiuta. Dopo l’approvazione il docente verrà collegato automaticamente.</p>
        <p style="margin:26px 0"><a href="https://orariodocente.it/" style="display:inline-block;background:#0b2a5b;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Apri il Portale scuola</a></p>
        <p>Cordiali saluti,<br><strong>Orario Docente</strong></p>
      </div>
    </div></body></html>`;
  let response;
  try{response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},body:JSON.stringify({sender:{name:senderName,email:senderEmail},to:[{email:to}],replyTo:{email:senderEmail,name:senderName},subject:`Richiesta collegamento docente – ${schoolName||'Orario Docente'}`,htmlContent})})}
  catch(error){throw new SchoolEmailError('email_provider_unreachable','Servizio email temporaneamente non raggiungibile',{status:0,cause:error})}
  const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!response.ok)throw new SchoolEmailError('email_provider_rejected',data.message||`Invio email rifiutato dal provider (HTTP ${response.status})`,{status:response.status});
  return data;
}
