/* Painel administrativo: roteador e telas */
(async function () {
  'use strict';
  const { esc, $, $$, toast, modal, confirmDialog, brl, readImage, fmtDate, fmtDateTime } = window.UI;
  const DB = window.DB;

  const sess = await DB.auth.current();
  if (!sess) { location.replace('index.html'); return; }
  $('#userEmail').textContent = sess.email;
  $('#logout').onclick = async () => { await DB.auth.logout(); location.replace('index.html'); };

  const view = $('#view');
  const ST = DB.STATUSES;
  const stLabel = DB.util.statusLabel, stTone = DB.util.statusTone;

  const NAV = [
    ['dashboard', '📊', 'Dashboard'], ['produtos', '🧁', 'Produtos'], ['categorias', '🏷️', 'Categorias'],
    ['estoque', '📦', 'Estoque'], ['bolos', '🎂', 'Bolos'], ['pedidos', '🧾', 'Pedidos'], ['config', '⚙️', 'Configurações']
  ];
  const ROUTES = { dashboard: pDashboard, produtos: pProducts, categorias: pCategories, estoque: pStock, bolos: pCakes, pedidos: pOrders, config: pConfig };

  const fail = (e) => toast(e && e.message ? e.message : 'Algo deu errado.', { type: 'error', ms: 5000 });
  const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
  const thumb = (p) => (p.images && p.images[0] ? '<img class="thumb" src="' + esc(p.images[0]) + '" alt="">' : '<div class="thumb ph" style="--h:' + (p.hue || 340) + '"><span>' + esc(p.emoji || '🧁') + '</span></div>');
  const stockBadge = (p) => {
    const s = DB.util.stockStatus(p);
    return s === 'out' ? '<span class="badge danger">Esgotado</span>' : s === 'low' ? '<span class="badge warn">Estoque baixo</span>' : '<span class="badge ok">Em estoque</span>';
  };
  const stBadge = (id) => '<span class="badge ' + stTone(id) + '">' + esc(stLabel(id)) + '</span>';
  const sw = (attr, on) => '<label class="switch"><input type="checkbox" ' + attr + (on ? ' checked' : '') + '><span></span></label>';

  /* ---------- roteador ---------- */
  let current = 'dashboard';
  async function render(keepScroll) {
    const key = location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard';
    current = ROUTES[key] ? key : 'dashboard';
    const orders = await DB.orders.list();
    const novos = orders.filter((o) => o.status === 'novo').length;
    $('#nav').innerHTML = NAV.map((n) => '<a href="#/' + n[0] + '" class="' + (n[0] === current ? 'on' : '') + '"><span aria-hidden="true">' + n[1] + '</span>' + n[2] + (n[0] === 'pedidos' && novos ? '<span class="n">' + novos + '</span>' : '') + '</a>').join('');
    $('#pageTitle').textContent = NAV.find((n) => n[0] === current)[2];
    document.title = $('#pageTitle').textContent + ' · Painel';
    const s = await DB.settings.get(); $('#brandName').textContent = s.storeName || 'Painel';
    $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
    try { await ROUTES[current](); } catch (e) { fail(e); }
    if (!keepScroll) window.scrollTo(0, 0);
  }
  const refresh = () => render(true);
  window.addEventListener('hashchange', () => render(false));
  $('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); };
  $('#scrim').onclick = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); };
  DB.onChange(() => { if (!document.querySelector('.modal-back')) refresh(); });

  /* ================= DASHBOARD ================= */
  async function pDashboard() {
    const [products, orders, cats] = await Promise.all([DB.products.list(), DB.orders.list(), DB.categories.list()]);
    const avail = products.filter(DB.util.isSellable).length;
    const out = products.filter((p) => p.stock <= 0);
    const low = products.filter((p) => DB.util.stockStatus(p) === 'low');
    const valid = orders.filter((o) => o.status !== 'cancelado');
    const revenue = valid.reduce((n, o) => n + o.total, 0);
    const top = {};
    valid.forEach((o) => o.items.forEach((i) => { const k = i.name; top[k] = (top[k] || 0) + i.qty; }));
    const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTop = topList.length ? topList[0][1] : 1;
    const maxSt = Math.max(1, ...ST.map((s) => orders.filter((o) => o.status === s.id).length));
    view.innerHTML =
      '<div class="stats">' +
      '<div class="stat"><span>Produtos cadastrados</span><strong>' + products.length + '</strong></div>' +
      '<div class="stat ok"><span>Disponíveis para venda</span><strong>' + avail + '</strong></div>' +
      '<div class="stat danger"><span>Sem estoque</span><strong>' + out.length + '</strong></div>' +
      '<div class="stat warn"><span>Estoque baixo</span><strong>' + low.length + '</strong></div>' +
      '<div class="stat"><span>Categorias</span><strong>' + cats.length + '</strong></div></div>' +
      '<div class="stats">' +
      '<div class="stat"><span>Pedidos no total</span><strong>' + orders.length + '</strong></div>' +
      '<div class="stat warn"><span>Aguardando atendimento</span><strong>' + orders.filter((o) => o.status === 'novo').length + '</strong></div>' +
      '<div class="stat"><span>Faturamento (sem cancelados)</span><strong>' + brl(revenue) + '</strong></div>' +
      '<div class="stat"><span>Ticket médio</span><strong>' + brl(valid.length ? revenue / valid.length : 0) + '</strong></div></div>' +
      '<div class="cols"><div class="card"><div class="page-bar"><h2 class="grow">Pedidos recentes</h2><a class="btn btn-ghost btn-sm" href="#/pedidos">Ver todos</a></div>' +
      (orders.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nº</th><th>Cliente</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>' +
        orders.slice(0, 5).map((o) => '<tr class="row-click" data-order="' + o.id + '"><td>#' + o.number + '</td><td>' + esc(o.customer.name) + '<br><small class="muted">' + fmtDateTime(o.createdAt) + '</small></td><td>' + stBadge(o.status) + '</td><td class="num">' + brl(o.total) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Nenhum pedido ainda.</p>') + '</div>' +
      '<div class="card"><h2>Pedidos por status</h2><div class="bars">' + ST.map((s) => { const n = orders.filter((o) => o.status === s.id).length; return '<div class="bar-row ' + s.tone + '"><span>' + s.label + '</span><i><b style="width:' + (n / maxSt * 100) + '%"></b></i><span>' + n + '</span></div>'; }).join('') + '</div></div></div>' +
      '<div class="cols"><div class="card"><div class="page-bar"><h2 class="grow">Alertas de estoque</h2><a class="btn btn-ghost btn-sm" href="#/estoque">Gerenciar</a></div>' +
      (out.length + low.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + [...out, ...low].map((p) => '<tr><td><div class="cell-prod">' + thumb(p) + '<div><b>' + esc(p.name) + '</b><small>mínimo ' + p.minStock + '</small></div></div></td><td class="num">' + p.stock + ' un.</td><td>' + stockBadge(p) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Tudo certo: nenhum produto com estoque baixo.</p>') + '</div>' +
      '<div class="card"><h2>Mais vendidos</h2>' + (topList.length ? '<div class="bars">' + topList.map((t) => '<div class="bar-row" style="grid-template-columns:130px 1fr 28px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(t[0]) + '">' + esc(t[0]) + '</span><i><b style="width:' + (t[1] / maxTop * 100) + '%"></b></i><span>' + t[1] + '</span></div>').join('') + '</div>' : '<p class="muted">Sem vendas registradas.</p>') + '</div></div>';
    $$('[data-order]').forEach((r) => r.onclick = () => { location.hash = '#/pedidos'; setTimeout(() => openOrder(r.dataset.order), 50); });
  }

  /* ================= PRODUTOS ================= */
  const pf = { q: '', cat: '', st: '' };
  async function pProducts() {
    const [products, cats] = await Promise.all([DB.products.list(), DB.categories.list()]);
    const catName = (id) => (cats.find((c) => c.id === id) || {}).name || 'Sem categoria';
    const list = products.filter((p) => {
      if (pf.q && !(p.name + ' ' + p.description).toLowerCase().includes(pf.q.toLowerCase())) return false;
      if (pf.cat && (pf.cat === '_none' ? p.categoryId : p.categoryId !== pf.cat)) return false;
      if (pf.st === 'avail' && !DB.util.isSellable(p)) return false;
      if (pf.st === 'out' && p.stock > 0) return false;
      if (pf.st === 'off' && p.available) return false;
      if (pf.st === 'feat' && !p.featured) return false;
      return true;
    });
    view.innerHTML =
      '<div class="page-bar"><input type="search" id="fq" class="grow" placeholder="Buscar produto…" aria-label="Buscar produto" value="' + esc(pf.q) + '">' +
      '<select id="fcat" aria-label="Categoria"><option value="">Todas as categorias</option>' + cats.map((c) => '<option value="' + c.id + '"' + (pf.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '<option value="_none"' + (pf.cat === '_none' ? ' selected' : '') + '>Sem categoria</option></select>' +
      '<select id="fst" aria-label="Situação">' + [['', 'Todas as situações'], ['avail', 'Disponíveis'], ['out', 'Sem estoque'], ['off', 'Desativados'], ['feat', 'Destaques']].map((o) => '<option value="' + o[0] + '"' + (pf.st === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<button class="btn btn-primary" id="newP">+ Novo produto</button></div>' +
      '<div class="tbl-wrap"><table class="tbl tbl-prod"><thead><tr><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th class="num">Estoque</th><th>Disponível</th><th>Destaque</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map((p) => '<tr><td><div class="cell-prod">' + thumb(p) + '<div><b>' + esc(p.name) + '</b><small>' + esc(p.unit || '') + '</small></div></div></td><td>' + esc(catName(p.categoryId)) + '</td><td class="num">' + brl(p.price) + '</td><td class="num">' + p.stock + '<br>' + stockBadge(p) + '</td>' +
        '<td>' + sw('data-avail="' + p.id + '" aria-label="Disponível"', p.available) + '</td><td><button class="star' + (p.featured ? ' on' : '') + '" data-feat="' + p.id + '" aria-label="Destaque" aria-pressed="' + p.featured + '">★</button></td>' +
        '<td><div class="acts"><button class="icon-btn" data-edit="' + p.id + '">Editar</button><button class="icon-btn danger" data-del="' + p.id + '">Excluir</button></div></td></tr>').join('') :
        '<tr><td colspan="7" class="muted" style="text-align:center;padding:32px">Nenhum produto encontrado.</td></tr>') + '</tbody></table></div>';

    $('#fq').oninput = (e) => { pf.q = e.target.value; clearTimeout(pf.t); pf.t = setTimeout(() => { pProducts().then(() => { const i = $('#fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 250); };
    $('#fcat').onchange = (e) => { pf.cat = e.target.value; refresh(); };
    $('#fst').onchange = (e) => { pf.st = e.target.value; refresh(); };
    $('#newP').onclick = () => productForm(null, cats, pf.cat && pf.cat !== '_none' ? pf.cat : '');
    $$('[data-edit]').forEach((b) => b.onclick = () => productForm(products.find((p) => p.id === b.dataset.edit), cats));
    $$('[data-del]').forEach((b) => b.onclick = async () => {
      const p = products.find((x) => x.id === b.dataset.del);
      if (await confirmDialog('Excluir "' + p.name + '"? Pedidos antigos continuam guardados.', { okLabel: 'Excluir', danger: true })) { await DB.products.remove(p.id); toast('Produto excluído.'); refresh(); }
    });
    $$('[data-avail]').forEach((i) => i.onchange = async () => { try { await DB.products.save({ id: i.dataset.avail, available: i.checked }); toast(i.checked ? 'Produto ativado.' : 'Produto desativado.'); refresh(); } catch (e) { fail(e); } });
    $$('[data-feat]').forEach((b) => b.onclick = async () => { const p = products.find((x) => x.id === b.dataset.feat); await DB.products.save({ id: p.id, featured: !p.featured }); refresh(); });
  }

  function productForm(p, cats, defaultCategoryId = '') {
    const isNew = !p;
    p = p || { name: '', categoryId: defaultCategoryId || '', unit: '', description: '', price: '', stock: 0, minStock: 5, emoji: '🧁', available: true, featured: false, images: [], hue: 340 };
    let imgs = (p.images || []).slice();
    const m = modal('<form id="pf" novalidate><div class="modal-head"><h3>' + (isNew ? 'Novo produto' : 'Editar produto') + '</h3><button type="button" class="x" data-close aria-label="Fechar">×</button></div><div class="modal-body"><div class="form-grid">' +
      '<div class="field span2"><label for="pName">Nome *</label><input type="text" id="pName" value="' + esc(p.name) + '"></div>' +
      '<div class="field"><label for="pCat">Categoria</label><select id="pCat"><option value="">Sem categoria</option>' + cats.map((c) => '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="pUnit">Unidade de venda</label><input type="text" id="pUnit" placeholder="ex.: caixa com 6" value="' + esc(p.unit) + '"></div>' +
      '<div class="field span2"><label for="pDesc">Descrição</label><textarea id="pDesc" rows="3">' + esc(p.description) + '</textarea></div>' +
      '<div class="field"><label for="pPrice">Preço (R$) *</label><input type="number" id="pPrice" min="0" step="0.01" value="' + esc(p.price) + '"></div>' +
      '<div class="field"><label for="pEmoji">Emoji (quando não há foto)</label><input type="text" id="pEmoji" maxlength="4" value="' + esc(p.emoji) + '"></div>' +
      '<div class="field"><label for="pStock">Estoque</label><input type="number" id="pStock" min="0" step="1" value="' + esc(p.stock) + '"></div>' +
      '<div class="field"><label for="pMin">Estoque mínimo</label><input type="number" id="pMin" min="0" step="1" value="' + esc(p.minStock) + '"></div>' +
      '<div class="field span2 checks"><label class="check"><input type="checkbox" id="pAvail"' + (p.available ? ' checked' : '') + '> Disponível para venda</label><label class="check"><input type="checkbox" id="pFeat"' + (p.featured ? ' checked' : '') + '> Destaque na página inicial</label></div>' +
      '<div class="field span2"><span class="lbl">Imagens (a primeira é a principal)</span><div class="img-grid" id="pImgs"></div><input type="file" id="pFile" accept="image/*" multiple hidden><div><button type="button" class="btn btn-ghost btn-sm" id="pAddImg">+ Adicionar imagens</button></div></div>' +
      '</div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar produto</button></div></form>', { size: 'lg' });
    const el = m.el;
    const draw = () => {
      $('#pImgs', el).innerHTML = imgs.map((s, i) => '<div class="img-item' + (i === 0 ? ' main' : '') + '"><img src="' + esc(s) + '" alt="Imagem ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remover imagem">×</button>' + (i === 0 ? '<em>Principal</em>' : '<em data-main="' + i + '" style="background:var(--ink);cursor:pointer">Tornar principal</em>') + '</div>').join('');
      $$('[data-rm]', el).forEach((b) => b.onclick = () => { imgs.splice(+b.dataset.rm, 1); draw(); });
      $$('[data-main]', el).forEach((b) => b.onclick = () => { const i = +b.dataset.main; imgs.unshift(imgs.splice(i, 1)[0]); draw(); });
    };
    draw();
    $('#pAddImg', el).onclick = () => $('#pFile', el).click();
    $('#pFile', el).onchange = async (e) => {
      for (const f of e.target.files) { try { imgs.push(await readImage(f)); } catch (err) { fail(err); } }
      e.target.value = ''; draw();
    };
    $('#pf', el).onsubmit = async (e) => {
      e.preventDefault();
      const name = $('#pName', el).value.trim(), price = num($('#pPrice', el).value, NaN);
      $$('.invalid', el).forEach((x) => x.classList.remove('invalid'));
      if (!name) { $('#pName', el).classList.add('invalid'); $('#pName', el).focus(); return toast('Informe o nome do produto.', { type: 'error' }); }
      if (!(price >= 0)) { $('#pPrice', el).classList.add('invalid'); $('#pPrice', el).focus(); return toast('Informe um preço válido.', { type: 'error' }); }
      const stock = Math.max(0, Math.floor(num($('#pStock', el).value)));
      try {
        await DB.products.save(Object.assign({}, isNew ? {} : { id: p.id }, {
          name, price, stock, minStock: Math.max(0, Math.floor(num($('#pMin', el).value))), categoryId: $('#pCat', el).value, unit: $('#pUnit', el).value.trim(),
          description: $('#pDesc', el).value.trim(), emoji: $('#pEmoji', el).value.trim() || '🧁', available: $('#pAvail', el).checked, featured: $('#pFeat', el).checked, images: imgs, hue: p.hue || Math.floor(Math.random() * 360)
        }));
        toast(isNew ? 'Produto criado.' : 'Produto atualizado.'); m.close(); refresh();
      } catch (err) { fail(err); }
    };
  }

  /* ================= CATEGORIAS ================= */
  async function pCategories() {
    const [cats, products] = await Promise.all([DB.categories.list(), DB.products.list()]);
    view.innerHTML = '<div class="page-bar"><p class="muted grow">Use as setas para definir a ordem em que as categorias aparecem no site.</p><button class="btn btn-primary" id="newC">+ Nova categoria</button></div><div class="cat-list">' +
      (cats.length ? cats.map((c, i) => {
        const ps = products.filter((p) => p.categoryId === c.id);
        return '<div class="cat-item' + (c.visible ? '' : ' off') + '"><div class="ic">' + esc(c.emoji || '🍬') + '</div><div class="info"><b>' + esc(c.name) + '</b> ' + (c.visible ? '' : '<span class="badge muted">Oculta no site</span>') + '<p>' + esc(c.description) + '</p><p>' + ps.length + ' produto(s)' + (ps.length ? ': ' + esc(ps.slice(0, 4).map((p) => p.name).join(', ')) + (ps.length > 4 ? '…' : '') : '') + '</p></div>' +
          '<div class="acts" style="display:flex;gap:6px"><button class="icon-btn" data-up="' + c.id + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon-btn" data-down="' + c.id + '" aria-label="Descer"' + (i === cats.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="icon-btn" data-edit="' + c.id + '">Editar</button><button class="icon-btn danger" data-del="' + c.id + '">Excluir</button></div></div>';
      }).join('') : '<div class="card muted">Nenhuma categoria criada.</div>') + '</div>';
    $('#newC').onclick = () => categoryForm(null, products);
    $$('[data-edit]').forEach((b) => b.onclick = () => categoryForm(cats.find((c) => c.id === b.dataset.edit), products));
    $$('[data-up]').forEach((b) => b.onclick = async () => { await DB.categories.move(b.dataset.up, -1); refresh(); });
    $$('[data-down]').forEach((b) => b.onclick = async () => { await DB.categories.move(b.dataset.down, +1); refresh(); });
    $$('[data-del]').forEach((b) => b.onclick = async () => {
      const c = cats.find((x) => x.id === b.dataset.del); const n = products.filter((p) => p.categoryId === c.id).length;
      if (await confirmDialog('Excluir a categoria "' + c.name + '"?' + (n ? ' Os ' + n + ' produto(s) dela ficarão sem categoria.' : ''), { okLabel: 'Excluir', danger: true })) { await DB.categories.remove(c.id); toast('Categoria excluída.'); refresh(); }
    });
  }
  function categoryForm(c, products) {
    const isNew = !c; c = c || { name: '', emoji: '🍬', description: '', visible: true };
    const m = modal('<form id="cf" novalidate><div class="modal-head"><h3>' + (isNew ? 'Nova categoria' : 'Editar categoria') + '</h3><button type="button" class="x" data-close aria-label="Fechar">×</button></div><div class="modal-body"><div class="form-grid">' +
      '<div class="field"><label for="cName">Nome *</label><input type="text" id="cName" value="' + esc(c.name) + '"></div><div class="field"><label for="cEmoji">Emoji</label><input type="text" id="cEmoji" maxlength="4" value="' + esc(c.emoji) + '"></div>' +
      '<div class="field span2"><label for="cDesc">Descrição</label><input type="text" id="cDesc" value="' + esc(c.description) + '"></div>' +
      '<div class="field span2"><label class="check"><input type="checkbox" id="cVis"' + (c.visible ? ' checked' : '') + '> Exibir no site</label></div>' +
      '<div class="field span2"><span class="lbl">Produtos nesta categoria</span><div class="pick-list">' + products.map((p) => '<label class="check"><input type="checkbox" value="' + p.id + '"' + (!isNew && p.categoryId === c.id ? ' checked' : '') + '> ' + esc(p.name) + (p.categoryId && p.categoryId !== c.id ? ' <small class="muted">(hoje em outra categoria)</small>' : '') + '</label>').join('') + '</div></div>' +
      '</div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>');
    $('#cf', m.el).onsubmit = async (e) => {
      e.preventDefault();
      const name = $('#cName', m.el).value.trim();
      if (!name) { $('#cName', m.el).classList.add('invalid'); return toast('Informe o nome da categoria.', { type: 'error' }); }
      try {
        const saved = await DB.categories.save(Object.assign({}, isNew ? {} : { id: c.id }, { name, emoji: $('#cEmoji', m.el).value.trim() || '🍬', description: $('#cDesc', m.el).value.trim(), visible: $('#cVis', m.el).checked }));
        await DB.categories.assignProducts(saved.id, $$('.pick-list input:checked', m.el).map((i) => i.value));
        toast('Categoria salva.'); m.close(); refresh();
      } catch (err) { fail(err); }
    };
  }

  /* ================= ESTOQUE ================= */
  let stFilter = '';
  async function pStock() {
    const products = await DB.products.list();
    const cnt = { out: products.filter((p) => p.stock <= 0).length, low: products.filter((p) => DB.util.stockStatus(p) === 'low').length };
    const list = products.filter((p) => !stFilter || DB.util.stockStatus(p) === stFilter);
    view.innerHTML =
      '<div class="page-bar"><div class="tabs grow" style="border:0;padding:0">' + [['', 'Todos (' + products.length + ')'], ['low', 'Estoque baixo (' + cnt.low + ')'], ['out', 'Esgotados (' + cnt.out + ')']].map((t) => '<button data-f="' + t[0] + '" class="' + (stFilter === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
      '<button class="btn btn-ghost" id="offOut"' + (products.some((p) => p.stock <= 0 && p.available) ? '' : ' disabled') + '>Desativar produtos esgotados</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Mínimo</th><th>Situação</th><th>Disponível</th></tr></thead><tbody>' +
      (list.length ? list.map((p) => '<tr data-row="' + p.id + '"><td><div class="cell-prod">' + thumb(p) + '<div><b>' + esc(p.name) + '</b><small>' + esc(p.unit || '') + '</small></div></div></td>' +
        '<td class="num"><span class="stepper"><button class="icon-btn" data-step="-1" aria-label="Diminuir">−</button><input class="mini-num" type="number" min="0" step="1" data-qty="' + p.id + '" aria-label="Quantidade de ' + esc(p.name) + '" value="' + p.stock + '"><button class="icon-btn" data-step="1" aria-label="Aumentar">+</button></span></td>' +
        '<td class="num"><input class="mini-num" type="number" min="0" step="1" data-min="' + p.id + '" aria-label="Mínimo de ' + esc(p.name) + '" value="' + p.minStock + '"></td><td data-badge>' + stockBadge(p) + '</td>' +
        '<td>' + sw('data-avail="' + p.id + '" aria-label="Disponível"', p.available) + '</td></tr>').join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:32px">Nenhum produto nesta visão.</td></tr>') + '</tbody></table></div>' +
      '<p class="muted">Produtos com quantidade zero aparecem como “Esgotado” no site e não podem ser comprados.</p>';
    $$('[data-f]').forEach((b) => b.onclick = () => { stFilter = b.dataset.f; refresh(); });
    $('#offOut').onclick = async () => {
      const t = products.filter((p) => p.stock <= 0 && p.available);
      for (const p of t) await DB.products.save({ id: p.id, available: false });
      toast(t.length + ' produto(s) desativado(s).'); refresh();
    };
    const saveField = async (id, patch, tr) => {
      try {
        const p = Object.assign(products.find((x) => x.id === id), patch);
        await DB.products.save({ id, ...patch });
        $('[data-badge]', tr).innerHTML = stockBadge(p);
        toast('Estoque atualizado.', { ms: 1400 });
      } catch (e) { fail(e); }
    };
    $$('[data-qty]').forEach((i) => i.onchange = () => { const v = Math.max(0, Math.floor(num(i.value))); i.value = v; saveField(i.dataset.qty, { stock: v }, i.closest('tr')); });
    $$('[data-min]').forEach((i) => i.onchange = () => { const v = Math.max(0, Math.floor(num(i.value))); i.value = v; saveField(i.dataset.min, { minStock: v }, i.closest('tr')); });
    $$('[data-step]').forEach((b) => b.onclick = () => { const i = b.closest('tr').querySelector('[data-qty]'); i.value = Math.max(0, Math.floor(num(i.value)) + Number(b.dataset.step)); i.onchange(); });
    $$('[data-avail]').forEach((i) => i.onchange = async () => { try { await DB.products.save({ id: i.dataset.avail, available: i.checked }); toast(i.checked ? 'Produto ativado.' : 'Produto desativado.', { ms: 1400 }); } catch (e) { fail(e); } });
  }

  /* ================= BOLOS ================= */
  const GROUPS = [
    { key: 'types', label: 'Tipos de bolo', one: 'tipo de bolo', priceLabel: 'Valor adicional (R$)', desc: true, img: true },
    { key: 'sizes', label: 'Tamanhos', one: 'tamanho', priceLabel: 'Preço do tamanho (R$)', serves: true },
    { key: 'doughs', label: 'Massas', one: 'massa', priceLabel: 'Valor adicional (R$)' },
    { key: 'fillings', label: 'Recheios', one: 'recheio', priceLabel: 'Valor adicional (R$)' },
    { key: 'toppings', label: 'Coberturas', one: 'cobertura', priceLabel: 'Valor adicional (R$)' },
    { key: 'extras', label: 'Extras', one: 'extra', priceLabel: 'Valor (R$)' },
    { key: 'occasions', label: 'Ocasiões', one: 'ocasião', noPrice: true, emoji: true }
  ];
  let cakeTab = 'config';
  async function pCakes() {
    const K = await DB.cakes.get();
    const tabs = '<div class="tabs"><button data-t="config" class="' + (cakeTab === 'config' ? 'on' : '') + '">Visão geral</button>' + GROUPS.map((g) => '<button data-t="' + g.key + '" class="' + (cakeTab === g.key ? 'on' : '') + '">' + g.label + ' (' + (K[g.key] || []).length + ')</button>').join('') + '</div>';
    let body;
    if (cakeTab === 'config') {
      body = '<div class="card"><h2>Encomendas de bolos</h2><label class="check">' + sw('id="kOn"', K.enabled) + ' Aceitar encomendas de bolos no site</label>' +
        '<div class="field" style="max-width:260px"><label for="kLead">Antecedência mínima (dias)</label><input type="number" id="kLead" min="0" step="1" value="' + K.leadDays + '"></div>' +
        '<div><button class="btn btn-primary" id="kSave">Salvar</button></div></div>' +
        '<div class="note">Como o preço é calculado: <b>preço do tamanho</b> + valores adicionais do tipo, massa, recheio, cobertura e extras escolhidos. Opções desativadas deixam de aparecer no site.</div>';
    } else {
      const g = GROUPS.find((x) => x.key === cakeTab); const items = K[g.key] || [];
      body = '<div class="page-bar"><p class="muted grow">Use as setas para ordenar como aparecem no site.</p><button class="btn btn-primary" id="addItem">+ Novo(a) ' + g.one + '</button></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th>' + (g.noPrice ? '' : '<th class="num">' + (g.key === 'sizes' ? 'Preço' : 'Adicional') + '</th>') + '<th>Disponível</th><th></th></tr></thead><tbody>' +
        (items.length ? items.map((it, i) => '<tr><td><div class="cell-prod">' + (g.img ? (it.images && it.images[0] ? '<img class="thumb" src="' + esc(it.images[0]) + '" alt="">' : '<div class="thumb ph" style="--h:340"><span>' + esc(it.emoji || '🎂') + '</span></div>') : g.emoji ? '<span style="font-size:1.4rem">' + esc(it.emoji || '🎂') + '</span>' : '') + '<div><b>' + esc(it.name) + '</b><small>' + esc(it.serves || it.description || '') + '</small></div></div></td>' +
          (g.noPrice ? '' : '<td class="num">' + (Number(it.price) > 0 || g.key === 'sizes' ? brl(it.price) : '—') + '</td>') + '<td>' + sw('data-av="' + it.id + '" aria-label="Disponível"', it.available) + '</td>' +
          '<td><div class="acts"><button class="icon-btn" data-up="' + it.id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir">↑</button><button class="icon-btn" data-down="' + it.id + '"' + (i === items.length - 1 ? ' disabled' : '') + ' aria-label="Descer">↓</button><button class="icon-btn" data-edit="' + it.id + '">Editar</button><button class="icon-btn danger" data-del="' + it.id + '">Excluir</button></div></td></tr>').join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:28px">Nada cadastrado ainda.</td></tr>') + '</tbody></table></div>';
    }
    view.innerHTML = tabs + body;
    $$('[data-t]').forEach((b) => b.onclick = () => { cakeTab = b.dataset.t; refresh(); });
    if (cakeTab === 'config') { $('#kSave').onclick = async () => { await DB.cakes.saveConfig({ enabled: $('#kOn').checked, leadDays: $('#kLead').value }); toast('Configuração salva.'); refresh(); }; return; }
    const g = GROUPS.find((x) => x.key === cakeTab); const items = K[g.key];
    $('#addItem').onclick = () => cakeItemForm(g, null);
    $$('[data-edit]').forEach((b) => b.onclick = () => cakeItemForm(g, items.find((i) => i.id === b.dataset.edit)));
    $$('[data-av]').forEach((i) => i.onchange = async () => { await DB.cakes.saveItem(g.key, { id: i.dataset.av, available: i.checked }); toast(i.checked ? 'Opção ativada.' : 'Opção desativada.', { ms: 1400 }); });
    $$('[data-up]').forEach((b) => b.onclick = async () => { await DB.cakes.moveItem(g.key, b.dataset.up, -1); refresh(); });
    $$('[data-down]').forEach((b) => b.onclick = async () => { await DB.cakes.moveItem(g.key, b.dataset.down, +1); refresh(); });
    $$('[data-del]').forEach((b) => b.onclick = async () => { const it = items.find((x) => x.id === b.dataset.del); if (await confirmDialog('Excluir "' + it.name + '"?', { okLabel: 'Excluir', danger: true })) { await DB.cakes.removeItem(g.key, it.id); toast('Removido.'); refresh(); } });
  }
  function cakeItemForm(g, it) {
    const isNew = !it; it = it || { name: '', price: 0, available: true, description: '', serves: '', emoji: '🎂', images: [] };
    let imgs = (it.images || []).slice();
    const m = modal('<form id="kf" novalidate><div class="modal-head"><h3>' + (isNew ? 'Novo(a) ' : 'Editar ') + g.one + '</h3><button type="button" class="x" data-close aria-label="Fechar">×</button></div><div class="modal-body"><div class="form-grid">' +
      '<div class="field span2"><label for="kName">Nome *</label><input type="text" id="kName" value="' + esc(it.name) + '"></div>' +
      (g.noPrice ? '' : '<div class="field"><label for="kPrice">' + g.priceLabel + '</label><input type="number" id="kPrice" min="0" step="0.01" value="' + esc(it.price) + '"></div>') +
      (g.serves ? '<div class="field"><label for="kServes">Serve (ex.: 8 a 10 fatias)</label><input type="text" id="kServes" value="' + esc(it.serves) + '"></div>' : '') +
      (g.emoji || g.img ? '<div class="field"><label for="kEmoji">Emoji</label><input type="text" id="kEmoji" maxlength="4" value="' + esc(it.emoji) + '"></div>' : '') +
      (g.desc ? '<div class="field span2"><label for="kDesc">Descrição</label><input type="text" id="kDesc" value="' + esc(it.description) + '"></div>' : '') +
      (g.img ? '<div class="field span2"><span class="lbl">Imagens</span><div class="img-grid" id="kImgs"></div><input type="file" id="kFile" accept="image/*" multiple hidden><div><button type="button" class="btn btn-ghost btn-sm" id="kAddImg">+ Adicionar imagens</button></div></div>' : '') +
      '<div class="field span2"><label class="check"><input type="checkbox" id="kAv"' + (it.available ? ' checked' : '') + '> Disponível</label></div></div></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>');
    const el = m.el;
    if (g.img) {
      const draw = () => { $('#kImgs', el).innerHTML = imgs.map((s, i) => '<div class="img-item' + (i === 0 ? ' main' : '') + '"><img src="' + esc(s) + '" alt="Imagem ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remover">×</button></div>').join(''); $$('[data-rm]', el).forEach((b) => b.onclick = () => { imgs.splice(+b.dataset.rm, 1); draw(); }); };
      draw();
      $('#kAddImg', el).onclick = () => $('#kFile', el).click();
      $('#kFile', el).onchange = async (e) => { for (const f of e.target.files) { try { imgs.push(await readImage(f)); } catch (err) { fail(err); } } e.target.value = ''; draw(); };
    }
    $('#kf', el).onsubmit = async (e) => {
      e.preventDefault();
      const name = $('#kName', el).value.trim();
      if (!name) { $('#kName', el).classList.add('invalid'); return toast('Informe o nome.', { type: 'error' }); }
      const item = { name, available: $('#kAv', el).checked };
      if (!isNew) item.id = it.id;
      if (!g.noPrice) item.price = num($('#kPrice', el).value);
      if (g.serves) item.serves = $('#kServes', el).value.trim();
      if (g.emoji || g.img) item.emoji = $('#kEmoji', el).value.trim() || '🎂';
      if (g.desc) item.description = $('#kDesc', el).value.trim();
      if (g.img) item.images = imgs;
      try { await DB.cakes.saveItem(g.key, item); toast('Salvo.'); m.close(); refresh(); } catch (err) { fail(err); }
    };
  }

  /* ================= PEDIDOS ================= */
  const of = { st: '', q: '' };
  async function pOrders() {
    const orders = await DB.orders.list();
    const list = orders.filter((o) => (!of.st || o.status === of.st) && (!of.q || ('#' + o.number + ' ' + o.customer.name + ' ' + o.customer.phone).toLowerCase().includes(of.q.toLowerCase())));
    view.innerHTML =
      '<div class="page-bar"><div class="tabs grow" style="border:0;padding:0"><button data-s="" class="' + (!of.st ? 'on' : '') + '">Todos (' + orders.length + ')</button>' + ST.map((s) => '<button data-s="' + s.id + '" class="' + (of.st === s.id ? 'on' : '') + '">' + s.label + ' (' + orders.filter((o) => o.status === s.id).length + ')</button>').join('') + '</div>' +
      '<input type="search" id="oq" placeholder="Buscar nº, nome ou telefone" aria-label="Buscar pedido" value="' + esc(of.q) + '"></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nº</th><th>Cliente</th><th>Itens</th><th>Entrega</th><th>Status</th><th class="num">Total</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map((o) => '<tr class="row-click" data-open="' + o.id + '"><td>#' + o.number + '</td><td>' + esc(o.customer.name) + '<br><small class="muted">' + fmtDateTime(o.createdAt) + '</small></td><td>' + o.items.reduce((n, i) => n + i.qty, 0) + (o.items.some((i) => i.kind === 'cake') ? ' 🎂' : '') + '</td><td>' + (o.delivery.type === 'entrega' ? 'Entrega' : 'Retirada') + '<br><small class="muted">' + fmtDate(o.delivery.date) + '</small></td><td>' + stBadge(o.status) + '</td><td class="num">' + brl(o.total) + '</td><td><button class="icon-btn">Detalhes</button></td></tr>').join('') :
        '<tr><td colspan="7" class="muted" style="text-align:center;padding:32px">Nenhum pedido encontrado. Os pedidos feitos no site aparecem aqui.</td></tr>') + '</tbody></table></div>';
    $$('[data-s]').forEach((b) => b.onclick = () => { of.st = b.dataset.s; refresh(); });
    $('#oq').oninput = (e) => { of.q = e.target.value; clearTimeout(of.t); of.t = setTimeout(() => pOrders().then(() => { const i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
    $$('[data-open]').forEach((r) => r.onclick = () => openOrder(r.dataset.open));
  }
  async function openOrder(id) {
    const o = await DB.orders.get(id); if (!o) return;
    const s = await DB.settings.get();
    const d = o.delivery;
    const m = modal('<div class="modal-head"><h3>Pedido #' + o.number + ' ' + stBadge(o.status) + '</h3><button type="button" class="x" data-close aria-label="Fechar">×</button></div><div class="modal-body">' +
      '<div><p class="muted" style="margin-bottom:8px">Alterar status</p><div class="status-btns">' + ST.map((x) => '<button class="btn btn-ghost btn-sm' + (o.status === x.id ? ' on' : '') + '" data-set="' + x.id + '">' + x.label + '</button>').join('') + '</div></div>' +
      '<dl class="kv"><dt>Cliente</dt><dd>' + esc(o.customer.name) + '</dd><dt>Telefone</dt><dd>' + esc(o.customer.phone) + '</dd>' + (o.customer.email ? '<dt>E-mail</dt><dd>' + esc(o.customer.email) + '</dd>' : '') +
      '<dt>Recebimento</dt><dd>' + (d.type === 'entrega' ? 'Entrega' : 'Retirada') + ' em ' + fmtDate(d.date) + (d.time ? ' às ' + esc(d.time) : '') + '</dd>' +
      (d.type === 'entrega' ? '<dt>Endereço</dt><dd>' + esc([d.street + ', ' + d.number, d.district, d.complement].filter(Boolean).join(' · ')) + '</dd>' : '') +
      '<dt>Pagamento</dt><dd>' + esc(o.payment) + '</dd>' + (o.notes ? '<dt>Observações</dt><dd>' + esc(o.notes) + '</dd>' : '') + '<dt>Feito em</dt><dd>' + fmtDateTime(o.createdAt) + '</dd></dl>' +
      '<div><h4 style="font-family:var(--font-display);font-size:1.15rem;margin-bottom:4px">Itens</h4>' + o.items.map((i) => '<div class="order-item"><div><b>' + i.qty + '× ' + esc(i.name) + '</b>' + (i.summary ? '<br><small class="muted">' + esc(i.summary) + '</small>' : '') + (i.note ? '<br><small>' + esc(i.note) + '</small>' : '') + (i.refImage ? '<br><img class="ref" src="' + esc(i.refImage) + '" alt="Referência do bolo">' : '') + '</div><b>' + brl(i.unitPrice * i.qty) + '</b></div>').join('') + '</div>' +
      '<div class="totals" style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>' + brl(o.subtotal) + '</span></div><div style="display:flex;justify-content:space-between"><span>Entrega</span><span>' + brl(o.deliveryFee) + '</span></div><div style="display:flex;justify-content:space-between;font-weight:600;font-size:1.15rem"><span>Total</span><span>' + brl(o.total) + '</span></div></div>' +
      '<div class="timeline"><b style="color:var(--ink)">Histórico</b>' + o.history.map((h) => '<span>' + fmtDateTime(h.at) + ' · ' + esc(stLabel(h.status)) + '</span>').join('') + '</div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" id="delOrder" style="margin-right:auto">Excluir pedido</button>' + (String(s.whatsapp || '').replace(/\D/g, '') ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/55' + String(o.customer.phone).replace(/\D/g, '').replace(/^55/, '') + '">WhatsApp do cliente</a>' : '') + '<button class="btn btn-primary" data-close>Fechar</button></div>', { size: 'lg' });
    $$('[data-set]', m.el).forEach((b) => b.onclick = async () => {
      try { await DB.orders.setStatus(o.id, b.dataset.set); toast('Status: ' + stLabel(b.dataset.set) + (b.dataset.set === 'cancelado' ? ' (estoque devolvido)' : '')); m.close(); await refresh(); openOrder(o.id); } catch (e) { fail(e); }
    });
    $('#delOrder', m.el).onclick = async () => { if (await confirmDialog('Excluir o pedido #' + o.number + ' definitivamente? O estoque não é alterado.', { okLabel: 'Excluir', danger: true })) { await DB.orders.remove(o.id); m.close(); toast('Pedido excluído.'); refresh(); } };
  }

  /* ================= CONFIGURAÇÕES ================= */
  async function pConfig() {
    const s = await DB.settings.get();
    const f = (id, label, val, type = 'text', ph = '') => '<div class="field"><label for="' + id + '">' + label + '</label><input type="' + type + '" id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '"></div>';
    view.innerHTML = '<form id="cfg" novalidate class="card" style="gap:22px">' +
      '<div><h2>Informações da doceria</h2><div class="form-grid" style="margin-top:12px">' + f('sName', 'Nome da doceria', s.storeName) + f('sCity', 'Cidade · UF', s.city) + f('sRate', 'Avaliação no início (ex.: 5,0 no Google · 9 avaliações)', s.rating || '') +
      '<div class="field span2"><label for="sTag">Frase de apresentação</label><input type="text" id="sTag" value="' + esc(s.tagline) + '"></div></div></div>' +
      '<div><h2>Contato</h2><div class="form-grid" style="margin-top:12px">' + f('sPhone', 'Telefone', s.phone, 'tel') + f('sWa', 'WhatsApp (com DDD, só números)', s.whatsapp, 'tel', '5534999999999') + f('sMail', 'E-mail', s.email, 'email') + f('sIg', 'Instagram', s.instagram, 'text', '@dloladoceria_') + '<div class="field span2"><label for="sAddr">Endereço (linha 1)</label><input type="text" id="sAddr" value="' + esc(s.address) + '"></div><div class="field span2"><label for="sAddr2">Endereço (linha 2: cidade e CEP)</label><input type="text" id="sAddr2" value="' + esc(s.address2 || '') + '"></div><div class="field span2"><label for="sExtra">Fechado também em (ex.: feriados)</label><input type="text" id="sExtra" value="' + esc(s.closedExtra || '') + '"></div></div></div>' +
      '<div><h2>Mapa, Instagram e avaliações</h2><div class="form-grid" style="margin-top:12px">' +
      f('sMapQ', 'Endereço usado no mapa (vazio = usa o endereço acima)', s.mapQuery || '') + f('sMapsUrl', 'Link do Google Maps (opcional)', s.mapsUrl || '', 'url', 'https://maps.app.goo.gl/…') +
      f('sRevUrl', 'Link das avaliações no Google (opcional)', s.googleReviewsUrl || '', 'url') +
      '<div class="field span2"><label for="sReviews">Avaliações exibidas no site (uma por linha: Nome | nota de 1 a 5 | texto)</label><textarea id="sReviews" rows="5" placeholder="Maria Silva | 5 | Bolo lindo e delicioso!">' + esc((s.reviews || []).map((r) => r.name + ' | ' + r.stars + ' | ' + r.text).join('\n')) + '</textarea>' +
      '<small class="muted">O texto "5,0 no Google · 9 avaliações" é editado em Informações da doceria.</small></div></div></div>' +
      '<div><h2>Horário de funcionamento</h2><div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' + s.hours.map((h, i) => '<div class="hours-row"><b>' + esc(h.day) + '</b><input type="time" data-h="open" data-i="' + i + '" value="' + esc(h.open) + '" aria-label="Abre ' + esc(h.day) + '"><input type="time" data-h="close" data-i="' + i + '" value="' + esc(h.close) + '" aria-label="Fecha ' + esc(h.day) + '"><label class="check"><input type="checkbox" data-h="closed" data-i="' + i + '"' + (h.closed ? ' checked' : '') + '> Fechado</label></div>').join('') + '</div></div>' +
      '<div><h2>Pedidos, entrega e pagamento</h2><div class="form-grid" style="margin-top:12px">' +
      '<div class="field span2 checks"><label class="check"><input type="checkbox" id="sDel"' + (s.deliveryEnabled ? ' checked' : '') + '> Aceitar entrega</label><label class="check"><input type="checkbox" id="sPick"' + (s.pickupEnabled ? ' checked' : '') + '> Aceitar retirada</label></div>' +
      f('sFee', 'Taxa de entrega (R$)', s.deliveryFee, 'number') + f('sFree', 'Entrega grátis acima de (R$, 0 = nunca)', s.freeDeliveryAbove, 'number') +
      '<div class="field span2 checks"><label class="check"><input type="checkbox" id="sPix"' + (s.payments.pix ? ' checked' : '') + '> Pix</label><label class="check"><input type="checkbox" id="sCash"' + (s.payments.dinheiro ? ' checked' : '') + '> Dinheiro</label><label class="check"><input type="checkbox" id="sCard"' + (s.payments.cartao ? ' checked' : '') + '> Cartão</label></div>' +
      f('sPixKey', 'Chave Pix (mostrada ao cliente)', s.pixKey) + '<div class="field"><label for="sNote">Aviso no pedido</label><input type="text" id="sNote" value="' + esc(s.orderNote) + '"></div>' +
      '<div class="field span2"><label class="check"><input type="checkbox" id="sAuto"' + (s.autoDisableOutOfStock ? ' checked' : '') + '> Desativar produto automaticamente quando o estoque chegar a zero por um pedido</label></div></div></div>' +
      '<div><button class="btn btn-primary" type="submit">Salvar configurações</button></div></form>' +

      '<div class="card"><h2>Dados de teste e backup</h2><p class="muted">Os dados ficam guardados neste navegador. Exporte um backup antes de limpar o navegador. A integração com banco de dados substituirá apenas o arquivo <code>js/db.js</code>.</p>' +
      '<div class="btn-row" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="exp">Exportar backup (.json)</button><button class="btn btn-ghost" id="imp">Importar backup</button><input type="file" id="impFile" accept="application/json" hidden><button class="btn btn-danger" id="rst">Restaurar dados de exemplo</button></div></div>' +
      '<div class="card"><h2>Preparado para integrações</h2><p class="muted">A estrutura já separa tela e dados. Pontos previstos: banco de dados (produtos, categorias, bolos, pedidos), autenticação real do administrador, notificação de novos pedidos por WhatsApp ou e-mail e cobrança online. Nenhum deles está ativo nesta etapa.</p></div>';

    $('#cfg').onsubmit = async (e) => {
      e.preventDefault();
      const hours = s.hours.map((h, i) => ({ day: h.day, open: $('[data-h=open][data-i="' + i + '"]').value, close: $('[data-h=close][data-i="' + i + '"]').value, closed: $('[data-h=closed][data-i="' + i + '"]').checked }));
      const name = $('#sName').value.trim();
      if (!name) { $('#sName').classList.add('invalid'); return toast('Informe o nome da doceria.', { type: 'error' }); }
      try {
        await DB.settings.save({ storeName: name, city: $('#sCity').value.trim(), rating: $('#sRate').value.trim(), tagline: $('#sTag').value.trim(), phone: $('#sPhone').value.trim(), whatsapp: $('#sWa').value.replace(/\D/g, ''), email: $('#sMail').value.trim(), instagram: $('#sIg').value.trim(), address: $('#sAddr').value.trim(), address2: $('#sAddr2').value.trim(), mapQuery: $('#sMapQ').value.trim(), mapsUrl: $('#sMapsUrl').value.trim(), googleReviewsUrl: $('#sRevUrl').value.trim(), reviews: $('#sReviews').value.split('\n').map((l) => l.split('|')).filter((p) => p[0].trim() && p.slice(2).join('|').trim()).map((p) => ({ name: p[0].trim(), stars: Math.min(5, Math.max(1, parseInt(p[1], 10) || 5)), text: p.slice(2).join('|').trim() })), closedExtra: $('#sExtra').value.trim(), hours,
          deliveryEnabled: $('#sDel').checked, pickupEnabled: $('#sPick').checked, deliveryFee: num($('#sFee').value), freeDeliveryAbove: num($('#sFree').value),
          payments: { pix: $('#sPix').checked, dinheiro: $('#sCash').checked, cartao: $('#sCard').checked }, pixKey: $('#sPixKey').value.trim(), orderNote: $('#sNote').value.trim(), autoDisableOutOfStock: $('#sAuto').checked });
        toast('Configurações salvas.'); refresh();
      } catch (err) { fail(err); }
    };
    $('#exp').onclick = async () => {
      const blob = new Blob([await DB.data.export()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'doceria-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
      toast('Se o download não iniciar, abra o painel em uma aba própria do navegador.', { ms: 4500 });
    };
    $('#imp').onclick = () => $('#impFile').click();
    $('#impFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { await DB.data.import(await f.text()); toast('Backup importado.'); refresh(); } catch (err) { fail(err); } };
    $('#rst').onclick = async () => { if (await confirmDialog('Isso apaga tudo o que foi cadastrado e volta aos dados de exemplo.', { okLabel: 'Restaurar', danger: true })) { await DB.data.reset(); toast('Dados de exemplo restaurados.'); refresh(); } };
  }

  render(false);
})();
