(function(root){
  async function dispatchSchoolScheduleUpload(file,handlers,detectFileKind){
    if(!file)throw new Error('Nessun file selezionato.');
    const kind=await detectFileKind(file);
    if(kind==='pdf')return handlers.pdf(file);
    if(kind==='excel')return handlers.excel(file);
    throw new Error(`Formato non supportato (${file.type||file.name||'sconosciuto'}). Seleziona un file Excel (.xlsx/.xls) o PDF (.pdf).`);
  }
  root.OrarioSchoolUploadDispatcher={dispatchSchoolScheduleUpload};
})(typeof window!=='undefined'?window:globalThis);
