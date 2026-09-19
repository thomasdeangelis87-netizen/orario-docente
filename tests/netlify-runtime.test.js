import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('il runtime Netlify soddisfa il requisito di @netlify/identity',()=>{
  const config=fs.readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
  const app=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const identity=JSON.parse(fs.readFileSync(new URL('../node_modules/@netlify/identity/package.json',import.meta.url),'utf8'));
  assert.equal(identity.engines.node,'>=22.12.0');
  assert.match(config,/\[build\.environment\][\s\S]*NODE_VERSION\s*=\s*"22\.12\.0"/);
  assert.equal(app.engines.node,'>=22.12.0');
});
