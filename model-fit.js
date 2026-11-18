/* Auto-normalises any generated pet model (e.g. from Meshy) onto a memorial pedestal.
   Convention: rotation 0 = the model's +Z side (Meshy's front) faces the path/viewer; positive degrees turn it counter-clockwise seen from above. */
(function(root){
 'use strict';
 // Pedestal of an empty memorial slot (scene.js grave(): top surface at y = .49, footprint 2.3 × 1.4).
 // Depth may overhang the front edge a little; the story stone behind starts at z = -.68.
 const DEFAULTS={top:.49,maxWidth:2.0,maxDepth:1.5,maxHeight:1.6,centerZ:.1};
 function normaliseRotation(deg){deg=Math.round(Number(deg)||0)%360;return deg<0?deg+360:deg}
 function fitMemorialModel(model,rotationDeg,options){
  const T=root.THREE,o=Object.assign({},DEFAULTS,options||{});
  const holder=new T.Group(),pivot=new T.Group();holder.name='MemorialModel';
  pivot.rotation.y=normaliseRotation(rotationDeg)*Math.PI/180;pivot.add(model);holder.add(pivot);
  holder.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(pivot,true),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  if(!isFinite(size.x+size.y+size.z)||size.x<=0||size.y<=0||size.z<=0)throw new Error('模型尺寸无效');
  const k=Math.min(o.maxWidth/size.x,o.maxDepth/size.z,o.maxHeight/size.y);
  holder.scale.setScalar(k);
  holder.position.set(-center.x*k,o.top-box.min.y*k,o.centerZ-center.z*k);// centre X/Z, bottom on the pedestal top
  holder.updateMatrixWorld(true);
  return {holder,pivot,info:{scale:k,width:size.x*k,height:size.y*k,depth:size.z*k,rotation:normaliseRotation(rotationDeg)}};
 }
 root.fitMemorialModel=fitMemorialModel;root.normaliseMemorialRotation=normaliseRotation;
})(typeof window!=='undefined'?window:globalThis);
