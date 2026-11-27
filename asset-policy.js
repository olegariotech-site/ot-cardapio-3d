export const VERSION='0.3.0';
export function assetPath(value,extension){
 if(typeof value!=='string'||!/^\.\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(glb|usdz|webp)$/.test(value)||!value.endsWith(extension))throw Error('Caminho de recurso inválido');
 const url=new URL(value,document.baseURI);if(url.origin!==location.origin)throw Error('Origem de recurso inválida');return url.href;
}
export function validateCatalog(c){
 if(c?.schemaVersion!==2||c.tenantId!=='ot-gastro-lab'||!Array.isArray(c.products)||c.products.length<1||c.products.length>64)throw Error('Catálogo inválido');
 const ids=new Set(),categories=['padaria','lanches','pizzas','pratos','confeitaria','bebidas'];
 for(const p of c.products){
  if(typeof p?.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(p?.id)||ids.has(p.id)||!categories.includes(p.category)||p.status!=='ready')throw Error('Produto inválido');ids.add(p.id);
  for(const k of ['name','description','imageAlt','referenceNote'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>300)throw Error('Texto inválido');
  if(!Number.isInteger(p.priceCents)||p.priceCents<0||p.priceCents>100000||p.physical?.unit!=='meter'||p.physical.upAxis!=='Y'||!Number.isFinite(p.physical.widthM)||p.physical.widthM<.01||p.physical.widthM>1||p.physical.grounded!==true||p.physical.referenceStatus!=='calibrated')throw Error('Referência inválida');
  for(const k of ['heightM','depthM'])if(p.physical[k]!==undefined&&(!Number.isFinite(p.physical[k])||p.physical[k]<=0||p.physical[k]>1))throw Error('Dimensão inválida');
  const licenseURLs={'CC0-1.0':'https://creativecommons.org/publicdomain/zero/1.0/','CC-BY-4.0':'https://creativecommons.org/licenses/by/4.0/','CC-BY-2.0':'https://creativecommons.org/licenses/by/2.0/'};
  if(!Object.hasOwn(licenseURLs,p.license?.spdx)||p.license.url!==licenseURLs[p.license.spdx]||typeof p.license.credit!=='string'||!p.license.credit.trim()||p.license.credit.length>1500)throw Error('Licença inválida');
  const source=new URL(p.license.source);if(source.protocol!=='https:'||source.username||source.password)throw Error('Fonte inválida');
  for(const [key,ext] of [['poster','.webp'],['glb','.glb'],['usdz','.usdz']])assetPath(p.assets?.[key],ext);
 }
 return c;
}
export const currency=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
