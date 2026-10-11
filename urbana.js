/* urbana.js — lógica y datos compartidos de la tienda URBANA */

 aPI = location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

const $ = id => document.getElementById(id);
const money = n => '$' + (+n).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const L = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } };
const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const ADMIN_PW = 'urbana2026'; // ⚠ DEMO: valida esto en el servidor antes de usarlo en producción

const CFG_VERSION = 2;
const PRODUCTOS_BASE = [
 { id: 1, n: "Camisa Casual Oxford", c: "Camisas", p: 45, s: 20, img: "https://images.unsplash.com/photo-1603252109612-24fa03d145c8?auto=format&fit=crop&w=800&h=800&q=80", tallas: ["S","M","L","XL"], modelo: "" },
 { id: 2, n: "Camiseta Essential Blanca", c: "Camisetas", p: 25, s: 30, img: "https://images.unsplash.com/photo-1564859228273-274232fdb516?auto=format&fit=crop&w=800&h=800&q=80", tallas: ["S","M","L","XL"], modelo: "" },
 { id: 3, n: "Pantalón Vaquero Clásico", c: "Pantalones", p: 60, s: 15, img: "", tallas: ["28","30","32","34","36"], modelo: "" },
 { id: 4, n: "Pantalón Cargo Urbano", c: "Pantalones", p: 55, s: 12, img: "", tallas: ["28","30","32","34","36"], modelo: "" },
 { id: 5, n: "Zapatilla Serie 500", c: "Calzado", p: 120, s: 8, img: "https://images.unsplash.com/photo-1615743472612-93b21e520fad?auto=format&fit=crop&w=800&h=800&q=80", tallas: ["38","39","40","41","42","43","44"], modelo: "" },
];
const CFG_BASE = {
 color: '#ce1126', fondo: '#08090c', texto: '#f2f4f7', bloques: '#131a24', heroImg: '',
 banner: 'Las Serie 500', sub: 'Diseño superior tejido y ligero que mejora la ventilación en tu día a día.',
 promo: 'ENVÍOS GRATIS EN PEDIDOS SUPERIORES A $150.00', wa: '', tarifa: 5, codigo: 'SOCIO10',
 datos: 'TRANSFERENCIA\nBanco: [Banco]\nCuenta: [0000-0000-00-0000000000]\nTitular: [Nombre] · CI/RIF: [V-00000000]\n\nPAGO MÓVIL\nBanco: [Banco] · Tel: [0414-0000000] · CI: [V-00000000]'
};
const PALETAS = [
 ['Escarlata', '#ce1126', '#08090c', '#f2f4f7', '#131a24'],
 ['Técnico', '#39ff8f', '#08090c', '#f2f4f7', '#131a24'],
 ['Glaciar', '#4fb0ff', '#08090c', '#f2f4f7', '#131a24'],
 ['Esmeralda', '#2fd08a', '#08090c', '#f2f4f7', '#131a24'],
 ['Ámbar', '#f5a623', '#08090c', '#f2f4f7', '#131a24'],
 ['Violeta', '#a78bfa', '#08090c', '#f2f4f7', '#131a24'],
];
const ICONS = {
 1: '<path d="M35 15 12 27l8 16 10-5v47h40V38l10 5 8-16L65 15q-15 10-30 0z" fill="#d6e4f2" stroke="#8aa4bd"/><path d="M50 26v58M35 15l15 12 15-12" stroke="#8aa4bd" fill="none"/>',
 2: '<path d="M35 15 12 27l8 16 10-5v47h40V38l10 5 8-16L65 15q-15 10-30 0z" fill="#e8e8e8" stroke="#9a9a9a"/>',
 3: '<path d="M32 12h36l7 80H54L50 42 46 92H25z" fill="#2f4b73"/><path d="M32 20h36M50 20v22" stroke="#9db4d3" fill="none"/>',
 4: '<path d="M32 12h36l7 80H54L50 42 46 92H25z" fill="#6b705c"/><path d="M29 55h11v15H29zM60 55h11v15H60z" fill="#565a49"/>',
 5: '<path d="M8 62C8 52 12 46 20 44L30 30l10 8 18 6c18 2 32 10 36 18z" fill="#e8e8e8" stroke="#9a9a9a"/><path d="M6 62h90v10q0 4-5 4H11q-5 0-5-4z" fill="#fff" stroke="#9a9a9a"/><path d="M24 55q30 4 60 0" stroke="#ce1126" stroke-width="3" fill="none"/>',
 def: '<path d="M26 36h48l5 52H21z" fill="#3a3f47"/><path d="M38 36c0-18 24-18 24 0" stroke="#6a6f77" stroke-width="5" fill="none"/>'
};

function backfillFotos(lista) {
 return lista.map(p => {
  const base = PRODUCTOS_BASE.find(b => b.id === p.id);
  let out = p;
  if (base) {
   if (!out.img && base.img) out = { ...out, img: base.img };
   if (!out.tallas && base.tallas) out = { ...out, tallas: base.tallas };
  }
  if (out.modelo === undefined) out = { ...out, modelo: '' };
  return out;
 });
}

let PRODUCTOS = backfillFotos(L('urbana_productos', PRODUCTOS_BASE));
const cfgLocal = L('urbana_cfg', {});
let CFG = (Number(cfgLocal._v) === CFG_VERSION) ? { ...CFG_BASE, ...cfgLocal } : { ...CFG_BASE, _v: CFG_VERSION };
let CARRITO = L('urbana_carrito', []);
let USERS = L('urbana_users', []);
let ONLINE = false;
let renderActual = () => {};

async function cargarDatos() {
 try {
  const [p, c] = await Promise.all([
   fetch(API + '/productos').then(r => r.json()),
   fetch(API + '/config').then(r => r.json())
  ]);
  PRODUCTOS = backfillFotos(p.map(x => ({ ...x, tallas: x.tallas ? JSON.parse(x.tallas) : null })));
  CFG = (Number(c._v) === CFG_VERSION) ? { ...CFG_BASE, ...c } : { ...CFG_BASE, _v: CFG_VERSION };
  ONLINE = true;
 } catch (e) { ONLINE = false; }
 S('urbana_productos', PRODUCTOS); S('urbana_cfg', CFG);
 tema();
}

function tema() {
 const a = CFG.color, f = CFG.fondo, t = CFG.texto, b = CFG.bloques,
  ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16),
  x = (ar * 299 + ag * 587 + ab * 114) / 1000 > 160 ? '#111' : '#fff',
  root = document.documentElement.style;
 root.setProperty('--r', a); root.setProperty('--r-rgb', `${ar},${ag},${ab}`);
 root.setProperty('--bg', f); root.setProperty('--bg2', b); root.setProperty('--fg', t);
 root.setProperty('--muted', t + '99'); root.setProperty('--line', t + '1a');
 const s = $('temaCss') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'temaCss' }));
 s.textContent = `
  .btn:not(.k){color:${x}}
  .btn:not(.k):not(:disabled):hover{background:${t};border-color:${t};color:${f}}
  .k{background:${t};border-color:${t};color:${f}}
  .k:hover{background:var(--r);border-color:var(--r);color:${x}}
  body.editing [contenteditable="true"]{outline:2px dashed var(--r);outline-offset:2px;background:${a}12}`;
}

function toast(msg) {
 let t = $('toast');
 if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
 t.textContent = msg; t.classList.add('on');
 clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1600);
}

async function guardarProductos() {
 S('urbana_productos', PRODUCTOS);
 if (ONLINE) try { await fetch(API + '/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PRODUCTOS) }); } catch (e) {}
 toast('Guardado ✓');
}
async function guardarCfg() {
 CFG._v = CFG_VERSION; S('urbana_cfg', CFG);
 if (ONLINE) try { await fetch(API + '/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CFG) }); } catch (e) {}
 tema(); toast('Guardado ✓');
}

const getSession = () => L('urbana_sesion', null);
const isAdmin = () => getSession()?.rol === 'admin';
const isClient = () => getSession()?.rol === 'cliente';
function logout() { localStorage.removeItem('urbana_sesion'); localStorage.removeItem('urbana_editando'); location.href = 'pagina web inicio.html'; }
const miUsuario = () => { const s = getSession(); return s?.rol === 'cliente' ? USERS.find(u => u.email === s.email) : null; };
const esSocio = () => !!miUsuario()?.socio;

function pintarNav() {
 const el = $('navCuenta'); if (!el) return;
 const s = getSession();
 el.href = s?.rol === 'cliente' ? 'mi-cuenta.html' : 'login.html';
 el.textContent = s?.rol === 'cliente' ? 'Hola, ' + s.nombre.split(' ')[0] : 'Mi cuenta';
}
function pintarCartBadge() { const el = $('cartCount'); if (el) el.textContent = CARRITO.reduce((a, x) => a + x.q, 0); }

function addCarrito(id, talla = null) {
 const p = PRODUCTOS.find(x => x.id === id); if (!p || p.s <= 0) return;
 const it = CARRITO.find(x => x.id === id && x.talla === talla);
 if (it) { if (it.q >= p.s) return toast('No hay más stock'); it.q++; }
 else CARRITO.push({ id: p.id, n: p.n, p: p.p, q: 1, talla });
 S('urbana_carrito', CARRITO);
}
function totalCarrito() { const sub = CARRITO.reduce((a, x) => a + x.p * x.q, 0), d = esSocio() ? sub * .1 : 0; return { sub, d, total: sub - d }; }

// Sube cualquier archivo (foto o modelo .glb) a un endpoint del servidor y avisa cuando termina.
function wireSubidaArchivo(input, endpoint, onPreview, onUploaded) {
 if (!input) return;
 input.onchange = async () => {
  const file = input.files[0]; if (!file) return;
  if (onPreview) onPreview(URL.createObjectURL(file));
  if (!ONLINE) return toast('Enciende server.py para guardar el archivo');
  const fd = new FormData(); fd.append('archivo', file);
  try {
   const r = await fetch(API + endpoint, { method: 'POST', body: fd });
   const data = await r.json();
   if (data.url) onUploaded(API + data.url); else toast(data.error || 'No se pudo subir el archivo');
  } catch (e) { toast('No se pudo subir el archivo'); }
 };
}
function wireSubidaImagen(input, onPreview, onUploaded) { wireSubidaArchivo(input, '/subir-imagen', onPreview, onUploaded); }
function wireSubidaModelo(input, onPreview, onUploaded) { wireSubidaArchivo(input, '/subir-modelo', onPreview, onUploaded); }

function tileHTML(p) {
 const socio = esSocio();
 const tallas = p.tallas && p.tallas.length ? `<div class="tallas">${p.tallas.map(t => `<button type="button" class="talla" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '';
 const visual = p.modelo
  ? `<model-viewer src="${esc(p.modelo)}" ${p.img ? `poster="${esc(p.img)}"` : ''} camera-controls auto-rotate shadow-intensity="0"
      exposure="1" environment-image="neutral" loading="lazy" style="width:100%;height:100%;background-color:transparent"></model-viewer>`
  : (p.img ? `<img src="${esc(p.img)}" alt="" onerror="this.remove()">` : `<svg viewBox="0 0 100 100">${ICONS[p.id] || ICONS.def}</svg>`);
 return `<article class="prod glow" data-id="${p.id}">
  <div class="tile">${visual}</div>
  <label class="imgupload"><input type="file" accept="image/*" class="imgfile" hidden>📷 Cambiar foto</label>
  <label class="imgupload"><input type="file" accept=".glb,.gltf" class="modelfile" hidden>📦 Cambiar modelo 3D</label>
  <small class="cat" spellcheck="false">${esc(p.c)}</small>
  <h3 class="nom" spellcheck="false">${esc(p.n)}</h3>
  <p class="precio">${socio ? `<s class="precio-tachado">${money(p.p)}</s> <b class="precio-socio">${money(p.p * 0.9)}</b>` : `$<span class="pre" spellcheck="false">${(+p.p).toFixed(2)}</span>`}</p>
  <small class="stock-tag"><span class="sto" spellcheck="false">${p.s}</span> ${p.s === 1 ? 'unidad' : 'unidades'} disponibles</small>
  ${tallas}
  <button class="btn add" ${p.s > 0 ? '' : 'disabled'}>${p.s > 0 ? 'Añadir 🛒' : 'Agotado'}</button>
  <button class="del" title="Quitar del catálogo">✕</button>
 </article>`;
}
function nodoAgregarHTML() { return `<button class="add-tile" id="btnNuevoProd">+ Añadir<br>producto</button>`; }

function wireGrid(container) {
 container.querySelectorAll('article.prod').forEach(art => {
  const id = +art.dataset.id, p = PRODUCTOS.find(x => x.id === id); if (!p) return;
  art.querySelectorAll('.talla').forEach(b => b.onclick = () => { art.querySelectorAll('.talla').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  art.querySelector('.add').onclick = () => {
   let talla = null;
   if (p.tallas && p.tallas.length) {
    const sel = art.querySelector('.talla.on'); if (!sel) return toast('Elige una talla'); talla = sel.dataset.t;
   }
   addCarrito(id, talla); document.dispatchEvent(new Event('urbana:carrito')); toast('Añadido al carrito');
  };
  art.querySelector('.del').onclick = () => {
   if (!confirm(`¿Quitar "${p.n}" del catálogo?`)) return;
   PRODUCTOS = PRODUCTOS.filter(x => x.id !== id); guardarProductos(); renderActual();
  };
  wireSubidaImagen(art.querySelector('.imgfile'),
   url => { if (!p.modelo) art.querySelector('.tile').innerHTML = `<img src="${url}" alt="">`; },
   url => { p.img = url; guardarProductos(); });
  wireSubidaModelo(art.querySelector('.modelfile'),
   () => {}, // el modelo tarda en cargar; se ve al terminar de subir, no antes
   url => {
    art.querySelector('.tile').innerHTML = `<model-viewer src="${url}" camera-controls auto-rotate shadow-intensity="0" exposure="1" environment-image="neutral" style="width:100%;height:100%;background-color:transparent"></model-viewer>`;
    p.modelo = url; guardarProductos();
   });
  const fav = art.querySelector('.fav'), u = miUsuario();
  if (u) {
   fav.textContent = (u.favoritos || []).includes(id) ? '❤️' : '🤍';
   fav.onclick = () => {
    u.favoritos = u.favoritos || [];
    const i = u.favoritos.indexOf(id);
    if (i === -1) { u.favoritos.push(id); fav.textContent = '❤️'; } else { u.favoritos.splice(i, 1); fav.textContent = '🤍'; }
    S('urbana_users', USERS);
   };
  }
  const nom = art.querySelector('.nom'), cat = art.querySelector('.cat'), pre = art.querySelector('.pre'), sto = art.querySelector('.sto');
  nom.onblur = () => { p.n = nom.textContent.trim() || p.n; nom.textContent = p.n; guardarProductos(); };
  cat.onblur = () => { p.c = cat.textContent.trim(); guardarProductos(); };
  if (pre) pre.onblur = () => { const v = parseFloat(pre.textContent.replace(',', '.')); if (!isNaN(v) && v >= 0) { p.p = v; pre.textContent = v.toFixed(2); guardarProductos(); } else pre.textContent = (+p.p).toFixed(2); };
  sto.onblur = () => {
   const v = parseInt(sto.textContent);
   if (!isNaN(v) && v >= 0) { p.s = v; sto.textContent = v; guardarProductos(); const btn = art.querySelector('.add'); btn.disabled = v <= 0; btn.textContent = v > 0 ? 'Añadir 🛒' : 'Agotado'; }
   else sto.textContent = p.s;
  };
 });
 const btnN = container.querySelector('#btnNuevoProd');
 if (btnN) btnN.onclick = () => { PRODUCTOS.push({ id: Date.now(), n: 'Nuevo producto', c: 'Categoría', p: 10, s: 10, img: '', modelo: '' }); guardarProductos(); renderActual(); };
 aplicarEdicionProductos(container);
}
function aplicarEdicionProductos(container) {
 const on = isAdmin() && document.body.classList.contains('editing');
 container.querySelectorAll('.nom,.cat,.pre,.sto').forEach(el => el.contentEditable = on);
}
function aplicarEdicion() {
 const on = document.body.classList.contains('editing');
 document.querySelectorAll('[data-edit]').forEach(el => {
  el.contentEditable = on;
  if (!el._wired) {
   el._wired = true;
   el.addEventListener('blur', () => {
    const v = el.textContent.trim();
    if (v) { CFG[el.dataset.edit] = v; guardarCfg(); } else el.textContent = CFG[el.dataset.edit]; // nunca guarda vacío por accidente
   });
  }
 });
}

function initAdminBar() {
 const bar = document.createElement('div'); bar.className = 'adminbar';
 bar.innerHTML = `<label class="pill"><input type="checkbox" id="chkEdit"> ✏️ Modo edición</label>
  <button id="btnAjustes" class="pill">⚙️ Ajustes</button><button id="btnPedidos" class="pill">🛒 Pedidos</button><button id="btnSalirAdmin" class="pill">Salir</button>`;
 document.body.appendChild(bar);
 $('chkEdit').checked = document.body.classList.contains('editing');
 $('chkEdit').onchange = e => { S('urbana_editando', e.target.checked); document.body.classList.toggle('editing', e.target.checked); renderActual(); aplicarEdicion(); };
 $('btnAjustes').onclick = panelAjustes; $('btnPedidos').onclick = panelPedidos; $('btnSalirAdmin').onclick = logout;
}

function panelAjustes() {
 let p = $('popAjustes'); if (p) { p.classList.toggle('on'); return; }
 p = document.createElement('div'); p.id = 'popAjustes'; p.className = 'popover on';
 p.innerHTML = `<h4>Ajustes de la tienda</h4>
  <div class="paletas">${PALETAS.map((x, i) => `<button class="sw" data-i="${i}"><i style="background:${x[1]}"></i>${x[0]}</button>`).join('')}</div>
  <label>Color de acento<input id="acColor" type="color" value="${CFG.color}"></label>
  <label>Fondo<input id="acFondo" type="color" value="${CFG.fondo}"></label>
  <label>Texto<input id="acTexto" type="color" value="${CFG.texto}"></label>
  <label>Superficies (tarjetas)<input id="acBloques" type="color" value="${CFG.bloques}"></label>
  <label>WhatsApp (código país, sin +)<input id="acWa" value="${esc(CFG.wa)}" placeholder="584120000000"></label>
  <label>Tarifa mensual $<input id="acTarifa" type="number" value="${+CFG.tarifa}"></label>
  <label>Código de membresía<input id="acCodigo" value="${esc(CFG.codigo)}"></label>
  <label>Datos bancarios / Pago Móvil<textarea id="acDatos" rows="4">${esc(CFG.datos)}</textarea></label>
  <button class="btn k" id="acGuardar" style="width:100%;margin-top:10px">Guardar</button>
  <button class="btn s" id="acReset" style="width:100%;margin-top:8px;background:none;color:#ff6b6b;border-color:#ff6b6b">Restablecer datos de fábrica</button>`;
 document.body.appendChild(p);
 p.querySelectorAll('.sw').forEach(b => b.onclick = () => {
  const x = PALETAS[+b.dataset.i]; CFG = { ...CFG, color: x[1], fondo: x[2], texto: x[3], bloques: x[4] }; tema();
  $('acColor').value = x[1]; $('acFondo').value = x[2]; $('acTexto').value = x[3]; $('acBloques').value = x[4];
 });
 ['Color', 'Fondo', 'Texto', 'Bloques'].forEach(k => $('ac' + k).oninput = () => { CFG = { ...CFG, [k.toLowerCase()]: $('ac' + k).value }; tema(); });
 $('acGuardar').onclick = () => {
  CFG = { ...CFG, wa: $('acWa').value.replace(/\D/g, ''), tarifa: +$('acTarifa').value || 5, codigo: $('acCodigo').value || 'SOCIO10', datos: $('acDatos').value.trim() || CFG_BASE.datos };
  guardarCfg(); p.classList.remove('on');
 };
 $('acReset').onclick = async () => {
  if (!confirm('Esto borra los productos y colores actuales y vuelve a los valores de fábrica. ¿Continuar?')) return;
  if (ONLINE) try { await fetch(API + '/restablecer', { method: 'POST' }); } catch (e) {}
  localStorage.removeItem('urbana_productos'); localStorage.removeItem('urbana_cfg'); location.reload();
 };
}

async function panelPedidos() {
 let p = $('popPedidos');
 if (!p) { p = document.createElement('div'); p.id = 'popPedidos'; p.className = 'popover wide'; document.body.appendChild(p); }
 p.classList.toggle('on'); if (p.classList.contains('on')) await cargarPedidos(p);
}
async function cargarPedidos(p) {
 p = p || $('popPedidos'); if (!p) return;
 let O = []; try { O = await (await fetch(API + '/pedidos')).json(); } catch (e) {}
 const ok = O.filter(x => x.estado === 'confirmado'), ing = ok.reduce((a, x) => a + x.total, 0);
 p.innerHTML = `<h4>Pedidos</h4>
  <div class="kpis-mini"><div><b>${ok.length}</b>Confirmados</div><div><b>${O.length - ok.length}</b>Pendientes</div>
   <div><b>${money(ing)}</b>Ingresos</div><div><b>${PRODUCTOS.filter(x => x.s <= 5).length}</b>Stock bajo</div></div>
  <div class="lista-pedidos">${O.filter(x => x.estado === 'pendiente').map(x => `
   <div class="fila-pedido"><b>${esc(x.cliente)}</b><br><small>${esc(x.productos)} · ${money(x.total)}</small><br>
   <button class="btn s" data-id="${x.id}">Confirmar pago</button></div>`).join('') || '<p><small>Sin pedidos pendientes</small></p>'}</div>`;
 p.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
  const r = await fetch(API + '/confirmar-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: +b.dataset.id }) }).catch(() => 0);
  if (!r || !r.ok) return alert('No se pudo confirmar (¿Excel abierto? ¿servidor encendido?)');
  const o = O.find(x => x.id === +b.dataset.id);
  JSON.parse(o.items || '[]').forEach(i => { const pr = PRODUCTOS.find(z => z.id === i.id); if (pr) pr.s = Math.max(0, pr.s - i.q); });
  await guardarProductos(); cargarPedidos(p);
 });
}

async function iniciarPagina(renderFn) {
 await cargarDatos();
 pintarNav(); pintarCartBadge();
 document.addEventListener('urbana:carrito', pintarCartBadge);
 document.addEventListener('mousemove', e => {
  const el = e.target.closest('.glow'); if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
 });
 if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  addEventListener('scroll', () => { const hb = document.querySelector('.hero-bg'); if (hb) hb.style.transform = `translateY(${scrollY * 0.25}px)`; }, { passive: true });
 }
 if (isAdmin()) document.body.classList.add('is-admin');
 if (isClient()) document.body.classList.add('is-client');
 if (isAdmin() && L('urbana_editando', false)) document.body.classList.add('editing');
 renderActual = renderFn || (() => {});
 renderActual();
 if (typeof AOS !== 'undefined') AOS.init({ duration: 700, once: true, offset: 60 });
 if (isAdmin()) { aplicarEdicion(); initAdminBar(); }
}