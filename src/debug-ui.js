  // Visible testing controls; the sandbox has its own save key.
  let debugTab = 'battle', debugEnemy = selectedNode, debugDraft = {}, debugReturnFocus = null;
  let normalMemory = null, testMemory = null;
  const debugField = (key,label,value,min=0,max=1e9,step=1,wide=false) => `<label class="${wide ? 'debug-wide' : ''}">${label}<input name="${key}" type="number" value="${value ?? ''}" min="${min}" ${max == null ? '' : `max="${max}"`} step="${step}"></label>`;
  const debugSelect = (key,label,value,options,wide=false) => `<div class="debug-field ${wide ? 'debug-wide' : ''}"><label for="debug-field-${key}">${label}</label><select id="debug-field-${key}" name="${key}">${options.map(([id,name]) => `<option value="${id}" ${String(value) === String(id) ? 'selected' : ''}>${name}</option>`).join('')}</select></div>`;
  const debugButton = (action,label,style='',disabled=false) => `<button class="debug-button ${style}" type="button" data-debug-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const debugValues = () => Object.fromEntries([...$('debugContent').querySelectorAll('[name]')].map(el => [el.name,el.type === 'checkbox' ? el.checked : el.value]));
  const debugMessage = message => { $('debugStatus').textContent = message; };
  function refreshTestBadges() {
    for (const id of ['testHome','testMap','testBattle']) {
      $(id).classList.toggle('active',testMode);
      $(id).title = testMode ? 'Test mode active: separate progress, all enemies available' : 'Open test menu';
    }
    $('debugModeLabel').textContent = testMode ? 'SANDBOX · separate test save' : 'Normal progress · live tools locked';
    $('debugModeToggle').textContent = testMode ? 'Return to normal' : 'Enable sandbox';
  }
  function refreshDebugBackground() {
    renderHomeProfile(); refreshTestBadges();
    if (!$('campaign').hidden) renderCampaign();
    if (S) { renderBoard(S.board); renderTray(false); renderTurnbar(); setHp(0,S.hp[0],true); setHp(1,S.hp[1],true); }
  }
  function setTestMode(enabled) {
    if (testMode === enabled) return;
    const screen = document.body.dataset.screen, copy = JSON.parse(JSON.stringify(profile));
    if (testMode) testMemory = copy; else normalMemory = copy;
    goHome(); closeCampaignWindow(); testMode = enabled;
    if (!enabled) { DEV.resetBalance(); debugPauseBot = false; }
    if (storageUnavailable) profile = enabled ? testMemory || DEV.restoreProfile(copy) : normalMemory || CAMP.create();
    else if (enabled) {
      try { const raw = JSON.parse(localStorage.getItem(DEV.KEY) || 'null'); profile = raw ? DEV.restoreProfile(raw) : DEV.restoreProfile(copy); }
      catch { profile = DEV.restoreProfile(copy); }
    } else profile = readProfile();
    if (enabled) saveProfile();
    if (screen === 'campaign' || screen === 'game') openCampaign();
    refreshDebugBackground();
  }
  function openDebugMenu() {
    if (debugOpen) return;
    debugReturnFocus = document.activeElement;
    closeCampaignWindow(); stopMapGlide();
    if (drag) cancelDrag();
    if (S && !S.over) {
      ++gen; timer.running = false; setCountdown(null); animating = false; setBusy(true);
      finger.classList.remove('on','press'); document.querySelectorAll('.ghost').forEach(el => el.remove()); fx.innerHTML = '';
      renderBoard(S.board); setPreview(0,0); setPreview(1,0);
    }
    debugOpen = true; $('debugWindow').hidden = false;
    for (const id of ['app','soundBtn','endScreen','leaveScreen']) $(id).inert = true;
    renderDebugMenu(); debugMessage(S && !S.over ? 'Battle paused while this menu is open.' : 'Ready. Sandbox battles can face any enemy.');
    $('debugClose').focus();
  }
  function closeDebugMenu(resume = true) {
    debugOpen = false; $('debugWindow').hidden = true;
    for (const id of ['app','soundBtn','endScreen','leaveScreen']) $(id).inert = false;
    refreshDebugBackground();
    if (debugReturnFocus?.isConnected) debugReturnFocus.focus();
    if (resume && S && !S.over) {
      shownTurn = S.turn; timer.left = Math.max(1000,timer.left); timer.running = BD.CONFIG.turnTimerEnabled; animating = false;
      step(gen);
    }
  }
  function renderDebugMenu() {
    refreshTestBadges();
    for (const button of $('debugWindow').querySelectorAll('[data-debug-tab]')) button.setAttribute('aria-selected',String(button.dataset.debugTab === debugTab));
    const body = $('debugContent');
    if (debugTab === 'battle') {
      const hero = CAMP.player(profile), enemy = CAMP.ENEMIES[debugEnemy];
      const v = {heroHp:hero.hp,heroAttack:percent(hero.attack),heroArmor:0,heroLoot:percent(hero.loot),
        enemyHp:enemy.hp,enemyAttack:percent(enemy.attack),enemyArmor:percent(enemy.armor),reward:enemy.reward,ai:enemy.ai,
        coinCount:CAMP.CONFIG.coinCount,coinGold:CAMP.CONFIG.coinGold,first:'random',seed:'',pauseBot:debugPauseBot,...debugDraft};
      body.innerHTML = `<p class="debug-note">Start a sandbox battle against any monster. Hero and enemy overrides apply to this battle. Opening this menu pauses the timer and bot.</p><div class="debug-fields">${debugSelect('enemy','Opponent',debugEnemy,CAMP.ENEMIES.map(e=>[e.id,`${e.id+1}. ${e.name} · ${CAMP.RACES[e.race].name}`]),true)}
        ${debugField('heroHp','Hero starting HP',v.heroHp,1,null)}${debugField('enemyHp','Enemy starting HP',v.enemyHp,1,100000)}
        ${debugField('heroAttack','Hero attack (%)',v.heroAttack,10,10000,10)}${debugField('enemyAttack','Enemy attack (%)',v.enemyAttack,10,10000,10)}
        ${debugField('heroArmor','Hero armor (%)',v.heroArmor,0,60)}${debugField('enemyArmor','Enemy armor (%)',v.enemyArmor,0,60)}
        ${debugField('heroLoot','Gold multiplier (%)',v.heroLoot,0,10000,10)}${debugField('reward','First victory gold',v.reward,0,1e6)}
        ${debugSelect('ai','Bot difficulty',v.ai,[['easy','Easy'],['medium','Medium'],['hard','Hard']])}${debugSelect('first','First turn',v.first,[['random','Random'],['0','Hero'],['1','Enemy']])}
        ${debugField('coinCount','Coins on board',v.coinCount,0,64)}${debugField('coinGold','Gold per coin',v.coinGold,1,1e6)}
        ${debugField('seed','Random seed (blank = random)',v.seed,-2147483648,2147483647,1,true)}</div>
        <label class="debug-check"><input name="pauseBot" type="checkbox" ${v.pauseBot ? 'checked' : ''}>Pause bot turns for manual inspection</label>
        <div class="debug-actions">${debugButton('start','START TEST BATTLE','primary')}${debugButton('battle-defaults','Use default stats')}</div>
        <p>Board: ${BD.N} × ${BD.N} · ${BD.CONFIG.rounds} rounds · ${BD.CONFIG.baseActions} actions · ${BD.CONFIG.turnTimerEnabled ? BD.CONFIG.turnSeconds+'s per turn' : 'No time limit'}. Configure these in Balance.</p>`;
    } else if (debugTab === 'balance') {
      const fields = (group,list,values) => `<div class="debug-fields">${list.map(([key,label,min,max,step])=>debugField(group+'_'+key,label,values[key],min,max,step)).join('')}</div>`;
      body.innerHTML = `<p class="debug-note">Balance changes affect sandbox games for this session. Returning to normal restores the standard rules. Decimal multipliers use 1 = 100%.</p><div class="debug-actions">${debugButton('balance-save','Apply balance','primary')}${debugButton('balance-reset','Reset balance')}</div>
        <h3>Puzzle & Combat</h3>
        <label class="debug-check"><input name="engine_turnTimerEnabled" type="checkbox" ${BD.CONFIG.turnTimerEnabled ? 'checked' : ''}>Enable turn timer</label>
        <p>No time limit by default. The duration below applies when the turn timer is enabled.</p>
        ${fields('engine',DEV.ENGINE_FIELDS,BD.CONFIG)}
        <p>Fixed layout: ${BD.N} × ${BD.N} board, ${BD.CONFIG.handSize} pieces per hand, ${BD.CONFIG.colors} internal colors. One x2 block doubles damage; the cap limits stacked multipliers. Bombs affect a 3 × 3 area.</p>
        <h3>Hero & Gold</h3>${fields('rpg',DEV.RPG_FIELDS,CAMP.CONFIG)}
        <h3>Upgrade Prices</h3>${Object.entries(CAMP.UPGRADES).map(([key,u])=>`<h3>${u.name}</h3>${key === 'hp' ? '<p>Vitality has no level limit. Next price = starting price + price increase × current level.</p>' : ''}<div class="debug-fields">${debugField('upgrade_'+key+'_base','Starting price',u.base,1,1e6)}${key === 'hp' ? debugField('upgrade_'+key+'_step','Price increase per level',u.step,1,1e6) : debugField('upgrade_'+key+'_growth','Price growth multiplier',u.growth,1,3,.01)+debugField('upgrade_'+key+'_cap','Maximum level',u.cap,1,50)}</div>`).join('')}
        <h3>Quest & Achievement Targets</h3>${[...CAMP.QUESTS,...CAMP.ACHIEVEMENTS].map(q=>`<h3>${q.name}</h3><div class="debug-fields">${debugField('quest_'+q.id+'_target','Target',q.target,1,1e6)}${debugField('quest_'+q.id+'_reward','Gold reward',q.reward,0,1e6)}</div>`).join('')}
        <div class="debug-actions">${debugButton('balance-save','Apply balance','primary')}${debugButton('balance-reset','Reset balance')}</div>`;
    } else if (debugTab === 'progress') {
      body.innerHTML = `<p class="debug-note">These controls write only to the separate sandbox profile. Your normal campaign stays in its own save.</p><div class="debug-fields">${debugField('gold','Gold',profile.gold)}${Object.entries(CAMP.UPGRADES).map(([key,u])=>debugField('level_'+key,u.name+' level',profile.levels[key],0,u.cap)).join('')}</div>
        <div class="debug-actions">${debugButton('progress-save','Apply progress','primary')}${debugButton('add-gold','+10,000 gold')}${debugButton('boss-build','Boss-ready build')}</div>
        <h3>Quest Counters</h3><div class="debug-fields">${CAMP.STAT_KEYS.map(key=>debugField('stat_'+key,({games:'Completed battles',actions:'Pieces placed',lines:'Lines cleared',coins:'Coins collected',upgrades:'Upgrades purchased',ratWins:'Ratfolk victories',wins:'Total victories',tower:'Tower conquered'})[key],profile.stats[key])).join('')}</div>
        <div class="debug-actions">${debugButton('ready-quests','Complete all quest targets')}</div>
        <h3>Defeated Enemies</h3><p>All enemies are playable in sandbox, even without victory markers.</p><div class="debug-checklist">${CAMP.ENEMIES.map(e=>`<label class="debug-check"><input type="checkbox" data-debug-cleared="${e.id}" ${profile.cleared.includes(e.id) ? 'checked' : ''}>${e.name}</label>`).join('')}</div>
        <div class="debug-actions">${debugButton('clear-all','Mark all defeated')}${debugButton('clear-none','Clear victory markers')}</div>
        <h3>Claimed Rewards</h3><div class="debug-checklist">${[...CAMP.QUESTS,...CAMP.ACHIEVEMENTS].map(q=>`<label class="debug-check"><input type="checkbox" data-debug-claimed="${q.id}" ${profile.claimed.includes(q.id) ? 'checked' : ''}>${q.name}</label>`).join('')}</div>
        <div class="debug-actions">${debugButton('progress-save','Apply progress','primary')}${debugButton('profile-reset','Reset test profile','danger')}</div>
        <h3>Import / Export</h3><label>Paste profile JSON or an exported test snapshot<textarea name="profileJson" rows="5"></textarea></label><div class="debug-actions">${debugButton('import-profile','Import test profile')}${debugButton('export','Download state JSON')}</div>`;
    } else {
      const live = S && !S.over && battleContext?.test;
      body.innerHTML = `<p class="debug-note">${live ? 'Battle paused. Apply values, then close this menu to continue.' : S && !S.over ? 'This is a normal battle. Start a sandbox battle to edit live state.' : 'Start a test battle to use live controls.'}</p>`;
      if (live) {
        body.innerHTML += `<p>${BD.CONFIG.turnTimerEnabled ? 'Turn timer enabled.' : 'No time limit. Enable the turn timer in Balance to test timed battles.'}</p><div class="debug-fields">${debugField('round','Current round',S.round,1,BD.CONFIG.rounds)}${debugSelect('turn','Current turn',S.turn,[[0,'Hero'],[1,'Enemy']])}${debugField('actions','Actions remaining',S.actionsLeft,1,30)}${debugField('bonus','Combo bonuses used',S.bonusUsed,0,BD.CONFIG.maxBonusActions)}${BD.CONFIG.turnTimerEnabled ? debugField('seconds','Timer remaining (seconds)',Math.ceil(timer.left/1000),1,BD.CONFIG.turnSeconds) : ''}${debugField('seed','Current RNG state',S.seed,-2147483648,2147483647)}${debugField('loot','Gold multiplier (%)',percent(battleContext.loot),0,10000)}${debugField('coinLimit','Coins allowed in settlement',battleContext.coinCount,0,1e6)}${debugField('coinValue','Gold per coin in settlement',battleContext.coinGold,1,1e6)}</div>
          <label class="debug-check"><input name="pauseBot" type="checkbox" ${debugPauseBot ? 'checked' : ''}>Pause bot turns</label>
          ${[0,1].map(side=>`<h3>${side === 0 ? 'Hero' : opp.name}</h3><div class="debug-fields">${debugField('side'+side+'_maxHp','Full health (HP)',S.maxHp[side],1,side === 0 ? null : 100000)}${debugField('side'+side+'_hp','Current HP',S.hp[side],1,S.maxHp[side])}${debugField('side'+side+'_attack','Attack (%)',percent(S.players[side].attack),10,10000)}${debugField('side'+side+'_armor','Armor (%)',percent(S.players[side].armor),0,60)}${debugField('side'+side+'_score','Damage points',S.scores[side])}${debugField('side'+side+'_gold','Collected raw gold',S.gold[side])}${debugField('side'+side+'_collected','Coins collected',S.collected[side])}${Object.keys(S.stats).filter(key=>Array.isArray(S.stats[key])).map(key=>debugField('side'+side+'_'+key,key.replace(/^./,ch=>ch.toUpperCase()),S.stats[key][side])).join('')}</div>`).join('')}
          <div class="debug-actions">${debugButton('live-save','Apply live values','primary')}${debugButton('skip-turn','Skip current turn')}${debugButton('heal','Heal both sides')}</div>
          <h3>Result & Rewards</h3><div class="debug-actions">${debugButton('win','Force victory','primary')}${debugButton('lose','Force defeat','danger')}${debugButton('draw','Force draw')}</div>
          <h3>Board Test Presets</h3><p>Presets replace the board and give the hero three single blocks. Finish the top row to test the effect.</p><div class="debug-actions">${debugButton('preset-empty','Empty board')}${debugButton('preset-line','Line clear')}${debugButton('preset-combo','Row + column combo')}${debugButton('preset-bomb','Bomb chain')}${debugButton('preset-x2','x2 multiplier')}${debugButton('coins','Refill coins')}</div>
          <h3>Hero Hand</h3><div class="debug-actions">${debugButton('hand-random','Random pieces')}${debugButton('hand-dot','Single blocks')}${debugButton('hand-bomb','Bomb blocks')}${debugButton('hand-x2','x2 blocks')}</div>`;
      }
      body.innerHTML += `<h3>State Inspector</h3><details><summary>Show full state JSON</summary><pre class="debug-state">${esc(JSON.stringify(debugSnapshot(),null,2))}</pre></details><div class="debug-actions">${debugButton('export','Download state JSON')}</div>`;
    }
  }
  function debugSnapshot() {
    return {version:1,mode:testMode ? 'sandbox' : 'normal',profile,
      rules:{puzzle:BD.CONFIG,rpg:CAMP.CONFIG,upgrades:CAMP.UPGRADES,quests:[...CAMP.QUESTS,...CAMP.ACHIEVEMENTS]},
      enemy:opp ? {id:opp.id,name:opp.name,race:opp.race,ai:opp.ai,reward:opp.reward} : null,
      battle:S,context:battleContext,timerEnabled:BD.CONFIG.turnTimerEnabled,
      timerSeconds:BD.CONFIG.turnTimerEnabled && S && !S.over ? Math.round(timer.left/1000) : null,botPaused:debugPauseBot};
  }
  function applyLiveValues(values) {
    DEV.editLive(S,values);
    if (BD.CONFIG.turnTimerEnabled) timer.left = DEV.number(values.seconds,1,BD.CONFIG.turnSeconds,timer.left/1000)*1000;
    battleContext.loot = DEV.number(values.loot,0,10000,percent(battleContext.loot))/100;
    battleContext.coinCount = DEV.number(values.coinLimit,0,1e6,battleContext.coinCount,1);
    battleContext.coinGold = DEV.number(values.coinValue,1,1e6,battleContext.coinGold,1);
    debugPauseBot = !!values.pauseBot; shownTurn = S.turn;
    $('flag0').textContent = `⚔ ${percent(S.players[0].attack)}%`;
    $('flag1').textContent = `${CAMP.RACES[opp.race].name} · 🛡 ${percent(S.players[1].armor)}%`;
  }
  function debugAction(action) {
    const values = debugValues();
    if (action === 'start') {
      debugEnemy = +values.enemy; debugDraft = {...values};
      setTestMode(true); debugPauseBot = !!values.pauseBot;
      const settings = DEV.makeBattle(profile,debugEnemy,values);
      closeDebugMenu(false); goHome(); beginEncounter(debugEnemy,settings); return;
    }
    if (action === 'battle-defaults') { debugDraft = {}; renderDebugMenu(); debugMessage('Battle overrides reset.'); return; }
    if (action === 'export') {
      const blob = new Blob([JSON.stringify(debugSnapshot(),null,2)],{type:'application/json'}), url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'block-lords-test-state.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      debugMessage('State exported.'); return;
    }
    if (action.startsWith('balance-')) {
      setTestMode(true);
      if (action === 'balance-reset') DEV.resetBalance(); else DEV.applyBalance(values);
      for (const key of ['heroHp','heroAttack','heroLoot','coinCount','coinGold']) delete debugDraft[key];
      profile = DEV.restoreProfile(profile); saveProfile();
      if (S && !S.over) { S.round = Math.min(S.round,BD.CONFIG.rounds); timer.left = Math.min(timer.left,BD.CONFIG.turnSeconds*1000); }
      refreshDebugBackground(); renderDebugMenu(); debugMessage(action === 'balance-reset' ? 'Default balance restored.' : 'Sandbox balance applied for this session.'); return;
    }
    const progressActions = ['progress-save','add-gold','boss-build','ready-quests','clear-all','clear-none','profile-reset','import-profile'];
    if (progressActions.includes(action)) {
      if (action === 'import-profile') {
        const parsed = JSON.parse(values.profileJson), raw = parsed.profile || parsed;
        if (raw?.version !== 1) throw new Error('Profile JSON needs version: 1.');
        setTestMode(true); profile = DEV.restoreProfile(raw);
      } else {
        setTestMode(true);
        if (action === 'progress-save') {
          profile.gold = DEV.number(values.gold,0,1e9,profile.gold,1);
          for (const [key,u] of Object.entries(CAMP.UPGRADES)) profile.levels[key] = CAMP.level(key,DEV.number(values['level_'+key],0,u.cap,profile.levels[key],1));
          for (const key of CAMP.STAT_KEYS) profile.stats[key] = DEV.number(values['stat_'+key],0,1e9,profile.stats[key],1);
          profile.cleared = [...$('debugContent').querySelectorAll('[data-debug-cleared]:checked')].map(el=>+el.dataset.debugCleared);
          profile.claimed = [...$('debugContent').querySelectorAll('[data-debug-claimed]:checked')].map(el=>el.dataset.debugClaimed);
        }
        if (action === 'add-gold') profile.gold = Math.min(1e9,profile.gold+10000);
        if (action === 'boss-build') for (const [key,value] of Object.entries(CAMP.BOSS_BUILD)) profile.levels[key] = Math.max(profile.levels[key],value);
        if (action === 'ready-quests') for (const q of [...CAMP.QUESTS,...CAMP.ACHIEVEMENTS]) profile.stats[q.stat] = Math.max(profile.stats[q.stat],q.target);
        if (action === 'clear-all') profile.cleared = CAMP.ENEMIES.map(e=>e.id);
        if (action === 'clear-none') profile.cleared = [];
        if (action === 'profile-reset') profile = CAMP.create();
      }
      for (const key of ['heroHp','heroAttack','heroLoot']) delete debugDraft[key];
      saveProfile(); refreshDebugBackground(); renderDebugMenu(); debugMessage('Test profile saved.'); return;
    }
    if (!S || S.over || !battleContext?.test) return;
    if (action === 'live-save') applyLiveValues(values);
    else if (['win','lose','draw'].includes(action)) {
      closeDebugMenu(false); timer.running = false; ++gen; setBusy(true);
      DEV.finish(S,action === 'win' ? 0 : action === 'lose' ? 1 : -1);
      setHp(0,S.hp[0],true); setHp(1,S.hp[1],true); renderTurnbar(); endMatch(gen); return;
    } else if (action === 'skip-turn') {
      BD.timeout(S); timer.left = BD.CONFIG.turnSeconds*1000; shownTurn = S.turn;
      if (S.over) { closeDebugMenu(false); endMatch(gen); return; }
    } else if (action === 'heal') S.hp = S.maxHp.slice();
    else if (action.startsWith('preset-')) { DEV.preset(S,action.slice(7),battleContext.coinGold); shownTurn = S.turn; timer.left = BD.CONFIG.turnSeconds*1000; }
    else if (action.startsWith('hand-')) DEV.hand(S,action.slice(5));
    else if (action === 'coins') {
      S.coins.fill(0); const free = S.board.map((v,i)=>v ? -1 : i).filter(i=>i>=0);
      const count = Math.min(free.length,CAMP.CONFIG.coinCount);
      for (let i=0;i<count;i++) S.coins[free.splice(Math.floor(BD.rand(S)*free.length),1)[0]] = CAMP.CONFIG.coinGold;
      battleContext.coinCount = S.collected[0]+S.collected[1]+count; battleContext.coinGold = CAMP.CONFIG.coinGold;
    }
    refreshDebugBackground(); renderDebugMenu(); debugMessage('Live state updated. Close the menu to resume.');
  }
  for (const id of ['testHome','testMap','testBattle']) $(id).addEventListener('click',openDebugMenu);
  bindSwipeScroll($('debugContent'),()=>debugOpen);
  $('debugClose').addEventListener('click',()=>closeDebugMenu());
  $('debugModeToggle').addEventListener('click',()=>{ setTestMode(!testMode); renderDebugMenu(); debugMessage(testMode ? 'Sandbox enabled. All enemies are available.' : 'Normal progress restored. Standard balance active.'); });
  $('debugWindow').addEventListener('click',e=>{
    if (e.target === $('debugWindow')) { closeDebugMenu(); return; }
    const button = e.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.debugTab) { if (debugTab === 'battle') debugDraft = debugValues(); debugTab = button.dataset.debugTab; renderDebugMenu(); $('debugContent').scrollTop = 0; }
    if (button.dataset.debugAction) try { debugAction(button.dataset.debugAction); } catch (error) { debugMessage(error.message || 'Unable to apply this change.'); }
  });
  $('debugContent').addEventListener('change',e=>{
    if (e.target.name !== 'enemy') return;
    debugEnemy = +e.target.value; const enemy = CAMP.ENEMIES[debugEnemy];
    debugDraft = {...debugValues(),enemyHp:enemy.hp,enemyAttack:percent(enemy.attack),enemyArmor:percent(enemy.armor),reward:enemy.reward,ai:enemy.ai};
    renderDebugMenu();
  });
  $('debugWindow').addEventListener('keydown',e=>{
    if (e.key === 'Escape') { e.preventDefault(); closeDebugMenu(); }
    if (e.key === 'Tab') {
      const focusable = [...$('debugWindow').querySelectorAll('button:not(:disabled),input,select,textarea,summary')].filter(el=>el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  refreshTestBadges();
