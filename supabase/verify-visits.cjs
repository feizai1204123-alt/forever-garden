#!/usr/bin/env node
/* Verify page_visits RLS with the PUBLIC publishable key. Writes one source=test
   row, then you (or the owner via SQL) can delete rows where source = 'test'. */
const URL_='https://uxfyueebcughwaciqima.supabase.co',KEY='sb_publishable_Pi6coAWcP5N9WHGb-AqQxw_9a1NlKhk';
const call=async(path,body,method='POST',prefer)=>{
  const headers={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
  if(prefer)headers.Prefer=prefer;
  const r=await fetch(URL_+path,{method,headers,body:body?JSON.stringify(body):undefined});
  let j=null,text=await r.text();
  try{j=text?JSON.parse(text):null}catch(_){j=text}
  return {status:r.status,j,text:text.slice(0,300)};
};
const row=(over={})=>({
  visitor_id:'verifyvis_'+Math.random().toString(36).slice(2,12),
  is_new_visitor:true,
  source:'test',
  lang:'en',
  device:'desktop',
  page_path:'/forever-garden/',
  embedded:false,
  event:'visit',
  ...over
});
let fails=0;
const check=(name,ok,info)=>{if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  → '+JSON.stringify(info)))};

(async()=>{
  const sel=await call('/rest/v1/page_visits?select=*','','GET');
  check('anon cannot read page_visits',sel.status>=400||(Array.isArray(sel.j)&&sel.j.length===0),sel);

  const view=await call('/rest/v1/visit_stats_daily?select=*','','GET');
  check('anon cannot read visit_stats_daily',view.status>=400||(Array.isArray(view.j)&&view.j.length===0),view);

  const upd=await call('/rest/v1/page_visits?event=eq.visit',{source:'test'},'PATCH');
  check('anon cannot update page_visits',upd.status>=400,upd);

  const del=await call('/rest/v1/page_visits?source=eq.test','','DELETE');
  check('anon cannot delete page_visits',del.status>=400,del);

  const badEvent=await call('/rest/v1/page_visits',row({event:'hack'}),'POST','return=minimal');
  check('invalid event is rejected',badEvent.status>=400,badEvent);

  const badId=await call('/rest/v1/page_visits',row({visitor_id:'x'}),'POST','return=minimal');
  check('short visitor_id is rejected',badId.status>=400,badId);

  const badSource=await call('/rest/v1/page_visits',row({source:'https://evil.example'}),'POST','return=minimal');
  check('raw referrer as source is rejected',badSource.status>=400,badSource);

  const ok=await call('/rest/v1/page_visits',row(),'POST','return=minimal');
  check('anon can insert a valid visit (source=test)',ok.status===201||ok.status===200,ok);

  const stillHidden=await call('/rest/v1/page_visits?select=*','','GET');
  check('anon still cannot read after insert',stillHidden.status>=400||(Array.isArray(stillHidden.j)&&stillHidden.j.length===0),stillHidden);

  console.log(fails?`\n${fails} check(s) failed`:'\nAll checks passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error('Could not reach Supabase:',e.message);process.exit(2)});
