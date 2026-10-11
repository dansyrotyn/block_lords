  // ---------- RPG profile and campaign screens ----------
  let storageWarning = '', storageUnavailable = false;
  function readProfile() {
    if (storageUnavailable) return profile || CAMP.create();
    try { return CAMP.restore(JSON.parse(localStorage.getItem(CAMP.KEY) || 'null')); }
    catch (e) { storageUnavailable = true; storageWarning = 'Збереження недоступне. Прогрес діятиме в цій сесії.'; return typeof profile !== 'undefined' ? profile : CAMP.create(); }
  }
  let profile;
  profile = readProfile();
  let selectedNode = Math.min(profile.cleared.length, CAMP.ENEMIES.length - 1), campaignTab = 'map', battleContext = null;
  function saveProfile() {
    try { localStorage.setItem(CAMP.KEY, JSON.stringify(profile)); }
    catch (e) { storageUnavailable = true; storageWarning = 'Збереження недоступне. Прогрес діятиме в цій сесії.'; }
    renderHomeProfile();
  }
  const percent = n => Math.round(n * 100);
  function portrait(race) {
    if (race === 'rat') return '__RAT__';
    const faces = {
      rat: '<ellipse cx="28" cy="28" rx="16" ry="22" fill="#B6A0CB"/><ellipse cx="72" cy="28" rx="16" ry="22" fill="#B6A0CB"/><ellipse cx="28" cy="28" rx="9" ry="15" fill="#E7BDD5"/><ellipse cx="72" cy="28" rx="9" ry="15" fill="#E7BDD5"/><path d="M22 44Q50 22 78 44L72 70L50 87L28 70Z" fill="#B6A0CB"/><ellipse cx="50" cy="66" rx="19" ry="15" fill="#E6D3DD"/><path d="M44 64L56 64L50 72Z" fill="#9C547B"/><path d="M45 77v7h10v-7" fill="#fff"/>',
      human: '<path d="M13 81V43Q16 7 50 7Q84 7 87 43v38Z" fill="#38648F"/><path d="M28 37Q50 16 72 37v28Q50 91 28 65Z" fill="#E9B681"/><path d="M21 40Q50 28 79 40v15H21Z" fill="#172B49"/><path d="M29 65Q50 57 71 65l-5 17H34Z" fill="#294663"/>',
      orc: '<path d="M22 40L8 28l5 28 12 3M78 40l14-12-5 28-12 3" fill="#9ACA6C"/><path d="M22 28Q50 9 78 28v39Q50 94 22 67Z" fill="#8ABD5F"/><path d="M20 30L28 12l22 9 22-9 8 18Z" fill="#36503A"/><path d="M29 63Q50 73 71 63v13H29Z" fill="#3A503A"/><path d="M31 75L34 58l9 17M57 75l9-17 3 17" fill="#FFF1C9"/>',
      demon: '<path d="M29 31Q10 21 17 3Q28 19 40 21M71 31Q90 21 83 3Q72 19 60 21" fill="#F6C279"/><path d="M23 28Q50 14 77 28l-4 42-23 19-23-19Z" fill="#CB667F"/><path d="M33 65L50 74l17-9-5 15H38Z" fill="#522C55"/><path d="M31 25L50 33l19-8-7-10H38Z" fill="#733B78"/>',
    };
    const eyeColor = race === 'demon' ? '#FFE36E' : '#fff';
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#203954"/><circle cx="50" cy="48" r="43" fill="${CAMP.RACES[race].color}" opacity=".2"/><g stroke="#18283C" stroke-width="3" stroke-linejoin="round">${faces[race]}<path d="M30 46h13v9H30ZM57 46h13v9H57Z" fill="${eyeColor}"/><path d="M38 47v7M62 47v7" stroke="#18283C" stroke-width="4"/></g></svg>`);
  }
  const HERO_AVATAR = '__HERO__';
  function readyCount() { return [...CAMP.QUESTS, ...CAMP.ACHIEVEMENTS].filter(q => !profile.claimed.includes(q.id) && profile.stats[q.stat] >= q.target).length; }
  function renderHomeProfile() {
    const p = CAMP.player(profile);
    $('homeGold').textContent = profile.gold;
    $('homeStats').textContent = `♥ ${p.hp} · ⚔ ${percent(p.attack)}% · ✦ ${percent(p.loot)}%`;
    $('homeQuestCount').textContent = readyCount() ? ` (${readyCount()})` : '';
  }
  function openCampaign(tab = 'map') {
    profile = readProfile(); campaignTab = tab;
    if (!CAMP.unlocked(profile, selectedNode)) selectedNode = Math.min(profile.cleared.length, 11);
    renderCampaign(); show('campaign');
  }
  function renderCampaign() {
    renderHomeProfile();
    $('campaignGold').textContent = profile.gold;
    const p = CAMP.player(profile);
    $('heroSummary').textContent = `♥ ${p.hp} HP · ⚔ ${percent(p.attack)}% сили · ✦ ${percent(p.loot)}% золота`;
    $('saveNotice').textContent = storageWarning;
    $('saveNotice').hidden = !storageWarning;
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === campaignTab ? 'true' : 'false'));
    const body = $('campaignContent'), detail = $('encounter');
    detail.hidden = campaignTab !== 'map';
    if (campaignTab === 'map') {
      $('campaignTitle').textContent = 'Шлях до вежі';
      body.innerHTML = `<p class="campaign-intro">Глава 1 · ${profile.cleared.length}/12 перемог<br><small>Кожна перемога відкриває наступного ворога.</small></p><div class="map-route">${CAMP.ENEMIES.map(e => {
        const open = CAMP.unlocked(profile, e.id), cleared = profile.cleared.includes(e.id);
        return `<button type="button" class="map-node ${selectedNode === e.id ? 'selected' : ''} ${cleared ? 'cleared' : ''}" data-node="${e.id}" aria-label="${e.id + 1}. ${e.name}${cleared ? ', переможено' : ''}" aria-pressed="${selectedNode === e.id}" ${open ? '' : 'disabled'}><span class="node-orb"><img src="${portrait(e.race)}" alt=""><i>${open ? cleared ? '✓' : e.boss ? '♛' : e.id + 1 : '🔒'}</i></span><span>${e.name}<small>${CAMP.RACES[e.race].name}${e.boss ? ' · Бос' : ''}</small></span></button>`;
      }).join('')}</div>`;
      const e = CAMP.ENEMIES[selectedNode], race = CAMP.RACES[e.race], repeat = profile.cleared.includes(e.id);
      const reward = Math.round((repeat ? Math.max(10, Math.floor(e.reward * .3)) : e.reward) * p.loot);
      detail.innerHTML = `<div class="encounter-heading"><img src="${portrait(e.race)}" alt=""><div><h2>${e.name}</h2><small>${race.name}${e.boss ? ' · Бос' : ''}</small></div></div><div class="enemy-stats"><span>♥ ${e.hp} HP</span><span>⚔ ${percent(e.attack)}%</span><span>🛡 ${percent(e.armor)}%</span></div><p>${race.trait}</p><div class="fight-row"><span class="reward">🪙 ${reward}<small>${repeat ? 'Повторна перемога' : 'Перша перемога'}</small></span><button class="btn-big fight-btn" data-start="${e.id}" type="button">У БІЙ</button></div><small class="battle-rule">8 монеток по 3 золота · 3 дії за хід</small>`;
    } else if (campaignTab === 'upgrades') {
      $('campaignTitle').textContent = 'Прокачка героя';
      body.innerHTML = `<p class="campaign-intro">Обирай, як посилити героя.<br><small>Ціна кожного параметра зростає окремо.</small></p>${Object.entries(CAMP.UPGRADES).map(([key, u]) => {
        const level = profile.levels[key], max = level >= u.cap, price = CAMP.cost(profile, key);
        const current = key === 'hp' ? `${p.hp} → ${p.hp + 15} HP` : `${percent(p[key === 'attack' ? 'attack' : 'loot'])}% → ${percent(p[key === 'attack' ? 'attack' : 'loot']) + 10}%`;
        return `<article class="upgrade-card panel-look"><div class="upgrade-icon">${u.icon}</div><div><h2>${u.name}</h2><small>Рівень ${level}/${u.cap}</small><p>${max ? 'Максимальний рівень' : current}</p><small>${u.detail}</small></div><button type="button" class="buy-btn" data-upgrade="${key}" ${max || profile.gold < price ? 'disabled' : ''}>${max ? 'MAX' : `🪙 ${price}`}<small>${max ? '' : profile.gold < price ? 'Бракує золота' : 'Покращити'}</small></button></article>`;
      }).join('')}`;
    } else {
      $('campaignTitle').textContent = 'Квести й досягнення';
      const cards = list => list.map(q => {
        const value = Math.min(q.target, profile.stats[q.stat]), claimed = profile.claimed.includes(q.id), ready = value >= q.target;
        return `<article class="quest-card panel-look"><h2>${claimed ? '✓ ' : ''}${q.name}</h2><p>${q.detail}</p><div class="quest-progress"><span style="width:${value / q.target * 100}%"></span></div><div class="quest-foot"><small>${value}/${q.target} · 🪙 ${q.reward}</small><button class="claim-btn" type="button" data-claim="${q.id}" ${claimed || !ready ? 'disabled' : ''}>${claimed ? 'Отримано' : ready ? 'Забрати' : 'У процесі'}</button></div></article>`;
      }).join('');
      body.innerHTML = `<p class="campaign-intro">За кожне виконане завдання — золото.<br><small>Бойові завдання зараховуються після завершення бою.</small></p><h2 class="section-label">Початкові квести</h2>${cards(CAMP.QUESTS)}<h2 class="section-label">Досягнення</h2>${cards(CAMP.ACHIEVEMENTS)}`;
    }
  }
  function beginEncounter(id) {
    profile = readProfile();
    if (!CAMP.unlocked(profile, id)) return;
    selectedNode = id;
    const e = CAMP.ENEMIES[id], hero = CAMP.player(profile);
    opp = { ...e, avatar: portrait(e.race) };
    battleContext = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, node: id, loot: hero.loot, settled: false };
    const myGen = ++gen;
    $('endScreen').hidden = true; $('leaveScreen').hidden = true;
    S = BD.newGame((Math.random() * 2 ** 31) | 0, undefined, { players: [hero, e], coinCount: 8 });
    startMatch(myGen);
  }
  function updateBattleMeta() {
    if (!S) return;
    $('battleMeta').textContent = `Раунд ${Math.min(S.round, 10)}/10 · 🪙 ${Math.round(S.gold[0] * battleContext.loot)} зібрано`;
  }
  function finishEncounter(winner) {
    if (!battleContext || battleContext.settled) return null;
    profile = readProfile();
    const result = CAMP.settle(profile, { ...battleContext, winner, gold: S.gold[0], collected: S.collected[0], actions: S.stats.actions[0], lines: S.stats.lines[0] });
    battleContext.settled = true; saveProfile(); return result;
  }
  $('campaign').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.tab) { campaignTab = b.dataset.tab; renderCampaign(); $('campaignContent').scrollTop = 0; }
    if (b.dataset.node !== undefined) { selectedNode = +b.dataset.node; const scroll = $('campaignContent').scrollTop; renderCampaign(); $('campaignContent').scrollTop = scroll; }
    if (b.dataset.start !== undefined) { unlockAudio(); sfx('play'); beginEncounter(+b.dataset.start); }
    if (b.dataset.upgrade) { profile = readProfile(); if (CAMP.buy(profile, b.dataset.upgrade)) { saveProfile(); sfx('combo'); } renderCampaign(); }
    if (b.dataset.claim) { profile = readProfile(); if (CAMP.claim(profile, b.dataset.claim)) { saveProfile(); sfx('win'); } const scroll = $('campaignContent').scrollTop; renderCampaign(); $('campaignContent').scrollTop = scroll; }
  });
  $('campaignBack').addEventListener('click', () => { sfx('back'); goHome(); });
  $('upgradeHome').addEventListener('click', () => openCampaign('upgrades'));
  $('questsHome').addEventListener('click', () => openCampaign('quests'));
  $('mapHome').addEventListener('click', () => openCampaign('map'));
  $('resultMap').addEventListener('click', () => { goHome(); openCampaign('map'); });
  $('resultUpgrade').addEventListener('click', () => { goHome(); openCampaign('upgrades'); });
