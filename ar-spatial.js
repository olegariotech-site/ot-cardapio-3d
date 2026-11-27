// OLEGARIO TECH — session-local WebXR controls for the pinned Model Viewer bridge.
// Coordinates remain in the XR reference space. Nothing is attached to the screen.
export function plateScale(physical, diameterCm, coveragePercent) {
  const diameter=Number(diameterCm),coverage=Number(coveragePercent);
  if(!Number.isFinite(diameter)||diameter<10||diameter>50||!Number.isFinite(coverage)||coverage<40||coverage>100)throw Error('Referência do prato inválida');
  const extent=Math.max(physical.widthM,physical.depthM||physical.widthM);
  return Math.max(.25,Math.min(4,(diameter/100)*(coverage/100)/extent));
}

export class SpatialSession {
  constructor(element,{mode='real',factor=1}={}) {
    this.element=element;this.mode=mode;this.factor=mode==='real'?1:Math.max(.25,Math.min(4,factor));
    this.epoch=0;this.state='idle';this.locked=true;this.anchorState='not-requested';this.poseOK=false;
  }
  configure(mode,factor=1){
    if(this.renderer)throw Error('Encerre a AR para trocar de modo');
    this.mode=mode;this.factor=mode==='real'?1:Math.max(.25,Math.min(4,factor));
  }
  emit(extra={}){
    this.element.dispatchEvent(new CustomEvent('ot-ar-spatial',{detail:{state:this.state,locked:this.locked,anchor:this.anchorState,gestures:this.gestureSupport||'pending',mode:this.mode,factor:this.factor,tracking:this.poseOK?'pose-available':'pose-unavailable',...extra}}));
  }
  connect(renderer){
    this.renderer=renderer;this.scene=renderer.presentedScene;this.epoch++;this.anchor=null;this.pendingAnchor=false;this.pendingLock=false;this.repositionNotice=false;this.samples=[];this.placed=false;this.locked=true;this.poseOK=false;this.recoveryFrames=0;this.lastTime=null;this.fpsFrames=0;this.fpsTime=null;this.lastPoseTime=null;
    this.active=renderer.xrMode==='screen-space';
    this.gestureSupport=renderer.transientHitTestSource?'available':'pending';
    if(!this.active){this.state='unsupported-interaction';this.emit();return;}
    this.state='searching';this.anchorState='not-requested';this.scene.visible=false;
    this.scene.canScale=false;this.renderer.goalScale=this.factor;this.scene.scenePivot.scale.setScalar(this.factor);
    this.refSpace=renderer.threeRenderer.xr.getReferenceSpace();
    this.onReset=()=>{this.invalidateAnchor();this.beginPlacement('reference-space-reset');};
    this.refSpace.addEventListener?.('reset',this.onReset);
    this.emit({anchorsFeature:renderer.currentSession.enabledFeatures?.includes('anchors')??'unknown',depth:'not-requested'});
  }
  invalidateAnchor(){
    this.epoch++;this.pendingAnchor=false;
    try{this.anchor?.delete();}catch{/* Session may already have ended. */}
    this.anchor=null;
  }
  disconnect(){
    if(!this.renderer)return;
    this.invalidateAnchor();this.refSpace?.removeEventListener?.('reset',this.onReset);
    this.scene.visible=true;this.scene.canScale=this.mode!=='real';this.state='idle';this.active=false;this.poseOK=false;this.anchorState='ended';
    this.renderer=null;this.scene=null;this.refSpace=null;this.emit();
  }
  allowInput(){return !this.active||Boolean(this.placed&&!this.locked&&this.poseOK&&this.state==='moving'&&this.gestureSupport==='available');}
  setGestureSupport(available,reason){this.gestureSupport=available?'available':'unavailable';if(this.active)this.emit({gestureReason:reason});}
  clearGestures(){
    const r=this.renderer;
    r.isTranslating=false;r.isRotating=false;r.isTwoHandInteraction=false;r.wasTwoFingering=false;r.inputSource=null;r.firstRatio=0;
    r.placementBox.offsetHeight=0;r.placementBox.show=false;this.scene.setShadowOffset(0);
  }
  track(pose,time){
    if(!this.active)return;
    const valid=Boolean(pose)&&!pose.emulatedPosition;
    if(this.lastPoseTime!==null&&time-this.lastPoseTime>750&&this.placed)this.loseTracking('frame-gap');
    this.lastPoseTime=time;
    if(!valid){this.loseTracking(pose?'emulated-position':'viewer-pose-unavailable');return;}
    if(!this.poseOK){this.poseOK=true;this.recoveryFrames=0;this.samples=[];this.emit({recovery:true});}
  }
  loseTracking(reason){
    if(!this.poseOK&&this.state==='lost')return;
    this.poseOK=false;this.samples=[];this.recoveryFrames=0;this.scene.visible=false;this.clearGestures();
    this.locked=true;this.scene.canScale=false;if(this.anchor)this.anchorState='pose-unavailable';this.state='lost';this.emit({reason});
  }
  place(frame){
    if(!this.active||this.placed||!this.poseOK)return;
    const r=this.renderer,source=r.initialHitSource;
    if(!source)return;
    let hit;
    try{hit=frame.getHitTestResults(source).find(h=>{
      const pose=h.getPose(this.refSpace);return pose&&!pose.emulatedPosition&&pose.transform.matrix[5]>.95;
    });}catch(error){this.sourceError(error);return;}
    if(!hit){this.samples=[];return;}
    const pose=hit.getPose(this.refSpace),m=pose.transform.matrix;
    const sample={x:m[12],y:m[13],z:m[14],time:this.lastPoseTime};
    if(![sample.x,sample.y,sample.z].every(Number.isFinite)){this.samples=[];return;}
    const previous=this.samples[0];
    if(previous&&Math.hypot(sample.x-previous.x,sample.y-previous.y,sample.z-previous.z)>.015)this.samples=[];
    this.samples.push(sample);if(this.samples.length>90)this.samples.shift();
    if(this.samples.length<8||sample.time-this.samples[0].time<250)return;
    // Use the actual horizontal hit in X, Y AND Z, never the initial 1 m preview.
    r.goalPosition.set(sample.x,sample.y,sample.z);this.scene.scenePivot.position.copy(r.goalPosition);
    r.goalScale=this.factor;this.scene.scenePivot.scale.setScalar(this.factor);
    r.placementComplete=true;this.clearGestures();this.scene.setShadowIntensity?.(.8);
    source.cancel();r.initialHitSource=null;this.placed=true;this.locked=true;this.scene.visible=true;
    this.state='locked';this.anchorState='pending';
    this.requestAnchor(frame,hit);r.dispatchEvent({type:'status',status:'object-placed'});this.emit({placement:'stable-horizontal-hit',digitalScale:this.factor});
  }
  requestAnchor(frame,hit=null){
    if(this.pendingAnchor)return;
    const token=this.epoch,renderer=this.renderer;this.pendingAnchor=true;
    let promise;
    try{
      if(hit&&typeof hit.createAnchor==='function')promise=hit.createAnchor();
      else if(typeof frame.createAnchor==='function'){
        const p=renderer.goalPosition,yaw=renderer.goalYaw;
        promise=frame.createAnchor(new XRRigidTransform({x:p.x,y:p.y,z:p.z},{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}),this.refSpace);
      }else throw Error('anchors-unavailable');
    }catch(error){this.anchorFailed(error);return;}
    Promise.resolve(promise).then(anchor=>{
      if(token!==this.epoch||renderer!==this.renderer||!this.locked){try{anchor.delete();}catch{}return;}
      this.pendingAnchor=false;this.anchor=anchor;this.anchorYawOffset=null;this.anchorState='created';this.emit();
    },error=>{if(token===this.epoch&&renderer===this.renderer)this.anchorFailed(error);});
  }
  anchorFailed(error){this.pendingAnchor=false;this.anchorState='unavailable';this.emit({anchorError:String(error?.name||error?.message||'anchor-error').slice(0,80)});}
  update(frame,time){
    if(!this.active||!this.poseOK)return;
    const r=this.renderer;
    if(this.pendingLock&&this.placed){
      this.pendingLock=false;this.invalidateAnchor();this.locked=true;this.clearGestures();
      r.goalPosition.copy(this.scene.scenePivot.position);this.scene.canScale=false;this.state='locked';this.requestAnchor(frame);this.emit();
    }
    if(this.placed&&this.locked&&this.anchor){
      let pose;try{pose=frame.getPose(this.anchor.anchorSpace,this.refSpace);}catch{this.loseAnchor('anchor-pose-error');return;}
      if(!pose||pose.emulatedPosition){this.loseAnchor('anchor-pose-unavailable');return;}
      const m=pose.transform.matrix,yaw=Math.atan2(m[8],m[10]);
      if(![m[12],m[13],m[14],yaw].every(Number.isFinite)){this.loseAnchor('anchor-pose-invalid');return;}
      if(this.anchorYawOffset===null)this.anchorYawOffset=r.goalYaw-yaw;
      // Apply the tracked world pose immediately; filtering it would add visible lag
      // against the camera's simultaneous world-origin correction.
      r.goalPosition.set(m[12],m[13],m[14]);this.scene.scenePivot.position.copy(r.goalPosition);
      r.goalYaw=yaw+this.anchorYawOffset;this.scene.scenePivot.quaternion.set(0,Math.sin(r.goalYaw/2),0,Math.cos(r.goalYaw/2));
      if(this.state==='anchor-lost'||this.state==='lost'){
        if(++this.recoveryFrames<5)return;
        this.state='locked';this.scene.visible=true;this.emit({recovered:true});
      }
      if(this.anchorState!=='tracked'){this.anchorState='tracked';this.emit();}
    }else if(this.placed&&this.state==='lost'){
      // A frozen local coordinate is not a recovered native anchor. Require a new hit.
      if(!this.repositionNotice){this.repositionNotice=true;this.emit({needsReposition:true});}return;
    }
    if(this.mode==='real')r.goalScale=1;
    else r.goalScale=Math.max(.25,Math.min(4,r.goalScale));
    this.factor=r.goalScale;
    if(this.placed){
      if(this.fpsTime===null){this.fpsTime=time;this.fpsFrames=0;}else this.fpsFrames++;
      if(time-this.fpsTime>=1000){this.emit({xrCallbackHz:Math.round(this.fpsFrames*10000/(time-this.fpsTime))/10,anchor:this.anchorState});this.fpsFrames=0;this.fpsTime=time;}
    }
  }
  setLocked(locked){
    if(!this.active||!this.placed||!this.poseOK||['lost','anchor-lost'].includes(this.state))return false;
    if(locked){this.pendingLock=true;return true;}
    if(this.gestureSupport!=='available')return false;
    this.invalidateAnchor();this.pendingLock=false;this.locked=false;this.clearGestures();this.anchorState='released';
    this.scene.canScale=this.mode!=='real';this.state='moving';this.emit();return true;
  }
  setFactor(factor){
    if(!this.active||!this.placed||!this.poseOK||['lost','anchor-lost'].includes(this.state)||this.mode==='real'||!Number.isFinite(Number(factor)))return false;
    this.factor=Math.max(.25,Math.min(4,Number(factor)));this.renderer.goalScale=this.factor;this.emit({scaleChanged:true});return true;
  }
  restoreDimensions(){
    if(!this.active||!this.placed||!this.poseOK||['lost','anchor-lost'].includes(this.state))return false;
    this.factor=1;this.renderer.goalScale=1;this.scene.scenePivot.scale.setScalar(1);this.emit({dimensionsRestored:true});return true;
  }
  sourceError(error){this.state='hit-test-unavailable';this.emit({reason:String(error?.name||'hit-test-error')});}
  loseAnchor(reason){this.scene.visible=false;this.recoveryFrames=0;this.anchorState='pose-unavailable';if(this.state!=='anchor-lost'){this.state='anchor-lost';this.emit({reason});}}
  async beginPlacement(reason='user-reposition'){
    if(!this.active)return false;
    const r=this.renderer;this.invalidateAnchor();this.pendingLock=false;this.repositionNotice=false;this.clearGestures();this.placed=false;this.samples=[];this.locked=true;this.scene.canScale=false;this.scene.visible=false;this.anchorState='not-requested';this.state='searching';
    r.initialHitSource?.cancel();r.initialHitSource=null;const token=this.epoch;this.emit({reason});
    try{
      const space=await r.currentSession.requestReferenceSpace('viewer');
      if(token!==this.epoch||r!==this.renderer)return false;
      const source=await r.currentSession.requestHitTestSource({space});
      if(token!==this.epoch||r!==this.renderer){source.cancel();return false;}r.initialHitSource=source;return true;
    }catch(error){if(token===this.epoch&&r===this.renderer)this.sourceError(error);return false;}
  }
}
