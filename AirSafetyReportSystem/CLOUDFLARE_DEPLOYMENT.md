# Cloudflare Deployment Guide - Report Sys

## ⚠️ ملاحظة هامة

المشروع الحالي يستخدم **Express.js** و **better-sqlite3** (Node.js APIs) التي **لا تعمل** مباشرة على Cloudflare Workers.

## الخيارات المتاحة:

### الخيار 1: Cloudflare Pages (موصى به)
Cloudflare Pages يدعم Node.js ويمكن تشغيل Express applications باستخدام Functions:

1. **إعداد Cloudflare Pages:**
   - ارفع المشروع إلى GitHub
   - اربط المستودع مع Cloudflare Pages
   - استخدم build command: `npm run build`
   - Output directory: `dist/public`
   - Node.js version: `18` أو `20`

2. **إعداد قاعدة البيانات:**
   - يمكنك استخدام Cloudflare D1 (SQLite)
   - أو استخدام قاعدة بيانات خارجية (PostgreSQL, MySQL)
   - يجب تحديث `server/db.ts` لدعم D1 إذا أردت استخدامه

### الخيار 2: Cloudflare Workers (يتطلب إعادة هيكلة)
يتطلب إعادة كتابة المشروع بالكامل:

1. استبدال Express بـ Workers API
2. استبدال better-sqlite3 بـ Cloudflare D1
3. إزالة Node.js APIs (fs, path, etc.)
4. استخدام Cloudflare KV للملفات بدلاً من filesystem

## التوصية
استخدم **Cloudflare Pages** لأنه يدعم Express و Node.js APIs دون تغييرات كبيرة في الكود.

## الخطوات التالية

1. ✅ تم إصلاح جميع أخطاء TypeScript
2. ✅ تم تنظيف الملفات غير المستخدمة
3. ⏳ يجب تحديث database configuration لدعم Cloudflare D1 (إذا لزم الأمر)
4. ⏳ يجب إعداد environment variables في Cloudflare
5. ⏳ يجب إضافة build scripts للنشر

## الملفات المطلوبة للنشر

- ✅ `package.json` - scripts محدثة
- ✅ `vite.config.ts` - إعدادات البناء
- ✅ `server/vite.ts` - مسار static files محدث
- ⏳ `.env` - متغيرات البيئة (يجب إضافتها في Cloudflare dashboard)
- ⏳ `wrangler.toml` - للتكوين (Pages لا يحتاجه، Workers يحتاجه)

