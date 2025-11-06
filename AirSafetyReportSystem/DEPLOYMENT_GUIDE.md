# دليل النشر - Security Improvements
# Deployment Guide - Security Improvements

## 📋 خطوات النشر (Deployment Steps)

### 1. توليد JWT_SECRET قوي

#### على Windows (PowerShell):
```powershell
# الطريقة 1: استخدام OpenSSL (إذا كان مثبت)
openssl rand -base64 48

# الطريقة 2: استخدام PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

#### على Linux/Mac:
```bash
openssl rand -base64 48
```

#### أو استخدام موقع online:
- https://www.random.org/strings/
- اختر: 48 حرف، Upper + Lower + Numbers

**مثال على JWT_SECRET قوي:**
```
aB3xY9mK2pL8nQ5wR7tU4vI6oP1sA0dF3gH7jK9lZ2xC5vB8nM1qW4eR6tY3uI0oP7aS
```

---

### 2. إضافة Environment Variables في Cloudflare Pages

#### الطريقة 1: عبر Cloudflare Dashboard

1. **افتح Cloudflare Dashboard:**
   - اذهب إلى: https://dash.cloudflare.com
   - اختر حسابك

2. **انتقل إلى Pages:**
   - من القائمة الجانبية: `Workers & Pages`
   - اختر `Pages`
   - اختر مشروعك: `report-sys`

3. **إضافة Environment Variables:**
   - اضغط على `Settings`
   - اختر `Environment variables`
   - اضغط `Add variable`

4. **أضف المتغيرات التالية:**

   **Production:**
   ```
   Variable name: JWT_SECRET
   Value: [الصق المفتاح الذي تم توليده]
   ```

   ```
   Variable name: NODE_ENV
   Value: production
   ```

   **Preview (اختياري):**
   ```
   Variable name: JWT_SECRET
   Value: [مفتاح مختلف للاختبار]
   ```

   ```
   Variable name: NODE_ENV
   Value: development
   ```

5. **حفظ التغييرات:**
   - اضغط `Save`
   - انتظر حتى يتم حفظ المتغيرات

#### الطريقة 2: عبر Wrangler CLI

```bash
# تعيين JWT_SECRET
npx wrangler pages secret put JWT_SECRET --project-name=report-sys

# سيطلب منك إدخال القيمة - الصق المفتاح الذي تم توليده

# تعيين NODE_ENV (اختياري - يمكن تعيينه في wrangler.toml)
```

---

### 3. التحقق من المتغيرات

#### عبر Dashboard:
- تأكد من ظهور المتغيرات في قائمة `Environment variables`

#### عبر Wrangler:
```bash
npx wrangler pages secret list --project-name=report-sys
```

---

### 4. بناء المشروع محلياً (اختياري - للاختبار)

```bash
# بناء المشروع
npm run build

# اختبار محلي (إذا كان لديك Wrangler)
npx wrangler pages dev dist/public
```

---

### 5. نشر التحديثات

#### الطريقة 1: عبر Git Push (إذا كان Git متصل)

```bash
# إضافة التغييرات
git add .

# عمل commit
git commit -m "Security improvements: JWT signing, rate limiting, input validation"

# Push إلى GitHub/GitLab
git push origin main
```

**Cloudflare Pages سيتلقى التحديثات تلقائياً ويبدأ Build**

#### الطريقة 2: عبر Wrangler CLI

```bash
# بناء المشروع
npm run build

# نشر مباشر
npx wrangler pages deploy dist/public --project-name=report-sys --commit-dirty=true
```

---

### 6. مراقبة النشر

1. **في Cloudflare Dashboard:**
   - اذهب إلى `Pages` → مشروعك
   - اضغط على `Deployments`
   - راقب حالة النشر (Building → Success/Failed)

2. **في Logs:**
   - بعد النشر، اذهب إلى `Functions` → `Logs`
   - تحقق من عدم وجود أخطاء

---

### 7. اختبار النظام بعد النشر

#### اختبار JWT:
1. جرب تسجيل الدخول
2. تحقق من أن Token يتم توليده بنجاح
3. تحقق من أن Token موقّع (يجب أن يحتوي على 3 أجزاء: header.payload.signature)

#### اختبار Rate Limiting:
1. حاول تسجيل الدخول 6 مرات بشكل متتالي
2. يجب أن تحصل على رسالة `429 Too Many Requests` في المحاولة السادسة

#### اختبار Input Validation:
1. حاول إرسال بيانات غير صحيحة
2. يجب أن تحصل على رسائل خطأ واضحة

---

### 8. التحقق من الأمان

#### ✅ Checklist:

- [ ] JWT_SECRET تم تعيينه (32+ حرف)
- [ ] NODE_ENV=production
- [ ] النشر تم بنجاح
- [ ] تسجيل الدخول يعمل
- [ ] Rate Limiting يعمل (5 محاولات / 15 دقيقة)
- [ ] Input Validation يعمل
- [ ] Error messages آمنة (لا تكشف معلومات حساسة)
- [ ] لا توجد أخطاء في Logs

---

### 9. إعدادات إضافية موصى بها

#### في Cloudflare Pages Settings:

1. **Custom Domain:**
   - إضافة domain مخصص
   - تفعيل HTTPS (تلقائي)

2. **Build Settings:**
   ```
   Build command: npm run build
   Build output directory: dist/public
   ```

3. **Environment Variables الأخرى (إذا لزم):**
   ```
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=[كلمة مرور قوية]
   DATABASE_URL=[إذا كان لديك database خارجي]
   ```

---

### 10. استكشاف الأخطاء

#### مشكلة: "JWT_SECRET is too short"
**الحل:** تأكد من أن JWT_SECRET 32 حرف على الأقل

#### مشكلة: "Rate limiting not working"
**الحل:** 
- تأكد من أن D1 database متصل
- تحقق من جدول `rate_limit` في Database

#### مشكلة: "Login fails after deployment"
**الحل:**
- تحقق من Environment Variables
- تحقق من Logs في Cloudflare Dashboard
- تأكد من أن JWT_SECRET صحيح

#### مشكلة: "Old tokens not working"
**الحل:** 
- هذا طبيعي - Tokens القديمة (غير موقعة) ستتوقف عن العمل تدريجياً
- المستخدمون يحتاجون لتسجيل الدخول مرة أخرى للحصول على Token جديد

---

### 11. Rollback (إذا لزم)

إذا واجهت مشاكل بعد النشر:

```bash
# في Cloudflare Dashboard:
# Pages → Deployments → اختر deployment سابق → Rollback
```

---

### 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من Logs في Cloudflare Dashboard
2. تحقق من Environment Variables
3. تأكد من أن جميع الملفات تم تحديثها

---

**تاريخ الدليل:** 2024
**الإصدار:** 1.0

