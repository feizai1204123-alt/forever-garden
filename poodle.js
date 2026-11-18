/* The user's textured poodle replaces one front-left memorial stone. */
window.populatePoodleMemorial=function({THREE:T,group}){
 const label=document.createElement('canvas');label.width=768;label.height=128;const c=label.getContext('2d');c.fillStyle='#d2b68a';c.fillRect(0,0,768,128);c.fillStyle='#493424';c.textAlign='center';c.textBaseline='middle';c.font='48px "Microsoft YaHei",sans-serif';c.fillText('花开不忘 · 永远相伴',384,64);const texture=new T.CanvasTexture(label);texture.colorSpace=T.SRGBColorSpace;
 const plaque=new T.Mesh(new T.PlaneGeometry(1.8,.3),new T.MeshBasicMaterial({map:texture,transparent:true}));plaque.position.set(0,.23,.966);group.add(plaque);
 const status=document.getElementById('pet-status');status.textContent='正在载入宠物纪念像…';
 const fail=e=>{console.error('Poodle memorial loading failed',e);status.textContent='宠物纪念像载入失败，请重新打开页面。';};
 const onGltf=gltf=>{
   const pet=gltf.scene;pet.name='Poodle in Bloom';pet.updateMatrixWorld(true);const box=new T.Box3().setFromObject(pet),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
   const scale=Math.min(2.55/size.y,2.05/size.x,1.62/size.z);pet.scale.setScalar(scale);pet.position.set(-center.x*scale,.485-box.min.y*scale,-center.z*scale-.02);
   pet.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.roughness=.82;o.material.metalness=0;}}});group.add(pet);group.updateWorldMatrix(true,true);
   group.userData.petLoaded=true;window.dispatchEvent(new CustomEvent('garden-memorial-ready',{detail:{group}}));
   status.textContent='宠物纪念像已安放 · 入口左侧';status.dataset.loaded='true';
 };
 const fromBase64=()=>{try{const raw=atob(window.GARDEN_POODLE_BASE64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);delete window.GARDEN_POODLE_BASE64;new T.GLTFLoader().parse(bytes.buffer,'',onGltf,fail);}catch(e){fail(e);}};
 if(location.protocol==='file:'||window.GARDEN_POODLE_BASE64)fromBase64();
 else{
  const loader=new T.GLTFLoader();if(window.MeshoptDecoder&&loader.setMeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);
  loader.load('assets/poodle-memorial.mobile.glb',onGltf,xhr=>{if(xhr.total)status.textContent='正在载入宠物纪念像… '+Math.round(xhr.loaded/xhr.total*100)+'%';},e=>{
   console.warn('Compressed poodle failed, trying original GLB',e);loader.load('assets/poodle-memorial.glb',onGltf,undefined,fail);
  });
 }
};
