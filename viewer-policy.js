// Radius limits are explicit for the single calibrated 20 cm product. The engine
// uses different percentage bases for min-camera-orbit and camera-orbit.
export const CAMERA = Object.freeze({orbit:'25deg 65deg 100%',target:'auto auto auto',min:'auto 35deg 0.36m',max:'auto 85deg 0.48m',fov:'30deg'});
export const AR_MODES = Object.freeze({auto:'webxr scene-viewer quick-look',webxr:'webxr','scene-viewer':'scene-viewer','quick-look':'quick-look'});
export const A11Y_PT = Object.freeze({
  'interaction-prompt':'Arraste ou use as setas para girar. Use a pinça para aproximar dentro dos limites.',
  front:'Vista frontal do alimento',right:'Vista pelo lado direito',back:'Vista traseira do alimento',left:'Vista pelo lado esquerdo',
  'upper-front':'Vista superior frontal','upper-right':'Vista superior direita','upper-back':'Vista superior traseira','upper-left':'Vista superior esquerda',
  'lower-front':'Vista inferior frontal','lower-right':'Vista inferior direita','lower-back':'Vista inferior traseira','lower-left':'Vista inferior esquerda'
});

export function applyARMode(viewer, mode, usdz, scaleMode='real') {
  if (!Object.hasOwn(AR_MODES,mode)) throw new Error('Modo de AR inválido');
  viewer.arModes=AR_MODES[mode];
  // ios-src enables Quick Look independently of ar-modes. Clear it in isolated Android tests.
  viewer.iosSrc=(mode==='auto'||mode==='quick-look')?usdz:null;
  if(!['real','free'].includes(scaleMode))throw Error('Escala inválida');
  viewer.arScale=scaleMode==='real'?'fixed':'auto';
  viewer.arPlacement='floor';
}

export function cameraFor(product){
  const factor=product.physical.widthM/0.2;
  return {...CAMERA,min:`auto 35deg ${(.36*factor).toFixed(5)}m`,max:`auto 85deg ${(.48*factor).toFixed(5)}m`};
}

export function restoreCamera(viewer, camera=CAMERA) {
  viewer.autoRotate=false;
  viewer.resetTurntableRotation();
  viewer.cameraTarget=camera.target;
  viewer.cameraOrbit=camera.orbit;
  viewer.fieldOfView=camera.fov;
  viewer.jumpCameraToGoal();
}

export function observeNativeLaunch(action,onAnchor) {
  // Model Viewer 4.4 clicks a detached anchor for Scene Viewer, so DOM event
  // listeners cannot observe that handoff. Scope this passive observer to one
  // launch, preserve the original click synchronously, and always restore it.
  const prototype=HTMLAnchorElement.prototype,original=prototype.click;
  function click(...args){
    if(this.href.startsWith('intent://arvr.google.com/scene-viewer/')||this.relList.contains('ar')){
      try{onAnchor(this);}catch{/* Diagnostics must not block the native handoff. */}
    }
    return Reflect.apply(original,this,args);
  }
  prototype.click=click;
  const restore=()=>{if(prototype.click===click)prototype.click=original;};
  try{return Promise.resolve(action()).finally(restore);}catch(error){restore();return Promise.reject(error);}
}

export function localDiagnostics() {
  const ua=navigator.userAgent;
  const browser=/EdgA\//.test(ua)?'Edge Android':/Edg\//.test(ua)?'Edge':/CriOS\//.test(ua)?'Chrome iOS':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Outro navegador';
  const data={version:'0.2.0',productId:null,scaleMode:'real',userAgent:ua,browser,devicePixelRatio:window.devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemoryGiB:navigator.deviceMemory??null,requestedMode:'auto',observedMode:null,modeEvidence:null,firstRenderMs:null,tracking:'not-measured',renderScale:null,events:[],physicalValidation:'pending'};
  const $=id=>document.getElementById(id);
  $('diag-browser').textContent=browser;
  $('diag-render').textContent=`DPR ${window.devicePixelRatio}; FPS físico não medido`;
  function event(type,detail={}){data.events.push({type,timeMs:Math.round(performance.now()),...detail});if(data.events.length>100)data.events.shift();}
  function observed(mode,evidence){data.observedMode=mode;data.modeEvidence=evidence;event('ar-mode-observed',{mode,evidence});$('diag-mode').textContent=mode==='webxr'?'WebXR: sessão iniciada':`${mode==='scene-viewer'?'Scene Viewer':'Quick Look'}: chamado; confirmar no aparelho`;}
  function nativeAnchor(a){
    if(!a)return;
    if(a.href.startsWith('intent://arvr.google.com/scene-viewer/')){
      const u=new URL(a.href);observed('scene-viewer','native-intent-click');event('native-scale-policy',{resizable:u.searchParams.get('resizable')});
    }else if(a.relList.contains('ar')){
      const u=new URL(a.href,location.href);observed('quick-look','rel-ar-link-click');event('native-scale-policy',{allowsContentScaling:new URLSearchParams(u.hash.slice(1)).get('allowsContentScaling')});
    }
  }
  function setTracking(value){data.tracking=value;event('ar-tracking',{status:value});$('diag-tracking').textContent=value==='tracking'?'Rastreamento reportado pelo WebXR':value==='not-tracking'?'Perda de rastreamento reportada':'Não medido';}
  return {data,event,observed,nativeAnchor,setTracking,
    setLoad(ms){data.firstRenderMs=Math.round(ms);$('diag-load').textContent=`${(ms/1000).toLocaleString('pt-BR',{maximumFractionDigits:2})} s neste carregamento`;event('first-render',{milliseconds:Math.round(ms)});},
    setRender(detail){data.renderScale={...detail};$('diag-render').textContent=`${detail.pixelWidth}×${detail.pixelHeight} px; DPR ${Number(detail.renderedDpr).toFixed(2)}; FPS físico não medido`;},
    export(){return JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);}
  };
}
