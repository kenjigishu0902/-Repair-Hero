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
    'bossHp', 'goalLock', 'attack', 'oxygenHud', 'oxygenGauge', 'start', 'retry', 'next',
    'resultKicker', 'resultTitle', 'resultStats'
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
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8']) {
    game.setStage(id);
    const start = game.state();
    assert.equal(start.player.hp, 3, `${id}: starts with full HP`);
    assert.ok(start.player.y >= 0 && start.player.y < start.world.height, `${id}: spawn is inside world`);
    if (id !== '1-7') assert.equal(start.player.grounded, true, `${id}: spawn is grounded`);
    game.step(.45);
    game.draw();
    const after = game.state();
    assert.equal(after.player.hp, 3, `${id}: safe after first frames`);
    assert.ok(after.player.y < after.world.height, `${id}: does not fall through stage`);
  }
  game.setStage('1-1');
  const portrait = game.state();
  const playerScreenRatio = 112 / portrait.world.viewportHeight;
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
  game.step(.18);
  assert.equal(game.state().player.swordPose, 'finish', 'sword ATTACK advances to the follow-through pose');
  game.step(.2);
  assert.equal(game.state().player.swordPose, 'ready', 'sword pose returns to ready after the attack');

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
  game.teleport(4995, 470);
  game.step(.08);
  assert.equal(game.state().boss.gateClosed, true, 'boss gate closes before combat');
  game.teleport(4850, 470);
  const gatedBossHp = game.state().boss.hp;
  game.setMode('muscle');
  game.attack();
  game.step(.9);
  assert.equal(game.state().boss.hp, gatedBossHp, 'rush shockwave cannot pass through the fixed boss gate');

  game.setStage('1-5');
  game.teleport(5250, 480);
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
}

function testAssetsAndSyntaxSurface() {
  for (const file of ['feni.png', 'feni_battery.png', 'feni_lcd.png', 'feni_king.png', 'fenichan_gorimacho.png', 'fenichan_gorimacho_punch.png', 'phoenix_sword.png', 'feni_sword_ready.png', 'feni_sword_swing.png', 'feni_sword_finish.png']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
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
      const ratio = 112 / state.world.viewportHeight;
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
  context.RepairHeroSound.music('boss2');
  context.RepairHeroSound.music(null);
}

testStagesAndSpawn();
testCoreControls();
testModes();
testRushPunch();
testBossGateAndChaseWall();
testViewportMatrix();
testAssetsAndSyntaxSurface();
testSoundRuntime();
console.log('Repair Hero smoke tests passed');
