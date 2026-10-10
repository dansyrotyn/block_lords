const BD = require('../src/engine.js');
const assert = require('assert');
const N = 8;
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('ok -', name); };

t('кількість варіантів відповідає GDD', () => {
  const want = { line2: 2, line3: 2, sq2: 1, corner3: 4, line4: 2, dot: 1, l4: 8, t: 4, line5: 2, rect23: 2, corner5: 4, sz: 4, sq3: 1 };
  for (const f of BD.FAMILIES) assert.strictEqual(f.variants.length, want[f.id], f.id);
});

const fam = id => BD.FAMILIES.findIndex(f => f.id === id);
const empty = () => new Array(64).fill(0);
const dot = (sp) => BD.makePiece(fam('dot'), 0, 0, sp || null);

t('одна лінія = 10', () => {
  const b = empty(); for (let c = 0; c < 7; c++) b[c] = 1;
  const r = BD.place(b, dot(), 0, 7);
  assert.strictEqual(r.n, 1); assert.strictEqual(r.points, 10); assert.strictEqual(r.combo, false);
  assert.ok(r.board.every(v => v === 0));
});

t('рядок + стовпець = 30 і комбо', () => {
  const b = empty(); for (let i = 0; i < 7; i++) { b[i] = 1; b[(i + 1) * N + 7] = 1; }
  const r = BD.place(b, dot(), 0, 7);
  assert.strictEqual(r.n, 2); assert.strictEqual(r.points, 30); assert.strictEqual(r.combo, true);
});

t('множник ×2 подвоює', () => {
  const b = empty(); for (let c = 0; c < 7; c++) b[c] = 1; b[3] = 1 | (BD.X2 << 4);
  assert.strictEqual(BD.place(b, dot(), 0, 7).points, 20);
});

t('два множники = ×4, три — теж ×4', () => {
  const b = empty(); for (let c = 0; c < 7; c++) b[c] = 1 | (c < 3 ? BD.X2 << 4 : 0);
  assert.strictEqual(BD.place(b, dot(), 0, 7).points, 40);
});

t('бомба вибухає 3×3 і дає +5 за блок', () => {
  const b = empty(); for (let c = 0; c < 7; c++) b[N + c] = 1; b[N + 3] = 1 | (BD.BOMB << 4);
  b[2 * N + 2] = 1; b[2 * N + 3] = 1; b[2 * N + 4] = 1; b[0 * N + 3] = 1; b[2 * N + 6] = 1;
  const r = BD.place(b, dot(), 1, 7);
  assert.strictEqual(r.blasted.length, 4); // 3 знизу + 1 зверху, (2,6) поза зоною
  assert.strictEqual(r.points, 10 + 20);
  assert.strictEqual(r.board[2 * N + 6], 1);
});

t('ланцюжок бомб', () => {
  const b = empty(); for (let c = 0; c < 7; c++) b[N + c] = 1; b[N + 1] = 1 | (BD.BOMB << 4);
  b[2 * N + 2] = 1 | (BD.BOMB << 4); b[3 * N + 3] = 1;
  const r = BD.place(b, dot(), 1, 7);
  assert.strictEqual(r.exploded.length, 2); assert.strictEqual(r.blasted.length, 2);
  assert.strictEqual(r.points, 10 + 10);
});

t('спецблок із фігури потрапляє на поле', () => {
  const r = BD.place(empty(), dot({ i: 0, t: BD.BOMB }), 4, 4);
  assert.strictEqual(BD.spOf(r.board[4 * N + 4]), BD.BOMB);
});

t('бонусні дії обмежені двома', () => {
  const S = BD.newGame(1, 0);
  for (let k = 0; k < 3; k++) {
    S.board = empty(); for (let i = 0; i < 7; i++) { S.board[i] = 1; S.board[(i + 1) * N + 7] = 1; }
    S.hands[0] = [dot(), dot(), dot()];
    const before = S.actionsLeft;
    const res = BD.act(S, 0, 0, 7);
    if (k < 2) { assert.ok(res.bonus); assert.strictEqual(S.actionsLeft, before); }
    else { assert.ok(!res.bonus); assert.strictEqual(S.actionsLeft, before - 1); }
  }
});

t('матч: 10 ходів кожному або нокаут', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const S = BD.newGame(seed);
    const turns = [0, 0]; let last = -1, guard = 0;
    while (!S.over && guard++ < 1000) {
      if (S.turn !== last) { turns[S.turn]++; last = S.turn; }
      if (!BD.handFits(S)) { BD.burn(S); if (S.over) break; continue; }
      const m = BD.chooseMove(S, 'medium');
      BD.act(S, m.slot, m.r, m.c);
    }
    assert.ok(S.over);
    if (S.ko === null) assert.deepStrictEqual(turns, [10, 10]);
    else assert.ok(Math.abs(turns[0] - turns[1]) <= 1 && turns[0] <= 10);
  }
});

t('нова рука завжди має фігуру, що влазить', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const S = BD.newGame(seed);
    for (let k = 0; k < 40; k++) { const i = Math.floor(BD.rand(S) * 64); S.board[i] = 1; }
    if (!S.board.some(v => !v)) continue;
    const p = S.turn;
    BD.burn(S);
    assert.ok(S.hands[p].some(x => x && BD.fits(S.board, x)), 'seed ' + seed);
  }
});

console.log(`\n${ok} тестів пройдено`);

t('HP: шкода дорівнює очкам, нокаут закінчує матч', () => {
  const S = BD.newGame(3, 0);
  S.hp[1] = 25;
  S.board = empty(); for (let i = 0; i < 7; i++) { S.board[i] = 1; S.board[(i + 1) * N + 7] = 1; }
  S.hands[0] = [dot(), dot(), dot()];
  const r = BD.act(S, 0, 0, 7);
  assert.strictEqual(r.points, 30); assert.strictEqual(S.hp[1], 0); assert.ok(r.ko);
  assert.ok(S.over); assert.strictEqual(BD.winner(S), 0);
});
t('тайм-аут передає хід', () => {
  const S = BD.newGame(4, 0);
  BD.timeout(S); assert.strictEqual(S.turn, 1); assert.strictEqual(S.actionsLeft, BD.CONFIG.baseActions);
});
