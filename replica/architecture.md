# Architecture — projets-gestion (منصة مشاريع AFMI)

> المصدر: `replica/recon.md`، `replica/features.csv` · المخطط: `replica/schema.sql` (مُختبَر: `replica/tests/`) · التالي: `/replica-design`

## 1. التقنيات

| الطبقة | الاختيار | لماذا |
| --- | --- | --- |
| تطبيق الويب | **Next.js 15 (App Router) + TypeScript** | صفحات وServer Actions في مشروع واحد؛ الأكثر توثيقاً |
| الأسلوب | **Tailwind CSS 4** مع خصائص منطقية (`ms-*`, `pe-*`, `start-*`) | قلب RTL/LTR مجاناً بتغيير `dir` على `<html>` |
| الترجمة | **next-intl** (`ar`, `fr`) | مسارات `/ar/...` و`/fr/...`، تنسيق التواريخ والأرقام بـ `Intl` |
| قاعدة البيانات | **Postgres على Supabase** | قاعدة واحدة، RLS، Auth، Storage، Realtime في خدمة واحدة؛ الخطة المجانية تكفي جمعية |
| الوصول للبيانات | **supabase-js** بـ JWT المستخدم + أنواع مولّدة (`supabase gen types`) | الصلاحيات في RLS فلا تُنسى في أي استعلام؛ لا ORM لأن RLS يحتاج JWT المستخدم |
| الهجرات | **Supabase CLI** (`supabase/migrations/`) | `schema.sql` يصبح الهجرة الأولى |
| المصادقة | **Supabase Auth**: رابط سحري بالبريد (magic link) | لا كلمات مرور لفريق صغير؛ التسجيل بالدعوة فقط |
| الملفات | **Supabase Storage** (bucket خاص `attachments`) | سياسات Storage تستعمل نفس دوال الصلاحية |
| البريد | **Resend** + قوالب React Email | دعوات، ملخص يومي؛ يدعم العربية |
| المهام الدورية | **Vercel Cron** → Route Handler | ملخص يومي واحد وتنظيف — لا حاجة لطابور |
| السحب والإفلات | **dnd-kit** | يدعم RTL ولوحة المفاتيح |
| المحرر النصي | **Tiptap** (JSON في `jsonb`) | إشارات @، RTL، تخزين منظم |
| الرسوم | **Recharts** | بسيط، SVG، يُطبع جيداً في PDF |
| تصدير PDF | **صفحة تقرير HTML + طباعة المتصفح** (`@media print`) — مرحلة 1؛ **Playwright/Chromium** على خادم صغير — اختياري لاحقاً | المتصفح يرسم العربية بشكل صحيح؛ مكتبات PDF في JS ضعيفة في RTL وربط الحروف |
| تصدير Excel | **exceljs** | يدعم `rightToLeft` للورقة |
| الاستضافة | **Vercel** (Hobby/Pro) + Supabase (Free/Pro) | صفر صيانة خوادم |
| الاختبارات | **Vitest** (منطق) + **Playwright** (مسارات) + اختبارات SQL (`replica/tests/`) | |

لا خدمات مصغّرة، لا خادم منفصل، لا Stripe (أداة داخلية بلا دفع).

## 2. المخطط

الملف الكامل: [`schema.sql`](schema.sql) — **29 جدولاً، 63 سياسة RLS، 6 مشغّلات (triggers)، عرض واحد**.

| المجال | الجداول |
| --- | --- |
| الأشخاص | `workspaces`, `profiles`, `workspace_members`, `invitations`, `donors` |
| سير العمل | `workflows`, `workflow_statuses`, `workflow_transitions` |
| المشاريع | `projects`, `project_members`, `sections` |
| المهام | `tasks`, `task_dependencies` |
| الحقول | `custom_fields`, `custom_field_options`, `project_fields`, `task_field_values` |
| التعاون | `comments`, `attachments`, `followers`, `activities`, `notifications` |
| التقارير | `status_updates`, `dashboards`, `charts`, `indicators`, `expenses`, `reports`, `saved_filters` |

**قرارات:**

- **الصلاحيات = Postgres RLS.** دوال `project_role(p)` و`ws_role(ws)` (security definer) هي المصدر الوحيد. الدور الفعلي في المشروع: مسؤول مساحة العمل ← `admin`؛ عضوية صريحة ← دورها؛ عضو (غير ضيف) في مشروع `workspace` ← `editor`. الضيف لا يرى إلا ما أُضيف إليه صراحة، ولا يرى المصاريف ولا المانحين.
- **المال:** `budget_cents`, `amount_cents` (bigint) + `currency` (افتراضي `MAD`).
- **التواريخ:** `due_date`/`start_date` من نوع `date` (يوم تقويمي بلا منطقة زمنية)؛ كل الطوابع الزمنية `timestamptz` (UTC).
- **الترتيب:** عمود نصي `rank` / `board_rank` (fractional indexing، مكتبة `fractional-indexing`) — السحب يعدّل صفاً واحداً.
- **قيود صلبة في القاعدة لا في الواجهة:**
  - الحالة يجب أن تنتمي لسير عمل المشروع (trigger).
  - الانتقال يجب أن يكون مسموحاً إذا كان `restrict_transitions = true` (trigger، رمز خطأ `P0001` + hint `workflow_transition`).
  - `completed_at` يُحسب من فئة الحالة `done` — لا يكتبه التطبيق.
  - لا دورات في التبعيات (CTE تكراري + قفل advisory ضد الإدراج المتزامن).
  - مهمة فرعية بمستوى واحد وفي نفس المشروع.
  - حذف حالة فيها مهام مرفوض (`on delete restrict`).
  - دعوة مفتوحة واحدة لكل بريد/مشروع (فهرس فريد جزئي).
- **سجل النشاط والإشعارات** تكتبهما مشغّلات (`activities` بلا سياسة كتابة)، فلا يمكن تزويرها ولا نسيانها.
- **حذف:** حذف مشروع يحذف كل ما تحته (cascade)؛ حذف مستخدم يُبقي مهامه ويجعل المسؤول `null` (set null).

**دوال SQL تُضاف في هجرات لاحقة** (مذكورة في القسم 3، غير موجودة بعد في `schema.sql`): `create_project_from_template` (M3)، `chart_data` (M2)، `delete_status` (M2).

**الاختبارات:** `replica/tests/schema.test.sql` (22 حالة: عضو، مسؤول، ضيف، غريب؛ الانتقالات؛ الدورات؛ الإشعارات) — كلها ناجحة على Postgres 16.

## 3. الواجهات البرمجية

معظم الكتابة عبر **Server Actions** (`app/[locale]/.../actions.ts`) التي تستدعي supabase-js بـ JWT المستخدم. القراءة في Server Components مباشرة. RLS يقرر "من يستطيع"؛ العمود أدناه يوضح المتوقع.

### F01 إنشاء مشروع
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| GET `/[l]/projects` | قائمة المشاريع + `project_progress` | staff, guest (المشاركة فقط) | filter, archived | Project[] + تقدّم |
| action `createProject` | ينشئ مشروعاً (+ نسخ أقسام/مهام القالب إن وُجد، في دالة SQL `create_project_from_template`) | admin, member | name, workflow_id, template_id?, donor_id?, dates, budget | project id → redirect S07 |
| action `createDonor` | إنشاء سريع لمانح | admin | name | donor |

### F02 / F03 المهام
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| GET `/[l]/p/[id]/list` | أقسام + مهام + قيم الحقول | viewer+ | filters, sort | tree |
| action `createTask` | مهمة أو مهمة فرعية | editor+ | project_id, section_id, title, parent? | Task |
| action `updateTask` | حقل أو أكثر (تفاؤلي: `where updated_at = $prev`) | editor+ | id, patch, prev_updated_at | Task \| conflict |
| action `deleteTask` | | editor+ | id | — |
| action `setFieldValue` | | editor+ | task_id, field_id, value | — |
| action `addDependency` / `removeDependency` | | editor+ | task_id, depends_on | — \| cycle error |
| action `addComment` / `editComment` / `deleteComment` | Tiptap JSON، يستخرج @mentions ويضيفهم متابعين | commenter+ | task_id, body | Comment |
| POST `/api/attachments/sign` | رابط رفع موقّع لـ Storage (≤ 25MB) ثم action `recordAttachment` | commenter+ | task_id, name, size, mime | signed url |
| action `follow` / `unfollow` | | viewer+ | task_id | — |
| GET `/[l]/my-tasks` | مهامي غير المنجزة، مجمّعة: متأخرة/اليوم/هذا الأسبوع/لاحقاً | any | — | groups |
| GET `/[l]/inbox` · action `markRead(ids \| all)` | الإشعارات | self | — | Notification[] |

### F04 اللوحة
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| GET `/[l]/p/[id]/board` | أعمدة = `workflow_statuses` مرتّبة | viewer+ | — | columns + cards |
| action `moveTask` | `status_id` + `board_rank` في تحديث واحد؛ عند `P0001` تُعاد البطاقة مع رسالة | editor+ | id, to_status_id, before_rank, after_rank | Task \| `transition_not_allowed` |
| Realtime channel `project:{id}` | بثّ تغييرات `tasks` (Supabase Realtime + RLS) | viewer+ | — | — (*should*) |

### F05 / F06 المتابعة والتحديثات
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| GET `/[l]/portfolio` | كل المشاريع: الحالة الأخيرة، التقدّم، المتأخر، الميزانية/المصروف | staff | sort, filter | rows |
| GET `/[l]/p/[id]/dashboard` | رسوم المشروع (استعلامات تجميع عبر دالة SQL `chart_data(chart_id)` بـ security invoker) | viewer+ | — | ChartData[] |
| action `createChart` / `updateChart` / `deleteChart` | | editor+ | type, source, group_by, filters | Chart |
| GET `/[l]/p/[id]/progress` | سجل تحديثات الحالة | viewer+ | — | StatusUpdate[] |
| action `saveStatusUpdate` / `publishStatusUpdate` | مسودة ← نشر (ينشئ activity + إشعار للأعضاء) | editor+ | status, title, body | StatusUpdate |
| action `upsertIndicator` / `addExpense` | مؤشرات ومصاريف | editor+ (staff للمصاريف) | … | … |

### F07 تقرير المانح
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| action `createReport` | يحفظ التقرير (مانح، فترة، مشاريع، لغة) | staff | donor_id?, period, project_ids, locale | Report |
| GET `/[l]/reports/[id]` | صفحة التقرير القابلة للطباعة: ملخص، تقدّم كل مشروع، المؤشرات، الميزانية مقابل المصروف، آخر تحديثات الحالة في الفترة | staff | — | HTML (print CSS) |
| GET `/api/reports/[id]/xlsx` | ملف Excel (ورقة لكل قسم، RTL إن `ar`) | staff | — | .xlsx |

### F08 / F09 الإدارة
| method path | ماذا يفعل | من | المدخل | المخرج |
| --- | --- | --- | --- | --- |
| action `inviteMember` | ينشئ `invitations` (sha256 للرمز) ويرسل بريداً عبر Resend | admin؛ project admin للضيوف | email, role, project_id?, project_role? | — |
| GET `/[l]/invite/[token]` → action `acceptInvite` | يتحقق من الرمز (service key، خادم فقط)، ينشئ `workspace_members`/`project_members`، يسجّل الدخول بالرابط السحري | public | token | redirect |
| action `revokeInvite` / `setMemberRole` / `removeMember` | | admin | … | — |
| GET `/[l]/settings/workflows/[id]` | الحالات والانتقالات | admin | — | Workflow |
| action `upsertStatus` / `deleteStatus(move_to)` / `setTransitions` | حذف حالة ينقل مهامها أولاً في معاملة واحدة (دالة SQL `delete_status(id, move_to)`) | admin | … | — |
| action `upsertCustomField` / `attachFieldToProject` | | admin / editor+ | … | — |
| GET `/[l]/search?q=` | `tasks.search` (tsvector) + `pg_trgm` على العنوان، ضمن ما يسمح به RLS | any | q, filters | Task[] |
| action `updateProfile` | الاسم، اللغة، الإشعارات | self | … | — |

### خارجي
| النوع | ماذا | الجدولة |
| --- | --- | --- |
| Cron → GET `/api/cron/digest` (سرّ `CRON_SECRET`) | بريد ملخص يومي: إشعارات غير مقروءة + مهام مستحقة اليوم/متأخرة؛ يضع `notifications.emailed_at` فلا يتكرر | يومياً 07:00 `Africa/Casablanca` |
| Cron → GET `/api/cron/cleanup` | حذف الدعوات المنتهية، ملفات Storage اليتيمة | أسبوعياً |
| Webhook خارج | Resend API فقط (مفتاح الجمعية) | — |
| Webhook داخل | لا يوجد | — |

**المجموع: ≈ 48 مساراً/إجراءً.** لا استخدام لأي واجهة خاصة بـ Asana أو Jira.

## 4. ما قد يؤذي

| الموضوع | الخطر | المعالجة |
| --- | --- | --- |
| **المنطقة الزمنية في المغرب** | المغرب على UTC+1 لكنه يعود إلى UTC+0 خلال رمضان كل سنة — "متأخر" و"اليوم" تتغير | لا حساب يدوي للإزاحة: `Intl`/`date-fns-tz` و`now() at time zone 'Africa/Casablanca'` (قاعدة tzdata). تواريخ الاستحقاق `date` لا `timestamptz` |
| **RTL** | الجداول الزمنية، الأسهم، السحب، الرسوم البيانية، الأيقونات الاتجاهية | خصائص CSS المنطقية فقط؛ اختبار Playwright لكل شاشة بـ `ar` و`fr`؛ عكس محور Gantt |
| **PDF بالعربية** | ربط الحروف واتجاه النص المختلط (عربي + أرقام + فرنسي) | التقرير صفحة HTML تُطبع من المتصفح؛ خط Noto Naskh Arabic / IBM Plex Sans Arabic مضمّن |
| **التعديل المتزامن** | شخصان يحرّكان نفس البطاقة | قفل تفاؤلي بـ `updated_at`؛ `rank` كسري؛ Realtime يحدّث الآخرين |
| **قواعد الانتقال** | الواجهة تسمح بسحب لا تقبله القاعدة | القاعدة ترفض (`P0001`)؛ الواجهة تعطّل الأعمدة غير المسموحة أثناء السحب (تقرأ `workflow_transitions`) |
| **حدود الملفات** | خطة Supabase المجانية 50MB للملف و1GB إجمالاً | حد 25MB في القاعدة والواجهة؛ مراقبة الاستهلاك |
| **البحث** | التشكيل والهمزات في العربية | تكوين `simple` + `pg_trgm`؛ تطبيع (إزالة التشكيل، أ/إ/آ ← ا) في عمود مولّد لاحقاً |
| **البريد** | رسائل الدعوة في البريد المزعج | نطاق الجمعية مع SPF/DKIM/DMARC في Resend |
| **تكرار الـ cron** | Vercel قد يستدعي مرتين | `emailed_at` يجعل الملخص idempotent |
| **حماية البيانات** | القانون المغربي 09-08 (CNDP) | بيانات قليلة؛ حذف حساب = cascade لعضويته و`set null` لمحتواه؛ منطقة Supabase في الاتحاد الأوروبي |
| **تعدد المستأجرين** | غير مطلوب الآن | `workspace_id` موجود في كل مكان، فالتوسع ممكن دون هجرة كبيرة |
| **مفتاح الخدمة** | تسريبه يتجاوز RLS | يستعمل فقط في `acceptInvite` وcron، في الخادم، ولا يُعرض للمتصفح أبداً |

## 5. ترتيب البناء

### M1 — الشريحة العمودية (أسبوع 1)
مسار F02/F03/F04 من البداية للنهاية، بلا تجميل.
- **الشاشات:** S01 (رابط سحري)، S05، S07 (بسيط)، S08، S09 (عنوان، حالة، مسؤول، تاريخ)
- **الجداول:** workspaces, profiles, workspace_members, workflows, workflow_statuses, workflow_transitions, projects, sections, tasks
- **المسارات:** createProject, createTask, updateTask, moveTask
- **ينجح إذا:** مستخدمان يدخلان، ينشئان مهمة، يحرّكانها على اللوحة، والقاعدة ترفض انتقالاً ممنوعاً — بالعربية والفرنسية.

### M2 — الضروريات (أسابيع 2–3)
- **التعاون:** S09 كاملة (مهام فرعية، تعليقات، @، مرفقات، سجل)، S04، S03، S02 — جداول comments, attachments, followers, activities, notifications
- **الصلاحيات:** S16، S19، الدعوات والضيوف (F08) — invitations, project_members
- **التقارير:** S12 (رسوم ثابتة: حسب الحالة، المسؤول، المتأخر)، S13 (F06)، S14 (F05) — status_updates, dashboards, charts
- **AFMI:** المانحون، الميزانية، المؤشرات، المصاريف، S15 + تصدير PDF/Excel (F07) — donors, indicators, expenses, reports
- **سير العمل:** S17 (حالات + فئات)، S20 البحث، S21 الملف الشخصي

### M3 — المهمّات (أسبوع 4)
الجدول الزمني S10 والتبعيات، الحقول المخصصة S18، الانتقالات المقيّدة في الواجهة، الرسوم المخصصة، الرسوم داخل تحديث الحالة، قوالب المشاريع، الأرشفة، ملخص البريد اليومي، Realtime.

### M4 — الاختياريات
التقويم S11، الفلاتر المحفوظة، قوالب تحديث الحالة، تقرير ثنائي اللغة، أتمتة بسيطة.

### M5 — الإصلاحات
ما يكشفه `replica-diff` واستخدام الفريق الفعلي.
