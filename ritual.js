/* Memorial rituals: offer flowers, light candles and leave short messages at every memorial. */
(()=>{'use strict';
const g=window.garden,T=window.THREE;if(!g||!T)return;
const STORE='pmg-rituals-v1',MAX_FLOWERS=5,MAX_CANDLES=3,MESSAGE_MAX=200,MESSAGES_KEPT=100,COUNT_MAX=9999,NEAR=2.2;
const ID_RE=/^(m([0-9]|[1-3][0-9]|4[0-6])|statue)$/;
const scene=g.scene,camera=g.camera,canvas=g.renderer.domElement;
scene.updateMatrixWorld(true);

/* ---------- Memorial spots: m0…m46 follow scene.js memorials[] order; "statue" is the central dog. ---------- */
const spots=g.memorials.map((m,i)=>({id:'m'+i,index:i,group:m.group,kind:m.group.userData.isPetMemorial?'pet':m.group.userData.emptyMemorial?'slot':'stone'}));
if(g.statue)spots.push({id:'statue',index:-1,group:g.statue,kind:'statue'});
const byId=new Map();
for(const s of spots){
 const front=s.kind==='statue'?1.6:s.kind==='pet'?1.24:1.1;
 const p=s.group.localToWorld(new T.Vector3(0,0,front));
 s.root=new T.Group();s.root.name='Rituals_'+s.id;s.root.position.set(p.x,.02,p.z);s.root.rotation.y=s.group.rotation.y;
 s.root.scale.setScalar(s.kind==='statue'?1.35:Math.max(.78,Math.min(1.15,s.group.scale.x)));
 s.root.userData.ritualSpot=s;scene.add(s.root);
 s.radius=s.kind==='statue'?3.2:NEAR;byId.set(s.id,s);
}
const available=s=>s.kind!=='slot'||!!(s.group.userData.storyStone||s.group.userData.petName);// empty pedestals wait for a memorial first
function nameOf(s){if(s.kind==='statue')return '守望花园的石雕狗狗';if(s.kind==='pet')return '花开不忘 · 贵宾犬纪念像';const n=s.group.userData.petName;return n?n+' 的纪念位':'纪念位 '+(s.index+1)}

/* ---------- Shared, merged geometry (one draw call per bouquet / candle body). ---------- */
const M=(x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));
function merged(parts){
 const list=parts.map(([geo,matrix,color])=>{const gg=geo.index?geo.toNonIndexed():geo.clone();gg.applyMatrix4(matrix);return {gg,c:new T.Color(color)}});
 const total=list.reduce((n,p)=>n+p.gg.attributes.position.count,0),pos=new Float32Array(total*3),nor=new Float32Array(total*3),col=new Float32Array(total*3);let o=0;
 for(const {gg,c} of list){const n=gg.attributes.position.count;pos.set(gg.attributes.position.array,o*3);nor.set(gg.attributes.normal.array,o*3);for(let i=0;i<n;i++){col[(o+i)*3]=c.r;col[(o+i)*3+1]=c.g;col[(o+i)*3+2]=c.b}o+=n;gg.dispose()}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));out.setAttribute('color',new T.BufferAttribute(col,3));out.computeBoundingSphere();return out;
}
const ball=new T.SphereGeometry(1,8,6),cyl=new T.CylinderGeometry(1,1,1,8),cone=new T.ConeGeometry(1,1,10);
const palettes=[['#f6e7c6','#efc9a6','#f2b9a8'],['#f3d27a','#fff1c4','#e9b13b'],['#e7a29a','#f4c5b0','#fff6e6']];
const bouquetGeos=palettes.map(pal=>{const parts=[[cone,M(0,.13,0,.1,.24,.1,Math.PI),'#e8dcc2'],[cyl,M(0,.19,0,.075,.03,.075),'#b98a4a']];
 for(let i=0;i<3;i++)parts.push([cyl,M((i-1)*.025,.27,0,.008,.14,.008,0,0,(i-1)*.15),'#4f6a3e']);
 parts.push([ball,M(-.07,.29,.02,.05,.016,.03,0,0,.7),'#5d7444'],[ball,M(.07,.3,-.01,.05,.016,.03,0,0,-.7),'#5d7444']);
 const heads=[[0,.37,0],[-.055,.34,.03],[.055,.345,.025],[-.03,.335,-.045],[.035,.34,-.04],[0,.315,.06]];
 heads.forEach((h,i)=>{parts.push([ball,M(h[0],h[1],h[2],.045,.04,.045),pal[i%pal.length]]);parts.push([ball,M(h[0],h[1]+.03,h[2],.014,.012,.014),'#d9a441'])});
 return merged(parts)});
const candleGeo=merged([[cyl,M(0,.012,0,.07,.024,.07),'#8a6d4a'],[cyl,M(0,.1,0,.042,.16,.042),'#f4e6c8'],[cyl,M(0,.19,0,.004,.02,.004),'#3a2f25']]);
const itemMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.85});
const flameMat=new T.MeshBasicMaterial({color:'#ffd88a',fog:true}),flameGeo=new T.SphereGeometry(1,10,8);
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,226,160,1)');gr.addColorStop(.25,'rgba(255,190,100,.55)');gr.addColorStop(1,'rgba(255,160,60,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t})();
const glowMat=new T.SpriteMaterial({map:glowTex,color:'#ffc06a',blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:.85});
const flowerSlots=[[-.36,.22],[.36,.22],[-.18,.3],[.18,.3],[0,.36]],candleSlots=[[-.22,.02],[.22,.02],[0,.06]];
const flames=[];
// One pooled real light follows the nearest lit memorial; every other candle glows with an emissive flame + sprite.
const candleLight=new T.PointLight('#ffb35c',0,3.4,2);candleLight.position.set(0,-50,0);scene.add(candleLight);

/* ---------- Data (localStorage always, server.cjs when available). ---------- */
const blank=()=>({flowers:0,candles:0,messages:[]});
function cleanEntry(e){if(!e||typeof e!=='object')return blank();const n=v=>Math.min(COUNT_MAX,Math.max(0,Math.floor(+v)||0));return {flowers:n(e.flowers),candles:n(e.candles),messages:(Array.isArray(e.messages)?e.messages:[]).filter(m=>m&&typeof m.text==='string'&&typeof m.at==='string').map(m=>({text:m.text.slice(0,MESSAGE_MAX*2),at:m.at})).slice(-MESSAGES_KEPT)}}
function cleanAll(obj){const out={};if(obj&&typeof obj==='object')for(const id of Object.keys(obj))if(ID_RE.test(id)&&byId.has(id))out[id]=cleanEntry(obj[id]);return out}
function mergeEntry(a,b){const seen=new Set(),messages=[];for(const m of [...a.messages,...b.messages]){const k=m.at+'|'+m.text;if(!seen.has(k)){seen.add(k);messages.push(m)}}messages.sort((x,y)=>x.at<y.at?-1:x.at>y.at?1:0);return {flowers:Math.max(a.flowers,b.flowers),candles:Math.max(a.candles,b.candles),messages:messages.slice(-MESSAGES_KEPT)}}
let data={};try{data=cleanAll(JSON.parse(localStorage.getItem(STORE)||'{}'))}catch(e){data={}}
const entry=id=>data[id]||(data[id]=blank());
function saveLocal(){try{localStorage.setItem(STORE,JSON.stringify(data));return true}catch(e){return false}}
let serverOK=false;
async function api(method,body){const r=await fetch('/api/rituals',{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('未连接花园服务');const b=await r.json();if(!r.ok)throw Error(b.error||'保存失败');return b}

/* ---------- 3D items ---------- */
function renderItems(s){
 for(let i=flames.length-1;i>=0;i--)if(flames[i].spot===s)flames.splice(i,1);
 s.root.clear();const e=data[s.id]||blank();
 for(let i=0;i<Math.min(e.flowers,MAX_FLOWERS);i++){const m=new T.Mesh(bouquetGeos[i%bouquetGeos.length],itemMat);const [x,z]=flowerSlots[i];m.position.set(x,0,z);m.rotation.set(.12*(i%2?1:-1),i*1.7,(i%2?-1:1)*.08);m.userData.ritualSpot=s;s.root.add(m)}
 for(let i=0;i<Math.min(e.candles,MAX_CANDLES);i++){const c=new T.Group(),[x,z]=candleSlots[i];c.position.set(x,0,z);c.add(new T.Mesh(candleGeo,itemMat));
  const flame=new T.Mesh(flameGeo,flameMat);flame.position.y=.225;flame.scale.set(.016,.036,.016);const glow=new T.Sprite(glowMat);glow.position.y=.23;glow.scale.setScalar(.42);c.add(flame,glow);s.root.add(c);flames.push({spot:s,flame,glow,phase:Math.random()*100})}
 s.root.traverse(o=>{o.userData.ritualSpot=s});s.lit=Math.min(e.candles,MAX_CANDLES)>0;
}
spots.forEach(renderItems);

/* ---------- Panel & prompt UI (styles in index.html) ---------- */
const panel=document.createElement('section');panel.id='ritual-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','ritual-title');
panel.innerHTML='<button type="button" class="ritual-close" aria-label="关闭心意面板">×</button><small>在这里，轻轻说一声想念</small><h2 id="ritual-title"></h2><p class="ritual-counts" aria-live="polite"></p>'
 +'<div class="ritual-actions"><button type="button" data-act="flower">✿ 献花</button><button type="button" data-act="candle">✦ 点蜡烛</button><button type="button" data-act="message" aria-expanded="false">✎ 留言</button></div>'
 +'<form class="ritual-form" hidden><label for="ritual-text">想对它说的话</label><textarea id="ritual-text" maxlength="200" rows="3" placeholder="今天也很想你。谢谢你来过我的生命……"></textarea><div class="ritual-row"><span class="ritual-left">0 / 200</span><button type="submit">留下这句话</button></div></form>'
 +'<p class="ritual-note" role="status" aria-live="polite"></p><p class="story-heading">留言</p><ol class="ritual-messages"></ol>';
document.body.append(panel);
const prompt=document.createElement('button');prompt.id='ritual-prompt';prompt.type='button';prompt.hidden=true;document.body.append(prompt);
const title=panel.querySelector('h2'),counts=panel.querySelector('.ritual-counts'),note=panel.querySelector('.ritual-note'),list=panel.querySelector('.ritual-messages'),form=panel.querySelector('form'),text=panel.querySelector('textarea'),left=panel.querySelector('.ritual-left'),msgBtn=panel.querySelector('[data-act="message"]');
let current=null,nearSpot=null,noteTimer=null,openFrom=null;
const pad=n=>String(n).padStart(2,'0');
function when(iso){const d=new Date(iso);return isNaN(d)?'':d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())}
function say(msg){note.textContent=msg;clearTimeout(noteTimer);noteTimer=setTimeout(()=>{note.textContent=''},6000)}
function renderPanel(){
 if(!current)return;const e=data[current.id]||blank();title.textContent=nameOf(current);
 counts.textContent=(e.flowers||e.candles||e.messages.length)?'已献花 '+e.flowers+' 束 · 已点亮 '+e.candles+' 支蜡烛 · '+e.messages.length+' 条留言':'这里还很安静。献一束花，点一盏灯，或者说几句话吧。';
 list.textContent='';
 if(!e.messages.length){const li=document.createElement('li');li.className='ritual-empty';li.textContent='还没有留言。第一句想念，可以由你写下。';list.append(li)}
 for(const m of e.messages.slice().reverse().slice(0,50)){const li=document.createElement('li'),p=document.createElement('p'),t=document.createElement('time');p.textContent=m.text;t.dateTime=m.at;t.textContent=when(m.at);li.append(p,t);list.append(li)}
}
function open(s,fromKeyboard){
 if(typeof s==='string')s=byId.get(s);if(!s)return;current=s;openFrom=null;form.hidden=true;msgBtn.setAttribute('aria-expanded','false');note.textContent='';renderPanel();panel.hidden=false;prompt.hidden=true;
 if(fromKeyboard)panel.querySelector('[data-act="flower"]').focus({preventScroll:true});
}
function close(){if(panel.hidden)return;const hadFocus=panel.contains(document.activeElement);panel.hidden=true;current=null;if(hadFocus)canvas.focus({preventScroll:true})}
panel.querySelector('.ritual-close').onclick=close;
async function offer(kind,message){
 const s=current;if(!s)return;try{navigator.vibrate&&navigator.vibrate(kind==='candle'?[20,40,20]:30)}catch(_){}const e=entry(s.id);let pushed=null;
 if(kind==='flower')e.flowers=Math.min(COUNT_MAX,e.flowers+1);else if(kind==='candle')e.candles=Math.min(COUNT_MAX,e.candles+1);else{pushed={text:message,at:new Date().toISOString()};e.messages.push(pushed);if(e.messages.length>MESSAGES_KEPT)e.messages.splice(0,e.messages.length-MESSAGES_KEPT)}
 const savedLocal=saveLocal();renderItems(s);renderPanel();if(window.gardenAudio)window.gardenAudio.chime();
 const thanks=kind==='flower'?(e.flowers>MAX_FLOWERS?'花台上最多摆放 '+MAX_FLOWERS+' 束花，这一束的心意也已记下。':'一束花，轻轻放在了这里。'):kind==='candle'?(e.candles>MAX_CANDLES?'这里已有 '+MAX_CANDLES+' 盏烛光，这份心意也已记下。':'烛光亮起来了，愿它照亮回家的路。'):'你的话，已经留在这里了。';
 if(!serverOK){say(thanks+(savedLocal?'（保存在这台设备上）':'（浏览器未允许本地保存）'));return}
 try{const r=await api('POST',{id:s.id,action:kind,text:kind==='message'?message:undefined});const mine=entry(s.id);if(pushed){const i=mine.messages.indexOf(pushed);if(i>=0)mine.messages.splice(i,1)}// the server copy (with server time) replaces the optimistic one
  data[s.id]=mergeEntry(entry(s.id),cleanEntry(r.entry));saveLocal();renderItems(s);if(current===s)renderPanel();say(thanks+'（已珍藏在花园里）')}
 catch(err){say(thanks+'（暂时只保存在这台设备上：'+err.message+'）')}
}
panel.querySelector('[data-act="flower"]').onclick=()=>offer('flower');
panel.querySelector('[data-act="candle"]').onclick=()=>offer('candle');
msgBtn.onclick=()=>{form.hidden=!form.hidden;msgBtn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)text.focus({preventScroll:true})};
const count=()=>{left.textContent=Array.from(text.value).length+' / '+MESSAGE_MAX};text.addEventListener('input',count);
form.onsubmit=e=>{e.preventDefault();const v=text.value.replace(/\r\n?/g,'\n').trim();const n=Array.from(v).length;if(!n){say('写一句想说的话吧，哪怕只是「想你」。');text.focus();return}if(n>MESSAGE_MAX){say('留言最多 '+MESSAGE_MAX+' 字。');return}text.value='';count();offer('message',v)};
// Typing in the panel must never steer the character (character.js listens on window): keep key events inside.
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}const t=e.target;if(t instanceof HTMLTextAreaElement||t instanceof HTMLInputElement)e.stopPropagation()});
prompt.onclick=()=>{if(nearSpot)open(nearSpot,true)};
addEventListener('keydown',e=>{if(e.code!=='KeyE'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement||t.isContentEditable||document.querySelector('dialog[open]'))return;if(nearSpot){e.preventDefault();open(nearSpot,true)}});

/* ---------- Click a memorial (empty pedestals keep the existing memorial-editor behaviour). ---------- */
const ray=new T.Raycaster(),clickable=spots.filter(s=>s.kind!=='slot').map(s=>s.group).concat(spots.map(s=>s.root));let down=null;
canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||document.querySelector('dialog[open]'))return;down=null;
 const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
 const hit=ray.intersectObjects(clickable,true)[0];if(!hit)return;let o=hit.object,s=null;
 while(o&&!s){s=o.userData.ritualSpot||spots.find(x=>x.group===o)||null;o=o.parent}
 if(s&&available(s))open(s,false);
});

/* ---------- Per-frame: proximity prompt, candle flicker, pooled light ---------- */
let lastLight=0;const coarse=!!window.GARDEN_MOBILE||!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
function frame(t){
 requestAnimationFrame(frame);const time=t/1000,c=g.controller;
 nearSpot=null;
 if(c&&c.active&&c.actor){const p=c.actor.position;let best=Infinity;for(const s of spots){if(!available(s))continue;const d=Math.hypot(p.x-s.root.position.x,p.z-s.root.position.z);if(d<s.radius&&d<best){best=d;nearSpot=s}}
  if(current){const d=Math.hypot(p.x-current.root.position.x,p.z-current.root.position.z);if(openFrom===null)openFrom=d;if(d>Math.max(openFrom,current.radius)+4)close()}}// walking away closes the panel gently
 const showPrompt=!!nearSpot&&nearSpot!==current&&!document.querySelector('dialog[open]');
 if(showPrompt){const label=coarse?'🌸 献心意 · 「'+nameOf(nearSpot)+'」':'按 E 或点这里 · 为「'+nameOf(nearSpot)+'」献上心意';if(prompt.textContent!==label)prompt.textContent=label}
 if(prompt.hidden===showPrompt){prompt.hidden=!showPrompt;if(showPrompt&&coarse){try{navigator.vibrate&&navigator.vibrate(12)}catch(_){}}}
 for(const f of flames){const k=.86+.1*Math.sin(time*11.3+f.phase)*Math.sin(time*7.1+f.phase*1.7)+.04*Math.sin(time*23+f.phase);f.flame.scale.set(.016,.036*k,.016);f.glow.scale.setScalar(.42*k)}
 if(t-lastLight>250){lastLight=t;const p=c&&c.active&&c.actor?c.actor.position:camera.position;let best=null,bd=16;for(const s of spots){if(!s.lit)continue;const d=Math.hypot(p.x-s.root.position.x,p.z-s.root.position.z);if(d<bd){bd=d;best=s}}
  candleLight.userData.target=best;if(best){candleLight.position.copy(best.root.position);candleLight.position.y+=.55}}
 candleLight.intensity=candleLight.userData.target?1.5*(.9+.1*Math.sin(time*9.7)):0;
}
requestAnimationFrame(frame);

/* ---------- Load from server.cjs (http only) and merge with this device's records ---------- */
if(!window.GARDEN_STATIC&&(location.protocol==='http:'||location.protocol==='https:'))api('GET').then(remote=>{serverOK=true;const r=cleanAll(remote);for(const id of new Set([...Object.keys(data),...Object.keys(r)]))data[id]=mergeEntry(data[id]||blank(),r[id]||blank());saveLocal();spots.forEach(renderItems);renderPanel()}).catch(()=>{serverOK=false});

window.gardenRituals={open,close,get data(){return data},spots};
})();
