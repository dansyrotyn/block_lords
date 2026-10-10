const BD = require('../src/engine.js');
const G = +process.argv[2] || 400;
function run(label, setup, lv) {
  const base = { ...BD.CONFIG }; setup(BD.CONFIG);
  let fw = 0, dec = 0, dr = 0;
  for (let g = 0; g < G; g++) {
    const S = BD.newGame(50000 + g * 104729, g % 2);
    while (!S.over) { if (!BD.handFits(S)) { BD.burn(S); continue; } const m = BD.chooseMove(S, lv); BD.act(S, m.slot, m.r, m.c); }
    const [a, b] = S.scores; if (a === b) { dr++; continue; } dec++; if ((a > b ? 0 : 1) === S.first) fw++;
  }
  Object.assign(BD.CONFIG, base);
  return { label, lv, firstWin: +(fw / dec * 100).toFixed(1), draws: +(dr / G * 100).toFixed(1) };
}
const out = [];
for (const lv of ['medium', 'hard']) {
  out.push(run('v1 (без компенсації)', c => {}, lv));
  out.push(run('другий: 1 дія в першому ході', c => { c.secondOpeningActions = 1; }, lv));
  out.push(run('першому +1 дія в останньому раунді', c => { c.firstFinalBonus = 1; }, lv));
}
console.log(JSON.stringify(out, null, 1));
