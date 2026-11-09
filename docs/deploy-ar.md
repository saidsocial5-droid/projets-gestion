# نشر منصة مشاريع AFMI على الإنترنت

دليل خطوة بخطوة، من المتصفح فقط، دون تثبيت أي برنامج على حاسوبك. المدة: نحو ساعة، أغلبها انتظار تفعيل نطاق البريد.

## ما تحتاجه

| الخدمة | لماذا | التكلفة |
| --- | --- | --- |
| [Supabase](https://supabase.com) | قاعدة البيانات، تسجيل الدخول، الملفات، التحديث اللحظي | مجاني للبداية (انظر الملاحظة أسفله) |
| [Vercel](https://vercel.com) | استضافة الموقع والملخص اليومي | مجاني للبداية |
| [Resend](https://resend.com) | إرسال رسائل الدخول والدعوات والملخص | مجاني حتى 3000 رسالة شهرياً |
| نطاق بريد للجمعية (مثلاً `afmi.ma`) | لكي تصل الرسائل ولا تذهب إلى البريد المزعج | لديكم غالباً |

احتفظ بملف نصي مؤقت تكتب فيه القيم التي ستنسخها أثناء الخطوات (عنوان المشروع، المفاتيح…). **لا ترسل هذه المفاتيح لأحد ولا تضعها في GitHub.**

---

## 1. Supabase: قاعدة البيانات

1. أنشئ حساباً على supabase.com ثم **New project**.
   - الاسم: `projets-gestion`
   - كلمة مرور قاعدة البيانات: اضغط **Generate** واحفظها.
   - المنطقة (Region): **Central EU (Frankfurt)** أو **West EU (Paris)**، الأقرب إلى المغرب.
2. انتظر دقيقتين حتى يصبح المشروع جاهزاً.
3. افتح في GitHub الملف `supabase/setup.sql` من المستودع، ثم اضغط **Copy raw file**.
4. في Supabase: **SQL Editor** ← **New query**، الصق الملف.
5. **في آخر سطر** استبدل `CHANGE-ME@example.org` ببريدك أنت (الشخص الذي سيكون أول مسؤول). هذا يمنع أي شخص آخر من الاستيلاء على المنصة قبلك.
6. اضغط **Run**. النتيجة المتوقعة: `Success. No rows returned`.
7. **Project Settings** ← **API Keys**، وانسخ إلى ملفك:
   - **Project URL** (يشبه `https://abcd.supabase.co`)
   - **Publishable key** (يبدأ بـ `sb_publishable_`)
   - **Secret key** (يبدأ بـ `sb_secret_`) — سرّي جداً.

## 2. Resend: البريد

1. أنشئ حساباً على resend.com ← **Domains** ← **Add domain** واكتب نطاق الجمعية.
2. سيعرض Resend سجلات DNS (من نوع TXT وMX). أضفها عند الجهة التي تدير نطاقكم (مزوّد الاستضافة أو مسجّل النطاق). إن لم تكن تعرف من يدير النطاق، أرسل هذه السجلات للشخص المسؤول عن موقع الجمعية.
3. انتظر حتى تظهر الحالة **Verified** (من دقائق إلى بضع ساعات).
4. **API Keys** ← **Create API key** (صلاحية Sending access) وانسخ المفتاح (يبدأ بـ `re_`).

## 3. Supabase: إعدادات تسجيل الدخول

1. **Authentication** ← **Emails** ← **SMTP Settings** ← فعّل **Enable custom SMTP**:
   - Sender email: `noreply@نطاقكم` (مثلاً `noreply@afmi.ma`)
   - Sender name: `منصة مشاريع AFMI`
   - Host: `smtp.resend.com` — Port: `465`
   - Username: `resend` — Password: مفتاح Resend
2. **Authentication** ← **Emails** ← **Templates**:
   - في **Magic Link** و**Confirm signup**: ضع العنوان `الدخول إلى منصة مشاريع AFMI / Connexion`، وانسخ محتوى الملف `supabase/templates/magic_link.html` من GitHub والصقه مكان النص الموجود. احفظ.
3. نعود إلى **URL Configuration** بعد الخطوة 4 (نحتاج عنوان الموقع أولاً).

## 4. Vercel: الموقع

1. أنشئ حساباً على vercel.com **باستعمال حساب GitHub نفسه**.
2. **Add New** ← **Project** ← اختر المستودع `projets-gestion` ← **Import**.
3. افتح **Environment Variables** وأضف:

   | الاسم | القيمة |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL من الخطوة 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `CRON_SECRET` | جملة عشوائية طويلة (32 حرفاً أو أكثر)، مثلاً من [هذا المولّد](https://1password.com/password-generator) |
   | `RESEND_API_KEY` | مفتاح Resend |
   | `MAIL_FROM` | `منصة مشاريع AFMI <noreply@نطاقكم>` |

4. اضغط **Deploy** وانتظر 2–3 دقائق. ستحصل على عنوان مثل `https://projets-gestion.vercel.app`. (يمكن لاحقاً ربط عنوان خاص مثل `projets.afmi.ma` من **Settings** ← **Domains**.)
5. **Settings** ← **Functions** ← **Function Region**: اختر **Frankfurt (fra1)** ليكون الموقع قريباً من قاعدة البيانات، ثم أعد النشر (**Deployments** ← آخر نشر ← **Redeploy**).

## 5. ربط العنوان في Supabase

**Authentication** ← **URL Configuration**:
- **Site URL**: عنوان موقعك، مثلاً `https://projets-gestion.vercel.app`
- **Redirect URLs** ← **Add URL**: `https://projets-gestion.vercel.app/**` (وأضف عنوانكم الخاص أيضاً إن ربطتموه).

## 6. أول دخول

1. افتح موقعك واكتب **البريد نفسه الذي وضعته في آخر سطر من setup.sql**.
2. افتح الرسالة واضغط الرابط: أنت الآن مسؤول المنصة.
3. **الإعدادات** ← **الأعضاء**: ادعُ فريق الجمعية. تصل الدعوة بالبريد مباشرة.
4. **الملف الشخصي (ملفي)**: اكتب اسمك كما تريد أن يراه الآخرون.

## 7. التحقق

- [ ] رسالة الدخول وصلت إلى صندوق الوارد (لا البريد المزعج).
- [ ] عضو مدعو دخل ورأى المشاريع العامة.
- [ ] إرفاق ملف في مهمة يعمل.
- [ ] في Vercel: **Settings** ← **Cron Jobs** يظهر `/api/cron/digest` يومياً (7 صباحاً بتوقيت المغرب).

---

## التحديثات لاحقاً

- **الكود**: كل تعديل يُرفع إلى GitHub (الفرع `main`) ينشره Vercel تلقائياً.
- **قاعدة البيانات**: إن أُضيف ملف جديد في `supabase/migrations/`، الصقه وشغّله في **SQL Editor** (الملفات الجديدة فقط، بترتيب أسمائها). لا تعِد تشغيل `setup.sql` على قاعدة فيها بيانات.

## ملاحظات على التكلفة والشروط

- **Supabase المجاني** يوقف المشروع مؤقتاً إذا لم يُستعمل 7 أيام متتالية، ويُعاد تشغيله من لوحة التحكم. للاستعمال اليومي المستمر ولنسخ احتياطية يومية، الخطة **Pro** (نحو 25 دولاراً شهرياً).
- **Vercel Hobby** مخصّص للاستعمال الشخصي غير التجاري. راجع شروطهم لاستعمال جمعية؛ وإلا فالخطة **Pro** (نحو 20 دولاراً شهرياً للمستخدم).
- **Resend المجاني**: 100 رسالة يومياً، تكفي فريقاً صغيراً.

## عند وجود مشكلة

| العَرَض | السبب المحتمل |
| --- | --- |
| لا تصل رسالة الدخول | نطاق Resend غير مُفعَّل بعد، أو إعدادات SMTP في الخطوة 3 |
| الرابط يعيد إلى صفحة الدخول | Site URL أو Redirect URLs في الخطوة 5 |
| «لا صلاحية لديك» عند أول دخول | البريد مختلف عن آخر سطر في setup.sql. صحّحه في SQL Editor: `insert into bootstrap_admins values (lower('بريدك'));` |
| الملخص اليومي لا يصل | `CRON_SECRET` أو `SUPABASE_SECRET_KEY` أو `RESEND_API_KEY` في Vercel، ثم Redeploy |
