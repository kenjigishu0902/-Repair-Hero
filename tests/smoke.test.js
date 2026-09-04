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
    return new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
      get(target, key) { return key in target ? target[key] : () => {}; }
    });
  }
}

function createGame({ width = 1280, height = 720, touch = false } = {}) {
  const ids = [
    'game', 'title', 'result', 'hud', 'touch', 'pause', 'hearts', 'coins', 'score', 'timer', 'characterHud', 'characterName',
    'dashGauge', 'notice', 'noticeText', 'noticePortrait', 'ultimateCutin', 'ultimateCutinPortrait', 'ultimateCutinImage', 'ultimateCutinHeader', 'ultimateCutinMode', 'ultimateCutinName', 'ultimateCutinQuote',
    'modeHud', 'modeTimer', 'shieldCount', 'specialStatus', 'transformFlash', 'bossHud',
    'bossName', 'bossHp', 'bossSpecial', 'bossSpecialLabel', 'goalLock', 'attack', 'wingAttack', 'specialAttack', 'oxygenHud', 'oxygenGauge', 'start', 'retry', 'next', 'titleBack',
    'resultKicker', 'resultTitle', 'resultStats', 'resultFeni', 'controlsTutorial', 'tutorialOpen', 'tutorialClose',
    'darkHeartHud', 'darkHeartCount', 'darkHeartMax', 'irregularChoice', 'tryDarkFeni', 'darkFeniStart', 'characterSelect', 'selectFeni', 'selectDarkFeni',
    'storyDialogue', 'storySpeaker', 'storyLine', 'storyTap', 'storyCinematic', 'storyPortrait', 'storyCinematicSpeaker', 'storyCinematicMood', 'storyBanner', 'storyFx',
    'missionHud', 'missionStage', 'missionName', 'missionObjective', 'missionProgress', 'comboHud', 'comboRank', 'comboCount',
    'stageIntro', 'stageIntroKicker', 'stageIntroTitle', 'stageIntroObjective'
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
  context.visualViewport = { width, height, scale:1, addEventListener() {} };
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
  for (const file of ['feni.png', 'feni_battery.png', 'feni_lcd.png', 'feni_king.png', 'fenichan_gorimacho.png', 'fenichan_gorimacho_punch.png', 'feni_dash.png', 'feni_states_normal.png', 'feni_states_battery.png', 'feni_states_lcd.png', 'feni_states_king.png', 'feni_states_muscle.png', 'feni_motion_normal.png', 'feni_motion_battery.png', 'feni_motion_lcd.png', 'feni_motion_king.png', 'feni_motion_muscle.png', 'phoenix_sword.png', 'feni_sword_ready.png', 'feni_sword_swing.png', 'feni_sword_finish.png', 'enemy_phone_bot.png', 'enemy_tool_mech.png', 'enemy_battery_bot.png', 'enemy_board_trooper.png', 'enemy_mecha_shark.png', 'enemy_battle_drone.png', 'boss_mega_bug_titan.png', 'boss_mecha_gorilla.png', 'enemy_mecha_monkey.png', 'assets/cutins/boss_titan_overload.webp', 'assets/cutins/boss_shark_tsunami.webp', 'assets/cutins/boss_gorilla_cataclysm.webp', 'assets/cutins/dark_feni_chaos.webp', 'assets/cutins/dark_feni_leak.webp', 'assets/cutins/dark_feni_lcd.webp', 'assets/cutins/dark_feni_muscle.webp', 'assets/cutins/dark_feni_board.webp', 'assets/dark-feni/dark_feni_master_sheet.webp', 'assets/dark-feni/dark_feni_portraits.webp', 'assets/dark-feni/dark_feni_sword.webp', 'assets/dark-feni/dark_feni_mode_sheet.webp', 'assets/dark-feni/dark_feni_idle_sheet.webp', 'assets/dark-feni/dark_feni_playable_icon.webp']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
    assert.ok(fs.statSync(path.join(root, file)).size > 1000, `${file} is a real image asset`);
  }
  const html = fs.readFileSync(path.join(root, 'legacy.html'), 'utf8');
  assert.match(html, /data-input="wing"/, 'mobile UI exposes the Phoenix Wing attack button');
  assert.match(html, /data-input="special"/, 'mobile UI exposes the mode-specific ultimate button');
  assert.match(html, /id="ultimateCutin"[\s\S]+id="ultimateCutinPortrait"[\s\S]+id="ultimateCutinImage"[\s\S]+id="ultimateCutinQuote"/, 'ultimate presentation has generated boss art and live full-screen dialogue surfaces');
  assert.match(html, /cutin-slash-a[\s\S]+LIMIT BREAK \/\/ PHOENIX DRIVE[\s\S]+EXECUTE/, 'ultimate cut-in includes the fast slash and limit-break presentation layers');
  assert.match(html, /title-enemy-left[\s\S]+enemy_phone_bot\.png[\s\S]+title-enemy-right[\s\S]+enemy_battle_drone\.png/, 'title screen uses the restored mech cast as its visual threat');
  assert.match(html, /id="controlsTutorial"[\s\S]+スマホ[\s\S]+PC[\s\S]+敵弾は剣・翼・パンチで相殺/, 'title includes a visual smartphone and PC tutorial');
  assert.match(html, /id="darkFeniStart"[\s\S]+DARK FENI BATTLE[\s\S]+FULL STORY EVENT/, 'title provides a replayable entrance to the complete Dark Feni route');
  assert.match(html, /id="characterSelect"[\s\S]+id="selectFeni"[\s\S]+id="selectDarkFeni"[\s\S]+dark_feni_playable_icon\.webp/, 'title exposes Feni and the dedicated playable Dark Feni as separate characters');
  assert.match(html, /id="irregularChoice"[\s\S]+IRREGULAR[\s\S]+id="tryDarkFeni"[\s\S]+Try…？/, 'IRREGULAR presents the intentionally unnamed Try…？ choice');
  const irregularMarkup=html.match(/<section id="irregularChoice"[\s\S]*?<\/section>/)?.[0]||'';assert.equal((irregularMarkup.match(/<button/g)||[]).length,1,'IRREGULAR contains exactly one selectable route');assert.doesNotMatch(irregularMarkup,/dark feni/i,'the IRREGULAR choice does not reveal Dark Feni by name');
  assert.match(html, /id="darkHeartHud"[\s\S]+REVIVE STOCK[\s\S]+id="darkHeartCount"[\s\S]+\/ 15[\s\S]+id="storyCinematic"[\s\S]+id="storyPortrait"[\s\S]+id="storyDialogue"[\s\S]+id="storyTap"/, 'the final route exposes responsive revival-stock, face close-up, and tap-dialogue surfaces');
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
  assert.match(gameSource, /dark_feni_master_sheet\.webp[\s\S]+dark_feni_portraits\.webp[\s\S]+dark_feni_sword\.webp[\s\S]+dark_feni_mode_sheet\.webp[\s\S]+dark_feni_idle_sheet\.webp[\s\S]+dark_feni_playable_icon\.webp/, 'gameplay, dialogue, strengthened modes, living idle poses, playable UI, and weapon rendering share the dedicated Dark Feni design');
  const darkRenderer=gameSource.match(/function drawDarkFeniAvatar[\s\S]*?function drawDarkFeniCinematicPortrait/)?.[0]||'';assert.doesNotMatch(darkRenderer,/playerMotionSheets|playerImages|DARK_MODE_SPRITES/,'Dark Feni never falls back to a recoloured normal Feni sprite');assert.match(darkRenderer,/DARK_FENI_POSE_INDEX\.dissolve[\s\S]+consume/,'the master renderer supports bottom-up particle dissolution rather than opacity-only removal');
  assert.match(gameSource, /function drawDarkFeniModeSprite[\s\S]+darkFeniModeImage[\s\S]+function drawDarkPlayable[\s\S]+modeSheet:true/, 'generated four-pose mode art is used directly by the playable character renderer');
  assert.match(gameSource, /DARK_IDLE_ROW=Object\.freeze\(\{look:0,footStep:1,armsCross:2,preen:3,swordAdjust:4\}\)[\s\S]+function updateDarkPlayableIdleMotion[\s\S]+function updateDarkBossIdle[\s\S]+function drawDarkFeniIdleSprite/, 'Dark Feni owns five synchronized, randomized idle poses for both playable and boss implementations');
  assert.match(gameSource, /filter\(\(action\)=>action!==actor\.idleLastAction\)/, 'the random idle selector excludes the immediately previous special pose');
  assert.match(gameSource, /const eligible=boss\.grounded&&distance>540[\s\S]+distance>760[\s\S]+distance>830/, 'long boss idles are restricted to safe distance and cooldown windows');
  assert.match(gameSource, /const embeddedSword=useCombatSheet[\s\S]+!embeddedSword[\s\S]+drawDarkFeniSword/, 'the combat sheet keeps the hand-wrapped sword grip intact instead of drawing a floating duplicate');
  for(const storyState of ['INTRO','HEART_AREA','PRE_BATTLE_DIALOGUE','BATTLE_INTRO','BATTLE','BOSS_DEFEAT_TRANSITION','BOSS_DEFEATED','POST_BATTLE_DIALOGUE','COLLAPSE_CUTSCENE','ESCAPE','ENDING','COMPLETE'])assert.ok(gameSource.includes(`${storyState}:'${storyState}'`),`Dark Feni story owns the explicit ${storyState} state`);
  for(const line of ['ここまで来たか…','お前は…まさか…','終わりの始まりを告げようか…','…強くなったな…','なんでこんな事ｯ！！','これが俺の選択さ…','他にもやりようはあったはずだ！！','お前にも、時期が来れば分かるさ…','Beyond Light and Darkness…'])assert.ok(gameSource.includes(line),`story contains the required line: ${line}`);
  for(const attack of ['darkHighSpeedSlash','darkSlashWave','darkFlameRift','darkDive','darkRush'])assert.ok(gameSource.includes(attack),`Dark Feni implements ${attack}`);
  for(const landmark of ['通 天 閣','道 頓 堀','大阪城','あべのハルカス','梅田スカイビル','岸和田だんじり'])assert.ok(gameSource.includes(landmark),`Osaka renderer contains the recognizable ${landmark} landmark`);
  assert.match(css, /@keyframes cutinSlash[\s\S]+@keyframes cutinFlash/, 'cut-in uses fast diagonal impact and flash animation');
  assert.match(css, /titleReactorSpin[\s\S]+titleScan/, 'title screen includes the animated repair reactor and scan layer');
  assert.match(css, /body\.touch-device\.boss-phase2 #game\{filter:none\}/, 'touch devices avoid the full-canvas boss filter');
  assert.match(css, /env\(safe-area-inset-top\)[\s\S]+env\(safe-area-inset-bottom\)/, 'story UI respects notches, Dynamic Island, and the home indicator');
  assert.match(css, /character-select[\s\S]+character-card\.dark[\s\S]+dark-battle-wide[\s\S]+@media\(orientation:landscape\) and \(max-height:620px\)/, 'playable selection and wide-battle UI include phone portrait and short-landscape adaptations');
  assert.match(html, /NEO 2\.5D ACTION · BUILD 09\.04-F[\s\S]+game\.js\?v=20260904f/, 'the visible build badge and cache-busted game script identify the modernized 2.5D build');
  assert.match(html, /id="missionHud"[\s\S]+id="missionProgress"[\s\S]+id="comboHud"[\s\S]+id="comboRank"[\s\S]+id="stageIntro"/, 'modern mission, progress, combat-flow, and stage-intro surfaces are present');
  assert.match(gameSource, /function stageObjective[\s\S]+function registerCombatHit[\s\S]+function drawActorShadow[\s\S]+function drawNeoAtmosphere/, 'the modern presentation layer is backed by live objective, combo, grounding, and atmosphere systems');
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

function testPlayableDarkFeni(){
  const game=createGame({width:390,height:844,touch:true});
  assert.equal(game.selectCharacter('darkFeni'),true,'title selection accepts Dark Feni as a separate playable character');
  game.setStage('1-1');let state=game.state();
  assert.equal(state.selectedCharacter,'darkFeni');assert.equal(state.activeCharacter,'darkFeni');assert.equal(state.player.character,'darkFeni','normal stages spawn the dedicated Dark Feni player');
  assert.equal(state.player.hasSword,true,'playable Dark Feni permanently carries the Dark Feni sword');
  assert.equal(state.render.assetRequests.darkFeni.modeSheet,true,'playable selection preloads the generated twenty-frame mode sheet');
  assert.equal(state.render.assetRequests.darkFeni.idleSheet,true,'playable selection preloads the generated twenty-five-frame living idle sheet');
  assert.equal(state.render.assetRequests.darkFeni.playableIcon,true,'playable selection preloads its dedicated UI portrait');

  const idleExpressions={look:'guarded',footStep:'irritated',armsCross:'confident',preen:'bored',swordAdjust:'threatening'};
  for(const [action,expression] of Object.entries(idleExpressions)){
    assert.equal(game.forceIdle(action),action,`${action} can be selected as a playable Dark Feni idle`);state=game.state();
    assert.equal(state.player.idleExpression,expression,`${action} uses its synchronized ${expression} expression`);game.draw();
  }
  game.forceIdle('armsCross');assert.notEqual(game.nextDarkIdle(),'armsCross','the same special idle cannot repeat immediately');
  game.forceIdle('armsCross');game.setInput('right',true);game.step(.03);game.setInput('right',false);state=game.state();
  assert.equal(state.player.idleAction,null,'movement cancels crossed arms on the first input frame');assert.equal(state.player.idleExitAction,'armsCross','the cancelled pose keeps only a brief visual cross-fade');assert.ok(state.player.vx>0,'idle cancellation never blocks movement control');

  game.setStage('1-1');state=game.state();assert.equal(state.player.maxJumps,3,'playable Dark Feni keeps the requested three-stage jump');
  for(let jump=0;jump<4;jump++){game.setInput('jump',true);game.step(.03);game.setInput('jump',false);game.step(.03);}
  assert.equal(game.state().player.jumpCount,3,'a fourth airborne jump is rejected after Dark Feni triple-jumps');

  game.setStage('1-1');game.draw();game.attack();state=game.state();assert.equal(state.player.darkComboStep,1,'the first sword input starts Dark Feni three-hit combo');assert.ok(state.player.attackTime>0,'playable Dark Feni can perform the dedicated sword attack');assert.ok(state.shockwaveKinds.includes('darkPlayerSlash'),'the sword emits its bounded purple-red Dark Feni slash trail');
  game.step(.25);game.attack();assert.equal(game.state().player.darkComboStep,2,'the second timed input advances the sword combo');
  game.step(.25);game.attack();assert.equal(game.state().player.darkComboStep,3,'the third timed input reaches the heavy combo finisher');
  game.step(.58);game.wingAttack();game.step(.3);state=game.state();assert.ok(state.wingProjectiles.some((shot)=>shot.kind==='darkPlayerFeather'),'playable Dark Feni fires the dedicated black-wing projectile');
  game.step(1);assert.equal(game.ultimate(),true,'playable Dark Feni can activate a dedicated ultimate');state=game.state();assert.equal(state.cutinVisible,true);assert.match(state.cutinImageSource,/assets\/cutins\/dark_feni_chaos\.webp/,'playable ultimate uses the canonical Dark Feni cut-in rather than normal Feni art');
  const ultimateKinds=new Set();for(let frame=0;frame<55;frame++){game.step(.05);game.state().wingProjectiles.forEach((shot)=>ultimateKinds.add(shot.kind));}
  assert.ok(ultimateKinds.has('darkPlayerFeather'),'playable normal-form ultimate releases a sustained chaos-feather volley');
  game.setMode('battery');state=game.state();assert.equal(state.player.darkMode,'leak','battery pickup visibly changes playable Dark Feni into the matching leak form');assert.ok(state.player.darkTransformTimer>=1,'playable mode change owns a visible transformation interval');assert.equal(state.player.hasSword,true,'mode changes keep the sword visibly attached to Dark Feni');
  for(const darkMode of ['battery','lcd','muscle','king']){game.setStage('1-1');game.setMode(darkMode);game.forceIdle('preen');state=game.state();assert.equal(state.player.idleAction,'preen',`${darkMode} form retains the living idle system`);game.draw();}
  game.setStage('1-1');game.respawn();assert.ok(game.state().notice.includes('何度でも…蘇るさ…'),'playable Dark Feni keeps her dedicated respawn line');
  game.setStage('1-1');state=game.state();game.teleport(state.goal.x+2,480);game.step(.04);assert.ok(game.state().notice.includes('俺の選択の邪魔をするな…'),'playable Dark Feni keeps her dedicated goal line');
  for(const expression of ['shock','alert','sadness','anguish','anger','resolve','quietAcceptance'])assert.ok(state.feniStoryExpressions.includes(expression),`story portraits expose Feni's ${expression} expression`);

  game.setStage('3-1');state=game.state();assert.equal(state.selectedCharacter,'darkFeni','the selected playable remains unlocked for later normal-stage replays');assert.equal(state.activeCharacter,'feni','the authored Dark Feni story safely forces its Feni protagonist');assert.equal(state.player.character,'feni','the boss route never spawns Dark Feni against herself');
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
  assert.equal(state.boss.hp,30,'Dark Feni starts with a substantially reinforced thirty-unit life bar');
  assert.equal(state.boss.maxHp,30,'Dark Feni maximum HP supports a durable three-phase fight');
  assert.equal(state.breakablesAlive,0,'the Dark Feni course removes the box obstacles that obscure the duel');
  assert.equal(state.finale.state,'INTRO','final route starts at the locked IRREGULAR choice');
  assert.equal(state.finale.heartMax,15,'the dedicated revival stock is capped at fifteen hearts');
  assert.deepEqual(new Set(state.transformTypes),new Set(['battery','lcd','muscle','king']),'all four transformations are available during the final route');
  assert.equal(game.tryDarkRoute(),true,'IRREGULAR exposes the single Try…？ route');state=game.state();assert.equal(state.finale.state,'HEART_AREA','Try…？ begins the quiet exploration area');
  assert.equal(game.collectDarkHearts(15),15,'all fifteen flaming hearts can be collected');state=game.state();assert.equal(state.finale.heartStock,15);assert.equal(state.finale.heartsRemaining,0);

  game.teleport(state.boss.gateX+180,470);game.beginBoss();state=game.state();
  assert.equal(state.finale.state,'PRE_BATTLE_DIALOGUE','approaching Dark Feni freezes combat and starts the tap dialogue');
  assert.equal(state.finale.dialogueLine,'ここまで来たか…');assert.equal(state.finale.locked,true,'attacks remain locked during dialogue');assert.equal(state.finale.cinematicVisible,true,'important dialogue opens on a face-filling cinematic portrait');assert.equal(state.finale.currentPortrait.speaker,'ダークフェニ');
  for(const expected of ['お前は…まさか…','終わりの始まりを告げようか…']){game.step(.2);assert.equal(game.advanceStory(),true);assert.equal(game.state().finale.dialogueLine,expected);}
  game.step(.2);game.advanceStory();assert.equal(game.state().finale.state,'BATTLE_INTRO','the last line starts the hair-and-sword battle introduction');
  game.step(5.05);state=game.state();assert.equal(state.finale.intro.swordSummoned,true,'Dark Feni summons the dedicated sword');assert.equal(state.finale.intro.swordPointing,true,'Dark Feni points the sword at Feni after exposing the scar');assert.ok(state.finale.intro.scarReveal>=1&&state.finale.intro.eyeGlow>=1,'the injured eye is fully revealed and glowing');
  game.step(2.5);state=game.state();assert.equal(state.finale.state,'BATTLE','BATTLE START restores player control');assert.equal(state.boss.active,true);assert.equal(state.finale.cameraMode,'combatWide','the duel switches to its dedicated two-fighter wide camera');assert.ok(state.world.viewportWidth>=1000,'portrait combat camera exposes enough horizontal arena space to read both fighters and telegraphs');
  assert.equal(state.render.assetRequests.darkFeni.modeSheet,true,'the generated mode sheet is loaded for the live boss');assert.equal(state.render.assetRequests.darkFeni.idleSheet,true,'the living idle sheet is loaded for the live boss');assert.equal(state.render.assetRequests.darkFeni.playableIcon,true,'the dedicated Dark Feni UI icon is loaded with the character package');
  assert.equal(game.forceBossIdle('armsCross'),'armsCross','the boss can use crossed arms inside an explicit safe combat window');state=game.state();assert.equal(state.boss.idleExpression,'confident');game.draw();
  assert.equal(game.forceDarkAttack('darkSlashWave'),'darkSlashWave','boss action selection remains available from a special idle');assert.equal(game.state().boss.idleAction,null,'an attack immediately cancels the boss special idle');game.step(1.5);
  assert.equal(game.forceBossIdle('preen'),'preen','the boss can use the restrained preening pose during an allowed lull');assert.equal(game.state().boss.idleExpression,'bored');game.draw();

  for(let hit=0;hit<7;hit++)game.hit();state=game.state();assert.equal(state.finale.heartStock,14,'HP zero consumes exactly one revival heart');assert.equal(state.finale.revive.active,true,'the heart shatter and flame revival sequence starts');
  game.hit();assert.equal(game.state().finale.heartStock,14,'revival lock prevents a multi-hit from consuming more hearts');
  game.step(2);state=game.state();assert.equal(state.player.hp,7,'revival restores Feni to battle health');assert.ok(state.player.invincible>0,'revival grants a meaningful invincibility window');

  for(const attackName of ['darkHighSpeedSlash','darkSlashWave','darkFlameRift','darkDive','darkRush']){assert.equal(game.forceDarkAttack(attackName),attackName,`${attackName} is available to the distance-aware boss AI`);assert.equal(game.state().boss.state,'telegraph',`${attackName} begins with a readable warning`);game.step(1.5);}
  for(let hit=0;hit<6;hit++)assert.equal(game.hitBoss(99),true,`reinforced Dark Feni accepts capped hit ${hit+1}`);
  state=game.state();assert.ok(state.boss.hp>=23&&state.boss.hp<=23.2,'oversized burst damage is capped instead of melting the thirty-unit boss bar');assert.equal(state.boss.darkMode,'leak','crossing eighty percent HP visibly transforms Dark Feni');assert.equal(state.boss.state,'darkTransform','mode changes own a locked transformation state');assert.ok(state.boss.modeTransitionTimer>0,'the strengthened appearance remains on screen long enough to read');assert.equal(state.boss.darkModeDwell,18,'each mode has an extended combat dwell instead of immediately rotating away');
  for(let frame=0;frame<6;frame++)game.step(.3);
  game.forceDarkAttack('darkSlashWave');const leakHp=game.state().boss.hp;assert.equal(game.hitBoss(99),true,'leak form resumes combat after its transformation presentation');state=game.state();assert.ok(leakHp-state.boss.hp>=.6&&leakHp-state.boss.hp<.7,'leak mode further reduces oversized damage instead of losing a full health segment');game.step(.35);

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

  game.defeatBoss();state=game.state();assert.equal(state.finale.state,'BOSS_DEFEAT_TRANSITION','HP zero enters the isolated defeat transition instead of deleting Dark Feni');assert.equal(state.boss.alive,true);assert.equal(state.boss.state,'defeatHit');assert.equal(state.boss.darkMode,'normal','HP zero forcibly returns every strengthened form to the same base Dark Feni design');assert.equal(state.boss.defeatSequenceStarted,true);assert.equal(state.bossProjectileKinds.length,0,'all boss hitboxes are cleared at defeat');
  game.step(.65);state=game.state();assert.equal(state.finale.cinematicVisible,true,'the last hit forces the wounded Dark Feni face close-up');assert.equal(state.finale.currentPortrait.portrait,'defeat');assert.equal(state.finale.locked,true,'player and AI remain locked throughout the defeat cut-in');
  game.step(4.2);state=game.state();assert.equal(state.finale.state,'BOSS_DEFEATED');assert.equal(state.boss.state,'kneel','stumble and sword support resolve into the dedicated kneeling pose');
  game.step(1.2);state=game.state();assert.equal(state.finale.state,'POST_BATTLE_DIALOGUE');assert.equal(state.finale.cinematicVisible,true,'post-battle dialogue returns to expression-specific close-ups');
  for(const expected of ['…強くなったな…','なんでこんな事ｯ！！','これが俺の選択さ…','他にもやりようはあったはずだ！！','お前にも、時期が来れば分かるさ…']){assert.equal(game.state().finale.dialogueLine,expected);game.step(.2);game.advanceStory();}
  state=game.state();assert.equal(state.finale.state,'COLLAPSE_CUTSCENE','the last line is followed by silence and the staged collapse');
  game.step(7.4);state=game.state();assert.equal(state.finale.collapse.bossGone,true,'darkness rises gradually and consumes Dark Feni');assert.equal(state.finale.state,'COLLAPSE_CUTSCENE','the disappearance retains a silent beat before escape');
  game.step(2.2);state=game.state();assert.equal(state.finale.state,'ESCAPE','the collapse becomes a playable escape');assert.equal(state.finale.escape.active,true);
  game.teleport(state.finale.escape.goalX-410,320);game.setVelocity(340,-280);game.step(.08);assert.equal(game.state().finale.escape.lastJump,true,'the final airborne gap triggers the last-jump climax');
  game.teleport(game.state().finale.escape.goalX,470);game.step(.08);assert.equal(game.state().finale.state,'ENDING','landing in the safe area begins the quiet ending instead of STAGE CLEAR');
  game.draw();game.step(13.2);assert.equal(game.state().mode,'title','Beyond Light and Darkness… fades out before returning to title');
  assert.equal(game.startDarkRoute(),true,'the title entrance remains replayable');assert.equal(game.state().finale.state,'INTRO','a replay starts the complete event from IRREGULAR again');

  const enterFinalBattle=(instance)=>{instance.setStage('3-1');instance.tryDarkRoute();let entry=instance.state();instance.teleport(entry.boss.gateX+180,470);instance.beginBoss();for(let line=0;line<3;line++){instance.step(.2);instance.advanceStory();}instance.step(7.5);assert.equal(instance.state().finale.state,'BATTLE');};
  const normalDefeat=createGame();enterFinalBattle(normalDefeat);normalDefeat.defeatBoss();let defeatState=normalDefeat.state();assert.equal(defeatState.finale.defeat.previousMode,'normal','case A records a normal-form defeat');normalDefeat.step(5.9);assert.equal(normalDefeat.state().finale.state,'POST_BATTLE_DIALOGUE','case A reaches cut-in, kneel, and dialogue in order');

  const transformedDefeat=createGame();enterFinalBattle(transformedDefeat);assert.equal(transformedDefeat.forceBossSpecial('darkMuscle'),'earthRend');defeatState=transformedDefeat.state();assert.equal(defeatState.boss.state,'cutin');transformedDefeat.defeatBoss();defeatState=transformedDefeat.state();assert.equal(defeatState.finale.defeat.previousMode,'darkMuscle','case B remembers the strengthened form that was defeated');assert.equal(defeatState.finale.defeat.specialCancelled,true,'cases B/C cancel a transformation or ultimate already in progress');assert.equal(defeatState.boss.darkMode,'normal','case B forces the canonical base Dark Feni before the defeat cut-in');assert.equal(defeatState.boss.attackName,null,'case C removes the interrupted ultimate from combat state');assert.equal(defeatState.cutinVisible,false,'case C closes the combat ultimate layer before the forced defeat portrait');

  const projectileDefeat=createGame();enterFinalBattle(projectileDefeat);projectileDefeat.forceBossSpecial('normal');for(let frame=0;frame<45&&projectileDefeat.state().bossProjectileKinds.length===0;frame++)projectileDefeat.step(.1);assert.ok(projectileDefeat.state().bossProjectileKinds.length>0,'case D creates live boss projectiles immediately before HP zero');projectileDefeat.defeatBoss();assert.equal(projectileDefeat.state().bossProjectileKinds.length,0,'case D clears every projectile before post-battle control lock');

  const dialogueLock=createGame();dialogueLock.setStage('3-1');dialogueLock.tryDarkRoute();let lockState=dialogueLock.state();dialogueLock.teleport(lockState.boss.gateX+180,470);dialogueLock.beginBoss();lockState=dialogueLock.state();const lockedHp=lockState.boss.hp;dialogueLock.attack();dialogueLock.wingAttack();dialogueLock.ultimate();dialogueLock.step(.25);lockState=dialogueLock.state();assert.equal(lockState.boss.hp,lockedHp,'case E ignores every player attack input during the face cut-in');assert.equal(lockState.boss.active,false,'case E keeps boss AI stopped while dialogue is on screen');assert.equal(lockState.finale.locked,true);

  const retryGame=createGame();retryGame.setStage('3-1');retryGame.tryDarkRoute();let retryState=retryGame.state();retryGame.teleport(retryState.boss.gateX+180,470);retryGame.beginBoss();for(let line=0;line<3;line++){retryGame.step(.2);retryGame.advanceStory();}retryGame.step(7.5);
  for(let hit=0;hit<7;hit++)retryGame.hit();retryState=retryGame.state();assert.equal(retryState.finale.retry.active,true,'zero revival stock enters the isolated Dark Feni battle retry');retryGame.step(1.4);retryState=retryGame.state();assert.equal(retryState.finale.state,'BATTLE');assert.equal(retryState.player.hp,7);assert.equal(retryState.boss.hp,30,'retry restores the complete reinforced duel without touching normal story progress');
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

function testMobileTapDoesNotZoomViewport() {
  const game = createGame({ width:390, height:760, touch:true });
  game.start();
  const initial = game.state().world;
  game.resizeViewport(390,844,1,false);
  let current = game.state().world;
  assert.equal(current.baseScale,initial.baseScale,'mobile browser chrome height change does not alter camera zoom');
  assert.equal(current.viewportHeight,initial.viewportHeight,'plain tap keeps the gameplay viewport height stable');
  game.resizeViewport(330,650,1.18,false);
  current = game.state().world;
  assert.equal(current.baseScale,initial.baseScale,'gesture viewport changes are ignored');
  game.resizeViewport(844,390,1,true);
  current = game.state().world;
  assert.equal(current.portrait,false,'a real orientation change still rebuilds the viewport');
  assert.notEqual(current.baseScale,initial.baseScale,'orientation rebuild recalculates the camera scale');
}

function testNeo3dEditionSurface() {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'neo3d.css'),'utf8');
  const source=fs.readFileSync(path.join(root,'neo3d.js'),'utf8');
  assert.match(html,/Repair Hero NEO[\s\S]+REAL-TIME ACTION[\s\S]+11 MISSIONS[\s\S]+5 FORMS/,'public entry is the new NEO action edition');
  assert.match(css,/repair_hero_key_visual\.webp/,'new cinematic key art is integrated into the title presentation');
  assert.match(html,/DUAL RENDERER · BUILD 09\.04-I/,'the visible dual-renderer build identifier is present');
  assert.match(html,/id="compatCanvas"[\s\S]+MOBILE RENDERER · 09\.04-I/,'iPad and phones have a dedicated visible renderer instead of a blank WebGL canvas');
  assert.match(html,/href="legacy\.html"/,'complete original edition remains available without losing prior work');
  assert.match(html,/data-key="dodge"[\s\S]+data-key="attack"[\s\S]+data-key="jump"[\s\S]+data-key="special"/,'3D mobile controls expose dodge, attack, jump, and burst');
  assert.match(source,/getContext\('webgl'/,'NEO edition uses native real-time WebGL rather than a flat CSS mockup');
  assert.match(source,/matchMedia\('\(pointer:coarse\)'\)[\s\S]+!rawGl[\s\S]+renderer'\)==='mobile'/,'touch and WebGL-incompatible devices can force the mobile-safe renderer');
  assert.match(source,/function renderCompat[\s\S]+compatMode\|\|!webglReady/,'the render loop switches to the compatibility scene before issuing WebGL draws');
  assert.match(source,/renderer:compatMode\?'mobile':'webgl'/,'debug state reports the active renderer');
  for(const feature of ['compatProject','compatMech','compatPhoenix'])assert.ok(source.includes(`function ${feature}`),`mobile renderer includes ${feature}`);
  assert.match(source,/precision mediump float;attribute[\s\S]+varying mediump vec3 N,V[\s\S]+precision mediump float;varying mediump vec3 N,V/,'both shaders use matching precision on strict iPad Safari WebGL implementations');
  assert.match(source,/getProgramParameter\(program,gl\.LINK_STATUS\)[\s\S]+2D完成版を開く/,'shader-link failure shows a playable fallback instead of a black screen');
  assert.match(source,/type==='sphere'\)idx\.push\(a,a\+1,b,b,a\+1,b\+1\)/,'sphere triangles use outward-facing winding and remain visible with face culling');
  assert.match(source,/const STAGES=\[[\s\S]+DARK FENI-CHAN/,'all eleven missions culminate in the Dark Feni route');
  assert.match(source,/Correct forward F:[^\n]+cracked version[\s\S]+if\(dark\)/,'3D Feni uses a forward F and Dark Feni owns the scarred emblem variant');
  for(const feature of ['function attack','function special','function damage','function drawPhoenix','function drawMech','function drawWorld','function darkIntro'])assert.ok(source.includes(feature),`NEO runtime includes ${feature}`);
  assert.match(css,/safe-area-inset-bottom[\s\S]+@media\(pointer:fine\)/,'new 3D UI handles phone safe areas and desktop input');
  assert.match(html,/assets\/neo3d\/feni_card\.webp[\s\S]+正位置のF胸章[\s\S]+assets\/neo3d\/dark_feni_card\.webp[\s\S]+傷入りF胸章/,'corrected F emblems are also used by both playable-select cards');
  for(const file of ['legacy.html','neo3d.js','neo3d.css','assets/neo3d/repair_hero_key_visual.webp','assets/neo3d/feni_card.webp','assets/neo3d/dark_feni_card.webp'])assert.ok(fs.existsSync(path.join(root,file)),`${file} exists`);
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
  for(const track of ['cityRush','pitRun','underground','sky','fortress','maze','sea','factory','deepSea','jungle','bonus','darkApproach','darkHorror','darkCollapse','darkEscape','bossTitan','bossTitan2','bossShark','bossShark2','bossGorilla','bossGorilla2','darkFeni','darkFeni2','darkEnding','ending'])context.RepairHeroSound.music(track);
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
  for(const effect of ['warpOpen','warpEnter','warpExit','vineGrab','vineJump','bossUltimate','bossCutin','darkBossCutin','bossUltimateImpact','darkTransform','darkFeather','darkClones','electricField','earthRend','irregular','blackout','darkReveal','darkIntroVoice','chaosHunt','darkDefeatVoice','darkVanish','defeatFreeze','defeatCutin','transformBreak','kneelImpact','staminaCola','colaSpawn','dialogueTap','heartGet','heartMax','heartBreak','heartRevive','windRise','swordSummon','swordPoint','battleStart','rumble','darkSlashWave','swordGround','darkFlameRift','rushStart','dive','darkJump','darkConsume','escapeStart','lastJump','finalCollapse','endingChime'])context.RepairHeroSound.play(effect);
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
testMobileTapDoesNotZoomViewport();
testNeo3dEditionSurface();
testAssetsAndSyntaxSurface();
testLazyAssetLoadingAndMechaEnemies();
testJungleRaidBossGuardMusicAndSwordTracking();
testPlayableDarkFeni();
testOsakaWarpVinesBossUltimatesAndDarkTrueEnd();
testSoundRuntime();
console.log('Repair Hero smoke tests passed');
