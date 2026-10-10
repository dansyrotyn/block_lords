const BD = require('../src/engine.js');
const G = 300, pairs = [['medium','medium'],['hard','hard'],['easy','medium'],['medium','hard']];
for (const [a,b] of pairs) {
  let ko = 0, koRound = 0, draws = 0, w = [0,0];
  for (let g = 0; g < G; g++) {
    const S = BD.newGame(777 + g * 31, g % 2), lv = [a,b];
    while (!S.over) { if (!BD.handFits(S)) { BD.burn(S); continue; } const m = BD.chooseMove(S, lv[S.turn]); BD.act(S, m.slot, m.r, m.c); }
    const win = BD.winner(S); if (win === -1) draws++; else w[win]++;
    if (S.ko !== null) { ko++; koRound += S.round; }
  }
  console.log(`${a} vs ${b}: KO ${(ko/G*100).toFixed(0)}% (avg round ${(koRound/Math.max(1,ko)).toFixed(1)}), wins ${w[0]}/${w[1]}, draws ${draws}`);
}
