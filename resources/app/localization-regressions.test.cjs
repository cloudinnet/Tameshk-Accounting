const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = path.join(__dirname);
const read = name => fs.readFileSync(path.join(app, name), 'utf8');

test('standard weight and dimension defaults are localized in each UI language', () => {
  const source = read('inventory-profiles.js');
  assert.match(source, /weightUnit:lang==='en'\?'Kilogram':lang==='ar'\?'كيلوغرام':'کیلوگرم'/);
  assert.match(source, /dimensionUnit:lang==='en'\?'Centimetre':lang==='ar'\?'سنتيمتر':'سانتی‌متر'/);
  assert.match(source, /m\.weightUnit==='کیلوگرم'/);
  assert.match(source, /m\.dimensionUnit==='سانتی‌متر'/);
});

test('invoice edit title and requested invoice captions use the active locale before interpolation', () => {
  const source = read('index.html');
  assert.match(source, /uiText\?\.\(editable\?'ویرایش و صدور فاکتور':'پیش‌نمایش فاکتور'\)/);
  for (const key of ['ذخیره تغییرات فاکتور', 'فی واحد انتخابی', 'مجموع', 'توضیحات فاکتور', 'ویرایش فاکتور']) {
    assert.ok(source.includes(`uiText?.('${key}')`), `missing explicit localized rendering for ${key}`);
  }
});

test('all user-reported exact phrases have English and Arabic dictionary entries', () => {
  const source = read('localization.js');
  const keys = [
    'درآمد خالص منهای هزینه‌های ثبت‌شده', 'فروش خالص و هزینهٔ هر روز هفته · شمارش کنار هر میله',
    'ویرایش و صدور فاکتور', 'ذخیره تغییرات فاکتور', 'بازپرداخت واقعاً نقدی است؛ از کیف پول کسر شود',
    'فایل CSV یا XLSX نرخ‌نامه را انتخاب کنید؛ نتیجهٔ هر ردیف پیش از اعمال نمایش داده می‌شود.',
    'دریافت الگو', 'واحد پایهٔ فروش/انبار', 'واحد وزن', 'واحد ابعاد', 'Parent unit (optional)',
    'بستهٔ بدون نام', 'موجودی اولیهٔ کیف پول (تومان)', 'لوگوی پروفایل جداگانه ذخیره شد.',
    'عنوان و مبلغ معتبر وارد کنید.', 'اطلاعاتی که وارد می‌کنید روی همین دستگاه ذخیره می‌شود. برای حفاظت از اطلاعات، به‌طور منظم پشتیبان بگیرید.',
    'نسخهٔ پشتیبان شامل تاریخ استاندارد، تقویم هر رکورد و بارکدها دانلود شد.', 'تمشک سبز', 'تراکنش ثبت شد', 'حسابداری تمشک'
  ];
  for (const key of keys) assert.ok(source.includes(`'${key}'`) || source.includes(`"${key}"`), `missing dictionary entry ${key}`);
});

test('packaging preview dynamic shells use the active language', () => {
  const source = read('packaging-manager.js');
  assert.match(source, /per parent unit:/);
  assert.match(source, /لكل وحدة أم:/);
  assert.match(source, /root\.uiText\?\.\('برای استفاده، نام و ضریب این سطح را وارد کنید\.'\)/);
});


test('empty category and service-unit options are localized at creation because the observer skips fixed options', () => {
  const index = read('index.html');
  const service = read('service-management.js');
  const inventory = read('inventory-management.js');
  assert.match(index, /uiText\?\.\('خدمت'\).*خدمت/);
  assert.match(index, /data-i18n-fixed="true" value=""[^>]*>\$\{esc\(window\.uiText\?\.\('انتخاب دسته'\)/);
  assert.match(service, /data-i18n-fixed="true" value=""[^>]*>\$\{esc\(tr\('انتخاب دسته'\)\)\}/);
  assert.match(service, /s\.unit==='خدمت'\?/);
  assert.match(inventory, /data-i18n-fixed="true" value="">\$\{esc\(tr\('انتخاب دسته'\)\)\}/);
});

test('inventory lot discrepancy UI explicitly localizes all reported captions and confirmation messages', () => {
  const inventory = read('inventory-profiles.js');
  const keys = [
    'موجودی کالا خودکار تغییر نمی‌کند. مغایرت را بررسی کنید و اگر لازم بود، همسان‌سازی محموله‌ها را خودتان صریحاً تأیید کنید.',
    'موجودی کالا', 'جمع ماندهٔ محموله‌ها', 'اختلاف', 'اقدام', 'بررسی و اصلاح دستی',
    'بررسی مغایرت', 'برای اختلاف، یک محمولهٔ اصلاحی اضافه شود',
    'از ماندهٔ محموله‌ها به اندازهٔ اختلاف کم شود',
    'موجودی کالا و ارزش دفتری آن تغییر نمی‌کند؛ ماندهٔ محموله‌ها به ترتیب انقضا کم و حرکت هر محموله ثبت می‌شود.',
    'این کار خودکار انجام نمی‌شود و فقط با زدن دکمهٔ تأیید و تأیید دوباره انجام خواهد شد.',
    'تأیید اصلاح محموله‌ها', 'ماندهٔ ریزمحموله‌ها با موجودی کالا همسان شد؛ مقدار موجودی و ارزش دفتری تغییر نکرد.',
    'افتتاحیه', 'موجودی اولیه / افزایش دستی'
  ];
  for (const key of keys) assert.ok(inventory.includes(`tr('${key}')`) || inventory.includes(`'${key}'`), `inventory UI missing localization hook for ${key}`);
  assert.match(inventory, /root\.uiLanguage\?\.\(\)==='en'\?`Confirm correcting the \$\{qty\}-unit discrepancy/);
  assert.match(inventory, /root\.uiLanguage\?\.\(\)==='ar'\?`هل تؤكد تصحيح فرق/);
  assert.match(inventory, /function discrepancyHeading\(count\)/);
  assert.match(inventory, /function lotReference\(l\)/);
  assert.match(inventory, /ref==='موجودی اولیه \/ افزایش دستی'\|\|ref==='legacy-stock-reconciliation'\|\|ref==='manual-lot-reconciliation'/, 'translate the literal Persian reference used by new opening-stock lots, as well as legacy internal references');
});

test('inventory discrepancy and built-in lot reference strings have English and Arabic translations', () => {
  const source = read('localization.js');
  const keys = [
    'موجودی کالا خودکار تغییر نمی‌کند. مغایرت را بررسی کنید و اگر لازم بود، همسان‌سازی محموله‌ها را خودتان صریحاً تأیید کنید.',
    'موجودی کالا', 'جمع ماندهٔ محموله‌ها', 'اختلاف', 'اقدام', 'بررسی و اصلاح دستی', 'بررسی مغایرت',
    'برای اختلاف، یک محمولهٔ اصلاحی اضافه شود', 'از ماندهٔ محموله‌ها به اندازهٔ اختلاف کم شود',
    'موجودی کالا تغییر نمی‌کند؛ فقط محمولهٔ ثبت‌شده اضافه می‌شود.',
    'موجودی کالا و ارزش دفتری آن تغییر نمی‌کند؛ ماندهٔ محموله‌ها به ترتیب انقضا کم و حرکت هر محموله ثبت می‌شود.',
    'این کار خودکار انجام نمی‌شود و فقط با زدن دکمهٔ تأیید و تأیید دوباره انجام خواهد شد.',
    'تأیید اصلاح محموله‌ها', 'ماندهٔ ریزمحموله‌ها با موجودی کالا همسان شد؛ مقدار موجودی و ارزش دفتری تغییر نکرد.',
    'افتتاحیه', 'موجودی اولیه / افزایش دستی', 'به‌روزرسانی گروهی از نرخ‌نامه'
  ];
  for (const key of keys) assert.ok(source.includes(`'${key}'`), `missing EN/AR dictionary entry ${key}`);
});


test('invoice edit tax toggle, tax rate, and notes captions have English and Arabic translations', () => {
  const source = read('localization.js');
  for (const key of ['مالیات فعال باشد', 'درصد مالیات', 'توضیحات:', 'این هزینه سابقهٔ مرجوعی دارد؛ ابتدا سوابق مرجوعی را حذف یا اصلاح کنید.', 'شماره فاکتور نمی‌تواند خالی باشد.', 'عنوان و قیمت ردیف‌ها را معتبر وارد کنید.', 'مبلغ تخفیف یا درصد مالیات معتبر نیست.', 'تخفیف نمی‌تواند از جمع اقلام بیشتر باشد.', 'تاریخ با تقویم انتخابی', 'تاریخ استاندارد میلادی ISO', 'بسته میانی', 'موجودی هنگام تغییر', 'تاریخ تغییر قیمت']) {
    assert.ok(source.includes(`'${key}'`), `missing EN/AR dictionary entry ${key}`);
  }
  const index = read('index.html');
  assert.ok(index.includes('مالیات فعال باشد'));
  assert.ok(index.includes('<label>درصد مالیات</label>'));
  assert.ok(index.includes('<b>توضیحات:</b>'));
});
