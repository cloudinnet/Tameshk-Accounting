/* Accessible, panel-scoped pagination and full-row search for Tameshk tables. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TameshkTablePagination = api;
  if (root?.document) api.start(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const stateStore = createStateStore();
  const mounted = new WeakSet();
  const normalize = value => String(value ?? '')
    .normalize('NFKC').toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim();

  function pageWindow(total, current) {
    total = Math.max(1, Math.floor(Number(total) || 1));
    current = Math.min(total, Math.max(1, Math.floor(Number(current) || 1)));
    if (total <= 5) return Array.from({length: total}, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, '…', total - 1, total];
    if (current === 4) return [1, 2, 3, 4, '…', total];
    if (current >= total - 2) return [1, 2, 3, '…', total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
  }
  function paginateItems(items, pageSize, page, query = '', textOf = value => value) {
    const all = Array.isArray(items) ? items : [];
    const size = Math.max(1, Math.floor(Number(pageSize) || 10));
    const needle = normalize(query);
    const filtered = needle ? all.filter(item => normalize(textOf(item)).includes(needle)) : all;
    const pageCount = Math.max(1, Math.ceil(filtered.length / size));
    const currentPage = Math.min(pageCount, Math.max(1, Math.floor(Number(page) || 1)));
    return {filtered, page: currentPage, pageCount, visible: filtered.slice((currentPage - 1) * size, currentPage * size)};
  }
  function createStateStore() {
    const map = new Map();
    return {get(key) { if (!map.has(key)) map.set(key, {page: 1, query: ''}); return map.get(key); }, clear() { map.clear(); }};
  }
  function text(root, value) {
    try { return typeof root.uiText === 'function' ? root.uiText(value) : value; }
    catch { return value; }
  }
  function numberText(root, value) {
    try { return typeof root.qtyFmt === 'function' ? root.qtyFmt(value) : String(value); }
    catch { return String(value); }
  }
  function isPlaceholder(row) {
    return row.hasAttribute('data-tp-empty') ||
      (row.querySelector('td[colspan]') && /^[-—–\s]*$/.test(row.textContent || ''));
  }
  function start(doc, root) {
    if (!doc || doc.__tameshkTablePaginationStarted) return;
    doc.__tameshkTablePaginationStarted = true;
    const scan = () => {
      doc.querySelectorAll('[data-tp-key][data-tp-size]').forEach(host => {
        if (!mounted.has(host)) mount(host, root);
      });
    };
    scan();
    const observer = new MutationObserver(() => {
      if (doc.__tameshkTablePaginationQueued) return;
      doc.__tameshkTablePaginationQueued = true;
      Promise.resolve().then(() => {
        doc.__tameshkTablePaginationQueued = false;
        scan();
      });
    });
    observer.observe(doc.body || doc.documentElement, {childList: true, subtree: true});
    doc.__tameshkTablePaginationObserver = observer;
  }
  function mount(host, root) {
    const table = host.matches('table') ? host : host.querySelector('table');
    const tbody = table?.tBodies?.[0];
    if (!table || !tbody) return;
    mounted.add(host);
    const key = host.dataset.tpKey;
    const size = Math.max(1, Math.floor(Number(host.dataset.tpSize) || 10));
    const state = stateStore.get(key);
    const originalRows = Array.from(tbody.rows).filter(row => !isPlaceholder(row));
    const controls = host.ownerDocument.createElement('div');
    controls.className = 'tp-controls';
    controls.setAttribute('data-tp-controls-for', key);
    const searchEnabled = !host.hasAttribute('data-tp-no-search');
    const search = searchEnabled ? host.ownerDocument.createElement('input') : null;
    if (search) {
      search.type = 'search';
      search.className = 'input tp-search';
      search.placeholder = text(root, 'جست‌وجو در این فهرست…');
      search.setAttribute('aria-label', text(root, 'جست‌وجو در این فهرست'));
      search.value = state.query;
      controls.appendChild(search);
    }
    const nav = host.ownerDocument.createElement('div');
    nav.className = 'tp-nav';
    controls.appendChild(nav);
    const render = () => {
      const result = paginateItems(originalRows, size, state.page, state.query, row => row.textContent);
      const {filtered, page: currentPage, pageCount: pages, visible} = result;
      state.page = currentPage;
      if (visible.length) tbody.replaceChildren(...visible);
      else {
        const empty = host.ownerDocument.createElement('tr');
        empty.dataset.tpEmpty = 'true';
        const cell = host.ownerDocument.createElement('td');
        cell.colSpan = Math.max(1, table.tHead?.rows?.[0]?.cells?.length || 1);
        cell.className = 'empty';
        cell.textContent = text(root, 'نتیجه‌ای برای جست‌وجو پیدا نشد.');
        empty.appendChild(cell);
        tbody.replaceChildren(empty);
      }
      nav.replaceChildren();
      if (pages > 1) {
        const numbers = host.ownerDocument.createElement('div');
        numbers.className = 'tp-page-numbers';
        for (const item of pageWindow(pages, state.page)) {
          if (item === '…') {
            const ellipsis = host.ownerDocument.createElement('span');
            ellipsis.className = 'tp-ellipsis';
            ellipsis.textContent = '…';
            numbers.appendChild(ellipsis);
          } else {
            const button = host.ownerDocument.createElement('button');
            button.type = 'button';
            button.className = `btn small tp-page${item === state.page ? ' active' : ''}`;
            button.textContent = numberText(root, item);
            button.setAttribute('aria-label', `${text(root, 'صفحه')} ${numberText(root, item)}`);
            if (item === state.page) button.setAttribute('aria-current', 'page');
            button.addEventListener('click', () => { state.page = item; render(); });
            numbers.appendChild(button);
          }
        }
        nav.appendChild(numbers);
      }
      if (pages > 1) {
        const jump = host.ownerDocument.createElement('label');
        jump.className = 'tp-jump';
        jump.append(text(root, 'رفتن به صفحه'));
        const input = host.ownerDocument.createElement('input');
        input.type = 'number'; input.min = '1'; input.max = String(pages);
        input.step = '1'; input.value = String(state.page);
        input.className = 'input tp-page-input';
        input.setAttribute('aria-label', text(root, 'شماره صفحه'));
        const go = () => {
          const value = Number(input.value);
          if (!Number.isInteger(value) || value < 1 || value > pages) {
            input.value = String(state.page); return;
          }
          state.page = value; render();
        };
        input.addEventListener('change', go);
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); go(); } });
        jump.appendChild(input);
        nav.appendChild(jump);
      }
      const total = host.ownerDocument.createElement('span');
      total.className = 'tp-count';
      total.textContent = `${numberText(root, filtered.length)} ${text(root, 'ردیف')}`;
      nav.appendChild(total);
      controls.hidden = originalRows.length <= size;
    };
    if (search) search.addEventListener('input', () => { state.query = search.value; state.page = 1; render(); });
    const styles = host.ownerDocument.getElementById('tameshkTablePaginationStyles');
    if (!styles) {
      const style = host.ownerDocument.createElement('style');
      style.id = 'tameshkTablePaginationStyles';
      style.textContent = `.tp-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:9px;margin:10px 0 2px;padding:9px 10px;border-top:1px solid var(--line,#ddd)}.tp-controls[hidden]{display:none}.tp-search{flex:1 1 210px;max-width:360px;min-height:35px}.tp-nav,.tp-page-numbers{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.tp-page-numbers{justify-content:center}.tp-page{min-width:32px}.tp-page.active{font-weight:800;background:var(--teal,#147d77);border-color:var(--teal,#147d77);color:#fff}.tp-ellipsis{padding:0 3px;color:var(--muted,#777)}.tp-jump{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted,#666)}.tp-page-input{width:70px;min-height:32px;text-align:center}.tp-count{font-size:10px;color:var(--muted,#777);white-space:nowrap}@media print{.tp-controls{display:none!important}}`;
      (docHead(host.ownerDocument)).appendChild(style);
    }
    // Every list owns its bottom controls, even when several lists/sections
    // share a panel. Keep them outside the horizontal scrolling wrapper and
    // never relocate a pre-existing upper external search.
    const anchor = table.closest('.table-wrap') || table;
    if (anchor.parentElement) anchor.parentElement.insertBefore(controls, anchor.nextSibling);
    render();
  }
  function docHead(doc) { return doc.head || doc.documentElement; }
  return {pageWindow, normalize, paginateItems, createStateStore, start, _states: stateStore};
});
