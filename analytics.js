/* Privacy-friendly visit analytics. Records one anonymous visit per browser session
   and a few funnel events. No names, IPs, or photos. Failures are silent and never
   block the garden. Disable with ?analytics=0 */
(()=>{
'use strict';
const SH=window.GARDEN_SHARED||{};
const qs=new URLSearchParams(location.search);
if(!SH.url||!SH.key||qs.get('analytics')==='0')return;

const VID_KEY='pmg-visitor-id';
const SHORT={xhs:'xiaohongshu',xiaohongshu:'xiaohongshu',red:'xiaohongshu',tt:'tiktok',tiktok:'tiktok',dy:'douyin',douyin:'douyin',yt:'youtube',youtube:'youtube',itch:'itch.io','itch.io':'itch.io',reddit:'reddit',x:'x',twitter:'x',fb:'facebook',facebook:'facebook',ph:'producthunt',producthunt:'producthunt',hn:'hn',test:'test','seo-memorial':'seo-memorial','seo-remember':'seo-remember',memorial:'seo-memorial',remember:'seo-remember',dir:'directory',directory:'directory'};
const HOSTS=[
  [/^(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)$/,'xiaohongshu'],
  [/^(?:www\.)?(?:tiktok\.com|tiktokv\.com)$/,'tiktok'],
  [/^(?:www\.)?(?:douyin\.com|iesdouyin\.com)$/,'douyin'],
  [/^(?:www\.)?(?:youtube\.com|youtu\.be)$/,'youtube'],
  [/^(?:www\.)?itch\.io$/,'itch.io'],
  [/^(?:www\.)?(?:reddit\.com|redd\.it)$/,'reddit'],
  [/^(?:t\.co|x\.com|twitter\.com|www\.twitter\.com)$/,'x'],
  [/^(?:www\.)?(?:facebook\.com|fb\.com|m\.facebook\.com|lm\.facebook\.com|l\.facebook\.com)$/,'facebook'],
  [/^(?:www\.)?producthunt\.com$/,'producthunt'],
  [/^news\.ycombinator\.com$/,'hn']
];

function isEmbedded(){
 try{return window.self!==window.top}catch(_){return true}
}
function hostOf(ref){
 try{return new URL(ref).hostname.toLowerCase()}catch(_){return ''}
}
function sourceOf(){
 const raw=(qs.get('s')||qs.get('utm_source')||'').toLowerCase().trim();
 if(SHORT[raw])return SHORT[raw];
 const host=hostOf(document.referrer);
 for(const [re,name] of HOSTS)if(re.test(host))return name;
 if(isEmbedded())return 'itch.io';
 if(host&&host!==location.hostname&&!/(^|\.)google\.|(^|\.)bing\.com$|duckduckgo\.com$/.test(host))return 'other';
 if(host&&host!==location.hostname)return 'search';
 return 'direct';
}
function visitor(){
 let id='',isNew=false;
 try{
  id=localStorage.getItem(VID_KEY)||'';
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(id)){
   id=(crypto.randomUUID?crypto.randomUUID():('v'+Math.random().toString(36).slice(2)+Date.now().toString(36))).replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
   localStorage.setItem(VID_KEY,id);
   isNew=true;
  }
 }catch(_){
  id='sess'+Math.random().toString(36).slice(2)+Date.now().toString(36);
 }
 return {id,isNew};
}
function langOf(){
 const l=(document.documentElement.lang||'').toLowerCase();
 return l.indexOf('zh')===0?'zh':'en';
}
function deviceOf(){
 return /Mobi|Android|iPhone|iPad|iPod|webOS|IEMobile|Opera Mini/i.test(navigator.userAgent||'')?'mobile':'desktop';
}
function pathOf(){
 let p=location.pathname||'/';
 if(p.length>200)p=p.slice(0,200);
 if(p[0]!=='/'||/[?#]/.test(p))p='/';
 return p;
}

const ctx=visitor();
const meta={
 visitor_id:ctx.id,
 source:sourceOf(),
 lang:langOf(),
 device:deviceOf(),
 page_path:pathOf(),
 embedded:isEmbedded()
};
const endpoint=SH.url.replace(/\/+$/,'')+'/rest/v1/page_visits';
const once=new Set();

function send(event,isNew){
 if(!event||once.has(event))return;
 once.add(event);
 const body=JSON.stringify({
  visitor_id:meta.visitor_id,
  is_new_visitor:!!isNew,
  source:meta.source,
  lang:meta.lang,
  device:meta.device,
  page_path:meta.page_path,
  embedded:!!meta.embedded,
  event:event
 });
 try{
  fetch(endpoint,{
   method:'POST',
   headers:{apikey:SH.key,Authorization:'Bearer '+SH.key,'Content-Type':'application/json',Prefer:'return=minimal'},
   body,
   keepalive:true,
   cache:'no-store',
   mode:'cors'
  }).catch(()=>{});
 }catch(_){}
}

function sessionFlag(key,mark){
 try{
  if(sessionStorage.getItem(key))return false;
  if(mark)sessionStorage.setItem(key,'1');
  return true;
 }catch(_){return true}
}

function track(event){
 if(event!=='visit'&&event!=='game_loaded'&&event!=='upload_opened'&&event!=='ritual_done')return;
 if(!sessionFlag('pmg-event-'+event,true))return;
 send(event,event==='visit'&&ctx.isNew);
}

if(sessionFlag('pmg-event-visit',true))send('visit',ctx.isNew);

function onLoaded(){
 if(!sessionFlag('pmg-event-game_loaded',true))return;
 send('game_loaded',false);
}
const loading=document.getElementById('loading');
const isGame=!!(window.GARDEN_STATIC||loading||document.getElementById('scene'));
if(!isGame){
 // Landing pages only record visit.
}else if(!loading){
 if(window.garden&&typeof window.garden==='object'&&!window.garden.tagName)onLoaded();
}else{
 const obs=new MutationObserver(()=>{
  if(!document.getElementById('loading')){obs.disconnect();onLoaded()}
 });
 obs.observe(document.documentElement,{childList:true,subtree:true});
}

function hookUpload(){
 const api=window.gardenPet3d;
 if(!api||api.__fgTracked||typeof api.openCreate!=='function')return;
 const orig=api.openCreate.bind(api);
 api.openCreate=function(){try{track('upload_opened')}catch(_){}return orig.apply(this,arguments)};
 api.__fgTracked=true;
}
hookUpload();
document.addEventListener('DOMContentLoaded',hookUpload);
setTimeout(hookUpload,0);
setTimeout(hookUpload,2000);

window.gardenAnalytics={event:track};
})();
