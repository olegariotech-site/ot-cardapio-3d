export const VERSION='0.2.0';
const IDS=['croissant','hamburguer','pizza-margherita','prato-executivo'];
export function assetPath(value,extension){
 if(typeof value!=='string'||!value.startsWith('./assets/')||!value.endsWith(extension)||value.includes('..')||/[?#\\\x00-\x20]/.test(value))throw Error('Caminho de recurso inválido');
 const url=new URL(value,document.baseURI);if(url.origin!==location.origin)throw Error('Origem de recurso inválida');return url.href;
}
export function validateCatalog(c){
 if(c?.schemaVersion!==2||c.tenantId!=='ot-gastro-lab'||!Array.isArray(c.products)||c.products.length!==4)throw Error('Catálogo inválido');
 const ids=new Set();
 for(const p of c.products){
  if(!IDS.includes(p.id)||ids.has(p.id)||!['padaria','lanches','pizzas','pratos'].includes(p.category)||!['ready','photo-only'].includes(p.status))throw Error('Produto inválido');ids.add(p.id);
  for(const k of ['name','description','imageAlt','referenceNote'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>300)throw Error('Texto inválido');
  if(!Number.isInteger(p.priceCents)||p.priceCents<0||p.priceCents>100000||p.physical?.unit!=='meter'||p.physical.upAxis!=='Y'||!Number.isFinite(p.physical.widthM)||p.physical.widthM<.01||p.physical.widthM>1)throw Error('Referência inválida');
  if(!['CC0-1.0','CC-BY-4.0','CC-BY-2.0'].includes(p.license?.spdx)||!/^https:\/\//.test(p.license?.source??'')||typeof p.license?.credit!=='string')throw Error('Licença inválida');
  const licenseURLs={'CC0-1.0':'https://creativecommons.org/publicdomain/zero/1.0/','CC-BY-4.0':'https://creativecommons.org/licenses/by/4.0/','CC-BY-2.0':'https://creativecommons.org/licenses/by/2.0/'};
  if(p.license.url!==licenseURLs[p.license.spdx])throw Error('URL de licença inválida');
  const source=new URL(p.license.source);if(source.protocol!=='https:'||source.username||source.password)throw Error('Fonte inválida');
  if(p.physical.referenceStatus!==(p.status==='ready'?'calibrated':'planned'))throw Error('Estado da referência inválido');
  assetPath(p.assets?.poster,'.webp');
  if(p.status==='ready'){assetPath(p.assets?.glb,'.glb');assetPath(p.assets?.usdz,'.usdz');}
  else if(p.assets?.glb||p.assets?.usdz)throw Error('Modelo indisponível não deve ter URL de AR');
 }
 return c;
}
export const currency=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
