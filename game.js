(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    title: $('#title'), result: $('#result'), hud: $('#hud'), touch: $('#touch'), pause: $('#pause'),
    hearts: $('#hearts'), coins: $('#coins'), score: $('#score'), timer: $('#timer'), notice: $('#notice')
  };

  const WORLD_WIDTH = 7600;
  const FLOOR_Y = 610;
  const PLAYER_W = 72;
  const PLAYER_H = 112;
  const MAX_JUMPS = 2;
  const feniImage = new Image();
  feniImage.src = 'assets/images/fenichan.svg';
  const GRAVITY = 1800;
  const MAX_FALL = 920;
  const START_TIME = 150;
  const input = { left: false, right: false, jump: false, dashLeft: false, dashRight: false };
  let width = 1280;
  let height = 720;
  let dpr = 1;
  let scale = 1;
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
  let checkpoint;
  let goal;
  let remainingTime;

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

  const coinBlueprints = [
    [360, 520], [450, 520], [540, 520], [900, 520], [1080, 415], [1160, 415],
    [1390, 355], [1470, 355], [1780, 495], [1900, 370], [1980, 370], [2200, 290],
    [2510, 520], [2690, 390], [2780, 390], [3260, 520], [3400, 370], [3680, 290],
    [4110, 465], [4280, 350], [4380, 350], [4660, 280], [4930, 520], [5130, 375],
    [5250, 375], [5710, 520], [5850, 385], [6190, 300], [6310, 300], [6650, 480],
    [6870, 360], [6980, 360], [7200, 490]
  ];

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scale = Math.min(width / 1280, height / 720);
    offsetX = (width - 1280 * scale) / 2;
    offsetY = (height - 720 * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeEnemy([type, x, y]) {
    return { type, x, y, w: type === 'battery' ? 52 : 50, h: type === 'battery' ? 58 : 62,
      vx: type === 'cracked' ? -65 : type === 'wet' ? -28 : 0, vy: 0, originX: x,
      grounded: false, alive: true, cooldown: 1.2 + (x % 7) / 10, phase: x / 80, squish: 0 };
  }

  function resetGame() {
    Object.keys(input).forEach((key) => { input[key] = false; });
    player = { x: 150, y: FLOOR_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0,
      grounded: true, hp: 3, coins: 0, score: 0, invincible: 0, state: 'idle', anim: 0,
      facing: 1, jumpHeld: false, jumpCount: 0, spin: 0, justLanded: 0, spawnX: 150, spawnY: FLOOR_Y - PLAYER_H, dead: false };
    enemies = enemyBlueprints.map(makeEnemy);
    droplets = [];
    coins = coinBlueprints.map(([x, y]) => ({ x, y, collected: false, phase: x / 30 }));
    dust = [];
    sparks = [];
    afterimages = [];
    movingPlatforms = [
      { x: 735, y: 500, baseX: 735, baseY: 500, w: 105, h: 18, axis: 'x', range: 80, speed: 1.15, lastX: 735, lastY: 500 },
      { x: 3090, y: 475, baseX: 3090, baseY: 475, w: 105, h: 18, axis: 'y', range: 95, speed: .9, lastX: 3090, lastY: 475 },
      { x: 5535, y: 470, baseX: 5535, baseY: 470, w: 105, h: 18, axis: 'x', range: 75, speed: 1.25, lastX: 5535, lastY: 470 }
    ];
    checkpoint = { x: 3900, y: FLOOR_Y - 70, active: false };
    goal = { x: 7410, y: FLOOR_Y - 180 };
    remainingTime = START_TIME;
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
    say('STAGE 1　スマホ修理商店街');
    sound('start');
  }

  function setModeResult(cleared) {
    mode = cleared ? 'clear' : 'gameover';
    ui.hud.classList.add('hidden');
    ui.touch.classList.add('hidden');
    ui.pause.classList.add('hidden');
    $('#resultKicker').textContent = cleared ? 'STAGE CLEAR!' : 'GAME OVER';
    $('#resultTitle').textContent = cleared ? '修理完了！' : 'もう一度挑戦！';
    $('#resultStats').textContent = `SCORE ${String(player.score).padStart(6, '0')}　● ${player.coins}`;
    ui.result.classList.remove('hidden');
    sound(cleared ? 'clear' : 'damage');
  }

  function showTitle() {
    mode = 'title';
    paused = false;
    ui.title.classList.remove('hidden');
    ui.result.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.touch.classList.add('hidden');
    ui.pause.classList.add('hidden');
  }

  function say(text) {
    ui.notice.textContent = text;
    ui.notice.classList.remove('show');
    void ui.notice.offsetWidth;
    ui.notice.classList.add('show');
  }

  function sound(name) { window.RepairHeroSound?.play(name); }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function allPlatforms() { return staticPlatforms.concat(movingPlatforms); }

  function moveAndCollide(body, dt, isPlayer = false) {
    const oldBottom = body.y + body.h;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.grounded = false;
    for (const platform of allPlatforms()) {
      if (body.x + body.w <= platform.x || body.x >= platform.x + platform.w) continue;
      if (body.vy >= 0 && oldBottom <= platform.y + 8 && body.y + body.h >= platform.y) {
        body.y = platform.y - body.h;
        body.vy = 0;
        body.grounded = true;
        if (isPlayer && movingPlatforms.includes(platform)) {
          body.x += platform.x - platform.lastX;
          body.y += platform.y - platform.lastY;
        }
      }
    }
  }

  function spawnDust(x, y, amount = 1) {
    for (let i = 0; i < amount; i += 1) {
      dust.push({ x: x + Math.random() * 18, y, vx: -player.facing * (25 + Math.random() * 45),
        vy: -25 - Math.random() * 35, life: .35 + Math.random() * .25, size: 4 + Math.random() * 6 });
    }
  }

  function hurt(sourceX) {
    if (player.invincible > 0 || mode !== 'playing') return;
    player.hp -= 1;
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
      setTimeout(() => { if (mode === 'playing') setModeResult(false); }, 650);
    }
  }

  function respawnAfterFall() {
    player.hp -= 1;
    sound('damage');
    shake = 18;
    if (player.hp <= 0) { setModeResult(false); return; }
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 1.8;
    player.jumpCount = 0; player.spin = 0;
    cameraX = Math.max(0, player.x - 360);
    say('落下！ チェックポイントから再開');
    updateHud();
  }

  function updatePlayer(dt) {
    if (player.dead) return;
    player.invincible = Math.max(0, player.invincible - dt);
    player.justLanded = Math.max(0, player.justLanded - dt);
    const dashDirection = Number(input.dashRight) - Number(input.dashLeft);
    const normalDirection = Number(input.right) - Number(input.left);
    const direction = dashDirection || normalDirection;
    const dashing = dashDirection !== 0;
    const targetSpeed = direction * (dashing ? 455 : 245);
    const acceleration = player.grounded ? 1900 : 1050;
    player.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - player.vx));
    if (!direction && player.grounded) player.vx *= Math.pow(.0008, dt);
    if (direction) player.facing = direction;

    if (input.jump && !player.jumpHeld && player.jumpCount < MAX_JUMPS) {
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
    if (!input.jump) player.jumpHeld = false;
    if (!input.jump && player.vy < -220) player.vy += GRAVITY * 1.35 * dt;
    if (player.spin > 0) player.spin = Math.max(0, player.spin - dt * 11);

    const wasGrounded = player.grounded;
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    moveAndCollide(player, dt, true);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));
    if (!wasGrounded && player.grounded) {
      player.jumpCount = 0; player.spin = 0; player.justLanded = .16; landingShake = 5;
      spawnDust(player.x + player.w / 2, player.y + player.h, 6);
    }
    if (player.y > 790) respawnAfterFall();

    const speed = Math.abs(player.vx);
    if (player.justLanded) player.state = 'land';
    else if (!player.grounded) player.state = player.vy < 0 ? (player.jumpCount === 2 ? 'doubleJump' : 'jump') : 'fall';
    else if (dashing && speed > 300) player.state = 'dash';
    else if (speed > 30) player.state = 'walk';
    else player.state = 'idle';
    player.anim += dt * (player.state === 'dash' ? 15 : player.state === 'walk' ? 9 : 3);
    if (player.grounded && speed > 100 && Math.floor(player.anim * 2) !== Math.floor((player.anim - dt * 9) * 2)) spawnDust(player.x, player.y + player.h, dashing ? 3 : 1);
    if (dashing) { shake = Math.max(shake, 2.5); if (Math.floor(elapsed*24) !== Math.floor((elapsed-dt)*24)) afterimages.push({x:player.x,y:player.y,facing:player.facing,life:.2}); }
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

      if (overlap(player, enemy) && player.invincible <= 0) {
        const playerBottom = player.y + player.h;
        if (player.vy > 120 && playerBottom - enemy.y < 32) {
          enemy.alive = false; enemy.squish = .45; player.vy = -410; player.score += 500;
          spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h, 9); sound('stomp');
        } else hurt(enemy.x + enemy.w / 2);
      }
    }

    for (const drop of droplets) {
      drop.vy += GRAVITY * .45 * dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt;
      if (overlap(player, drop)) { drop.dead = true; hurt(drop.x); }
      if (drop.y > FLOOR_Y + 30) drop.dead = true;
    }
    droplets = droplets.filter((drop) => !drop.dead && Math.abs(drop.x - cameraX) < 1500);
  }

  function updateObjects(dt) {
    for (const platform of movingPlatforms) {
      platform.lastX = platform.x; platform.lastY = platform.y;
      const movement = Math.sin(elapsed * platform.speed) * platform.range;
      if (platform.axis === 'x') platform.x = platform.baseX + movement;
      else platform.y = platform.baseY + movement;
    }
    for (const coin of coins) {
      coin.phase += dt * 5;
      const hitbox = { x: coin.x - 13, y: coin.y - 13, w: 26, h: 26 };
      if (!coin.collected && overlap(player, hitbox)) {
        coin.collected = true; player.coins += 1; player.score += 100; sound('coin'); updateHud();
      }
    }
    if (!checkpoint.active && player.x > checkpoint.x) {
      checkpoint.active = true; player.spawnX = checkpoint.x + 35; player.spawnY = FLOOR_Y - 55 - PLAYER_H;
      player.score += 1000; say('CHECKPOINT!'); sound('checkpoint');
    }
    if (player.x + player.w > goal.x) {
      player.state = 'clear'; player.score += Math.ceil(remainingTime) * 25; setModeResult(true);
    }
    dust.forEach((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 130 * dt; particle.life -= dt; });
    dust = dust.filter((particle) => particle.life > 0);
    sparks.forEach((p) => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 420*dt; p.life -= dt; });
    sparks = sparks.filter((p) => p.life > 0);
    afterimages.forEach((ghost) => { ghost.life -= dt; });
    afterimages = afterimages.filter((ghost) => ghost.life > 0);
  }

  function update(dt) {
    if (mode !== 'playing' || paused) return;
    elapsed += dt;
    remainingTime = Math.max(0, remainingTime - dt);
    if (remainingTime <= 0) { player.hp = 0; setModeResult(false); return; }
    updateObjects(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    const targetCamera = Math.max(0, Math.min(WORLD_WIDTH - 1280, player.x - (player.facing > 0 ? 350 : 650)));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * 7);
    shake *= Math.pow(.02, dt);
    landingShake *= Math.pow(.01, dt);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    ui.hearts.textContent = `${'♥ '.repeat(Math.max(0, player.hp))}${'♡ '.repeat(Math.max(0, 3 - player.hp))}`;
    ui.coins.textContent = String(player.coins).padStart(2, '0');
    ui.score.textContent = String(player.score).padStart(6, '0');
    ui.timer.textContent = String(Math.ceil(remainingTime)).padStart(3, '0');
  }

  function drawRoundedRect(x, y, w, h, radius) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#63cbe6'); sky.addColorStop(.65, '#d8f1dc'); sky.addColorStop(1, '#f7d794');
    ctx.fillStyle = sky; ctx.fillRect(-50, -50, 1380, 820);
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
    ctx.save(); ctx.translate(-cameraX, 0);
    for (const platform of staticPlatforms) drawPlatform(platform);
    for (const platform of movingPlatforms) { drawPlatform(platform, true); }
    drawScenery();
    coins.forEach(drawCoin);
    drawCheckpoint();
    drawGoal();
    enemies.forEach(drawEnemy);
    droplets.forEach(drawDroplet);
    dust.forEach((particle) => { ctx.globalAlpha = particle.life * 1.8; ctx.fillStyle = '#dfc18a'; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    afterimages.forEach((ghost) => drawFeniSprite(ghost.x, ghost.y, ghost.facing, 0, .18 * ghost.life / .2));
    sparks.forEach((p) => { ctx.globalAlpha=p.life*1.7; ctx.fillStyle=Math.random()>.5?'#ffec48':'#ff5a1f'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill(); });
    ctx.globalAlpha = 1;
    drawPlayer();
    ctx.restore();
  }

  function drawPlatform(platform, moving = false) {
    if (platform.x + platform.w < cameraX - 80 || platform.x > cameraX + 1360) return;
    ctx.fillStyle = moving ? '#3b5d65' : '#4d4c43'; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = moving ? '#ffc62e' : '#9a8159'; ctx.fillRect(platform.x, platform.y, platform.w, Math.min(14, platform.h));
    ctx.fillStyle = '#d8b76f';
    for (let x = platform.x + 8; x < platform.x + platform.w; x += 38) ctx.fillRect(x, platform.y + 4, 22, 4);
    if (moving) { ctx.fillStyle = '#172f3a'; ctx.font = 'bold 14px Arial'; ctx.fillText('◀  GEAR  ▶', platform.x + 10, platform.y + 15); }
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

  function drawCheckpoint() {
    ctx.fillStyle = '#6d4930'; ctx.fillRect(checkpoint.x, checkpoint.y, 8, 70);
    ctx.fillStyle = checkpoint.active ? '#51e77f' : '#e8eef0'; ctx.beginPath(); ctx.moveTo(checkpoint.x + 8, checkpoint.y); ctx.lineTo(checkpoint.x + 70, checkpoint.y + 18); ctx.lineTo(checkpoint.x + 8, checkpoint.y + 36); ctx.fill();
    ctx.fillStyle = '#143044'; ctx.font = 'bold 11px Arial'; ctx.fillText('CHECK', checkpoint.x + 37, checkpoint.y + 21);
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
    const squash = player.state === 'land' ? .88 : 1;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x+player.w/2,y+player.h/2+bob); ctx.rotate(rotation+tilt); ctx.scale(facing,squash);
    if (feniImage.complete && feniImage.naturalWidth) ctx.drawImage(feniImage,-player.w*.62,-player.h*.66,player.w*1.24,player.h*1.32);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(elapsed * 14) % 2) return;
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
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('touchstart', press, { passive: false });
    button.addEventListener('touchend', release, { passive: false });
    button.addEventListener('touchcancel', release, { passive: false });
    button.addEventListener('pointerenter', (event) => { if (event.buttons) press(event); });
    button.addEventListener('pointerleave', (event) => { if (event.buttons) release(event); });
  });

  $('#start').addEventListener('click', startGame);
  $('#retry').addEventListener('click', startGame);
  $('#backTitle').addEventListener('click', showTitle);
  ui.pause.addEventListener('click', () => { if (mode === 'playing') paused = !paused; });
  addEventListener('resize', resize);
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  resize();
  resetGame();
  if (!animationFrame) animationFrame = requestAnimationFrame(loop);
})();
