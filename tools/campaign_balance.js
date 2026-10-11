'use strict';
// Reproducible balance experiments using the actual battle and reward rules.
// Run: node tools/campaign_balance.js [battles-per-matchup=300] [campaigns-per-policy=100]
const BD = require('../src/engine.js');
const C = require('../src/campaign.js');

function fight(hero, enemy, seed, first, skill) {
  const s = BD.newGame(seed, first, { players:[hero,enemy], coinCount:C.CONFIG.coinCount, coinGold:C.CONFIG.coinGold });
  let guard = 0;
  while (!s.over) {
    if (++guard > 1000) throw new Error('Battle did not finish.');
    if (!BD.handFits(s)) { BD.burn(s); continue; }
    const m = BD.chooseMove(s, s.turn === 0 ? skill : enemy.ai);
    BD.act(s,m.slot,m.r,m.c);
  }
  return s;
}
function totalCost(levels) {
  let total = 0;
  const p = C.create();
  for (const [key,target] of Object.entries(levels))
    while (p.levels[key] < target) { total += C.cost(p,key); p.levels[key]++; }
  return total;
}
function bossMatchup(levels, skill, games) {
  const hero = C.player({levels}), enemy = C.ENEMIES.at(-1);
  let wins = 0, draws = 0, knockouts = 0, gold = 0;
  for (let i=0;i<games;i++) {
    const s = fight(hero,enemy,1000+i*7919,i%2,skill), winner = BD.winner(s);
    wins += winner === 0; draws += winner === -1; knockouts += s.ko !== null; gold += s.gold[0];
  }
  return { levels, hp:hero.hp, attack:Math.round(hero.attack*100), skill, games,
    winPercent:+(100*wins/games).toFixed(1), drawPercent:+(100*draws/games).toFixed(1),
    koPercent:+(100*knockouts/games).toFixed(1), averageFieldGold:+(gold/games).toFixed(1) };
}
function claimReady(p) { for (const q of [...C.QUESTS,...C.ACHIEVEMENTS]) C.claim(p,q.id); }
function shop(p, fortune) {
  claimReady(p);
  // An optional single early Fortune level: pay now for more gold later.
  if (fortune && p.stats.wins >= 1 && p.levels.loot === 0) C.buy(p,'loot');
  for (let i=0;i<100;i++) {
    const hero = C.player(p);
    // Compare proportional improvement per gold. Do not skip the best-value
    // upgrade for a cheaper purchase: save the remainder for the next battle.
    const efficiency = key => (key === 'hp' ? C.CONFIG.hpPerLevel/hero.hp : C.CONFIG.attackPerLevel/hero.attack)/C.cost(p,key);
    const key = ['hp','attack'].filter(key=>!C.maxed(p,key)).sort((a,b)=>efficiency(b)-efficiency(a))[0];
    if (!key || !C.buy(p,key)) break;
    claimReady(p);
  }
}
function campaign(run, skill, fortune) {
  const p = C.create();
  let battles = 0, failures = 0, replays = 0, bossEntry = null;
  shop(p,fortune);
  while (!p.stats.tower && battles < 100) {
    const next = C.recommended(p);
    // After two failed attempts, try a previously defeated enemy for gold.
    const farming = failures >= 2 && p.cleared.length > 0;
    const id = farming ? [...p.cleared].reverse().find(id=>C.danger(p,id)!=='high') ?? 0 : next;
    if (!C.unlocked(p,id)) throw new Error('Simulation tried a locked encounter.');
    replays += farming;
    const hero = C.player(p);
    if (id === C.ENEMIES.length-1 && !bossEntry) bossEntry = hero;
    const s = fight(hero,C.ENEMIES[id],8137+run*104729+battles*7919,battles%2,skill);
    const winner = BD.winner(s);
    const result = C.settle(p,{id:`sim-${run}-${battles}`,node:id,winner,loot:hero.loot,
      gold:s.gold[0],collected:s.collected[0],actions:s.stats.actions[0],lines:s.stats.lines[0]});
    if (!result) throw new Error('Simulation result was rejected.');
    if (winner === 0) failures = 0; else failures++;
    battles++; shop(p,fortune);
  }
  return {battles,replays,complete:!!p.stats.tower,bossEntry,finalHero:C.player(p)};
}
function progression(skill, fortune, runs) {
  const rows = Array.from({length:runs},(_,i)=>campaign(i,skill,fortune));
  const attempts = rows.map(r=>r.battles).sort((a,b)=>a-b);
  const entries = rows.map(r=>r.bossEntry).filter(Boolean);
  const avg = values => +(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1);
  const percentile = q => attempts[Math.ceil(attempts.length*q)-1];
  return {skill,fortune,runs,completed:rows.filter(r=>r.complete).length,
    medianBattles:percentile(.5),p90Battles:percentile(.9),maxBattles:attempts.at(-1),
    averageReplays:avg(rows.map(r=>r.replays)),
    averageFirstBossHp:avg(entries.map(h=>h.hp)),averageFirstBossAttack:avg(entries.map(h=>h.attack*100))};
}
function report(games=300,runs=100) {
  const priceSnapshot = JSON.parse(JSON.stringify(C.UPGRADES));
  const builds = [{attack:0,hp:0,loot:0},{attack:4,hp:6,loot:0},{attack:6,hp:8,loot:0},
    C.BOSS_BUILD,{attack:8,hp:15,loot:0},{attack:10,hp:15,loot:0}];
  const boss = builds.flatMap(levels=>['medium','easy'].map(skill=>bossMatchup(levels,skill,games)));
  const economy = {bossBuild:C.BOSS_BUILD,bossBuildCost:totalCost(C.BOSS_BUILD),
    firstVictoryGoldBeforeBoss:C.ENEMIES.slice(0,-1).reduce((a,e)=>a+e.reward,0),
    starterQuestGold:C.QUESTS.reduce((a,q)=>a+q.reward,0),tenWinsGold:C.ACHIEVEMENTS.find(q=>q.id==='wins10').reward,
    initialGold:C.CONFIG.initialGold};
  economy.budgetBeforeFieldCoins = economy.initialGold+economy.firstVictoryGoldBeforeBoss+economy.starterQuestGold+economy.tenWinsGold;
  const current = ['medium','easy'].flatMap(skill=>[false,true].map(fortune=>progression(skill,fortune,runs)));
  let previous;
  try {
    Object.assign(C.UPGRADES.attack,{growth:1.32});
    delete C.UPGRADES.hp.step;
    Object.assign(C.UPGRADES.hp,{growth:1.3,cap:20});
    previous = {bossBuildCost:totalCost(C.BOSS_BUILD),progression:['medium','easy'].map(skill=>progression(skill,false,runs))};
  } finally {
    for (const key of Object.keys(C.UPGRADES)) {
      for (const field of Object.keys(C.UPGRADES[key])) delete C.UPGRADES[key][field];
      Object.assign(C.UPGRADES[key],priceSnapshot[key]);
    }
  }
  return {method:'Actual engine, seeded hands, alternating first player, default enemy AI. Full map, manual rewards modeled as claimed immediately; no timeouts. Bots are skill proxies, not predictions of human win rates.',
    seeds:{matchups:'1000 + i × 7919',campaigns:'8137 + run × 104729 + battle × 7919'},boss,economy,current,previous};
}
if (require.main === module) {
  const games = Math.max(2,Math.floor(+process.argv[2]||300)), runs = Math.max(2,Math.floor(+process.argv[3]||100));
  console.log(JSON.stringify(report(games,runs),null,2));
}
module.exports = {fight,totalCost,bossMatchup,campaign,progression,report};
