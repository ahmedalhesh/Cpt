# خطوات النشر على Cloudflare Pages - دليل خطوة بخطوة

## ✅ الخطوة 1: رفع المشروع إلى GitHub

تمت هذه الخطوة:
```bash
git add .
git commit -m "Prepare project for Cloudflare Pages deployment"
git push origin main
```

---

## 📋 الخطوة 2: إعداد Cloudflare Pages

### 2.1 الدخول إلى Cloudflare Dashboard
1. اذهب إلى [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. سجل الدخول أو أنشئ حساب

### 2.2 إنشاء مشروع Pages جديد
1. من القائمة الجانبية، اختر **Pages**
2. اضغط على **Create a project**
3. اختر **Connect to Git**
4. اختر مستودعك من GitHub (AirSafetyReportSystem)
5. اضغط **Begin setup**

### 2.3 إعدادات البناء (Build Settings)
املأ الحقول التالية:

**Project name:**
```
report-sys
```

**Production branch:**
```
main
```

**Build command:**
```
npm install && npm run build
```

**Build output directory:**
```
dist/public
```

**Root directory (leave empty):**
```
(فارغ)
```

**Framework preset:**
```
None (أو React - اختياري)
```

**Node.js version:**
```
20
```

---

## 🔐 الخطوة 3: إعداد Environment Variables

بعد إنشاء المشروع:

1. اذهب إلى **Settings** → **Environment variables**
2. أضف المتغيرات التالية:

### Production Environment Variables:
```
DATABASE_URL=./database.sqlite
JWT_SECRET=your-very-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=3000
```

**ملاحظة**: يمكنك أيضًا إضافة نفس المتغيرات لـ **Preview** environment

---

## 💾 الخطوة 4: إعداد قاعدة البيانات

### الخيار 1: استخدام Cloudflare D1 (SQLite في السحابة)

1. في Cloudflare Dashboard، اذهب إلى **Workers & Pages** → **D1**
2. اضغط **Create database**
3. اسم: `report-sys-db`
4. انسخ **Database ID**
5. اربط Database مع Pages project:
   - في Pages project → Settings → **Functions**
   - أضف binding:
     - Variable name: `DB`
     - D1 Database: `report-sys-db`
6. حدّث `DATABASE_URL` في environment variables لتشير إلى D1

### الخيار 2: قاعدة بيانات خارجية

استخدم PostgreSQL أو MySQL من مزود خارجي:
- حدّث `DATABASE_URL` في environment variables
- حدّث `drizzle.config.ts` للنوع الجديد

### الخيار 3: البقاء على SQLite محلي (للتطوير فقط)

⚠️ هذا غير موصى به للإنتاج، لكن يمكن استخدامه للتجربة

---

## 🚀 الخطوة 5: النشر والاختبار

1. بعد إتمام الإعدادات، اضغط **Save and Deploy**
2. Cloudflare سيبدأ البناء تلقائياً
3. انتظر حتى يكتمل البناء (عادة 2-5 دقائق)
4. بعد البناء، ستحصل على رابط:
   - `https://report-sys.pages.dev`
   - أو رابط مخصص إذا أضفت domain

---

## 🔍 الخطوة 6: الاختبار

### اختبار الوصول:
1. افتح الرابط في المتصفح
2. جرب تسجيل الدخول:
   - Email: `demo@airline.com`
   - Password: `password123`

### اختبار الوظائف:
- ✅ إنشاء تقرير جديد
- ✅ عرض التقارير
- ✅ تحديث حالة التقرير
- ✅ إضافة تعليق
- ✅ تصدير PDF

---

## 🐛 حل المشاكل الشائعة

### مشكلة: البناء يفشل
**الحل:**
- تحقق من Node.js version (يجب أن يكون 18+)
- تحقق من build command
- تحقق من environment variables

### مشكلة: الصفحة تظهر "Not Found"
**الحل:**
- تحقق من Build output directory: `dist/public`
- تحقق من أن `dist/public/index.html` موجود

### مشكلة: قاعدة البيانات لا تعمل
**الحل:**
- إذا كنت تستخدم D1، تأكد من ربط Database مع Pages project
- تحقق من `DATABASE_URL` في environment variables
- تأكد من تشغيل migrations على D1

### مشكلة: المصادقة لا تعمل
**الحل:**
- تحقق من `JWT_SECRET` في environment variables
- تأكد من أنه قوي وآمن

---

## 📞 المساعدة

إذا واجهت أي مشاكل:
1. تحقق من Cloudflare Pages logs
2. راجع ملف `CLOUDFLARE_CHECKLIST.md`
3. راجع ملف `DEPLOYMENT_SUMMARY.md`

---

## ✅ قائمة التحقق النهائية

- [ ] المشروع مرفوع على GitHub
- [ ] Cloudflare Pages project منشأ
- [ ] Build settings محددة بشكل صحيح
- [ ] Environment variables مضافوة
- [ ] قاعدة البيانات معدة (D1 أو خارجية)
- [ ] البناء مكتمل بنجاح
- [ ] الموقع يعمل بشكل صحيح
- [ ] جميع الوظائف مختبرة

---

**🎉 مبروك! مشروعك الآن على Cloudflare Pages!**

