const {json}=require('./_lib');
exports.handler=async()=>json(200,{ok:true,service:'Orario Docente Cloud',version:16});
