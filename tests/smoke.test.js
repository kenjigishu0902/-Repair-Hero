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
  setAttribute(name, value) { this[name] = String(value); }
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
    'dashGauge', 'notice', 'noticeText', 'noticePortrait', 'ultimateCutin', 'ultimateCutinPortrait', 'ultimateCutinImage', 'ultimateCutinHeader', 'ultimateCutinMode', 'ultimateCutinName', 'ultimateCutinQuote',
    'modeHud', 'modeTimer', 'shieldCount', 'specialStatus', 'transformFlash', 'bossHud',
    'bossName', 'bossHp', 'bossSpecial', 'bossSpecialLabel', 'goalLock', 'attack', 'wingAttack', 'specialAttack', 'oxygenHud', 'oxygenGauge', 'start', 'retry', 'next', 'titleBack',
    'resultKicker', 'resultTitle', 'resultStats', 'resultFeni', 'controlsTutorial', 'tutorialOpen', 'tutorialClose'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  const buttons = ['dashLeft', 'dashRight', 'left', 'right', 'up', 'down', 'wing', 'special', 'attack', 'jump'].map((name) => {
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
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '2-5', '2-6', '3-1']) {
    game.setStage(id);
    const start = game.state();
    const expectedHp=id==='3-1'?7:3;
    assert.equal(start.player.hp, expectedHp, `${id}: starts with full HP`);
    assert.ok(start.player.y >= 0 && start.player.y < start.world.height, `${id}: spawn is inside world`);
    if (!['1-7', '2-5'].includes(id)) assert.equal(start.player.grounded, true, `${id}: spawn is grounded`);
    game.step(.45);
    game.draw();
    const after = game.state();
    assert.equal(after.player.hp, expectedHp, `${id}: safe after first frames`);
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
  assert.equal(game.state().player.shields, 5, 'LCD mode starts with the upgraded five-layer barrier');
  for (let layer = 4; layer >= 0; layer -= 1) {
    game.hit();
    assert.equal(game.state().player.shields, layer, `LCD barrier absorbs hit ${5-layer}`);
    assert.equal(game.state().player.hp, 3);
  }
  game.hit();
  assert.equal(game.state().player.hp, 2, 'sixth LCD hit damages HP after five barriers');

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
  assert.equal(game.state().player.state, 'dash', 'dash pose remains locked instead of flickering to walk/air frames');
  assert.ok(game.state().player.visualPose.scaleX > 1.05, 'dash pose stretches forward like an action-game character');
  assert.ok(game.state().player.visualPose.scaleY < .97, 'dash pose compresses vertically for a stronger silhouette');
  assert.ok(Math.abs(game.state().player.visualPose.tilt) >= .1, 'dash pose visibly leans into its direction');
  game.step(.08);
  assert.equal(game.state().player.state, 'dash', 'dash pose lock survives the button release transition');

  game.setStage('1-1');
  game.setInput('dashLeft', true);
  game.step(.25);
  game.setInput('dashLeft', false);
  assert.ok(game.state().player.vx < -300, 'left dash reaches dash speed');

  game.setStage('1-1');
  game.setInput('right', true);
  game.step(.18);
  game.setInput('right', false);
  game.setInput('left', true);
  game.step(.03);
  game.setInput('left', false);
  assert.ok(game.state().player.turnPoseTime > 0, 'changing direction triggers a short anticipation pose');

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
  assert.equal(game.state().player.renderExpression, 'swordReady', 'sword holder uses the per-mode two-handed ready artwork');
  game.attack();
  assert.ok(game.state().player.attackTime > 0, 'sword ATTACK activates');
  assert.equal(game.state().player.swordPose, 'swing', 'sword ATTACK starts with the flaming swing pose');
  assert.equal(game.state().player.renderExpression, 'swordSwing', 'sword attack uses the per-mode flaming swing artwork');
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

function testCrouchDurabilityFallGuardAndGimmicks() {
  const game = createGame();
  for (const transform of ['normal', 'battery', 'lcd', 'king', 'muscle']) {
    game.setStage('1-1');
    if (transform !== 'normal') game.setMode(transform);
    game.setInput('down', true);
    game.step(.08);
    assert.equal(game.state().player.crouching, true, `${transform}: down input crouches on solid ground`);
    assert.equal(game.state().player.state, 'crouch', `${transform}: crouch owns the animation state`);
    assert.equal(game.state().player.motionFrame, 'land', `${transform}: crouch reuses its matching mode art`);
    assert.ok(game.state().player.damageBox.h < 70, `${transform}: crouch lowers the vulnerable body`);
    assert.ok(game.state().player.damageBox.y > game.state().player.y + 45, `${transform}: crouch can duck a readable projectile`);
    game.setInput('down', false);
    game.step(.04);
  }

  game.setStage('1-1');
  const durability = game.state().enemyPositions;
  const lightIndex = durability.findIndex((enemy) => enemy.maxHp === 1);
  const armoredIndex = durability.findIndex((enemy) => enemy.maxHp === 2);
  assert.ok(lightIndex >= 0 && armoredIndex >= 0, 'stage mixes one-hit and two-hit enemy classes');
  const enemiesBeforeLight = game.state().enemiesAlive;
  game.hitEnemy(lightIndex, 1);
  assert.equal(game.state().enemiesAlive, enemiesBeforeLight - 1, 'one-hit enemy falls to one normal hit');

  game.setStage('1-1');
  const freshArmored = game.state().enemyPositions;
  const freshArmoredIndex = freshArmored.findIndex((enemy) => enemy.maxHp === 2);
  const armoredBefore = game.state().enemiesAlive;
  game.hitEnemy(freshArmoredIndex, 1);
  let survivingArmored = game.state().enemyPositions[freshArmoredIndex];
  assert.equal(game.state().enemiesAlive, armoredBefore, 'armored enemy survives its first normal hit');
  assert.equal(survivingArmored.hp, 1, 'armored enemy visibly has one armor segment left');
  game.hitEnemy(freshArmoredIndex, 1);
  assert.equal(game.state().enemiesAlive, armoredBefore - 1, 'armored enemy falls on the second normal hit');

  game.setStage('1-1');
  game.forceVoid();
  let recovered = game.state();
  assert.equal(recovered.player.voidRecoveries, 1, 'fall guard records a void recovery');
  assert.ok(recovered.player.y >= 0 && recovered.player.y < recovered.world.height, 'void recovery immediately returns Feni inside the stage');
  assert.equal(recovered.player.grounded, true, 'void recovery chooses supported land');
  game.step(1.2);
  recovered = game.state();
  assert.ok(recovered.player.y < recovered.world.height, 'recovered player does not enter an endless fall loop');

  game.setStage('1-1');
  const landGimmicks = new Set(game.state().gimmicks.map((gimmick) => gimmick.type));
  assert.ok(landGimmicks.has('boostRail'), 'land stages add a controllable speed-rail gimmick');
  assert.ok(landGimmicks.has('scanLaser'), 'land stages add a telegraphed crouch/jump laser gimmick');
  game.setStage('1-7');
  assert.equal(game.state().gimmicks.filter((gimmick) => gimmick.type === 'bubbleJet').length, 2, 'water stage adds two oxygen bubble-current gimmicks');

  game.setStage('1-1');
  game.setInput('right', true);
  game.step(.26);
  const walking = game.state().player;
  game.setInput('right', false);
  assert.equal(walking.state, 'walk', 'normal movement enters the walk state');
  assert.ok(walking.walkBlend && walking.walkBlend.blend > 0 && walking.walkBlend.blend < 1, 'walk frames cross-fade instead of snapping between poses');
}

function testStaminaCoinsAndEnemyArsenal() {
  const game = createGame();
  game.setStage('1-1');
  game.setInput('dashLeft', true);
  game.step(1.25);
  game.setInput('dashLeft', false);
  game.step(.03);
  const spent = game.state().player.dash;
  assert.equal(game.state().dashBalance.drainPerSecond, 28, 'dash drain is reduced to the longer-lasting balance');
  assert.ok(spent > 63 && spent < 69, 'a full dash gauge now lasts about 3.6 seconds');
  assert.equal(game.state().dashBalance.recoveryPerSecond, 12, 'stamina naturally recovers without a dedicated button');
  game.step(1);
  assert.ok(game.state().player.dash > spent + 10, 'stamina recovers automatically after releasing dash');
  assert.throws(() => game.setInput('charge', true), /Unknown input/, 'dedicated charge input is removed');

  game.setStage('1-1');
  game.collectCoins(4);
  assert.equal(game.state().player.speedTier, 0, '0–4 coins keep normal speed');
  assert.equal(game.state().player.coinSpeed, 0, 'normal coin tier has no hidden speed creep');
  game.collectCoins(1);
  assert.equal(game.state().player.speedTier, 1, 'the fifth coin unlocks medium speed');
  assert.ok(game.state().player.coinSpeed >= 60, 'medium speed is clearly stronger');
  assert.ok(game.state().notice.includes('SPEED UP'), 'the fifth coin announces SPEED UP');
  game.collectCoins(5);
  assert.equal(game.state().player.speedTier, 2, 'the tenth coin unlocks high speed');
  assert.ok(game.state().player.coinSpeed >= 120, 'high speed is substantially stronger');
  assert.ok(game.state().notice.includes('SUPER SPEED UP'), 'the tenth coin gets the stronger presentation');

  game.setStage('1-1');
  const enemyFamilies = game.state().enemyPositions;
  assert.ok(enemyFamilies.every((enemy) => enemy.w >= 64), 'enemy sprites use the larger combat scale');
  assert.ok(new Set(enemyFamilies.map((enemy) => enemy.attack)).size >= 3, 'enemy families expose multiple attack types');
  const target = enemyFamilies[0];
  assert.ok(target.attackCooldown >= 3.4, 'enemy special attacks begin with a low-tempo cooldown');
  game.teleport(Math.max(0, target.x - 520), target.y);
  game.setMode('king');
  const firedKinds = new Set();
  for (let frame = 0; frame < 96; frame += 1) {
    game.step(.1);
    game.state().projectileKinds.forEach((kind) => firedKinds.add(kind));
  }
  assert.ok([...firedKinds].some((kind) => kind !== 'droplet'), 'telegraphed enemy special attacks actually fire');
}

function testProjectileLifecycleIdleJumpAndWing() {
  const game = createGame();
  game.setStage('1-5');
  game.spawnEnemyProjectile('missile');
  assert.equal(game.state().enemyProjectileData.length, 1, 'enemy ranged objects expose lifecycle data');
  assert.ok(game.state().enemyProjectileData[0].maxDistance <= 620, 'enemy projectile has a finite readable range');
  assert.ok(game.state().enemyProjectileData[0].life <= 3.2, 'enemy projectile has a finite lifetime');
  const gateX = game.state().boss.gateX;
  game.teleport(gateX + 40, 470);
  game.beginBoss();
  assert.equal(game.state().enemyProjectileData.length, 0, 'boss intro removes regular-enemy projectiles');
  for (let index = 0; index < 70; index += 1) game.spawnEnemyProjectile('bolt');
  assert.ok(game.state().poolCounts.droplets <= 48, 'enemy projectile pool is capped for mobile performance');
  game.step(3.5);
  assert.equal(game.state().enemyProjectileData.length, 0, 'expired or over-range enemy projectiles are removed from memory');

  game.setStage('1-1');
  game.forceIdle('yawn');
  assert.equal(game.state().player.motionFrame, 'yawn', 'idle animation has a dedicated yawn pose without random face swapping');
  game.forceIdle('stretch');
  assert.equal(game.state().player.motionFrame, 'doubleJump', 'idle animation can use the all-mode broad stretch pose');
  game.setInput('right', true);
  game.step(.06);
  game.setInput('right', false);
  assert.equal(game.state().player.idleAction, null, 'player input immediately interrupts special idle motion');
  assert.equal(game.state().player.state, 'walk', 'idle transitions directly into movement');

  game.setStage('1-1');
  game.setInput('jump', true);
  game.step(.025);
  game.setInput('jump', false);
  assert.equal(game.state().player.state, 'jump');
  assert.equal(game.state().player.motionFrame, 'jumpStart', 'first jump begins with a takeoff pose');
  game.step(.18);
  assert.equal(game.state().player.motionFrame, 'jumpRise', 'first jump advances to its rising pose');
  game.setInput('jump', true);
  game.step(.025);
  game.setInput('jump', false);
  assert.equal(game.state().player.state, 'doubleJump');
  assert.equal(game.state().player.motionFrame, 'doubleJump', 'second jump uses a distinct wing/twist pose');

  game.setStage('1-1');
  const target = game.state().enemyPositions[0];
  const enemiesBefore = game.state().enemiesAlive;
  game.teleport(target.x - 220, target.y + target.h - 112);
  game.wingAttack();
  assert.equal(game.state().player.motionFrame, 'wingCharge', 'wing attack starts with its charge pose');
  game.step(.3);
  assert.ok(game.state().wingProjectiles.length > 0, 'wing attack launches a real ranged projectile');
  assert.ok(game.state().wingProjectiles[0].maxDistance <= 700, 'wing attack has a deliberate range limit');
  game.step(.45);
  assert.ok(game.state().enemiesAlive < enemiesBefore, 'wing attack damages a normal enemy');
  const cooldown = game.state().player.wingCooldown;
  game.wingAttack();
  assert.equal(game.state().player.wingAttackTime, 0, 'wing cooldown prevents immediate repeated fire');
  assert.ok(cooldown > 0, 'wing attack exposes a short cooldown');

  game.setStage('1-5');
  game.teleport(game.state().boss.gateX + 40, 470);
  game.beginBoss();
  game.step(2);
  const bossBefore = game.state().boss.hp;
  game.wingAttack();
  game.step(1.15);
  assert.ok(game.state().boss.hp < bossBefore, 'wing attack deals balanced fractional damage to a boss');
}

function testBossIntroAIPhasesAndCamera() {
  const game = createGame({ width: 390, height: 844, touch: true });
  game.setStage('1-5');
  const initial = game.state();
  assert.ok(initial.enemiesAlive > 0, 'boss stage retains regular encounters before the arena');
  game.spawnEnemyProjectile('rail');
  game.teleport(initial.boss.gateX + 40, 470);
  game.beginBoss();
  let state = game.state();
  assert.equal(state.boss.active, false, 'boss AI is locked during the entrance presentation');
  assert.equal(state.boss.gateClosed, true, 'arena gate closes at boss entry');
  assert.equal(state.enemiesAlive, 0, 'all regular enemies are cleared at boss entry');
  assert.equal(state.poolCounts.droplets, 0, 'all regular-enemy shots are cleared at boss entry');
  assert.ok(state.boss.arenaWidth >= 2300, 'boss arena provides a wide dedicated combat space');
  game.step(.7);
  state = game.state();
  const visibleSpan = Math.abs((state.boss.x + state.boss.w / 2) - (state.player.x + 36)) + state.boss.w / 2 + 36;
  assert.ok(visibleSpan <= state.world.viewportWidth + 40, 'portrait boss camera frames both Feni and the boss');
  assert.equal(state.boss.active, false, 'boss cannot attack during the warning window');
  assert.equal(state.player.hp, 3, 'entrance presentation cannot damage the player');
  game.step(1.25);
  assert.equal(game.state().boss.active, true, 'boss AI starts only after the preparation window');

  game.setMode('king');
  const observedStates = new Set();
  const observedAttacks = new Set();
  const firstStateByAttack = new Map();
  for (let frame = 0; frame < 190; frame += 1) {
    game.step(.1);
    const boss = game.state().boss;
    observedStates.add(boss.state);
    if (boss.attackName) {
      observedAttacks.add(boss.attackName);
      if (!firstStateByAttack.has(boss.attackName)) firstStateByAttack.set(boss.attackName, boss.state);
    }
  }
  assert.ok(observedStates.has('telegraph'), 'boss attacks always expose a telegraph state');
  assert.ok(observedStates.has('attack'), 'boss executes its telegraphed attacks');
  assert.ok(observedStates.has('recovery'), 'boss attacks include a punishable recovery');
  assert.ok(observedAttacks.size >= 3, 'boss cycles through multiple dedicated attacks');
  assert.ok([...firstStateByAttack.values()].every((value) => value === 'telegraph' || value === 'cutin'), 'each observed boss move begins with a warning or full-screen limit-break cut-in');

  game.setStage('1-5');
  game.teleport(game.state().boss.gateX + 40, 470);
  game.beginBoss();
  game.step(2);
  game.hitBoss(10);
  assert.equal(game.state().boss.phase, 2, 'boss enters phase 2 below 60% HP');
  game.hitBoss(8);
  assert.equal(game.state().boss.phase, 3, 'boss unlocks its final phase below 30% HP');
}

function testModeUltimatesSwordGripAndClashes() {
  const game = createGame();

  const airGame=createGame();airGame.setStage('1-1');airGame.setInput('jump',true);airGame.step(.05);airGame.setInput('jump',false);
  const airborneStart=airGame.state();assert.equal(airborneStart.player.grounded,false,'Feni is airborne before the test ultimate');
  assert.equal(airGame.ultimate(),true,'Feni can activate an ultimate while airborne');
  assert.equal(airGame.state().player.ultimateAirborne,true,'the airborne cut-in records a suspended aerial activation');
  airGame.step(.32);const airborneCutin=airGame.state();
  assert.ok(Math.abs(airborneCutin.player.y-airborneStart.player.y)<1,'Feni holds altitude through the airborne cut-in instead of falling below the stage');
  airGame.step(1.5);assert.equal(airGame.state().player.ultimatePhase,null,'airborne presentation reaches the actual attack normally');

  game.setStage('1-1');
  const normalTarget = game.state().enemyPositions.find((enemy) => !enemy.allied);
  game.teleport(Math.max(0, normalTarget.x - 520), normalTarget.y + normalTarget.h - 112);
  const normalBefore = game.state().enemiesAlive;
  assert.equal(game.ultimate(), true, 'normal ultimate can be activated');
  assert.equal(game.state().player.ultimatePhase, 'cutin', 'normal ultimate starts with the cut-in');
  assert.equal(game.state().cutinVisible, true, 'cut-in overlay is visible before dialogue');
  assert.equal(game.state().wingProjectiles.length, 0, 'attack does not fire before the cut-in and dialogue');
  game.step(.46);
  assert.equal(game.state().player.ultimatePhase, 'dialogue', 'cut-in advances to dialogue');
  assert.equal(game.state().cutinVisible, false, 'cut-in closes before the speech bubble');
  assert.ok(game.state().notice.includes('おいどんを甘く見るなよ！！'), 'normal ultimate uses its requested line');
  assert.equal(game.state().wingProjectiles.length, 0, 'attack still waits until dialogue completes');
  game.step(1.22);
  assert.equal(game.state().player.ultimatePhase, null, 'dialogue advances to the actual attack');
  game.step(.35);
  assert.ok(game.state().wingProjectiles.filter((shot) => shot.kind === 'fireFeather').length >= 5, 'normal ultimate launches a barrage of fire feathers');
  game.step(1.1);
  assert.ok(game.state().enemiesAlive < normalBefore, 'fire feathers seek and defeat enemies');
  assert.equal(game.ultimate(), false, 'normal ultimate respects its cooldown');

  game.setStage('1-1');
  game.setMode('battery');
  game.hit();
  const damagedHp = game.state().player.hp;
  game.step(.65);
  assert.ok(game.state().player.hp > damagedHp, 'battery mode continuously regenerates without a post-hit delay');
  assert.equal(game.ultimate(), true, 'battery ultimate activates');
  assert.equal(game.state().alliesAlive, 0, 'battery ally waits for the presentation sequence');
  game.step(.46);
  assert.ok(game.state().notice.includes('元気1000倍！！負ける気がしねぇ！！'), 'battery ultimate uses its requested line');
  game.step(1.22);
  assert.equal(game.state().alliesAlive, 1, 'battery ultimate converts exactly one enemy into an ally after dialogue');
  game.step(.4);
  assert.ok(game.state().wingProjectiles.some((shot) => shot.kind === 'allyPulse'), 'the allied enemy attacks other enemies');

  game.setStage('1-1');
  game.setMode('lcd');
  const lcdBefore = game.state().enemiesAlive;
  assert.equal(game.state().player.shields, 5, 'LCD barrier is upgraded to five layers');
  game.ultimate();
  assert.equal(game.state().player.ultimatePhase, 'cutin', 'LCD blink starts with its cut-in');
  game.step(.46);
  assert.ok(game.state().notice.includes('俯瞰した俺をもう誰も止められない…'), 'LCD ultimate uses its requested line');
  assert.equal(game.state().enemiesAlive, lcdBefore, 'LCD does not teleport before its dialogue');
  game.step(1.22);
  game.step(.82);
  assert.ok(game.state().enemiesAlive <= lcdBefore - 4, 'LCD ultimate chains instant-movement defeats');
  assert.ok(game.state().player.y >= 0 && game.state().player.y < game.state().world.height, 'LCD chain teleport always lands inside the stage');
  assert.equal(game.state().player.grounded, true, 'LCD chain teleport resolves to supported land');

  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '2-5', '2-6']) {
    game.setStage(id);
    game.setMode('lcd');
    game.ultimate();
    game.step(3.45);
    const blinkResult = game.state();
    assert.ok(blinkResult.player.y >= 0 && blinkResult.player.y < blinkResult.world.height, `${id}: repeated LCD targets never place Feni below the world`);
    assert.equal(blinkResult.player.voidRecoveries, 0, `${id}: LCD ultimate does not need the emergency fall guard`);
    if (!['1-7', '2-5'].includes(id)) assert.equal(blinkResult.player.grounded, true, `${id}: LCD ultimate ends on supported terrain`);
  }

  game.setStage('1-1');
  game.setMode('muscle');
  game.ultimate();
  game.step(.46);
  assert.ok(game.state().notice.includes('ウホォ/ / /止まんなァい゛い゛！！゛'), 'muscle ultimate uses its requested line');
  game.step(1.22);
  game.step(.58);
  const radialShots = game.state().wingProjectiles.filter((shot) => shot.kind === 'radialPunch');
  assert.ok(radialShots.length >= 14, 'muscle ultimate releases a dense all-direction rush punch');
  assert.ok(radialShots.some((shot) => Math.abs(shot.vy) > 300), 'all-direction rush includes strong vertical punches');

  game.setStage('1-1');
  game.setMode('king');
  const kingBefore = game.state().enemiesAlive;
  game.ultimate();
  assert.equal(game.state().kingClones, 0, 'KING clones wait until after the presentation');
  game.step(.46);
  assert.ok(game.state().notice.includes('ひれ伏せ！！俺はKINGだっ！！'), 'KING ultimate uses its requested line');
  game.step(1.22);
  assert.equal(game.state().kingClones, 2, 'KING becomes a three-member team with two autonomous clones');
  game.step(2.2);
  assert.ok(game.state().enemiesAlive < kingBefore, 'KING clones move ahead and defeat enemies independently');

  game.setStage('1-1');
  game.giveSword();
  game.attack();
  game.spawnCounterProjectile('rail');
  game.step(.04);
  assert.equal(game.state().enemyProjectileData.length, 0, 'a sword swing cancels an incoming enemy projectile');
  assert.equal(game.state().player.swordPose, 'swing', 'the exact Phoenix Sword overlay follows the active swing phase');
}

function testModeSwordAndGoalExpressions() {
  const game = createGame();
  for (const transform of ['battery', 'lcd', 'king', 'muscle']) {
    game.setStage('1-5');
    game.setMode(transform);
    game.giveSword();
    assert.equal(game.state().player.swordPose, 'ready', `${transform}: keeps its own sword-ready state`);
    assert.equal(game.state().player.renderExpression, 'swordReady', `${transform}: uses its matching mode sword-ready image`);
    game.attack();
    assert.equal(game.state().player.swordPose, 'swing', `${transform}: can swing the sword`);
    assert.equal(game.state().player.renderExpression, 'swordSwing', `${transform}: uses its matching mode sword-swing image`);
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
  assert.equal(game.state().noticeExpression.state, 'revive', 'respawn bubble uses the dedicated revival portrait');
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
  game.step(2);
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
  const sharkAttacks = new Set();
  for (let frame = 0; frame < 145; frame += 1) {
    game.step(.1);
    game.state().bossProjectileKinds.forEach((kind) => sharkAttacks.add(kind));
  }
  assert.ok(sharkAttacks.has('torpedo'), 'mecha shark launches low-tempo torpedo attacks');
  game.defeatBoss();
  game.step(3);
  assert.equal(game.state().boss.goalUnlocked, true, '2-5 goal unlocks only after the shark is defeated');
}

function testAssetsAndSyntaxSurface() {
  for (const file of ['feni.png', 'feni_battery.png', 'feni_lcd.png', 'feni_king.png', 'fenichan_gorimacho.png', 'fenichan_gorimacho_punch.png', 'feni_dash.png', 'feni_states_normal.png', 'feni_states_battery.png', 'feni_states_lcd.png', 'feni_states_king.png', 'feni_states_muscle.png', 'feni_motion_normal.png', 'feni_motion_battery.png', 'feni_motion_lcd.png', 'feni_motion_king.png', 'feni_motion_muscle.png', 'phoenix_sword.png', 'feni_sword_ready.png', 'feni_sword_swing.png', 'feni_sword_finish.png', 'enemy_phone_bot.png', 'enemy_tool_mech.png', 'enemy_battery_bot.png', 'enemy_board_trooper.png', 'enemy_mecha_shark.png', 'enemy_battle_drone.png', 'boss_mega_bug_titan.png', 'boss_mecha_gorilla.png', 'enemy_mecha_monkey.png', 'assets/cutins/boss_titan_overload.webp', 'assets/cutins/boss_shark_tsunami.webp', 'assets/cutins/boss_gorilla_cataclysm.webp', 'assets/cutins/dark_feni_chaos.webp', 'assets/cutins/dark_feni_leak.webp', 'assets/cutins/dark_feni_lcd.webp', 'assets/cutins/dark_feni_muscle.webp', 'assets/cutins/dark_feni_board.webp']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
    assert.ok(fs.statSync(path.join(root, file)).size > 1000, `${file} is a real image asset`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /data-input="wing"/, 'mobile UI exposes the Phoenix Wing attack button');
  assert.match(html, /data-input="special"/, 'mobile UI exposes the mode-specific ultimate button');
  assert.match(html, /id="ultimateCutin"[\s\S]+id="ultimateCutinPortrait"[\s\S]+id="ultimateCutinImage"[\s\S]+id="ultimateCutinQuote"/, 'ultimate presentation has generated boss art and live full-screen dialogue surfaces');
  assert.match(html, /cutin-slash-a[\s\S]+LIMIT BREAK \/\/ PHOENIX DRIVE[\s\S]+EXECUTE/, 'ultimate cut-in includes the fast slash and limit-break presentation layers');
  assert.match(html, /title-enemy-left[\s\S]+enemy_phone_bot\.png[\s\S]+title-enemy-right[\s\S]+enemy_battle_drone\.png/, 'title screen uses the restored mech cast as its visual threat');
  assert.match(html, /id="controlsTutorial"[\s\S]+スマホ[\s\S]+PC[\s\S]+敵弾は剣・翼・パンチで相殺/, 'title includes a visual smartphone and PC tutorial');
  for(const label of ['左ダッシュ','右ダッシュ','しゃがむ','つばさ攻撃','ひっさつ','ジャンプ'])assert.ok(html.includes(label),`touch controls expose the visual ${label} label`);
  assert.doesNotMatch(html, /data-input="charge"|STAMINA<br>CHARGE/, 'dedicated dash charge button is absent from the mobile UI');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  assert.doesNotMatch(css, /charge-control/, 'removed charge control leaves no stale responsive CSS');
  assert.match(css, /grid-template-areas:"special wing jump" "attack attack jump"/, 'portrait action layout fits ultimate, wing, attack, and jump controls');
  assert.match(gameSource, /drawImage\(phoenixSwordImage,[^\n]+swordSize,swordSize\)/, 'the canonical Phoenix Sword is rendered without aspect-ratio distortion');
  assert.doesNotMatch(gameSource, /ctx\.drawImage\(swordPoseImage/, 'old baked sword-pose art is not drawn over transformed characters');
  assert.match(gameSource, /function drawBackground\(\)[\s\S]+ABYSSAL REPAIR ZONE/, 'optimized theme-specific background renderer is active');
  assert.doesNotMatch(gameSource, /fillText\(['"]ARMOR['"]/, 'enemy art is restored without the added permanent ARMOR label');
  assert.doesNotMatch(gameSource, /enemy\.hit>0\)ctx\.filter/, 'enemy art is restored without the added hit-color filter');
  assert.match(gameSource, /enemyImage\?\.repairRequested[\s\S]+ctx\.drawImage\(enemyImage\b/, 'regular enemies render the detailed mech PNG only after proximity loading');
  assert.match(gameSource, /ULTIMATE_CUTIN_TIME = \.42[\s\S]+ULTIMATE_DIALOGUE_TIME = 1\.18/, 'the player cinematic reaches the spoken line and attack substantially faster');
  assert.match(gameSource, /BOSS_CUTIN_TIME=\.72[\s\S]+boss_titan_overload\.webp[\s\S]+dark_feni_board\.webp/, 'boss and all Dark Feni modes use fast generated full-screen cut-ins');
  assert.match(gameSource, /function drawDarkFeniAvatar[\s\S]+strokeStyle='#310015'[\s\S]+strokeStyle='#be2458'/, 'the in-game Dark Feni renderer overlays a dark crimson-violet scar across his right eye');
  for(const landmark of ['通 天 閣','道 頓 堀','大阪城','あべのハルカス','梅田スカイビル','岸和田だんじり'])assert.ok(gameSource.includes(landmark),`Osaka renderer contains the recognizable ${landmark} landmark`);
  assert.match(css, /@keyframes cutinSlash[\s\S]+@keyframes cutinFlash/, 'cut-in uses fast diagonal impact and flash animation');
  assert.match(css, /titleReactorSpin[\s\S]+titleScan/, 'title screen includes the animated repair reactor and scan layer');
  assert.match(css, /body\.touch-device\.boss-phase2 #game\{filter:none\}/, 'touch devices avoid the full-canvas boss filter');
  assert.match(html, /BOSS ULTIMATE CINEMATIC · BUILD 08\.21-J[\s\S]+game\.js\?v=20260821j/, 'the visible build badge and cache-busted game script identify the boss-cinematic build');
  assert.match(gameSource, /KeyJ:'attack'[\s\S]+KeyK:'wing'[\s\S]+KeyV:'special'[\s\S]+KeyQ:'dashLeft'[\s\S]+KeyE:'dashRight'/, 'PC keyboard maps attacks, ultimates, and directional dashes');
  for (const source of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const local = source[1].replace(/^\.\//, '').split('?')[0];
    if (!/^https?:/.test(local)) assert.ok(fs.existsSync(path.join(root, local)), `${local} reference exists`);
  }
}

function testLazyAssetLoadingAndMechaEnemies() {
  const game=createGame({width:390,height:844,touch:true});
  let state=game.state();
  assert.equal(state.render.enemyArt,'mechaPngLazy','the detailed dark-SF mech renderer is active');
  assert.equal(state.render.assetRequests.player.normal,true,'normal Feni is requested at startup');
  assert.equal(state.render.assetRequests.state.normal,true,'normal expression sheet is requested at startup');
  assert.equal(state.render.assetRequests.motion.normal,true,'normal motion sheet is requested at startup');
  assert.equal(state.render.assetRequests.player.lcd,false,'inactive transformation base art is deferred');
  assert.equal(state.render.assetRequests.state.lcd,false,'inactive transformation expression art is deferred');
  assert.equal(state.render.assetRequests.motion.lcd,false,'inactive transformation motion art is deferred');
  assert.ok(Object.values(state.render.assetRequests.enemies).every((requested)=>!requested),'gameplay enemy textures stay deferred on the title screen');
  assert.equal(state.render.assetRequests.boss,false,'boss art is deferred outside its arena');
  assert.equal(state.render.assetRequests.sword,false,'sword art is deferred outside its arena');

  game.start();game.step(.05);state=game.state();
  assert.equal(state.render.assetRequests.enemies.phoneBot,true,'the nearby smartphone battle robot art is prefetched before entering view');
  assert.equal(state.render.assetRequests.enemies.toolMech,true,'the nearby tool mech art is prefetched before entering view');
  assert.equal(state.images.enemies.phoneBot.loaded,true,'the requested smartphone battle robot texture becomes drawable');
  assert.ok(Object.values(state.render.assetRequests.enemies).some((requested)=>!requested),'distant enemy types remain deferred instead of all decoding at once');

  game.setMode('lcd');state=game.state();
  assert.equal(state.render.assetRequests.player.lcd,true,'LCD base art loads when its mode is needed');
  assert.equal(state.render.assetRequests.state.lcd,true,'LCD expressions load when its mode is needed');
  assert.equal(state.render.assetRequests.motion.lcd,true,'LCD motions load when its mode is needed');

  game.setStage('1-5');
  state=game.state();game.teleport(state.boss.gateX-900,470);game.step(.05);state=game.state();
  assert.equal(state.render.assetRequests.boss,true,'Titan art is prefetched near the arena');
  assert.equal(state.render.assetRequests.sword,true,'Phoenix Sword art is prefetched before its pickup');

  const sharkGame=createGame();sharkGame.setStage('2-5');state=sharkGame.state();
  sharkGame.teleport(state.boss.gateX-900,300);sharkGame.step(.05);state=sharkGame.state();
  assert.equal(state.render.assetRequests.enemies.mechaShark,true,'shark boss art is prefetched near its arena');
  assert.ok(Object.entries(state.render.assetRequests.enemies).filter(([name])=>name!=='mechaShark').some(([,requested])=>!requested),'enemy types outside the nearby shark arena stay deferred');
}

function testJungleRaidBossGuardMusicAndSwordTracking(){
  const expectedMusic={
    '1-1':'cityRush','1-2':'pitRun','1-3':'underground','1-4':'sky','1-5':'fortress',
    '1-6':'maze','1-7':'sea','1-8':'factory','2-5':'deepSea','2-6':'jungle','3-1':'darkApproach'
  };
  const game=createGame({width:390,height:844,touch:true});
  for(const [id,music] of Object.entries(expectedMusic)){game.setStage(id);assert.equal(game.state().stageMusic,music,`${id} selects its own stage score`);}

  game.setStage('2-6');let state=game.state();
  assert.equal(state.boss.type,'gorilla','jungle stage has the dedicated mecha gorilla boss');
  assert.equal(state.bossMusic,'bossGorilla','gorilla starts with its dedicated boss score');
  game.teleport(state.boss.gateX-900,470);game.step(.05);state=game.state();
  assert.equal(state.render.assetRequests.gorillaBoss,true,'gorilla art is prefetched before the arena');
  assert.equal(state.render.assetRequests.enemies.mechaMonkey,true,'mecha monkey art is prefetched with its boss');
  game.teleport(state.boss.gateX+180,470);game.beginBoss();game.step(1.9);state=game.state();
  assert.equal(state.boss.minionsAlive,3,'boss intro creates exactly three guardian monkeys');
  assert.equal(state.boss.damageLocked,true,'gorilla is protected while guardian monkeys live');
  const protectedHp=state.boss.hp;
  assert.equal(game.hitBoss(5),false,'attacking the protected gorilla is rejected');
  assert.equal(game.state().boss.hp,protectedHp,'guardian lock prevents all boss HP damage');
  for(let count=3;count>0;count--){game.hitBossMinion(0);assert.equal(game.state().boss.minionsAlive,count-1,`guardian monkey ${4-count} can be defeated`);}
  state=game.state();assert.equal(state.boss.damageLocked,false,'defeating all monkeys removes the damage lock');assert.equal(state.boss.guardBroken,true,'gorilla armor break is recorded');
  assert.equal(game.hitBoss(2),true,'gorilla takes damage after all three monkeys are defeated');
  assert.ok(game.state().boss.hp<protectedHp,'unlocked boss HP decreases');
  game.setMode('king');state=game.state();game.teleport(state.boss.arenaLeft+180,350);game.teleportBoss(state.boss.arenaLeft+900,305);
  const gorillaAttacks=new Set();for(let frame=0;frame<130;frame++){game.step(.1);const attack=game.state().boss.attackName;if(attack)gorillaAttacks.add(attack);}
  assert.ok(gorillaAttacks.has('apeCharge'),'gorilla performs its own telegraphed charge');
  assert.ok([...gorillaAttacks].some((attack)=>['armSweep','scrapThrow','groundPound','roarPulse'].includes(attack)),'gorilla rotates into another dedicated attack');

  const clearGame=createGame();clearGame.setStage('2-6');state=clearGame.state();clearGame.teleport(state.boss.gateX+180,470);clearGame.beginBoss();clearGame.step(1.9);
  assert.equal(clearGame.state().boss.goalUnlocked,false,'jungle goal remains locked at boss start');
  for(let count=0;count<3;count++)clearGame.hitBossMinion(0);
  clearGame.defeatBoss();clearGame.step(3);
  assert.equal(clearGame.state().boss.goalUnlocked,true,'jungle goal unlocks after minions and gorilla are defeated');

  for(const transform of ['normal','battery','lcd','king','muscle']){
    game.setStage('1-5');if(transform!=='normal')game.setMode(transform);
    game.forceIdle('yawn');assert.equal(game.state().player.motionFrame,'yawn',`${transform} has the yawn model pose`);
    game.forceIdle('stretch');assert.equal(game.state().player.motionFrame,'doubleJump',`${transform} has the stretch model pose`);
  }
  game.setStage('1-5');game.giveSword();const idleAnchor=game.state().player.swordAnchor;
  game.setInput('right',true);game.step(.12);game.setInput('right',false);const runState=game.state();
  assert.ok(['walk','sprint'].includes(runState.player.state),'sword tracking test reaches a running state');
  assert.notDeepEqual(runState.player.swordAnchor,idleAnchor,'running uses its measured hand anchor instead of the idle anchor');
  game.setInput('jump',true);game.step(.025);game.setInput('jump',false);const jumpState=game.state();
  assert.equal(jumpState.player.state,'jump','sword tracking test reaches jump state');
  assert.ok(jumpState.player.swordAnchor.y<0,'jumping sword grip stays on the raised hand instead of floating below the body');
}

function testOsakaWarpVinesBossUltimatesAndDarkTrueEnd(){
  const game=createGame({width:390,height:844,touch:true});
  game.setStage('1-1');
  assert.equal(game.state().osakaBackdrop,true,'selected city routes render recognizable Osaka landmarks');
  assert.equal(game.spawnWarp(),true,'a safe random warp gate can be spawned');
  assert.ok(game.state().warpGate,'the random warp gate exists in the live world');
  assert.equal(game.enterBonus(),true,'entering the warp transfers Feni to the bonus room');
  let state=game.state();
  assert.equal(state.bonus.active,true,'bonus stage runs as its own bounded room');
  assert.ok(state.bonus.coinCount>=20,'bonus stage contains a meaningful coin route');
  game.step(.4);game.draw();
  assert.equal(game.exitBonus(),true,'the return gate exits the bonus stage');
  assert.equal(game.state().bonus,null,'bonus objects are released after returning');

  game.setStage('1-1');
  game.setInput('right',true);game.step(.08);const firstWalk=game.state().player;game.step(.08);const secondWalk=game.state().player;game.setInput('right',false);
  assert.ok(firstWalk.walkBlend&&secondWalk.walkBlend,'walking uses interpolated sprite states');
  assert.ok(secondWalk.walkPhase>firstWalk.walkPhase,'walking phase follows travelled distance continuously');
  assert.notEqual(secondWalk.walkBlend.blend,firstWalk.walkBlend.blend,'walking cross-fade advances without frame snapping');

  game.setStage('1-7');
  assert.equal(game.state().player.oxygenGear,true,'water stages equip Feni with the oxygen tank visual state');

  game.setStage('2-6');state=game.state();
  assert.ok(state.vines.length>=5,'jungle stage has multiple climbable and swingable vines');
  assert.equal(game.attachVine(0),true,'Feni can grab a jungle vine');
  const vineStart=game.state().player.y;game.setInput('up',true);game.step(.3);game.setInput('up',false);
  assert.ok(game.state().player.y<vineStart,'up input climbs the vine');
  game.setInput('right',true);game.setInput('jump',true);game.step(.04);game.setInput('jump',false);game.setInput('right',false);
  assert.equal(game.state().player.vineAttached,false,'jump input launches Feni from a hanging vine');
  assert.ok(game.state().player.vy<0,'vine jump provides a real upward launch');

  const bossSpecials=[['1-5','overloadStorm'],['2-5','abyssTsunami'],['2-6','jungleCataclysm']];
  for(const [stage,expected] of bossSpecials){
    game.setStage(stage);state=game.state();
    assert.ok(state.boss.arenaWidth>=3100,`${stage} has a substantially widened boss arena`);
    if(stage!=='2-5')assert.ok(state.boss.arenaUpperPlatforms>=6,`${stage} provides upper dodge platforms`);
    game.teleport(state.boss.gateX+160,stage==='2-5'?280:470);game.beginBoss();game.step(2.15);state=game.state();
    assert.ok(state.boss.specialGauge>0,`${stage} boss gauge fills naturally during combat`);
    const attack=game.forceBossSpecial();state=game.state();
    assert.equal(attack,expected,`${stage} spends its full boss gauge on its own ultimate`);
    assert.equal(state.boss.state,'cutin',`${stage} ultimate begins with a generated full-screen cut-in`);
    assert.equal(state.cutinVisible,true,`${stage} cut-in fills the presentation layer before combat resumes`);
    assert.match(state.cutinImageSource,/assets\/cutins\/boss_(?:titan|shark|gorilla)_/,`${stage} cut-in uses its matching generated boss art`);
    assert.ok(state.cutinQuote.length>=8,`${stage} boss speaks its own limit-break line`);
    game.step(.75);assert.equal(game.state().boss.state,'telegraph',`${stage} cut-in resolves into the readable attack telegraph`);
    assert.equal(state.boss.specialCount,1,`${stage} records the charged ultimate use`);
  }

  game.setStage('3-1');state=game.state();
  assert.equal(state.stageCount,11,'the Dark Feni duel is the eleventh full stage');
  assert.equal(state.player.hp,7,'final duel gives Feni seven health units');
  assert.equal(state.player.maxHp,7,'Feni final-duel maximum is seven');
  assert.equal(state.boss.hp,7,'Dark Feni starts with seven health units');
  assert.equal(state.boss.maxHp,7,'Dark Feni maximum is seven');
  assert.equal(state.finale.opening.phase,'irregular','final route starts with the full-screen IRREGULAR warning');
  assert.deepEqual(new Set(state.transformTypes),new Set(['battery','lcd','muscle','king']),'all four transformations are available during the final route');
  game.step(1.2);assert.equal(game.state().finale.opening.phase,'blackout','IRREGULAR warning cuts to blackout');
  game.step(2.2);assert.equal(game.state().finale.opening.active,false,'blackout resolves into the terminal stage');

  game.hit();assert.equal(game.state().player.hp,6,'final-duel damage removes one of seven health units');
  assert.equal(game.collectStaminaCola(),true,'the stamina cola can be collected');
  state=game.state();assert.equal(state.player.hp,7,'stamina cola fully restores all seven health units');assert.equal(state.player.dash,100,'stamina cola also fully restores dash stamina');
  assert.ok(state.finale.staminaColas.some((cola)=>cola.collected&&cola.respawns&&cola.respawnTimer>0),'collected stamina cola is scheduled to reappear');
  game.step(22);assert.ok(game.state().finale.staminaColas.every((cola)=>!cola.collected),'stamina cola actually reappears after its bounded cooldown');

  state=game.state();game.teleport(state.boss.gateX+180,470);game.beginBoss();game.step(.8);state=game.state();
  assert.equal(state.finale.bossReveal.spoken,true,'Dark Feni speaks after the blackout reveal');
  assert.match(state.notice,/始まりの終わりを始めよう/,'Dark Feni entrance line is visible before combat');
  game.step(2.6);assert.equal(game.state().boss.active,true,'Dark Feni cannot attack until the reveal completes');
  game.hitBoss(4);state=game.state();assert.equal(state.boss.hp,6,'each Dark Feni health segment absorbs oversized burst damage');assert.equal(state.boss.darkMode,'leak','losing the first health segment visibly transforms Dark Feni');
  game.hitBoss(4);state=game.state();assert.ok(state.boss.hp>5&&state.boss.hp<6,'leak mode reduces incoming damage instead of losing a full segment');

  const darkSpecials=[['normal','chaosHunt'],['leak','electricField'],['brokenLcd','blinkExecution'],['darkMuscle','earthRend'],['board','mirrorLegion']];
  for(const [darkMode,expected] of darkSpecials){
    const attack=game.forceBossSpecial(darkMode);assert.equal(attack,expected,`${darkMode} has its specified Dark Feni ultimate`);
    state=game.state();assert.equal(state.boss.state,'cutin',`${darkMode} ultimate opens on a full-screen Dark Feni cut-in`);
    assert.match(state.cutinImageSource,new RegExp(`assets/cutins/dark_feni_(?:chaos|leak|lcd|muscle|board)\\.webp`),`${darkMode} cut-in uses generated purple-red Dark Feni art`);
    assert.equal(state.cutinQuote.length>0,true,`${darkMode} cut-in carries its mode-specific spoken line`);
    game.step(.75);assert.equal(game.state().boss.state,'telegraph',`${darkMode} ultimate is telegraphed after the cut-in and before damage`);
    const observedKinds=new Set();let maxDarkClones=0;
    for(let frame=0;frame<20;frame++){game.step(.1);state=game.state();state.bossProjectileKinds.forEach((kind)=>observedKinds.add(kind));maxDarkClones=Math.max(maxDarkClones,state.darkClones);}
    if(darkMode==='normal'){
      assert.ok(observedKinds.has('darkChaos'),'normal Dark Feni fires visible chaos energy');
      assert.ok(state.bossProjectileData.some((shot)=>shot.kind==='darkChaos'&&shot.homingTime>=0),'chaos energy uses a bounded homing window');
    }
    if(darkMode==='leak')assert.ok(observedKinds.has('darkLightning'),'leak mode releases the surrounding electric field');
    if(darkMode==='darkMuscle')assert.ok(observedKinds.has('earthChunk'),'muscle mode lifts and throws terrain chunks');
    if(darkMode==='board')assert.equal(maxDarkClones,2,'board mode creates two attacking mirror clones');
    game.step(1.6);
  }

  game.defeatBoss();game.step(.45);assert.match(game.state().notice,/それがお前の答えか/,'defeated Dark Feni delivers the requested final line');
  game.step(3);assert.equal(game.state().finale.endRoll.active,true,'Dark Feni vanishes into shadow and starts the end roll');
  game.draw();game.step(13);assert.equal(game.state().mode,'clear','end roll resolves to the true-ending result');
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
    if (touch) {
      assert.equal(state.render.reducedEffects, true, `${label}: touch performance profile is active`);
      assert.ok(state.render.dpr <= 1.5, `${label}: canvas DPR is capped for mobile rendering`);
      assert.ok(state.render.backingWidth * state.render.backingHeight <= 1805000, `${label}: canvas stays inside the mobile pixel budget`);
    }
    if (height > width) {
      const ratio = (112 * 1.32) / state.world.viewportHeight;
      assert.ok(ratio >= .14 && ratio <= .18, `${label}: portrait player height stays within 14–18%`);
      assert.ok(state.world.viewportWidth >= 469, `${label}: portrait preserves at least 470 world pixels of forward view`);
    } else assert.ok(state.world.viewportWidth >= 1149, `${label}: landscape preserves at least 1150 world pixels of view`);
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
  for(const track of ['cityRush','pitRun','underground','sky','fortress','maze','sea','factory','deepSea','jungle','bonus','darkApproach','bossTitan','bossTitan2','bossShark','bossShark2','bossGorilla','bossGorilla2','darkFeni','darkFeni2','ending'])context.RepairHeroSound.music(track);
  context.RepairHeroSound.play('dash');
  context.RepairHeroSound.play('rushPunch');
  context.RepairHeroSound.play('shieldBreak');
  context.RepairHeroSound.play('attack');
  context.RepairHeroSound.play('enemyAttack');
  context.RepairHeroSound.play('revive');
  context.RepairHeroSound.play('coin');
  context.RepairHeroSound.play('speedUp');
  context.RepairHeroSound.play('speedMax');
  context.RepairHeroSound.play('wingFire');
  context.RepairHeroSound.play('ultimateCharge');
  context.RepairHeroSound.play('featherVolley');
  context.RepairHeroSound.play('allyJoin');
  context.RepairHeroSound.play('teleportStrike');
  context.RepairHeroSound.play('omniRush');
  context.RepairHeroSound.play('kingClones');
  context.RepairHeroSound.play('clash');
  context.RepairHeroSound.play('ultimateVoice');
  context.RepairHeroSound.play('armorHit');
  context.RepairHeroSound.play('boostRail');
  context.RepairHeroSound.play('laserWarn');
  context.RepairHeroSound.play('phaseGate');
  context.RepairHeroSound.play('bubbleJet');
  for(const effect of ['warpOpen','warpEnter','warpExit','vineGrab','vineJump','bossUltimate','bossCutin','darkBossCutin','bossUltimateImpact','darkTransform','darkFeather','darkClones','electricField','earthRend','irregular','blackout','darkReveal','darkIntroVoice','chaosHunt','darkDefeatVoice','darkVanish','staminaCola','colaSpawn'])context.RepairHeroSound.play(effect);
  context.RepairHeroSound.music('boss2');
  context.RepairHeroSound.transition('goal');
  assert.equal(context.RepairHeroSound.state().currentName, 'goal', 'goal transition replaces the previous BGM instead of layering it');
  context.RepairHeroSound.music(null);
  assert.equal(context.RepairHeroSound.state().currentName, null, 'leaving a stage stops the goal track');
}

testStagesAndSpawn();
testCoreControls();
testTraversalAndStompUpgrades();
testCrouchDurabilityFallGuardAndGimmicks();
testStaminaCoinsAndEnemyArsenal();
testProjectileLifecycleIdleJumpAndWing();
testBossIntroAIPhasesAndCamera();
testModeUltimatesSwordGripAndClashes();
testModeSwordAndGoalExpressions();
testModes();
testRushPunch();
testBossGateAndChaseWall();
testViewportMatrix();
testAssetsAndSyntaxSurface();
testLazyAssetLoadingAndMechaEnemies();
testJungleRaidBossGuardMusicAndSwordTracking();
testOsakaWarpVinesBossUltimatesAndDarkTrueEnd();
testSoundRuntime();
console.log('Repair Hero smoke tests passed');
