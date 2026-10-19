/* Offline donation page for the four user-provided wallet addresses and QR images. */
(function (root) {
  'use strict';
  if (!root?.document || root.TameshkDonation) return;
  const doc = root.document;
  const wallets = [
    { id: 'bitcoin', name: 'Bitcoin', address: 'bc1qxnmf3uud608lfvrsg3gfgmg2kwuheefz2tgupt', qr: 'wallet-qr/bitcoin.png', icon: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#f7931a"/><path fill="#fff" d="M30.8 21.2c.5-3.2-2-4.9-5.4-6l1.1-4.4-2.7-.7-1.1 4.3-2.2-.5 1.1-4.4-2.7-.7-1.1 4.4-5.6-1.4-.7 2.9 2.1.5c1.2.3 1.5.8 1.4 1.5l-3.1 12.3c-.2.5-.6.7-1.3.5l-2.1-.5-1.3 3 5.6 1.4-1.1 4.5 2.7.7 1.1-4.5 2.2.6-1.1 4.4 2.7.7 1.1-4.5c4.6.9 8 .5 9.4-3.6 1.1-3.3-.1-5.1-2.4-6.3 1.7-.4 3-1.6 3.4-4zm-5.9 8.4c-.8 3.2-6.2 1.5-7.9 1.1l1.4-5.6c1.7.4 7.4 1.2 6.5 4.5zm.8-8.5c-.7 2.9-5.3 1.4-6.8 1l1.3-5.1c1.5.4 6.2 1 5.5 4.1z"/></svg>' },
    { id: 'ethereum', name: 'Ethereum', address: '0x1353c563E8e9DF44DfCE0D6f9b61aFe55f06dD3b', qr: 'wallet-qr/ethereum.png', icon: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#68718a" d="M24 2 10 25l14 8 14-8L24 2z"/><path fill="#929bb0" d="m24 2 0 31 14-8L24 2z"/><path fill="#3d465e" d="m10 28 14 18 14-18-14 8-14-8z"/><path fill="#68718a" d="m24 36 0 10 14-18-14 8z"/></svg>' },
    { id: 'litecoin', name: 'Litecoin', address: 'ltc1qf80un55tm9ykne4qmfgh7a3zctqwwq5detzzls', qr: 'wallet-qr/litecoin.png', icon: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#345d9d"/><path fill="#fff" d="m30.8 14.1-2.1 8.2 4.8-1.7-1.1 4.2-4.8 1.7-1.7 6.6h11.3l-1.2 4.4H17.3l2.5-9.6-4.1 1.5 1.1-4.2 4.1-1.5 2.4-9.6z"/></svg>' },
    { id: 'solana', name: 'Solana', address: 'EmRi8vPu6vHLt7Wsy3XZitsg2qvHZYzxS5Qvbp9e1d1P', qr: 'wallet-qr/solana.png', icon: '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="tmSolana" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00ffa3"/><stop offset="1" stop-color="#9945ff"/></linearGradient></defs><path fill="url(#tmSolana)" d="M12 11h26l-5 6H7zm0 10h29l-5 6H7zm0 10h26l-5 6H7z"/></svg>' }
  ];
  const text = {
    fa: { title: 'کمک مالی به پروژه', lead: 'اگر این نرم‌افزار برای کسب‌وکار شما مفید بوده، می‌توانید از پروژه حمایت کنید.', qr: 'بارکد کیف پول', copy: 'کپی آدرس', copied: 'آدرس کپی شد.', copyFail: 'کپی خودکار ممکن نشد؛ آدرس را دستی انتخاب و کپی کنید.', network: 'شبکه', address: 'آدرس', zoom: 'نمایش بزرگ بارکد', close: 'بستن تصویر بارکد', note: 'هر QR فقط برای شبکهٔ درج‌شده در همان کارت است. پیش از هر انتقال، آدرس و شبکه را با کیف پول خود تطبیق دهید؛ ارسال روی شبکهٔ اشتباه ممکن است باعث از دست رفتن دارایی شود.' },
    en: { title: 'Support the project', lead: 'If this software helps your business, you can support the project.', qr: 'Wallet QR code', copy: 'Copy address', copied: 'Address copied.', copyFail: 'Automatic copy failed; select and copy the address manually.', network: 'Network', address: 'Address', zoom: 'Enlarge QR code', close: 'Close QR code image', note: 'Each QR code is for the network named on its card. Verify the address and network in your wallet before sending; using the wrong network may result in loss of funds.' },
    ar: { title: 'المساعدة في دعم المشروع', lead: 'إذا كان هذا البرنامج مفيداً لعملك، يمكنك دعم المشروع.', qr: 'رمز QR للمحفظة', copy: 'نسخ العنوان', copied: 'تم نسخ العنوان.', copyFail: 'تعذر النسخ تلقائياً؛ حدد العنوان وانسخه يدوياً.', network: 'الشبكة', address: 'العنوان', zoom: 'تكبير رمز QR', close: 'إغلاق صورة رمز QR', note: 'كل رمز QR خاص بالشبكة المذكورة على بطاقته. تحقق من العنوان والشبكة في محفظتك قبل الإرسال؛ قد يؤدي استخدام شبكة خاطئة إلى فقدان الأصول.' }
  };
  const lang = () => { const current = typeof state !== 'undefined' ? state : root.state; return ['fa', 'en', 'ar'].includes(current?.settings?.language) ? current.settings.language : 'en'; };
  const tr = key => (text[lang()] || text.en)[key] || text.en[key];
  const esc = value => typeof root.esc === 'function' ? root.esc(String(value)) : String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function page(el) {
    if (!el) return;
    const navButton=doc.querySelector('#nav [data-page="donation"]');if(navButton?.lastElementChild)navButton.lastElementChild.textContent=tr('title');
    const crumb=doc.getElementById('crumb');if(crumb&&doc.querySelector('#nav [data-page="donation"].active'))crumb.textContent=tr('title');
    el.innerHTML = `<div class="page-head"><div><h1>${tr('title')}</h1><p>${tr('lead')}</p></div></div><section class="donation-wallets" aria-label="${esc(tr('title'))}">${wallets.map(w => `<article class="panel donation-wallet" data-wallet="${w.id}"><div class="donation-wallet-heading">${w.icon}<div><h2>${w.name}</h2><small>${esc(tr('network'))} · ${w.name}</small></div></div><div class="donation-wallet-body"><button type="button" class="donation-qr-trigger" data-zoom-qr="${w.id}" aria-label="${esc(tr('zoom'))} · ${w.name}"><span class="donation-qr-wrap"><img class="donation-qr" src="${w.qr}" alt="${esc(w.name)} · ${esc(tr('qr'))}" width="184" height="184" loading="eager"></span></button><div class="donation-address"><label for="wallet-${w.id}">${esc(w.name)} · ${esc(tr('address'))}</label><code id="wallet-${w.id}" dir="ltr" translate="no">${w.address}</code><button class="btn primary" type="button" data-copy-wallet="${w.id}">${tr('copy')}</button></div></div></article>`).join('')}<p class="notice donation-network-warning">${tr('note')}</p></section>`;
  }
  let activeQrDialog = null, lastQrTrigger = null;
  function closeQr() { if (!activeQrDialog) return false; const dialog = activeQrDialog; activeQrDialog = null; dialog.remove?.(); if (lastQrTrigger?.focus) lastQrTrigger.focus(); lastQrTrigger = null; return true; }
  function openQr(id, trigger = null) {
    const wallet = wallets.find(item => item.id === id); if (!wallet) return false;
    closeQr(); lastQrTrigger = trigger;
    const layer = doc.createElement('div'); layer.className = 'donation-qr-dialog-backdrop'; layer.setAttribute('data-qr-backdrop', '');
    layer.innerHTML = `<section class="donation-qr-dialog" role="dialog" aria-modal="true" aria-label="${esc(tr('zoom'))} · ${esc(wallet.name)}"><button type="button" class="donation-qr-close" data-close-qr aria-label="${esc(tr('close'))}" title="${esc(tr('close'))}">×</button><h2>${esc(wallet.name)} · ${esc(tr('qr'))}</h2><img src="${wallet.qr}" alt="${esc(wallet.name)} · ${esc(tr('qr'))}"></section>`;
    activeQrDialog = layer; doc.body.appendChild(layer); layer.querySelector?.('[data-close-qr]')?.focus?.(); return true;
  }
  async function copy(id) {
    const wallet = wallets.find(item => item.id === id || item.address === id);
    if (!wallet) return false;
    try {
      if (root.navigator?.clipboard?.writeText) await root.navigator.clipboard.writeText(wallet.address);
      else {
        const input = doc.createElement('textarea'); input.value = wallet.address; input.style.position = 'fixed'; input.style.opacity = '0'; doc.body.appendChild(input); input.select();
        const ok = doc.execCommand('copy'); input.remove(); if (!ok) throw new Error('copy failed');
      }
      root.showToast?.(tr('copied')); return true;
    } catch (_) { root.showToast?.(tr('copyFail')); return false; }
  }
  function init() {
    const nav = doc.getElementById('nav');
    if (nav && !nav.querySelector('[data-page="donation"]')) { const b = doc.createElement('button'); b.dataset.page = 'donation'; b.innerHTML = '<span class="ico" aria-hidden="true">♥</span><span></span>'; b.lastElementChild.textContent = tr('title'); nav.appendChild(b); }
    if (!doc.getElementById('tameshk-donation-style')) { const style = doc.createElement('style'); style.id = 'tameshk-donation-style'; style.textContent = '.donation-wallets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:1120px}.donation-wallet{margin:0;min-width:0;padding:16px}.donation-wallet-heading{display:flex;align-items:center;gap:11px;margin-bottom:13px}.donation-wallet-heading svg{width:42px;height:42px;flex:0 0 42px}.donation-wallet-heading h2{margin:0;font-size:16px}.donation-wallet-heading small{color:var(--muted,#62747c)}.donation-wallet-body{display:grid;grid-template-columns:184px minmax(0,1fr);align-items:center;gap:14px}.donation-qr-trigger{display:block;width:100%;padding:0;border:0;background:transparent;text-align:inherit;cursor:zoom-in}.donation-qr-wrap{display:block;padding:5px;border:1px solid var(--line);border-radius:12px;background:#fff}.donation-qr{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:contain}.donation-address{min-width:0;display:grid;gap:8px}.donation-address label{font-weight:700;font-size:12px}.donation-address code{display:block;padding:10px;background:#f4f7f8;border:1px solid var(--line);border-radius:9px;overflow-wrap:anywhere;font-size:12px;text-align:left}.donation-network-warning{grid-column:1/-1;margin:0;line-height:1.8}.donation-wallet .btn{white-space:nowrap}.donation-qr-dialog-backdrop{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:#061722b8}.donation-qr-dialog{position:relative;width:min(94vw,620px);max-height:92vh;overflow:auto;padding:26px 20px 20px;border-radius:18px;background:var(--card,#fff);box-shadow:0 18px 70px #0006;text-align:center}.donation-qr-dialog h2{margin:0 40px 14px;font-size:18px}.donation-qr-dialog>img{display:block;width:min(78vw,520px);max-width:100%;max-height:76vh;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;margin:0 auto;background:#fff;border-radius:10px}.donation-qr-close{position:absolute;inset-inline-end:10px;top:10px;width:38px;height:38px;border:0;border-radius:50%;background:var(--bg,#eef3f4);color:var(--ink,#172e3d);font-size:28px;line-height:1;cursor:pointer}@media(max-width:800px){.donation-wallets{grid-template-columns:1fr}}@media(max-width:520px){.donation-wallet-body{grid-template-columns:minmax(110px,38%) minmax(0,1fr);gap:9px}.donation-wallet{padding:11px}.donation-wallet-heading svg{width:36px;height:36px;flex-basis:36px}.donation-address code{font-size:10px;padding:8px}.donation-wallet .btn{font-size:11px;padding:8px}}'; doc.head.appendChild(style); }
    doc.addEventListener('click', event => { const close = event.target?.closest?.('[data-close-qr]'); if (close || (activeQrDialog && event.target === activeQrDialog)) { event.preventDefault(); closeQr(); return; } const zoom = event.target?.closest?.('[data-zoom-qr]'); if (zoom) { event.preventDefault(); openQr(zoom.dataset.zoomQr, zoom); return; } const button = event.target?.closest?.('[data-copy-wallet]'); if (button) { event.preventDefault(); copy(button.dataset.copyWallet); } });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape' && activeQrDialog) { event.preventDefault(); closeQr(); } });
    const original = root.render;
    if (typeof original === 'function' && !original.__donationWrapped) { const wrapped = function () { const out = original.apply(this, arguments); if (doc.querySelector('#nav [data-page="donation"].active')) page(doc.getElementById('content')); return out; }; wrapped.__donationWrapped = true; root.render = wrapped; }
    const oldGo = root.go;
    if (typeof oldGo === 'function' && !oldGo.__donationWrapped) { const wrapped = function (which) { const out = oldGo.apply(this, arguments); if (which === 'donation') { const crumb = doc.getElementById('crumb'); if (crumb) crumb.textContent = tr('title'); page(doc.getElementById('content')); } return out; }; wrapped.__donationWrapped = true; root.go = wrapped; }
  }
  root.TameshkDonation = Object.freeze({ wallets: wallets.map(({ id, name, address, qr }) => ({ id, name, address, qr })), copy, openQr, closeQr, render: () => page(doc.getElementById('content')) });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})(window);
