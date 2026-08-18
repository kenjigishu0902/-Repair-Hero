(() => {
  'use strict';

  // The repository currently ships no MP3 files. Default to the built-in Web Audio
  // score so GitHub Pages never produces four avoidable 404 requests. Real tracks
  // can still be supplied before this script through window.REPAIR_HERO_TRACKS.
  const TRACK_URLS = window.REPAIR_HERO_TRACKS || {};
  const TRACK_VOLUME = .46;
  const tracks = Object.fromEntries(Object.entries(TRACK_URLS).map(([name, url]) => {
    const audio = new Audio();
    audio.src = url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = TRACK_VOLUME;
    return [name, audio];
  }));
  let context;
  let currentName = null;
  let synthTimer = 0;
  let synthStep = 0;
  let fadeTimer = 0;
  let musicToken = 0;

  const tones = {
    start: [330, 440, .18], jump: [470, 650, .11], doubleJump: [620, 1040, .2], dash: [180, 480, .08],
    coin: [930, 1250, .08], battery: [420, 720, .18], screen: [700, 1080, .2], toolbox: [210, 620, .22],
    fenicoin: [880, 1500, .3], fire: [340, 980, .3], stomp: [190, 130, .12], damage: [120, 70, .25],
    checkpoint: [620, 880, .25], goal: [520, 980, .32], clear: [760, 1250, .5], gameover: [170, 65, .6],
    transformItem: [280, 920, .18], batteryMode: [330, 740, .42], lcdMode: [1050, 480, .38],
    kingMode: [260, 1480, .65], muscleMode: [95, 1320, .62], transformEnd: [720, 240, .3], kingFlight: [520, 660, .12],
    heal: [660, 990, .18], kingHit: [240, 1180, .22], bossDown: [160, 1320, .8],
    swordGet:[440,1320,.35],sword:[820,260,.14],swordHit:[180,900,.18],punch:[130,70,.16],punchHit:[75,420,.3],bossShot:[620,120,.24],
    crumble:[240,85,.28], itemWarning:[760,980,.18], itemSpawn:[420,1180,.28], enemyDown:[170,520,.2],
    shieldBreak:[1480,260,.32], rushPunch:[95,1480,.42], wallWarning:[70,180,.48], wallImpact:[55,45,.55],
    attack:[980,190,.2],enemyAttack:[240,860,.19],enemyCharge:[180,520,.28],drop:[310,150,.1],charge:[180,560,.16],revive:[260,1320,.55],
    speedUp:[520,1320,.32],speedMax:[660,1760,.46],wingCharge:[260,780,.24],wingFire:[420,1560,.3],wingHit:[190,980,.22],bossWarning:[95,420,.52],bossMelee:[120,640,.26],
    ultimateCharge:[120,1180,.48],featherShot:[520,1380,.16],featherVolley:[240,1720,.3],allyJoin:[240,1040,.42],allyShot:[460,980,.13],
    teleportStrike:[1480,180,.22],omniRush:[70,1640,.58],kingClones:[260,1760,.62],clash:[1320,420,.16],
    ultimateVoice:[330,990,.28],armorHit:[135,460,.16],boostRail:[180,1240,.32],laserWarn:[920,180,.34],phaseGate:[260,1480,.38],bubbleJet:[420,980,.22]
  };

  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === 'suspended') context.resume();
  }

  function note(frequency, duration = .1, volume = .025, type = 'square') {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function startSynthMusic(name) {
    clearInterval(synthTimer);
    if (!name) return;
    const melodies = {
      title: [262, 330, 392, 523, 392, 330, 294, 392],
      game: [220, 330, 392, 440, 523, 659, 587, 440, 392, 294, 330, 494, 587, 659, 784, 659],
      boss: [110,147,165,123,110,196,165,123], boss2:[147,220,175,247,147,294,220,175],
      goal: [523,659,784,1047,988,784,659,880,1047,1319,1175,1047]
    };
    synthStep = 0;
    synthTimer = window.setInterval(() => {
      if (currentName !== name) return;
      const melody = melodies[name];
      note(melody[synthStep % melody.length], name==='goal' ? 0.24 : 0.16, name==='game' ? 0.028 : name==='goal' ? 0.034 : 0.018, 'triangle');
      if (synthStep % 2 === 0) note(name === 'game' ? [110,147,165,196][Math.floor(synthStep/2)%4] : name==='goal' ? [262,330,392,440][Math.floor(synthStep/2)%4] : 131, .2, name==='game' ? 0.022 : name==='goal' ? 0.018 : 0.012, 'sine');
      if(name==='game'&&synthStep%4===3)note(melody[(synthStep+4)%melody.length]*.5,.22,.013,'sawtooth');
      if(name==='goal'&&synthStep%3===2)note(melody[(synthStep+2)%melody.length]*2,.13,.012,'square');
      synthStep += 1;
    }, name === 'boss2' ? 120 : name === 'boss' ? 150 : name === 'game' ? 155 : name === 'goal' ? 190 : 260);
  }

  function stopMusicTimers() {
    clearInterval(synthTimer);
    clearInterval(fadeTimer);
    synthTimer = 0;
    fadeTimer = 0;
  }

  function startMusic(name) {
    currentName = name || null;
    if (!currentName) return;
    const track = tracks[currentName];
    if (!track) { startSynthMusic(currentName); return; }
    track.volume = TRACK_VOLUME;
    track.currentTime = 0;
    track.play().catch(() => startSynthMusic(currentName));
    track.addEventListener('error', () => { if (currentName === name) startSynthMusic(name); }, { once: true });
  }

  function music(name) {
    unlock();
    musicToken += 1;
    stopMusicTimers();
    Object.values(tracks).forEach((track) => { track.pause(); track.currentTime = 0; track.volume = TRACK_VOLUME; });
    startMusic(name);
  }

  function transition(name, fadeSeconds = .28) {
    unlock();
    const token = ++musicToken;
    const outgoing = currentName;
    const outgoingTrack = outgoing ? tracks[outgoing] : null;
    stopMusicTimers();
    if (!outgoing || outgoing === name || !outgoingTrack) {
      Object.values(tracks).forEach((track) => { track.pause(); track.currentTime = 0; track.volume = TRACK_VOLUME; });
      startMusic(name);
      return;
    }
    const steps = 8;
    let step = 0;
    fadeTimer = window.setInterval(() => {
      if (token !== musicToken) { clearInterval(fadeTimer); return; }
      step += 1;
      outgoingTrack.volume = TRACK_VOLUME * Math.max(0, 1 - step / steps);
      if (step < steps) return;
      clearInterval(fadeTimer); fadeTimer = 0; outgoingTrack.pause(); outgoingTrack.currentTime = 0; outgoingTrack.volume = TRACK_VOLUME;
      if (token === musicToken) startMusic(name);
    }, Math.max(18, fadeSeconds * 1000 / steps));
  }

  function play(name) {
    unlock();
    if (!context) return;
    const [from, to, duration] = tones[name] || [220, 280, .1];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === 'damage' || name === 'gameover' || name === 'attack' || name === 'omniRush' ? 'sawtooth' : name === 'doubleJump' || name === 'kingFlight' || name === 'revive' || name === 'kingClones' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    const volume = name === 'coin' ? .022 : ['speedUp','speedMax','wingFire','bossWarning','ultimateCharge','omniRush','kingClones','boostRail','phaseGate'].includes(name) ? .052 : name === 'doubleJump' ? .06 : name === 'clash' ? .03 : .035;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    if (name === 'kingMode') {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        window.setTimeout(() => note(frequency, .25, .045, 'triangle'), index * 90);
      });
    } else if (name === 'lcdMode') {
      window.setTimeout(() => note(1320, .12, .03, 'square'), 110);
    } else if (name === 'muscleMode') {
      [90, 130, 220, 440].forEach((frequency, index) => window.setTimeout(() => note(frequency, .22, .065, index < 2 ? 'sawtooth' : 'square'), index * 55));
    } else if (name === 'batteryMode') {
      window.setTimeout(() => note(880, .2, .035, 'sine'), 130);
    } else if (name === 'coin') {
      window.setTimeout(() => note(1560, .055, .014, 'sine'), 38);
    } else if (name === 'speedUp') {
      [659,880,1175].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.18,.038,'triangle'),index*62));
    } else if (name === 'speedMax') {
      [784,1047,1319,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.22,.045,'triangle'),index*55));
    } else if (name === 'wingFire') {
      [520,780,1170].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.18,.035,index===2?'sawtooth':'triangle'),index*35));
    } else if (name === 'ultimateCharge') {
      [196,330,523,784].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.038,index<2?'sawtooth':'triangle'),index*48));
    } else if (name === 'featherVolley') {
      [659,988,1319,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.12,.028,'triangle'),index*30));
    } else if (name === 'allyJoin') {
      [330,494,659,988].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.19,.032,'sine'),index*55));
    } else if (name === 'omniRush') {
      [75,110,220,440,880].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.045,index<3?'sawtooth':'square'),index*32));
    } else if (name === 'kingClones') {
      [523,784,1047,1568].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.28,.04,'triangle'),index*62));
    } else if (name === 'ultimateVoice') {
      [330,494,659,988].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.16,.031,'triangle'),index*48));
    } else if (name === 'boostRail') {
      [220,440,880,1320].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.14,.036,index<2?'sawtooth':'triangle'),index*38));
    } else if (name === 'phaseGate') {
      [330,660,990,1480].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.032,'sine'),index*46));
    }
  }

  window.RepairHeroSound = { play, music, transition, unlock, state:()=>({currentName,synthActive:!!synthTimer,fadeActive:!!fadeTimer}) };
  const beginTitleAudio = () => { unlock(); if (!currentName) music('title'); };
  document.addEventListener('pointerdown', beginTitleAudio, { once: true });
  document.addEventListener('touchstart', beginTitleAudio, { once: true, passive: true });
  document.addEventListener('keydown', beginTitleAudio, { once: true });
})();
