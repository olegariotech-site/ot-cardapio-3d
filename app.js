const $ = (id) => document.getElementById(id);
const stage = $('stage');
const loadButton = $('load-model');
const arButton = $('launch-ar');
const status = $('status');
let viewer;
let ready = false;
let loading = false;
let moduleReady = false;
let failedModule = false;
let timeout;
let generation = 0;
let attempts = 0;

function say(message, state = 'normal') {
  status.textContent = message;
  status.dataset.state = state;
}

export function assetPath(value, extension) {
  if (typeof value !== 'string' || !value.startsWith('./assets/') || !value.endsWith(extension) || value.includes('..') || /[?#\\]/.test(value)) throw new Error('Caminho de recurso inválido');
  const url = new URL(value, document.baseURI);
  if (url.origin !== location.origin) throw new Error('Origem de recurso inválida');
  return url.href;
}

export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.tenantId !== 'ot-gastro-lab' || !Array.isArray(catalog.products) || !catalog.products.length || catalog.products.length > 100) throw new Error('Catálogo inválido');
  for (const p of catalog.products) {
    if (!/^[a-z0-9-]+$/.test(p.id) || p.physical?.unit !== 'meter' || p.physical?.upAxis !== 'Y' || p.physical?.widthM <= 0 || !Number.isFinite(p.physical?.widthM) || p.license?.spdx !== 'CC0-1.0') throw new Error('Produto inválido');
    assetPath(p.assets?.glb, '.glb');
    assetPath(p.assets?.usdz, '.usdz');
    assetPath(p.assets?.poster, '.webp');
  }
  return catalog;
}

function updateAR() {
  const supported = ready && window.isSecureContext && viewer?.canActivateAR;
  arButton.disabled = !supported;
  $('ar-help').textContent = !window.isSecureContext
    ? 'A realidade aumentada precisa de uma conexão HTTPS. A visualização 3D continua disponível.'
    : supported
      ? 'Aponte para uma mesa bem iluminada. A câmera será aberta com sua permissão.'
      : 'A realidade aumentada não foi disponibilizada por este navegador. Você pode explorar todos os ângulos em 3D.';
}

function refreshARAvailability(current, remaining = 12) {
  if (current !== generation || !ready) return;
  updateAR();
  // Support detection may settle after the model's load event.
  if (arButton.disabled && remaining > 0) setTimeout(() => refreshARAvailability(current, remaining - 1), 500);
}

function fail(message) {
  generation++;
  clearTimeout(timeout);
  viewer?.remove();
  viewer = undefined;
  loading = false;
  ready = false;
  arButton.disabled = true;
  stage.setAttribute('aria-busy', 'false');
  stage.classList.remove('viewer-ready');
  $('viewer-controls').hidden = true;
  $('start-panel').hidden = false;
  loadButton.disabled = false;
  loadButton.textContent = failedModule ? 'Recarregar a experiência ↗' : 'Tentar novamente ↗';
  say(message, 'error');
}

async function loadModel() {
  if (loading) return;
  if (failedModule) { location.reload(); return; }
  const current = ++generation;
  attempts++;
  loading = true;
  ready = false;
  loadButton.disabled = true;
  loadButton.textContent = 'Preparando o 3D…';
  stage.setAttribute('aria-busy', 'true');
  say('Preparando a experiência. Isso pode levar alguns instantes.');
  try {
    const response = await fetch('./catalog.json', {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Catálogo indisponível');
    const catalog = validateCatalog(await response.json());
    const product = catalog.products.find((item) => item.id === 'croissant');
    if (!product) throw new Error('Produto indisponível');
    if (!moduleReady) {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) {
        fail('Este navegador não disponibilizou os recursos para exibir o 3D. A imagem do alimento continua disponível.');
        return;
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      try { await import('./vendor/model-viewer.min.js'); moduleReady = true; }
      catch (error) { failedModule = true; throw error; }
    }
    await customElements.whenDefined('model-viewer');
    viewer?.remove();
    viewer = document.createElement('model-viewer');
    viewer.id = 'food-viewer';
    const attributes = {
      alt: 'Croissant artesanal em três dimensões. Arraste para girar e use dois dedos para aproximar.',
      'camera-controls': '', ar: '', 'ar-modes': 'webxr scene-viewer quick-look',
      'ar-placement': 'floor', 'ar-scale': 'fixed',
      'ios-src': assetPath(product.assets.usdz, '.usdz'),
      'camera-orbit': '25deg 65deg 0.38m', 'camera-target': '0m 0.03m 0m',
      'min-camera-orbit': 'auto 0deg 0.15m', 'max-camera-orbit': 'auto 180deg 0.7m',
      'shadow-intensity': '1', 'shadow-softness': '0.9', exposure: '1',
      'interaction-prompt': 'auto', 'touch-action': 'pan-y', loading: 'eager', reveal: 'auto',
      'rotation-per-second': '18deg', 'environment-image': 'neutral'
    };
    for (const [key, value] of Object.entries(attributes)) viewer.setAttribute(key, value);
    const nativeButton = document.createElement('span');
    nativeButton.slot = 'ar-button';
    viewer.append(nativeButton);
    viewer.addEventListener('progress', (event) => {
      if (current !== generation) return;
      if (loading && Number.isFinite(event.detail?.totalProgress)) say(`Carregando o alimento: ${Math.round(event.detail.totalProgress * 100)}%.`);
    });
    viewer.addEventListener('load', () => {
      if (current !== generation) return;
      const dimensions = viewer.getDimensions();
      if (!Number.isFinite(dimensions.x) || Math.abs(dimensions.x - product.physical.widthM) > 0.00001 || dimensions.y <= 0 || dimensions.z <= 0) {
        fail('O modelo não pôde ser exibido corretamente. A imagem continua disponível. Tente novamente.');
        return;
      }
      clearTimeout(timeout);
      loading = false;
      ready = true;
      stage.setAttribute('aria-busy', 'false');
      stage.classList.add('viewer-ready');
      $('start-panel').hidden = true;
      $('viewer-controls').hidden = false;
      $('spin').setAttribute('aria-pressed', 'false');
      $('interaction-hint').textContent = 'ARRASTE PARA GIRAR · 360°';
      say('Pronto. Arraste para girar e aproxime para ver a textura.');
      refreshARAvailability(current);
    });
    viewer.addEventListener('error', () => {
      if (current === generation) fail('Não foi possível carregar o 3D. A imagem continua disponível. Você pode tentar novamente.');
    });
    viewer.addEventListener('ar-status', (event) => {
      if (current !== generation) return;
      const state = event.detail.status;
      if (state === 'failed') { say('Não foi possível iniciar a realidade aumentada. Continue no 3D ou tente novamente no navegador do celular.', 'error'); updateAR(); }
      if (state === 'session-started') say('Mova o celular devagar e procure uma superfície horizontal bem iluminada.');
      if (state === 'object-placed') say('Alimento posicionado. Observe de outros ângulos, mantendo a mesa no campo de visão.');
      if (state === 'not-presenting' && ready) { say('Você voltou ao 3D. Pode continuar explorando.'); updateAR(); }
    });
    $('viewer-host').replaceChildren(viewer);
    timeout = setTimeout(() => fail('O carregamento demorou mais que o esperado. Confira sua conexão e tente novamente.'), 45000);
    const modelUrl = new URL(assetPath(product.assets.glb, '.glb'));
    // The viewer caches failed GLB promises. A retry needs a fresh local URL.
    if (attempts > 1) modelUrl.searchParams.set('ot-retry', String(attempts));
    viewer.src = modelUrl.href;
  } catch {
    fail('Não foi possível preparar a experiência. A imagem continua disponível. Tente novamente.');
  }
}

loadButton.addEventListener('click', loadModel);
arButton.addEventListener('click', () => {
  if (!ready || !viewer.canActivateAR || !window.isSecureContext) { updateAR(); return; }
  viewer.autoRotate = false;
  $('spin').setAttribute('aria-pressed', 'false');
  // Invoke in the original click task so WebXR retains user activation.
  viewer.activateAR().catch(() => say('A sessão de realidade aumentada não iniciou. Você pode continuar no 3D.', 'error'));
});
$('rotate').addEventListener('click', () => {
  if (!ready) return;
  const orbit = viewer.getCameraOrbit();
  viewer.cameraOrbit = `${orbit.theta + Math.PI / 2}rad ${orbit.phi}rad ${orbit.radius}m`;
});
$('spin').addEventListener('click', () => {
  if (!ready) return;
  viewer.autoRotate = !viewer.autoRotate;
  $('spin').setAttribute('aria-pressed', String(viewer.autoRotate));
});
$('reset').addEventListener('click', () => {
  if (!ready) return;
  viewer.autoRotate = false;
  viewer.resetTurntableRotation();
  viewer.cameraOrbit = '25deg 65deg 0.38m';
  viewer.cameraTarget = '0m 0.03m 0m';
  $('spin').setAttribute('aria-pressed', 'false');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && viewer) { viewer.autoRotate = false; $('spin').setAttribute('aria-pressed', 'false'); }
});
