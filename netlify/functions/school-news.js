import {json,currentUser} from './_lib.js';
import {getSchoolNews} from './_school_news_feed.js';

export default async(req,context)=>{
 try{
  const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
  if(req.method!=='GET')return json(405,{error:'Metodo non consentito'});
  const query=new URL(req.url).searchParams.get('q')||'';
  const articles=await getSchoolNews(query);
  return json(200,{ok:true,source:'Orizzonte Scuola',sourceUrl:'https://www.orizzontescuola.it/',query,articles});
 }catch(error){console.error('school-news error',{message:String(error?.message||error).slice(0,220)});return json(502,{error:'Notizie temporaneamente non disponibili'});}
};
