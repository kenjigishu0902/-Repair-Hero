'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : force;
    if (enabled) this.values.add(name); else this.values.delete(name);
    return enabled;
  }
  contains(name) { return this.values.has(name); }
}

class Element {
  constructor(id = '') {
    this.id = id;
    this.classList = new ClassList();
    this.style = {};
    this.dataset = {};
    this.value = 0;
    this.textContent = '';
    this.offsetWidth = 100;
  }
  addEventListener() {}
  setPointerCapture() {}
  getContext() {
    const gradient = { addColorStop() {} };
    return new Proxy({ createLinearGradient: () => gradient }, {
      get(target, key) { return key in target ? target[key] : () => {}; }
    });
  }
}

function createGame({ width = 1280, height = 720, touch = false } = {}) {
  const ids = [
    'game', 'title', 'result', 'hud', 'touch', 'pause', 'hearts', 'coins', 'score', 'timer',
    'dashGauge', 'notice', 'modeHud', 'modeTimer', 'shieldCount', 'transformFlash', 'bossHud',
    'bossName', 'bossHp', 'goalLock', 'attack', 'oxygenHud', 'oxygenGauge', 'start', 'retry', 'next',
    'resultKicker', 'resultTitle', 'resultStats', 'resultFeni'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  const buttons = ['dashLeft', 'dashRight', 'left', 'right', 'up', 'down', 'attack', 'jump'].map((name) => {
    const button = new Element();
    button.dataset.input = name;
    return button;
  });
  const document = {
    body: new Element('body'),
    querySelector(selector) { return elements[selector.replace('#', '')] || new Element(); },
    querySelectorAll(selector) { return selector === '[data-input]' ? buttons : []; },
    addEventListener() {}
  };
  class Image {
    constructor() { this.complete = true; this.naturalWidth = 600; this.naturalHeight = 700; }
    set src(value) { this.source = value; }
    get src() { return this.source; }
  }
  const context = {
    console, document, Image, URLSearchParams, location: { search: '?debug=1' },
    navigator: { maxTouchPoints: touch ? 5 : 0 }, innerWidth: width, innerHeight: height,
    devicePixelRatio: touch ? 2 : 1, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: () => 1, clearTimeout() {}, Math, Date
  };
  context.window = context;
  context.globalThis = context;
  context.addEventListener = () => {};
  context.visualViewport = { width, height, addEventListener() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'game.js'), 'utf8'), context, { filename: 'game.js' });
  return context.__repairHeroDebug;
}

function testStagesAndSpawn() {
  const game = createGame({ width: 390, height: 844, touch: true });
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '2-5']) {
    game.setStage(id);
    const start = game.state();
    assert.equal(start.player.hp, 3, `${id}: starts with full HP`);
    assert.ok(start.player.y >= 0 && start.player.y < start.world.height, `${id}: spawn is inside world`);
    if (!['1-7', '2-5'].includes(id)) assert.equal(start.player.grounded, true, `${id}: spawn is grounded`);
    game.step(.45);
    game.draw();
    const after = game.state();
    assert.equal(after.player.hp, 3, `${id}: safe after first frames`);
    assert.ok(after.player.y < after.world.height, `${id}: does not fall through stage`);
  }
  game.setStage('1-1');
  const portrait = game.state();
  const playerScreenRatio = (112 * 1.32) / portrait.world.viewportHeight;
  assert.ok(playerScreenRatio >= .14 && playerScreenRatio <= .18, 'portrait player height stays within 14–18%');
}

function testModes() {
  const game = createGame();
  game.start();

  game.setMode('battery');
  assert.equal(game.state().player.modeTimer, 25);
  game.hit();
  assert.equal(game.state().player.hp, 2.5, 'battery mode reduces damage');
  game.step(4);
  assert.equal(game.state().player.hp, 3, 'battery mode regenerates without exceeding max HP');

  game.setStage('1-1');
  game.setMode('lcd');
  assert.equal(game.state().player.modeTimer, 25);
  game.hit();
  assert.equal(game.state().player.shields, 1);
  assert.equal(game.state().player.hp, 3);
  game.hit();
  assert.equal(game.state().player.shields, 0);
  assert.equal(game.state().player.hp, 3);
  game.hit();
  assert.equal(game.state().player.hp, 2, 'third LCD hit damages HP');

  game.setStage('1-1');
  game.setMode('king');
  assert.equal(game.state().player.modeTimer, 20);
  game.hit();
  assert.equal(game.state().player.hp, 3, 'king mode is invincible');
  const beforeFlight = game.state().player;
  game.setInput('up', true);
  game.setInput('right', true);
  game.step(.6);
  game.setInput('up', false);
  game.setInput('right', false);
  const afterFlight = game.state().player;
  assert.ok(afterFlight.x > beforeFlight.x && afterFlight.y < beforeFlight.y, 'king flies freely up and right');

  game.setStage('1-1');
  const kingTarget = game.state().enemyPositions[0];
  const kingEnemies = game.state().enemiesAlive;
  game.setMode('king');
  game.teleport(kingTarget.x, kingTarget.y);
  game.step(.08);
  assert.ok(game.state().enemiesAlive < kingEnemies, 'king contact defeats a normal enemy without player damage');
  assert.equal(game.state().player.hp, 3);

  game.setStage('1-1');
  game.setMode('muscle');
  assert.equal(game.state().player.modeTimer, 25);
  game.hit();
  assert.equal(game.state().player.hp, 1.5, 'GORI MACHO loses half of its full HP per hit');
  game.hit();
  assert.equal(game.state().player.hp, 0, 'GORI MACHO loses the other half on the next hit');
}

function testCoreControls() {
  const game = createGame();
  game.start();
  const startX = game.state().player.x;
  game.setInput('right', true);
  game.step(.4);
  game.setInput('right', false);
  assert.ok(game.state().player.x > startX, 'right movement works');

  game.setStage('1-1');
  game.setInput('left', true);
  game.step(.25);
  game.setInput('left', false);
  assert.ok(game.state().player.vx < 0, 'left movement works');

  game.setStage('1-1');
  game.setInput('dashRight', true);
  game.step(.25);
  game.setInput('dashRight', false);
  assert.ok(game.state().player.vx > 300, 'right dash reaches dash speed');

  game.setStage('1-1');
  game.setInput('dashLeft', true);
  game.step(.25);
  game.setInput('dashLeft', false);
  assert.ok(game.state().player.vx < -300, 'left dash reaches dash speed');

  game.setStage('1-1');
  game.setInput('jump', true);
  game.step(.03);
  game.setInput('jump', false);
  game.step(.03);
  game.setInput('jump', true);
  game.step(.03);
  game.setInput('jump', false);
  assert.equal(game.state().player.jumpCount, 2, 'double jump works');

  game.setStage('1-1');
  const comboStart = game.state().player;
  game.setInput('dashRight', true);
  game.setInput('jump', true);
  game.step(.12);
  game.setInput('dashRight', false);
  game.setInput('jump', false);
  const comboEnd = game.state().player;
  assert.ok(comboEnd.x > comboStart.x && comboEnd.vy < 0, 'dash and jump work simultaneously for multi-touch controls');

  game.setStage('1-7');
  const waterY = game.state().player.y;
  game.setInput('up', true);
  game.step(.35);
  game.setInput('up', false);
  assert.ok(game.state().player.y < waterY, 'underwater up movement works');
  const raisedY = game.state().player.y;
  game.setInput('down', true);
  game.step(.65);
  game.setInput('down', false);
  assert.ok(game.state().player.y > raisedY, 'underwater down movement works');

  game.setStage('1-5');
  game.giveSword();
  assert.equal(game.state().player.swordPose, 'ready', 'sword holder uses the ready pose');
  game.attack();
  assert.ok(game.state().player.attackTime > 0, 'sword ATTACK activates');
  assert.equal(game.state().player.swordPose, 'swing', 'sword ATTACK starts with the flaming swing pose');
  assert.ok(game.state().shockwaveKinds.includes('slash'), 'sword ATTACK launches a flame slash wave');
  assert.ok(game.state().shockwaveData.some((wave) => wave.kind === 'slash' && wave.maxDistance >= 360), 'slash wave travels well beyond the sword hitbox');
  game.step(.18);
  assert.equal(game.state().player.swordPose, 'finish', 'sword ATTACK advances to the follow-through pose');
  game.step(.2);
  assert.equal(game.state().player.swordPose, 'ready', 'sword pose returns to ready after the attack');

  game.setStage('1-1');
  const swordTarget = game.state().enemyPositions[0];
  const swordEnemyCount = game.state().enemiesAlive;
  game.teleport(swordTarget.x - 90, swordTarget.y);
  game.giveSword();
  game.attack();
  assert.ok(game.state().enemiesAlive < swordEnemyCount, 'sword attack defeats an enemy in its hitbox');

  game.setStage('1-1');
  const beforeDashWall = game.state();
  const dashWall = beforeDashWall.breakablePositions[0];
  game.teleport(dashWall.x - 125, dashWall.y - 35);
  game.setInput('dashRight', true);
  game.step(.45);
  game.setInput('dashRight', false);
  assert.ok(game.state().breakablesAlive < beforeDashWall.breakablesAlive, 'dash destroys a breakable obstacle without stopping');

  game.setStage('1-1');
  const checkpoint = game.state().checkpoints[0];
  game.teleport(checkpoint.x, checkpoint.y);
  game.step(.08);
  assert.equal(game.state().checkpoints[0].active, true, 'checkpoint activates');
  game.teleport(0, 20);
  game.respawn();
  assert.equal(Math.round(game.state().player.x), Math.round(checkpoint.respawnX), 'checkpoint respawn X is restored');
  assert.equal(Math.round(game.state().player.y), Math.round(checkpoint.respawnY), 'checkpoint respawn Y is safe and restored');
}

function testTraversalAndStompUpgrades() {
  const game = createGame();
  game.setStage('1-1');

  const ledge = game.state().oneWayPlatforms.find((platform) => platform.y < 560 && platform.h <= 32);
  assert.ok(ledge, 'stage exposes a one-way upper ledge');
  game.teleport(ledge.x + 25, ledge.y + ledge.h + 8);
  game.setVelocity(0, -780);
  game.step(.18);
  assert.ok(game.state().player.y < ledge.y + ledge.h, 'jumping passes through the underside of an upper ledge');

  game.setStage('1-1');
  const dropLedge = game.state().oneWayPlatforms.find((platform) => platform.y < 560 && platform.h <= 32);
  game.teleport(dropLedge.x + 30, dropLedge.y - 112);
  game.step(.04);
  const ledgeTop = game.state().player.y;
  game.setInput('down', true);
  game.step(.06);
  game.setInput('down', false);
  assert.ok(game.state().player.dropTimer > 0, 'down input enables one-way platform drop-through');
  assert.ok(game.state().player.y > ledgeTop + 8, 'Feni drops below a ledge instead of getting caught on it');

  game.setStage('1-1');
  const pad = game.state().jumpPadPositions[0];
  game.teleport(pad.x + 5, pad.y - 170);
  game.setVelocity(0, 720);
  game.step(.22);
  assert.ok(game.state().jumpPadVelocity <= -1100, 'jump pad launch power is substantially stronger than the old -850 setting');
  assert.ok(game.state().player.vy < 0 && game.state().player.y < pad.y - 200, 'jump pad sends Feni rapidly upward');
  assert.equal(game.state().player.jumpCount, 0, 'jump pad preserves both air jumps');

  game.setStage('1-1');
  const target = game.state().enemyPositions.find((enemy) => enemy.type === 'phoneBot') || game.state().enemyPositions[0];
  const enemiesBefore = game.state().enemiesAlive;
  game.teleport(target.x + target.w * .25, target.y - 145);
  game.setVelocity(0, 620);
  game.step(.18);
  assert.ok(game.state().enemiesAlive < enemiesBefore, 'falling onto an enemy reliably stomps it');
  assert.ok(game.state().player.vy < 0, 'successful stomp bounces Feni upward');

  for (const [id, minimumWidth] of [['1-1', 10000], ['1-5', 9000], ['1-6', 13000], ['1-7', 13500], ['1-8', 11000]]) {
    game.setStage(id);
    assert.ok(game.state().world.width >= minimumWidth, `${id}: stage is substantially longer`);
  }
  game.setStage('1-1');
  assert.ok(game.state().kingWeight < .1, 'KING MODE random spawn weight stays rare');
  game.setStage('1-5');
  assert.equal(game.state().transformTypes.filter((type) => type === 'king').length, 1, 'boss stage keeps one deliberate KING pickup');

  game.setStage('1-6');
  const surfaceDecks = game.state().oneWayPlatforms.filter((platform) => platform.surfaceRoute);
  assert.ok(surfaceDecks.length >= 4, 'underground maze has a traversable surface route connected to the deep route');
}

function testStaminaCoinsAndEnemyArsenal() {
  const game = createGame();
  game.setStage('1-1');
  game.setInput('dashLeft', true);
  game.step(1.25);
  game.setInput('dashLeft', false);
  game.step(.03);
  const spent = game.state().player.dash;
  assert.ok(spent < 70, 'dash consumes stamina before a manual recharge');
  game.setInput('down', true);
  game.step(.55);
  const charged = game.state().player;
  game.setInput('down', false);
  assert.ok(charged.chargeTime > 0, 'holding down on safe solid ground enters CHARGE');
  assert.ok(charged.dash > spent + 35, 'manual CHARGE restores stamina rapidly');

  game.setStage('1-1');
  const firstCoin = game.state().coinPositions[0];
  game.teleport(firstCoin.x - 30, firstCoin.y - 55);
  game.step(.04);
  const firstBonus = game.state().player.coinSpeed;
  assert.ok(firstBonus > 0, 'collecting a coin adds movement speed');
  const secondCoin = game.state().coinPositions[0];
  game.teleport(secondCoin.x - 30, secondCoin.y - 55);
  game.step(.04);
  assert.ok(game.state().player.coinSpeed > firstBonus, 'coin speed increases gradually with each pickup');

  game.setStage('1-1');
  const enemyFamilies = game.state().enemyPositions;
  assert.ok(enemyFamilies.every((enemy) => enemy.w >= 64), 'enemy sprites use the larger combat scale');
  assert.ok(new Set(enemyFamilies.map((enemy) => enemy.attack)).size >= 3, 'enemy families expose multiple attack types');
  const target = enemyFamilies[0];
  game.teleport(Math.max(0, target.x - 520), target.y);
  game.setMode('king');
  const firedKinds = new Set();
  for (let frame = 0; frame < 36; frame += 1) {
    game.step(.1);
    game.state().projectileKinds.forEach((kind) => firedKinds.add(kind));
  }
  assert.ok([...firedKinds].some((kind) => kind !== 'droplet'), 'telegraphed enemy special attacks actually fire');
}

function testModeSwordAndGoalExpressions() {
  const game = createGame();
  for (const transform of ['battery', 'lcd', 'king', 'muscle']) {
    game.setStage('1-5');
    game.setMode(transform);
    game.giveSword();
    assert.equal(game.state().player.swordPose, 'ready', `${transform}: keeps its own sword-ready state`);
    game.attack();
    assert.equal(game.state().player.swordPose, 'swing', `${transform}: can swing the sword`);
    assert.ok(game.state().shockwaveKinds.includes('slash'), `${transform}: keeps the flame slash wave`);
    if (transform === 'muscle') assert.equal(game.state().rushTrails, 0, 'GORI MACHO uses the sword, not rush punch, while armed');
  }

  const goalLines = {
    normal: 'おいどんの勝利！！', battery: '体力万全！！', lcd: '合理的な結果やな',
    king: "I'm KING👑", muscle: 'うおおおおお！！プロテイン！！'
  };
  for (const [transform, line] of Object.entries(goalLines)) {
    game.setStage('1-1');
    if (transform !== 'normal') game.setMode(transform);
    const goal = game.state().goal;
    game.teleport(goal.x + 2, 480);
    game.step(.04);
    assert.equal(game.state().player.clearMode, transform, `${transform}: clear pose preserves the active mode`);
    assert.ok(game.state().notice.includes(line), `${transform}: displays its unique goal line`);
  }

  game.setStage('1-1');
  game.respawn();
  assert.ok(game.state().notice.includes('何度でも蘇る！！'), 'respawn displays the requested speech bubble line');
  assert.ok(game.state().player.revivePose > 0, 'respawn activates the dedicated smiling expression');
}

function testRushPunch() {
  const game = createGame();
  game.start();
  const before = game.state();
  game.setMode('muscle');
  game.attack();
  const fired = game.state();
  assert.ok(fired.rushTrails >= 42, 'rush punch creates many fist afterimages');
  assert.ok(fired.shockwaves > 0, 'rush punch creates a long-range shockwave');
  game.step(.9);
  assert.ok(game.state().enemiesAlive < before.enemiesAlive, 'rush punch pierces distant enemies in its lane');

  game.setStage('1-1');
  const wallState = game.state();
  const targetWall = wallState.breakablePositions[0];
  game.teleport(targetWall.x - 430, targetWall.y - 40);
  game.setMode('muscle');
  game.attack();
  game.step(.9);
  assert.ok(game.state().breakablesAlive < wallState.breakablesAlive, 'rush shockwave destroys breakable walls');

  game.setStage('1-5');
  const gateX = game.state().boss.gateX;
  game.teleport(gateX + 30, 470);
  game.step(.08);
  assert.equal(game.state().boss.gateClosed, true, 'boss gate closes before combat');
  game.teleport(gateX - 420, 470);
  const gatedBossHp = game.state().boss.hp;
  game.setMode('muscle');
  game.attack();
  game.step(.9);
  assert.equal(game.state().boss.hp, gatedBossHp, 'rush shockwave cannot pass through the fixed boss gate');

  game.setStage('1-5');
  const bossEntry = game.state().boss;
  game.teleport(bossEntry.gateX + 30, 470);
  game.step(.08);
  game.teleport(game.state().boss.x - 300, game.state().boss.y + 100);
  game.step(.08);
  const bossBefore = game.state().boss.hp;
  game.setMode('muscle');
  game.attack();
  game.step(.5);
  assert.ok(game.state().boss.hp <= bossBefore - 5, 'rush punch deals high boss damage');
}

function testBossGateAndChaseWall() {
  const game = createGame();
  game.setStage('1-5');
  assert.equal(game.state().boss.goalUnlocked, false, 'boss goal starts locked');
  game.defeatBoss();
  game.step(3);
  assert.equal(game.state().boss.defeated, true);
  assert.equal(game.state().boss.gateClosed, false);
  assert.equal(game.state().boss.goalUnlocked, true, 'goal unlocks only after boss defeat sequence');

  game.setStage('1-8');
  const wallStart = game.state().chaserWall;
  game.step(1);
  const wallAfter = game.state().chaserWall;
  assert.ok(wallAfter.x > wallStart.x, 'chaser wall advances');
  assert.ok(wallAfter.speed >= wallStart.speed, 'chaser wall accelerates with progress');

  game.setStage('2-5');
  const shark = game.state().boss;
  assert.equal(shark.type, 'shark', '2-5 uses the giant mecha shark boss');
  assert.equal(shark.name, 'ABYSS MECHA SHARK');
  assert.equal(shark.goalUnlocked, false, '2-5 goal starts locked');
  assert.ok(shark.swordX < shark.gateX && shark.gateX - shark.swordX >= 500, 'Phoenix Sword is prepared well before the shark arena');
  game.giveSword();
  game.teleport(shark.gateX + 30, 300);
  game.step(.08);
  assert.ok(game.state().notice.includes('おいどんが諦めるのを諦めろ！！'), 'armed boss entry uses the sword-holder line');
  game.step(2.5);
  assert.ok(game.state().bossProjectileKinds.includes('torpedo'), 'mecha shark launches torpedo attacks');
  game.defeatBoss();
  game.step(3);
  assert.equal(game.state().boss.goalUnlocked, true, '2-5 goal unlocks only after the shark is defeated');
}

function testAssetsAndSyntaxSurface() {
  for (const file of ['feni.png', 'feni_battery.png', 'feni_lcd.png', 'feni_king.png', 'fenichan_gorimacho.png', 'fenichan_gorimacho_punch.png', 'feni_dash.png', 'phoenix_sword.png', 'feni_sword_ready.png', 'feni_sword_swing.png', 'feni_sword_finish.png', 'enemy_phone_bot.png', 'enemy_tool_mech.png', 'enemy_battery_bot.png', 'enemy_board_trooper.png', 'enemy_mecha_shark.png', 'enemy_battle_drone.png', 'boss_mega_bug_titan.png']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
    assert.ok(fs.statSync(path.join(root, file)).size > 1000, `${file} is a real image asset`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const source of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const local = source[1].replace(/^\.\//, '');
    if (!/^https?:/.test(local)) assert.ok(fs.existsSync(path.join(root, local)), `${local} reference exists`);
  }
}

function testViewportMatrix() {
  const viewports = [
    [390, 844, true, 'iPhone portrait'], [844, 390, true, 'iPhone landscape'],
    [768, 1024, true, 'iPad portrait'], [1180, 820, true, 'iPad landscape'],
    [412, 915, true, 'Android portrait'], [1280, 720, false, 'PC landscape']
  ];
  for (const [width, height, touch, label] of viewports) {
    const game = createGame({ width, height, touch });
    game.start();
    game.draw();
    const state = game.state();
    assert.ok(state.world.viewportWidth > 0 && state.world.viewportHeight > 0, `${label}: viewport initializes`);
    assert.ok(state.player.y < state.world.height, `${label}: player remains inside the stage`);
    if (height > width) {
      const ratio = (112 * 1.32) / state.world.viewportHeight;
      assert.ok(ratio >= .14 && ratio <= .18, `${label}: portrait player height stays within 14–18%`);
    }
  }
}

function testSoundRuntime() {
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() { this.state = 'running'; }
    createOscillator() {
      return { type: 'square', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(target) { return target; }, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(target) { return target; } };
    }
  }
  const document = { addEventListener() {} };
  const context = { document, AudioContext, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'sound.js'), 'utf8'), context, { filename: 'sound.js' });
  context.RepairHeroSound.music('title');
  context.RepairHeroSound.music('game');
  context.RepairHeroSound.play('rushPunch');
  context.RepairHeroSound.play('shieldBreak');
  context.RepairHeroSound.play('attack');
  context.RepairHeroSound.play('enemyAttack');
  context.RepairHeroSound.play('revive');
  context.RepairHeroSound.music('boss2');
  context.RepairHeroSound.music(null);
}

testStagesAndSpawn();
testCoreControls();
testTraversalAndStompUpgrades();
testStaminaCoinsAndEnemyArsenal();
testModeSwordAndGoalExpressions();
testModes();
testRushPunch();
testBossGateAndChaseWall();
testViewportMatrix();
testAssetsAndSyntaxSurface();
testSoundRuntime();
console.log('Repair Hero smoke tests passed');
