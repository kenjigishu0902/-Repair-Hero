(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  if (navigator.maxTouchPoints > 0) document.body.classList.add('touch-device');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    title: $('#title'), result: $('#result'), hud: $('#hud'), touch: $('#touch'), pause: $('#pause'),
    hearts: $('#hearts'), coins: $('#coins'), score: $('#score'), timer: $('#timer'), dashGauge: $('#dashGauge'), notice: $('#notice'),
    modeHud: $('#modeHud'), modeTimer: $('#modeTimer'), transformFlash: $('#transformFlash')
  };

  let WORLD_WIDTH = 7600;
  const FLOOR_Y = 610;
  const PLAYER_W = 72;
  const PLAYER_H = 112;
  const MAX_JUMPS = 2;
  const playerImages = {};
  for (const [name, source] of Object.entries({ normal: './feni.png', battery: './feni_battery.png', lcd: './feni_lcd.png', king: './feni_king.png' })) {
    playerImages[name] = new Image();
    playerImages[name].src = source;
  }
  const MODE_DURATION = 10;
  const MODE_NAMES = { battery: 'BATTERY MODE', lcd: 'LCD MODE', king: 'KING MODE' };
  const GRAVITY = 1800;
  const MAX_FALL = 920;
  const START_TIME = 150;
  const input = { left: false, right: false, jump: false, dashLeft: false, dashRight: false };
  let width = 1280;
  let height = 720;
  let dpr = 1;
  let scale = 1;
  let viewportWidth = 1280;
  let viewportHeight = 720;
  let cameraY = 0;
  let portrait = false;
  let offsetX = 0;
  let offsetY = 0;
  let mode = 'title';
  let paused = false;
  let previousTime = 0;
  let animationFrame = 0;
  let elapsed = 0;
  let cameraX = 0;
  let shake = 0;
  let landingShake = 0;
  let player;
  let enemies;
  let droplets;
  let coins;
  let dust;
  let sparks;
  let afterimages;
  let movingPlatforms;
  let checkpoints;
  let goal;
  let remainingTime;
  let items;
  let confetti;
  let transformItems;
  let modeParticles;
  let playerMode = 'normal';
  let modeTimer = 0;
  let slowMotion = 0;
  let flightSoundTimer = 0;
  let fragilePlatforms;
  let hazards;
  let fallingHazards;
  let currentStage = 0;
  let stageTheme = 'city';
  let boss = null;
  const STAGES = [
    { id: '1-1', name: 'スマホ修理商店街', theme: 'city', width: 7600, time: 150 },
    { id: '1-2', name: '地下ケーブル迷宮', theme: 'underground', width: 6800, time: 145 },
    { id: '1-3', name: '水没スマホ海域', theme: 'sea', width: 7000, time: 145 },
    { id: '1-4', name: 'クラウド空中回廊', theme: 'sky', width: 7200, time: 150 },
    { id: '1-5', name: 'キング基板・決戦', theme: 'boss', width: 6500, time: 180 }
  ];

  const staticPlatforms = [
    { x: 0, y: FLOOR_Y, w: 720, h: 130 },
    { x: 850, y: FLOOR_Y, w: 760, h: 130 },
    { x: 1710, y: FLOOR_Y - 45, w: 640, h: 175 },
    { x: 2470, y: FLOOR_Y, w: 610, h: 130 },
    { x: 3210, y: FLOOR_Y, w: 720, h: 130 },
    { x: 4050, y: FLOOR_Y - 55, w: 710, h: 185 },
    { x: 4890, y: FLOOR_Y, w: 630, h: 130 },
    { x: 5650, y: FLOOR_Y, w: 790, h: 130 },
    { x: 6560, y: FLOOR_Y - 35, w: 1040, h: 165 },
    { x: 1040, y: 475, w: 190, h: 22 },
    { x: 1370, y: 415, w: 165, h: 22 },
    { x: 1870, y: 430, w: 175, h: 22 },
    { x: 2170, y: 350, w: 160, h: 22 },
    { x: 2660, y: 450, w: 210, h: 22 },
    { x: 3360, y: 430, w: 170, h: 22 },
    { x: 3630, y: 350, w: 180, h: 22 },
    { x: 4250, y: 410, w: 190, h: 22 },
    { x: 4620, y: 340, w: 140, h: 22 },
    { x: 5090, y: 435, w: 200, h: 22 },
    { x: 5810, y: 445, w: 170, h: 22 },
    { x: 6140, y: 360, w: 180, h: 22 },
    { x: 6820, y: 420, w: 220, h: 22 }
  ];

  const enemyBlueprints = [
    ['cracked', 1080, 420], ['battery', 1480, 350], ['cracked', 1960, 370],
    ['wet', 2800, 390], ['battery', 3470, 360], ['cracked', 3770, 290],
    ['wet', 4370, 350], ['cracked', 5120, 375], ['battery', 5900, 385],
    ['wet', 6220, 300], ['cracked', 6870, 360]
  ];

  const jumpPads = [{x:1540,y:FLOOR_Y-18,w:58,h:18},{x:4740,y:FLOOR_Y-73,w:58,h:18}];

  const itemBlueprints = [
    ['battery', 1120, 380], ['screen', 2260, 305], ['toolbox', 3650, 305],
    ['fire', 5180, 385], ['fenicoin', 6260, 300]
  ];

  const transformBlueprints = [
    [780, 455], [1510, 350], [2390, 500], [3760, 295], [4825, 475], [6050, 305], [6740, 370]
  ];

  const coinBlueprints = [
    [360, 520], [450, 520], [540, 520], [900, 520], [1080, 415], [1160, 415],
    [1390, 355], [1470, 355], [1780, 495], [1900, 370], [1980, 370], [2200, 290],
    [2510, 520], [2690, 390], [2780, 390], [3260, 520], [3400, 370], [3680, 290],
    [4110, 465], [4280, 350], [4380, 350], [4660, 280], [4930, 520], [5130, 375],
    [5250, 375], [5710, 520], [5850, 385], [6190, 300], [6310, 300], [6650, 480],
    [6870, 360], [6980, 360], [7200, 490]
  ];

  function configureStage() {
    const stage = STAGES[currentStage];
    WORLD_WIDTH = stage.width; stageTheme = stage.theme;
    if (currentStage === 0) return;
    staticPlatforms.length = 0; enemyBlueprints.length = 0; itemBlueprints.length = 0;
    transformBlueprints.length = 0; coinBlueprints.length = 0; jumpPads.length = 0;
    const gapEvery = stageTheme === 'sky' ? 620 : 900;
    for (let x = 0; x < WORLD_WIDTH; x += gapEvery) {
      const rise = stageTheme === 'underground' ? (x / gapEvery % 3) * 35 : stageTheme === 'sea' ? Math.sin(x / 600) * 45 : stageTheme === 'sky' ? -80 - (x / gapEvery % 3) * 55 : 0;
      const gap = x && x < WORLD_WIDTH - 700 ? (stageTheme === 'sky' ? 150 : 95) : 0;
      staticPlatforms.push({ x: x + gap, y: FLOOR_Y + rise, w: Math.min(gapEvery - gap, WORLD_WIDTH - x), h: 180 - rise });
      if (x > 0) staticPlatforms.push({ x: x + 120, y: 440 + rise * .4, w: 190, h: 22 });
    }
    for (let x = 520; x < WORLD_WIDTH - 400; x += 470) coinBlueprints.push([x, 380 + (x / 470 % 3) * 55]);
    for (let x = 900; x < WORLD_WIDTH - 500; x += 740) enemyBlueprints.push([[ 'cracked', 'wet', 'battery' ][Math.floor(x / 740) % 3], x, 350]);
    for (let x = 1100; x < WORLD_WIDTH - 500; x += 1500) transformBlueprints.push([x, 330]);
    itemBlueprints.push(['toolbox', 2050, 350], ['battery', 4050, 350]);
    jumpPads.push({ x: 1500, y: FLOOR_Y - 18, w: 58, h: 18 });
  }

  function resize() {
    const view = window.visualViewport;
    width = Math.round(view?.width || innerWidth);
    height = Math.round(view?.height || innerHeight);
    portrait = height > width;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // Portrait uses a dedicated close camera: Feni occupies roughly 22% of screen height.
    scale = portrait ? height / 520 : height / 720;
    viewportWidth = width / scale;
    viewportHeight = height / scale;
    offsetX = Math.max(0, (width - viewportWidth * scale) / 2);
    offsetY = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeEnemy([type, x, y]) {
    return { type, x, y, w: type === 'battery' ? 52 : 50, h: type === 'battery' ? 58 : 62,
      vx: type === 'cracked' ? -65 : type === 'wet' ? -28 : 0, vy: 0, originX: x,
      grounded: false, alive: true, cooldown: 1.2 + (x % 7) / 10, phase: x / 80, squish: 0 };
  }

  function resetGame() {
    configureStage();
    Object.keys(input).forEach((key) => { input[key] = false; });
    player = { x: 150, y: FLOOR_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0,
      grounded: true, hp: 3, coins: 0, score: 0, invincible: 0, state: 'idle', anim: 0,
      facing: 1, jumpHeld: false, jumpCount: 0, spin: 0, justLanded: 0, spawnX: 150, spawnY: FLOOR_Y - PLAYER_H, spawnCamera: 0, checkpointHp: 3, checkpointCoins: 0, checkpointScore: 0, dead: false, dash: 100, boost: 0, clearTime: 0, healDelay: 0, healTick: 0 };
    enemies = enemyBlueprints.map(makeEnemy);
    droplets = [];
    coins = coinBlueprints.map(([x, y]) => ({ x, y, collected: false, phase: x / 30 }));
    items = itemBlueprints.map(([type,x,y]) => ({ type,x,y,collected:false,phase:x/40 }));
    confetti = [];
    transformItems = transformBlueprints.map(([x, y]) => ({ x, y, w: 42, h: 42, collected: false, phase: x / 50 }));
    modeParticles = [];
    playerMode = 'normal'; modeTimer = 0; slowMotion = 0; flightSoundTimer = 0;
    dust = [];
    sparks = [];
    afterimages = [];
    fragilePlatforms = [
      { x: 1260, y: 505, w: 105, h: 18, kind: 'vanish', timer: 0, active: true },
      { x: 2960, y: 395, w: 92, h: 18, kind: 'crumble', timer: 0, active: true },
      { x: 5350, y: 385, w: 90, h: 18, kind: 'crumble', timer: 0, active: true }
    ];
    hazards = [{x:690,y:590,w:30,h:20},{x:1615,y:590,w:90,h:20},{x:3080,y:590,w:120,h:20},{x:4760,y:535,w:120,h:20},{x:6460,y:590,w:95,h:20}];
    fallingHazards = [{x:2700,y:90,baseY:90,w:28,h:34,vy:0,delay:1},{x:4550,y:70,baseY:70,w:34,h:40,vy:0,delay:2.2},{x:6710,y:60,baseY:60,w:32,h:38,vy:0,delay:1.4}];
    movingPlatforms = [
      { x: 735, y: 500, baseX: 735, baseY: 500, w: 105, h: 18, axis: 'x', range: 80, speed: 1.15, lastX: 735, lastY: 500 },
      { x: 3090, y: 475, baseX: 3090, baseY: 475, w: 105, h: 18, axis: 'y', range: 95, speed: .9, lastX: 3090, lastY: 475 },
      { x: 5535, y: 470, baseX: 5535, baseY: 470, w: 105, h: 18, axis: 'x', range: 75, speed: 1.25, lastX: 5535, lastY: 470 }
    ];
    checkpoints = [WORLD_WIDTH*.24,WORLD_WIDTH*.52,WORLD_WIDTH*.8].map((x)=>({x,y:FLOOR_Y-70,active:false}));
    goal = { x: WORLD_WIDTH - 190, y: FLOOR_Y - 180 };
    boss = currentStage === 4 ? {x:WORLD_WIDTH-900,y:FLOOR_Y-230,w:190,h:230,hp:8,maxHp:8,vx:-80,alive:true,hit:0} : null;
    remainingTime = STAGES[currentStage].time || START_TIME;
    elapsed = 0;
    cameraX = 0;
    shake = 0;
    landingShake = 0;
    paused = false;
    updateHud();
  }

  function startGame() {
    resetGame();
    mode = 'playing';
    ui.title.classList.add('hidden');
    ui.result.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.touch.classList.remove('hidden');
    ui.pause.classList.remove('hidden');
    ui.modeHud.classList.add('hidden');
    say(`STAGE ${STAGES[currentStage].id}\n${STAGES[currentStage].name}`);
    window.RepairHeroSound?.music('game');
    sound('start');
  }

  function setModeResult(cleared) {
    clearMode(false);
    mode = cleared ? 'clear' : 'gameover';
    window.RepairHeroSound?.music(null);
    ui.hud.classList.add('hidden');
    ui.touch.classList.add('hidden');
    ui.pause.classList.add('hidden');
    $('#resultKicker').textContent = cleared ? 'STAGE CLEAR!' : 'GAME OVER';
    $('#resultTitle').textContent = cleared ? (currentStage === STAGES.length-1 ? '全ステージ修理完了！' : `${STAGES[currentStage].id} 修理完了！`) : 'もう一度挑戦！';
    $('#next').classList.toggle('hidden', !cleared || currentStage === STAGES.length-1);
    $('#resultStats').textContent = `SCORE ${String(player.score).padStart(6, '0')}　COIN ${player.coins}　TIME ${Math.ceil(remainingTime)}`;
    ui.result.classList.remove('hidden');
    sound(cleared ? 'clear' : 'gameover');
  }

  function showTitle() {
    mode = 'title';
    paused = false;
    ui.title.classList.remove('hidden');
    ui.result.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.touch.classList.add('hidden');
    ui.pause.classList.add('hidden');
    window.RepairHeroSound?.music('title');
  }

  function say(text) {
    ui.notice.textContent = text;
    ui.notice.classList.remove('show');
    void ui.notice.offsetWidth;
    ui.notice.classList.add('show');
  }

  function sound(name) { window.RepairHeroSound?.play(name); }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function allPlatforms() { return staticPlatforms.concat(movingPlatforms, fragilePlatforms.filter((p) => p.active)); }

  function moveAndCollide(body, dt, isPlayer = false) {
    // Small swept steps keep LCD-speed movement from crossing thin platforms.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(body.vx * dt), Math.abs(body.vy * dt)) / 18));
    const step = dt / steps;
    body.grounded = false;
    for (let n = 0; n < steps; n += 1) {
      const oldX = body.x; const oldY = body.y; const oldBottom = oldY + body.h;
      body.x += body.vx * step;
      body.y += body.vy * step;
      for (const platform of allPlatforms()) {
        if (body.x + body.w <= platform.x || body.x >= platform.x + platform.w) continue;
        if (body.vy >= 0 && oldBottom <= platform.y + 7 && body.y + body.h >= platform.y) {
          body.y = platform.y - body.h; body.vy = 0; body.grounded = true;
          if (isPlayer && movingPlatforms.includes(platform)) { body.x += platform.x-platform.lastX; body.y += platform.y-platform.lastY; }
          if (isPlayer && fragilePlatforms.includes(platform) && !platform.timer) platform.timer = .001;
        }
      }
      for (const platform of allPlatforms()) {
        const vertical = body.y + body.h > platform.y + 3 && body.y < platform.y + platform.h;
        if (!vertical) continue;
        if (body.vx > 0 && oldX + body.w <= platform.x && body.x + body.w > platform.x) { body.x=platform.x-body.w; body.vx=0; }
        if (body.vx < 0 && oldX >= platform.x+platform.w && body.x < platform.x+platform.w) { body.x=platform.x+platform.w; body.vx=0; }
      }
    }
  }

  function spawnDust(x, y, amount = 1) {
    for (let i = 0; i < amount; i += 1) {
      dust.push({ x: x + Math.random() * 18, y, vx: -player.facing * (25 + Math.random() * 45),
        vy: -25 - Math.random() * 35, life: .35 + Math.random() * .25, size: 4 + Math.random() * 6 });
    }
  }

  function scoreValue(points) { return playerMode === 'lcd' ? points * 2 : points; }

  function clearMode(playSound = true) {
    if (playerMode === 'normal') return;
    playerMode = 'normal';
    modeTimer = 0;
    flightSoundTimer = 0;
    modeParticles = [];
    ui.modeHud.className = 'mode-hud hidden';
    if (playSound) { sound('transformEnd'); say('NORMAL MODE'); }
  }

  function emitModeParticles(modeName, amount) {
    const colors = { battery: ['#54ff72', '#d8ff76'], lcd: ['#48eaff', '#ffffff'], king: ['#ffd338', '#ff8a20', '#fff7b0'] }[modeName];
    for (let i = 0; i < amount; i += 1) modeParticles.push({
      x: player.x + player.w / 2 + (Math.random() - .5) * 80, y: player.y + player.h / 2 + (Math.random() - .5) * 110,
      vx: (Math.random() - .5) * 150, vy: -30 - Math.random() * 120, life: .45 + Math.random() * .65,
      size: 2 + Math.random() * (modeName === 'king' ? 7 : 4), color: colors[i % colors.length], digital: modeName === 'lcd'
    });
  }

  function applyMode(nextMode) {
    clearMode(false);
    playerMode = nextMode;
    modeTimer = MODE_DURATION;
    slowMotion = 0;
    if (nextMode === 'battery') { player.healDelay = 0; player.healTick = 0; }
    const subtitles = { battery: 'AUTO RECOVERY!', lcd: 'SUPER SPEED!!', king: 'INVINCIBLE FLY!' };
    say(nextMode === 'lcd' ? 'LCD MODE!!\nSUPER SPEED!!' : `${MODE_NAMES[nextMode]}！\n${subtitles[nextMode]}`);
    ui.modeHud.className = `mode-hud ${nextMode}`;
    ui.transformFlash.className = `transform-flash ${nextMode}`;
    void ui.transformFlash.offsetWidth;
    ui.transformFlash.classList.add('show');
    sound('transformItem'); sound(`${nextMode}Mode`);
    emitModeParticles(nextMode, nextMode === 'king' ? 70 : 38);
    updateHud();
  }

  function collectTransformItem(item) {
    item.collected = true;
    player.score += scoreValue(250);
    const choices = ['battery', 'lcd', 'king'];
    applyMode(choices[Math.floor(Math.random() * choices.length)]);
  }

  function updateModeTimer(dt) {
    if (playerMode === 'normal') return;
    modeTimer = Math.max(0, modeTimer - dt);
    const rate = playerMode === 'king' ? 18 : 10;
    if (Math.floor(elapsed * rate) !== Math.floor((elapsed - dt) * rate)) emitModeParticles(playerMode, playerMode === 'king' ? 3 : 1);
    if (playerMode === 'king' && input.jump) {
      flightSoundTimer -= dt;
      if (flightSoundTimer <= 0) { sound('kingFlight'); flightSoundTimer = .55; }
    }
    if (playerMode === 'battery') {
      player.healDelay += dt;
      if (player.healDelay >= 1 && player.hp < 3) {
        player.healTick += dt;
        if (player.healTick >= .75) { player.healTick = 0; player.hp = Math.min(3, player.hp + .25); sound('heal'); emitModeParticles('battery', 8); }
      }
    }
    if (modeTimer <= 0) clearMode(true);
  }

  function hurt(sourceX) {
    if (player.invincible > 0 || mode !== 'playing' || playerMode === 'king') return;
    player.hp -= playerMode === 'battery' ? .5 : 1;
    player.healDelay = 0; player.healTick = 0;
    player.invincible = 1.6;
    player.vx = player.x < sourceX ? -290 : 290;
    player.vy = -420;
    player.grounded = false;
    player.state = 'hurt';
    shake = 14;
    sound('damage');
    updateHud();
    if (player.hp <= 0) {
      player.dead = true;
      setTimeout(() => { if (mode === 'playing') respawnAtCheckpoint('REPAIR RESTART!'); }, 650);
    }
  }

  function respawnAtCheckpoint(message) {
    clearMode(false);
    player.hp = player.checkpointHp;
    player.coins = player.checkpointCoins;
    player.score = player.checkpointScore;
    player.dead = false;
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 1.8;
    player.jumpCount = 0;
    player.spin = 0;
    cameraX = player.spawnCamera;
    droplets = [];
    say(message);
    updateHud();
  }

  function respawnAfterFall() {
    sound('damage');
    shake = 18;
    respawnAtCheckpoint('落下！ チェックポイントから再開');
  }

  function updatePlayer(dt) {
    if (player.dead) return;
    player.invincible = Math.max(0, player.invincible - dt);
    player.justLanded = Math.max(0, player.justLanded - dt);
    const dashDirection = Number(input.dashRight) - Number(input.dashLeft);
    const normalDirection = Number(input.right) - Number(input.left);
    const direction = dashDirection || normalDirection;
    const dashing = dashDirection !== 0;
    player.boost = Math.max(0, player.boost - dt);
    const canDash = dashing && player.dash > 0;
    player.dash = Math.max(0, Math.min(100, player.dash + (canDash ? -38 : 24) * dt));
    const speedScale = playerMode === 'lcd' ? 2.4 : playerMode === 'battery' ? 1.12 : 1;
    const dashSpeed = playerMode === 'lcd' ? 1365 : player.boost ? 610 : playerMode === 'king' ? 720 : 455;
    const targetSpeed = direction * (canDash ? dashSpeed : 245 * speedScale);
    if (canDash && Math.floor(elapsed * 9) !== Math.floor((elapsed-dt)*9)) sound('dash');
    const acceleration = (player.grounded ? 1900 : 1050) * (playerMode === 'lcd' ? 2.8 : 1);
    player.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - player.vx));
    if (!direction && player.grounded) player.vx *= Math.pow(playerMode === 'lcd' ? .00002 : .0008, dt);
    if (direction) player.facing = direction;

    if (playerMode === 'king') {
      player.jumpHeld = input.jump;
      player.grounded = false;
      player.vy += ((input.jump ? -520 : 105) - player.vy) * Math.min(1, dt * (input.jump ? 5 : 2.2));
      player.vy = Math.max(-390, Math.min(115, player.vy));
    } else if (input.jump && !player.jumpHeld && player.jumpCount < MAX_JUMPS) {
      player.jumpCount += 1;
      player.vy = player.jumpCount === 2 ? -720 : -650;
      player.grounded = false;
      player.jumpHeld = true;
      if (player.jumpCount === 2) {
        player.spin = Math.PI * 2;
        for (let i = 0; i < 14; i += 1) sparks.push({ x:player.x+player.w/2, y:player.y+player.h*.75, vx:(Math.random()-.5)*260, vy:40+Math.random()*190, life:.45+Math.random()*.25, size:3+Math.random()*5 });
        sound('doubleJump');
      } else { spawnDust(player.x + player.w / 2, player.y + player.h, 5); sound('jump'); }
    }
    if (playerMode !== 'king' && !input.jump) player.jumpHeld = false;
    if (playerMode !== 'king' && !input.jump && player.vy < -220) player.vy += GRAVITY * 1.35 * dt;
    if (player.spin > 0) player.spin = Math.max(0, player.spin - dt * 11);

    const wasGrounded = player.grounded;
    if (playerMode !== 'king') player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    moveAndCollide(player, dt, true);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));
    if (!wasGrounded && player.grounded) {
      player.jumpCount = 0; player.spin = 0; player.justLanded = .16; landingShake = 5;
      spawnDust(player.x + player.w / 2, player.y + player.h, 6);
    }
    for (const pad of jumpPads) {
      if (player.vy >= 0 && player.x + player.w > pad.x && player.x < pad.x + pad.w && player.y + player.h >= pad.y && player.y + player.h <= pad.y + 24) {
        player.y = pad.y - player.h; player.vy = -850; player.grounded = false; player.jumpCount = 1;
        spawnDust(player.x + player.w / 2,pad.y,10); sound('jump'); say('SUPER JUMP!');
      }
    }
    if (playerMode === 'king') { player.y = Math.max(45, Math.min(FLOOR_Y-player.h+35,player.y)); if(player.y<=45)player.vy=Math.max(0,player.vy); }
    if (player.y > 790) respawnAfterFall();

    const speed = Math.abs(player.vx);
    if (player.justLanded) player.state = 'land';
    else if (!player.grounded) player.state = player.vy < 0 ? (player.jumpCount === 2 ? 'doubleJump' : 'jump') : 'fall';
    else if (canDash && speed > 300) player.state = 'dash';
    else if (speed > 30) player.state = 'walk';
    else player.state = 'idle';
    player.anim += dt * (player.state === 'dash' ? 15 : player.state === 'walk' ? 9 : 3) * (playerMode === 'lcd' ? 1.7 : 1);
    if (player.grounded && speed > 100 && Math.floor(player.anim * 2) !== Math.floor((player.anim - dt * 9) * 2)) spawnDust(player.x, player.y + player.h, dashing ? 3 : 1);
    if (playerMode === 'lcd' && Math.floor(elapsed*16) !== Math.floor((elapsed-dt)*16)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.28,lcd:true});
    if (canDash) { shake = Math.max(shake, 2.5); if (Math.floor(elapsed*24) !== Math.floor((elapsed-dt)*24)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.2}); }
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (!enemy.alive) { enemy.squish -= dt; continue; }
      enemy.phase += dt;
      enemy.cooldown -= dt;
      if (enemy.type === 'cracked') {
        enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt);
        if (Math.abs(enemy.x - enemy.originX) > 125) enemy.vx *= -1;
        moveAndCollide(enemy, dt);
      } else if (enemy.type === 'battery') {
        enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt);
        if (enemy.grounded && enemy.cooldown <= 0) { enemy.vy = -520; enemy.vx = player.x < enemy.x ? -65 : 65; enemy.cooldown = 2.1; }
        moveAndCollide(enemy, dt);
      } else {
        enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt);
        if (Math.abs(enemy.x - enemy.originX) > 75) enemy.vx *= -1;
        moveAndCollide(enemy, dt);
        if (enemy.cooldown <= 0 && Math.abs(player.x - enemy.x) < 650) {
          const direction = player.x < enemy.x ? -1 : 1;
          droplets.push({ x: enemy.x + 20, y: enemy.y + 15, w: 16, h: 16, vx: direction * 210, vy: -240 });
          enemy.cooldown = 2.4;
        }
      }

      if (overlap(player, enemy) && playerMode === 'king') {
        enemy.alive=false; enemy.squish=.45; player.score+=scoreValue(750); sound('kingHit'); emitModeParticles('king',18);
      } else if (overlap(player, enemy) && player.invincible <= 0) {
        const playerBottom = player.y + player.h;
        if (player.vy > 120 && playerBottom - enemy.y < 32) {
          enemy.alive = false; enemy.squish = .45; player.vy = -410; player.score += scoreValue(500);
          spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h, 9); sound('stomp');
        } else hurt(enemy.x + enemy.w / 2);
      }
    }

    for (const drop of droplets) {
      drop.vy += GRAVITY * .45 * dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt;
      if (overlap(player, drop)) { drop.dead = true; if(playerMode !== 'king') hurt(drop.x); }
      if (drop.y > FLOOR_Y + 30) drop.dead = true;
    }
    droplets = droplets.filter((drop) => !drop.dead && Math.abs(drop.x - cameraX) < 1500);
    if (boss?.alive) {
      boss.hit=Math.max(0,boss.hit-dt); boss.x+=boss.vx*dt;
      if(boss.x<WORLD_WIDTH-1250||boss.x>WORLD_WIDTH-480)boss.vx*=-1;
      if(overlap(player,boss)) {
        const attack=playerMode==='king'||(player.vy>160&&player.y+player.h<boss.y+70);
        if(attack&&boss.hit<=0){boss.hp-=1;boss.hit=.45;player.vy=-480;player.score+=scoreValue(1000);sound('kingHit');emitModeParticles(playerMode==='king'?'king':'lcd',30);if(boss.hp<=0){boss.alive=false;player.score+=scoreValue(10000);say('BOSS REPAIRED!!');sound('bossDown');}}
        else hurt(boss.x+boss.w/2);
      }
    }
  }

  function updateObjects(dt) {
    for (const platform of movingPlatforms) {
      platform.lastX = platform.x; platform.lastY = platform.y;
      const movement = Math.sin(elapsed * platform.speed) * platform.range;
      if (platform.axis === 'x') platform.x = platform.baseX + movement;
      else platform.y = platform.baseY + movement;
    }
    for (const platform of fragilePlatforms) {
      if (platform.kind === 'vanish') platform.active = Math.sin(elapsed * 1.7 + platform.x) > -.2;
      if (platform.kind === 'crumble' && platform.timer) { platform.timer += dt; if (platform.timer > .65) platform.active = false; if (platform.timer > 3.2) { platform.timer=0; platform.active=true; } }
    }
    for (const rock of fallingHazards) {
      rock.delay -= dt;
      if (rock.delay <= 0) { rock.vy += 900*dt; rock.y += rock.vy*dt; }
      if (overlap(player, rock)) hurt(rock.x);
      if (rock.y > 730) { rock.y=rock.baseY; rock.vy=0; rock.delay=2.8; }
    }
    for (const spike of hazards) if (overlap(player, spike)) hurt(spike.x + spike.w/2);
    for (const coin of coins) {
      coin.phase += dt * 5;
      const hitbox = { x: coin.x - 13, y: coin.y - 13, w: 26, h: 26 };
      if (!coin.collected && overlap(player, hitbox)) {
        coin.collected = true; player.coins += 1; player.score += scoreValue(100); sound('coin'); updateHud();
      }
    }
    for (const item of transformItems) {
      item.phase += dt * 3;
      if (!item.collected && overlap(player, { x: item.x - 25, y: item.y - 25, w: 50, h: 50 })) collectTransformItem(item);
    }
    for (const item of items) {
      item.phase += dt * 4;
      if (item.collected || !overlap(player,{x:item.x-18,y:item.y-18,w:36,h:36})) continue;
      item.collected=true; player.score += scoreValue(250); const labels={battery:'HP RECOVER',screen:'LCD +1000',toolbox:'DASH BOOST',fenicoin:'FENI COIN +3000',fire:'INVINCIBLE'};
      if(item.type==='battery') player.hp=Math.min(3,player.hp+1);
      if(item.type==='screen') player.score+=scoreValue(1000);
      if(item.type==='toolbox') { player.boost=8; player.dash=100; }
      if(item.type==='fenicoin') { player.score+=scoreValue(3000); player.coins+=5; }
      if(item.type==='fire') player.invincible=8;
      say(labels[item.type]); sound(item.type);
      for(let i=0;i<20;i+=1) sparks.push({x:item.x,y:item.y,vx:(Math.random()-.5)*300,vy:(Math.random()-.5)*300,life:.7,size:4});
    }
    for (const checkpoint of checkpoints) {
      const checkpointHitbox = { x: checkpoint.x - 12, y: checkpoint.y, w: 92, h: 75 };
      if (checkpoint.active || !overlap(player, checkpointHitbox)) continue;
      checkpoints.forEach((point) => { if (point.x <= checkpoint.x) point.active = true; });
      player.spawnX = checkpoint.x + 35;
      player.spawnY = checkpoint.y + 70 - PLAYER_H;
      player.spawnCamera = Math.max(0, cameraX);
      player.score += scoreValue(1000);
      player.checkpointHp = player.hp; player.checkpointCoins = player.coins; player.checkpointScore = player.score;
      say('CHECK POINT');
      sound('checkpoint');
      for (let i = 0; i < 28; i += 1) sparks.push({ x: checkpoint.x + 35, y: checkpoint.y + 20, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: .8, size: 4 });
    }
    if (player.x + player.w > goal.x && !player.clearTime && (!boss || !boss.alive)) {
      player.clearTime = .001; player.vx = 0; player.score += Math.ceil(remainingTime) * 25; sound('goal');
      say('STAGE CLEAR!!');
      for(let i=0;i<100;i+=1) confetti.push({x:cameraX+Math.random()*1280,y:-Math.random()*500,vx:(Math.random()-.5)*100,vy:100+Math.random()*180,life:4,color:['#ff3b20','#ffd338','#41d9ec','#fff'][i%4]});
    }
    if (player.clearTime) { player.clearTime += dt; player.state='clear'; player.x += ((cameraX + viewportWidth / 2 - player.w / 2) - player.x) * Math.min(1, dt * 3); player.y += Math.sin(player.clearTime*9)*50*dt; player.spin += dt*5; if(player.clearTime>2.6) setModeResult(true); }
    dust.forEach((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 130 * dt; particle.life -= dt; });
    dust = dust.filter((particle) => particle.life > 0);
    sparks.forEach((p) => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 420*dt; p.life -= dt; });
    sparks = sparks.filter((p) => p.life > 0);
    modeParticles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    modeParticles = modeParticles.filter((p) => p.life > 0);
    afterimages.forEach((ghost) => { ghost.life -= dt; });
    afterimages = afterimages.filter((ghost) => ghost.life > 0);
    confetti.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}); confetti=confetti.filter(p=>p.life>0);
  }

  function update(dt) {
    if (mode !== 'playing' || paused) return;
    if (slowMotion > 0) { slowMotion = Math.max(0, slowMotion - dt); dt *= .25; }
    elapsed += dt;
    updateModeTimer(dt);
    remainingTime = Math.max(0, remainingTime - dt);
    if (remainingTime <= 0) { player.hp = 0; setModeResult(false); return; }
    updateObjects(dt);
    if (!player.clearTime) { updatePlayer(dt); updateEnemies(dt); }
    const lead = playerMode === 'lcd' ? Math.max(-viewportWidth*.22,Math.min(viewportWidth*.22, player.vx*.2)) : player.vx*.06;
    const targetCamera = Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, player.x + lead - viewportWidth * (portrait ? .39 : player.facing > 0 ? .34 : .56)));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * (playerMode === 'lcd' ? 10 : 7));
    const verticalAnchor = playerMode==='king' ? .55 : player.vy < -100 ? .68 : player.vy > 180 ? .48 : .61;
    const targetCameraY = portrait ? Math.max(-130, Math.min(260, player.y - viewportHeight*verticalAnchor)) : 0;
    cameraY += (targetCameraY - cameraY) * Math.min(1, dt * (playerMode==='lcd'?11:6));
    shake *= Math.pow(.02, dt);
    landingShake *= Math.pow(.01, dt);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    ui.hearts.textContent = `${'♥ '.repeat(Math.max(0, Math.ceil(player.hp)))}${'♡ '.repeat(Math.max(0, 3 - Math.ceil(player.hp)))}`;
    ui.coins.textContent = String(player.coins).padStart(2, '0');
    ui.score.textContent = String(player.score).padStart(6, '0');
    ui.timer.textContent = String(Math.ceil(remainingTime)).padStart(3, '0');
    ui.dashGauge.value = player.dash;
    if (playerMode !== 'normal') { ui.modeTimer.textContent = `${MODE_NAMES[playerMode]}  ${Math.ceil(modeTimer)}`; ui.modeHud.classList.remove('hidden'); }
  }

  function drawRoundedRect(x, y, w, h, radius) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    const palettes={city:['#63cbe6','#d8f1dc','#f7d794'],underground:['#10152d','#36285a','#59463d'],sea:['#087fa9','#35c9dc','#b8f4df'],sky:['#287fd1','#9ce7ff','#fff2bd'],boss:['#451251','#b42d44','#ff9b43']};
    const palette=palettes[stageTheme]; sky.addColorStop(0,palette[0]); sky.addColorStop(.65,palette[1]); sky.addColorStop(1,palette[2]);
    ctx.fillStyle = sky; ctx.fillRect(-50, -200, Math.max(1380, viewportWidth+100), Math.max(1100, viewportHeight+300));
    ctx.fillStyle = '#fff4';
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 260 - cameraX * .08) % 1820) - 180;
      ctx.beginPath(); ctx.arc(x, 130 + i % 3 * 35, 42, 0, 7); ctx.arc(x + 48, 120 + i % 3 * 35, 55, 0, 7); ctx.arc(x + 96, 137 + i % 3 * 35, 36, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#426a7b';
    for (let i = 0; i < 12; i += 1) {
      const x = i * 190 - (cameraX * .18 % 190) - 80; const h = 110 + (i % 4) * 35;
      ctx.fillRect(x, 440 - h, 145, h);
      ctx.fillStyle = '#79a2ad';
      for (let wx = x + 18; wx < x + 130; wx += 35) for (let wy = 455 - h; wy < 410; wy += 34) ctx.fillRect(wx, wy, 15, 12);
      ctx.fillStyle = '#426a7b';
    }
    ctx.fillStyle = '#284c58'; ctx.fillRect(0, 438, 1280, 172);
    for (let i = 0; i < 7; i += 1) {
      const x = i * 250 - (cameraX * .42 % 250) - 50;
      ctx.fillStyle = i % 2 ? '#e9e0c5' : '#f5b85d'; ctx.fillRect(x, 310, 215, 300);
      ctx.fillStyle = i % 2 ? '#ef5b43' : '#32a6b6'; ctx.fillRect(x - 8, 330, 231, 34);
      ctx.fillStyle = '#173a49'; ctx.fillRect(x + 24, 386, 75, 130); ctx.fillRect(x + 120, 386, 70, 82);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 17px Arial'; ctx.textAlign = 'center'; ctx.fillText(i % 2 ? 'MOBILE PARTS' : 'REPAIR SHOP', x + 107, 353);
      ctx.fillStyle = '#ffda35'; ctx.fillRect(x + 130, 480, 57, 29); ctx.fillStyle = '#183a49'; ctx.font = 'bold 18px Arial'; ctx.fillText('🔧', x + 158, 501);
    }
  }

  function drawWorld() {
    ctx.save(); ctx.translate(-cameraX, -cameraY);
    for (const platform of staticPlatforms) drawPlatform(platform);
    for (const platform of movingPlatforms) { drawPlatform(platform, true); }
    fragilePlatforms.forEach((platform) => { if (platform.active) drawPlatform(platform, true); });
    jumpPads.forEach(drawJumpPad);
    drawHazards();
    drawScenery();
    coins.forEach(drawCoin);
    items.forEach(drawItem);
    transformItems.forEach(drawTransformItem);
    checkpoints.forEach(drawCheckpoint);
    drawGoal();
    enemies.forEach(drawEnemy);
    if(boss?.alive) drawBoss();
    droplets.forEach(drawDroplet);
    dust.forEach((particle) => { ctx.globalAlpha = particle.life * 1.8; ctx.fillStyle = '#dfc18a'; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    afterimages.forEach((ghost) => { if(ghost.lcd){ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='hue-rotate(135deg) saturate(2)';} drawFeniSprite(ghost.x, ghost.y, ghost.facing, 0, .28 * ghost.life / .28); if(ghost.lcd)ctx.restore(); });
    sparks.forEach((p) => { ctx.globalAlpha=p.life*1.7; ctx.fillStyle=Math.random()>.5?'#ffec48':'#ff5a1f'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill(); });
    ctx.globalAlpha = 1;
    confetti.forEach(p=>{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,8,14);});
    modeParticles.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; if (p.digital) ctx.fillRect(p.x, p.y, p.size * 2.2, p.size); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } });
    ctx.globalAlpha = 1;
    drawPlayer();
    ctx.restore();
  }

  function drawBoss(){
    ctx.save();ctx.translate(boss.x+boss.w/2,boss.y+boss.h/2);ctx.shadowColor=boss.hit?'#fff':'#ff352d';ctx.shadowBlur=35;
    ctx.fillStyle=boss.hit?'#fff':'#59204f';drawRoundedRect(-95,-115,190,230,28);ctx.fillStyle='#111d32';ctx.fillRect(-68,-82,136,122);
    ctx.strokeStyle='#ff5544';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-45,-45);ctx.lineTo(20,20);ctx.lineTo(-5,70);ctx.moveTo(20,20);ctx.lineTo(55,-55);ctx.stroke();
    ctx.fillStyle='#ffdb32';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('MEGA BUG',0,104);ctx.restore();
    ctx.fillStyle='#180c22';ctx.fillRect(boss.x,boss.y-28,boss.w,14);ctx.fillStyle='#ff493e';ctx.fillRect(boss.x,boss.y-28,boss.w*(boss.hp/boss.maxHp),14);
  }

  function drawPlatform(platform, moving = false) {
    if (platform.x + platform.w < cameraX - 80 || platform.x > cameraX + 1360) return;
    ctx.fillStyle = moving ? '#3b5d65' : '#4d4c43'; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = moving ? '#ffc62e' : '#9a8159'; ctx.fillRect(platform.x, platform.y, platform.w, Math.min(14, platform.h));
    ctx.fillStyle = '#d8b76f';
    for (let x = platform.x + 8; x < platform.x + platform.w; x += 38) ctx.fillRect(x, platform.y + 4, 22, 4);
    if (moving) { ctx.fillStyle = '#172f3a'; ctx.font = 'bold 14px Arial'; ctx.fillText('◀  GEAR  ▶', platform.x + 10, platform.y + 15); }
  }

  function drawJumpPad(pad) {
    ctx.fillStyle='#ff4a25'; ctx.fillRect(pad.x,pad.y,pad.w,pad.h);
    ctx.fillStyle='#fff04a'; ctx.beginPath(); ctx.moveTo(pad.x+8,pad.y+12);ctx.lineTo(pad.x+29,pad.y+2);ctx.lineTo(pad.x+50,pad.y+12);ctx.fill();
  }

  function drawHazards() {
    ctx.fillStyle='#e23b32';
    hazards.forEach((h)=>{ for(let x=h.x;x<h.x+h.w;x+=18){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+9,h.y);ctx.lineTo(x+18,h.y+h.h);ctx.fill();} });
    fallingHazards.forEach((r)=>{ctx.fillStyle='#5a4b43';ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+r.h/2,r.w/2,0,Math.PI*2);ctx.fill();});
    const sections=[[120,'SECTION 1  BASIC'],[1550,'SECTION 2  PITS + PLATFORMS'],[3100,'SECTION 3  ENEMY CLIMB'],[4800,'SECTION 4  HIGH SPEED'],[6450,'SECTION 5  FINAL CHALLENGE']];
    ctx.font='bold 22px Arial';ctx.textAlign='left';sections.forEach(([x,label])=>{ctx.fillStyle='#0d385dcc';ctx.fillRect(x,205,390,38);ctx.fillStyle='#fff36a';ctx.fillText(label,x+12,232);});
  }

  function drawScenery() {
    const props = [[620, 'TOOL'], [1590, 'PARTS'], [3070, '🔧'], [4780, 'BATTERY'], [6440, 'REPAIR']];
    for (const [x, label] of props) {
      ctx.fillStyle = '#714b2b'; ctx.fillRect(x, FLOOR_Y - 90, 8, 90);
      ctx.fillStyle = '#1c6075'; drawRoundedRect(x - 35, FLOOR_Y - 125, 78, 45, 5);
      ctx.strokeStyle = '#5ce6ef'; ctx.lineWidth = 3; ctx.strokeRect(x - 35, FLOOR_Y - 125, 78, 45);
      ctx.fillStyle = '#fff36a'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, x + 4, FLOOR_Y - 98);
    }
    for (const x of [2300, 3850, 5470, 7130]) {
      ctx.fillStyle = '#aa713c'; ctx.fillRect(x, FLOOR_Y - 42, 70, 42); ctx.strokeStyle = '#71431d'; ctx.strokeRect(x, FLOOR_Y - 42, 70, 42);
      ctx.fillStyle = '#5c381d'; ctx.font = '20px Arial'; ctx.fillText('⚙', x + 35, FLOOR_Y - 13);
    }
  }

  function drawCoin(coin) {
    if (coin.collected) return;
    const squash = .35 + Math.abs(Math.sin(coin.phase)) * .65;
    ctx.save(); ctx.translate(coin.x, coin.y + Math.sin(coin.phase) * 4); ctx.scale(squash, 1);
    ctx.fillStyle = '#ffd52f'; ctx.strokeStyle = '#b76a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff49d'; ctx.fillRect(-3, -7, 4, 11); ctx.restore();
  }

  function drawItem(item) {
    if(item.collected) return;
    const symbols={battery:'🔋',screen:'📱',toolbox:'🧰',fenicoin:'🔥',fire:'🔥'};
    ctx.save(); ctx.translate(item.x,item.y+Math.sin(item.phase)*6); ctx.shadowColor='#fff25b'; ctx.shadowBlur=18;
    ctx.fillStyle=item.type==='fenicoin'?'#ffd338':'#eaffff'; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.font='26px Arial'; ctx.textAlign='center'; ctx.fillText(symbols[item.type],0,9); ctx.restore();
  }

  function drawTransformItem(item) {
    if (item.collected) return;
    ctx.save(); ctx.translate(item.x, item.y + Math.sin(item.phase) * 8); ctx.rotate(elapsed * 1.8);
    ctx.shadowColor = '#ff6cff'; ctx.shadowBlur = 24; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#913cff'; ctx.lineWidth = 5;
    ctx.beginPath(); for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; const r = i % 2 ? 14 : 24; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-elapsed * 1.8); ctx.fillStyle = '#5b177d'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 7); ctx.restore();
  }

  function drawCheckpoint(checkpoint) {
    ctx.save();
    if (checkpoint.active) { ctx.shadowColor = '#65ff93'; ctx.shadowBlur = 24; }
    ctx.fillStyle = '#6d4930'; ctx.fillRect(checkpoint.x, checkpoint.y, 8, 70);
    ctx.fillStyle = checkpoint.active ? '#51e77f' : '#e8eef0'; ctx.beginPath(); ctx.moveTo(checkpoint.x + 8, checkpoint.y); ctx.lineTo(checkpoint.x + 70, checkpoint.y + 18); ctx.lineTo(checkpoint.x + 8, checkpoint.y + 36); ctx.fill();
    ctx.fillStyle = '#143044'; ctx.font = 'bold 11px Arial'; ctx.fillText('CHECK', checkpoint.x + 37, checkpoint.y + 21);
    ctx.restore();
  }

  function drawGoal() {
    ctx.fillStyle = '#49616b'; ctx.fillRect(goal.x, goal.y, 12, 180);
    ctx.fillStyle = '#ff4d22'; ctx.beginPath(); ctx.moveTo(goal.x + 12, goal.y); ctx.lineTo(goal.x + 100, goal.y + 30); ctx.lineTo(goal.x + 12, goal.y + 62); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px Arial'; ctx.fillText('REPAIR!', goal.x + 52, goal.y + 36);
    ctx.fillStyle = '#ffd238'; ctx.beginPath(); ctx.arc(goal.x + 6, goal.y, 12, 0, 7); ctx.fill();
  }

  function drawFeniSprite(x, y, facing, rotation = 0, alpha = 1) {
    const stride = Math.sin(player.anim); const speed = Math.abs(player.vx);
    const bob = player.grounded && speed > 25 ? -Math.abs(stride) * 6 : Math.sin(player.anim) * 1.5;
    const tilt = player.invincible > 0 ? Math.sin(elapsed*35)*.12 : player.state === 'dash' ? .16*facing : player.state === 'walk' ? .07*facing : player.state === 'fall' ? .05*facing : 0;
    const squash = player.state === 'land' ? .88 : player.state === 'doubleJump' ? 1.1 : 1;
    const stretchX = player.state === 'jump' ? .92 : player.state === 'doubleJump' ? .88 : 1;
    const celebration = player.state === 'clear' ? 1 + Math.sin(player.clearTime * 10) * .09 : 1;
    ctx.save(); ctx.globalAlpha *= alpha; if(player.state==='clear'){ctx.shadowColor='#fff36a';ctx.shadowBlur=28;} ctx.translate(x+player.w/2,y+player.h/2+bob); ctx.rotate(rotation+tilt); ctx.scale(facing * stretchX * celebration,squash * celebration);
    const currentImage = playerImages[playerMode];
    if (currentImage.complete && currentImage.naturalWidth) ctx.drawImage(currentImage,-player.w*.62,-player.h*.66,player.w*1.24,player.h*1.32);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(elapsed * 14) % 2) return;
    if(playerMode==='lcd'){ctx.save();ctx.strokeStyle='#61ecff';ctx.lineWidth=3;ctx.globalAlpha=.6;for(let i=0;i<7;i++){const y=player.y+Math.random()*player.h;ctx.beginPath();ctx.moveTo(player.x-25-Math.random()*120,y);ctx.lineTo(player.x-160-Math.random()*160,y);ctx.stroke();}ctx.restore();}
    if(playerMode==='king'){ctx.save();ctx.globalAlpha=.48;ctx.fillStyle='#ffd52f';ctx.shadowColor='#fff09a';ctx.shadowBlur=35;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.8,player.h*.75,0,0,7);ctx.fill();ctx.restore();}
    drawFeniSprite(player.x, player.y, player.facing, player.spin);
  }

  function drawEnemy(enemy) {
    if (!enemy.alive && enemy.squish <= 0) return;
    ctx.save(); ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    if (!enemy.alive) ctx.scale(1.3, .25);
    if (enemy.type === 'cracked') {
      ctx.fillStyle = '#657684'; drawRoundedRect(-23, -30, 46, 60, 7); ctx.fillStyle = '#162d3a'; ctx.fillRect(-18, -23, 36, 43);
      ctx.strokeStyle = '#dff8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, -20); ctx.lineTo(8, 3); ctx.lineTo(-5, 20); ctx.moveTo(8, 3); ctx.lineTo(17, -12); ctx.stroke();
      ctx.fillStyle = '#ff5744'; ctx.font = 'bold 15px Arial'; ctx.fillText('× ×', 0, 5);
    } else if (enemy.type === 'battery') {
      ctx.translate(0, Math.sin(enemy.phase * 5) * 3); ctx.fillStyle = '#784fc4'; drawRoundedRect(-25, -25, 50, 50, 15); ctx.fillStyle = '#e7cf32'; ctx.fillRect(-8, -33, 16, 8);
      ctx.fillStyle = '#1d1432'; ctx.beginPath(); ctx.arc(-9, -4, 4, 0, 7); ctx.arc(9, -4, 4, 0, 7); ctx.fill(); ctx.font = '20px Arial'; ctx.fillText('ϟ', 0, 19);
    } else {
      ctx.fillStyle = '#28a8c8'; drawRoundedRect(-23, -30, 46, 60, 8); ctx.fillStyle = '#124155'; ctx.fillRect(-17, -22, 34, 40);
      ctx.fillStyle = '#9eeeff'; ctx.beginPath(); ctx.arc(-8, -3, 4, 0, 7); ctx.arc(9, -3, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#55dfff'; ctx.beginPath(); ctx.moveTo(0, -43); ctx.quadraticCurveTo(15, -25, 0, -20); ctx.quadraticCurveTo(-15, -25, 0, -43); ctx.fill();
    }
    ctx.restore();
  }

  function drawDroplet(drop) {
    ctx.fillStyle = '#45dfff'; ctx.beginPath(); ctx.moveTo(drop.x + 8, drop.y); ctx.quadraticCurveTo(drop.x + 20, drop.y + 13, drop.x + 8, drop.y + 17); ctx.quadraticCurveTo(drop.x - 4, drop.y + 13, drop.x + 8, drop.y); ctx.fill();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#102b46'; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(offsetX + (Math.random() - .5) * (shake + landingShake), offsetY + (Math.random() - .5) * (shake + landingShake)); ctx.scale(scale, scale);
    drawBackground();
    if (mode !== 'title') drawWorld();
    ctx.restore();
    if (paused && mode === 'playing') {
      ctx.fillStyle = '#04111dcc'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.max(30, 52 * scale)}px Arial`; ctx.fillText('PAUSE', width / 2, height / 2);
      ctx.font = `${Math.max(14, 18 * scale)}px Arial`; ctx.fillText('Ⅱ / ESC で再開', width / 2, height / 2 + 42 * scale);
    }
  }

  function loop(now) {
    const dt = Math.min(.033, (now - previousTime) / 1000 || 0);
    previousTime = now;
    update(dt);
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump' };
  addEventListener('keydown', (event) => {
    if ((event.code === 'Enter' || event.code === 'Space') && (mode === 'title' || mode === 'clear' || mode === 'gameover')) { event.preventDefault(); startGame(); return; }
    if (event.code === 'Escape' && mode === 'playing') { paused = !paused; return; }
    if (keyMap[event.code]) { event.preventDefault(); input[keyMap[event.code]] = true; }
    if (event.code.startsWith('Shift')) { event.preventDefault(); input[player?.facing < 0 ? 'dashLeft' : 'dashRight'] = true; }
  });
  addEventListener('keyup', (event) => { if (keyMap[event.code]) { event.preventDefault(); input[keyMap[event.code]] = false; } if (event.code.startsWith('Shift')) { input.dashLeft=false; input.dashRight=false; } });
  addEventListener('blur', () => Object.keys(input).forEach((key) => { input[key] = false; }));

  document.querySelectorAll('[data-input]').forEach((button) => {
    const name = button.dataset.input;
    const press = (event) => { event.preventDefault(); input[name] = true; button.classList.add('pressed'); if (event.pointerId !== undefined) button.setPointerCapture?.(event.pointerId); };
    const release = (event) => { event.preventDefault(); input[name] = false; button.classList.remove('pressed'); };
    if (window.PointerEvent) {
      button.addEventListener('pointerdown', press); button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    } else {
      button.addEventListener('touchstart', press, { passive: false });
      button.addEventListener('touchend', release, { passive: false });
      button.addEventListener('touchcancel', release, { passive: false });
    }
  });

  $('#start').addEventListener('click', startGame);
  $('#retry').addEventListener('click', startGame);
  $('#next').addEventListener('click', () => { currentStage=Math.min(STAGES.length-1,currentStage+1); startGame(); });
  ui.pause.addEventListener('click', () => { if (mode === 'playing') paused = !paused; });
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 80));
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', resize);
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  resize();
  resetGame();
  if (!animationFrame) animationFrame = requestAnimationFrame(loop);
})();
