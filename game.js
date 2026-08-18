(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const touchDevice = navigator.maxTouchPoints > 0;
  const reducedEffects = touchDevice;
  if (touchDevice) document.body.classList.add('touch-device');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    title: $('#title'), result: $('#result'), hud: $('#hud'), touch: $('#touch'), pause: $('#pause'),
    hearts: $('#hearts'), coins: $('#coins'), score: $('#score'), timer: $('#timer'), dashGauge: $('#dashGauge'), notice: $('#notice'),
    noticeText: $('#noticeText'), noticePortrait: $('#noticePortrait'), wingAttack: $('#wingAttack'), specialAttack: $('#specialAttack'),
    ultimateCutin: $('#ultimateCutin'), ultimateCutinPortrait: $('#ultimateCutinPortrait'), ultimateCutinMode: $('#ultimateCutinMode'), ultimateCutinName: $('#ultimateCutinName'),
    modeHud: $('#modeHud'), modeTimer: $('#modeTimer'), shieldCount: $('#shieldCount'), specialStatus: $('#specialStatus'), transformFlash: $('#transformFlash'),
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
  const STATE_FRAME_INDEX = { dash:0, goal:1, swordReady:2, swordSwing:3, revive:4 };
  // Generated compositions use different amounts of transparent padding. These
  // per-state corrections equalize visible alpha height to NORMAL Feni, so mode
  // changes never make the hero appear larger or smaller.
  const STATE_MODE_SCALE = {
    dash:{normal:1,battery:1.03,lcd:.91,king:1.10,muscle:.73},
    goal:{normal:1,battery:.86,lcd:1,king:1.20,muscle:.85},
    swordReady:{normal:1,battery:1.06,lcd:.88,king:1.23,muscle:.81},
    swordSwing:{normal:1,battery:1.14,lcd:.99,king:1.20,muscle:.97},
    revive:{normal:1,battery:.88,lcd:.87,king:.93,muscle:.98}
  };
  const PLAYER_STATE_SOURCES = {
    normal:'./feni_states_normal.png', battery:'./feni_states_battery.png', lcd:'./feni_states_lcd.png',
    king:'./feni_states_king.png', muscle:'./feni_states_muscle.png'
  };
  const playerStateSheets = {};
  let activeNoticePose=null, activeResultPose=null;
  for (const [name, source] of Object.entries(PLAYER_STATE_SOURCES)) {
    const image=new Image();const record={image,drawable:null,ready:false,source};playerStateSheets[name]=record;
    image.onload=()=>{record.drawable=image;record.ready=true;if(activeNoticePose?.mode===name)drawStateFrameToCanvas(ui.noticePortrait,name,activeNoticePose.state);if(activeResultPose?.mode===name)drawStateFrameToCanvas(ui.resultFeni,name,activeResultPose.state);};
    image.src=source;
  }
  const MOTION_FRAME_INDEX = {
    idle:0, lookLeft:1, lookRight:2, blink:3, step1:4, step2:5, alert:6, stretch:7,
    jumpStart:8, jumpRise:9, fall:10, land:11, doubleJump:12, wingCharge:13, wingFire:14, wingRecover:15
  };
  const PLAYER_MOTION_SOURCES = {
    normal:'./feni_motion_normal.png', battery:'./feni_motion_battery.png', lcd:'./feni_motion_lcd.png',
    king:'./feni_motion_king.png', muscle:'./feni_motion_muscle.png'
  };
  const playerMotionSheets = {};
  for (const [name, source] of Object.entries(PLAYER_MOTION_SOURCES)) {
    const image=new Image();const record={image,drawable:null,ready:false,source};playerMotionSheets[name]=record;
    image.onload=()=>{record.drawable=image;record.ready=true;};
    image.src=source;
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
  const ULTIMATE_NAMES = { normal:'FIRE FEATHER STORM', battery:'BATTERY ALLY LINK', lcd:'ZERO-LAG BLINK', muscle:'OMNI RUSH PUNCH', king:'KING TRINITY' };
  const ULTIMATE_LINES = {
    normal:'おいどんを甘く見るなよ！！',
    battery:'元気1000倍！！負ける気がしねぇ！！',
    lcd:'俯瞰した俺をもう誰も止められない…',
    muscle:'ウホォ/ / /止まんなァい゛い゛！！゛',
    king:'ひれ伏せ！！俺はKINGだっ！！'
  };
  const GRAVITY = 1800;
  const MAX_FALL = 920;
  const JUMP_PAD_VELOCITY = -1120;
  const START_TIME = 150;
  const BOSS_ARENA_WIDTH = 2600;
  const BOSS_INTRO_DURATION = 1.8;
  const MAX_ENEMY_PROJECTILES = reducedEffects ? 32 : 48;
  const MAX_BOSS_PROJECTILES = reducedEffects ? 26 : 36;
  // Gameplay attacks keep enough slots for the 18-way GORI ultimate. Only
  // decorative particles are reduced on touch devices.
  const MAX_FRIENDLY_PROJECTILES = reducedEffects ? 28 : 38;
  const DASH_DRAIN_PER_SECOND = 28;
  const DASH_RECOVERY_PER_SECOND = 12;
  const ULTIMATE_CUTIN_TIME = .72;
  const ULTIMATE_DIALOGUE_TIME = 1.6;
  const input = { left:false, right:false, up:false, down:false, jump:false, dashLeft:false, dashRight:false, attack:false, wing:false, special:false };
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
  let hudRefreshTimer = 0;
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
  let projectiles = [], wingShots = [], shockwaves = [], combatFx = [], shieldShards = [], rushTrails = [], speedTrails = [], kingClones = [], swordItem = null, bossGate = null, bossIntro = 0, hitStop = 0;
  let enemyVolleyLock = 0;
  let lastClashAt = -10;
  let bossDefeated = false;
  let goalUnlocked = true;
  let breakables = [], currents = [], bubbles = [], gimmicks = [], oxygen = 100, oxygenDamageTimer = 0, chaserWall = null;
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
      const gap = section === 0 ? 24 : 46 + Math.min(12,currentStage*2);
      const chunk = section % 4 === 3 ? 680 : 730;
      for (let x = start; x < end - 100; x += chunk) {
        const first = x === start && section === 0;
        const px = first ? x : x + gap;
        const rise = floors[(section + Math.floor(x / chunk)) % floors.length] + themeLift;
        staticPlatforms.push({x:px, y:FLOOR_Y + rise, w:Math.min(chunk-gap+(first?gap:0),end-px), h:190-rise});
        if (section === 1 || section === 4 || section === 6) staticPlatforms.push({x:px+135,y:FLOOR_Y-145+rise*.35,w:255+(Math.floor(x/chunk)%2)*35,h:20,oneWay:true});
        if (section === 2 || section === 5) staticPlatforms.push({x:px+85,y:FLOOR_Y-90-(Math.floor(x/chunk)%3)*80,w:270,h:20,oneWay:true});
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
      const arenaX=WORLD_WIDTH-BOSS_ARENA_WIDTH;
      staticPlatforms.push({x:arenaX,y:FLOOR_Y,w:BOSS_ARENA_WIDTH,h:190,bossArena:true});
      staticPlatforms.push({x:arenaX+520,y:FLOOR_Y-125,w:260,h:20,oneWay:true,bossArena:true},{x:WORLD_WIDTH-720,y:FLOOR_Y-155,w:260,h:20,oneWay:true,bossArena:true});
      itemBlueprints.push(['muscle',arenaX+470,FLOOR_Y-185]);
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
        const arenaX=WORLD_WIDTH-BOSS_ARENA_WIDTH;
        enemyBlueprints.splice(0,enemyBlueprints.length,...enemyBlueprints.filter(([,x])=>x<arenaX-260));
        transformBlueprints.splice(0,transformBlueprints.length,...transformBlueprints.filter(([x])=>x<arenaX-320));
        itemBlueprints.push(['battery',arenaX-760,250],['muscle',arenaX-390,430]);
      }
    }
    if (stage.chaseWall) {
      // The wall is the threat here: encounters stay sparse and every obstacle
      // has a visible run-up so the player can choose jump, dash or break-through.
      enemyBlueprints.splice(8);
      jumpPads.push({x:WORLD_WIDTH*.48,y:FLOOR_Y-22,w:62,h:22},{x:WORLD_WIDTH*.82,y:FLOOR_Y-22,w:62,h:22});
    }
    if(stage.bossType){
      const arenaX=WORLD_WIDTH-BOSS_ARENA_WIDTH;
      enemyBlueprints.splice(0,enemyBlueprints.length,...enemyBlueprints.filter(([,x])=>x<arenaX-260));
      // Keep the last 2,600 world pixels open and predictable. The titan gets
      // a continuous ground arena; the shark gets a deep, unobstructed basin.
      const authoredArena=staticPlatforms.filter((platform)=>platform.bossArena);
      staticPlatforms.splice(0,staticPlatforms.length,...staticPlatforms.filter((platform)=>platform.x+platform.w<=arenaX+20),...authoredArena);
      if(stage.bossType==='shark')staticPlatforms.push({x:arenaX,y:700,w:BOSS_ARENA_WIDTH,h:120,seabed:true,bossArena:true});
    }
  }

  function resize() {
    const view = window.visualViewport;
    width = Math.round(view?.width || innerWidth);
    height = Math.round(view?.height || innerHeight);
    portrait = height > width;
    // A 2x full-screen canvas is unnecessarily expensive on iPhone/iPad. Keep
    // the CSS viewport and camera unchanged while limiting only backing pixels.
    const nativeDpr = devicePixelRatio || 1;
    const pixelBudget = touchDevice ? 1800000 : 3000000;
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1,width * height));
    dpr = Math.max(1,Math.min(nativeDpr,touchDevice ? 1.5 : 2,budgetDpr));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // Keep Feni readable while guaranteeing a useful amount of forward space.
    // Narrow phones use width as a second camera constraint instead of scaling
    // the DOM, so portrait and landscape both reveal upcoming hazards.
    // The visible sprite is about 1.32× the physics body. Portrait viewports are
    // kept near 900–1020 world pixels high (14–17% character height), while the
    // width constraint guarantees at least 470 world pixels and useful lead room.
    baseScale = portrait ? Math.min(height / 900, width / 470) : Math.min(height / 780, width / 1150);
    scale = baseScale;
    viewportWidth = width / scale;
    viewportHeight = height / scale;
    offsetX = Math.max(0, (width - viewportWidth * scale) / 2);
    offsetY = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ENEMY_PROFILES = {
    phoneBot: { behavior:'walker', attack:'pulse', alternate:'scan', w:72, h:82, speed:72, hp:1 },
    toolMech: { behavior:'shooter', attack:'bolt', alternate:'saw', w:78, h:80, speed:42, hp:2 },
    batteryBot: { behavior:'hopper', attack:'burst', alternate:'mine', w:72, h:84, speed:68, hp:2 },
    boardTrooper: { behavior:'shooter', attack:'spread', alternate:'rail', w:84, h:94, speed:48, heavy:true, hp:2 },
    drillMech: { behavior:'charger', attack:'drillWave', alternate:'debris', w:90, h:78, speed:92, heavy:true, hp:2 },
    mechaShark: { behavior:'swimmer', attack:'bite', alternate:'bubble', w:108, h:67, speed:86, flying:true, aquatic:true, hp:2 },
    jelly: { behavior:'jelly', attack:'electric', alternate:'lightning', w:78, h:90, speed:38, flying:true, aquatic:true, hp:1 },
    subDrone: { behavior:'shooter', attack:'torpedo', alternate:'depthCharge', w:90, h:65, speed:54, flying:true, aquatic:true, hp:2 },
    battleDrone: { behavior:'shooter', attack:'spread', alternate:'diveShot', w:88, h:63, speed:62, flying:true, hp:1 },
    jetMech: { behavior:'flyer', attack:'missile', alternate:'fireRain', w:101, h:61, speed:118, flying:true, hp:2 }
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

  function safePlayerPositionNear(preferredX, preferredY = FLOOR_Y - PLAYER_H, options = {}) {
    const clampedX=Math.max(18,Math.min(WORLD_WIDTH-PLAYER_W-18,preferredX));
    if(STAGES[currentStage].water||options.allowAir){
      return {x:clampedX,y:Math.max(58,Math.min(WORLD_HEIGHT-PLAYER_H-42,preferredY)),grounded:false,platform:null};
    }
    const floors=staticPlatforms.filter((platform)=>!platform.ceiling&&platform.w>=PLAYER_W+42&&platform.y>PLAYER_H+20&&platform.y<WORLD_HEIGHT+20);
    const candidates=[];
    for(const floor of floors){
      const x=Math.max(floor.x+18,Math.min(floor.x+floor.w-PLAYER_W-18,clampedX));
      if(x<floor.x||x+PLAYER_W>floor.x+floor.w)continue;
      const y=floor.y-PLAYER_H;
      const body={x,y,w:PLAYER_W,h:PLAYER_H};
      const danger={x:x-26,y:y-18,w:PLAYER_W+52,h:PLAYER_H+36};
      if(hazards?.some((hazard)=>hazardIsActive(hazard)&&overlap(danger,{x:hazard.x-18,y:hazard.y-18,w:hazard.w+36,h:hazard.h+36})))continue;
      if(breakables?.some((wall)=>wall.alive&&overlap(body,wall)))continue;
      if(options.avoidBoss&&boss?.alive&&overlap({x:x-12,y:y-8,w:PLAYER_W+24,h:PLAYER_H+16},boss))continue;
      const exactSupport=Math.abs(y-preferredY)<18&&clampedX>=floor.x+18&&clampedX+PLAYER_W<=floor.x+floor.w-18;
      const stableBonus=floor.safe||floor.bossArena||floor.mazeFloor?120:0;
      const score=(exactSupport?-10000:0)+Math.abs(x-clampedX)+Math.abs(y-preferredY)*1.25-stableBonus;
      candidates.push({x,y,grounded:true,platform:floor,score});
    }
    candidates.sort((a,b)=>a.score-b.score);
    if(candidates.length)return candidates[0];
    if(player&&Number.isFinite(player.lastSafeX)&&Number.isFinite(player.lastSafeY))return {x:player.lastSafeX,y:player.lastSafeY,grounded:true,platform:null};
    const fallback=safeSpawnNear(clampedX,preferredY+PLAYER_H);
    return {x:fallback.x,y:fallback.y,grounded:true,platform:fallback.platform||null};
  }

  function placePlayerSafely(preferredX,preferredY,options={}) {
    const safe=safePlayerPositionNear(preferredX,preferredY,options);
    player.x=safe.x;player.y=safe.y;player.previousY=safe.y;player.vx=0;player.vy=0;player.grounded=!!safe.grounded;
    player.dropTimer=0;player.downHeld=false;player.crouching=false;
    if(safe.grounded){player.lastSafeX=safe.x;player.lastSafeY=safe.y;}
    return safe;
  }

  function buildStageGimmicks(stage) {
    gimmicks=[];
    const arenaLimit=stage.bossType?WORLD_WIDTH-BOSS_ARENA_WIDTH-280:WORLD_WIDTH-320;
    const usableFloors=staticPlatforms.filter((floor)=>!floor.ceiling&&floor.w>=360&&floor.x>420&&floor.x<arenaLimit&&floor.y<WORLD_HEIGHT-20);
    const clearSpot=(floor,ratio=.5,width=240)=>{
      if(!floor)return null;const x=Math.max(floor.x+42,Math.min(floor.x+floor.w-width-42,floor.x+floor.w*ratio-width/2));
      const zone={x:x-45,y:floor.y-145,w:width+90,h:160};
      if(hazards.some((hazard)=>overlap(zone,hazard))||enemies.some((enemy)=>overlap(zone,enemy)))return null;
      return {x,y:floor.y};
    };
    const findClearSpot=(worldRatio,minWidth,width,ratios=[.5])=>{
      const ordered=usableFloors.filter((floor)=>floor.w>=minWidth).sort((a,b)=>
        Math.abs(a.x+a.w/2-WORLD_WIDTH*worldRatio)-Math.abs(b.x+b.w/2-WORLD_WIDTH*worldRatio));
      for(const floor of ordered)for(const ratio of ratios){const spot=clearSpot(floor,ratio,width);if(spot)return spot;}
      return null;
    };
    if(!stage.water){
      for(const [ratio,direction] of [[.18,1],[.58,1]]){
        const spot=findClearSpot(ratio,430,240,[.48,.24,.72]);if(spot)gimmicks.push({type:'boostRail',x:spot.x,y:spot.y-16,w:240,h:16,direction,cooldown:0,phase:ratio*9});
      }
      const laserSpot=findClearSpot(stage.maze ? .48 : .39,390,270,[.52,.24,.76]);
      if(laserSpot)gimmicks.push({type:'scanLaser',x:laserSpot.x,y:laserSpot.y-80,w:270,h:14,phaseOffset:(currentStage%3)*.6,warningPlayed:false});
      const source=findClearSpot(stage.maze ? .24 : .72,390,78,[.28,.5,.72]),exit=findClearSpot(stage.maze ? .68 : .86,390,78,[.66,.42,.82]);
      if(source&&exit&&exit.x-source.x>420)gimmicks.push({type:'phaseGate',x:source.x,y:source.y-108,w:78,h:108,targetX:exit.x,targetY:exit.y-PLAYER_H,cooldown:0,phase:currentStage});
    }else{
      for(const ratio of[.28,.61])gimmicks.push({type:'bubbleJet',x:WORLD_WIDTH*ratio,y:220+(ratio>.5?150:0),w:145,h:175,direction:ratio>.5?-1:1,cooldown:0,phase:ratio*10});
    }
  }

  function makeEnemy([type, x, y]) {
    const profile = ENEMY_PROFILES[type] || ENEMY_PROFILES.phoneBot;
    const floor = profile.flying ? null : surfaceAt(x,y+profile.h);
    return { type, behavior:profile.behavior, attack:profile.attack, alternateAttack:profile.alternate, attackCycle:0, heavy:!!profile.heavy, aquatic:!!profile.aquatic, flying:!!profile.flying,
      x, y:floor ? floor.y-profile.h : y, w:profile.w, h:profile.h,
      vx:profile.behavior==='walker'?-profile.speed:profile.behavior==='charger'?-profile.speed*.55:profile.flying?profile.speed:0,
      speed:profile.speed, vy:0, originX:x, originY:y, grounded:false, alive:true, hp:profile.hp||1, maxHp:profile.hp||1, hit:0,
      cooldown:3.4+(x%7)/5, shotCharge:0, attackCooldown:5.8+(x%11)/5, attackCharge:0, pendingAttack:profile.attack,
      targetX:x, targetY:y, aimFacing:-1, dashCharge:0, phase:x/80, squish:0, warning:0,
      allied:false,allyCooldown:0,allyBurst:0,allyTarget:null };
  }

  function buildRuntimeTerrain(stage) {
    const solidFloors=staticPlatforms.filter((platform)=>!platform.ceiling&&platform.w>=180&&platform.y<WORLD_HEIGHT-35).sort((a,b)=>a.x-b.x||b.y-a.y);
    const movingCount=stage.water?0:stage.maze?5:stage.chaseWall?4:Math.min(7,4+currentStage);
    movingPlatforms=Array.from({length:movingCount},(_,i)=>{
      const anchor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(movingCount+1)))] || {x:700+i*900,y:FLOOR_Y};
      const vertical=stage.maze || i%2===1;
      const x=Math.min(WORLD_WIDTH-180,anchor.x+Math.max(70,anchor.w*.55));
      const y=Math.max(180,anchor.y-(vertical?175:115));
      return {x,y,baseX:x,baseY:y,w:vertical?138:164,h:20,axis:vertical?'y':'x',range:stage.maze?105:66+i*7,speed:.66+i*.10,lastX:x,lastY:y};
    });

    const fragileCount=stage.water?0:stage.maze?6:stage.chaseWall?3:Math.min(5,3+Math.floor(currentStage/3));
    fragilePlatforms=Array.from({length:fragileCount},(_,i)=>{
      const anchor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(fragileCount+1)))] || {x:500+i*900,y:FLOOR_Y};
      return {x:anchor.x+Math.min(anchor.w-145,85+(i%3)*70),y:anchor.y-105-(i%2)*62,w:112+(i%2)*18,h:18,kind:i%2?'vanish':'crumble',timer:0,active:true};
    });

    if(stage.water){
      const waterHazardCount=stage.bossType==='shark'?7:9;
      hazards=Array.from({length:waterHazardCount},(_,i)=>({x:720+i*(stage.bossType==='shark'?1180:980),y:190+(i%4)*105,w:i%3===0?46:92,h:i%3===0?46:42,type:i%3===0?'mine':i%3===1?'electric':'spike',phase:i,targetY:690}));
      fallingHazards=[];
    }else{
      const hazardCount=stage.chaseWall?3:stage.maze?6:Math.min(6,4+Math.floor(currentStage/4));
      hazards=Array.from({length:hazardCount},(_,i)=>{
        const floor=solidFloors[Math.min(solidFloors.length-1,Math.floor((i+1)*solidFloors.length/(hazardCount+1)))] || {x:600+i*700,y:FLOOR_Y,w:300};
        const type=i%5===2?'electric':i%5===4?'fire':i%5===3?'spinner':'spike';
        const w=type==='spinner'?66:92+(i%2)*18;
        const h=type==='spike'?48:type==='electric'?42:34;
        return {x:floor.x+Math.max(70,Math.min(floor.w-w-70,floor.w*(.40+(i%3)*.13))),y:floor.y-h,w,h,type,phase:i,targetY:floor.y};
      });
      const fallingCount=stage.chaseWall?1:stage.maze?3:Math.min(4,2+Math.floor(currentStage/4));
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
    if(!STAGES[currentStage].maze){
      breakables=breakables.filter((wall)=>
        !enemies.some((enemy)=>Math.abs((enemy.x+enemy.w/2)-(wall.x+wall.w/2))<190)&&
        !hazards.some((hazard)=>Math.abs((hazard.x+hazard.w/2)-(wall.x+wall.w/2))<135));
      if(!breakables.length){
        const safeFloor=staticPlatforms.find((floor)=>floor.w>420&&floor.x>760&&floor.x<WORLD_WIDTH-1200&&
          !enemies.some((enemy)=>Math.abs((enemy.x+enemy.w/2)-(floor.x+floor.w*.22))<210)&&
          !hazards.some((hazard)=>Math.abs((hazard.x+hazard.w/2)-(floor.x+floor.w*.22))<150));
        if(safeFloor)breakables.push({x:safeFloor.x+safeFloor.w*.22,y:safeFloor.y-72,w:58,h:72,alive:true});
      }
    }
    buildStageGimmicks(STAGES[currentStage]);
    const initialFloor=surfaceAt(150,FLOOR_Y);
    const initialSpawn = safeSpawnNear(150,initialFloor?.y||FLOOR_Y);
    player = { x:initialSpawn.x, y:initialSpawn.y, w:PLAYER_W, h:PLAYER_H, vx:0, vy:0,
      grounded:!STAGES[currentStage].water, physicsReady:false, hp:3, maxHp:3, coins:0, score:0, invincible:0, state:'idle', anim:0,
      facing:1, lastFacing:1, turnPoseTime:0, jumpHeld:false, jumpCount:0, spin:0, justLanded:0, spawnX:initialSpawn.x, spawnY:initialSpawn.y, spawnCamera:0,
      checkpointHp:3, checkpointCoins:0, checkpointScore:0, checkpointCoinSpeed:0, dead:false, respawnTimer:0, respawnMessage:'', dash:100, boost:0, clearTime:0,
      healDelay:0, healTick:0, shields:0, shieldHit:0, hasSword:false, attackHeld:false, attackTime:0, attackCooldown:0,
      rushPulse:0, kingBossHitCooldown:0, previousY:initialSpawn.y, lastSafeX:initialSpawn.x, lastSafeY:initialSpawn.y, voidRecoveries:0,
      dropTimer:0, downHeld:false, crouching:false, chargeTime:0, coinSpeed:0,speedTier:0,speedBurst:0,
      dashPoseTime:0, dashDirection:1,
      wingHeld:false,wingAttackTime:0,wingCooldown:0,wingAttackFired:false,jumpPoseTime:0,doubleJumpPose:0,hurtTime:0,
      specialHeld:false,specialTime:0,specialCooldown:0,specialUsed:false,specialFired:false,specialTick:0,specialShots:0,specialTargets:[],ultimateSequence:null,skidTime:0,
      idleTime:0,idleAction:null,idleActionTime:0,nextIdleAction:2.2+Math.random()*2.2,blinkTime:0,nextBlink:1.4+Math.random()*2.8,
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
    shieldShards=[]; rushTrails=[];speedTrails=[];wingShots=[];kingClones=[];enemyVolleyLock=0;
    checkpoints=buildCheckpoints(STAGES[currentStage]);
    const goalFloor=STAGES[currentStage].water?null:surfaceAt(WORLD_WIDTH-190,WORLD_HEIGHT-180);
    goal = { x:WORLD_WIDTH-190, y:STAGES[currentStage].water?280:(goalFloor?goalFloor.y-180:FLOOR_Y-180) };
    const stageBoss=STAGES[currentStage].bossType;
    const arenaX=WORLD_WIDTH-BOSS_ARENA_WIDTH;
    boss = stageBoss ? (stageBoss==='shark'
      ? {type:'shark',name:'ABYSS MECHA SHARK',x:WORLD_WIDTH-720,y:235,w:300,h:170,hp:30,maxHp:30,vx:0,vy:0,alive:true,active:false,hit:0,phase:1,state:'dormant',timer:0,cooldown:2.7,grounded:false,intro:false,introLock:0,recovery:0,attackIndex:0,attackFired:false,targetX:0,targetY:0,defeat:0,originY:235,arenaLeft:arenaX+45,arenaRight:WORLD_WIDTH-230}
      : {type:'titan',name:'MEGA BUG TITAN',x:WORLD_WIDTH-700,y:FLOOR_Y-270,w:220,h:270,hp:24,maxHp:24,vx:0,vy:0,alive:true,active:false,hit:0,phase:1,state:'dormant',timer:0,cooldown:2.8,grounded:true,intro:false,introLock:0,recovery:0,attackIndex:0,attackFired:false,targetX:0,targetY:0,defeat:0,arenaLeft:arenaX+45,arenaRight:WORLD_WIDTH-230}) : null;
    // Both bosses telegraph the sword well before the arena gate so players can
    // learn ATTACK and enter the fight already armed.
    swordItem = stageBoss ? {x:arenaX-660,y:stageBoss==='shark'?300:FLOOR_Y-85,w:42,h:58,collected:false} : null;
    bossGate = stageBoss ? {x:arenaX,y:stageBoss==='shark'?72:FLOOR_Y-300,w:32,h:stageBoss==='shark'?690:300,closed:false} : null;
    if(stageBoss){
      hazards=hazards.filter((hazard)=>hazard.x<arenaX-160);fallingHazards=fallingHazards.filter((hazard)=>hazard.x<arenaX-160);
      movingPlatforms=movingPlatforms.filter((platform)=>platform.x<arenaX-100);fragilePlatforms=fragilePlatforms.filter((platform)=>platform.x<arenaX-100);
      breakables=breakables.filter((wall)=>wall.x<arenaX-120);
    }
    projectiles=[]; wingShots=[];shockwaves=[]; combatFx=[]; kingClones=[]; bossIntro=0; hitStop=0; bossDefeated=false; goalUnlocked=!boss;
    currents=STAGES[currentStage].water?Array.from({length:Math.ceil(WORLD_WIDTH/720)},(_,i)=>({x:500+i*720,y:130+(i%4)*120,w:390,h:150,force:(i%3===2?-1:1)*(90+(i%4)*35)})).filter((current)=>!stageBoss||current.x<arenaX-180):[];
    bubbles=STAGES[currentStage].water?Array.from({length:Math.ceil(WORLD_WIDTH/590)},(_,i)=>({x:350+i*590,y:150+(i%4)*130,r:32,phase:i})):[];
    chaserWall=STAGES[currentStage].chaseWall?{x:-320,w:190,speed:76,maxSpeed:305,warning:0,warningCooldown:0}:null;
    oxygen=100; oxygenDamageTimer=0; ui.oxygenHud.classList.toggle('hidden',!STAGES[currentStage].water);
    ui.ultimateCutin?.classList.add('hidden');ui.notice?.classList.remove('ultimate-speech');
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
    if(!cleared)window.RepairHeroSound?.music(null);
    ui.hud.classList.add('hidden');
    ui.touch.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.bossHud.classList.add('hidden'); ui.attack.classList.add('hidden');
    $('#resultKicker').textContent = cleared ? 'STAGE CLEAR!' : 'GAME OVER';
    $('#resultTitle').textContent = cleared ? (currentStage === STAGES.length-1 ? '全ステージ修理完了！' : `${STAGES[currentStage].id} 修理完了！`) : 'もう一度挑戦！';
    $('#next').classList.toggle('hidden', !cleared || currentStage === STAGES.length-1);
    $('#resultStats').textContent = `SCORE ${String(player.score).padStart(6, '0')}　COIN ${player.coins}　TIME ${Math.ceil(remainingTime)}`;
    activeResultPose={mode:completedMode,state:cleared?'goal':'revive'};
    drawStateFrameToCanvas(ui.resultFeni,activeResultPose.mode,activeResultPose.state);
    ui.resultFeni.setAttribute?.('aria-label',`${MODE_NAMES[completedMode]||'NORMAL MODE'}で喜ぶフェニちゃん`);
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

  function drawStateFrameToCanvas(targetCanvas,modeName,stateName) {
    if(!targetCanvas)return false;
    const stateFrame=STATE_FRAME_INDEX[stateName];
    const sheet=stateFrame===undefined?(playerMotionSheets[modeName]||playerMotionSheets.normal):(playerStateSheets[modeName]||playerStateSheets.normal);
    if(!sheet?.ready||!sheet.drawable)return false;
    const frame=stateFrame===undefined?MOTION_FRAME_INDEX[stateName]:stateFrame;if(frame===undefined)return false;
    const columns=stateFrame===undefined?4:3,rows=stateFrame===undefined?4:2;
    const targetCtx=targetCanvas.getContext('2d');const sw=sheet.drawable.width/columns,sh=sheet.drawable.height/rows;
    targetCtx.clearRect(0,0,targetCanvas.width,targetCanvas.height);
    targetCtx.drawImage(sheet.drawable,(frame%columns)*sw,Math.floor(frame/columns)*sh,sw,sh,0,0,targetCanvas.width,targetCanvas.height);
    return true;
  }

  function hideNotice() {
    ui.notice.classList.remove('show','speech','ultimate-speech');
    activeNoticePose=null;
  }

  function showUltimateCutin(modeName) {
    if(!ui.ultimateCutin)return;
    ui.ultimateCutin.classList.remove('hidden','battery','lcd','muscle','king');
    if(modeName!=='normal')ui.ultimateCutin.classList.add(modeName);
    ui.ultimateCutinMode.textContent=MODE_NAMES[modeName]||'NORMAL MODE';
    ui.ultimateCutinName.textContent=ULTIMATE_NAMES[modeName];
    drawStateFrameToCanvas(ui.ultimateCutinPortrait,modeName,modeName==='king'?'stretch':'alert');
  }

  function hideUltimateCutin() {
    ui.ultimateCutin?.classList.add('hidden');
  }

  function say(text, expression=null, expressionMode=playerMode, kind=null) {
    (ui.noticeText||ui.notice).textContent = text;
    const speech=!!expression;ui.notice.classList.remove('ultimate-speech');ui.notice.classList.toggle('speech',speech);
    if(kind==='ultimate')ui.notice.classList.add('ultimate-speech');
    activeNoticePose=speech?{mode:expressionMode||'normal',state:expression}:null;
    if(speech)drawStateFrameToCanvas(ui.noticePortrait,activeNoticePose.mode,activeNoticePose.state);
    else ui.noticePortrait?.getContext('2d')?.clearRect(0,0,ui.noticePortrait.width,ui.noticePortrait.height);
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

  function playerDamageBox() {
    if(player?.crouching&&!STAGES[currentStage].water)return {x:player.x+7,y:player.y+54,w:player.w-14,h:player.h-54};
    return {x:player.x+5,y:player.y+5,w:player.w-10,h:player.h-7};
  }

  const ENEMY_SHOT_RULES = {
    aimedBolt:{range:520,life:2.9}, spread:{range:500,life:2.8}, burst:{range:470,life:2.7}, pulse:{range:480,life:2.8},
    scan:{range:460,life:2.5}, saw:{range:440,life:2.6}, mine:{range:360,life:3}, rail:{range:560,life:2.7}, debris:{range:460,life:2.8},
    bubble:{range:430,life:3}, electric:{range:420,life:2.7}, lightning:{range:390,life:2.2}, missile:{range:610,life:3.1},
    torpedo:{range:620,life:3.2}, depthCharge:{range:390,life:2.8}, diveShot:{range:520,life:2.7}, fireRain:{range:410,life:2.5}, bolt:{range:520,life:2.8}
  };
  const BOSS_SHOT_RULES = {
    torpedo:{range:760,life:3.3}, bossOrb:{range:680,life:3.2}, waterBlade:{range:700,life:3.1}, magma:{range:620,life:3}, bossWave:{range:720,life:3.2}
  };

  function trimPool(pool, max) {
    if (pool.length > max) pool.splice(0,pool.length-max);
  }

  function effectCount(count, minimum=2) {
    return reducedEffects ? Math.max(minimum,Math.ceil(count*.56)) : count;
  }

  function visibleInCamera(rect, margin=150) {
    return rect.x+(rect.w||0)>=cameraX-margin&&rect.x<=cameraX+viewportWidth+margin&&
      rect.y+(rect.h||0)>=cameraY-margin&&rect.y<=cameraY+viewportHeight+margin;
  }

  function projectileOutsideView(projectile, margin=260) {
    return projectile.x+projectile.w<cameraX-margin||projectile.x>cameraX+viewportWidth+margin||
      projectile.y+projectile.h<cameraY-margin||projectile.y>cameraY+viewportHeight+margin;
  }

  function projectileTravel(projectile) {
    return Math.hypot(projectile.x-(projectile.originX??projectile.x),projectile.y-(projectile.originY??projectile.y));
  }

  function projectileHitsTerrain(box) {
    return staticPlatforms.some((platform)=>overlap(box,platform))||movingPlatforms.some((platform)=>overlap(box,platform))||
      fragilePlatforms.some((platform)=>platform.active&&overlap(box,platform))||breakables.some((wall)=>wall.alive&&overlap(box,wall))||!!(bossGate?.closed&&overlap(box,bossGate));
  }

  function projectileHitsHardWall(box) {
    return staticPlatforms.some((platform)=>platform.fixedWall&&overlap(box,platform))||breakables.some((wall)=>wall.alive&&overlap(box,wall))||!!(bossGate?.closed&&overlap(box,bossGate));
  }

  function spawnEnemyShot(options) {
    const kind=options.kind||'bolt';const rule=ENEMY_SHOT_RULES[kind]||ENEMY_SHOT_RULES.bolt;
    const projectile={energy:true,w:20,h:20,...options,kind,owner:'enemy',originX:options.x,originY:options.y,
      maxDistance:options.maxDistance||rule.range,life:Math.min(options.life||rule.life,rule.life),dead:false};
    droplets.push(projectile);trimPool(droplets,MAX_ENEMY_PROJECTILES);return projectile;
  }

  function spawnBossShot(options) {
    const kind=options.kind||'bossOrb';const rule=BOSS_SHOT_RULES[kind]||BOSS_SHOT_RULES.bossOrb;
    const projectile={w:24,h:24,...options,kind,owner:'boss',originX:options.x,originY:options.y,
      maxDistance:options.maxDistance||rule.range,life:Math.min(options.life||rule.life,rule.life),dead:false};
    projectiles.push(projectile);trimPool(projectiles,MAX_BOSS_PROJECTILES);return projectile;
  }

  function coinSpeedTier(count=player?.coins||0) { return count>=10?2:count>=5?1:0; }
  function coinSpeedBonus(count=player?.coins||0) { return coinSpeedTier(count)===2?125:coinSpeedTier(count)===1?65:0; }
  function coinDashBonus(count=player?.coins||0) { return coinSpeedTier(count)===2?72:coinSpeedTier(count)===1?36:0; }

  function triggerCoinSpeed(previousCoins) {
    const previousTier=coinSpeedTier(previousCoins),nextTier=coinSpeedTier(player.coins);
    player.coinSpeed=coinSpeedBonus(player.coins);player.speedTier=nextTier;
    if(nextTier<=previousTier)return;
    player.speedBurst=nextTier===2?1.25:.85;
    say(nextTier===2?'SUPER SPEED UP!!\nMAX SPEED':'SPEED UP!\nMEDIUM SPEED');
    sound(nextTier===2?'speedMax':'speedUp');
    const amount=effectCount(nextTier===2?34:18,10);
    for(let i=0;i<amount;i++)speedTrails.push({x:player.x+player.w/2+(Math.random()-.5)*75,y:player.y+Math.random()*player.h,
      vx:-player.facing*(260+Math.random()*(nextTier===2?620:340)),life:.28+Math.random()*.42,size:2+Math.random()*(nextTier===2?7:4),tier:nextTier});
    trimPool(speedTrails,80);
  }

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
    for (let i = 0; i < effectCount(amount,1); i += 1) {
      dust.push({ x: x + Math.random() * 18, y, vx: -player.facing * (25 + Math.random() * 45),
        vy: -25 - Math.random() * 35, life: .35 + Math.random() * .25, size: 4 + Math.random() * 6 });
    }
  }

  function scoreValue(points) { return playerMode === 'lcd' ? points * 2 : points; }

  function clearMode(playSound = true) {
    if (playerMode === 'normal') return;
    for(const enemy of enemies||[]){if(enemy.allied){enemy.alive=false;enemy.squish=0;enemy.allied=false;}}
    kingClones=[];
    playerMode = 'normal';
    modeTimer = 0;
    flightSoundTimer = 0;
    modeParticles = [];
    player.shields = 0;
    player.attackTime = 0; player.attackCooldown = 0; player.attackHeld = false;
    player.specialTime=0;player.specialUsed=false;player.specialFired=false;player.specialTargets=[];player.ultimateSequence=null;player.specialCooldown=Math.min(player.specialCooldown,2.5);
    ui.ultimateCutin?.classList.add('hidden');ui.notice?.classList.remove('ultimate-speech');
    document.body.classList.remove('king-mode');
    ui.shieldCount.className = 'shield-count hidden';
    ui.attack.classList.toggle('hidden', !player.hasSword); ui.attack.classList.remove('punch');
    ui.modeHud.className = 'mode-hud hidden';
    if (playSound) { sound('transformEnd'); say('NORMAL MODE'); }
  }

  function emitModeParticles(modeName, amount) {
    const colors = { normal:['#ff6a32','#ffd338'], battery: ['#54ff72', '#d8ff76'], lcd: ['#48eaff', '#ffffff'], king: ['#ffd338', '#ff8a20', '#fff7b0'], muscle:['#ff542f','#ffd338','#fff'] }[modeName]||['#fff','#ffd338'];
    const count=effectCount(amount,1);
    for (let i = 0; i < count; i += 1) modeParticles.push({
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
    player.specialTime=0;player.specialCooldown=0;player.specialUsed=false;player.specialFired=false;player.specialTick=0;player.specialTargets=[];player.ultimateSequence=null;
    ui.ultimateCutin?.classList.add('hidden');ui.notice?.classList.remove('ultimate-speech');
    if (nextMode === 'battery') { player.healDelay = 0; player.healTick = 0; }
    if (nextMode === 'lcd') { player.shields = 5; player.shieldHit = 0; }
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
    if (player.ultimateSequence) return;
    modeTimer = Math.max(0, modeTimer - dt);
    const rate = playerMode === 'king' ? 18 : 10;
    if (Math.floor(elapsed * rate) !== Math.floor((elapsed - dt) * rate)) emitModeParticles(playerMode, playerMode === 'king' ? 3 : 1);
    if (playerMode === 'king' && (input.jump||input.up||input.down||input.left||input.right)) {
      flightSoundTimer -= dt;
      if (flightSoundTimer <= 0) { sound('kingFlight'); flightSoundTimer = .55; }
    }
    if (playerMode === 'battery') {
      player.healTick += dt;
      if (player.healTick >= .55 && player.hp < player.maxHp) {
        player.healTick = 0; player.hp = Math.min(player.maxHp, player.hp + .25); sound('heal'); emitModeParticles('battery', 8);
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
      for(let i=0;i<effectCount(26,12);i++) shieldShards.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:(Math.random()-.5)*520,vy:(Math.random()-.5)*470,life:.45+Math.random()*.4,size:4+Math.random()*9});
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
    player.hurtTime = .34;
    player.idleAction = null; player.idleTime = 0;
    shake = 14;
    sound('damage');
    updateHud();
    if (player.hp <= 0) {
      player.dead = true;
      player.respawnTimer=.65;player.respawnMessage='REPAIR RESTART!';
    }
  }

  function respawnAtCheckpoint(message) {
    const respawnMode=playerMode;
    clearMode(false);
    player.hp = Math.max(2,player.checkpointHp);
    player.coins = player.checkpointCoins;
    player.score = player.checkpointScore;
    player.coinSpeed = player.checkpointCoinSpeed;
    player.speedTier = coinSpeedTier(player.coins);
    player.dead = false;
    player.respawnTimer = 0;player.respawnMessage = '';
    placePlayerSafely(player.spawnX,player.spawnY,{allowAir:STAGES[currentStage].water});
    player.physicsReady=true;
    player.invincible = 1.8;
    player.jumpCount = 0;
    player.spin = 0;
    player.attackTime=0;player.attackCooldown=0;player.attackHeld=false;player.wingAttackTime=0;player.wingCooldown=0;player.wingHeld=false;
    player.specialTime=0;player.specialCooldown=0;player.specialUsed=false;player.specialHeld=false;player.specialFired=false;player.specialTargets=[];player.ultimateSequence=null;kingClones=[];
    player.dashPoseTime=0;player.turnPoseTime=0;player.lastFacing=player.facing;player.hurtTime=0;player.speedBurst=0;player.idleTime=0;player.idleAction=null;player.idleActionTime=0;player.crouching=false;player.downHeld=false;
    input.down=false;input.up=false;input.jump=false;
    player.revivePose = 1.6;
    cameraX = player.spawnCamera;
    droplets = [];
    if(chaserWall)chaserWall.x=Math.max(-320,player.spawnX-760);
    if (STAGES[currentStage].water) oxygen = 100;
    say(`${message}\n何度でも蘇る！！`,'revive',respawnMode);
    sound('revive');
    for(let i=0;i<effectCount(26,12);i++)combatFx.push({x:player.x+player.w/2+(Math.random()-.5)*90,y:player.y+player.h/2+(Math.random()-.5)*120,life:.55+Math.random()*.45,size:18+Math.random()*22,type:'gold'});
    updateHud();
  }

  function respawnAfterFall() {
    sound('damage');
    shake = 18;
    player.voidRecoveries=(player.voidRecoveries||0)+1;
    respawnAtCheckpoint('落下！ チェックポイントから再開');
  }

  function damageBoss(amount, force = 0) {
    if (!boss?.alive || !boss.active || boss.hit > 0 || boss.state === 'dormant'||boss.state==='intro') return false;
    boss.hp = Math.max(0, boss.hp - amount); boss.hit = .34; boss.vx += player.facing * force;
    player.score += scoreValue(amount * 700); shake = amount >= 4 ? 25 : 12;
    combatFx.push({x:boss.x+boss.w/2,y:boss.y+boss.h/2,life:.55,size:amount>=4?125:65,type:amount>=4?'punch':'slash'});
    sound(amount >= 4 ? 'punchHit' : 'swordHit');
    if (amount >= 4) { hitStop=reducedEffects ? .035 : .10; slowMotion=reducedEffects?0:.16; shockwaves.push({x:boss.x,y:FLOOR_Y-28,w:20,vx:player.facing*330,life:.8,friendly:true}); }
    const ratio=boss.hp/boss.maxHp;const nextPhase=ratio<=.29?3:ratio<=.59?2:1;
    if(nextPhase>boss.phase){boss.phase=nextPhase;boss.cooldown=.95;boss.state=boss.type==='shark'?'swim':'chase';boss.timer=0;boss.attackFired=false;boss.attackName=null;boss.submerged=false;if(boss.type==='shark')boss.vy=0;document.body.classList.add('boss-phase2');say(nextPhase===3?'FINAL PHASE!!\nLIMIT BREAK':'PHASE 2!!\nOVERDRIVE');if(nextPhase===2)window.RepairHeroSound?.music('boss2');sound('bossWarning');}
    if (boss.hp <= 0) { boss.alive=false; bossDefeated=true; boss.state='defeated'; boss.defeat=.001; boss.vx=0; boss.vy=0; slowMotion=.75; sound('bossDown'); }
    return true;
  }

  function performAttack() {
    if ((!player.hasSword && playerMode !== 'muscle') || player.attackCooldown > 0 || player.wingAttackTime>0 || player.specialTime>0 || player.ultimateSequence || player.dead) return;
    const punch = playerMode === 'muscle'&&!player.hasSword;
    player.attackTime = punch ? .86 : SWORD_ATTACK_DURATION; player.attackCooldown = punch ? 1.08 : .48;
    player.rushPulse = punch ? .86 : 0;
    const range = punch ? Math.max(260,Math.min(1120,viewportWidth*.72)) : 105;
    const contactRange = punch ? 155 : range;
    const front=player.facing>0?player.x+player.w:player.x;
    const hitbox={x:player.facing>0?front-4:front-contactRange+4,y:player.y+28,w:contactRange,h:44};
    sound(punch?'rushPunch':'attack');sound(punch?'punchHit':'sword');
    if (punch || playerMode !== 'normal') combatFx.push({x:punch?front+player.facing*range*.62:player.facing>0?hitbox.x+range:hitbox.x,y:hitbox.y+22,life:punch ? 0.48 : 0.25,size:range,type:punch?'punch':'slash'});
    if(punch){
      shake=reducedEffects?20:28;hitStop=reducedEffects ? .018 : .045;slowMotion=reducedEffects?0:.08;
      for(let i=0;i<effectCount(42,20);i++){
        const depth=Math.random()*Math.min(range*.55,420);
        rushTrails.push({x:front+player.facing*depth,y:player.y+22+Math.random()*70,vx:player.facing*(420+Math.random()*720),life:.22+Math.random()*.3,delay:i*.012,size:14+Math.random()*24,facing:player.facing});
        sparks.push({x:front+player.facing*Math.random()*range*.4,y:player.y+30+Math.random()*60,vx:player.facing*(260+Math.random()*760),vy:(Math.random()-.5)*520,life:.25+Math.random()*.42,size:3+Math.random()*8});
      }
      shockwaves.push({kind:'rush',x:front,y:player.y+player.h*.53,w:42,h:94,vx:player.facing*1480,life:range/1480+.12,friendly:true,
        originX:front,maxDistance:range,damage:900,bossDamage:5,breaksWalls:true,hitEnemies:new Set(),bossHit:false});
    }else{
      const slashRange=Math.max(360,Math.min(820,viewportWidth*.62));
      shake=Math.max(shake,reducedEffects?8:12);hitStop=reducedEffects ? .01 : .025;
      combatFx.push({x:front+player.facing*68,y:player.y+player.h*.52,life:.34,size:120,type:'slash'});
      for(let i=0;i<effectCount(24,10);i++)sparks.push({x:front+player.facing*Math.random()*115,y:player.y+18+Math.random()*82,
        vx:player.facing*(210+Math.random()*640),vy:(Math.random()-.6)*390,life:.22+Math.random()*.38,size:3+Math.random()*7});
      shockwaves.push({kind:'slash',x:front,y:player.y+player.h*.54,w:34,h:112,vx:player.facing*1180,life:slashRange/1180+.14,friendly:true,
        originX:front,maxDistance:slashRange,damage:650,bossDamage:1,breaksWalls:true,hitEnemies:new Set(),bossHit:false});
    }
    if (boss?.alive && overlap(hitbox,{x:boss.x,y:boss.y+70,w:boss.w,h:boss.h-70})) damageBoss(punch?6:2,punch?360:70);
    for(const enemy of enemies) if(enemy.alive&&overlap(hitbox,enemy)){enemy.vx=player.facing*780;enemy.x+=player.facing*45;damageEnemy(enemy,punch?99:2,punch?'muscle':'sword',500,player.facing*260);if(punch){hitStop=.085;shake=28;}}
  }

  function fireWingShot() {
    const front=player.facing>0?player.x+player.w+8:player.x-8;
    const speed=playerMode==='lcd'?760:playerMode==='king'?820:690;
    wingShots.push({kind:'phoenixWing',x:front,y:player.y+player.h*.43,w:58,h:34,vx:player.facing*speed,vy:0,life:1.15,
      originX:front,originY:player.y+player.h*.43,maxDistance:playerMode==='king'?700:620,damage:1,bossDamage:.75,dead:false,hitEnemies:new Set()});
    trimPool(wingShots,MAX_FRIENDLY_PROJECTILES);sound('wingFire');shake=Math.max(shake,7);
    for(let i=0;i<effectCount(16,8);i++)speedTrails.push({x:front,y:player.y+25+Math.random()*68,vx:-player.facing*(190+Math.random()*420),life:.2+Math.random()*.28,size:2+Math.random()*5,tier:3});
    trimPool(speedTrails,reducedEffects?44:80);
  }

  function performWingAttack() {
    if(player.dead||player.clearTime||player.wingCooldown>0||player.wingAttackTime>0||player.attackTime>0||player.specialTime>0||player.ultimateSequence)return;
    player.wingAttackTime=.62;player.wingCooldown=.95;player.wingAttackFired=false;player.state='wingAttack';player.idleAction=null;player.idleTime=0;
    player.vx*=.82;sound('wingCharge');
  }

  function liveHostileEnemies() {
    return enemies.filter((enemy)=>enemy.alive&&!enemy.allied);
  }

  function spawnFriendlyShot(options) {
    const shot={kind:'phoenixWing',x:player.x+player.w/2,y:player.y+player.h/2,w:38,h:24,vx:player.facing*680,vy:0,
      life:1.2,originX:options.x,originY:options.y,maxDistance:680,damage:1,bossDamage:.5,dead:false,hitEnemies:new Set(),...options};
    if(shot.originX===undefined)shot.originX=shot.x;if(shot.originY===undefined)shot.originY=shot.y;
    wingShots.push(shot);trimPool(wingShots,MAX_FRIENDLY_PROJECTILES);return shot;
  }

  function fireUltimateFeather(index=0) {
    const originX=player.x+player.w/2+player.facing*(30+index%3*8),originY=player.y+player.h*.42+(index%5-2)*10;
    const targets=liveHostileEnemies().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const target=targets[index%Math.max(1,targets.length)]||(boss?.alive&&boss.active?boss:null);
    const targetX=target?target.x+target.w/2:originX+player.facing*720,targetY=target?target.y+target.h/2:originY+(index%5-2)*26;
    const aim=aimVelocity(originX,originY,targetX,targetY,720+index%4*28);
    spawnFriendlyShot({kind:'fireFeather',x:originX,y:originY,w:42,h:22,...aim,life:1.35,maxDistance:760,target,
      turnRate:4.8,style:'fire',points:560,bossDamage:.42,clashPower:1});
    sound(index%4===0?'featherVolley':'featherShot');
  }

  function recruitBatteryAlly() {
    let ally=liveHostileEnemies().sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];
    if(!ally){
      const helperType=STAGES[currentStage].water?'subDrone':stageTheme==='sky'?'battleDrone':'phoneBot';
      ally=makeEnemy([helperType,Math.max(30,Math.min(WORLD_WIDTH-140,player.x-player.facing*110)),player.y+18]);
      enemies.push(ally);
    }
    ally.allied=true;ally.flying=true;ally.aquatic=STAGES[currentStage].water;ally.warning=0;ally.attackCharge=0;ally.shotCharge=0;ally.dashCharge=0;
    ally.allyCooldown=.12;ally.allyBurst=1.8;ally.allyTarget=null;ally.vx=0;ally.vy=0;ally.originX=ally.x;ally.originY=ally.y;
    combatFx.push({x:ally.x+ally.w/2,y:ally.y+ally.h/2,life:1,size:110,type:'ally'});sound('allyJoin');
    return ally;
  }

  function spawnOmniRush() {
    const centerX=player.x+player.w/2,centerY=player.y+player.h/2;
    for(let index=0;index<18;index++){
      const angle=index*Math.PI*2/18+(index%2?Math.PI/36:0),speed=900+(index%3)*95;
      spawnFriendlyShot({kind:'radialPunch',x:centerX,y:centerY,w:62,h:40,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
        life:.86,maxDistance:720,piercing:true,breaksWalls:true,style:'muscle',points:780,damage:2,bossDamage:.9,clashPower:3,angle});
    }
    for(let index=0;index<effectCount(70,30);index++){
      const angle=Math.random()*Math.PI*2,speed=260+Math.random()*780;
      sparks.push({x:centerX,y:centerY,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.3+Math.random()*.5,size:3+Math.random()*8});
    }
    combatFx.push({x:centerX,y:centerY,life:.72,size:210,type:'punch'});shake=reducedEffects?25:38;hitStop=reducedEffects ? .032 : .09;slowMotion=reducedEffects?0:.18;sound('omniRush');
  }

  function spawnKingClones() {
    kingClones=[-1,1].map((side,index)=>({x:player.x-side*38,y:player.y+side*24,w:player.w,h:player.h,vx:0,vy:0,
      facing:player.facing,life:Math.max(3,Math.min(12,modeTimer-.2)),attackCooldown:.12+index*.18,target:null,index,phase:index*Math.PI}));
    sound('kingClones');emitModeParticles('king',52);
  }

  function activateUltimatePower(modeName) {
    player.specialTime=modeName==='lcd' ? 1.08 : modeName==='muscle' ? 1.3 : 1.15;player.specialFired=false;player.specialTick=0;
    player.specialShots=modeName==='normal'?18:0;player.specialTargets=[];player.state='special';player.idleAction=null;player.idleTime=0;
    player.vx*=.2;player.invincible=Math.max(player.invincible,modeName==='lcd'?1.45:.55);emitModeParticles(modeName,modeName==='king'?58:36);
    if(modeName==='battery')recruitBatteryAlly();
    else if(modeName==='lcd')player.specialTargets=liveHostileEnemies().sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x)).slice(0,6);
    else if(modeName==='king')spawnKingClones();
  }

  function performUltimate() {
    if(!player||player.dead||player.clearTime||player.specialTime>0||player.ultimateSequence||player.attackTime>0||player.wingAttackTime>0)return false;
    if(playerMode==='normal'&&player.specialCooldown>0)return false;
    if(playerMode!=='normal'&&player.specialUsed)return false;
    player.specialUsed=playerMode!=='normal';player.specialCooldown=playerMode==='normal'?8.5:modeTimer+1;
    player.ultimateSequence={mode:playerMode,phase:'cutin',timer:ULTIMATE_CUTIN_TIME};player.state='special';player.idleAction=null;player.idleTime=0;
    player.vx*=.18;player.invincible=Math.max(player.invincible,ULTIMATE_CUTIN_TIME+ULTIMATE_DIALOGUE_TIME+1.4);
    hideNotice();showUltimateCutin(playerMode);sound('ultimateCharge');
    return true;
  }

  function updateUltimateSequence(dt) {
    const sequence=player.ultimateSequence;if(!sequence)return false;
    if(sequence.mode!==playerMode){hideUltimateCutin();player.ultimateSequence=null;return false;}
    sequence.timer-=dt;player.vx*=Math.pow(.0005,dt);player.state='special';
    if(sequence.timer>0)return true;
    if(sequence.phase==='cutin'){
      sequence.phase='dialogue';sequence.timer=ULTIMATE_DIALOGUE_TIME;hideUltimateCutin();
      say(ULTIMATE_LINES[sequence.mode],'alert',sequence.mode,'ultimate');sound('ultimateVoice');return true;
    }
    hideNotice();player.ultimateSequence=null;activateUltimatePower(sequence.mode);return false;
  }

  function updateUltimate(dt) {
    player.specialCooldown=Math.max(0,player.specialCooldown-dt);
    if(player.specialTime<=0)return;
    const previous=player.specialTime;player.specialTime=Math.max(0,player.specialTime-dt);player.specialTick-=dt;
    if(playerMode==='normal'&&player.specialShots>0&&player.specialTick<=0){
      const fired=18-player.specialShots;fireUltimateFeather(fired);if(player.specialShots%3===0)fireUltimateFeather(fired+7);
      player.specialShots-=1;player.specialTick=.055;shake=Math.max(shake,8);
    }else if(playerMode==='lcd'&&player.specialTick<=0){
      let target=player.specialTargets.shift();while(target&&!target.alive)target=player.specialTargets.shift();
      if(target){
        afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.38,lcd:true,mode:'lcd',state:'dash'});
        player.facing=Math.sign(target.x-player.x)||player.facing;
        const desiredX=target.x-player.facing*(player.w*.72),desiredY=target.y+target.h-player.h;
        placePlayerSafely(desiredX,desiredY,{allowAir:STAGES[currentStage].water});
        defeatEnemy(target,'lcd',900);combatFx.push({x:target.x+target.w/2,y:target.y+target.h/2,life:.45,size:92,type:'teleport'});sound('teleportStrike');
      }else if(!player.specialFired&&boss?.alive&&boss.active){
        player.specialFired=true;const side=player.x<boss.x?-1:1;player.facing=-side;
        const desiredX=Math.max(boss.arenaLeft,Math.min(boss.arenaRight-player.w,boss.x+boss.w/2+side*(boss.w*.62)));
        const desiredY=boss.y+boss.h*.42-player.h/2;
        placePlayerSafely(desiredX,desiredY,{allowAir:STAGES[currentStage].water,avoidBoss:true});
        afterimages.push({x:player.x-side*170,y:player.y,facing:player.facing,life:.42,lcd:true,mode:'lcd',state:'dash'});
        damageBoss(4,150);combatFx.push({x:boss.x+boss.w/2,y:boss.y+boss.h/2,life:.5,size:120,type:'teleport'});sound('teleportStrike');
      }
      player.specialTick=.12;trimPool(afterimages,30);
    }
    if(playerMode==='muscle'&&!player.specialFired&&previous>.76&&player.specialTime<=.76){player.specialFired=true;spawnOmniRush();}
    if(player.specialTime<=0){player.specialShots=0;player.specialTargets=[];player.specialFired=false;}
  }

  function updateBatteryAlly(ally,dt) {
    ally.phase+=dt*4;ally.allyCooldown-=dt;ally.allyBurst=Math.max(0,ally.allyBurst-dt);
    const targets=liveHostileEnemies().filter((enemy)=>enemy!==ally);
    const target=targets.sort((a,b)=>Math.hypot(a.x-ally.x,a.y-ally.y)-Math.hypot(b.x-ally.x,b.y-ally.y))[0]||(boss?.alive&&boss.active?boss:null);
    ally.allyTarget=target;
    const desiredX=target?target.x+target.w/2-player.facing*125:player.x+player.w/2+player.facing*230;
    const desiredY=target?target.y+target.h/2-ally.h/2:player.y-35+Math.sin(elapsed*4)*24;
    const dx=desiredX-(ally.x+ally.w/2),dy=desiredY-ally.y,speed=ally.allyBurst>0?360:245;
    ally.vx+=(Math.max(-speed,Math.min(speed,dx*2.2))-ally.vx)*Math.min(1,dt*5.5);
    ally.vy+=(Math.max(-speed,Math.min(speed,dy*2.2))-ally.vy)*Math.min(1,dt*5.5);
    ally.x=Math.max(15,Math.min(WORLD_WIDTH-ally.w,ally.x+ally.vx*dt));ally.y=Math.max(40,Math.min(WORLD_HEIGHT-ally.h-25,ally.y+ally.vy*dt));
    ally.aimFacing=Math.sign(dx)||ally.aimFacing;
    if(target&&ally.allyCooldown<=0&&Math.hypot(dx,dy)<760){
      const fromX=ally.x+ally.w/2,fromY=ally.y+ally.h*.42,aim=aimVelocity(fromX,fromY,target.x+target.w/2,target.y+target.h/2,ally.allyBurst>0?620:480);
      spawnFriendlyShot({kind:'allyPulse',x:fromX,y:fromY,w:24,h:16,...aim,life:1.2,maxDistance:630,target,turnRate:2.5,
        style:'battery',points:460,bossDamage:.35,clashPower:1});ally.allyCooldown=ally.allyBurst>0 ? .24 : .72;sound('allyShot');
    }
  }

  function updateKingClones(dt) {
    for(const clone of kingClones){
      clone.life-=dt;clone.attackCooldown-=dt;clone.phase+=dt*5;
      const targets=liveHostileEnemies();const target=targets.sort((a,b)=>Math.hypot(a.x-clone.x,a.y-clone.y)-Math.hypot(b.x-clone.x,b.y-clone.y))[0]||(boss?.alive&&boss.active?boss:null);
      clone.target=target;
      const lead=clone.index===0?270:440,desiredX=target?target.x+target.w/2:player.x+player.w/2+player.facing*lead;
      const desiredY=target?target.y+target.h/2:player.y+player.h/2+(clone.index===0?-75:70);
      const dx=desiredX-(clone.x+clone.w/2),dy=desiredY-(clone.y+clone.h/2),distance=Math.hypot(dx,dy)||1,speed=target?620:460;
      clone.vx+=(dx/distance*speed-clone.vx)*Math.min(1,dt*5);clone.vy+=(dy/distance*speed-clone.vy)*Math.min(1,dt*5);
      if(!target&&distance<45){clone.vx*=.75;clone.vy*=.75;}
      clone.x=Math.max(10,Math.min(WORLD_WIDTH-clone.w,clone.x+clone.vx*dt));clone.y=Math.max(25,Math.min(WORLD_HEIGHT-clone.h-25,clone.y+clone.vy*dt));clone.facing=Math.sign(clone.vx)||clone.facing;
      if(target&&clone.attackCooldown<=0&&overlap({x:clone.x-10,y:clone.y-10,w:clone.w+20,h:clone.h+20},target)){
        if(target===boss){if(damageBoss(1.25,120))clone.attackCooldown=.82;}
        else{defeatEnemy(target,'king',820);clone.attackCooldown=.3;}
        combatFx.push({x:target.x+target.w/2,y:target.y+target.h/2,life:.42,size:82,type:'gold'});sound('kingHit');
      }
    }
    kingClones=kingClones.filter((clone)=>clone.life>0&&playerMode==='king');
  }

  function updateCompanions(dt) {
    for(const ally of enemies)if(ally.alive&&ally.allied)updateBatteryAlly(ally,dt);
    if(kingClones.length)updateKingClones(dt);
  }

  function updateIdleMotion(dt,hasControl,speed) {
    player.blinkTime=Math.max(0,player.blinkTime-dt);
    player.nextBlink-=dt;
    if(player.nextBlink<=0){player.blinkTime=.12;player.nextBlink=1.5+Math.random()*3.2;}
    const idleEligible=player.grounded&&speed<18&&!hasControl&&!player.attackTime&&!player.wingAttackTime&&!player.clearTime&&player.revivePose<=0;
    if(!idleEligible){player.idleTime=0;player.idleAction=null;player.idleActionTime=0;player.nextIdleAction=2.1+Math.random()*2.7;return;}
    player.idleTime+=dt;
    if(player.idleAction){
      player.idleActionTime+=dt;
      if(player.idleActionTime>=player.idleActionDuration){player.idleAction=null;player.idleActionTime=0;player.idleTime=0;player.nextIdleAction=2.2+Math.random()*3.6;}
      return;
    }
    if(player.idleTime<player.nextIdleAction)return;
    const choices=['lookLeft','lookRight','lookAround','step','stretch','alert','backLook'];
    player.idleAction=choices[Math.floor(Math.random()*choices.length)];player.idleActionTime=0;
    player.idleActionDuration=player.idleAction==='lookAround'?1.55:player.idleAction==='step'?1.25:.85+Math.random()*.55;
  }

  function updatePlayer(dt) {
    if (player.dead || !player.physicsReady) return;
    player.previousY=player.y;
    player.invincible = Math.max(0, player.invincible - dt);
    player.shieldHit = Math.max(0,player.shieldHit-dt);
    player.kingBossHitCooldown = Math.max(0,player.kingBossHitCooldown-dt);
    player.justLanded = Math.max(0, player.justLanded - dt);
    player.attackCooldown=Math.max(0,player.attackCooldown-dt); player.attackTime=Math.max(0,player.attackTime-dt);
    const previousWingTime=player.wingAttackTime;
    player.wingAttackTime=Math.max(0,player.wingAttackTime-dt);player.wingCooldown=Math.max(0,player.wingCooldown-dt);
    if(previousWingTime>.36&&player.wingAttackTime<=.36&&!player.wingAttackFired){player.wingAttackFired=true;fireWingShot();}
    player.jumpPoseTime=Math.max(0,player.jumpPoseTime-dt);player.doubleJumpPose=Math.max(0,player.doubleJumpPose-dt);player.hurtTime=Math.max(0,player.hurtTime-dt);
    player.turnPoseTime=Math.max(0,player.turnPoseTime-dt);
    player.skidTime=Math.max(0,player.skidTime-dt);
    player.speedBurst=Math.max(0,player.speedBurst-dt);
    player.rushPulse=Math.max(0,player.rushPulse-dt);
    player.dropTimer=Math.max(0,player.dropTimer-dt);
    player.revivePose=Math.max(0,player.revivePose-dt);
    if(player.rushPulse>0&&Math.floor(player.rushPulse*24)!==Math.floor((player.rushPulse+dt)*24)){
      const front=player.facing>0?player.x+player.w:player.x;
      for(let i=0;i<effectCount(4,2);i++) rushTrails.push({x:front+player.facing*Math.random()*95,y:player.y+24+Math.random()*66,vx:player.facing*(580+Math.random()*650),life:.18+Math.random()*.18,delay:0,size:16+Math.random()*22,facing:player.facing});
      shake=Math.max(shake,13);
    }
    const sequenceLocked=updateUltimateSequence(dt);
    updateUltimate(dt);
    if(input.attack&&!player.attackHeld) performAttack();
    player.attackHeld=input.attack;
    if(input.wing&&!player.wingHeld)performWingAttack();
    player.wingHeld=input.wing;
    if(input.special&&!player.specialHeld)performUltimate();
    player.specialHeld=input.special;
    const dashPressed=!sequenceLocked&&(input.dashLeft||input.dashRight);
    const rawDashDirection = Number(input.dashRight) - Number(input.dashLeft);
    const dashDirection = rawDashDirection || (dashPressed ? player.dashDirection || player.facing : 0);
    const groundCrouchIntent=!sequenceLocked&&!STAGES[currentStage].water&&input.down&&!input.up&&!input.jump&&player.grounded;
    const normalDirection = sequenceLocked||groundCrouchIntent ? 0 : Number(input.right) - Number(input.left);
    const direction = dashPressed ? dashDirection : normalDirection;
    const dashing = !!dashPressed;
    player.boost = Math.max(0, player.boost - dt);
    const canDash = dashing && player.dash > 0;
    if(canDash){player.dashDirection=dashDirection;player.dashPoseTime=.18;}
    else player.dashPoseTime=Math.max(0,player.dashPoseTime-dt);
    player.dash = Math.max(0, Math.min(100, player.dash + (canDash ? -DASH_DRAIN_PER_SECOND : DASH_RECOVERY_PER_SECOND) * dt));
    const speedBonus=coinSpeedBonus(player.coins);
    const speedScale = playerMode === 'lcd' ? 1.42 : playerMode === 'battery' ? 1.08 : playerMode === 'king' ? 1.55 : 1;
    const dashSpeed = (playerMode === 'lcd' ? 655 : player.boost ? 610 : playerMode === 'king' ? 760 : 455)+coinDashBonus(player.coins);
    const targetSpeed = direction * (canDash ? dashSpeed : 245 * speedScale+speedBonus);
    if (canDash && Math.floor(elapsed * 9) !== Math.floor((elapsed-dt)*9)) sound('dash');
    const tierAcceleration=player.speedTier===2?1.17:player.speedTier===1?1.08:1;
    const acceleration = (player.grounded ? 1900 : 1050) * (playerMode === 'lcd' ? 1.48 : playerMode === 'king' ? 1.7 : 1)*tierAcceleration;
    player.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - player.vx));
    if (!direction && player.grounded) player.vx *= Math.pow(playerMode === 'lcd' ? .00002 : .0008, dt);
    if(direction&&direction!==player.facing){player.lastFacing=player.facing;player.facing=direction;player.turnPoseTime=.14;player.skidTime=.12;if(player.grounded)spawnDust(player.x+player.w/2,player.y+player.h,2);}
    else if(direction)player.facing=direction;
    if(!direction&&player.grounded&&Math.abs(player.vx)>190)player.skidTime=Math.max(player.skidTime,.08);

    const wantsDrop=!sequenceLocked&&input.down&&!input.up&&!input.jump;
    let droppedThrough=false;
    if(wantsDrop&&!player.downHeld&&!STAGES[currentStage].water){
      const support=allPlatforms().find((platform)=>isOneWayPlatform(platform)&&player.x+player.w>platform.x&&player.x<platform.x+platform.w&&Math.abs(player.y+player.h-platform.y)<10);
      if(support){player.dropTimer=.28;player.y+=12;player.vy=120;player.grounded=false;droppedThrough=true;sound('drop');}
    }
    player.downHeld=wantsDrop;
    player.crouching=groundCrouchIntent&&!droppedThrough&&player.dropTimer<=0;
    player.chargeTime=0;
    if(player.crouching)player.vx*=Math.pow(.0004,dt);

    if (STAGES[currentStage].water) {
      const vertical=sequenceLocked?0:Number(input.down)-Number(input.up||input.jump); player.jumpHeld=input.jump||input.up;
      player.grounded=false; player.vy+=(vertical*(canDash?430:245)-player.vy)*Math.min(1,dt*5); player.vy*=Math.pow(.72,dt);
    } else if (playerMode === 'king'&&!player.crouching) {
      const vertical=sequenceLocked?0:Number(input.down)-Number(input.up||input.jump);
      player.jumpHeld = input.jump||input.up;
      player.grounded = false;
      player.vy += (vertical*(canDash?720:480)-player.vy)*Math.min(1,dt*(vertical?7:4.5));
      player.vy = Math.max(-720,Math.min(720,player.vy));
    } else if (!sequenceLocked && input.jump && !player.jumpHeld && player.jumpCount < MAX_JUMPS) {
      player.jumpCount += 1;
      player.vy = player.jumpCount === 2 ? -720 : -650;
      player.grounded = false;
      player.jumpHeld = true;
      if (player.jumpCount === 2) {
        player.doubleJumpPose=.34;
        player.spin = Math.PI * 2;
        for (let i = 0; i < effectCount(14,7); i += 1) sparks.push({ x:player.x+player.w/2, y:player.y+player.h*.75, vx:(Math.random()-.5)*260, vy:40+Math.random()*190, life:.45+Math.random()*.25, size:3+Math.random()*5 });
        sound('doubleJump');
      } else { player.jumpPoseTime=.14;spawnDust(player.x + player.w / 2, player.y + player.h, 5); sound('jump'); }
    }
    if (playerMode !== 'king' && (!input.jump||sequenceLocked)) player.jumpHeld = false;
    if (playerMode !== 'king' && (!input.jump||sequenceLocked) && player.vy < -220) player.vy += GRAVITY * 1.35 * dt;
    if (player.spin > 0) player.spin = Math.max(0, player.spin - dt * 11);

    const wasGrounded = player.grounded;
    if (playerMode !== 'king' && !STAGES[currentStage].water) player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    if(STAGES[currentStage].water){moveAndCollide(player,dt,true);player.grounded=false;player.y=Math.max(92,Math.min(WORLD_HEIGHT-player.h-30,player.y));}else moveAndCollide(player, dt, true);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));
    if(bossGate?.closed&&boss?.intro&&player.x<bossGate.x+bossGate.w+12){player.x=bossGate.x+bossGate.w+12;player.vx=Math.max(0,player.vx);}
    if (!wasGrounded && player.grounded) {
      player.jumpCount = 0; player.spin = 0; player.justLanded = .20; landingShake = 5;
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
    if(!Number.isFinite(player.x)||!Number.isFinite(player.y)||player.y>WORLD_HEIGHT+70){respawnAfterFall();return;}
    if(player.grounded&&!STAGES[currentStage].water){
      const stable=staticPlatforms.find((platform)=>!platform.ceiling&&player.x+player.w>platform.x+4&&player.x<platform.x+platform.w-4&&Math.abs(player.y+player.h-platform.y)<9);
      const danger=hazards.some((hazard)=>hazardIsActive(hazard)&&overlap(player,hazard));
      if(stable&&!danger){player.lastSafeX=player.x;player.lastSafeY=player.y;}
    }

    const speed = Math.abs(player.vx);
    const hasControl=!!(direction||input.jump||input.up||input.down||input.attack||input.wing||input.special||dashPressed);
    updateIdleMotion(dt,hasControl,speed);
    // Dash has its own short action lock, including airborne frames. Ground,
    // jump and landing updates therefore cannot flicker another sprite into it.
    if(player.hurtTime>0)player.state='hurt';
    else if(player.ultimateSequence||player.specialTime>0)player.state='special';
    else if(player.wingAttackTime>0)player.state='wingAttack';
    else if(player.attackTime>0)player.state=playerMode==='muscle'&&!player.hasSword?'rushAttack':'swordAttack';
    else if (player.dashPoseTime>0&&speed>70) player.state = 'dash';
    else if (player.crouching) player.state = 'crouch';
    else if (player.justLanded) player.state = 'land';
    else if (!player.grounded) player.state = player.vy < 0 ? (player.jumpCount === 2 ? 'doubleJump' : 'jump') : 'fall';
    else if(player.skidTime>0&&speed>90)player.state='skid';
    else if(speed>330)player.state='sprint';
    else if (speed > 30) player.state = 'walk';
    else player.state = 'idle';
    const animationRate=player.state==='dash'||player.state==='sprint'?13:player.state==='walk'?5.8+Math.min(2.4,speed/145):player.state==='special'?8:3;
    player.anim += dt * animationRate * (playerMode === 'lcd' ? 1.32 : 1);
    if (player.grounded && speed > 100 && Math.floor(player.anim * 2) !== Math.floor((player.anim - dt * 9) * 2)) spawnDust(player.x, player.y + player.h, dashing ? 3 : 1);
    if (playerMode === 'lcd' && Math.floor(elapsed*16) !== Math.floor((elapsed-dt)*16)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.28,lcd:true,mode:playerMode,state:player.state});
    if (canDash) { shake = Math.max(shake, 2.5); if (Math.floor(elapsed*18) !== Math.floor((elapsed-dt)*18)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.18,mode:playerMode,state:player.state}); }
    if(player.speedTier>0&&speed>170&&Math.floor(elapsed*(player.speedTier===2?18:10))!==Math.floor((elapsed-dt)*(player.speedTier===2?18:10))){
      speedTrails.push({x:player.x-player.facing*(18+Math.random()*35),y:player.y+18+Math.random()*80,vx:-player.facing*(230+Math.random()*(player.speedTier===2?500:260)),life:.18+Math.random()*.22,size:2+Math.random()*(player.speedTier===2?5:3),tier:player.speedTier});
      if(player.speedTier===2&&Math.floor(elapsed*11)!==Math.floor((elapsed-dt)*11))afterimages.push({x:player.x-player.facing*10,y:player.y,facing:player.facing,life:.12,speed:true,mode:playerMode,state:player.state});
      trimPool(speedTrails,80);trimPool(afterimages,30);
    }
    updateCompanions(dt);
  }

  const BOSS_TELEGRAPH_TIME={charge:.78,shoot:.82,jump:.72,slam:.9,sweep:.7,roar:1.05,magma:.92,
    bite:.72,torpedo:.9,breach:.78,dive:1.05,waterBurst:.92,maelstrom:1.1};

  function beginBossEncounter() {
    if(!boss||boss.intro)return;
    boss.intro=true;boss.active=false;boss.state='intro';boss.timer=0;boss.introLock=BOSS_INTRO_DURATION;bossIntro=.001;
    const revealDistance=portrait?430:720;boss.x=Math.max(boss.arenaLeft,Math.min(boss.arenaRight-boss.w,player.x+revealDistance));
    if(boss.type==='titan')boss.y=FLOOR_Y-boss.h;else boss.y=Math.max(110,Math.min(WORLD_HEIGHT-boss.h-70,player.y-25));
    boss.vx=0;boss.vy=0;bossGate.closed=true;enemyVolleyLock=BOSS_INTRO_DURATION+1;
    // The arena is a clean duel: remove every regular enemy and every object
    // created by regular enemies before the gate closes.
    for(const enemy of enemies){if(!enemy.allied){enemy.alive=false;enemy.squish=.18;}}
    droplets=[];projectiles=[];shockwaves=shockwaves.filter((wave)=>wave.friendly);
    player.invincible=Math.max(player.invincible,BOSS_INTRO_DURATION+.35);
    ui.bossHud.classList.remove('hidden');
    say(player.hasSword?'WARNING!!\nおいどんが諦めるのを諦めろ！！':`WARNING!!\n${boss.name}`,player.hasSword?'alert':null,playerMode);
    sound('bossWarning');
    if(window.RepairHeroSound?.transition)window.RepairHeroSound.transition('boss',.35);else window.RepairHeroSound?.music('boss');
  }

  function bossMoveState() { return boss.type==='shark'?'swim':'chase'; }

  function chooseBossAttack() {
    const titan=[['charge','shoot','jump'],['charge','shoot','jump','slam','sweep'],['charge','shoot','jump','slam','sweep','roar','magma']];
    const shark=[['bite','torpedo','breach'],['bite','torpedo','breach','dive','waterBurst'],['bite','torpedo','breach','dive','waterBurst','maelstrom']];
    const choices=(boss.type==='shark'?shark:titan)[boss.phase-1];
    const choice=choices[boss.attackIndex%choices.length];boss.attackIndex+=1;return choice;
  }

  function beginBossAttack(name) {
    boss.attackName=name;boss.state='telegraph';boss.timer=0;boss.attackFired=false;boss.attackStep=0;boss.vx=0;
    boss.targetX=player.x+player.w/2;boss.targetY=player.y+player.h/2;
    sound(name==='bite'||name==='sweep'?'bossMelee':'bossWarning');
  }

  function finishBossAttack(recovery=.65) {
    boss.state='recovery';boss.timer=0;boss.recovery=recovery;boss.vx*=.12;boss.vy*=boss.type==='shark' ? 0.25 : 1;
    boss.cooldown=boss.phase===3?2.05:boss.phase===2?2.35:2.75;
  }

  function spawnBossGroundWave(x,vx,kind='bossWave',maxDistance=620) {
    shockwaves.push({kind,x,y:FLOOR_Y-24,w:24,h:42,vx,life:Math.abs(maxDistance/(vx||1))+.2,friendly:false,owner:'boss',originX:x,maxDistance});
  }

  function aimVelocity(fromX,fromY,targetX,targetY,speed) {
    const dx=targetX-fromX,dy=targetY-fromY,len=Math.hypot(dx,dy)||1;return {vx:dx/len*speed,vy:dy/len*speed};
  }

  function updateTitanBossAttack(dt) {
    const direction=Math.sign(boss.targetX-(boss.x+boss.w/2))||1;
    if(boss.attackName==='charge'){
      if(!boss.attackFired){boss.attackFired=true;boss.vx=direction*(boss.phase===3?560:boss.phase===2?500:430);sound('bossMelee');}
      if(boss.timer>.72)finishBossAttack(.72);
    }else if(boss.attackName==='shoot'){
      if(!boss.attackFired){boss.attackFired=true;const x=boss.x+boss.w/2,y=boss.y+82;const aim=aimVelocity(x,y,boss.targetX,boss.targetY,265+(boss.phase-1)*22);
        spawnBossShot({kind:'bossOrb',x,y,w:28,h:28,...aim});
        if(boss.phase>=2)spawnBossShot({kind:'bossOrb',x,y:y+18,w:24,h:24,vx:aim.vx,vy:aim.vy+(direction>0?58:-58)});sound('bossShot');}
      if(boss.timer>.42)finishBossAttack(.62);
    }else if(boss.attackName==='jump'){
      if(!boss.attackFired){boss.attackFired=true;boss.vy=-760-(boss.phase-1)*45;boss.vx=direction*(180+(boss.phase-1)*35);boss.grounded=false;}
      if(boss.attackFired&&boss.grounded&&boss.timer>.38){spawnBossGroundWave(boss.x+boss.w/2,-300,'bossWave',560);spawnBossGroundWave(boss.x+boss.w/2,300,'bossWave',560);shake=18;sound('stomp');finishBossAttack(.82);}
    }else if(boss.attackName==='slam'){
      if(!boss.attackFired){boss.attackFired=true;spawnBossGroundWave(boss.x+boss.w/2,-330,'bossWave',650);spawnBossGroundWave(boss.x+boss.w/2,330,'bossWave',650);shake=20;sound('stomp');}
      if(boss.timer>.46)finishBossAttack(.78);
    }else if(boss.attackName==='sweep'){
      if(!boss.attackFired){boss.attackFired=true;const range=245;const box={x:direction>0?boss.x+boss.w-20:boss.x-range+20,y:boss.y+55,w:range,h:125};
        combatFx.push({x:direction>0?box.x+box.w:box.x,y:box.y+box.h/2,life:.42,size:145,type:'slash'});if(overlap(player,box))hurt(boss.x+boss.w/2);sound('bossMelee');}
      if(boss.timer>.42)finishBossAttack(.82);
    }else if(boss.attackName==='roar'){
      if(!boss.attackFired){boss.attackFired=true;const x=boss.x+boss.w/2,y=boss.y+75;for(const offset of[-.38,0,.38])spawnBossShot({kind:'bossOrb',x,y,w:25,h:25,vx:direction*245,vy:offset*245});shake=14;sound('bossShot');}
      if(boss.timer>.5)finishBossAttack(.9);
    }else if(boss.attackName==='magma'){
      if(!boss.attackFired){boss.attackFired=true;for(let i=-1;i<=1;i++)spawnBossShot({kind:'magma',x:boss.x+boss.w/2,y:boss.y+55,w:30,h:30,vx:direction*(180+i*30),vy:-310+Math.abs(i)*45,gravity:760});sound('bossShot');}
      if(boss.timer>.52)finishBossAttack(.88);
    }
  }

  function updateSharkBossAttack(dt) {
    const fromX=boss.x+boss.w/2,fromY=boss.y+boss.h/2;const aim=aimVelocity(fromX,fromY,boss.targetX,boss.targetY,1);
    if(boss.attackName==='bite'){
      if(!boss.attackFired){boss.attackFired=true;const speed=boss.phase===3?620:boss.phase===2?560:500;boss.vx=aim.vx*speed;boss.vy=aim.vy*speed;sound('bossMelee');}
      if(boss.timer>.58)finishBossAttack(.72);
    }else if(boss.attackName==='torpedo'){
      if(!boss.attackFired){boss.attackFired=true;const speed=300+(boss.phase-1)*20;const shotAim=aimVelocity(fromX,fromY,boss.targetX,boss.targetY,speed);const perpendicularX=-shotAim.vy/speed,perpendicularY=shotAim.vx/speed;
        for(const offset of(boss.phase===1?[-38,38]:[-58,0,58]))spawnBossShot({kind:'torpedo',x:fromX+perpendicularX*offset,y:fromY+perpendicularY*offset,w:34,h:20,vx:shotAim.vx,vy:shotAim.vy});sound('bossShot');}
      if(boss.timer>.5)finishBossAttack(.72);
    }else if(boss.attackName==='breach'){
      if(!boss.attackFired){boss.attackFired=true;const speed=520+(boss.phase-1)*45;boss.vx=aim.vx*speed;boss.vy=aim.vy*speed;combatFx.push({x:boss.x+boss.w/2,y:boss.y+boss.h,life:.5,size:115,type:'speed'});sound('bossMelee');}
      if(boss.timer>.68)finishBossAttack(.8);
    }else if(boss.attackName==='dive'){
      if(!boss.attackFired){boss.attackFired=true;boss.submerged=true;boss.vx=0;boss.vy=590;}
      if(boss.attackStep===0&&boss.timer>.48){boss.attackStep=1;boss.x=Math.max(boss.arenaLeft,Math.min(boss.arenaRight-boss.w,boss.targetX-boss.w/2));boss.y=70;boss.vy=690;boss.submerged=false;combatFx.push({x:boss.targetX,y:boss.targetY,life:.5,size:125,type:'speed'});sound('bossMelee');}
      if(boss.timer>.9){boss.submerged=false;finishBossAttack(.92);}
    }else if(boss.attackName==='waterBurst'){
      if(!boss.attackFired){boss.attackFired=true;const direction=Math.sign(boss.targetX-fromX)||1;for(let i=-2;i<=2;i++)spawnBossShot({kind:'waterBlade',x:fromX,y:fromY,w:30,h:15,vx:direction*(225-Math.abs(i)*12),vy:i*82});sound('bossShot');}
      if(boss.timer>.56)finishBossAttack(.86);
    }else if(boss.attackName==='maelstrom'){
      if(!boss.attackFired){boss.attackFired=true;const direction=Math.sign(boss.targetX-fromX)||1;for(let i=-2;i<=2;i++)spawnBossShot({kind:'waterBlade',x:fromX,y:fromY,w:32,h:16,vx:direction*250,vy:i*96,maxDistance:650});
        shockwaves.push({kind:'bossWave',x:fromX,y:fromY,w:28,h:110,vx:-direction*300,life:2.2,friendly:false,owner:'boss',originX:fromX,maxDistance:650});shake=18;sound('bossShot');}
      if(boss.timer>.62)finishBossAttack(.98);
    }
  }

  function resolveBossContact() {
    if(!boss.active||!boss.alive||boss.submerged)return;
    const head=boss.type==='shark'?{x:boss.x,y:boss.y+12,w:boss.w*.46,h:boss.h*.72}:{x:boss.x+35,y:boss.y,w:boss.w-70,h:66};
    const body=boss.type==='shark'?{x:boss.x+boss.w*.3,y:boss.y,w:boss.w*.7,h:boss.h}:{x:boss.x,y:boss.y+62,w:boss.w,h:boss.h-62};
    if(playerMode==='king'&&(overlap(player,head)||overlap(player,body))){if(player.kingBossHitCooldown<=0&&damageBoss(2,190)){player.kingBossHitCooldown=.48;boss.vx+=player.facing*155;}}
    else if(overlap(player,head)&&player.vy>70&&(player.previousY??player.y)+player.h<=head.y+48){if(damageBoss(playerMode==='muscle'?3:1,70))player.vy=-570;}
    else if(overlap(player,head)||overlap(player,body))hurt(boss.x+boss.w/2);
  }

  function updateBoss(dt) {
    if(!boss)return;
    if(!boss.intro&&player.x>bossGate.x)beginBossEncounter();
    if(boss.defeat){boss.defeat+=dt;if(boss.defeat>.55&&boss.defeat-dt<=.55){shake=reducedEffects?24:35;for(let i=0;i<effectCount(12,7);i++)combatFx.push({x:boss.x+Math.random()*boss.w,y:boss.y+Math.random()*boss.h,life:.8,size:80,type:'explosion'});say('BOSS DEFEATED!!');}
      if(boss.defeat>1.7&&bossGate.closed){bossGate.closed=false;ui.goalLock.textContent='GOAL UNLOCKED!!';ui.goalLock.classList.add('unlocked');say('GOAL UNLOCKED!!');window.RepairHeroSound?.music('game');}return;}
    if(!boss.intro||!boss.alive)return;
    if(!boss.active){boss.introLock=Math.max(0,boss.introLock-dt);boss.timer+=dt;boss.y+=(Math.sin(elapsed*3)*8)*dt;
      if(boss.introLock<=0){boss.active=true;boss.state=bossMoveState();boss.timer=0;boss.cooldown=1.15;say('BOSS BATTLE\nFIGHT!!');sound('start');}return;}
    boss.hit=Math.max(0,boss.hit-dt);boss.timer+=dt;boss.cooldown-=dt;
    if(boss.state==='telegraph'){
      boss.vx*=Math.pow(.001,dt);if(boss.timer>=(BOSS_TELEGRAPH_TIME[boss.attackName]||.8)){boss.state='attack';boss.timer=0;boss.attackFired=false;boss.attackStep=0;}
    }else if(boss.state==='attack'){
      if(boss.type==='shark')updateSharkBossAttack(dt);else updateTitanBossAttack(dt);
    }else if(boss.state==='recovery'){
      boss.vx*=Math.pow(.02,dt);if(boss.timer>=boss.recovery){boss.state=bossMoveState();boss.timer=0;boss.attackName=null;}
    }else{
      const dx=(player.x+player.w/2)-(boss.x+boss.w/2),distance=Math.abs(dx),direction=Math.sign(dx)||1;
      const preferred=boss.type==='shark'?470:390;const speed=(boss.type==='shark'?145:100)+(boss.phase-1)*(boss.type==='shark'?27:22);
      let desired=distance>preferred+95?direction*speed:distance<preferred*.58?-direction*speed*.62:0;
      boss.vx+=(desired-boss.vx)*Math.min(1,dt*2.8);
      if(boss.type==='shark'){const targetY=Math.max(105,Math.min(WORLD_HEIGHT-boss.h-75,player.y+player.h/2-boss.h/2));boss.y+=(targetY-boss.y)*Math.min(1,dt*1.7);}
      if(boss.cooldown<=0&&distance<Math.min(1250,viewportWidth*1.3))beginBossAttack(chooseBossAttack());
    }
    if(boss.type==='shark'){
      boss.x+=boss.vx*dt;boss.y+=boss.vy*dt;boss.vy*=Math.pow(.08,dt);boss.y=Math.max(65,Math.min(WORLD_HEIGHT-boss.h-48,boss.y));
    }else{
      boss.vy=Math.min(MAX_FALL,boss.vy+GRAVITY*dt);boss.x+=boss.vx*dt;boss.y+=boss.vy*dt;
      if(boss.y+boss.h>=FLOOR_Y){boss.y=FLOOR_Y-boss.h;boss.vy=0;boss.grounded=true;}else boss.grounded=false;
    }
    boss.x=Math.max(boss.arenaLeft,Math.min(boss.arenaRight-boss.w,boss.x));resolveBossContact();
  }

  function activeMeleeCounterBox() {
    if(player.dead||player.specialTime>0||player.attackTime<=0)return null;
    const muscle=playerMode==='muscle'&&!player.hasSword,range=muscle?205:155,front=player.facing>0?player.x+player.w:player.x;
    return {x:player.facing>0?front-12:front-range+12,y:player.y+12,w:range,h:player.h*.78};
  }

  function clashEffect(x,y,power=1) {
    combatFx.push({x,y,life:.34,size:42+power*10,type:'clash'});shake=Math.max(shake,5+power*2);player.score+=25;
    for(let index=0;index<effectCount(8+power*3,5);index++)sparks.push({x,y,vx:(Math.random()-.5)*420,vy:(Math.random()-.5)*420,life:.2+Math.random()*.28,size:2+Math.random()*5});
    if(elapsed-lastClashAt>.065){lastClashAt=elapsed;sound('clash');}
  }

  function counterAttackCancels(box) {
    for(const shot of wingShots){
      if(shot.dead)continue;const shotBox={x:shot.x-shot.w/2,y:shot.y-shot.h/2,w:shot.w,h:shot.h};
      if(!overlap(box,shotBox))continue;if((shot.clashPower||1)<=1&&!shot.piercing)shot.dead=true;clashEffect((Math.max(box.x,shotBox.x)+Math.min(box.x+box.w,shotBox.x+shotBox.w))/2,(Math.max(box.y,shotBox.y)+Math.min(box.y+box.h,shotBox.y+shotBox.h))/2,shot.clashPower||1);return true;
    }
    for(const wave of shockwaves){
      if(!wave.friendly||wave.life<=0)continue;const waveBox={x:wave.x-(wave.w||20),y:wave.y-(wave.h||38)/2,w:(wave.w||20)*2,h:wave.h||38};
      if(overlap(box,waveBox)){clashEffect((box.x+box.w/2+wave.x)/2,(box.y+box.h/2+wave.y)/2,wave.kind==='rush'?3:2);return true;}
    }
    const melee=activeMeleeCounterBox();if(melee&&overlap(box,melee)){clashEffect(box.x+box.w/2,box.y+box.h/2,playerMode==='muscle'?3:2);return true;}
    return false;
  }

  function prepareEnemyAttack(enemy,type,duration) {
    enemy.pendingAttack=type;enemy.targetX=player.x+player.w/2;enemy.targetY=player.y+player.h/2;
    enemy.aimFacing=Math.sign(enemy.targetX-(enemy.x+enemy.w/2))||enemy.aimFacing||1;enemy.warning=Math.max(enemy.warning,duration);
    enemyVolleyLock=Math.max(enemyVolleyLock,duration+.32);sound('enemyCharge');
  }

  function updateEnemies(dt) {
    enemyVolleyLock=Math.max(0,enemyVolleyLock-dt);
    for (const enemy of enemies) {
      if (!enemy.alive) { enemy.squish -= dt; continue; }
      if(enemy.allied)continue;
      enemy.phase += dt;enemy.cooldown -= dt;enemy.attackCooldown-=dt;enemy.hit=Math.max(0,(enemy.hit||0)-dt);
      const previousAttackCharge=enemy.attackCharge,previousShotCharge=enemy.shotCharge,previousDashCharge=enemy.dashCharge;
      enemy.attackCharge=Math.max(0,enemy.attackCharge-dt);enemy.shotCharge=Math.max(0,enemy.shotCharge-dt);enemy.dashCharge=Math.max(0,enemy.dashCharge-dt);
      enemy.warning=Math.max(0,enemy.warning-dt);
      if(enemy.flying){
        if(enemy.behavior==='jelly'){enemy.x=enemy.originX+Math.sin(enemy.phase*.7)*55;enemy.y=enemy.originY+Math.sin(enemy.phase*1.7)*62;}
        else{if(Math.abs(enemy.x-enemy.originX)>165)enemy.vx*=-1;enemy.x+=enemy.vx*dt;enemy.y=enemy.originY+Math.sin(enemy.phase*(enemy.behavior==='flyer'?2.5:1.5))*42;}
      }else{
        enemy.vy=Math.min(MAX_FALL,enemy.vy+GRAVITY*dt);
        if(enemy.behavior==='walker'&&Math.abs(enemy.x-enemy.originX)>135)enemy.vx*=-1;
        if(enemy.behavior==='hopper'&&enemy.grounded&&enemy.cooldown<=0){enemy.vy=-500;enemy.vx=player.x<enemy.x?-enemy.speed:enemy.speed;enemy.cooldown=3.25;}
        if(enemy.behavior==='charger'){
          if(enemy.cooldown<=0&&enemyVolleyLock<=0&&Math.abs(player.x-enemy.x)<650){enemy.dashCharge=.88;enemy.cooldown=4.8;prepareEnemyAttack(enemy,'chargeDash',.88);}
          if(enemy.dashCharge>0)enemy.vx*=Math.pow(.001,dt);
          else if(Math.abs(enemy.x-enemy.originX)>205)enemy.vx=-Math.sign(enemy.x-enemy.originX)*enemy.speed*.5;
        }
        if(previousDashCharge>0&&enemy.dashCharge<=0)enemy.vx=enemy.aimFacing*enemy.speed*3.65;
        if(enemy.behavior==='shooter'&&Math.abs(enemy.x-enemy.originX)>90)enemy.vx*=-1;
        moveAndCollide(enemy,dt);
      }
      if(enemy.behavior==='shooter'&&enemy.cooldown<=0&&enemy.shotCharge<=0&&enemy.attackCharge<=0&&enemyVolleyLock<=0&&Math.abs(player.x-enemy.x)<640){
        enemy.shotCharge=.82;enemy.cooldown=(enemy.flying?6.1:5.65)+(enemy.x%4)*.18;prepareEnemyAttack(enemy,'aimedBolt',.82);
      }
      if(previousShotCharge>0&&enemy.shotCharge<=0){
        const cx=enemy.x+enemy.w/2,cy=enemy.y+enemy.h*.35,aim=aimVelocity(cx,cy,enemy.targetX,enemy.targetY,190);
        spawnEnemyShot({x:cx,y:cy,w:18,h:18,...aim,energy:true,kind:'aimedBolt'});enemy.attackCooldown=Math.max(enemy.attackCooldown,3.8);sound('enemyAttack');
      }
      // Each family alternates readable attacks, but the global volley lock
      // prevents several nearby enemies from creating an unavoidable wall.
      if(enemy.attackCooldown<=0&&enemy.attackCharge<=0&&enemy.shotCharge<=0&&enemyVolleyLock<=0&&Math.abs(player.x-enemy.x)<690){
        const attack=enemy.attackCycle%2===0?enemy.attack:(enemy.alternateAttack||enemy.attack);enemy.attackCycle+=1;
        enemy.attackCharge=.9;enemy.attackCooldown=7.8+(enemy.x%7)*.2;prepareEnemyAttack(enemy,attack,.9);
      }
      if(previousAttackCharge>0&&enemy.attackCharge<=0){
        const cx=enemy.x+enemy.w/2,cy=enemy.y+enemy.h*.42,dx=enemy.targetX-cx,dy=enemy.targetY-cy,len=Math.hypot(dx,dy)||1;
        const attack=enemy.pendingAttack||enemy.attack;
        const addShot=(vx,vy,w=20,h=20,kind=attack,energy=true,x=cx,y=cy)=>spawnEnemyShot({x,y,w,h,vx,vy,energy,kind});
        if(attack==='spread'){for(let angle=-1;angle<=1;angle++)addShot(dx/len*205,dy/len*205+angle*78,20,20,'spread');}
        else if(attack==='burst'){for(let angle=-1;angle<=1;angle++)addShot((dx/len*180)+angle*62,-205+Math.abs(angle)*45,18,18,'burst',false);}
        else if(attack==='drillWave')shockwaves.push({kind:'enemyDrill',x:cx,y:enemy.y+enemy.h-8,w:18,h:34,vx:Math.sign(dx||1)*265,life:1.45,friendly:false,owner:'enemy',originX:cx,maxDistance:390});
        else if(attack==='electric'){for(let angle=-1;angle<=1;angle++)addShot(Math.sign(dx||1)*165,angle*105,16,16,'electric');}
        else if(attack==='bite'){enemy.vx=Math.sign(dx||1)*enemy.speed*3.15;}
        else if(attack==='missile'||attack==='torpedo')addShot(dx/len*235,dy/len*235,28,16,attack);
        else if(attack==='pulse'){for(let angle=-1;angle<=1;angle++)addShot(dx/len*165,dy/len*165+angle*66,22,22,'pulse');}
        else if(attack==='scan')addShot(Math.sign(dx||1)*190,0,36,12,'scan');
        else if(attack==='saw')addShot(Math.sign(dx||1)*185,Math.sign(dy)*32,30,30,'saw');
        else if(attack==='mine')addShot(Math.sign(dx||1)*48,-120,28,28,'mine',false);
        else if(attack==='rail')addShot(dx/len*255,dy/len*255,34,10,'rail');
        else if(attack==='debris'){for(let angle=-1;angle<=1;angle++)addShot(Math.sign(dx||1)*(135+angle*30),-195+Math.abs(angle)*40,20,20,'debris',false);}
        else if(attack==='bubble'){for(let angle=-1;angle<=1;angle++)addShot(Math.sign(dx||1)*145,angle*92,22,22,'bubble');}
        else if(attack==='lightning')addShot(0,190,18,42,'lightning',true,enemy.targetX,Math.max(30,enemy.targetY-320));
        else if(attack==='depthCharge')addShot(Math.sign(dx||1)*30,112,24,30,'depthCharge',false);
        else if(attack==='diveShot')addShot(dx/len*205,dy/len*205,20,26,'diveShot');
        else if(attack==='fireRain'){for(const offset of[-1,1])addShot(offset*24,190,20,28,'fireRain',false,enemy.targetX+offset*90,Math.max(25,enemy.targetY-285));}
        else addShot(dx/len*200,dy/len*200,20,20,attack||'bolt');
        if(enemy.behavior==='shooter')enemy.cooldown=Math.max(enemy.cooldown,3.8);sound('enemyAttack');
      }

      const dashHit=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>300;
      if (overlap(player, enemy) && (playerMode === 'king'||dashHit)) {
        enemy.vx=player.facing*(playerMode==='king'?980:760);
        if(playerMode==='king')defeatEnemy(enemy,'king',750);else damageEnemy(enemy,1,'dash',520,player.facing*380);
        emitModeParticles(playerMode==='king'?'king':'lcd',18);
      } else if (overlap(player, enemy)) {
        const playerBottom = player.y + player.h;
        const previousBottom=(player.previousY??player.y)+player.h;
        const stompBand=Math.max(34,enemy.h*.55);
        const crossedEnemyTop=previousBottom<=enemy.y+stompBand&&playerBottom>=enemy.y-4;
        const playerIsAbove=player.y+player.h*.68<=enemy.y+enemy.h*.64;
        if (player.vy > 28 && crossedEnemyTop && playerIsAbove) {
          player.y=enemy.y-player.h+2;
          damageEnemy(enemy,1,'stomp',500,player.facing*90); player.vy = -540;player.grounded=false;player.jumpCount=1;
          combatFx.push({x:enemy.x+enemy.w/2,y:enemy.y,life:.52,size:78,type:'stomp'});
          spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h, 9); sound('stomp');
        } else if(player.invincible<=0) hurt(enemy.x + enemy.w / 2);
      }
    }

    for (const drop of droplets) {
      drop.life-=dt;if(!drop.energy||drop.kind==='burst')drop.vy += GRAVITY * .45 * dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt;
      if(counterAttackCancels(drop)){drop.dead=true;continue;}
      if (overlap(playerDamageBox(), drop)) { drop.dead = true; if(playerMode !== 'king') hurt(drop.x); }
      if(projectileHitsTerrain(drop))drop.dead=true;
      if(drop.life<=0||projectileTravel(drop)>=drop.maxDistance||projectileOutsideView(drop)||drop.x<-120||drop.x>WORLD_WIDTH+120||drop.y>WORLD_HEIGHT+80||drop.y<-120)drop.dead=true;
    }
    droplets = droplets.filter((drop) => !drop.dead);
    wingShots=wingShots.filter((shot)=>!shot.dead);
    updateBoss(dt);
  }

  function damageEnemy(enemy,amount=1,style='normal',points=500,force=0) {
    if(!enemy?.alive||enemy.allied)return false;
    enemy.hp=Math.max(0,(enemy.hp??1)-amount);enemy.hit=.22;enemy.vx+=force;
    if(enemy.hp<=0){defeatEnemy(enemy,style,points);return true;}
    player.score+=scoreValue(90);combatFx.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h*.35,life:.3,size:42,type:'clash'});
    for(let index=0;index<effectCount(7,4);index++)sparks.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,vx:(Math.random()-.5)*260,vy:(Math.random()-.7)*250,life:.24+Math.random()*.2,size:2+Math.random()*4});
    sound('armorHit');return false;
  }

  function defeatEnemy(enemy, style='normal', points=500) {
    if(!enemy.alive)return; enemy.alive=false;enemy.hp=0; enemy.squish=.45; player.score+=scoreValue(points);
    const type=style==='king'?'gold':style==='lcd'?'speed':style==='muscle'?'fire':style==='sword'?'slash':'explosion';
    combatFx.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,life:.65,size:style==='muscle'?110:65,type,points:scoreValue(points)});
    for(let i=0;i<effectCount(14,7);i++)sparks.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,vx:(Math.random()-.5)*(style==='muscle'?700:360),vy:(Math.random()-.7)*400,life:.35+Math.random()*.35,size:3+Math.random()*5});
    sound(style==='muscle'?'punchHit':style==='king'?'kingHit':style==='sword'?'swordHit':'enemyDown');
  }

  function hazardIsActive(hazard){
    if(hazard.type==='fire')return (elapsed*1.25+hazard.phase)%2.4>.62;
    if(hazard.type==='electric')return (elapsed*1.7+hazard.phase)%2.1>.72;
    return true;
  }

  function updateGimmicks(dt) {
    const canInteract=player?.physicsReady&&!player.dead&&!player.clearTime&&!player.ultimateSequence;
    for(const gimmick of gimmicks){
      gimmick.cooldown=Math.max(0,(gimmick.cooldown||0)-dt);gimmick.phase=(gimmick.phase||0)+dt;
      if(gimmick.type==='boostRail'){
        const railBox={x:gimmick.x,y:gimmick.y-10,w:gimmick.w,h:gimmick.h+24};
        if(canInteract&&gimmick.cooldown<=0&&player.grounded&&overlap(player,railBox)){
          player.vx=gimmick.direction*Math.max(610,Math.abs(player.vx));player.facing=gimmick.direction;player.boost=Math.max(player.boost,1.25);player.dash=Math.min(100,player.dash+28);gimmick.cooldown=1.05;
          for(let index=0;index<effectCount(24,12);index++)speedTrails.push({x:player.x+player.w/2,y:player.y+20+Math.random()*75,vx:-gimmick.direction*(320+Math.random()*520),life:.18+Math.random()*.28,size:3+Math.random()*5,tier:2});
          sound('boostRail');say('NITRO REPAIR RAIL!!');
        }
      }else if(gimmick.type==='scanLaser'){
        const cycle=(elapsed+gimmick.phaseOffset)%4.6,warning=cycle>=2.15&&cycle<3.25,active=cycle>=3.25&&cycle<4.02;
        gimmick.warning=warning;gimmick.active=active;
        if(warning&&!gimmick.warningPlayed){gimmick.warningPlayed=true;sound('laserWarn');}
        if(cycle<1.2)gimmick.warningPlayed=false;
        if(canInteract&&active&&overlap(playerDamageBox(),{x:gimmick.x,y:gimmick.y,w:gimmick.w,h:gimmick.h}))hurt(gimmick.x+gimmick.w/2);
      }else if(gimmick.type==='phaseGate'){
        if(canInteract&&gimmick.cooldown<=0&&overlap(player,{x:gimmick.x,y:gimmick.y,w:gimmick.w,h:gimmick.h})){
          const fromX=player.x+player.w/2,fromY=player.y+player.h/2;placePlayerSafely(gimmick.targetX,gimmick.targetY,{avoidBoss:true});gimmick.cooldown=2;
          combatFx.push({x:fromX,y:fromY,life:.55,size:92,type:'teleport'},{x:player.x+player.w/2,y:player.y+player.h/2,life:.55,size:92,type:'teleport'});
          player.invincible=Math.max(player.invincible,.7);sound('phaseGate');say('PHASE LINK!!\nSHORTCUT');
        }
      }else if(gimmick.type==='bubbleJet'){
        if(canInteract&&overlap(player,gimmick)){
          player.vx+=gimmick.direction*240*dt;player.vy-=360*dt;oxygen=Math.min(100,oxygen+12*dt);
          if(gimmick.cooldown<=0){gimmick.cooldown=.7;sound('bubbleJet');}
        }
      }
    }
  }

  function drawGimmicks() {
    for(const gimmick of gimmicks){
      if(!visibleInCamera(gimmick,120))continue;
      ctx.save();
      if(gimmick.type==='boostRail'){
        ctx.shadowColor='#62efff';ctx.shadowBlur=20;ctx.fillStyle='#0a5369';ctx.strokeStyle='#a8ffff';ctx.lineWidth=4;ctx.fillRect(gimmick.x,gimmick.y,gimmick.w,gimmick.h);ctx.strokeRect(gimmick.x,gimmick.y,gimmick.w,gimmick.h);
        ctx.fillStyle='#fff568';ctx.font='900 19px Arial';ctx.textAlign='center';for(let x=gimmick.x+28;x<gimmick.x+gimmick.w-10;x+=48)ctx.fillText(gimmick.direction>0?'»':'«',x,gimmick.y+14);
      }else if(gimmick.type==='scanLaser'){
        const pulse=.55+.45*Math.sin(elapsed*22);ctx.fillStyle='#252d39';ctx.strokeStyle='#ffb13b';ctx.lineWidth=4;ctx.fillRect(gimmick.x-18,gimmick.y-34,18,82);ctx.fillRect(gimmick.x+gimmick.w,gimmick.y-34,18,82);ctx.strokeRect(gimmick.x-18,gimmick.y-34,18,82);ctx.strokeRect(gimmick.x+gimmick.w,gimmick.y-34,18,82);
        if(gimmick.warning||gimmick.active){ctx.globalAlpha=gimmick.active ? .9 : pulse*.45;ctx.strokeStyle=gimmick.active?'#fff4b0':'#ff4732';ctx.shadowColor='#ff2e1d';ctx.shadowBlur=gimmick.active?34:18;ctx.lineWidth=gimmick.active?12:4;ctx.beginPath();ctx.moveTo(gimmick.x,gimmick.y+gimmick.h/2);ctx.lineTo(gimmick.x+gimmick.w,gimmick.y+gimmick.h/2);ctx.stroke();}
        ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText(gimmick.active?'CROUCH!':'SCAN LASER',gimmick.x+gimmick.w/2,gimmick.y-17);
      }else if(gimmick.type==='phaseGate'){
        const pulse=Math.sin(elapsed*4+gimmick.phase)*8;ctx.translate(gimmick.x+gimmick.w/2,gimmick.y+gimmick.h/2);ctx.strokeStyle='#87f8ff';ctx.shadowColor='#34dfff';ctx.shadowBlur=30;ctx.lineWidth=7;for(let ring=0;ring<3;ring++){ctx.globalAlpha=.85-ring*.2;ctx.beginPath();ctx.ellipse(0,0,25+ring*9+pulse*.25,48+ring*8,0,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#fff';ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('PHASE',0,4);
      }else if(gimmick.type==='bubbleJet'){
        ctx.strokeStyle='#c9ffff';ctx.shadowColor='#4ceaff';ctx.shadowBlur=22;ctx.lineWidth=4;for(let bubble=0;bubble<9;bubble++){const x=gimmick.x+(bubble%3)*48+Math.sin(elapsed*3+bubble)*12,y=gimmick.y+gimmick.h-((elapsed*70+bubble*41)%gimmick.h);ctx.globalAlpha=.35+(bubble%3)*.16;ctx.beginPath();ctx.arc(x,y,7+bubble%4*3,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#efffff';ctx.globalAlpha=.9;ctx.font='900 12px Arial';ctx.fillText('O₂ JET',gimmick.x+42,gimmick.y+gimmick.h+20);
      }
      ctx.restore();
    }
  }

  function updateObjects(dt) {
    updateGimmicks(dt);
    if(swordItem&&!swordItem.collected&&overlap(player,swordItem)){swordItem.collected=true;player.hasSword=true;ui.attack.classList.remove('hidden');say('PHOENIX SWORD GET!!\n⚔ ATTACK');sound('swordGet');}
    for(const p of projectiles){p.life-=dt;if(p.gravity)p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const box={x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h};
      if(counterAttackCancels(box)){p.dead=true;continue;}
      if(overlap(playerDamageBox(),box)){p.dead=true;if(playerMode!=='king')hurt(p.x);}
      if(projectileHitsTerrain(box))p.dead=true;
      if(p.life<=0||projectileTravel(p)>=p.maxDistance||projectileOutsideView(box)||p.x<-140||p.x>WORLD_WIDTH+140||p.y<-140||p.y>WORLD_HEIGHT+140)p.dead=true;}
    projectiles=projectiles.filter((p)=>!p.dead);
    for(const wing of wingShots){
      if(wing.dead)continue;
      wing.life-=dt;
      if(wing.turnRate&&wing.target&&wing.target.alive){
        const targetAngle=Math.atan2(wing.target.y+wing.target.h/2-wing.y,wing.target.x+wing.target.w/2-wing.x),currentAngle=Math.atan2(wing.vy,wing.vx);
        let delta=(targetAngle-currentAngle+Math.PI*3)%(Math.PI*2)-Math.PI;delta=Math.max(-wing.turnRate*dt,Math.min(wing.turnRate*dt,delta));
        const speed=Math.hypot(wing.vx,wing.vy);wing.vx=Math.cos(currentAngle+delta)*speed;wing.vy=Math.sin(currentAngle+delta)*speed;
      }
      wing.x+=wing.vx*dt;wing.y+=wing.vy*dt;
      const box={x:wing.x-wing.w/2,y:wing.y-wing.h/2,w:wing.w,h:wing.h};
      for(const enemy of enemies){if(wing.dead||!enemy.alive||enemy.allied||wing.hitEnemies.has(enemy)||!overlap(box,enemy))continue;wing.hitEnemies.add(enemy);damageEnemy(enemy,wing.damage||1,wing.style||'wing',wing.points||620,Math.sign(wing.vx)*120);if(!wing.piercing)wing.dead=true;sound(wing.kind==='radialPunch'?'punchHit':'wingHit');}
      if(!wing.dead&&boss?.alive&&boss.active&&!wing.bossHit&&overlap(box,{x:boss.x,y:boss.y,w:boss.w,h:boss.h})){
        if(damageBoss(wing.bossDamage,wing.kind==='radialPunch'?145:38)){wing.bossHit=true;if(!wing.piercing)wing.dead=true;sound(wing.kind==='radialPunch'?'punchHit':'wingHit');}
      }
      if(wing.breaksWalls)for(const wall of breakables){if(!wall.alive||wall.fixed||!overlap(box,wall))continue;wall.alive=false;player.score+=300;combatFx.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,life:.55,size:72,type:'punch'});shake=Math.max(shake,15);}
      if(projectileHitsHardWall(box))wing.dead=true;
      if(wing.life<=0||projectileTravel(wing)>=wing.maxDistance||projectileOutsideView(box,190)||wing.x<-100||wing.x>WORLD_WIDTH+100)wing.dead=true;
    }
    wingShots=wingShots.filter((wing)=>!wing.dead);
    for(const wave of shockwaves){
      const oldX=wave.x;
      if(wave.originX===undefined)wave.originX=oldX;
      const attackWave=wave.kind==='rush'||wave.kind==='slash';
      const maxWaveWidth=wave.kind==='rush'?150:wave.kind==='slash'?120:80;
      const waveGrowth=wave.kind==='rush'?230:wave.kind==='slash'?180:90;
      wave.x+=wave.vx*dt;wave.w=Math.min(maxWaveWidth,wave.w+waveGrowth*dt);wave.life-=dt;
      const waveBox={x:Math.min(oldX,wave.x)-wave.w,y:wave.y-(wave.h||28)/2,w:Math.abs(wave.x-oldX)+wave.w*2,h:wave.h||28};
      if(!wave.friendly&&counterAttackCancels(waveBox)){wave.life=0;continue;}
      if(!wave.friendly&&overlap(playerDamageBox(),waveBox)){wave.life=0;hurt(wave.x);continue;}
      if(!wave.friendly&&projectileHitsHardWall(waveBox)){wave.life=0;continue;}
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
          damageEnemy(enemy,rush?99:2,rush?'muscle':'sword',wave.damage||(rush?900:650),direction*(rush?520:280));
          hitStop=Math.max(hitStop,rush ? .065 : .038);shake=Math.max(shake,rush ? 26 : 17);
        }
        for(const wall of breakables){
          if(!wall.alive||wall.fixed||!wave.breaksWalls||!overlap(effectiveBox,wall))continue;
          wall.alive=false;player.score+=350;shake=Math.max(shake,22);
          combatFx.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,life:.7,size:90,type:wave.kind==='rush'?'fire':'slash'});
          for(let i=0;i<effectCount(18,9);i++)sparks.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,vx:Math.sign(wave.vx)*(160+Math.random()*620),vy:(Math.random()-.5)*480,life:.35+Math.random()*.45,size:4+Math.random()*8});
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
      if(wave.maxDistance&&Math.abs(wave.x-wave.originX)>=wave.maxDistance)wave.life=0;
      if(!wave.friendly&&projectileOutsideView({x:wave.x-wave.w,y:wave.y-(wave.h||32)/2,w:wave.w*2,h:wave.h||32},240))wave.life=0;
    }
    shockwaves=shockwaves.filter(p=>p.life>0);
    wingShots=wingShots.filter((shot)=>!shot.dead);
    combatFx.forEach(p=>p.life-=dt);combatFx=combatFx.filter(p=>p.life>0);
    const activeDash=(input.dashLeft||input.dashRight)&&Math.abs(player.vx)>280;
    for(const wall of breakables){if(!wall.alive||!overlap(player,wall))continue;if(activeDash){wall.alive=false;shake=13;player.score+=250;for(let i=0;i<effectCount(12,6);i++)sparks.push({x:wall.x+wall.w/2,y:wall.y+wall.h/2,vx:(Math.random()-.5)*360,vy:(Math.random()-.5)*300,life:.5,size:6});}else{player.x=player.vx>0?wall.x-player.w:wall.x+wall.w;player.vx=0;}}
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
        player.respawnTimer=.7;player.respawnMessage='壁から再開！';
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
        const previousCoins=player.coins;coin.collected = true; player.coins += 1;player.score += scoreValue(100);sound('coin');triggerCoinSpeed(previousCoins);updateHud();
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
      if(item.type==='fenicoin') { const previousCoins=player.coins;player.score+=scoreValue(3000);player.coins+=5;triggerCoinSpeed(previousCoins); }
      if(item.type==='fire') player.invincible=8;
      if(item.type==='muscle') applyMode('muscle');
      say(labels[item.type]); sound(item.type);
      for(let i=0;i<effectCount(20,10);i+=1) sparks.push({x:item.x,y:item.y,vx:(Math.random()-.5)*300,vy:(Math.random()-.5)*300,life:.7,size:4});
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
      for (let i = 0; i < effectCount(28,14); i += 1) sparks.push({ x: checkpoint.x + 35, y: checkpoint.y + 20, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: .8, size: 4 });
    }
    if (boss && bossDefeated && !bossGate.closed) goalUnlocked = true;
    if (!goalUnlocked && player.x + player.w > goal.x - 20) { player.x=goal.x-player.w-20; player.vx=Math.min(0,player.vx); if(bossIntro>.8)say('GOAL LOCKED\nボスを倒せ！'); }
    if (player.x + player.w > goal.x && !player.clearTime && goalUnlocked) {
      player.clearTime = .001;player.clearMode=playerMode; player.vx = 0; player.score += Math.ceil(remainingTime) * 25; sound('goal');
      if(window.RepairHeroSound?.transition)window.RepairHeroSound.transition('goal',.28);else window.RepairHeroSound?.music('goal');
      say(`STAGE CLEAR!!\n${GOAL_LINES[playerMode]||GOAL_LINES.normal}`,'goal',playerMode);
      for(let i=0;i<effectCount(100,56);i+=1) confetti.push({x:cameraX+Math.random()*viewportWidth,y:cameraY-Math.random()*500,vx:(Math.random()-.5)*100,vy:100+Math.random()*180,life:4,color:['#ff3b20','#ffd338','#41d9ec','#fff'][i%4]});
    }
    if (player.clearTime) { player.clearTime += dt; player.state='clear'; player.x += ((cameraX + viewportWidth / 2 - player.w / 2) - player.x) * Math.min(1, dt * 3); player.y += Math.sin(player.clearTime*9)*50*dt; player.spin=Math.sin(player.clearTime*6)*.08; if(player.clearTime>2.6) setModeResult(true); }
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
    speedTrails.forEach((trail)=>{trail.x+=trail.vx*dt;trail.life-=dt;});speedTrails=speedTrails.filter((trail)=>trail.life>0);
    confetti.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}); confetti=confetti.filter(p=>p.life>0);
    trimPool(dust,reducedEffects?70:120);trimPool(sparks,reducedEffects?96:180);trimPool(shieldShards,reducedEffects?48:90);trimPool(rushTrails,reducedEffects?58:90);trimPool(modeParticles,reducedEffects?72:120);
    trimPool(afterimages,reducedEffects?16:30);trimPool(speedTrails,reducedEffects?44:80);trimPool(confetti,reducedEffects?78:130);trimPool(combatFx,reducedEffects?58:100);trimPool(shockwaves,reducedEffects?34:48);
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
    if(player.dead&&player.respawnTimer>0){player.respawnTimer=Math.max(0,player.respawnTimer-dt);if(player.respawnTimer<=0)respawnAtCheckpoint(player.respawnMessage||'REPAIR RESTART!');}
    updateObjects(dt);
    if (!player.clearTime) { updatePlayer(dt); updateEnemies(dt); }
    // Frame both fighters in the boss arena. The zoom is eased and changes the
    // real world viewport/camera range rather than scaling the DOM canvas.
    let targetScale = baseScale;
    if (boss?.alive && boss.intro) {
      const combatSpan = Math.abs((boss.x + boss.w/2) - (player.x + player.w/2)) + boss.w/2 + player.w/2 + 230;
      targetScale = Math.min(baseScale,width/Math.max(width/baseScale,combatSpan));
      targetScale = Math.max(Math.min(baseScale,portrait ? 0.46 : 0.50),targetScale);
    }
    scale += (targetScale-scale)*Math.min(1,dt*4.5);
    viewportWidth=width/scale; viewportHeight=height/scale;
    const fast = Math.abs(player.vx) > 360 || playerMode === 'lcd';
    const leadLimit = viewportWidth*(fast ? .34 : .21);
    const lead = Math.max(-leadLimit,Math.min(leadLimit,player.vx*(fast ? .27 : .14)));
    const anchor = player.facing > 0 ? .24 : .76;
    let focusX = player.x + lead - viewportWidth*anchor;
    if (boss?.alive && boss.intro) focusX=(player.x+player.w/2+boss.x+boss.w/2)/2-viewportWidth/2;
    let targetCamera = Math.max(0, Math.min(Math.max(0,WORLD_WIDTH - viewportWidth), focusX));
    if(chaserWall)targetCamera=Math.max(targetCamera,Math.min(WORLD_WIDTH-viewportWidth,chaserWall.x+chaserWall.w-viewportWidth*.06));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * (playerMode === 'lcd' ? 10 : 7));
    const jumping=Math.abs(player.vy)>100;
    const verticalAnchor = playerMode==='king' ? .55 : player.vy < -100 ? .61 : player.vy > 180 ? .46 : .57;
    const verticalMargin=jumping?210:150;
    const maxCameraY=Math.max(300,WORLD_HEIGHT-viewportHeight+80);
    const bossFocusY=boss?.alive&&boss.intro?(player.y+player.h/2+boss.y+boss.h/2)/2-viewportHeight*.5:null;
    const targetCameraY = bossFocusY!==null?Math.max(-260,Math.min(maxCameraY,bossFocusY)):(portrait||STAGES[currentStage].maze) ? Math.max(-verticalMargin, Math.min(maxCameraY, player.y - viewportHeight*verticalAnchor)) : 0;
    cameraY += (targetCameraY - cameraY) * Math.min(1, dt * (playerMode==='lcd'?11:6));
    shake *= Math.pow(.02, dt);
    landingShake *= Math.pow(.01, dt);
    hudRefreshTimer-=dt;
    if(hudRefreshTimer<=0){hudRefreshTimer=.08;updateHud();}
  }

  function updateHud() {
    if (!player) return;
    ui.hearts.textContent = `${'♥ '.repeat(Math.max(0, Math.ceil(player.hp)))}${'♡ '.repeat(Math.max(0, 3 - Math.ceil(player.hp)))}`;
    ui.coins.textContent = String(player.coins).padStart(2, '0');
    ui.score.textContent = String(player.score).padStart(6, '0');
    ui.timer.textContent = String(Math.ceil(remainingTime)).padStart(3, '0');
    ui.dashGauge.value = player.dash;
    if(ui.wingAttack){const ready=player.wingCooldown<=0&&!player.dead;ui.wingAttack.classList.toggle('ready',ready);ui.wingAttack.classList.toggle('cooldown',!ready);ui.wingAttack.setAttribute?.('aria-label',ready?'翼を飛ばす攻撃・使用可能':`翼攻撃・再使用まで${player.wingCooldown.toFixed(1)}秒`);}
    if(ui.specialAttack){
      const labels={normal:'🔥\nFIRE STORM',battery:'🤝\nALLY LINK',lcd:'✦\nZERO BLINK',muscle:'👊\nOMNI RUSH',king:'👑\nKING TRINITY'},ready=!player.dead&&(playerMode==='normal'?player.specialCooldown<=0:!player.specialUsed);
      ui.specialAttack.textContent=labels[playerMode];ui.specialAttack.classList.remove('battery','lcd','muscle','king');if(playerMode!=='normal')ui.specialAttack.classList.add(playerMode);
      ui.specialAttack.classList.toggle('ready',ready);ui.specialAttack.classList.toggle('cooldown',playerMode==='normal'&&!ready);ui.specialAttack.classList.toggle('used',playerMode!=='normal'&&player.specialUsed);
      ui.specialAttack.setAttribute?.('aria-label',ready?`${ULTIMATE_NAMES[playerMode]}・使用可能`:playerMode==='normal'?`必殺技・再使用まで${player.specialCooldown.toFixed(1)}秒`:`${ULTIMATE_NAMES[playerMode]}・使用済み`);
    }
    ui.oxygenGauge.value=oxygen;
    if(boss) ui.bossHp.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
    const canPunch = playerMode === 'muscle' && !player.hasSword;
    ui.attack.textContent = canPunch ? '👊 RUSH\nPUNCH' : '⚔ ATTACK';
    ui.attack.classList.toggle('punch',canPunch);
    ui.attack.classList.toggle('sword-ready',player.hasSword&&!canPunch);
    ui.attack.classList.toggle('hidden',!canPunch && !player.hasSword);
    if (playerMode !== 'normal') {
      ui.modeTimer.textContent = `${MODE_NAMES[playerMode]}  ${Math.ceil(modeTimer)}s`; ui.modeHud.classList.remove('hidden');
      const lcd=playerMode==='lcd';ui.shieldCount.classList.toggle('hidden',!lcd);
      if(lcd){ui.shieldCount.textContent=`SHIELD ×${player.shields}`;ui.shieldCount.classList.toggle('shield-one',player.shields===1);ui.shieldCount.classList.toggle('shield-zero',player.shields===0);}
      if(ui.specialStatus){ui.specialStatus.textContent=player.specialUsed?'ULTIMATE USED':'ULTIMATE READY';ui.specialStatus.classList.toggle('used',player.specialUsed);ui.specialStatus.classList.remove('cooldown');}
    }
  }

  function drawRoundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(x,y,w,h,radius);
    else{const r=Math.min(radius,w/2,h/2);ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);}
    ctx.fill();
  }

  function drawLegacyBackground() {
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

  function parallaxWrap(value,span) {
    return ((value%span)+span)%span;
  }

  function drawDetailedBackground() {
    const viewW=Math.max(1400,viewportWidth+180),viewH=Math.max(900,viewportHeight+240);
    const palettes={city:['#07192b','#226681','#f48a54'],underground:['#050714','#16152b','#3f283a'],sea:['#021a3a','#075e8b','#16adbb'],sky:['#103f83','#3ba8d7','#f5d79c'],boss:['#120518','#571438','#e94a2c'],factory:['#070a11','#202836','#5a3327']};
    const palette=palettes[stageTheme]||palettes.city,sky=ctx.createLinearGradient(0,-150,0,viewH);
    sky.addColorStop(0,palette[0]);sky.addColorStop(.58,palette[1]);sky.addColorStop(1,palette[2]);ctx.fillStyle=sky;ctx.fillRect(-90,-240,viewW+180,viewH+480);
    ctx.save();
    if(stageTheme==='city'){
      const sunX=viewW*.76-cameraX*.018,sunY=150-cameraY*.03;ctx.globalAlpha=.72;ctx.fillStyle='#ffd48b';ctx.shadowColor='#ff8b44';ctx.shadowBlur=55;ctx.beginPath();ctx.arc(sunX,sunY,76,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.globalAlpha=.28;ctx.fillStyle='#d8f7ff';for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++){const x=parallaxWrap(i*270-cameraX*(.035+layer*.025),2160)-210,y=95+layer*74+(i%3)*18;ctx.beginPath();ctx.ellipse(x,y,105-layer*22,25-layer*4,0,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;for(let layer=0;layer<3;layer++)for(let i=0;i<13;i++){const spacing=145+layer*38,x=parallaxWrap(i*spacing-cameraX*(.07+layer*.075),spacing*13)-spacing,h=120+(i*47+layer*61)%210,ground=525-layer*22;ctx.fillStyle=layer===0?'#102c43':layer===1?'#173a4d':'#214b59';ctx.fillRect(x,ground-h,spacing-20,h);ctx.fillStyle=layer===2?'#ffd26a88':'#75dff055';for(let wy=ground-h+22;wy<ground-20;wy+=31)for(let wx=x+18;wx<x+spacing-32;wx+=31)if((Math.floor(wx+wy+i)%3)!==0)ctx.fillRect(wx,wy,9,13);}
      ctx.strokeStyle='#122c3d';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,250);ctx.bezierCurveTo(viewW*.3,315,viewW*.65,175,viewW,245);ctx.stroke();for(let x=-50;x<viewW;x+=125){ctx.fillStyle='#ffcd54';ctx.shadowColor='#ff8b2d';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,250+Math.sin((x+cameraX*.1)*.009)*34,4,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
    }else if(stageTheme==='sky'){
      ctx.globalAlpha=.7;ctx.fillStyle='#fff7cf';ctx.shadowColor='#fff1a2';ctx.shadowBlur=42;ctx.beginPath();ctx.arc(viewW*.78-cameraX*.025,132,58,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      for(let layer=0;layer<3;layer++){ctx.globalAlpha=.16+layer*.12;ctx.fillStyle='#f4ffff';for(let i=0;i<9;i++){const x=parallaxWrap(i*245-cameraX*(.04+layer*.05),2205)-180,y=145+layer*145+(i%3)*28;ctx.beginPath();ctx.ellipse(x,y,125-layer*17,31+layer*3,0,0,Math.PI*2);ctx.fill();}}
      ctx.globalAlpha=.42;ctx.fillStyle='#24476b';for(let i=0;i<10;i++){const x=parallaxWrap(i*230-cameraX*.18,2300)-180,y=560+(i%2)*35;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+170,y);ctx.lineTo(x+135,y+54);ctx.lineTo(x+35,y+54);ctx.closePath();ctx.fill();ctx.fillStyle='#64e8ff';ctx.fillRect(x+35,y+12,100,5);ctx.fillStyle='#24476b';}
      ctx.globalAlpha=.32;ctx.fillStyle='#0b2945';for(let i=0;i<18;i++){const x=parallaxWrap(i*112-cameraX*.11,2016),h=30+(i*29)%100;ctx.fillRect(x,690-h,80,h);}
    }else if(stageTheme==='underground'){
      ctx.fillStyle='#090714';ctx.globalAlpha=.95;ctx.beginPath();ctx.moveTo(0,0);for(let x=0;x<=viewW;x+=80)ctx.lineTo(x,45+(x*13%95));ctx.lineTo(viewW,0);ctx.closePath();ctx.fill();
      ctx.fillStyle='#2a2237';ctx.beginPath();ctx.moveTo(0,viewH);for(let x=0;x<=viewW;x+=95)ctx.lineTo(x,650+(x*17%110));ctx.lineTo(viewW,viewH);ctx.closePath();ctx.fill();
      for(let layer=0;layer<3;layer++){ctx.strokeStyle=layer===0?'#1d6e78':layer===1?'#68436e':'#a66a46';ctx.globalAlpha=.24+layer*.09;ctx.lineWidth=8-layer*2;ctx.beginPath();const base=180+layer*145;ctx.moveTo(-40,base);for(let x=-40;x<viewW+80;x+=90)ctx.lineTo(x,base+Math.sin((x+cameraX*(.08+layer*.04))*.012+layer)*45);ctx.stroke();}
      ctx.globalAlpha=1;for(let i=0;i<12;i++){const x=parallaxWrap(i*205-cameraX*.14,2460)-100,y=120+(i%4)*150;ctx.fillStyle='#06161e';ctx.fillRect(x,y,118,48);ctx.strokeStyle='#45eaff';ctx.lineWidth=3;ctx.strokeRect(x,y,118,48);ctx.fillStyle='#4df4ff';ctx.shadowColor='#48eaff';ctx.shadowBlur=18;ctx.fillRect(x+14,y+12,7,24);ctx.fillRect(x+34,y+20,56,5);ctx.shadowBlur=0;}
      ctx.fillStyle='#ffe477';ctx.font='bold 18px Arial';ctx.fillText('SUBTERRANEAN REPAIR NETWORK',38,140);
    }else if(stageTheme==='sea'){
      ctx.globalCompositeOperation='screen';for(let ray=0;ray<8;ray++){ctx.globalAlpha=.06+.025*Math.sin(elapsed*1.4+ray);ctx.fillStyle='#b6ffff';ctx.beginPath();const x=parallaxWrap(ray*240-cameraX*.035,1920)-220;ctx.moveTo(x,-40);ctx.lineTo(x+65,760);ctx.lineTo(x+220,760);ctx.lineTo(x+55,-40);ctx.closePath();ctx.fill();}ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.26;ctx.strokeStyle='#b9ffff';ctx.lineWidth=4;for(let line=0;line<4;line++){ctx.beginPath();for(let x=-30;x<viewW+40;x+=35)ctx.lineTo(x,85+line*26+Math.sin(x*.025+elapsed*1.8+line)*8);ctx.stroke();}
      ctx.globalAlpha=.5;for(let i=0;i<30;i++){const x=parallaxWrap(i*83-cameraX*.06,2490),y=parallaxWrap(i*113-elapsed*(18+i%4*5),780);ctx.strokeStyle=i%3?'#9ff7ff':'#e6ffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,3+i%7,0,Math.PI*2);ctx.stroke();}
      ctx.globalAlpha=.68;ctx.fillStyle='#063e53';ctx.beginPath();ctx.moveTo(0,viewH);for(let x=0;x<=viewW;x+=90)ctx.lineTo(x,650+Math.sin((x+cameraX*.12)*.015)*45+(x%170));ctx.lineTo(viewW,viewH);ctx.closePath();ctx.fill();
      ctx.fillStyle='#0d3142';ctx.globalAlpha=.75;for(let i=0;i<8;i++){const x=parallaxWrap(i*330-cameraX*.18,2640)-160,y=490+(i%3)*45;ctx.save();ctx.translate(x,y);ctx.rotate((i%2?-.09:.06));ctx.fillRect(0,0,250,76);ctx.fillStyle='#36b8b0';ctx.fillRect(25,18,46,18);ctx.fillRect(92,18,46,18);ctx.fillStyle='#0d3142';ctx.restore();}
      ctx.fillStyle='#d8ffff';ctx.globalAlpha=.9;ctx.font='bold 18px Arial';ctx.fillText('ABYSSAL REPAIR ZONE',38,140);
    }else if(stageTheme==='factory'){
      ctx.globalAlpha=.72;ctx.fillStyle='#111822';for(let i=0;i<14;i++){const x=parallaxWrap(i*170-cameraX*.12,2380)-120,h=260+(i%4)*70;ctx.fillRect(x,610-h,128,h);ctx.fillStyle='#263442';ctx.fillRect(x+16,620-h,20,h-35);ctx.fillStyle='#111822';}
      ctx.strokeStyle='#627382';ctx.lineWidth=28;ctx.beginPath();ctx.moveTo(-80,180);ctx.lineTo(viewW*.38,180);ctx.quadraticCurveTo(viewW*.46,180,viewW*.46,260);ctx.lineTo(viewW*.46,510);ctx.stroke();ctx.strokeStyle='#26313d';ctx.lineWidth=12;ctx.stroke();
      for(let i=0;i<9;i++){const x=parallaxWrap(i*265-cameraX*.22,2385)-120,y=290+(i%3)*105;ctx.save();ctx.translate(x,y);ctx.rotate(elapsed*(i%2?-.25:.2));ctx.strokeStyle='#4a5965';ctx.lineWidth=14;ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.stroke();for(let tooth=0;tooth<8;tooth++){ctx.rotate(Math.PI/4);ctx.fillStyle='#4a5965';ctx.fillRect(38,-8,26,16);}ctx.restore();}
      for(let i=0;i<12;i++){const x=parallaxWrap(i*210-cameraX*.16,2520)-100,y=125+(i%4)*125;ctx.fillStyle=Math.floor(elapsed*2+i)%2?'#ff3b24':'#5f1615';ctx.shadowColor='#ff3b20';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
    }else if(stageTheme==='boss'){
      ctx.globalAlpha=.76;ctx.fillStyle='#ffbb5c';ctx.shadowColor='#ff3d2d';ctx.shadowBlur=70;ctx.beginPath();ctx.arc(viewW*.72-cameraX*.022,175,105,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=.38;ctx.fillStyle='#1a0c25';for(let i=0;i<12;i++){const x=parallaxWrap(i*190-cameraX*.1,2280)-130,h=180+(i*71)%310;ctx.fillRect(x,610-h,145,h);ctx.fillStyle='#ff4050';for(let y=630-h;y<570;y+=45)ctx.fillRect(x+20+(i%2)*22,y,8,19);ctx.fillStyle='#1a0c25';}
      ctx.strokeStyle='#ff5a42';ctx.globalAlpha=.5;ctx.lineWidth=4;for(let line=0;line<6;line++){ctx.beginPath();const y=240+line*70;ctx.moveTo(0,y);for(let x=0;x<viewW;x+=85)ctx.lineTo(x,y+Math.sin((x+cameraX*.16)*.02+line)*28);ctx.stroke();}
      for(let i=0;i<32;i++){const x=parallaxWrap(i*79-cameraX*.04,2528),y=parallaxWrap(700-i*67-elapsed*(28+i%5*7),760);ctx.fillStyle=i%2?'#ffd15c':'#ff5438';ctx.globalAlpha=.45;ctx.fillRect(x,y,3+i%3,8+i%6);}
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='screen';
    if(stageTheme==='city'||stageTheme==='factory'){
      for(let sign=0;sign<6;sign++){const x=parallaxWrap(sign*390-cameraX*.24,2340)-140,y=205+(sign%3)*105,w=116+(sign%2)*34;ctx.save();ctx.translate(x,y);ctx.transform(1,-.08,.04,1,0,0);ctx.fillStyle=sign%2?'#073c55cc':'#351249cc';ctx.strokeStyle=sign%2?'#48efff':'#ff5de1';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=18;ctx.lineWidth=3;ctx.fillRect(0,0,w,42);ctx.strokeRect(0,0,w,42);ctx.fillStyle='#eaffff';ctx.font='900 12px Arial';ctx.textAlign='center';ctx.fillText(sign%2?'REPAIR // 24':'FENI GRID',w/2,26);ctx.restore();}
      for(let craft=0;craft<4;craft++){const span=viewW+460,x=parallaxWrap(elapsed*(42+craft*8)+craft*430-cameraX*.055,span)-220,y=115+craft*78;ctx.strokeStyle='#78f5ff';ctx.fillStyle='#14334f';ctx.shadowColor='#4cecff';ctx.shadowBlur=18;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+48,y-9);ctx.lineTo(x+75,y+2);ctx.lineTo(x+45,y+12);ctx.closePath();ctx.fill();ctx.stroke();ctx.globalAlpha=.28;ctx.fillStyle='#5aeaff';ctx.fillRect(x-115,y,110,3);ctx.globalAlpha=1;}
    }else if(stageTheme==='underground'){
      ctx.strokeStyle='#50efff';ctx.shadowColor='#31cfff';ctx.shadowBlur=16;ctx.lineWidth=3;for(let circuit=0;circuit<7;circuit++){const x=parallaxWrap(circuit*310-cameraX*.19,2170)-80,y=230+(circuit%4)*115;ctx.beginPath();ctx.moveTo(x-90,y);ctx.lineTo(x,y);ctx.lineTo(x+35,y-34);ctx.lineTo(x+125,y-34);ctx.stroke();ctx.fillStyle=circuit%2?'#ffb54e':'#75f6ff';ctx.beginPath();ctx.arc(x+125,y-34,6+Math.sin(elapsed*4+circuit)*2,0,Math.PI*2);ctx.fill();}
    }else if(stageTheme==='sea'){
      const beastX=parallaxWrap(1700-cameraX*.045,2600)-520,beastY=370+Math.sin(elapsed*.45)*22;ctx.globalAlpha=.18;ctx.fillStyle='#051c38';ctx.shadowColor='#2bdcff';ctx.shadowBlur=25;ctx.beginPath();ctx.ellipse(beastX,beastY,260,62,-.05,0,Math.PI*2);ctx.moveTo(beastX+230,beastY);ctx.lineTo(beastX+360,beastY-105);ctx.lineTo(beastX+330,beastY+72);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(beastX-20,beastY-48);ctx.lineTo(beastX+60,beastY-135);ctx.lineTo(beastX+95,beastY-35);ctx.fill();ctx.globalAlpha=.8;ctx.fillStyle='#82fbff';ctx.beginPath();ctx.arc(beastX-190,beastY-15,6,0,Math.PI*2);ctx.fill();
    }else if(stageTheme==='sky'){
      ctx.strokeStyle='#fff1a1';ctx.shadowColor='#63eaff';ctx.shadowBlur=22;ctx.lineWidth=6;for(let ring=0;ring<4;ring++){const x=parallaxWrap(ring*560-cameraX*.13,2240)-140,y=230+(ring%2)*210;ctx.save();ctx.translate(x,y);ctx.rotate(elapsed*.12*(ring%2?1:-1));ctx.beginPath();ctx.ellipse(0,0,90,28,.22,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(0,0,55,75,-.18,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }else if(stageTheme==='boss'){
      ctx.strokeStyle='#fff09b';ctx.shadowColor='#ff3b24';ctx.shadowBlur=32;ctx.lineWidth=5;for(let bolt=0;bolt<5;bolt++){const x=parallaxWrap(bolt*330-cameraX*.08,1650)-80,y=40+(bolt%2)*70;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+35,y+70);ctx.lineTo(x+10,y+128);ctx.lineTo(x+75,y+220);ctx.stroke();}
    }
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.12;ctx.fillStyle='#ffffff';for(let y=0;y<viewH;y+=5)ctx.fillRect(0,y,viewW,1);
    const shade=ctx.createLinearGradient(0,0,viewW,0);shade.addColorStop(0,'#02050dcc');shade.addColorStop(.16,'#0000');shade.addColorStop(.84,'#0000');shade.addColorStop(1,'#02050dcc');ctx.globalAlpha=.48;ctx.fillStyle=shade;ctx.fillRect(0,0,viewW,viewH);
    ctx.restore();
  }

  // The previous cinematic renderer rebuilt hundreds of windows, scanlines and
  // blurred shapes every frame. This version keeps the same stage identity and
  // parallax depth with a small, bounded number of canvas operations.
  function drawBackground() {
    const viewW=Math.max(1280,viewportWidth+100),viewH=Math.max(820,viewportHeight+160);
    const palettes={city:['#07192b','#286d85','#ef8a55'],underground:['#050714','#18162e','#493143'],sea:['#021a3a','#08668f','#18aeb9'],sky:['#113f82','#49add7','#f1d39d'],boss:['#120518','#63163d','#e6532e'],factory:['#070a11','#242d3a','#63392a']};
    const palette=palettes[stageTheme]||palettes.city,sky=ctx.createLinearGradient(0,-120,0,viewH);
    sky.addColorStop(0,palette[0]);sky.addColorStop(.62,palette[1]);sky.addColorStop(1,palette[2]);ctx.fillStyle=sky;ctx.fillRect(-80,-220,viewW+160,viewH+420);
    ctx.save();
    if(stageTheme==='city'){
      ctx.globalAlpha=.78;ctx.fillStyle='#ffd38a';ctx.beginPath();ctx.arc(viewW*.76-cameraX*.018,142-cameraY*.025,64,0,Math.PI*2);ctx.fill();
      for(let layer=0;layer<2;layer++)for(let i=0;i<10;i++){
        const spacing=185+layer*34,x=parallaxWrap(i*spacing-cameraX*(.065+layer*.08),spacing*10)-spacing,h=115+(i*53+layer*67)%210,ground=540-layer*22;
        ctx.globalAlpha=.82;ctx.fillStyle=layer?'#173b4d':'#102a40';ctx.fillRect(x,ground-h,spacing-24,h);
        ctx.globalAlpha=.35;ctx.fillStyle=layer?'#ffd16a':'#68ddef';ctx.fillRect(x+18,ground-h+28,10,Math.max(12,h-56));ctx.fillRect(x+48,ground-h+48,10,Math.max(10,h-82));
      }
      ctx.globalAlpha=.72;ctx.strokeStyle='#ffd45a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-40,260);for(let x=-40;x<viewW+100;x+=140)ctx.lineTo(x,248+Math.sin((x+cameraX*.1)*.012)*30);ctx.stroke();
      for(let sign=0;sign<3;sign++){const x=parallaxWrap(sign*620-cameraX*.21,1860)-120,y=220+(sign%2)*120,w=132;ctx.globalAlpha=.82;ctx.fillStyle=sign%2?'#351249':'#073c55';ctx.strokeStyle=sign%2?'#ff69e6':'#63efff';ctx.lineWidth=3;ctx.fillRect(x,y,w,40);ctx.strokeRect(x,y,w,40);ctx.fillStyle='#eaffff';ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText(sign%2?'FENI GRID':'REPAIR // 24',x+w/2,y+25);}
    }else if(stageTheme==='sky'){
      ctx.globalAlpha=.74;ctx.fillStyle='#fff4c5';ctx.beginPath();ctx.arc(viewW*.78-cameraX*.025,126,54,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f4ffff';for(let i=0;i<9;i++){const x=parallaxWrap(i*245-cameraX*.075,2205)-170,y=125+(i%3)*112;ctx.globalAlpha=.18+(i%3)*.08;ctx.beginPath();ctx.ellipse(x,y,112,27,0,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#24486c';for(let i=0;i<8;i++){const x=parallaxWrap(i*285-cameraX*.18,2280)-180,y=490+(i%3)*42;ctx.globalAlpha=.46;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+165,y);ctx.lineTo(x+132,y+48);ctx.lineTo(x+32,y+48);ctx.closePath();ctx.fill();ctx.fillStyle='#67e8ff';ctx.fillRect(x+34,y+13,92,4);ctx.fillStyle='#24486c';}
      ctx.globalAlpha=.5;ctx.strokeStyle='#fff3a8';ctx.lineWidth=5;for(let ring=0;ring<3;ring++){const x=parallaxWrap(ring*700-cameraX*.12,2100)-120,y=215+(ring%2)*190;ctx.beginPath();ctx.ellipse(x,y,76,23,.2,0,Math.PI*2);ctx.stroke();}
    }else if(stageTheme==='underground'){
      ctx.globalAlpha=.96;ctx.fillStyle='#090714';ctx.beginPath();ctx.moveTo(-20,-20);for(let x=-20;x<=viewW+80;x+=105)ctx.lineTo(x,42+(Math.floor(x/105)%4)*24);ctx.lineTo(viewW+80,-20);ctx.closePath();ctx.fill();
      ctx.fillStyle='#2a2238';ctx.beginPath();ctx.moveTo(-20,viewH+20);for(let x=-20;x<=viewW+80;x+=110)ctx.lineTo(x,650+(Math.floor(x/110)%3)*37);ctx.lineTo(viewW+80,viewH+20);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.62;ctx.strokeStyle='#43e9ff';ctx.lineWidth=4;for(let circuit=0;circuit<6;circuit++){const x=parallaxWrap(circuit*350-cameraX*.16,2100)-90,y=205+(circuit%4)*112;ctx.beginPath();ctx.moveTo(x-75,y);ctx.lineTo(x,y);ctx.lineTo(x+32,y-30);ctx.lineTo(x+118,y-30);ctx.stroke();ctx.fillStyle=circuit%2?'#ffb84f':'#7af6ff';ctx.beginPath();ctx.arc(x+118,y-30,5,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=.9;ctx.fillStyle='#ffe477';ctx.font='bold 17px Arial';ctx.fillText('SUBTERRANEAN REPAIR NETWORK',38,140);
    }else if(stageTheme==='sea'){
      ctx.fillStyle='#c8ffff';for(let ray=0;ray<4;ray++){const x=parallaxWrap(ray*430-cameraX*.04,1720)-260;ctx.globalAlpha=.06;ctx.beginPath();ctx.moveTo(x,-40);ctx.lineTo(x+75,720);ctx.lineTo(x+190,720);ctx.lineTo(x+42,-40);ctx.closePath();ctx.fill();}
      ctx.strokeStyle='#c8ffff';ctx.lineWidth=2;for(let bubble=0;bubble<16;bubble++){const x=parallaxWrap(bubble*137-cameraX*.06,2192),y=parallaxWrap(bubble*97-elapsed*(14+bubble%3*4),760);ctx.globalAlpha=.25+(bubble%3)*.1;ctx.beginPath();ctx.arc(x,y,4+bubble%5,0,Math.PI*2);ctx.stroke();}
      ctx.globalAlpha=.72;ctx.fillStyle='#06455b';ctx.beginPath();ctx.moveTo(-20,viewH+20);for(let x=-20;x<=viewW+100;x+=120)ctx.lineTo(x,650+Math.sin((x+cameraX*.12)*.016)*38+(Math.floor(x/120)%2)*45);ctx.lineTo(viewW+100,viewH+20);ctx.closePath();ctx.fill();
      ctx.fillStyle='#0c3142';for(let wreck=0;wreck<5;wreck++){const x=parallaxWrap(wreck*510-cameraX*.16,2550)-180,y=500+(wreck%3)*38;ctx.globalAlpha=.62;ctx.save();ctx.translate(x,y);ctx.rotate(wreck%2?-.08:.05);ctx.fillRect(0,0,230,68);ctx.fillStyle='#39b8b2';ctx.fillRect(28,18,42,14);ctx.fillRect(92,18,42,14);ctx.restore();ctx.fillStyle='#0c3142';}
      ctx.globalAlpha=.9;ctx.fillStyle='#d8ffff';ctx.font='bold 17px Arial';ctx.fillText('ABYSSAL REPAIR ZONE',38,140);
    }else if(stageTheme==='factory'){
      ctx.globalAlpha=.78;for(let i=0;i<10;i++){const x=parallaxWrap(i*210-cameraX*.13,2100)-130,h=245+(i%4)*68;ctx.fillStyle=i%2?'#202a36':'#111821';ctx.fillRect(x,610-h,152,h);ctx.fillStyle='#354451';ctx.fillRect(x+18,625-h,18,h-38);}
      ctx.strokeStyle='#687987';ctx.lineWidth=24;ctx.beginPath();ctx.moveTo(-80,178);ctx.lineTo(viewW*.42,178);ctx.quadraticCurveTo(viewW*.48,178,viewW*.48,245);ctx.lineTo(viewW*.48,500);ctx.stroke();ctx.strokeStyle='#28333e';ctx.lineWidth=10;ctx.stroke();
      for(let gear=0;gear<5;gear++){const x=parallaxWrap(gear*470-cameraX*.2,2350)-100,y=315+(gear%3)*105;ctx.save();ctx.translate(x,y);ctx.rotate(elapsed*(gear%2?-.18:.15));ctx.strokeStyle='#52616d';ctx.lineWidth=12;ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*2);ctx.stroke();ctx.restore();}
      ctx.fillStyle='#ffcf36';ctx.globalAlpha=.9;ctx.font='bold 18px Arial';ctx.fillText('CRUSH FACTORY  → ESCAPE',38,140);
    }else{
      ctx.globalAlpha=.72;ctx.fillStyle='#ffbd61';ctx.beginPath();ctx.arc(viewW*.73-cameraX*.02,165,84,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#190d24';for(let i=0;i<10;i++){const x=parallaxWrap(i*215-cameraX*.1,2150)-140,h=175+(i*71)%300;ctx.globalAlpha=.52;ctx.fillRect(x,610-h,160,h);ctx.fillStyle='#ff4b52';ctx.fillRect(x+22,635-h,7,Math.max(12,h-70));ctx.fillStyle='#190d24';}
      ctx.strokeStyle='#ff6548';ctx.lineWidth=4;for(let line=0;line<4;line++){ctx.globalAlpha=.46;ctx.beginPath();const y=250+line*92;ctx.moveTo(0,y);for(let x=0;x<viewW+80;x+=125)ctx.lineTo(x,y+Math.sin((x+cameraX*.14)*.018+line)*24);ctx.stroke();}
      for(let ember=0;ember<effectCount(18,10);ember++){const x=parallaxWrap(ember*131-cameraX*.04,2358),y=parallaxWrap(680-ember*71-elapsed*(18+ember%4*5),740);ctx.fillStyle=ember%2?'#ffd15c':'#ff5438';ctx.globalAlpha=.45;ctx.fillRect(x,y,3,8);}
    }
    const shade=ctx.createLinearGradient(0,0,viewW,0);shade.addColorStop(0,'#02050da8');shade.addColorStop(.14,'#0000');shade.addColorStop(.86,'#0000');shade.addColorStop(1,'#02050da8');ctx.globalAlpha=.42;ctx.fillStyle=shade;ctx.fillRect(0,0,viewW,viewH);
    ctx.restore();
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
    drawGimmicks();
    drawHazards();
    coins.forEach(drawCoin);
    items.forEach(drawItem);
    transformItems.forEach(drawTransformItem);
    checkpoints.forEach(drawCheckpoint);
    breakables.forEach(w=>{if(!w.alive||!visibleInCamera(w,90))return;ctx.fillStyle='#8b5737';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeStyle='#ffd335';ctx.lineWidth=4;ctx.strokeRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.fillText('BREAK',w.x+5,w.y+42);});
    currents.forEach(c=>{if(!visibleInCamera(c,80))return;ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=c.force>0?'#48eaff':'#83aaff';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.globalAlpha=.95;ctx.fillStyle='#efffff';ctx.shadowColor='#54eaff';ctx.shadowBlur=12;ctx.font='bold 30px Arial';for(let x=c.x+30;x<c.x+c.w;x+=80)ctx.fillText(c.force>0?'→':'←',x,c.y+c.h/2+Math.sin(elapsed*5+x)*8);ctx.restore();});
    bubbles.forEach(b=>{if(!visibleInCamera({x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2},80))return;ctx.save();ctx.strokeStyle='#d7ffff';ctx.lineWidth=4;ctx.shadowColor='#a8ffff';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(b.x,b.y+Math.sin(b.phase)*12,b.r,0,7);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.fillText('O₂',b.x-9,b.y+4);ctx.restore();});
    drawGoal();
    if(swordItem&&!swordItem.collected&&visibleInCamera(swordItem,110)){ctx.save();ctx.translate(swordItem.x+swordItem.w/2,swordItem.y+swordItem.h/2+Math.sin(elapsed*3)*8);ctx.rotate(.12*Math.sin(elapsed*2));ctx.shadowColor='#ff5a1f';ctx.shadowBlur=30;if(phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth)ctx.drawImage(phoenixSwordImage,-38,-64,76,114);ctx.restore();}
    if(bossGate?.closed&&visibleInCamera(bossGate,100)){ctx.fillStyle='#ff3d31';ctx.shadowColor='#ff2c22';ctx.shadowBlur=18;for(let y=bossGate.y;y<bossGate.y+bossGate.h;y+=34)ctx.fillRect(bossGate.x,y,bossGate.w,18);ctx.shadowBlur=0;}
    enemies.forEach(drawEnemy);
    if(boss?.intro && (boss.alive || boss.defeat<.7)&&visibleInCamera(boss,260)) drawBoss();
    droplets.forEach(drawDroplet);
    projectiles.forEach(p=>{if(!visibleInCamera({x:p.x-p.w,y:p.y-p.h,w:p.w*2,h:p.h*2},100))return;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.lineWidth=5;ctx.shadowBlur=18;
      if(p.kind==='torpedo'){ctx.fillStyle='#8defff';ctx.strokeStyle='#eaffff';ctx.shadowColor='#45dfff';ctx.beginPath();ctx.ellipse(0,0,p.w*.62,p.h*.55,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ff5b24';ctx.beginPath();ctx.moveTo(-p.w*.5,0);ctx.lineTo(-p.w*.95,-p.h*.55);ctx.lineTo(-p.w*.95,p.h*.55);ctx.closePath();ctx.fill();ctx.fillStyle='#d9ffff';for(let trail=1;trail<=3;trail++){ctx.globalAlpha=.8-trail*.18;ctx.beginPath();ctx.arc(-p.w*(.9+trail*.55),0,3+trail*2,0,7);ctx.fill();}}
      else{ctx.fillStyle='#ffef39';ctx.strokeStyle='#ff3028';ctx.shadowColor='#ff3028';ctx.beginPath();ctx.arc(0,0,p.w/2,0,7);ctx.fill();ctx.stroke();}ctx.restore();});
    wingShots.forEach((wing)=>{if(!visibleInCamera({x:wing.x-wing.w,y:wing.y-wing.h,w:wing.w*2,h:wing.h*2},100))return;ctx.save();ctx.translate(wing.x,wing.y);ctx.rotate(Math.atan2(wing.vy,wing.vx));ctx.globalCompositeOperation='screen';
      if(wing.kind==='allyPulse'){
        ctx.shadowColor='#45ff79';ctx.shadowBlur=24;ctx.fillStyle='#d9ffe4';ctx.strokeStyle='#37e96b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-5,-10);ctx.lineTo(-20,0);ctx.lineTo(-5,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#55ff82';ctx.fillRect(-38,-3,24,6);
      }else if(wing.kind==='radialPunch'){
        ctx.shadowColor='#ff391c';ctx.shadowBlur=30;ctx.fillStyle='#ff7b27';ctx.strokeStyle='#fff06d';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(5,0,31,18,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff1a1';for(let finger=0;finger<4;finger++)ctx.fillRect(8+finger*6,-16,5,12);ctx.strokeStyle='#ff5923';ctx.beginPath();ctx.moveTo(-22,-12);ctx.lineTo(-65,-4);ctx.lineTo(-34,4);ctx.lineTo(-72,14);ctx.stroke();
      }else if(wing.kind==='fireFeather'){
        ctx.shadowColor='#ff3418';ctx.shadowBlur=26;ctx.fillStyle='#fff3a2';ctx.strokeStyle='#ff5a1f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(25,0);ctx.quadraticCurveTo(0,-19,-27,-13);ctx.quadraticCurveTo(-8,-3,-34,0);ctx.quadraticCurveTo(-7,6,-25,16);ctx.quadraticCurveTo(2,17,25,0);ctx.fill();ctx.stroke();ctx.fillStyle='#ff3d19';ctx.globalAlpha=.82;ctx.beginPath();ctx.moveTo(-15,-10);ctx.lineTo(-56,-3);ctx.lineTo(-31,5);ctx.lineTo(-62,15);ctx.lineTo(-12,12);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      }else{
        ctx.shadowColor='#ff4b18';ctx.shadowBlur=28;ctx.fillStyle='#fff4a8';ctx.strokeStyle='#ff7026';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(30,0);ctx.quadraticCurveTo(4,-31,-33,-24);ctx.quadraticCurveTo(-13,-9,-41,0);ctx.quadraticCurveTo(-12,8,-31,27);ctx.quadraticCurveTo(5,25,30,0);ctx.fill();ctx.stroke();ctx.fillStyle='#ff5b1e';ctx.globalAlpha=.82;ctx.beginPath();ctx.moveTo(-18,-14);ctx.lineTo(-65,-4);ctx.lineTo(-35,7);ctx.lineTo(-72,20);ctx.lineTo(-19,15);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.globalAlpha=1;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(-5,i*7);ctx.lineTo(22,0);ctx.stroke();}
      }
      ctx.restore();});
    shockwaves.forEach(p=>{
      if(!visibleInCamera({x:p.x-(p.w||30)*2,y:p.y-(p.h||100),w:(p.w||30)*4,h:(p.h||100)*2},160))return;
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
    rushTrails.forEach((p)=>{if(p.delay>0||!visibleInCamera({x:p.x-p.size*3,y:p.y-p.size,w:p.size*4,h:p.size*2},100))return;ctx.save();ctx.globalAlpha=Math.min(1,p.life*4);ctx.translate(p.x,p.y);ctx.scale(p.facing,1);ctx.shadowColor='#ff401e';ctx.shadowBlur=24;ctx.strokeStyle='#fff36c';ctx.lineWidth=5;ctx.fillStyle='#ff7a26';ctx.beginPath();ctx.ellipse(0,0,p.size*1.25,p.size*.62,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff4a5';for(let i=0;i<4;i++)ctx.fillRect(p.size*.2+i*p.size*.23,-p.size*.55,p.size*.18,p.size*.38);ctx.strokeStyle='#ffb126';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-p.size*1.1,-p.size*.7);ctx.lineTo(-p.size*2.8,-p.size*.2);ctx.lineTo(-p.size*1.7,p.size*.15);ctx.lineTo(-p.size*3,p.size*.75);ctx.stroke();ctx.restore();});
    speedTrails.forEach((trail)=>{if(!visibleInCamera({x:trail.x-Math.abs(trail.vx*.1),y:trail.y-12,w:Math.abs(trail.vx*.1)+20,h:24},80))return;ctx.save();ctx.globalAlpha=Math.min(1,trail.life*4);ctx.strokeStyle=trail.tier===3?'#ffb12d':trail.tier===2?'#fff06a':'#9befff';ctx.shadowColor=trail.tier===3?'#ff4a1c':'#42dfff';ctx.shadowBlur=12;ctx.lineWidth=trail.size;ctx.beginPath();ctx.moveTo(trail.x,trail.y);ctx.lineTo(trail.x-trail.vx*.09,trail.y);ctx.stroke();ctx.restore();});
    combatFx.forEach(p=>{if(!visibleInCamera({x:p.x-p.size,y:p.y-p.size,w:p.size*2,h:p.size*2},120))return;ctx.save();ctx.globalAlpha=Math.min(1,p.life*3);const colors={gold:'#ffd335',speed:'#42eaff',fire:'#ff5425',explosion:'#ff7b25',slash:'#ffb12e',punch:'#ff4a1f',stomp:'#fff06a',ally:'#55ff82',teleport:'#6ff2ff',clash:'#ffffff'};ctx.strokeStyle=colors[p.type]||'#fff';ctx.fillStyle=colors[p.type]||'#ffd335';ctx.lineWidth=p.type==='clash'?7:12;ctx.shadowColor=colors[p.type]||'#ff3b20';ctx.shadowBlur=reducedEffects?16:30;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-p.life*.35),0,7);['explosion','gold','fire'].includes(p.type)?ctx.fill():ctx.stroke();if(p.type==='clash'){for(let ray=0;ray<8;ray++){const angle=ray*Math.PI/4,length=p.size*(.45+ray%2*.22);ctx.beginPath();ctx.moveTo(p.x+Math.cos(angle)*12,p.y+Math.sin(angle)*12);ctx.lineTo(p.x+Math.cos(angle)*length,p.y+Math.sin(angle)*length);ctx.stroke();}}if(p.points){ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#fff';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(`+${p.points}`,p.x,p.y-45-(1-p.life)*25);}ctx.restore();});
    dust.forEach((particle) => { if(!visibleInCamera({x:particle.x-8,y:particle.y-8,w:16,h:16},60))return;ctx.globalAlpha = particle.life * 1.8; ctx.fillStyle = '#dfc18a'; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    afterimages.forEach((ghost) => { if(!visibleInCamera({x:ghost.x,y:ghost.y,w:player.w,h:player.h},100))return;if(ghost.lcd){ctx.save();ctx.globalCompositeOperation='screen';if(!reducedEffects)ctx.filter='hue-rotate(135deg) saturate(2)';} drawFeniSprite(ghost.x, ghost.y, ghost.facing, 0, .28 * ghost.life / .28,ghost.mode,ghost.state); if(ghost.lcd)ctx.restore(); });
    sparks.forEach((p) => { if(!visibleInCamera({x:p.x-10,y:p.y-10,w:20,h:20},60))return;ctx.globalAlpha=p.life*1.7;ctx.fillStyle=(Math.floor((p.x+p.y+p.size)*.17)&1)?'#ffec48':'#ff5a1f';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,7);ctx.fill(); });
    shieldShards.forEach((p)=>{if(!visibleInCamera({x:p.x-p.size,y:p.y-p.size,w:p.size*2,h:p.size*2},60))return;ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle='#bffaff';ctx.strokeStyle='#3ddfff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-p.size);ctx.lineTo(p.x+p.size*.75,p.y+p.size*.5);ctx.lineTo(p.x-p.size*.65,p.y+p.size);ctx.closePath();ctx.fill();ctx.stroke();});
    ctx.globalAlpha = 1;
    confetti.forEach(p=>{if(!visibleInCamera({x:p.x,y:p.y,w:8,h:14},40))return;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,8,14);});
    modeParticles.forEach(p => { if(!visibleInCamera({x:p.x-10,y:p.y-10,w:20,h:20},60))return;ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; if (p.digital) ctx.fillRect(p.x, p.y, p.size * 2.2, p.size); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } });
    ctx.globalAlpha = 1;
    kingClones.forEach(drawKingClone);
    drawPlayer();
    ctx.restore();
  }

  function drawChaserWall(){
    if(!chaserWall||!visibleInCamera({x:chaserWall.x,y:0,w:chaserWall.w,h:WORLD_HEIGHT},220))return;
    ctx.save();ctx.translate(chaserWall.x,0);ctx.shadowColor='#ff321f';ctx.shadowBlur=22+chaserWall.warning*35;
    ctx.fillStyle='#181b22';ctx.fillRect(0,-80,chaserWall.w,WORLD_HEIGHT+300);
    ctx.fillStyle='#4c1e1c';for(let y=-40;y<WORLD_HEIGHT+180;y+=86)ctx.fillRect(15,y,chaserWall.w-30,58);
    ctx.strokeStyle='#ff5a25';ctx.lineWidth=8;ctx.strokeRect(4,-70,chaserWall.w-8,WORLD_HEIGHT+260);
    ctx.fillStyle='#ffd63a';ctx.font='bold 44px Arial';ctx.textAlign='center';for(let y=80;y<WORLD_HEIGHT;y+=120)ctx.fillText('→',chaserWall.w/2,y);
    ctx.fillStyle='#fff';ctx.font='bold 15px Arial';ctx.fillText('CRUSH WALL',chaserWall.w/2,45);ctx.restore();
  }

  function drawBoss(){
    ctx.save();ctx.translate(boss.x+boss.w/2,boss.y+boss.h/2);ctx.shadowColor=boss.hit?'#fff':'#ff352d';ctx.shadowBlur=35;
    if(boss.state==='intro'){const introProgress=1-boss.introLock/BOSS_INTRO_DURATION;ctx.globalAlpha=.45+.55*introProgress;ctx.scale(.78+.22*introProgress,.78+.22*introProgress);}
    if(boss.state==='telegraph'){ctx.globalAlpha=.65+.35*Math.sin(elapsed*28);ctx.strokeStyle='#fff13d';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,145+Math.sin(elapsed*18)*12,0,7);ctx.stroke();
      const tx=boss.targetX-(boss.x+boss.w/2),ty=boss.targetY-(boss.y+boss.h/2),len=Math.hypot(tx,ty)||1;ctx.setLineDash([20,12]);ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(tx/len*Math.min(250,len),ty/len*Math.min(250,len));ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
    if(boss.state==='attack'&&['charge','bite','breach'].includes(boss.attackName))ctx.scale(1.13,.9);
    if(boss.state==='recovery'){ctx.rotate(Math.sin(elapsed*5)*.025);ctx.scale(1,.94);}
    if(boss.type==='shark'&&enemyImages.mechaShark.complete&&enemyImages.mechaShark.naturalWidth){
      if(boss.vx>0)ctx.scale(-1,1);const spriteW=boss.w*1.34,spriteH=boss.h*1.48;
      if(boss.phase>=2&&!reducedEffects)ctx.filter=boss.phase===3?'saturate(1.9) contrast(1.25) hue-rotate(-25deg)':'saturate(1.55) contrast(1.15) hue-rotate(-12deg)';
      if(boss.hit)ctx.globalAlpha=.62+.38*Math.sin(elapsed*50);
      ctx.drawImage(enemyImages.mechaShark,-spriteW/2,-spriteH/2,spriteW,spriteH);ctx.filter='none';ctx.globalAlpha=1;
    }else if(bossImage.complete&&bossImage.naturalWidth){
      const spriteSize=Math.max(boss.w,boss.h)*1.28;
      if(boss.phase>=2&&!reducedEffects)ctx.filter=boss.phase===3?'saturate(1.85) contrast(1.25) hue-rotate(-14deg)':'saturate(1.45) contrast(1.08)';
      if(boss.hit)ctx.globalAlpha=.62+.38*Math.sin(elapsed*50);
      ctx.drawImage(bossImage,-spriteSize/2,boss.h/2-spriteSize,spriteSize,spriteSize);
      ctx.filter='none';ctx.globalAlpha=1;
    }else{
      ctx.fillStyle=boss.hit?'#fff':'#59204f';drawRoundedRect(-95,-115,190,230,28);ctx.fillStyle='#111d32';ctx.fillRect(-68,-82,136,122);
      ctx.strokeStyle='#ff5544';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-45,-45);ctx.lineTo(20,20);ctx.lineTo(-5,70);ctx.moveTo(20,20);ctx.lineTo(55,-55);ctx.stroke();
      ctx.fillStyle='#ffdb32';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('MEGA BUG',0,104);
    }
    ctx.restore();
    if(boss.state==='telegraph'&&(boss.attackName==='dive'||boss.attackName==='jump'||boss.attackName==='slam')){ctx.save();ctx.globalAlpha=.55+.4*Math.sin(elapsed*22);ctx.strokeStyle='#fff238';ctx.fillStyle='#ff3428aa';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(boss.targetX,boss.targetY+player.h/2,78,22,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText('!',boss.targetX,boss.targetY+player.h/2-28);ctx.restore();}
    ctx.fillStyle='#180c22';ctx.fillRect(boss.x,boss.y-28,boss.w,14);ctx.fillStyle='#ff493e';ctx.fillRect(boss.x,boss.y-28,boss.w*(boss.hp/boss.maxHp),14);
  }

  function drawPlatform(platform, kind = 'safe') {
    if (!visibleInCamera(platform,100)) return;
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
    if(!visibleInCamera(pad,80))return;
    ctx.fillStyle='#ff4a25'; ctx.fillRect(pad.x,pad.y,pad.w,pad.h);
    ctx.fillStyle='#fff04a'; ctx.beginPath(); ctx.moveTo(pad.x+8,pad.y+12);ctx.lineTo(pad.x+29,pad.y+2);ctx.lineTo(pad.x+50,pad.y+12);ctx.fill();
  }

  function drawHazards() {
    hazards.forEach((h)=>{if(!visibleInCamera({x:h.x-35,y:h.y-95,w:h.w+70,h:h.h+100},110))return;const active=hazardIsActive(h);ctx.save();ctx.globalAlpha=active ? 0.82+.18*Math.sin(elapsed*9+h.phase) : 0.42+.16*Math.sin(elapsed*12+h.phase);ctx.lineWidth=4;ctx.shadowBlur=20;
      ctx.fillStyle='#111';ctx.fillRect(h.x,h.y+h.h-6,h.w,8);for(let x=h.x;x<h.x+h.w;x+=16){ctx.fillStyle=((x-h.x)/16)%2<1?'#ffd62e':'#111';ctx.fillRect(x,h.y+h.h-6,16,8);}
      if(h.type==='mine'){ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.fillStyle='#252c36';ctx.strokeStyle='#ff4434';ctx.shadowColor='#ff2f22';ctx.shadowBlur=active?30:15;ctx.beginPath();ctx.arc(0,0,h.w*.36,0,7);ctx.fill();ctx.stroke();for(let a=0;a<8;a++){ctx.rotate(Math.PI/4);ctx.fillRect(h.w*.3,-3,h.w*.27,6);}ctx.fillStyle=active&&Math.floor(elapsed*8)%2?'#fff':'#ff3028';ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();}
      else if(h.type==='spinner'){ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.rotate(elapsed*3+h.phase);ctx.strokeStyle='#ffe329';ctx.shadowColor='#ff3020';for(let a=0;a<4;a++){ctx.rotate(Math.PI/2);ctx.fillStyle=a%2?'#111':'#ffd32b';ctx.fillRect(0,-7,h.w*.72,14);}ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.stroke();if(stageTheme==='sea'){ctx.rotate(-elapsed*3-h.phase);ctx.fillStyle=Math.floor(elapsed*6)%2?'#ff241d':'#fff';ctx.shadowColor='#ff241d';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();}}
      else if(h.type==='fire'){ctx.fillStyle=active?'#ff3b18':'#991e19';ctx.strokeStyle='#ffe52d';ctx.shadowColor='#ff3b18';if(!active){ctx.beginPath();ctx.ellipse(h.x+h.w/2,h.y+h.h,h.w*.55,13+Math.sin(elapsed*9)*5,0,0,7);ctx.fill();ctx.fillStyle='#fff12f';ctx.font='bold 16px Arial';ctx.fillText('!',h.x+h.w/2-4,h.y-8);}else for(let x=h.x;x<h.x+h.w;x+=22){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.quadraticCurveTo(x+4,h.y-18-Math.sin(elapsed*12)*8,x+11,h.y);ctx.lineTo(x+22,h.y+h.h);ctx.fill();ctx.stroke();}}
      else {ctx.fillStyle=h.type==='electric'?'#dffeff':'#ff3025';ctx.strokeStyle=h.type==='electric'?'#62ddff':'#fff36a';ctx.shadowColor=h.type==='electric'?'#45eaff':'#ff2018';ctx.shadowBlur=active?34:20;for(let x=h.x;x<h.x+h.w;x+=18){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+9,h.y);ctx.lineTo(x+18,h.y+h.h);ctx.fill();ctx.stroke();}ctx.fillStyle=h.type==='electric'?'#075b79':'#a61916';ctx.fillRect(h.x-10,h.y-28,h.w+20,23);for(let x=h.x-10;x<h.x+h.w+10;x+=20){ctx.fillStyle=((x-h.x)/20)%2<1?'#ffd62e':'#111';ctx.fillRect(x,h.y-28,20,7);}ctx.fillStyle='#ff281e';ctx.strokeStyle='#fff238';ctx.lineWidth=5;ctx.beginPath();ctx.arc(h.x+h.w/2,h.y-54,19,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 25px Arial';ctx.textAlign='center';ctx.fillText('!',h.x+h.w/2,h.y-45);ctx.font='bold 20px Arial';ctx.fillText(h.type==='electric'?'⚡ DANGER ⚡':'⚠ SPIKE ⚠',h.x+h.w/2,h.y-80);}
      ctx.restore();});
    fallingHazards.forEach((r)=>{if(!visibleInCamera({x:r.x-45,y:Math.min(r.y,r.targetY)-70,w:r.w+90,h:Math.abs(r.targetY-r.y)+r.h+100},120))return;ctx.save();if(r.warn>0){ctx.globalAlpha=.45+.5*Math.sin(elapsed*18);ctx.fillStyle='#ff281e';ctx.strokeStyle='#fff238';ctx.lineWidth=5;ctx.shadowColor='#ff281e';ctx.shadowBlur=24;ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.targetY-5,34+20*r.warn,12+8*r.warn,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('!',r.x+r.w/2,r.targetY-25);}ctx.globalAlpha=1;ctx.fillStyle='#ff4a25';ctx.strokeStyle='#ffe42e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+r.h/2,r.w/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText('!',r.x+r.w/2,r.y+r.h/2+7);ctx.restore();});
    const names=['A  WARM UP','B  PIT RUN','C  VERTICAL','D  SPEED','E  EXTREME'];const sections=names.map((n,i)=>[120+i*WORLD_WIDTH/5,`SECTION ${n}`]);
    ctx.font='bold 22px Arial';ctx.textAlign='left';sections.forEach(([x,label])=>{if(!visibleInCamera({x,y:205,w:390,h:38},90))return;ctx.fillStyle='#0d385dcc';ctx.fillRect(x,205,390,38);ctx.fillStyle='#fff36a';ctx.fillText(label,x+12,232);});
    // Every floor gap gets high-contrast caution stripes and visible downward darkness.
    const sorted=[...staticPlatforms].filter(p=>p.h>80).sort((a,b)=>a.x-b.x);for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];const gx=a.x+a.w,gw=b.x-gx;if(gw>35&&gw<420){const gy=Math.min(a.y,b.y);if(!visibleInCamera({x:gx,y:gy-25,w:gw,h:445},80))continue;ctx.fillStyle='#02030a';ctx.fillRect(gx,gy-5,gw,420);for(let x=gx;x<b.x;x+=28){ctx.fillStyle=(Math.floor((x-gx)/28)%2)?'#111':'#ffd32b';ctx.fillRect(x,gy-16,28,12);}ctx.fillStyle='#ff3a28';ctx.font='bold 18px Arial';ctx.fillText('⚠',gx+4,gy-23);ctx.fillText('⚠',b.x-24,gy-23);}}
  }

  function drawDetailedScenery() {
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

  function drawScenery() {
    const left=cameraX-180,right=cameraX+viewportWidth+180;
    if(stageTheme==='sea'){
      const zones=['海面','浅瀬','サンゴ礁','海中洞窟','沈没船','深海','海底'],zoneWidth=WORLD_WIDTH/zones.length;
      ctx.textAlign='left';
      const first=Math.max(0,Math.floor(left/zoneWidth)),last=Math.min(zones.length-1,Math.ceil(right/zoneWidth));
      for(let i=first;i<=last;i++){const x=i*zoneWidth+70;ctx.fillStyle='#062c49bb';ctx.fillRect(x,112,245,40);ctx.fillStyle='#d9ffff';ctx.font='bold 20px Arial';ctx.fillText(`${i+1}  ${zones[i]}`,x+12,140);}
      if(left<zoneWidth*1.1){ctx.strokeStyle='#b8ffff';ctx.lineWidth=6;ctx.globalAlpha=.65;ctx.beginPath();const start=Math.max(0,Math.floor(left/35)*35),end=Math.min(zoneWidth*1.1,right);for(let x=start;x<end;x+=35)ctx.lineTo(x,92+Math.sin(x*.025+elapsed*2)*9);ctx.stroke();ctx.globalAlpha=1;}
      ctx.fillStyle='#ff795b';const coralStart=Math.max(zoneWidth*2,Math.floor(left/145)*145);for(let x=coralStart;x<Math.min(zoneWidth*3,right);x+=145){ctx.fillRect(x,560,13,82);ctx.fillRect(x-18,585,48,12);}
      const shipX=zoneWidth*4+180;if(visibleInCamera({x:shipX,y:470,w:540,h:180},120)){ctx.fillStyle='#392e2a';ctx.beginPath();ctx.moveTo(shipX,510);ctx.lineTo(shipX+520,475);ctx.lineTo(shipX+430,640);ctx.lineTo(shipX+70,640);ctx.closePath();ctx.fill();ctx.strokeStyle='#d09355';ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#b8ffff';ctx.font='bold 18px Arial';ctx.fillText('SUNKEN REPAIR SHIP',shipX+125,545);}return;
    }
    if(stageTheme==='underground'){
      ctx.strokeStyle='#4be9ff';ctx.lineWidth=8;const start=Math.floor(left/140)*140,end=right+140;for(let y=190;y<WORLD_HEIGHT;y+=230){if(y<cameraY-80||y>cameraY+viewportHeight+80)continue;ctx.beginPath();ctx.moveTo(start,y+Math.sin(start*.01+y)*35);for(let x=start+140;x<end;x+=140)ctx.lineTo(x,y+Math.sin(x*.01+y)*35);ctx.stroke();}
      ctx.fillStyle='#ffe238';ctx.font='bold 17px Arial';const signStart=Math.max(520,Math.ceil((left-520)/900)*900+520);for(let x=signStart;x<right;x+=900)ctx.fillText(x%1800?'EXIT →':'↓ DEEP ROUTE',x,260+(Math.floor(x/900)%3)*185);return;
    }
    if(stageTheme==='factory'){
      ctx.fillStyle='#ffcc31';ctx.font='bold 24px Arial';const start=Math.max(450,Math.ceil((left-450)/700)*700+450);for(let x=start;x<right;x+=700)ctx.fillText('→  RUN  →',x,FLOOR_Y-145);return;
    }
    const props=[[620,'TOOL'],[1590,'PARTS'],[3070,'🔧'],[4780,'BATTERY'],[6440,'REPAIR']];
    for(const [x,label] of props){if(x<left-60||x>right+60)continue;ctx.fillStyle='#714b2b';ctx.fillRect(x,FLOOR_Y-90,8,90);ctx.fillStyle='#1c6075';drawRoundedRect(x-35,FLOOR_Y-125,78,45,5);ctx.strokeStyle='#5ce6ef';ctx.lineWidth=3;ctx.strokeRect(x-35,FLOOR_Y-125,78,45);ctx.fillStyle='#fff36a';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(label,x+4,FLOOR_Y-98);}
    for(const x of[2300,3850,5470,7130]){if(x<left-80||x>right+80)continue;ctx.fillStyle='#aa713c';ctx.fillRect(x,FLOOR_Y-42,70,42);ctx.strokeStyle='#71431d';ctx.strokeRect(x,FLOOR_Y-42,70,42);ctx.fillStyle='#5c381d';ctx.font='20px Arial';ctx.fillText('⚙',x+35,FLOOR_Y-13);}
  }

  function drawCoin(coin) {
    if (coin.collected||!visibleInCamera({x:coin.x-18,y:coin.y-18,w:36,h:36},70)) return;
    const squash = .35 + Math.abs(Math.sin(coin.phase)) * .65;
    ctx.save(); ctx.translate(coin.x, coin.y + Math.sin(coin.phase) * 4); ctx.scale(squash, 1);
    ctx.fillStyle = '#ffd52f'; ctx.strokeStyle = '#b76a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff49d'; ctx.fillRect(-3, -7, 4, 11); ctx.restore();
  }

  function drawItem(item) {
    if(item.collected||!visibleInCamera({x:item.x-42,y:item.y-42,w:84,h:84},80)) return;
    const symbols={battery:'🔋',screen:'📱',toolbox:'🧰',fenicoin:'🔥',fire:'🔥',muscle:'👊'};
    ctx.save(); ctx.translate(item.x,item.y+Math.sin(item.phase)*6); ctx.shadowColor='#fff25b'; ctx.shadowBlur=18;
    ctx.fillStyle=item.type==='fenicoin'?'#ffd338':'#eaffff'; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.font='26px Arial'; ctx.textAlign='center'; ctx.fillText(symbols[item.type],0,9); ctx.restore();
  }

  function drawTransformItem(item) {
    if (item.collected||!visibleInCamera({x:item.x-48,y:item.y-150,w:96,h:205},100)) return;
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
    if(!visibleInCamera({x:checkpoint.x,y:checkpoint.y,w:80,h:75},90))return;
    ctx.save();
    if (checkpoint.active) { ctx.shadowColor = '#65ff93'; ctx.shadowBlur = 24; }
    ctx.fillStyle = '#6d4930'; ctx.fillRect(checkpoint.x, checkpoint.y, 8, 70);
    ctx.fillStyle = checkpoint.active ? '#51e77f' : '#e8eef0'; ctx.beginPath(); ctx.moveTo(checkpoint.x + 8, checkpoint.y); ctx.lineTo(checkpoint.x + 70, checkpoint.y + 18); ctx.lineTo(checkpoint.x + 8, checkpoint.y + 36); ctx.fill();
    ctx.fillStyle = '#143044'; ctx.font = 'bold 11px Arial'; ctx.fillText('CHECK', checkpoint.x + 37, checkpoint.y + 21);
    ctx.restore();
  }

  function drawGoal() {
    if(!visibleInCamera({x:goal.x,y:goal.y,w:112,h:190},130))return;
    ctx.fillStyle = '#49616b'; ctx.fillRect(goal.x, goal.y, 12, 180);
    ctx.fillStyle = '#ff4d22'; ctx.beginPath(); ctx.moveTo(goal.x + 12, goal.y); ctx.lineTo(goal.x + 100, goal.y + 30); ctx.lineTo(goal.x + 12, goal.y + 62); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px Arial'; ctx.fillText('REPAIR!', goal.x + 52, goal.y + 36);
    ctx.fillStyle = '#ffd238'; ctx.beginPath(); ctx.arc(goal.x + 6, goal.y, 12, 0, 7); ctx.fill();
  }

  function currentMotionFrame(renderState=player.state) {
    if(renderState==='special'){
      if(player.ultimateSequence)return player.ultimateSequence.phase==='cutin'?'alert':'stretch';
      const phase=player.specialTime>0.78?'alert':player.specialTime>.22?'wingFire':'wingRecover';
      if(playerMode==='lcd')return player.specialTime>.22?'wingFire':'land';
      if(playerMode==='muscle')return player.specialTime>.76?'alert':player.specialTime>.2?'doubleJump':'land';
      if(playerMode==='king')return player.specialTime>.72?'stretch':phase;
      return phase;
    }
    if(renderState==='wingAttack')return player.wingAttackTime>.47?'wingCharge':player.wingAttackTime>.18?'wingFire':'wingRecover';
    if(renderState==='swordAttack'){
      const progress=1-Math.min(1,player.attackTime/SWORD_ATTACK_DURATION);
      return progress<.28?'wingCharge':progress<.72?'wingFire':'wingRecover';
    }
    if(renderState==='rushAttack')return player.attackTime>.58?'alert':player.attackTime>.16?'wingFire':'wingRecover';
    if(renderState==='doubleJump')return player.doubleJumpPose>.08?'doubleJump':'jumpRise';
    if(renderState==='jump')return player.jumpPoseTime>0?'jumpStart':'jumpRise';
    if(renderState==='fall')return 'fall';
    if(renderState==='land')return 'land';
    if(renderState==='crouch')return 'land';
    if(renderState==='hurt'||renderState==='charge')return 'alert';
    if(renderState==='skid')return 'alert';
    if(renderState==='sprint')return Math.floor(player.anim)%2?'step1':'step2';
    if(renderState==='walk'){
      const cycle=Math.floor(player.anim)%4;
      return cycle===1?'step1':cycle===3?'step2':'idle';
    }
    if(renderState!=='idle')return null;
    if(player.blinkTime>0)return 'blink';
    if(player.idleAction==='lookLeft')return 'lookLeft';
    if(player.idleAction==='lookRight'||player.idleAction==='backLook')return 'lookRight';
    if(player.idleAction==='lookAround')return Math.floor(player.idleActionTime*4)%2?'lookLeft':'lookRight';
    if(player.idleAction==='step')return Math.floor(player.idleActionTime*5)%2?'step1':'step2';
    if(player.idleAction==='stretch')return 'stretch';
    if(player.idleAction==='alert')return 'alert';
    return 'idle';
  }

  function walkFrameBlend(renderState=player.state) {
    if(!['walk','sprint'].includes(renderState))return null;
    const sequence=renderState==='sprint'?['step1','idle','step2','idle']:['idle','step1','idle','step2'];
    const phase=((player.anim%sequence.length)+sequence.length)%sequence.length,index=Math.floor(phase),raw=phase-index;
    const blend=raw*raw*(3-2*raw);
    return {from:sequence[index],to:sequence[(index+1)%sequence.length],blend};
  }

  function playerVisualPose(renderState=player.state,facing=player.facing,speed=Math.abs(player.vx)) {
    const stride=Math.sin(player.anim),strideSide=Math.cos(player.anim),pace=Math.min(1,speed/480);
    let shiftX=0,bob=0,tilt=0,scaleX=1,scaleY=1;
    if(renderState==='idle'){
      bob=Math.sin(elapsed*2.35)*2.4+(player.idleAction==='step'?Math.sin(player.idleActionTime*12)*3:0);
      tilt=player.idleAction==='lookLeft'?-0.035:(player.idleAction==='lookRight'||player.idleAction==='backLook')?0.035:Math.sin(elapsed*1.15)*.012;
      scaleX=1+Math.sin(elapsed*2.35)*.008;scaleY=1-Math.sin(elapsed*2.35)*.01;
    }else if(renderState==='walk'){
      bob=-Math.abs(stride)*(2.5+pace*2.2);shiftX=strideSide*facing*(.8+pace*1.25);
      tilt=facing*(.025+strideSide*.014);scaleX=1+Math.abs(stride)*.016;scaleY=1-Math.abs(stride)*.012;
    }else if(renderState==='sprint'){
      bob=-Math.abs(stride)*7;shiftX=facing*3+strideSide*facing*2.5;tilt=facing*.105;scaleX=1.055+Math.abs(stride)*.025;scaleY=.96;
    }else if(renderState==='skid'){
      bob=2;shiftX=-facing*4;tilt=-facing*.13;scaleX=1.06;scaleY=.94;
    }else if(renderState==='dash'){
      bob=-2;shiftX=facing*5;tilt=facing*.12;scaleX=1.08;scaleY=.94;
    }else if(renderState==='jump'){
      const takeoff=Math.min(1,player.jumpPoseTime/.14);bob=-takeoff*2;tilt=facing*.035;scaleX=.94-takeoff*.02;scaleY=1.07+takeoff*.03;
    }else if(renderState==='doubleJump'){
      tilt=facing*.055;scaleX=.90;scaleY=1.09;
    }else if(renderState==='fall'){
      bob=2;tilt=facing*.065;scaleX=1.035;scaleY=.975;
    }else if(renderState==='land'){
      const impact=Math.min(1,player.justLanded/.20);bob=3*impact;scaleX=1.10+impact*.035;scaleY=.88-impact*.035;
    }else if(renderState==='crouch'){
      bob=31;tilt=facing*.018;scaleX=1.12;scaleY=.66;
    }else if(renderState==='wingAttack'){
      const recoil=Math.sin(Math.min(1,player.wingAttackTime/.62)*Math.PI);shiftX=-facing*recoil*4;tilt=-facing*recoil*.045;scaleX=1+recoil*.025;scaleY=1-recoil*.018;
    }else if(renderState==='special'){
      const pulse=Math.sin((1.35-player.specialTime)*18);bob=-5-Math.abs(pulse)*3;tilt=playerMode==='lcd'?facing*.16:facing*pulse*.035;
      scaleX=1.04+Math.abs(pulse)*.05;scaleY=.97+Math.abs(pulse)*.04;
    }else if(renderState==='swordAttack'||renderState==='rushAttack'){
      tilt=facing*.075;scaleX=1.04;scaleY=.97;
    }else if(renderState==='hurt'){
      shiftX=-facing*4;tilt=-facing*.10;scaleX=1.04;scaleY=.96;
    }
    if(player.turnPoseTime>0&&renderState==='walk'){
      const turn=Math.min(1,player.turnPoseTime/.14);shiftX-=facing*4*turn;tilt-=facing*.11*turn;scaleX*=.96;scaleY*=1.035;
    }
    if(player.invincible>0)tilt+=Math.sin(elapsed*35)*.12;
    const celebration=renderState==='clear'?1+Math.sin(player.clearTime*10)*.09:1;
    return {shiftX,bob,tilt,scaleX:scaleX*celebration,scaleY:scaleY*celebration,stride,pace};
  }

  function drawHeldSwordOverlay(renderState,gripOnly=false) {
    if(!player.hasSword)return;
    // The source sword points up/right from its grip. Anchor it below and ahead
    // of the face so the unbroken blade stays visible without masking Feni's
    // expression, then paint the hand over the grip.
    const anchors={normal:[43,27],battery:[43,27],lcd:[44,28],king:[45,26],muscle:[50,31]};
    const [handX,handY]=anchors[playerMode]||anchors.normal;
    const pose=currentSwordPose(),progress=pose==='ready'?0:1-Math.min(1,player.attackTime/SWORD_ATTACK_DURATION);
    let rotation=.18;
    if(renderState==='swordAttack')rotation=-.62+progress*1.72;
    else if(renderState==='dash'||renderState==='sprint')rotation=.02;
    else if(['jump','doubleJump','fall'].includes(renderState))rotation=.08;
    else if(renderState==='crouch')rotation=.34;
    else if(renderState==='wingAttack'||renderState==='special')rotation=-.18;
    const swordSize=playerMode==='muscle'?112:98;
    ctx.save();ctx.translate(handX,handY);ctx.rotate(rotation);
    if(!gripOnly){
      ctx.shadowColor='#ff4b1d';ctx.shadowBlur=24;
      if(phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth)ctx.drawImage(phoenixSwordImage,-swordSize*.30,-swordSize*.74,swordSize,swordSize);
      else{ctx.strokeStyle='#fff3a0';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(swordSize*.38,-swordSize*.56);ctx.stroke();ctx.strokeStyle='#ff4b1d';ctx.lineWidth=5;ctx.stroke();}
    }else{
      const gripColors={normal:'#e94b2c',battery:'#62df62',lcd:'#28b9e8',king:'#f1aa28',muscle:'#a91f18'};
      ctx.shadowBlur=0;ctx.fillStyle=gripColors[playerMode]||gripColors.normal;ctx.strokeStyle='#612018';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(0,0,8,6,.18,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }

  function currentExpressionState(renderState=player.state,forcedMode=null) {
    if(!forcedMode&&player.clearTime)return 'goal';
    if(!forcedMode&&player.revivePose>0)return 'revive';
    if(!forcedMode&&player.hasSword&&(renderState==='swordAttack'||player.attackTime>0))return 'swordSwing';
    if(!forcedMode&&player.hasSword&&renderState==='idle')return 'swordReady';
    if(renderState==='dash')return 'dash';
    return null;
  }

  function drawFeniSprite(x, y, facing, rotation = 0, alpha = 1, forcedMode = null, forcedState = null) {
    const renderState=forcedState||player.state;
    const visual=playerVisualPose(renderState,facing,Math.abs(player.vx));
    ctx.save(); ctx.globalAlpha *= alpha; if(renderState==='clear'){ctx.shadowColor='#fff36a';ctx.shadowBlur=28;} ctx.translate(x+player.w/2+visual.shiftX,y+player.h/2+visual.bob); ctx.rotate(rotation+visual.tilt); ctx.scale(facing*visual.scaleX,visual.scaleY);
    const renderMode=forcedMode||playerMode;
    const rushPunch=!forcedMode&&renderMode==='muscle'&&player.attackTime>0&&!player.hasSword;
    const expressionState=currentExpressionState(renderState,forcedMode);
    const sheet=playerStateSheets[renderMode]||playerStateSheets.normal;
    if(expressionState&&!rushPunch&&sheet?.ready&&sheet.drawable){
      const frame=STATE_FRAME_INDEX[expressionState],sw=sheet.drawable.width/3,sh=sheet.drawable.height/2;
      const baseSize=expressionState==='swordSwing'?220:expressionState==='swordReady'?204:194;
      const drawSize=baseSize*(STATE_MODE_SCALE[expressionState]?.[renderMode]||1);
      const shiftX=expressionState==='swordSwing'?drawSize*.15:0;
      ctx.drawImage(sheet.drawable,(frame%3)*sw,Math.floor(frame/3)*sh,sw,sh,-drawSize/2+shiftX,-drawSize/2,drawSize,drawSize);
      if(!forcedMode&&player.hasSword&&expressionState==='dash'){drawHeldSwordOverlay(renderState,false);drawHeldSwordOverlay(renderState,true);}
      ctx.restore();return;
    }
    const motionName=currentMotionFrame(renderState);const motionSheet=playerMotionSheets[renderMode]||playerMotionSheets.normal;
    if(motionName&&motionSheet?.ready&&motionSheet.drawable&&!rushPunch){
      const sw=motionSheet.drawable.width/4,sh=motionSheet.drawable.height/4,drawSize=196,blend=walkFrameBlend(renderState),baseAlpha=ctx.globalAlpha;
      const drawMotion=(name,frameAlpha)=>{const frame=MOTION_FRAME_INDEX[name];ctx.globalAlpha=baseAlpha*frameAlpha;ctx.drawImage(motionSheet.drawable,(frame%4)*sw,Math.floor(frame/4)*sh,sw,sh,-drawSize/2,-drawSize/2,drawSize,drawSize);};
      if(blend){drawMotion(blend.from,1-blend.blend);drawMotion(blend.to,blend.blend);ctx.globalAlpha=baseAlpha;}
      else drawMotion(motionName,1);
      if(!forcedMode){drawHeldSwordOverlay(renderState,false);drawHeldSwordOverlay(renderState,true);}ctx.restore();return;
    }
    let imageKey = rushPunch ? 'musclePunch' : renderMode;
    if(renderMode==='normal'&&renderState==='dash'&&!player.hasSword)imageKey='dash';
    const currentImage=playerImages[imageKey];
    const meta=PLAYER_SPRITE_META[imageKey]||PLAYER_SPRITE_META.normal;
    if (currentImage.complete && currentImage.naturalWidth) {
      const normalAspect=PLAYER_SPRITE_META.normal.sw/PLAYER_SPRITE_META.normal.sh;
      const drawHeight=player.h*1.32;
      const drawWidth=player.w*1.24*((meta.sw/meta.sh)/normalAspect);
      ctx.drawImage(currentImage,meta.sx,meta.sy,meta.sw,meta.sh,-drawWidth/2,-drawHeight/2,drawWidth,drawHeight);
    }
    if(!forcedMode){drawHeldSwordOverlay(renderState,false);drawHeldSwordOverlay(renderState,true);}
    ctx.restore();
  }

  function currentSwordPose() {
    if (!player?.hasSword) return null;
    if (player.attackTime <= 0) return 'ready';
    const progress = 1 - Math.min(1, player.attackTime / SWORD_ATTACK_DURATION);
    return progress < .48 ? 'swing' : 'finish';
  }

  function drawPlayerMotionAccents() {
    const speed=Math.abs(player.vx);
    ctx.save();ctx.lineCap='round';
    if(player.grounded&&['walk','sprint'].includes(player.state)&&speed>55){
      const pulse=.25+Math.abs(Math.sin(player.anim))*.3;
      ctx.globalAlpha=pulse;ctx.strokeStyle=playerMode==='king'?'#ffe55a':'#fff0bd';ctx.shadowColor='#ff7a28';ctx.shadowBlur=8;ctx.lineWidth=3;
      const rear=player.facing>0?player.x-8:player.x+player.w+8;
      for(let line=0;line<2;line++){const y=player.y+player.h-12-line*9;ctx.beginPath();ctx.moveTo(rear,y);ctx.lineTo(rear-player.facing*(14+line*8+speed*.025),y+line*2);ctx.stroke();}
    }
    if(player.justLanded>0){
      const impact=Math.min(1,player.justLanded/.20),radius=20+(1-impact)*48;
      ctx.globalAlpha=impact*.55;ctx.strokeStyle='#ffe2a0';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h-2,radius,7+radius*.08,0,0,Math.PI*2);ctx.stroke();
    }
    if(player.turnPoseTime>0&&player.grounded){
      const turn=Math.min(1,player.turnPoseTime/.14);ctx.globalAlpha=turn*.55;ctx.strokeStyle='#ffd36d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(player.x+player.w/2,player.y+player.h-18,28,-.25,1.15);ctx.stroke();
    }
    if(player.state==='skid'&&player.grounded){ctx.globalAlpha=.7;ctx.strokeStyle='#ffe09a';ctx.lineWidth=5;for(let line=0;line<3;line++){const rear=player.facing>0?player.x-5:player.x+player.w+5,y=player.y+player.h-6-line*5;ctx.beginPath();ctx.moveTo(rear,y);ctx.lineTo(rear-player.facing*(35+line*18),y+line*2);ctx.stroke();}}
    ctx.restore();
  }

  function drawKingClone(clone) {
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.48+.2*Math.sin(elapsed*7+clone.phase);ctx.strokeStyle='#fff2a1';ctx.shadowColor='#ffd335';ctx.shadowBlur=30;ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(clone.x+clone.w/2,clone.y+clone.h/2,clone.w*.72,clone.h*.67,0,0,Math.PI*2);ctx.stroke();
    for(let line=0;line<3;line++){ctx.globalAlpha=.24-line*.05;ctx.beginPath();ctx.moveTo(clone.x-clone.facing*(15+line*24),clone.y+28+line*22);ctx.lineTo(clone.x-clone.facing*(90+line*35),clone.y+28+line*22);ctx.stroke();}
    ctx.restore();drawFeniSprite(clone.x,clone.y,clone.facing,Math.sin(clone.phase)*.045,.72,'king','dash');
    ctx.save();ctx.fillStyle='#fff6b0';ctx.shadowColor='#ffd335';ctx.shadowBlur=12;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(`KING CLONE ${clone.index+1}`,clone.x+clone.w/2,clone.y-12);ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    if (player.invincible > 0 && Math.floor(elapsed * 14) % 2) ctx.globalAlpha=.34;
    drawPlayerMotionAccents();
    if(playerMode==='lcd'){
      ctx.save();ctx.strokeStyle='#61ecff';ctx.lineWidth=3;ctx.globalAlpha=.6;
      const lineCount=reducedEffects?3:7;
      for(let i=0;i<lineCount;i++){
        const phase=(elapsed*210+i*47)%player.h,y=player.y+phase;
        const near=player.x-25-(i%3)*31,far=near-135-(i%2)*48;
        ctx.beginPath();ctx.moveTo(near,y);ctx.lineTo(far,y);ctx.stroke();
      }
      ctx.restore();
    }
    if(playerMode==='lcd'&&player.shields>0){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);ctx.fillStyle='#65eaff';ctx.shadowColor='#42dfff';ctx.shadowBlur=24;for(let layer=0;layer<player.shields;layer++){ctx.globalAlpha=(player.shieldHit>0 ? .26 : .07)+layer*.025;ctx.beginPath();ctx.ellipse(0,0,player.w*(.78+layer*.12),player.h*(.69+layer*.08),0,0,Math.PI*2);if(layer===0)ctx.fill();ctx.globalAlpha=(player.shieldHit>0 ? .85 : .42)+layer*.055;ctx.strokeStyle=layer===0?'#e8ffff':'#48dfff';ctx.lineWidth=layer===player.shields-1?4:2.5;ctx.stroke();}ctx.restore();}
    if(playerMode==='king'){ctx.save();ctx.globalAlpha=.48;ctx.fillStyle='#ffd52f';ctx.shadowColor='#fff09a';ctx.shadowBlur=35;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.8,player.h*.75,0,0,7);ctx.fill();ctx.restore();}
    if(player.specialTime>0){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);const colors={normal:'#ff5b24',battery:'#55ff82',lcd:'#54efff',muscle:'#ff3d1f',king:'#ffd335'};ctx.strokeStyle=colors[playerMode];ctx.shadowColor=colors[playerMode];ctx.shadowBlur=35;ctx.lineWidth=6;for(let ring=0;ring<3;ring++){ctx.globalAlpha=.72-ring*.18;ctx.beginPath();ctx.arc(0,0,48+ring*22+Math.sin(elapsed*18+ring)*7,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=.9;ctx.fillStyle='#fff';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText(ULTIMATE_NAMES[playerMode],0,-92);ctx.restore();}
    if(player.chargeTime>0){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);ctx.strokeStyle='#70ffc0';ctx.shadowColor='#24f28c';ctx.shadowBlur=22;ctx.lineWidth=5;for(let ring=0;ring<3;ring++){ctx.globalAlpha=.8-ring*.2;ctx.beginPath();ctx.arc(0,0,45+ring*16+Math.sin(elapsed*8+ring)*5,0,7);ctx.stroke();}ctx.fillStyle='#e8fff3';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('CHARGE',0,-78);ctx.restore();}
    if(player.wingAttackTime>0){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h*.48);ctx.globalCompositeOperation='screen';const open=1-Math.min(1,Math.abs(player.wingAttackTime-.36)/.28);ctx.strokeStyle='#fff3a0';ctx.fillStyle='#ff6724aa';ctx.shadowColor='#ff4218';ctx.shadowBlur=32;ctx.lineWidth=6;
      for(const side of[-1,1]){ctx.save();ctx.scale(side,1);ctx.beginPath();ctx.moveTo(8,0);ctx.quadraticCurveTo(36*open,-56-25*open,82+45*open,-38);ctx.quadraticCurveTo(58+28*open,-4,14,22);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
      ctx.fillStyle='#fff';ctx.font='bold 14px Arial';ctx.textAlign='center';if(player.wingAttackTime>.4)ctx.fillText('PHOENIX WING',0,-78);ctx.restore();}
    drawFeniSprite(player.x, player.y, player.facing, player.spin);
    if(player.attackTime>0){ctx.save();const front=player.facing>0?player.x+player.w:player.x;ctx.translate(front,player.y+55);ctx.scale(player.facing,1);if(playerMode==='muscle'&&!player.hasSword){ctx.fillStyle='#ff8b31';ctx.strokeStyle='#7d1d12';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(48,0,48,25,0,0,7);ctx.fill();ctx.stroke();}else{ctx.strokeStyle='#fff36b';ctx.lineWidth=12;ctx.shadowColor='#ff3b18';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(0,0,105,-1.18,1.18);ctx.stroke();ctx.strokeStyle='#ff5a1f';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,120,-1.08,1.08);ctx.stroke();}ctx.restore();}
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (!enemy.alive && enemy.squish <= 0) return;
    if(!visibleInCamera(enemy,140))return;
    ctx.save();ctx.translate(enemy.x+enemy.w/2,enemy.y+enemy.h/2);
    const warning=enemy.warning>0&&!enemy.allied;const facing=enemy.vx<0?-1:1;
    ctx.shadowColor=enemy.allied?'#56ff88':warning?'#ff251d':enemy.aquatic?'#4cecff':enemy.flying?'#9cefff':'#ff6049';ctx.shadowBlur=warning?34:enemy.allied?28:15;
    if(enemy.allied){ctx.save();ctx.globalAlpha=.28+.12*Math.sin(elapsed*8);ctx.fillStyle='#4dff7c';ctx.strokeStyle='#d9ffe4';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,enemy.w*.72,enemy.h*.67,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#eaffee';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText('ALLY LINK',0,-enemy.h*.64);}
    if(warning){ctx.globalAlpha=.55+.45*Math.sin(elapsed*30);ctx.strokeStyle='#fff32e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,Math.max(enemy.w,enemy.h)*.7,0,7);ctx.stroke();
      const dx=enemy.targetX-(enemy.x+enemy.w/2),dy=enemy.targetY-(enemy.y+enemy.h/2),len=Math.hypot(dx,dy)||1,guide=Math.min(420,len);ctx.setLineDash([12,9]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx/len*guide,dy/len*guide);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff352d';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(dx/len*Math.min(guide+12,len),dy/len*Math.min(guide+12,len),13,0,7);ctx.fill();ctx.stroke();
      if(['lightning','fireRain','depthCharge','rail'].includes(enemy.pendingAttack)){ctx.globalAlpha=.32+.25*Math.sin(elapsed*24);ctx.beginPath();ctx.ellipse(dx,dy,38,13,0,0,7);ctx.fill();ctx.stroke();ctx.globalAlpha=.9;}
      ctx.fillStyle='#fff';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('!',dx/len*Math.min(guide+12,len),dy/len*Math.min(guide+12,len)+6);ctx.globalAlpha=1;}
    const enemyImage=enemyImages[enemy.type];
    if(enemyImage?.complete&&enemyImage.naturalWidth){
      if(!enemy.alive)ctx.scale(1.35,.24);
      else{
        const faceLeft=enemy.allied?enemy.aimFacing<0:warning?enemy.aimFacing<0:enemy.vx<-.5||(Math.abs(enemy.vx)<=.5&&player.x<enemy.x);
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
    if(!visibleInCamera({x:drop.x-drop.w,y:drop.y-drop.h,w:drop.w*3,h:drop.h*3},100))return;
    ctx.save();ctx.translate(drop.x+drop.w/2,drop.y+drop.h/2);ctx.rotate(Math.atan2(drop.vy,drop.vx));
    const electric=['electric','lightning','scan','rail'].includes(drop.kind),explosive=['burst','mine','debris','fireRain','depthCharge'].includes(drop.kind),missile=['missile','torpedo','diveShot'].includes(drop.kind);
    ctx.shadowColor=electric?'#a9f9ff':explosive?'#ff5a23':missile?'#ffcf37':'#45dfff';ctx.shadowBlur=18;
    if(missile){ctx.fillStyle=drop.kind==='torpedo'?'#8defff':'#ffcb35';ctx.strokeStyle='#eaffff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,drop.w/2,drop.h/2,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ff5b24';ctx.beginPath();ctx.moveTo(-drop.w/2,0);ctx.lineTo(-drop.w*.8,-drop.h*.45);ctx.lineTo(-drop.w*.8,drop.h*.45);ctx.closePath();ctx.fill();}
    else if(electric){ctx.strokeStyle='#dfffff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-drop.w/2,-drop.h/3);ctx.lineTo(0,-2);ctx.lineTo(-3,drop.h/3);ctx.lineTo(drop.w/2,0);ctx.stroke();}
    else if(explosive){ctx.fillStyle='#ff8a28';ctx.beginPath();for(let i=0;i<12;i++){const radius=i%2?drop.w*.28:drop.w*.55,angle=i*Math.PI/6;ctx.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}ctx.closePath();ctx.fill();}
    else if(drop.kind==='saw'){ctx.fillStyle='#cbd8dd';ctx.strokeStyle='#ff5c31';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<16;i++){const radius=i%2?drop.w*.38:drop.w*.56,angle=i*Math.PI/8;ctx.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}ctx.closePath();ctx.fill();ctx.stroke();}
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
    // Do not slow the whole game down when a mobile frame takes over 33 ms.
    // Collision already uses swept substeps, so 50 ms remains safe and makes
    // touch input/movement track real time instead of feeling heavy.
    const dt = Math.min(.05, (now - previousTime) / 1000 || 0);
    previousTime = now;
    update(dt);
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  const keyMap = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
    Space:'jump', KeyX:'attack', KeyJ:'attack', KeyZ:'wing', KeyK:'wing', KeyC:'special', KeyV:'special', KeyL:'special', KeyQ:'dashLeft', KeyE:'dashRight' };
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
    const press = (event) => { event.preventDefault(); input[name] = true;if(player&&name==='dashLeft')player.dashDirection=-1;if(player&&name==='dashRight')player.dashDirection=1; button.classList.add('pressed'); if (event.pointerId !== undefined) button.setPointerCapture?.(event.pointerId); };
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
  $('#titleBack').addEventListener('click', showTitle);
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
      wingAttack:()=>performWingAttack(),
      ultimate:()=>performUltimate(),
      collectCoins:(count=1)=>{for(let index=0;index<Math.max(0,count);index++){const previousCoins=player.coins;player.coins+=1;player.score+=scoreValue(100);sound('coin');triggerCoinSpeed(previousCoins);}updateHud();},
      forceIdle:(action='lookAround')=>{player.vx=0;player.vy=0;player.grounded=true;player.state='idle';player.idleTime=5;player.idleAction=action;player.idleActionTime=0;player.idleActionDuration=2;player.blinkTime=action==='blink' ? 0.1 : 0;},
      giveSword:()=>{player.hasSword=true;if(swordItem)swordItem.collected=true;updateHud();},
      setInput:(name,value)=>{if(!(name in input))throw new Error(`Unknown input: ${name}`);input[name]=!!value;},
      setVelocity:(vx,vy)=>{if(Number.isFinite(vx))player.vx=vx;if(Number.isFinite(vy))player.vy=vy;player.grounded=false;},
      step:(seconds=.016)=>{const frames=Math.max(1,Math.ceil(seconds*60));for(let frame=0;frame<frames;frame++)update(Math.min(.033,seconds/frames));},
      draw:()=>draw(),
      teleport:(x,y)=>{player.x=Math.max(0,Math.min(WORLD_WIDTH-player.w,x));if(Number.isFinite(y))player.y=y;player.vx=0;player.vy=0;},
      teleportBoss:(x,y)=>{if(boss){boss.x=Math.max(boss.arenaLeft,Math.min(boss.arenaRight-boss.w,x));if(Number.isFinite(y))boss.y=y;boss.vx=0;boss.vy=0;}},
      beginBoss:()=>beginBossEncounter(),
      hitBoss:(amount=1)=>{if(boss){boss.intro=true;boss.active=true;if(['dormant','intro'].includes(boss.state))boss.state=bossMoveState();boss.hit=0;return damageBoss(amount);}return false;},
      spawnEnemyProjectile:(kind='bolt')=>spawnEnemyShot({kind,x:player.x+420,y:player.y+20,w:20,h:20,vx:190,vy:0,energy:true}),
      spawnCounterProjectile:(kind='bolt')=>spawnEnemyShot({kind,x:player.x+105,y:player.y+32,w:20,h:20,vx:-190,vy:0,energy:true}),
      hitEnemy:(index=0,amount=1)=>{const target=liveHostileEnemies()[index];return target?damageEnemy(target,amount,'debug',500):false;},
      forceVoid:()=>{player.y=WORLD_HEIGHT+90;player.vy=400;updatePlayer(.016);},
      respawn:()=>respawnAtCheckpoint('DEBUG RESPAWN'),
      defeatBoss:()=>{if(boss){boss.hp=1;boss.hit=0;boss.state=bossMoveState();boss.intro=true;boss.active=true;damageBoss(99);}},
      state:()=>({mode,currentStage:STAGES[currentStage].id,notice:(ui.noticeText||ui.notice).textContent,noticeExpression:activeNoticePose,cutinVisible:!ui.ultimateCutin?.classList.contains('hidden'),dashBalance:{drainPerSecond:DASH_DRAIN_PER_SECOND,recoveryPerSecond:DASH_RECOVERY_PER_SECOND},player:{x:player.x,y:player.y,vx:player.vx,vy:player.vy,hp:player.hp,grounded:player.grounded,state:player.state,motionFrame:currentMotionFrame(),renderExpression:currentExpressionState(),walkBlend:walkFrameBlend(),visualPose:playerVisualPose(),damageBox:playerDamageBox(),crouching:player.crouching,voidRecoveries:player.voidRecoveries,turnPoseTime:player.turnPoseTime,jumpCount:player.jumpCount,dash:player.dash,dashPoseTime:player.dashPoseTime,coinSpeed:player.coinSpeed,speedTier:player.speedTier,speedBurst:player.speedBurst,dropTimer:player.dropTimer,chargeTime:player.chargeTime,revivePose:player.revivePose,idleTime:player.idleTime,idleAction:player.idleAction,blinkTime:player.blinkTime,wingAttackTime:player.wingAttackTime,wingCooldown:player.wingCooldown,specialTime:player.specialTime,specialCooldown:player.specialCooldown,specialUsed:player.specialUsed,ultimatePhase:player.ultimateSequence?.phase||null,clearMode:player.clearMode,mode:playerMode,modeTimer,shields:player.shields,hasSword:player.hasSword,attackTime:player.attackTime,swordPose:currentSwordPose()},
        enemiesAlive:enemies.filter((enemy)=>enemy.alive&&!enemy.allied).length,alliesAlive:enemies.filter((enemy)=>enemy.alive&&enemy.allied).length,kingClones:kingClones.length,enemyPositions:enemies.filter((enemy)=>enemy.alive).slice(0,12).map((enemy)=>({type:enemy.type,attack:enemy.attack,alternateAttack:enemy.alternateAttack,attackCooldown:enemy.attackCooldown,allied:enemy.allied,hp:enemy.hp,maxHp:enemy.maxHp,hit:enemy.hit,x:enemy.x,y:enemy.y,w:enemy.w,h:enemy.h})),gimmicks:gimmicks.map((gimmick)=>({type:gimmick.type,x:gimmick.x,y:gimmick.y,w:gimmick.w,h:gimmick.h,targetX:gimmick.targetX,targetY:gimmick.targetY,active:!!gimmick.active,warning:!!gimmick.warning})),hazardPositions:hazards.map((hazard)=>({type:hazard.type,x:hazard.x,y:hazard.y,w:hazard.w,h:hazard.h})),coinPositions:coins.filter((coin)=>!coin.collected).slice(0,12).map((coin)=>({x:coin.x,y:coin.y})),breakablesAlive:breakables.filter((wall)=>wall.alive).length,breakablePositions:breakables.filter((wall)=>wall.alive).slice(0,6).map((wall)=>({x:wall.x,y:wall.y})),checkpoints:checkpoints.map((point)=>({x:point.x,y:point.y,active:point.active,respawnX:point.respawnX,respawnY:point.respawnY})),jumpPadVelocity:JUMP_PAD_VELOCITY,jumpPadPositions:jumpPads.map((pad)=>({x:pad.x,y:pad.y,w:pad.w,h:pad.h})),oneWayPlatforms:allPlatforms().filter(isOneWayPlatform).slice(0,128).map((platform)=>({x:platform.x,y:platform.y,w:platform.w,h:platform.h,surfaceRoute:!!platform.surfaceRoute})),transformTypes:transformItems.filter((item)=>!item.collected).map((item)=>item.type),kingWeight:TRANSFORM_WEIGHTS.filter((type)=>type==='king').length/TRANSFORM_WEIGHTS.length,shockwaves:shockwaves.length,shockwaveKinds:shockwaves.map((wave)=>wave.kind||'ground'),shockwaveData:shockwaves.map((wave)=>({kind:wave.kind||'ground',maxDistance:wave.maxDistance||0,breaksWalls:!!wave.breaksWalls})),rushTrails:rushTrails.length,projectileKinds:droplets.map((drop)=>drop.kind||'droplet'),
        boss:boss?{type:boss.type,name:boss.name,x:boss.x,y:boss.y,w:boss.w,h:boss.h,hp:boss.hp,alive:boss.alive,active:boss.active,intro:boss.intro,introLock:boss.introLock,phase:boss.phase,state:boss.state,attackName:boss.attackName,recovery:boss.recovery,arenaLeft:boss.arenaLeft,arenaRight:boss.arenaRight,arenaWidth:boss.arenaRight-boss.arenaLeft,defeated:bossDefeated,gateX:bossGate.x,gateClosed:bossGate.closed,goalUnlocked,swordX:swordItem?.x}:null,goal:{x:goal.x,y:goal.y,unlocked:goalUnlocked},enemyProjectileData:droplets.map((shot)=>({kind:shot.kind,x:shot.x,y:shot.y,vx:shot.vx,vy:shot.vy,life:shot.life,maxDistance:shot.maxDistance,travel:projectileTravel(shot),owner:shot.owner})),bossProjectileKinds:projectiles.map((projectile)=>projectile.kind||'orb'),bossProjectileData:projectiles.map((shot)=>({kind:shot.kind,x:shot.x,y:shot.y,vx:shot.vx,vy:shot.vy,life:shot.life,maxDistance:shot.maxDistance,travel:projectileTravel(shot),owner:shot.owner})),wingProjectiles:wingShots.map((shot)=>({kind:shot.kind,x:shot.x,y:shot.y,vx:shot.vx,vy:shot.vy,life:shot.life,maxDistance:shot.maxDistance,travel:projectileTravel(shot),piercing:!!shot.piercing})),poolCounts:{droplets:droplets.length,bossProjectiles:projectiles.length,wingShots:wingShots.length,particles:dust.length+sparks.length+modeParticles.length+combatFx.length+speedTrails.length},chaserWall:chaserWall?{x:chaserWall.x,speed:chaserWall.speed}:null,
        world:{width:WORLD_WIDTH,height:WORLD_HEIGHT,viewportWidth,viewportHeight,cameraX,cameraY},render:{touchDevice,reducedEffects,dpr,backingWidth:canvas.width,backingHeight:canvas.height},images:{...Object.fromEntries(Object.entries(playerImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}])),stateSheets:Object.fromEntries(Object.entries(playerStateSheets).map(([name,record])=>[name,{loaded:record.ready,source:record.source}])),motionSheets:Object.fromEntries(Object.entries(playerMotionSheets).map(([name,record])=>[name,{loaded:record.ready,source:record.source}])),enemies:Object.fromEntries(Object.entries(enemyImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}])),boss:{loaded:bossImage.complete&&bossImage.naturalWidth>0,width:bossImage.naturalWidth,height:bossImage.naturalHeight},sword:{loaded:phoenixSwordImage.complete&&phoenixSwordImage.naturalWidth>0,width:phoenixSwordImage.naturalWidth,height:phoenixSwordImage.naturalHeight},swordPoses:Object.fromEntries(Object.entries(swordPoseImages).map(([name,image])=>[name,{loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight}]))}})
    });
  }

  resize();
  resetGame();
  if (!animationFrame) animationFrame = requestAnimationFrame(loop);
})();
