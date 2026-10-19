/* Tameshk offline help center. Standalone: integration only needs to load this file and provide #helpButton. */
(function (root) {
  'use strict';
  if (!root || root.TameshkHelpCenter) return;

  var doc = root.document;
  var GITHUB_URL = 'https://github.com/cloudinnet/Tameshk-Accounting';
  var PACKAGE_FALLBACK_VERSION = '1.50.7';
  var previouslyFocused = null;
  var helpIsOpen = false;
  var observer = null;

  /* Every visible/localizable source key used below is Persian and goes through uiText(). */
  var SOURCE_STRINGS = [
    'راهنمای حسابداری تمشک',
    'هر سه گزینه فقط نحوهٔ نمایش یا ورود را تنظیم می‌کنند.',
    'زبان انگلیسی در آغاز پیش‌فرض است و تغییر زبان همان لحظه متن صفحهٔ آغازین را عوض می‌کند.',
    'پروفایل بی‌نام با زبان انتخاب‌شده نام می‌گیرد و بدون تصویر، حرف اول نام نشان داده می‌شود.',
    'اعداد ردیف بالا و صفحه‌کلید عددی هم‌ارزند.',
    'فقط وقتی برنامه باز است',
    'تغییر تقویم، تاریخ‌های ذخیره‌شده را بازنویسی نمی‌کند.',
    'راهنمای مسیرهای تنظیمات',
    'مسیرهای مدیریت',
    'پشتیبان و امکانات',
    'تم و چیدمان',
    'تاریخ‌ها',
    'فونت‌های رابط برنامه',
    'تقویم پیش‌فرض گزارش‌ها',
    'دسترسی سریع با صفحه‌کلید',
    'فقط وقتی برنامه باز است',
    'اعداد ردیف بالا و صفحه‌کلید عددی',
    'نام پروفایل و زبان',
    'کمک مالی و نشانی کیف‌پول‌ها',
    'امکانات اختیاری',
    'موضوع‌های راهنما',
    'باز کردن موضوع',
    'بستن راهنما',
    'مسیر تنظیم امکانات',
    'پنل مدیریت',
    'پشتیبان و امکانات',
    'پیش‌فرض‌ها و قابلیت‌های اختیاری',
    'ساده‌سازی محیط و قابلیت‌های اختیاری',
    'امکانات اختیاری در این بخش تنظیم می‌شوند.',
    'تیک‌دار یعنی قابلیت غیرفعال و پنهان است.',
    'برای فعال‌کردن، تیک را بردارید و ذخیره کنید؛ داده‌های قبلی حذف نمی‌شوند.',
    'بهای تمام‌شدهٔ اختیاری',
    'قیمت جانبی اختیاری',
    'به‌روزرسانی دسته‌ای قیمت کالا و خدمت',
    'پنل کالاها و موجودی',
    'از پنل کالاها و موجودی یا پنل مدیریت، بخش به‌روزرسانی دسته‌ای قیمت کالا و خدمت را باز کنید.',
    'فایل CSV یا XLSX نرخ‌نامه را با ستون‌های عنوان کالا/خدمت، قیمت فروش، قیمت هزینه‌شده و هزینه‌های جانبی وارد کنید.',
    'عنوان کالا/خدمت',
    'قیمت فروش',
    'قیمت هزینه‌شده',
    'هزینه‌های جانبی',
    'پیش‌نمایش ردیف‌ها، موارد قابل اعمال و مواردی را که نیاز به بررسی دارند نشان می‌دهد.',
    'پس از تأیید، گزینه‌های پشتیبانی‌شده و تغییرهای آماده در پیش‌نمایش اعمال می‌شوند.',
    'ورود فایل نرخ‌نامه',
    'بررسی ردیف‌ها و اعمال تغییرهای آماده',
    'دربارهٔ برنامه',
    'نسخه',
    'بارکد',
    'خدمات',
    'نام پروفایل و زبان',
    'ساده‌سازی محیط و ابزارک دسکتاپ در پیش‌فرض‌ها و قابلیت‌های اختیاری قرار دارد.',
    'نمایش تاریخ، تقویم ورود تراکنش و هزینه و تقویم پیش‌فرض گزارش‌ها',
    'میانبرها را در پشتیبان و امکانات تنظیم کنید؛ برای هر بخش دکمهٔ ضبط را بزنید. ترکیب‌ها Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 هستند. ردیف عددی و صفحه‌کلید عددی معادل‌اند و میانبرها فقط زمانی اجرا می‌شوند که برنامه باز باشد.',
    'نسخهٔ نصب‌شدهٔ برنامه نمایش داده می‌شود و با به‌روزرسانی نرم‌افزار تغییر می‌کند.',
    'نمایش پروژه در GitHub',
    'بررسی به‌روزرسانی',
    'در حال بررسی به‌روزرسانی…',
    'برنامه به‌روز است.',
    'نسخهٔ تازه پیدا شد:',
    'مشاهدهٔ نسخهٔ تازه',
    'بررسی به‌روزرسانی ممکن نشد.',
    'برای بررسی به‌روزرسانی آنلاین شوید.',
    'راهنمای امکانات اختیاری',
    'راهنمای نرخ‌نامه',
    'نسخه',
    'بارکد',
    'خدمات',
    'نام پروفایل و زبان',
    'ساده‌سازی محیط و ابزارک دسکتاپ در پیش‌فرض‌ها و قابلیت‌های اختیاری قرار دارد.',
    'نمایش تاریخ، تقویم ورود تراکنش و هزینه و تقویم پیش‌فرض گزارش‌ها',
    'میانبرها را در پشتیبان و امکانات تنظیم کنید؛ برای هر بخش دکمهٔ ضبط را بزنید. ترکیب‌ها Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 هستند. ردیف عددی و صفحه‌کلید عددی معادل‌اند و میانبرها فقط زمانی اجرا می‌شوند که برنامه باز باشد.',
    'قلم کالا',
    'محصول',
    'لوازم‌التحریر',
    'کاغذ A4',
    'چاپ رنگی',
    'شناسه/کد',
    'عنوان کالا/خدمت',
    'قیمت فروش',
    'قیمت هزینه‌شده',
    'هزینه‌های جانبی',
    'موجودی',
    'از پنل مدیریت، بخش دسته‌ها و بارکد، یا از صفحهٔ انبارداری، ابزار به‌روزرسانی دسته‌ای قیمت کالا و خدمت را باز کنید.',
    'خانهٔ خالی یا صفر، مقدار موجود را نگه می‌دارد؛ «-» یا «/» عدد را صریحاً صفر می‌کند. تغییر موجودی کالای موجود از دفتر رویداد انبار ثبت می‌شود.',
    'پس از تأیید، فقط تغییرهای آماده در فهرست کالاها و خدمات اعمال می‌شوند.',
    'برای هر بخش، با دکمهٔ ضبط یک میانبر یکتای Ctrl + Alt + رقم یا F2، F3 و F5 تا F10 انتخاب کنید.',
    'برای کمک مالی از منوی اصلی وارد بخش کمک مالی شوید؛ پیش از ارسال، شبکه را با آدرس و QR همان کارت تطبیق دهید.',
    'از پنل مدیریت، بخش دسته‌ها و بارکد، یا از صفحهٔ انبارداری، ابزار به‌روزرسانی دسته‌ای قیمت کالا و خدمت را باز کنید.',
    'نحوهٔ فعال‌کردن/غیرفعال‌کردن نمایش قابلیت‌های اضافه',
    'نحوهٔ واردکردن/به‌روزرسانی دسته‌ای قیمت کالاها/خدمات',
    'دربارهٔ نرم‌افزار',
    'ستون‌های فایل نرخ‌نامه: نوع، عنوان، دسته، شناسه/کد، قیمت فروش، بهای تمام‌شده، هزینه‌های جانبی و موجودی است. برای ساخت قلم تازه نوع و عنوان لازم است.',
    'خانهٔ خالی یا صفر، مقدار موجود را نگه می‌دارد؛ «-» یا «/» عدد را صریحاً صفر می‌کند. تغییر موجودی کالای موجود از دفتر رویداد انبار ثبت می‌شود.',
    'راهنما: نوع، عنوان، دسته، کد، فروش، هزینه، جانبی و موجودی'
  ];

  function tr(source) {
    return typeof root.uiText === 'function' ? root.uiText(source) : source;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function lang() {
    var value = typeof root.uiLanguage === 'function' ? root.uiLanguage() : '';
    if (value === 'fa' || value === 'ar' || value === 'en') return value;
    return doc.documentElement && doc.documentElement.lang === 'en' ? 'en' : 'fa';
  }

  function version() {
    var announced = root.TAMESHK_APP_VERSION;
    if (announced != null && String(announced).trim()) return String(announced).trim();
    var packageVersion = root.TAMESHK_PACKAGE_VERSION || (root.TAMESHK_PACKAGE && root.TAMESHK_PACKAGE.version);
    return packageVersion != null && String(packageVersion).trim() ? String(packageVersion).trim() : PACKAGE_FALLBACK_VERSION;
  }

  var versionRequest = 0;
  function syncInstalledVersion() {
    var bridge = root.tameshkDesktop;
    if (!bridge || typeof bridge.getAppVersion !== 'function') return;
    var request = ++versionRequest;
    Promise.resolve().then(function () { return bridge.getAppVersion(); }).then(function (installed) {
      var value = String(installed || '').trim();
      if (request !== versionRequest || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value)) return;
      root.TAMESHK_APP_VERSION = value;
      var node = doc.querySelector('[data-help-root] .tm-help-version');
      if (helpIsOpen && node) node.textContent = value;
    }).catch(function () {});
  }

  function settingsIllustration() {
    return '<svg class="tm-help-illustration" viewBox="0 0 720 350" role="img" aria-label="' + esc(tr('راهنمای امکانات اختیاری')) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="helpSettingsBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2faf8"/><stop offset="1" stop-color="#f7f8fc"/></linearGradient></defs>' +
      '<rect width="720" height="350" rx="18" fill="url(#helpSettingsBg)"/><rect x="18" y="16" width="684" height="318" rx="15" fill="#fff" stroke="#dce7e8"/>' +
      '<text x="360" y="48" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="17" font-weight="700" fill="#173848">' + esc(tr('ساده‌سازی محیط و قابلیت‌های اختیاری')) + '</text>' +
      '<text x="360" y="73" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="11" fill="#526972">' + esc(tr('پنل مدیریت')) + '  ‹  ' + esc(tr('پیش‌فرض‌ها و قابلیت‌های اختیاری')) + '</text>' +
      '<rect x="40" y="88" width="640" height="35" rx="8" fill="#eef7f5"/><text x="360" y="111" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" font-weight="700" fill="#147d77">' + esc(tr('امکانات اختیاری')) + '</text>' +
      '<rect x="40" y="132" width="640" height="43" rx="9" fill="#fbfcfc" stroke="#e5ecec"/><rect x="40" y="181" width="640" height="43" rx="9" fill="#fbfcfc" stroke="#e5ecec"/><rect x="40" y="230" width="640" height="43" rx="9" fill="#fbfcfc" stroke="#e5ecec"/><rect x="40" y="279" width="640" height="43" rx="9" fill="#fbfcfc" stroke="#e5ecec"/>' +
      '<rect x="635" y="144" width="22" height="20" rx="5" fill="#147d77"/><path d="M641 154l4 4 7-8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="560" y="159" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('ثبت هزینه')) + '</text>' +
      '<rect x="635" y="193" width="22" height="20" rx="5" fill="#fff" stroke="#9dafb5"/><text x="560" y="208" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('بارکد')) + '</text>' +
      '<rect x="635" y="242" width="22" height="20" rx="5" fill="#147d77"/><path d="M641 252l4 4 7-8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="560" y="257" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('بهای تمام‌شدهٔ اختیاری')) + '</text>' +
      '<rect x="635" y="291" width="22" height="20" rx="5" fill="#fff" stroke="#9dafb5"/><text x="560" y="306" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('قیمت جانبی اختیاری')) + '</text></svg>';
  }

  function settingsMapIllustration() {
    return '<svg class="tm-help-illustration" viewBox="0 0 720 230" role="img" aria-label="' + esc(tr('راهنمای مسیرهای تنظیمات')) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="720" height="230" rx="18" fill="#f5f8f8"/><rect x="18" y="18" width="684" height="194" rx="14" fill="#fff" stroke="#dce7e8"/>' +
      '<rect x="38" y="45" width="198" height="140" rx="12" fill="#f5fbf9" stroke="#c8e5df"/><rect x="261" y="45" width="198" height="140" rx="12" fill="#f5fbf9" stroke="#c8e5df"/><rect x="484" y="45" width="198" height="140" rx="12" fill="#f5fbf9" stroke="#c8e5df"/>' +
      '<text x="137" y="76" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="15" font-weight="700" fill="#147d77">' + esc(tr('تم و چیدمان')) + '</text>' +
      '<text x="137" y="108" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('فونت‌های رابط برنامه')) + '</text>' +
      '<text x="360" y="76" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="11.5" font-weight="700" fill="#147d77">' + esc(tr('پیش‌فرض‌ها و قابلیت‌های اختیاری')) + '</text>' +
      '<text x="360" y="108" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('پیش‌فرض‌های فروشنده برای فاکتور')) + '</text>' +
      '<text x="360" y="132" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('ابزارک دسکتاپ')) + '</text>' +
      '<text x="583" y="76" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="15" font-weight="700" fill="#147d77">' + esc(tr('تاریخ‌ها')) + '</text>' +
      '<text x="583" y="108" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('نمایش تاریخ')) + '</text>' +
      '<text x="583" y="132" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="12" fill="#435860">' + esc(tr('تقویم پیش‌فرض گزارش‌ها')) + '</text>' +
      '<path d="M236 115h25m198 0h25" stroke="#e9ac5b" stroke-width="3" stroke-linecap="round"/><path d="m254 109 7 6-7 6m216-12-7 6 7 6" fill="none" stroke="#e9ac5b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function spreadsheetIllustration() {
    var columns = [
      {x:34,w:83,label:'نوع',value1:'محصول',value2:'خدمت'},
      {x:117,w:105,label:'شناسه/کد',value1:'1001',value2:'S-02'},
      {x:222,w:145,label:'عنوان کالا/خدمت',value1:'کاغذ A4',value2:'چاپ رنگی'},
      {x:367,w:92,label:'دسته',value1:'لوازم‌التحریر',value2:'خدمات'},
      {x:459,w:105,label:'قیمت فروش',value1:'2500',value2:'18000'},
      {x:564,w:112,label:'قیمت هزینه‌شده',value1:'1400',value2:'0'},
      {x:676,w:112,label:'هزینه‌های جانبی',value1:'0',value2:'500'},
      {x:788,w:94,label:'موجودی',value1:'450',value2:'∞'}
    ];
    var grid = '<path d="M34 66h848M34 116h848M34 166h848M34 216h848" stroke="#dce7e8"/>' + columns.slice(0, -1).map(c => '<path d="M' + (c.x+c.w) + ' 32v184" stroke="#dce7e8"/>').join('');
    var headers = columns.map(c => '<text x="' + (c.x+c.w/2) + '" y="54" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="10" font-weight="700" fill="#147d77">' + esc(tr(c.label)) + '</text>').join('');
    var cells = columns.map(c => '<text x="' + (c.x+c.w/2) + '" y="96" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="10" fill="#52636d">' + esc(tr(c.value1)) + '</text><text x="' + (c.x+c.w/2) + '" y="146" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="10" fill="#52636d">' + esc(tr(c.value2)) + '</text>').join('');
    return '<svg class="tm-help-illustration" viewBox="0 0 916 292" role="img" aria-label="' + esc(tr('راهنمای نرخ‌نامه')) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="916" height="292" rx="18" fill="#f5f8f8"/><rect x="18" y="18" width="880" height="205" rx="12" fill="#fff" stroke="#dce7e8"/><rect x="18" y="18" width="880" height="48" rx="12" fill="#e1f3ef"/><rect x="18" y="52" width="880" height="14" fill="#e1f3ef"/>' + grid + headers + cells +
      '<path d="M458 235v17m0 0-7-7m7 7 7-7" stroke="#147d77" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="249" y="255" width="418" height="27" rx="9" fill="#147d77"/><text x="458" y="273" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="11" font-weight="700" fill="#fff">' + esc(tr('بررسی ردیف‌ها و اعمال تغییرهای آماده')) + '</text></svg>';
  }

  function topicLink(id, label, selected) {
    return '<a id="tm-help-link-' + id + '" href="#tm-help-topic-' + id + '" class="tm-help-topic' + (selected ? ' is-selected' : '') + '" data-help-topic="' + id + '" role="tab" aria-selected="' + (selected ? 'true' : 'false') + '" aria-controls="tm-help-topic-' + id + '" title="' + esc(tr('باز کردن موضوع')) + '">' + esc(tr(label)) + '</a>';
  }

  function panel(id, title, content, image, selected) {
    return '<section id="tm-help-topic-' + id + '" class="tm-help-panel" data-help-panel="' + id + '" role="tabpanel" aria-labelledby="tm-help-link-' + id + '" aria-hidden="' + (selected ? 'false' : 'true') + '"' + (selected ? '' : ' hidden') + '><h3>' + esc(tr(title)) + '</h3>' + content + image + '</section>';
  }

  function markup() {
    var directionLanguage = lang();
    var optional = '<p>' + esc(tr('امکانات اختیاری در این بخش تنظیم می‌شوند.')) + '</p><p class="tm-help-path"><strong>' + esc(tr('مسیر تنظیم امکانات')) + ':</strong> ' + esc(tr('پنل مدیریت')) + ' → ' + esc(tr('پیش‌فرض‌ها و قابلیت‌های اختیاری')) + ' → ' + esc(tr('ساده‌سازی محیط و قابلیت‌های اختیاری')) + ' → ' + esc(tr('امکانات اختیاری')) + '</p><p class="tm-help-note">' + esc(tr('تیک‌دار یعنی قابلیت غیرفعال و پنهان است.')) + '</p><p>' + esc(tr('برای فعال‌کردن، تیک را بردارید و ذخیره کنید؛ داده‌های قبلی حذف نمی‌شوند.')) + '</p>';
    var rates = '<p>' + esc(tr('از پنل مدیریت، بخش دسته‌ها و بارکد، یا از صفحهٔ انبارداری، ابزار به‌روزرسانی دسته‌ای قیمت کالا و خدمت را باز کنید.')) + '</p><p>' + esc(tr('ستون‌های فایل نرخ‌نامه: نوع، عنوان، دسته، شناسه/کد، قیمت فروش، بهای تمام‌شده، هزینه‌های جانبی و موجودی است. برای ساخت قلم تازه نوع و عنوان لازم است.')) + '</p><p>' + esc(tr('خانهٔ خالی یا صفر، مقدار موجود را نگه می‌دارد؛ «-» یا «/» عدد را صریحاً صفر می‌کند. تغییر موجودی کالای موجود از دفتر رویداد انبار ثبت می‌شود.')) + '</p><p>' + esc(tr('پیش‌نمایش ردیف‌ها، موارد قابل اعمال و مواردی را که نیاز به بررسی دارند نشان می‌دهد.')) + '</p><p>' + esc(tr('پس از تأیید، فقط تغییرهای آماده در فهرست کالاها و خدمات اعمال می‌شوند.')) + '</p><h4>' + esc(tr('ورود فایل نرخ‌نامه')) + '</h4>';
    var settingsMap = '<p><strong>' + esc(tr('پیش‌فرض‌های فروشنده برای فاکتور')) + ':</strong> ' + esc(tr('پنل مدیریت')) + ' → ' + esc(tr('پیش‌فرض‌ها و قابلیت‌های اختیاری')) + '.</p>' +
      '<p><strong>' + esc(tr('فونت‌های رابط برنامه')) + ':</strong> ' + esc(tr('پنل مدیریت')) + ' → ' + esc(tr('تم و چیدمان')) + '.</p>' +
      '<p><strong>' + esc(tr('نمایش تاریخ، تقویم ورود تراکنش و هزینه و تقویم پیش‌فرض گزارش‌ها')) + ':</strong> ' + esc(tr('پنل مدیریت')) + ' → ' + esc(tr('تاریخ‌ها')) + '. ' + esc(tr('هر سه گزینه فقط نحوهٔ نمایش یا ورود را تنظیم می‌کنند.')) + '</p>' +
      '<p>' + esc(tr('ساده‌سازی محیط و ابزارک دسکتاپ در پیش‌فرض‌ها و قابلیت‌های اختیاری قرار دارد.')) + '</p>' +
      '<p><strong>' + esc(tr('دسترسی سریع با صفحه‌کلید')) + ':</strong> ' + esc(tr('پشتیبان و امکانات')) + '. ' + esc(tr('میانبرها را در پشتیبان و امکانات تنظیم کنید؛ برای هر بخش دکمهٔ ضبط را بزنید. ترکیب‌ها Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 هستند. ردیف عددی و صفحه‌کلید عددی معادل‌اند و میانبرها فقط زمانی اجرا می‌شوند که برنامه باز باشد.')) + '</p>' +
      '<p><strong>' + esc(tr('نام پروفایل و زبان')) + ':</strong> ' + esc(tr('زبان انگلیسی در آغاز پیش‌فرض است و تغییر زبان همان لحظه متن صفحهٔ آغازین را عوض می‌کند.')) + ' ' + esc(tr('پروفایل بی‌نام با زبان انتخاب‌شده نام می‌گیرد و بدون تصویر، حرف اول نام نشان داده می‌شود.')) + '</p>' +
      '<p><strong>' + esc(tr('کمک مالی و نشانی کیف‌پول‌ها')) + ':</strong> ' + esc(tr('برای کمک مالی از منوی اصلی وارد بخش کمک مالی شوید؛ پیش از ارسال، شبکه را با آدرس و QR همان کارت تطبیق دهید.')) + '</p>' +
      '<p class="tm-help-note">' + esc(tr('تغییر تقویم، تاریخ‌های ذخیره‌شده را بازنویسی نمی‌کند.')) + '</p>';
    var about = '<p><strong>' + esc(tr('نسخه')) + ':</strong> <span class="tm-help-version">' + esc(version()) + '</span></p><p>' + esc(tr('نسخهٔ برنامه از مقدار اعلام‌شدهٔ برنامه یا نسخهٔ بستهٔ دسکتاپ خوانده می‌شود.')) + '</p><p><a class="tm-help-github" href="' + GITHUB_URL + '" target="_blank" rel="noopener noreferrer">' + esc(tr('نمایش پروژه در GitHub')) + '</a></p><button type="button" class="btn tm-help-update">' + esc(tr('بررسی به‌روزرسانی')) + '</button><span class="tm-help-update-status" role="status" aria-live="polite"></span>';
    return '<div class="tm-help-modal" data-help-root data-help-lang="' + esc(directionLanguage) + '"><div class="modal-head"><h2>' + esc(tr('راهنمای حسابداری تمشک')) + '</h2><button type="button" class="close tm-help-close" data-help-close aria-label="' + esc(tr('بستن راهنما')) + '">×</button></div><div class="tm-help-layout" data-help-language="' + esc(directionLanguage) + '"><nav class="tm-help-links" aria-label="' + esc(tr('موضوع‌های راهنما')) + '" role="tablist">' + topicLink('optional-features', 'نحوهٔ فعال‌کردن/غیرفعال‌کردن نمایش قابلیت‌های اضافه', true) + topicLink('settings-map', 'راهنمای مسیرهای تنظیمات', false) + topicLink('batch-price', 'نحوهٔ واردکردن/به‌روزرسانی دسته‌ای قیمت کالاها/خدمات', false) + topicLink('about', 'دربارهٔ نرم‌افزار', false) + '</nav><div class="tm-help-content">' + panel('optional-features', 'نحوهٔ فعال‌کردن/غیرفعال‌کردن نمایش قابلیت‌های اضافه', optional, settingsIllustration(), true) + panel('settings-map', 'راهنمای مسیرهای تنظیمات', settingsMap, settingsMapIllustration(), false) + panel('batch-price', 'نحوهٔ واردکردن/به‌روزرسانی دسته‌ای قیمت کالاها/خدمات', rates, spreadsheetIllustration(), false) + panel('about', 'دربارهٔ نرم‌افزار', about, '', false) + '</div></div></div>';
  }

  function injectStyle() {
    if (doc.getElementById('tm-help-center-style')) return;
    var style = doc.createElement('style');
    style.id = 'tm-help-center-style';
    style.textContent = '.topbar-help-button{width:37px;height:37px;padding:0;border:1px solid #d7ebe8;border-radius:12px;display:grid;place-items:center;background:#e7f4f1;color:#147d77;transition:background .16s ease,box-shadow .16s ease,transform .16s ease}.topbar-help-button:hover{background:#d8eee9;box-shadow:0 3px 10px #147d7726;transform:translateY(-1px)}.topbar-help-button:focus-visible{outline:3px solid #e9ac5b;outline-offset:2px}.topbar-help-button svg{width:20px;height:20px;display:block}.tm-help-modal{direction:rtl}.tm-help-layout{direction:ltr;display:grid;grid-template-columns:minmax(155px,.42fr) minmax(0,1.58fr);gap:18px;align-items:start}.tm-help-links{grid-column:1;grid-row:1;display:grid;align-content:start;gap:8px;padding:8px;background:#f5f8f8;border:1px solid #e2eaeb;border-radius:13px;position:sticky;top:0}.tm-help-content{grid-column:2;grid-row:1;min-width:0;direction:rtl}.tm-help-layout[data-help-language="en"]{grid-template-columns:minmax(0,1.58fr) minmax(155px,.42fr)}.tm-help-layout[data-help-language="en"] .tm-help-links{grid-column:2}.tm-help-layout[data-help-language="en"] .tm-help-content{grid-column:1;direction:ltr}.tm-help-topic{display:flex;align-items:center;min-height:54px;text-decoration:none;border:1px solid transparent;background:transparent;color:#52636d;padding:11px 12px;border-radius:10px;font:inherit;font-size:13.5px;line-height:1.6;font-weight:800;text-align:right;cursor:pointer;box-shadow:inset -3px 0 transparent;transition:background .16s ease,color .16s ease,box-shadow .16s ease}.tm-help-layout[data-help-language="en"] .tm-help-topic{text-align:left;box-shadow:inset 3px 0 transparent}.tm-help-topic[data-help-topic="about"]{margin-top:16px}.tm-help-topic:hover,.tm-help-topic.is-selected{background:#e1f3ef;border-color:#c5e7e1;color:#116c66;box-shadow:inset -3px 0 #147d77}.tm-help-layout[data-help-language="en"] .tm-help-topic:hover,.tm-help-layout[data-help-language="en"] .tm-help-topic.is-selected{box-shadow:inset 3px 0 #147d77}.tm-help-panel[hidden]{display:none}.tm-help-panel h3{font-size:15px;margin:0 0 9px}.tm-help-panel h4{font-size:13px;margin:14px 0 5px}.tm-help-panel p{font-size:12px;margin:8px 0;color:#52636d}.tm-help-note{background:#fff7e8;border-right:3px solid #e9ac5b;border-radius:7px;padding:8px 10px;color:#765522!important}.tm-help-path{line-height:2;background:#f8fbfb;border:1px solid #e2eaeb;border-radius:9px;padding:8px 10px}.tm-help-illustration{width:100%;max-width:100%;height:auto;max-height:none;object-fit:contain;display:block;margin:12px auto 4px;border:1px solid #e2eaeb;border-radius:10px;background:#fff}.tm-help-github{color:#147d77}.tm-help-update{margin-top:3px}.tm-help-update-status{display:block;font-size:11px;color:#52636d;margin-top:8px;min-height:1.5em}.tm-help-update-status .tm-help-release{margin-inline-start:8px}.tm-help-close:focus-visible,.tm-help-topic:focus-visible,.tm-help-update:focus-visible,.tm-help-release:focus-visible{outline:3px solid #e9ac5b;outline-offset:2px}@media(max-width:620px){.tm-help-layout{grid-template-columns:1fr}.tm-help-links,.tm-help-content,.tm-help-layout[data-help-language="en"] .tm-help-links,.tm-help-layout[data-help-language="en"] .tm-help-content{grid-column:1;grid-row:auto}.tm-help-links{position:static}}';
    doc.head.appendChild(style);
  }

  function selectTopic(id) {
    var rootElement = doc.querySelector('[data-help-root]');
    if (!rootElement) return;
    var selectedLink = rootElement.querySelector('[data-help-topic="' + id + '"]');
    if (!selectedLink) return;
    rootElement.querySelectorAll('[data-help-topic]').forEach(function (link) {
      var selected = link === selectedLink;
      link.classList.toggle('is-selected', selected);
      link.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    rootElement.querySelectorAll('[data-help-panel]').forEach(function (section) {
      var selected = section.getAttribute('data-help-panel') === id;
      section.hidden = !selected;
      section.setAttribute('aria-hidden', selected ? 'false' : 'true');
    });
    if (selectedLink.focus) selectedLink.focus({ preventScroll: true });
  }

  function dispatchFallbackUpdateEvent() {
    var event;
    if (typeof root.CustomEvent === 'function') event = new root.CustomEvent('tameshk-check-updates', { detail: { version: version() } });
    else if (doc.createEvent) { event = doc.createEvent('Event'); event.initEvent('tameshk-check-updates', true, true); }
    if (event && root.dispatchEvent) root.dispatchEvent(event);
  }

  function updateStatus(text) {
    var status = doc.querySelector('[data-help-root] .tm-help-update-status');
    if (status) status.textContent = text;
  }

  function safeReleaseUrl(value) {
    try {
      var url = new URL(String(value || ''));
      var repo = '/cloudinnet/Tameshk-Accounting';
      if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname) || !(url.pathname === repo || url.pathname.startsWith(repo + '/'))) return '';
      return url.href;
    } catch (_) { return ''; }
  }

  function checkUpdates() {
    var bridge = root.tameshkDesktop;
    dispatchFallbackUpdateEvent();
    if (!bridge || typeof bridge.checkUpdates !== 'function') {
      updateStatus(tr('برای بررسی به‌روزرسانی آنلاین شوید.'));
      return;
    }
    updateStatus(tr('در حال بررسی به‌روزرسانی…'));
    Promise.resolve().then(function () { return bridge.checkUpdates(); }).then(function (result) {
      var status = doc.querySelector('[data-help-root] .tm-help-update-status');
      if (!result || !result.ok) { updateStatus(tr('بررسی به‌روزرسانی ممکن نشد.')); return; }
      if (!result.available) { updateStatus(tr('برنامه به‌روز است.')); return; }
      if (!status) return;
      status.textContent = tr('نسخهٔ تازه پیدا شد:') + ' ' + String(result.version || '');
      var releaseUrl = safeReleaseUrl(result.url);
      if (releaseUrl && typeof bridge.openExternal === 'function') {
        var link = doc.createElement('button');
        link.type = 'button'; link.className = 'btn small tm-help-release'; link.textContent = tr('مشاهدهٔ نسخهٔ تازه'); link.setAttribute('data-help-release-url', releaseUrl);
        status.appendChild(link);
      }
    }).catch(function () { updateStatus(tr('بررسی به‌روزرسانی ممکن نشد.')); });
  }

  function closeHelp() {
    if (typeof root.closeModal === 'function') root.closeModal();
    helpIsOpen = false;
    var target = previouslyFocused;
    previouslyFocused = null;
    if (target && typeof target.focus === 'function') {
      try { target.focus({ preventScroll: true }); } catch (_) { try { target.focus(); } catch (__) {} }
    }
  }

  function externalLink(url, event) {
    var bridge = root.tameshkDesktop, safeUrl = safeReleaseUrl(url);
    if (!bridge || typeof bridge.openExternal !== 'function' || !safeUrl) return;
    event.preventDefault();
    Promise.resolve(bridge.openExternal(safeUrl)).catch(function () {});
  }

  function handleClick(event) {
    var rootElement = doc.querySelector('[data-help-root]');
    if (!helpIsOpen || !rootElement) return;
    if (event.__tameshkHelpHandled) return;
    event.__tameshkHelpHandled = true;
    var target = event.target;
    if (target && target.id === 'modal') { if (event.stopPropagation) event.stopPropagation(); closeHelp(); return; }
    var close = target && target.closest ? target.closest('[data-help-close]') : null;
    if (close && rootElement.contains(close)) { event.preventDefault(); closeHelp(); return; }
    var topic = target && target.closest ? target.closest('[data-help-topic]') : null;
    if (topic && rootElement.contains(topic)) { event.preventDefault(); selectTopic(topic.getAttribute('data-help-topic')); return; }
    var update = target && target.closest ? target.closest('.tm-help-update') : null;
    if (update && rootElement.contains(update)) { event.preventDefault(); checkUpdates(); return; }
    var release = target && target.closest ? target.closest('[data-help-release-url]') : null;
    if (release && rootElement.contains(release)) { externalLink(release.getAttribute('data-help-release-url'), event); return; }
    var github = target && target.closest ? target.closest('.tm-help-github') : null;
    if (github && rootElement.contains(github)) externalLink(GITHUB_URL, event);
  }

  function handleKeydown(event) {
    if (helpIsOpen && event.key === 'Escape') { event.preventDefault(); closeHelp(); }
  }

  function openHelp() {
    if (typeof root.openModal !== 'function') return false;
    previouslyFocused = doc.activeElement;
    injectStyle();
    root.openModal(markup(), false);
    helpIsOpen = true;
    var rootElement = doc.querySelector('[data-help-root]');
    if (rootElement) { rootElement.addEventListener('click', handleClick); var close = rootElement.querySelector('[data-help-close]'); if (close && close.focus) close.focus({ preventScroll: true }); }
    syncInstalledVersion();
    return true;
  }

  function decorateButton(button) {
    if (!button || button.__tameshkHelpIcon) return;
    button.__tameshkHelpIcon = true;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.7 9.3a2.45 2.45 0 1 1 4.2 1.7c-.95.9-1.9 1.2-1.9 2.55" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1" fill="currentColor"/></svg>';
  }

  function bindButton(button) {
    if (!button) return;
    decorateButton(button);
    if (button.__tameshkHelpBound) return;
    button.__tameshkHelpBound = true;
    button.addEventListener('click', function (event) { event.preventDefault(); openHelp(); });
  }

  function init() {
    injectStyle();
    bindButton(doc.getElementById('helpButton'));
    if (typeof root.MutationObserver === 'function' && !observer && doc.body) { observer = new root.MutationObserver(function () { bindButton(doc.getElementById('helpButton')); }); observer.observe(doc.body, { childList: true, subtree: true }); }
  }

  doc.addEventListener('keydown', handleKeydown);
  var modal = doc.getElementById('modal');
  if (modal) modal.addEventListener('click', handleClick, true);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();

  root.TameshkHelpCenter = Object.freeze({ open: openHelp, close: closeHelp, selectTopic: selectTopic, checkUpdates: checkUpdates, version: version, sourceStrings: SOURCE_STRINGS.slice() });
})(window);
