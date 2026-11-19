// Forever Garden · bilingual UI (zh / en). Loaded first in <head>.
// Language: ?lang=en|zh  >  saved choice (localStorage)  >  navigator.language (zh* → zh, else en).
(function(){
'use strict';
const KEY='pmg-lang';
let q=null;try{q=new URLSearchParams(location.search).get('lang')}catch(_){}
q=q&&q.toLowerCase().startsWith('zh')?'zh':q&&q.toLowerCase().startsWith('en')?'en':null;
let saved=null;try{saved=localStorage.getItem(KEY)}catch(_){}
const nav=(navigator.languages&&navigator.languages[0])||navigator.language||'';
const lang=q||(saved==='zh'||saved==='en'?saved:(/^zh/i.test(nav)?'zh':'en'));
if(q)try{localStorage.setItem(KEY,q)}catch(_){}
window.gardenLang=lang;
document.documentElement.lang=lang==='zh'?'zh-CN':'en';
document.documentElement.classList.add('lang-'+lang);
const setTitle=()=>{document.title=lang==='zh'?'永远的花园 · Forever Garden':'Forever Garden · A Garden of Little Souls'};setTitle();document.addEventListener('DOMContentLoaded',setTitle);

// ---------------------------------------------------------------- dictionary
// Exact strings. «0» = a name that was inside 「」, #0 = a number.
const pl=(n,one,many)=>n+' '+(+n===1?one:many);
const D={
'永远的花园':'Forever Garden',
'永远的花园 · A Garden of Little Souls':'Forever Garden · A Garden of Little Souls',
'永远的花园 · 开始':'Forever Garden · Start',
'爱不会离开，只是开成了花。':'Love never leaves. It simply blooms into flowers.',
'正在推开花园的门… 请稍候':'Opening the garden gate… one moment',
'走进花园 · 伴着音乐':'Enter the garden · with music',
'安静地进入':'Enter quietly',
'左下摇杆散步，推到底奔跑':'Walk with the joystick at the bottom left; push it all the way to run',
'右侧拖动转视角，双指缩放':'Drag on the right to look around; pinch to zoom',
'走近纪念碑，轻触「献心意」':'Walk up to a memorial and tap “Pay tribute”',
'小贴士：Safari「分享」→「添加到主屏幕」，从主屏幕打开就是全屏':'Tip: in Safari, tap Share → Add to Home Screen, then open it from your home screen for full screen',
'暖灯暮色中的宠物纪念园区，中央狗狗雕像，周围是鲜花、纪念碑、木亭和石板路。拖动可旋转，滚轮可缩放。':'A pet memorial garden at dusk under warm lanterns: a dog statue in the middle, surrounded by flowers, memorial stones, a wooden pavilion and stone paths. Drag to rotate, scroll to zoom.',
'拖动环顾 · 滚轮缩放 · 双击回到最初':'Drag to look around · scroll to zoom · double-click to reset',
'人物载入中':'Loading gardener',
'原图视角':'Start view',
'宠物纪念像':'Pet statue',
'园区全景':'Overview',
'环绕漫游':'Orbit',
'停止漫游':'Stop tour',
'微风 · 开':'Breeze · On',
'微风 · 关':'Breeze · Off',
'保存画面':'Snapshot',
'上传宠物照':'Upload pet photo',
'正在安放宠物纪念像…':'Placing the pet statue…',
'正在载入你的人物与动画…':'Loading your gardener and animations…',
'虚拟摇杆：按住拖动移动人物，推到边缘奔跑':'Virtual joystick: hold and drag to walk, push to the edge to run',
'推到底 · 奔跑':'Push all the way · run',
'横屏提示':'Rotate your phone',
'把手机横过来玩会更好':'It plays better with your phone turned sideways',
'继续竖屏玩':'Keep playing upright',
'小贴士：在 Safari 点「分享」→「添加到主屏幕」，从主屏幕打开就是全屏的':'Tip: in Safari, tap Share → Add to Home Screen, then open it from your home screen for full screen',
'💡 Safari「分享」→「添加到主屏幕」，从主屏幕打开即可全屏游玩 ✕':'💡 Safari: Share → Add to Home Screen to play full screen ✕',
'正在走进花园…':'Walking into the garden…',
'请稍候 · 首次打开约需下载 3 MB':'One moment · the first visit downloads about 3 MB',
'全屏':'Full screen',
'退出全屏':'Exit full screen',
'WASD / 方向键散步，Shift 奔跑':'WASD / arrow keys to walk, Shift to run',
'拖动转视角，滚轮缩放':'Drag to look around, scroll to zoom',
'轻触「献心意」':'Tap “Pay tribute”',
'按 E「献心意」':'Press E to pay tribute',
'无法显示':'Can’t be shown',
'花园已苏醒，正在请园丁过来…':'The garden is awake. Calling the gardener over…',
'园丁到了，正在安放宠物纪念像…':'The gardener is here. Placing the pet statue…',
'花园准备好了':'The garden is ready',
'网络有点慢，可以先进入花园，其余会在里面继续载入':'The connection is a little slow. You can go in now; the rest will keep loading inside',
'人物已就绪':'Gardener ready',
'创建宠物纪念':'Create pet memorial',
'退出操控':'Free look',
'操控人物':'Walk the gardener',
'左下摇杆移动 · 推到底奔跑 · 右侧单指拖动转视角':'Joystick bottom left to move · push all the way to run · drag on the right to look',
'WASD / 方向键自由移动 · Shift 奔跑 · R 回到入口':'WASD / arrow keys to move · Shift to run · R to return to the entrance',
'单指拖动环顾 · 双指缩放':'Drag to look around · pinch to zoom',
'人物已就绪 · 正在操控':'Gardener ready · you’re in control',
'人物已就绪 · 点击「操控人物」继续':'Gardener ready · tap “Walk the gardener” to continue',
'🪑 坐一会儿':'🪑 Sit for a while',
'🪑 在长椅上坐一会儿':'🪑 Sit on the bench for a while',
'园丁在长椅上打盹 · 推动摇杆叫醒他':'The gardener is dozing on the bench · move the joystick to wake him',
'园丁坐下歇一会儿 · 推动摇杆起身':'The gardener is resting · move the joystick to stand up',
'前方有障碍 · 请绕行':'Something’s in the way · go around it',
'人物载入失败，请重新打开页面。':'The gardener failed to load. Please reopen the page.',
'人物载入失败':'Gardener failed to load',
'正在载入你的人物…':'Loading your gardener…',
'正在载入人物（备用方式，较慢，请稍候）…':'Loading the gardener (backup method, slower, please wait)…',
'宠物墓地':'Pet Memorial',
'花语纪念区':'Flower Memorials',
'星光纪念区':'Starlight Memorials',
'静谧水庭':'Quiet Water Court',
'林间花园':'Woodland Garden',
'永远的花园.png':'forever-garden.png',
'3D 花园。方向键调整视角，加减键缩放，Home 恢复视角。':'3D garden. Arrow keys to change the view, plus/minus to zoom, Home to reset.',
'花园暂时无法显示。':'The garden can’t be shown right now.',
'请使用支持 WebGL 的浏览器打开，并保持 vendor 文件夹与页面放在一起。':'Please open it in a browser that supports WebGL.',
'模型尺寸无效':'Invalid model size',
'花开不忘 · 永远相伴':'Remembered in bloom · always together',
'正在载入宠物纪念像…':'Loading the pet statue…',
'宠物纪念像载入失败，请重新打开页面。':'The pet statue failed to load. Please reopen the page.',
'宠物纪念像已安放 · 入口左侧':'Pet statue placed · left of the entrance',
'花园声音':'Garden sound',
'♪ 声音 · 关':'♪ Sound · Off',
'♪ 声音 · 开':'♪ Sound · On',
'风声 · 开':'Wind · On',
'风声 · 关':'Wind · Off',
'音量':'Volume',
'花园声音音量':'Garden sound volume',
'♪ 轻触画面开始聆听':'♪ Tap the screen to listen',
'关闭背景音乐、风声和风铃':'Turn off music, wind and chimes',
'打开柔和的背景音乐、风声和风铃':'Turn on soft music, wind and chimes',
'♪ 此浏览器暂不支持声音':'♪ Sound isn’t supported in this browser',
'关闭轻柔的风声':'Turn off the gentle wind',
'打开轻柔的风声':'Turn on the gentle wind',
'♪ 暂时无法播放声音':'♪ Sound can’t play right now',
'守望花园的石雕狗狗':'Stone guardian dog',
'花开不忘 · 贵宾犬纪念像':'Remembered in bloom · poodle statue',
'未连接花园服务':'Not connected to the garden service',
'保存失败':'Couldn’t save',
// shared rituals · server error codes (ritual_add)
'留言里不能放链接或联系方式，换一种说法吧。':'Messages can’t include links or contact details. Try saying it another way.',
'这句话里有不太合适的词，换个温柔的说法吧。':'That message has a word that doesn’t quite fit here. Try a gentler way to say it.',
'留言最多 200 字。':'Messages can be up to 200 characters.',
'写一句想说的话吧。':'Write a few words first.',
'今天在这里已经留了很多话了，明天再来看看它吧。':'Lots of words have been left here today. Come back and visit tomorrow.',
'今天的心意已经很多了，明天再来吧。':'You’ve shared a lot of love today. Come back tomorrow.',
'这个纪念位暂时不能留言。':'This memorial can’t take messages right now.',
'这个心意暂时不能保存。':'This tribute can’t be saved right now.',
'这台设备暂时不能保存心意。':'This device can’t save tributes right now.',
'花园有点忙，请稍后再试。':'The garden is a little busy. Please try again shortly.',
// ritual panel
'在这里，轻轻说一声想念':'Here, quietly say you miss them',
'关闭心意面板':'Close tribute panel',
'✿ 献花':'✿ Leave flowers',
'✦ 点蜡烛':'✦ Light a candle',
'✎ 留言':'✎ Write a message',
'想对它说的话':'What you’d like to tell them',
'留下这句话':'Leave this message',
'今天也很想你。谢谢你来过我的生命……':'Missing you again today. Thank you for being part of my life…',
'留言':'Messages',
'这里还很安静。献一束花，点一盏灯，或者说几句话吧。':'It’s still quiet here. Leave some flowers, light a candle, or say a few words.',
'还没有留言。第一句想念，可以由你写下。':'No messages yet. You could write the first one.',
'· 待同步':'· waiting to sync',
'一束花，轻轻放在了这里。':'A bouquet, gently laid here.',
'烛光亮起来了，愿它照亮回家的路。':'The candle is lit. May it light the way home.',
'你的话，已经留在这里了。':'Your words are here now.',
'（保存在这台设备上）':' (saved on this device)',
'（浏览器未允许本地保存）':' (your browser didn’t allow local saving)',
'（已珍藏在花园里）':' (kept in the garden)',
'（正在送到花园里…）':' (sending it to the garden…)',
'（已珍藏在花园里，来看它的人都能看到）':' (kept in the garden for every visitor to see)',
'（暂时保存在这台设备上，联网后会自动送到花园里）':' (saved on this device for now; it will reach the garden once you’re online)',
'写一句想说的话吧，哪怕只是「想你」。':'Write a few words, even just “I miss you”.',
'献花 · 点蜡烛 · 留言':'Flowers · candle · message',
// pet memorial (pet-upload.js + memorial-editor.js)
'正在提交':'Submitting',
'排队等待生成':'Waiting in line',
'正在生成':'Generating',
'已生成，等待你确认安放':'Ready, waiting for you to place it',
'已安放':'Placed',
'生成失败':'Generation failed',
'提交结果未确认':'Submission not confirmed',
'今天这台设备已经生成过一次了，明天再来吧。每天限 1 次。':'This device has already made one today. Please come back tomorrow (limit 1 per day).',
'今天这个网络已经生成过一次了，明天再来吧。每天限 1 次。':'This network has already made one today. Please come back tomorrow (limit 1 per day).',
'这个月的生成额度已经用完了（每月最多大约 20 只小像），下个月再来吧。':'This month’s figurines are all used up (about 20 per month). Please come back next month.',
'这个纪念位已经有小像了，换一个空位吧。':'This spot already has a figurine. Please pick an empty one.',
'请上传 1 MB 以内的 jpg、png 或 webp 照片。':'Please upload a jpg, png or webp photo under 1 MB.',
'请选择一个空着的纪念位。':'Please choose an empty memorial spot.',
'请给它起一个 1 到 24 个字的名字。':'Please give them a name of 1 to 24 characters.',
'这台设备暂时不能生成。请刷新页面再试。':'This device can’t generate right now. Please refresh and try again.',
'名字或故事里不能放链接、网址或一长串数字。':'Names and stories can’t include links, web addresses or long strings of numbers.',
'故事最多 2000 字。':'Stories can be up to 2000 characters.',
'管理员还没有配置生成密钥，请稍后再试。':'Generation isn’t set up yet. Please try again later.',
'生成没有成功。请明天再试，或换一张更清晰的照片。':'Generation didn’t work. Please try again tomorrow, or use a clearer photo.',
'没有找到这次生成。':'We couldn’t find that generation.',
'只能查看或确认自己提交的小像。':'You can only view or confirm figurines you submitted.',
'小像还在生成中，请再等一会儿。':'The figurine is still being made. Please wait a little longer.',
'上次提交没有发出去，请重新上传。':'The last submission didn’t go through. Please upload again.',
'暂时连不上花园服务，请检查网络后再试。':'Can’t reach the garden right now. Please check your connection and try again.',
'请求失败':'Request failed',
'请选择 jpg、png 或 webp 照片（iPhone 请选「最兼容」或把实况照片转成 jpg）。':'Please choose a jpg, png or webp photo (on iPhone, pick “Most Compatible” or convert Live Photos to jpg).',
'照片太小了，请换一张更清晰的。':'That photo is too small. Please choose a clearer one.',
'照片还是太大了，请换一张更小的，或裁掉背景后再试。':'That photo is still too large. Please choose a smaller one or crop out the background.',
'这张照片打不开，请换一张 jpg 或 png。':'That photo can’t be opened. Please try a jpg or png.',
'相遇的那天':'The day we met',
'永远在心里':'Forever in my heart',
'我们的故事':'Our story',
'永远被爱着':'Forever loved',
'轻触，读一读我们的故事':'Tap to read our story',
'轻触纪念碑，阅读完整故事…':'Tap the memorial to read the whole story…',
'返回花园':'Back to the garden',
'关闭纪念页':'Close memorial page',
'爱曾来过 · 永远相伴':'Love was here · always together',
'那些一起走过的日子':'The days we walked together',
'愿风带去思念，愿花记得你的名字。':'May the wind carry our longing, and the flowers remember your name.',
'宠物小像预览':'Pet figurine preview',
'宠物纪念照片':'Pet memorial photo',
'有些爱，不必用言语记下。它一直在这里。':'Some love needs no words. It is always here.',
'留下爱的纪念':'Leave a loving memorial',
'空纪念位':'Empty spot',
'宠物名字':'Pet’s name',
'它的名字':'Their name',
'宠物照片':'Pet photo',
'预览':'Preview',
'出生日期':'Born',
'离世日期':'Passed away',
'写下相遇、陪伴，以及那些不想忘记的小事…':'Write about how you met, your time together, and the little things you never want to forget…',
'照片会在手机上先压到 1 MB 以内。生成一只带颜色的低面数小像，大约 15 个额度；每台设备每天限 1 次。确认安放后，所有来花园的人都能看见它。':'Your photo is shrunk to under 1 MB on your phone first, then turned into a small colored 3D figurine. Limit 1 per device per day. Once you place it, everyone who visits the garden can see it.',
'生成纪念小像':'Make a memorial figurine',
'关闭':'Close',
'暂时没有空位':'No empty spots right now',
'小像':'Figurine',
'离世日期不能早于出生日期。':'The passing date can’t be before the birth date.',
'正在压缩照片…':'Shrinking the photo…',
'正在提交，开始生成小像…这可能需要一两分钟。':'Submitting and starting the figurine… this can take a minute or two.',
'已提交':'Submitted',
'预览小像':'Preview figurine',
'朝向':'Facing',
'向左转':'Turn left',
'向右转':'Turn right',
'安放到花园':'Place in the garden',
'稍后决定':'Decide later',
'现在正对小路 / 来看它的人':'Now facing the path and its visitors',
'现在朝向你的右手边':'Now facing your right',
'现在背对小路':'Now facing away from the path',
'现在朝向你的左手边':'Now facing your left',
'正在载入小像…':'Loading the figurine…',
'这个小像还没有放进花园。转一转朝向，确认后所有来访的人都能看见它。':'This figurine isn’t in the garden yet. Turn it to face the way you like; once you confirm, every visitor can see it.',
'正在安放…':'Placing…',
// memorial-editor.js (local server flow)
'在线生成需启动 server.cjs 并打开 http://127.0.0.1:8780':'Online generation needs server.cjs running at http://127.0.0.1:8780',
'连接本地服务失败，请确认 server.cjs 仍在运行':'Couldn’t reach the local server. Make sure server.cjs is still running',
'请使用本地服务（8780 端口）打开游戏':'Please open the game from the local server (port 8780)',
'网页试玩版为只读演示，不能修改纪念':'The web demo is read-only; memorials can’t be changed',
'请确认':'Please confirm',
'确定':'OK',
'再想想':'Let me think',
'照片会发送到 Meshy，生成将消耗账号额度（每次提交只会扣一次）。生成好后会先给你预览，确认后才放入花园。':'The photo is sent to Meshy and uses account credits (charged once per submission). You’ll see a preview first; it only goes into the garden after you confirm.',
'生成纪念模型':'Generate memorial model',
'在线创建纪念小像暂时没有开放 · 你仍然可以在花园里散步、献花、点蜡烛和留言':'Creating pet memorials online isn’t open right now · you can still walk the garden, leave flowers, light candles and write messages',
'提示：当前是离线打开，生成功能需要用 node server.cjs 启动后访问 http://127.0.0.1:8780':'Note: opened offline. Generation needs node server.cjs and http://127.0.0.1:8780',
'纪念信息已保存':'Memorial details saved',
'请选择一个空的纪念位':'Please choose an empty memorial spot',
'请选择 10 MB 以下照片':'Please choose a photo under 10 MB',
'正在提交，请不要关闭页面…':'Submitting, please don’t close the page…',
'网络中断，暂时不知道是否提交成功。再点一次「生成纪念模型」是安全的：同一次提交不会重复扣费。':'The connection dropped, so we don’t know whether it went through. It’s safe to tap “Generate memorial model” again: the same submission is never charged twice.',
'这次提交已经收到过了，正在继续跟进生成进度。':'This submission was already received; still following its progress.',
'已提交，正在生成。可以先关闭窗口，在花园里逛逛，生成好了会提醒你。':'Submitted and generating. Feel free to close this and wander the garden; we’ll let you know when it’s ready.',
'补写纪念信息':'Add memorial details',
'保存纪念信息（不重新生成）':'Save details (no regeneration)',
'调整朝向':'Adjust facing',
'Meshy 任务编号（在 Meshy 控制台的任务详情里）':'Meshy task ID (from the task details in the Meshy console)',
'关联这个任务':'Link this task',
'例如 01a1e05c-064e-7060-…':'e.g. 01a1e05c-064e-7060-…',
'刷新状态':'Refresh status',
'重置此纪念位':'Reset this spot',
'确定重置':'Reset',
'已重置，可以重新创建纪念':'Reset; you can create a new memorial',
'看看它，满意就放进花园':'Take a look; place it in the garden if you like it',
'画面正前方就是花园小路，让它的脸朝向你；左右拖动可以转着看':'The garden path is straight ahead, so turn their face toward you. Drag left and right to spin it',
'↺ 向左转 90°':'↺ Turn left 90°',
'向右转 90° ↻':'Turn right 90° ↻',
'细调朝向':'Fine-tune facing',
'纪念模型预览，可左右拖动查看':'Memorial model preview; drag left and right to look',
'保存朝向':'Save facing',
'确认放入花园':'Place in the garden',
'取消':'Cancel',
'放弃这个模型…':'Discard this model…',
'正在载入模型…':'Loading the model…',
'这个模型还没有放进花园，确认后才会安放。':'This model isn’t in the garden yet; it will be placed once you confirm.',
'（已使用）':' (in use)',
'这次提交的结果还没有确认，Meshy 可能已经创建了任务并扣费。':'This submission was never confirmed; Meshy may already have created the task and charged for it.',
'请先到 Meshy 控制台确认没有对应的任务，再重置。':'Check the Meshy console for a matching task before resetting.',
'这个模型已经生成（已消耗额度）。重置后它不会出现在花园里，但文件仍保留在 generated 文件夹。':'This model has already been generated (credits used). After a reset it won’t appear in the garden, but the file stays in the generated folder.',
'照片和记录会存档保留，纪念位变回空位，可以重新生成。':'The photo and record are archived, and the spot becomes empty so you can generate again.',
'状态：':'Status: ',
'提交时间：':'Submitted: ',
' · 任务编号：':' · task ID: ',
'· 任务编号：':'· task ID: ',
// composed templates
'已献花 #0 束 · 已点亮 #1 支蜡烛 · #2 条留言':(a)=>pl(a.n[0],'bouquet','bouquets')+' · '+pl(a.n[1],'candle','candles')+' · '+pl(a.n[2],'message','messages'),
'🌸 献心意 · «0»':a=>'🌸 Pay tribute · '+a.q[0],
'按 E 或点这里 · 为«0»献上心意':a=>'Press E or tap here · pay tribute to '+a.q[0],
'花台上最多摆放 #0 束花，这一束的心意也已记下。':a=>'The flower stand holds up to '+a.n[0]+' bouquets, but this one’s love is counted too.',
'这里已有 #0 盏烛光，这份心意也已记下。':a=>a.n[0]+' candles already glow here, and your light is counted too.',
'留言最多 #0 字。':a=>'Messages can be up to '+a.n[0]+' characters.',
'纪念位 #0':a=>'Memorial spot '+a.n[0],
'纪念位 #0（已使用）':a=>'Memorial spot '+a.n[0]+' (in use)',
'«0»的小像暂时载入失败，刷新页面再试':a=>a.q[0]+'’s figurine couldn’t load. Please refresh and try again',
'«0»的模型暂时载入失败，刷新页面再试':a=>a.q[0]+'’s model couldn’t load. Please refresh and try again',
'«0»已经在花园里了':a=>a.q[0]+' is already in the garden',
'«0»还在等你确认 · 点这里继续预览':a=>a.q[0]+' is waiting for you · tap here to keep previewing',
'«0»已经安放在纪念位 · 点这里去看看':a=>a.q[0]+' has been placed · tap here to visit',
'«0»已经安放在纪念位 #0 · 点这里去看看':a=>a.q[0]+' has been placed at spot '+a.n[0]+' · tap here to visit',
'«0»已经生成好了 · 点这里预览并安放':a=>a.q[0]+' is ready · tap here to preview and place',
'«0»的纪念模型生成好了 · 点这里预览并安放':a=>a.q[0]+'’s memorial model is ready · tap here to preview and place',
'«0»还在生成中':a=>a.q[0]+' is still being made',
'调整«0»的朝向':a=>'Adjust '+a.q[0]+'’s facing',
'看看«0»，满意就放进花园':a=>'Take a look at '+a.q[0]+'; place them in the garden if you like it',
'纪念位 #0 已重置，可以重新创建纪念':a=>'Spot '+a.n[0]+' has been reset; you can create a new memorial',
'朝向 #0°':a=>'Facing '+a.n[0]+'°',
'正在载入你的人物… #0%':a=>'Loading your gardener… '+a.n[0]+'%',
'正在载入宠物纪念像… #0%':a=>'Loading the pet statue… '+a.n[0]+'%',
};
// Prefix/suffix rules for strings that wrap arbitrary text (names, error messages).
const R=[
 [/^(.+) 的纪念位$/,m=>m[1]+'’s memorial'],
 [/^「([^」]*)」生成失败：([\s\S]*)$/,m=>'“'+T(m[1],1)+'” couldn’t be made: '+T(m[2])],
 [/^「([^」]*)」([^「」]+)$/,m=>{const s=T(m[2]);return s===m[2]?null:'“'+m[1]+'” · '+s}],
 [/^([\s\S]+?)（暂时只保存在这台设备上：([\s\S]*)）$/,m=>T(m[1])+' (saved on this device for now: '+T(m[2])+')'],
 [/^([\s\S]+?)，请稍候…$/,m=>T(m[1])+', please wait…'],
 [/^模型载入失败：([\s\S]*)$/,m=>'Couldn’t load the model: '+T(m[1])],
 [/^纪念位 (\d+)（([\s\S]*?)）：([\s\S]*?) · 点这里查看$/,m=>'Spot '+m[1]+' ('+m[2]+'): '+T(m[3])+' · tap to view'],
 [/^纪念位 (\d+) · ([\s\S]*)$/,m=>'Spot '+m[1]+' · '+m[2]],
 [/^状态：([\s\S]*)$/,m=>'Status: '+T(m[1])],
];
const CJK=/[\u3400-\u9fff\uff01-\uff5e\u3000-\u303f]/;
const HAN=/[\u3400-\u9fff]/;
const subs=Object.keys(D).filter(k=>typeof D[k]==='string'&&k.length>=4&&!/[«#]/.test(k)).sort((a,b)=>b.length-a.length);
const cache=new Map();
const missing=new Set();window.__i18nMissing=missing;
function T(src,nameOnly){
 if(src==null)return src;src=String(src);
 if(lang!=='en'||!CJK.test(src))return src;
 const hit=cache.get(src);if(hit!==undefined)return hit;
 const lead=src.match(/^\s*/)[0],trail=src.match(/\s*$/)[0],s=src.trim();
 let out=null,names=[];
 if(typeof D[s]==='string')out=D[s];
 if(out==null){
  const qn=[],nn=[];
  const tpl=s.replace(/「([^」]*)」/g,(_,n)=>{qn.push('“'+T(n,1)+'”');return '\u0005'+String.fromCharCode(64+qn.length)+'\u0006'}).replace(/\d+/g,d=>{nn.push(d);return '#'+(nn.length-1)}).replace(/\u0005([A-Z])\u0006/g,(_,c)=>'«'+(c.charCodeAt(0)-65)+'»');
  const v=D[tpl];
  if(typeof v==='function')out=v({q:qn,n:nn});else if(typeof v==='string')out=v;
 }
 if(out==null)for(const [re,fn] of R){const m=s.match(re);if(m){const r=fn(m);if(r!=null){out=r;break}}}
let viaSub=false;
 if(out==null&&nameOnly)out=s;
 if(out==null){viaSub=true;
  // substring pass over the original text, keeping 「names」 untouched
  let t=s.replace(/「([^」]*)」/g,(_,n)=>{names.push(n);return '\u0001'+(names.length-1)+'\u0002'});
  t=t.replace(/确定要(放弃并)?重置纪念位 (\d+)(?:（([^）]*)）)? ?吗？/g,(_,g,n,nm)=>'\u0003'+(g?'Discard and reset':'Reset')+' spot '+n+(nm?' ('+nm+')':'')+'?\u0004');
  for(const k of subs)if(t.includes(k))t=t.split(k).join('\u0003'+D[k]+'\u0004');
  out=t.replace(/[\u0003\u0004]/g,'').replace(/\u0001(\d+)\u0002/g,(_,i)=>'“'+names[+i]+'”');
 }
 const rest=out.replace(/“[^”]*”/g,'');
 if(viaSub&&HAN.test(rest)&&missing.size<200)missing.add(s);
 out=lead+out+trail;
 if(nameOnly)return out;
 if(cache.size>4000)cache.clear();
 cache.set(src,out);return out;
}
window.gT=s=>lang==='en'?T(s):s;
window.gTr=T;

// ---------------------------------------------------------------- DOM translator (en only)
const SKIP='.ritual-messages p,.memory-story,.story,#pet3d-memory h2,#memory-viewer h2,dialog h2.pet-name,[data-i18n-skip],textarea,script,style';
const ATTRS=['placeholder','aria-label','title','alt'];
function skip(el){return !el||(el.closest&&el.closest(SKIP))}
function doText(n){const v=n.nodeValue;if(!v||!CJK.test(v))return;const p=n.parentElement;if(skip(p))return;const t=T(v);if(t!==v)n.nodeValue=t}
const ASKIP='.ritual-messages p,.memory-story,.story,[data-i18n-skip]';
function doAttrs(el){if(!el||(el.closest&&el.closest(ASKIP)))return;for(const a of ATTRS){const v=el.getAttribute(a);if(v&&CJK.test(v)){const t=T(v);if(t!==v)el.setAttribute(a,t)}}}
function walk(root){
 if(root.nodeType===3){doText(root);return}
 if(root.nodeType!==1)return;
 doAttrs(root);
 if(skip(root))return;
 const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let n;
 while((n=it.nextNode())){if(n.nodeType===3)doText(n);else doAttrs(n)}
}
if(lang==='en'){
 const mo=new MutationObserver(list=>{for(const m of list){
  if(m.type==='characterData')doText(m.target);
  else if(m.type==='attributes')doAttrs(m.target);
  else for(const n of m.addedNodes)walk(n);
 }});
 mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
 document.addEventListener('DOMContentLoaded',()=>{walk(document.body)});
}

// ---------------------------------------------------------------- 中 / EN toggle
function setLang(l){
 try{localStorage.setItem(KEY,l)}catch(_){}
 try{const u=new URL(location.href);u.searchParams.delete('lang');location.replace(u.toString())}catch(_){location.reload()}
}
window.gardenSetLang=setLang;
function makeToggle(cls){
 const b=document.createElement('button');b.type='button';b.className='lang-toggle '+cls;b.setAttribute('data-i18n-skip','');
 b.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');b.title=b.getAttribute('aria-label');
 b.innerHTML='<span'+(lang==='zh'?' class="on"':'')+'>中</span><i>/</i><span'+(lang==='en'?' class="on"':'')+'>EN</span>';
 b.addEventListener('click',e=>{e.stopPropagation();setLang(lang==='zh'?'en':'zh')});
 b.addEventListener('pointerdown',e=>e.stopPropagation());
 return b;
}
const css=document.createElement('style');
css.textContent='.lang-toggle{font:12px/1 Arial,"Microsoft YaHei",sans-serif!important;letter-spacing:1px;padding:7px 11px!important;min-height:0!important;display:inline-flex;align-items:center;gap:4px;color:#f6dcae99}.lang-toggle span.on{color:#ffe6b8;font-weight:700}.lang-toggle i{font-style:normal;opacity:.45}'
+'.lang-toggle.on-splash{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:calc(16px + env(safe-area-inset-right,0px));z-index:5;background:#3d3931cc;border:1px solid #e2b96b55;border-radius:20px}'
+'.lang-toggle.on-hud{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:4;background:#3d3931c4;border:1px solid #e2b96b44;border-radius:20px}'
+'html.kb-open .lang-toggle.on-hud{display:none}'
+'html.lang-en header h1{letter-spacing:2px;white-space:nowrap}html.lang-en.mobile header h1{letter-spacing:.5px}'
;
document.head.appendChild(css);
function mount(){
 const sp=document.getElementById('splash');
 if(sp&&!sp.querySelector('.lang-toggle'))sp.appendChild(makeToggle('on-splash'));
 if(!document.querySelector('.lang-toggle.on-hud'))document.body.appendChild(makeToggle('on-hud'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
