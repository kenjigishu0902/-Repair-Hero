(() => {
  'use strict';

  // The repository currently ships no MP3 files. Default to the built-in Web Audio
  // score so GitHub Pages never produces four avoidable 404 requests. Real tracks
  // can still be supplied before this script through window.REPAIR_HERO_TRACKS.
  const TRACK_URLS = window.REPAIR_HERO_TRACKS || {};
  const tracks = Object.fromEntries(Object.entries(TRACK_URLS).map(([name, url]) => {
    const audio = new Audio();
    audio.src = url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = .46;
    return [name, audio];
  }));
  let context;
  let currentName = null;
  let synthTimer = 0;
  let synthStep = 0;

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
    attack:[980,190,.2],enemyAttack:[240,860,.19],drop:[310,150,.1],charge:[180,560,.16],revive:[260,1320,.55]
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
      boss: [110,147,165,123,110,196,165,123], boss2:[147,220,175,247,147,294,220,175]
    };
    synthStep = 0;
    synthTimer = window.setInterval(() => {
      if (currentName !== name) return;
      const melody = melodies[name];
      note(melody[synthStep % melody.length], .16, name==='game'?.028:.018, 'triangle');
      if (synthStep % 2 === 0) note(name === 'game' ? [110,147,165,196][Math.floor(synthStep/2)%4] : 131, .2, name==='game'?.022:.012, 'sine');
      if(name==='game'&&synthStep%4===3)note(melody[(synthStep+4)%melody.length]*.5,.22,.013,'sawtooth');
      synthStep += 1;
    }, name === 'boss2' ? 120 : name === 'boss' ? 150 : name === 'game' ? 155 : 260);
  }

  function music(name) {
    unlock();
    clearInterval(synthTimer);
    Object.values(tracks).forEach((track) => { track.pause(); track.currentTime = 0; });
    currentName = name || null;
    if (!currentName) return;
    const track = tracks[currentName];
    if (!track) { startSynthMusic(currentName); return; }
    track.currentTime = 0;
    track.play().catch(() => startSynthMusic(currentName));
    track.addEventListener('error', () => { if (currentName === name) startSynthMusic(name); }, { once: true });
  }

  function play(name) {
    unlock();
    if (!context) return;
    const [from, to, duration] = tones[name] || [220, 280, .1];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === 'damage' || name === 'gameover' || name === 'attack' ? 'sawtooth' : name === 'doubleJump' || name === 'kingFlight' || name === 'revive' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    gain.gain.setValueAtTime(name === 'doubleJump' ? .06 : .035, context.currentTime);
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
    }
  }

  window.RepairHeroSound = { play, music, unlock };
  const beginTitleAudio = () => { unlock(); if (!currentName) music('title'); };
  document.addEventListener('pointerdown', beginTitleAudio, { once: true });
  document.addEventListener('touchstart', beginTitleAudio, { once: true, passive: true });
  document.addEventListener('keydown', beginTitleAudio, { once: true });
})();
