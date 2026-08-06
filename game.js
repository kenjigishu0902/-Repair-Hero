(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const ui = {level:$('level'),rank:$('rank'),combo:$('combo'),time:$('time'),money:$('money'),lives:$('lives'),burst:$('burstFill'),mission:$('mission'),toast:$('toast'),step:$('stepName'),instruction:$('instruction'),dots:$('dots')};
  const stages = [
    {device:'iPhone 13',issue:'画面割れ',note:'データそのまま希望',part:'NEW DISPLAY',color:'#ef4d2d'},
    {device:'iPhone 12',issue:'バッテリー劣化',note:'最大容量 68%',part:'NEW BATTERY',color:'#ffc134'},
    {device:'iPhone 14 Pro',issue:'水没・起動不可',note:'データ救出希望',part:'LOGIC BOARD',color:'#36b9ff'},
    {device:'Android X',issue:'基板故障',note:'緊急修理',part:'MAIN BOARD',color:'#bb75ff'},
    {device:'Unknown Device',issue:'修理不能端末',note:'FINAL BOSS',part:'CORE MODULE',color:'#ff3525'}
  ];
  const steps = [
    ['受付','依頼カードをタップして受付開始！'],['分解','ドライバーをネジに合わせ、円を描いて回せ！'],['画面取り外し','吸盤を上へドラッグ、次にヘラを右へスワイプ！'],['コネクタ','樹脂ヘラで光るコネクタをすべてタップ！'],['修理','交換部品を端末へドラッグして装着！'],['組み立て','ネジを同じ色の場所へドラッグ！'],['動作確認','光るチェック項目を制限時間内にタップ！']
  ];
  let W=1280,H=720,dpr=1,running=false,last=0,time=60,phase=0,combo=0,best=0,score=0,money=0,lives=3,burst=0,level=0,objects=[],particles=[],pointer={x:0,y:0,down:false},drag=null,turn=0,sound=true,audio=null,shake=0,flash=0,holdTimer=0;
  function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);canvas.width=r.width*dpr;canvas.height=r.height*dpr;W=r.width;H=r.height;ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  function beep(freq=440,dur=.07,type='square',vol=.035){if(!sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.35,audio.currentTime+dur);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch(_){}}
  function updateHUD(){ui.combo.textContent=combo;ui.time.textContent=time.toFixed(1);ui.money.textContent=money.toLocaleString();ui.lives.textContent='♥ '.repeat(lives).trim()+' ♡ '.repeat(3-lives).trim();ui.burst.style.width=burst+'%';ui.level.textContent=String(level+1).padStart(2,'0');const ranks=['D','C','B','A','S','SS','SSS','LEGEND'];ui.rank.textContent=ranks[Math.min(7,Math.floor(score/3500))]}
  function setPhase(n){phase=n;objects=[];drag=null;turn=0;ui.step.textContent=steps[n][0];ui.instruction.textContent=steps[n][1];ui.dots.innerHTML=steps.map((_,i)=>`<i class="${i<=n?'on':''}"></i>`).join('');const cx=W*.5,cy=H*.5;
    if(n===0){ui.mission.classList.remove('hidden');ui.mission.innerHTML=`<small>NEW ORDER / #00${level+1}</small><h2>${stages[level].device}</h2><p>⚠ ${stages[level].issue}</p><p>◉ ${stages[level].note}</p>`;objects=[{type:'card',x:cx-135,y:cy-105,w:270,h:210}]}
    if(n===1){ui.mission.classList.add('hidden');objects=[[-1,-1],[1,-1],[-1,1],[1,1]].map((p,i)=>({type:'screw',x:cx+p[0]*125,y:cy+p[1]*185*.55,r:20,done:false,id:i}))}
    if(n===2)objects=[{type:'suction',x:cx,y:cy+30,r:48,done:false},{type:'spudger',x:cx-200,y:cy+155,w:100,h:24,done:false}];
    if(n===3)objects=[[-70,-55],[70,-55],[-70,55],[70,55]].map((p,i)=>({type:'connector',x:cx+p[0],y:cy+p[1],w:52,h:28,done:false,id:i}))
    if(n===4)objects=[{type:'part',x:100,y:cy-60,w:150,h:120,done:false}];
    if(n===5)objects=[[-1,-1],[1,-1],[-1,1],[1,1]].map((p,i)=>({type:'bolt',x:80,y:cy-120+i*75,tx:cx+p[0]*125,ty:cy+p[1]*100,r:16,done:false,id:i}))
    if(n===6)objects=['FACE ID','TRUE TONE','充電','WI-FI','カメラ','マイク','スピーカー','近接'].map((name,i)=>({type:'test',name,x:cx-210+(i%2)*220,y:cy-145+Math.floor(i/2)*82,w:200,h:62,done:false,id:i}));
  }
  function phone(){const x=W*.5-175,y=H*.5-255,w=350,h=510;ctx.save();ctx.shadowColor='#ff5a1933';ctx.shadowBlur=35;round(x,y,w,h,48,'#191716','#815439',5);round(x+15,y+15,w-30,h-30,37,'#080909','#332820',2);round(x+120,y+24,110,23,12,'#171412');ctx.restore();if(phase>=3){ctx.fillStyle='#182727';ctx.fillRect(x+48,y+110,w-96,270);ctx.strokeStyle='#d49b3e';ctx.lineWidth=3;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x+75,y+135+i*45);ctx.lineTo(x+270,y+135+i*45);ctx.stroke()}}}
  function round(x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function draw(){ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);const g=ctx.createRadialGradient(W/2,H*.45,20,W/2,H*.45,Math.max(W,H)*.7);g.addColorStop(0,'#35170f');g.addColorStop(1,'#080504');ctx.fillStyle=g;ctx.fillRect(-20,-20,W+40,H+40);ctx.strokeStyle='#4d2416';ctx.lineWidth=1;for(let x=0;x<W;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-180,H);ctx.stroke()}ctx.fillStyle='#0d0907';ctx.fillRect(0,H*.79,W,H*.21);ctx.strokeStyle='#7a3b1d';ctx.strokeRect(0,H*.79,W,2);phone();objects.forEach(drawObj);particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.s,p.s)});ctx.globalAlpha=1;if(flash){ctx.fillStyle=`rgba(255,185,45,${flash/15})`;ctx.fillRect(0,0,W,H)}ctx.restore()}
  function drawObj(o){ctx.save();if(o.done){ctx.globalAlpha=.18}if(o.type==='card'){round(o.x,o.y,o.w,o.h,12,'#18110ddd','#ff9e32',2);ctx.fillStyle='#ffbf3f';ctx.font='900 12px system-ui';ctx.fillText('TAP TO ACCEPT',o.x+72,o.y+185)}
    if(o.type==='screw'||o.type==='bolt'){const x=o.type==='bolt'?o.x:o.x,y=o.type==='bolt'?o.y:o.y;ctx.shadowColor='#ffb52a';ctx.shadowBlur=12;ctx.fillStyle=o.type==='bolt'?['#f75b39','#57a5ff','#ffc23f','#67df94'][o.id]:'#d7a653';ctx.beginPath();ctx.arc(x,y,o.r,0,7);ctx.fill();ctx.strokeStyle='#49301c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();if(o.type==='bolt'&&!o.done){ctx.setLineDash([4,5]);ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();ctx.arc(o.tx,o.ty,22,0,7);ctx.stroke()}}
    if(o.type==='suction'){ctx.strokeStyle='#f8d38a';ctx.lineWidth=12;ctx.beginPath();ctx.arc(o.x,o.y,o.r,Math.PI,0);ctx.stroke();ctx.fillStyle='#dc5429';ctx.fillRect(o.x-9,o.y-o.r-45,18,50)}
    if(o.type==='spudger'){round(o.x,o.y,o.w,o.h,10,'#ff9f35','#ffe09b',2);ctx.fillStyle='#fff';ctx.font='bold 10px system-ui';ctx.fillText('SWIPE',o.x+28,o.y+16)}
    if(o.type==='connector'){round(o.x-o.w/2,o.y-o.h/2,o.w,o.h,6,o.done?'#333':'#ffc13d','#fff1ae',2)}
    if(o.type==='part'){round(o.x,o.y,o.w,o.h,15,stages[level].color,'#fff',3);ctx.fillStyle='#090706';ctx.textAlign='center';ctx.font='900 13px system-ui';ctx.fillText(stages[level].part,o.x+o.w/2,o.y+o.h/2+5)}
    if(o.type==='test'){round(o.x,o.y,o.w,o.h,8,o.done?'#1c6c43':'#211813',o.done?'#52ff9d':'#8a5833',2);ctx.fillStyle=o.done?'#fff':'#d9c5ad';ctx.font='800 14px system-ui';ctx.fillText((o.done?'✓  ':'○  ')+o.name,o.x+18,o.y+38)}ctx.restore()}
  function hit(o,x,y){if(o.r)return Math.hypot(x-o.x,y-o.y)<o.r*1.8;return x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h}
  function success(x=W/2,y=H/2){combo++;best=Math.max(best,combo);score+=500+combo*25;money+=120;burst=Math.min(100,burst+14);burstFX(x,y);beep(520+combo*15);show(combo%10===0?'EXCELLENT!':combo%3===0?'PERFECT!':'GREAT!');updateHUD()}
  function fail(){lives--;combo=0;shake=16;flash=12;beep(140,.18,'sawtooth',.06);show('MISS!');updateHUD();if(lives<=0)finish(false)}
  function show(t){ui.toast.textContent=t;ui.toast.classList.remove('show');void ui.toast.offsetWidth;ui.toast.classList.add('show')}
  function burstFX(x,y){for(let i=0;i<26;i++){const a=Math.random()*7,s=Math.random()*5+2;particles.push({x,y,vx:Math.cos(a)*Math.random()*9,vy:Math.sin(a)*Math.random()*9-2,s,c:i%3?'#ff9a27':'#fff3ad',life:1})}}
  function checkDone(){if(objects.length&&objects.every(o=>o.done)){setTimeout(()=>{if(running){phase<6?setPhase(phase+1):finish(true)}},400)}}
  function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e.changedTouches?.[0]||e;return{x:p.clientX-r.left,y:p.clientY-r.top}}
  function down(e){if(!running)return;e.preventDefault();pointer={...pos(e),down:true};holdTimer=setTimeout(()=>{if(burst>=100)repairBurst()},700);for(const o of objects){if(!o.done&&hit(o,pointer.x,pointer.y)){drag=o;o.sx=pointer.x;o.sy=pointer.y;if(['card','connector','test'].includes(o.type)){o.done=true;success(o.x,o.y);checkDone()}break}}}
  function move(e){if(!pointer.down||!running)return;e.preventDefault();const p=pos(e),dx=p.x-pointer.x,dy=p.y-pointer.y;if(drag?.type==='screw'){turn+=Math.abs(dx)+Math.abs(dy);if(turn>170){drag.done=true;success(drag.x,drag.y);drag=null;turn=0;checkDone()}}
    if(drag?.type==='suction'&&p.y<drag.sy-90){drag.done=true;success(p.x,p.y);drag=null;checkDone()}
    if(drag?.type==='spudger'&&p.x>drag.sx+170){drag.done=true;success(p.x,p.y);drag=null;checkDone()}
    if(drag?.type==='part'){drag.x+=dx;drag.y+=dy;if(Math.abs(drag.x+drag.w/2-W/2)<100&&Math.abs(drag.y+drag.h/2-H/2)<120){drag.done=true;success(W/2,H/2);drag=null;checkDone()}}
    if(drag?.type==='bolt'){drag.x+=dx;drag.y+=dy}pointer={...p,down:true}}
  function up(e){clearTimeout(holdTimer);if(!running)return;const p=pos(e);if(drag?.type==='bolt'){if(Math.hypot(drag.x-drag.tx,drag.y-drag.ty)<45){drag.x=drag.tx;drag.y=drag.ty;drag.done=true;success(p.x,p.y);checkDone()}else fail()}drag=null;pointer.down=false}
  canvas.addEventListener('pointerdown',down,{passive:false});canvas.addEventListener('pointermove',move,{passive:false});canvas.addEventListener('pointerup',up,{passive:false});canvas.addEventListener('pointercancel',up,{passive:false});
  function repairBurst(){burst=0;flash=15;shake=25;show('🔥 REPAIR BURST 🔥');beep(160,.6,'sawtooth',.08);for(let i=0;i<150;i++)burstFX(Math.random()*W,H*.7+Math.random()*80);const undone=objects.filter(o=>!o.done).slice(0,2);undone.forEach(o=>{o.done=true;success(o.x||W/2,o.y||H/2)});checkDone();updateHUD()}
  function tick(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;if(running){time-=dt;if(time<=0)finish(false);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.18;p.life-=.025});particles=particles.filter(p=>p.life>0);shake*=.86;flash=Math.max(0,flash-1);updateHUD()}draw();requestAnimationFrame(tick)}requestAnimationFrame(tick);
  function start(){running=true;time=60-level*4;phase=0;combo=best=score=money=burst=0;lives=3;particles=[];$('start').classList.add('hidden');$('result').classList.add('hidden');setPhase(0);updateHUD();beep(330,.15)}
  function finish(win){running=false;ui.mission.classList.add('hidden');const rank=win?(score>7000?'SSS':score>5000?'S':'A'):'D';$('resultRank').textContent=rank;$('resultTitle').textContent=win?'MISSION CLEARED':'REPAIR FAILED';$('score').textContent=score.toLocaleString();$('bestCombo').textContent=best;$('reward').textContent='¥'+money.toLocaleString();$('toolLevel').textContent='Lv.'+(level+2);$('xpFill').style.width=Math.min(100,25+score/80)+'%';$('result').classList.remove('hidden');if(win)level=(level+1)%stages.length;beep(win?660:110,.5,win?'triangle':'sawtooth',.06)}
  $('startBtn').onclick=start;$('againBtn').onclick=start;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♪ ON':'♪ OFF'};updateHUD();
})();
