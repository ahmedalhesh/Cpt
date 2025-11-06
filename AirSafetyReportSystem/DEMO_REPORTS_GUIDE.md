# دليل استخدام التقارير التجريبية (Demo Reports Guide)

## نظرة عامة

هذا الدليل يشرح كيفية استخدام endpoints إنشاء التقارير التجريبية في نظام Air Safety Report System.

## الـ Endpoints المتاحة

### 1. إنشاء جميع التقارير دفعة واحدة
```
POST /api/demo/create-all
```
ينشئ تقارير تجريبية لجميع أنواع التقارير (ASR, NCR, CDF, CHR, OR, RIR)

### 2. إنشاء تقرير واحد لكل نوع
```
POST /api/demo/create-asr    # Air Safety Report
POST /api/demo/create-ncr     # Non-Conformance Report
POST /api/demo/create-cdf     # Commander's Discretion Form
POST /api/demo/create-chr     # Confidential Hazard Report
POST /api/demo/create-or      # Occurrence Report
POST /api/demo/create-rir     # Ramp Incident Report
```

## طرق الاستخدام

### الطريقة 1: من Dashboard (الأسهل) ✅

1. سجل الدخول كـ **Admin**
2. اذهب إلى **Dashboard**
3. اضغط على زر **"إنشاء تقارير تجريبية"**
4. سيتم إنشاء جميع التقارير التجريبية تلقائياً

### الطريقة 2: من Console المتصفح (Browser Console)

افتح Developer Tools (F12) ثم نفذ:

```javascript
// إنشاء جميع التقارير
fetch('/api/demo/create-all', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(res => res.json())
.then(data => {
  console.log('✅ تم الإنشاء بنجاح:', data);
  // إعادة تحميل الصفحة لعرض التقارير الجديدة
  window.location.reload();
})
.catch(error => {
  console.error('❌ خطأ:', error);
});
```

### الطريقة 3: استخدام curl (Terminal/Command Prompt)

#### Windows (PowerShell):
```powershell
# إنشاء جميع التقارير
Invoke-WebRequest -Uri "https://98751ecf.report-sys.pages.dev/api/demo/create-all" -Method POST -ContentType "application/json"
```

#### Windows (CMD):
```cmd
curl -X POST https://98751ecf.report-sys.pages.dev/api/demo/create-all -H "Content-Type: application/json"
```

#### Linux/Mac:
```bash
# إنشاء جميع التقارير
curl -X POST https://98751ecf.report-sys.pages.dev/api/demo/create-all \
  -H "Content-Type: application/json"

# إنشاء تقرير ASR فقط
curl -X POST https://98751ecf.report-sys.pages.dev/api/demo/create-asr \
  -H "Content-Type: application/json"

# إنشاء تقرير NCR فقط
curl -X POST https://98751ecf.report-sys.pages.dev/api/demo/create-ncr \
  -H "Content-Type: application/json"
```

### الطريقة 4: استخدام Postman أو أي API Testing Tool

1. افتح Postman أو أي أداة API testing
2. أنشئ طلب جديد (New Request)
3. اختر **POST** كـ Method
4. أدخل URL:
   ```
   https://98751ecf.report-sys.pages.dev/api/demo/create-all
   ```
5. في Headers، أضف:
   ```
   Content-Type: application/json
   ```
6. اضغط **Send**

### الطريقة 5: استخدام JavaScript في صفحة HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>Create Demo Reports</title>
</head>
<body>
    <button onclick="createDemoReports()">إنشاء تقارير تجريبية</button>
    
    <script>
        async function createDemoReports() {
            try {
                const response = await fetch('/api/demo/create-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert(`✅ تم إنشاء ${data.results?.filter(r => r.success).length} تقرير بنجاح!`);
                    console.log('التفاصيل:', data);
                } else {
                    alert(`❌ خطأ: ${data.error}`);
                }
            } catch (error) {
                alert(`❌ خطأ في الاتصال: ${error.message}`);
            }
        }
    </script>
</body>
</html>
```

## الاستجابة المتوقعة (Response)

### نجاح (Success):
```json
{
  "success": true,
  "message": "Demo reports created for all report types",
  "results": [
    { "type": "asr", "id": "uuid-here", "success": true },
    { "type": "ncr", "id": "uuid-here", "success": true },
    { "type": "cdf", "id": "uuid-here", "success": true },
    { "type": "chr", "id": "uuid-here", "success": true },
    { "type": "or", "id": "uuid-here", "success": true },
    { "type": "rir", "id": "uuid-here", "success": true }
  ]
}
```

### خطأ (Error):
```json
{
  "success": false,
  "error": "Failed to create demo reports",
  "details": "Error message here"
}
```

## ملاحظات مهمة

1. **المستخدم التجريبي**: يتم إنشاء مستخدم تجريبي تلقائياً إذا لم يكن موجوداً:
   - Email: `demo@airline.com`
   - Password: `demo123`
   - Role: `captain`

2. **البيانات**: جميع التقارير التجريبية تحتوي على بيانات شاملة في جميع الحقول

3. **الإشعارات**: يتم إنشاء إشعارات للمشرفين (admins) لكل تقرير جديد

4. **البيانات المحفوظة**: جميع البيانات تُحفظ في `extraData` كـ JSON string داخل `description` field

5. **الاستخدام المحلي**: إذا كنت تعمل على localhost، استخدم:
   ```
   http://localhost:5173/api/demo/create-all
   ```
   أو
   ```
   http://localhost:8787/api/demo/create-all
   ```

## أمثلة سريعة

### إنشاء تقرير ASR فقط:
```javascript
fetch('/api/demo/create-asr', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

### إنشاء تقرير CDF فقط:
```javascript
fetch('/api/demo/create-cdf', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

### إنشاء تقرير RIR فقط:
```javascript
fetch('/api/demo/create-rir', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

## استكشاف الأخطاء (Troubleshooting)

### المشكلة: "Failed to create demo reports"
**الحل**: تأكد من:
- أنك متصل بالإنترنت
- أن الـ URL صحيح
- أن قاعدة البيانات تعمل بشكل صحيح

### المشكلة: لا تظهر التقارير بعد الإنشاء
**الحل**: 
- قم بتحديث الصفحة (Refresh)
- تحقق من أنك تستخدم حساب صحيح
- تحقق من أن التقارير موجودة في Reports List

### المشكلة: خطأ في Authentication
**الحل**: لا تحتاج للمصادقة (Authentication) لإنشاء التقارير التجريبية، لكن تأكد من أن الـ endpoint متاح

## الدعم

إذا واجهت أي مشاكل، تحقق من:
1. Console المتصفح للأخطاء
2. Network tab في Developer Tools
3. Server logs (إذا كان لديك وصول)

---

**ملاحظة**: التقارير التجريبية هي للاختبار فقط ولا يجب استخدامها في بيئة الإنتاج.

