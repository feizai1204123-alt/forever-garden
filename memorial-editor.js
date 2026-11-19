/* Photo → 3D memorial: create, follow generation, preview & confirm placement, edit, reset. Talks to server.cjs (http only). */
(()=>{
'use strict';
const g=window.garden,T=window.THREE;if(!g||!T)return;
const online=location.protocol!=='file:';
const slots=g.memorials.map((m,id)=>({...m,id})).filter(m=>m.group.userData.emptyMemorial);
const slotById=id=>slots.find(m=>m.id===+id);
const records={};// slot id → public record from the server (no photo data, only URLs)
const ACTIVE=['SUBMITTING','PENDING','IN_PROGRESS'];
const STATUS={SUBMITTING:'正在提交',PENDING:'排队等待生成',IN_PROGRESS:'正在生成',SUCCEEDED:'已生成，等待你确认安放',PLACED:'已安放',FAILED:'生成失败',UNKNOWN:'提交结果未确认'};
const statusText=r=>(STATUS[r.status]||r.status)+(r.status==='IN_PROGRESS'?' '+(r.progress||0)+'%':'');
const newRequestId=()=>window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)+Math.random().toString(36).slice(2,8);
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e};

/* ---------- Styles ---------- */
const style=document.createElement('style');style.textContent=`dialog{max-height:88vh;overflow:auto;font:15px/1.8 'Microsoft YaHei',sans-serif;box-shadow:0 24px 100px #171a16aa}dialog::backdrop{background:#20281dcc;backdrop-filter:blur(6px)}dialog h2{font-family:Georgia,'Microsoft YaHei',serif;letter-spacing:3px;margin:0 0 18px}dialog input:not([type=file]):not([type=range]),dialog select,dialog textarea{display:block;width:100%;margin-top:8px;padding:12px;border:1px solid #ae956b77;border-radius:10px;background:#eee1c9;color:#493c2d;font:inherit}dialog input[type=file]{max-width:100%;font-size:13px}dialog textarea{resize:vertical}dialog p{margin:14px 0}#memory-view{width:680px;max-width:94vw;border:1px solid #af966b;background:linear-gradient(140deg,#f5ebd8,#e2d4b9);color:#554839;border-radius:22px;padding:32px}#memory-view img{display:block;max-width:100%;max-height:52vh;object-fit:contain;margin:18px auto;border-radius:12px;box-shadow:0 8px 32px #745b3025}#memory-view .memory-story{white-space:pre-wrap;overflow-wrap:anywhere;line-height:2.1}#memory-view small{color:#8a7759;letter-spacing:3px}#memory-view h2{text-align:center;font-size:28px;margin:14px 0 2px}#memory-view .dates{text-align:center;color:#8a7759}#memory-view .memory-close{float:right}#memory-view .story-heading{border-top:1px solid #bca68066;padding-top:20px;margin-top:24px}dialog label{color:inherit}dialog button{margin-top:6px}
.garden-dialog{background:#37362d;color:#ffe4b4;border:1px solid #b99660;border-radius:20px;padding:24px;width:400px;max-width:95vw}.garden-dialog .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.garden-dialog .muted{color:#d9c29a;font-size:13px}.garden-dialog .warn{color:#ffd08a;background:#5a463099;border-radius:12px;padding:10px 12px;font-size:13px;white-space:pre-wrap}.garden-dialog .danger{border-color:#d98a6a88;color:#ffc9b0}
#model-preview{width:460px}#model-preview canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;border-radius:14px;background:#2b2924;touch-action:none;cursor:grab}#model-preview input[type=range]{width:100%;accent-color:#c99a55}#model-preview .facing{font-size:12px;color:#d9c29a;text-align:center;margin:6px 0 0}
#memorial-toast{position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:6;max-width:min(560px,90vw);background:#5a4630f2;border-color:#e2b96baa}#memorial-toast[hidden]{display:none}@media(max-width:600px){#memorial-toast{top:auto;bottom:250px}}`;document.head.append(style);

/* ---------- Server helper ---------- */
async function request(url,options){
 if(window.GARDEN_STATIC)throw Error('网页试玩版为只读演示，不能修改纪念');
 if(!online)throw Error('在线生成需启动 server.cjs 并打开 http://127.0.0.1:8780');
 let r;try{r=await fetch(url,options)}catch(e){throw Object.assign(Error('连接本地服务失败，请确认 server.cjs 仍在运行'),{network:true})}
 if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('请使用本地服务（8780 端口）打开游戏');
 const b=await r.json();if(!r.ok)throw Object.assign(Error(b.error||'请求失败'),{status:r.status,body:b});return b;
}
const send=(url,method,body)=>request(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
function loadOne(url){return new Promise((resolve,reject)=>{const loader=new T.GLTFLoader();if(window.MeshoptDecoder&&loader.setMeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);loader.load(url,a=>resolve(a.scene),undefined,reject)})}
// Prefer the compressed model; if this browser/loader can't read it, fall back to the original download.
function loadModel(r){const url=typeof r==='string'?r:r.model,original=typeof r==='string'?'':r.modelOriginal;return loadOne(url).catch(e=>{if(original&&original!==url){console.warn('Compressed model failed, using original',e);return loadOne(original)}throw e})}

/* ---------- Toast (gentle notice for things that need the owner) ---------- */
const toast=el('button',{id:'memorial-toast',type:'button',hidden:true});document.body.append(toast);let toastAction=null;
function showToast(text,action){toast.textContent=text;toastAction=action;toast.hidden=false}
toast.onclick=()=>{toast.hidden=true;if(toastAction)toastAction()};

/* ---------- Confirm dialog (Chinese, replaces window.confirm) ---------- */
const confirmBox=el('dialog',{className:'garden-dialog',id:'garden-confirm'});confirmBox.innerHTML='<h2>请确认</h2><p class="confirm-text" style="white-space:pre-wrap"></p><div class="row"><button type="button" value="yes" class="danger">确定</button><button type="button" value="no">再想想</button></div>';document.body.append(confirmBox);
function confirmDialog(text,yes='确定'){return new Promise(resolve=>{confirmBox.querySelector('.confirm-text').textContent=text;const [ok,no]=confirmBox.querySelectorAll('button');ok.textContent=yes;const done=v=>{confirmBox.close();resolve(v)};ok.onclick=()=>done(true);no.onclick=()=>done(false);confirmBox.oncancel=e=>{e.preventDefault();done(false)};confirmBox.showModal();no.focus()})}

/* ---------- Create dialog ---------- */
let editingId=null,requestId=null,submitting=false;
const dialog=el('dialog');dialog.style.cssText='background:#37362d;color:#ffe4b4;border:1px solid #b99660;border-radius:20px;padding:24px;width:380px;max-width:95vw';dialog.innerHTML='<h2>留下爱的纪念</h2><form><p><label>空纪念位 <select id="slot"></select></label></p><p><label>宠物名字 <input id="petname" required maxlength="24"></label></p><p class="photo-row"><label>宠物照片 <input id="photo" type="file" accept="image/png,image/jpeg,image/webp" required></label></p><p><label>出生日期 <input id="born" type="date"></label></p><p><label>离世日期 <input id="departed" type="date"></label></p><p><label>我们的故事 <textarea id="story" maxlength="4000" rows="5" placeholder="写下相遇、陪伴，以及那些不想忘记的小事…"></textarea></label></p><p class="paid-note">照片会发送到 Meshy，生成将消耗账号额度（每次提交只会扣一次）。生成好后会先给你预览，确认后才放入花园。</p><p id="generation-status" role="status"></p><button type="submit">生成纪念模型</button> <button type="button" id="close-editor">关闭</button></form>';document.body.append(dialog);
const select=dialog.querySelector('select'),status=dialog.querySelector('#generation-status'),submit=dialog.querySelector('[type=submit]');
function refreshSlotOptions(){const keep=select.value;select.textContent='';for(const m of slots){const used=!!records[m.id];select.add(new Option('纪念位 '+(m.id+1)+(used?'（已使用）':''),m.id,false,false));select.lastChild.disabled=used&&String(m.id)!==String(editingId)}if(keep&&!select.querySelector(`option[value="${keep}"]`)?.disabled)select.value=keep;else{const free=[...select.options].find(o=>!o.disabled);if(free)select.value=free.value}}
let demoMode=!!window.GARDEN_STATIC;if(online&&!demoMode)fetch('/api/config').then(r=>r.json()).then(c=>{demoMode=!!c.demo}).catch(()=>{});
function openCreate(id){if(demoMode){showToast('在线创建纪念小像暂时没有开放 · 你仍然可以在花园里散步、献花、点蜡烛和留言');return}editingId=null;requestId=newRequestId();submit.textContent='生成纪念模型';submit.disabled=false;dialog.querySelector('.photo-row').hidden=false;dialog.querySelector('.paid-note').hidden=false;dialog.querySelector('#photo').required=true;dialog.querySelector('form').reset();refreshSlotOptions();select.disabled=false;if(id!==undefined&&!records[id])select.value=String(id);status.textContent=online?'':'提示：当前是离线打开，生成功能需要用 node server.cjs 启动后访问 http://127.0.0.1:8780';g.controller?.setActive(false);dialog.showModal()}
const createButton=el('button',{textContent:'创建宠物纪念'});document.querySelector('footer').append(createButton);createButton.onclick=()=>{const p=window.gardenPet3d;if(p&&p.enabled)return p.openCreate('');openCreate()};
dialog.querySelector('#close-editor').onclick=()=>dialog.close();
dialog.querySelector('form').onsubmit=async e=>{
 e.preventDefault();if(submitting)return;submitting=true;submit.disabled=true;
 const field=id=>dialog.querySelector('#'+id).value;
 try{
  if(editingId!==null){const r=await send('/api/memorials/'+editingId,'PATCH',{name:field('petname'),born:field('born'),departed:field('departed'),story:field('story')});records[editingId]=r;refreshStone(editingId);refreshPlaque(editingId);status.textContent='纪念信息已保存';return}
  const id=select.value;if(id===''||records[id])throw Error('请选择一个空的纪念位');
  const file=dialog.querySelector('#photo').files[0];if(!file||file.size>10*1024*1024)throw Error('请选择 10 MB 以下照片');
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
  status.textContent='正在提交，请不要关闭页面…';
  let r;
  try{r=await send('/api/memorials','POST',{requestId,slot:+id,name:field('petname'),born:field('born'),departed:field('departed'),story:field('story'),image})}
  catch(err){if(err.body&&err.body.record){accept(id,err.body.record);status.textContent=err.message;requestId=newRequestId();return}
   // Network problem: keep the same requestId, so trying again can never create a second paid task.
   if(err.network)throw Error('网络中断，暂时不知道是否提交成功。再点一次「生成纪念模型」是安全的：同一次提交不会重复扣费。');throw err}
  requestId=newRequestId();accept(id,r);
  status.textContent=r.duplicate?'这次提交已经收到过了，正在继续跟进生成进度。':'已提交，正在生成。可以先关闭窗口，在花园里逛逛，生成好了会提醒你。';
 }catch(err){status.textContent=err.message}
 finally{submitting=false;submit.disabled=false}
};

/* ---------- Records → garden ---------- */
function accept(id,r){records[id]=r;refreshSlotOptions();refreshStone(id);if(r.status==='PLACED')placeInGarden(id);if(ACTIVE.includes(r.status))poll(id);if(r.status==='SUCCEEDED'&&r.model)announceReady(id);if(r.status==='FAILED'||r.status==='UNKNOWN')showToast('纪念位 '+(+id+1)+'（'+r.name+'）：'+statusText(r)+' · 点这里查看',()=>openTask(id))}
const polling=new Set();
async function poll(id){
 if(polling.has(id))return;polling.add(id);
 try{for(;;){await new Promise(r=>setTimeout(r,5000));let r;try{r=await request('/api/memorials/'+id)}catch(e){if(e.status===404){forget(id);return}continue}
  records[id]=r;if(dialog.open&&select.value===String(id))status.textContent=r.name+'：'+statusText(r);
  if(!ACTIVE.includes(r.status)){accept(id,r);return}}}
 finally{polling.delete(id)}
}
function announceReady(id){const r=records[id];const text='「'+r.name+'」的纪念模型生成好了 · 点这里预览并安放';if(!document.querySelector('dialog[open]'))openPreview(id);else showToast(text,()=>openPreview(id))}
function extras(group){return group.userData.memorialExtras||(group.userData.memorialExtras={})}
function dispose(o){if(!o)return;o.parent&&o.parent.remove(o);o.traverse(x=>{if(x.isMesh){x.geometry.dispose();for(const m of [].concat(x.material)){if(m.map)m.map.dispose();m.dispose()}}})}
function forget(id){const s=slotById(id);if(s){const ex=extras(s.group);for(const k of Object.keys(ex)){dispose(ex[k]);delete ex[k]}delete s.group.userData.storyStone;delete s.group.userData.petName;s.group.updateWorldMatrix(true,true);dispatchEvent(new CustomEvent('garden-memorial-ready',{detail:{group:s.group}}))}delete records[id];refreshSlotOptions()}
function plaqueTexture(name){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#d8bf96';ctx.fillRect(0,0,768,128);ctx.fillStyle='#493426';ctx.font='46px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(name,384,83,720);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t}
function refreshPlaque(id){const s=slotById(id),r=records[id];if(!s||!r||r.status!=='PLACED')return;const ex=extras(s.group);dispose(ex.plaque);ex.plaque=new T.Mesh(new T.PlaneGeometry(1.9,.28),new T.MeshBasicMaterial({map:plaqueTexture(r.name)}));ex.plaque.position.set(0,.3,.71);s.group.add(ex.plaque)}
const placing=new Map();
function placeInGarden(id){
 const r=records[id],s=slotById(id);if(!s||!r||!r.model)return Promise.resolve();
 const key=r.model+'@'+(r.rotation||0);if(placing.get(id)===key)return Promise.resolve();placing.set(id,key);
 return loadModel(r).then(model=>{
  if(placing.get(id)!==key)return;const ex=extras(s.group);dispose(ex.pet);
  const fit=window.fitMemorialModel(model,r.rotation||0);fit.holder.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});ex.pet=fit.holder;s.group.add(fit.holder);
  refreshPlaque(id);s.group.updateWorldMatrix(true,true);dispatchEvent(new CustomEvent('garden-memorial-ready',{detail:{group:s.group}}));
 }).catch(e=>{placing.delete(id);console.error('Memorial model failed to load',e);showToast('「'+r.name+'」的模型暂时载入失败，刷新页面再试',null)});
}
function dates(r){return (r.born||(window.gT||String)('相遇的那天'))+' — '+(r.departed||(window.gT||String)('永远在心里'))}
function lines(ctx,text,width){const out=[];for(const paragraph of text.split('\n')){let row='';for(const char of paragraph){if(ctx.measureText(row+char).width>width){out.push(row);row=char}else row+=char}out.push(row)}return out}
function refreshStone(id){
 const s=slotById(id),r=records[id];if(!s||!r)return;const group=s.group,ex=extras(group);group.userData.petName=r.name;group.userData.storyStone=true;
 dispose(ex.stone);const stoneGroup=new T.Group();ex.stone=stoneGroup;group.add(stoneGroup);
 const stone=new T.Mesh(new T.BoxGeometry(2.12,2.65,.22),new T.MeshStandardMaterial({color:0xc7b18b,roughness:.96}));stone.position.set(0,1.815,-.79);stone.castShadow=stone.receiveShadow=true;stoneGroup.add(stone);
 function surface(back){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#cfbd9d';ctx.fillRect(0,0,768,1024);ctx.strokeStyle='#a78e67';ctx.lineWidth=3;ctx.strokeRect(32,32,704,960);ctx.fillStyle='#594934';ctx.textAlign='center';ctx.font='30px Microsoft YaHei';ctx.fillText((window.gT||String)(back?'我们的故事':'永远被爱着'),384,100,680);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const plane=new T.Mesh(new T.PlaneGeometry(2.06,2.59),new T.MeshStandardMaterial({map:tex,roughness:1}));plane.position.set(0,1.815,back?-.906:-.674);if(back)plane.rotation.y=Math.PI;stoneGroup.add(plane);return {ctx,tex}}
 const front=surface(false);front.ctx.font='bold 58px Microsoft YaHei';front.ctx.fillText(r.name,384,825,670);front.ctx.font='29px Microsoft YaHei';front.ctx.fillText(dates(r),384,892,670);front.ctx.font='25px Microsoft YaHei';front.ctx.fillText((window.gT||String)('轻触，读一读我们的故事'),384,952,680);front.tex.needsUpdate=true;
 if(r.photo){const photo=new Image();photo.onload=()=>{const k=Math.min(594/photo.width,570/photo.height),w=photo.width*k,h=photo.height*k;front.ctx.drawImage(photo,(768-w)/2,180+(570-h)/2,w,h);front.tex.needsUpdate=true};photo.src=r.photo}
 const back=surface(true);back.ctx.font='31px Microsoft YaHei';back.ctx.textAlign='left';const rows=lines(back.ctx,r.story||(window.gT||String)('爱不会离开，只是开成了花。'),620);rows.slice(0,18).forEach((line,i)=>back.ctx.fillText(line,74,180+i*39));if(rows.length>18){back.ctx.font='25px Microsoft YaHei';back.ctx.fillText((window.gT||String)('轻触纪念碑，阅读完整故事…'),74,950,620)}back.tex.needsUpdate=true;
 group.updateWorldMatrix(true,true);dispatchEvent(new CustomEvent('garden-memorial-ready',{detail:{group}}));
}

/* ---------- Memory viewer (placed memorials) ---------- */
const viewer=el('dialog',{id:'memory-view'});viewer.innerHTML='<button class="memory-close" aria-label="关闭纪念页">返回花园</button><small>爱曾来过 · 永远相伴</small><h2></h2><p class="dates"></p><img alt="宠物纪念照片"><p class="story-heading">那些一起走过的日子</p><div class="memory-story"></div><p style="text-align:center;color:#8a7759">愿风带去思念，愿花记得你的名字。</p>';document.body.append(viewer);viewer.querySelector('button').onclick=()=>viewer.close();
function showMemory(id){const r=records[id];if(!r)return;g.controller?.setActive(false);viewer.querySelector('h2').textContent=r.name;viewer.querySelector('.dates').textContent=dates(r);const photo=viewer.querySelector('img');photo.hidden=!r.photo;if(r.photo)photo.src=r.photo;else photo.removeAttribute('src');viewer.querySelector('.memory-story').textContent=r.story||'有些爱，不必用言语记下。它一直在这里。';viewer.dataset.slot=String(id);viewer.showModal()}
const edit=el('button',{textContent:'补写纪念信息'});viewer.append(edit);edit.onclick=()=>{editingId=viewer.dataset.slot;const r=records[editingId];viewer.close();refreshSlotOptions();select.value=editingId;select.disabled=true;for(const [field,key] of [['petname','name'],['born','born'],['departed','departed'],['story','story']])dialog.querySelector('#'+field).value=r[key]||'';dialog.querySelector('#photo').required=false;dialog.querySelector('.photo-row').hidden=true;dialog.querySelector('.paid-note').hidden=true;submit.textContent='保存纪念信息（不重新生成）';status.textContent='';dialog.showModal()};
const turn=el('button',{textContent:'调整朝向'});turn.style.marginLeft='8px';viewer.append(turn);turn.onclick=()=>{const id=viewer.dataset.slot;viewer.close();openPreview(id)};
const ritualButton=el('button',{textContent:'献花 · 点蜡烛 · 留言'});ritualButton.style.marginLeft='8px';viewer.append(ritualButton);ritualButton.onclick=()=>{const id=viewer.dataset.slot;viewer.close();window.gardenRituals?.open('m'+id,true)};

/* ---------- Task dialog (in progress / failed / unknown) ---------- */
const task=el('dialog',{className:'garden-dialog',id:'memorial-task'});task.innerHTML='<h2></h2><p class="task-status" role="status"></p><p class="warn" hidden></p><p class="muted task-meta"></p><div class="attach" hidden><label>Meshy 任务编号（在 Meshy 控制台的任务详情里）<input class="task-id" maxlength="80" placeholder="例如 01a1e05c-064e-7060-…"></label><div class="row"><button type="button" class="do-attach">关联这个任务</button></div></div><div class="row"><button type="button" class="do-refresh">刷新状态</button><button type="button" class="do-reset danger" hidden>重置此纪念位</button><button type="button" class="do-close">关闭</button></div>';document.body.append(task);
let taskId=null;
function renderTask(){const r=records[taskId];if(!r)return task.close();task.querySelector('h2').textContent='纪念位 '+(+taskId+1)+' · '+r.name;task.querySelector('.task-status').textContent='状态：'+statusText(r);const warn=task.querySelector('.warn');warn.hidden=!r.error;warn.textContent=r.error||'';task.querySelector('.task-meta').textContent=(r.createdAt?'提交时间：'+new Date(r.createdAt).toLocaleString('zh-CN'):'')+(r.taskId?' · 任务编号：'+r.taskId:'');task.querySelector('.attach').hidden=!(r.status==='UNKNOWN'||(r.status==='FAILED'&&!r.taskId));task.querySelector('.do-reset').hidden=!['FAILED','UNKNOWN','SUCCEEDED'].includes(r.status)}
function openTask(id){if(!records[id])return;taskId=String(id);g.controller?.setActive(false);renderTask();if(!task.open)task.showModal()}
task.querySelector('.do-close').onclick=()=>task.close();
task.querySelector('.do-refresh').onclick=async()=>{try{records[taskId]=await request('/api/memorials/'+taskId);renderTask();if(ACTIVE.includes(records[taskId].status))poll(taskId);else if(records[taskId].status==='SUCCEEDED'){task.close();openPreview(taskId)}}catch(e){task.querySelector('.task-status').textContent=e.message}};
task.querySelector('.do-attach').onclick=async()=>{const v=task.querySelector('.task-id').value.trim();if(!v)return;try{const r=await send('/api/memorials/'+taskId+'/attach','POST',{taskId:v});records[taskId]=r;renderTask();poll(taskId)}catch(e){task.querySelector('.task-status').textContent=e.message}};
task.querySelector('.do-reset').onclick=()=>resetSlot(taskId,()=>task.close());
async function resetSlot(id,after){
 const r=records[id];if(!r)return;
 const text=r.status==='UNKNOWN'?'这次提交的结果还没有确认，Meshy 可能已经创建了任务并扣费。\n请先到 Meshy 控制台确认没有对应的任务，再重置。\n\n确定要重置纪念位 '+(+id+1)+'（'+r.name+'）吗？':r.status==='SUCCEEDED'?'这个模型已经生成（已消耗额度）。重置后它不会出现在花园里，但文件仍保留在 generated 文件夹。\n\n确定要放弃并重置纪念位 '+(+id+1)+' 吗？':'确定要重置纪念位 '+(+id+1)+'（'+r.name+'）吗？\n照片和记录会存档保留，纪念位变回空位，可以重新生成。';
 if(!await confirmDialog(text,'确定重置'))return;
 try{await send('/api/memorials/'+id,'DELETE');forget(id);if(after)after();showToast('纪念位 '+(+id+1)+' 已重置，可以重新创建纪念',()=>openCreate(id))}catch(e){showToast(e.message,null)}
}

/* ---------- Preview & placement confirm ---------- */
const preview=el('dialog',{className:'garden-dialog',id:'model-preview'});preview.innerHTML='<h2>看看它，满意就放进花园</h2><canvas width="640" height="480" aria-label="纪念模型预览，可左右拖动查看"></canvas><p class="facing">画面正前方就是花园小路，让它的脸朝向你；左右拖动可以转着看</p><div class="row"><button type="button" class="rot-left">↺ 向左转 90°</button><button type="button" class="rot-right">向右转 90° ↻</button></div><p><label>细调朝向 <span class="rot-value">0°</span><input type="range" class="rot" min="0" max="355" step="5" value="0"></label></p><p class="muted preview-status" role="status"></p><div class="row"><button type="button" class="do-confirm">确认放入花园</button><button type="button" class="do-cancel">取消</button><button type="button" class="do-discard danger" hidden>放弃这个模型…</button></div>';document.body.append(preview);
const pCanvas=preview.querySelector('canvas'),pRange=preview.querySelector('.rot'),pValue=preview.querySelector('.rot-value'),pStatus=preview.querySelector('.preview-status');
let pv=null;// {renderer, scene, camera, model, fit, id, yaw, raf}
function setRotation(deg){deg=window.normaliseMemorialRotation(deg);pRange.value=String(deg-deg%5);pValue.textContent=deg+'°';if(pv&&pv.model){if(pv.fit)pv.slot.remove(pv.fit.holder);pv.fit=window.fitMemorialModel(pv.model,deg);pv.slot.add(pv.fit.holder)}if(pv)pv.rotation=deg}
function buildPreviewScene(){
 const renderer=new T.WebGLRenderer({canvas:pCanvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(pCanvas.clientWidth||400,(pCanvas.clientWidth||400)*.75,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene();scene.background=new T.Color('#3b3630');scene.add(new T.HemisphereLight('#fff1dc','#4a4436',1.5));const sun=new T.DirectionalLight('#ffd9a8',2.2);sun.position.set(-2,5,4);scene.add(sun);
 const ground=new T.Mesh(new T.CircleGeometry(4,48),new T.MeshStandardMaterial({color:'#4e5a3e',roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
 const slot=new T.Group();scene.add(slot);const stone=new T.MeshStandardMaterial({color:'#9c8c7c',roughness:.95}),light=new T.MeshStandardMaterial({color:'#d2bea1',roughness:.95});
 const cube=(p,s,m)=>{const o=new T.Mesh(new T.BoxGeometry(1,1,1),m);o.position.set(...p);o.scale.set(...s);slot.add(o)};cube([0,.16,.14],[2.3,.29,1.4],stone);cube([0,.32,0],[2.3,.34,1.4],light);cube([0,1.815,-.79],[2.12,2.65,.22],light);
 const path=new T.Mesh(new T.PlaneGeometry(1.2,2.2),new T.MeshStandardMaterial({color:'#b9a27f',roughness:1}));path.rotation.x=-Math.PI/2;path.position.set(0,.005,2.1);scene.add(path);
 const camera=new T.PerspectiveCamera(34,4/3,.05,50);
 return {renderer,scene,slot,camera,yaw:0,rotation:0};
}
function drawPreview(){if(!pv)return;pv.raf=requestAnimationFrame(drawPreview);const d=5.4;pv.camera.position.set(Math.sin(pv.yaw)*d,1.9,Math.cos(pv.yaw)*d);pv.camera.lookAt(0,.95,0);pv.renderer.render(pv.scene,pv.camera)}
let drag=null;pCanvas.addEventListener('pointerdown',e=>{drag=e.clientX;pCanvas.setPointerCapture(e.pointerId)});pCanvas.addEventListener('pointermove',e=>{if(drag===null||!pv)return;pv.yaw=Math.max(-1.4,Math.min(1.4,pv.yaw-(e.clientX-drag)*.01));drag=e.clientX});pCanvas.addEventListener('pointerup',()=>{drag=null});pCanvas.addEventListener('dblclick',()=>{if(pv)pv.yaw=0});
async function openPreview(id){
 const r=records[id];if(!r||!r.model)return;g.controller?.setActive(false);toast.hidden=true;
 closePreviewScene();for(const d of document.querySelectorAll('dialog[open]'))if(d!==preview)d.close();
 const adjusting=r.status==='PLACED';preview.querySelector('h2').textContent=adjusting?'调整「'+r.name+'」的朝向':'看看「'+r.name+'」，满意就放进花园';preview.querySelector('.do-confirm').textContent=adjusting?'保存朝向':'确认放入花园';preview.querySelector('.do-discard').hidden=adjusting;
 preview.showModal();pv=buildPreviewScene();pv.id=String(id);setRotation(r.rotation||0);pStatus.textContent='正在载入模型…';drawPreview();
 try{const model=await loadModel(r);if(!pv||pv.id!==String(id))return;pv.model=model;setRotation(pv.rotation);pStatus.textContent=adjusting?'':'这个模型还没有放进花园，确认后才会安放。'}catch(e){pStatus.textContent='模型载入失败：'+(e.message||e)}
}
function closePreviewScene(){if(!pv)return;cancelAnimationFrame(pv.raf);pv.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material)){if(m.map)m.map.dispose();m.dispose()}}});pv.renderer.dispose();pv=null}
preview.addEventListener('close',closePreviewScene);
// rotation +90° turns a model that faces the path towards the viewer's right (+X).
preview.querySelector('.rot-left').onclick=()=>setRotation((pv?pv.rotation:0)-90);
preview.querySelector('.rot-right').onclick=()=>setRotation((pv?pv.rotation:0)+90);
pRange.oninput=()=>setRotation(+pRange.value);
preview.querySelector('.do-cancel').onclick=()=>{const r=records[pv&&pv.id];preview.close();if(r&&r.status==='SUCCEEDED')showToast('「'+r.name+'」还在等你确认 · 点这里继续预览',()=>openPreview(pv?pv.id:taskIdFor(r)))};
const taskIdFor=r=>Object.keys(records).find(k=>records[k]===r);
preview.querySelector('.do-confirm').onclick=async()=>{if(!pv)return;const id=pv.id,rotation=pv.rotation,btn=preview.querySelector('.do-confirm');btn.disabled=true;
 try{const r=await send('/api/memorials/'+id+'/confirm','POST',{rotation});records[id]=r;preview.close();await placeInGarden(id);showToast('「'+r.name+'」已经安放在纪念位 '+(+id+1)+' · 点这里去看看',()=>showMemory(id))}catch(e){pStatus.textContent=e.message}finally{btn.disabled=false}};
preview.querySelector('.do-discard').onclick=()=>{const id=pv&&pv.id;if(id!==undefined&&id!==null)resetSlot(id,()=>preview.close())};

/* ---------- Clicking a pedestal ---------- */
function onSlot(id){const r=records[id];if(!r)return openCreate(id);if(r.status==='PLACED')return showMemory(id);if(r.status==='SUCCEEDED'&&r.model)return openPreview(id);return openTask(id)}
const ray=new T.Raycaster();let down;g.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);g.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||document.querySelector('dialog[open]'))return;const rect=g.renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),g.camera);const hit=ray.intersectObjects(slots.map(m=>m.group),true)[0];if(hit){const m=slots.find(m=>{let p=hit.object;while(p){if(p===m.group)return true;p=p.parent}});if(m)onSlot(m.id)}});

(window.GARDEN_STATIC?fetch('memorials.json').then(r=>r.json()):online?request('/api/memorials'):Promise.reject()).then(all=>{for(const [id,r] of Object.entries(all))accept(id,r)}).catch(()=>{});
window.gardenMemorials={records,openPreview,openTask,openCreate};
})();
