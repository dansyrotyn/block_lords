'use strict';
/* Блок Дуель — ігровий рушій без UI. Усі числа балансу живуть у CONFIG. */
const BD = (() => {
  const CONFIG = {
    size: 8,
    rounds: 10,
    baseActions: 3,
    maxBonusActions: 2,   // максимум 5 дій за хід
    lineBase: 10,         // очки = 10 * n(n+1)/2
    bombPerBlock: 5,
    maxMultiplier: 4,
    specialChance: 0.12,  // шанс, що одна клітинка фігури стане спецблоком
    startBlocks: 8,
    handSize: 3,
    fitTries: 20,
    colors: 6,
    hp: 100,                 // здоров'я кожного гравця; шкода = очки
    turnSeconds: 20,         // таймер ходу
    secondOpeningActions: 3, // дій у першому ході другого гравця
    firstFinalBonus: 0,      // додаткові дії першому гравцеві в останньому раунді
  };
  const N = CONFIG.size;
  const NEUTRAL = 7;      // код нейтрального блока (колір 6)
  const BOMB = 1, X2 = 2; // спецблоки, зберігаються в бітах 4-5

  const SHAPES = [
    { id: 'line2', w: 6, rows: ['##'] },
    { id: 'line3', w: 6, rows: ['###'] },
    { id: 'sq2', w: 6, rows: ['##', '##'] },
    { id: 'corner3', w: 6, rows: ['#.', '##'] },
    { id: 'line4', w: 5, rows: ['####'] },
    { id: 'dot', w: 4, rows: ['#'] },
    { id: 'l4', w: 4, rows: ['#.', '#.', '##'], mirror: true },
    { id: 't', w: 4, rows: ['###', '.#.'] },
    { id: 'line5', w: 3, rows: ['#####'] },
    { id: 'rect23', w: 3, rows: ['###', '###'] },
    { id: 'corner5', w: 3, rows: ['#..', '#..', '###'] },
    { id: 'sz', w: 3, rows: ['##.', '.##'], mirror: true },
    { id: 'sq3', w: 2, rows: ['###', '###', '###'] },
  ];

  const parse = rows => {
    const cells = [];
    rows.forEach((s, r) => [...s].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return cells;
  };
  const norm = cells => {
    const mr = Math.min(...cells.map(x => x[0])), mc = Math.min(...cells.map(x => x[1]));
    return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  };
  const rot = cells => norm(cells.map(([r, c]) => [c, -r]));
  const mir = cells => norm(cells.map(([r, c]) => [r, -c]));

  const FAMILIES = SHAPES.map(s => {
    const seen = new Map();
    const add = cs => { let x = cs; for (let i = 0; i < 4; i++) { const k = JSON.stringify(x); if (!seen.has(k)) seen.set(k, x); x = rot(x); } };
    const base = norm(parse(s.rows));
    add(base);
    if (s.mirror) add(mir(base));
    return { ...s, variants: [...seen.values()] };
  });
  const TOTAL_W = FAMILIES.reduce((a, f) => a + f.w, 0);

  // ---------- випадковість (стан зберігається в S.seed, тож гру можна серіалізувати) ----------
  function rand(st) {
    let a = st.seed = (st.seed + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- фігури ----------
  function makePiece(fi, vi, color, sp) {
    const cells = FAMILIES[fi].variants[vi];
    let h = 0, w = 0;
    for (const [r, c] of cells) { if (r + 1 > h) h = r + 1; if (c + 1 > w) w = c + 1; }
    return { f: fi, v: vi, cells, h, w, color, sp };
  }
  function genPiece(st) {
    let x = rand(st) * TOTAL_W, fi = 0;
    while (x >= FAMILIES[fi].w) { x -= FAMILIES[fi].w; fi++; }
    const fam = FAMILIES[fi];
    const vi = Math.floor(rand(st) * fam.variants.length);
    const color = Math.floor(rand(st) * CONFIG.colors);
    let sp = null;
    if (rand(st) < CONFIG.specialChance) {
      sp = { i: Math.floor(rand(st) * fam.variants[vi].length), t: rand(st) < 0.5 ? BOMB : X2 };
    }
    return makePiece(fi, vi, color, sp);
  }
  const DOT = FAMILIES.findIndex(f => f.id === 'dot');
  function genHand(st, board) {
    for (let t = 0; t < CONFIG.fitTries; t++) {
      const hand = [];
      for (let i = 0; i < CONFIG.handSize; i++) hand.push(genPiece(st));
      if (hand.some(p => fits(board, p))) return hand;
    }
    const hand = [];
    for (let i = 0; i < CONFIG.handSize; i++) hand.push(genPiece(st));
    hand[0] = makePiece(DOT, 0, Math.floor(rand(st) * CONFIG.colors), null);
    return hand;
  }

  // ---------- поле ----------
  function canPlace(board, p, r, c) {
    if (r < 0 || c < 0 || r + p.h > N || c + p.w > N) return false;
    for (const [dr, dc] of p.cells) if (board[(r + dr) * N + c + dc]) return false;
    return true;
  }
  function fits(board, p) {
    for (let r = 0; r + p.h <= N; r++) for (let c = 0; c + p.w <= N; c++) if (canPlace(board, p, r, c)) return true;
    return false;
  }
  function placements(board, p) {
    const out = [];
    for (let r = 0; r + p.h <= N; r++) for (let c = 0; c + p.w <= N; c++) if (canPlace(board, p, r, c)) out.push([r, c]);
    return out;
  }
  const spOf = v => v >> 4;
  const colorOf = v => (v & 15) - 1;

  // Ставить фігуру і рахує все, що сталося. Не змінює вхідне поле.
  function place(board, p, r, c) {
    const b = board.slice();
    const placed = [];
    p.cells.forEach(([dr, dc], i) => {
      const idx = (r + dr) * N + c + dc;
      let v = p.color + 1;
      if (p.sp && p.sp.i === i) v |= p.sp.t << 4;
      b[idx] = v;
      placed.push(idx);
    });
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      let fr = true, fc = true;
      for (let j = 0; j < N; j++) { if (!b[i * N + j]) fr = false; if (!b[j * N + i]) fc = false; }
      if (fr) rows.push(i);
      if (fc) cols.push(i);
    }
    const n = rows.length + cols.length;
    const before = b.slice();
    if (!n) return { board: b, before, placed, rows, cols, n: 0, cleared: [], exploded: [], blasted: [], mult: 1, base: 0, points: 0, combo: false };

    const clearedSet = new Set();
    for (const i of rows) for (let j = 0; j < N; j++) clearedSet.add(i * N + j);
    for (const i of cols) for (let j = 0; j < N; j++) clearedSet.add(j * N + i);
    let mults = 0;
    const queue = [];
    for (const idx of clearedSet) {
      const s = spOf(b[idx]);
      if (s === X2) mults++;
      else if (s === BOMB) queue.push(idx);
    }
    for (const idx of clearedSet) b[idx] = 0;
    const exploded = [], blasted = [];
    while (queue.length) {
      const bi = queue.shift();
      exploded.push(bi);
      const br = Math.floor(bi / N), bc = bi % N;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = br + dr, cc = bc + dc;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        const j = rr * N + cc;
        if (!b[j]) continue;
        if (spOf(b[j]) === BOMB) queue.push(j);
        b[j] = 0;
        blasted.push(j);
      }
    }
    const mult = Math.min(CONFIG.maxMultiplier, 2 ** mults);
    const base = CONFIG.lineBase * n * (n + 1) / 2;
    const points = (base + CONFIG.bombPerBlock * blasted.length) * mult;
    return { board: b, before, placed, rows, cols, n, cleared: [...clearedSet], exploded, blasted, mult, base, points, combo: n >= 2 };
  }

  // ---------- матч ----------
  function newGame(seed, first, options = {}) {
    const players = [0, 1].map(i => {
      const p = (options.players || [])[i] || {};
      return { hp: Number.isFinite(p.hp) ? Math.max(1, Math.round(p.hp)) : CONFIG.hp,
        attack: Number.isFinite(p.attack) ? Math.max(.1, p.attack) : 1,
        armor: Number.isFinite(p.armor) ? Math.max(0, Math.min(.6, p.armor)) : 0 };
    });
    const S = {
      seed: seed | 0, board: new Array(N * N).fill(0), hands: [[], []], scores: [0, 0],
      round: 1, first: 0, turn: 0, actionsLeft: CONFIG.baseActions, bonusUsed: 0, over: false,
      hp: players.map(p => p.hp), maxHp: players.map(p => p.hp), players, ko: null,
      coins: new Array(N * N).fill(0), gold: [0, 0], collected: [0, 0],
      stats: { timeouts: [0, 0], burns: [0, 0], lines: [0, 0], combos: [0, 0], bombs: [0, 0], mults: [0, 0], actions: [0, 0], specialsDealt: 0 },
    };
    S.first = first === 0 || first === 1 ? first : (rand(S) < 0.5 ? 0 : 1);
    S.turn = S.first;
    let tries = 0;
    do {
      S.board.fill(0);
      let k = 0;
      while (k < CONFIG.startBlocks) { const i = Math.floor(rand(S) * N * N); if (!S.board[i]) { S.board[i] = NEUTRAL; k++; } }
      tries++;
    } while (hasFullLine(S.board) && tries < 50);
    S.hands[0] = dealHand(S);
    S.hands[1] = dealHand(S);
    const free = S.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    const coinCount = Math.max(0, Math.min(free.length, Math.floor(options.coinCount || 0)));
    for (let i = 0; i < coinCount; i++) {
      const j = Math.floor(rand(S) * free.length), cell = free.splice(j, 1)[0];
      S.coins[cell] = 3;
    }
    return S;
  }
  function hasFullLine(b) {
    for (let i = 0; i < N; i++) {
      let fr = true, fc = true;
      for (let j = 0; j < N; j++) { if (!b[i * N + j]) fr = false; if (!b[j * N + i]) fc = false; }
      if (fr || fc) return true;
    }
    return false;
  }
  function dealHand(S) {
    const h = genHand(S, S.board);
    S.stats.specialsDealt += h.filter(p => p.sp).length;
    return h;
  }
  const handFits = S => S.hands[S.turn].some(p => p && fits(S.board, p));

  function endTurn(S) {
    if (S.turn !== S.first) S.round++;
    S.turn = 1 - S.turn;
    S.actionsLeft = CONFIG.baseActions;
    if (S.turn !== S.first && S.round === 1) S.actionsLeft = CONFIG.secondOpeningActions;
    if (S.turn === S.first && S.round === CONFIG.rounds) S.actionsLeft += CONFIG.firstFinalBonus;
    S.bonusUsed = 0;
    if (S.round > CONFIG.rounds) S.over = true;
  }
  // Жодна фігура не влазить: дія згорає, рука оновлюється.
  function burn(S) {
    const p = S.turn;
    S.hands[p] = dealHand(S);
    S.actionsLeft--;
    S.stats.burns[p]++;
    const ended = S.actionsLeft <= 0;
    if (ended) endTurn(S);
    return { player: p, ended };
  }
  // Час вийшов: решта дій пропадає, хід переходить суперникові.
  function timeout(S) {
    if (S.over) return;
    S.stats.timeouts[S.turn]++;
    endTurn(S);
  }
  // 0 або 1 — переможець, -1 — нічия, null — матч ще йде.
  function winner(S) {
    if (!S.over) return null;
    if (S.ko !== null) return 1 - S.ko;
    const a = S.hp[0] / S.maxHp[0], b = S.hp[1] / S.maxHp[1];
    return Math.abs(a - b) < 1e-9 ? -1 : a > b ? 0 : 1;
  }
  function damage(S, player, points) {
    if (points <= 0) return 0;
    return Math.max(1, Math.round(points * S.players[player].attack * (1 - S.players[1 - player].armor)));
  }
  function act(S, slot, r, c) {
    if (S.over) throw new Error('match is over');
    const p = S.turn, piece = S.hands[p][slot];
    if (!piece || !canPlace(S.board, piece, r, c)) throw new Error('invalid move');
    const res = place(S.board, piece, r, c);
    const coinCells = res.placed.filter(i => S.coins[i]);
    const gold = coinCells.reduce((sum, i) => sum + S.coins[i], 0);
    coinCells.forEach(i => { S.coins[i] = 0; });
    S.gold[p] += gold;
    S.collected[p] += coinCells.length;
    S.board = res.board;
    S.scores[p] += res.points;
    const target = 1 - p, hpBefore = S.hp[target];
    const hit = damage(S, p, res.points);
    S.hp[target] = Math.max(0, hpBefore - hit);
    const ko = hit > 0 && S.hp[target] === 0;
    if (ko) { S.over = true; S.ko = target; }
    S.hands[p][slot] = null;
    S.actionsLeft--;
    S.stats.actions[p]++;
    S.stats.lines[p] += res.n;
    S.stats.bombs[p] += res.exploded.length;
    if (res.mult > 1) S.stats.mults[p]++;
    let bonus = false;
    if (res.combo) {
      S.stats.combos[p]++;
      if (S.bonusUsed < CONFIG.maxBonusActions) { S.actionsLeft++; S.bonusUsed++; bonus = true; }
    }
    let refilled = false;
    if (S.hands[p].every(x => !x)) { S.hands[p] = dealHand(S); refilled = true; }
    let ended = false;
    if (!S.over && S.actionsLeft <= 0) { endTurn(S); ended = true; }
    return { ...res, damage: hit, gold, coinCells, bonus, refilled, ended, player: p, piece, slot, r, c, target, hpBefore, hpAfter: S.hp[target], ko };
  }

  // ---------- бот ----------
  function allMoves(board, hand) {
    const out = [];
    hand.forEach((p, slot) => { if (p) for (const [r, c] of placements(board, p)) out.push({ slot, r, c }); });
    return out;
  }
  // Чим менше «дірок» і рваних країв, тим краще поле.
  function quality(b) {
    let trans = 0, iso = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c, f = !!b[i];
      if (c < N - 1 && f !== !!b[i + 1]) trans++;
      if (r < N - 1 && f !== !!b[i + N]) trans++;
      if (!f) {
        const up = r === 0 || b[i - N], dn = r === N - 1 || b[i + N], lf = c === 0 || b[i - 1], rt = c === N - 1 || b[i + 1];
        if (up && dn && lf && rt) iso++;
      }
    }
    return -(trans + iso * 4);
  }
  // Скільки максимум очок візьме суперник однією дією з видимої руки.
  function threat(board, hand) {
    let best = 0;
    for (const p of hand) {
      if (!p) continue;
      for (const [r, c] of placements(board, p)) {
        const res = place(board, p, r, c);
        if (res.points > best) best = res.points;
      }
    }
    return best;
  }
  const BONUS_VALUE = 15;

  function chooseMove(S, level) {
    const me = S.turn, hand = S.hands[me], board = S.board;
    const moves = allMoves(board, hand);
    if (!moves.length) return null;
    const pieceAt = m => hand[m.slot];

    if (level === 'easy') {
      const scored = moves.map(m => ({ m, pts: place(board, pieceAt(m), m.r, m.c).points }));
      const clears = scored.filter(x => x.pts > 0);
      if (clears.length && rand(S) < 0.5) return clears.reduce((a, b) => (b.pts > a.pts ? b : a)).m;
      return moves[Math.floor(rand(S) * moves.length)];
    }

    if (level === 'medium') {
      let best = null, bestV = -Infinity;
      for (const m of moves) {
        const res = place(board, pieceAt(m), m.r, m.c);
        const v = damage(S, me, res.points) * 100 + quality(res.board);
        if (v > bestV) { bestV = v; best = m; }
      }
      return best;
    }

    // hard: планує решту ходу (до 2 дій) і не лишає подарунків суперникові
    const opp = S.hands[1 - me];
    const bonusLeft = CONFIG.maxBonusActions - S.bonusUsed;
    const depth = Math.min(S.actionsLeft, 2);
    const cands = [];
    for (const m1 of moves) {
      const r1 = place(board, pieceAt(m1), m1.r, m1.c);
      const b1 = r1.combo && bonusLeft > 0;
      const v1 = damage(S, me, r1.points) + (b1 ? BONUS_VALUE : 0);
      const rest = hand.map((p, i) => (i === m1.slot ? null : p));
      const restHas = rest.some(Boolean);
      if (depth === 2 && restHas) {
        const m2s = allMoves(r1.board, rest);
        if (!m2s.length) { cands.push({ m1, final: r1.board, own: v1 - 10, endsTurn: !b1 }); continue; }
        for (const m2 of m2s) {
          const r2 = place(r1.board, rest[m2.slot], m2.r, m2.c);
          const b2 = r2.combo && bonusLeft - (b1 ? 1 : 0) > 0;
          cands.push({ m1, final: r2.board, own: v1 + damage(S, me, r2.points) + (b2 ? BONUS_VALUE : 0), endsTurn: !b1 && !b2 });
        }
      } else {
        cands.push({ m1, final: r1.board, own: v1, endsTurn: S.actionsLeft === 1 && !b1 });
      }
    }
    for (const x of cands) x.pre = x.own + 0.3 * quality(x.final);
    cands.sort((a, b) => b.pre - a.pre);
    const top = cands.slice(0, 40);
    let best = null, bestV = -Infinity;
    for (const x of top) {
      const danger = x.endsTurn ? damage(S, 1 - me, threat(x.final, opp)) : 0;
      const v = x.pre - 0.8 * danger;
      if (v > bestV) { bestV = v; best = x.m1; }
    }
    return best;
  }

  return { CONFIG, N, FAMILIES, NEUTRAL, BOMB, X2, rand, makePiece, genPiece, canPlace, fits, placements, place, spOf, colorOf, newGame, handFits, burn, act, timeout, winner, endTurn, chooseMove, quality, threat, damage };
})();
if (typeof module !== 'undefined') module.exports = BD;
