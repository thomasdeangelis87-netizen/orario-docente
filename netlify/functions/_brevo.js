function env(name){
  try { return Netlify.env.get(name) || ''; }
  catch { return ''; }
}
function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export async function sendSchoolApprovalEmail({to, schoolName, schoolCode, contactName=''}) {
  const apiKey = env('BREVO_API_KEY');
  if(!apiKey) throw new Error('BREVO_API_KEY non configurata su Netlify');

  const senderEmail = env('BREVO_SENDER_EMAIL') || 'scuole@orariodocente.it';
  const senderName = env('BREVO_SENDER_NAME') || 'Orario Docente';

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
        <p>Il tuo account è già stato associato alla scuola con ruolo di <strong>Amministratore</strong>.</p>
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

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
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
  });

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  if(!response.ok){
    throw new Error(data.message || raw || `Brevo HTTP ${response.status}`);
  }
  return data;
}
