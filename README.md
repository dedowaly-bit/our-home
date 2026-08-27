# Our Home 🏠

تطبيق عائلي لإدارة ميزانية المنزل والمصروفات (مصاريف، ديون، فواتير، أهداف ادخار).
تم بناءه بـ Node.js JSON-Store مع إمكانية التخزين في PostgreSQL.

## التشغيل محلياً

```bash
npm install
node server.js
# ثم افتح http://localhost:3000
```

البيانات تُحفظ افتراضياً في `data/db.json`.

### استخدم PostgreSQL بدلاً من الملف

```bash
set DATABASE_URL=postgres://USER:PASS@HOST:5432/DB
node server.js
```

عند وجود `DATABASE_URL`، تُخزن البيانات كلها في جدول واحد (`app_data`) بدلاً من الملف.

## النشر على Render (مجاني)

1. ارفع الكود ده إلى GitHub.
2. سجّل في [render.com](https://render.com) واربط حساب GitHub.
3. من الداشبورد: **New → Blueprint** (أو New Web Service) واختر الـ repository.
4. `render.yaml` هيعمل كل حاجة أوتوماتيكيا (الـ Node service + PostgreSQL مجاني).
5. خلاص — الموقع هيتنشر على رابط زي `https://our-home.onrender.com`.

## اختبار الـ API

```bash
node test-api.js
```

## الملفات المهمة

- `server.js` — سيرفر HTTP + REST API كامل
- `public/` — واجهة SPA (بدون أي مكتبات خارجية)
- `render.yaml` — إعداد Render Blueprint
- `data/db.json` — قاعدة بيانات الملف (محلياً)