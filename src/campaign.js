'use strict';
/* Block Lords: fixed encounters and persistent RPG progression. No browser dependency. */
const CAMP = (() => {
  const KEY = 'block-lords.campaign.v1';
  const CONFIG = { initialGold: 60, heroHp: 100, hpPerLevel: 15, heroAttack: 1, attackPerLevel: .1,
    heroLoot: 1, lootPerLevel: .1, coinCount: 8, coinGold: 3, replayRate: .3, minReplayGold: 10 };
  const RACES = {
    rat: { name: 'Ratfolk', icon: '🐀', color: '#AB88CB', trait: 'Low health and attack. A good place to start your adventure.' },
    human: { name: 'Bandit', icon: '🗡', color: '#74A4D7', trait: 'Armor absorbs part of every hit.' },
    orc: { name: 'Orc', icon: '🪓', color: '#82BE65', trait: 'More health and stronger attacks.' },
    demon: { name: 'Demon', icon: '🔥', color: '#D582A5', trait: 'Strong attacks, armor, and a skilled opponent.' },
  };
  const ENEMIES = [
    ['rat', 'Rat Scout', 60, .6, 0, 'easy', 45],
    ['rat', 'Cave Thief', 75, .7, 0, 'easy', 55],
    ['rat', 'Burrow King', 90, .8, .05, 'easy', 70],
    ['human', 'Road Bandit', 100, .85, .1, 'easy', 80],
    ['human', 'Ruins Guard', 115, .9, .15, 'medium', 95],
    ['human', 'Bandit Captain', 130, 1, .2, 'medium', 115],
    ['orc', 'Orc Raider', 145, 1.2, 0, 'medium', 125],
    ['orc', 'Stone Brute', 165, 1.35, .05, 'medium', 140],
    ['orc', 'Clan Chief', 190, 1.5, .1, 'medium', 165],
    ['demon', 'Flame Warden', 190, 1.45, .15, 'medium', 175],
    ['demon', 'Tower Shadow', 210, 1.3, .15, 'medium', 200],
    ['demon', 'Tower Lord', 225, 1.4, .2, 'medium', 250],
  ].map(([race, name, hp, attack, armor, ai, reward], id) => ({ id, race, name, hp, attack, armor, ai, reward, boss: id % 3 === 2 }));
  // Two routes from the first victory: the woodland road or a harder orc shortcut.
  // Each listed parent is an alternative prerequisite (OR), not a required checklist.
  const PARENTS = [[], [0], [1], [2], [3], [4], [0], [6,3], [7], [5,8,4], [9], [10]];
  const ROUTES = PARENTS.flatMap((parents,to) => parents.map(from => ({from,to,shortcut: to-from > 1})));
  const UPGRADES = {
    attack: { name: 'Attack', icon: '⚔', base: 50, growth: 1.32, cap: 20, detail: '+10% damage per level' },
    hp: { name: 'Vitality', icon: '♥', base: 45, growth: 1.3, cap: 20, detail: '+15 maximum HP per level' },
    loot: { name: 'Fortune', icon: '✦', base: 75, growth: 1.4, cap: 10, detail: '+10% battle gold per level' },
  };
  const QUESTS = [
    { id: 'play', name: 'First Adventure', detail: 'Complete one battle', stat: 'games', target: 1, reward: 25 },
    { id: 'blocks', name: 'Rune Master', detail: 'Place 10 pieces', stat: 'actions', target: 10, reward: 30 },
    { id: 'lines', name: 'First Spells', detail: 'Clear 5 lines', stat: 'lines', target: 5, reward: 35 },
    { id: 'coins', name: 'Treasure Hunter', detail: 'Collect 5 coins on the board', stat: 'coins', target: 5, reward: 30 },
    { id: 'upgrade', name: 'Growing Stronger', detail: 'Buy one upgrade', stat: 'upgrades', target: 1, reward: 20 },
    { id: 'rats', name: 'Rat Hunter', detail: 'Defeat ratfolk 3 times', stat: 'ratWins', target: 3, reward: 60 },
  ];
  const ACHIEVEMENTS = [
    { id: 'wins10', name: 'Ten Victories', detail: 'Win 10 battles', stat: 'wins', target: 10, reward: 100 },
    { id: 'lines100', name: 'Lord of Runes', detail: 'Clear 100 lines', stat: 'lines', target: 100, reward: 150 },
    { id: 'tower', name: 'Tower Conqueror', detail: 'Defeat the Tower Lord', stat: 'tower', target: 1, reward: 250 },
  ];
  const STAT_KEYS = ['games', 'actions', 'lines', 'coins', 'upgrades', 'ratWins', 'wins', 'tower'];
  const amount = value => Number.isFinite(value) ? Math.max(0, Math.min(1e9, Math.floor(value))) : 0;
  function create() {
    return { version: 1, gold: CONFIG.initialGold, levels: { attack: 0, hp: 0, loot: 0 }, cleared: [], claimed: [], settled: [], stats: Object.fromEntries(STAT_KEYS.map(k => [k, 0])) };
  }
  function restore(raw) {
    const p = create();
    if (!raw || raw.version !== 1) return p;
    p.gold = amount(raw.gold);
    for (const k of Object.keys(UPGRADES)) p.levels[k] = Math.min(UPGRADES[k].cap, amount(raw.levels?.[k]));
    // Keep reachable victories on either branch; old linear saves remain valid.
    const cleared = new Set(Array.isArray(raw.cleared) ? raw.cleared : []);
    for (const e of ENEMIES) { if (cleared.has(e.id) && unlocked(p,e.id)) p.cleared.push(e.id); }
    const ids = new Set([...QUESTS, ...ACHIEVEMENTS].map(q => q.id));
    p.claimed = [...new Set(Array.isArray(raw.claimed) ? raw.claimed.filter(id => ids.has(id)) : [])];
    p.settled = Array.isArray(raw.settled) ? raw.settled.filter(id => typeof id === 'string').slice(-100) : [];
    for (const k of STAT_KEYS) p.stats[k] = amount(raw.stats?.[k]);
    return p;
  }
  function player(p) {
    return { hp: CONFIG.heroHp + CONFIG.hpPerLevel * p.levels.hp, attack: CONFIG.heroAttack + CONFIG.attackPerLevel * p.levels.attack,
      armor: 0, loot: CONFIG.heroLoot + CONFIG.lootPerLevel * p.levels.loot };
  }
  const unlocked = (p,id) => Number.isInteger(id) && id >= 0 && id < ENEMIES.length && (id === 0 || p.cleared.includes(id) || PARENTS[id].some(parent => p.cleared.includes(parent)));
  const recommended = p => ENEMIES.find(e => unlocked(p,e.id) && !p.cleared.includes(e.id))?.id ?? ENEMIES.length-1;
  function danger(p,id) {
    const e = ENEMIES[id], hero = player(p);
    const ratio = (e.hp * e.attack / (1-e.armor)) / (hero.hp * hero.attack);
    return ratio >= 1.55 ? 'high' : ratio >= 1.15 ? 'medium' : 'normal';
  }
  const cost = (p, key) => UPGRADES[key] ? Math.ceil(UPGRADES[key].base * UPGRADES[key].growth ** p.levels[key]) : Infinity;
  function buy(p, key) {
    const u = UPGRADES[key];
    if (!u || p.levels[key] >= u.cap || p.gold < cost(p, key)) return false;
    p.gold -= cost(p, key); p.levels[key]++; p.stats.upgrades++; return true;
  }
  function claim(p, id) {
    const q = [...QUESTS, ...ACHIEVEMENTS].find(q => q.id === id);
    if (!q || p.claimed.includes(id) || p.stats[q.stat] < q.target) return false;
    p.gold += q.reward; p.claimed.push(id); return true;
  }
  function settle(p, battle, options = {}) {
    const e = options.test ? options.enemy || ENEMIES[battle.node] : ENEMIES[battle.node];
    if (!e || !ENEMIES[e.id] || (!options.test && !unlocked(p, e.id)) || typeof battle.id !== 'string' || p.settled.includes(battle.id) || ![0, 1, -1].includes(battle.winner)) return null;
    const availableBefore = ENEMIES.filter(e => unlocked(p,e.id)).map(e => e.id);
    const won = battle.winner === 0, first = won && !p.cleared.includes(e.id);
    const victoryBase = won ? (first ? e.reward : Math.max(CONFIG.minReplayGold, Math.floor(e.reward * CONFIG.replayRate))) : 0;
    const loot = Number.isFinite(battle.loot) ? Math.max(0, Math.min(options.test ? 100 : CONFIG.heroLoot + CONFIG.lootPerLevel * UPGRADES.loot.cap, battle.loot)) : 1;
    const coinCount = options.test ? options.coinCount ?? CONFIG.coinCount : CONFIG.coinCount;
    const coinGold = options.test ? options.coinGold ?? CONFIG.coinGold : CONFIG.coinGold;
    const field = Math.round(Math.min(coinCount * coinGold, amount(battle.gold)) * loot);
    const victory = Math.round(victoryBase * loot);
    p.gold += field + victory;
    p.stats.games++; p.stats.actions += amount(battle.actions); p.stats.lines += amount(battle.lines);
    p.stats.coins += Math.min(coinCount, amount(battle.collected));
    if (won) { p.stats.wins++; if (e.race === 'rat') p.stats.ratWins++; if (e.id === ENEMIES.length - 1) p.stats.tower = 1; }
    if (first) p.cleared.push(e.id);
    p.settled.push(battle.id); p.settled = p.settled.slice(-100);
    const opened = ENEMIES.filter(e => unlocked(p,e.id) && !availableBefore.includes(e.id)).map(e => e.id);
    return { field, victory, total: field + victory, first, won, opened };
  }
  return { KEY, CONFIG, STAT_KEYS, RACES, ENEMIES, PARENTS, ROUTES, recommended, danger, UPGRADES, QUESTS, ACHIEVEMENTS, create, restore, player, unlocked, cost, buy, claim, settle };
})();
if (typeof module !== 'undefined') module.exports = CAMP;
