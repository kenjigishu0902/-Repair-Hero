(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  if (navigator.maxTouchPoints > 0) document.body.classList.add('touch-device');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    title: $('#title'), result: $('#result'), hud: $('#hud'), touch: $('#touch'), pause: $('#pause'),
    hearts: $('#hearts'), coins: $('#coins'), score: $('#score'), timer: $('#timer'), dashGauge: $('#dashGauge'), notice: $('#notice'),
    modeHud: $('#modeHud'), modeTimer: $('#modeTimer'), transformFlash: $('#transformFlash'),
    bossHud: $('#bossHud'), bossHp: $('#bossHp'), goalLock: $('#goalLock'), attack: $('#attack'),
    oxygenHud: $('#oxygenHud'), oxygenGauge: $('#oxygenGauge')
  };

  let WORLD_WIDTH = 7600;
  const FLOOR_Y = 610;
  const PLAYER_W = 72;
  const PLAYER_H = 112;
  const MAX_JUMPS = 2;
  const playerImages = {};
  for (const [name, source] of Object.entries({ normal: './feni.png', battery: './feni_battery.png', lcd: './feni_lcd.png', king: './feni_king.png', muscle: './fenichan_gorimacho.png', musclePunch: './fenichan_gorimacho_punch.png' })) {
    playerImages[name] = new Image();
    playerImages[name].src = source;
  }
  const MODE_DURATION = 10;
  const MODE_NAMES = { battery: 'BATTERY MODE', lcd: 'LCD MODE', king: 'KING MODE', muscle: 'GORI MACHO MODE' };
  const GRAVITY = 1800;
  const MAX_FALL = 920;
  const START_TIME = 150;
  const input = { left: false, right: false, down: false, jump: false, dashLeft: false, dashRight: false, attack: false };
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
  let projectiles = [], shockwaves = [], combatFx = [], swordItem = null, bossGate = null, bossIntro = 0, hitStop = 0;
  let bossDefeated = false;
  let goalUnlocked = true;
  let breakables = [], currents = [], bubbles = [], oxygen = 100, oxygenDamageTimer = 0;
  const STAGES = [
    { id: '1-1', name: 'スマホ修理商店街', theme: 'city', width: 7600, time: 150 },
    { id: '1-2', name: '連続ピット工場', theme: 'city', width: 6800, time: 145 },
    { id: '1-3', name: '地下ケーブル迷宮', theme: 'underground', width: 7000, time: 145 },
    { id: '1-4', name: 'クラウド空中回廊', theme: 'sky', width: 7200, time: 150 },
    { id: '1-5', name: 'キング基板・決戦', theme: 'boss', width: 6500, time: 180 },
    { id: '1-6', name: '地下迷宮', theme: 'underground', width: 9600, time: 240, maze: true },
    { id: '1-7', name: '深海リペア海域', theme: 'sea', width: 9800, time: 240, water: true }
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
    staticPlatforms.length = 0; enemyBlueprints.length = 0; itemBlueprints.length = 0;
    transformBlueprints.length = 0; coinBlueprints.length = 0; jumpPads.length = 0;
    // Five authored sections per stage: every one changes elevation, gap rhythm and required action.
    const sectionLength = WORLD_WIDTH / 5;
    const floors = [0, 25, -20, 45, 0];
    for (let section = 0; section < 5; section += 1) {
      const start = section * sectionLength;
      const end = (section + 1) * sectionLength;
      const themeLift = stageTheme === 'sky' ? -70 : stageTheme === 'underground' ? 25 : 0;
      const gap = section === 0 ? 80 : 115 + currentStage * 10;
      const chunk = section === 3 ? 380 : 460;
      for (let x = start; x < end - 100; x += chunk) {
        const first = x === start && section === 0;
        const px = first ? x : x + gap;
        const rise = floors[(section + Math.floor(x / chunk)) % floors.length] + themeLift;
        staticPlatforms.push({x:px, y:FLOOR_Y + rise, w:Math.min(chunk-gap+(first?gap:0),end-px), h:190-rise});
        if (section === 1 || section === 4) staticPlatforms.push({x:px+145,y:FLOOR_Y-145+rise*.35,w:105+(x/chunk%2)*35,h:20});
        if (section === 2) staticPlatforms.push({x:px+80,y:FLOOR_Y-90-(Math.floor(x/chunk)%3)*80,w:125,h:20});
      }
      const ex = start + sectionLength * .42;
      // Three readable encounters per section: dense, but telegraphed.
      enemyBlueprints.push(
        [['cracked','battery','wet'][(section+currentStage)%3],ex,FLOOR_Y-210],
        [['battery','wet','cracked'][(section+currentStage)%3],ex+sectionLength*.22,FLOOR_Y-170],
        [['wet','cracked','battery'][(section+currentStage)%3],ex+sectionLength*.39,FLOOR_Y-250]
      );
      transformBlueprints.push([start+sectionLength*.34, FLOOR_Y-235]);
      for(let c=0;c<5;c+=1) coinBlueprints.push([start+260+c*85,FLOOR_Y-170-(c%2)*45]);
      jumpPads.push({x:start+sectionLength*.76,y:FLOOR_Y-22,w:62,h:22});
    }
    itemBlueprints.push(['battery',WORLD_WIDTH*.18,FLOOR_Y-170],['toolbox',WORLD_WIDTH*.47,FLOOR_Y-250],['screen',WORLD_WIDTH*.72,FLOOR_Y-190]);
    [WORLD_WIDTH*.205,WORLD_WIDTH*.405,WORLD_WIDTH*.605,WORLD_WIDTH*.805].forEach(x=>staticPlatforms.push({x:x-35,y:FLOOR_Y,w:260,h:190,safe:true}));
    // A continuous, fair arena floor prevents pit-only boss deaths.
    if (currentStage === 4) {
      staticPlatforms.push({x:WORLD_WIDTH-1450,y:FLOOR_Y,w:1450,h:190});
      staticPlatforms.push({x:WORLD_WIDTH-1240,y:FLOOR_Y-105,w:150,h:20},{x:WORLD_WIDTH-560,y:FLOOR_Y-150,w:155,h:20});
      itemBlueprints.push(['muscle',WORLD_WIDTH-1120,FLOOR_Y-165]);
    }
    if (stage.maze) {
      staticPlatforms.length=0; enemyBlueprints.length=0; coinBlueprints.length=0; jumpPads.length=0;
      for(let i=0;i<16;i++){const x=i*600,depth=Math.min(330,(i%8)*48);staticPlatforms.push({x,y:FLOOR_Y+depth,w:470,h:220},{x:x+190,y:FLOOR_Y-150+depth,w:170,h:20});if(i%3===1)staticPlatforms.push({x:x+420,y:FLOOR_Y-260+depth,w:120,h:20});enemyBlueprints.push([['cracked','battery','wet'][i%3],x+310,FLOOR_Y-220+depth]);for(let c=0;c<4;c++)coinBlueprints.push([x+120+c*70,FLOOR_Y-90+depth]);}
      itemBlueprints.push(['toolbox',2860,FLOOR_Y-310],['fenicoin',5280,FLOOR_Y+40],['muscle',8120,FLOOR_Y-180]);
    }
    if (stage.water) {
      staticPlatforms.length=0; enemyBlueprints.length=0; coinBlueprints.length=0; jumpPads.length=0;
      staticPlatforms.push({x:0,y:690,w:WORLD_WIDTH,h:80});
      for(let i=0;i<18;i++){const x=i*540;staticPlatforms.push({x,y:i%4===1?80:0,w:260,h:120,ceiling:true});if(i%4===2)staticPlatforms.push({x:x+210,y:500,w:250,h:190});enemyBlueprints.push(['wet',x+360,250+(i%3)*100]);for(let c=0;c<3;c++)coinBlueprints.push([x+180+c*65,220+(i%4)*85]);}
      itemBlueprints.push(['battery',2450,390],['toolbox',5100,180],['muscle',7920,340]);
    }
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
      facing: 1, jumpHeld: false, jumpCount: 0, spin: 0, justLanded: 0, spawnX: 150, spawnY: FLOOR_Y - PLAYER_H, spawnCamera: 0, checkpointHp: 3, checkpointCoins: 0, checkpointScore: 0, dead: false, dash: 100, boost: 0, clearTime: 0, healDelay: 0, healTick: 0, hasSword:false, attackHeld:false, attackTime:0, attackCooldown:0 };
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
    fragilePlatforms = Array.from({length:6+currentStage},(_,i)=>({x:WORLD_WIDTH*(.16+(i+1)/(9+currentStage)),y:FLOOR_Y-105-(i%3)*62,w:82+(i%2)*20,h:18,kind:i%2?'vanish':'crumble',timer:0,active:true}));
    const hazardCount = 8 + currentStage * 2;
    hazards = Array.from({length:hazardCount},(_,i)=>({x:WORLD_WIDTH*(.09+i/(hazardCount+2)),y:FLOOR_Y-20-(i%4===3?105:0),w:54+(i%3)*18,h:20,type:i%5===2?'electric':i%5===4?'fire':i%5===3?'spinner':'spike',phase:i}));
    fallingHazards = Array.from({length:5+currentStage},(_,i)=>({x:WORLD_WIDTH*(.18+i/(7+currentStage)),y:60,baseY:60,w:34,h:42,vy:0,delay:.7+i*.45,warn:0}));
    movingPlatforms = Array.from({length:6+currentStage},(_,i)=>{const x=WORLD_WIDTH*(.1+(i+1)/(8+currentStage));const y=475-(i%3)*72;return {x,y,baseX:x,baseY:y,w:96+(i%2)*20,h:18,axis:i%2?'y':'x',range:82+i*7,speed:.85+i*.13,lastX:x,lastY:y};});
    checkpoints = [WORLD_WIDTH*.205,WORLD_WIDTH*.405,WORLD_WIDTH*.605,WORLD_WIDTH*.805].map((x)=>({x,y:FLOOR_Y-70,active:false}));
    goal = { x: WORLD_WIDTH - 190, y: FLOOR_Y - 180 };
    if(STAGES[currentStage].maze){checkpoints.forEach((p,i)=>p.y=FLOOR_Y-70+(i+1)*48);goal.y=FLOOR_Y+150;}
    if(STAGES[currentStage].water){checkpoints.forEach((p,i)=>p.y=180+(i%3)*150);goal.y=280;}
    boss = currentStage === 4 ? {x:WORLD_WIDTH-720,y:FLOOR_Y-270,w:220,h:270,hp:24,maxHp:24,vx:0,vy:0,alive:true,hit:0,phase:1,state:'dormant',timer:0,cooldown:1.8,grounded:true,intro:false,defeat:0} : null;
    swordItem = currentStage === 4 ? {x:WORLD_WIDTH-1420,y:FLOOR_Y-85,w:42,h:58,collected:false} : null;
    bossGate = currentStage === 4 ? {x:WORLD_WIDTH-1490,y:FLOOR_Y-250,w:28,h:250,closed:false} : null;
    projectiles=[]; shockwaves=[]; combatFx=[]; bossIntro=0; hitStop=0; bossDefeated=false; goalUnlocked=!boss;
    breakables=Array.from({length:STAGES[currentStage].maze?12:6},(_,i)=>({x:900+i*710,y:FLOOR_Y-80+(STAGES[currentStage].maze?(i%5)*48:0),w:58,h:80,alive:true}));
    currents=STAGES[currentStage].water?Array.from({length:12},(_,i)=>({x:500+i*720,y:130+(i%4)*120,w:390,h:150,force:(i%3===2?-1:1)*(90+(i%4)*35)})):[];
    bubbles=STAGES[currentStage].water?Array.from({length:16},(_,i)=>({x:350+i*590,y:150+(i%4)*130,r:32,phase:i})):[];
    oxygen=100; oxygenDamageTimer=0; ui.oxygenHud.classList.toggle('hidden',!STAGES[currentStage].water); document.body.classList.toggle('water-stage',!!STAGES[currentStage].water);
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
    ui.bossHud.classList.add('hidden'); ui.attack.classList.add('hidden'); document.body.classList.remove('boss-phase2'); ui.goalLock.textContent='GOAL LOCKED'; ui.goalLock.classList.remove('unlocked');
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
    ui.bossHud.classList.add('hidden'); ui.attack.classList.add('hidden');
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
    player.attackTime = 0; player.attackCooldown = 0; player.attackHeld = false;
    ui.attack.classList.toggle('hidden', !player.hasSword); ui.attack.classList.remove('punch');
    ui.modeHud.className = 'mode-hud hidden';
    if (playSound) { sound('transformEnd'); say('NORMAL MODE'); }
  }

  function emitModeParticles(modeName, amount) {
    const colors = { battery: ['#54ff72', '#d8ff76'], lcd: ['#48eaff', '#ffffff'], king: ['#ffd338', '#ff8a20', '#fff7b0'], muscle:['#ff542f','#ffd338','#fff'] }[modeName];
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
    if (nextMode === 'muscle') { shake=28; landingShake=16; sound('punch'); shockwaves.push({x:player.x+player.w/2,y:player.y+player.h-18,w:22,vx:-260,life:.65,friendly:true},{x:player.x+player.w/2,y:player.y+player.h-18,w:22,vx:260,life:.65,friendly:true}); }
    const subtitles = { battery: 'AUTO RECOVERY!', lcd: 'SUPER SPEED!!', king: 'INVINCIBLE FLY!', muscle:'POWER MAX!!' };
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
    const choices = ['battery', 'lcd', 'king', 'muscle'];
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
    player.hp -= playerMode === 'battery' ? .5 : playerMode === 'muscle' ? .4 : 1;
    player.healDelay = 0; player.healTick = 0;
    player.invincible = 1.6;
    const knockback = playerMode === 'muscle' ? .28 : 1;
    player.vx = (player.x < sourceX ? -290 : 290) * knockback;
    player.vy = -420 * knockback;
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
    if (STAGES[currentStage].water) oxygen = 100;
    say(message);
    updateHud();
  }

  function respawnAfterFall() {
    sound('damage');
    shake = 18;
    respawnAtCheckpoint('落下！ チェックポイントから再開');
  }

  function damageBoss(amount, force = 0) {
    if (!boss?.alive || boss.hit > 0 || boss.state === 'dormant') return false;
    boss.hp = Math.max(0, boss.hp - amount); boss.hit = .34; boss.vx += player.facing * force;
    player.score += scoreValue(amount * 700); shake = amount >= 4 ? 25 : 12;
    combatFx.push({x:boss.x+boss.w/2,y:boss.y+boss.h/2,life:.55,size:amount>=4?125:65,type:amount>=4?'punch':'slash'});
    sound(amount >= 4 ? 'punchHit' : 'swordHit');
    if (amount >= 4) { hitStop=.10; slowMotion=.16; shockwaves.push({x:boss.x,y:FLOOR_Y-28,w:20,vx:player.facing*330,life:.8,friendly:true}); }
    if (boss.hp <= boss.maxHp/2 && boss.phase === 1) { boss.phase=2; boss.cooldown=.4; document.body.classList.add('boss-phase2'); say('PHASE 2!!\nOVERDRIVE'); window.RepairHeroSound?.music('boss2'); }
    if (boss.hp <= 0) { boss.alive=false; bossDefeated=true; boss.state='defeated'; boss.defeat=.001; boss.vx=0; boss.vy=0; slowMotion=.75; sound('bossDown'); }
    return true;
  }

  function performAttack() {
    if ((!player.hasSword && playerMode !== 'muscle') || player.attackCooldown > 0 || player.dead) return;
    const punch = playerMode === 'muscle';
    player.attackTime = punch ? .38 : .24; player.attackCooldown = punch ? .42 : .48;
    const range = punch ? 190 : 105;
    const hitbox={x:player.facing>0?player.x+player.w-4:player.x-range+4,y:player.y+28,w:range,h:44};
    sound(punch?'punch':'sword');
    combatFx.push({x:player.facing>0?hitbox.x+range:hitbox.x,y:hitbox.y+22,life:punch?.48:.25,size:range,type:punch?'punch':'slash'});
    if(punch){shake=18;for(let i=0;i<26;i++)sparks.push({x:hitbox.x+Math.random()*hitbox.w,y:hitbox.y+Math.random()*hitbox.h,vx:player.facing*(160+Math.random()*480),vy:(Math.random()-.5)*420,life:.25+Math.random()*.35,size:3+Math.random()*8});shockwaves.push({x:player.facing>0?hitbox.x+hitbox.w:hitbox.x,y:hitbox.y+25,w:35,vx:player.facing*620,life:.45,friendly:true});}
    if (boss?.alive && overlap(hitbox,{x:boss.x,y:boss.y+70,w:boss.w,h:boss.h-70})) damageBoss(punch?4:2,punch?250:70);
    for(const enemy of enemies) if(enemy.alive&&overlap(hitbox,enemy)){enemy.vx=player.facing*780;enemy.x+=player.facing*45;enemy.alive=false;enemy.squish=.4;player.score+=500;if(punch){hitStop=.085;shake=28;sound('punchHit');combatFx.push({x:enemy.x,y:enemy.y,life:.55,size:105,type:'explosion'});}}
  }

  function updatePlayer(dt) {
    if (player.dead) return;
    player.invincible = Math.max(0, player.invincible - dt);
    player.justLanded = Math.max(0, player.justLanded - dt);
    player.attackCooldown=Math.max(0,player.attackCooldown-dt); player.attackTime=Math.max(0,player.attackTime-dt);
    if(input.attack&&!player.attackHeld) performAttack();
    player.attackHeld=input.attack;
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

    if (STAGES[currentStage].water) {
      const vertical=Number(input.down)-Number(input.jump); player.jumpHeld=input.jump;
      player.grounded=false; player.vy+=(vertical*(canDash?430:245)-player.vy)*Math.min(1,dt*5); player.vy*=Math.pow(.72,dt);
    } else if (playerMode === 'king') {
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
    if (playerMode !== 'king' && !STAGES[currentStage].water) player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    if(STAGES[currentStage].water){player.x+=player.vx*dt;player.y+=player.vy*dt;player.y=Math.max(105,Math.min(690-player.h,player.y));}else moveAndCollide(player, dt, true);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));
    if (!wasGrounded && player.grounded) {
      player.jumpCount = 0; player.spin = 0; player.justLanded = .16; landingShake = 5;
      spawnDust(player.x + player.w / 2, player.y + player.h, 6);
      if (playerMode === 'muscle') { shake=10; sound('stomp'); shockwaves.push({x:player.x+player.w/2,y:player.y+player.h-20,w:16,vx:-180,life:.45,friendly:true},{x:player.x+player.w/2,y:player.y+player.h-20,w:16,vx:180,life:.45,friendly:true}); }
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

  function updateBoss(dt) {
    if (!boss) return;
    if (!boss.intro && player.x > WORLD_WIDTH-1510) {
      boss.intro=true; bossIntro=.001; bossGate.closed=true;
      ui.bossHud.classList.remove('hidden');
      say('WARNING!!'); window.setTimeout(()=>{if(mode==='playing')say('BOSS BATTLE');},900); window.RepairHeroSound?.music('boss');
    }
    if (boss.defeat) {
      boss.defeat += dt;
      if (boss.defeat > .55 && boss.defeat-dt <= .55) { shake=35; for(let i=0;i<12;i++) combatFx.push({x:boss.x+Math.random()*boss.w,y:boss.y+Math.random()*boss.h,life:.8,size:80,type:'explosion'}); say('BOSS DEFEATED!!'); }
      if (boss.defeat > 1.7 && bossGate.closed) { bossGate.closed=false; ui.goalLock.textContent='GOAL UNLOCKED!!'; ui.goalLock.classList.add('unlocked'); say('GOAL UNLOCKED!!'); window.RepairHeroSound?.music('game'); }
      return;
    }
    if (!boss.intro || !boss.alive) return;
    boss.hit=Math.max(0,boss.hit-dt); boss.timer+=dt; boss.cooldown-=dt;
    const left=WORLD_WIDTH-1370,right=WORLD_WIDTH-260-boss.w;
    if (boss.state==='dormant') { boss.state='chase'; boss.timer=0; }
    if (boss.state==='chase') {
      const speed=boss.phase===2?145:95; boss.vx+=(Math.sign(player.x-boss.x)*speed-boss.vx)*Math.min(1,dt*3);
      if(boss.cooldown<=0){const choices=boss.phase===2?['charge','jump','shoot','slam']:['charge','jump','shoot'];boss.state=choices[Math.floor(boss.timer)%choices.length];boss.timer=0;boss.vx=0;boss.cooldown=boss.phase===2?1.15:1.8;}
    } else if (boss.state==='charge') {
      if(boss.timer<.65) boss.vx=0; else boss.vx=Math.sign(player.x-boss.x)*(boss.phase===2?520:410);
      if(boss.timer>1.25){boss.state='chase';boss.timer=0;}
    } else if (boss.state==='jump') {
      if(boss.timer<.5) boss.vx=0; else if(boss.grounded){boss.vy=-720;boss.vx=Math.sign(player.x-boss.x)*155;boss.grounded=false;}
      if(boss.timer>1.45&&boss.grounded){shockwaves.push({x:boss.x+boss.w/2,y:FLOOR_Y-25,w:25,vx:-280,life:1.5},{x:boss.x+boss.w/2,y:FLOOR_Y-25,w:25,vx:280,life:1.5});shake=18;boss.state='chase';boss.timer=0;}
    } else if (boss.state==='shoot') {
      if(boss.timer>.55&&boss.timer-dt<=.55){const dx=player.x-boss.x,dy=player.y-boss.y,len=Math.hypot(dx,dy)||1;projectiles.push({x:boss.x+boss.w/2,y:boss.y+80,w:24,h:24,vx:dx/len*300,vy:dy/len*300,life:3});sound('bossShot');}
      if(boss.timer>1.05){boss.state='chase';boss.timer=0;}
    } else if (boss.state==='slam') {
      if(boss.timer>.6&&boss.timer-dt<=.6){for(let i=-2;i<=2;i++)shockwaves.push({x:boss.x+boss.w/2,y:FLOOR_Y-25,w:28,vx:i*170,life:1.2});shake=22;}
      if(boss.timer>1.1){boss.state='chase';boss.timer=0;}
    }
    boss.vy=Math.min(MAX_FALL,boss.vy+GRAVITY*dt); boss.x+=boss.vx*dt; boss.y+=boss.vy*dt;
    if(boss.y+boss.h>=FLOOR_Y){boss.y=FLOOR_Y-boss.h;boss.vy=0;boss.grounded=true;} boss.x=Math.max(left,Math.min(right,boss.x));
    const head={x:boss.x+35,y:boss.y,w:boss.w-70,h:62}; const body={x:boss.x,y:boss.y+62,w:boss.w,h:boss.h-62};
    if(overlap(player,head)&&player.vy>0&&player.y+player.h<=head.y+42){if(damageBoss(playerMode==='muscle'?3:1,60))player.vy=-570;}
    else if(overlap(player,body)||overlap(player,head)) hurt(boss.x+boss.w/2);
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

      const dashHit=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>300;
      if (overlap(player, enemy) && (playerMode === 'king'||dashHit)) {
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
    updateBoss(dt);
  }

  function updateObjects(dt) {
    if(swordItem&&!swordItem.collected&&overlap(player,swordItem)){swordItem.collected=true;player.hasSword=true;ui.attack.classList.remove('hidden');say('BOSS SWORD GET!!\n⚔ ATTACK');sound('swordGet');}
    projectiles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(overlap(player,p)){p.life=0;hurt(p.x);}});projectiles=projectiles.filter(p=>p.life>0);
    shockwaves.forEach(p=>{p.x+=p.vx*dt;p.w=Math.min(80,p.w+90*dt);p.life-=dt;if(!p.friendly&&overlap(player,{x:p.x-p.w/2,y:p.y,w:p.w,h:28})){p.life=0;hurt(p.x);}});shockwaves=shockwaves.filter(p=>p.life>0);
    combatFx.forEach(p=>p.life-=dt);combatFx=combatFx.filter(p=>p.life>0);
    const activeDash=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>280;
    for(const wall of breakables){if(!wall.alive||!overlap(player,wall))continue;if(activeDash){wall.alive=false;shake=13;player.score+=250;for(let i=0;i<12;i++)sparks.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,vx:(Math.random()-.5)*360,vy:(Math.random()-.5)*300,life:.5,size:6});}else{player.x=player.vx>0?wall.x-player.w:wall.x+wall.w;player.vx=0;}}
    if(STAGES[currentStage].water){
      oxygen=Math.max(0,oxygen-dt*2.4); if(oxygen<=0){oxygenDamageTimer+=dt;if(oxygenDamageTimer>=1.2){oxygenDamageTimer=0;hurt(player.x);}}else oxygenDamageTimer=0;
      currents.forEach(c=>{if(overlap(player,c))player.vx+=c.force*dt;});
      bubbles.forEach(b=>{b.phase+=dt*2;if(overlap(player,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){oxygen=Math.min(100,oxygen+42*dt);}});
    }
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
      item.collected=true; player.score += scoreValue(250); const labels={battery:'HP RECOVER',screen:'LCD +1000',toolbox:'DASH BOOST',fenicoin:'FENI COIN +3000',fire:'INVINCIBLE',muscle:'GORI MACHO MODE!!'};
      if(item.type==='battery') player.hp=Math.min(3,player.hp+1);
      if(item.type==='screen') player.score+=scoreValue(1000);
      if(item.type==='toolbox') { player.boost=8; player.dash=100; }
      if(item.type==='fenicoin') { player.score+=scoreValue(3000); player.coins+=5; }
      if(item.type==='fire') player.invincible=8;
      if(item.type==='muscle') applyMode('muscle');
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
      if(STAGES[currentStage].water) oxygen=100;
      say('CHECK POINT');
      sound('checkpoint');
      for (let i = 0; i < 28; i += 1) sparks.push({ x: checkpoint.x + 35, y: checkpoint.y + 20, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: .8, size: 4 });
    }
    if (boss && bossDefeated && !bossGate.closed) goalUnlocked = true;
    if (!goalUnlocked && player.x + player.w > goal.x - 20) { player.x=goal.x-player.w-20; player.vx=Math.min(0,player.vx); if(bossIntro>.8)say('GOAL LOCKED\nボスを倒せ！'); }
    if (player.x + player.w > goal.x && !player.clearTime && goalUnlocked) {
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
    if(hitStop>0){hitStop=Math.max(0,hitStop-dt);return;}
    if (slowMotion > 0) { slowMotion = Math.max(0, slowMotion - dt); dt *= .25; }
    elapsed += dt;
    if(bossIntro)bossIntro+=dt;
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
    ui.oxygenGauge.value=oxygen;
    if(boss) ui.bossHp.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
    const canPunch = playerMode === 'muscle';
    ui.attack.textContent = canPunch ? '👊 PUNCH' : '⚔ ATTACK';
    ui.attack.classList.toggle('punch',canPunch);
    ui.attack.classList.toggle('hidden',!canPunch && !player.hasSword);
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
    if(stageTheme==='underground'){ctx.fillStyle='#171126';for(let i=0;i<18;i++){const x=i*130-(cameraX*.16%130);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+65,90+(i%4)*45);ctx.lineTo(x+125,0);ctx.fill();}ctx.fillStyle='#69513d';ctx.fillRect(0,500,Math.max(1400,viewportWidth),260);ctx.fillStyle='#ffd23c';ctx.font='bold 20px Arial';ctx.fillText('UNDERGROUND MAZE  ↓ DEEP ZONE',40,150);return;}
    if(stageTheme==='sea'){ctx.fillStyle='#064e73aa';ctx.fillRect(0,0,Math.max(1400,viewportWidth),900);for(let i=0;i<28;i++){const x=(i*97-cameraX*.12)%1500,y=(i*83+elapsed*35)%760;ctx.strokeStyle='#b9fbff88';ctx.beginPath();ctx.arc(x,y,5+i%7,0,7);ctx.stroke();}ctx.fillStyle='#72e0c7';for(let i=0;i<10;i++)ctx.fillRect(i*180-(cameraX*.2%180),540+(i%2)*40,18,90);ctx.fillStyle='#d5ffff';ctx.font='bold 20px Arial';ctx.fillText('DEEP SEA REPAIR ROUTE',40,150);return;}
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
    breakables.forEach(w=>{if(!w.alive)return;ctx.fillStyle='#8b5737';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeStyle='#ffd335';ctx.lineWidth=4;ctx.strokeRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.fillText('BREAK',w.x+5,w.y+42);});
    currents.forEach(c=>{ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=c.force>0?'#8ff7ff':'#a7d2ff';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.globalAlpha=.8;ctx.font='28px Arial';for(let x=c.x+30;x<c.x+c.w;x+=80)ctx.fillText(c.force>0?'→':'←',x,c.y+c.h/2);ctx.restore();});
    bubbles.forEach(b=>{ctx.save();ctx.strokeStyle='#d7ffff';ctx.lineWidth=4;ctx.shadowColor='#a8ffff';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(b.x,b.y+Math.sin(b.phase)*12,b.r,0,7);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.fillText('O₂',b.x-9,b.y+4);ctx.restore();});
    drawGoal();
    if(swordItem&&!swordItem.collected){ctx.save();ctx.shadowColor='#fff34a';ctx.shadowBlur=25;ctx.font='52px Arial';ctx.fillText('⚔',swordItem.x,swordItem.y+45);ctx.restore();}
    if(bossGate?.closed){ctx.fillStyle='#ff3d31';ctx.shadowColor='#ff2c22';ctx.shadowBlur=18;for(let y=bossGate.y;y<FLOOR_Y;y+=34)ctx.fillRect(bossGate.x,y,bossGate.w,18);ctx.shadowBlur=0;}
    enemies.forEach(drawEnemy);
    if(boss?.intro && (boss.alive || boss.defeat<.7)) drawBoss();
    droplets.forEach(drawDroplet);
    projectiles.forEach(p=>{ctx.save();ctx.fillStyle='#ffef39';ctx.strokeStyle='#ff3028';ctx.lineWidth=5;ctx.shadowColor='#ff3028';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(p.x,p.y,p.w/2,0,7);ctx.fill();ctx.stroke();ctx.restore();});
    shockwaves.forEach(p=>{ctx.strokeStyle=p.friendly?'#ffdc35':'#ff3b29';ctx.lineWidth=9;ctx.beginPath();ctx.arc(p.x,p.y,p.w,Math.PI,Math.PI*2);ctx.stroke();});
    combatFx.forEach(p=>{ctx.save();ctx.globalAlpha=Math.min(1,p.life*3);ctx.strokeStyle=p.type==='punch'?'#ffd335':'#fff';ctx.fillStyle=p.type==='explosion'?'#ff5425':'#ffd335';ctx.lineWidth=12;ctx.shadowColor='#ff3b20';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-p.life*.35),0,7);p.type==='explosion'?ctx.fill():ctx.stroke();ctx.restore();});
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
    if(['charge','jump','shoot','slam'].includes(boss.state)&&boss.timer<.65){ctx.globalAlpha=.65+.35*Math.sin(elapsed*28);ctx.strokeStyle='#fff13d';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,145,0,7);ctx.stroke();}
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
    hazards.forEach((h)=>{ctx.save();ctx.globalAlpha=.82+.18*Math.sin(elapsed*9+h.phase);ctx.lineWidth=4;ctx.shadowBlur=20;
      if(h.type==='spinner'){ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.rotate(elapsed*3+h.phase);ctx.strokeStyle='#ffe329';ctx.shadowColor='#ff3020';for(let a=0;a<4;a++){ctx.rotate(Math.PI/2);ctx.fillStyle=a%2?'#111':'#ffd32b';ctx.fillRect(0,-7,h.w*.72,14);}ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.stroke();}
      else if(h.type==='fire'){ctx.fillStyle='#ff3b18';ctx.strokeStyle='#ffe52d';ctx.shadowColor='#ff3b18';for(let x=h.x;x<h.x+h.w;x+=22){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.quadraticCurveTo(x+4,h.y-18-Math.sin(elapsed*12)*8,x+11,h.y);ctx.lineTo(x+22,h.y+h.h);ctx.fill();ctx.stroke();}}
      else {ctx.fillStyle=h.type==='electric'?'#fff22d':'#f02f27';ctx.strokeStyle='#fff';ctx.shadowColor=h.type==='electric'?'#45eaff':'#ff2018';for(let x=h.x;x<h.x+h.w;x+=18){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+9,h.y);ctx.lineTo(x+18,h.y+h.h);ctx.fill();ctx.stroke();}}
      ctx.restore();});
    fallingHazards.forEach((r)=>{ctx.fillStyle='#ff4a25';ctx.strokeStyle='#ffe42e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+r.h/2,r.w/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='bold 20px Arial';ctx.fillText('!',r.x+r.w/2,r.y+r.h/2+7);});
    const names=['A  WARM UP','B  PIT RUN','C  VERTICAL','D  SPEED','E  EXTREME'];const sections=names.map((n,i)=>[120+i*WORLD_WIDTH/5,`SECTION ${n}`]);
    ctx.font='bold 22px Arial';ctx.textAlign='left';sections.forEach(([x,label])=>{ctx.fillStyle='#0d385dcc';ctx.fillRect(x,205,390,38);ctx.fillStyle='#fff36a';ctx.fillText(label,x+12,232);});
    // Every floor gap gets high-contrast caution stripes and visible downward darkness.
    const sorted=[...staticPlatforms].filter(p=>p.h>80).sort((a,b)=>a.x-b.x);for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];const gx=a.x+a.w,gw=b.x-gx;if(gw>35&&gw<420){ctx.fillStyle='#050810';ctx.fillRect(gx,FLOOR_Y-8,gw,250);for(let x=gx;x<b.x;x+=28){ctx.fillStyle=(Math.floor((x-gx)/28)%2)?'#111':'#ffd32b';ctx.fillRect(x,FLOOR_Y-18,28,10);}}}
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
    const symbols={battery:'🔋',screen:'📱',toolbox:'🧰',fenicoin:'🔥',fire:'🔥',muscle:'👊'};
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
    const currentImage = playerMode === 'muscle' && player.attackTime > 0 ? playerImages.musclePunch : playerImages[playerMode];
    if (currentImage.complete && currentImage.naturalWidth) ctx.drawImage(currentImage,-player.w*.62,-player.h*.66,player.w*1.24,player.h*1.32);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(elapsed * 14) % 2) return;
    if(playerMode==='lcd'){ctx.save();ctx.strokeStyle='#61ecff';ctx.lineWidth=3;ctx.globalAlpha=.6;for(let i=0;i<7;i++){const y=player.y+Math.random()*player.h;ctx.beginPath();ctx.moveTo(player.x-25-Math.random()*120,y);ctx.lineTo(player.x-160-Math.random()*160,y);ctx.stroke();}ctx.restore();}
    if(playerMode==='king'){ctx.save();ctx.globalAlpha=.48;ctx.fillStyle='#ffd52f';ctx.shadowColor='#fff09a';ctx.shadowBlur=35;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.8,player.h*.75,0,0,7);ctx.fill();ctx.restore();}
    drawFeniSprite(player.x, player.y, player.facing, player.spin);
    if(player.attackTime>0){ctx.save();const front=player.facing>0?player.x+player.w:player.x;ctx.translate(front,player.y+55);ctx.scale(player.facing,1);if(playerMode==='muscle'){ctx.fillStyle='#ff8b31';ctx.strokeStyle='#7d1d12';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(48,0,48,25,0,0,7);ctx.fill();ctx.stroke();}else{ctx.strokeStyle='#fff';ctx.lineWidth=9;ctx.shadowColor='#62eaff';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,0,92,-1.1,1.1);ctx.stroke();}ctx.restore();}
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

  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', KeyX:'attack' };
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
