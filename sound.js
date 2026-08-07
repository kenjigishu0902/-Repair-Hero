(() => {
  'use strict';
  let context;
  const tones = { start:[330,440,.18], jump:[470,650,.11], doubleJump:[620,1040,.2], coin:[930,1250,.08], stomp:[190,130,.12], damage:[120,70,.25], checkpoint:[620,880,.25], clear:[760,1250,.5] };
  window.RepairHeroSound = { play(name) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context ||= new Audio();
    if (context.state === 'suspended') context.resume();
    const [from,to,duration] = tones[name] || [220,280,.1];
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = name === 'damage' ? 'sawtooth' : name === 'doubleJump' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(from,context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(to,context.currentTime+duration);
    gain.gain.setValueAtTime(name === 'doubleJump' ? .06 : .035,context.currentTime); gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime+duration);
  }};
})();
