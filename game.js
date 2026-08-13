(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  if (navigator.maxTouchPoints > 0) document.body.classList.add('touch-device');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    title: $('#title'), result: $('#result'), hud: $('#hud'), touch: $('#touch'), pause: $('#pause'),
    hearts: $('#hearts'), coins: $('#coins'), score: $('#score'), timer: $('#timer'), dashGauge: $('#dashGauge'), notice: $('#notice'),
    modeHud: $('#modeHud'), modeTimer: $('#modeTimer'), shieldCount: $('#shieldCount'), transformFlash: $('#transformFlash'),
    bossHud: $('#bossHud'), bossName: $('#bossName'), bossHp: $('#bossHp'), goalLock: $('#goalLock'), attack: $('#attack'),
    oxygenHud: $('#oxygenHud'), oxygenGauge: $('#oxygenGauge'), resultFeni: $('#resultFeni')
  };

  let WORLD_WIDTH = 7600;
  let WORLD_HEIGHT = 820;
  const FLOOR_Y = 610;
  const PLAYER_W = 72;
  const PLAYER_H = 112;
  const MAX_JUMPS = 2;
  const PLAYER_IMAGE_SOURCES = { normal: './feni.png', battery: './feni_battery.png', lcd: './feni_lcd.png', king: './feni_king.png', muscle: './fenichan_gorimacho.png', musclePunch: './fenichan_gorimacho_punch.png', dash: './feni_dash.png' };
  const playerImages = {};
  for (const [name, source] of Object.entries(PLAYER_IMAGE_SOURCES)) {
    playerImages[name] = new Image();
    playerImages[name].src = source;
  }
  // Each source illustration has different transparent padding. Cropping to the
  // visible character before drawing keeps every mode at the original normal
  // Feni size without altering the physics hitbox or shrinking the whole game.
  const PLAYER_SPRITE_META = {
    normal: { sx:0, sy:0, sw:839, sh:885 },
    battery: { sx:58, sy:139, sw:409, sh:475 },
    lcd: { sx:47, sy:144, sw:491, sh:477 },
    king: { sx:0, sy:146, sw:524, sh:479 },
    muscle: { sx:22, sy:1, sw:1191, sh:1183 },
    musclePunch: { sx:0, sy:0, sw:1469, sh:1022 },
    dash: { sx:33, sy:89, sw:689, sh:566 }
  };
  const enemyImages = {};
  for (const [name, source] of Object.entries({
    phoneBot:'./enemy_phone_bot.png', toolMech:'./enemy_tool_mech.png', batteryBot:'./enemy_battery_bot.png',
    boardTrooper:'./enemy_board_trooper.png', drillMech:'./enemy_tool_mech.png', mechaShark:'./enemy_mecha_shark.png',
    subDrone:'./enemy_battle_drone.png', battleDrone:'./enemy_battle_drone.png', jetMech:'./enemy_battle_drone.png'
  })) {
    enemyImages[name] = new Image();
    enemyImages[name].src = source;
  }
  const bossImage = new Image();
  bossImage.src = './boss_mega_bug_titan.png';
  const phoenixSwordImage = new Image();
  phoenixSwordImage.src = './phoenix_sword.png';
  const swordPoseImages = {};
  for (const [name, source] of Object.entries({
    ready: './feni_sword_ready.png',
    swing: './feni_sword_swing.png',
    finish: './feni_sword_finish.png'
  })) {
    swordPoseImages[name] = new Image();
    swordPoseImages[name].src = source;
  }
  const SWORD_ATTACK_DURATION = .30;
  const SWORD_POSE_META = {
    ready: { anchorX: .34, anchorY: .747, size: 198 },
    swing: { anchorX: .35, anchorY: .547, size: 260 },
    finish: { anchorX: .35, anchorY: .591, size: 250 }
  };
  const TRANSFORM_WEIGHTS = ['battery','battery','battery','battery','battery','lcd','lcd','lcd','lcd','lcd','muscle','muscle','muscle','muscle','muscle','muscle','king'];
  const MODE_DURATIONS = { battery: 25, lcd: 25, king: 20, muscle: 25 };
  const MODE_NAMES = { battery: 'BATTERY MODE', lcd: 'LCD MODE', king: 'KING MODE', muscle: 'GORI MACHO MODE' };
  const GRAVITY = 1800;
  const MAX_FALL = 920;
  const JUMP_PAD_VELOCITY = -1120;
  const START_TIME = 150;
  const input = { left: false, right: false, up: false, down: false, jump: false, dashLeft: false, dashRight: false, attack: false };
  let width = 1280;
  let height = 720;
  let dpr = 1;
  let scale = 1;
  let baseScale = 1;
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
  let transformSpawnPoints = [], transformSpawnTimer = 0, transformHistory = [];
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
  let projectiles = [], shockwaves = [], combatFx = [], shieldShards = [], rushTrails = [], swordItem = null, bossGate = null, bossIntro = 0, hitStop = 0;
  let bossDefeated = false;
  let goalUnlocked = true;
  let breakables = [], currents = [], bubbles = [], oxygen = 100, oxygenDamageTimer = 0, chaserWall = null;
  const STAGES = [
    { id: '1-1', name: 'スマホ修理商店街', theme: 'city', width: 10600, time: 215 },
    { id: '1-2', name: '連続ピット工場', theme: 'city', width: 9800, time: 200 },
    { id: '1-3', name: '地下ケーブル迷宮', theme: 'underground', width: 10400, time: 210 },
    { id: '1-4', name: 'クラウド空中回廊', theme: 'sky', width: 10800, time: 220 },
    { id: '1-5', name: 'キング基板・決戦', theme: 'boss', width: 9200, time: 240, bossType: 'titan' },
    { id: '1-6', name: '地下迷宮', theme: 'underground', width: 13200, time: 300, maze: true },
    { id: '1-7', name: '深海リペア海域', theme: 'sea', width: 14000, time: 320, water: true },
    { id: '1-8', name: '圧壊ウォール・エスケープ', theme: 'factory', width: 11600, time: 210, chaseWall: true },
    { id: '2-5', name: '深海メカシャーク決戦', theme: 'sea', width: 11000, time: 280, water: true, bossType: 'shark' }
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
    WORLD_WIDTH = stage.width; WORLD_HEIGHT = stage.maze ? 1180 : 820; stageTheme = stage.theme;
    staticPlatforms.length = 0; enemyBlueprints.length = 0; itemBlueprints.length = 0;
    transformBlueprints.length = 0; coinBlueprints.length = 0; jumpPads.length = 0;
    const enemySets = {
      city: ['phoneBot', 'toolMech', 'batteryBot'],
      underground: ['boardTrooper', 'drillMech', 'boardTrooper'],
      sea: ['mechaShark', 'jelly', 'subDrone'],
      sky: ['battleDrone', 'jetMech', 'battleDrone'],
      boss: ['boardTrooper', 'jetMech', 'batteryBot'],
      factory: ['toolMech', 'batteryBot', 'jetMech']
    };
    const stageEnemies = enemySets[stageTheme] || enemySets.city;
    // Seven authored sections make each route substantially longer while wide
    // floor chunks and readable run-ups keep Feni comfortable to control.
    const sectionCount = 7;
    const sectionLength = WORLD_WIDTH / sectionCount;
    const floors = [0, 20, -15, 35, 0, -25, 20];
    for (let section = 0; section < sectionCount; section += 1) {
      const start = section * sectionLength;
      const end = (section + 1) * sectionLength;
      const themeLift = stageTheme === 'sky' ? -70 : stageTheme === 'underground' ? 25 : 0;
      const gap = section === 0 ? 40 : 66 + Math.min(18,currentStage*3);
      const chunk = section % 4 === 3 ? 590 : 640;
      for (let x = start; x < end - 100; x += chunk) {
        const first = x === start && section === 0;
        const px = first ? x : x + gap;
        const rise = floors[(section + Math.floor(x / chunk)) % floors.length] + themeLift;
        staticPlatforms.push({x:px, y:FLOOR_Y + rise, w:Math.min(chunk-gap+(first?gap:0),end-px), h:190-rise});
        if (section === 1 || section === 4 || section === 6) staticPlatforms.push({x:px+145,y:FLOOR_Y-145+rise*.35,w:205+(Math.floor(x/chunk)%2)*35,h:20,oneWay:true});
        if (section === 2 || section === 5) staticPlatforms.push({x:px+95,y:FLOOR_Y-90-(Math.floor(x/chunk)%3)*80,w:215,h:20,oneWay:true});
      }
      const ex = start + sectionLength * .42;
      // Two readable encounters per section leave room to run, jump and dash.
      enemyBlueprints.push(
        [stageEnemies[(section+currentStage)%3],ex,FLOOR_Y-210],
        [stageEnemies[(section+currentStage+1)%3],ex+sectionLength*.25,FLOOR_Y-170]
      );
      transformBlueprints.push([start+sectionLength*.34, FLOOR_Y-235]);
      for(let c=0;c<6;c+=1) coinBlueprints.push([start+240+c*88,FLOOR_Y-170-(c%2)*45]);
      jumpPads.push({x:start+sectionLength*.80,y:FLOOR_Y-22,w:72,h:22});
    }
    itemBlueprints.push(['battery',WORLD_WIDTH*.18,FLOOR_Y-170],['toolbox',WORLD_WIDTH*.47,FLOOR_Y-250],['screen',WORLD_WIDTH*.72,FLOOR_Y-190]);
    [WORLD_WIDTH*.205,WORLD_WIDTH*.405,WORLD_WIDTH*.605,WORLD_WIDTH*.805].forEach(x=>staticPlatforms.push({x:x-35,y:FLOOR_Y,w:260,h:190,safe:true}));
    // A continuous, fair arena floor prevents pit-only boss deaths.
    if (stage.bossType === 'titan') {
      staticPlatforms.push({x:WORLD_WIDTH-1450,y:FLOOR_Y,w:1450,h:190});
      staticPlatforms.push({x:WORLD_WIDTH-1240,y:FLOOR_Y-105,w:150,h:20},{x:WORLD_WIDTH-560,y:FLOOR_Y-150,w:155,h:20});
      itemBlueprints.push(['muscle',WORLD_WIDTH-1120,FLOOR_Y-165]);
    }
    if (stage.maze) {
      staticPlatforms.length=0; enemyBlueprints.length=0; coinBlueprints.length=0; jumpPads.length=0;
      const routeY=[610,610,745,745,900,900,1040,1040,900,745,610,745,900,1040,900,745];
      const mazeSegments=Math.ceil(WORLD_WIDTH/600);
      for(let i=0;i<mazeSegments;i++){
        const x=i*600,y=routeY[i%routeY.length];
        const nextY=routeY[(i+1)%routeY.length];
        staticPlatforms.push({x,y,w:470,h:WORLD_HEIGHT-y+180,mazeFloor:true});
        staticPlatforms.push({x:x+145,y:y-155,w:190,h:20,branch:i%2===0,oneWay:true});
        if(i%3===1) staticPlatforms.push({x:x+315,y:y-285,w:145,h:20,secret:true,oneWay:true});
        if(i<mazeSegments-1&&nextY<y){
          staticPlatforms.push({x:x+430,y:y-105,w:125,h:20,oneWay:true},{x:x+500,y:y-215,w:115,h:20,oneWay:true});
        } else if(i<mazeSegments-1&&nextY>y) {
          staticPlatforms.push({x:x+465,y:y+70,w:115,h:20,oneWay:true},{x:x+515,y:y+135,w:100,h:20,oneWay:true});
        }
        enemyBlueprints.push([stageEnemies[i%2],x+305,y-90]);
        for(let c=0;c<4;c++) coinBlueprints.push([x+110+c*75,y-65-(c%2)*55]);
      }
      // Optional upper branches and deep reward rooms make the route genuinely
      // exploratory without making the main exit dependent on a blind jump.
      staticPlatforms.push(
        {x:WORLD_WIDTH*.22,y:470,w:440,h:24,secret:true,oneWay:true},{x:WORLD_WIDTH*.255,y:410,w:390,h:24,secret:true,oneWay:true},
        {x:WORLD_WIDTH*.48,y:650,w:450,h:24,shortcut:true,oneWay:true},{x:WORLD_WIDTH*.515,y:550,w:390,h:24,shortcut:true,oneWay:true},
        {x:WORLD_WIDTH*.70,y:1080,w:540,h:100,coinRoom:true},{x:WORLD_WIDTH*.84,y:560,w:540,h:24,secret:true,oneWay:true}
      );
      // A second, walkable surface route crosses the deep maze. The one-way
      // decks and connector ledges let players move freely between surface and
      // underground routes; ↓ drops through them on demand.
      for(let x=650,index=0;x<WORLD_WIDTH-850;x+=1850,index+=1){
        staticPlatforms.push({x,y:360+(index%2)*45,w:720,h:24,oneWay:true,surfaceRoute:true});
        staticPlatforms.push({x:x+110,y:505+(index%2)*55,w:220,h:20,oneWay:true,connector:true});
        staticPlatforms.push({x:x+410,y:585+(index%3)*65,w:205,h:20,oneWay:true,connector:true});
      }
      for(let c=0;c<12;c++) coinBlueprints.push([WORLD_WIDTH*.705+(c%6)*72,1010-Math.floor(c/6)*70]);
      itemBlueprints.push(['toolbox',WORLD_WIDTH*.27,FLOOR_Y-310],['fenicoin',WORLD_WIDTH*.52,FLOOR_Y+40],['muscle',WORLD_WIDTH*.84,FLOOR_Y-180]);
    }
    if (stage.water) {
      staticPlatforms.length=0; enemyBlueprints.length=0; coinBlueprints.length=0; jumpPads.length=0;
      const zoneNames=['海面','浅瀬','サンゴ礁','海中洞窟','沈没船','深海','海底'];
      const zoneLength=WORLD_WIDTH/zoneNames.length;
      const waterSegments=Math.ceil(WORLD_WIDTH/490);
      for(let i=0;i<waterSegments;i++){
        const x=i*490,zone=Math.min(zoneNames.length-1,Math.floor(x/zoneLength));
        const seabed=zone<2?650:zone===2?610+(i%2)*35:zone===3?600+(i%3)*38:zone===4?665:zone===5?620+(i%2)*45:660;
        staticPlatforms.push({x,y:seabed,w:500,h:WORLD_HEIGHT-seabed+80,seabed:true});
        if(zone>=3&&zone<=5&&i%2===0) staticPlatforms.push({x:x+70,y:70,w:300,h:155+(i%3)*55,ceiling:true});
        if(zone===4&&i%3===1) staticPlatforms.push({x:x+190,y:315,w:170,h:24,wreck:true});
        enemyBlueprints.push([stageEnemies[i%3],x+310,180+(i%4)*105]);
        for(let c=0;c<3;c++) coinBlueprints.push([x+130+c*75,190+(i%4)*88]);
      }
      itemBlueprints.push(['battery',WORLD_WIDTH*.25,390],['toolbox',WORLD_WIDTH*.52,180],['muscle',WORLD_WIDTH*.80,340]);
      if(stage.bossType==='shark'){
        enemyBlueprints.splice(0,enemyBlueprints.length,...enemyBlueprints.filter(([,x])=>x<WORLD_WIDTH-1850));
        transformBlueprints.splice(0,transformBlueprints.length,...transformBlueprints.filter(([x])=>x<WORLD_WIDTH-1950));
        itemBlueprints.push(['battery',WORLD_WIDTH-2450,250],['muscle',WORLD_WIDTH-2050,430]);
      }
    }
    if (stage.chaseWall) {
      // The wall is the threat here: encounters stay sparse and every obstacle
      // has a visible run-up so the player can choose jump, dash or break-through.
      enemyBlueprints.splice(8);
      jumpPads.push({x:WORLD_WIDTH*.48,y:FLOOR_Y-22,w:62,h:22},{x:WORLD_WIDTH*.82,y:FLOOR_Y-22,w:62,h:22});
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
    // Keep Feni readable while guaranteeing a useful amount of forward space.
    // Narrow phones use width as a second camera constraint instead of scaling
    // the DOM, so portrait and landscape both reveal upcoming hazards.
    // The visible sprite is about 1.32× the physics body. A portrait viewport
    // around 850–950 world pixels high keeps that artwork at 14–18% of the
    // screen while widening the look-ahead from 340 to at least 430 world px.
    baseScale = portrait ? Math.min(height / 850, width / 430) : Math.min(height / 720, width / 980);
    scale = baseScale;
    viewportWidth = width / scale;
    viewportHeight = height / scale;
    offsetX = Math.max(0, (width - viewportWidth * scale) / 2);
    offsetY = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ENEMY_PROFILES = {
    phoneBot: { behavior:'walker', attack:'pulse', w:64, h:73, speed:72 },
    toolMech: { behavior:'shooter', attack:'bolt', w:69, h:71, speed:42 },
    batteryBot: { behavior:'hopper', attack:'burst', w:64, h:75, speed:68 },
    boardTrooper: { behavior:'shooter', attack:'spread', w:75, h:84, speed:48, heavy:true },
    drillMech: { behavior:'charger', attack:'drillWave', w:80, h:69, speed:92, heavy:true },
    mechaShark: { behavior:'swimmer', attack:'bite', w:96, h:60, speed:86, flying:true, aquatic:true },
    jelly: { behavior:'jelly', attack:'electric', w:69, h:80, speed:38, flying:true, aquatic:true },
    subDrone: { behavior:'shooter', attack:'torpedo', w:80, h:58, speed:54, flying:true, aquatic:true },
    battleDrone: { behavior:'shooter', attack:'spread', w:78, h:56, speed:62, flying:true },
    jetMech: { behavior:'flyer', attack:'missile', w:90, h:54, speed:118, flying:true }
  };

  function surfaceAt(x, targetY = FLOOR_Y) {
    const candidates = staticPlatforms.filter((platform) => !platform.ceiling && x >= platform.x + 8 && x <= platform.x + platform.w - 8);
    if (!candidates.length) return null;
    return candidates.reduce((best, platform) => Math.abs(platform.y-targetY) < Math.abs(best.y-targetY) ? platform : best);
  }

  function safeSpawnNear(preferredX, targetY = FLOOR_Y) {
    if (STAGES[currentStage].water) return { x:Math.max(120,preferredX), y:175 };
    const floors = staticPlatforms.filter((platform) => !platform.ceiling && platform.w >= PLAYER_W + 90 && platform.y < WORLD_HEIGHT - 40);
    const score=(platform)=>Math.abs((platform.x+platform.w/2)-preferredX)+Math.abs(platform.y-targetY)*1.6;
    const ordered = floors.sort((a,b) => score(a)-score(b));
    for (const floor of ordered) {
      const x = Math.max(floor.x+55,Math.min(floor.x+floor.w-PLAYER_W-55,preferredX));
      const box = {x:x-90,y:floor.y-PLAYER_H-55,w:PLAYER_W+180,h:PLAYER_H+90};
      const unsafeEnemy = (enemies || []).some((enemy) => overlap(box,enemy));
      const unsafeHazard = (hazards || []).some((hazard) => overlap(box,{x:hazard.x-30,y:hazard.y-35,w:hazard.w+60,h:hazard.h+70}));
      const unsafeWall = (breakables || []).some((wall) => wall.alive && overlap(box,wall));
      if (!unsafeEnemy && !unsafeHazard && !unsafeWall) return {x,y:floor.y-PLAYER_H,platform:floor};
    }
    const fallback = ordered[0];
    return fallback ? {x:fallback.x+40,y:fallback.y-PLAYER_H,platform:fallback} : {x:150,y:targetY-PLAYER_H};
  }

  function makeEnemy([type, x, y]) {
    const profile = ENEMY_PROFILES[type] || ENEMY_PROFILES.phoneBot;
    const floor = profile.flying ? null : surfaceAt(x,y+profile.h);
    return { type, behavior:profile.behavior, attack:profile.attack, heavy:!!profile.heavy, aquatic:!!profile.aquatic, flying:!!profile.flying,
      x, y:floor ? floor.y-profile.h : y, w:profile.w, h:profile.h,
      vx:profile.behavior==='walker'?-profile.speed:profile.behavior==='charger'?-profile.speed*.55:profile.flying?profile.speed:0,
      speed:profile.speed, vy:0, originX:x, originY:y, grounded:false, alive:true,
      cooldown:1.2+(x%7)/10, attackCooldown:1.8+(x%11)/8, attackCharge:0, phase:x/80, squish:0, warning:0 };
  }

  function buildRuntimeTerrain(stage) {
    const solidFloors=staticPlatforms.filter((platform)=>!platform.ceiling&&platform.w>=180&&platform.y<WORLD_HEIGHT-35).sort((a,b)=>a.x-b.x||b.y-a.y);
    const movingCount=stage.water?0:stage.maze?5:stage.chaseWall?4:Math.min(7,4+currentStage);
    movingPlatforms=Array.from({length:movingCount},(_,i)=>{
      const anchor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(movingCount+1)))] || {x:700+i*900,y:FLOOR_Y};
      const vertical=stage.maze || i%2===1;
      const x=Math.min(WORLD_WIDTH-180,anchor.x+Math.max(70,anchor.w*.55));
      const y=Math.max(180,anchor.y-(vertical?175:115));
      return {x,y,baseX:x,baseY:y,w:vertical?112:132,h:20,axis:vertical?'y':'x',range:stage.maze?115:72+i*8,speed:.72+i*.11,lastX:x,lastY:y};
    });

    const fragileCount=stage.water?0:stage.maze?7:stage.chaseWall?4:Math.min(7,4+Math.floor(currentStage/2));
    fragilePlatforms=Array.from({length:fragileCount},(_,i)=>{
      const anchor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(fragileCount+1)))] || {x:500+i*900,y:FLOOR_Y};
      return {x:anchor.x+Math.min(anchor.w-125,85+(i%3)*70),y:anchor.y-105-(i%2)*62,w:92+(i%2)*18,h:18,kind:i%2?'vanish':'crumble',timer:0,active:true};
    });

    if(stage.water){
      const waterHazardCount=stage.bossType==='shark'?7:9;
      hazards=Array.from({length:waterHazardCount},(_,i)=>({x:720+i*(stage.bossType==='shark'?1180:980),y:190+(i%4)*105,w:i%3===0?46:92,h:i%3===0?46:42,type:i%3===0?'mine':i%3===1?'electric':'spike',phase:i,targetY:690}));
      fallingHazards=[];
    }else{
      const hazardCount=stage.chaseWall?4:stage.maze?7:Math.min(7,5+Math.floor(currentStage/3));
      hazards=Array.from({length:hazardCount},(_,i)=>{
        const floor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(hazardCount+1)))] || {x:600+i*700,y:FLOOR_Y,w:300};
        const type=i%5===2?'electric':i%5===4?'fire':i%5===3?'spinner':'spike';
        const w=type==='spinner'?66:92+(i%2)*18;
        const h=type==='spike'?48:type==='electric'?42:34;
        return {x:floor.x+Math.max(70,Math.min(floor.w-w-70,floor.w*(.40+(i%3)*.13))),y:floor.y-h,w,h,type,phase:i,targetY:floor.y};
      });
      const fallingCount=stage.chaseWall?2:stage.maze?4:Math.min(5,3+Math.floor(currentStage/3));
      fallingHazards=Array.from({length:fallingCount},(_,i)=>{
        const floor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1.5)*solidFloors.length/(fallingCount+1)))] || {x:900+i*1100,y:FLOOR_Y,w:300};
        return {x:floor.x+floor.w*.52,y:Math.max(35,floor.y-520),baseY:Math.max(35,floor.y-520),targetY:floor.y,w:34,h:42,vy:0,delay:1.1+i*.52,warn:0};
      });
    }

    if(stage.maze){
      breakables=[.24,.43,.63,.77,.89].map((ratio,index)=>{
        const x=WORLD_WIDTH*ratio;const floor=surfaceAt(x,WORLD_HEIGHT)||{y:FLOOR_Y};
        return {x,y:floor.y-120,w:58,h:120,alive:true,hiddenRoom:index===0||index===2,shortcut:index===4};
      });
    }else{
      const count=stage.chaseWall?7:4;
      breakables=[];
      for(let i=0;i<count;i++){
        const targetX=WORLD_WIDTH*(i+1)/(count+1);const floor=surfaceAt(targetX,FLOOR_Y)||solidFloors[Math.min(solidFloors.length-1,i)];
        if(!floor)continue;const x=Math.max(floor.x+70,Math.min(floor.x+floor.w-90,targetX));
        if(breakables.some((wall)=>Math.abs(wall.x-x)<260))continue;
        breakables.push({x,y:floor.y-72,w:58,h:72,alive:true});
      }
    }
  }

  function buildSafeTransformPoints(stage) {
    const clearance=(point)=>{
      const box={x:point.x-145,y:point.y-90,w:290,h:180};
      const itemBox={x:point.x-38,y:point.y-42,w:76,h:84};
      return !enemies.some((enemy)=>overlap(box,enemy)) && !hazards.some((hazard)=>overlap(box,hazard)) &&
        !breakables.some((wall)=>wall.alive&&overlap(box,wall))&&!staticPlatforms.some((platform)=>overlap(itemBox,platform));
    };
    if(stage.water){
      transformSpawnPoints=[.14,.31,.48,.66,.84].map((ratio,index)=>({x:WORLD_WIDTH*ratio,y:index%2?430:240})).filter(clearance);
    }else{
      transformSpawnPoints=staticPlatforms.filter((platform)=>!platform.ceiling&&platform.w>=230&&platform.y>170&&platform.y<WORLD_HEIGHT-40)
        .map((platform,index)=>({x:platform.x+Math.max(90,Math.min(platform.w-90,platform.w*(.35+(index%3)*.14))),y:platform.y-118,platform}))
        .filter((point)=>point.x>430&&point.x<WORLD_WIDTH-430&&clearance(point));
    }
    const separated=[];
    for(const point of transformSpawnPoints.sort((a,b)=>a.x-b.x)) if(!separated.length||point.x-separated[separated.length-1].x>Math.max(620,WORLD_WIDTH/7)) separated.push(point);
    transformSpawnPoints=separated;
  }

  function buildCheckpoints(stage) {
    return [.205,.405,.605,.805].map((ratio,index)=>{
      const targetX=WORLD_WIDTH*ratio;
      if(stage.water){const y=190+(index%3)*125;return {x:targetX,y:y-35,active:false,respawnX:targetX+35,respawnY:y};}
      const routeFloor=surfaceAt(targetX,stage.maze?WORLD_HEIGHT:FLOOR_Y);
      const spawn=safeSpawnNear(targetX,routeFloor?.y||FLOOR_Y);
      return {x:spawn.x-12,y:spawn.y+PLAYER_H-70,active:false,respawnX:spawn.x,respawnY:spawn.y};
    });
  }

  function resetGame() {
    configureStage();
    Object.keys(input).forEach((key) => { input[key] = false; });
    // Build collision and every dangerous runtime object before choosing either
    // the initial spawn or transform/checkpoint positions. Physics only starts
    // after resetGame has completed, so an unfinished stage can never swallow
    // the player on its first frame.
    buildRuntimeTerrain(STAGES[currentStage]);
    enemies = enemyBlueprints.map(makeEnemy);
    if(!STAGES[currentStage].maze)breakables=breakables.filter((wall)=>
      !enemies.some((enemy)=>Math.abs((enemy.x+enemy.w/2)-(wall.x+wall.w/2))<230)&&
      !hazards.some((hazard)=>Math.abs((hazard.x+hazard.w/2)-(wall.x+wall.w/2))<170));
    const initialFloor=surfaceAt(150,FLOOR_Y);
    const initialSpawn = safeSpawnNear(150,initialFloor?.y||FLOOR_Y);
    player = { x:initialSpawn.x, y:initialSpawn.y, w:PLAYER_W, h:PLAYER_H, vx:0, vy:0,
      grounded:!STAGES[currentStage].water, physicsReady:false, hp:3, maxHp:3, coins:0, score:0, invincible:0, state:'idle', anim:0,
      facing:1, jumpHeld:false, jumpCount:0, spin:0, justLanded:0, spawnX:initialSpawn.x, spawnY:initialSpawn.y, spawnCamera:0,
      checkpointHp:3, checkpointCoins:0, checkpointScore:0, checkpointCoinSpeed:0, dead:false, dash:100, boost:0, clearTime:0,
      healDelay:0, healTick:0, shields:0, shieldHit:0, hasSword:false, attackHeld:false, attackTime:0, attackCooldown:0,
      rushPulse:0, kingBossHitCooldown:0, previousY:initialSpawn.y, dropTimer:0, downHeld:false, chargeTime:0, coinSpeed:0,
      revivePose:0, clearMode:'normal' };
    droplets = [];
    coins = coinBlueprints.map(([x, y]) => ({ x, y, collected: false, phase: x / 30 }));
    items = itemBlueprints.map(([type,x,y]) => {
      const floor=STAGES[currentStage].water?null:surfaceAt(x,y+80);
      return {type,x,y:floor?floor.y-55:y,collected:false,phase:x/40};
    });
    confetti = [];
    buildSafeTransformPoints(STAGES[currentStage]);
    const initialModeSets = [
      ['battery','lcd','muscle'], ['lcd','battery','muscle'], ['muscle','lcd','battery'], ['battery','muscle','lcd'],
      ['lcd','king','muscle'], ['muscle','battery','lcd'], ['battery','lcd','muscle'], ['lcd','muscle','battery']
    ];
    const initialModes=initialModeSets[currentStage]||initialModeSets[0];
    transformItems = transformSpawnPoints.filter((_,index)=>index%Math.max(1,Math.floor(transformSpawnPoints.length/3))===0).slice(0,3).map(({x,y},index) => ({ x, y, w:64, h:70, type:initialModes[index%initialModes.length], collected:false, active:true, warning:0, phase:x/50 }));
    if(STAGES[currentStage].bossType==='titan'&&transformItems.length)transformItems[Math.min(1,transformItems.length-1)].type='king';
    transformSpawnTimer = 20 + Math.random()*15; transformHistory = transformItems.slice(-2).map(item=>item.type);
    modeParticles = [];
    playerMode = 'normal'; modeTimer = 0; slowMotion = 0; flightSoundTimer = 0;
    dust = [];
    sparks = [];
    afterimages = [];
    shieldShards=[]; rushTrails=[];
    checkpoints=buildCheckpoints(STAGES[currentStage]);
    const goalFloor=STAGES[currentStage].water?null:surfaceAt(WORLD_WIDTH-190,WORLD_HEIGHT-180);
    goal = { x:WORLD_WIDTH-190, y:STAGES[currentStage].water?280:(goalFloor?goalFloor.y-180:FLOOR_Y-180) };
    const stageBoss=STAGES[currentStage].bossType;
    boss = stageBoss ? (stageBoss==='shark'
      ? {type:'shark',name:'ABYSS MECHA SHARK',x:WORLD_WIDTH-760,y:235,w:300,h:170,hp:30,maxHp:30,vx:0,vy:0,alive:true,hit:0,phase:1,state:'dormant',timer:0,cooldown:1.55,grounded:false,intro:false,defeat:0,originY:235}
      : {type:'titan',name:'MEGA BUG TITAN',x:WORLD_WIDTH-720,y:FLOOR_Y-270,w:220,h:270,hp:24,maxHp:24,vx:0,vy:0,alive:true,hit:0,phase:1,state:'dormant',timer:0,cooldown:1.8,grounded:true,intro:false,defeat:0}) : null;
    // Both bosses telegraph the sword well before the arena gate so players can
    // learn ATTACK and enter the fight already armed.
    swordItem = stageBoss ? {x:WORLD_WIDTH-2350,y:stageBoss==='shark'?300:FLOOR_Y-85,w:42,h:58,collected:false} : null;
    bossGate = stageBoss ? {x:WORLD_WIDTH-1650,y:stageBoss==='shark'?92:FLOOR_Y-250,w:28,h:stageBoss==='shark'?620:250,closed:false} : null;
    projectiles=[]; shockwaves=[]; combatFx=[]; bossIntro=0; hitStop=0; bossDefeated=false; goalUnlocked=!boss;
    currents=STAGES[currentStage].water?Array.from({length:Math.ceil(WORLD_WIDTH/720)},(_,i)=>({x:500+i*720,y:130+(i%4)*120,w:390,h:150,force:(i%3===2?-1:1)*(90+(i%4)*35)})):[];
    bubbles=STAGES[currentStage].water?Array.from({length:Math.ceil(WORLD_WIDTH/590)},(_,i)=>({x:350+i*590,y:150+(i%4)*130,r:32,phase:i})):[];
    chaserWall=STAGES[currentStage].chaseWall?{x:-320,w:190,speed:76,maxSpeed:305,warning:0,warningCooldown:0}:null;
    oxygen=100; oxygenDamageTimer=0; ui.oxygenHud.classList.toggle('hidden',!STAGES[currentStage].water);
    document.body.classList.toggle('water-stage',!!STAGES[currentStage].water); document.body.classList.remove('king-mode');
    ui.bossName.textContent=boss?.name||'MEGA BUG TITAN';
    remainingTime = STAGES[currentStage].time || START_TIME;
    elapsed = 0;
    cameraX = 0;
    shake = 0;
    landingShake = 0;
    paused = false;
    player.physicsReady = true;
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
    const completedMode=player.clearMode||playerMode;
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
    const resultSources={normal:'./feni.png',battery:'./feni_battery.png',lcd:'./feni_lcd.png',king:'./feni_king.png',muscle:'./fenichan_gorimacho.png'};
    ui.resultFeni.src=resultSources[completedMode]||resultSources.normal;
    ui.resultFeni.alt=`${MODE_NAMES[completedMode]||'NORMAL MODE'}で喜ぶフェニちゃん`;
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

  const GOAL_LINES = {
    normal:'おいどんの勝利！！', battery:'体力万全！！', lcd:'合理的な結果やな',
    king:"I'm KING👑", muscle:'うおおおおお！！プロテイン！！'
  };

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function allPlatforms() { return staticPlatforms.concat(movingPlatforms, fragilePlatforms.filter((p) => p.active)); }
  function isOneWayPlatform(platform) {
    return !!platform.oneWay || (!platform.fixedWall && !platform.ceiling && platform.h <= 32) ||
      movingPlatforms.includes(platform) || fragilePlatforms.includes(platform);
  }

  function moveAndCollide(body, dt, isPlayer = false) {
    // Small swept steps keep LCD-speed movement from crossing thin platforms.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(body.vx * dt), Math.abs(body.vy * dt)) / 18));
    const step = dt / steps;
    body.grounded = false;
    for (let n = 0; n < steps; n += 1) {
      const oldX = body.x; const oldY = body.y; const oldBottom = oldY + body.h; const oldTop=oldY;
      body.x += body.vx * step;
      body.y += body.vy * step;
      for (const platform of allPlatforms()) {
        if (body.x + body.w <= platform.x || body.x >= platform.x + platform.w) continue;
        if(isPlayer&&body.dropTimer>0&&isOneWayPlatform(platform))continue;
        if (body.vy >= 0 && oldBottom <= platform.y + 7 && body.y + body.h >= platform.y) {
          body.y = platform.y - body.h; body.vy = 0; body.grounded = true;
          if (isPlayer && movingPlatforms.includes(platform)) { body.x += platform.x-platform.lastX; body.y += platform.y-platform.lastY; }
          if (isPlayer && fragilePlatforms.includes(platform) && !platform.timer) platform.timer = .001;
        } else if(body.vy<0 && oldTop>=platform.y+platform.h-7 && body.y<=platform.y+platform.h){
          if(isPlayer&&isOneWayPlatform(platform))continue;
          body.y=platform.y+platform.h;body.vy=0;
        }
      }
      for (const platform of allPlatforms()) {
        // Thin upper ledges are Mario-style one-way platforms: jump through
        // their underside/sides, then land safely on the top while falling.
        if(isPlayer&&isOneWayPlatform(platform))continue;
        const vertical = body.y + body.h > platform.y + 3 && body.y < platform.y + platform.h;
        if (!vertical) continue;
        const dashThrough=isPlayer&&(input.dashLeft||input.dashRight)&&Math.abs(body.vx)>280&&!platform.fixedWall&&
          ((platform.h<=32&&platform.w<=190)||fragilePlatforms.includes(platform));
        if(dashThrough){
          if(fragilePlatforms.includes(platform)){platform.active=false;platform.timer=1;shake=Math.max(shake,8);}
          continue;
        }
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
    player.shields = 0;
    player.attackTime = 0; player.attackCooldown = 0; player.attackHeld = false;
    document.body.classList.remove('king-mode');
    ui.shieldCount.className = 'shield-count hidden';
    ui.attack.classList.toggle('hidden', !player.hasSword); ui.attack.classList.remove('punch');
    ui.modeHud.className = 'mode-hud hidden';
    if (playSound) { sound('transformEnd'); say('NORMAL MODE'); }
  }

  function emitModeParticles(modeName, amount) {
    const colors = { normal:['#ff6a32','#ffd338'], battery: ['#54ff72', '#d8ff76'], lcd: ['#48eaff', '#ffffff'], king: ['#ffd338', '#ff8a20', '#fff7b0'], muscle:['#ff542f','#ffd338','#fff'] }[modeName]||['#fff','#ffd338'];
    for (let i = 0; i < amount; i += 1) modeParticles.push({
      x: player.x + player.w / 2 + (Math.random() - .5) * 80, y: player.y + player.h / 2 + (Math.random() - .5) * 110,
      vx: (Math.random() - .5) * 150, vy: -30 - Math.random() * 120, life: .45 + Math.random() * .65,
      size: 2 + Math.random() * (modeName === 'king' ? 7 : 4), color: colors[i % colors.length], digital: modeName === 'lcd'
    });
  }

  function applyMode(nextMode) {
    clearMode(false);
    playerMode = nextMode;
    modeTimer = MODE_DURATIONS[nextMode];
    slowMotion = 0;
    if (nextMode === 'battery') { player.healDelay = 0; player.healTick = 0; }
    if (nextMode === 'lcd') { player.shields = 2; player.shieldHit = 0; }
    if (nextMode === 'king') document.body.classList.add('king-mode');
    if (nextMode === 'muscle') { player.hp=Math.max(.5,player.hp);shake=28; landingShake=16; sound('punch'); shockwaves.push({x:player.x+player.w/2,y:player.y+player.h-18,w:22,vx:-260,life:.65,friendly:true},{x:player.x+player.w/2,y:player.y+player.h-18,w:22,vx:260,life:.65,friendly:true}); }
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
    applyMode(item.type);
  }

  function chooseTransformMode() {
    const last=transformHistory[transformHistory.length-1], repeated=transformHistory.length>=2&&last===transformHistory[transformHistory.length-2];
    const pool=repeated?TRANSFORM_WEIGHTS.filter(type=>type!==last):TRANSFORM_WEIGHTS;
    const chosen=pool[Math.floor(Math.random()*pool.length)]; transformHistory.push(chosen); transformHistory=transformHistory.slice(-3); return chosen;
  }

  function scheduleTransformSpawn() {
    transformItems=transformItems.filter((item)=>!item.collected);
    const usable=transformSpawnPoints.filter((point)=>{
      const box={x:point.x-160,y:point.y-100,w:320,h:200};
      return Math.abs(point.x-player.x)>Math.max(500,viewportWidth*.65)&&
        !enemies.some((enemy)=>enemy.alive&&overlap(box,enemy))&&!hazards.some((hazard)=>overlap(box,hazard))&&
        !breakables.some((wall)=>wall.alive&&overlap(box,wall));
    });
    if(!usable.length){transformSpawnTimer=4;return;}
    const point=usable[Math.floor(Math.random()*usable.length)];
    transformItems.push({x:point.x,y:point.y,w:64,h:70,type:chooseTransformMode(),collected:false,active:false,warning:1,phase:Math.random()*6});
    sound('itemWarning'); transformSpawnTimer=20+Math.random()*15;
  }

  function updateModeTimer(dt) {
    if (playerMode === 'normal') return;
    modeTimer = Math.max(0, modeTimer - dt);
    const rate = playerMode === 'king' ? 18 : 10;
    if (Math.floor(elapsed * rate) !== Math.floor((elapsed - dt) * rate)) emitModeParticles(playerMode, playerMode === 'king' ? 3 : 1);
    if (playerMode === 'king' && (input.jump||input.up||input.down||input.left||input.right)) {
      flightSoundTimer -= dt;
      if (flightSoundTimer <= 0) { sound('kingFlight'); flightSoundTimer = .55; }
    }
    if (playerMode === 'battery') {
      player.healDelay += dt;
      if (player.healDelay >= 1.5 && player.hp < player.maxHp) {
        player.healTick += dt;
        if (player.healTick >= .65) { player.healTick = 0; player.hp = Math.min(player.maxHp, player.hp + .25); sound('heal'); emitModeParticles('battery', 8); }
      }
    }
    if (modeTimer <= 0) clearMode(true);
  }

  function hurt(sourceX) {
    if (player.invincible > 0 || mode !== 'playing' || playerMode === 'king') return;
    if (playerMode === 'lcd' && player.shields > 0) {
      player.shields -= 1;
      player.invincible = .55;
      player.shieldHit = .45;
      shake = 10;
      sound('shieldBreak');
      for(let i=0;i<26;i++) shieldShards.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:(Math.random()-.5)*520,vy:(Math.random()-.5)*470,life:.45+Math.random()*.4,size:4+Math.random()*9});
      say(`SHIELD BREAK!\nSHIELD ×${player.shields}`);
      updateHud();
      return;
    }
    player.hp -= playerMode === 'battery' ? .5 : playerMode === 'muscle' ? player.maxHp*.5 : 1;
    player.hp=Math.max(0,player.hp);
    player.healDelay = 0; player.healTick = 0;
    player.invincible = 1.6;
    const knockback = playerMode === 'muscle' ? .28 : playerMode === 'battery' ? .52 : 1;
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
    player.hp = Math.max(2,player.checkpointHp);
    player.coins = player.checkpointCoins;
    player.score = player.checkpointScore;
    player.coinSpeed = player.checkpointCoinSpeed;
    player.dead = false;
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.previousY = player.spawnY;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 1.8;
    player.jumpCount = 0;
    player.spin = 0;
    player.revivePose = 1.6;
    cameraX = player.spawnCamera;
    droplets = [];
    if(chaserWall)chaserWall.x=Math.max(-320,player.spawnX-760);
    if (STAGES[currentStage].water) oxygen = 100;
    say(`${message}\n何度でも蘇る！！`);
    sound('revive');
    for(let i=0;i<26;i++)combatFx.push({x:player.x+player.w/2+(Math.random()-.5)*90,y:player.y+player.h/2+(Math.random()-.5)*120,life:.55+Math.random()*.45,size:18+Math.random()*22,type:'gold'});
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
    const punch = playerMode === 'muscle'&&!player.hasSword;
    player.attackTime = punch ? .86 : SWORD_ATTACK_DURATION; player.attackCooldown = punch ? 1.08 : .48;
    player.rushPulse = punch ? .86 : 0;
    const range = punch ? Math.max(260,Math.min(1120,viewportWidth*.72)) : 105;
    const contactRange = punch ? 155 : range;
    const front=player.facing>0?player.x+player.w:player.x;
    const hitbox={x:player.facing>0?front-4:front-contactRange+4,y:player.y+28,w:contactRange,h:44};
    sound(punch?'rushPunch':'attack');sound(punch?'punchHit':'sword');
    if (punch || playerMode !== 'normal') combatFx.push({x:punch?front+player.facing*range*.62:player.facing>0?hitbox.x+range:hitbox.x,y:hitbox.y+22,life:punch?.48:.25,size:range,type:punch?'punch':'slash'});
    if(punch){
      shake=28;hitStop=.045;slowMotion=.08;
      for(let i=0;i<42;i++){
        const depth=Math.random()*Math.min(range*.55,420);
        rushTrails.push({x:front+player.facing*depth,y:player.y+22+Math.random()*70,vx:player.facing*(420+Math.random()*720),life:.22+Math.random()*.3,delay:i*.012,size:14+Math.random()*24,facing:player.facing});
        sparks.push({x:front+player.facing*Math.random()*range*.4,y:player.y+30+Math.random()*60,vx:player.facing*(260+Math.random()*760),vy:(Math.random()-.5)*520,life:.25+Math.random()*.42,size:3+Math.random()*8});
      }
      shockwaves.push({kind:'rush',x:front,y:player.y+player.h*.53,w:42,h:94,vx:player.facing*1480,life:range/1480+.12,friendly:true,
        originX:front,maxDistance:range,damage:900,bossDamage:5,breaksWalls:true,hitEnemies:new Set(),bossHit:false});
    }else{
      const slashRange=Math.max(360,Math.min(820,viewportWidth*.62));
      shake=Math.max(shake,12);hitStop=.025;
      combatFx.push({x:front+player.facing*68,y:player.y+player.h*.52,life:.34,size:120,type:'slash'});
      for(let i=0;i<24;i++)sparks.push({x:front+player.facing*Math.random()*115,y:player.y+18+Math.random()*82,
        vx:player.facing*(210+Math.random()*640),vy:(Math.random()-.6)*390,life:.22+Math.random()*.38,size:3+Math.random()*7});
      shockwaves.push({kind:'slash',x:front,y:player.y+player.h*.54,w:34,h:112,vx:player.facing*1180,life:slashRange/1180+.14,friendly:true,
        originX:front,maxDistance:slashRange,damage:650,bossDamage:1,breaksWalls:true,hitEnemies:new Set(),bossHit:false});
    }
    if (boss?.alive && overlap(hitbox,{x:boss.x,y:boss.y+70,w:boss.w,h:boss.h-70})) damageBoss(punch?6:2,punch?360:70);
    for(const enemy of enemies) if(enemy.alive&&overlap(hitbox,enemy)){enemy.vx=player.facing*780;enemy.x+=player.facing*45;defeatEnemy(enemy,punch?'muscle':'normal');if(punch){hitStop=.085;shake=28;}}
  }

  function updatePlayer(dt) {
    if (player.dead || !player.physicsReady) return;
    player.previousY=player.y;
    player.invincible = Math.max(0, player.invincible - dt);
    player.shieldHit = Math.max(0,player.shieldHit-dt);
    player.kingBossHitCooldown = Math.max(0,player.kingBossHitCooldown-dt);
    player.justLanded = Math.max(0, player.justLanded - dt);
    player.attackCooldown=Math.max(0,player.attackCooldown-dt); player.attackTime=Math.max(0,player.attackTime-dt);
    player.rushPulse=Math.max(0,player.rushPulse-dt);
    player.dropTimer=Math.max(0,player.dropTimer-dt);
    player.revivePose=Math.max(0,player.revivePose-dt);
    if(player.rushPulse>0&&Math.floor(player.rushPulse*24)!==Math.floor((player.rushPulse+dt)*24)){
      const front=player.facing>0?player.x+player.w:player.x;
      for(let i=0;i<4;i++) rushTrails.push({x:front+player.facing*Math.random()*95,y:player.y+24+Math.random()*66,vx:player.facing*(580+Math.random()*650),life:.18+Math.random()*.18,delay:0,size:16+Math.random()*22,facing:player.facing});
      shake=Math.max(shake,13);
    }
    if(input.attack&&!player.attackHeld) performAttack();
    player.attackHeld=input.attack;
    const dashDirection = Number(input.dashRight) - Number(input.dashLeft);
    const normalDirection = Number(input.right) - Number(input.left);
    const direction = dashDirection || normalDirection;
    const dashing = dashDirection !== 0;
    player.boost = Math.max(0, player.boost - dt);
    const canDash = dashing && player.dash > 0;
    player.dash = Math.max(0, Math.min(100, player.dash + (canDash ? -38 : 24) * dt));
    const coinSpeedBonus=Math.min(95,player.coinSpeed||0);
    const speedScale = playerMode === 'lcd' ? 1.42 : playerMode === 'battery' ? 1.08 : playerMode === 'king' ? 1.55 : 1;
    const dashSpeed = (playerMode === 'lcd' ? 655 : player.boost ? 610 : playerMode === 'king' ? 760 : 455)+coinSpeedBonus*.72;
    const targetSpeed = direction * (canDash ? dashSpeed : 245 * speedScale+coinSpeedBonus);
    if (canDash && Math.floor(elapsed * 9) !== Math.floor((elapsed-dt)*9)) sound('dash');
    const acceleration = (player.grounded ? 1900 : 1050) * (playerMode === 'lcd' ? 1.48 : playerMode === 'king' ? 1.7 : 1);
    player.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - player.vx));
    if (!direction && player.grounded) player.vx *= Math.pow(playerMode === 'lcd' ? .00002 : .0008, dt);
    if (direction) player.facing = direction;

    const wantsDrop=input.down&&!input.up&&!input.jump;
    if(wantsDrop&&!player.downHeld&&!STAGES[currentStage].water&&playerMode!=='king'){
      const support=allPlatforms().find((platform)=>isOneWayPlatform(platform)&&player.x+player.w>platform.x&&player.x<platform.x+platform.w&&Math.abs(player.y+player.h-platform.y)<10);
      if(support){player.dropTimer=.28;player.y+=12;player.vy=120;player.grounded=false;sound('drop');}
    }
    player.downHeld=wantsDrop;
    const charging=wantsDrop&&player.grounded&&!direction&&!input.attack&&player.dropTimer<=0&&playerMode!=='king';
    if(charging){player.chargeTime+=dt;player.dash=Math.min(100,player.dash+72*dt);player.vx*=Math.pow(.001,dt);if(Math.floor(player.chargeTime*5)!==Math.floor((player.chargeTime-dt)*5)){sound('charge');emitModeParticles(playerMode==='normal'?'battery':playerMode,3);}}
    else player.chargeTime=0;

    if (STAGES[currentStage].water) {
      const vertical=Number(input.down)-Number(input.up||input.jump); player.jumpHeld=input.jump||input.up;
      player.grounded=false; player.vy+=(vertical*(canDash?430:245)-player.vy)*Math.min(1,dt*5); player.vy*=Math.pow(.72,dt);
    } else if (playerMode === 'king') {
      const vertical=Number(input.down)-Number(input.up||input.jump);
      player.jumpHeld = input.jump||input.up;
      player.grounded = false;
      player.vy += (vertical*(canDash?720:480)-player.vy)*Math.min(1,dt*(vertical?7:4.5));
      player.vy = Math.max(-720,Math.min(720,player.vy));
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
    if(STAGES[currentStage].water){moveAndCollide(player,dt,true);player.grounded=false;player.y=Math.max(92,Math.min(WORLD_HEIGHT-player.h-30,player.y));}else moveAndCollide(player, dt, true);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));
    if (!wasGrounded && player.grounded) {
      player.jumpCount = 0; player.spin = 0; player.justLanded = .16; landingShake = 5;
      spawnDust(player.x + player.w / 2, player.y + player.h, 6);
      if (playerMode === 'muscle') { shake=10; sound('stomp'); shockwaves.push({x:player.x+player.w/2,y:player.y+player.h-20,w:16,vx:-180,life:.45,friendly:true},{x:player.x+player.w/2,y:player.y+player.h-20,w:16,vx:180,life:.45,friendly:true}); }
    }
    for (const pad of jumpPads) {
      if (player.vy >= 0 && player.x + player.w > pad.x && player.x < pad.x + pad.w && player.y + player.h >= pad.y && player.y + player.h <= pad.y + 24) {
        player.y = pad.y - player.h; player.vy = JUMP_PAD_VELOCITY; player.grounded = false; player.jumpCount = 0;
        spawnDust(player.x + player.w / 2,pad.y,16); shake=Math.max(shake,9); sound('jump'); say('ULTRA JUMP!');
      }
    }
    if (playerMode === 'king') { player.y=Math.max(35,Math.min(WORLD_HEIGHT-player.h-35,player.y)); if(player.y<=35)player.vy=Math.max(0,player.vy); }
    if (player.y > WORLD_HEIGHT + 180) respawnAfterFall();

    const speed = Math.abs(player.vx);
    if (player.justLanded) player.state = 'land';
    else if (!player.grounded) player.state = player.vy < 0 ? (player.jumpCount === 2 ? 'doubleJump' : 'jump') : 'fall';
    // Lock the dash pose as soon as acceleration starts. Crossing the old
    // 300px/s threshold every frame caused normal/walk/dash sprites to flicker.
    else if (canDash && speed > 80) player.state = 'dash';
    else if (speed > 30) player.state = 'walk';
    else player.state = 'idle';
    player.anim += dt * (player.state === 'dash' ? 15 : player.state === 'walk' ? 9 : 3) * (playerMode === 'lcd' ? 1.7 : 1);
    if (player.grounded && speed > 100 && Math.floor(player.anim * 2) !== Math.floor((player.anim - dt * 9) * 2)) spawnDust(player.x, player.y + player.h, dashing ? 3 : 1);
    if (playerMode === 'lcd' && Math.floor(elapsed*16) !== Math.floor((elapsed-dt)*16)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.28,lcd:true,mode:playerMode,state:player.state});
    if (canDash) { shake = Math.max(shake, 2.5); if (Math.floor(elapsed*18) !== Math.floor((elapsed-dt)*18)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.18,mode:playerMode,state:player.state}); }
  }

  function updateBoss(dt) {
    if (!boss) return;
    if (!boss.intro && player.x > bossGate.x) {
      boss.intro=true; bossIntro=.001; bossGate.closed=true;
      ui.bossHud.classList.remove('hidden');
      say(player.hasSword?'WARNING!!\nおいどんが諦めるのを諦めろ！！':'WARNING!!'); window.setTimeout(()=>{if(mode==='playing')say('BOSS BATTLE');},900); window.RepairHeroSound?.music('boss');
    }
    if (boss.defeat) {
      boss.defeat += dt;
      if (boss.defeat > .55 && boss.defeat-dt <= .55) { shake=35; for(let i=0;i<12;i++) combatFx.push({x:boss.x+Math.random()*boss.w,y:boss.y+Math.random()*boss.h,life:.8,size:80,type:'explosion'}); say('BOSS DEFEATED!!'); }
      if (boss.defeat > 1.7 && bossGate.closed) { bossGate.closed=false; ui.goalLock.textContent='GOAL UNLOCKED!!'; ui.goalLock.classList.add('unlocked'); say('GOAL UNLOCKED!!'); window.RepairHeroSound?.music('game'); }
      return;
    }
    if (!boss.intro || !boss.alive) return;
    boss.hit=Math.max(0,boss.hit-dt); boss.timer+=dt; boss.cooldown-=dt;
    if(boss.type==='shark'){
      const left=WORLD_WIDTH-1500,right=WORLD_WIDTH-280-boss.w;
      if(boss.state==='dormant'){boss.state='swim';boss.timer=0;}
      if(boss.state==='swim'){
        const speed=boss.phase===2?210:145;boss.vx+=(Math.sign(player.x-boss.x)*speed-boss.vx)*Math.min(1,dt*2.8);
        boss.y=boss.originY+Math.sin(elapsed*(boss.phase===2?2.8:1.8))*125;
        if(boss.cooldown<=0){boss.state=Math.floor(boss.timer)%2?'torpedo':'charge';boss.timer=0;boss.cooldown=boss.phase===2?1.0:1.55;boss.vx=0;}
      }else if(boss.state==='torpedo'){
        if(boss.timer>.42&&boss.timer-dt<=.42){
          for(let angle=-1;angle<=1;angle++){const dx=player.x-boss.x,dy=player.y-boss.y+angle*125,len=Math.hypot(dx,dy)||1;projectiles.push({kind:'torpedo',x:boss.x,y:boss.y+boss.h*.48,w:30,h:18,vx:dx/len*390,vy:dy/len*390,life:4});}sound('bossShot');
        }
        if(boss.timer>1.05){boss.state='swim';boss.timer=0;}
      }else if(boss.state==='charge'){
        if(boss.timer<.55)boss.vx=0;else boss.vx=Math.sign(player.x-boss.x)*(boss.phase===2?620:470);
        if(boss.timer>1.18){boss.state='swim';boss.timer=0;}
      }
      boss.x=Math.max(left,Math.min(right,boss.x+boss.vx*dt));boss.y=Math.max(105,Math.min(WORLD_HEIGHT-boss.h-75,boss.y));
      const head={x:boss.x,y:boss.y+15,w:boss.w*.45,h:boss.h*.7};const body={x:boss.x+boss.w*.35,y:boss.y,w:boss.w*.65,h:boss.h};
      if(playerMode==='king'&&(overlap(player,head)||overlap(player,body))){if(player.kingBossHitCooldown<=0&&damageBoss(2,190))player.kingBossHitCooldown=.48;}
      else if(overlap(player,head)&&player.vy>80&&player.y+player.h*.75<head.y+head.h*.7){if(damageBoss(playerMode==='muscle'?3:1,70))player.vy=-570;}
      else if(overlap(player,head)||overlap(player,body))hurt(boss.x+boss.w/2);
      return;
    }
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
    if(playerMode==='king'&&(overlap(player,head)||overlap(player,body))){
      if(player.kingBossHitCooldown<=0&&damageBoss(2,190)){player.kingBossHitCooldown=.48;boss.vx+=player.facing*190;combatFx.push({x:boss.x+boss.w/2,y:boss.y+boss.h/2,life:.48,size:95,type:'gold'});}
    }else if(overlap(player,head)&&player.vy>0&&player.y+player.h<=head.y+42){if(damageBoss(playerMode==='muscle'?3:1,60))player.vy=-570;}
    else if(overlap(player,body)||overlap(player,head)) hurt(boss.x+boss.w/2);
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (!enemy.alive) { enemy.squish -= dt; continue; }
      enemy.phase += dt;
      enemy.cooldown -= dt;
      enemy.attackCooldown-=dt;
      const previousAttackCharge=enemy.attackCharge;
      enemy.attackCharge=Math.max(0,enemy.attackCharge-dt);
      if(enemy.behavior!=='charger')enemy.warning=Math.max(0,enemy.warning-dt);
      if(enemy.flying){
        if(enemy.behavior==='jelly'){
          enemy.x=enemy.originX+Math.sin(enemy.phase*.7)*55;enemy.y=enemy.originY+Math.sin(enemy.phase*1.7)*62;
        }else{
          if(Math.abs(enemy.x-enemy.originX)>165)enemy.vx*=-1;
          enemy.x+=enemy.vx*dt;enemy.y=enemy.originY+Math.sin(enemy.phase*(enemy.behavior==='flyer'?2.5:1.5))*42;
        }
      }else{
        enemy.vy=Math.min(MAX_FALL,enemy.vy+GRAVITY*dt);
        if(enemy.behavior==='walker'&&Math.abs(enemy.x-enemy.originX)>135)enemy.vx*=-1;
        if(enemy.behavior==='hopper'&&enemy.grounded&&enemy.cooldown<=0){enemy.vy=-530;enemy.vx=player.x<enemy.x?-enemy.speed:enemy.speed;enemy.cooldown=2.05;}
        if(enemy.behavior==='charger'){
          if(enemy.cooldown<=0&&Math.abs(player.x-enemy.x)<720){enemy.warning=.5;enemy.cooldown=2.45;}
          if(enemy.warning>0){enemy.warning-=dt;if(enemy.warning<=0)enemy.vx=Math.sign(player.x-enemy.x)*enemy.speed*4.5;}
          else if(Math.abs(enemy.x-enemy.originX)>190)enemy.vx=-Math.sign(enemy.x-enemy.originX)*enemy.speed*.55;
        }
        if(enemy.behavior==='shooter'&&Math.abs(enemy.x-enemy.originX)>90)enemy.vx*=-1;
        moveAndCollide(enemy,dt);
      }
      if(enemy.behavior==='shooter'&&enemy.cooldown<=0&&Math.abs(player.x-enemy.x)<720){
        const dx=player.x-enemy.x,dy=player.y-enemy.y,len=Math.hypot(dx,dy)||1;
        droplets.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h*.35,w:18,h:18,vx:dx/len*245,vy:dy/len*245,energy:true});
        enemy.cooldown=enemy.flying?2.05:2.45;enemy.warning=.35;
      }
      // Every enemy family owns an additional, telegraphed attack. The warning
      // precedes the shot/charge so larger sprites never become unfair hazards.
      if(enemy.attackCooldown<=0&&Math.abs(player.x-enemy.x)<760){enemy.attackCharge=.42;enemy.attackCooldown=2.8+(enemy.x%5)*.15;enemy.warning=Math.max(enemy.warning,.42);}
      if(previousAttackCharge>0&&enemy.attackCharge<=0){
        const cx=enemy.x+enemy.w/2,cy=enemy.y+enemy.h*.42,dx=player.x+player.w/2-cx,dy=player.y+player.h/2-cy,len=Math.hypot(dx,dy)||1;
        const addShot=(vx,vy,w=20,h=20,kind=enemy.attack)=>droplets.push({x:cx,y:cy,w,h,vx,vy,energy:true,kind});
        if(enemy.attack==='spread'){for(let angle=-1;angle<=1;angle++)addShot(dx/len*260,dy/len*260+angle*105,20,20,'spread');}
        else if(enemy.attack==='burst'){for(let angle=-1;angle<=1;angle++)addShot((dx/len*220)+angle*85,-260+Math.abs(angle)*60,18,18,'burst');}
        else if(enemy.attack==='drillWave')shockwaves.push({kind:'enemyDrill',x:cx,y:enemy.y+enemy.h-8,w:18,h:34,vx:Math.sign(dx)*360,life:1.15,friendly:false});
        else if(enemy.attack==='electric'){for(let angle=-2;angle<=2;angle++)addShot(Math.cos(angle*.45)*230,Math.sin(angle*.45)*230,16,16,'electric');}
        else if(enemy.attack==='bite'){enemy.vx=Math.sign(dx)*enemy.speed*3.8;}
        else if(enemy.attack==='missile'||enemy.attack==='torpedo')addShot(dx/len*330,dy/len*330,28,16,enemy.attack);
        else addShot(dx/len*280,dy/len*280,20,20,enemy.attack||'bolt');
        sound('enemyAttack');
      }

      const dashHit=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>300;
      if (overlap(player, enemy) && (playerMode === 'king'||dashHit)) {
        enemy.vx=player.facing*(playerMode==='king'?980:760);
        defeatEnemy(enemy,playerMode==='king'?'king':'dash',750); emitModeParticles(playerMode==='king'?'king':'lcd',18);
      } else if (overlap(player, enemy) && player.invincible <= 0) {
        const playerBottom = player.y + player.h;
        const previousBottom=(player.previousY??player.y)+player.h;
        const crossedEnemyTop=previousBottom<=enemy.y+Math.max(28,enemy.h*.48)&&playerBottom>=enemy.y;
        const playerIsAbove=player.y+player.h*.72<=enemy.y+enemy.h*.68;
        if (player.vy > 55 && crossedEnemyTop && playerIsAbove) {
          player.y=Math.min(player.y,enemy.y-player.h+3);
          defeatEnemy(enemy,'normal',500); player.vy = -520;player.grounded=false;player.jumpCount=1;
          spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h, 9); sound('stomp');
        } else hurt(enemy.x + enemy.w / 2);
      }
    }

    for (const drop of droplets) {
      if(!drop.energy||drop.kind==='burst')drop.vy += GRAVITY * .45 * dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt;
      if (overlap(player, drop)) { drop.dead = true; if(playerMode !== 'king') hurt(drop.x); }
      if (drop.y > WORLD_HEIGHT + 30||drop.y<-80) drop.dead = true;
    }
    droplets = droplets.filter((drop) => !drop.dead && Math.abs(drop.x - cameraX) < 1500);
    updateBoss(dt);
  }

  function defeatEnemy(enemy, style='normal', points=500) {
    if(!enemy.alive)return; enemy.alive=false; enemy.squish=.45; player.score+=scoreValue(points);
    const type=style==='king'?'gold':style==='lcd'?'speed':style==='muscle'?'fire':style==='sword'?'slash':'explosion';
    combatFx.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,life:.65,size:style==='muscle'?110:65,type,points:scoreValue(points)});
    for(let i=0;i<14;i++)sparks.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,vx:(Math.random()-.5)*(style==='muscle'?700:360),vy:(Math.random()-.7)*400,life:.35+Math.random()*.35,size:3+Math.random()*5});
    sound(style==='muscle'?'punchHit':style==='king'?'kingHit':style==='sword'?'swordHit':'enemyDown');
  }

  function hazardIsActive(hazard){
    if(hazard.type==='fire')return (elapsed*1.25+hazard.phase)%2.4>.62;
    if(hazard.type==='electric')return (elapsed*1.7+hazard.phase)%2.1>.72;
    return true;
  }

  function updateObjects(dt) {
    if(swordItem&&!swordItem.collected&&overlap(player,swordItem)){swordItem.collected=true;player.hasSword=true;ui.attack.classList.remove('hidden');say('PHOENIX SWORD GET!!\n⚔ ATTACK');sound('swordGet');}
    projectiles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(overlap(player,p)){p.life=0;hurt(p.x);}});projectiles=projectiles.filter(p=>p.life>0);
    for(const wave of shockwaves){
      const oldX=wave.x;
      const attackWave=wave.kind==='rush'||wave.kind==='slash';
      const maxWaveWidth=wave.kind==='rush'?150:wave.kind==='slash'?120:80;
      const waveGrowth=wave.kind==='rush'?230:wave.kind==='slash'?180:90;
      wave.x+=wave.vx*dt;wave.w=Math.min(maxWaveWidth,wave.w+waveGrowth*dt);wave.life-=dt;
      const waveBox={x:Math.min(oldX,wave.x)-wave.w,y:wave.y-(wave.h||28)/2,w:Math.abs(wave.x-oldX)+wave.w*2,h:wave.h||28};
      if(!wave.friendly&&overlap(player,waveBox)){wave.life=0;hurt(wave.x);continue;}
      if(attackWave){
        const direction=Math.sign(wave.vx)||1;
        const blockers=[...staticPlatforms.filter((platform)=>platform.fixedWall),
          ...breakables.filter((wall)=>wall.alive&&wall.fixed),...(bossGate?.closed?[bossGate]:[])];
        const boxRight=waveBox.x+waveBox.w;
        const blocking=blockers.filter((blocker)=>
          blocker.y+blocker.h>waveBox.y&&blocker.y<waveBox.y+waveBox.h&&
          (direction>0?blocker.x+blocker.w>=oldX&&blocker.x<=boxRight:blocker.x<=oldX&&blocker.x+blocker.w>=waveBox.x))
          .sort((a,b)=>direction>0?a.x-b.x:(b.x+b.w)-(a.x+a.w))[0];
        const effectiveBox={...waveBox};
        if(blocking){
          if(direction>0) effectiveBox.w=Math.max(0,Math.min(boxRight,blocking.x)-effectiveBox.x);
          else {const right=boxRight;effectiveBox.x=Math.max(effectiveBox.x,blocking.x+blocking.w);effectiveBox.w=Math.max(0,right-effectiveBox.x);}
        }
        for(const enemy of enemies){
          if(!enemy.alive||wave.hitEnemies.has(enemy)||!overlap(effectiveBox,enemy))continue;
          const rush=wave.kind==='rush';
          wave.hitEnemies.add(enemy);enemy.vx=direction*(rush?980:760);enemy.x+=direction*(rush?60:34);
          defeatEnemy(enemy,rush?'muscle':'sword',wave.damage||(rush?900:650));
          hitStop=Math.max(hitStop,rush ? .065 : .038);shake=Math.max(shake,rush ? 26 : 17);
        }
        for(const wall of breakables){
          if(!wall.alive||wall.fixed||!wave.breaksWalls||!overlap(effectiveBox,wall))continue;
          wall.alive=false;player.score+=350;shake=Math.max(shake,22);
          combatFx.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,life:.7,size:90,type:wave.kind==='rush'?'fire':'slash'});
          for(let i=0;i<18;i++)sparks.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,vx:Math.sign(wave.vx)*(160+Math.random()*620),vy:(Math.random()-.5)*480,life:.35+Math.random()*.45,size:4+Math.random()*8});
        }
        if(boss?.alive&&!wave.bossHit&&overlap(effectiveBox,{x:boss.x,y:boss.y+40,w:boss.w,h:boss.h-40})){
          const rush=wave.kind==='rush';
          wave.bossHit=true;damageBoss(wave.bossDamage||(rush?5:1),rush?390:110);
          hitStop=Math.max(hitStop,rush ? .12 : .055);shake=Math.max(shake,rush ? 32 : 18);
        }
        if(blocking){
          combatFx.push({x:direction>0?blocking.x:blocking.x+blocking.w,y:wave.y,life:.35,size:62,type:wave.kind==='rush'?'fire':'slash'});
          shake=Math.max(shake,wave.kind==='rush'?18:11);wave.life=0;continue;
        }
        if(Math.abs(wave.x-wave.originX)>=wave.maxDistance)wave.life=0;
      }
    }
    shockwaves=shockwaves.filter(p=>p.life>0);
    combatFx.forEach(p=>p.life-=dt);combatFx=combatFx.filter(p=>p.life>0);
    const activeDash=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>280;
    for(const wall of breakables){if(!wall.alive||!overlap(player,wall))continue;if(activeDash){wall.alive=false;shake=13;player.score+=250;for(let i=0;i<12;i++)sparks.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,vx:(Math.random()-.5)*360,vy:(Math.random()-.5)*300,life:.5,size:6});}else{player.x=player.vx>0?wall.x-player.w:wall.x+wall.w;player.vx=0;}}
    if(STAGES[currentStage].water){
      oxygen=Math.max(0,oxygen-dt*2.4); if(oxygen<=0){oxygenDamageTimer+=dt;if(oxygenDamageTimer>=1.2){oxygenDamageTimer=0;hurt(player.x);}}else oxygenDamageTimer=0;
      currents.forEach(c=>{if(overlap(player,c))player.vx+=c.force*dt;});
      bubbles.forEach(b=>{b.phase+=dt*2;if(overlap(player,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){oxygen=Math.min(100,oxygen+42*dt);}});
    }
    if(chaserWall){
      const progress=Math.max(0,Math.min(1,player.x/WORLD_WIDTH));
      chaserWall.speed=76+(chaserWall.maxSpeed-76)*Math.pow(progress,1.45);
      chaserWall.x+=chaserWall.speed*dt;
      chaserWall.warningCooldown-=dt;
      const distance=player.x-(chaserWall.x+chaserWall.w);
      chaserWall.warning=Math.max(0,1-distance/Math.max(240,viewportWidth*.42));
      if(chaserWall.warning>.35&&chaserWall.warningCooldown<=0){sound('wallWarning');chaserWall.warningCooldown=1.35;}
      if(!player.dead&&!player.clearTime&&distance<8){
        player.dead=true;player.hp=0;player.vx=0;player.vy=0;shake=36;sound('wallImpact');say('WALL CRUSHED!');
        window.setTimeout(()=>{if(mode==='playing')respawnAtCheckpoint('壁から再開！');},700);
      }
    }
    for (const platform of movingPlatforms) {
      platform.lastX = platform.x; platform.lastY = platform.y;
      const movement = Math.sin(elapsed * platform.speed) * platform.range;
      if (platform.axis === 'x') platform.x = platform.baseX + movement;
      else platform.y = platform.baseY + movement;
    }
    for (const platform of fragilePlatforms) {
      if (platform.kind === 'vanish') platform.active = Math.sin(elapsed * 1.7 + platform.x) > -.2;
      if (platform.kind === 'crumble' && platform.timer) {
        platform.timer += dt;
        if (platform.timer > .42 && !platform.warned) { platform.warned=true; sound('crumble'); }
        if (platform.timer > .72) platform.active = false;
        if (platform.timer > 3.2) { platform.timer=0; platform.active=true; platform.warned=false; }
      }
    }
    for (const rock of fallingHazards) {
      rock.delay -= dt;
      rock.warn = Math.max(0, Math.min(1, 1 - rock.delay / .75));
      if (rock.delay <= 0) { rock.warn=1; rock.vy += 900*dt; rock.y += rock.vy*dt; }
      if (overlap(player, rock)) hurt(rock.x);
      if (rock.y > rock.targetY+70) { rock.y=rock.baseY; rock.vy=0; rock.delay=2.8; rock.warn=0; }
    }
    for (const spike of hazards) if (hazardIsActive(spike)&&overlap(player, spike)) hurt(spike.x + spike.w/2);
    for (const coin of coins) {
      coin.phase += dt * 5;
      const hitbox = { x: coin.x - 13, y: coin.y - 13, w: 26, h: 26 };
      if (!coin.collected && overlap(player, hitbox)) {
        coin.collected = true; player.coins += 1; player.coinSpeed=Math.min(95,(player.coinSpeed||0)+2.25);player.score += scoreValue(100); sound('coin'); updateHud();
      }
    }
    transformSpawnTimer-=dt;
    const existing=transformItems.some(item=>!item.collected);
    if(transformSpawnTimer<=0){if(existing)transformSpawnTimer=4+Math.random()*4;else scheduleTransformSpawn();}
    for (const item of transformItems) {
      item.phase += dt * 3;
      if(!item.active){item.warning-=dt;if(item.warning<=0){item.active=true;sound('itemSpawn');}}
      if (!item.collected && item.active && overlap(player, { x: item.x - 32, y: item.y - 35, w: 64, h: 70 })) collectTransformItem(item);
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
      player.spawnX = checkpoint.respawnX ?? checkpoint.x + 35;
      player.spawnY = checkpoint.respawnY ?? checkpoint.y + 70 - PLAYER_H;
      player.spawnCamera = Math.max(0, cameraX);
      if(chaserWall)checkpoint.wallX=Math.max(-320,player.spawnX-760);
      player.score += scoreValue(1000);
      player.checkpointHp = player.hp; player.checkpointCoins = player.coins; player.checkpointScore = player.score; player.checkpointCoinSpeed=player.coinSpeed;
      if(STAGES[currentStage].water) oxygen=100;
      say('CHECK POINT');
      sound('checkpoint');
      for (let i = 0; i < 28; i += 1) sparks.push({ x: checkpoint.x + 35, y: checkpoint.y + 20, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: .8, size: 4 });
    }
    if (boss && bossDefeated && !bossGate.closed) goalUnlocked = true;
    if (!goalUnlocked && player.x + player.w > goal.x - 20) { player.x=goal.x-player.w-20; player.vx=Math.min(0,player.vx); if(bossIntro>.8)say('GOAL LOCKED\nボスを倒せ！'); }
    if (player.x + player.w > goal.x && !player.clearTime && goalUnlocked) {
      player.clearTime = .001;player.clearMode=playerMode; player.vx = 0; player.score += Math.ceil(remainingTime) * 25; sound('goal');
      say(`STAGE CLEAR!!\n${GOAL_LINES[playerMode]||GOAL_LINES.normal}`);
      for(let i=0;i<100;i+=1) confetti.push({x:cameraX+Math.random()*1280,y:-Math.random()*500,vx:(Math.random()-.5)*100,vy:100+Math.random()*180,life:4,color:['#ff3b20','#ffd338','#41d9ec','#fff'][i%4]});
    }
    if (player.clearTime) { player.clearTime += dt; player.state='clear'; player.x += ((cameraX + viewportWidth / 2 - player.w / 2) - player.x) * Math.min(1, dt * 3); player.y += Math.sin(player.clearTime*9)*50*dt; player.spin += dt*5; if(player.clearTime>2.6) setModeResult(true); }
    dust.forEach((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 130 * dt; particle.life -= dt; });
    dust = dust.filter((particle) => particle.life > 0);
    sparks.forEach((p) => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 420*dt; p.life -= dt; });
    sparks = sparks.filter((p) => p.life > 0);
    shieldShards.forEach((p)=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=520*dt;p.life-=dt;});
    shieldShards=shieldShards.filter((p)=>p.life>0);
    rushTrails.forEach((p)=>{p.delay-=dt;if(p.delay<=0){p.x+=p.vx*dt;p.life-=dt;}});
    rushTrails=rushTrails.filter((p)=>p.life>0);
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
    // Frame both fighters in the boss arena. The zoom is eased and changes the
    // real world viewport/camera range rather than scaling the DOM canvas.
    let targetScale = baseScale;
    if (portrait && boss?.alive && boss.intro) {
      const combatSpan = Math.abs((boss.x + boss.w/2) - (player.x + player.w/2)) + boss.w + 150;
      targetScale = Math.min(baseScale, width / Math.max(width/baseScale, combatSpan));
      targetScale = Math.max(height / 980, targetScale);
    }
    scale += (targetScale-scale)*Math.min(1,dt*4.5);
    viewportWidth=width/scale; viewportHeight=height/scale;
    const fast = Math.abs(player.vx) > 360 || playerMode === 'lcd';
    const leadLimit = viewportWidth*(fast ? .30 : .17);
    const lead = Math.max(-leadLimit,Math.min(leadLimit,player.vx*(fast ? .24 : .11)));
    const anchor = portrait ? (player.facing > 0 ? .29 : .71) : (player.facing > 0 ? .30 : .70);
    let focusX = player.x + lead - viewportWidth*anchor;
    if (boss?.alive && boss.intro && Math.abs(boss.x-player.x)<viewportWidth*1.25) focusX=(player.x+player.w/2+boss.x+boss.w/2)/2-viewportWidth/2;
    let targetCamera = Math.max(0, Math.min(Math.max(0,WORLD_WIDTH - viewportWidth), focusX));
    if(chaserWall)targetCamera=Math.max(targetCamera,Math.min(WORLD_WIDTH-viewportWidth,chaserWall.x+chaserWall.w-viewportWidth*.06));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * (playerMode === 'lcd' ? 10 : 7));
    const jumping=Math.abs(player.vy)>100;
    const verticalAnchor = playerMode==='king' ? .55 : player.vy < -100 ? .61 : player.vy > 180 ? .46 : .57;
    const verticalMargin=jumping?210:150;
    const maxCameraY=Math.max(300,WORLD_HEIGHT-viewportHeight+80);
    const targetCameraY = (portrait||STAGES[currentStage].maze) ? Math.max(-verticalMargin, Math.min(maxCameraY, player.y - viewportHeight*verticalAnchor)) : 0;
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
    const canPunch = playerMode === 'muscle' && !player.hasSword;
    ui.attack.textContent = canPunch ? '👊 RUSH\nPUNCH' : '⚔ ATTACK';
    ui.attack.classList.toggle('punch',canPunch);
    ui.attack.classList.toggle('hidden',!canPunch && !player.hasSword);
    if (playerMode !== 'normal') {
      ui.modeTimer.textContent = `${MODE_NAMES[playerMode]}  ${Math.ceil(modeTimer)}s`; ui.modeHud.classList.remove('hidden');
      const lcd=playerMode==='lcd';ui.shieldCount.classList.toggle('hidden',!lcd);
      if(lcd){ui.shieldCount.textContent=`SHIELD ×${player.shields}`;ui.shieldCount.classList.toggle('shield-one',player.shields===1);ui.shieldCount.classList.toggle('shield-zero',player.shields===0);}
    }
  }

  function drawRoundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(x,y,w,h,radius);
    else{const r=Math.min(radius,w/2,h/2);ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);}
    ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    const palettes={city:['#63cbe6','#d8f1dc','#f7d794'],underground:['#10152d','#36285a','#59463d'],sea:['#087fa9','#35c9dc','#b8f4df'],sky:['#287fd1','#9ce7ff','#fff2bd'],boss:['#451251','#b42d44','#ff9b43'],factory:['#161d2b','#38404b','#6e432f']};
    const palette=palettes[stageTheme]; sky.addColorStop(0,palette[0]); sky.addColorStop(.65,palette[1]); sky.addColorStop(1,palette[2]);
    ctx.fillStyle = sky; ctx.fillRect(-50, -200, Math.max(1380, viewportWidth+100), Math.max(WORLD_HEIGHT+300,viewportHeight+300));
    if(stageTheme==='underground'){ctx.fillStyle='#171126';for(let i=0;i<18;i++){const x=i*130-(cameraX*.16%130);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+65,90+(i%4)*45);ctx.lineTo(x+125,0);ctx.fill();}ctx.fillStyle='#69513d';ctx.fillRect(0,500,Math.max(1400,viewportWidth),WORLD_HEIGHT-420);ctx.fillStyle='#ffd23c';ctx.font='bold 20px Arial';ctx.fillText('UNDERGROUND MAZE  ↓ DEEP ZONE',40,150);return;}
    if(stageTheme==='sea'){ctx.fillStyle='#064e73aa';ctx.fillRect(0,0,Math.max(1400,viewportWidth),900);for(let i=0;i<28;i++){const x=(i*97-cameraX*.12)%1500,y=(i*83+elapsed*35)%760;ctx.strokeStyle='#b9fbff88';ctx.beginPath();ctx.arc(x,y,5+i%7,0,7);ctx.stroke();}ctx.fillStyle='#72e0c7';for(let i=0;i<10;i++)ctx.fillRect(i*180-(cameraX*.2%180),540+(i%2)*40,18,90);ctx.fillStyle='#d5ffff';ctx.font='bold 20px Arial';ctx.fillText('DEEP SEA REPAIR ROUTE',40,150);return;}
    if(stageTheme==='factory'){ctx.fillStyle='#151a24';for(let i=0;i<14;i++){const x=i*150-(cameraX*.2%150);ctx.fillStyle=i%2?'#2f3945':'#242b35';ctx.fillRect(x,160,110,470);ctx.strokeStyle='#ff9d2f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+20,190);ctx.lineTo(x+85,260);ctx.lineTo(x+20,330);ctx.stroke();}ctx.fillStyle='#ffcf36';ctx.font='bold 20px Arial';ctx.fillText('CRUSH FACTORY  → ESCAPE',40,145);return;}
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
    drawChaserWall();
    // Scenery is background art. Draw collision geometry and warnings after it
    // so shops, caves and wrecks can never hide spikes or warning markers.
    drawScenery();
    for (const platform of staticPlatforms) drawPlatform(platform);
    for (const platform of movingPlatforms) drawPlatform(platform, 'moving');
    fragilePlatforms.forEach((platform) => { if (platform.active) drawPlatform(platform, 'fragile'); });
    jumpPads.forEach(drawJumpPad);
    drawHazards();
    coins.forEach(drawCoin);
    items.forEach(drawItem);
    transformItems.forEach(drawTransformItem);
    checkpoints.forEach(drawCheckpoint);
    breakables.forEach(w=>{if(!w.alive)return;ctx.fillStyle='#8b5737';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeStyle='#ffd335';ctx.lineWidth=4;ctx.strokeRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.fillText('BREAK',w.x+5,w.y+42);});
    currents.forEach(c=>{ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=c.force>0?'#48eaff':'#83aaff';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.globalAlpha=.95;ctx.fillStyle='#efffff';ctx.shadowColor='#54eaff';ctx.shadowBlur=12;ctx.font='bold 30px Arial';for(let x=c.x+30;x<c.x+c.w;x+=80)ctx.fillText(c.force>0?'→':'←',x,c.y+c.h/2+Math.sin(elapsed*5+x)*8);ctx.restore();});
    bubbles.forEach(b=>{ctx.save();ctx.strokeStyle='#d7ffff';ctx.lineWidth=4;ctx.shadowColor='#a8ffff';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(b.x,b.y+Math.sin(b.phase)*12,b.r,0,7);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.fillText('O₂',b.x-9,b.y+4);ctx.restore();});
    drawGoal();
    if(swordItem&&!swordItem.collected){ctx.save();ctx.translate(swordItem.x+swordItem.w/2,swordItem.y+swordItem.h/2+Math.sin(elapsed*3)*8);ctx.rotate(.12*Math.sin(elapsed*2));ctx.shadowColor='#ff5a1f';ctx.shadowBlur=30;if(phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth)ctx.drawImage(phoenixSwordImage,-38,-64,76,114);ctx.restore();}
    if(bossGate?.closed){ctx.fillStyle='#ff3d31';ctx.shadowColor='#ff2c22';ctx.shadowBlur=18;for(let y=bossGate.y;y<FLOOR_Y;y+=34)ctx.fillRect(bossGate.x,y,bossGate.w,18);ctx.shadowBlur=0;}
    enemies.forEach(drawEnemy);
    if(boss?.intro && (boss.alive || boss.defeat<.7)) drawBoss();
    droplets.forEach(drawDroplet);
    projectiles.forEach(p=>{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.lineWidth=5;ctx.shadowBlur=18;
      if(p.kind==='torpedo'){ctx.fillStyle='#8defff';ctx.strokeStyle='#eaffff';ctx.shadowColor='#45dfff';ctx.beginPath();ctx.ellipse(0,0,p.w*.62,p.h*.55,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ff5b24';ctx.beginPath();ctx.moveTo(-p.w*.5,0);ctx.lineTo(-p.w*.95,-p.h*.55);ctx.lineTo(-p.w*.95,p.h*.55);ctx.closePath();ctx.fill();ctx.fillStyle='#d9ffff';for(let trail=1;trail<=3;trail++){ctx.globalAlpha=.8-trail*.18;ctx.beginPath();ctx.arc(-p.w*(.9+trail*.55),0,3+trail*2,0,7);ctx.fill();}}
      else{ctx.fillStyle='#ffef39';ctx.strokeStyle='#ff3028';ctx.shadowColor='#ff3028';ctx.beginPath();ctx.arc(0,0,p.w/2,0,7);ctx.fill();ctx.stroke();}ctx.restore();});
    shockwaves.forEach(p=>{
      ctx.save();const direction=Math.sign(p.vx)||1;
      if(p.kind==='slash'){
        ctx.translate(p.x,p.y);ctx.scale(direction,1);ctx.globalCompositeOperation='screen';
        ctx.shadowColor='#ff461c';ctx.shadowBlur=34;
        ctx.strokeStyle='#ff6a22';ctx.lineWidth=22;ctx.beginPath();ctx.arc(0,0,p.w+30,-1.08,1.08);ctx.stroke();
        ctx.strokeStyle='#fff9b0';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,p.w+18,-1.02,1.02);ctx.stroke();
        ctx.strokeStyle='#ffffff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,p.w+8,-.96,.96);ctx.stroke();
        ctx.strokeStyle='#ffb12b';ctx.lineWidth=5;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(-35,p.w*.16*i);ctx.lineTo(-120-i*17,p.w*.2*i);ctx.stroke();}
      }else{
        ctx.strokeStyle=p.kind==='rush'?'#fff169':p.friendly?'#ffdc35':'#ff3b29';ctx.shadowColor=p.kind==='rush'?'#ff4b16':ctx.strokeStyle;ctx.shadowBlur=p.kind==='rush'?35:12;ctx.lineWidth=p.kind==='rush'?14:9;
        for(let ring=0;ring<(p.kind==='rush'?3:1);ring++){ctx.globalAlpha=1-ring*.25;ctx.beginPath();ctx.arc(p.x-direction*ring*16,p.y,p.w+ring*24,Math.PI,Math.PI*2);ctx.stroke();}
        if(p.kind==='rush'){ctx.strokeStyle='#ff5a1f';ctx.lineWidth=6;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(p.x-direction*(45+i*8),p.y+i*17);ctx.lineTo(p.x-direction*(170+i*24),p.y+i*22);ctx.stroke();}}
      }
      ctx.restore();
    });
    rushTrails.forEach((p)=>{if(p.delay>0)return;ctx.save();ctx.globalAlpha=Math.min(1,p.life*4);ctx.translate(p.x,p.y);ctx.scale(p.facing,1);ctx.shadowColor='#ff401e';ctx.shadowBlur=24;ctx.strokeStyle='#fff36c';ctx.lineWidth=5;ctx.fillStyle='#ff7a26';ctx.beginPath();ctx.ellipse(0,0,p.size*1.25,p.size*.62,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff4a5';for(let i=0;i<4;i++)ctx.fillRect(p.size*.2+i*p.size*.23,-p.size*.55,p.size*.18,p.size*.38);ctx.strokeStyle='#ffb126';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-p.size*1.1,-p.size*.7);ctx.lineTo(-p.size*2.8,-p.size*.2);ctx.lineTo(-p.size*1.7,p.size*.15);ctx.lineTo(-p.size*3,p.size*.75);ctx.stroke();ctx.restore();});
    combatFx.forEach(p=>{ctx.save();ctx.globalAlpha=Math.min(1,p.life*3);const colors={gold:'#ffd335',speed:'#42eaff',fire:'#ff5425',explosion:'#ff7b25',slash:'#ffb12e',punch:'#ff4a1f'};ctx.strokeStyle=colors[p.type]||'#fff';ctx.fillStyle=colors[p.type]||'#ffd335';ctx.lineWidth=12;ctx.shadowColor=colors[p.type]||'#ff3b20';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-p.life*.35),0,7);['explosion','gold','fire'].includes(p.type)?ctx.fill():ctx.stroke();if(p.points){ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#fff';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(`+${p.points}`,p.x,p.y-45-(1-p.life)*25);}ctx.restore();});
    dust.forEach((particle) => { ctx.globalAlpha = particle.life * 1.8; ctx.fillStyle = '#dfc18a'; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    afterimages.forEach((ghost) => { if(ghost.lcd){ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='hue-rotate(135deg) saturate(2)';} drawFeniSprite(ghost.x, ghost.y, ghost.facing, 0, .28 * ghost.life / .28,ghost.mode,ghost.state); if(ghost.lcd)ctx.restore(); });
    sparks.forEach((p) => { ctx.globalAlpha=p.life*1.7; ctx.fillStyle=Math.random()>.5?'#ffec48':'#ff5a1f'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill(); });
    shieldShards.forEach((p)=>{ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle='#bffaff';ctx.strokeStyle='#3ddfff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-p.size);ctx.lineTo(p.x+p.size*.75,p.y+p.size*.5);ctx.lineTo(p.x-p.size*.65,p.y+p.size);ctx.closePath();ctx.fill();ctx.stroke();});
    ctx.globalAlpha = 1;
    confetti.forEach(p=>{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,8,14);});
    modeParticles.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; if (p.digital) ctx.fillRect(p.x, p.y, p.size * 2.2, p.size); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } });
    ctx.globalAlpha = 1;
    drawPlayer();
    ctx.restore();
  }

  function drawChaserWall(){
    if(!chaserWall)return;
    ctx.save();ctx.translate(chaserWall.x,0);ctx.shadowColor='#ff321f';ctx.shadowBlur=22+chaserWall.warning*35;
    ctx.fillStyle='#181b22';ctx.fillRect(0,-80,chaserWall.w,WORLD_HEIGHT+300);
    ctx.fillStyle='#4c1e1c';for(let y=-40;y<WORLD_HEIGHT+180;y+=86)ctx.fillRect(15,y,chaserWall.w-30,58);
    ctx.strokeStyle='#ff5a25';ctx.lineWidth=8;ctx.strokeRect(4,-70,chaserWall.w-8,WORLD_HEIGHT+260);
    ctx.fillStyle='#ffd63a';ctx.font='bold 44px Arial';ctx.textAlign='center';for(let y=80;y<WORLD_HEIGHT;y+=120)ctx.fillText('→',chaserWall.w/2,y);
    ctx.fillStyle='#fff';ctx.font='bold 15px Arial';ctx.fillText('CRUSH WALL',chaserWall.w/2,45);ctx.restore();
  }

  function drawBoss(){
    ctx.save();ctx.translate(boss.x+boss.w/2,boss.y+boss.h/2);ctx.shadowColor=boss.hit?'#fff':'#ff352d';ctx.shadowBlur=35;
    if(['charge','jump','shoot','slam','torpedo'].includes(boss.state)&&boss.timer<.65){ctx.globalAlpha=.65+.35*Math.sin(elapsed*28);ctx.strokeStyle='#fff13d';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,145,0,7);ctx.stroke();}
    if(boss.type==='shark'&&enemyImages.mechaShark.complete&&enemyImages.mechaShark.naturalWidth){
      if(boss.vx>0)ctx.scale(-1,1);const spriteW=boss.w*1.34,spriteH=boss.h*1.48;
      if(boss.phase===2)ctx.filter='saturate(1.55) contrast(1.15) hue-rotate(-12deg)';
      if(boss.hit)ctx.globalAlpha=.62+.38*Math.sin(elapsed*50);
      ctx.drawImage(enemyImages.mechaShark,-spriteW/2,-spriteH/2,spriteW,spriteH);ctx.filter='none';ctx.globalAlpha=1;
    }else if(bossImage.complete&&bossImage.naturalWidth){
      const spriteSize=Math.max(boss.w,boss.h)*1.28;
      if(boss.phase===2)ctx.filter='saturate(1.45) contrast(1.08)';
      if(boss.hit)ctx.globalAlpha=.62+.38*Math.sin(elapsed*50);
      ctx.drawImage(bossImage,-spriteSize/2,boss.h/2-spriteSize,spriteSize,spriteSize);
      ctx.filter='none';ctx.globalAlpha=1;
    }else{
      ctx.fillStyle=boss.hit?'#fff':'#59204f';drawRoundedRect(-95,-115,190,230,28);ctx.fillStyle='#111d32';ctx.fillRect(-68,-82,136,122);
      ctx.strokeStyle='#ff5544';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-45,-45);ctx.lineTo(20,20);ctx.lineTo(-5,70);ctx.moveTo(20,20);ctx.lineTo(55,-55);ctx.stroke();
      ctx.fillStyle='#ffdb32';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('MEGA BUG',0,104);
    }
    ctx.restore();
    ctx.fillStyle='#180c22';ctx.fillRect(boss.x,boss.y-28,boss.w,14);ctx.fillStyle='#ff493e';ctx.fillRect(boss.x,boss.y-28,boss.w*(boss.hp/boss.maxHp),14);
  }

  function drawPlatform(platform, kind = 'safe') {
    if (platform.x + platform.w < cameraX - 80 || platform.x > cameraX + 1360) return;
    const moving=kind==='moving', fragile=kind==='fragile';
    let jitter=0;if(fragile&&platform.timer)jitter=Math.sin(elapsed*55)*Math.min(5,platform.timer*9);
    ctx.save();ctx.translate(jitter,0);
    ctx.fillStyle = moving ? '#244f60' : fragile ? '#6b4540' : '#4d4c43'; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.strokeStyle=moving?'#65efff':fragile?'#ff6a4a':'#d9bd7c';ctx.lineWidth=3;ctx.strokeRect(platform.x,platform.y,platform.w,platform.h);
    ctx.fillStyle = moving ? '#45e5ff' : fragile ? '#e96a43' : '#9a8159'; ctx.fillRect(platform.x, platform.y, platform.w, Math.min(14, platform.h));
    ctx.fillStyle = fragile&&platform.timer>.42&&Math.floor(elapsed*14)%2?'#fff':'#d8b76f';
    for (let x = platform.x + 8; x < platform.x + platform.w; x += 38) ctx.fillRect(x, platform.y + 4, 22, 4);
    if (moving) {ctx.shadowColor='#54eaff';ctx.shadowBlur=10;ctx.fillStyle='#071d29';ctx.font='bold 14px Arial';ctx.fillText(platform.axis==='x'?'←  MOVE  →':'↕  MOVE',platform.x+8,platform.y+15);}
    if(fragile){ctx.strokeStyle='#2b1717';ctx.lineWidth=3;const crack=Math.min(1,(platform.timer||0)/.65);ctx.beginPath();ctx.moveTo(platform.x+platform.w*.18,platform.y);ctx.lineTo(platform.x+platform.w*(.37+crack*.12),platform.y+platform.h);ctx.lineTo(platform.x+platform.w*.66,platform.y+3);ctx.stroke();ctx.fillStyle='#ffe238';ctx.font='bold 13px Arial';ctx.fillText('⚠',platform.x+platform.w/2-7,platform.y-5);}
    ctx.restore();
  }

  function drawJumpPad(pad) {
    ctx.fillStyle='#ff4a25'; ctx.fillRect(pad.x,pad.y,pad.w,pad.h);
    ctx.fillStyle='#fff04a'; ctx.beginPath(); ctx.moveTo(pad.x+8,pad.y+12);ctx.lineTo(pad.x+29,pad.y+2);ctx.lineTo(pad.x+50,pad.y+12);ctx.fill();
  }

  function drawHazards() {
    hazards.forEach((h)=>{const active=hazardIsActive(h);ctx.save();ctx.globalAlpha=active?.82+.18*Math.sin(elapsed*9+h.phase):.42+.16*Math.sin(elapsed*12+h.phase);ctx.lineWidth=4;ctx.shadowBlur=20;
      ctx.fillStyle='#111';ctx.fillRect(h.x,h.y+h.h-6,h.w,8);for(let x=h.x;x<h.x+h.w;x+=16){ctx.fillStyle=((x-h.x)/16)%2<1?'#ffd62e':'#111';ctx.fillRect(x,h.y+h.h-6,16,8);}
      if(h.type==='mine'){ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.fillStyle='#252c36';ctx.strokeStyle='#ff4434';ctx.shadowColor='#ff2f22';ctx.shadowBlur=active?30:15;ctx.beginPath();ctx.arc(0,0,h.w*.36,0,7);ctx.fill();ctx.stroke();for(let a=0;a<8;a++){ctx.rotate(Math.PI/4);ctx.fillRect(h.w*.3,-3,h.w*.27,6);}ctx.fillStyle=active&&Math.floor(elapsed*8)%2?'#fff':'#ff3028';ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();}
      else if(h.type==='spinner'){ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.rotate(elapsed*3+h.phase);ctx.strokeStyle='#ffe329';ctx.shadowColor='#ff3020';for(let a=0;a<4;a++){ctx.rotate(Math.PI/2);ctx.fillStyle=a%2?'#111':'#ffd32b';ctx.fillRect(0,-7,h.w*.72,14);}ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.stroke();if(stageTheme==='sea'){ctx.rotate(-elapsed*3-h.phase);ctx.fillStyle=Math.floor(elapsed*6)%2?'#ff241d':'#fff';ctx.shadowColor='#ff241d';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();}}
      else if(h.type==='fire'){ctx.fillStyle=active?'#ff3b18':'#991e19';ctx.strokeStyle='#ffe52d';ctx.shadowColor='#ff3b18';if(!active){ctx.beginPath();ctx.ellipse(h.x+h.w/2,h.y+h.h,h.w*.55,13+Math.sin(elapsed*9)*5,0,0,7);ctx.fill();ctx.fillStyle='#fff12f';ctx.font='bold 16px Arial';ctx.fillText('!',h.x+h.w/2-4,h.y-8);}else for(let x=h.x;x<h.x+h.w;x+=22){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.quadraticCurveTo(x+4,h.y-18-Math.sin(elapsed*12)*8,x+11,h.y);ctx.lineTo(x+22,h.y+h.h);ctx.fill();ctx.stroke();}}
      else {ctx.fillStyle=h.type==='electric'?'#dffeff':'#ff3025';ctx.strokeStyle=h.type==='electric'?'#62ddff':'#fff36a';ctx.shadowColor=h.type==='electric'?'#45eaff':'#ff2018';ctx.shadowBlur=active?34:20;for(let x=h.x;x<h.x+h.w;x+=18){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+9,h.y);ctx.lineTo(x+18,h.y+h.h);ctx.fill();ctx.stroke();}ctx.fillStyle=h.type==='electric'?'#075b79':'#a61916';ctx.fillRect(h.x-10,h.y-28,h.w+20,23);for(let x=h.x-10;x<h.x+h.w+10;x+=20){ctx.fillStyle=((x-h.x)/20)%2<1?'#ffd62e':'#111';ctx.fillRect(x,h.y-28,20,7);}ctx.fillStyle='#ff281e';ctx.strokeStyle='#fff238';ctx.lineWidth=5;ctx.beginPath();ctx.arc(h.x+h.w/2,h.y-54,19,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 25px Arial';ctx.textAlign='center';ctx.fillText('!',h.x+h.w/2,h.y-45);ctx.font='bold 20px Arial';ctx.fillText(h.type==='electric'?'⚡ DANGER ⚡':'⚠ SPIKE ⚠',h.x+h.w/2,h.y-80);}
      ctx.restore();});
    fallingHazards.forEach((r)=>{ctx.save();if(r.warn>0){ctx.globalAlpha=.45+.5*Math.sin(elapsed*18);ctx.fillStyle='#ff281e';ctx.strokeStyle='#fff238';ctx.lineWidth=5;ctx.shadowColor='#ff281e';ctx.shadowBlur=24;ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.targetY-5,34+20*r.warn,12+8*r.warn,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('!',r.x+r.w/2,r.targetY-25);}ctx.globalAlpha=1;ctx.fillStyle='#ff4a25';ctx.strokeStyle='#ffe42e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+r.h/2,r.w/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText('!',r.x+r.w/2,r.y+r.h/2+7);ctx.restore();});
    const names=['A  WARM UP','B  PIT RUN','C  VERTICAL','D  SPEED','E  EXTREME'];const sections=names.map((n,i)=>[120+i*WORLD_WIDTH/5,`SECTION ${n}`]);
    ctx.font='bold 22px Arial';ctx.textAlign='left';sections.forEach(([x,label])=>{ctx.fillStyle='#0d385dcc';ctx.fillRect(x,205,390,38);ctx.fillStyle='#fff36a';ctx.fillText(label,x+12,232);});
    // Every floor gap gets high-contrast caution stripes and visible downward darkness.
    const sorted=[...staticPlatforms].filter(p=>p.h>80).sort((a,b)=>a.x-b.x);for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];const gx=a.x+a.w,gw=b.x-gx;if(gw>35&&gw<420){const gy=Math.min(a.y,b.y);ctx.fillStyle='#02030a';ctx.fillRect(gx,gy-5,gw,420);for(let x=gx;x<b.x;x+=28){ctx.fillStyle=(Math.floor((x-gx)/28)%2)?'#111':'#ffd32b';ctx.fillRect(x,gy-16,28,12);}ctx.fillStyle='#ff3a28';ctx.font='bold 18px Arial';ctx.fillText('⚠',gx+4,gy-23);ctx.fillText('⚠',b.x-24,gy-23);}}
  }

  function drawScenery() {
    if(stageTheme==='sea'){
      const zones=['海面','浅瀬','サンゴ礁','海中洞窟','沈没船','深海','海底'];const zoneWidth=WORLD_WIDTH/zones.length;
      ctx.textAlign='left';for(let i=0;i<zones.length;i++){const x=i*zoneWidth+70;ctx.fillStyle='#062c49bb';ctx.fillRect(x,112,245,40);ctx.fillStyle='#d9ffff';ctx.font='bold 20px Arial';ctx.fillText(`${i+1}  ${zones[i]}`,x+12,140);}
      ctx.strokeStyle='#b8ffff';ctx.lineWidth=6;ctx.globalAlpha=.65;ctx.beginPath();for(let x=0;x<zoneWidth*1.1;x+=35)ctx.lineTo(x,92+Math.sin(x*.025+elapsed*2)*9);ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle='#ff795b';for(let x=zoneWidth*2;x<zoneWidth*3;x+=145){ctx.fillRect(x,560,13,82);ctx.fillRect(x-18,585,48,12);}
      const shipX=zoneWidth*4+180;ctx.fillStyle='#392e2a';ctx.beginPath();ctx.moveTo(shipX,510);ctx.lineTo(shipX+520,475);ctx.lineTo(shipX+430,640);ctx.lineTo(shipX+70,640);ctx.closePath();ctx.fill();ctx.strokeStyle='#d09355';ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#b8ffff';ctx.font='bold 18px Arial';ctx.fillText('SUNKEN REPAIR SHIP',shipX+125,545);return;
    }
    if(stageTheme==='underground'){
      ctx.strokeStyle='#4be9ff';ctx.lineWidth=8;for(let y=190;y<WORLD_HEIGHT;y+=230){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<WORLD_WIDTH;x+=140)ctx.lineTo(x,y+Math.sin(x*.01+y)*35);ctx.stroke();}
      ctx.fillStyle='#ffe238';ctx.font='bold 17px Arial';for(let x=520;x<WORLD_WIDTH;x+=900)ctx.fillText(x%1800?'EXIT →':'↓ DEEP ROUTE',x,260+(Math.floor(x/900)%3)*185);return;
    }
    if(stageTheme==='factory'){
      ctx.fillStyle='#ffcc31';ctx.font='bold 24px Arial';for(let x=450;x<WORLD_WIDTH;x+=700)ctx.fillText('→  RUN  →',x,FLOOR_Y-145);return;
    }
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
    const data={battery:{color:'#43ff72',dark:'#075e32',label:'BATTERY',icon:'▰'},lcd:{color:'#42eaff',dark:'#07517a',label:'LCD',icon:'▣'},king:{color:'#ffd338',dark:'#8b4e00',label:'KING',icon:'♛'},muscle:{color:'#ff582d',dark:'#8b1607',label:'MUSCLE',icon:'✊'}}[item.type];
    ctx.save();ctx.translate(item.x,item.y);
    if(!item.active){const pulse=.7+.3*Math.sin(elapsed*24);ctx.globalAlpha=pulse;ctx.fillStyle=data.color;ctx.shadowColor=data.color;ctx.shadowBlur=28;ctx.fillRect(-5,-125,10,105);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,12,38,13,0,0,7);ctx.stroke();ctx.restore();return;}
    ctx.translate(0,Math.sin(item.phase)*7);ctx.shadowColor=data.color;ctx.shadowBlur=30;ctx.fillStyle=data.dark;ctx.strokeStyle=data.color;ctx.lineWidth=5;drawRoundedRect(-31,-34,62,68,13);ctx.strokeRect(-25,-28,50,42);
    ctx.fillStyle=data.color;ctx.font=item.type==='muscle'?'25px Arial':'bold 28px Arial';ctx.textAlign='center';ctx.fillText(data.icon,0,3);
    if(item.type==='battery'){ctx.fillRect(-12,-17,24,9);ctx.fillRect(-12,-5,17,9);}
    if(item.type==='king'){for(let i=0;i<4;i++){const a=elapsed*2+i*Math.PI/2;ctx.fillText('✦',Math.cos(a)*42,Math.sin(a)*35+5);}}
    if(item.type==='muscle'){ctx.strokeStyle='#ffb02e';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-27+i*25,35);ctx.lineTo(-20+i*25,48+Math.sin(elapsed*12+i)*7);ctx.stroke();}}
    ctx.fillStyle='#07121c';ctx.fillRect(-34,38,68,17);ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.fillText(data.label,0,50);ctx.restore();
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

  function drawFeniSprite(x, y, facing, rotation = 0, alpha = 1, forcedMode = null, forcedState = null) {
    const renderState=forcedState||player.state;
    const stride = Math.sin(player.anim); const speed = Math.abs(player.vx);
    const bob = player.grounded && speed > 25 ? -Math.abs(stride) * 6 : Math.sin(player.anim) * 1.5;
    const tilt = player.invincible > 0 ? Math.sin(elapsed*35)*.12 : renderState === 'dash' ? .07*facing : renderState === 'walk' ? .07*facing : renderState === 'fall' ? .05*facing : 0;
    const squash = renderState === 'land' ? .88 : renderState === 'doubleJump' ? 1.1 : 1;
    const stretchX = renderState === 'jump' ? .92 : renderState === 'doubleJump' ? .88 : 1;
    const celebration = renderState === 'clear' ? 1 + Math.sin(player.clearTime * 10) * .09 : 1;
    ctx.save(); ctx.globalAlpha *= alpha; if(renderState==='clear'){ctx.shadowColor='#fff36a';ctx.shadowBlur=28;} ctx.translate(x+player.w/2,y+player.h/2+bob); ctx.rotate(rotation+tilt); ctx.scale(facing * stretchX * celebration,squash * celebration);
    const renderMode=forcedMode||playerMode;
    const swordPose = forcedMode?null:currentSwordPose();
    const swordPoseImage = swordPose ? swordPoseImages[swordPose] : null;
    if (swordPoseImage?.complete && swordPoseImage.naturalWidth) {
      const meta = SWORD_POSE_META[swordPose];
      if(renderMode==='normal'){
        ctx.drawImage(swordPoseImage,-meta.anchorX*meta.size,player.h/2-meta.anchorY*meta.size,meta.size,meta.size);
        ctx.restore();return;
      }
    }
    let imageKey = renderMode === 'muscle' && player.attackTime > 0 ? 'musclePunch' : renderMode;
    if(renderMode==='normal'&&renderState==='dash'&&!player.hasSword)imageKey='dash';
    const currentImage=playerImages[imageKey];
    const meta=PLAYER_SPRITE_META[imageKey]||PLAYER_SPRITE_META.normal;
    if (currentImage.complete && currentImage.naturalWidth) {
      const normalAspect=PLAYER_SPRITE_META.normal.sw/PLAYER_SPRITE_META.normal.sh;
      const drawHeight=player.h*1.32;
      const drawWidth=player.w*1.24*((meta.sw/meta.sh)/normalAspect);
      ctx.drawImage(currentImage,meta.sx,meta.sy,meta.sw,meta.sh,-drawWidth/2,-drawHeight/2,drawWidth,drawHeight);
    }
    if(swordPose&&renderMode!=='normal'&&phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth){
      const progress=1-Math.min(1,player.attackTime/SWORD_ATTACK_DURATION);ctx.save();ctx.translate(player.w*.24,-player.h*.05);ctx.rotate(player.attackTime>0?-1.08+progress*2.08:-.55);ctx.shadowColor='#ff4b1d';ctx.shadowBlur=22;ctx.drawImage(phoenixSwordImage,-16,-98,54,108);ctx.restore();
    }
    // Each transform keeps its own body art while the stable face overlays make
    // dash, sword and goal emotions readable without swapping sprite geometry.
    const needsExpression=(renderState==='dash'&&renderMode!=='normal')||player.clearTime||player.hasSword||player.revivePose>0;
    if(!forcedMode&&needsExpression){
      const faceX=player.w*.09,faceY=-player.h*.18;ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#3b1914';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(faceX-7,faceY,7,9,0,0,7);ctx.ellipse(faceX+8,faceY,7,9,0,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle=renderState==='dash'?'#ffcf28':'#1b1819';ctx.beginPath();ctx.arc(faceX-6,faceY+1,3,0,7);ctx.arc(faceX+9,faceY+1,3,0,7);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();if(player.clearTime||player.revivePose>0){ctx.arc(faceX+1,faceY+14,10,0,Math.PI);ctx.fillStyle='#ff6b68';ctx.fill();}else if(renderState==='dash'){ctx.moveTo(faceX-14,faceY-10);ctx.lineTo(faceX-2,faceY-6);ctx.moveTo(faceX+4,faceY-6);ctx.lineTo(faceX+16,faceY-10);ctx.stroke();}else{ctx.arc(faceX+1,faceY+13,7,0,Math.PI);ctx.stroke();}ctx.restore();
    }
    ctx.restore();
  }

  function currentSwordPose() {
    if (!player?.hasSword) return null;
    if (player.attackTime <= 0) return 'ready';
    const progress = 1 - Math.min(1, player.attackTime / SWORD_ATTACK_DURATION);
    return progress < .48 ? 'swing' : 'finish';
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(elapsed * 14) % 2) return;
    if(playerMode==='lcd'){ctx.save();ctx.strokeStyle='#61ecff';ctx.lineWidth=3;ctx.globalAlpha=.6;for(let i=0;i<7;i++){const y=player.y+Math.random()*player.h;ctx.beginPath();ctx.moveTo(player.x-25-Math.random()*120,y);ctx.lineTo(player.x-160-Math.random()*160,y);ctx.stroke();}ctx.restore();}
    if(playerMode==='lcd'&&player.shields>0){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);ctx.globalAlpha=.2+(player.shieldHit>0?.38:0);ctx.fillStyle='#65eaff';ctx.shadowColor='#42dfff';ctx.shadowBlur=30;for(let layer=0;layer<player.shields;layer++){ctx.beginPath();ctx.ellipse(0,0,player.w*(.78+layer*.22),player.h*(.69+layer*.12),0,0,7);ctx.fill();ctx.globalAlpha+=.1;ctx.strokeStyle=layer===0?'#d8ffff':'#48dfff';ctx.lineWidth=3;ctx.stroke();}ctx.restore();}
    if(playerMode==='king'){ctx.save();ctx.globalAlpha=.48;ctx.fillStyle='#ffd52f';ctx.shadowColor='#fff09a';ctx.shadowBlur=35;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.8,player.h*.75,0,0,7);ctx.fill();ctx.restore();}
    drawFeniSprite(player.x, player.y, player.facing, player.spin);
    if(player.attackTime>0){ctx.save();const front=player.facing>0?player.x+player.w:player.x;ctx.translate(front,player.y+55);ctx.scale(player.facing,1);if(playerMode==='muscle'&&!player.hasSword){ctx.fillStyle='#ff8b31';ctx.strokeStyle='#7d1d12';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(48,0,48,25,0,0,7);ctx.fill();ctx.stroke();}else if(playerMode!=='normal'){const swing=1-Math.min(1,player.attackTime/SWORD_ATTACK_DURATION);ctx.save();ctx.rotate(-1.05+swing*2.1);ctx.shadowColor='#ff491d';ctx.shadowBlur=28;if(phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth)ctx.drawImage(phoenixSwordImage,-23,-112,72,128);ctx.restore();ctx.strokeStyle='#fff36b';ctx.lineWidth=12;ctx.shadowColor='#ff3b18';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(0,0,105,-1.18,1.18);ctx.stroke();ctx.strokeStyle='#ff5a1f';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,120,-1.08,1.08);ctx.stroke();}ctx.restore();}
  }

  function drawEnemy(enemy) {
    if (!enemy.alive && enemy.squish <= 0) return;
    ctx.save();ctx.translate(enemy.x+enemy.w/2,enemy.y+enemy.h/2);
    const warning=enemy.warning>0||enemy.cooldown<.42;const facing=enemy.vx<0?-1:1;
    ctx.shadowColor=warning?'#ff251d':enemy.aquatic?'#4cecff':enemy.flying?'#9cefff':'#ff6049';ctx.shadowBlur=warning?34:15;
    if(warning){ctx.globalAlpha=.55+.45*Math.sin(elapsed*30);ctx.strokeStyle='#fff32e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,Math.max(enemy.w,enemy.h)*.7,0,7);ctx.stroke();ctx.globalAlpha=1;}
    const enemyImage=enemyImages[enemy.type];
    if(enemyImage?.complete&&enemyImage.naturalWidth){
      if(!enemy.alive)ctx.scale(1.35,.24);
      else{
        const faceLeft=enemy.vx<-.5||(Math.abs(enemy.vx)<=.5&&player.x<enemy.x);
        ctx.scale(faceLeft?1:-1,1);
      }
      const spriteSize=Math.max(enemy.w,enemy.h)*(enemy.heavy?1.88:1.72);
      ctx.drawImage(enemyImage,-spriteSize/2,-spriteSize/2,spriteSize,spriteSize);
      ctx.restore();return;
    }
    if(!enemy.alive)ctx.scale(1.35,.24);else ctx.scale(facing,1);
    ctx.lineWidth=4;ctx.strokeStyle='#c5d8df';
    if(enemy.type==='mechaShark'){
      ctx.fillStyle='#185f7e';ctx.beginPath();ctx.moveTo(-40,0);ctx.quadraticCurveTo(-8,-31,35,-14);ctx.lineTo(48,-30);ctx.lineTo(44,-5);ctx.lineTo(54,15);ctx.lineTo(29,10);ctx.quadraticCurveTo(-8,31,-40,0);ctx.fill();ctx.stroke();
      ctx.fillStyle='#9ed8e7';ctx.beginPath();ctx.moveTo(-4,-21);ctx.lineTo(12,-40);ctx.lineTo(20,-17);ctx.fill();ctx.fillStyle='#ff352e';ctx.beginPath();ctx.arc(-20,-6,5,0,7);ctx.fill();
      ctx.strokeStyle='#e8f9ff';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-37+i*7,8);ctx.lineTo(-32+i*7,15);ctx.stroke();}
    }else if(enemy.type==='jelly'){
      ctx.fillStyle='#462b75';ctx.beginPath();ctx.arc(0,-8,27,Math.PI,0);ctx.lineTo(27,4);ctx.lineTo(-27,4);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#89f5ff';ctx.lineWidth=4;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*10,3);ctx.bezierCurveTo(i*13,20+Math.sin(enemy.phase+i)*7,i*5,31,i*10,40);ctx.stroke();}
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-9,-8,4,0,7);ctx.arc(9,-8,4,0,7);ctx.fill();
    }else if(enemy.type==='subDrone'){
      ctx.fillStyle='#24576d';ctx.beginPath();ctx.ellipse(0,4,34,21,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#54e8ff';ctx.fillRect(-10,-24,20,14);ctx.fillRect(7,-31,5,12);ctx.fillStyle='#ff382f';ctx.beginPath();ctx.arc(-20,0,5,0,7);ctx.fill();ctx.strokeStyle='#b8f6ff';ctx.beginPath();ctx.arc(38,4,14,0,7);ctx.stroke();
    }else if(enemy.type==='battleDrone'){
      ctx.fillStyle='#344e70';ctx.beginPath();ctx.moveTo(-34,-12);ctx.lineTo(-16,-29);ctx.lineTo(18,-29);ctx.lineTo(35,-10);ctx.lineTo(24,23);ctx.lineTo(-24,23);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#88efff';ctx.fillRect(-48,-1,22,6);ctx.fillRect(26,-1,22,6);ctx.strokeStyle='#d9fbff';ctx.beginPath();ctx.ellipse(-40,-5,18,5,0,0,7);ctx.ellipse(40,-5,18,5,0,0,7);ctx.stroke();
      ctx.fillStyle='#ff392e';ctx.beginPath();ctx.arc(0,-7,7,0,7);ctx.fill();
    }else if(enemy.type==='jetMech'){
      ctx.fillStyle='#32475f';ctx.beginPath();ctx.moveTo(-42,0);ctx.lineTo(-14,-24);ctx.lineTo(36,-14);ctx.lineTo(48,0);ctx.lineTo(34,17);ctx.lineTo(-15,24);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#ff7b22';ctx.beginPath();ctx.moveTo(38,-9);ctx.lineTo(62,0);ctx.lineTo(38,10);ctx.fill();ctx.fillStyle='#ff3131';ctx.beginPath();ctx.arc(-23,-4,5,0,7);ctx.fill();
    }else{
      const heavy=enemy.heavy;ctx.fillStyle=heavy?'#363d49':'#536571';drawRoundedRect(-enemy.w*.38,-enemy.h*.42,enemy.w*.76,enemy.h*.78,heavy?5:10);ctx.strokeRect(-enemy.w*.32,-enemy.h*.36,enemy.w*.64,enemy.h*.64);
      ctx.fillStyle='#18222d';ctx.fillRect(-enemy.w*.25,-enemy.h*.27,enemy.w*.5,enemy.h*.34);
      if(enemy.type==='batteryBot'){ctx.fillStyle='#ffe036';ctx.fillRect(-17,-17,34,24);ctx.fillStyle='#26323c';ctx.fillRect(-9,-27,18,7);ctx.fillStyle='#fff28c';ctx.fillRect(-11,-11,22,5);}
      if(enemy.type==='toolMech'){ctx.strokeStyle='#d8edf2';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-24,3);ctx.lineTo(-42,20);ctx.moveTo(24,3);ctx.lineTo(42,-18);ctx.stroke();ctx.lineWidth=4;ctx.beginPath();ctx.arc(45,-21,9,.5,5.7);ctx.stroke();}
      if(enemy.type==='drillMech'){ctx.fillStyle='#c6d0d4';ctx.beginPath();ctx.moveTo(-enemy.w*.38,-12);ctx.lineTo(-enemy.w*.78,0);ctx.lineTo(-enemy.w*.38,12);ctx.fill();ctx.stroke();ctx.strokeStyle='#59646d';for(let x=-52;x<-25;x+=9){ctx.beginPath();ctx.moveTo(x,-8);ctx.lineTo(x+7,8);ctx.stroke();}}
      if(enemy.type==='boardTrooper'){ctx.strokeStyle='#55eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,-25);ctx.lineTo(4,-3);ctx.lineTo(-7,24);ctx.moveTo(4,-3);ctx.lineTo(21,-22);ctx.stroke();ctx.fillStyle='#8c979e';ctx.fillRect(-35,20,22,15);ctx.fillRect(13,20,22,15);}
      if(enemy.type==='phoneBot'){ctx.strokeStyle='#edf7fa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,-20);ctx.lineTo(5,2);ctx.lineTo(-5,19);ctx.moveTo(5,2);ctx.lineTo(18,-15);ctx.stroke();}
      ctx.fillStyle=warning?'#fff':'#ff382f';ctx.shadowColor='#ff251d';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(-9,-7,4,0,7);ctx.arc(9,-7,4,0,7);ctx.fill();
    }
    ctx.strokeStyle='#dce8ec';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-enemy.w*.25,-enemy.h*.25);ctx.lineTo(-enemy.w*.1,-enemy.h*.12);ctx.moveTo(enemy.w*.08,enemy.h*.1);ctx.lineTo(enemy.w*.24,enemy.h*.24);ctx.stroke();ctx.restore();
  }

  function drawDroplet(drop) {
    ctx.save();ctx.translate(drop.x+drop.w/2,drop.y+drop.h/2);ctx.rotate(Math.atan2(drop.vy,drop.vx));
    const electric=drop.kind==='electric',explosive=drop.kind==='burst',missile=['missile','torpedo'].includes(drop.kind);
    ctx.shadowColor=electric?'#a9f9ff':explosive?'#ff5a23':missile?'#ffcf37':'#45dfff';ctx.shadowBlur=18;
    if(missile){ctx.fillStyle=drop.kind==='torpedo'?'#8defff':'#ffcb35';ctx.strokeStyle='#eaffff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,drop.w/2,drop.h/2,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ff5b24';ctx.beginPath();ctx.moveTo(-drop.w/2,0);ctx.lineTo(-drop.w*.8,-drop.h*.45);ctx.lineTo(-drop.w*.8,drop.h*.45);ctx.closePath();ctx.fill();}
    else if(electric){ctx.strokeStyle='#dfffff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-drop.w/2,-drop.h/3);ctx.lineTo(0,-2);ctx.lineTo(-3,drop.h/3);ctx.lineTo(drop.w/2,0);ctx.stroke();}
    else if(explosive){ctx.fillStyle='#ff8a28';ctx.beginPath();for(let i=0;i<12;i++){const radius=i%2?drop.w*.28:drop.w*.55,angle=i*Math.PI/6;ctx.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}ctx.closePath();ctx.fill();}
    else{ctx.fillStyle='#45dfff';ctx.beginPath();ctx.moveTo(-drop.w/2,0);ctx.quadraticCurveTo(0,-drop.h*.7,drop.w/2,0);ctx.quadraticCurveTo(0,drop.h*.7,-drop.w/2,0);ctx.fill();}
    ctx.restore();
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

  const keyMap = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', Space:'jump', KeyX:'attack' };
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

  if(new URLSearchParams(location.search).has('debug')){
    window.__repairHeroDebug=Object.freeze({
      start:()=>startGame(),
      setStage:(id)=>{const index=typeof id==='number'?id:STAGES.findIndex((stage)=>stage.id===id);if(index<0||index>=STAGES.length)throw new Error(`Unknown stage: ${id}`);currentStage=index;startGame();},
      setMode:(name)=>{if(!MODE_DURATIONS[name])throw new Error(`Unknown mode: ${name}`);applyMode(name);},
      hit:(sourceX=player.x+300)=>{player.invincible=0;hurt(sourceX);},
      attack:()=>performAttack(),
      giveSword:()=>{player.hasSword=true;if(swordItem)swordItem.collected=true;updateHud();},
      setInput:(name,value)=>{if(!(name in input))throw new Error(`Unknown input: ${name}`);input[name]=!!value;},
      setVelocity:(vx,vy)=>{if(Number.isFinite(vx))player.vx=vx;if(Number.isFinite(vy))player.vy=vy;player.grounded=false;},
      step:(seconds=.016)=>{const frames=Math.max(1,Math.ceil(seconds*60));for(let frame=0;frame<frames;frame++)update(Math.min(.033,seconds/frames));},
      draw:()=>draw(),
      teleport:(x,y)=>{player.x=Math.max(0,Math.min(WORLD_WIDTH-player.w,x));if(Number.isFinite(y))player.y=y;player.vx=0;player.vy=0;},
      respawn:()=>respawnAtCheckpoint('DEBUG RESPAWN'),
      defeatBoss:()=>{if(boss){boss.hp=1;boss.hit=0;boss.state='chase';boss.intro=true;damageBoss(99);}},
      state:()=>({mode,currentStage:STAGES[currentStage].id,notice:ui.notice.textContent,player:{x:player.x,y:player.y,vx:player.vx,vy:player.vy,hp:player.hp,grounded:player.grounded,jumpCount:player.jumpCount,dash:player.dash,coinSpeed:player.coinSpeed,dropTimer:player.dropTimer,chargeTime:player.chargeTime,revivePose:player.revivePose,clearMode:player.clearMode,mode:playerMode,modeTimer,shields:player.shields,hasSword:player.hasSword,attackTime:player.attackTime,swordPose:currentSwordPose()},
        enemiesAlive:enemies.filter((enemy)=>enemy.alive).length,enemyPositions:enemies.filter((enemy)=>enemy.alive).slice(0,12).map((enemy)=>({type:enemy.type,attack:enemy.attack,x:enemy.x,y:enemy.y,w:enemy.w,h:enemy.h})),hazardPositions:hazards.map((hazard)=>({type:hazard.type,x:hazard.x,y:hazard.y,w:hazard.w,h:hazard.h})),coinPositions:coins.filter((coin)=>!coin.collected).slice(0,12).map((coin)=>({x:coin.x,y:coin.y})),breakablesAlive:breakables.filter((wall)=>wall.alive).length,breakablePositions:breakables.filter((wall)=>wall.alive).slice(0,6).map((wall)=>({x:wall.x,y:wall.y})),checkpoints:checkpoints.map((point)=>({x:point.x,y:point.y,active:point.active,respawnX:point.respawnX,respawnY:point.respawnY})),jumpPadVelocity:JUMP_PAD_VELOCITY,jumpPadPositions:jumpPads.map((pad)=>({x:pad.x,y:pad.y,w:pad.w,h:pad.h})),oneWayPlatforms:allPlatforms().filter(isOneWayPlatform).slice(0,128).map((platform)=>({x:platform.x,y:platform.y,w:platform.w,h:platform.h,surfaceRoute:!!platform.surfaceRoute})),transformTypes:transformItems.filter((item)=>!item.collected).map((item)=>item.type),kingWeight:TRANSFORM_WEIGHTS.filter((type)=>type==='king').length/TRANSFORM_WEIGHTS.length,shockwaves:shockwaves.length,shockwaveKinds:shockwaves.map((wave)=>wave.kind||'ground'),shockwaveData:shockwaves.map((wave)=>({kind:wave.kind||'ground',maxDistance:wave.maxDistance||0,breaksWalls:!!wave.breaksWalls})),rushTrails:rushTrails.length,projectileKinds:droplets.map((drop)=>drop.kind||'droplet'),
        boss:boss?{type:boss.type,name:boss.name,x:boss.x,y:boss.y,w:boss.w,h:boss.h,hp:boss.hp,alive:boss.alive,defeated:bossDefeated,gateX:bossGate.x,gateClosed:bossGate.closed,goalUnlocked,swordX:swordItem?.x}:null,goal:{x:goal.x,y:goal.y,unlocked:goalUnlocked},bossProjectileKinds:projectiles.map((projectile)=>projectile.kind||'orb'),chaserWall:chaserWall?{x:chaserWall.x,speed:chaserWall.speed}:null,
        world:{width:WORLD_WIDTH,height:WORLD_HEIGHT,viewportWidth,viewportHeight,cameraX,cameraY},images:{...Object.fromEntries(Object.entries(playerImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}])),enemies:Object.fromEntries(Object.entries(enemyImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}])),boss:{loaded:bossImage.complete&&bossImage.naturalWidth>0,width:bossImage.naturalWidth,height:bossImage.naturalHeight},sword:{loaded:phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth>0,width:phoenixSwordImage.naturalWidth,height:phoenixSwordImage.naturalHeight},swordPoses:Object.fromEntries(Object.entries(swordPoseImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}]))}})
    });
  }

  resize();
  resetGame();
  if (!animationFrame) animationFrame = requestAnimationFrame(loop);
})();
