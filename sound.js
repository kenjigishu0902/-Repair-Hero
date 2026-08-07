(() => {
  'use strict';
  let context;
  const tracks = {
    title: new Audio('assets/sounds/title.mp3'),
    game: new Audio('assets/sounds/bgm.mp3')
  };
  Object.values(tracks).forEach((track) => { track.loop = true; track.preload = 'auto'; track.volume = .32; });
  let currentTrack = null;
  const tones = {
    start:[330,440,.18], jump:[470,650,.11], doubleJump:[620,1040,.2], dash:[180,480,.12],
    coin:[930,1250,.08], item:[520,920,.18], stomp:[190,130,.12], damage:[120,70,.25],
    checkpoint:[620,880,.25], goal:[520,980,.32], clear:[760,1250,.5], gameover:[170,65,.6]
  };
  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) { context ||= new AudioContext(); if (context.state === 'suspended') context.resume(); }
  }
  function music(name) {
    unlock();
    Object.entries(tracks).forEach(([key, track]) => { if (key !== name) { track.pause(); track.currentTime = 0; } });
    currentTrack = name && tracks[name] ? tracks[name] : null;
    if (currentTrack) currentTrack.play().catch(() => {});
  }
  function play(name) {
    unlock(); if (!context) return;
    const [from,to,duration] = tones[name] || [220,280,.1];
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = name === 'damage' || name === 'gameover' ? 'sawtooth' : name === 'doubleJump' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(from,context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(to,context.currentTime+duration);
    gain.gain.setValueAtTime(name === 'doubleJump' ? .06 : .035,context.currentTime); gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime+duration);
  }
  window.RepairHeroSound = { play, music, unlock };
  document.addEventListener('pointerdown', unlock, { once:true });
  document.addEventListener('keydown', unlock, { once:true });
})();
