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

 function play(name){if(!actions[name]||name===currentName)return;const next=actions[name];next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.2).play();if(currentAction)currentAction.fadeOut(.2);currentAction=next;currentName=name;}
 function clear(){keys.clear();touchKeys.clear();speed=0;velocity.set(0,0,0);}
 function setActive(value){
  if(!ready)return;
  active=value;clear();button.setAttribute('aria-pressed',String(value));button.textContent=value?'退出操控':'操控人物';
  pad.hidden=!value;document.body.classList.toggle('controlling-character',value);
  const touch=window.GARDEN_MOBILE;hint.textContent=value?(touch?'左下摇杆移动 · 推到底奔跑 · 右侧单指拖动转视角':'WASD / 方向键自由移动 · Shift 奔跑 · R 回到入口'):(touch?'单指拖动环顾 · 双指缩放':'拖动环顾 · 滚轮缩放 · 双击回到最初');
  status.textContent=value?'人物已就绪 · 正在操控':'人物已就绪 · 点击「操控人物」继续';if(!value&&window.gardenJoystick)window.gardenJoystick.reset();
  if(value){api.beginFollow(actor.position);renderer.domElement.focus({preventScroll:true});}else{play('idle');api.endFollow();}
 }
 function spawn(){clear();actor.position.set(0,.13,14.2);actor.rotation.y=Math.PI;idleTime=0;play('idle');if(active)api.beginFollow(actor.position);}
 const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
 addEventListener('keydown',e=>{if(!active||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(movementCodes.has(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='KeyR'){e.preventDefault();spawn();}if(e.code==='Escape')setActive(false);});
 addEventListener('keyup',e=>{keys.delete(e.code);});addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 button.onclick=()=>setActive(!active);
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
   speed=T.MathUtils.damp(speed,desired.lengthSq()?target:0,12,dt);
   const oldX=actor.position.x,oldZ=actor.position.z;
   const blocked=navigation.move(actor.position,desired.x*speed*dt,desired.z*speed*dt);
   const stateText=blocked?'前方有障碍 · 请绕行':'人物已就绪 · 正在操控';if(status.textContent!==stateText)status.textContent=stateText;
   const walked=Math.hypot(actor.position.x-oldX,actor.position.z-oldZ)>1e-5;
   if(desired.lengthSq()){const angle=Math.atan2(desired.x,desired.z),delta=Math.atan2(Math.sin(angle-actor.rotation.y),Math.cos(angle-actor.rotation.y));actor.rotation.y+=delta*(1-Math.exp(-14*dt));}
   if(walked){idleTime=0;play(running?'run':'walk');}else{idleTime+=dt;play(idleTime>8?'look':'idle');}
   const inPavilion=actor.position.x>6.45&&actor.position.x<13.65&&actor.position.z> -13.95&&actor.position.z< -7.65;
   actor.position.y=T.MathUtils.damp(actor.position.y,inPavilion?.34:.13,15,dt);
   api.follow(actor.position,dt);
  }else play('idle');
  mixer.update(dt);
  // Visible diagnostic state also gives the controller a screen-reader status.
  // Cheap diagnostics: reuse one object, touch the DOM only ~6x per second (avoids per-frame style work / garbage).
  const st=controlState;st.ready=ready;st.active=active;st.animation=currentName;st.x=actor.position.x;st.z=actor.position.z;actor.userData.controlState=st;
  if(++diagFrame>=10||currentName!==diagAnim){diagFrame=0;diagAnim=currentName;status.dataset.x=String(+st.x.toFixed(3));status.dataset.z=String(+st.z.toFixed(3));status.dataset.animation=currentName;}
 }
 const controlState={ready:false,active:false,animation:'',x:0,z:0};let diagFrame=0,diagAnim='';
 const controller={update,setActive,spawn,get active(){return active;},get ready(){return ready;},actor,obstacles,allowed,navigation};
 button.disabled=true;status.textContent='正在载入你的人物与动画…';
 const fail=error=>{console.error('Character loading failed',error);status.textContent='人物载入失败，请重新打开页面。';button.textContent='人物载入失败';};
 const onGltf=gltf=>{
   try{
    model=gltf.scene;model.name='MeshyLightbulbWorker';model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    actor.add(model);mixer=new T.AnimationMixer(model);
    for(const original of gltf.animations){
     const clip=original.clone();
     for(const track of clip.tracks){if(/Hips\.position$/i.test(track.name)){const bone=model.getObjectByName(track.name.slice(0,-9));const x=bone?bone.position.x:track.values[0],z=bone?bone.position.z:track.values[2];for(let i=0;i<track.values.length;i+=3){track.values[i]=x;track.values[i+2]=z;}}}
     const key=/running/i.test(clip.name)?'run':/walking/i.test(clip.name)?'walk':/idle/i.test(clip.name)?'idle':'look';actions[key]=mixer.clipAction(clip);
    }
    play('idle');mixer.update(0);model.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),scale=1.85/size.y;
    model.scale.setScalar(scale);model.position.y=-(bounds.min.y-actor.position.y)*scale;model.updateMatrixWorld(true);
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
  loader.load('assets/character.opt.glb',onGltf,xhr=>{if(xhr.total)status.textContent='正在载入你的人物… '+Math.round(xhr.loaded/xhr.total*100)+'%';},e=>{
   console.warn('Compressed character failed, falling back to embedded data',e);status.textContent='正在载入人物（备用方式，较慢，请稍候）…';
   if(window.GARDEN_STATIC){fail(e);return}const sc=document.createElement('script');sc.src='assets/character-data.js';sc.onload=fromBase64;sc.onerror=fail;document.head.append(sc);
  });
 }
 return controller;
};
