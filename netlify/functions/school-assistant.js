import OpenAI from 'openai';
import {json,currentUser,getJSON,setJSON} from './_lib.js';
import {getSchoolNews} from './_school_news_feed.js';

const DAILY_LIMIT=20;
const usageKey=(userId,date)=>`ai-usage/${encodeURIComponent(userId)}/${date}`;
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();

export default async(req,context)=>{
 try{
  const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
  if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
  const body=await req.json(),question=clean(body.question).slice(0,600);
  if(question.length<3)return json(400,{error:'Scrivi una domanda più completa'});
  const today=new Date().toISOString().slice(0,10),key=usageKey(user.id,today),usage=(await getJSON(key))||{count:0};
  if(Number(usage.count)>=DAILY_LIMIT)return json(429,{error:'Hai raggiunto il limite giornaliero di 20 domande. Riprova domani.'});
  const articles=(await getSchoolNews(question)).slice(0,8);
  if(!articles.length)return json(200,{ok:true,answer:'Non ho trovato notizie pertinenti nelle fonti disponibili. Prova con parole più specifiche.',sources:[],remaining:DAILY_LIMIT-Number(usage.count)});
  const sources=articles.map((article,index)=>`[${index+1}] ${article.title}\nData: ${article.publishedAt||'non indicata'}\nSintesi fonte: ${article.summary}\nURL: ${article.url}`).join('\n\n');
  const openai=new OpenAI();
  const completion=await openai.chat.completions.create({
   model:'gpt-4o-mini',temperature:0.2,max_tokens:700,
   messages:[
    {role:'system',content:'Sei l’Assistente scuola di Orario Docente. Rispondi in italiano in modo concreto, chiaro e sintetico. Per concetti generali e consolidati del mondo scolastico puoi usare le tue conoscenze e devi dare una risposta utile anche quando le notizie fornite non sono pertinenti. Usa e cita con [1], [2] soltanto le fonti realmente pertinenti: non citare mai una fonte solo perché è presente. Per novità, importi, date, scadenze, norme vigenti o informazioni che possono cambiare, affidati alle fonti fornite; se non bastano, dichiaralo chiaramente e invita a verificare una fonte ufficiale. Non presentare interpretazioni normative come consulenza ufficiale.'},
    {role:'user',content:`Domanda: ${question}\n\nFonti disponibili:\n${sources}`}
   ]
  });
  const answer=clean(completion.choices?.[0]?.message?.content);
  const cited=new Set([...answer.matchAll(/\[(\d+)\]/g)].map(match=>Number(match[1])-1).filter(index=>index>=0&&index<articles.length));
  const answerSources=articles.map((article,index)=>({...article,index})).filter(article=>cited.has(article.index)).map(({title,url,publishedAt,index})=>({title,url,publishedAt,citation:index+1}));
  await setJSON(key,{count:Number(usage.count)+1,updatedAt:new Date().toISOString()});
  return json(200,{ok:true,answer:answer||'Non sono riuscito a formulare una risposta.',sources:answerSources,remaining:Math.max(0,DAILY_LIMIT-Number(usage.count)-1)});
 }catch(error){
  console.error('school-assistant error',{name:error?.name,code:error?.code||'',message:String(error?.message||error).slice(0,240)});
  return json(502,{error:'Assistente temporaneamente non disponibile. Riprova tra poco.'});
 }
};
