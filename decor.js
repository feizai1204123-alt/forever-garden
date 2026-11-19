/* Phone copy: extra warm decorations — fireflies, drifting petals, butterflies, rocks & mushrooms at tree roots,
   a flower arch at the entrance and a cosy pavilion corner. Everything is instanced / single-draw so it stays phone-friendly. */
(()=>{
'use strict';
const g=window.garden,T=window.THREE;if(!g||!T)return;
const {scene}=g,nav=g.controller&&g.controller.navigation,mobile=!!window.GARDEN_MOBILE;
let seed=20261118;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646},range=(a,b)=>a+rand()*(b-a);
const onPath=(x,z,m=-.35)=>nav?nav.surface(x,z,m):false;
const S=1.5;// park spacing (scene was built at 1x then spread by 1.5 in x/z)
const trunks=[[-7,-2],[10,-7],[-9,-13],[6,-16],[-3,-19],[13,-17],[-17,-17],[-19,-8],[19,-17],[-13,-24],[0,-27],[12,-25],[20,1],[-20,3]].map(([x,z])=>[x*S,z*S]);
const lam=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:.85,metalness:0,...o});
const dummy=new T.Object3D();
function instanced(geo,mat,list,{cast=false,receive=true}={}){const im=new T.InstancedMesh(geo,mat,list.length);list.forEach((v,i)=>{dummy.position.set(...v.p);dummy.rotation.set(...(v.r||[0,0,0]));dummy.scale.set(...(v.s||[1,1,1]));dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);if(v.c)im.setColorAt(i,new T.Color(v.c))});im.castShadow=cast;im.receiveShadow=receive;scene.add(im);return im}

/* ---------- Rocks & mushrooms around tree roots and the pond ---------- */
const rocks=[],stems=[],caps=[],dots=[];
for(const [tx,tz] of trunks){
 const nR=mobile?3:5;for(let i=0;i<nR;i++){const a=rand()*6.28,d=range(1.1,2.1),x=tx+Math.cos(a)*d,z=tz+Math.sin(a)*d;if(onPath(x,z))continue;const s=range(.12,.32);rocks.push({p:[x,s*.35,z],r:[rand()*3,rand()*3,rand()*3],s:[s*1.3,s*.8,s],c:['#9d8f7c','#b5a08a','#857766','#a89580'][i%4]})}
 const nM=mobile?3:5;for(let i=0;i<nM;i++){const a=rand()*6.28,d=range(.9,1.9),x=tx+Math.cos(a)*d,z=tz+Math.sin(a)*d;if(onPath(x,z))continue;const h=range(.12,.26),w=h*range(.75,1.1),lean=range(-.18,.18);
  stems.push({p:[x,h/2,z],s:[w*.22,h,w*.22],r:[lean,0,lean*.6]});caps.push({p:[x+lean*h*.5,h,z-lean*h*.3],s:[w*.62,w*.42,w*.62],r:[lean,0,lean*.6],c:['#b45a3c','#c9844a','#a8483a','#d39a5a'][i%4]});
  if(i%2===0)dots.push({p:[x+lean*h*.5+w*.18,h+w*.3,z],s:[w*.07,w*.05,w*.07]})}
}
const pondX=-12.8*S,pondZ=-12.6*S;for(let i=0;i<(mobile?14:20);i++){const a=i/(mobile?14:20)*6.28+range(-.1,.1),x=pondX+Math.cos(a)*range(2.75,3.05)*1.1,z=pondZ+Math.sin(a)*range(2.6,2.9)*.85*1.2;const s=range(.18,.34);rocks.push({p:[x,s*.3,z],r:[rand()*3,rand()*3,rand()*3],s:[s*1.4,s*.7,s*1.1],c:['#a89580','#8f8170','#b9a994'][i%3]})}
instanced(new T.IcosahedronGeometry(1,0),lam('#ffffff',{flatShading:true}),rocks,{cast:!mobile});
instanced(new T.CylinderGeometry(1,1.15,1,6),lam('#efe0c2'),stems);
instanced(new T.SphereGeometry(1,mobile?8:10,4,0,Math.PI*2,0,Math.PI/2),lam('#ffffff'),caps);
instanced(new T.SphereGeometry(1,5,3),lam('#fff4dc'),dots);

/* ---------- Flower arch at the entrance ---------- */
const arch=new T.Group();arch.position.set(.1,0,10.6);scene.add(arch);
const wood=lam('#8a6440'),woodLight=lam('#a77e55'),leaf=lam('#5d6b45');
const R=3.1,postH=2.3;
for(const s of [-1,1]){const post=new T.Mesh(new T.BoxGeometry(.22,postH,.22),woodLight);post.position.set(s*R,postH/2,0);post.castShadow=true;arch.add(post);
 const foot=new T.Mesh(new T.BoxGeometry(.5,.18,.5),lam('#9d8f7c'));foot.position.set(s*R,.09,0);arch.add(foot)}
const arc=new T.Mesh(new T.TorusGeometry(R,.09,6,mobile?28:40,Math.PI),wood);arc.position.y=postH;arc.scale.y=.32;arc.castShadow=true;arch.add(arc);
const archLeaves=[],archFlowers=[],pal=['#f0b45f','#f6d7a7','#e98a6a','#f3c3c0','#fff1d6','#d9784f'];
const along=(t)=>{const a=Math.PI*t;return [Math.cos(a)*R,postH+Math.sin(a)*R*.32]};
for(let i=0;i<(mobile?70:110);i++){let x,y;if(rand()<.62){[x,y]=along(rand())}else{const s=rand()<.5?-1:1;x=s*R;y=range(.4,postH)}
 x+=range(-.16,.16);y+=range(-.12,.12);const z=range(-.16,.16);
 archLeaves.push({p:[x,y,z],r:[rand()*3,rand()*3,rand()*3],s:[range(.07,.12),range(.03,.05),range(.06,.1)],c:['#5d6b45','#6f7a4c','#4f5e3e'][i%3]});
 if(i%2===0)archFlowers.push({p:[x+range(-.05,.05),y+range(0,.08),z+(z>0?.06:-.06)],s:[range(.07,.12),range(.07,.12),range(.05,.08)],c:pal[i%pal.length]})}
const archLeafMesh=instanced(new T.SphereGeometry(1,5,3),lam('#ffffff'),archLeaves.map(v=>({...v,p:[v.p[0]+arch.position.x,v.p[1],v.p[2]+arch.position.z]})));
instanced(new T.SphereGeometry(1,6,4),lam('#ffffff',{emissive:'#3a2208',emissiveIntensity:.35}),archFlowers.map(v=>({...v,p:[v.p[0]+arch.position.x,v.p[1],v.p[2]+arch.position.z]})));
// little hanging sign on the arch
const cv=document.createElement('canvas');cv.width=512;cv.height=160;const cx=cv.getContext('2d');cx.fillStyle='#f3e2c2';cx.fillRect(0,0,512,160);cx.strokeStyle='#8a6440';cx.lineWidth=10;cx.strokeRect(6,6,500,148);cx.fillStyle='#6b4a2b';cx.font='bold 74px "Microsoft YaHei", sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText((window.gT||String)('永远的花园'),256,84,470);
const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const plaque=new T.Mesh(new T.BoxGeometry(1.4,.44,.06),[woodLight,woodLight,woodLight,woodLight,new T.MeshStandardMaterial({map:tex,roughness:.8}),new T.MeshStandardMaterial({map:tex,roughness:.8})]);
plaque.position.set(0,postH+R*.32-.55,0);arch.add(plaque);for(const s of [-1,1]){const rope=new T.Mesh(new T.CylinderGeometry(.012,.012,.32,4),wood);rope.position.set(s*.6,postH+R*.32-.2,0);arch.add(rope)}
if(g.controller)for(const s of [-1,1])g.controller.obstacles.push({x:arch.position.x+s*R,z:arch.position.z,r:.45});

/* ---------- Cosy pavilion corner: rug, potted plants, paper lanterns ---------- */
const PX=6.7*S,PZ=-7.2*S;
{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#9b4f36';x.fillRect(0,0,256,256);x.strokeStyle='#e9c48a';x.lineWidth=10;x.strokeRect(14,14,228,228);x.lineWidth=4;x.strokeStyle='#f3dcae';x.strokeRect(30,30,196,196);
 x.fillStyle='#e9c48a';for(let i=0;i<5;i++)for(let j=0;j<5;j++){x.beginPath();x.arc(52+i*38,52+j*38,(i+j)%2?5:8,0,7);x.fill()}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const rug=new T.Mesh(new T.PlaneGeometry(3.3,2.3),new T.MeshStandardMaterial({map:t,roughness:1}));rug.rotation.x=-Math.PI/2;rug.position.set(PX,.345,PZ-.6);rug.receiveShadow=true;scene.add(rug)}
const pots=[],potPlants=[],potFlowers=[];
for(const [x,z] of [[PX-3.55,PZ+3.5],[PX+3.55,PZ+3.5],[PX-3.55,PZ-3.35],[PX+3.55,PZ-3.35],[PX-1.6,PZ+3.55],[PX+1.6,PZ+3.55]]){
 pots.push({p:[x,.24,z],s:[.3,.48,.3],c:'#b0623f'});
 for(let k=0;k<9;k++){const a=k*2.4,d=range(.02,.2);potPlants.push({p:[x+Math.cos(a)*d,.55+range(0,.28),z+Math.sin(a)*d],r:[rand()*3,rand()*3,rand()*3],s:[range(.12,.2),range(.06,.1),range(.12,.18)],c:['#5d6b45','#6f7a4c','#7c8350'][k%3]});
  if(k%2===0)potFlowers.push({p:[x+Math.cos(a)*d*1.3,.7+range(0,.25),z+Math.sin(a)*d*1.3],s:[.07,.07,.07],c:pal[(k+pots.length)%pal.length]})}
}
instanced(new T.CylinderGeometry(1,.72,1,10),lam('#ffffff'),pots,{cast:!mobile});
instanced(new T.SphereGeometry(1,5,3),lam('#ffffff'),potPlants);
instanced(new T.SphereGeometry(1,6,4),lam('#ffffff',{emissive:'#3a2208',emissiveIntensity:.35}),potFlowers);
const lanterns=[];const paper=new T.MeshStandardMaterial({color:'#ffcf8a',emissive:'#ff9a3c',emissiveIntensity:1.6,roughness:.7});
for(const [x,z] of [[PX-2.4,PZ+2.45],[PX+2.4,PZ+2.45]]){const l=new T.Group();l.position.set(x,3.05,z);scene.add(l);
 const body=new T.Mesh(new T.SphereGeometry(.26,10,8),paper);body.scale.y=1.25;l.add(body);
 for(const y of [-.31,.31]){const cap=new T.Mesh(new T.CylinderGeometry(.12,.12,.06,8),wood);cap.position.y=y;l.add(cap)}
 const string=new T.Mesh(new T.CylinderGeometry(.01,.01,.5,4),wood);string.position.y=.56;l.add(string);
 const tassel=new T.Mesh(new T.ConeGeometry(.04,.18,5),lam('#b5452f'));tassel.position.y=-.44;tassel.rotation.x=Math.PI;l.add(tassel);lanterns.push(l)}

/* ---------- Fireflies (one Points draw) ---------- */
const FN=mobile?90:150,fp=new Float32Array(FN*3),fph=new Float32Array(FN);
for(let i=0;i<FN;i++){let x,z;const r=rand();
 if(r<.25){x=PX+range(-5,5);z=PZ+range(-5,5)}else if(r<.4){x=pondX+range(-4,4);z=pondZ+range(-4,4)}else{x=range(-26,26);z=range(-30,17)}
 fp.set([x,range(.35,2.6),z],i*3);fph[i]=rand()*100}
const fgeo=new T.BufferGeometry();fgeo.setAttribute('position',new T.BufferAttribute(fp,3));fgeo.setAttribute('phase',new T.BufferAttribute(fph,1));
const fmat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uScale:{value:innerHeight*.5}},
 vertexShader:`attribute float phase;uniform float uTime;uniform float uScale;varying float vA;
 void main(){vec3 p=position;float t=uTime*.35+phase;p.x+=sin(t*1.3)*.6+sin(t*.37)*1.2;p.z+=cos(t*1.1)*.6+cos(t*.29)*1.2;p.y+=sin(t*1.7)*.25;
 vA=.35+.65*pow(max(0.,sin(uTime*1.6+phase*3.)),3.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uScale*.16/max(1.,-mv.z)*(.7+vA*.6);gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a=a*a;gl_FragColor=vec4(vec3(1.,.82,.45)*a*vA*1.4,a*vA);}`});
const fireflies=new T.Points(fgeo,fmat);fireflies.frustumCulled=false;scene.add(fireflies);
addEventListener('resize',()=>{fmat.uniforms.uScale.value=innerHeight*.5});

/* ---------- Drifting petals (instanced, CPU-animated) ---------- */
const PN=mobile?40:70,petals=new T.InstancedMesh(new T.PlaneGeometry(.11,.07),new T.MeshStandardMaterial({color:'#ffffff',side:T.DoubleSide,roughness:.9,emissive:'#4a2a12',emissiveIntensity:.25}),PN);
const pst=[];for(let i=0;i<PN;i++){pst.push({x:range(-18,18),y:range(0,7),z:range(-24,14),vy:range(.18,.35),sw:range(.4,1.2),ph:rand()*6.28,rs:range(1,3)});petals.setColorAt(i,new T.Color(['#f3c3c0','#fff1d6','#f6d7a7','#e9a58a'][i%4]))}
petals.frustumCulled=false;scene.add(petals);

/* ---------- Butterflies (2 wings each, instanced) ---------- */
const BN=mobile?5:8,wingGeo=new T.CircleGeometry(.12,8);wingGeo.scale(1,.75,1);wingGeo.translate(.12,0,0);wingGeo.rotateX(-Math.PI/2);
const wings=new T.InstancedMesh(wingGeo,new T.MeshStandardMaterial({color:'#ffffff',side:T.DoubleSide,roughness:.7,emissive:'#3a1e08',emissiveIntensity:.3}),BN*2);wings.frustumCulled=false;scene.add(wings);
const homes=[[-3.4,-2],[3.4,-2],[PX-4.5,PZ+5],[-8,6],[8,6],[-14,-6],[14,-6],[0,9]];
const bst=[];for(let i=0;i<BN;i++){const [hx,hz]=homes[i%homes.length];bst.push({hx,hz,ph:rand()*6.28,sp:range(.25,.45),r:range(1.2,2.4)});const c=new T.Color(['#f0a24a','#fff0cf','#e9785a','#f6c76a'][i%4]);wings.setColorAt(i*2,c);wings.setColorAt(i*2+1,c)}

/* ---------- Animate ---------- */
const reduce=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;let last=performance.now()/1000;
const q=new T.Quaternion(),e=new T.Euler(),m=new T.Matrix4(),pos=new T.Vector3(),scl=new T.Vector3(1,1,1);
function frame(){requestAnimationFrame(frame);const now=performance.now()/1000,dt=Math.min(.05,now-last);last=now;if(document.hidden)return;
 const t=reduce?0:now;fmat.uniforms.uTime.value=t;
 if(!reduce){for(let i=0;i<PN;i++){const p=pst[i];p.y-=p.vy*dt;p.x+=Math.sin(now*.6+p.ph)*p.sw*dt+.12*dt;p.z+=Math.cos(now*.4+p.ph)*p.sw*.5*dt;if(p.y<.05){p.y=range(5,8);p.x=range(-18,18);p.z=range(-24,14)}
   e.set(now*p.rs+p.ph,now*p.rs*.7,p.ph);q.setFromEuler(e);pos.set(p.x,p.y,p.z);m.compose(pos,q,scl);petals.setMatrixAt(i,m)}petals.instanceMatrix.needsUpdate=true;
  for(let i=0;i<BN;i++){const b=bst[i],a=now*b.sp+b.ph,x=b.hx+Math.cos(a)*b.r+Math.sin(a*2.3)*.4,z=b.hz+Math.sin(a*1.3)*b.r,y=.7+Math.sin(a*3.1)*.35+.25,heading=Math.atan2(-Math.sin(a)*b.r,Math.cos(a*1.3)*b.r*1.3),flap=Math.sin(now*14+b.ph)*.9;
   for(const s of [0,1]){e.set(0,heading+(s?Math.PI:0),flap,'YXZ');q.setFromEuler(e);pos.set(x,y,z);m.compose(pos,q,scl);wings.setMatrixAt(i*2+s,m)}}wings.instanceMatrix.needsUpdate=true;
  for(const [i,l] of lanterns.entries())l.rotation.z=Math.sin(now*.9+i)*.05;paper.emissiveIntensity=1.5+Math.sin(now*2.3)*.12+Math.sin(now*5.1)*.06;}
}
frame();
window.gardenDecor={fireflies,petals,wings,arch,lanterns};
})();
