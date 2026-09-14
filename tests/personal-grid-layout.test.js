import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('il testo delle celle personali resta contenuto nella propria colonna',()=>{
  assert.match(html,/\.slot \.subject\{[^}]*overflow-wrap:anywhere;[^}]*word-break:break-word;[^}]*white-space:normal/);
  assert.match(html,/\.slot>div\{[^}]*max-width:100%;[^}]*overflow:hidden/);
  assert.match(html,/\.cell\{[^}]*min-width:0;[^}]*overflow:hidden/);
});

test('attivita lunghe ricevono automaticamente font piu piccolo',()=>{
  assert.match(html,/function subjectSizeClass\(value\)/);
  assert.match(html,/length>=11\?'subject-long'/);
  assert.match(html,/subject \$\{subjectSizeClass\(v\[0\]\)\}/);
  assert.match(html,/\.subject\.subject-long\{font-size:clamp\(13px,1vw,14px\)\}/);
  assert.match(html,/\.subject\.subject-xlong\{font-size:clamp\(12px,\.92vw,13px\)\}/);
});

test('orario separato e leggibile anche su mobile',()=>{
  assert.match(html,/\.slot \.time\{font-size:15px;[^}]*white-space:nowrap/);
  assert.match(html,/@media\(max-width:720px\)[^{]*\{[\s\S]*?\.slot \.subject\{font-size:14px\}[\s\S]*?\.slot \.time\{font-size:13px\}/);
});
