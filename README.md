# Tameshk Accounting — Windows Desktop


# **Built with Artificial Intelligence**

> [!WARNING]
> **Warning — AI-generated software**
>
> This software was developed with the assistance of artificial intelligence. Many features have been tested manually and through automated checks, but bugs, security weaknesses, data-handling issues, or other problems may remain. It is published publicly on GitHub so developers and other AI systems can study its implementation and draw inspiration from individual features. Publication does not mean that it is production-ready. **Use it at your own risk.** Verify important calculations and records, keep independent backups, and test it in an environment appropriate for your needs. Do not rely on it as the sole recordkeeping system for critical operations without your own review and validation.

## Quick links

- [Minimum System Requirements and Prerequisites](#minimum-system-requirements-and-prerequisites)
- [Description and Features](#description-and-features)
- [Testing and Known Limitations](#testing-and-known-limitations)
- [Data Safety and Privacy](#data-safety-and-privacy)
- [License and Reuse](#license-and-reuse)

<!-- This is the single shared demo-video section. Add the real video or thumbnail here when it is ready. -->

## Demo Video / ویدیوی معرفی / فيديو توضيحي

[![Watch the Tameshk Accounting demo](docs/demo-video/TAMESHK_Accounting.png)](https://youtu.be/WBRs1X_rO5k)

**English:** Watch the Windows application walkthrough.

**فارسی:** برای مشاهدهٔ معرفی و امکانات نسخهٔ ویندوز کلیک کنید.

**العربية:** شاهد شرح التطبيق وميزاته على Windows.

<!-- Recommended: upload the video to GitHub or a video host and replace the placeholder below with a real URL. Alternatively, add a thumbnail image to docs/demo-video/ and link it to the real video. Never publish a guessed or placeholder URL as if it were live. -->
<!-- Example: [![Watch the Tameshk Accounting demo](docs/demo-video/thumbnail.png)](REAL_VIDEO_URL_HERE) -->

---


## Minimum System Requirements and Prerequisites

### Minimum requirements

These are practical baseline recommendations, not the result of a complete hardware compatibility study.

- **Operating system:** Windows 10 or Windows 11, 64-bit (x64).
- **Processor:** A compatible modern x64 processor.
- **Memory:** 4 GB RAM minimum; **8 GB recommended** for smoother multitasking.
- **Storage:** Allow at least 500 MB of free space for the application, plus extra room for records, backups, and exported files. Actual requirements vary by release and usage.
- **Display:** 1280 × 720 suggested minimum; 1920 × 1080 recommended for more comfortable use of tables and reports.
- **Network:** Internet access is needed to download the installer or source dependencies. The app is designed for local, offline-first use after installation.

### For end users

1. Download the Windows x64 setup executable from the repository's [Releases](../../releases) page.
2. Run the installer and follow its prompts.
3. Choose the interface language on first launch. You may optionally enter a profile name and image.
4. **Node.js and NSIS are not required** to run an already-built installer.

The installer is not signed with an Authenticode certificate. Windows may therefore display a publisher or SmartScreen warning. Only proceed if you trust the source and have independently verified the file you downloaded.

### For developers building from source

- Windows 10/11 x64.
- **Node.js 22.12 or newer** and npm.
- **NSIS 3 or newer** to build the custom installer.
- Internet access for the initial dependency installation.

From the repository root, run in PowerShell:

```powershell
npm ci
npm run dist:win
```

Build outputs are written under `dist\`, including the unpacked application and, if the installer build completes successfully, a Windows x64 setup executable. If `makensis.exe` is not available through `PATH`, set `MAKENSIS_PATH` to its full path. To build an unpacked directory without an installer, run:

```powershell
npx electron-builder --win dir --x64
```

## Description and Features

Tameshk Accounting is designed to manage everyday small-business records on a Windows computer.

### Main features

- **Transactions and sales records** — record and review business transactions.
- **Expense tracking** — maintain expense records and review them in reports.
- **Inventory management** — manage product records, stock, and warehouse-related information.
- **Returns tracking** — record returns separately while preserving the original transaction history and recording the return event time.
- **Reports and charts** — review summaries over selected date ranges, including cash-wallet summaries for the selected period.
- **Invoice printing and PDF export** — prepare invoices from the main window and supported widget workflows.
- **Desktop quick-access widget** — open selected functions from a separate desktop widget.
- **Persian, Arabic, and English interface** — use the supported interface languages.
- **Configurable monetary precision** — monetary calculations use the configured decimal precision.
- **Local backup and restore** — create backups and restore saved data.
- **Offline-first operation** — core records are intended to remain on the local device.

## Testing and Known Limitations

The source includes automated checks for accounting logic, interface behavior, security guards, widget behavior, installer-related scripts, and browser regressions. The available source audit passed its JavaScript syntax checks, Node tests, migration tests, installer-script tests, and browser regression tests. However, the audit did **not** constitute a complete build-and-install verification of the Windows executable in every target environment.

Automated tests do not replace manual verification of installation and uninstallation, offline operation, physical printing, PDF output, data migration, backup restoration, or compatibility with every Windows version and hardware configuration. This repository does not claim a complete security audit or production-readiness certification.

## Data Safety and Privacy

- User records are stored locally in the current Windows user profile.
- This version is intended for one local Windows user/device. Do not assume cloud synchronization, team access controls, or server-side backups.
- Keep regular backups in a separate location and test restoration before relying on a backup.
- Verify calculations, invoices, reports, and exports before using them for tax, legal, or other high-impact decisions.
- The software is provided without a guarantee of ongoing support or compliance with any particular regulatory requirement.
- A SHA-256 hash can help detect accidental file changes; it is **not** a publisher signature and does not prove that a file is safe.


## License and Reuse

This project is distributed under the **MIT License**; see [`LICENSE`](LICENSE) for the full text. The license generally permits personal and commercial use, modification, redistribution, and inclusion in other projects, provided the copyright and license notice are retained as required by the license.

Third-party components remain subject to their own licenses. Public availability of the source does not imply that the software is secure, production-ready, or suitable for a particular business.

**Version:** 1.50.7  
**Platform covered here:** Windows 10/11 x64  
**License:** MIT

---

# **ساخته‌شده با هوش مصنوعی**

> [!WARNING]
> **هشدار — نرم‌افزار ساخته‌شده با هوش مصنوعی**
>
> این نرم‌افزار با کمک هوش مصنوعی توسعه داده شده است. بسیاری از قابلیت‌های آن به‌صورت دستی و با آزمون‌های خودکار بررسی شده‌اند، اما همچنان ممکن است باگ، ضعف امنیتی، مشکل در مدیریت داده‌ها یا ایرادهای دیگری وجود داشته باشد. این پروژه به‌صورت عمومی در گیت‌هاب منتشر شده تا برنامه‌نویسان و سامانه‌های هوش مصنوعی بتوانند پیاده‌سازی آن را بررسی کنند و از برخی قابلیت‌هایش الهام بگیرند. انتشار عمومی به معنی آماده‌بودن برای استفادهٔ عملیاتی نیست. **استفاده از نرم‌افزار بر عهده و مسئولیت خود شماست.** محاسبات و سوابق مهم را بررسی کنید، نسخه‌های پشتیبان مستقل نگه دارید و نرم‌افزار را متناسب با نیاز خود آزمایش کنید. بدون بررسی و اعتبارسنجی مستقل، آن را تنها مرجع نگهداری سوابق حیاتی کسب‌وکار قرار ندهید.

## دسترسی سریع

- [حداقل سیستم مورد نیاز و پیش‌نیازها](#حداقل-سیستم-مورد-نیاز-و-پیشنیازها)
- [توضیحات و قابلیت‌ها](#توضیحات-و-قابلیت‌ها)
- [آزمون‌ها و محدودیت‌های شناخته‌شده](#آزمونها-و-محدودیتهای-شناختهشده)
- [ایمنی داده‌ها و حریم خصوصی](#ایمنی-دادهها-و-حریم-خصوصی)
- [مجوز و استفادهٔ مجدد](#مجوز-و-استفاده-مجدد)

## حداقل سیستم مورد نیاز و پیش‌نیازها

### حداقل مشخصات پیشنهادی

موارد زیر برآوردهای عملی و پیشنهادی‌اند و نتیجهٔ بررسی کامل سازگاری با همهٔ سخت‌افزارها نیستند.

- **سیستم‌عامل:** ویندوز ۱۰ یا ۱۱، نسخهٔ ۶۴ بیتی (x64).
- **پردازنده:** پردازندهٔ سازگار و نسبتاً جدید با معماری x64.
- **حافظه:** حداقل ۴ گیگابایت RAM؛ برای اجرای روان‌تر و چندوظیفگی، **۸ گیگابایت پیشنهاد می‌شود**.
- **فضای ذخیره‌سازی:** دست‌کم ۵۰۰ مگابایت فضای آزاد برای برنامه و فضای اضافی برای اطلاعات، پشتیبان‌ها و فایل‌های خروجی در نظر بگیرید. نیاز واقعی به نسخه و نوع استفاده بستگی دارد.
- **نمایشگر:** حداقل پیشنهادی ۱۲۸۰×۷۲۰؛ وضوح ۱۹۲۰×۱۰۸۰ برای کار راحت‌تر با جدول‌ها و گزارش‌ها مناسب‌تر است.
- **اینترنت:** برای دریافت نصاب یا وابستگی‌های سورس لازم است. پس از نصب، برنامه برای استفادهٔ محلی و آفلاین‌محور طراحی شده است.

### پیش‌نیاز کاربران عادی

۱. در صورت موجود بودن فایل انتشار، نصاب Windows x64 را از بخش [Releases](../../releases) دریافت کنید.  
۲. نصاب را اجرا کرده و مراحل آن را دنبال کنید.  
۳. در اولین اجرا زبان رابط را انتخاب کنید؛ واردکردن نام و تصویر پروفایل اختیاری است.  
۴. برای اجرای نصاب آماده، **نیازی به نصب Node.js یا NSIS نیست**.

نصاب با گواهی Authenticode امضای دیجیتال نشده است؛ بنابراین ممکن است ویندوز هشدار ناشر یا SmartScreen نمایش دهد. فقط در صورتی ادامه دهید که به منبع اعتماد دارید و فایل دریافتی را مستقلاً بررسی کرده‌اید.

### پیش‌نیازهای ساخت سورس

- ویندوز ۱۰/۱۱ نسخهٔ x64.
- **Node.js نسخهٔ 22.12 یا جدیدتر** به‌همراه npm.
- **NSIS نسخهٔ 3 یا جدیدتر** برای ساخت نصاب سفارشی.
- دسترسی به اینترنت برای دریافت اولیهٔ وابستگی‌ها.

در ریشهٔ مخزن، در PowerShell اجرا کنید:

```powershell
npm ci
npm run dist:win
```

خروجی‌ها در پوشهٔ `dist\` ساخته می‌شوند؛ از جمله نسخهٔ پوشه‌ای برنامه و در صورت موفقیت ساخت نصاب، فایل نصب Windows x64. اگر `makensis.exe` در `PATH` نیست، متغیر محیطی `MAKENSIS_PATH` را به مسیر کامل آن تنظیم کنید. برای ساخت نسخهٔ پوشه‌ای بدون نصاب:

```powershell
npx electron-builder --win dir --x64
```

## توضیحات و قابلیت‌ها

حسابداری تمشک برای مدیریت سوابق روزمرهٔ کسب‌وکارهای کوچک روی رایانهٔ ویندوزی طراحی شده است.

### قابلیت‌های اصلی

- **ثبت تراکنش‌ها و فروش** — ثبت و مرور تراکنش‌های کاری.
- **مدیریت هزینه‌ها** — نگهداری سوابق هزینه و بررسی آن‌ها در گزارش‌ها.
- **مدیریت کالا و موجودی انبار** — مدیریت اطلاعات کالا، موجودی و اطلاعات مرتبط با انبار.
- **مدیریت مرجوعی** — ثبت جداگانهٔ مرجوعی با حفظ تراکنش اصلی و زمان رخداد مرجوعی.
- **گزارش‌ها و نمودارها** — مشاهدهٔ خلاصه‌ها در بازهٔ زمانی دلخواه، از جمله خلاصهٔ کیف پول نقدی در همان بازه.
- **چاپ فاکتور و خروجی PDF** — تهیهٔ فاکتور از پنجرهٔ اصلی و مسیرهای پشتیبانی‌شدهٔ ابزارک.
- **ابزارک دسترسی سریع دسکتاپ** — دسترسی به برخی قابلیت‌ها از پنجرهٔ جداگانهٔ ابزارک.
- **رابط فارسی، عربی و انگلیسی** — استفاده از زبان‌های پشتیبانی‌شده.
- **دقت اعشاری قابل تنظیم مبالغ** — محاسبات پولی با دقت اعشاری تنظیم‌شده انجام می‌شوند.
- **پشتیبان‌گیری و بازیابی محلی** — تهیه و بازیابی نسخهٔ پشتیبان.
- **کارکرد آفلاین‌محور** — اطلاعات اصلی برای نگهداری روی دستگاه محلی طراحی شده‌اند.

## آزمون‌ها و محدودیت‌های شناخته‌شده

سورس شامل آزمون‌های خودکار برای منطق حسابداری، رفتار رابط کاربری، کنترل‌های امنیتی، رفتار ابزارک، اسکریپت‌های مرتبط با نصاب و رگرسیون مرورگر است. ممیزی سورس موجود، بررسی‌های نحوی JavaScript، آزمون‌های Node، آزمون‌های مهاجرت، آزمون اسکریپت نصاب و آزمون‌های رگرسیون مرورگر را با موفقیت گذرانده است. با این حال، این ممیزی به معنی تأیید کامل ساخت و نصب فایل اجرایی ویندوز در همهٔ محیط‌های هدف نیست.

آزمون خودکار جایگزین بررسی دستی نصب و حذف نصب، عملکرد آفلاین، چاپگر واقعی، خروجی PDF، مهاجرت داده‌ها، بازیابی پشتیبان یا سازگاری با همهٔ نسخه‌ها و سخت‌افزارهای ویندوز نیست. این مخزن ادعای ممیزی کامل امنیتی یا تأییدیهٔ آمادگی برای استفادهٔ عملیاتی ندارد.

## ایمنی داده‌ها و حریم خصوصی

- اطلاعات کاربر در پروفایل محلی کاربر فعلی ویندوز ذخیره می‌شود.
- این نسخه برای یک کاربر/دستگاه محلی طراحی شده است؛ همگام‌سازی ابری، کنترل دسترسی گروهی یا پشتیبان‌گیری سمت سرور را فرض نکنید.
- به‌طور منظم در محل جداگانه پشتیبان تهیه کنید و پیش از اتکا به آن، بازیابی را آزمایش کنید.
- پیش از استفاده از محاسبات، فاکتورها، گزارش‌ها و خروجی‌ها برای تصمیم‌های مالیاتی، حقوقی یا مهم، آن‌ها را بررسی کنید.
- پشتیبانی مداوم یا انطباق با مقررات خاصی تضمین نشده است.
- هش SHA-256 می‌تواند به تشخیص تغییر ناخواستهٔ فایل کمک کند؛ اما **امضای ناشر نیست** و ایمن‌بودن فایل را ثابت نمی‌کند.


## مجوز و استفادهٔ مجدد

این پروژه تحت **مجوز MIT** منتشر شده است؛ متن کامل در فایل [`LICENSE`](LICENSE) قرار دارد. این مجوز به‌طور کلی استفادهٔ شخصی و تجاری، تغییر، بازتوزیع و ادغام کد در پروژه‌های دیگر را مجاز می‌داند؛ مشروط بر حفظ اعلان حق‌نشر و متن مجوز مطابق شرایط آن.

اجزای شخص ثالث تابع مجوزهای خود هستند. عمومی‌بودن سورس به معنی امن‌بودن، آماده‌بودن برای محیط عملیاتی یا مناسب‌بودن برای هر کسب‌وکار نیست.

**نسخه:** 1.50.7  
**پلتفرم تحت پوشش:** Windows 10/11 x64  
**مجوز:** MIT

---

# **تمشک — برنامج محاسبة مطوّر بمساعدة الذكاء الاصطناعي**


> [!WARNING]
> **تحذير — برنامج طُوّر بمساعدة الذكاء الاصطناعي**
>
> تم تطوير هذا البرنامج بمساعدة الذكاء الاصطناعي. خضعت ميزات كثيرة لاختبارات يدوية وآلية، لكن قد تظل هناك أخطاء أو نقاط ضعف أمنية أو مشكلات في التعامل مع البيانات أو غيرها من العيوب. نُشر المشروع علناً على GitHub ليتمكن المطورون وأنظمة الذكاء الاصطناعي الأخرى من دراسة طريقة تنفيذه والاستلهام من بعض ميزاته. النشر العام لا يعني أن البرنامج جاهز للاستخدام الإنتاجي. **استخدمه على مسؤوليتك الخاصة.** تحقّق من الحسابات والسجلات المهمة، واحتفظ بنسخ احتياطية مستقلة، واختبر البرنامج في بيئة تناسب احتياجاتك. لا تعتمد عليه بوصفه النظام الوحيد لحفظ السجلات الحساسة دون مراجعة وتحقق مستقلين.

## روابط سريعة

- [الحد الأدنى لمتطلبات النظام والمتطلبات المسبقة](#الحد-الأدنى-لمتطلبات-النظام-والمتطلبات-المسبقة)
- [الوصف والميزات](#الوصف-والميزات)
- [الاختبارات والقيود المعروفة](#الاختبارات-والقيود-المعروفة)
- [سلامة البيانات والخصوصية](#سلامة-البيانات-والخصوصية)
- [الترخيص وإعادة الاستخدام](#الترخيص-وإعادة-الاستخدام)

## الحد الأدنى لمتطلبات النظام والمتطلبات المسبقة

### الحد الأدنى المقترح

هذه تقديرات عملية مقترحة وليست نتيجة دراسة توافق شاملة لجميع الأجهزة.

- **نظام التشغيل:** Windows 10 أو Windows 11، إصدار 64 بت (x64).
- **المعالج:** معالج x64 حديث ومتوافق.
- **الذاكرة:** 4 غيغابايت RAM كحد أدنى؛ ويوصى بـ **8 غيغابايت** لتعدد المهام بسلاسة أكبر.
- **مساحة التخزين:** يوصى بتوفير 500 ميغابايت على الأقل للتطبيق، إضافة إلى مساحة للسجلات والنسخ الاحتياطية والملفات المصدّرة. تختلف الحاجة الفعلية حسب الإصدار وطريقة الاستخدام.
- **الشاشة:** دقة 1280×720 كحد أدنى مقترح؛ ويوصى بدقة 1920×1080 لعرض الجداول والتقارير براحة أكبر.
- **الإنترنت:** يلزم تنزيل برنامج التثبيت أو اعتماديات المصدر. صُمّم التطبيق للعمل محلياً دون اتصال بعد التثبيت.

### متطلبات المستخدم النهائي

1. عند توفر ملف إصدار، نزّل مثبت Windows x64 من صفحة [Releases](../../releases).
2. شغّل المثبّت واتبع التعليمات.
3. اختر لغة الواجهة عند التشغيل الأول؛ وإدخال اسم وصورة للملف الشخصي اختياري.
4. لا تحتاج إلى تثبيت **Node.js أو NSIS** لتشغيل مثبّت جاهز.

المثبّت غير موقّع بشهادة Authenticode، لذلك قد يعرض Windows تحذيراً بشأن الناشر أو SmartScreen. لا تتابع إلا إذا كنت تثق بالمصدر وتحققت بشكل مستقل من الملف الذي نزّلته.

### متطلبات بناء المصدر

- Windows 10/11 x64.
- **Node.js الإصدار 22.12 أو أحدث** مع npm.
- **NSIS الإصدار 3 أو أحدث** لإنشاء المثبّت المخصص.
- اتصال بالإنترنت لتنزيل الاعتماديات عند الإعداد الأول.

من جذر المستودع، شغّل الأوامر التالية في PowerShell:

```powershell
npm ci
npm run dist:win
```

تُحفظ مخرجات البناء داخل `dist\`، بما فيها نسخة التطبيق غير المعبأة، وملف تثبيت Windows x64 إذا اكتمل بناء المثبّت بنجاح. إذا لم يكن `makensis.exe` متاحاً ضمن `PATH`، فعيّن المتغير `MAKENSIS_PATH` إلى مساره الكامل. لبناء مجلد التطبيق دون مثبّت:

```powershell
npx electron-builder --win dir --x64
```


## الوصف والميزات

صُمّم تمشک لإدارة السجلات اليومية للشركات الصغيرة على جهاز يعمل بنظام Windows.

### الميزات الرئيسية

- **تسجيل المعاملات والمبيعات** — تسجيل معاملات العمل ومراجعتها.
- **تتبع المصروفات** — حفظ المصروفات ومراجعتها في التقارير.
- **إدارة المخزون** — إدارة المنتجات والكميات والمعلومات المتعلقة بالمستودعات.
- **تتبع المرتجعات** — تسجيل المرتجعات بشكل منفصل مع الحفاظ على المعاملة الأصلية ووقت حدوث الإرجاع.
- **التقارير والرسوم البيانية** — عرض الملخصات ضمن نطاق زمني محدد، بما في ذلك ملخص المحفظة النقدية للفترة نفسها.
- **طباعة الفواتير وتصدير PDF** — إعداد الفواتير من النافذة الرئيسية ومسارات الأدوات المدعومة.
- **أداة وصول سريع لسطح المكتب** — الوصول إلى بعض الوظائف من نافذة أداة منفصلة.
- **واجهة بالفارسية والعربية والإنجليزية** — استخدام اللغات المدعومة.
- **دقة عشرية قابلة للضبط للمبالغ** — تُجرى الحسابات النقدية وفق الدقة العشرية المضبوطة.
- **نسخ احتياطي واستعادة محليان** — إنشاء النسخ الاحتياطية واستعادة البيانات المحفوظة.
- **العمل المحلي أولاً** — صُمّمت السجلات الأساسية لتبقى على الجهاز المحلي.

## الاختبارات والقيود المعروفة

يتضمن المصدر اختبارات آلية لمنطق المحاسبة وسلوك الواجهة وضوابط الأمان وسلوك الأداة ونصوص المثبّت واختبارات تراجع المتصفح. اجتاز التدقيق المتاح للمصدر فحوص صياغة JavaScript واختبارات Node واختبارات ترحيل البيانات ونصوص المثبّت واختبارات تراجع المتصفح. ومع ذلك، لا يُعد هذا التدقيق تحققاً كاملاً من بناء تطبيق Windows التنفيذي وتثبيته في جميع البيئات المستهدفة.

لا تغني الاختبارات الآلية عن التحقق اليدوي من التثبيت وإلغاء التثبيت والعمل دون اتصال والطباعة الفعلية ومخرجات PDF وترحيل البيانات واستعادة النسخ الاحتياطية والتوافق مع جميع إصدارات Windows والأجهزة. ولا يدّعي هذا المستودع إجراء تدقيق أمني كامل أو الحصول على اعتماد للجاهزية الإنتاجية.

## سلامة البيانات والخصوصية

- تُحفظ بيانات المستخدم محلياً ضمن ملف تعريف مستخدم Windows الحالي.
- صُمّم هذا الإصدار لمستخدم وجهاز محليين؛ لا تفترض وجود مزامنة سحابية أو صلاحيات جماعية أو نسخ احتياطي على الخادم.
- احتفظ بنسخ احتياطية منتظمة في مكان منفصل، واختبر الاستعادة قبل الاعتماد عليها.
- راجع الحسابات والفواتير والتقارير والملفات المصدّرة قبل استخدامها في قرارات ضريبية أو قانونية أو مهمة.
- لا يوجد ضمان لاستمرار الدعم أو للامتثال لمتطلبات تنظيمية محددة.
- يساعد تجزئة SHA-256 في اكتشاف التغييرات غير المقصودة في الملف، لكنها **ليست توقيعاً للناشر** ولا تثبت أن الملف آمن.


## الترخيص وإعادة الاستخدام

يُوزّع هذا المشروع بموجب **رخصة MIT**؛ راجع الملف [`LICENSE`](LICENSE) للنص الكامل. تسمح الرخصة عموماً بالاستخدام الشخصي والتجاري والتعديل وإعادة التوزيع ودمج الكود في مشاريع أخرى، شريطة الاحتفاظ بإشعار حقوق النشر ونص الترخيص وفقاً لشروط الرخصة.

وتظل المكونات الخارجية خاضعة لتراخيصها الخاصة. إن إتاحة المصدر علناً لا تعني أن البرنامج آمن أو جاهز للاستخدام الإنتاجي أو مناسب لكل نشاط تجاري.

**الإصدار:** 1.50.7  
**المنصة المشمولة:** Windows 10/11 x64  
**الترخيص:** MIT
