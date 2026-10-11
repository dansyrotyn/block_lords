const assert = require('node:assert/strict');
const BD = require('../src/engine.js');
const C = require('../src/campaign.js');
let total = 0;
const test = (name, fn) => { fn(); total++; console.log('ok -', name); };
const battle = (id, node = 0, winner = 0) => ({ id, node, winner, loot: 1, gold: 6, collected: 2, actions: 12, lines: 4 });
const empty = () => Array(64).fill(0);
const dot = () => BD.makePiece(BD.FAMILIES.findIndex(p => p.id === 'dot'), 0, 0, null);

test('прокачка списує золото, підвищує характеристики й наступну ціну', () => {
  const p = C.create();
  assert.equal(C.buy(p, 'attack'), true);
  assert.equal(p.gold, 10); assert.equal(C.player(p).attack, 1.1);
  assert.ok(C.cost(p, 'attack') > 50); assert.equal(C.buy(p, 'hp'), false);
  assert.equal(C.claim(p, 'upgrade'), true); assert.equal(p.gold, 30);
  assert.equal(C.claim(p, 'upgrade'), false); assert.equal(p.gold, 30);
});
test('перша перемога відкриває розвилку; результат не оплачується двічі', () => {
  const p = C.create(); assert.equal(C.unlocked(p, 1), false);
  const r = C.settle(p, battle('first')); assert.equal(r.total, 51);
  assert.equal(C.unlocked(p, 1), true); assert.equal(C.unlocked(p, 6), true); assert.equal(C.unlocked(p, 2), false); assert.deepEqual(r.opened,[1,6]);
  const gold = p.gold, stats = { ...p.stats };
  assert.equal(C.settle(p, battle('first')), null); assert.equal(p.gold, gold); assert.deepEqual(p.stats, stats);
  const repeat = C.settle(p, battle('repeat')); assert.equal(repeat.victory, 13); assert.equal(repeat.first, false);
});
test('заблокований ворог не дає нагороду чи прогрес', () => {
  const p = C.create(); assert.equal(C.settle(p, battle('locked', 11)), null); assert.equal(p.gold, 60); assert.equal(p.stats.games, 0);
});
test('поразка зберігає золото поля й квести, але не відкриває наступний рівень', () => {
  const p = C.create(); const result = C.settle(p, battle('lost', 0, 1));
  assert.equal(result.victory, 0); assert.equal(result.total, 6); assert.equal(p.stats.games, 1);
  assert.equal(p.stats.actions, 12); assert.equal(p.stats.coins, 2); assert.equal(C.unlocked(p, 1), false);
  assert.equal(C.claim(p, 'play'), true); assert.equal(C.claim(p, 'rats'), false);
});
test('множник здобичі діє на бій, а нагороди квестів залишаються фіксованими', () => {
  const p = C.create(); const r = C.settle(p, { ...battle('loot'), loot: 1.5 });
  assert.equal(r.field, 9); assert.equal(r.victory, 68);
  const before = p.gold; C.claim(p, 'play'); assert.equal(p.gold - before, 25);
});
test('збереження відновлює придбані рівні, відкриті вузли та отримані нагороди', () => {
  const p = C.create(); C.buy(p, 'attack'); C.claim(p, 'upgrade'); C.settle(p, battle('persist'));
  const loaded = C.restore(JSON.parse(JSON.stringify(p))); assert.deepEqual(loaded, p);
  assert.equal(C.settle(loaded, battle('persist')), null); assert.equal(C.claim(loaded, 'upgrade'), false);
});
test('пошкоджене збереження не створює від’ємне золото чи відкритого фінального боса', () => {
  const p = C.restore({ version: 1, gold: -8, levels: { hp: Infinity, loot: 100 }, cleared: [11], claimed: ['fake'] });
  assert.equal(p.gold, 0); assert.equal(p.levels.hp, 0); assert.equal(p.levels.loot, 10);
  assert.deepEqual(p.cleared, []); assert.deepEqual(p.claimed, []);
});
test('індивідуальні HP, сила і броня змінюють шкоду без зміни очок лінії', () => {
  const s = BD.newGame(1, 0, { players: [{ hp: 130, attack: 1.5 }, { hp: 200, armor: .2 }] });
  s.board = empty(); for (let i = 0; i < 7; i++) s.board[i] = 1;
  s.hands[0] = [dot()]; const r = BD.act(s, 0, 0, 7);
  assert.equal(r.points, 10); assert.equal(r.damage, 12); assert.equal(s.hp[1], 188); assert.deepEqual(s.maxHp, [130, 200]);
});
test('ліміт раундів порівнює відсоток HP, а не більший максимум', () => {
  const s = BD.newGame(1, 0, { players: [{ hp: 200 }, { hp: 100 }] }); s.over = true;
  s.hp = [100, 60]; assert.equal(BD.winner(s), 1); s.hp = [120, 60]; assert.equal(BD.winner(s), -1);
});
test('монетки не займають клітинки, збираються обома сторонами й лише один раз', () => {
  const s = BD.newGame(1, 0, { coinCount: 8 });
  assert.equal(s.coins.filter(Boolean).length, 8); assert.ok(s.coins.every((v, i) => !v || !s.board[i]));
  s.board = empty(); s.coins = empty(); s.coins[0] = 3; s.hands[0] = [dot()];
  const r = BD.act(s, 0, 0, 0); assert.equal(r.gold, 3); assert.equal(s.gold[0], 3); assert.equal(s.coins[0], 0);
  s.turn = 1; s.coins[1] = 3; s.hands[1] = [dot()]; const stolen = BD.act(s, 0, 0, 1);
  assert.equal(stolen.gold, 3); assert.equal(s.gold[1], 3); assert.equal(s.gold[0], 3);
});
test('бомба не збирає монетку, яка не накрита поставленою фігурою', () => {
  const s = BD.newGame(1, 0); s.board = empty(); s.coins = empty();
  for (let i = 0; i < 7; i++) s.board[8 + i] = 1;
  s.board[8 + 3] |= BD.BOMB << 4; s.coins[3] = 3; s.hands[0] = [dot()];
  const r = BD.act(s, 0, 1, 7); assert.equal(r.gold, 0); assert.equal(s.coins[3], 3);
});
test('нокаут зупиняє бій і не дозволяє повторно отримати монети дією', () => {
  const s = BD.newGame(1, 0); s.board = empty(); for (let i = 0; i < 7; i++) s.board[i] = 1;
  s.hp[1] = 1; s.hands[0] = [dot(), dot()]; BD.act(s, 0, 0, 7);
  assert.equal(BD.winner(s), 0); assert.throws(() => BD.act(s, 1, 1, 0), /over/);
});
test('оркова гілка дозволяє ранній сильний бій та вихід до демонів без лісового шляху', () => {
  const p = C.create();
  for (const id of [0,6,7,8,9,10,11]) {
    assert.equal(C.unlocked(p,id),true);
    assert.ok(C.settle(p,battle('branch-'+id,id)));
  }
  assert.equal(p.stats.tower,1);
  assert.equal(C.unlocked(p,2),false);
  assert.deepEqual(C.restore(JSON.parse(JSON.stringify(p))).cleared,p.cleared);
  assert.equal(C.danger(C.create(),6),'high');
});
test('невдала спроба сильного ворога не закриває легший маршрут і не відкриває продовження', () => {
  const p = C.create(); C.settle(p,battle('root'));
  C.settle(p,battle('orc-loss',6,1));
  assert.equal(C.unlocked(p,1),true); assert.equal(C.unlocked(p,6),true);
  assert.equal(C.unlocked(p,7),false); assert.deepEqual(p.cleared,[0]);
});
test('старі лінійні збереження та нові перемоги не за порядком відновлюються', () => {
  const legacy = C.create(); legacy.cleared = [0,1,2,3,4,5];
  assert.deepEqual(C.restore(legacy).cleared,legacy.cleared);
  const branched = C.create(); branched.cleared = [0,6,1,7];
  assert.deepEqual(C.restore(branched).cleared,[0,1,6,7]);
  const damaged = C.create(); damaged.cleared = [0,8,11];
  assert.deepEqual(C.restore(damaged).cleared,[0]);
});
console.log(`\n${total} перевірок RPG пройдено`);
