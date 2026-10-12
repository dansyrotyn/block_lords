const assert = require('node:assert/strict');
const BD = require('../src/engine.js'), C = require('../src/campaign.js'), D = require('../src/debug-tools.js');
let count = 0;
const test = (name,fn) => { D.resetBalance(); fn(); count++; console.log('ok -',name); };
test('sandbox restores out-of-order victories without unlocking the normal save',()=>{
  const normal = C.create(), testProfile = D.restoreProfile({...normal,cleared:[11,6,11,-1,200]});
  assert.deepEqual(testProfile.cleared,[6,11]); assert.deepEqual(C.restore(testProfile).cleared,[]);
  assert.deepEqual(normal.cleared,[]); assert.notEqual(D.KEY,C.KEY);
});
test('battle overrides are bounded and a zero seed stays reproducible',()=>{
  const o = D.makeBattle(C.create(),11,{heroHp:333,enemyArmor:900,heroAttack:-2,enemyHp:'bad',coinCount:90,seed:0,first:'0'});
  assert.equal(o.hero.hp,333); assert.equal(o.enemy.armor,.6); assert.equal(o.hero.attack,.1);
  assert.equal(o.enemy.hp,225); assert.equal(o.coinCount,64); assert.equal(o.seed,0); assert.equal(o.first,0);
  const a = BD.newGame(o.seed,o.first,{players:[o.hero,o.enemy],coinCount:16,coinGold:5});
  const b = BD.newGame(o.seed,o.first,{players:[o.hero,o.enemy],coinCount:16,coinGold:5});
  assert.deepEqual(a,b); assert.equal(a.coins.filter(Boolean).length,16); assert.ok(a.coins.every(v=>v===0||v===5));
});
test('a locked boss settles only in the test profile and pays once',()=>{
  const normal = C.create(), p = D.restoreProfile(normal), battle = {id:'test-boss',node:11,winner:0,loot:2,gold:5,collected:1};
  assert.equal(C.settle(normal,battle),null);
  const options = {test:true,enemy:{...C.ENEMIES[11],reward:123},coinCount:16,coinGold:5};
  const result = C.settle(p,battle,options);
  assert.equal(result.total,256); assert.equal(p.stats.tower,1); assert.ok(p.cleared.includes(11));
  assert.equal(C.settle(p,battle,options),null); assert.equal(normal.gold,60);
  assert.ok(D.restoreProfile(p).cleared.includes(11));
});
test('extended test coins are included in gold and quest settlement',()=>{
  const p = C.create(), options = {test:true,coinCount:16,coinGold:5};
  const result = C.settle(p,{id:'coins16',node:0,winner:1,loot:1.5,gold:80,collected:16},options);
  assert.equal(result.field,120); assert.equal(p.stats.coins,16);
});
test('balance changes affect damage and timer, then reset exactly',()=>{
  D.applyBalance({engine_lineBase:23,engine_bombPerBlock:7,engine_rounds:4,engine_turnSeconds:120,engine_specialChance:200,engine_startBlocks:999,
    rpg_hpPerLevel:25,rpg_coinCount:12,upgrade_hp_base:70,upgrade_hp_step:12,upgrade_hp_cap:20,quest_play_target:2,quest_play_reward:77});
  assert.equal(BD.CONFIG.lineBase,23); assert.equal(BD.CONFIG.specialChance,1); assert.equal(BD.CONFIG.startBlocks,63);
  assert.equal(C.CONFIG.coinCount,12); assert.equal(C.QUESTS[0].reward,77);
  const p = C.create(); p.levels.hp = 2; assert.equal(C.player(p).hp,150); assert.equal(C.cost(p,'hp'),94);
  assert.equal(C.UPGRADES.hp.cap,null);
  D.resetBalance(); assert.equal(BD.CONFIG.lineBase,10); assert.equal(BD.CONFIG.turnSeconds,20);
  assert.equal(C.CONFIG.hpPerLevel,15); assert.equal(C.UPGRADES.hp.base,45); assert.equal(C.QUESTS[0].target,1);
  assert.equal(C.UPGRADES.hp.step,5); assert.equal(C.UPGRADES.hp.cap,null); assert.equal(C.UPGRADES.attack.growth,1.18);
});
test('turn timer is off by default, can be toggled and resets to untimed battles',()=>{
  assert.equal(BD.CONFIG.turnTimerEnabled,false);
  D.applyBalance({engine_turnTimerEnabled:true,engine_turnSeconds:3});
  assert.equal(BD.CONFIG.turnTimerEnabled,true); assert.equal(BD.CONFIG.turnSeconds,3);
  D.applyBalance({engine_lineBase:15}); assert.equal(BD.CONFIG.turnTimerEnabled,true);
  D.applyBalance({engine_turnTimerEnabled:false}); assert.equal(BD.CONFIG.turnTimerEnabled,false);
  D.applyBalance({engine_turnTimerEnabled:'true'}); assert.equal(BD.CONFIG.turnTimerEnabled,false);
  D.applyBalance({engine_turnTimerEnabled:true}); D.resetBalance();
  assert.equal(BD.CONFIG.turnTimerEnabled,false); assert.equal(BD.CONFIG.turnSeconds,20);
});
test('hero HP and Vitality levels stay unlimited in battle, live edits and imported profiles',()=>{
  const p = D.restoreProfile({...C.create(),levels:{hp:10001,attack:0,loot:0}});
  assert.equal(p.levels.hp,10001);
  const o = D.makeBattle(p,11); assert.equal(o.hero.hp,150115);
  assert.equal(D.makeBattle(p,11,{heroHp:200000}).hero.hp,200000);
  const s = BD.newGame(1,0,{players:[o.hero,o.enemy]});
  D.editLive(s,{side0_maxHp:300000,side0_hp:290000});
  assert.equal(s.maxHp[0],300000); assert.equal(s.hp[0],290000);
  assert.equal(D.makeBattle(p,11,{heroHp:Infinity}).hero.hp,o.hero.hp);
});
test('board presets produce a line, combo, bomb chain and x2',()=>{
  for (const kind of ['line','combo','bomb','x2']) {
    const s = BD.newGame(1,0); D.preset(s,kind);
    const r = BD.act(s,0,0,7);
    assert.equal(r.gold,3); assert.equal(s.stats.actions[0],1);
    if (kind==='line') assert.equal(r.points,10);
    if (kind==='combo') { assert.equal(r.n,2); assert.equal(r.points,30); assert.equal(r.bonus,true); }
    if (kind==='bomb') { assert.equal(r.exploded.length,2); assert.equal(r.blasted.length,3); assert.equal(r.points,25); }
    if (kind==='x2') { assert.equal(r.mult,2); assert.equal(r.points,20); }
  }
});
test('live edits clamp current HP and armor to their valid ranges',()=>{
  const s = BD.newGame(1,0);
  D.editLive(s,{side0_maxHp:500,side0_hp:900,side0_armor:99,side1_attack:210,actions:5,round:999,turn:'1',side0_lines:44});
  assert.equal(s.maxHp[0],500); assert.equal(s.hp[0],500); assert.equal(s.players[0].armor,.6);
  assert.equal(s.players[1].attack,2.1); assert.equal(s.actionsLeft,5); assert.equal(s.round,10); assert.equal(s.turn,1); assert.equal(s.stats.lines[0],44);
});
test('forced victory, defeat and draw stop the game with the requested result',()=>{
  for (const w of [0,1,-1]) { const s = BD.newGame(1,0); D.finish(s,w); assert.equal(BD.winner(s),w); assert.throws(()=>BD.act(s,0,0,0),/over/); }
});
D.resetBalance(); console.log(`\n${count} debug checks passed`);
