# Arabic Font Setup for jsPDF

## خطوات إضافة الخط العربي:

1. **تحميل خط عربي TTF:**
   - قم بتحميل خط عربي مجاني مثل "Amiri" من Google Fonts:
     https://fonts.google.com/specimen/Amiri
   - أو استخدم خط "Traditional Arabic" أو "Arial Unicode MS"

2. **تحويل الخط إلى تنسيق jsPDF:**
   - افتح أداة التحويل: https://raw.githack.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
   - حمّل ملف الخط TTF
   - احفظ الملف الناتج كـ `arabic-font.js` في هذا المجلد

3. **استخدام الخط:**
   - سيتم استيراد الخط تلقائياً في `report-detail.tsx`
   - الخط سيعمل تلقائياً مع النص العربي في PDF

## ملاحظة:
- تأكد من أن الخط يدعم جميع الأحرف العربية
- الخط الموصى به: Amiri (مجاني ومفتوح المصدر)

