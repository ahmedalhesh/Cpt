# إعداد الخط العربي لـ jsPDF

## الخطوات المطلوبة:

### 1. تحميل خط عربي TTF
- قم بتحميل خط عربي مجاني مثل **Amiri** من Google Fonts:
  - الرابط: https://fonts.google.com/specimen/Amiri
  - أو استخدم خط **Traditional Arabic** أو **Arial Unicode MS**

### 2. تحويل الخط إلى تنسيق jsPDF
- افتح أداة التحويل: https://raw.githack.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
- حمّل ملف الخط TTF (مثل `Amiri-Regular.ttf`)
- ستقوم الأداة بإنشاء ملف JavaScript يحتوي على الخط بتنسيق Base64

### 3. إضافة الخط إلى المشروع
- انسخ محتوى الملف الناتج من أداة التحويل
- استبدل محتوى ملف `arabic-font.ts` بالمحتوى التالي:

```typescript
import { jsPDF } from 'jspdf';

// Add the font file to VFS
jsPDF.API.events.push(['addFonts', function() {
  // استبدل base64FontData بالبيانات الفعلية من أداة التحويل
  this.addFileToVFS('Amiri-Regular-normal.ttf', base64FontData);
  this.addFont('Amiri-Regular-normal.ttf', 'ArabicFont', 'normal');
  this.addFont('Amiri-Regular-normal.ttf', 'ArabicFont', 'bold');
}]);

export default { loaded: true };
```

### 4. التحقق من العمل
- بعد إضافة الخط، سيتم استخدامه تلقائياً في PDF لتقرير NCR
- النص العربي سيظهر بشكل صحيح مع الخط العربي المدعوم

## ملاحظات:
- تأكد من أن الخط يدعم جميع الأحرف العربية
- الخط الموصى به: **Amiri** (مجاني ومفتوح المصدر)
- حجم الملف بعد التحويل قد يكون كبيراً (عدة ميجابايت)

