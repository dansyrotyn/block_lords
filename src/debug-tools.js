'use strict';
const BD = typeof module !== 'undefined' ? require('./engine.js') : globalThis.BD;
const CAMP = typeof module !== 'undefined' ? require('./campaign.js') : globalThis.CAMP;
const DEV = (() => {
  const KEY = 'block-lords.test-profile.v1';
  const number = (value, min, max, fallback, step = 0) => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n)) return fallback;
    const bounded = Math.max(min, Math.min(max ?? Infinity, n));
    return step === 1 ? Math.round(bounded) : bounded;
  };
  const ENGINE_FIELDS = [
    ['rounds','Rounds',1,200,1], ['baseActions','Actions per turn',1,30,1],
    ['maxBonusActions','Maximum combo bonus actions',0,20,1], ['lineBase','Base line damage',0,10000,1],
    ['bombPerBlock','Bomb damage per extra block',0,10000,1], ['maxMultiplier','Damage multiplier cap',1,64,1],
    ['specialChance','Special block chance',0,1,.01], ['startBlocks','Starting board blocks',0,63,1],
    ['turnSeconds','Turn timer (seconds)',1,600,1], ['secondOpeningActions','Enemy opening actions',1,30,1],
    ['firstFinalBonus','First player final-round bonus',0,30,1], ['hp','Fallback player HP',1,100000,1],
    ['fitTries','Hand generation attempts',1,100,1],
  ];
  const RPG_FIELDS = [
    ['initialGold','New profile gold',0,1e9,1], ['heroHp','Base hero HP',1,null,1],
    ['hpPerLevel','HP per upgrade',0,10000,1], ['heroAttack','Base hero attack multiplier',.1,100,.1],
    ['attackPerLevel','Attack multiplier per upgrade',0,10,.05], ['heroLoot','Base gold multiplier',0,100,.1],
    ['lootPerLevel','Gold multiplier per upgrade',0,10,.05], ['coinCount','Coins on board',0,64,1],
    ['coinGold','Gold per coin',1,1e6,1], ['replayRate','Replay reward fraction',0,1,.05],
    ['minReplayGold','Minimum replay reward',0,1e6,1],
  ];
  const defaults = { engine: {...BD.CONFIG}, rpg: {...CAMP.CONFIG},
    upgrades: JSON.parse(JSON.stringify(CAMP.UPGRADES)), quests: JSON.parse(JSON.stringify([...CAMP.QUESTS,...CAMP.ACHIEVEMENTS])) };
  function resetBalance() {
    Object.assign(BD.CONFIG, defaults.engine); Object.assign(CAMP.CONFIG, defaults.rpg);
    for (const key of Object.keys(CAMP.UPGRADES)) Object.assign(CAMP.UPGRADES[key], defaults.upgrades[key]);
    [...CAMP.QUESTS,...CAMP.ACHIEVEMENTS].forEach((q,i) => Object.assign(q, defaults.quests[i]));
  }
  function applyBalance(values) {
    if (typeof values.engine_turnTimerEnabled === 'boolean')
      BD.CONFIG.turnTimerEnabled = values.engine_turnTimerEnabled;
    for (const [group,fields,target] of [['engine',ENGINE_FIELDS,BD.CONFIG],['rpg',RPG_FIELDS,CAMP.CONFIG]])
      for (const [key,,min,max,step] of fields) target[key] = number(values[group+'_'+key],min,max,target[key],step);
    for (const [key,u] of Object.entries(CAMP.UPGRADES)) {
      u.base = number(values['upgrade_'+key+'_base'],1,1e6,u.base,1);
      if (key === 'hp') {
        u.step = number(values['upgrade_'+key+'_step'],1,1e6,u.step,1);
        u.cap = null;
      } else {
        u.growth = number(values['upgrade_'+key+'_growth'],1,3,u.growth);
        u.cap = number(values['upgrade_'+key+'_cap'],1,50,u.cap,1);
      }
    }
    for (const q of [...CAMP.QUESTS,...CAMP.ACHIEVEMENTS]) {
      q.target = number(values['quest_'+q.id+'_target'],1,1e6,q.target,1);
      q.reward = number(values['quest_'+q.id+'_reward'],0,1e6,q.reward,1);
    }
  }
  function restoreProfile(raw) {
    const p = CAMP.restore(raw);
    if (raw?.version === 1 && Array.isArray(raw.cleared))
      p.cleared = [...new Set(raw.cleared.filter(id => Number.isInteger(id) && CAMP.ENEMIES[id]))].sort((a,b) => a-b);
    return p;
  }
  function makeBattle(profile,id,values = {}) {
    const original = CAMP.ENEMIES[id];
    if (!original) throw new Error('Choose a valid enemy.');
    const hero = CAMP.player(profile);
    const pct = (key, fallback, min=.1, max=100) => number(values[key],min*100,max*100,fallback*100)/100;
    return {
      hero: { hp:number(values.heroHp,1,null,hero.hp,1), attack:pct('heroAttack',hero.attack), armor:pct('heroArmor',0,0,.6), loot:pct('heroLoot',hero.loot,0) },
      enemy: {...original, hp:number(values.enemyHp,1,100000,original.hp,1), attack:pct('enemyAttack',original.attack),
        armor:pct('enemyArmor',original.armor,0,.6), reward:number(values.reward,0,1e6,original.reward,1),
        ai:['easy','medium','hard'].includes(values.ai) ? values.ai : original.ai },
      seed: values.seed === '' || values.seed === undefined ? (Math.random()*2**31)|0 : number(values.seed,-2147483648,2147483647,1,1),
      first: values.first === '0' ? 0 : values.first === '1' ? 1 : undefined,
      coinCount: number(values.coinCount,0,64,CAMP.CONFIG.coinCount,1), coinGold:number(values.coinGold,1,1e6,CAMP.CONFIG.coinGold,1),
    };
  }
  const dot = special => BD.makePiece(BD.FAMILIES.findIndex(f => f.id === 'dot'),0,0,special ? {i:0,t:special} : null);
  function hand(S,kind,side = 0) {
    S.hands[side] = Array.from({length:BD.CONFIG.handSize},() => kind === 'random' ? BD.genPiece(S) : dot(kind === 'bomb' ? BD.BOMB : kind === 'x2' ? BD.X2 : 0));
    if (!S.hands[side].some(p => BD.fits(S.board,p))) S.hands[side][0] = dot();
    S.stats.specialsDealt += S.hands[side].filter(p => p.sp).length;
  }
  function preset(S,kind,coinGold = CAMP.CONFIG.coinGold) {
    S.board.fill(0); S.coins.fill(0);
    if (kind !== 'empty') {
      for (let c=0;c<BD.N-1;c++) S.board[c] = 1;
      if (kind === 'combo') for (let r=1;r<BD.N;r++) S.board[r*BD.N+BD.N-1] = 1;
      if (kind === 'bomb') { S.board[3] |= BD.BOMB<<4; for (let c=2;c<=4;c++) S.board[BD.N+c] = 1; S.board[BD.N+3] |= BD.BOMB<<4; }
      if (kind === 'x2') S.board[3] |= BD.X2<<4;
      S.coins[BD.N-1] = coinGold;
    }
    S.turn = 0; S.actionsLeft = BD.CONFIG.baseActions; S.bonusUsed = 0;
    hand(S,'dot');
  }
  function editLive(S,values) {
    S.round = number(values.round,1,BD.CONFIG.rounds,S.round,1);
    S.turn = values.turn === '1' ? 1 : 0;
    S.actionsLeft = number(values.actions,1,30,S.actionsLeft,1);
    S.bonusUsed = number(values.bonus,0,BD.CONFIG.maxBonusActions,S.bonusUsed,1);
    S.seed = number(values.seed,-2147483648,2147483647,S.seed,1);
    for (let side=0;side<2;side++) {
      const key = 'side'+side+'_';
      S.maxHp[side] = number(values[key+'maxHp'],1,side === 0 ? null : 100000,S.maxHp[side],1);
      S.hp[side] = number(values[key+'hp'],1,S.maxHp[side],Math.min(S.hp[side],S.maxHp[side]),1);
      S.players[side] = { hp:S.maxHp[side], attack:number(values[key+'attack'],10,10000,S.players[side].attack*100)/100,
        armor:number(values[key+'armor'],0,60,S.players[side].armor*100)/100 };
      for (const [field,target] of [['score',S.scores],['gold',S.gold],['collected',S.collected]]) target[side] = number(values[key+field],0,1e9,target[side],1);
      for (const stat of Object.keys(S.stats)) if (Array.isArray(S.stats[stat])) S.stats[stat][side] = number(values[key+stat],0,1e9,S.stats[stat][side],1);
    }
  }
  function finish(S,winner) {
    S.over = true; S.ko = winner === -1 ? null : 1-winner;
    if (winner === -1) S.hp = S.maxHp.slice(); else S.hp[1-winner] = 0;
  }
  return {KEY,ENGINE_FIELDS,RPG_FIELDS,number,resetBalance,applyBalance,restoreProfile,makeBattle,hand,preset,editLive,finish};
})();
if (typeof module !== 'undefined') module.exports = DEV;
