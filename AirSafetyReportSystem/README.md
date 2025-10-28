# Report Sys

نظام التقارير - منصة رقمية آمنة لاستبدال النماذج الورقية في الطيران.

## المميزات

- **6 أنواع تقارير**: ASR, OR, RIR, NCR, CDF, CHR
- **نظام مصادقة آمن**: JWT مع تشفير كلمات المرور
- **أدوار المستخدمين**: Captain, Safety Officer, Administrator
- **واجهة متجاوبة**: تعمل على جميع الأجهزة
- **رفع الملفات**: دعم PDF, JPG, PNG, DOCX
- **التقارير المجهولة**: للتقارير الحساسة
- **لوحة تحكم متقدمة**: إحصائيات ورسوم بيانية

## التقنيات المستخدمة

### Frontend
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query
- React Hook Form + Zod
- Wouter (Routing)

### Backend
- Node.js + Express
- PostgreSQL + Drizzle ORM
- JWT Authentication
- bcryptjs (Password Hashing)
- Multer (File Upload)

## التثبيت والتشغيل

### 1. تثبيت المتطلبات

```bash
# تثبيت dependencies
npm install

# تثبيت dependencies إضافية
npm install jsonwebtoken bcryptjs
npm install --save-dev @types/jsonwebtoken @types/bcryptjs
```

### 2. إعداد قاعدة البيانات

```bash
# إنشاء ملف .env
cp .env.example .env

# تحديث متغيرات البيئة
DATABASE_URL=postgresql://username:password@localhost:5432/airsafety
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### 3. إعداد قاعدة البيانات

```bash
# تشغيل migrations
npm run db:push
```

### 4. تشغيل التطبيق

```bash
# وضع التطوير
npm run dev

# بناء التطبيق
npm run build

# تشغيل الإنتاج
npm start
```

## المستخدمين الافتراضيين

### تسجيل الدخول
- **Email**: demo@airline.com
- **Password**: password123

### إنشاء حساب جديد
يمكن إنشاء حسابات جديدة من صفحة تسجيل الدخول مع الأدوار التالية:
- **Captain**: إنشاء التقارير
- **Safety Officer**: مراجعة التقارير
- **Administrator**: صلاحيات كاملة

## أنواع التقارير

### 1. Air Safety Report (ASR)
- رقم الرحلة، نوع الطائرة، المسار
- وصف الحدث، العوامل المساهمة
- الإجراءات التصحيحية

### 2. Occurrence Report (OR)
- الموقع، مرحلة الطيران
- مستوى المخاطر، الإجراءات المتابعة

### 3. Ramp Incident Report (RIR)
- حوادث المدرج والأرض
- أسماء الطاقم الأرضي، المركبات
- نوع الأضرار، الخطوات التصحيحية

### 4. Nonconformity Report (NCR)
- انتهاكات الإجراءات والمعايير
- القسم، نوع عدم المطابقة
- السبب الجذري، الإجراءات الوقائية

### 5. Commander's Discretion Form (CDF)
- قرارات القائد خارج الحدود المعيارية
- سبب التقدير، تمديد الوقت
- تفاصيل إرهاق الطاقم

### 6. Confidential Hazard Report (CHR)
- تقارير المخاطر السرية
- إمكانية الإرسال المجهول
- وصف الخطر، التأثير المحتمل

## API Endpoints

### المصادقة
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب
- `GET /api/auth/user` - بيانات المستخدم الحالي
- `POST /api/auth/logout` - تسجيل الخروج

### التقارير
- `GET /api/reports` - قائمة التقارير
- `GET /api/reports/:id` - تفاصيل التقرير
- `POST /api/reports` - إنشاء تقرير جديد
- `PATCH /api/reports/:id/status` - تحديث حالة التقرير
- `GET /api/reports/stats` - إحصائيات التقارير

### التعليقات
- `GET /api/comments` - تعليقات التقرير
- `POST /api/comments` - إضافة تعليق

### المرفقات
- `POST /api/attachments` - رفع ملف
- `GET /api/attachments/:id/download` - تحميل ملف

## الأمان

- **JWT Tokens**: مصادقة آمنة
- **Password Hashing**: تشفير كلمات المرور بـ bcrypt
- **Role-based Access**: صلاحيات حسب الدور
- **File Upload Security**: فحص أنواع الملفات
- **Input Validation**: تحقق شامل من البيانات

## التطوير

### هيكل المشروع
```
├── client/          # Frontend (React)
├── server/          # Backend (Express)
├── shared/          # Schema مشترك
├── migrations/      # Database migrations
└── uploads/         # الملفات المرفوعة
```

### الأوامر المفيدة
```bash
# فحص TypeScript
npm run check

# تشغيل قاعدة البيانات
npm run db:push

# بناء الإنتاج
npm run build
```

## الترخيص

MIT License - انظر ملف LICENSE للتفاصيل.

## الدعم

للحصول على المساعدة أو الإبلاغ عن مشاكل، يرجى فتح issue في المستودع.
