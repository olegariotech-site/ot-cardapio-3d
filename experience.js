import {CAMERA,cameraFor,A11Y_PT,applyARMode,restoreCamera,localDiagnostics,observeNativeLaunch} from './viewer-policy.js?v=0.3.0';
import {assetPath} from './asset-policy.js?v=0.3.0';
export function createExperience(onLock=()=>{}){
const $=id=>document.getElementById(id);
const stage=$('stage'),loadButton=$('load-model'),arButton=$('launch-ar'),status=$('status'),progress=$('download-progress');
const diagnostics=localDiagnostics();
let scaleMode='real';
let viewer,ready=false,loading=false,enginePromise,engineFailed=false,generation=0,attempts=0,timeout,controller,product,loadStarted=0,arActive=false,nativePending=false,launchBusy=false,arHint,keyboardInitiated=false;
const say=(message,state='normal')=>{status.textContent=message;status.dataset.state=state;};
const pauseRotation=()=>{if(viewer)viewer.autoRotate=false;$('spin').setAttribute('aria-pressed','false');};

function engine(){
  if(!enginePromise){
    const probe=document.createElement('canvas'),gl=probe.getContext('webgl2');
    if(!gl)throw Error('webgl-unavailable');gl.getExtension('WEBGL_lose_context')?.loseContext();
    enginePromise=import('./vendor/model-viewer.min.js').then(async()=>{await customElements.whenDefined('model-viewer');customElements.get('model-viewer').modelCacheSize=0;});
    enginePromise.catch(()=>{engineFailed=true;});
  }return enginePromise;
}
function updateAR(){
  const locked=arActive||nativePending||launchBusy;onLock(locked);
  $('scale-controls').disabled=locked||!ready; $('ar-mode').disabled=locked||!ready;
  if(product?.status==='photo-only'){arButton.disabled=true;$('ar-help').textContent='Este produto está disponível em fotografia. O 3D aguarda digitalização.';return;}

  arButton.disabled=!ready||arActive||nativePending||launchBusy||!window.isSecureContext||!viewer?.canActivateAR;
  $('ar-help').textContent=!window.isSecureContext?'A realidade aumentada precisa de HTTPS. O 3D continua disponível.':arActive?'Sessão WebXR em andamento.':nativePending?'Visualizador nativo chamado. Confirme a abertura no celular.':viewer?.canActivateAR&&ready?'Aponte para uma mesa bem iluminada. Permita a câmera quando solicitado.':'AR não disponibilizada por este navegador. Você pode continuar no 3D.';
}
function refreshAR(current,remaining=16){
  if(current!==generation||!ready)return;updateAR();
  if(arButton.disabled&&!arActive&&!nativePending&&remaining>0)setTimeout(()=>refreshAR(current,remaining-1),400);
}
function restoreView(){if(!viewer||!ready||arActive||nativePending||launchBusy)return;pauseRotation();restoreCamera(viewer,cameraFor(product));diagnostics.event('3d-view-restored');}
function fail(message){
  launchBusy=false;
  generation++;clearTimeout(timeout);controller?.abort();pauseRotation();viewer?.remove();viewer=undefined;ready=false;loading=false;arActive=false;nativePending=false;
  stage.setAttribute('aria-busy','false');stage.classList.remove('viewer-ready');$('viewer-controls').hidden=true;$('start-panel').hidden=false;progress.hidden=true;
  loadButton.disabled=false;loadButton.textContent=engineFailed?'Recarregar a experiência':'Tentar novamente';arButton.disabled=true;$('download-label').textContent='A fotografia continua disponível.';
  updateAR();say(message,'error');diagnostics.event('3d-load-failed',{message});
}
async function download(url,signal,current){
  const response=await fetch(url,{signal,cache:'force-cache'});if(!response.ok)throw Error('model-download');
  const total=Number(response.headers.get('Content-Length'));
  const hasTotal=total>0&&!response.headers.get('Content-Encoding');
  progress.hidden=false;if(hasTotal){progress.max=total;progress.value=0;}else progress.removeAttribute('value');
  let bytes=0;
  const show=()=>{if(current!==generation)return;$('download-label').textContent=`Baixando ${(bytes/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})} MB`;if(hasTotal)progress.value=Math.min(bytes,total);};
  if(response.body?.getReader){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;show();}}finally{reader.releaseLock();}}
  else{bytes=(await response.arrayBuffer()).byteLength;show();}
  diagnostics.event('model-download-complete',{bytes});
}
function localizeShadow(v){
  const s=v.shadowRoot;if(!s)return;
  s.querySelector('[role="region"]')?.setAttribute('aria-label','Atualizações da visualização');
  for(const [id,label] of [['default-poster','Carregando alimento em 3D'],['default-ar-button','Ver na minha mesa'],['default-exit-webxr-ar-button','Sair da realidade aumentada']])s.getElementById(id)?.setAttribute('aria-label',label);
}
function attachAR(v,current){
  v.addEventListener('ar-status',e=>{
    if(current!==generation)return;
    const value=e.detail.status;diagnostics.event('ar-status',{status:value});
    if(value==='session-started'){
      arActive=true;nativePending=false;pauseRotation();diagnostics.observed('webxr','model-viewer-session-started');
      setHint('Mova o celular devagar e procure a mesa.');say('Sessão WebXR iniciada. Procure uma superfície horizontal.');
    }else if(value==='object-placed'){setHint('Alimento posicionado. Observe a estabilidade sem arrastar o objeto.');say(`Alimento posicionado. Referência: ${Math.round(product.physical.widthM*100)} cm. Confira com uma régua no modo Tamanho real.`);}
    else if(value==='not-presenting'){arActive=false;nativePending=false;requestAnimationFrame(()=>{if(current!==generation)return;restoreView();updateAR();});say('Você voltou ao 3D. A vista inicial foi restaurada.');}
    else if(value==='failed'){arActive=false;nativePending=false;updateAR();say('A realidade aumentada não iniciou. Continue no 3D ou teste outro modo.','error');}
    updateAR();
  });
  v.addEventListener('ar-tracking',e=>{
    if(current!==generation)return;diagnostics.setTracking(e.detail.status);
    setHint(e.detail.status==='not-tracking'?'Rastreamento instável. Pare e aponte para uma superfície iluminada e com textura.':'Rastreamento recuperado. Confira a posição antes de medir.');
  });
}
async function loadModel(event){
  if(!product||product.status!=='ready')return;if(loading)return;if(engineFailed){location.reload();return;}
  const current=++generation;attempts++;keyboardInitiated=event?.detail===0;loading=true;ready=false;loadStarted=performance.now();controller?.abort();controller=new AbortController();
  stage.setAttribute('aria-busy','true');loadButton.disabled=true;loadButton.textContent='Carregando o alimento…';$('download-label').textContent='Preparando a experiência';progress.hidden=false;progress.removeAttribute('value');say('Carregando o alimento e preparando o 3D.');
  diagnostics.event('3d-load-started',{attempt:attempts});
  timeout=setTimeout(()=>{if(current===generation)fail('O carregamento demorou mais que o esperado. Confira a conexão e tente novamente.');},45000);
  try{
    // Download only the selected model while the engine parses.
    const engineResult=engine().then(()=>null,e=>e);
    const modelURL=new URL(assetPath(product.assets.glb,'.glb'));if(attempts>1)modelURL.searchParams.set('ot-retry',String(attempts));
    const [engineError]=await Promise.all([engineResult,download(modelURL.href,controller.signal,current)]);
    if(engineError)throw engineError;if(current!==generation)return;
    $('download-label').textContent='Preparando textura e primeira imagem';progress.removeAttribute('value');
    viewer?.remove();viewer=document.createElement('model-viewer');const v=viewer;v.id='food-viewer';
    const attributes={alt:`${product.name} em três dimensões.`, 'camera-controls':'',ar:'','ar-scale':'fixed','ar-placement':'floor','camera-orbit':CAMERA.orbit,'camera-target':CAMERA.target,'min-camera-orbit':cameraFor(product).min,'max-camera-orbit':cameraFor(product).max,'field-of-view':CAMERA.fov,'min-field-of-view':CAMERA.fov,'max-field-of-view':CAMERA.fov,'disable-pan':'','disable-tap':'','interpolation-decay':'30','orbit-sensitivity':'1.1','zoom-sensitivity':'0.6','shadow-intensity':'0.65','shadow-softness':'0.6',exposure:'1','interaction-prompt':'none','touch-action':'pan-y',loading:'eager',reveal:'auto','rotation-per-second':'25deg','auto-rotate-delay':'600','environment-image':'neutral'};
    for(const [k,value] of Object.entries(attributes))v.setAttribute(k,value);
    v.a11y=A11Y_PT;applyARMode(v,$('ar-mode').value,assetPath(product.assets.usdz,'.usdz'),scaleMode);localizeShadow(v);
    for(const slot of ['ar-button','poster','progress-bar']){const el=document.createElement('span');el.slot=slot;el.hidden=true;el.setAttribute('aria-hidden','true');v.append(el);}
    arHint=document.createElement('div');arHint.className='xr-hint';arHint.setAttribute('role','status');arHint.setAttribute('aria-live','polite');setHint('Mova o celular devagar e procure a mesa.');v.append(arHint);
    const exit=document.createElement('button');exit.type='button';exit.slot='exit-webxr-ar-button';exit.className='exit-ar';exit.textContent='Sair da AR';exit.setAttribute('aria-label','Sair da realidade aumentada');v.append(exit);
    v.addEventListener('pointerdown',pauseRotation);
    v.addEventListener('render-scale',e=>{if(current===generation)diagnostics.setRender(e.detail);});
    v.addEventListener('error',()=>{if(current===generation)fail('Não foi possível exibir o 3D. A fotografia continua disponível. Tente novamente.');});
    v.addEventListener('load',()=>{
      if(current!==generation)return;const dimensions=v.getDimensions();
      if(!Number.isFinite(dimensions.x)||Math.abs(dimensions.x-product.physical.widthM)>.00001||dimensions.y<=0||dimensions.z<=0){fail('O modelo não pôde ser exibido corretamente. Tente novamente.');return;}
      clearTimeout(timeout);loading=false;ready=true;stage.setAttribute('aria-busy','false');stage.classList.add('viewer-ready');$('start-panel').hidden=true;progress.hidden=true;$('viewer-controls').hidden=false;
      diagnostics.setLoad(performance.now()-loadStarted);$('interaction-hint').textContent='Arraste para girar · pinça para aproximar';say('Pronto. Explore o alimento ou veja na sua mesa.');localizeShadow(v);refreshAR(current);
      if(keyboardInitiated)v.focus({preventScroll:true});
    });
    attachAR(v,current);$('viewer-host').replaceChildren(v);
    // Keep a static same-origin URL. Native viewers cannot load browser blob URLs.
    v.src=modelURL.href;
  }catch(error){if(current!==generation)return;fail(error.message==='webgl-unavailable'?'Este navegador não disponibilizou os recursos para exibir o 3D. A fotografia continua disponível.':'Não foi possível preparar a experiência. Confira a conexão e tente novamente.');}
}
loadButton.addEventListener('click',loadModel);
arButton.addEventListener('click',()=>{
  if(!ready||!viewer?.canActivateAR||!window.isSecureContext||arActive||nativePending||launchBusy){updateAR();return;}
  pauseRotation();diagnostics.event('ar-launch-requested',{requestedMode:$('ar-mode').value});
  launchBusy=true;updateAR();const current=generation;
  // No await before activateAR: preserve the original user gesture.
  observeNativeLaunch(()=>viewer.activateAR(),anchor=>{
    if(current!==generation)return;diagnostics.nativeAnchor(anchor);nativePending=true;updateAR();
    setTimeout(()=>{if(current===generation&&nativePending&&!document.hidden){nativePending=false;updateAR();say('Se o visualizador não abriu, tente novamente ou compare outro modo de AR.');diagnostics.event('native-handoff-not-confirmed');}},6000);
  }).catch(()=>{nativePending=false;arActive=false;say('A sessão de AR não iniciou. O 3D continua disponível.','error');}).finally(()=>{launchBusy=false;updateAR();});
});
$('rotate').addEventListener('click',()=>{if(!ready||arActive)return;pauseRotation();const orbit=viewer.getCameraOrbit();viewer.cameraOrbit=`${orbit.theta+Math.PI/2}rad ${orbit.phi}rad ${orbit.radius}m`;});
$('spin').addEventListener('click',()=>{if(!ready||arActive)return;viewer.autoRotate=!viewer.autoRotate;$('spin').setAttribute('aria-pressed',String(viewer.autoRotate));});
$('reset').addEventListener('click',restoreView);
$('ar-mode').addEventListener('change',()=>{
  if(arActive||nativePending||launchBusy)return;
  const mode=$('ar-mode').value;diagnostics.data.requestedMode=mode;diagnostics.event('ar-mode-selected',{mode});nativePending=false;diagnostics.data.observedMode=null;diagnostics.data.modeEvidence=null;$('diag-mode').textContent='Aguardando nova tentativa';
  if(viewer&&product&&!arActive){arButton.disabled=true;applyARMode(viewer,mode,assetPath(product.assets.usdz,'.usdz'),scaleMode);setTimeout(()=>refreshAR(generation),150);}
});
$('copy-diagnostics').addEventListener('click',()=>{const field=$('diagnostic-report');field.value=diagnostics.export();field.hidden=false;field.focus({preventScroll:true});field.select();$('copy-diagnostics').textContent='Relatório pronto para copiar';});
function restoreAfterNative(){if(!document.hidden&&nativePending){nativePending=false;restoreView();updateAR();diagnostics.event('returned-from-native-handoff');}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRotation();else restoreAfterNative();});
window.addEventListener('focus',restoreAfterNative);
window.addEventListener('pageshow',()=>{if(ready&&!arActive){restoreView();updateAR();}});
function setHint(text){if(arHint)arHint.textContent=(scaleMode==='free'?'Exploração livre: tamanho ilustrativo. ':'')+text;}
function updateScaleText(){
 const width=Math.round((product?.physical.widthM??.2)*100);
 $('scale-help').textContent=scaleMode==='real'?`Escala bloqueada em AR. Referência de ${width} cm.`:'O tamanho pode ser ampliado ou reduzido quando o visualizador permitir. Não representa necessariamente o tamanho real.';
 $('return-real').hidden=scaleMode==='real';
 for(const radio of document.querySelectorAll('[name=scale-mode]'))radio.checked=radio.value===scaleMode;
}
function setScale(mode){
 if(arActive||nativePending||launchBusy){updateScaleText();return;}
 if(!['real','free'].includes(mode))return;scaleMode=mode;diagnostics.data.scaleMode=mode;diagnostics.event('scale-selected',{mode});updateScaleText();
 if(viewer&&product?.status==='ready'){applyARMode(viewer,$('ar-mode').value,assetPath(product.assets.usdz,'.usdz'),scaleMode);arButton.disabled=true;setTimeout(()=>refreshAR(generation),150);}
}
for(const radio of document.querySelectorAll('[name=scale-mode]'))radio.addEventListener('change',()=>setScale(radio.value));
$('return-real').addEventListener('click',()=>{setScale('real');restoreView();say('Tamanho real selecionado. Inicie uma nova sessão e posicione o alimento novamente.');});
function dispose(){
 generation++;controller?.abort();clearTimeout(timeout);pauseRotation();if(viewer){viewer.src=null;viewer.remove();viewer=undefined;}
 ready=false;loading=false;arActive=false;nativePending=false;launchBusy=false;onLock(false);diagnostics.event('viewer-released',{modelCacheSize:0});
}
function selectProduct(p,event){
 if(arActive||nativePending||launchBusy)return false;dispose();product=p;attempts=0;scaleMode='real';diagnostics.data.productId=p.id;diagnostics.data.scaleMode='real';diagnostics.data.observedMode=null;diagnostics.data.modeEvidence=null;diagnostics.data.firstRenderMs=null;diagnostics.data.tracking='not-measured';
 $('diag-load').textContent='Ainda não carregado';$('diag-mode').textContent='Nenhuma sessão iniciada';$('diag-tracking').textContent='Não medido';$('diagnostic-report').hidden=true;
 diagnostics.event('product-selected',{id:p.id});stage.classList.remove('viewer-ready');stage.setAttribute('aria-busy','false');$('viewer-controls').hidden=true;$('start-panel').hidden=false;progress.hidden=true;
 loadButton.hidden=p.status!=='ready';loadButton.disabled=false;loadButton.textContent='Explorar em 3D';$('download-label').textContent=p.status==='ready'?'Preparando a experiência':'Fotografia disponível. Modelo 3D pendente de digitalização.';
 updateScaleText();updateAR();
 if(p.status==='ready')loadModel(event);else{say('Veja a fotografia. A realidade aumentada ainda não está disponível para este produto.');$('interaction-hint').textContent='Fotografia ilustrativa · 3D ainda indisponível';$('scale-help').textContent='Dimensão planejada; modelo ainda não calibrado.';}
 return true;
}
return {selectProduct,dispose,canLeave:()=>!arActive&&!nativePending&&!launchBusy};
}
