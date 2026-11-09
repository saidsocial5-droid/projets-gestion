# نشر منصة مشاريع AFMI على الإنترنت مجاناً

دليل خطوة بخطوة، من المتصفح فقط، دون تثبيت أي برنامج ودون أي اشتراك مدفوع.

## الخدمات (كلها مجانية)

| الخدمة | دورها | لماذا هي مناسبة مجاناً |
| --- | --- | --- |
| [Supabase](https://supabase.com) — الخطة Free | قاعدة البيانات، الدخول، الملفات، التحديث اللحظي | 500 ميغابايت للبيانات و1 غيغابايت للملفات: تكفي سنوات لفريق صغير |
| [Netlify](https://www.netlify.com) — الخطة Free | استضافة الموقع | خطتها المجانية تسمح بالاستعمال المهني والجمعوي، بخلاف خطة Vercel المجانية المخصصة للاستعمال الشخصي |
| حساب Gmail للجمعية | إرسال رسائل الدخول والدعوات والملخص | مجاني، دون حاجة إلى نطاق، حتى نحو 500 رسالة يومياً |
| GitHub Actions | الملخص اليومي، ونسخة احتياطية أسبوعية | مجاني ضمن حصة GitHub الشهرية؛ المهمتان تستهلكان دقائق قليلة |

**كل ميزات المنصة مجانية**: لا توجد في الكود أي ميزة مدفوعة أو مقفلة.

> إن كان للجمعية نطاق (مثل `afmi.ma`)، يمكن استعمال [Resend](https://resend.com) المجاني بدل Gmail (3000 رسالة شهرياً، وتظهر الرسائل باسم نطاقكم). انظر «بديل: Resend» أسفله.

احتفظ بملف نصي مؤقت تكتب فيه القيم التي ستنسخها. **لا ترسل المفاتيح وكلمات المرور لأحد ولا تضعها في GitHub إلا في خانة Secrets.**

---

## 1. Gmail: حساب الإرسال

1. أنشئ حساب Gmail مخصصاً للمنصة (مثلاً `afmi.projets@gmail.com`)، أو استعمل حساب الجمعية.
2. فعّل **التحقق بخطوتين**: [myaccount.google.com/security](https://myaccount.google.com/security).
3. أنشئ **كلمة مرور للتطبيقات**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) — الاسم: `AFMI`. انسخ الرمز المكوّن من 16 حرفاً (دون مسافات).

## 2. Supabase: قاعدة البيانات

1. أنشئ حساباً على supabase.com ثم **New project** (الخطة Free):
   - الاسم: `projets-gestion`
   - كلمة مرور قاعدة البيانات: **Generate** واحفظها.
   - المنطقة: **Central EU (Frankfurt)** (أقرب إلى المغرب، وضمن حماية المعطيات الأوروبية).
2. افتح في GitHub الملف `supabase/setup.sql` ← **Copy raw file**.
3. في Supabase: **SQL Editor** ← **New query**، الصق الملف.
4. **في آخر سطر** استبدل `CHANGE-ME@example.org` ببريدك (الشخص الذي سيكون أول مسؤول). هذا يمنع أي شخص آخر من الاستيلاء على المنصة قبلك.
5. **Run**. النتيجة المتوقعة: `Success. No rows returned`.
6. **Project Settings** ← **API Keys**، وانسخ:
   - **Project URL** (`https://….supabase.co`)
   - **Publishable key** (`sb_publishable_…`)
   - **Secret key** (`sb_secret_…`) — سرّي جداً.
7. **Connect** (أعلى الصفحة) ← **Session pooler** ← انسخ سلسلة الاتصال وضع فيها كلمة مرور قاعدة البيانات مكان `[YOUR-PASSWORD]`. (تُستعمل للنسخ الاحتياطي فقط.)

## 3. Supabase: البريد وتسجيل الدخول

1. **Authentication** ← **Emails** ← **SMTP Settings** ← فعّل **Enable custom SMTP**:
   - Sender email: بريد Gmail من الخطوة 1
   - Sender name: `منصة مشاريع AFMI`
   - Host: `smtp.gmail.com` — Port: `465`
   - Username: بريد Gmail — Password: كلمة مرور التطبيقات (16 حرفاً)
2. **Authentication** ← **Emails** ← **Templates**: في **Magic Link** و**Confirm signup** ضع العنوان `الدخول إلى منصة مشاريع AFMI / Connexion` والصق محتوى `supabase/templates/magic_link.html` من GitHub مكان النص الموجود. احفظ.
3. نعود إلى **URL Configuration** بعد الخطوة 4.

## 4. Netlify: الموقع

1. أنشئ حساباً على netlify.com **باستعمال حساب GitHub نفسه** (الخطة Free).
2. **Add new project** ← **Import an existing project** ← **GitHub** ← اختر `projets-gestion`. الإعدادات تُقرأ تلقائياً من `netlify.toml`.
3. قبل **Deploy**، افتح **Environment variables** وأضف:

   | الاسم | القيمة |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `CRON_SECRET` | جملة عشوائية طويلة (32 حرفاً أو أكثر)، مثلاً من [هذا المولّد](https://1password.com/password-generator) — احفظها، ستحتاجها في الخطوة 6 |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | بريد Gmail |
   | `SMTP_PASS` | كلمة مرور التطبيقات |
   | `MAIL_FROM` | `منصة مشاريع AFMI <بريد Gmail>` |

4. **Deploy** وانتظر 3–5 دقائق. ستحصل على عنوان مثل `https://xxxx.netlify.app`. غيّره إلى اسم أوضح من **Project configuration** ← **Change project name** (مثلاً `afmi-projets` ← `https://afmi-projets.netlify.app`).

## 5. ربط العنوان في Supabase

**Authentication** ← **URL Configuration**:
- **Site URL**: عنوان موقعك، مثلاً `https://afmi-projets.netlify.app`
- **Redirect URLs** ← **Add URL**: `https://afmi-projets.netlify.app/**`

## 6. GitHub: الملخص اليومي والنسخ الاحتياطي

في مستودع `projets-gestion` على GitHub: **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**، وأضف:

| الاسم | القيمة |
| --- | --- |
| `APP_URL` | عنوان موقعك (`https://afmi-projets.netlify.app`) |
| `CRON_SECRET` | **نفس** القيمة التي وضعتها في Netlify |
| `SUPABASE_DB_URL` | سلسلة الاتصال (Session pooler) من الخطوة 2.7 |
| `BACKUP_PASSPHRASE` | كلمة سر طويلة لتشفير النسخ الاحتياطية — **احفظها خارج GitHub**، فبدونها لا يمكن استرجاع النسخ |

ثم في تبويب **Actions**:
- **Daily digest** ← **Run workflow**: يجب أن يظهر ✓ أخضر. بعد ذلك يعمل وحده كل صباح (7:00 بتوقيت المغرب).
- **Weekly backup** ← **Run workflow**: يظهر ملف `backup-…` في أسفل صفحة التشغيل. بعد ذلك يعمل وحده كل أحد.

> فائدة إضافية: الملخص اليومي يقرأ من قاعدة البيانات كل يوم، فيبقى مشروع Supabase المجاني نشطاً ولا يُوقَف بسبب عدم الاستعمال.

## 7. أول دخول

1. افتح موقعك واكتب **البريد نفسه الذي وضعته في آخر سطر من setup.sql**.
2. افتح الرسالة واضغط الرابط: أنت الآن مسؤول المنصة.
3. **الإعدادات** ← **الأعضاء**: ادعُ فريق الجمعية.
4. **ملفي**: اكتب اسمك كما تريد أن يراه الآخرون.

## 8. التحقق

- [ ] رسالة الدخول وصلت (افحص البريد المزعج في المرة الأولى، واضغط «ليست رسالة مزعجة»).
- [ ] عضو مدعو دخل ورأى المشاريع العامة.
- [ ] إرفاق ملف في مهمة يعمل.
- [ ] في GitHub ← Actions: آخر تشغيل لـ **Daily digest** و**Weekly backup** أخضر.

---

## بديل: Resend بدل Gmail (إن كان للجمعية نطاق)

1. resend.com ← **Domains** ← **Add domain**، وأضف سجلات DNS التي يعرضها عند مدير نطاقكم، وانتظر **Verified**.
2. **API Keys** ← **Create API key**.
3. في Supabase (الخطوة 3.1): Host `smtp.resend.com`، Port `465`، Username `resend`، Password مفتاح Resend، Sender `noreply@نطاقكم`.
4. في Netlify: احذف متغيرات `SMTP_…` وأضف `RESEND_API_KEY`، واجعل `MAIL_FROM` = `منصة مشاريع AFMI <noreply@نطاقكم>`، ثم **Deploys** ← **Trigger deploy**.

## استرجاع نسخة احتياطية

من GitHub ← Actions ← **Weekly backup** ← اختر تشغيلاً ← حمّل `backup-…`. فك الضغط ثم (على حاسوب فيه `gpg` و`psql`):

```bash
gpg -d backup.sql.gz.gpg | gunzip | psql "سلسلة الاتصال بقاعدة جديدة"
```

## التحديثات لاحقاً

- **الكود**: كل تعديل يُرفع إلى الفرع `main` على GitHub ينشره Netlify تلقائياً.
- **قاعدة البيانات**: إن أُضيف ملف جديد في `supabase/migrations/`، شغّله في **SQL Editor** (الملفات الجديدة فقط، بترتيب أسمائها). لا تعِد تشغيل `setup.sql` على قاعدة فيها بيانات.

## حدود الخطط المجانية (لتعرف متى تحتاج تغييراً)

- **Supabase**: 500 ميغابايت للبيانات و1 غيغابايت للملفات المرفقة. لا نسخ احتياطية تلقائية (لذلك أضفنا النسخ الأسبوعي). يُوقَف المشروع إن لم يُستعمل أسبوعاً (الملخص اليومي يمنع ذلك؛ وإن حدث، يُعاد تشغيله بضغطة من لوحة Supabase دون فقدان البيانات).
- **Netlify**: حصة شهرية مجانية من الزيارات والبناء تكفي فريقاً داخلياً. إن تجاوزتموها يتوقف الموقع حتى الشهر التالي ولا تُخصم أي مبالغ.
- **Gmail**: نحو 500 رسالة يومياً.
- **السرعة**: دوال Netlify المجانية تعمل غالباً في الولايات المتحدة بينما قاعدة البيانات في أوروبا، فقد تبدو بعض الصفحات أبطأ قليلاً. إن أزعجكم ذلك يمكن نقل المشروع لاحقاً.

## عند وجود مشكلة

| العَرَض | السبب المحتمل |
| --- | --- |
| لا تصل رسالة الدخول | كلمة مرور التطبيقات في Supabase (الخطوة 3.1)، أو الرسالة في البريد المزعج |
| الرابط يعيد إلى صفحة الدخول | Site URL أو Redirect URLs (الخطوة 5) |
| «لا صلاحية لديك» عند أول دخول | البريد مختلف عن آخر سطر في setup.sql. صحّحه في SQL Editor: `insert into bootstrap_admins values (lower('بريدك'));` |
| Daily digest أحمر في GitHub | `APP_URL` أو `CRON_SECRET` مختلف بين GitHub وNetlify، أو متغيرات `SMTP_…` في Netlify |
| Weekly backup أحمر | `SUPABASE_DB_URL` (يجب أن تكون سلسلة **Session pooler** مع كلمة المرور) |
