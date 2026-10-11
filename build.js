// Збирає гру в один самодостатній HTML-файл: node build.js [вихідний файл]
const fs = require('fs'), path = require('path');
const root = __dirname;
const out = process.argv[2] || path.join(root, 'dist', 'blockbusters.html');
const b64 = f => fs.readFileSync(f).toString('base64');
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav' };
const dataUri = f => `data:${MIME[path.extname(f).slice(1)]};base64,` + b64(f);

// аватарки суперників і гравця
const avDir = path.join(root, 'assets', 'avatars');
const avatars = fs.readdirSync(avDir).filter(f => f.endsWith('.jpg')).sort().map(f => dataUri(path.join(avDir, f)));
const player = dataUri(path.join(root, 'assets', 'player.jpg'));

// арт: фон меню, поле і фони матчу
const ART = { __HOME__: 'home-ui-reference.png', __MAP__: 'world-map-parchment-v2.jpg', __BANDIT__: 'bandit-v1.jpg', __ORC__: 'orc-v1.jpg', __DEMON__: 'demon-v1.jpg', __BOARD__: 'arena-runes.png', __HERO__: 'hero-mage.jpg', __RAT__: 'rat-scout.jpg', __MAGIC__: 'magic-block.png', __BGTOP__: 'bg_top.webp', __BGBOTTOM__: 'bg_bottom.webp' };

// звуки: ім'я файлу без розширення = ім'я звуку в коді (sfx('place1'))
const sfxDir = path.join(root, 'assets', 'sfx');
const SFX = {};
for (const f of fs.readdirSync(sfxDir).filter(f => /\.(mp3|wav)$/.test(f)).sort()) SFX[f.replace(/\.(mp3|wav)$/, '')] = dataUri(path.join(sfxDir, f));

const engine = fs.readFileSync(path.join(root, 'src', 'engine.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = BD;", '');
let html = fs.readFileSync(path.join(root, 'src', 'game.html'), 'utf8');
html = html
  .replace('/*MAP_CSS*/', () => fs.readFileSync(path.join(root, 'src', 'map.css'), 'utf8'))
  .replace('/*DEBUG_CSS*/', () => fs.readFileSync(path.join(root, 'src', 'debug.css'), 'utf8'))
  .replace('/*SFX*/{}', () => JSON.stringify(SFX))
  .replace('/*ENGINE*/', () => engine)
  .replace('/*CAMPAIGN*/', () => fs.readFileSync(path.join(root, 'src', 'campaign.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = CAMP;", ''))
  .replace('/*RPG_UI*/', () => fs.readFileSync(path.join(root, 'src', 'rpg-ui.js'), 'utf8'))
  .replace('/*DEBUG_TOOLS*/', () => fs.readFileSync(path.join(root, 'src', 'debug-tools.js'), 'utf8').replace(/^const BD = .*\nconst CAMP = .*\n/m, '').replace("if (typeof module !== 'undefined') module.exports = DEV;", ''))
  .replace('/*DEBUG_UI*/', () => fs.readFileSync(path.join(root, 'src', 'debug-ui.js'), 'utf8'))
  .replace('/*AVATARS*/[]', () => JSON.stringify(avatars))
  .replace("'/*PLAYER*/'", () => JSON.stringify(player));

for (const [token, file] of Object.entries(ART)) html = html.split(token).join(dataUri(path.join(root, 'assets', 'art', file)));

// повноцінна сторінка, щоб файл відкривався в браузері напряму
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#000000">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${html}
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`built ${path.relative(root, out)}: ${(page.length / 1024).toFixed(0)} KB, ${avatars.length} avatars, ${Object.keys(SFX).length} sounds`);
