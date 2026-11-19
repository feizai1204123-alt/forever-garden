/* Procedural Three.js memorial garden. No image planes or external 3D assets. */
(()=>{'use strict';
try{
const T=THREE, root=document.getElementById('scene');
let seed=8721;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}, range=(a,b)=>a+(b-a)*rand();
const scene=new T.Scene();scene.background=new T.Color('#70656a');scene.fog=new T.FogExp2('#847366',.017);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,window.GARDEN_MOBILE?1.25:1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=window.GARDEN_MOBILE?T.PCFShadowMap:T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.89;root.appendChild(renderer.domElement);
const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,200);
// Dusk gradient: amber along the horizon, subdued violet above the garden.
const sky=new T.Mesh(new T.SphereGeometry(160,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#353848')},horizon:{value:new T.Color('#be8d69')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 v;void main(){float h=clamp(normalize(v).y,0.0,1.0);gl_FragColor=vec4(mix(horizon,top,smoothstep(0.0,0.65,h)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));scene.add(sky);
scene.add(new T.HemisphereLight('#b9b5cd','#393d2b',.85));const sun=new T.DirectionalLight('#ffc173',3.6);sun.position.set(-9,9,-12);sun.castShadow=true;sun.shadow.mapSize.set(window.GARDEN_MOBILE?1024:2048,window.GARDEN_MOBILE?1024:2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.1,far:65});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.shadow.radius=4;scene.add(sun);scene.add(sun.target);
const fill=new T.DirectionalLight('#ffd6a1',.95);fill.position.set(2,6,12);scene.add(fill);
const mat=(c,extra={})=>new T.MeshStandardMaterial({color:c,roughness:.94,...extra});
const stone=mat('#b5a08a'),lightStone=mat('#d2bea1'),darkStone=mat('#817365'),engrave=mat('#705b45'),wood=mat('#674830'),woodLight=mat('#9b7550'),bark=mat('#554538'),green=mat('#475e3e'),gold=mat('#bd8c37'),cream=mat('#f2deb2');
function noiseTexture(){let c=document.createElement('canvas');c.width=c.height=256;let x=c.getContext('2d');x.fillStyle='#f5ebd9';x.fillRect(0,0,256,256);for(let i=0;i<10000;i++){let n=rand()>.5?255:70;x.fillStyle=`rgba(${n},${n*.88},${n*.65},${range(.015,.09)})`;x.beginPath();x.ellipse(rand()*256,rand()*256,range(.3,2.8),range(.3,1.8),rand()*6,0,7);x.fill()}let tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;return tx}const stoneTex=noiseTexture();[stone,lightStone,darkStone].forEach(m=>{m.map=stoneTex;m.bumpMap=stoneTex;m.bumpScale=.045});
const sphere=new T.SphereGeometry(1,20,14),ico=new T.IcosahedronGeometry(1,1),box=new T.BoxGeometry(1,1,1);
function mesh(geo,m,p,s,parent=scene){const o=new T.Mesh(geo,m);o.position.set(...p);if(s)o.scale.set(...s);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
const ell=(p,s,m=stone,parent=scene)=>mesh(sphere,m,p,s,parent),cube=(p,s,m,parent=scene)=>mesh(box,m,p,s,parent);
function beam(a,b,r,m,parent=scene,r2=r){let d=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.CylinderGeometry(r2,r,d.length(),8),m,new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5).toArray(),null,parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o}
function tube(points,r,m,parent=scene){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,6,false),m,[0,0,0],null,parent)}
function paw(x,y,z,s,m,parent){ell([x,y-.13*s,z],[.24*s,.22*s,.035*s],m,parent);[[-.27,.18,-.4],[-.095,.32,-.12],[.105,.32,.12],[.28,.18,.4]].forEach(([dx,dy,a])=>{let o=ell([x+dx*s,y+dy*s,z],[.09*s,.13*s,.035*s],m,parent);o.rotation.z=-a})}
function slab(w,h,d,m,parent){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w*.38);sh.bezierCurveTo(w/2,h+w*.12,-w/2,h+w*.12,-w/2,h-w*.38);sh.closePath();let geo=new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.065,bevelThickness:.06,curveSegments:20});return mesh(geo,m,[0,0,-d/2],null,parent)}
function shadow(x,z,sx,sz,opacity=.16){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,`rgba(74,52,22,${opacity})`);g.addColorStop(1,'rgba(74,52,22,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const o=mesh(new T.PlaneGeometry(sx,sz),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}),[x,.025,z]);o.rotation.x=-Math.PI/2;o.castShadow=false}
// Uneven warm meadow, individual stepping stones.
mesh(new T.CylinderGeometry(36,37,.8,96),mat('#404d35'),[0,-.45,-8]);
const earth=mat('#746747');for(let i=0;i<200;i++){let x=range(-22,22),z=range(-26,15);ell([x,-.16,z],[range(.5,2),range(.08,.22),range(.5,2)],earth)}
for(let i=0;i<12;i++){let z=13-i*1.23,x=Math.sin(i*.74)*.7;let o=mesh(new T.CylinderGeometry(1,1,.12,7),i%2?stone:lightStone,[x,.04,z],[range(1.25,1.7),1,range(.54,.78)]);o.rotation.y=rand()*3;shadow(x,z,3.4,1.7,.13)}
// Pedestal and seated golden-retriever stone sculpture.
const dog=new T.Group();dog.position.set(0,0,-2.5);scene.add(dog);cube([0,.22,0],[4.2,.4,2.8],darkStone,dog);cube([0,1.1,0],[2.75,1.55,1.9],stone,dog);cube([0,1.91,0],[3.15,.22,2.18],lightStone,dog);paw(0,1.08,1,.95,engrave,dog);shadow(0,-2.5,6,4,.26);
ell([0,3.1,-.12],[.86,1.26,.68],stone,dog);ell([0,3.92,.03],[.72,1.04,.61],lightStone,dog);
ell([-.66,2.63,.05],[.61,.65,.67],stone,dog);ell([.65,2.63,.03],[.57,.64,.65],stone,dog);
for(let side of [-1,1]){let leg=ell([side*.43,2.97,.58],[.25,.93,.28],lightStone,dog);leg.rotation.z=side*.08;ell([side*.45,2.16,.73],[.36,.24,.46],lightStone,dog);for(let k=0;k<2;k++)tube([[side*.45+(k-.5)*.14,2.19,1.13],[side*.45+(k-.5)*.14,2.28,1.07]],.012,engrave,dog)}
tube([[.68,2.35,-.3],[1.02,2.24,-.15],[1.16,2.16,.4],[.91,2.13,.66]],.22,stone,dog);
const head=new T.Group();head.position.set(0,4.93,.07);head.rotation.z=-.07;head.rotation.y=.12;dog.add(head);
ell([0,0,0],[.88,.84,.72],lightStone,head);ell([0,-.38,.32],[.73,.6,.57],lightStone,head);
for(let side of [-1,1]){let ear=ell([side*.78,-.22,-.01],[.32,.69,.3],stone,head);ear.rotation.z=side*.19;ell([side*.3,-.18,.63],[.39,.28,.28],lightStone,head);tube([[side*.48,.12,.621],[side*.36,.2,.69],[side*.23,.18,.718]],.025,engrave,head)}
ell([0,-.1,.877],[.19,.115,.1],engrave,head);tube([[0,-.18,.87],[0,-.34,.88],[.22,-.39,.81],[.39,-.28,.77]],.021,engrave,head);tube([[0,-.34,.88],[-.21,-.39,.81],[-.38,-.29,.77]],.018,engrave,head);ell([.16,-.43,.79],[.11,.14,.035],mat('#bf9574'),head);
// Sculpted locks, tapered and layered rather than flat texture.
const furGeo=new T.ConeGeometry(1,1,5);for(let i=0;i<270;i++){let a=range(0,Math.PI*2),v=range(-.8,.75),rad=Math.sqrt(1-v*v);let onHead=i<130,p=onHead?[.84*rad*Math.cos(a),v*.81,rad*.7*Math.sin(a)]:[.79*rad*Math.cos(a),3.5+v*1.3,rad*.61*Math.sin(a)];if(onHead&&p[2]>.42&&p[1]>-.45&&p[1]<.4)continue;let o=mesh(furGeo,i%3?lightStone:stone,p,[range(.07,.12),range(.16,.29),.055],onHead?head:dog);o.rotation.set(.2*Math.sin(a),-a+Math.PI/2,Math.PI+range(-.35,.35))}
for(let side of [-1,1])for(let i=0;i<20;i++){let o=mesh(furGeo,i%3?lightStone:stone,[side*(.72+range(-.09,.2)),range(-.72,.22),range(.14,.29)],[.1,.22,.055],head);o.rotation.z=Math.PI+side*.22}
const collar=mesh(new T.TorusGeometry(.63,.058,8,64),woodLight,[0,4.27,.1],null,dog);collar.rotation.x=Math.PI/2;ell([0,4.08,.7],[.16,.19,.05],gold,dog);paw(0,4.09,.758,.43,lightStone,dog);
const sculpture=new T.Group();const sculptParts=dog.children.slice(8);sculptParts.forEach(o=>sculpture.add(o));sculpture.scale.setScalar(1.23);sculpture.position.y=-.46;dog.add(sculpture);
// Engraved animal portraits on the front memorial stones.
function animal(type,g,z){if(type==='cat'){ell([0,1.05,z],[.25,.39,.017],engrave,g);ell([0,1.49,z],[.24,.22,.018],engrave,g);for(let a of [-1,1]){let o=mesh(new T.ConeGeometry(.13,.24,3),engrave,[a*.15,1.69,z]);o.rotation.y=Math.PI/2}tube([[.13,.78,z],[.42,.79,z],[.55,.98,z],[.49,1.11,z]],.032,engrave,g)}else{ell([0,.96,z],[.24,.35,.02],engrave,g);ell([-.04,1.35,z],[.2,.2,.02],engrave,g);for(let a of [-1,1]){let o=ell([a*.1,1.65,z],[.065,.25,.02],engrave,g);o.rotation.z=a*-.23}ell([.24,.8,z],[.1,.1,.025],engrave,g)}}
const memorials=[];
function grave(x,z,s,type,rot=0){let g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;g.scale.setScalar(s);scene.add(g);memorials.push({x,z,s,group:g});cube([0,.16,.14],[2.3,.29,1.4],darkStone,g);if(type==='empty'||(!type && memorials.length%3===0)){g.userData.emptyMemorial=true;cube([0,.32,0],[2.3,.34,1.4],lightStone,g);shadow(x,z,3*s,2*s,.16);return g;}if(type==='poodle'){g.name='PoodleMemorial';g.userData.isPetMemorial=true;cube([0,.2,0],[2.5,.4,1.92],stone,g);cube([0,.42,0],[2.65,.13,2.02],lightStone,g);window.populatePoodleMemorial({THREE:T,group:g});shadow(x,z,3*s,2.4*s,.2);return g;}let b=slab(1.62,2.5,.32,memorials.length%4===0?lightStone:stone,g);b.position.y=.3;paw(0,2.37,.2,.6,engrave,g);if(type)animal(type,g,.205);else paw(0,1.35,.205,.85,engrave,g);for(let i=0;i<7;i++){ell([range(-.73,.73),range(.45,2.2),.215],[.025,.04,.005],darkStone,g)}shadow(x,z,3*s,2*s,.2);return g}
const cat=grave(-4.35,4.25,1.23,'poodle',.13),rabbit=grave(4.3,5.25,1.21,'rabbit',-.17);
[[-4,-1,.78],[-6,-4,.85],[4,-1.2,.93],[6,-4,.86],[-3.5,-6,.75],[2.7,-6,.9],[7,1.1,.86],[-7,1,.82],[.5,-9,.6]].forEach(a=>grave(...a,null,range(-.18,.18)));
function bowl(g,x,z){mesh(new T.CylinderGeometry(.31,.41,.19,24),lightStone,[x,.41,z],null,g);mesh(new T.CylinderGeometry(.25,.25,.014,24),engrave,[x,.513,z],null,g);paw(x,.42,z+.37,.26,cream,g);for(let i=0;i<22;i++)ell([x+range(-.19,.19),range(.53,.59),z+range(-.15,.15)],[.035,.03,.035],wood,g)}bowl(rabbit,.1,.65);
// Tiny keepsakes: sleeping mouse and plush bunny.
ell([.77,.59,.6],[.2,.27,.16],lightStone,rabbit);ell([.74,.91,.64],[.18,.19,.16],lightStone,rabbit);for(let a of [-1,1]){let o=ell([.74+a*.095,1.17,.64],[.06,.2,.055],lightStone,rabbit);o.rotation.z=-a*.2;ell([.74+a*.07,.94,.79],[.017,.022,.012],engrave,rabbit);ell([.77+a*.16,.38,.7],[.1,.09,.13],lightStone,rabbit)}
// Expanded memorial groves, grouped by paths instead of scattering over circulation.
for(const side of [-1,1])for(const x of [8.9,12.6,15.5])for(const z of [-15,-7,-3,1,5]){
 if(x===15.5&&(z===-15||z===5))continue;
 const atPavilion=side===1&&x===8.9&&z===-7;
 const g=grave((atPavilion?7.8:side*x)+range(-.17,.17),(atPavilion?-12.8:z)+range(-.25,.25),range(.57,.84),rand()<.42?(rand()<.5?'cat':'rabbit'):null,-side*.1+range(-.12,.12));
 g.scale.y*=range(.85,1.15);
}
for(const z of [-14.8,-18.5])for(const x of [-6.8,-3.4,0,3.4,6.8])grave(x,z,range(.64,.89),rand()<.35?'cat':null,range(-.12,.12));
// Extra vacant pedestals for visitor figurines (append after the original 47 so existing ids stay put).
// 纪念位 3 (m2) stays in the garden for Kate but is not offered in the upload list.
if(memorials[2])memorials[2].group.userData.reservedMemorial=true;
[
 [-8.2,-20.6,.72,0],[-5.2,-20.6,.7,0],[0,-20.6,.74,0],[3.2,-20.6,.7,0],[8.2,-20.6,.72,0],
 [-15.5,-15,.7,-Math.PI/2],[15.5,-15,.7,Math.PI/2],[-15.5,5,.7,-Math.PI/2],[15.5,5,.7,Math.PI/2],
 [-8.5,-16.6,.68,Math.PI/2],[8.5,-16.6,.68,-Math.PI/2],[-8.5,-13.2,.68,Math.PI/2],[8.5,-13.2,.68,-Math.PI/2],
 [-13.6,-20.4,.7,0],[13.6,-20.4,.7,0]
].forEach(([x,z,s,rot])=>grave(x,z,s,'empty',rot));
// Low picket fence, including the two foreground gateposts.
function fence(x1,x2,z){for(let x=x1;x<=x2;x+=.58){cube([x,.69,z],[.16,1.25,.16],woodLight);mesh(new T.ConeGeometry(.115,.24,4),woodLight,[x,1.43,z]).rotation.y=Math.PI/4}for(let y of [.5,1.04])cube([(x1+x2)/2,y,z],[x2-x1,.13,.13],woodLight)}fence(-18,18,-22);fence(-18,-3.4,11.2);fence(3.6,18,11.2);
for(let x of [-3.5,3.6]){cube([x,1.1,10],[.65,2.1,.65],stone);mesh(new T.ConeGeometry(.48,.35,4),lightStone,[x,2.3,10]).rotation.y=Math.PI/4;paw(x,1.4,10.335,.6,engrave,scene)}
// Timber memorial pavilion.
const pavilion=new T.Group();pavilion.position.set(6.7,0,-7.2);scene.add(pavilion);cube([0,.17,0],[4.8,.32,4.2],stone,pavilion);for(let x of [-2,2])for(let z of [-1.65,1.65]){cube([x,1.9,z],[.23,3.5,.23],woodLight,pavilion);beam([x,3.15,z],[x-Math.sign(x)*.65,3.8,z],.08,woodLight,pavilion)}for(let z of [-1.7,1.7]){cube([0,3.7,z],[4.5,.2,.2],woodLight,pavilion);beam([-2.45,3.72,z],[0,5.02,z],.115,woodLight,pavilion);beam([0,5.02,z],[2.45,3.72,z],.115,woodLight,pavilion)}
for(let side of [-1,1]){let roof=cube([side*1.23,4.42,0],[2.9,.15,4.3],mat('#b47942'),pavilion);roof.rotation.z=-side*.49;for(let i=0;i<14;i++){let r=cube([side*1.23,4.52,-2.04+i*.32],[2.94,.045,.035],woodLight,pavilion);r.rotation.z=-side*.49}}
cube([0,.65,-1.45],[3.4,.15,.65],wood,pavilion);cube([0,1.18,-1.7],[3.4,.7,.12],woodLight,pavilion);paw(0,4.18,1.84,.55,wood,pavilion);
// Framing oak: branching trunk and thousands of individually modeled leaves.
const leaves=[];const leafGeo=window.GARDEN_MOBILE?new T.SphereGeometry(1,5,3):new T.SphereGeometry(1,7,4),leafColors=['#726037','#b18039','#c29a48','#526044','#967144'];
function tree(x,z,h,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);beam([0,0,0],[.18,h*.65,0],.42,bark,g,.24);for(let j=0;j<7;j++){let a=j*2.4,yy=h*range(.5,.85),xx=Math.cos(a)*range(1.3,2.4),zz=Math.sin(a)*range(1.1,2);beam([.1,yy*.65,0],[xx,yy,zz],.14,bark,g,.05);beam([xx*.6,yy*.85,zz*.6],[xx*.8,yy+1,zz*1.2],.07,bark,g,.024);for(let k=0;k<240;k++){let px=xx+range(-1.6,1.6),py=yy+range(-.35,1.3),pz=zz+range(-1.4,1.4);leaves.push({p:[x+px*scale,py*scale,z+pz*scale],s:[range(.11,.26)*scale,range(.025,.055)*scale,range(.12,.25)*scale],r:[rand()*3,rand()*6,rand()*6],c:leafColors[Math.floor(rand()*5)]})}}}
tree(-7,-2,10.1,1.1);tree(10,-7,9.6,1);tree(-9,-13,8.6,1);tree(6,-16,9,1.1);tree(-3,-19,8,1);tree(13,-17,10,1);
for(const [x,z,h,k] of [[-17,-17,9,1],[-19,-8,8,1],[19,-17,10,1],[-13,-24,10,1],[0,-27,11,1.1],[12,-25,10,1],[20,1,9,.9],[-20,3,8,.9]])tree(x,z,h,k);
function instances(geo,entries,material,cast=true){const im=new T.InstancedMesh(geo,material,entries.length),o=new T.Object3D();entries.forEach((v,i)=>{o.position.set(...v.p);o.scale.set(...v.s);o.rotation.set(...(v.r||[0,0,0]));o.updateMatrix();im.setMatrixAt(i,o.matrix);if(v.c)im.setColorAt(i,new T.Color(v.c))});im.castShadow=cast;im.receiveShadow=true;scene.add(im);return im}instances(leafGeo,leaves,mat('#ffffff'));
// Wooden sign, hanging lantern, ivy around the oak.
const sign=new T.Group();sign.position.set(-6.6,4.7,-.95);sign.rotation.y=.1;scene.add(sign);cube([0,0,0],[3.45,.87,.16],woodLight,sign);cube([-.27,.84,0],[2.9,.64,.17],wood,sign);paw(-.1,.87,.11,.65,engrave,sign);
const cv=document.createElement('canvas');cv.width=1024;cv.height=256;let ctx=cv.getContext('2d');ctx.fillStyle='#644423';ctx.font='bold 118px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((window.gT||String)('宠物墓地'),465,132,700);ctx.fillStyle='#a55336';ctx.font='90px serif';ctx.fillText('♥',858,132);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;mesh(new T.PlaneGeometry(3.2,.8),new T.MeshBasicMaterial({map:tx,transparent:true}),[0,0,.09],null,sign);
const lantern=new T.Group();lantern.position.set(-4.76,5.6,-.9);scene.add(lantern);beam([0,.5,0],[0,1.25,0],.025,engrave,lantern);mesh(new T.ConeGeometry(.42,.27,4),wood,[0,.46,0],null,lantern).rotation.y=Math.PI/4;cube([0,-.34,0],[.58,.09,.51],wood,lantern);for(let x of [-.24,.24])for(let z of [-.2,.2])cube([x,.04,z],[.045,.73,.045],wood,lantern);ell([0,.02,0],[.12,.25,.12],mat('#ffeaa8',{emissive:'#ffc344',emissiveIntensity:2}),lantern);const pl=new T.PointLight('#ffbb4f',3,3);pl.position.copy(lantern.position);scene.add(pl);
for(let i=0;i<85;i++){let y=range(.3,6),a=y*3;ell([-7.1+Math.cos(a)*.48,y,-2+Math.sin(a)*.5],[.13,.21,.065],green).rotation.z=range(-1,1)}
// Park infrastructure: continuous loop, cross paths, hedges and intimate gathering spaces.
const pathStone=mat('#91816a'),hedgeMat=mat('#344d39'),hedgeTips=mat('#536344'),metal=mat('#463c32',{metalness:.6});
const pathFootprints=[],walkRoutes=[],solidObjects=[];
solidObjects.push(...pavilion.children.filter(o=>o.position.z< -1&&o.position.y<1.5));
const walkAreas=[{minX:4.3,maxX:9.1,minZ:-9.3,maxZ:-5.1}];
function route(points,width=.82){walkRoutes.push({points,width});}
const mainRoute=[];for(let i=0;i<12;i++)mainRoute.push([Math.sin(i*.74)*.7,13-i*1.23]);route(mainRoute,1.18);
// Rounded perimeter stays outside the memorial beds, with entrances at every junction.
const perimeter=[];for(const [cx,cz,start] of [[15,7,0],[-15,7,Math.PI/2],[-15,-18,Math.PI],[15,-18,Math.PI*1.5]])for(let i=0;i<=12;i++){const a=start+i/12*Math.PI/2;perimeter.push([cx+Math.cos(a)*2,cz+Math.sin(a)*2]);}perimeter.push(perimeter[0]);route(perimeter,.83);
for(const side of [-1,1]){route([[side*10.6,-20],[side*10.6,9]],.83);route([[0,8.2],[side*17,8.2]],.85);}
route([[-17,-11],[17,-11]],.83);
route([[10.6,-8.1],[8.5,-8.1]],.9);
const walkingSurface=window.createGardenNavigation({routes:walkRoutes,areas:walkAreas,radius:0});
function pathStoneAt(x,z,sx,sz,a){const o=mesh(new T.CylinderGeometry(1,1,.075,7),pathStone,[x,.045,z],[sx,1,sz]);o.rotation.y=a;pathFootprints.push({x,z,r:Math.max(sx,sz)*.9});}
for(let i=1;i<perimeter.length;i++){const a=perimeter[i-1],b=perimeter[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<len;t+=1.05)pathStoneAt(a[0]+(b[0]-a[0])*t/len,a[1]+(b[1]-a[1])*t/len,.72,.64,Math.atan2(b[0]-a[0],b[1]-a[1]));}
for(let side of [-1,1])for(let z=-20;z<=9;z+=1.06)pathStoneAt(side*10.6,z,.68,.6,range(-.15,.15));
for(let x=-17;x<=17;x+=1.05)pathStoneAt(x,-11,.66,.62,range(-.2,.2));
for(let side of [-1,1])for(let x=0;x<=17;x+=1.05)pathStoneAt(side*x,8.2,.63,.62,range(-.2,.2));
// A continuous gravel margin makes the collision boundary visible between stepping stones.
const trailMat=mat('#655d49');
for(const r of walkRoutes)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1];const strip=cube([(a[0]+b[0])/2,.006,(a[1]+b[1])/2],[r.width*2,.015,Math.hypot(dx,dz)+.04],trailMat);strip.rotation.y=Math.atan2(dx,dz);}
for(let x=8.5;x<=10.6;x+=.7)pathStoneAt(x,-8.1,.62,.62,0);
function hedgeLine(x1,z1,x2,z2){const len=Math.hypot(x2-x1,z2-z1),n=Math.ceil(len/.65);for(let i=0;i<=n;i++){let t=i/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;solidObjects.push(mesh(ico,i%3?hedgeMat:hedgeTips,[x,.43,z],[.52,range(.36,.56),.5]));}beam([x1,.14,z1],[x2,.14,z2],.13,darkStone);}
for(const side of [-1,1]){hedgeLine(side*18,-21,side*18,9);hedgeLine(side*3.1,-21.5,side*16.7,-21.5);hedgeLine(side*8,6.7,side*9.25,6.7);hedgeLine(side*11.95,6.7,side*15,6.7);hedgeLine(side*11.7,-8.5,side*15.1,-8.5);hedgeLine(side*11.7,-16.6,side*15.1,-16.6);}
// Entrance: short stone walls, open wooden gate and flowering side trellises.
for(const side of [-1,1]){
 cube([side*4.5,.42,11.2],[1.5,.84,.72],darkStone);
 const trellis=new T.Group();trellis.position.set(side*5.8,0,10.3);scene.add(trellis);
 for(const x of [-.7,.7])cube([x,1.6,0],[.12,3.2,.12],woodLight,trellis);
 for(let y=.8;y<3.2;y+=.43)cube([0,y,0],[1.55,.065,.07],woodLight,trellis);
 for(let x=-.45;x<.6;x+=.3)cube([x,1.85,0],[.055,2.7,.055],wood,trellis);
 for(let j=0;j<15;j++){let y=range(.4,3.2),x=Math.sin(y*3)*.55;ell([x,y,.08],[.16,.23,.09],green,trellis);if(j%3===0)ell([x+.08,y+.1,.15],[.09,.09,.055],mat('#c09782'),trellis);}
}
function bench(x,z,a){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=a;scene.add(g);solidObjects.push(g);for(let j=0;j<4;j++)cube([0,.62,(j-1.5)*.16],[2.3,.1,.12],woodLight,g);for(let j=0;j<3;j++)cube([0,.95+j*.18,-.32],[2.3,.12,.1],woodLight,g);for(const s of [-1,1]){for(const zz of [-.26,.26])cube([s*.88,.32,zz],[.1,.62,.1],metal,g);cube([s*1.06,.88,0],[.08,.08,.75],metal,g);cube([s*1.06,.7,.25],[.08,.35,.08],metal,g);cube([s*.88,.97,-.35],[.08,.9,.08],metal,g);}shadow(x,z,3,1.7,.3);}
bench(-12.3,10.3,Math.PI-.08);bench(12.3,10.3,Math.PI+.08);/* entrance benches face into the garden */bench(-3.3,-11.9,.1);bench(3.3,-11.9,-.1);
// A small water garden with stone rim, lily leaves and soft reflection.
const pondX=-12.8,pondZ=-12.6;
mesh(new T.CylinderGeometry(1.55,1.65,.18,48),darkStone,[pondX,.06,pondZ],[1.1,1,.85]);
const water=mesh(new T.CircleGeometry(1.43,48),mat('#355b59',{roughness:.23,metalness:.55,transparent:true,opacity:.92}),[pondX,.165,pondZ],[1.1,.85,1]);water.rotation.x=-Math.PI/2;
for(let i=0;i<18;i++){let a=i/18*Math.PI*2;ell([pondX+Math.cos(a)*1.68,.18,pondZ+Math.sin(a)*1.3],[.27,.17,.22],i%2?stone:darkStone);}
for(let i=0;i<6;i++){let x=pondX+range(-1,1),z=pondZ+range(-.7,.7);const lily=mesh(new T.CircleGeometry(.2,12),green,[x,.18,z]);lily.rotation.x=-Math.PI/2;ell([x,.205,z],[.08,.04,.08],cream);}
// Shared warm lamp glow; only a handful of true lights keep the expanded garden fast.
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;let gc=glowCanvas.getContext('2d'),gg=gc.createRadialGradient(32,32,0,32,32,32);gg.addColorStop(0,'rgba(255,217,135,.9)');gg.addColorStop(.18,'rgba(255,181,77,.33)');gg.addColorStop(1,'rgba(255,160,60,0)');gc.fillStyle=gg;gc.fillRect(0,0,64,64);const glowTexture=new T.CanvasTexture(glowCanvas);
const flame=mat('#ffe8aa',{emissive:'#ffc166',emissiveIntensity:3});
function warmGlow(x,y,z,size){const sp=new T.Sprite(new T.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));sp.position.set(x,y,z);sp.scale.set(size,size,1);scene.add(sp);}
function pathLamp(x,z,tall=false,lit=false){const h=tall?2.85:1.05;cube([x,.12,z],[.32,.24,.32],darkStone);beam([x,.15,z],[x,h,z],tall?.055:.045,metal);cube([x,h,z],[.34,.07,.34],metal);ell([x,h+.19,z],[.12,.19,.12],flame);for(const sx of [-1,1])for(const sz of [-1,1])cube([x+sx*.15,h+.2,z+sz*.15],[.025,.4,.025],metal);mesh(new T.ConeGeometry(.29,.16,4),metal,[x,h+.45,z]).rotation.y=Math.PI/4;warmGlow(x,h+.2,z,1.5);const pool=mesh(new T.PlaneGeometry(3.7,3.7),new T.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.28,depthWrite:false,blending:T.AdditiveBlending}),[x,.09,z]);pool.rotation.x=-Math.PI/2;pool.castShadow=false;if(lit&&window.GARDEN_MOBILE)pool.material.opacity=.4;if(lit&&!window.GARDEN_MOBILE){const l=new T.PointLight('#ffb75a',9,6,2);l.position.set(x,h+.25,z);scene.add(l);}}
for(const side of [-1,1]){for(const z of [7.4,2,-4.8,-11,-17.6])pathLamp(side*11.5,z,z===7.4||z===-11,z===7.4);for(const z of [8.7,3,-4.4])pathLamp(side*2.4,z,false,z===3);pathLamp(side*3.5,10,true,true);}
// Warm lights beneath the pavilion's roof.
for(let i=0;i<9;i++){let x=4.7+i*.5,y=3.55-Math.sin(i/8*Math.PI)*.38;ell([x,y,-5.35],[.065,.095,.065],flame);warmGlow(x,y,-5.35,.6);}tube([[4.7,3.6,-5.35],[6.7,3.2,-5.35],[8.7,3.6,-5.35]],.014,metal);
const pavilionLight=new T.PointLight('#ffbc70',14,7,2);pavilionLight.position.set(6.7,2.8,-7);scene.add(pavilionLight);
function parkSign(x,z,label){beam([x,0,z],[x,1.7,z],.06,wood);cube([x,1.63,z],[1.55,.45,.1],woodLight);let c=document.createElement('canvas');c.width=512;c.height=128;let q=c.getContext('2d');q.fillStyle='#f4dfb9';q.font='52px "Microsoft YaHei",sans-serif';q.textAlign='center';q.textBaseline='middle';q.fillText((window.gT||String)(label),256,64,490);let t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;mesh(new T.PlaneGeometry(1.4,.35),new T.MeshBasicMaterial({map:t,transparent:true}),[x,1.63,z+.058]);}
parkSign(-9.3,7.5,'花语纪念区');parkSign(9.3,7.5,'星光纪念区');parkSign(-5.4,-10,'静谧水庭');parkSign(3.8,-10,'林间花园');
function onPath(x,z){if(walkingSurface.surface(x,z,-.4))return true;if(Math.abs(x-Math.sin((13-z)/1.23*.74)*.7)<1.3&&z>0)return true;if(Math.abs(x)<2.15&&z<-.8&&z>-4.2)return true;if(Math.hypot((x-pondX)/1.1,(z-pondZ)/.85)<1.8)return true;if(pathFootprints.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+.14))return true;return memorials.some(g=>Math.abs(x-g.x)<g.s*1.2&&Math.abs(z-g.z)<g.s*.8);}
// Meadow flowers: instanced stems, leaves, petals and pollen hearts.
const stems=[],petals=[],centers=[],grass=[];const petalColors=['#fff1bf','#ffe6a2','#eeb173','#e7a29a','#f4c5b0','#e9b13b'];
function flower(x,y,z,size,color){stems.push({p:[x,y+size*.43,z],s:[.018,size*.86,.018]});for(let k=0;k<2;k++)grass.push({p:[x+(k?-.08:.08)*size,y+size*(.3+k*.17),z],s:[.13*size,.035,.045*size],r:[0,k*2,.45]});const count=7;for(let j=0;j<count;j++){let a=j/count*Math.PI*2;petals.push({p:[x+Math.sin(a)*size*.17,y+size+Math.cos(a)*size*.15,z+.015],s:[size*.07,size*.155,size*.035],r:[.25,0,-a],c:color})}centers.push({p:[x,y+size,z+.04],s:[size*.085,size*.085,size*.055]})}
for(let i=0;i<2200;i++){let x=range(-18,18),z=range(-21,11);if(onPath(x,z))continue;let size=range(.2,.68),pc=petalColors[Math.floor(rand()*petalColors.length)];if(window.GARDEN_MOBILE&&i%2)continue;flower(x,0,z,size,pc)}
// Taller yellow daisies surrounding the statue.
for(let i=0;i<95;i++){let side=i%2?1:-1,x=side*range(1.8,3.4),z=range(-4.5,-.2);if(walkingSurface.surface(x,z,-.7))continue;flower(x,0,z,range(.65,1.6),i%3?'#ecc348':'#ffe5a6')}
for(let i=0;i<19000;i++){let x=range(-22,22),z=range(-27,15);if(onPath(x,z))continue;const blade={p:[x,range(.02,.12),z],s:[range(.018,.055),range(.09,.26),.025],r:[range(-.3,.3),rand()*6,range(-.6,.6)],c:['#526442','#6c754a','#8a8052','#a48e59'][i%4]};if(!(window.GARDEN_MOBILE&&i%5<2))grass.push(blade)}
const flowerGeometry=window.GARDEN_MOBILE?new T.SphereGeometry(1,6,4):new T.SphereGeometry(1,8,6);
instances(new T.CylinderGeometry(1,1,1,4),stems,green,false);instances(flowerGeometry,petals,mat('#ffffff'),false);instances(flowerGeometry,centers,gold,false);instances(new T.ConeGeometry(1,1,3),grass,mat('#9ea184'),false);
function bouquet(parent,x,z){mesh(new T.CylinderGeometry(.13,.19,.47,16),mat('#adad87',{metalness:.17,roughness:.4}),[x,.53,z],null,parent);for(let i=0;i<9;i++){let a=i*2.4,xx=x+Math.cos(a)*.27,zz=z+Math.sin(a)*.16,y=.95+rand()*.45;beam([x,.7,z],[xx,y,zz],.012,green,parent);for(let j=0;j<6;j++){let b=j/6*Math.PI*2;let p=ell([xx+Math.sin(b)*.12,y+Math.cos(b)*.12,zz],[.055,.14,.025],cream,parent);p.rotation.z=-b}ell([xx,y,zz+.035],[.055,.055,.03],gold,parent)}}bouquet(rabbit,-.66,.65);
memorials.forEach((m,i)=>{if(i<11||m.group.userData.emptyMemorial)return;if(i%3===0)bouquet(m.group,-.75,.55);else if(i%3===1){mesh(new T.CylinderGeometry(.1,.12,.24,10),cream,[.7,.4,.55],null,m.group);ell([.7,.55,.55],[.035,.07,.035],flame,m.group);}});
// Sun disk and soft halo behind the sculpture.
const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=256;let hc=haloCanvas.getContext('2d'),hg=hc.createRadialGradient(128,128,0,128,128,128);hg.addColorStop(0,'rgba(255,210,139,.8)');hg.addColorStop(.17,'rgba(255,231,155,.4)');hg.addColorStop(1,'rgba(255,220,150,0)');hc.fillStyle=hg;hc.fillRect(0,0,256,256);const halo=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(haloCanvas),transparent:true,depthWrite:false,blending:T.AdditiveBlending}));halo.position.set(-9,6,-25);halo.scale.set(15,15,1);scene.add(halo);
const motes=[];for(let i=0;i<85;i++)motes.push({p:[range(-9,9),range(.5,9),range(-7,11)],s:[range(.016,.034),range(.016,.034),range(.016,.034)]});const dust=instances(sphere,motes,new T.MeshBasicMaterial({color:'#fff1be',transparent:true,opacity:.72}),false);
const falling=[];for(let i=0;i<24;i++){let o=mesh(leafGeo,gold,[range(-9,9),range(2,11),range(-8,9)],[.07,.025,.12]);o.castShadow=false;falling.push(o)}
// Give each memorial more breathing room without enlarging the monuments themselves.
// Widen the park and connected paths together, so graves stay inside their garden plots.
const parkSpacing=1.5,park=new T.Group();
for(const child of [...scene.children]){
 if(child===sky)continue;
 if(child.isLight||child===sun.target){child.position.x*=parkSpacing;child.position.z*=parkSpacing;continue;}
 park.add(child);
}
park.scale.set(parkSpacing,1,parkSpacing);scene.add(park);
for(const g of [dog,...memorials.map(m=>m.group)]){g.scale.x/=parkSpacing;g.scale.z/=parkSpacing;}
// Pointer orbit with mobile pinch zoom. Initial camera matches the reference composition.
let controller=null;
const target=new T.Vector3(0,2.65,-1.1);let yaw=0,pitch=1.18,distance=29,auto=false,moving=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0;
function frameCamera(){camera.position.set(target.x+distance*Math.sin(pitch)*Math.sin(yaw),target.y+distance*Math.cos(pitch),target.z+distance*Math.sin(pitch)*Math.cos(yaw));camera.lookAt(target)}
function reset(){if(controller?.active)controller.setActive(false);target.set(0,2.65,-1.65);yaw=0;pitch=1.22;distance=innerWidth<600?36:29;auto=false;document.getElementById('orbit').setAttribute('aria-pressed','false');document.getElementById('orbit').textContent='环绕漫游';frameCamera()}reset();
const pointers=new Map();let prevPinch=0;renderer.domElement.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);auto=false;document.getElementById('orbit').textContent='环绕漫游';document.getElementById('orbit').setAttribute('aria-pressed','false')});renderer.domElement.addEventListener('pointermove',e=>{let p=pointers.get(e.pointerId);if(!p)return;let dx=e.clientX-p.x,dy=e.clientY-p.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){let [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(prevPinch)distance=T.MathUtils.clamp(distance*prevPinch/d,3,105);prevPinch=d}else{yaw-=dx*.004;pitch=T.MathUtils.clamp(pitch-dy*.003,.35,1.51)}frameCamera()});function pointerEnd(e){pointers.delete(e.pointerId);prevPinch=0}renderer.domElement.addEventListener('pointerup',pointerEnd);renderer.domElement.addEventListener('pointercancel',pointerEnd);renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance*Math.exp(e.deltaY*.0008),3,105);frameCamera()},{passive:false});renderer.domElement.addEventListener('dblclick',reset);document.getElementById('reset').onclick=reset;document.getElementById('pet-view').onclick=()=>{if(controller?.active)controller.setActive(false);auto=false;document.getElementById('orbit').textContent='环绕漫游';document.getElementById('orbit').setAttribute('aria-pressed','false');const pos=cat.getWorldPosition(new T.Vector3());target.set(pos.x,1.05,pos.z);yaw=.12;pitch=1.23;distance=innerWidth<600?8.8:6.5;frameCamera();};document.getElementById('overview').onclick=()=>{if(controller?.active)controller.setActive(false);auto=false;document.getElementById('orbit').textContent='环绕漫游';document.getElementById('orbit').setAttribute('aria-pressed','false');target.set(0,0,-7.5);yaw=-.3;pitch=.63;distance=innerWidth<600?94:69;frameCamera()};document.getElementById('orbit').onclick=e=>{if(controller?.active)controller.setActive(false);auto=!auto;e.currentTarget.textContent=auto?'停止漫游':'环绕漫游';e.currentTarget.setAttribute('aria-pressed',String(auto))};document.getElementById('motion').setAttribute('aria-pressed',String(moving));document.getElementById('motion').textContent=moving?'微风 · 开':'微风 · 关';document.getElementById('motion').onclick=e=>{moving=!moving;e.currentTarget.textContent=moving?'微风 · 开':'微风 · 关';e.currentTarget.setAttribute('aria-pressed',String(moving))};document.getElementById('save').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=(window.gT||String)('永远的花园.png');a.href=renderer.domElement.toDataURL('image/png');a.click()};
function fitFov(){const wide=window.GARDEN_MOBILE&&innerWidth>innerHeight;camera.fov=wide?50:43;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}fitFov();addEventListener('resize',()=>{fitFov();renderer.setSize(innerWidth,innerHeight)});
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D 花园。方向键调整视角，加减键缩放，Home 恢复视角。');renderer.domElement.addEventListener('keydown',e=>{if(controller?.active)return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')reset();if(e.key==='ArrowLeft')yaw-=.07;if(e.key==='ArrowRight')yaw+=.07;if(e.key==='ArrowUp')pitch=Math.max(.35,pitch-.05);if(e.key==='ArrowDown')pitch=Math.min(1.51,pitch+.05);if(e.key==='+')distance=Math.max(11,distance-1);if(e.key==='-')distance=Math.min(105,distance+1);frameCamera()});
const dummy=new T.Object3D();function animate(t){requestAnimationFrame(animate);let dt=Math.min((t-last)/1000,.1);last=t;if(controller)controller.update(dt);if(auto){yaw+=dt*.11;frameCamera()}if(moving){falling.forEach((o,i)=>{o.position.y-=dt*(.14+i%5*.035);o.position.x+=Math.sin(t*.0004+i)*dt*.09;o.rotation.x+=dt*.3;o.rotation.z+=dt*.22;if(o.position.y<.1)o.position.y=10});motes.forEach((m,i)=>{dummy.position.set(m.p[0]+Math.sin(t*.0003+i)*.2,m.p[1]+Math.sin(t*.0005+i)*.2,m.p[2]);dummy.scale.set(...m.s);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix)});dust.instanceMatrix.needsUpdate=true}renderer.render(scene,camera)}
renderer.render(scene,camera);document.getElementById('loading').remove();requestAnimationFrame(animate);window.garden={scene,camera,renderer,memorials,statue:dog,reset,falling,memorialCount:memorials.length,stats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
const followDest=new T.Vector3();controller=window.createGardenCharacter({scene,camera,renderer,memorials,parkSpacing,walkRoutes,walkAreas,solidObjects,
 beginFollow(position){auto=false;document.getElementById('orbit').textContent='环绕漫游';document.getElementById('orbit').setAttribute('aria-pressed','false');yaw=0;pitch=1.12;distance=innerWidth<600?8.5:(window.GARDEN_MOBILE&&innerHeight<520?6.4:7);pitch=window.GARDEN_MOBILE&&innerWidth>innerHeight?1.08:1.12;target.copy(position).add(new T.Vector3(0,1.1,0));frameCamera();},
 follow(position,dt){followDest.set(position.x,position.y+1.1,position.z);target.lerp(followDest,1-Math.exp(-9*dt));frameCamera();},endFollow(){},
 getView(){return {pitch,distance}},setView(v){if(v&&v.pitch!=null)pitch=v.pitch;if(v&&v.distance!=null)distance=v.distance}
});window.garden.controller=controller;

}catch(e){document.getElementById('error').textContent='花园暂时无法显示。\n请使用支持 WebGL 的浏览器打开，并保持 vendor 文件夹与页面放在一起。\n'+e.message;console.error(e)}
})();




