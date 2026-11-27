import {validateCatalog,currency,VERSION} from './asset-policy.js?v=0.3.0';
import {createExperience} from './experience.js?v=0.3.0';
const $=id=>document.getElementById(id),dialog=$('experience');
let catalog,selectedIndex=0,opener;
const categoryNames={padaria:'Padaria',lanches:'Lanches',pizzas:'Pizzas',pratos:'Pratos',confeitaria:'Confeitaria',bebidas:'Bebidas'};
const controller=createExperience(locked=>{for(const id of ['close-product','previous-product','next-product'])$(id).disabled=locked;});
function rowsMatch(products){return [...document.querySelectorAll('.menu-item')].map(x=>x.dataset.product).join(',')===products.map(p=>p.id).join(',');}
function bindProducts(){
 for(const a of document.querySelectorAll("[data-open-image]"))a.addEventListener("click",e=>{e.preventDefault();opener=a;openProduct(catalog.products.findIndex(p=>p.id===a.dataset.openImage),e);});
 for(const button of document.querySelectorAll('[data-open-product]')){button.disabled=false;button.addEventListener('click',e=>{opener=button;openProduct(catalog.products.findIndex(p=>p.id===button.dataset.openProduct),e);});}
}
function openProduct(index,event){
 if(!catalog||!controller.canLeave())return;selectedIndex=(index+catalog.products.length)%catalog.products.length;const p=catalog.products[selectedIndex];
 $('product-title').textContent=p.name;$('product-price').textContent=currency(p.priceCents);$('product-category').textContent=categoryNames[p.category];
 $('product-dimension').replaceChildren(document.createTextNode(`${Math.round(p.physical.widthM*100)} cm`),Object.assign(document.createElement('span'),{textContent:p.status==='ready'?'largura de referência':'referência planejada'}));
 $('poster').src=p.assets.poster;$('poster').alt=p.imageAlt;$('product-description').textContent=p.description;$('reference-note').textContent=p.referenceNote;
 $('product-credit').textContent=p.license.credit;$('product-source').href=p.license.source;$('product-license').href=p.license.url;
 $('product-counter').textContent=`${selectedIndex+1} / ${catalog.products.length}`;
 $('previous-product').setAttribute('aria-label','Produto anterior: '+catalog.products[(selectedIndex+catalog.products.length-1)%catalog.products.length].name);
 $('next-product').setAttribute('aria-label','Próximo produto: '+catalog.products[(selectedIndex+1)%catalog.products.length].name);
 if(!dialog.open){dialog.showModal();document.body.classList.add('dialog-open');}
 dialog.scrollTop=0;controller.selectProduct(p,event);$('close-product').focus({preventScroll:true});
}
function closeProduct(){if(!controller.canLeave())return;controller.dispose();dialog.close();document.body.classList.remove('dialog-open');opener?.focus({preventScroll:true});}
$('close-product').addEventListener('click',closeProduct);dialog.addEventListener('cancel',e=>{e.preventDefault();closeProduct();});
$('previous-product').addEventListener('click',e=>openProduct(selectedIndex-1,e));$('next-product').addEventListener('click',e=>openProduct(selectedIndex+1,e));
for(const button of document.querySelectorAll('button[data-category]'))button.addEventListener('click',()=>{
 const category=button.dataset.category;for(const other of document.querySelectorAll('button[data-category]'))other.setAttribute('aria-pressed',String(other===button));let visible=0;
 for(const row of document.querySelectorAll('.menu-item')){row.hidden=category!=='all'&&row.dataset.category!==category;if(!row.hidden)visible++;}
 $('filter-status').textContent=`${visible} ${visible===1?'produto disponível':'produtos disponíveis'} nesta categoria.`;
});
try{
 const response=await fetch(`./catalog.json?v=${VERSION}`,{cache:'no-cache'});if(!response.ok)throw Error('catalog-download');catalog=validateCatalog(await response.json());
 if(!rowsMatch(catalog.products))throw Error('catalog-html-mismatch');bindProducts();$('catalog-status').textContent='';
}catch{ $('catalog-status').textContent='Não foi possível preparar o 3D. As imagens e informações continuam disponíveis. Recarregue a página para tentar novamente.';}
