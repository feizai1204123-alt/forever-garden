#!/usr/bin/env node
/* Verify the pet3d SQL (and optionally the Edge Function) with the PUBLIC publishable key.
   node verify-pet3d.cjs          → table/storage refusal + pet3d_list() (no writes, no Meshy)
   node verify-pet3d.cjs --fn     → also pings POST /functions/v1/pet3d  {action:"list"}

   The reserve check must distinguish "permission denied" from "the function ran and
   refused for a business reason" (daily_limit, bad_name, …). A 400 daily_limit means
   anon CAN execute the function — that is a FAIL, not a PASS.
   Anon must also be unable to pass p_skip_daily or call pet3d_admin_attempt. */
const URL_='https://uxfyueebcughwaciqima.supabase.co',KEY='sb_publishable_Pi6coAWcP5N9WHGb-AqQxw_9a1NlKhk';
const FN=process.argv.includes('--fn');
const call=async(path,body,method='POST',extra={})=>{
  const r=await fetch(URL_+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
  let j=null;try{j=await r.json()}catch(_){}
  return {status:r.status,j};
};
let fails=0;const check=(name,ok,info)=>{if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  → '+JSON.stringify(info).slice(0,400)))};

// True only when the role was not allowed to execute the function at all.
const BUSINESS=['daily_limit','ip_limit','month_limit','spot_taken','bad_request','bad_device','bad_spot','bad_name','has_link','too_long','expired','slow_down'];
function permissionDenied(r){
  const code=String((r.j&&(r.j.code||r.j.error))||'');
  const msg=String((r.j&&r.j.message)||'');
  if(r.status===200) return false;
  if(BUSINESS.includes(msg)||BUSINESS.includes(code)) return false;
  if(r.status===401||r.status===403) return true;
  if(code==='42501'||code==='PGRST202'||code==='PGRST205'||code==='PGRST301') return true;
  if(/permission denied|not found in the schema cache|could not find the function/i.test(msg)) return true;
  if(r.status===404) return true;
  return false;
}
function ranInfo(r){
  const msg=String((r.j&&r.j.message)||'');
  const ran=r.status===200||BUSINESS.includes(msg);
  return ran?{reason:'function executed',status:r.status,message:r.j&&r.j.message,duplicate:r.j&&r.j.duplicate}:r;
}

(async()=>{
  const list=await call('/rest/v1/rpc/pet3d_list',{});
  check('pet3d_list() returns an array',list.status===200&&Array.isArray(list.j),list);

  const sel=await call('/rest/v1/pet3d_jobs?select=*',null,'GET');
  check('anon cannot read pet3d_jobs',sel.status>=400||(Array.isArray(sel.j)&&sel.j.length===0),sel);

  const ins=await call('/rest/v1/pet3d_jobs',{id:crypto.randomUUID(),device:'verifydevice1',ip_hash:'x'.repeat(32),spot:'m3',name:'test'});
  check('anon cannot insert into pet3d_jobs',ins.status>=400,ins);

  // Reuse a stable dummy id/device so a leak cannot keep inserting new rows.
  const args={p_id:'00000000-0000-4000-8000-000000000001',p_device:'verifydevice1',p_ip_hash:'a'.repeat(64),p_spot:'m3',p_name:'test',p_born:null,p_departed:null,p_story:null};
  const reserve=await call('/rest/v1/rpc/pet3d_reserve',args);
  check('anon cannot call pet3d_reserve (permission denied, not a rate limit)',permissionDenied(reserve),ranInfo(reserve));

  const skip=await call('/rest/v1/rpc/pet3d_reserve',Object.assign({},args,{p_skip_daily:true}));
  check('anon cannot call pet3d_reserve with p_skip_daily',permissionDenied(skip),ranInfo(skip));

  const attempt=await call('/rest/v1/rpc/pet3d_admin_attempt',{p_ip_hash:'a'.repeat(64),p_ok:false});
  check('anon cannot call pet3d_admin_attempt',permissionDenied(attempt),ranInfo(attempt));

  const failsTbl=await call('/rest/v1/pet3d_admin_fails?select=*',null,'GET');
  check('anon cannot read pet3d_admin_fails',failsTbl.status>=400||(Array.isArray(failsTbl.j)&&failsTbl.j.length===0)||failsTbl.status===404,failsTbl);

  const up=await fetch(URL_+'/storage/v1/object/pet3d/models/should-not-work.glb',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'model/gltf-binary'},body:new Uint8Array([0,1,2,3])});
  check('anon cannot upload to pet3d storage',up.status>=400,{status:up.status,text:(await up.text()).slice(0,200)});

  if(FN){
    const fn=await call('/functions/v1/pet3d',{action:'list'});
    check('edge function pet3d action=list',fn.status===200&&fn.j&&fn.j.ok===true&&Array.isArray(fn.j.jobs),fn);
  }else{
    console.log('SKIP edge function (pass --fn after it is deployed)');
  }
  console.log(fails?`\n${fails} check(s) failed`:'\nAll checks passed');process.exit(fails?1:0);
})().catch(e=>{console.error('Could not reach Supabase:',e.message);process.exit(2)});
