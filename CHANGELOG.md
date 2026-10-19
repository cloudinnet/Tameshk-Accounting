# Changelog

## 1.50.7 — Localization regression and inventory lot fixes

- Fixed language-specific default values for weight and dimension units, including existing built-in Persian defaults shown in English/Arabic forms.
- Fixed dynamically composed invoice edit headings and explicitly localized invoice editor labels/buttons before adding invoice numbers or currency symbols.
- Fixed fixed/empty category options that the generic translation observer intentionally skips.
- Fixed the default service-unit option in transaction rows and service forms for English and Arabic.
- Localized dynamic packaging conversion previews and the application title.
- Added targeted regression tests for the user-reported localization paths.
- Explicitly localized the Inventory stock/lot discrepancy notice, table headings, review dialog, correction action, and completion/error messages in English and Arabic.
- Localized the second confirmation prompt with the item name and discrepancy quantity preserved in the active language.
- Localized built-in lot references such as opening balance and manual reconciliation without translating user-entered lot references.
- Added regression tests for all reported Inventory discrepancy strings and the built-in lot references.


- پاک‌سازی وضعیت اولیه برای انتشار عمومی: در پروفایل تازه فقط دستهٔ سیستمی «-» ایجاد می‌شود؛ کالا، خدمت، مورد بارکد سریع، تراکنش، هزینه، مرجوعی، انبار و ردیف نمونه در پیش‌نمایش فاکتور یا CSV ساخته نمی‌شود. انتخاب دسته به‌صورت پیش‌فرض اختیاری است و از پنل مدیریت قابل اجباری‌کردن است. دستهٔ «-» فقط در صورت وجود دستهٔ دیگری حذف می‌شود و حذف آخرین دسته‌بندی مجاز نیست. داده‌های ذخیره‌شدهٔ پروفایل موجود هنگام ارتقا خودکار پاک نمی‌شوند.
- محاسبهٔ بازپرداخت مرجوعی بر اساس مبلغ قلم پس از تخفیف همان قلم؛ مالیات، تخفیف نهایی فاکتور و هزینه‌های جانبی وارد مبلغ مرجوعی نمی‌شوند.
- اصلاح محاسبهٔ مجدد بازپرداخت هنگام پاک‌کردن یا تغییر تعداد مرجوعی.
- ثبت زمان قابل‌ویرایش مرجوعی و استفاده از زمان رخداد برای ترتیب رویدادهای انبار.
- اصلاح آمار داشبورد، نمودارها و گزارش‌های دوره‌ای پس از مرجوعی بدون تغییر مبلغ تراکنش اصلی.
- اعمال بازهٔ زمانی انتخابی روی گزارش‌های متنی، جدولی و نموداری و محاسبهٔ موجودی آغازین، دریافت‌ها و پرداخت‌های کیف پول نقدی برای همان بازه.
- بهبود چینش متن مالیات هر قلم در فاکتور اصلی و ابزارک در فارسی، عربی و انگلیسی.
- ارتقای Electron به 44.9.0 و نگه‌داشتن electron-builder روی 26.15.3.
- تمیزسازی سورس انتشار از رکوردهای نمایشی، اسکریپت‌های یک‌بارهٔ ویرایش سورس و یادداشت‌های داخلی QA.

- حذف دسته‌بندی‌ای که قبلاً در کالا، خدمت، هزینه یا تراکنش استفاده شده است پس از تأیید صریح کاربر ممکن شد. هشدار سه‌زبانه توضیح می‌دهد که دسته از فهرست‌های قابل انتخاب خارج می‌شود اما نام آن در سوابق قبلی حفظ می‌شود؛ انصراف هیچ تغییری نمی‌دهد و حذف آخرین دسته همچنان ممنوع است.
- افزودن گزینهٔ «انتخاب دسته» به ردیف‌های ثبت تراکنش و فرم‌های فروش/خرید اعتباری و اقساطی؛ مقدار خالی در حالت اختیاری ذخیره می‌شود و در فهرست‌ها و تاریخچه‌ها به‌صورت «-» نمایش داده می‌شود. منطق یکسان برای کالا، خدمت، هزینهٔ تک‌ردیفی و چندردیفی، ورود چندکالایی انبار، اقلام بارکد سریع و واردکردن نرخ‌نامه اعمال شد.
- افزودن کنترل سه‌زبانهٔ اجبار انتخاب دسته در پنل مدیریت ← پیش‌فرض‌ها و قابلیت‌های اختیاری ← ساده‌سازی محیط و قابلیت‌های اختیاری؛ در اولین نصب تیک آن فعال است تا انتخاب دسته اجباری نباشد.

## شناخته‌شده پیش از انتشار

- نصاب امضای دیجیتال Authenticode ندارد؛ برای انتشار عمومی ممکن است SmartScreen هشدار بدهد.
- آزمون خودکار، آزمون چاپگر فیزیکی و سازگاری تمام نسخه‌ها و سخت‌افزارهای Windows را تضمین نمی‌کند.
- مجوز MIT به پروژه اضافه شد؛ استفادهٔ تجاری و انتشار نسخه‌های تغییر‌یافته با حفظ اعلان حق‌نشر و متن مجوز مجاز است.

### Inventory opening-stock correction (1.50.7)
- Fixed a double-counting path where creating a new product with opening stock caused legacy-lot migration and opening-stock lot creation to both run. A new product with stock 10 now creates one lot of 10, so no false discrepancy is shown. Existing products still use legacy-lot migration when needed.
- Added a regression test for creating `Blue Pen` with opening stock 10.
