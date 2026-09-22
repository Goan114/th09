import createModule from './th09.mjs';
import {scanCodes} from './keyboard.mjs';
import {Netplay} from './netplay.mjs';
import {exportReplayName,importReplayName} from './motion-replay.mjs';
const game='th09',protocol='eagler-touhou/1',query=new URLSearchParams(location.search),canvas=document.querySelector('canvas'),$=s=>document.querySelector(s);
let core,launched=false,first=false,options={},music=true,chain=Promise.resolve(),queue=Promise.resolve(),revision=0,netplay,stopping=false;
const emit=(event,fields={})=>parent.postMessage({protocol,game,event,...fields},location.origin);
const values=(fn,n)=>Array.from(core.HEAP32.subarray(fn()/4,fn()/4+n));
const status=()=>({title:values(core._th09_title_status,8),session:values(core._th09_session_status,8),touch:values(core._th09_touch_state,4)});
const err=()=>{const a=core.HEAPU8.subarray(core._th09_error());return new TextDecoder().decode(a.subarray(0,a.indexOf(0)));};
const fatal=e=>{const message=e?.message||String(e);$('#error').textContent=message;core?._th09_loop_pause(1);emit('error',{error:message});};
const sync=(populate=false)=>{const current=chain.then(()=>new Promise((r,j)=>core.FS.syncfs(populate,e=>e?j(e):r())));chain=current.catch(()=>{});return current;};
function path(value){let name=String(value).replaceAll('\\','/').toLowerCase().replace(/^\/savesth09\//,'').replace(/^\//,'');if(!/^(?:score\.dat|th09\.cfg|replay\/th9_(?:\d{2}|ud[a-z0-9]{4})\.rpyx?)$/.test(name))throw Error('存档路径无效');return name;}
function apply(){core._th09_touch_options(+!!options.touchEnabled,Math.max(0,['touch','touch-unlimited','joystick','joystick-free'].indexOf(options.touchMovementMode)),Number(options.touchSensitivity||100)/100,+(options.touchFocusMode==='two-finger'),+!!options.doubleTapBombEnabled);if(launched)core._th09_music_enabled(+music);}
async function resource(r){if(!/^\/(?:music|fonts)\/[a-z0-9_.-]+$/.test(r.path))throw Error('资源路径无效');const u=new URL(r.url,location.href);if(u.origin!==location.origin)throw Error('资源来源无效');const response=await fetch(u);if(!response.ok)throw Error('资源读取失败');core.FS.mkdirTree(r.path.slice(0,r.path.lastIndexOf('/')));core.FS.writeFile(r.path,new Uint8Array(await response.arrayBuffer()));}
async function save(){if(launched&&!core._th09_save_snapshot())throw Error('保存失败');await sync();}
async function stop(){if(stopping)return;stopping=true;try{netplay?.close();core._th09_loop_stop();await save();core._th09_game_close();launched=false;delete window.__th09Runtime;emit('exit',{code:0,status:'success'});}finally{stopping=false;}}
function openNetwork(){if(!launched)return;core._th09_loop_pause(1);const allowed=status().title[1]&&!netplay.socket;$('#create').disabled=$('#join').disabled=!allowed;if(!allowed&&!netplay.socket)$('#network-status').textContent='请先返回游戏标题。';if(!$('#network').open)$('#network').showModal();emit('network-dialog',{open:true});}
$('#create').onclick=()=>netplay.connect().catch(e=>$('#network-status').textContent=e.message);$('#join').onclick=()=>netplay.connect($('#code').value).catch(e=>$('#network-status').textContent=e.message);$('#leave').onclick=()=>netplay.close();$('#close').onclick=()=>$('#network').close();$('#network').addEventListener('close',()=>{emit('network-dialog',{open:false});core._th09_keys_clear();core._th09_loop_pause(+document.hidden);canvas.focus();});
async function command(m){switch(m.command){
case 'configure':options=m.options||{};music=m.music!=='none';for(const r of [...(m.runtimeResources||[]),...(m.resources||[])])await resource(r);apply();return {};
case 'resources':for(const r of m.resources||[])await resource(r);return {};
case 'keyboard':if(!$('#network').open&&scanCodes[m.code])core._th09_key(scanCodes[m.code],+!!m.down);return {};
case 'keyboard-clear':core._th09_keys_clear();return {};
case 'touch-cancel':core._th09_touch_cancel();return {};
case 'direct-touch':{if($('#network').open)return {};const b=canvas.getBoundingClientRect();core._th09_touch(({down:0,move:1,up:2,cancel:2})[m.type]??2,Number(m.id)||0,(Number(m.x)*innerWidth-b.left)/b.width,(Number(m.y)*innerHeight-b.top)/b.height);return {};}
case 'touch-controls':{const t=m.controls||m;if(!$('#network').open){core._th09_touch_controls(+!!options.touchEnabled,+!!t.fireEnabled,+!!t.focusEnabled,t.bombSerial>>>0,t.escapeSerial>>>0);core._th09_touch_stick(Number(t.joystickX)||0,Number(t.joystickY)||0);}return {};}
case 'launch':if(!launched){if(!core._th09_game_open(Date.now()&65535))throw Error(err());launched=true;apply();first=false;netplay=new Netplay(core,{sync,onStatus:t=>$('#network-status').textContent=t,onClose(){}});$('#loading').textContent='';core._th09_loop_start();window.__th09Runtime={core,netplay,status,save,command};emit('runtime-info',{renderer:'SDL3 / WebGL2 / C++',architecture:protocol,version:'2026.09.20-fix'});}return {};
case 'sync':await save();return {};
case 'list':{const files=[];for(const dir of ['', '/replay'])for(const name of core.FS.readdir('/savesth09'+dir)){const n=(dir+'/'+name).replace(/^\//,'');try{path(n);}catch{continue;}const full='/savesth09/'+n,s=core.FS.stat(full);if(core.FS.isFile(s.mode))files.push({path:exportReplayName(n,core.FS.readFile(full),9),size:s.size});}return {files};}
case 'read':return {bytes:Array.from(core.FS.readFile('/savesth09/'+path(m.path).replace(/\.rpyx$/,'.rpy')))};
case 'write':{if(!Array.isArray(m.bytes)||m.bytes.length>16*1024*1024||m.bytes.some(b=>!Number.isInteger(b)||b<0||b>255))throw Error('存档数据无效');const bytes=Uint8Array.from(m.bytes),name=importReplayName(path(m.path),bytes,9);if(launched)throw Error('请先退出游戏再导入');const kind=name.endsWith('.rpy')?1:name==='score.dat'?0:2,p=core._th09_file_buffer(bytes.length);if(!p)throw Error('文件为空或过大');core.HEAPU8.set(bytes,p);if(!core._th09_file_valid(kind,bytes.length))throw Error('文件损坏或不是花映塚 1.50a 的存档/录像');core.FS.mkdirTree('/savesth09/replay');core.FS.writeFile('/savesth09/'+name,bytes);await sync();return {};}
case 'remove':if(launched)throw Error('请先退出游戏');core.FS.unlink('/savesth09/'+path(m.path).replace(/\.rpyx$/,'.rpy'));await sync();return {};
case 'network-open':openNetwork();return {};
default:throw Error('不支持的操作');}}
window.addEventListener('message',e=>{const m=e.data;if(e.source!==parent||e.origin!==location.origin||m?.protocol!==protocol||m.game!==game||typeof m.command!=='string')return;queue=queue.then(async()=>{await initialized;try{const result=await command(m);if(typeof m.request==='string')parent.postMessage({protocol,game,request:m.request,ok:true,...result},location.origin);}catch(e){if(typeof m.request==='string')parent.postMessage({protocol,game,request:m.request,ok:false,error:String(e),errno:e?.errno},location.origin);else fatal(e);}}).catch(fatal);});
// The launcher also listens in the child realm. Room edits belong to the DOM.
for(const event of ['keydown','keyup','keypress'])window.addEventListener(event,e=>{if($('#network').open)e.stopImmediatePropagation();},{capture:true});
for(const event of ['pointerdown','keydown'])window.addEventListener(event,()=>core?.SDL3?.audioContext?.resume().catch(()=>{}),{capture:true});
document.addEventListener('visibilitychange',()=>{if(launched){core._th09_keys_clear();core._th09_touch_cancel();core._th09_loop_pause(+(document.hidden||$('#network').open));if(document.hidden)void save().catch(fatal);}});
// Android sends touches directly to the child; iOS uses the host protocol.
for(const [name,type] of [['pointerdown',0],['pointermove',1],['pointerup',2],['pointercancel',2]])document.body.addEventListener(name,e=>{
 if(!launched||!options.touchEnabled||e.pointerType==='mouse'||$('#network').open||e.target.closest('button,input,dialog'))return;
 e.preventDefault();if(type===0)document.body.setPointerCapture(e.pointerId);const b=canvas.getBoundingClientRect();core._th09_touch(type,e.pointerId,(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fatal(Error('图形环境失效，请退出后重新开始。'));});window.addEventListener('pagehide',()=>{if(launched){netplay?.close();core._th09_loop_pause(1);void save();}});
const initialized=(async()=>{
 let last=performance.now(),lastFrames=0;
 core=await createModule({canvas,printErr:console.error,onNetworkRequest:openNetwork,onNetworkResult:()=>netplay?.result(),onNetworkInput:(...args)=>netplay?.input(...args),onGameFrame(ok,ms){if(!ok){fatal(Error(err()));return;}netplay?.frame();if(!first){first=true;emit('first-frame');}const current=core._th09_storage_revision();if(current!==revision){revision=current;void sync().catch(fatal);}const now=performance.now(),frames=status().title[0];if(now-last>=1000){emit('frame-health',{fps:(frames-lastFrames)*1000/(now-last),maxGapMs:ms});last=now;lastFrames=frames;}if(status().title[7]===0)void stop().catch(fatal);}});
 window.Module=core;window.FS=core.FS;core.SDL3=core.SDL3||{};if(parent!==window&&parent.__touhouAudioContext)core.SDL3.audioContext=parent.__touhouAudioContext;
 core.FS.mkdirTree('/savesth09');core.FS.mount(core.IDBFS,{},'/savesth09');await sync(true);core.FS.mkdirTree('/savesth09/replay');core.FS.symlink('/savesth09','/save');
 const index=await fetch('./th09.data.json').then(r=>r.json());let buffer;if(query.get('managedData')==='1'){if(parent===window||typeof parent.__eaglerPrepareManagedRuntimeDataV1!=='function')throw Error('游戏资源尚未准备');buffer=(await parent.__eaglerPrepareManagedRuntimeDataV1({game,generation:query.get('gameGeneration')})).buffer;}else buffer=await fetch('../../packages/th09/th09.data').then(r=>r.arrayBuffer());
 if(buffer.byteLength!==index.remote_package_size)throw Error('游戏资源大小错误');for(const f of index.files){if(!/^\/(?:th09\.dat|fonts\/[a-z0-9_.-]+)$/.test(f.filename)||!Number.isInteger(f.start)||!Number.isInteger(f.end)||f.start<0||f.end<=f.start||f.end>buffer.byteLength)throw Error('游戏资源清单错误');core.FS.mkdirTree(f.filename.slice(0,f.filename.lastIndexOf('/'))||'/');core.FS.writeFile(f.filename,new Uint8Array(buffer,f.start,f.end-f.start));}
 if(query.get('managedData')!=='1')for(const name of index.music){const r=await fetch('../../packages/th09/music/'+name);if(!r.ok)throw Error('音乐加载失败');core.FS.mkdirTree('/music');core.FS.writeFile('/music/'+name,new Uint8Array(await r.arrayBuffer()));}
 emit('ready');if(query.get('standalone')==='1')await command({command:'launch'});
})().catch(e=>{fatal(e);throw e;});
