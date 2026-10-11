'use strict';
/* Block Lords: fixed encounters and persistent RPG progression. No browser dependency. */
const CAMP = (() => {
  const KEY = 'block-lords.campaign.v1';
  const RACES = {
    rat: { name: 'Щуролюд', icon: '🐀', color: '#AB88CB', trait: 'Невисокі HP та сила. Добрий початок пригоди.' },
    human: { name: 'Бандит', icon: '🗡', color: '#74A4D7', trait: 'Броня поглинає частину кожного удару.' },
    orc: { name: 'Орк', icon: '🪓', color: '#82BE65', trait: 'Більше здоров’я та сильніші удари.' },
    demon: { name: 'Демон', icon: '🔥', color: '#D582A5', trait: 'Висока сила, броня та досвідчений AI.' },
  };
  const ENEMIES = [
    ['rat', 'Щур-розвідник', 60, .6, 0, 'easy', 45],
    ['rat', 'Печерний злодій', 75, .7, 0, 'easy', 55],
    ['rat', 'Король нори', 90, .8, .05, 'easy', 70],
    ['human', 'Дорожній бандит', 100, .85, .1, 'easy', 80],
    ['human', 'Вартовий руїн', 115, .9, .15, 'medium', 95],
    ['human', 'Капітан розбійників', 130, 1, .2, 'medium', 115],
    ['orc', 'Орк-рубака', 145, 1.2, 0, 'medium', 125],
    ['orc', 'Кам’яний громила', 165, 1.35, .05, 'medium', 140],
    ['orc', 'Вождь клану', 190, 1.5, .1, 'medium', 165],
    ['demon', 'Вогняний страж', 190, 1.45, .15, 'medium', 175],
    ['demon', 'Тінь вежі', 210, 1.3, .15, 'medium', 200],
    ['demon', 'Володар вежі', 225, 1.4, .2, 'medium', 250],
  ].map(([race, name, hp, attack, armor, ai, reward], id) => ({ id, race, name, hp, attack, armor, ai, reward, boss: id % 3 === 2 }));
  const UPGRADES = {
    attack: { name: 'Сила', icon: '⚔', base: 50, growth: 1.32, cap: 20, detail: '+10% до шкоди за рівень' },
    hp: { name: 'Витривалість', icon: '♥', base: 45, growth: 1.3, cap: 20, detail: '+15 максимальних HP за рівень' },
    loot: { name: 'Здобич', icon: '✦', base: 75, growth: 1.4, cap: 10, detail: '+10% золота з боїв за рівень' },
  };
  const QUESTS = [
    { id: 'play', name: 'Перша пригода', detail: 'Заверши один бій', stat: 'games', target: 1, reward: 25 },
    { id: 'blocks', name: 'Рунний майстер', detail: 'Постав 10 фігур', stat: 'actions', target: 10, reward: 30 },
    { id: 'lines', name: 'Перші закляття', detail: 'Очисти 5 ліній', stat: 'lines', target: 5, reward: 35 },
    { id: 'coins', name: 'Шукач скарбів', detail: 'Збери 5 монеток на полі', stat: 'coins', target: 5, reward: 30 },
    { id: 'upgrade', name: 'Нова сила', detail: 'Купи одне покращення', stat: 'upgrades', target: 1, reward: 20 },
    { id: 'rats', name: 'Приборкувач щурів', detail: 'Переможи 3 щуролюдів', stat: 'ratWins', target: 3, reward: 60 },
  ];
  const ACHIEVEMENTS = [
    { id: 'wins10', name: 'Десять перемог', detail: 'Здобудь 10 перемог', stat: 'wins', target: 10, reward: 100 },
    { id: 'lines100', name: 'Володар рун', detail: 'Очисти 100 ліній', stat: 'lines', target: 100, reward: 150 },
    { id: 'tower', name: 'Підкорювач вежі', detail: 'Здолай Володаря вежі', stat: 'tower', target: 1, reward: 250 },
  ];
  const STAT_KEYS = ['games', 'actions', 'lines', 'coins', 'upgrades', 'ratWins', 'wins', 'tower'];
  const amount = value => Number.isFinite(value) ? Math.max(0, Math.min(1e9, Math.floor(value))) : 0;
  function create() {
    return { version: 1, gold: 60, levels: { attack: 0, hp: 0, loot: 0 }, cleared: [], claimed: [], settled: [], stats: Object.fromEntries(STAT_KEYS.map(k => [k, 0])) };
  }
  function restore(raw) {
    const p = create();
    if (!raw || raw.version !== 1) return p;
    p.gold = amount(raw.gold);
    for (const k of Object.keys(UPGRADES)) p.levels[k] = Math.min(UPGRADES[k].cap, amount(raw.levels?.[k]));
    // Campaign clearance must be a contiguous prefix; a damaged save cannot unlock arbitrary bosses.
    const cleared = new Set(Array.isArray(raw.cleared) ? raw.cleared : []);
    for (const e of ENEMIES) { if (!cleared.has(e.id)) break; p.cleared.push(e.id); }
    const ids = new Set([...QUESTS, ...ACHIEVEMENTS].map(q => q.id));
    p.claimed = [...new Set(Array.isArray(raw.claimed) ? raw.claimed.filter(id => ids.has(id)) : [])];
    p.settled = Array.isArray(raw.settled) ? raw.settled.filter(id => typeof id === 'string').slice(-100) : [];
    for (const k of STAT_KEYS) p.stats[k] = amount(raw.stats?.[k]);
    return p;
  }
  function player(p) {
    return { hp: 100 + 15 * p.levels.hp, attack: 1 + .1 * p.levels.attack, armor: 0, loot: 1 + .1 * p.levels.loot };
  }
  const unlocked = (p, id) => Number.isInteger(id) && id >= 0 && id < ENEMIES.length && (id === 0 || p.cleared.includes(id - 1));
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
  function settle(p, battle) {
    const e = ENEMIES[battle.node];
    if (!e || !unlocked(p, e.id) || typeof battle.id !== 'string' || p.settled.includes(battle.id) || ![0, 1, -1].includes(battle.winner)) return null;
    const won = battle.winner === 0, first = won && !p.cleared.includes(e.id);
    const victoryBase = won ? (first ? e.reward : Math.max(10, Math.floor(e.reward * .3))) : 0;
    const loot = Number.isFinite(battle.loot) ? Math.max(1, Math.min(2, battle.loot)) : 1;
    const field = Math.round(Math.min(24, amount(battle.gold)) * loot);
    const victory = Math.round(victoryBase * loot);
    p.gold += field + victory;
    p.stats.games++; p.stats.actions += amount(battle.actions); p.stats.lines += amount(battle.lines);
    p.stats.coins += Math.min(8, amount(battle.collected));
    if (won) { p.stats.wins++; if (e.race === 'rat') p.stats.ratWins++; if (e.id === ENEMIES.length - 1) p.stats.tower = 1; }
    if (first) p.cleared.push(e.id);
    p.settled.push(battle.id); p.settled = p.settled.slice(-100);
    return { field, victory, total: field + victory, first, won };
  }
  return { KEY, RACES, ENEMIES, UPGRADES, QUESTS, ACHIEVEMENTS, create, restore, player, unlocked, cost, buy, claim, settle };
})();
if (typeof module !== 'undefined') module.exports = CAMP;
