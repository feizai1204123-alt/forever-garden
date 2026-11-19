/* Upload a pet photo → Meshy 3D, then place it on an empty memorial. Talks only to the Supabase
   Edge Function "pet3d" (see supabase/functions/pet3d/index.ts). Hidden until GARDEN_SHARED.pet3d
   is true, or ?pet3d=1 is in the URL. */
(()=>{'use strict';
const g=window.garden,T=window.THREE,SH=window.GARDEN_SHARED||{};
if(!g||!T)return;
const qs=new URLSearchParams(location.search);
const enabled=!!(SH.url&&SH.key&&/^https:\/\//.test(SH.url)&&(qs.get('pet3d')==='1'||(SH.pet3d&&qs.get('pet3d')!=='0')));
const btn=document.getElementById('pet-upload');
if(!enabled){if(btn)btn.hidden=true;return}

const FN=SH.url.replace(/\/+$/,'')+'/functions/v1/pet3d';
const PUBLIC=SH.url.replace(/\/+$/,'')+'/storage/v1/object/public/pet3d/';
const STORE_DEV='pmg-device-id',STORE_MINE='pmg-pet3d-mine-v1';
const MAX_BYTES=1024*1024,POLL_MS=4000;
const STATUS={queued:'正在提交',pending:'排队等待生成',in_progress:'正在生成',succeeded:'已生成，等待你确认安放',placed:'已安放',failed:'生成失败'};
const MESSAGES={
 daily_limit:'今天这台设备已经生成过一次了，明天再来吧。每天限 1 次。',
 ip_limit:'今天这个网络已经生成过一次了，明天再来吧。每天限 1 次。',
 month_limit:'这个月的生成额度已经用完了（每月最多大约 20 只小像），下个月再来吧。',
 spot_taken:'这个纪念位已经有小像了，换一个空位吧。',
 bad_image:'请上传 1 MB 以内的 jpg、png 或 webp 照片。',
 bad_spot:'请选择一个空着的纪念位。',
 bad_name:'请给它起一个 1 到 24 个字的名字。',
 bad_device:'这台设备暂时不能生成。请刷新页面再试。',
 has_link:'名字或故事里不能放链接、网址或一长串数字。',
 too_long:'故事最多 2000 字。',
 no_key:'管理员还没有配置生成密钥，请稍后再试。',
 meshy_error:'生成没有成功。请明天再试，或换一张更清晰的照片。',
 not_found:'没有找到这次生成。',
 not_yours:'只能查看或确认自己提交的小像。',
 not_ready:'小像还在生成中，请再等一会儿。',
 expired:'上次提交没有发出去，请重新上传。',
 busy:'花园有点忙，请稍后再试。',
 offline:'暂时连不上花园服务，请检查网络后再试。'
};
const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
const readLS=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const writeLS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
let device=String(readLS(STORE_DEV,'')||'');if(!/^[A-Za-z0-9_-]{8,64}$/.test(device)){device=uuid();writeLS(STORE_DEV,device)}
let mine=(Array.isArray(readLS(STORE_MINE,[]))?readLS(STORE_MINE,[]):[]).filter(x=>x&&typeof x.id==='string').slice(-20);
const saveMine=()=>writeLS(STORE_MINE,mine);
const remember=job=>{if(!job||!job.id)return;const rest=mine.filter(x=>x.id!==job.id);mine=[{id:job.id,spot:job.spot,status:job.status,name:job.name,at:Date.now()},...rest].slice(0,20);saveMine()};

const slots=g.memorials.map((m,id)=>({...m,id,spot:'m'+id})).filter(m=>m.group.userData.emptyMemorial);
const slotBySpot=spot=>slots.find(s=>s.spot===spot);
const jobs=new Map();// spot → public job (placed ones + mine)
const extras=new WeakMap();
function ex(group){let o=extras.get(group);if(!o){o={};extras.set(group,o)}return o}
function dispose(obj){if(!obj)return;obj.parent&&obj.parent.remove(obj);obj.traverse(o=>{if(o.isMesh){o.geometry&&o.geometry.dispose();for(const m of [].concat(o.material||[])){if(!m)continue;if(m.map)m.map.dispose();m.dispose()}}})}

const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e};
const style=document.createElement('style');
style.textContent=`#pet-upload{display:inline-block}#pet3d-dialog,#pet3d-preview,#pet3d-memory{background:#37362d;color:#ffe4b4;border:1px solid #b99660;border-radius:20px;padding:22px 22px 18px;width:420px;max-width:94vw;max-height:88vh;overflow:auto;font:15px/1.75 'Microsoft YaHei',sans-serif;box-shadow:0 24px 100px #171a16aa;display:flex;flex-direction:column}#pet3d-dialog::backdrop,#pet3d-preview::backdrop,#pet3d-memory::backdrop{background:#20281dcc;backdrop-filter:blur(6px)}#pet3d-dialog h2,#pet3d-preview h2,#pet3d-memory h2{font-family:Georgia,'Microsoft YaHei',serif;letter-spacing:3px;margin:0 0 14px;font-weight:400;font-size:22px}#pet3d-dialog label{display:block;margin:10px 0 0;color:#f6e4c4}#pet3d-dialog input:not([type=file]),#pet3d-dialog select,#pet3d-dialog textarea{display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #ae956b77;border-radius:10px;background:#eee1c9;color:#493c2d;font:inherit}#pet3d-dialog textarea{resize:vertical;min-height:4.5em}#pet3d-dialog input[type=file]{max-width:100%;font-size:13px;color:#f6e4c4;margin-top:6px}#pet3d-dialog .hint{color:#d9c29a;font-size:12px;margin:10px 0 0;line-height:1.65}#pet3d-dialog .row,#pet3d-preview .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}#pet3d-dialog .status,#pet3d-preview .status{min-height:1.4em;color:#ffd08a;white-space:pre-wrap}#pet3d-preview canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;border-radius:14px;background:#2b2924;touch-action:none;cursor:grab}#pet3d-preview input[type=range]{width:100%;accent-color:#c99a55}#pet3d-preview .facing{font-size:12px;color:#d9c29a;text-align:center;margin:6px 0 0}#pet3d-memory{width:560px;background:linear-gradient(140deg,#f5ebd8,#e2d4b9);color:#554839;border-color:#af966b}#pet3d-memory h2{text-align:center;color:#493c2d;margin:10px 0 2px}#pet3d-memory .dates{text-align:center;color:#8a7759}#pet3d-memory img{display:block;max-width:100%;max-height:42vh;object-fit:contain;margin:14px auto;border-radius:12px;box-shadow:0 8px 32px #745b3025}#pet3d-memory .story{white-space:pre-wrap;overflow-wrap:anywhere;line-height:2}#pet3d-toast{position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:7;max-width:min(560px,90vw);background:#5a4630f2;border:1px solid #e2b96baa;border-radius:24px;color:#f6dcae;padding:11px 17px;font:12px 'Microsoft YaHei',sans-serif;box-shadow:0 5px 24px #633d1912}#pet3d-toast[hidden]{display:none}#pet3d-preview-thumb{display:block;max-width:100%;max-height:160px;margin:8px auto 0;border-radius:12px}#pet3d-photo-preview{display:none;max-width:100%;max-height:120px;margin:8px 0 0;border-radius:10px;object-fit:contain}#pet3d-dialog:not([open]),#pet3d-preview:not([open]),#pet3d-memory:not([open]){display:none}footer #pet-upload::before,footer #create-memorial::before{content:"✿ "}#pet3d-dialog>*,#pet3d-preview>*,#pet3d-memory>*{flex-shrink:0}#pet3d-dialog form p{margin:0 0 4px}#pet3d-dialog .pick-label{display:block;margin:10px 0 0;color:#f6e4c4}#pet3d-dialog .photo-pick{position:relative;display:flex;align-items:center;gap:12px;min-height:92px;margin:6px 0 0;padding:10px 14px;border:2px dashed #c9a46aaa;border-radius:14px;background:#2c2b24;color:#f6e4c4;cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent}#pet3d-dialog .photo-pick:active{background:#3a382f}#pet3d-dialog .photo-pick.has{border-style:solid;border-color:#b99660}#pet3d-dialog .photo-pick.need{border-color:#ffb36b;box-shadow:0 0 0 3px #ffb36b44}#pet3d-dialog .photo-pick input[type=file]{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;font-size:16px;z-index:2}#pet3d-dialog .photo-pick #pet3d-photo-preview{margin:0;max-height:72px;max-width:96px;flex:none}#pet3d-dialog .pick-copy{display:flex;flex-direction:column;gap:2px;line-height:1.4}#pet3d-dialog .pick-copy b{font-weight:600;font-size:15px}#pet3d-dialog .pick-copy small{font-size:11.5px;color:#cdb68e}#pet3d-dialog>.row{position:sticky;bottom:0;z-index:3;background:#37362d;margin:8px -16px 0;padding:8px 16px 10px;border-top:1px solid #b9966033}#pet3d-dialog input,#pet3d-dialog select,#pet3d-dialog textarea{font-size:16px}html.kb-open #pet3d-dialog[open]{margin-top:calc(var(--vvtop,0px) + 6px);margin-bottom:auto;max-height:calc(var(--vvh,100vh) - 12px)}
@media(max-height:420px){#pet3d-dialog,#pet3d-preview,#pet3d-memory{max-height:94vh;padding:12px 16px}#pet3d-dialog h2{margin-bottom:6px;font-size:20px}#pet3d-dialog label{margin-top:6px}}
@media(orientation:landscape) and (max-height:500px){
 #pet3d-dialog{width:min(720px,96vw);max-height:94vh;max-height:calc(var(--vvh,100vh) - 12px);padding:10px 16px 0;display:block;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
 #pet3d-dialog h2{margin:0 0 4px;font-size:20px;flex:none}
 #pet3d-form{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
 #pet3d-dialog .photo-pick{min-height:72px}
 #pet3d-form .wide{grid-column:1/-1}
 #pet3d-dialog label{margin-top:6px}
 #pet3d-dialog .hint{margin-top:6px;font-size:11px}
 #pet3d-dialog .row{margin-top:6px}
 #pet3d-photo-preview{max-height:56px}
 #pet3d-preview{width:min(640px,96vw)}
}
@media(max-width:600px){#pet3d-toast{top:auto;bottom:250px}}`;
document.head.append(style);

/* ---------- Network ---------- */
async function call(action,payload,timeoutMs){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs||20000);
 try{
  const r=await fetch(FN,{method:'POST',headers:{apikey:SH.key,Authorization:'Bearer '+SH.key,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action,device},payload||{})),signal:ctl.signal,cache:'no-store'});
  let b=null;try{b=await r.json()}catch(_){}
  if(!b||typeof b!=='object')throw Object.assign(Error('offline'),{code:'offline'});
  if(!r.ok||b.ok===false){const err=Error(MESSAGES[b.error]||b.message||b.error||'请求失败');err.code=b.error||'busy';err.job=b.job;throw err}
  return b;
 }catch(e){
  if(e&&e.code)throw e;
  const err=Error(MESSAGES.offline);err.code='offline';throw err;
 }finally{clearTimeout(timer)}
}
function modelUrl(job){return job&&(job.model_url||(job.model_path?PUBLIC+job.model_path:null))}
function loadOne(url){return new Promise((resolve,reject)=>{const loader=new T.GLTFLoader();if(window.MeshoptDecoder&&loader.setMeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);loader.load(url,a=>resolve(a.scene),undefined,reject)})}

/* ---------- Compress photo to ≤1MB jpeg ---------- */
function compress(file){
 return new Promise((resolve,reject)=>{
  if(!file)return reject(Object.assign(Error(MESSAGES.bad_image),{code:'bad_image'}));
  if(file.type&&!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type))return reject(Object.assign(Error('请选择 jpg、png 或 webp 照片（iPhone 请选「最兼容」或把实况照片转成 jpg）。'),{code:'bad_image'}));
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   URL.revokeObjectURL(url);
   if(img.width<32||img.height<32)return reject(Object.assign(Error('照片太小了，请换一张更清晰的。'),{code:'bad_image'}));
   const max=1280,scale=Math.min(1,max/img.width,max/img.height);
   const w=Math.max(32,Math.round(img.width*scale)),h=Math.max(32,Math.round(img.height*scale));
   const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
   const qualities=[0.86,0.74,0.62,0.5,0.4];
   const next=i=>{
    c.toBlob(blob=>{
     if(!blob)return reject(Object.assign(Error(MESSAGES.bad_image),{code:'bad_image'}));
     if(blob.size>MAX_BYTES&&i<qualities.length-1)return next(i+1);
     if(blob.size>MAX_BYTES)return reject(Object.assign(Error('照片还是太大了，请换一张更小的，或裁掉背景后再试。'),{code:'bad_image'}));
     const reader=new FileReader();reader.onload=()=>resolve({dataUri:reader.result,blob,width:w,height:h});reader.onerror=()=>reject(Object.assign(Error(MESSAGES.bad_image),{code:'bad_image'}));reader.readAsDataURL(blob);
    },'image/jpeg',qualities[i]);
   };
   next(0);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Object.assign(Error('这张照片打不开，请换一张 jpg 或 png。'),{code:'bad_image'}))};
  img.src=url;
 });
}

/* ---------- Toast ---------- */
const toast=el('button',{id:'pet3d-toast',type:'button',hidden:true});document.body.append(toast);
let toastAction=null;
function showToast(text,action){toast.textContent=text;toastAction=action||null;toast.hidden=false}
toast.onclick=()=>{toast.hidden=true;if(toastAction)toastAction()};

/* ---------- Plaque + story stone + model ---------- */
function plaqueTexture(name){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#d8bf96';ctx.fillRect(0,0,768,128);ctx.fillStyle='#493426';ctx.font='46px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(name,384,83,720);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t}
function dates(r){return (r.born||(window.gT||String)('相遇的那天'))+' — '+(r.departed||(window.gT||String)('永远在心里'))}
function lines(ctx,text,width){const out=[];for(const paragraph of String(text||'').split('\n')){let row='';for(const char of paragraph){if(ctx.measureText(row+char).width>width){out.push(row);row=char}else row+=char}out.push(row)}return out}
function refreshStone(job){
 const s=slotBySpot(job.spot);if(!s)return;const group=s.group,x=ex(group);
 group.userData.petName=job.name;group.userData.storyStone=true;
 dispose(x.stone);const stoneGroup=new T.Group();x.stone=stoneGroup;group.add(stoneGroup);
 const stone=new T.Mesh(new T.BoxGeometry(2.12,2.65,.22),new T.MeshStandardMaterial({color:0xc7b18b,roughness:.96}));stone.position.set(0,1.815,-.79);stone.castShadow=stone.receiveShadow=true;stoneGroup.add(stone);
 function surface(back){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#cfbd9d';ctx.fillRect(0,0,768,1024);ctx.strokeStyle='#a78e67';ctx.lineWidth=3;ctx.strokeRect(32,32,704,960);ctx.fillStyle='#594934';ctx.textAlign='center';ctx.font='30px Microsoft YaHei';ctx.fillText((window.gT||String)(back?'我们的故事':'永远被爱着'),384,100,680);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const plane=new T.Mesh(new T.PlaneGeometry(2.06,2.59),new T.MeshStandardMaterial({map:tex,roughness:1}));plane.position.set(0,1.815,back?-.906:-.674);if(back)plane.rotation.y=Math.PI;stoneGroup.add(plane);return {ctx,tex}}
 const front=surface(false);front.ctx.font='bold 58px Microsoft YaHei';front.ctx.fillText(job.name,384,825,670);front.ctx.font='29px Microsoft YaHei';front.ctx.fillText(dates(job),384,892,670);front.ctx.font='25px Microsoft YaHei';front.ctx.fillText((window.gT||String)('轻触，读一读我们的故事'),384,952,680);front.tex.needsUpdate=true;
 if(job.thumb_url){const photo=new Image();photo.crossOrigin='anonymous';photo.onload=()=>{const k=Math.min(594/photo.width,570/photo.height),w=photo.width*k,h=photo.height*k;front.ctx.drawImage(photo,(768-w)/2,180+(570-h)/2,w,h);front.tex.needsUpdate=true};photo.src=job.thumb_url}
 const back=surface(true);back.ctx.font='31px Microsoft YaHei';back.ctx.textAlign='left';const rows=lines(back.ctx,job.story||(window.gT||String)('爱不会离开，只是开成了花。'),620);rows.slice(0,18).forEach((line,i)=>back.ctx.fillText(line,74,180+i*39));back.tex.needsUpdate=true;
}
const placing=new Map();
function placeInGarden(job){
 const s=slotBySpot(job.spot),url=modelUrl(job);if(!s||!url)return Promise.resolve();
 const key=url+'@'+(job.rotation||0);if(placing.get(job.spot)===key)return Promise.resolve();placing.set(job.spot,key);
 refreshStone(job);
 dispose(ex(s.group).plaque);
 const plaque=new T.Mesh(new T.PlaneGeometry(1.9,.28),new T.MeshBasicMaterial({map:plaqueTexture(job.name)}));plaque.position.set(0,.3,.71);ex(s.group).plaque=plaque;s.group.add(plaque);
 return loadOne(url).then(model=>{
  if(placing.get(job.spot)!==key)return;const x=ex(s.group);dispose(x.pet);
  const fit=window.fitMemorialModel(model,job.rotation||0);fit.holder.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});x.pet=fit.holder;s.group.add(fit.holder);
  s.group.updateWorldMatrix(true,true);dispatchEvent(new CustomEvent('garden-memorial-ready',{detail:{group:s.group}}));
 }).catch(e=>{placing.delete(job.spot);console.error('pet3d model failed',e);showToast('「'+job.name+'」的小像暂时载入失败，刷新页面再试',null)});
}

/* ---------- Memory page ---------- */
const memory=el('dialog',{id:'pet3d-memory'});memory.innerHTML='<button type="button" class="memory-close" aria-label="关闭纪念页">返回花园</button><small style="letter-spacing:3px;color:#8a7759">爱曾来过 · 永远相伴</small><h2></h2><p class="dates"></p><img alt="宠物小像预览"><p style="border-top:1px solid #bca68066;padding-top:16px;margin-top:18px;letter-spacing:2px;color:#8a7759">那些一起走过的日子</p><div class="story"></div><p style="text-align:center;color:#8a7759">愿风带去思念，愿花记得你的名字。</p>';
document.body.append(memory);memory.querySelector('button').onclick=()=>memory.close();
function showMemory(job){if(!job)return;memory.querySelector('h2').textContent=job.name;memory.querySelector('.dates').textContent=dates(job);const img=memory.querySelector('img');if(job.thumb_url){img.hidden=false;img.src=job.thumb_url}else{img.hidden=true;img.removeAttribute('src')}memory.querySelector('.story').textContent=job.story||'有些爱，不必用言语记下。它一直在这里。';try{memory.showModal()}catch(_){}}

/* ---------- Create / progress dialog ---------- */
const dialog=el('dialog',{id:'pet3d-dialog'});
dialog.innerHTML='<h2>留下爱的纪念</h2><form id="pet3d-form" novalidate><p><label>空纪念位 <select id="pet3d-slot"></select></label></p><p><label>宠物名字 <input id="pet3d-name" maxlength="24" placeholder="它的名字"></label></p><p class="wide pick-wrap"><span class="pick-label">宠物照片</span><label class="photo-pick" id="pet3d-pick"><input id="pet3d-photo" type="file" accept="image/jpeg,image/png,image/webp,image/jpg" aria-label="宠物照片"><img id="pet3d-photo-preview" alt="预览"><span class="pick-copy"><b class="pick-text">📷 轻触这里，选择一张宠物照片</b><small>jpg / png / webp · 清晰的正脸或全身照最好</small></span></label></p><p><label>出生日期 <input id="pet3d-born" type="date"></label></p><p><label>离世日期 <input id="pet3d-departed" type="date"></label></p><p class="wide"><label>我们的故事 <textarea id="pet3d-story" maxlength="2000" rows="3" placeholder="写下相遇、陪伴，以及那些不想忘记的小事…"></textarea></label></p><p class="hint wide">照片会在手机上先压到 1 MB 以内。生成一只带颜色的低面数小像，大约 15 个额度；每台设备每天限 1 次。确认安放后，所有来花园的人都能看见它。</p><p class="status wide" id="pet3d-status" role="status"></p></form><div class="row"><button type="submit" form="pet3d-form" id="pet3d-submit">生成纪念小像</button><button type="button" id="pet3d-close">关闭</button></div>';
document.body.append(dialog);
const form=dialog.querySelector('#pet3d-form'),select=dialog.querySelector('#pet3d-slot'),photoInput=dialog.querySelector('#pet3d-photo'),photoPrev=dialog.querySelector('#pet3d-photo-preview'),pick=dialog.querySelector('#pet3d-pick'),pickText=dialog.querySelector('.pick-text'),statusEl=dialog.querySelector('#pet3d-status'),submit=dialog.querySelector('#pet3d-submit');
dialog.querySelector('#pet3d-close').onclick=()=>dialog.close();
function freeSlots(){return slots.filter(s=>{const j=jobs.get(s.spot);return !j||j.status==='failed'})}
function refreshOptions(preferred){const cur=preferred||select.value;select.textContent='';const free=freeSlots();if(!free.length){select.append(new Option('暂时没有空位',''));return}for(const s of free)select.append(new Option('纪念位 '+(s.id+1),s.spot));if(cur&&[...select.options].some(o=>o.value===cur))select.value=cur}
photoInput.onchange=()=>{const f=photoInput.files&&photoInput.files[0];pick.classList.remove('need');if(!f){photoPrev.style.display='none';pick.classList.remove('has');pickText.textContent='📷 轻触这里，选择一张宠物照片';return}pick.classList.add('has');pickText.textContent='已选好照片 · 轻触可以换一张';if(statusEl.dataset.need){statusEl.textContent='';delete statusEl.dataset.need}const url=URL.createObjectURL(f);photoPrev.onload=()=>URL.revokeObjectURL(url);photoPrev.src=url;photoPrev.style.display='block'};
function setBusy(on,text){submit.disabled=!!on;photoInput.disabled=!!on;select.disabled=!!on;if(text!=null)statusEl.textContent=text}
let submitting=false,polling=new Set();

async function poll(id){
 if(polling.has(id))return;polling.add(id);
 try{
  for(;;){
   let res;try{res=await call('status',{client_id:id})}catch(e){if(e.code==='not_found'||e.code==='not_yours')return;await new Promise(r=>setTimeout(r,POLL_MS));continue}
   const job=res.job;if(!job)return;
   remember(job);if(job.spot)jobs.set(job.spot,job);
   if(dialog.open&&currentPoll===id){statusEl.textContent=(STATUS[job.status]||job.status)+(job.status==='in_progress'?' '+(job.progress||0)+'%':'')}
   if(job.status==='succeeded'){if(dialog.open)dialog.close();openPreview(job);return}
   if(job.status==='placed'){await placeInGarden(job);showToast('「'+job.name+'」已经在花园里了',()=>showMemory(job));return}
   if(job.status==='failed'){setBusy(false,job.error||MESSAGES.meshy_error);showToast('「'+(job.name||'小像')+'」生成失败：'+(job.error||MESSAGES.meshy_error),null);return}
   await new Promise(r=>setTimeout(r,POLL_MS));
  }
 }finally{polling.delete(id)}
}
let currentPoll=null;

form.onsubmit=async ev=>{
 ev.preventDefault();if(submitting)return;
 const name=form.querySelector('#pet3d-name').value.trim();
 const spot=select.value,born=form.querySelector('#pet3d-born').value,departed=form.querySelector('#pet3d-departed').value,story=form.querySelector('#pet3d-story').value;
 const file=photoInput.files&&photoInput.files[0];
 if(!file){statusEl.textContent='请先选择一张宠物照片。';statusEl.dataset.need='1';pickText.textContent='📷 请先选择一张宠物照片（轻触这里）';pick.classList.add('need');try{pick.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_){}return}
 if(!spot){statusEl.textContent=MESSAGES.bad_spot;return}
 if(!name){statusEl.textContent=MESSAGES.bad_name;return}
 if(born&&departed&&born>departed){statusEl.textContent='离世日期不能早于出生日期。';return}
 submitting=true;setBusy(true,'正在压缩照片…');
 try{
  const compressed=await compress(file);
  setBusy(true,'正在提交，开始生成小像…这可能需要一两分钟。');
  const client_id=uuid();
  const res=await call('create',{client_id,spot,name,born,departed,story,image:compressed.dataUri},45000);
  const job=res.job;remember(job);jobs.set(job.spot,job);currentPoll=job.id;
  setBusy(true,(STATUS[job.status]||'已提交')+'，请稍候…');
  if(job.status==='succeeded'){dialog.close();openPreview(job);return}
  if(job.status==='failed'){setBusy(false,job.error||MESSAGES.meshy_error);return}
  await poll(job.id);
 }catch(e){if(e.code==='month_limit')try{localStorage.setItem(CAP_KEY,month())}catch(_){}setBusy(false,e.message||MESSAGES.offline)}
 finally{submitting=false}
};

function openCreate(spot){
 refreshOptions(spot||'');statusEl.textContent='';setBusy(false,'');
 submit.textContent='生成纪念小像';photoInput.required=false;pickText.textContent='📷 轻触这里，选择一张宠物照片';pick.classList.remove('need','has');photoInput.value='';photoPrev.style.display='none';
 try{dialog.showModal()}catch(_){}
}

/* ---------- Preview & confirm ---------- */
const preview=el('dialog',{id:'pet3d-preview'});
preview.innerHTML='<h2>预览小像</h2><canvas id="pet3d-canvas" width="640" height="480"></canvas><img id="pet3d-preview-thumb" alt="" hidden><p class="facing" id="pet3d-facing"></p><p><label>朝向 <input id="pet3d-rot" type="range" min="0" max="270" step="90" value="0"></label></p><div class="row"><button type="button" class="rot-left">向左转</button><button type="button" class="rot-right">向右转</button></div><p class="status" id="pet3d-pstatus" role="status"></p><div class="row"><button type="button" class="do-confirm">安放到花园</button><button type="button" class="do-cancel">稍后决定</button></div>';
document.body.append(preview);
const pCanvas=preview.querySelector('#pet3d-canvas'),pRange=preview.querySelector('#pet3d-rot'),pStatus=preview.querySelector('#pet3d-pstatus'),pFacing=preview.querySelector('#pet3d-facing'),pThumb=preview.querySelector('#pet3d-preview-thumb');
const facingText=deg=>{const d=((deg%360)+360)%360;return d===0?'现在正对小路 / 来看它的人':d===90?'现在朝向你的右手边':d===180?'现在背对小路':d===270?'现在朝向你的左手边':'朝向 '+d+'°'};
let pv=null;
function setRotation(deg){if(!pv)return;deg=((Math.round(deg)%360)+360)%360;pv.rotation=deg;pRange.value=String(deg);if(pv.pivot&&window.normaliseMemorialRotation){pv.pivot.rotation.y=window.normaliseMemorialRotation(deg)*Math.PI/180}pFacing.textContent=facingText(deg)}
function closePreviewScene(){if(!pv)return;cancelAnimationFrame(pv.raf);if(pv.scene)pv.scene.traverse(o=>{if(o.isMesh){o.geometry&&o.geometry.dispose();for(const m of [].concat(o.material||[])){if(!m)continue;if(m.map)m.map.dispose();m.dispose()}}});if(pv.renderer)pv.renderer.dispose();pv=null}
preview.addEventListener('close',closePreviewScene);
function drawPreview(){if(!pv)return;pv.model&&(pv.model.rotation.y+=0.003);pv.renderer.render(pv.scene,pv.camera);pv.raf=requestAnimationFrame(drawPreview)}
function buildPreviewScene(){
 closePreviewScene();
 const renderer=new T.WebGLRenderer({canvas:pCanvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(pCanvas.width,pCanvas.height,false);renderer.setClearColor(0x2b2924,1);
 const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff1d2','#3a3428',1));const key=new T.DirectionalLight('#ffd9a0',1.4);key.position.set(-2,3,3);scene.add(key);
 const camera=new T.PerspectiveCamera(35,pCanvas.width/pCanvas.height,.1,50);camera.position.set(0,1.2,3.2);camera.lookAt(0,.6,0);
 pv={renderer,scene,camera,model:null,pivot:null,rotation:0,job:null,raf:0};drawPreview();
}
async function openPreview(job){
 buildPreviewScene();pv.job=job;pv.rotation=job.rotation||0;setRotation(pv.rotation);
 pStatus.textContent='正在载入小像…';pThumb.hidden=!job.thumb_url;if(job.thumb_url)pThumb.src=job.thumb_url;
 try{preview.showModal()}catch(_){}
 try{
  const model=await loadOne(modelUrl(job));
  if(!pv||pv.job!==job)return;
  const fit=window.fitMemorialModel(model,pv.rotation||0);
  // Show the fitted model centred in the preview: lift the holder so the pedestal offset doesn't matter.
  fit.holder.position.y-=0.2;pv.scene.add(fit.holder);pv.model=fit.holder;pv.pivot=fit.pivot;setRotation(pv.rotation);
  pStatus.textContent='这个小像还没有放进花园。转一转朝向，确认后所有来访的人都能看见它。';
 }catch(e){pStatus.textContent='模型载入失败：'+(e.message||e)}
}
preview.querySelector('.rot-left').onclick=()=>setRotation((pv?pv.rotation:0)-90);
preview.querySelector('.rot-right').onclick=()=>setRotation((pv?pv.rotation:0)+90);
pRange.oninput=()=>setRotation(+pRange.value);
preview.querySelector('.do-cancel').onclick=()=>{const job=pv&&pv.job;preview.close();if(job)showToast('「'+job.name+'」还在等你确认 · 点这里继续预览',()=>openPreview(job))};
preview.querySelector('.do-confirm').onclick=async()=>{
 if(!pv||!pv.job)return;const job=pv.job,rotation=pv.rotation,btn=preview.querySelector('.do-confirm');btn.disabled=true;pStatus.textContent='正在安放…';
 try{const res=await call('place',{client_id:job.id,rotation});const next=res.job;remember(next);jobs.set(next.spot,next);preview.close();await placeInGarden(next);showToast('「'+next.name+'」已经安放在纪念位 · 点这里去看看',()=>showMemory(next))}
 catch(e){pStatus.textContent=e.message||MESSAGES.offline}finally{btn.disabled=false}
};

/* ---------- Open + click handling (capture, so we take over empty pedestals from memorial-editor) ---------- */
if(btn){btn.hidden=true;btn.style.display='none'}// one footer button: memorial-editor's「创建宠物纪念」routes here via gardenPet3d.openCreate
const CAP_KEY='pmg-pet3d-cap',month=()=>new Date().toISOString().slice(0,7);
function capReached(){try{return localStorage.getItem(CAP_KEY)===month()}catch(_){return false}}
function openCreateChecked(spot){if(capReached()){showToast(MESSAGES.month_limit,null);return}openCreate(spot)}
function jobForGroup(group){const s=slots.find(s=>s.group===group);return s?jobs.get(s.spot):null}
const canvas=g.renderer.domElement;let down=null;
canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||document.querySelector('dialog[open]'))return;
 const rect=canvas.getBoundingClientRect();
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),g.camera);
 const hit=ray.intersectObjects(slots.map(s=>s.group),true)[0];if(!hit)return;
 const s=slots.find(s=>{let p=hit.object;while(p){if(p===s.group)return true;p=p.parent}});if(!s)return;
 const job=jobs.get(s.spot);
 e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
 if(!job||job.status==='failed')openCreateChecked(s.spot);
 else if(job.status==='placed')showMemory(job);
 else if(job.status==='succeeded')openPreview(job);
 else {showToast('「'+(job.name||'小像')+'」'+(STATUS[job.status]||'正在生成'),()=>openCreate(s.spot));if(['queued','pending','in_progress'].includes(job.status))poll(job.id)}
},true);

/* ---------- Load everyone's placed pets, and resume my in-flight job ---------- */
(async()=>{
 try{
  const res=await call('list',{},12000);
  for(const job of res.jobs||[]){jobs.set(job.spot,job);placeInGarden(job)}
 }catch(e){/* function or schema not installed yet — stay quiet, the button still explains on submit */}
 for(const m of mine){
  if(!m.id)continue;
  try{
   const res=await call('status',{client_id:m.id});
   const job=res.job;if(!job)continue;remember(job);jobs.set(job.spot,job);
   if(job.status==='placed')placeInGarden(job);
   else if(job.status==='succeeded')showToast('「'+job.name+'」已经生成好了 · 点这里预览并安放',()=>openPreview(job));
   else if(job.status==='queued'||job.status==='pending'||job.status==='in_progress'){showToast('「'+job.name+'」还在生成中',()=>{});poll(job.id)}
  }catch(_){}
 }
})();

window.gardenPet3d={enabled:true,slots,jobs,openCreate:openCreateChecked,openPreview};
})();
