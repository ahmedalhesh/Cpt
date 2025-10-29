# 🔧 خطوات ربط D1 يدوياً في Cloudflare (مطلوب!)

## ⚠️ مهم جداً - يجب تنفيذ هذه الخطوات!

على الرغم من أن `wrangler.toml` محدّث بشكل صحيح، **قد تحتاج إلى إضافة الربط يدوياً** في لوحة تحكم Cloudflare.

---

## 📋 الخطوات (5 دقائق فقط):

### 1. افتح لوحة تحكم Cloudflare
```
🔗 https://dash.cloudflare.com/c65441278840d45ed3cd9cfef5b898b1
```

### 2. اذهب إلى Workers & Pages
- من القائمة اليسرى، انقر على **"Workers & Pages"**
- ستجد قائمة بجميع مشاريعك

### 3. افتح مشروع report-sys
- ابحث عن مشروع باسم **"report-sys"**
- انقر عليه لفتحه

### 4. افتح إعدادات Functions
```
report-sys > Settings > Functions
```
- انقر على تبويب **"Settings"** (في الأعلى)
- من القائمة الجانبية، اختر **"Functions"**

### 5. ابحث عن D1 database bindings
- مرّر للأسفل حتى تجد قسم **"D1 database bindings"**
- تحقق إذا كان هناك ربط موجود

### 6. أضف الربط (إذا لم يكن موجوداً)
- انقر على زر **"Add binding"**
- املأ المعلومات التالية:
  ```
  Variable name: DB
  D1 database:   reportDB
  ```
- انقر **"Save"**

### 7. انتظر قليلاً (30 ثانية)
- Cloudflare تحتاج وقت قصير لتطبيق التغييرات
- لا حاجة لإعادة النشر

---

## 🧪 اختبر الربط

### اختبار 1: Health Endpoint
افتح في المتصفح:
```
https://report-sys.pages.dev/api/health
```

**النتيجة المتوقعة:**
```json
{
  "status": "ok",
  "database": "D1 connected",
  "environment": "production"
}
```

**إذا ظهر خطأ:**
```json
{
  "error": "D1 binding 'DB' not found"
}
```
→ معناه أن الربط لم يُضف بعد في لوحة التحكم

### اختبار 2: إنشاء تقرير
1. افتح: https://report-sys.pages.dev
2. سجل الدخول:
   - Email: `admin@airline.com`
   - Password: `password123`
3. اذهب إلى "Create New Report"
4. اختر نوع التقرير (ASR, OR, RIR, إلخ)
5. املأ البيانات الأساسية
6. اضغط "Submit"

**النتيجة المتوقعة:**
- ✅ رسالة نجاح
- ✅ التقرير يظهر في قائمة التقارير
- ✅ لا أخطاء 500

**إذا ظهر خطأ 500:**
→ افتح Console في المتصفح (F12)
→ تحقق من رسالة الخطأ
→ تأكد من إضافة الربط في لوحة التحكم

---

## 📸 صور توضيحية للخطوات:

### موقع D1 bindings في لوحة التحكم:
```
Cloudflare Dashboard
  └── Workers & Pages
      └── report-sys
          └── Settings
              └── Functions
                  └── D1 database bindings  ← هنا!
                      └── [Add binding]
```

### نموذج إضافة الربط:
```
┌─────────────────────────────────────┐
│  Add D1 database binding            │
├─────────────────────────────────────┤
│  Variable name: [DB            ]    │
│  D1 database:   [reportDB ▼   ]    │
│                                     │
│         [Cancel]  [Save]            │
└─────────────────────────────────────┘
```

---

## ✅ قائمة التحقق النهائية

قبل الاختبار، تأكد من:

- [x] `wrangler.toml` يحتوي على `binding = "DB"`
- [x] قاعدة البيانات D1 موجودة: `reportDB`
- [x] المخطط مطبّق: `d1-schema.sql`
- [x] الكود منشور على Cloudflare Pages
- [ ] **✋ D1 binding مضاف في لوحة التحكم** ← **افعل هذا الآن!**
- [ ] اختبرت endpoint الصحة
- [ ] اختبرت إنشاء تقرير

---

## 🆘 إذا واجهت مشكلة

### الخطأ: "D1 binding 'DB' not found"
**الحل:** أضف الربط يدوياً كما في الخطوات أعلاه

### الخطأ: "table reports does not exist"
**الحل:** 
```bash
wrangler d1 execute reportDB --remote --file=./migrations/d1-schema.sql
```

### الخطأ: "Unauthorized"
**الحل:** تأكد من بيانات الدخول:
- admin@airline.com / password123
- أو demo@airline.com / password123

---

## 📞 الخلاصة

1. **افتح:** https://dash.cloudflare.com
2. **اذهب إلى:** Workers & Pages > report-sys > Settings > Functions
3. **أضف:** D1 database binding (Variable: DB, Database: reportDB)
4. **اختبر:** https://report-sys.pages.dev/api/health
5. **أنشئ تقرير** للتأكد من أن كل شيء يعمل

**🎯 بعد إضافة الربط، كل شيء يجب أن يعمل بشكل مثالي!**

