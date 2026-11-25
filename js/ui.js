/* Utilitários de interface compartilhados (site + painel) */
(function (w) {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    return d.toLocaleDateString('pt-BR');
  };
  const fmtDateTime = (v) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function toast(msg, opts = {}) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (opts.type ? ' ' + opts.type : '');
    t.innerHTML = '<span>' + esc(msg) + '</span>';
    if (opts.action) {
      const b = document.createElement('button');
      b.textContent = opts.action.label;
      b.onclick = () => { opts.action.onClick(); t.remove(); };
      t.appendChild(b);
    }
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.ms || 3400);
  }

  function modal(html, opts = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(back);
    document.body.classList.add('no-scroll');
    const el = back.firstElementChild;
    const prev = document.activeElement;
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      back.remove();
      if (!document.querySelector('.modal-back')) document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
      if (prev && prev.focus) prev.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        const all = document.querySelectorAll('.modal-back');
        if (all[all.length - 1] === back) close();
      }
    }
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    const f = el.querySelector('[autofocus],input:not([type=hidden]),select,textarea,button');
    if (f) f.focus();
    return { el, close };
  }

  function confirmDialog(msg, { okLabel = 'Confirmar', danger = false, title = 'Tem certeza?' } = {}) {
    return new Promise((res) => {
      let done = false;
      const m = modal(
        '<div class="modal-head"><h3>' + esc(title) + '</h3></div><div class="modal-body"><p>' + esc(msg) + '</p></div>' +
        '<div class="modal-foot"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="cf-ok">' + esc(okLabel) + '</button></div>',
        { size: 'sm', onClose: () => { if (!done) res(false); } }
      );
      m.el.querySelector('#cf-ok').onclick = () => { done = true; res(true); m.close(); };
    });
  }

  // Lê uma imagem, reduz e devolve um data URL (JPEG) para guardar localmente.
  function readImage(file, maxW = 900, q = 0.78) {
    return new Promise((res, rej) => {
      if (!file.type.startsWith('image/')) return rej(new Error('O arquivo não é uma imagem.'));
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('Não foi possível ler o arquivo.'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error('Imagem inválida.'));
        img.onload = () => {
          const r = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  w.UI = { esc, $, $$, brl, fmtDate, fmtDateTime, toast, modal, confirmDialog, readImage };
})(window);
