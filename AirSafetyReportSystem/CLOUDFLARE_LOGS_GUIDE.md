# دليل الوصول إلى سجلات Cloudflare Pages Functions

## الطريقة 1: استخدام Cloudflare Dashboard (الطريقة الأسهل)

### خطوات الوصول:

1. **افتح Cloudflare Dashboard:**
   - اذهب إلى: https://dash.cloudflare.com/
   - قم بتسجيل الدخول

2. **انتقل إلى Pages:**
   - من القائمة الجانبية، اختر **Workers & Pages**
   - أو اذهب مباشرة إلى: https://dash.cloudflare.com/?to=/:account/pages

3. **اختر مشروعك:**
   - ابحث عن مشروع `report-sys` وانقر عليه

4. **افتح سجلات Production:**
   - في صفحة المشروع، انقر على تبويب **Functions**
   - أو انقر على **Deployments** ثم اختر آخر deployment
   - انقر على **View Logs** أو **Logs**

5. **عرض السجلات:**
   - ستظهر لك سجلات جميع الطلبات
   - يمكنك تصفية حسب:
     - **Status Code** (مثل 500, 401, 200)
     - **Function Name** (مثل `api/auth/login`)
     - **Time Range** (آخر ساعة، آخر 24 ساعة، إلخ)

---

## الطريقة 2: استخدام Wrangler CLI (للتنمية المحلية)

### عرض السجلات في الوقت الفعلي:

```powershell
# عرض سجلات آخر deployment
npx wrangler pages deployment tail --project-name=report-sys

# عرض سجلات deployment محدد
npx wrangler pages deployment tail --project-name=report-sys --deployment-id=YOUR_DEPLOYMENT_ID

# عرض السجلات مع فلترة
npx wrangler pages deployment tail --project-name=report-sys --format=pretty
```

### مثال على الأمر:

```powershell
# في PowerShell
npx wrangler pages deployment tail --project-name=report-sys
```

**ملاحظة:** قد تحتاج إلى تسجيل الدخول أولاً:
```powershell
npx wrangler login
```

---

## الطريقة 3: استخدام Browser DevTools (للتطوير المحلي)

إذا كنت تعمل على localhost، يمكنك رؤية السجلات في:
- **Console** في المتصفح (F12)
- **Network** tab لرؤية طلبات API

---

## ما الذي تبحث عنه في السجلات؟

### أخطاء تسجيل الدخول:

ابحث عن:
1. **`bcrypt comparison error:`** - خطأ في مقارنة كلمة المرور
2. **`Login error:`** - خطأ عام في تسجيل الدخول
3. **`Failed to hash password:`** - فشل في تشفير كلمة المرور
4. **`JWT signing error:`** - خطأ في إنشاء JWT token

### مثال على رسالة خطأ:

```
[ERROR] bcrypt comparison error: Cannot read property 'compareSync' of undefined
[ERROR] Login error: { message: "Internal server error", stack: "..." }
```

---

## كيفية قراءة السجلات:

### 1. **Request Logs:**
```
[2024-01-15 10:30:45] POST /api/auth/login
Status: 500
Duration: 150ms
```

### 2. **Console Logs:**
```
[LOG] bcrypt comparison error: TypeError: ...
[LOG] Auto-hashed password for user user@example.com
```

### 3. **Error Logs:**
```
[ERROR] Login error: {
  message: "Internal server error",
  stack: "Error: ...",
  name: "TypeError"
}
```

---

## نصائح للتصحيح:

### 1. **فلترة حسب الخطأ:**
   - في Dashboard، استخدم البحث: `error` أو `ERROR`
   - أو فلتر حسب Status Code: `500`

### 2. **فحص آخر deployment:**
   - تأكد من أنك تنظر إلى آخر deployment
   - Deployment ID يظهر في URL: `https://...pages.dev`

### 3. **مشاركة السجلات:**
   - انسخ السجلات الكاملة
   - أو التقط screenshot
   - أرسلها للمساعدة في حل المشكلة

---

## روابط مفيدة:

- **Cloudflare Dashboard:** https://dash.cloudflare.com/
- **Pages Projects:** https://dash.cloudflare.com/?to=/:account/pages
- **Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/

---

## حل مشكلة شائعة:

### إذا لم تظهر السجلات:

1. **تأكد من أنك في Production:**
   - السجلات تظهر فقط في Production deployments

2. **تحقق من أن لديك الصلاحيات:**
   - يجب أن تكون لديك صلاحيات `View` على المشروع

3. **استخدم Wrangler كبديل:**
   ```powershell
   npx wrangler pages deployment tail --project-name=report-sys
   ```

---

## ملاحظة مهمة:

- **السجلات في Cloudflare Dashboard محدودة بـ 7 أيام**
- **للسجلات الأطول، استخدم Wrangler أو تكامل خارجي**
- **تأكد من أن `console.log` و `console.error` موجودة في الكود**

