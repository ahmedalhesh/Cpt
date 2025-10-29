# 🔗 ربط قاعدة البيانات D1 بتطبيق Cloudflare Pages

## ✅ الحالة الحالية

### 1. ملف wrangler.toml محدّث بشكل صحيح:

```toml
# D1 Database configuration
[[d1_databases]]
binding = "DB"                    # ✅ الربط الصحيح
database_name = "reportDB"        # ✅ اسم قاعدة البيانات
database_id = "6b920600-39c2-4b2b-a8d5-fbf79cdfbd1a"  # ✅ معرّف D1
```

### 2. الكود يستخدم `env.DB` بشكل صحيح:

```typescript
// في functions/api/reports.ts
export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  // يستخدم env.DB للوصول إلى قاعدة البيانات
  await env.DB.prepare(`INSERT INTO reports (...) VALUES (...)`).bind(...).run();
}
```

## 🔧 التحقق من الربط في لوحة تحكم Cloudflare

### الطريقة الأولى: عبر لوحة التحكم (موصى بها)

1. **افتح لوحة تحكم Cloudflare:**
   https://dash.cloudflare.com/c65441278840d45ed3cd9cfef5b898b1

2. **اذهب إلى Workers & Pages:**
   - من القائمة الجانبية، اختر "Workers & Pages"
   - ابحث عن مشروع "report-sys"
   - انقر على المشروع

3. **افتح الإعدادات:**
   - اذهب إلى تبويب "Settings"
   - ثم "Functions"

4. **تحقق من D1 Database Bindings:**
   - ابحث عن قسم "D1 database bindings"
   - يجب أن ترى:
     - **Variable name:** `DB`
     - **D1 database:** `reportDB`

5. **إذا لم يكن موجوداً، أضفه:**
   - انقر "Add binding"
   - Variable name: `DB`
   - اختر D1 database: `reportDB`
   - احفظ التغييرات

### الطريقة الثانية: عبر wrangler (تلقائي)

عند النشر باستخدام:
```bash
wrangler pages deploy dist/public --project-name=report-sys
```

يتم قراءة إعدادات `wrangler.toml` تلقائياً وتطبيق الربط.

## 🧪 اختبار الربط

### 1. اختبر endpoint الصحة:
```bash
curl https://report-sys.pages.dev/api/health
```

**النتيجة المتوقعة:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-29T...",
  "database": "D1 connected",
  "environment": "production"
}
```

### 2. اختبر إنشاء تقرير:
- افتح: https://report-sys.pages.dev
- سجل الدخول: admin@airline.com / password123
- أنشئ تقرير ASR جديد
- املأ البيانات واضغط Submit

**النتيجة المتوقعة:**
- ✅ تم إنشاء التقرير بنجاح
- ✅ لا أخطاء 500
- ✅ التقرير يظهر في القائمة

## 🔍 استكشاف الأخطاء

### إذا ظهر خطأ "D1 binding 'DB' not found":

**الحل 1 - عبر لوحة التحكم:**
```
1. Cloudflare Dashboard
2. Workers & Pages > report-sys
3. Settings > Functions
4. D1 database bindings > Add binding
5. Variable name: DB
6. D1 database: reportDB
7. Save
```

**الحل 2 - إعادة النشر:**
```bash
npm run build
wrangler pages deploy dist/public --project-name=report-sys
```

### إذا ظهر خطأ "table reports does not exist":

```bash
# تطبيق المخطط على D1
wrangler d1 execute reportDB --remote --file=./migrations/d1-schema.sql

# ثم إعادة النشر
npm run build
wrangler pages deploy dist/public --project-name=report-sys
```

## 📋 قائمة التحقق النهائية

- [x] ملف `wrangler.toml` يحتوي على `binding = "DB"`
- [x] قاعدة البيانات D1 موجودة: `reportDB`
- [x] المخطط مطبّق على D1: `d1-schema.sql`
- [x] الكود يستخدم `env.DB`
- [ ] **تحقق من الربط في لوحة تحكم Cloudflare** ← افعل هذا الآن!
- [ ] اختبر إنشاء تقرير على التطبيق المنشور

## 🚀 الخطوات التالية

1. **افتح لوحة تحكم Cloudflare**
2. **تحقق من D1 bindings في إعدادات المشروع**
3. **أضف الربط إذا لم يكن موجوداً**
4. **أعد النشر إذا لزم الأمر**
5. **اختبر إنشاء تقرير**

---

**ملاحظة مهمة:** 
Cloudflare Pages يقرأ `wrangler.toml` تلقائياً عند النشر، لكن في بعض الحالات قد تحتاج إلى إضافة الربط يدوياً عبر لوحة التحكم.

