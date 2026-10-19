'use strict';
const words={
 app:['حسابداری تمشک','Tameshk Accounting','تمشك للمحاسبة'],
 toolbar:['ابزارک حسابداری تمشک','Tameshk Accounting widget','أداة تمشك للمحاسبة'],
 transaction:['ثبت تراکنش','New transaction','تسجيل معاملة'],expense:['ثبت هزینه','Add expense','تسجيل مصروف'],charity:['ثبت خیریه','Record charity','تسجيل تبرع'],history:['تاریخچه ابزارک','Widget history','سجل الأداة'],invoice:['پیش‌نمایش فاکتور','Invoice preview','معاينة الفاتورة'],
 openApp:['بازکردن حسابداری تمشک','Open Tameshk Accounting','فتح تمشك للمحاسبة'],
 openLogs:['بازکردن پوشهٔ گزارش‌ها','Open logs folder','فتح مجلد السجلات'],
 logs:['لاگ','Logs','السجلات'],logsHint:['بازکردن پوشهٔ گزارش‌های خطا','Open the error logs folder','فتح مجلد سجلات الأخطاء'],
 quit:['خروج کامل','Quit completely','إنهاء التطبيق بالكامل'],close:['بستن','Close','إغلاق'],logPath:['مسیر گزارش‌ها:','Logs folder:','مجلد السجلات:'],
 trayHint:['فرستادن برنامه به نوار آیکن‌های مخفی؛ برنامه در پس‌زمینه می‌ماند','Send to the system tray; the app stays running in the background','إرسال التطبيق إلى علبة النظام؛ يظل يعمل في الخلفية'],
 'خطای پیش‌بینی‌نشده در برنامه رخ داد.':['خطای پیش‌بینی‌نشده در برنامه رخ داد.','An unexpected application error occurred.','حدث خطأ غير متوقع في التطبيق.'],
 'رابط برنامه متوقف شد. گزارش خطا ذخیره شد.':['رابط برنامه متوقف شد. گزارش خطا ذخیره شد.','The application interface stopped. An error log was saved.','توقفت واجهة التطبيق. تم حفظ سجل الخطأ.'],
 'صفحهٔ اصلی برنامه بارگذاری نشد.':['صفحهٔ اصلی برنامه بارگذاری نشد.','The main application page could not be loaded.','تعذر تحميل الصفحة الرئيسية للتطبيق.'],
 'درگاه محلی برنامه اشغال شده است؛ برنامهٔ متعارض را ببندید و دوباره اجرا کنید.':['درگاه محلی برنامه اشغال شده است؛ برنامهٔ متعارض را ببندید و دوباره اجرا کنید.','The local application port is in use. Close the conflicting application and try again.','منفذ التطبيق المحلي قيد الاستخدام. أغلق التطبيق المتعارض وحاول مرة أخرى.'],
 'برنامه هنگام شروع با خطا روبه‌رو شد.':['برنامه هنگام شروع با خطا روبه‌رو شد.','An error occurred while starting the application.','حدث خطأ أثناء بدء التطبيق.']
};
function normalizeLanguage(language){return ['fa','en','ar'].includes(language)?language:'en'}
function text(key,language){const values=Object.hasOwn(words,key)?words[key]:null;return values?values[{fa:0,en:1,ar:2}[normalizeLanguage(language)]]:String(key)}
module.exports={text,normalizeLanguage};
