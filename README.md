# Our Home 🏠

تطبيق عائلي لإدارة ميزانية المنزل والمصروفات (مصاريف، ديون، فواتير، أهداف ادخار).
تم بناءه بـ Node.js JSON-Store مع إمكانية التخزين في PostgreSQL.

## التشغيل محلياً

```bash
node server.js
# ثم افتح http://localhost:3000
```

البيانات تُحفظ افتراضياً في `data/db.json`.

## نسخة GitHub Pages (بدون سيرفر)

`store.js` بيدعم **وضع بدون سيرفر**: لو اتفتحت الصفحة من GitHub Pages (أو أي استضافة ثابتة)،
البيانات كلها بتتحفظ في `localStorage` بالمتصفح وبتقدر تستخدم كل المزايا من غير أي سيرفر.
تم النشر بضغطة عمل جاهزة في `.github/workflows/pages.yml`.

## النشر على Render (لسيرفر حقيقي + PostgreSQL)

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
- `.github/workflows/pages.yml` — نشر GitHub Pages من مجلد `public`
- `render.yaml` — إعداد Render Blueprint
- `data/db.json` — قاعدة بيانات الملف (محلياً)