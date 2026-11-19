#!/usr/bin/env node
/* Verify the shared-rituals backend with the PUBLIC publishable key (run after schema.sql was pasted & run).
   node verify.cjs          → read + refusal checks only (writes nothing)
   node verify.cjs --write  → also adds 1 flower + 1 test message to spot m46 (delete those rows in Table Editor afterwards) */
const URL_='https://uxfyueebcughwaciqima.supabase.co',KEY='sb_publishable_Pi6coAWcP5N9WHGb-AqQxw_9a1NlKhk';
const WRITE=process.argv.includes('--write'),dev='verify-'+Math.random().toString(36).slice(2,10);
const call=async(path,body,method='POST')=>{const r=await fetch(URL_+path,{method,headers:{apikey:KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch(_){}return {status:r.status,j}};
const add=(a)=>call('/rest/v1/rpc/ritual_add',{p_client_id:a.cid||crypto.randomUUID(),p_spot:a.spot||'m46',p_kind:a.kind||'message',p_device:a.dev||dev,p_text:a.text??null});
let fails=0;const check=(name,ok,info)=>{if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  → '+JSON.stringify(info)))};
(async()=>{
 const s=await call('/rest/v1/rpc/ritual_summary',{});check('ritual_summary() returns an object',s.status===200&&s.j&&typeof s.j==='object'&&!Array.isArray(s.j),s);
 const s1=await call('/rest/v1/rpc/ritual_summary',{p_spot:'statue'});check('ritual_summary(statue)',s1.status===200,s1);
 const sel=await call('/rest/v1/rituals?select=*',null,'GET');check('anon cannot read the table directly',sel.status>=400||(Array.isArray(sel.j)&&sel.j.length===0),sel);
 const ins=await call('/rest/v1/rituals',{client_id:crypto.randomUUID(),spot:'m1',kind:'flower',device:'x',ip_hash:'x'});check('anon cannot insert into the table directly',ins.status>=400,ins);
 const bw=await call('/rest/v1/ritual_badwords?select=*',null,'GET');check('anon cannot read the word list',bw.status>=400||(Array.isArray(bw.j)&&bw.j.length===0),bw);
 for(const [name,a,code] of [['link refused',{text:'看 https://spam.example.com'},'has_link'],['phone number refused',{text:'加我 13812345678'},'has_link'],['bad words refused',{text:'你是傻 逼'},'bad_words'],['too long refused',{text:'想'.repeat(201)},'too_long'],['empty refused',{text:'   '},'empty'],['bad spot refused',{spot:'m100',kind:'flower'},'bad_spot'],['bad kind refused',{kind:'hug'},'bad_kind'],['bad device refused',{kind:'flower',dev:'x'},'bad_device']]){
  const r=await add(a);check(name+' ('+code+')',r.status===400&&r.j&&r.j.message===code,r)}
 if(WRITE){
  const cid=crypto.randomUUID();const f=await add({cid,kind:'flower'});check('add flower',f.status===200&&f.j&&f.j.ok,f);
  const d=await add({cid,kind:'flower'});check('retry with same id is idempotent',d.status===200&&d.j&&d.j.duplicate===true&&d.j.entry.flowers===f.j.entry.flowers,d);
  const mcid=crypto.randomUUID();const m=await add({cid:mcid,text:'【测试】花园联网检查，可删除'});check('add message',m.status===200&&m.j&&m.j.entry.messages.some(x=>x.id===mcid),m);
  const after=await call('/rest/v1/rpc/ritual_summary',{p_spot:'m46'});check('summary shows the new message',after.status===200&&after.j.m46&&after.j.m46.messages.some(x=>x.id===mcid),after);
  console.log('Test rows written on spot m46 (client_id):',cid,mcid,'— delete them in Table Editor → rituals if you like.');
 }
 console.log(fails?`\n${fails} check(s) failed`:'\nAll checks passed');process.exit(fails?1:0);
})().catch(e=>{console.error('Could not reach Supabase:',e.message);process.exit(2)});
