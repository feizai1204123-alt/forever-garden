/* Procedural garden ambience (Web Audio): a warm music-box lullaby with felt-piano accompaniment, a soft wind bed and wind chimes. No audio files. */
(()=>{'use strict';
const KEY_ON='pmg-audio-on',KEY_VOL='pmg-audio-volume',KEY_WIND='pmg-wind-on',WIND_LEVEL=.025;
const AC=window.AudioContext||window.webkitAudioContext;
let windOn=true,ctx=null,engine=null,master=null,timer=null,proximityTimer=null,enabled=false,volume=55,proximity=0;
try{enabled=localStorage.getItem(KEY_ON)==='1';windOn=localStorage.getItem(KEY_WIND)!=='0';const v=localStorage.getItem(KEY_VOL);if(v!==null&&+v>=0&&+v<=100)volume=+v}catch(e){}
const store=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};

// UI: small ♪ toggle and a volume slider, styled in index.html (#ambience).
const box=document.createElement('div');box.id='ambience';box.setAttribute('role','group');box.setAttribute('aria-label','花园声音');
box.innerHTML='<button id="ambience-toggle" type="button" aria-pressed="false">♪ 声音 · 关</button><button id="wind-toggle" type="button" aria-pressed="true">风声 · 开</button><label class="ambience-volume"><span>音量</span><input id="ambience-volume" type="range" min="0" max="100" step="1" aria-label="花园声音音量"></label>';
document.body.append(box);
const toggle=box.querySelector('#ambience-toggle'),windToggle=box.querySelector('#wind-toggle'),slider=box.querySelector('input');slider.value=String(volume);
function label(){toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?(ctx&&ctx.state==='running'?'♪ 声音 · 开':'♪ 轻触画面开始聆听'):'♪ 声音 · 关';toggle.title=enabled?'关闭背景音乐、风声和风铃':'打开柔和的背景音乐、风声和风铃';}
if(!AC){windToggle.disabled=true;toggle.disabled=true;toggle.textContent='♪ 此浏览器暂不支持声音';slider.disabled=true;window.gardenAudio={chime(){},get enabled(){return false}};return}
label();
function windLabel(){windToggle.setAttribute('aria-pressed',String(windOn));windToggle.textContent=windOn?'风声 · 开':'风声 · 关';windToggle.title=windOn?'关闭轻柔的风声':'打开轻柔的风声'}windLabel();
windToggle.addEventListener('click',()=>{windOn=!windOn;store(KEY_WIND,windOn?'1':'0');windLabel();if(engine)engine.setWind(windOn)});

const mtof=m=>440*Math.pow(2,(m-69)/12),pick=a=>a[Math.floor(Math.random()*a.length)];

/* Lullaby score: C major, 3/4, 66 BPM. 16-bar cycle = A · A' · B · cadence, each phrase has two variants. */
const BPM=66,BEAT=60/BPM,EIGHTH=BEAT/2,BAR=BEAT*3;
const VOICING={C:[48,55,64],Am:[45,52,60],F:[41,48,57],G:[43,50,59]};
const PROGRESSION=['C','Am','F','G','C','Am','F','G','C','G','Am','F','F','G','C','C'];
// Each phrase: four bars of [midi, beats]; C5 = 72.
const PHRASES={
 A:[[[[76,2],[79,1]],[[81,2],[79,1]],[[77,1],[76,1],[74,1]],[[74,3]]],
    [[[76,1],[77,1],[79,1]],[[81,1.5],[79,.5],[76,1]],[[77,1],[76,1],[74,1]],[[71,1],[72,1],[74,1]]]],
 B:[[[[79,1],[76,1],[79,1]],[[77,1],[74,1],[71,1]],[[72,1],[76,1],[81,1]],[[81,2],[77,1]]],
    [[[79,1.5],[76,.5],[79,1]],[[79,1],[77,1],[74,1]],[[76,1],[72,1],[76,1]],[[77,3]]]],
 K:[[[[81,1],[79,1],[77,1]],[[76,1],[77,1],[74,1]],[[76,1],[74,1],[72,1]],[[72,3]]],
    [[[77,1],[81,1],[79,1]],[[77,1],[76,1],[74,1]],[[72,2],[76,1]],[[72,3]]]]
};
function planCycle(cycle){
 const a=Math.random()<.5?0:1;
 const bars=[...PHRASES.A[a],...PHRASES.A[1-a],...PHRASES.B[Math.random()<.5?0:1],...PHRASES.K[Math.random()<.5?0:1]];
 // Every third cycle the melody moves an octave down onto the felt piano, for a softer verse.
 return {bars,low:cycle%3===2};
}

function createEngine(ctx,output){
 const gain=v=>{const g=ctx.createGain();g.gain.value=v;return g};
 function impulse(seconds,decay){const len=Math.floor(ctx.sampleRate*seconds),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}return b}
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=3;comp.attack.value=.02;comp.release.value=.4;comp.connect(output);
 const master=gain(0);master.connect(comp);
 const reverb=ctx.createConvolver();reverb.buffer=impulse(3.4,2.6);const wet=gain(.5);reverb.connect(wet);wet.connect(master);
 // Music gets its own gentle tone shaping: a soft high-shelf cut keeps the music box warm, never shrill.
 const musicBus=gain(1.4),warm=ctx.createBiquadFilter();warm.type='highshelf';warm.frequency.value=2800;warm.gain.value=-9;musicBus.connect(warm);warm.connect(master);
 const musicSend=gain(.42);warm.connect(musicSend);musicSend.connect(reverb);
 const chimeBus=gain(.42);chimeBus.connect(master);chimeBus.connect(reverb);
 // Wind: a barely-there breeze. Brown noise (no hiss), two gentle low-passes, slow smooth swells.
 const windBus=gain(windOn?WIND_LEVEL:0);windBus.connect(master);
 (function startWind(){
  const len=ctx.sampleRate*8,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let last=0,peak=0;
  for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last;peak=Math.max(peak,Math.abs(last))}
  for(let i=0;i<len;i++)d[i]*=.5/peak;
  const fade=Math.floor(ctx.sampleRate*1);for(let i=0;i<fade;i++){const k=i/fade;d[i]=d[i]*k+d[len-fade+i]*(1-k)}// seamless loop
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;src.loopEnd=(len-fade)/ctx.sampleRate;
  const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=45;high.Q.value=.5;// trim sub rumble
  const low1=ctx.createBiquadFilter();low1.type='lowpass';low1.frequency.value=380;low1.Q.value=.5;
  const low2=ctx.createBiquadFilter();low2.type='lowpass';low2.frequency.value=520;low2.Q.value=.4;
  const amp=gain(.6);
  const swell=ctx.createOscillator();swell.frequency.value=.045;const swellDepth=gain(.28);swell.connect(swellDepth);swellDepth.connect(amp.gain);
  const drift=ctx.createOscillator();drift.frequency.value=.017;const driftDepth=gain(.12);drift.connect(driftDepth);driftDepth.connect(amp.gain);
  src.connect(high);high.connect(low1);low1.connect(low2);low2.connect(amp);amp.connect(windBus);
  src.start();swell.start();drift.start();
 })();
 function setWind(on){windBus.gain.cancelScheduledValues(ctx.currentTime);windBus.gain.setTargetAtTime(on?WIND_LEVEL:0,ctx.currentTime,.8)}

 // Music box: round sine tine, a quiet octave partial and a tiny bright "pluck" that fades in 0.1 s.
 function musicBox(freq,t,level){
  const env=ctx.createGain();env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level,t+.006);env.gain.exponentialRampToValueAtTime(level*.45,t+.25);env.gain.exponentialRampToValueAtTime(.0001,t+2.6);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;lp.Q.value=.3;env.connect(lp);lp.connect(musicBus);
  const a=ctx.createOscillator();a.type='sine';a.frequency.value=freq;a.connect(env);
  const b=ctx.createOscillator();b.type='sine';b.frequency.value=freq*2;b.detune.value=4;const bg=ctx.createGain();bg.gain.setValueAtTime(.22,t);bg.gain.exponentialRampToValueAtTime(.001,t+1.2);b.connect(bg);bg.connect(env);
  const c=ctx.createOscillator();c.type='sine';c.frequency.value=freq*3.98;const cg=ctx.createGain();cg.gain.setValueAtTime(.12,t);cg.gain.exponentialRampToValueAtTime(.0005,t+.1);c.connect(cg);cg.connect(env);
  for(const o of [a,b,c]){o.start(t);o.stop(t+2.7)}a.onended=()=>{env.disconnect();lp.disconnect()};
 }
 // Felt piano: triangle + soft octave, quick-but-not-hard attack, filter that closes as the note decays.
 function felt(freq,t,level,decay){
  const env=ctx.createGain();env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level,t+.02);env.gain.exponentialRampToValueAtTime(level*.4,t+.4);env.gain.exponentialRampToValueAtTime(.0001,t+decay);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=.2;lp.frequency.setValueAtTime(Math.min(2200,freq*6),t);lp.frequency.exponentialRampToValueAtTime(Math.max(260,freq*1.6),t+decay);
  env.connect(lp);lp.connect(musicBus);
  const a=ctx.createOscillator();a.type='triangle';a.frequency.value=freq;a.connect(env);
  const b=ctx.createOscillator();b.type='sine';b.frequency.value=freq*2;b.detune.value=-3;const bg=gain(.14);b.connect(bg);bg.connect(env);
  for(const o of [a,b]){o.start(t);o.stop(t+decay+.05)}a.onended=()=>{env.disconnect();lp.disconnect()};
 }
 const human=(v,amount)=>v*(1+(Math.random()*2-1)*amount);
 function scheduleBar(index,t,plan){
  const chord=VOICING[PROGRESSION[index]];
  // Broken-chord accompaniment in eighths: root · 5th · 10th · 5th · 10th · 5th.
  const pattern=[chord[0],chord[1],chord[2],chord[1],chord[2],chord[1]];
  pattern.forEach((n,i)=>{const at=Math.max(ctx.currentTime,t+i*EIGHTH+(i?(Math.random()-.5)*.012:0));if(i===0)felt(mtof(n),at,human(.11,.08),3.6);else felt(mtof(n),at,human(i%2?.05:.058,.12),1.9)});
  if(index===PROGRESSION.length-1)felt(mtof(chord[0]-12),t,.07,4.5);// warm low note to close each cycle
  let beat=0;
  for(const [n,len] of plan.bars[index]){const at=Math.max(ctx.currentTime,t+beat*BEAT+(Math.random()-.5)*.016);
   if(plan.low)felt(mtof(n-12),at,human(.1,.08),2.8);else musicBox(mtof(n),at,human(.13,.1));
   beat+=len}
 }
 // Chime tone: inharmonic partials with long exponential decay, like a small metal tube.
 function chimeTone(freq,t,level){
  const out=gain(level);out.connect(chimeBus);
  [[1,1,3.6],[2.76,.42,2.1],[5.4,.18,1.2],[8.93,.08,.7]].forEach(([ratio,amp,decay],i)=>{const o=ctx.createOscillator(),e=ctx.createGain();o.frequency.value=freq*ratio;e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(amp,t+.005);e.gain.exponentialRampToValueAtTime(.0001,t+decay);o.connect(e);e.connect(out);o.start(t);o.stop(t+decay+.05);if(i===0)o.onended=()=>out.disconnect()});
 }
 function windChime(t){const notes=[84,86,88,91,93,96],strikes=1+Math.floor(Math.random()*3),level=.07*(.55+.95*proximity);let at=t;for(let i=0;i<strikes;i++){chimeTone(mtof(pick(notes)),at,level*(.7+Math.random()*.3));at+=.22+Math.random()*.5}}
 let nextBar=-1,bar=0,cycle=0,plan=planCycle(0),nextChime=-1;
 function schedule(ahead){
  const now=ctx.currentTime;
  if(nextBar<now){nextBar=now+.15}
  while(nextBar<ahead){scheduleBar(bar,nextBar,plan);nextBar+=BAR;bar++;if(bar>=PROGRESSION.length){bar=0;cycle++;plan=planCycle(cycle);nextBar+=BEAT}}// a breath between cycles
  if(nextChime<now)nextChime=now+2+Math.random()*4;
  while(nextChime<ahead){windChime(nextChime);nextChime+=5+Math.random()*9}
 }
 return {master,schedule,setWind,chime(){const t=ctx.currentTime+.03;[79,84,88].forEach((n,i)=>chimeTone(mtof(n),t+i*.16,.09))}};
}
function build(){
 ctx=new AC();engine=createEngine(ctx,ctx.destination);master=engine.master;
 timer=setInterval(schedule,300);proximityTimer=setInterval(updateProximity,500);
 ctx.onstatechange=label;
}
function schedule(){if(!ctx||ctx.state!=='running')return;engine.schedule(ctx.currentTime+1.2)}
// Chimes are a little clearer close to the central statue (world 0, -2.5).
function updateProximity(){const g=window.garden;if(!g)return;const c=g.controller,p=c&&c.active&&c.actor?c.actor.position:g.camera.position;const d=Math.hypot(p.x,p.z+2.5);proximity=Math.max(0,Math.min(1,1-(d-3)/16))}
function applyVolume(){if(!ctx)return;const target=enabled?Math.pow(volume/100,2)*.9:0;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(target,ctx.currentTime,.4)}
let suspendTimer=null;
function start(){
 try{if(!ctx)build();clearTimeout(suspendTimer);const resumed=ctx.state==='suspended'?ctx.resume():Promise.resolve();resumed.then(()=>{applyVolume();label()}).catch(()=>label());}
 catch(e){console.warn('Garden audio unavailable',e);enabled=false;toggle.disabled=true;toggle.textContent='♪ 暂时无法播放声音';}
}
function stop(){if(!ctx)return;applyVolume();clearTimeout(suspendTimer);suspendTimer=setTimeout(()=>{if(!enabled&&ctx.state==='running')ctx.suspend().then(label)},1500);label()}
toggle.addEventListener('click',()=>{if(enabled&&(!ctx||ctx.state!=='running')){start();return}enabled=!enabled;store(KEY_ON,enabled?'1':'0');enabled?start():stop()});
slider.addEventListener('input',()=>{volume=+slider.value;store(KEY_VOL,String(volume));if(enabled&&volume>0&&(!ctx||ctx.state!=='running'))start();applyVolume()});
// Browsers only allow sound after a gesture: if it was left on last time, start on the first touch or key press.
const firstGesture=e=>{if(e.target===toggle)return;removeEventListener('pointerdown',firstGesture,true);removeEventListener('keydown',firstGesture,true);if(enabled)start()};
addEventListener('pointerdown',firstGesture,true);addEventListener('keydown',firstGesture,true);
document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden){if(ctx.state==='running')ctx.suspend()}else if(enabled)ctx.resume().then(label).catch(()=>{})});
// Soft three-note chime used when a flower, candle or message is offered.
window.gardenAudio={
 chime(){if(!enabled||!ctx||ctx.state!=='running')return;engine.chime()},
 // Renders a preview of the music (with wind and chimes) offline; used for testing only.
 renderPreview(seconds=30,vol=70){const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext,oc=new OAC(2,Math.ceil(44100*seconds),44100),e=createEngine(oc,oc.destination);e.master.gain.value=Math.pow(vol/100,2)*.9;proximity=.5;e.schedule(seconds);return oc.startRendering()},
 get enabled(){return enabled&&!!ctx&&ctx.state==='running'}
};
})();
