# دليل النشر السريع
# Quick Deployment Guide

## 🚀 خطوات النشر السريعة

### الخطوة 1: توليد JWT_SECRET

#### على Windows:
```powershell
# تشغيل السكريبت
powershell -ExecutionPolicy Bypass -File generate-jwt-secret.ps1
```

#### أو استخدم هذا المفتاح (للاختبار فقط - استخدم مفتاح مختلف في Production):
```
aB3xY9mK2pL8nQ5wR7tU4vI6oP1sA0dF3gH7jK9lZ2xC5vB8nM1qW4eR6tY3uI0oP7aS9dF2gH
```

---

### الخطوة 2: إضافة Environment Variables في Cloudflare

#### عبر Dashboard:
1. اذهب إلى: https://dash.cloudflare.com
2. `Workers & Pages` → `Pages` → `report-sys`
3. `Settings` → `Environment variables`
4. اضغط `Add variable`

#### أضف المتغيرات التالية:

**Production:**
- **Variable name:** `JWT_SECRET`
- **Value:** [الصق المفتاح من الخطوة 1]

- **Variable name:** `NODE_ENV`
- **Value:** `production`

---

### الخطوة 3: النشر

#### الطريقة 1: عبر Git (موصى به)
```bash
git add .
git commit -m "Security improvements: JWT signing, rate limiting, validation"
git push origin main
```

Cloudflare Pages سيبدأ البناء تلقائياً.

#### الطريقة 2: عبر Wrangler CLI
```bash
npm run build
npx wrangler pages deploy dist/public --project-name=report-sys --commit-dirty=true
```

---

### الخطوة 4: التحقق

1. **في Cloudflare Dashboard:**
   - `Pages` → `report-sys` → `Deployments`
   - انتظر حتى يكتمل البناء (Status: Success)

2. **اختبار النظام:**
   - جرب تسجيل الدخول
   - تحقق من أن Rate Limiting يعمل (5 محاولات / 15 دقيقة)
   - تحقق من أن Input Validation يعمل

---

## ✅ Checklist

- [ ] JWT_SECRET تم توليده (48 حرف)
- [ ] Environment Variables تم إضافتها في Cloudflare
- [ ] النشر تم بنجاح
- [ ] تسجيل الدخول يعمل
- [ ] Rate Limiting يعمل
- [ ] لا توجد أخطاء في Logs

---

## 🔍 استكشاف الأخطاء

### المشكلة: "JWT_SECRET is too short"
**الحل:** تأكد من أن المفتاح 32+ حرف

### المشكلة: "Login fails"
**الحل:** 
- تحقق من Environment Variables
- تحقق من Logs في Cloudflare Dashboard

### المشكلة: "Rate limiting not working"
**الحل:** 
- تأكد من أن D1 database متصل
- تحقق من جدول `rate_limit`

---

## 📞 ملاحظات

- **JWT_SECRET:** يجب أن يكون قوياً وفريداً (لا تشاركه أبداً)
- **NODE_ENV:** `production` للإنتاج، `development` للاختبار
- **Tokens القديمة:** ستتوقف عن العمل تدريجياً - المستخدمون يحتاجون لتسجيل الدخول مرة أخرى

---

**تاريخ:** 2024

