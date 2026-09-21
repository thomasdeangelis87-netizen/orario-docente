import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseFeed,getSchoolNews} from '../netlify/functions/_school_news_feed.js';

const xml=`<?xml version="1.0"?><rss><channel><item>
 <title><![CDATA[Graduatorie &amp; supplenze: le novità]]></title>
 <link>https://www.orizzontescuola.it/graduatorie-novita/</link>
 <pubDate>Mon, 21 Sep 2026 10:00:00 +0000</pubDate>
 <description><![CDATA[<p>Una <strong>sintesi</strong> della notizia.</p>]]></description>
</item><item><title>Sito estraneo</title><link>https://example.com/x</link></item></channel></rss>`;

test('legge il feed senza copiare HTML e accetta solo collegamenti della fonte',()=>{
 const articles=parseFeed(xml);
 assert.equal(articles.length,1);
 assert.equal(articles[0].title,'Graduatorie & supplenze: le novità');
 assert.equal(articles[0].summary,'Una sintesi della notizia.');
 assert.match(articles[0].url,/^https:\/\/www\.orizzontescuola\.it\//);
});

test('la ricerca usa il feed remoto fissato e restituisce articoli normalizzati',async()=>{
 let requested='';
 const articles=await getSchoolNews('graduatorie gps',async url=>{requested=url;return new Response(xml,{status:200})});
 assert.match(requested,/^https:\/\/www\.orizzontescuola\.it\/\?s=/);
 assert.match(requested,/feed=rss2/);
 assert.equal(articles[0].id,'1');
});

test('UI e Functions espongono notizie, ricerca, assistente e fonti',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const news=fs.readFileSync(new URL('../netlify/functions/school-news.js',import.meta.url),'utf8');
 const assistant=fs.readFileSync(new URL('../netlify/functions/school-assistant.js',import.meta.url),'utf8');
 assert.match(html,/data-view="schoolNewsView"/);
 assert.match(html,/Chiedi all’Assistente scuola/);
 assert.match(html,/apiCall\('school-news'/);
 assert.match(html,/apiCall\('school-assistant'/);
 assert.match(news,/currentUser\(req,context\)/);
 assert.match(assistant,/model:'gpt-4o-mini'/);
 assert.match(assistant,/DAILY_LIMIT=20/);
 assert.match(assistant,/usando esclusivamente le fonti fornite/);
});
