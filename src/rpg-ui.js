  // ---------- RPG profile and campaign screens ----------
  let storageWarning = '', storageUnavailable = false;
  function readProfile() {
    if (storageUnavailable) return profile || CAMP.create();
    try { return CAMP.restore(JSON.parse(localStorage.getItem(CAMP.KEY) || 'null')); }
    catch (e) { storageUnavailable = true; storageWarning = 'Saving is unavailable. Progress will last for this session only.'; return typeof profile !== 'undefined' ? profile : CAMP.create(); }
  }
  let profile;
  profile = readProfile();
  let selectedNode = CAMP.recommended(profile), battleContext = null;
  function saveProfile() {
    try { localStorage.setItem(CAMP.KEY, JSON.stringify(profile)); }
    catch (e) { storageUnavailable = true; storageWarning = 'Saving is unavailable. Progress will last for this session only.'; }
    renderHomeProfile();
  }
  const GOLD_ICON = '<span class="gold-icon" aria-hidden="true"></span>';
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
  const MAP_POINTS = [[28,92],[56,85],[70,77],[49,69],[28,61],[37,53],[65,45],[72,37],[52,29],[29,23],[36,16],[50,9]];
  let activeWindow = null, returnFocus = null;
  const menuIcon = key => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#513414" stroke-width="2.5" stroke-linejoin="round">${key === 'upgrades' ? '<path d="M17 49L45 9l9-3-1 10-29 39Z" fill="#D4F2FF"/><path d="M20 42l13 10-6 6-13-10Z" fill="#FFC95A"/><path d="M16 50L7 61" stroke="#AE6B2D" stroke-width="7"/><path d="M37 48l8-22 11 5-8 22Z" fill="#7EBCF0"/><path d="M37 48l-8 6 11 4 8-5" fill="#F3C769"/>' : '<path d="M7 14q13-5 25 3 12-8 25-3v37q-13-4-25 3-12-7-25-3Z" fill="#F3D8A0"/><path d="M32 17v37"/><path d="M13 23l12 2m-12 6 12 2m-12 6 12 2m14-16 12-2m-12 10 12-2m-12 10 12-2" stroke="#A2723D"/><path d="M47 6l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#FFD258"/>'}</svg>`;
  function openCampaign(tab = 'map') {
    stopMapGlide(); profile = readProfile(); closeCampaignWindow();
    selectedNode = CAMP.recommended(profile);
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
    $('campaignTitle').textContent = 'Road to the Tower';
    $('mapProgress').textContent = `${profile.cleared.length} / ${CAMP.ENEMIES.length}`;
    $('saveNotice').textContent = storageWarning; $('saveNotice').hidden = !storageWarning;
    $('mapQuestBadge').textContent = readyCount(); $('mapQuestBadge').hidden = !readyCount();
    const body = $('campaignContent'), scroll = body.scrollTop;
    const points = MAP_POINTS.map(([x,y]) => [x*10,y*35]);
    let route = `M ${points[0].join(' ')}`;
    for (let i=1;i<points.length;i++) {
      const [x,y] = points[i], [px,py] = points[i-1], mid = (y+py)/2;
      route += ` C ${px} ${mid}, ${x} ${mid}, ${x} ${y}`;
    }
    const routes = `<path class="route-edge open" d="${route}"/>`;
    body.innerHTML = `<div class="world-map" role="group" aria-label="Adventure map: winding trail from the forest to the tower"><img class="world-terrain" src="__MAP__" alt="Ancient parchment map with forests, mountains, and a tower"><svg class="world-road" viewBox="0 0 1000 3500" aria-hidden="true">${routes}</svg><span class="region-label forest-label">Woodland Trail</span><span class="region-label peaks-label">Orc Highlands</span><span class="region-label tower-label">Demon Tower</span>${CAMP.ENEMIES.map(e => {
      const open = CAMP.unlocked(profile,e.id), cleared = profile.cleared.includes(e.id), current = e.id === CAMP.recommended(profile) && !cleared;
      const risk = CAMP.danger(profile,e.id), [x,y] = MAP_POINTS[e.id];
      const hint = CAMP.PARENTS[e.id].map(id => CAMP.ENEMIES[id].name).join(' or ');
      return `<button type="button" class="world-node ${x >= 50 ? 'label-left' : 'label-right'} ${cleared ? 'cleared' : open ? 'available' : 'locked'} ${current ? 'current' : ''} ${e.boss ? 'boss' : ''}" style="left:${x}%;top:${y}%" data-node="${e.id}" title="${open ? e.name : 'First defeat: '+hint}" aria-label="${e.name}${cleared ? ', defeated' : open ? ', battle available'+(risk === 'high' ? ', stronger than your hero' : '') : ', locked'}" ${open ? '' : 'disabled'}><span class="monster-medallion"><img src="${portrait(e.race)}" alt="" draggable="false"><span class="node-status">${cleared ? '✓' : open ? e.boss ? '♛' : e.id+1 : '🔒'}</span></span><span class="node-name">${e.name}</span><span class="node-caption">${cleared ? 'Defeated' : open ? risk === 'high' ? '⚠ Stronger' : risk === 'medium' ? 'Hard' : current ? 'FIGHT' : 'Available' : 'Locked'}</span></button>`;
    }).join('')}</div>`;
    body.scrollTop = scroll;
    $('mapUpgradeIcon').innerHTML = menuIcon('upgrades'); $('mapQuestIcon').innerHTML = menuIcon('quests');
    if (activeWindow === 'upgrades' || activeWindow === 'quests') renderProgressWindow();
  }
  function lockMap(value) {
    for (const id of ['mapHeader','campaignContent','mapFooter']) $(id).inert = value;
  }
  function closeCampaignWindow() {
    stopMapGlide();
    $('progressWindow').hidden = true; $('encounterWindow').hidden = true; activeWindow = null;
    lockMap(false);
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  function openProgressWindow(tab) {
    stopMapGlide(); returnFocus = document.activeElement; activeWindow = tab;
    $('encounterWindow').hidden = true; $('progressWindow').hidden = false;
    renderProgressWindow(); $('progressContent').scrollTop = 0; lockMap(true); $('progressClose').focus();
  }
  function renderProgressWindow() {
    const body = $('progressContent'), p = CAMP.player(profile), scroll = body.scrollTop, hadFocus = body.contains(document.activeElement);
    $('progressGold').textContent = profile.gold;
    $('heroSummary').textContent = `♥ ${p.hp} HP · ⚔ ${percent(p.attack)}% · ✦ ${percent(p.loot)}%`;
    $('progressPortrait').src = HERO_AVATAR;
    if (activeWindow === 'upgrades') {
      $('progressTitle').textContent = 'Hero Upgrades';
      body.innerHTML = `<p class="campaign-intro">Choose how to strengthen your hero.<br><small>Each upgrade has its own growing price.</small></p>${Object.entries(CAMP.UPGRADES).map(([key, u]) => {
        const level = profile.levels[key], max = level >= u.cap, price = CAMP.cost(profile, key);
        const current = key === 'hp' ? `${p.hp} → ${p.hp + 15} HP` : `${percent(p[key === 'attack' ? 'attack' : 'loot'])}% → ${percent(p[key === 'attack' ? 'attack' : 'loot']) + 10}%`;
        return `<article class="upgrade-card panel-look"><div class="upgrade-icon">${u.icon}</div><div><h2>${u.name}</h2><small>Level ${level}/${u.cap}</small><p>${max ? 'Maximum level' : current}</p><small>${u.detail}</small></div><button type="button" class="buy-btn" data-upgrade="${key}" ${max || profile.gold < price ? 'disabled' : ''}>${max ? 'MAX' : `${GOLD_ICON} ${price}`}<small>${max ? '' : profile.gold < price ? 'Not enough gold' : 'Upgrade'}</small></button></article>`;
      }).join('')}`;
    } else {
      $('progressTitle').textContent = 'Quests & Achievements';
      const cards = list => list.map(q => {
        const value = Math.min(q.target, profile.stats[q.stat]), claimed = profile.claimed.includes(q.id), ready = value >= q.target;
        return `<article class="quest-card panel-look"><h2>${claimed ? '✓ ' : ''}${q.name}</h2><p>${q.detail}</p><div class="quest-progress"><span style="width:${value / q.target * 100}%"></span></div><div class="quest-foot"><small>${value}/${q.target} · ${GOLD_ICON} ${q.reward}</small><button class="claim-btn" type="button" data-claim="${q.id}" ${claimed || !ready ? 'disabled' : ''}>${claimed ? 'Claimed' : ready ? 'Claim' : 'In progress'}</button></div></article>`;
      }).join('');
      body.innerHTML = `<p class="campaign-intro">Complete quests to earn gold.<br><small>Battle progress is counted when the battle ends.</small></p><h2 class="section-label">Starter Quests</h2>${cards(CAMP.QUESTS)}<h2 class="section-label">Achievements</h2>${cards(CAMP.ACHIEVEMENTS)}`;
    }
    body.scrollTop = scroll;
    if (hadFocus) $('progressClose').focus();
  }
  function openEnemyWindow(id) {
    if (!CAMP.unlocked(profile,id)) return;
    stopMapGlide(); selectedNode = id; returnFocus = document.activeElement; activeWindow = 'enemy';
    const e = CAMP.ENEMIES[id], race = CAMP.RACES[e.race], repeat = profile.cleared.includes(id), p = CAMP.player(profile);
    const risk = CAMP.danger(profile,id);
    const reward = Math.round((repeat ? Math.max(10,Math.floor(e.reward*.3)) : e.reward)*p.loot);
    $('encounter').innerHTML = `<span class="encounter-kicker">BATTLE ${id+1} / 12${e.boss ? ' · BOSS' : ''}</span><img class="enemy-portrait" src="${portrait(e.race)}" alt="${race.name}"><h2 id="enemyTitle">${e.name}</h2><small>${race.name}</small><div class="enemy-stats"><span>♥ ${e.hp} HP</span><span>⚔ ${percent(e.attack)}%</span><span>🛡 ${percent(e.armor)}%</span></div><p>${race.trait}</p>${repeat ? '<p class="victory-note">✓ You have already defeated this enemy</p>' : risk === 'high' ? '<p class="danger-note">⚠ Stronger than your hero. Take the risk, or upgrade and return later.</p>' : risk === 'medium' ? '<p class="danger-note">A tough fight. Check your upgrades before entering.</p>' : ''}<div class="fight-row"><span class="reward">${GOLD_ICON} ${reward}<small>${repeat ? 'Replay reward' : 'First victory'}</small></span><button class="btn-big fight-btn" data-start="${id}" type="button">FIGHT</button></div><small class="battle-rule">3 actions per turn · coins on the board</small>`;
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
    $('battleMeta').innerHTML = `Round ${Math.min(S.round, 10)}/10 · ${GOLD_ICON} ${Math.round(S.gold[0] * battleContext.loot)} collected`;
  }
  function finishEncounter(winner) {
    if (!battleContext || battleContext.settled) return null;
    profile = readProfile();
    const result = CAMP.settle(profile, { ...battleContext, winner, gold: S.gold[0], collected: S.collected[0], actions: S.stats.actions[0], lines: S.stats.lines[0] });
    battleContext.settled = true; saveProfile(); return result;
  }
  // Drag-to-scroll for both the map and window contents. Touch and mouse share one path.
  const swipeControllers = [];
  function stopMapGlide() { swipeControllers.forEach(controller => controller.stop()); }
  function bindSwipeScroll(element, enabled) {
    let pan = null, frame = 0, suppressClickUntil = 0;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    swipeControllers.push({stop});
    element.addEventListener('dragstart',e => e.preventDefault());
    element.addEventListener('pointerdown',e => {
      if (!enabled() || !e.isPrimary || e.button !== 0) return;
      stop();
      pan = {id:e.pointerId,startY:e.clientY,lastY:e.clientY,startScroll:element.scrollTop,lastTime:performance.now(),velocity:0,moved:false};
    });
    element.addEventListener('pointermove',e => {
      if (!pan || pan.id !== e.pointerId) return;
      const dy = e.clientY-pan.startY;
      if (!pan.moved && Math.abs(dy) < 6) return;
      if (!pan.moved) { pan.moved = true; element.setPointerCapture(e.pointerId); element.classList.add('panning'); }
      e.preventDefault();
      const now = performance.now(), dt = Math.max(1,now-pan.lastTime);
      pan.velocity = .4*pan.velocity+.6*(pan.lastY-e.clientY)/dt;
      pan.lastY = e.clientY; pan.lastTime = now;
      element.scrollTop = pan.startScroll-dy;
    },{passive:false});
    const end = e => {
      if (!pan || pan.id !== e.pointerId) return;
      const state = pan; pan = null; element.classList.remove('panning');
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      if (!state.moved) return;
      suppressClickUntil = Date.now()+400;
      if (e.type === 'pointercancel' || performance.now()-state.lastTime > 100) return;
      let velocity = Math.max(-1.6,Math.min(1.6,state.velocity)), last = performance.now();
      const glide = now => {
        const dt = Math.min(32,now-last), before = element.scrollTop; last = now;
        element.scrollTop += velocity*dt; velocity *= Math.pow(.92,dt/16);
        if (Math.abs(velocity) > .03 && element.scrollTop !== before && enabled()) frame = requestAnimationFrame(glide);
        else frame = 0;
      };
      frame = requestAnimationFrame(glide);
    };
    element.addEventListener('pointerup',end); element.addEventListener('pointercancel',end);
    element.addEventListener('wheel',stop,{passive:true});
    element.addEventListener('click',e => {
      if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
    },true);
  }
  bindSwipeScroll($('campaignContent'),() => !activeWindow && !$('campaign').hidden);
  bindSwipeScroll($('progressContent'),() => !$('progressWindow').hidden);
  bindSwipeScroll($('endScreen').querySelector('.panel'),() => !$('endScreen').hidden);
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
