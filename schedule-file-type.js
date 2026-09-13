(function(root){
  async function detectScheduleFileKind(file){
    const name=String(file&&file.name||'').trim().toLowerCase();
    const type=String(file&&file.type||'').trim().toLowerCase();
    if(type==='application/pdf'||name.endsWith('.pdf'))return'pdf';
    if(/spreadsheet|excel|ms-excel/.test(type)||/\.xlsx?$/.test(name))return'excel';
    if(file&&typeof file.slice==='function'){
      const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
      if(String.fromCharCode(...bytes)==='%PDF-')return'pdf';
    }
    return'unknown';
  }
  root.OrarioScheduleFileType={detectScheduleFileKind};
})(typeof window!=='undefined'?window:globalThis);
