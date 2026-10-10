// Симуляції бот-проти-бота для балансу. node sim.js [games]
const BD = require('../src/engine.js');
const GAMES = +process.argv[2] || 400;

function play(seed, lv0, lv1, first) {
  const S = BD.newGame(seed, first);
  const lv = [lv0, lv1];
  let firstClearRound = null, hardMs = 0, hardCalls = 0, maxGap = 0;
  while (!S.over) {
    if (!BD.handFits(S)) { BD.burn(S); continue; }
    const t0 = performance.now();
    const m = BD.chooseMove(S, lv[S.turn]);
    const dt = performance.now() - t0;
    if (lv[S.turn] === 'hard') { hardMs += dt; hardCalls++; if (dt > maxGap) maxGap = dt; }
    const round = S.round;
    const r = BD.act(S, m.slot, m.r, m.c);
    if (r.n && firstClearRound === null) firstClearRound = round;
  }
  return { S, firstClearRound, hardMs, hardCalls, maxGap };
}

function matchup(lv0, lv1, games) {
  let w0 = 0, w1 = 0, d = 0, sc = [0, 0], firstWins = 0, decided = 0;
  let burns = 0, combos = 0, bombs = 0, mults = 0, specials = 0, actions = 0, fcr = 0, fcrN = 0, hardMs = 0, hardCalls = 0, maxMs = 0;
  const margins = [];
  for (let g = 0; g < games; g++) {
    const first = g % 2;
    const { S, firstClearRound, ...t } = play(1000 + g * 7919, lv0, lv1, first);
    const [a, b] = S.scores;
    sc[0] += a; sc[1] += b; margins.push(Math.abs(a - b));
    if (a > b) w0++; else if (b > a) w1++; else d++;
    if (a !== b) { decided++; if ((a > b ? 0 : 1) === S.first) firstWins++; }
    burns += S.stats.burns[0] + S.stats.burns[1];
    combos += S.stats.combos[0] + S.stats.combos[1];
    bombs += S.stats.bombs[0] + S.stats.bombs[1];
    mults += S.stats.mults[0] + S.stats.mults[1];
    specials += S.stats.specialsDealt;
    actions += S.stats.actions[0] + S.stats.actions[1];
    if (firstClearRound !== null) { fcr += firstClearRound; fcrN++; }
    hardMs += t.hardMs; hardCalls += t.hardCalls; maxMs = Math.max(maxMs, t.maxGap);
  }
  margins.sort((x, y) => x - y);
  return {
    matchup: `${lv0} vs ${lv1}`, games,
    winA: +(w0 / games * 100).toFixed(1), winB: +(w1 / games * 100).toFixed(1), draw: +(d / games * 100).toFixed(1),
    avgA: Math.round(sc[0] / games), avgB: Math.round(sc[1] / games),
    medianMargin: margins[Math.floor(games / 2)],
    firstMoverWin: +(firstWins / decided * 100).toFixed(1),
    burnsPerGame: +(burns / games).toFixed(2), combosPerGame: +(combos / games).toFixed(2),
    bombsPerGame: +(bombs / games).toFixed(2), multActionsPerGame: +(mults / games).toFixed(2),
    specialsDealtPerGame: +(specials / games).toFixed(2), actionsPerGame: +(actions / games).toFixed(1),
    firstClearRound: +(fcr / fcrN).toFixed(2),
    hardMsAvg: hardCalls ? +(hardMs / hardCalls).toFixed(1) : null, hardMsMax: hardCalls ? +maxMs.toFixed(0) : null,
  };
}

const rows = [
  matchup('easy', 'medium', GAMES),
  matchup('medium', 'hard', GAMES),
  matchup('easy', 'hard', GAMES),
  matchup('medium', 'medium', GAMES),
  matchup('hard', 'hard', GAMES),
];
console.log(JSON.stringify(rows, null, 1));
