const FEED_URL='https://www.orizzontescuola.it/feed/';
const cache=new Map();

function decode(value=''){
 return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
function text(value=''){
 return decode(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function field(block,name){
 const match=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
 return match?decode(match[1]).trim():'';
}
function parseFeed(xml){
 return [...String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,24).map(([,item],index)=>{
  const title=text(field(item,'title')),url=text(field(item,'link')),description=text(field(item,'description'));
  const date=field(item,'pubDate');
  return {id:String(index+1),title,url:url.startsWith('https://www.orizzontescuola.it/')?url:'',summary:description.slice(0,420),publishedAt:date?new Date(date).toISOString():''};
 }).filter(item=>item.title&&item.url);
}
function searchUrl(query=''){
 const q=String(query).trim().slice(0,120);
 return q?`https://www.orizzontescuola.it/?s=${encodeURIComponent(q)}&feed=rss2`:FEED_URL;
}
async function getSchoolNews(query='',fetchImpl=fetch){
 const key=String(query).trim().toLowerCase().slice(0,120),hit=cache.get(key);
 if(hit&&Date.now()-hit.time<10*60*1000)return hit.items;
 const response=await fetchImpl(searchUrl(query),{headers:{accept:'application/rss+xml, application/xml;q=0.9','user-agent':'OrarioDocente/16.11 (+https://orariodocente.it)'}});
 if(!response.ok)throw new Error(`Feed notizie non disponibile (${response.status})`);
 const items=parseFeed(await response.text());
 cache.set(key,{time:Date.now(),items});
 return items;
}

export {FEED_URL,parseFeed,getSchoolNews};
