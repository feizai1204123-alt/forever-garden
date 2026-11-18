/* Analog virtual joystick (bottom-left). Publishes window.gardenJoystick = {x, y, mag} (x right+, y down+, mag 0..1).
   Tracks one pointer id only, so a second finger on the right side keeps rotating the camera (multitouch). */
(()=>{
'use strict';
const zone=document.getElementById('joystick');if(!zone)return;
const base=zone.querySelector('.js-base'),knob=zone.querySelector('.js-knob');
const state={x:0,y:0,mag:0,active:false,reset};window.gardenJoystick=state;
let pid=null,cx=0,cy=0,wasRunning=false;
const R=()=>base.getBoundingClientRect().width*.42;// max knob travel in px
function center(){const b=base.getBoundingClientRect();cx=b.left+b.width/2;cy=b.top+b.height/2}
function setKnob(dx,dy){knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`}
function move(e){
 const r=R();let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy);if(d>r){dx*=r/d;dy*=r/d}
 setKnob(dx,dy);let mag=Math.min(1,d/r);const dead=.12;
 if(mag<dead){state.x=state.y=state.mag=0}else{const m=(mag-dead)/(1-dead);state.x=dx/(Math.hypot(dx,dy)||1)*m;state.y=dy/(Math.hypot(dx,dy)||1)*m;state.mag=m}
 const running=state.mag>.92;zone.classList.toggle('running',running);
 if(running&&!wasRunning){try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}wasRunning=running;
}
function reset(){pid=null;state.x=state.y=state.mag=0;state.active=false;wasRunning=false;setKnob(0,0);zone.classList.remove('active','running')}
zone.addEventListener('pointerdown',e=>{if(pid!==null)return;e.preventDefault();pid=e.pointerId;try{zone.setPointerCapture(pid)}catch(_){}center();state.active=true;zone.classList.add('active');move(e)});
zone.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;e.preventDefault();move(e)});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(ev,e=>{if(e.pointerId===pid)reset()});
addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
addEventListener('resize',()=>{if(pid!==null)center()});
})();
