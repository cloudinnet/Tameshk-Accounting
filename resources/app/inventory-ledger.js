/* Offline moving-weighted-average inventory ledger. This is an app feature, not encrypted or a legal ledger. */
(function (root) {
  'use strict';
  if (!root || root.InventoryLedger) return;

  let idSeq = 0;
  const nowISO = () => new Date().toISOString();
  const newId = prefix => `${prefix || 'il'}-${Date.now()}-${++idSeq}`;
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const getState = () => typeof state !== 'undefined' ? state : root.state;
  const escText = value => typeof root.esc === 'function'
    ? root.esc(String(value == null ? '' : value))
    : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateToday = () => typeof root.todayISO === 'function' ? root.todayISO() : (()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})();
  const localClock = () => {const d=new Date(),pad=x=>String(x).padStart(2,'0');return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`};
  const validISODate = value => {if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const d=new Date(`${value}T12:00:00Z`);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value};
  const validClock = value => /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value||''));
  const localTimestamp = (date,time) => {const value=String(time||'').length===5?`${date}T${time}:00`:`${date}T${time}`;const d=new Date(value);return Number.isFinite(+d)?d.toISOString():''};
  const formatEventTime = value => {const ms=Date.parse(value||'');if(!Number.isFinite(ms))return '—';const language=getState()?.settings?.language,locale=language==='en'?'en-GB':language==='ar'?'ar-SA':'fa-IR';return new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(ms))};
  const moneyText = (value,record) => root.TameshkCurrency ? root.TameshkCurrency.amount(value,record) : typeof root.money === 'function' ? root.money(value) : String(Math.round(num(value)));
  const currencySymbol = record => root.TameshkCurrency?.symbol(record) || langText('تومان','toman','تومان');
  const qtyText = value => {
    const locale = getState()?.settings?.language === 'en' ? 'en-GB' : getState()?.settings?.language === 'ar' ? 'ar-SA' : 'fa-IR';
    return new Intl.NumberFormat(locale, {maximumFractionDigits:6}).format(num(value));
  };
  const toast = message => { if (typeof root.showToast === 'function') root.showToast(message); };
  const persist = () => {
    // save() is a top-level const in the host classic script, so it is lexical rather than window.save.
    try {
      if (typeof save === 'function') save();
      else if (root.localStorage && getState()) root.localStorage.setItem('tameshk-state', JSON.stringify(getState()));
    } catch (_) { /* Offline storage may be unavailable or full. */ }
  };
  const langText = (fa, en, ar) => {
    if (fa === 'تومان' && root.TameshkCurrency) return root.TameshkCurrency.symbol();
    const language = getState()?.settings?.language;
    return language === 'en' ? en : language === 'ar' ? ar : fa;
  };

  function ledger() {
    const s = getState();
    if (!s) return null;
    if (!s.inventoryLedger || typeof s.inventoryLedger !== 'object') s.inventoryLedger = {version: 1, events: []};
    if (!Array.isArray(s.inventoryLedger.events)) s.inventoryLedger.events = [];
    return s.inventoryLedger;
  }
  function inheritCurrency(target,source){if(root.TameshkCurrency?.snapshot)return root.TameshkCurrency.snapshot(target,source);if(source)for(const key of ['currency','currencyDecimals'])if(Object.hasOwn(source,key))target[key]=source[key];return target}
  function groupedMoney(rows,value){const groups=new Map();for(const r of rows){const key=JSON.stringify([r.currency??null,r.currencyDecimals??null]);if(!groups.has(key))groups.set(key,{record:r,total:0});groups.get(key).total+=num(value(r))}return [...groups.values()].map(g=>moneyText(g.total,g.record)).join(' · ')||moneyText(0)}
  function appendEvent(event,source) {
    const book = ledger();
    if (!book) return null;
    const stored = Object.assign({
      id: newId('inv'), type: '', productId: '', quantity: 0, unitCost: 0,
      totalCost: 0, sourceId: '', occurredAt: nowISO(), note: '', estimated: false
    }, event || {});
    inheritCurrency(stored,source||getState()?.products?.find(p=>p.id===stored.productId));
    book.events.push(stored);
    return stored;
  }
  function initialize() {
    const s = getState();
    if (!s) return;
    const book = ledger();
    if (book.migratedAt) {
      (s.products || []).forEach(p => {
        if (!Number.isFinite(Number(p.avgCost))) p.avgCost = num(p.cost);
        if (!Number.isFinite(Number(p.inventoryValue))) p.inventoryValue = num(p.stock) * num(p.avgCost);
      });
      return;
    }
    (s.products || []).forEach(p => {
      const qty = num(p.stock), cost = num(p.cost);
      p.avgCost = cost;
      p.inventoryValue = qty * cost;
      appendEvent({type:'opening_balance', productId:p.id, quantity:qty, unitCost:cost,
        totalCost:qty * cost, sourceId:'migration-opening', occurredAt:nowISO(),
        note:langText('موجودی آغازین هنگام راه‌اندازی دفتر انبار','Opening stock at ledger setup','المخزون الافتتاحي عند إعداد سجل المخزون'), estimated:true});
    });
    book.version = 1;
    book.migratedAt = nowISO();
    persist();
  }
  initialize();

  function callOriginal(name, args) {
    const fn = root[name];
    if (typeof fn !== 'function') return undefined;
    return fn.apply(root, args);
  }

  // Add supplier and base-unit purchase cost fields to the original purchase dialog.
  if (typeof root.stockModal === 'function') {
    const oldStockModal = root.stockModal;
    root.stockModal = function (id) {
      const result = oldStockModal.apply(this, arguments);
      try {
        const inner = root.document?.getElementById('modalInner');
        const note = root.document?.getElementById('packNote');
        if (inner && note && !root.document.getElementById('ledgerUnitCost')) {
          const costField = `<div class="field"><label>${escText(langText('قیمت خرید هر واحد پایه','Purchase cost per base unit','تكلفة الشراء لكل وحدة أساسية'))} (${escText(currencySymbol(getState()?.products?.find(p=>p.id===id)))})</label><input id="ledgerUnitCost" type="number" min="0" step="${root.TameshkCurrency?.inputStep(getState()?.products?.find(p=>p.id===id))||'0.01'}" value="${num(getState()?.products?.find(p=>p.id===id)?.cost)}"></div>`;
          const supplierField = `<div class="field"><label>${escText(langText('تأمین‌کننده (اختیاری)','Supplier (optional)','المورّد (اختياري)'))}</label><input id="ledgerSupplier" maxlength="160"></div>`;
          const wrap = note.parentElement;
          if (wrap?.insertAdjacentHTML) wrap.insertAdjacentHTML('beforebegin', costField + supplierField);
        }
      } catch (_) { /* Preserve the original dialog if a host DOM differs. */ }
      return result;
    };
  }

  if (typeof root.addStock === 'function') {
    const oldAddStock = root.addStock;
    root.addStock = function (id) {
      const s = getState(), p = s?.products?.find(x => x.id === id);
      if (!p) return oldAddStock.apply(this, arguments);
      const oldStock = num(p.stock), oldValue = Number.isFinite(Number(p.inventoryValue)) ? num(p.inventoryValue) : oldStock * num(p.avgCost ?? p.cost);
      const costEl = root.document?.getElementById('ledgerUnitCost');
      const unitCost = costEl ? Number(costEl.value) : num(p.cost);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        toast(langText('قیمت خرید هر واحد پایه معتبر نیست.','Enter a valid purchase cost per base unit.','أدخل تكلفة صحيحة لكل وحدة أساسية.'));
        return;
      }
      const result = oldAddStock.apply(this, arguments);
      const quantity = num(p.stock) - oldStock;
      if (!(quantity > 0)) return result;
      const value = oldValue + quantity * unitCost;
      p.inventoryValue = value;
      p.avgCost = num(p.stock) > 0 ? value / num(p.stock) : 0;
      p.cost = unitCost;
      const supplier = root.document?.getElementById('ledgerSupplier')?.value?.trim() || '';
      const note = root.document?.getElementById('packNote')?.value?.trim() || '';
      appendEvent({type:'purchase_receipt', productId:id, quantity, unitCost, totalCost:quantity*unitCost,
        sourceId:newId('purchase'), occurredAt:nowISO(), note:[supplier && `${langText('تأمین‌کننده','Supplier','المورّد')}: ${supplier}`, note].filter(Boolean).join(' · '), estimated:false});
      persist();
      return result;
    };
  }

  if (typeof root.saveTransaction === 'function') {
    const oldSaveTransaction = root.saveTransaction;
    root.saveTransaction = function () {
      let s = getState();
      const before = new Map((s?.products || []).map(p => [p.id, {
        avg: Number.isFinite(Number(p.avgCost)) ? num(p.avgCost) : num(p.cost),
        value: Number.isFinite(Number(p.inventoryValue)) ? num(p.inventoryValue) : num(p.stock) * num(p.avgCost ?? p.cost)
      }]));
      const priorIds = new Set((s?.transactions || []).map(t => t.id));
      const result = oldSaveTransaction.apply(this, arguments);
      if (root.__tameshkLastSaveSucceeded === false) return result;
      // The central save may replace the root state with a merged snapshot.
      // Never continue mutating the stale object captured before save().
      s = getState();
      const added = (s?.transactions || []).find(t => !priorIds.has(t.id));
      if (!added) return result; // Validation failed or original action did not create a sale.
      (added.items || []).forEach((item, index) => {
        if (!item.productId) return;
        const p = s.products.find(x => x.id === item.productId);
        if (!p) return;
        const qty = num(item.baseQty) || num(item.qty);
        if (!(qty > 0)) return;
        const snapshot = before.get(p.id) || {avg:num(p.avgCost ?? p.cost), value:num(p.inventoryValue)};
        const unitCost = snapshot.avg;
        const cogs = qty * unitCost;
        item.costAtSale = unitCost;
        item.cogs = cogs;
        const costConfig = root.TameshkCurrency?.config(p);
        if (costConfig) {
          item.costCurrency = costConfig.currency;
          item.costCurrencyDecimals = costConfig.currencyDecimals;
          item.costCurrencyMismatch = !root.TameshkCurrency.sameCurrency(p,added);
        }
        item.costEstimated = false;
        const currentValue = Number.isFinite(Number(p.inventoryValue)) ? num(p.inventoryValue) : snapshot.value;
        p.inventoryValue = Math.max(0, currentValue - cogs);
        appendEvent({type:'sale', productId:p.id, quantity:qty, unitCost, totalCost:cogs,
          sourceId:added.id, occurredAt:added.createdAt || nowISO(), note:`${langText('ردیف','Line','بند')} ${index+1}`, estimated:false});
      });
      persist();
      return result;
    };
  }

  if (typeof root.saveProduct === 'function') {
    const oldSaveProduct = root.saveProduct;
    root.saveProduct = function (id) {
      const s = getState();
      const previous = id ? s?.products?.find(p => p.id === id) : null;
      const before = previous ? {
        stock:num(previous.stock), avg:Number.isFinite(Number(previous.avgCost)) ? num(previous.avgCost) : num(previous.cost),
        value:Number.isFinite(Number(previous.inventoryValue)) ? num(previous.inventoryValue) : num(previous.stock) * num(previous.avgCost ?? previous.cost),
        price:num(previous.price)
      } : null;
      const knownIds = new Set((s?.products || []).map(p => p.id));
      const result = oldSaveProduct.apply(this, arguments);
      let p = id ? s?.products?.find(x => x.id === id) : (s?.products || []).find(x => !knownIds.has(x.id));
      if (!p) return result;
      const stock = num(p.stock), cost = num(p.cost);
      if (!before) {
        p.avgCost = cost;
        p.inventoryValue = stock * cost;
        appendEvent({type:'opening_balance', productId:p.id, quantity:stock, unitCost:cost, totalCost:stock*cost,
          sourceId:`product:${p.id}`, occurredAt:nowISO(), note:langText('موجودی آغازین کالا','Initial product stock','المخزون الأولي للمنتج'), estimated:true});
      } else {
        const delta = stock - before.stock;
        if (delta > 0) {
          p.inventoryValue = before.value + delta * cost;
          p.avgCost = stock > 0 ? p.inventoryValue / stock : 0;
          appendEvent({type:'stock_adjustment', productId:p.id, quantity:delta, unitCost:cost, totalCost:delta*cost,
            sourceId:`product:${p.id}`, occurredAt:nowISO(), note:langText('افزایش دستی موجودی','Manual stock increase','زيادة يدوية للمخزون'), estimated:false, direction:'in'});
        } else if (delta < 0) {
          const qty = Math.abs(delta), unitCost = before.avg;
          p.inventoryValue = Math.max(0, before.value - qty * unitCost);
          p.avgCost = stock > 0 ? p.inventoryValue / stock : 0;
          appendEvent({type:'stock_adjustment', productId:p.id, quantity:qty, unitCost, totalCost:qty*unitCost,
            sourceId:`product:${p.id}`, occurredAt:nowISO(), note:langText('کاهش دستی موجودی','Manual stock decrease','خفض يدوي للمخزون'), estimated:false, direction:'out'});
        } else {
          p.avgCost = before.avg;
          p.inventoryValue = before.value;
        }
      }
      if (before && num(p.price) !== before.price) {
        appendEvent({type:'price_change', productId:p.id, quantity:stock, unitCost:num(p.price), totalCost:0,
          oldPrice:before.price, newPrice:num(p.price), sourceId:`product:${p.id}`, occurredAt:nowISO(),
          note:`${langText('تغییر قیمت فروش','Sale price change','تغيير سعر البيع')}: ${moneyText(before.price,p)} → ${moneyText(p.price,p)}`, estimated:false});
      }
      persist();
      return result;
    };
  }

  function returnedQty(transactionId, lineIndex) {
    return (ledger()?.events || []).filter(e => e.type === 'sale_return' && e.sourceId === transactionId && Number(e.lineIndex) === lineIndex).reduce((sum,e) => sum + num(e.quantity), 0);
  }
  function saleLines() {
    const s = getState();
    return (s?.transactions || []).flatMap(t => (t.items || []).map((item,index) => ({t,item,index})).filter(x => x.item.productId));
  }
  function returnsPanel() {
    const rows = saleLines().map(({t,item,index}) => {
      const sold = num(item.baseQty) || num(item.qty), returned = returnedQty(t.id,index), remaining = Math.max(0,sold-returned);
      const title = item.name || getState()?.products?.find(p=>p.id===item.productId)?.name || '';
      const disabled = remaining <= 1e-9 ? ' disabled' : '';
      return `<tr><td>${escText(t.date||'—')}</td><td>${escText(t.no||t.id||'')}</td><td>${escText(title)}</td><td>${qtyText(sold)}</td><td>${qtyText(returned)}</td><td>${qtyText(remaining)}</td><td><button class="btn small"${disabled} onclick="inventoryLedgerOpenReturn(this.dataset.tid,${index})" data-tid="${escText(t.id)}">${escText(langText('ثبت مرجوعی','Return item','إرجاع صنف'))}</button></td></tr>`;
    }).join('');
    return `<section class="panel" style="margin-top:15px"><div class="panel-title"><h2>${escText(langText('مرجوعی فروش','Sales returns','مرتجعات المبيعات'))}</h2><small>${escText(langText('مانده بر اساس فروش و مرجوعی‌های ثبت‌شده محاسبه می‌شود.','Remaining quantity is calculated from sales and recorded returns.','تُحسب الكمية المتبقية من المبيعات والمرتجعات المسجلة.'))}</small></div>${rows ? `<div class="table-wrap"><table><thead><tr><th>${escText(langText('تاریخ','Date','التاريخ'))}</th><th>${escText(langText('فاکتور','Invoice','الفاتورة'))}</th><th>${escText(langText('کالا','Item','الصنف'))}</th><th>${escText(langText('فروش (واحد پایه)','Sold (base units)','المباع (وحدات أساسية)'))}</th><th>${escText(langText('مرجوع‌شده','Returned','المرتجع'))}</th><th>${escText(langText('مانده','Remaining','المتبقي'))}</th><th>${escText(langText('عملیات','Action','الإجراء'))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${escText(langText('فروش کالای ثبت‌شده‌ای برای مرجوعی نیست.','No recorded product sales to return.','لا توجد مبيعات أصناف مسجلة للإرجاع.'))}</div>`}</section>`;
  }
  function addAfter(el, html) {
    if (!el) return;
    if (typeof el.insertAdjacentHTML === 'function') el.insertAdjacentHTML('beforeend', html);
    else el.innerHTML = (el.innerHTML || '') + html;
  }
  if (typeof root.transactionsPage === 'function') {
    const oldTransactionsPage = root.transactionsPage;
    root.transactionsPage = function (el) { const result = oldTransactionsPage.apply(this, arguments); addAfter(el, returnsPanel()); return result; };
  }

  function priceHistoryPanel() {
    const s = getState(), products = s?.products || [], transactions = s?.transactions || [];
    const locale = s?.settings?.language === 'en' ? 'en-GB' : s?.settings?.language === 'ar' ? 'ar-SA' : 'fa-IR';
    const fmtTime = ms => Number.isFinite(ms) ? new Intl.DateTimeFormat(locale, {dateStyle:'short', timeStyle:'short'}).format(new Date(ms)) : '—';
    const rows = [];
    for (const p of products) {
      const raw = (ledger()?.events || []).filter(e => e.type === 'price_change' && e.productId === p.id).map(e => ({at:Date.parse(e.occurredAt), old:num(e.oldPrice), price:num(e.newPrice),record:e}));
      for (const h of p.history || []) {
        const at = Date.parse(h.timestamp || (h.date ? `${h.date}T00:00:00Z` : ''));
        if (!Number.isFinite(at) || raw.some(x => x.at === at && x.old === num(h.old) && x.price === num(h.new))) continue;
        raw.push({at, old:num(h.old), price:num(h.new),record:h});
      }
      const changes = raw.filter(x => Number.isFinite(x.at)).sort((a,b) => a.at-b.at);
      if (!changes.length) continue;
      const periods = [{from:null,to:changes[0].at,price:changes[0].old,record:changes[0].record}];
      changes.forEach((change,index) => periods.push({from:change.at,to:changes[index+1]?.at ?? null,price:change.price,record:change.record}));
      for (const period of periods) {
        let sold = 0;
        for (const tx of transactions) {
          const at = Date.parse(tx.createdAt || (tx.date ? `${tx.date}T00:00:00Z` : ''));
          if (!Number.isFinite(at) || (period.from !== null && at < period.from) || (period.to !== null && at >= period.to)) continue;
          for (const item of tx.items || tx.lines || []) if (item.productId === p.id) sold += num(item.baseQty) || num(item.qty);
        }
        rows.push(`<tr><td>${escText(p.name||'')}</td><td>${moneyText(period.price,period.record)}</td><td>${period.from===null?escText(langText('پیش از نخستین تغییر','Before first change','قبل أول تغيير')):escText(fmtTime(period.from))}</td><td>${period.to===null?escText(langText('اکنون','Now','الآن')):escText(fmtTime(period.to))}</td><td>${qtyText(sold)} ${escText(p.baseUnit||p.unit||'')}</td></tr>`);
      }
    }
    return `<section class="panel" style="margin-top:15px"><div class="panel-title"><h2>${escText(langText('فروش به تفکیک دورهٔ قیمت','Sales by price period','المبيعات حسب فترة السعر'))}</h2><small>${escText(langText('از زمان تغییر قیمت به بعد؛ مقدار فروش بر پایهٔ واحد پایه از تراکنش‌ها محاسبه می‌شود.','Sales quantity per effective price period, calculated from transaction snapshots in base units.','كمية المبيعات لكل فترة سعر، محسوبة من لقطات المعاملات بالوحدات الأساسية.'))}</small></div><div class="table-wrap" data-tp-key="price-period-sales-ledger" data-tp-size="5"><table><thead><tr><th>${escText(langText('کالا','Item','الصنف'))}</th><th>${escText(langText('قیمت فروش','Sale price','سعر البيع'))}</th><th>${escText(langText('از زمان','From','من'))}</th><th>${escText(langText('تا زمان','Until','إلى'))}</th><th>${escText(langText('فروش در این دوره','Sold in period','المباع خلال الفترة'))}</th></tr></thead><tbody>${rows.join('')||`<tr><td colspan="5">${escText(langText('هنوز تغییر قیمت ثبت نشده است.','No price changes have been recorded yet.','لم يتم تسجيل تغييرات الأسعار بعد.'))}</td></tr>`}</tbody></table></div></section>`;
  }

  function inventoryPanel() {
    const s = getState(), products = s?.products || [], eventStamp = e => {const at=Date.parse(e?.occurredAt||'');if(Number.isFinite(at))return at;const created=Date.parse(e?.createdAt||'');return Number.isFinite(created)?created:0}, events = (ledger()?.events || []).slice().sort((a,b)=>eventStamp(b)-eventStamp(a)||(Date.parse(b?.createdAt||'')||0)-(Date.parse(a?.createdAt||'')||0)).slice(0,20);
    const value = products.reduce((sum,p)=>sum+num(p.inventoryValue),0);
    const cogs = (ledger()?.events || []).reduce((sum,e) => sum + (e.type==='sale' ? num(e.totalCost) : e.type==='sale_return' && e.restocked ? -num(e.totalCost) : e.type==='sale_edit_adjustment' ? (e.direction==='out'?num(e.totalCost):-num(e.totalCost)) : 0), 0);
    const productRows = products.map(p => `<tr><td>${escText(p.name||'')}</td><td>${qtyText(p.stock)} ${escText(p.baseUnit||p.unit||'')}</td><td>${moneyText(p.avgCost,p)}</td><td>${moneyText(p.inventoryValue,p)}</td></tr>`).join('');
    const eventRows = events.map(e => {
      const p = products.find(x=>x.id===e.productId);
      const typeName = ({opening_balance:langText('افتتاحیه','Opening','افتتاحي'),purchase_receipt:langText('خرید','Purchase','شراء'),sale:langText('فروش','Sale','بيع'),sale_return:langText('مرجوعی فروش','Sales return','مرتجع بيع'),stock_adjustment:langText('اصلاح موجودی','Adjustment','تسوية'),price_change:langText('تغییر قیمت','Price change','تغيير السعر')})[e.type] || e.type;
      return `<tr><td>${escText(formatEventTime(e.occurredAt||e.createdAt))}</td><td>${escText(typeName)}</td><td>${escText(p?.name||e.productId||'')}</td><td>${e.direction==='out'?'−':''}${qtyText(e.quantity)}</td><td>${moneyText(e.unitCost,e)}</td><td>${moneyText(e.totalCost,e)}</td><td>${escText(e.note||'')}${e.estimated?` <span class="tag neutral">${escText(langText('تخمینی','Estimated','تقديري'))}</span>`:''}</td></tr>`;
    }).join('');
    return `<section class="panel" style="margin-top:15px"><div class="panel-title"><h2>${escText(langText('دفتر رویداد انبار','Inventory event ledger','سجل أحداث المخزون'))}</h2><small>${escText(langText('فقط‌افزودنی · فقط روی همین مرورگر؛ پشتیبان‌گیری منظم لازم است. امنیت رمزنگاری‌شده یا دفتر قانونی نیست.','Append-only · stored in this browser only; back up regularly. Not encrypted or a statutory ledger.','إضافة فقط · محفوظ في هذا المتصفح فقط؛ يلزم نسخ احتياطي منتظم. ليس سجلاً مشفراً أو قانونياً.'))}</small></div><div class="grid stats"><div class="stat"><div class="label">${escText(langText('ارزش بهای موجودی','Inventory cost value','قيمة تكلفة المخزون'))}</div><div class="value">${groupedMoney(products,p=>p.inventoryValue)}</div></div><div class="stat"><div class="label">${escText(langText('بهای تمام‌شده فروش خالص','Net COGS','تكلفة المبيعات الصافية'))}</div><div class="value">${groupedMoney((ledger()?.events||[]).filter(e=>e.type==='sale'||e.type==='sale_return'&&e.restocked||e.type==='sale_edit_adjustment'),e=>e.type==='sale'||e.type==='sale_edit_adjustment'&&e.direction==='out'?e.totalCost:-num(e.totalCost))}</div></div><div class="stat"><div class="label">${escText(langText('رویدادها','Events','الأحداث'))}</div><div class="value">${qtyText(ledger()?.events?.length||0)}</div></div></div><h3>${escText(langText('ارزش و میانگین موزون کالاها','Product value and moving average','قيمة المنتجات ومتوسط التكلفة المتحرك'))}</h3><div class="table-wrap"><table data-tp-key="weighted-inventory-value" data-tp-size="5"><thead><tr><th>${escText(langText('کالا','Item','الصنف'))}</th><th>${escText(langText('موجودی','Stock','المخزون'))}</th><th>${escText(langText('میانگین واحد','Average unit cost','متوسط تكلفة الوحدة'))}</th><th>${escText(langText('ارزش موجودی','Inventory value','قيمة المخزون'))}</th></tr></thead><tbody>${productRows||`<tr><td colspan="4">—</td></tr>`}</tbody></table></div><h3>${escText(langText('۲۰ رویداد اخیر','Latest 20 events','آخر 20 حدثاً'))}</h3><div class="table-wrap"><table data-tp-key="inventory-ledger-events" data-tp-size="10"><thead><tr><th>${escText(langText('زمان','Time','الوقت'))}</th><th>${escText(langText('نوع','Type','النوع'))}</th><th>${escText(langText('کالا','Item','الصنف'))}</th><th>${escText(langText('تعداد پایه','Base qty','الكمية الأساسية'))}</th><th>${escText(langText('بهای واحد','Unit cost','تكلفة الوحدة'))}</th><th>${escText(langText('بهای کل','Total cost','التكلفة الإجمالية'))}</th><th>${escText(langText('یادداشت','Note','ملاحظة'))}</th></tr></thead><tbody>${eventRows||`<tr><td colspan="7">—</td></tr>`}</tbody></table></div>${priceHistoryPanel()}</section>`;
  }
  if (typeof root.inventoryPage === 'function') {
    const oldInventoryPage = root.inventoryPage;
    root.inventoryPage = function (el) { const result = oldInventoryPage.apply(this, arguments); addAfter(el, inventoryPanel()); return result; };
  }

  function openReturn(transactionId, lineIndex) {
    const s = getState(), t = s?.transactions?.find(x => x.id === transactionId), item = t?.items?.[lineIndex];
    if (!item || !item.productId) return;
    const sold = num(item.baseQty) || num(item.qty), already = returnedQty(transactionId,lineIndex), remaining = Math.max(0,sold-already);
    if (!(remaining > 1e-9)) { toast(langText('کل مقدار این قلم قبلاً مرجوع شده است.','This line has already been fully returned.','تم إرجاع كامل كمية هذا الصنف بالفعل.')); return; }
    const p = s.products.find(x=>x.id===item.productId);
    const html = `<input type="hidden" id="ledgerReturnTransactionId" value="${escText(transactionId)}"><div class="modal-head"><h2>${escText(langText('ثبت مرجوعی کالا','Record item return','تسجيل إرجاع الصنف'))}</h2><button class="close" onclick="closeModal()">×</button></div><p class="muted">${escText(item.name||p?.name||'')} · ${escText(langText('مانده قابل مرجوعی','Returnable remaining','المتبقي للإرجاع'))}: ${qtyText(remaining)} ${escText(item.baseUnit||p?.baseUnit||p?.unit||'')}</p><div class="form-grid"><div class="field"><label>${escText(langText('تعداد برگشتی (واحد پایه)','Return quantity (base units)','كمية الإرجاع (وحدات أساسية)'))}</label><input id="ledgerReturnQty" type="number" min="0.000001" max="${remaining}" step="any" value="${remaining}"></div><div class="field"><label for="ledgerReturnDate">${escText(langText('تاریخ ثبت مرجوعی','Return date','تاريخ الإرجاع'))}</label><input id="ledgerReturnDate" type="date" value="${escText(dateToday())}" required></div><div class="field"><label for="ledgerReturnTime">${escText(langText('زمان ثبت مرجوعی','Return time','وقت الإرجاع'))}</label><input id="ledgerReturnTime" type="time" step="1" value="${escText(localClock())}" required></div><div class="field wide"><label for="ledgerReturnNote">${escText(langText('توضیح','Note','ملاحظة'))}</label><input id="ledgerReturnNote" maxlength="300"></div></div><label class="field" style="display:flex;gap:8px;align-items:center"><input id="ledgerRestock" type="checkbox" checked> ${escText(langText('برگشت فیزیکی به انبار','Physically return to stock','إرجاع فعلي إلى المخزون'))}</label><div class="toolbar" style="justify-content:flex-end"><button class="btn" onclick="closeModal()">${escText(langText('انصراف','Cancel','إلغاء'))}</button><button class="btn primary" onclick="inventoryLedgerSubmitReturn(document.getElementById('ledgerReturnTransactionId').value,${lineIndex})">${escText(langText('ثبت مرجوعی و بازپرداخت','Record return and refund','تسجيل الإرجاع والاسترداد'))}</button></div>`;
    if (typeof root.openModal === 'function') root.openModal(html);
  }
  function submitReturn(transactionId, lineIndex) {
    const returnDate = root.document?.getElementById('ledgerReturnDate')?.value || dateToday();
    const returnTime = root.document?.getElementById('ledgerReturnTime')?.value || localClock();
    const occurredAt = validISODate(returnDate) && validClock(returnTime) ? localTimestamp(returnDate,returnTime) : '';
    if (!validISODate(returnDate) || !validClock(returnTime) || !occurredAt) { toast(langText('تاریخ و زمان مرجوعی معتبر نیست.','Enter a valid return date and time.','أدخل تاريخاً ووقتاً صالحين للإرجاع.')); return false; }
    // returns-management is the canonical return writer once the full app has loaded.
    // Keep this legacy entry point usable during partial/older loads, but avoid creating
    // a second, differently-shaped record when the canonical module is present.
    if (typeof root.TameshkReturnsManagement?.submitLegacyTransactionReturn === 'function') {
      return root.TameshkReturnsManagement.submitLegacyTransactionReturn(transactionId, lineIndex, {deferLotSync:true});
    }
    const s = getState(), t = s?.transactions?.find(x=>x.id===transactionId), item = t?.items?.[lineIndex];
    if (!item || !item.productId) return false;
    const input = root.document?.getElementById('ledgerReturnQty'), qty = Number(input?.value);
    const sold = num(item.baseQty) || num(item.qty), remaining = Math.max(0,sold-returnedQty(transactionId,lineIndex));
    if (!Number.isFinite(qty) || qty <= 0 || qty > remaining + 1e-9) {
      toast(langText('تعداد از ماندهٔ قابل مرجوعی بیشتر است یا معتبر نیست.','Quantity exceeds the returnable balance or is invalid.','الكمية تتجاوز المتبقي القابل للإرجاع أو غير صالحة.'));
      return false;
    }
    const p = s.products.find(x=>x.id===item.productId);
    if (!p) return false;
    const hadCost = Number.isFinite(Number(item.costAtSale)) || (Number.isFinite(Number(item.cogs)) && sold > 0);
    const unitCost = Number.isFinite(Number(item.costAtSale)) ? num(item.costAtSale) : Number.isFinite(Number(item.cogs)) && sold > 0 ? num(item.cogs)/sold : num(p.avgCost ?? p.cost);
    const estimated = !hadCost;
    const totalCost = qty * unitCost;
    const restock = !!root.document?.getElementById('ledgerRestock')?.checked;
    const note = root.document?.getElementById('ledgerReturnNote')?.value?.trim() || '';
    const soldBaseQty = num(item.baseQty) || num(item.qty) || 1;
    const lineGross = num(item.qty) * num(item.priceAtSale ?? item.price);
    const lineDiscount = Math.min(lineGross, Math.max(0, num(item.lineDiscount)));
    // Return only the returned quantity's share of the item's own net principal.
    // Do not refund invoice discounts, taxes, ancillary charges or ancillary tax.
    const monetaryRound = value => root.TameshkCurrency ? root.TameshkCurrency.round(value,t) : Math.round(value);
    const refund = Math.max(0, monetaryRound(Math.max(0, lineGross - lineDiscount) * Math.min(1, qty / soldBaseQty)));
    const productValue = Number.isFinite(Number(p.inventoryValue)) ? num(p.inventoryValue) : num(p.stock)*num(p.avgCost ?? p.cost);
    if (restock) {
      const nextStock = num(p.stock) + qty;
      p.inventoryValue = productValue + totalCost;
      p.stock = nextStock;
      p.avgCost = nextStock > 0 ? p.inventoryValue / nextStock : 0;
    }
    appendEvent({type:'sale_return', productId:p.id, quantity:qty, unitCost, totalCost, sourceId:t.id,
      occurredAt, note, estimated, lineIndex, restocked:restock});
    if (!Array.isArray(s.expenses)) s.expenses = [];
    s.expenses.push(inheritCurrency({id:newId('return'), title:`${langText('مرجوعی فروش','Sales return','مرتجع بيع')} · ${item.name||p.name}`,
      amount:refund, category:'مرجوعی فروش', date:returnDate, note:[t.no||t.id, note].filter(Boolean).join(' · ')},t));
    persist();
    if (typeof root.closeModal === 'function') root.closeModal();
    if (typeof root.render === 'function') root.render();
    toast(langText('مرجوعی و بازپرداخت ثبت شد.','Return and refund recorded.','تم تسجيل الإرجاع والاسترداد.'));
    return true;
  }

  function setStockFromBulkImport(productId, desiredStock, options) {
    const s = getState(), p = s?.products?.find(x => String(x.id) === String(productId));
    const next = Number(desiredStock), opts = options || {};
    if (!p || !Number.isFinite(next) || next < 0) return {ok:false, reason:'invalid'};
    const before = num(p.stock), delta = next - before;
    if (Math.abs(delta) < 1e-9) return {ok:true, changed:false, stock:before};
    const profiles = root.TameshkInventoryProfiles;
    // A product created/imported before expiry profiles were enabled can have
    // stock but no lot rows. Reconcile only missing physical balance (never
    // discard an over-recorded lot) before applying the requested delta.
    profiles?.ensureState?.();
    const lotBalance = () => (Array.isArray(p.lots) ? p.lots : []).reduce((sum, lot) => sum + Math.max(0, num(lot.remainingQty)), 0);
    const missingLots = before - lotBalance();
    if (profiles && missingLots > 1e-9) {
      profiles.addLot?.(p, missingLots, {enteredAt:nowISO(), entryNote:langText('همسان‌سازی موجودی پیشین با ریزمحموله‌ها','Reconcile legacy stock with expiry lots','مزامنة المخزون السابق مع دفعات الانتهاء')}, 'legacy-stock-reconciliation', true);
    }
    const beforeValue = Number.isFinite(Number(p.inventoryValue)) ? num(p.inventoryValue) : before * num(p.avgCost ?? p.cost);
    const avgCost = Number.isFinite(Number(p.avgCost)) ? Math.max(0,num(p.avgCost)) : Math.max(0,num(p.cost));
    let unitCost;
    if (delta > 0) {
      const suppliedCost = Number(opts.unitCost);
      unitCost = Number.isFinite(suppliedCost) && suppliedCost >= 0 ? suppliedCost : avgCost;
      p.inventoryValue = beforeValue + delta * unitCost;
      profiles?.addLot?.(p, delta, {enteredAt:nowISO(), entryNote:langText('افزایش گروهی از نرخ‌نامه','Bulk increase from rate sheet','زيادة جماعية من قائمة الأسعار')}, opts.reference || 'bulk-rate-sheet');
    } else {
      unitCost = avgCost;
      profiles?.moveLots?.(p, Math.abs(delta), opts.reference || 'bulk-rate-sheet');
      p.inventoryValue = Math.max(0, beforeValue - Math.abs(delta) * unitCost);
    }
    p.stock = next;
    p.avgCost = next > 0 ? p.inventoryValue / next : 0;
    appendEvent({type:'stock_adjustment', direction:delta > 0 ? 'in' : 'out', productId:p.id,
      quantity:Math.abs(delta), unitCost, totalCost:Math.abs(delta) * unitCost,
      sourceId:opts.sourceId || `bulk-rate-sheet:${Date.now()}`, occurredAt:nowISO(),
      note:opts.note || langText('اصلاح موجودی از ورود گروهی نرخ‌نامه','Stock adjustment from bulk rate-sheet import','تسوية المخزون من استيراد قائمة الأسعار دفعة واحدة'), estimated:false});
    if (opts.persist !== false) persist();
    const remainingLots = lotBalance();
    return {ok:true, changed:true, stock:next, delta, unitCost,
      lotBalance:remainingLots,
      lotBalanceConsistent:!profiles || Math.abs(remainingLots - next) <= 1e-9};
  }

  // The exposed object has no event-edit/delete operation; events are appended internally only.
  root.InventoryLedger = Object.freeze({openReturn, submitReturn, getEvents:() => (ledger()?.events || []).map(e => Object.assign({},e)), formatEventTime, initialize, setStockFromBulkImport});
  root.inventoryLedgerOpenReturn = openReturn;
  root.inventoryLedgerSubmitReturn = submitReturn;
})(typeof window !== 'undefined' ? window : globalThis);
