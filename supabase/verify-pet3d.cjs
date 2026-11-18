#!/usr/bin/env node
/* Verify the pet3d SQL (and optionally the Edge Function) with the PUBLIC publishable key.
   node verify-pet3d.cjs          → table/storage refusal + pet3d_list() (no writes, no Meshy)
   node verify-pet3d.cjs --fn     → also pings POST /functions/v1/pet3d  {action:"list"}  */
const URL_='https://uxfyueebcughwaciqima.supabase.co',KEY='sb_publishable_Pi6coAWcP5N9WHGb-AqQxw_9a1NlKhk';
const FN=process.argv.includes('--fn');
const call=async(path,body,method='POST',extra={})=>{
  const r=await fetch(URL_+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
  let j=null;try{j=await r.json()}catch(_){}
  return {status:r.status,j};
};
let fails=0;const check=(name,ok,info)=>{if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  → '+JSON.stringify(info).slice(0,400)))};
(async()=>{
  const list=await call('/rest/v1/rpc/pet3d_list',{});
  check('pet3d_list() returns an array',list.status===200&&Array.isArray(list.j),list);

  const sel=await call('/rest/v1/pet3d_jobs?select=*',null,'GET');
  check('anon cannot read pet3d_jobs',sel.status>=400||(Array.isArray(sel.j)&&sel.j.length===0),sel);

  const ins=await call('/rest/v1/pet3d_jobs',{id:crypto.randomUUID(),device:'verifydevice1',ip_hash:'x'.repeat(32),spot:'m3',name:'test'});
  check('anon cannot insert into pet3d_jobs',ins.status>=400,ins);

  const reserve=await call('/rest/v1/rpc/pet3d_reserve',{p_id:crypto.randomUUID(),p_device:'verifydevice1',p_ip_hash:'a'.repeat(64),p_spot:'m3',p_name:'test',p_born:null,p_departed:null,p_story:null});
  check('anon cannot call pet3d_reserve',reserve.status>=400,reserve);

  const up=await fetch(URL_+'/storage/v1/object/pet3d/models/should-not-work.glb',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'model/gltf-binary'},body:new Uint8Array([0,1,2,3])});
  check('anon cannot upload to pet3d storage',up.status>=400,{status:up.status,text:(await up.text()).slice(0,200)});

  if(FN){
    const fn=await call('/functions/v1/pet3d',{action:'list'});
    check('edge function pet3d action=list',fn.status===200&&fn.j&&fn.j.ok===true&&Array.isArray(fn.j.jobs),fn);
  }else{
    console.log('SKIP edge function (pass --fn after it is deployed)');
  }
  console.log(fails?`\n${fails} check(s) failed`:'\nAll checks passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error('Could not reach Supabase:',e.message);process.exit(2)});
