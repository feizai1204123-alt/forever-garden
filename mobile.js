/* Phone play-test helpers: detect touch devices before the scene is built, and stop the page from scrolling/zooming/pull-to-refresh while playing. */
(()=>{
'use strict';
const coarse=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
window.GARDEN_MOBILE=coarse||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||('ontouchstart' in window&&innerWidth<900);
if(window.GARDEN_MOBILE)document.documentElement.classList.add('mobile');
const scrollable=el=>!!(el&&el.closest&&el.closest('dialog,#ritual-panel,textarea,footer,select'));
// iOS Safari ignores user-scalable=no, so block pinch / double-tap zoom gestures directly.
for(const ev of ['gesturestart','gesturechange','gestureend'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1||!scrollable(e.target))e.preventDefault()},{passive:false});
let lastTouchEnd=0;document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<320&&!scrollable(e.target)&&!(e.target.closest&&e.target.closest('button,input,a')))e.preventDefault();lastTouchEnd=now},{passive:false});
document.addEventListener('contextmenu',e=>{if(window.GARDEN_MOBILE&&!scrollable(e.target))e.preventDefault()});
})();
/* Landscape helpers: visual-viewport vars (keyboard), portrait suggestion, fullscreen button, iOS add-to-home tip. */
(()=>{
'use strict';
if(!window.GARDEN_MOBILE)return;
const root=document.documentElement,vv=window.visualViewport;
let baseH={landscape:0,portrait:0};
function syncViewport(){
 const h=vv?vv.height:innerHeight,top=vv?vv.offsetTop:0,o=innerWidth>innerHeight?'landscape':'portrait';
 const typingNow=document.activeElement&&/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)&&document.activeElement.type!=='range';
 if(!typingNow)baseH[o]=Math.max(innerHeight,h);else if(!baseH[o])baseH[o]=innerHeight;
 root.style.setProperty('--vvh',h+'px');root.style.setProperty('--vvtop',top+'px');
 const typing=document.activeElement&&/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)&&document.activeElement.type!=='range';
 const kb=!!typing&&h<baseH[o]*.8;root.classList.toggle('kb-open',kb);
 if(kb)requestAnimationFrame(()=>{try{document.activeElement.scrollIntoView({block:'nearest'})}catch(_){}});
}
if(vv){vv.addEventListener('resize',syncViewport);vv.addEventListener('scroll',syncViewport)}
addEventListener('resize',syncViewport);document.addEventListener('focusin',()=>setTimeout(syncViewport,350));document.addEventListener('focusout',()=>setTimeout(()=>{syncViewport();window.scrollTo(0,0)},120));syncViewport();
// Portrait: gentle suggestion, never a hard block.
const ios=/iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1&&/iPad|Macintosh/.test(navigator.userAgent)&&!/Android/.test(navigator.userAgent)&&screen.width<1100);
const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
try{if(sessionStorage.getItem('garden-portrait-ok'))root.classList.add('rotate-dismissed')}catch(_){}
const cont=document.getElementById('rotate-continue');if(cont)cont.onclick=()=>{root.classList.add('rotate-dismissed');try{sessionStorage.setItem('garden-portrait-ok','1')}catch(_){}};
if(ios&&!standalone)for(const el of document.querySelectorAll('#rotate-tip .ios-only'))el.hidden=false;
// Fullscreen where the browser supports it (not iPhone Safari).
const canFs=!ios&&(document.fullscreenEnabled||document.webkitFullscreenEnabled);
if(canFs){
 const footer=document.querySelector('footer'),btn=document.createElement('button');btn.id='fullscreen';btn.type='button';btn.textContent='全屏';footer.prepend(btn);
 const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 btn.onclick=async()=>{try{if(isFs()){await(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else{await(root.requestFullscreen||root.webkitRequestFullscreen).call(root,{navigationUI:'hide'});try{await screen.orientation.lock('landscape')}catch(_){}}}catch(e){console.warn('fullscreen',e)}};
 const sync=()=>{btn.textContent=isFs()?'退出全屏':'全屏'};document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
}
// iOS Safari in landscape: one-time tip about Add to Home Screen.
const tip=document.getElementById('ios-tip');
if(tip&&ios&&!standalone){let shown=false;try{shown=!!localStorage.getItem('garden-ios-tip')}catch(_){}
 const maybe=()=>{if(shown||innerWidth<innerHeight)return;shown=true;try{localStorage.setItem('garden-ios-tip','1')}catch(_){}tip.hidden=false;setTimeout(()=>{tip.hidden=true},9000)};
 tip.onclick=()=>{tip.hidden=true};addEventListener('garden-memorial-ready',()=>setTimeout(maybe,1500),{once:true});addEventListener('orientationchange',()=>setTimeout(maybe,800));}
// Control hint fades after a while in landscape (less clutter over the 3D view).
let fadeTimer;const hint=document.getElementById('hint');
if(hint)new MutationObserver(()=>{root.classList.remove('hint-faded');clearTimeout(fadeTimer);fadeTimer=setTimeout(()=>root.classList.add('hint-faded'),9000)}).observe(hint,{childList:true,characterData:true,subtree:true});
})();

/* Start screen: real progress (scripts → scene → gardener → memorial), then a tap to enter (also unlocks audio on iOS). */
(()=>{
'use strict';
const sp=document.getElementById('splash');if(!sp)return;
const bar=sp.querySelector('.sp-bar span'),status=sp.querySelector('.sp-status'),actions=sp.querySelector('.sp-actions');
const ios=/iPhone|iPod/.test(navigator.userAgent),standalone=navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
if(ios&&!standalone)sp.querySelector('.sp-ios').hidden=false;
if(!window.GARDEN_MOBILE)for(const li of sp.querySelectorAll('.sp-help li'))li.innerHTML=li.innerHTML.replace('左下摇杆散步，推到底奔跑','WASD / 方向键散步，Shift 奔跑').replace('右侧拖动转视角，双指缩放','拖动转视角，滚轮缩放').replace('轻触「献心意」','按 E「献心意」');
const pct=el=>{const m=el&&el.textContent.match(/(\d+)%/);return m?+m[1]:0};
let shown=4,done=false,started=Date.now();
const timer=setInterval(()=>{
 const g=window.garden,ch=document.getElementById('character-status'),pet=document.getElementById('pet-status'),err=document.getElementById('error');
 if(err&&err.textContent.includes('无法显示')){clearInterval(timer);sp.classList.add('gone');return}// let the WebGL error message show
 let p=8,text='正在推开花园的门… 请稍候';
 if(g){p=25;text='花园已苏醒，正在请园丁过来…';const c=g.controller,petDone=pet&&pet.dataset.loaded==='true';
  const cp=c&&c.ready?100:pct(ch),pp=petDone?100:pct(pet);p=25+cp*.45+pp*.3;
  if(c&&c.ready&&!petDone)text='园丁到了，正在安放宠物纪念像…';
  if(ch&&/失败/.test(ch.textContent))text=ch.textContent;
  if(c&&c.ready&&petDone){p=100;text='花园准备好了'}}
 shown+=(p-shown)*.35;bar.style.width=Math.max(4,Math.min(100,shown))+'%';if(status.textContent!==text)status.textContent=text;
 if(p>=100&&!done){done=true;actions.hidden=false;try{document.getElementById('splash-enter').focus({preventScroll:true})}catch(_){}}
 if(Date.now()-started>90000&&!done&&g){done=true;actions.hidden=false;status.textContent='网络有点慢，可以先进入花园，其余会在里面继续载入'}
},200);
function enter(withMusic){clearInterval(timer);sp.classList.add('gone');setTimeout(()=>sp.remove(),1000);
 if(withMusic){const t=document.getElementById('ambience-toggle');if(t&&t.getAttribute('aria-pressed')!=='true')t.click()}
 try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}}
document.getElementById('splash-enter').onclick=()=>enter(true);document.getElementById('splash-quiet').onclick=()=>enter(false);
// HUD: hide the routine "人物已就绪" status, keep important messages visible.
const st=document.getElementById('character-status');
if(st&&window.GARDEN_MOBILE)new MutationObserver(()=>st.classList.toggle('quiet',/已就绪/.test(st.textContent))).observe(st,{childList:true,characterData:true,subtree:true});
addEventListener('load',()=>{for(const b of document.querySelectorAll('footer button'))if(!b.id&&b.textContent.includes('创建宠物纪念'))b.id='create-memorial'});
})();
