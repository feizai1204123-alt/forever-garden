/* Shared walking surface for vegetation placement and character collision. */
(function(root){
 'use strict';
 function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
 function createNavigation({routes,areas=[],obstacles=[],scale=1,radius=.4,bounds=null}){
  const segments=[];for(const r of routes)for(let i=1;i<r.points.length;i++)segments.push({a:r.points[i-1].map(v=>v*scale),b:r.points[i].map(v=>v*scale),width:r.width*scale});
  const rects=areas.map(a=>({minX:a.minX*scale,maxX:a.maxX*scale,minZ:a.minZ*scale,maxZ:a.maxZ*scale}));
  function surface(x,z,margin=radius){return segments.some(s=>segmentDistance(x,z,s.a,s.b)<=s.width-margin)||rects.some(a=>x>=a.minX+margin&&x<=a.maxX-margin&&z>=a.minZ+margin&&z<=a.maxZ-margin);}
  function allowed(x,z){const inGround=bounds?x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ:surface(x,z);return inGround&&!obstacles.some(o=>o.r?Math.hypot(x-o.x,z-o.z)<o.r:(x>o.minX&&x<o.maxX&&z>o.minZ&&z<o.maxZ));}
  function move(position,dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07)),sx=dx/steps,sz=dz/steps;let blocked=false;
   for(let i=0;i<steps;i++){
    if(allowed(position.x+sx,position.z+sz)){position.x+=sx;position.z+=sz;continue;}
    blocked=true;
    if(allowed(position.x+sx,position.z))position.x+=sx;
    if(allowed(position.x,position.z+sz))position.z+=sz;
   }return blocked;
  }
  return {allowed,surface,move,segments,obstacles};
 }
 root.createGardenNavigation=createNavigation;
 if(typeof module!=='undefined')module.exports={createNavigation,segmentDistance};
})(typeof window!=='undefined'?window:globalThis);
