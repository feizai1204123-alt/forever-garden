/* Phone copy performance pass:
   1) merge thousands of static meshes into a few draw calls (by material + 12 m grid cell, so culling still works),
   2) throttle shadow-map updates on phones,
   3) adaptive quality governor (DPR, shadow rate/size, particle counts) driven by the measured frame time. */
(()=>{
'use strict';
const g=window.garden,T=window.THREE,BGU=T&&(T.BufferGeometryUtils||window.BufferGeometryUtils);if(!g||!T)return;
const {scene,renderer}=g,mobile=!!window.GARDEN_MOBILE;
const report={mergedFrom:0,mergedInto:0};

/* ---------- 1. Static mesh merge ---------- */
function mergeStatic(){
 if(!BGU||!BGU.mergeGeometries)return;
 const skip=new Set();const skipTree=o=>o&&o.traverse(c=>skip.add(c));
 const local=[];for(const m of g.memorials){const u=m.group.userData;skipTree(m.group);if(!(u.emptyMemorial||u.isPetMemorial||u.petLoaded||m.group.name==='PoodleMemorial'))local.push(m.group)}// memorial groups stay tappable (ritual raycast): merge them inside their own group
 const dyn=new Set(),dynTree=o=>o&&o.traverse(c=>{dyn.add(c);skip.add(c)});
 if(g.controller&&g.controller.actor)dynTree(g.controller.actor);
 for(const o of g.falling||[])dynTree(o);
 if(window.gardenDecor)for(const l of window.gardenDecor.lanterns||[])dynTree(l);
 scene.traverse(o=>{if(o.name&&/^Rituals_/.test(o.name))dynTree(o)});
 scene.updateMatrixWorld(true);
 const tmp=new T.Vector3(),inv=new T.Matrix4(),rel=new T.Matrix4(),canon=new Map(),hx=c=>c?c.getHexString():'-';
 // Many props build their own material instance with identical settings; share one so they can batch together.
 const sigOf=m=>[m.type,hx(m.color),hx(m.emissive),m.emissiveIntensity,m.roughness,m.metalness,m.map?m.map.uuid:'-',m.transparent,m.opacity,m.side,m.flatShading,m.vertexColors,m.alphaTest,m.depthWrite,m.depthTest,m.fog,m.toneMapped,m.blending,m.wireframe,m.envMap?m.envMap.uuid:'-',m.normalMap?m.normalMap.uuid:'-',m.emissiveMap?m.emissiveMap.uuid:'-',m.polygonOffset,m.onBeforeCompile&&m.onBeforeCompile.toString().length,m.userData&&Object.keys(m.userData).length].join('|');
 const matFor=m=>{if(!/^Mesh(Standard|Lambert|Phong|Basic)Material$/.test(m.type))return m;const k=sigOf(m);let c=canon.get(k);if(!c)canon.set(k,c=m);return c};
 function mergeUnder(root,parent,skipSet){
 const groups=new Map();inv.copy(parent.matrixWorld).invert();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.name==='MergedStatic'||(skipSet&&skipSet.has(o))||!o.visible||Array.isArray(o.material)||o.morphTargetInfluences)return;
  const geo=o.geometry;if(!geo||!geo.attributes.position||geo.morphAttributes.position)return;
  if(o.onBeforeRender!==T.Object3D.prototype.onBeforeRender)return;
  let p=o.parent;while(p&&p!==scene){if(!p.visible)return;p=p.parent}
  if(!geo.boundingSphere)geo.computeBoundingSphere();tmp.copy(geo.boundingSphere.center).applyMatrix4(o.matrixWorld);
  if(geo.boundingSphere.radius*o.matrixWorld.getMaxScaleOnAxis()>40)return;// sky/ground stay as they are
  const attrs=['position','normal','uv'].filter(n=>geo.attributes[n]).join(',')+(o.material.vertexColors&&geo.attributes.color?',color':'');
  const mat=matFor(o.material);const key=mat.uuid+'|'+attrs+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0)+'|'+o.renderOrder+'|'+Math.floor(tmp.x/12)+','+Math.floor(tmp.z/12);
  let e=groups.get(key);if(!e)groups.set(key,e={mat,cast:o.castShadow,recv:o.receiveShadow,order:o.renderOrder,list:[]});e.list.push(o);
 });
 for(const e of groups.values()){
  if(e.list.length<2)continue;
  const geos=[];let ok=true;
  for(const o of e.list){let geo=o.geometry.clone();
   for(const n of Object.keys(geo.attributes))if(!['position','normal','uv','color'].includes(n))geo.deleteAttribute(n);
   if(!e.mat.vertexColors&&geo.attributes.color)geo.deleteAttribute('color');
   if(!geo.index){const n=geo.attributes.position.count,idx=new (n>65535?Uint32Array:Uint16Array)(n);for(let i=0;i<n;i++)idx[i]=i;geo.setIndex(new T.BufferAttribute(idx,1))}
   if(!geo.attributes.normal)geo.computeVertexNormals();
   geo.applyMatrix4(rel.multiplyMatrices(inv,o.matrixWorld));geo.clearGroups();geos.push(geo)}
  let merged=null;try{merged=BGU.mergeGeometries(geos,false)}catch(err){ok=false}
  if(!merged||!ok)continue;
  merged.computeBoundingSphere();merged.computeBoundingBox();
  const mesh=new T.Mesh(merged,e.mat);mesh.castShadow=e.cast;mesh.receiveShadow=e.recv;mesh.renderOrder=e.order;mesh.name='MergedStatic';mesh.matrixAutoUpdate=false;mesh.updateMatrix();parent.add(mesh);
  for(const o of e.list){o.parent&&o.parent.remove(o)}
  report.mergedFrom+=e.list.length;report.mergedInto++;
 }
 }
 mergeUnder(scene,scene,skip);
 for(const grp of local)mergeUnder(grp,grp,dyn);
 // Static things never move again: skip their per-frame matrix recompute.
 scene.traverse(o=>{if(o.name==='MergedStatic')o.matrixAutoUpdate=false});
}
try{mergeStatic()}catch(err){console.warn('static merge skipped',err)}

/* ---------- 2+3. Shadow throttling & adaptive quality ---------- */
const fire=window.gardenDecor&&window.gardenDecor.fireflies,petals=window.gardenDecor&&window.gardenDecor.petals,wings=window.gardenDecor&&window.gardenDecor.wings;
const counts={fire:fire?fire.geometry.attributes.position.count:0,petals:petals?petals.count:0,wings:wings?wings.count:0};
let sun=null;scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow&&!sun)sun=o});
const maxDpr=Math.min(window.devicePixelRatio||1,mobile?1.5:1.7);
const LEVELS=mobile?[
 {dpr:1.5,shadowEvery:1,shadowSize:1024,particles:1},
 {dpr:1.25,shadowEvery:2,shadowSize:1024,particles:1},
 {dpr:1.1,shadowEvery:2,shadowSize:1024,particles:.65},
 {dpr:.95,shadowEvery:3,shadowSize:512,particles:.4},
 {dpr:.8,shadowEvery:4,shadowSize:512,particles:.2}]:[
 {dpr:1.7,shadowEvery:1,shadowSize:2048,particles:1},
 {dpr:1.35,shadowEvery:1,shadowSize:2048,particles:1},
 {dpr:1.1,shadowEvery:2,shadowSize:1024,particles:.6}];
let level=mobile?1:0;
function apply(){
 const L=LEVELS[level];const dpr=Math.min(maxDpr,L.dpr);if(Math.abs(renderer.getPixelRatio()-dpr)>.01){renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight)}
 if(sun&&sun.shadow.mapSize.x!==L.shadowSize){sun.shadow.mapSize.set(L.shadowSize,L.shadowSize);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
 if(fire)fire.geometry.setDrawRange(0,Math.round(counts.fire*L.particles));
 if(petals)petals.count=Math.round(counts.petals*L.particles);
 if(wings)wings.count=Math.max(0,Math.round(counts.wings/2*L.particles)*2);
 renderer.shadowMap.needsUpdate=true;
}
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;apply();
const SLOW=mobile?24:26,FAST=mobile?13.5:12;// ms: step down when a 2 s window averages slower than ~42 fps, up when clearly faster than 60
let frame=0,last=performance.now(),acc=0,n=0,winStart=last,fastWins=0,cooldown=0;
function loop(now){
 requestAnimationFrame(loop);
 const dt=now-last;last=now;
 if(++frame>=LEVELS[level].shadowEvery){frame=0;renderer.shadowMap.needsUpdate=true}
 if(document.hidden||dt>250){winStart=now;acc=n=0;return}// tab switches / loading hitches don't count
 acc+=Math.min(dt,100);n++;
 if(now-winStart<2000)return;
 const avg=acc/n;winStart=now;acc=n=0;
 if(cooldown>0){cooldown--;return}
 if(avg>SLOW&&level<LEVELS.length-1){level++;fastWins=0;cooldown=1;apply()}
 else if(avg<FAST&&level>0){if(++fastWins>=3){level--;fastWins=0;cooldown=2;apply()}}
 else fastWins=0;
 Q.lastAvg=+avg.toFixed(1);
}
requestAnimationFrame(loop);
addEventListener('resize',()=>{renderer.shadowMap.needsUpdate=true});
const Q=window.gardenQuality={get level(){return level},get levels(){return LEVELS},set level(v){level=Math.max(0,Math.min(LEVELS.length-1,v|0));apply()},lastAvg:0,merge:report};
console.info('[garden perf] merged',report.mergedFrom,'meshes into',report.mergedInto,'draws; quality level',level);
})();
