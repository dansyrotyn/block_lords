'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
execFileSync(process.execPath,[path.join(root,'build.js')],{cwd:root,stdio:'pipe'});
const page = fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
assert.match(page,/<title>Block Lords<\/title>/);
assert.match(page,/id="playBtn"/);
assert.match(page,/data:image\/png;base64,/);
assert.doesNotMatch(page,/__(?:HOME|MAP|BOARD|HERO|MAGIC|RAT|BANDIT|ORC|DEMON)__/);
assert.doesNotMatch(page,/\/\*(?:ENGINE|CAMPAIGN|RPG_UI|DEBUG_TOOLS|DEBUG_UI|MAP_CSS|DEBUG_CSS)\*\//);
for (const script of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
console.log('ok - canonical index contains the complete built game and valid scripts');

for (const base of ['http://localhost:8765/','https://dansyrotyn.github.io/block_lords/']) {
  for (const file of ['index.html','dist/blockbusters.html']) {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const current = new URL(file+'?seed=7#map',base);
    let destination;
    vm.runInNewContext(script,{window:{location:{search:current.search,hash:current.hash,replace:target=>{destination = new URL(target,current);}}}});
    assert.equal(destination.href,new URL('dist/index.html?seed=7#map',base).href);
    const meta = html.match(/http-equiv="refresh" content="0; url=([^"]+)"/)[1];
    const link = html.match(/<a href="([^"]+)"/)[1];
    assert.equal(new URL(meta,current).pathname,new URL('dist/index.html',base).pathname);
    assert.equal(meta,link);
  }
}
assert.ok(fs.existsSync(path.join(root,'.nojekyll')));
assert.ok(fs.existsSync(path.join(root,'dist/.nojekyll')));
console.log('ok - root and legacy URLs resolve correctly at localhost and under the Pages project path');
