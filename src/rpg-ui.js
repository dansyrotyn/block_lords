  // ---------- RPG profile and campaign screens ----------
  let storageWarning = '', storageUnavailable = false;
  function readProfile() {
    if (storageUnavailable) return profile || CAMP.create();
    try { return CAMP.restore(JSON.parse(localStorage.getItem(CAMP.KEY) || 'null')); }
    catch (e) { storageUnavailable = true; storageWarning = 'Збереження недоступне. Прогрес діятиме в цій сесії.'; return typeof profile !== 'undefined' ? profile : CAMP.create(); }
  }
  let profile;
  profile = readProfile();
  let selectedNode = Math.min(profile.cleared.length, CAMP.ENEMIES.length - 1), battleContext = null;
  function saveProfile() {
    try { localStorage.setItem(CAMP.KEY, JSON.stringify(profile)); }
    catch (e) { storageUnavailable = true; storageWarning = 'Збереження недоступне. Прогрес діятиме в цій сесії.'; }
    renderHomeProfile();
  }
  const percent = n => Math.round(n * 100);
  const ENEMY_ART = { rat: '__RAT__', human: '__BANDIT__', orc: '__ORC__', demon: '__DEMON__' };
  const portrait = race => ENEMY_ART[race];
  const HERO_AVATAR = '__HERO__';
  function readyCount() { return [...CAMP.QUESTS, ...CAMP.ACHIEVEMENTS].filter(q => !profile.claimed.includes(q.id) && profile.stats[q.stat] >= q.target).length; }
  function renderHomeProfile() {
    const p = CAMP.player(profile);
    $('homeGold').textContent = profile.gold;
    $('homeStats').textContent = `♥ ${p.hp} · ⚔ ${percent(p.attack)}% · ✦ ${percent(p.loot)}%`;
    $('homeQuestCount').textContent = readyCount() ? ` (${readyCount()})` : '';
  }
  const MAP_POINTS = [[28,92],[61,85],[39,77],[70,69],[43,61],[24,53],[55,45],[75,37],[44,29],[26,22],[63,15],[50,8]];
  let activeWindow = null, returnFocus = null;
  const menuIcon = key => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#513414" stroke-width="2.5" stroke-linejoin="round">${key === 'upgrades' ? '<path d="M17 49L45 9l9-3-1 10-29 39Z" fill="#D4F2FF"/><path d="M20 42l13 10-6 6-13-10Z" fill="#FFC95A"/><path d="M16 50L7 61" stroke="#AE6B2D" stroke-width="7"/><path d="M37 48l8-22 11 5-8 22Z" fill="#7EBCF0"/><path d="M37 48l-8 6 11 4 8-5" fill="#F3C769"/>' : '<path d="M7 14q13-5 25 3 12-8 25-3v37q-13-4-25 3-12-7-25-3Z" fill="#F3D8A0"/><path d="M32 17v37"/><path d="M13 23l12 2m-12 6 12 2m-12 6 12 2m14-16 12-2m-12 10 12-2m-12 10 12-2" stroke="#A2723D"/><path d="M47 6l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#FFD258"/>'}</svg>`;
  function openCampaign(tab = 'map') {
    profile = readProfile(); closeCampaignWindow();
    selectedNode = Math.min(profile.cleared.length, CAMP.ENEMIES.length - 1);
    renderCampaign(); show('campaign');
    requestAnimationFrame(() => {
      const body = $('campaignContent'), map = body.querySelector('.world-map');
      body.scrollTop = Math.max(0, map.clientHeight * MAP_POINTS[selectedNode][1] / 100 - body.clientHeight * .6);
      if (tab !== 'map') openProgressWindow(tab);
    });
  }
  function renderCampaign() {
    renderHomeProfile();
    $('campaignGold').textContent = profile.gold;
    $('campaignTitle').textContent = 'Шлях до вежі';
    $('mapProgress').textContent = `${profile.cleared.length} / ${CAMP.ENEMIES.length}`;
    $('saveNotice').textContent = storageWarning; $('saveNotice').hidden = !storageWarning;
    $('mapQuestBadge').textContent = readyCount(); $('mapQuestBadge').hidden = !readyCount();
    const body = $('campaignContent'), scroll = body.scrollTop;
    const points = MAP_POINTS.map(([x,y]) => [x * 10,y * 27.5]);
    let route = `M ${points[0].join(' ')}`;
    for (let i = 1; i < points.length; i++) {
      const [x,y] = points[i], [px,py] = points[i-1], mid = (py+y)/2;
      route += ` C ${px} ${mid}, ${x} ${mid}, ${x} ${y}`;
    }
    body.innerHTML = `<div class="world-map" role="group" aria-label="Карта пригод: 12 боїв до вежі"><img class="world-terrain" src="__MAP__" alt="Мальований світ: ліси, руїни, гори й магічна вежа"><svg class="world-road" viewBox="0 0 1000 2750" aria-hidden="true"><path d="${route}" stroke="#3D3925" stroke-opacity=".5" stroke-width="31"/><path d="${route}" stroke="#E8CA83" stroke-width="23"/><path d="${route}" stroke="#FFF1B0" stroke-width="4" stroke-dasharray="2 18"/></svg><span class="region-label forest-label">Шепіт лісу</span><span class="region-label ruins-label">Забуті руїни</span><span class="region-label peaks-label">Оркові скелі</span><span class="region-label tower-label">Вежа демонів</span>${CAMP.ENEMIES.map(e => {
      const open = CAMP.unlocked(profile, e.id), cleared = profile.cleared.includes(e.id), current = e.id === Math.min(profile.cleared.length,11) && !cleared;
      const [x,y] = MAP_POINTS[e.id];
      return `<button type="button" class="world-node ${cleared ? 'cleared' : open ? 'available' : 'locked'} ${current ? 'current' : ''} ${e.boss ? 'boss' : ''}" style="left:${x}%;top:${y}%" data-node="${e.id}" aria-label="${e.id+1}. ${e.name}${cleared ? ', переможено' : open ? ', доступний бій' : ', заблоковано'}" ${open ? '' : 'disabled'}><span class="monster-medallion"><img src="${portrait(e.race)}" alt=""><span class="node-status">${cleared ? '✓' : open ? e.boss ? '♛' : e.id+1 : '🔒'}</span></span><span class="node-stars" aria-hidden="true">${cleared ? '★' : e.boss ? '♛' : '◆'}</span>${current ? '<span class="next-battle">У БІЙ</span>' : ''}</button>`;
    }).join('')}</div>`;
    body.scrollTop = scroll;
    $('mapUpgradeIcon').innerHTML = menuIcon('upgrades'); $('mapQuestIcon').innerHTML = menuIcon('quests');
    if (activeWindow === 'upgrades' || activeWindow === 'quests') renderProgressWindow();
  }
  function lockMap(value) {
    for (const id of ['mapHeader','campaignContent','mapFooter']) $(id).inert = value;
  }
  function closeCampaignWindow() {
    $('progressWindow').hidden = true; $('encounterWindow').hidden = true; activeWindow = null;
    lockMap(false);
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  function openProgressWindow(tab) {
    returnFocus = document.activeElement; activeWindow = tab;
    $('encounterWindow').hidden = true; renderProgressWindow(); $('progressContent').scrollTop = 0;
    $('progressWindow').hidden = false; lockMap(true); $('progressClose').focus();
  }
  function renderProgressWindow() {
    const body = $('progressContent'), p = CAMP.player(profile), scroll = body.scrollTop, hadFocus = body.contains(document.activeElement);
    $('progressGold').textContent = profile.gold;
    $('heroSummary').textContent = `♥ ${p.hp} HP · ⚔ ${percent(p.attack)}% · ✦ ${percent(p.loot)}%`;
    $('progressPortrait').src = HERO_AVATAR;
    if (activeWindow === 'upgrades') {
      $('progressTitle').textContent = 'Прокачка героя';
      body.innerHTML = `<p class="campaign-intro">Обирай, як посилити героя.<br><small>Ціна кожного параметра зростає окремо.</small></p>${Object.entries(CAMP.UPGRADES).map(([key, u]) => {
        const level = profile.levels[key], max = level >= u.cap, price = CAMP.cost(profile, key);
        const current = key === 'hp' ? `${p.hp} → ${p.hp + 15} HP` : `${percent(p[key === 'attack' ? 'attack' : 'loot'])}% → ${percent(p[key === 'attack' ? 'attack' : 'loot']) + 10}%`;
        return `<article class="upgrade-card panel-look"><div class="upgrade-icon">${u.icon}</div><div><h2>${u.name}</h2><small>Рівень ${level}/${u.cap}</small><p>${max ? 'Максимальний рівень' : current}</p><small>${u.detail}</small></div><button type="button" class="buy-btn" data-upgrade="${key}" ${max || profile.gold < price ? 'disabled' : ''}>${max ? 'MAX' : `🪙 ${price}`}<small>${max ? '' : profile.gold < price ? 'Бракує золота' : 'Покращити'}</small></button></article>`;
      }).join('')}`;
    } else {
      $('progressTitle').textContent = 'Квести й досягнення';
      const cards = list => list.map(q => {
        const value = Math.min(q.target, profile.stats[q.stat]), claimed = profile.claimed.includes(q.id), ready = value >= q.target;
        return `<article class="quest-card panel-look"><h2>${claimed ? '✓ ' : ''}${q.name}</h2><p>${q.detail}</p><div class="quest-progress"><span style="width:${value / q.target * 100}%"></span></div><div class="quest-foot"><small>${value}/${q.target} · 🪙 ${q.reward}</small><button class="claim-btn" type="button" data-claim="${q.id}" ${claimed || !ready ? 'disabled' : ''}>${claimed ? 'Отримано' : ready ? 'Забрати' : 'У процесі'}</button></div></article>`;
      }).join('');
      body.innerHTML = `<p class="campaign-intro">За кожне виконане завдання — золото.<br><small>Бойові завдання зараховуються після завершення бою.</small></p><h2 class="section-label">Початкові квести</h2>${cards(CAMP.QUESTS)}<h2 class="section-label">Досягнення</h2>${cards(CAMP.ACHIEVEMENTS)}`;
    }
    body.scrollTop = scroll;
    if (hadFocus) $('progressClose').focus();
  }
  function openEnemyWindow(id) {
    if (!CAMP.unlocked(profile,id)) return;
    selectedNode = id; returnFocus = document.activeElement; activeWindow = 'enemy';
    const e = CAMP.ENEMIES[id], race = CAMP.RACES[e.race], repeat = profile.cleared.includes(id), p = CAMP.player(profile);
    const reward = Math.round((repeat ? Math.max(10,Math.floor(e.reward*.3)) : e.reward)*p.loot);
    $('encounter').innerHTML = `<span class="encounter-kicker">БІЙ ${id+1} / 12${e.boss ? ' · БОС' : ''}</span><img class="enemy-portrait" src="${portrait(e.race)}" alt="${race.name}"><h2 id="enemyTitle">${e.name}</h2><small>${race.name}</small><div class="enemy-stats"><span>♥ ${e.hp} HP</span><span>⚔ ${percent(e.attack)}%</span><span>🛡 ${percent(e.armor)}%</span></div><p>${race.trait}</p><div class="fight-row"><span class="reward">🪙 ${reward}<small>${repeat ? 'Повторна перемога' : 'Перша перемога'}</small></span><button class="btn-big fight-btn" data-start="${id}" type="button">У БІЙ</button></div><small class="battle-rule">3 дії за хід · монети на арені</small>`;
    $('progressWindow').hidden = true; $('encounterWindow').hidden = false;
    lockMap(true); $('encounterClose').focus();
  }
  function beginEncounter(id) {
    profile = readProfile();
    if (!CAMP.unlocked(profile, id)) return;
    closeCampaignWindow(); selectedNode = id;
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
    if (e.target.classList.contains('campaign-window')) { closeCampaignWindow(); return; }
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.window) openProgressWindow(b.dataset.window);
    if (b.dataset.node !== undefined) openEnemyWindow(+b.dataset.node);
    if (b.dataset.close !== undefined) closeCampaignWindow();
    if (b.dataset.start !== undefined) { unlockAudio(); sfx('play'); beginEncounter(+b.dataset.start); }
    if (b.dataset.upgrade) { profile = readProfile(); if (CAMP.buy(profile,b.dataset.upgrade)) { saveProfile(); sfx('combo'); } renderCampaign(); }
    if (b.dataset.claim) { profile = readProfile(); if (CAMP.claim(profile,b.dataset.claim)) { saveProfile(); sfx('win'); } const scroll = $('progressContent').scrollTop; renderCampaign(); $('progressContent').scrollTop = scroll; }
  });
  $('campaign').addEventListener('keydown', e => {
    if (!activeWindow) return;
    if (e.key === 'Escape') { e.preventDefault(); closeCampaignWindow(); }
    if (e.key === 'Tab') {
      const root = activeWindow === 'enemy' ? $('encounterWindow') : $('progressWindow');
      const buttons = [...root.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('campaignBack').addEventListener('click', () => { closeCampaignWindow(); sfx('back'); goHome(); });
  $('upgradeHome').addEventListener('click', () => openCampaign('upgrades'));
  $('questsHome').addEventListener('click', () => openCampaign('quests'));
  $('mapHome').addEventListener('click', () => openCampaign('map'));
  $('resultMap').addEventListener('click', () => { goHome(); openCampaign('map'); });
  $('resultUpgrade').addEventListener('click', () => { goHome(); openCampaign('upgrades'); });
