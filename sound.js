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
    start: [330, 440, .18], jump: [470, 650, .11], doubleJump: [620, 1040, .2], dash: [920, 175, .14],
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
    teleportStrike:[1480,180,.22],omniRush:[70,1640,.58],kingClones:[260,1760,.62],clash:[1320,420,.16],gorillaGuard:[92,46,.3],minionDown:[520,1320,.25],
    ultimateVoice:[330,990,.28],armorHit:[135,460,.16],boostRail:[180,1240,.32],laserWarn:[920,180,.34],phaseGate:[260,1480,.38],bubbleJet:[420,980,.22],
    warpOpen:[180,1320,.42],warpEnter:[260,1760,.46],warpExit:[1180,330,.38],vineGrab:[330,620,.18],vineJump:[420,980,.2],bossUltimate:[72,1480,.72],
    bossCutin:[66,1480,.5],darkBossCutin:[58,1760,.56],bossUltimateImpact:[52,720,.38],
    darkTransform:[130,1180,.48],darkFeather:[720,150,.22],darkClones:[110,1320,.58],electricField:[90,1760,.62],earthRend:[55,620,.58],
    irregular:[48,1480,.72],blackout:[95,42,.42],darkReveal:[130,880,.48],darkIntroVoice:[180,72,.52],chaosHunt:[80,1520,.68],darkDefeatVoice:[220,62,.7],darkVanish:[1320,45,.72],staminaCola:[420,1760,.46],colaSpawn:[280,980,.3]
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
    // Stage-specific Web Audio arrangements: distinct tempo, bass and lead,
    // with a strict three-oscillator ceiling per beat for mobile Safari.
    const scores = {
      title:{lead:[262,330,392,523,392,330,294,392],bass:[131,165,196,147],step:240,type:'triangle'},
      game:{lead:[330,392,440,523,659,587,494,392],bass:[110,147,165,196],step:150,type:'triangle'},
      cityRush:{lead:[330,392,494,659,587,494,440,392,330,494,659,784,659,587,494,440],bass:[110,165,147,196],step:142,type:'triangle'},
      pitRun:{lead:[294,370,440,587,440,659,587,494,330,440,554,740,659,554,494,370],bass:[98,147,123,165],step:132,type:'square'},
      underground:{lead:[196,247,294,370,330,294,247,220,196,294,370,494,440,370,294,247],bass:[65,82,73,98],step:174,type:'triangle'},
      sky:{lead:[440,554,659,880,784,659,587,554,494,659,784,988,880,784,659,587],bass:[147,185,220,196],step:158,type:'sine'},
      fortress:{lead:[220,262,330,392,349,330,294,262,220,330,440,523,494,440,392,330],bass:[73,110,98,82],step:146,type:'sawtooth'},
      maze:{lead:[220,277,330,415,370,330,277,247,220,330,415,554,494,415,370,277],bass:[73,92,82,110],step:166,type:'triangle'},
      sea:{lead:[294,370,440,587,554,440,370,330,294,440,587,740,659,587,494,370],bass:[98,123,147,110],step:184,type:'sine'},
      factory:{lead:[247,330,370,494,440,370,330,294,247,370,494,659,587,494,440,330],bass:[82,123,110,98],step:128,type:'square'},
      deepSea:{lead:[196,247,330,392,370,330,294,247,220,294,392,494,440,392,330,277],bass:[65,82,98,73],step:170,type:'sine'},
      jungle:{lead:[294,392,440,587,659,587,494,440,330,440,523,698,784,698,587,523],bass:[73,110,98,131],step:136,type:'triangle'},
      bonus:{lead:[523,659,784,1047,988,1175,1047,880,659,784,988,1319,1175,988,880,784],bass:[131,196,165,220],step:112,type:'triangle'},
      darkApproach:{lead:[147,185,220,277,247,220,185,165,147,220,277,370,330,277,247,185],bass:[49,62,55,73],step:156,type:'triangle'},
      boss:{lead:[110,147,165,123,110,196,165,123],bass:[55,73,65,62],step:150,type:'sawtooth'},
      boss2:{lead:[147,220,175,247,147,294,220,175],bass:[73,98,82,110],step:120,type:'sawtooth'},
      bossTitan:{lead:[110,165,147,220,123,196,165,247],bass:[55,82,62,73],step:148,type:'sawtooth'},
      bossTitan2:{lead:[147,220,294,247,330,294,247,220],bass:[73,110,82,123],step:116,type:'sawtooth'},
      bossShark:{lead:[98,147,196,175,147,220,196,131],bass:[49,65,55,73],step:164,type:'sine'},
      bossShark2:{lead:[131,196,262,220,294,262,220,175],bass:[55,82,65,98],step:128,type:'triangle'},
      bossGorilla:{lead:[82,123,165,147,196,165,147,110],bass:[41,55,49,62],step:154,type:'sawtooth'},
      bossGorilla2:{lead:[110,165,220,196,262,247,220,165],bass:[55,73,65,82],step:118,type:'sawtooth'},
      darkFeni:{lead:[131,196,165,247,220,294,247,185,147,220,277,330,294,247,220,165],bass:[44,55,49,65],step:126,type:'sawtooth'},
      darkFeni2:{lead:[165,247,330,294,392,330,294,247,196,294,392,494,440,392,330,277],bass:[55,73,65,82],step:98,type:'sawtooth'},
      ending:{lead:[330,392,494,659,587,494,392,330,294,370,494,587,523,440,392,330],bass:[82,98,110,73],step:224,type:'sine'},
      goal:{lead:[523,659,784,1047,988,784,659,880,1047,1319,1175,1047],bass:[262,330,392,440],step:190,type:'triangle'}
    };
    const score=scores[name]||scores.game;
    synthStep = 0;
    synthTimer = window.setInterval(() => {
      if (currentName !== name) return;
      const lead=score.lead[synthStep%score.lead.length],bossTrack=name.startsWith('boss')||name.startsWith('darkFeni');
      note(lead,name==='goal'?.24:.145,name==='goal'?.034:bossTrack?.026:.029,score.type);
      if(synthStep%2===0)note(score.bass[Math.floor(synthStep/2)%score.bass.length],.2,bossTrack?.025:.019,bossTrack?'sawtooth':'sine');
      if(synthStep%4===3)note(lead*(bossTrack?1.5:2),.08,bossTrack?.011:.009,'square');
      synthStep += 1;
    }, score.step);
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
    oscillator.type = name === 'damage' || name === 'gameover' || name === 'attack' || name === 'omniRush' || name === 'dash' || name === 'gorillaGuard' || name === 'bossUltimate' || name === 'bossCutin' || name === 'darkBossCutin' || name === 'bossUltimateImpact' || name === 'earthRend' || name === 'irregular' || name === 'chaosHunt' ? 'sawtooth' : name === 'doubleJump' || name === 'kingFlight' || name === 'revive' || name === 'kingClones' || name === 'darkClones' || name === 'staminaCola' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    const volume = name === 'coin' ? .022 : ['speedUp','speedMax','wingFire','bossWarning','ultimateCharge','omniRush','kingClones','boostRail','phaseGate','warpOpen','warpEnter','bossUltimate','bossCutin','darkBossCutin','bossUltimateImpact','electricField','earthRend','irregular','chaosHunt','darkVanish','staminaCola'].includes(name) ? .052 : name === 'doubleJump' ? .06 : name === 'clash' ? .03 : .035;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    if (name === 'dash') {
      window.setTimeout(()=>note(105,.13,.04,'sawtooth'),18);
      window.setTimeout(()=>note(72,.09,.025,'sine'),62);
    } else if (name === 'kingMode') {
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
    } else if (name === 'warpOpen' || name === 'warpEnter') {
      [220,440,880,1320,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.22,.032,index<2?'sine':'triangle'),index*42));
    } else if (name === 'bossUltimate') {
      [72,110,165,330,660,1320].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.24,.045,index<3?'sawtooth':'square'),index*46));
    } else if (name === 'bossCutin') {
      [66,99,198,396,792,1480].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.22,.044,index<3?'sawtooth':'square'),index*38));
    } else if (name === 'darkBossCutin') {
      [58,87,174,261,696,1392,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.044,index%2?'square':'sawtooth'),index*34));
    } else if (name === 'bossUltimateImpact') {
      [52,72,104,208,416,720].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.048,index<4?'sawtooth':'square'),index*24));
    } else if (name === 'darkTransform' || name === 'darkClones') {
      [131,196,262,392,784].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.24,.038,index%2?'triangle':'sawtooth'),index*54));
    } else if (name === 'electricField') {
      [110,220,440,880,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.18,.042,'square'),index*36));
    } else if (name === 'irregular') {
      [52,78,156,624,1248].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.24,.043,index<3?'sawtooth':'square'),index*42));
    } else if (name === 'chaosHunt') {
      [82,123,246,492,984,1476].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.21,.04,index%2?'square':'sawtooth'),index*38));
    } else if (name === 'darkVanish') {
      [1320,880,440,220,110,55].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.038,index<2?'triangle':'sawtooth'),index*48));
    } else if (name === 'staminaCola') {
      [523,659,784,1047,1319,1760].forEach((frequency,index)=>window.setTimeout(()=>note(frequency,.2,.034,'triangle'),index*42));
    }
  }

  window.RepairHeroSound = { play, music, transition, unlock, state:()=>({currentName,synthActive:!!synthTimer,fadeActive:!!fadeTimer}) };
  const beginTitleAudio = () => { unlock(); if (!currentName) music('title'); };
  document.addEventListener('pointerdown', beginTitleAudio, { once: true });
  document.addEventListener('touchstart', beginTitleAudio, { once: true, passive: true });
  document.addEventListener('keydown', beginTitleAudio, { once: true });
})();
