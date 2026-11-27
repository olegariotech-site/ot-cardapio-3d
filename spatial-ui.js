import {SpatialSession} from './ar-spatial.js?v=0.3.1';
export function installSpatialUI(viewer,product,{mode,factor,hint,diagnostics}){
 const controller=new SpatialSession(viewer,{mode,factor});viewer.otSpatialController=controller;
 const panel=document.createElement('section');panel.className='xr-panel';panel.hidden=true;panel.setAttribute('aria-label','Controles espaciais da realidade aumentada');panel.append(hint);
 const actions=document.createElement('div');actions.className='xr-actions';
 const button=(id,text,fn)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.addEventListener('click',fn);actions.append(b);return b;};
 const lock=button('xr-lock','Desbloquear gestos',()=>controller.setLocked(!controller.locked));
 const reposition=button('xr-reposition','Reposicionar',()=>controller.beginPlacement());
 const reset=button('xr-reset-scale','Restaurar dimensões',()=>controller.restoreDimensions());
 reset.hidden=mode==='real';panel.append(actions);
 const label=document.createElement('label');label.className='xr-scale';label.hidden=mode==='real';label.textContent='Escala ilustrativa';
 const range=document.createElement('input');range.id='xr-scale';range.type='range';range.min='.25';range.max='4';range.step='.01';range.value=String(factor);range.setAttribute('aria-label','Ajustar escala ilustrativa em AR');range.addEventListener('input',()=>controller.setFactor(range.value));
 const output=document.createElement('output');label.append(range,output);panel.append(label);viewer.append(panel);
 function update(detail){
  reset.hidden=detail.mode==='real';label.hidden=detail.mode==='real';
  diagnostics.data.spatial={...detail};diagnostics.event('spatial-status',detail);
  document.getElementById('diag-spatial').textContent=detail.state;
  document.getElementById('diag-anchor').textContent=({tracked:'Âncora XR acompanhada',created:'Âncora XR criada; aguardando pose',unavailable:'Indisponível nesta sessão',released:'Liberada para movimentar',pending:'Solicitando âncora','not-requested':'Ainda não solicitada','pose-unavailable':'Âncora sem pose válida no momento',ended:'Sessão encerrada; âncora liberada'})[detail.anchor]||detail.anchor;
  if(detail.xrCallbackHz!==undefined)document.getElementById('diag-cadence').textContent=`${detail.xrCallbackHz} callbacks XR/s; não equivale a FPS da GPU`;
  const problem=['lost','anchor-lost'].includes(detail.state),placed=controller.placed&&detail.state!=='searching';
  lock.disabled=!placed||problem||detail.gestures!=='available';reposition.disabled=!controller.active;reset.disabled=!placed||problem;range.disabled=!placed||problem;
  lock.textContent=detail.locked?'Desbloquear gestos':'Fixar posição';lock.setAttribute('aria-pressed',String(detail.locked));
  if(detail.gestures==='unavailable')lock.textContent='Gestos indisponíveis';
  range.value=String(detail.factor);output.textContent=`${Math.round(product.physical.widthM*detail.factor*1000)/10} cm de largura · ${Math.round(detail.factor*100)}%`;
  const prefix=detail.mode==='real'?'':detail.mode==='plate'?'Ajuste ao prato: escala ilustrativa. ':'Exploração livre: escala ilustrativa. ';
  const messages={
   searching:'Aponte o centro da tela para uma mesa com textura e aguarde. Evite espelhos e reflexos.',
   locked:detail.anchor==='tracked'?'Âncora acompanhada. Gestos bloqueados; confira a posição com uma referência física.':detail.anchor==='unavailable'?'Gestos bloqueados; âncora indisponível. Se houver deslocamento, use Reposicionar.':'Gestos bloqueados. Aguardando confirmação da âncora.',
   moving:'Gestos liberados. Arraste para mover ou gire; depois toque em Fixar posição.',
   lost:'Posição ocultada por perda de rastreamento. Pare e aponte para uma área iluminada e com textura. Sem âncora, use Reposicionar.',
   'anchor-lost':'Âncora temporariamente não localizada. O alimento ficará oculto até a recuperação ou um novo posicionamento.',
   'hit-test-unavailable':'O hit test não ficou disponível. Saia da AR e tente novamente ou compare com Scene Viewer.',
   'unsupported-interaction':'Controles espaciais OT indisponíveis neste tipo de sessão.'
  };
  if(messages[detail.state])hint.textContent=prefix+messages[detail.state]+(detail.recovered?' Rastreamento recuperado: confira a posição antes de medir.':'');
 }
 viewer.addEventListener('ot-ar-spatial',event=>update(event.detail));
 viewer.addEventListener('ar-status',event=>{panel.hidden=!controller.active||!['session-started','object-placed'].includes(event.detail.status);});
 return controller;
}
