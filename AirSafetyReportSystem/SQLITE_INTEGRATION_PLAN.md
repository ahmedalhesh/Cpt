# 🗄️ خطة دمج قاعدة البيانات SQLite المحلية

## 🎯 الهدف
استخدام قاعدة البيانات المحلية `database.sqlite` بدلاً من D1 لضمان عمل النظام 100%.

## 📊 الوضع الحالي

### قاعدة البيانات المحلية:
- **الملف:** `database.sqlite` (593 KB)
- **الموقع:** محلي في المشروع
- **الحالة:** ✅ جاهزة ومكتملة
- **البيانات:** تحتوي على جميع الجداول والبيانات

### قاعدة البيانات D1:
- **المشكلة:** تحتاج ربط يدوي في Cloudflare
- **التعقيد:** إعدادات معقدة
- **الحالة:** ⚠️ تحتاج خطوات إضافية

## 🚀 الحل المقترح: SQLite في Cloudflare

### الطريقة 1: SQLite عبر GitHub (موصى بها)

#### الخطوات:
1. **رفع قاعدة البيانات إلى GitHub:**
   ```bash
   git add database.sqlite
   git commit -m "Add local SQLite database"
   git push origin main
   ```

2. **تحميل قاعدة البيانات في Cloudflare Functions:**
   ```typescript
   // في functions/api/reports.ts
   const dbUrl = 'https://raw.githubusercontent.com/ahmedalhesh/Cpt/main/AirSafetyReportSystem/database.sqlite';
   const dbResponse = await fetch(dbUrl);
   const dbBuffer = await dbResponse.arrayBuffer();
   ```

3. **استخدام SQLite.js في Cloudflare:**
   ```typescript
   import { Database } from 'sql.js';
   const db = new Database(new Uint8Array(dbBuffer));
   ```

### الطريقة 2: تحويل إلى JSON (أبسط)

#### الخطوات:
1. **تصدير البيانات إلى JSON:**
   ```javascript
   // سكريبت لتصدير SQLite إلى JSON
   const Database = require('better-sqlite3');
   const fs = require('fs');
   
   const db = new Database('./database.sqlite');
   const reports = db.prepare('SELECT * FROM reports').all();
   const users = db.prepare('SELECT * FROM users').all();
   
   fs.writeFileSync('database.json', JSON.stringify({
     reports,
     users,
     // ... other tables
   }));
   ```

2. **استخدام JSON في Cloudflare:**
   ```typescript
   import databaseData from './database.json';
   // البحث في البيانات المحلية
   ```

### الطريقة 3: REST API محلي (الأسرع)

#### الخطوات:
1. **تشغيل خادم محلي:**
   ```bash
   npm run dev
   # يعمل على localhost:3000
   ```

2. **توجيه Cloudflare إلى الخادم المحلي:**
   ```typescript
   // في functions/api/reports.ts
   const LOCAL_API = 'https://your-ngrok-url.ngrok.io';
   const response = await fetch(`${LOCAL_API}/api/reports`, {
     method: 'POST',
     body: JSON.stringify(body),
     headers: { 'Content-Type': 'application/json' }
   });
   ```

## 🎯 التوصية: الطريقة 1 (SQLite عبر GitHub)

### المميزات:
- ✅ لا حاجة لخادم خارجي
- ✅ قاعدة البيانات محدّثة دائماً
- ✅ سرعة عالية
- ✅ موثوقية عالية

### التنفيذ:

#### 1. رفع قاعدة البيانات:
```bash
git add database.sqlite
git commit -m "Add production SQLite database"
git push origin main
```

#### 2. تحديث Cloudflare Functions:
```typescript
// functions/api/reports-sqlite.ts
import { Database } from 'sql.js';

let cachedDB: Database | null = null;

async function getSQLiteDB() {
  if (cachedDB) return cachedDB;
  
  const dbUrl = 'https://raw.githubusercontent.com/ahmedalhesh/Cpt/main/AirSafetyReportSystem/database.sqlite';
  const response = await fetch(dbUrl);
  const buffer = await response.arrayBuffer();
  
  cachedDB = new Database(new Uint8Array(buffer));
  return cachedDB;
}
```

#### 3. استخدام قاعدة البيانات:
```typescript
export const onRequestPost = async ({ request, env }) => {
  const db = await getSQLiteDB();
  
  // إدراج تقرير جديد
  const stmt = db.prepare(`
    INSERT INTO reports (id, report_type, status, ...) 
    VALUES (?, ?, ?, ...)
  `);
  
  stmt.run(reportId, reportType, status, ...);
  
  return new Response(JSON.stringify({ success: true }));
};
```

## 📋 قائمة المهام

- [ ] رفع `database.sqlite` إلى GitHub
- [ ] إضافة `sql.js` إلى dependencies
- [ ] إنشاء `functions/api/reports-sqlite.ts`
- [ ] تحديث جميع API endpoints لاستخدام SQLite
- [ ] اختبار النظام الجديد
- [ ] النشر على Cloudflare

## 🔧 الملفات المطلوب إنشاؤها:

1. **`functions/api/reports-sqlite.ts`** - API للتقارير مع SQLite
2. **`functions/api/auth-sqlite.ts`** - API للمصادقة مع SQLite
3. **`functions/api/users-sqlite.ts`** - API للمستخدمين مع SQLite
4. **`functions/api/comments-sqlite.ts`** - API للتعليقات مع SQLite
5. **`functions/api/notifications-sqlite.ts`** - API للإشعارات مع SQLite

## ⚡ البدء السريع:

```bash
# 1. رفع قاعدة البيانات
git add database.sqlite
git commit -m "Add production SQLite database"
git push origin main

# 2. إضافة sql.js
npm install sql.js

# 3. بناء المشروع
npm run build

# 4. النشر
wrangler pages deploy dist/public --project-name=report-sys
```

---

**🎯 هذا الحل سيضمن عمل النظام 100% بدون مشاكل D1!**
