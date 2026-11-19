/* User character: in-place skeletal animation, camera-relative movement, collisions. */
window.createGardenCharacter=function(api){
 'use strict';
 const T=THREE,{scene,camera,renderer,memorials,parkSpacing,walkRoutes,walkAreas,solidObjects}=api;
 const button=document.getElementById('character'),status=document.getElementById('character-status');
 const pad=document.getElementById('joystick'),hint=document.getElementById('hint');
 const actor=new T.Group();actor.name='UserControlledCharacter';actor.position.set(0,.13,14.2);scene.add(actor);
 let model,mixer,actions={},currentAction,currentName='',ready=false,active=false,speed=0,idleTime=0;
 const keys=new Set(),touchKeys=new Set(),velocity=new T.Vector3(),forward=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(0,1,0),desired=new T.Vector3();
 const radius=.44,obstacles=[];
 scene.updateMatrixWorld(true);
 const memorialBounds=new Map();
 function refreshMemorial(group){group.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(group);let bound=memorialBounds.get(group);if(!bound){bound={};memorialBounds.set(group,bound);obstacles.push(bound);}Object.assign(bound,{minX:b.min.x-radius,maxX:b.max.x+radius,minZ:b.min.z-radius,maxZ:b.max.z+radius});}
 for(const m of memorials)refreshMemorial(m.group);
 addEventListener('garden-memorial-ready',event=>refreshMemorial(event.detail.group));
 // Central monument, tree trunks, pond, pavilion posts and benches.
 obstacles.push({minX:-2.5,maxX:2.5,minZ:-5.5,maxZ:-2.0});
 const trunks=[[-7,-2],[10,-7],[-9,-13],[6,-16],[-3,-19],[13,-17],[-17,-17],[-19,-8],[19,-17],[-13,-24],[0,-27],[12,-25],[20,1],[-20,3]];
 for(const [x,z] of trunks)obstacles.push({x:x*parkSpacing,z:z*parkSpacing,r:.82});
 for(const x of [4.7,8.7])for(const z of [-8.85,-5.55])obstacles.push({x:x*parkSpacing,z:z*parkSpacing,r:.54});
 for(const solid of solidObjects){const b=new T.Box3().setFromObject(solid);obstacles.push({minX:b.min.x-radius,maxX:b.max.x+radius,minZ:b.min.z-radius,maxZ:b.max.z+radius});}
 obstacles.push({x:-12.8*parkSpacing,z:-12.6*parkSpacing,r:2.75});
 // Grass and flowers are traversable. Only solid shrubs/props and park fences block movement.
 obstacles.push({minX:-27.5,maxX:-4.66,minZ:16.24,maxZ:17.36},{minX:4.96,maxX:27.5,minZ:16.24,maxZ:17.36});
 const navigation=window.createGardenNavigation({routes:walkRoutes,areas:walkAreas,obstacles,scale:parkSpacing,radius,bounds:{minX:-26,maxX:26,minZ:-31.4,maxZ:20}});
 const allowed=navigation.allowed;

 function play(name,o){if(!actions[name]||(name===currentName&&!(o&&o.restart)))return false;const next=actions[name],fade=o&&o.fade!=null?o.fade:.2,ts=o&&o.timeScale||1,same=next===currentAction;next.reset().setEffectiveTimeScale(ts).setEffectiveWeight(1);if(ts<0)next.time=next.getClip().duration;if(same)next.play();else next.fadeIn(fade).play();if(currentAction&&currentAction!==next)currentAction.fadeOut(fade);currentAction=next;currentName=name;return true;}
 /* ---------- Gardener interactions (Meshy clips): sit / doze on benches, bow, kneel, place, wave ---------- */
 // mode: free | sitDown | sit | doze | standUp | gesture | kneelHold
 let mode='free',modeTime=0,seat=null,gestureName='',seatIdle=0,lastWave=-1e9,clock=0;const seats=[],tmpV=new T.Vector3(),tmpW=new T.Vector3();
 const SIT_DROP={pavilion:.03,bench:.06};// how far the actor base sits below the seat-height formula (tuned from screenshots)
 function findSeats(){
  seats.length=0;
  for(const solid of solidObjects){
   solid.updateWorldMatrix(true,false);
   const isBench=solid.isGroup&&solid.children.length===17,isPav=solid.isMesh&&Math.abs(solid.position.y-.65)<.01&&Math.abs(solid.position.z+1.45)<.01;
   if(!isBench&&!isPav)continue;
   const c=solid.localToWorld(new T.Vector3(0,isBench?.67:0,0)),f=solid.localToWorld(new T.Vector3(0,isBench?.67:0,isBench?1:.5)).sub(c);f.y=0;f.normalize();
   const top=isBench?.67:new T.Box3().setFromObject(solid).max.y,depth=isBench?.95:1.05;
   seats.push({kind:isBench?'bench':'pavilion',x:c.x,z:c.z,top,angle:Math.atan2(f.x,f.z),fx:c.x+f.x*depth,fz:c.z+f.z*depth,dir:f});
  }
 }
 function nearSeat(){if(!seats.length)return null;let best=null,bd=.95;for(const st of seats){const d=Math.hypot(actor.position.x-st.fx,actor.position.z-st.fz);if(d<bd){bd=d;best=st}}return best}
 function faceTo(x,z){actor.userData.faceAngle=Math.atan2(x-actor.position.x,z-actor.position.z)}
 function setMode(m){mode=m;modeTime=0}
 function sit(st){st=st||nearSeat();if(!st||!actions.sitDown||mode!=='free')return false;seat=st;clear();
  actor.position.set(st.x+st.dir.x*.12,st.top-SIT_OFFSET-SIT_DROP[st.kind],st.z+st.dir.z*.12);actor.rotation.y=st.angle;actor.userData.faceAngle=null;
  setMode('sitDown');seatIdle=0;play('sitDown',{fade:.35});if(st.kind==='pavilion'&&api.getView){savedView=api.getView();api.setView({pitch:1.3,distance:3.8})}return true}
 function standUp(){if(mode!=='sit'&&mode!=='doze'&&mode!=='sitDown')return;setMode('standUp');play('standUp',{fade:.3,timeScale:1.7})}
 // Gestures play once in place, facing an optional point; walking cancels them.
 function perform(name,o){
  if(!ready||!actions[name==='kneel'?'kneel':name])return false;
  if(mode==='sit'||mode==='doze'||mode==='sitDown'||mode==='standUp')return false;
  if(o&&o.face)faceTo(o.face.x,o.face.z);idleTime=0;gestureName=name;
  if(name==='kneel'){setMode('kneelHold');actor.userData.kneelStage=0;play('kneel',{fade:.3,timeScale:-1.15,restart:true})}// clip is kneel→stand: play it backwards to go down
  else{setMode('gesture');play(name,{fade:.25,restart:true})}
  return true}
 function onFinished(e){
  if(e.action!==currentAction)return;
  if(mode==='sitDown'){setMode('sit');play('sitIdle',{fade:.45})}
  else if(mode==='standUp'){const st=seat;seat=null;if(st){actor.position.set(st.fx,actor.position.y,st.fz);seatCooldown=st}if(savedView){api.setView(savedView);savedView=null}setMode('free');idleTime=0;play('idle',{fade:.35})}
  else if(mode==='kneelHold'){if(actor.userData.kneelStage===0){actor.userData.kneelStage=1;modeTime=0;}else{setMode('free');play('idle',{fade:.3})}}
  else if(mode==='gesture'){setMode('free');idleTime=0;play('idle',{fade:.35})}
 }
 let SIT_OFFSET=.5,savedView=null,seatCooldown=null;
 findSeats();// now, before perf.js merges the bench meshes into batches
 function clear(){keys.clear();touchKeys.clear();speed=0;velocity.set(0,0,0);}
 function setActive(value){
  if(!ready)return;
  active=value;clear();button.setAttribute('aria-pressed',String(value));button.textContent=value?'退出操控':'操控人物';
  pad.hidden=!value;document.body.classList.toggle('controlling-character',value);
  const touch=window.GARDEN_MOBILE;hint.textContent=value?(touch?'左下摇杆移动 · 推到底奔跑 · 右侧单指拖动转视角':'WASD / 方向键自由移动 · Shift 奔跑 · R 回到入口'):(touch?'单指拖动环顾 · 双指缩放':'拖动环顾 · 滚轮缩放 · 双击回到最初');
  status.textContent=value?'人物已就绪 · 正在操控':'人物已就绪 · 点击「操控人物」继续';if(!value&&window.gardenJoystick)window.gardenJoystick.reset();
  if(!value&&mode!=='free'){if(seat)actor.position.set(seat.fx,actor.position.y,seat.fz);if(savedView&&api.setView){api.setView(savedView);savedView=null}seat=null;mode='free';actor.userData.faceAngle=null;currentName='';}
  if(value){api.beginFollow(actor.position);renderer.domElement.focus({preventScroll:true});}else{play('idle');api.endFollow();}
 }
 function spawn(){clear();mode='free';seat=null;actor.userData.faceAngle=null;actor.position.set(0,.13,14.2);actor.rotation.y=Math.PI;idleTime=0;play('idle');if(active)api.beginFollow(actor.position);}
 const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
 addEventListener('keydown',e=>{if(!active||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(movementCodes.has(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='KeyR'){e.preventDefault();spawn();}if(e.code==='KeyC'&&!e.repeat){if(mode==='free')sit();else standUp();}if(e.code==='KeyH'&&!e.repeat)perform('wave',{face:camera.position});if(e.code==='Escape')setActive(false);});
 addEventListener('keyup',e=>{keys.delete(e.code);});addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 button.onclick=()=>setActive(!active);
 const sitPrompt=document.createElement('button');sitPrompt.id='sit-prompt';sitPrompt.type='button';sitPrompt.hidden=true;sitPrompt.textContent=(window.gT||String)(window.GARDEN_MOBILE?'🪑 坐一会儿':'🪑 在长椅上坐一会儿');document.body.append(sitPrompt);
 sitPrompt.onclick=()=>{sit();sitPrompt.hidden=true};
 // Tap the gardener himself → he waves back.
 {let down=null;const cv=renderer.domElement;cv.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});cv.addEventListener('pointerup',e=>{if(!down||!ready||!active||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;down=null;
  const r=cv.getBoundingClientRect();let hit=false;for(const h of [.5,1.1,1.6]){tmpV.copy(actor.position);tmpV.y+=h;tmpV.project(camera);const sx=r.left+(tmpV.x+1)/2*r.width,sy=r.top+(1-tmpV.y)/2*r.height;if(Math.hypot(sx-e.clientX,sy-e.clientY)<Math.max(36,r.height*.09)){hit=true;break}}
  if(hit){if(mode==='sit'||mode==='doze'){if(mode==='doze'){setMode('sit');seatIdle=0;play('sitIdle',{fade:.6})}}else perform('wave',{face:camera.position})}})}
 function update(dt){
  if(!ready)return;
  if(active){
   const held=code=>keys.has(code)||touchKeys.has(code);
   const f=(held('KeyW')||held('ArrowUp')?1:0)-(held('KeyS')||held('ArrowDown')?1:0);
   const r=(held('KeyD')||held('ArrowRight')?1:0)-(held('KeyA')||held('ArrowLeft')?1:0);
   let running=held('ShiftLeft')||held('ShiftRight');
   camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
   desired.copy(forward).multiplyScalar(f).addScaledVector(right,r);let target=running?5:2.25;
   // Analog virtual joystick (phone): direction + magnitude; pushing to the rim runs.
   const js=window.gardenJoystick;
   if(!f&&!r&&js&&js.mag>0){desired.copy(forward).multiplyScalar(-js.y).addScaledVector(right,js.x);running=js.mag>.92;target=running?5:2.25*Math.max(.35,Math.min(1,js.mag/.85));}
   if(desired.lengthSq()>0)desired.normalize();
   clock+=dt;modeTime+=dt;const wants=desired.lengthSq()>0;
   if(mode!=='free'){
    // Seated: any input stands up first (no sliding while getting up).
    if(mode==='sit'||mode==='doze'||mode==='sitDown'){if(wants&&modeTime>.4)standUp();else if(mode==='sit'&&(seatIdle+=dt)>14&&actions.doze){setMode('doze');play('doze',{fade:1.2})}}
    else if(mode==='kneelHold'){if(actor.userData.kneelStage===1&&(modeTime>1.6||wants)){actor.userData.kneelStage=2;play('kneel',{fade:.25,timeScale:1.15,restart:true})}}
    else if(mode==='gesture'&&wants&&modeTime>.35){setMode('free')}
    if(mode!=='free'){
     const fa=actor.userData.faceAngle;if(fa!=null){const dl=Math.atan2(Math.sin(fa-actor.rotation.y),Math.cos(fa-actor.rotation.y));actor.rotation.y+=dl*(1-Math.exp(-8*dt));}
     speed=0;const stTxt=(window.gT||String)(mode==='doze'?'园丁在长椅上打盹 · 推动摇杆叫醒他':mode==='sit'||mode==='sitDown'?'园丁坐下歇一会儿 · 推动摇杆起身':'人物已就绪 · 正在操控');if(status.textContent!==stTxt)status.textContent=stTxt;
     if(sitPrompt&&!sitPrompt.hidden)sitPrompt.hidden=true;
     api.follow(actor.position,dt);mixer.update(dt);diag();return;
    }
    actor.userData.faceAngle=null;
   }
   speed=T.MathUtils.damp(speed,desired.lengthSq()?target:0,12,dt);
   const oldX=actor.position.x,oldZ=actor.position.z;
   const blocked=navigation.move(actor.position,desired.x*speed*dt,desired.z*speed*dt);
   const stateText=(window.gT||String)(blocked?'前方有障碍 · 请绕行':'人物已就绪 · 正在操控');if(status.textContent!==stateText)status.textContent=stateText;
   const walked=Math.hypot(actor.position.x-oldX,actor.position.z-oldZ)>1e-5;
   if(desired.lengthSq()){const angle=Math.atan2(desired.x,desired.z),delta=Math.atan2(Math.sin(angle-actor.rotation.y),Math.cos(angle-actor.rotation.y));actor.rotation.y+=delta*(1-Math.exp(-14*dt));}
   if(walked){idleTime=0;play(running?'run':'walk');}else{idleTime+=dt;play(idleTime>8?'look':'idle');}
   // Standing still in front of a bench: offer a seat; after a short pause he sits down by himself.
   const ns=!walked?nearSeat():null;if(sitPrompt){const show=!!ns&&!document.querySelector('dialog[open]')&&(!document.getElementById('ritual-prompt')||document.getElementById('ritual-prompt').hidden);if(sitPrompt.hidden===show)sitPrompt.hidden=!show}
   if(seatCooldown&&Math.hypot(actor.position.x-seatCooldown.fx,actor.position.z-seatCooldown.fz)>1.6)seatCooldown=null;
   if(ns&&ns!==seatCooldown&&idleTime>2.2)sit(ns);
   else if(!walked&&idleTime>26&&clock-lastWave>40&&actions.wave){lastWave=clock;perform('wave',{face:camera.position});idleTime=9}
   const inPavilion=mode==='free'&&actor.position.x>6.45&&actor.position.x<13.65&&actor.position.z> -13.95&&actor.position.z< -7.65;
   actor.position.y=T.MathUtils.damp(actor.position.y,inPavilion?.34:.13,15,dt);
   api.follow(actor.position,dt);
  }else play('idle');
  mixer.update(dt);diag();
 }
 function diag(){
  // Visible diagnostic state also gives the controller a screen-reader status.
  // Cheap diagnostics: reuse one object, touch the DOM only ~6x per second (avoids per-frame style work / garbage).
  const st=controlState;st.ready=ready;st.active=active;st.animation=currentName;st.x=actor.position.x;st.z=actor.position.z;actor.userData.controlState=st;
  st.mode=mode;if(++diagFrame>=10||currentName!==diagAnim){diagFrame=0;diagAnim=currentName;status.dataset.x=String(+st.x.toFixed(3));status.dataset.z=String(+st.z.toFixed(3));status.dataset.animation=currentName;status.dataset.mode=mode;}
 }
 const controlState={ready:false,active:false,animation:'',x:0,z:0};let diagFrame=0,diagAnim='';
 const controller={update,setActive,spawn,perform,sit,standUp,get mode(){return mode;},get seats(){return seats;},get active(){return active;},get ready(){return ready;},actor,obstacles,allowed,navigation};
 button.disabled=true;status.textContent='正在载入你的人物与动画…';
 const fail=error=>{console.error('Character loading failed',error);status.textContent='人物载入失败，请重新打开页面。';button.textContent='人物载入失败';};
 const onGltf=gltf=>{
   try{
    model=gltf.scene;model.name='MeshyLightbulbWorker';model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    actor.add(model);mixer=new T.AnimationMixer(model);
    for(const original of gltf.animations){
     const clip=original.clone();
     for(const track of clip.tracks){if(/Hips\.position$/i.test(track.name)){const bone=model.getObjectByName(track.name.slice(0,-9));const x=bone?bone.position.x:track.values[0],z=bone?bone.position.z:track.values[2];for(let i=0;i<track.values.length;i+=3){track.values[i]=x;track.values[i+2]=z;}}}
     const NAMED={SitIdle:'sitIdle',Doze:'doze',Wave:'wave',Kneel:'kneel',Bow:'bow',PickUp:'pickup'};let key=NAMED[clip.name],c=clip;
     if(clip.name==='SitDown'){key='sitDown';c=T.AnimationUtils.subclip(clip,'SitDown',Math.round(5.6*30),Math.round(clip.duration*30),30)}// skip the walk-up part
     else if(clip.name==='StandUp'){key='standUp';c=T.AnimationUtils.subclip(clip,'StandUp',0,Math.round(3.2*30),30)}
     if(!key)key=/running/i.test(clip.name)?'run':/walking/i.test(clip.name)?'walk':/idle/i.test(clip.name)?'idle':'look';
     const a=mixer.clipAction(c);if(['sitDown','standUp','wave','kneel','bow','pickup'].includes(key)){a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true}actions[key]=a;
    }
    mixer.addEventListener('finished',onFinished);
    play('idle');mixer.update(0);model.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),scale=1.85/size.y;
    model.scale.setScalar(scale);model.position.y=-(bounds.min.y-actor.position.y)*scale;model.updateMatrixWorld(true);
    // Seat height: where the hips sit in the seated clip, minus the thigh thickness.
    if(actions.sitIdle){const hips=model.getObjectByName('Hips');if(hips){const ia=actions.idle;if(ia)ia.stop();actions.sitIdle.reset().setEffectiveWeight(1).play();mixer.update(0);model.updateMatrixWorld(true);const hy=hips.getWorldPosition(new T.Vector3()).y-actor.position.y;actions.sitIdle.stop();if(ia)ia.reset().setEffectiveWeight(1).play();mixer.update(0);SIT_OFFSET=Math.max(.3,Math.min(.8,hy-.1))}}
    actor.rotation.y=Math.PI;ready=true;button.disabled=false;
    // Gentle fill keeps the supplied material readable under the garden's dusk light.
    const light=new T.PointLight('#ffe4b7',2.2,4,2);light.position.set(0,1.6,.6);actor.add(light);
    setActive(true);
   }catch(e){fail(e);}
 };
 const fromBase64=()=>{try{const binary=atob(window.GARDEN_CHARACTER_BASE64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);delete window.GARDEN_CHARACTER_BASE64;new T.GLTFLoader().parse(bytes.buffer,'',onGltf,fail);}catch(e){fail(e);}};
 if(location.protocol==='file:'||window.GARDEN_CHARACTER_BASE64)fromBase64();
 else{
  // Phone/http path: compressed GLB (~0.8 MB, meshopt + WebP) instead of the 44 MB base64 script.
  const loader=new T.GLTFLoader();if(window.MeshoptDecoder&&loader.setMeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);
  const tryLoad=(url,next)=>loader.load(url,onGltf,xhr=>{if(xhr.total)status.textContent='正在载入你的人物… '+Math.round(xhr.loaded/xhr.total*100)+'%';},next);
  tryLoad('assets/gardener.opt.glb',()=>loader.load('assets/character.opt.glb',onGltf,xhr=>{if(xhr.total)status.textContent='正在载入你的人物… '+Math.round(xhr.loaded/xhr.total*100)+'%';},e=>{
   console.warn('Compressed character failed, falling back to embedded data',e);status.textContent='正在载入人物（备用方式，较慢，请稍候）…';
   if(window.GARDEN_STATIC){fail(e);return}const sc=document.createElement('script');sc.src='assets/character-data.js';sc.onload=fromBase64;sc.onerror=fail;document.head.append(sc);
  }));
 }
 return controller;
};
