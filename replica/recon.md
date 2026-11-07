# Recon map — منصة مشاريع AFMI (مزيج Asana + Jira)

> تاريخ: 2026-11-07 · المرحلة: replica-recon · التالي: `/replica-architect`

## 1. النطاق (Scope)

| البند | القرار |
| --- | --- |
| التطبيقات المرجعية | **Asana** (البساطة: مشاريع، أقسام، مهام، عروض قائمة/لوحة، تحديثات الحالة، لوحات المتابعة) + **Jira** (سير عمل بحالات وانتقالات قابلة للتخصيص، ربط أعمدة اللوحة بالحالات، أنواع العناصر) |
| المنصة | ويب (متجاوب مع الهاتف) |
| الشريحة | الحلقة الأساسية + التقارير |
| الجمهور | جمعية الغابة النموذجية بإفران (AFMI) — استخدام داخلي، فريق صغير (≈6 أدوار: مدير تنفيذي، إداري، مالي، رئيس مشاريع، مونتاج مشاريع، تواصل) + شركاء/مانحون كضيوف |
| اللغات | العربية (RTL) + الفرنسية (LTR) — **متطلب خاص بالنسخة، غير موجود بنفس الشكل في الأصل** |

**الحلقة الأساسية (core loop):**
إنشاء مشروع ← تقسيمه إلى أقسام/مراحل ← إنشاء مهام وإسنادها بتواريخ ← تحريك المهام عبر حالات سير العمل ← التعليق والمتابعة ← نشر تحديث حالة أسبوعي/شهري ← لوحة متابعة وتقرير يُرسل للمانح.

**إضافة خاصة بالجمعية (مستنتجة من الحاجة، لا من الأصل):** ربط المشروع بالمانح والميزانية ومؤشرات الإنجاز، لتوليد تقرير تقدّم قابل للتصدير (PDF/Excel).

## 2. المصادر

> ملاحظة: نطاقات `asana.com` و`atlassian.com` محجوبة في شبكة هذه الجلسة، فلم أفتح صفحاتها مباشرة. اعتمدتُ على نتائج البحث (مقتطفات من مراكز المساعدة الرسمية + مقالات مقارنة). لم تُلتقط لقطات شاشة (`replica/screens/` فارغ). لم يُستخدم أي حساب.

| # | المصدر | النوع | ما أفادنا به | تحقق |
| --- | --- | --- | --- | --- |
| R1 | https://www.atlassian.com/fr/software/jira/comparison/jira-vs-asana | صفحة تسويق (من المستخدم) | تموضع المنتجين | غير مقروءة (محجوبة) |
| R2 | https://help.asana.com/s/article/project-dashboards | مركز مساعدة | الرسوم البيانية في تبويب Dashboard | مقتطف |
| R3 | https://help.asana.com/s/article/universal-reporting | مركز مساعدة | 3 مستويات تقارير: مشروع، محفظة، شامل | مقتطف |
| R4 | https://help.asana.com/s/article/how-to-create-project-dashboards | مركز مساعدة | إضافة/تخصيص/تعديل الرسوم | عناوين فقط |
| R5 | https://asana.com/features/project-management/status-updates.md | صفحة ميزة | تحديث الحالة: On track / At risk / Off track / On hold / Complete، سحب رسوم إلى التحديث، قوالب | مقتطف |
| R6 | https://asana.com/features/goals-reporting/reporting-dashboards.md | صفحة ميزة | رسوم مخصّصة: مدخلات، فلاتر، نمط عرض | مقتطف |
| R7 | https://help.asana.com/s/article/all-asana-features | مركز مساعدة | قائمة الميزات | مقتطف |
| R8 | https://help.asana.com/hc/articles/17964993107611 | مركز مساعدة | الحقول المخصصة: single/multi-select، رقم، نص | مقتطف |
| R9 | https://forum.asana.com/t/sections-dependencies-and-dates/1063124/3 | منتدى | التبعيات "waiting on" / "blocking" | مقتطف |
| R10 | https://forum.asana.com/t/q4-quality-of-life-improvements-for-our-customers/1125260.md | سجل تحديثات | إنشاء مهام فرعية من اللوحة، رفع حد الحقول إلى 150 | مقتطف |
| R11 | https://help.asana.com/s/article/permissions-overview | مركز مساعدة | صلاحيات على مستوى الكائن؛ admin/editor/commenter/viewer | مقتطف |
| R12 | https://help.asana.com/s/article/guests-faq | مركز مساعدة | الضيوف يرون فقط ما شورك معهم | مقتطف |
| R13 | https://help.asana.com/s/article/understanding-user-role-permissions | مركز مساعدة | أدوار: super admin، admin، member، guest | مقتطف |
| R14 | https://support.atlassian.com/jira-software-cloud/docs/workflows-and-statuses-for-boards-in-business-projects/ | توثيق Jira | سير عمل = حالات + انتقالات؛ سير عمل لكل نوع عنصر؛ انتقال شامل | مقتطف |
| R15 | https://support.atlassian.com:443/jira-software-cloud/docs/transition-an-issue/ | توثيق Jira | ربط أعمدة اللوحة بالحالات؛ السحب = انتقال | مقتطف |
| R16 | https://support.atlassian.com/jira-cloud-administration/docs/configure-workflow-statuses | توثيق Jira | إعداد الحالات وأنواع العناصر | عنوان |
| R17 | https://thedigitalprojectmanager.com/tools/asana-vs-jira/ | مقارنة | تكاملات Slack/Teams/Google | مقتطف |
| R18 | https://www.temperstack.com/versus/asana-vs-jira/ | مقارنة | Jira = عمق تقني، Asana = سهولة | مقتطف |
| R19 | https://cirface.com/blog/asana-dashboards-and-reporting | دليل طرف ثالث | Dashboards مشروع من Starter، المحافظ والتقارير الشاملة من Advanced | مقتطف |
| R20 | https://costbench.com/compare/jira-vs-asana/ | مقارنة أسعار | الأسعار متضاربة — لا يُعتمد عليها | ضعيف |

**ما تكشفه الأسعار (R19, R20, المقارنات):** المستويات المدفوعة تحجب: المحافظ (portfolios)، التقارير الشاملة، الأتمتة، الحقول المخصصة، الضيوف، والصلاحيات الدقيقة. أي أن **التقارير متعددة المشاريع** هي ما يدفع الناس مقابله — وهو بالضبط ما تحتاجه الجمعية للمانحين.

**ثغرات للتحقق لاحقاً:** صفحة R1 نفسها، صفحات الأسعار الرسمية، لقطات الشاشات. يمكن سدّها إن سُمح بالنطاقين في إعدادات الشبكة، أو إن عرض المستخدم حسابه المجاني.

## 3. جرد الشاشات

الحالات: `E` فارغ · `L` تحميل · `F` ممتلئ · `X` خطأ · `P` لا صلاحية · `M` هاتف

| ID | الشاشة | المسار / الوصول | الغرض | المكوّنات الرئيسية | الحالات | مصدر |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | تسجيل الدخول / قبول دعوة | `/login`, `/invite/:token` | دخول عبر بريد مدعو فقط | Input، Button، اختيار اللغة | F X M | R11, R13 |
| S02 | الرئيسية | `/` | ملخص: مهامي القادمة، مشاريعي، آخر التحديثات | Sidebar، Card، TaskRow، Avatar | E F L M | R7 |
| S03 | مهامي | `/my-tasks` | كل المهام المسندة لي، مجمّعة (متأخرة/اليوم/القادمة) | TaskRow، GroupHeader، Filter | E F M | R7 |
| S04 | صندوق الإشعارات | `/inbox` | إسناد، تعليق، إشارة، تغيير حالة | NotificationItem، Tabs | E F M | R7 |
| S05 | المشاريع / الفريق | `/projects` | قائمة المشاريع مع حالتها ونسبة الإنجاز | ProjectCard، StatusBadge، ProgressBar، Filter | E F P M | R3 |
| S06 | إنشاء مشروع | Modal من S05 | اسم، قالب، سير عمل، مانح، تواريخ، ميزانية | Modal، Form، Select، DatePicker | F X | R7, R14 |
| S07 | مشروع — عرض القائمة | `/p/:id/list` | المهام مجمّعة حسب الأقسام مع أعمدة الحقول | ProjectHeader، ViewTabs، Table، SectionHeader، InlineEdit، AddTaskRow | E F L P M | R8 |
| S08 | مشروع — اللوحة (Kanban) | `/p/:id/board` | أعمدة = حالات سير العمل؛ السحب = انتقال | BoardColumn، TaskCard، DragHandle | E F P M | R14, R15 |
| S09 | تفاصيل المهمة | لوحة جانبية `?task=:id` | كل حقول المهمة، مهام فرعية، تبعيات، مرفقات، تعليقات، سجل النشاط | SidePanel، Field، StatusSelect، UserPicker، DatePicker، SubtaskList، DependencyPicker، CommentBox، ActivityFeed، FileUpload | F X P M | R8, R9, R10 |
| S10 | مشروع — الجدول الزمني | `/p/:id/timeline` | شريط زمني (Gantt) مع التبعيات | TimelineBar، DependencyArrow، ZoomControl | E F | R9 |
| S11 | مشروع — التقويم | `/p/:id/calendar` | المهام حسب تاريخ الاستحقاق | CalendarGrid، TaskChip | E F M | R7 |
| S12 | مشروع — لوحة المتابعة | `/p/:id/dashboard` | رسوم: حسب الحالة، حسب المسؤول، متأخرة، إنجاز عبر الزمن | ChartCard، KPI Tile، Filter | E F L | R2, R4, R6 |
| S13 | مشروع — التقدّم / تحديثات الحالة | `/p/:id/progress` | نشر تحديث بحالة (على المسار/في خطر/متأخر/معلّق/مكتمل) + ملخص + رسوم مسحوبة | StatusPicker، RichText، ChartCard، UpdateHistory | E F | R5 |
| S14 | المحفظة | `/portfolio` | كل المشاريع في جدول: الحالة، التقدّم، المسؤول، المانح، الميزانية | Table، StatusBadge، ProgressBar | E F P | R3, R19 |
| S15 | التقارير / تقرير المانح | `/reports`, `/reports/:id` | تقرير متعدد المشاريع + تصدير PDF/Excel لمانح أو فترة | ReportBuilder، ChartCard، ExportButton، DateRange | E F L | R3 (+ حاجة AFMI) |
| S16 | إعدادات المشروع — الأعضاء | `/p/:id/settings/members` | دعوة، دور المشروع (مدير/محرر/معلّق/مشاهد)، خصوصية المشروع | MemberRow، RoleSelect، InviteInput | F P | R11, R12 |
| S17 | إعدادات سير العمل | `/settings/workflows/:id` | حالات (لون، فئة: للتنفيذ/جارٍ/منجز) + انتقالات مسموحة | StatusList، TransitionMatrix أو Graph | F X | R14, R16 |
| S18 | الحقول المخصصة | `/settings/fields` | إنشاء حقول: اختيار، متعدد، رقم، نص، تاريخ | FieldEditor، OptionList | E F | R8 |
| S19 | إعدادات مساحة العمل — الأعضاء | `/settings/members` | الأدوار العامة: مسؤول، عضو، ضيف | Table، RoleSelect، InviteModal | F P | R13 |
| S20 | البحث والفلاتر المحفوظة | شريط علوي + `/search` | بحث نصي + فلاتر (مسؤول، حالة، تاريخ، مشروع، حقل) | SearchInput، FilterBuilder، ResultList | E F | R7 |
| S21 | الملف الشخصي | `/me` | الاسم، الصورة، اللغة (ar/fr)، إعدادات الإشعارات | Form، Toggle، LanguageSwitch | F | — |

**المجموع: 21 شاشة.**

## 4. مسارات المستخدم

```
F01 رئيس المشاريع ينشئ مشروعاً جديداً لمانح
    S05 -> S06 (اسم، قالب، سير عمل، مانح، تواريخ، ميزانية) -> S07 (أقسام القالب جاهزة)
    نقرات (مسار سعيد): 5
    edge: لا قوالب بعد، مانح غير موجود (إنشاء سريع)، تاريخ نهاية قبل البداية

F02 إضافة مهمة وإسنادها
    S07 -> AddTaskRow (كتابة العنوان + Enter) -> S09 (مسؤول، تاريخ، أولوية)
    نقرات: 4
    edge: المسؤول ليس عضواً في المشروع (دعوة ضمنية؟)، تاريخ خارج فترة المشروع

F03 العضو ينجز عمله اليومي
    S02 أو S03 -> S09 -> تغيير الحالة / تعليق / إرفاق ملف -> إشعار في S04 للمعنيين
    نقرات: 3
    edge: انتقال غير مسموح في سير العمل (Jira)، مهمة محجوبة بتبعية غير منجزة

F04 تحريك مهمة على اللوحة
    S08 -> سحب البطاقة إلى عمود -> (انتقال سير العمل) -> تحديث فوري
    نقرات: 1 سحب
    edge: الانتقال غير مسموح (إرجاع البطاقة + رسالة)، عمودان مرتبطان بنفس الحالة، تعديل متزامن من مستخدمين

F05 المدير التنفيذي يتابع كل المشاريع
    S14 -> فرز حسب الحالة "في خطر" -> S13 لمشروع -> S12
    نقرات: 3
    edge: مشروع بلا أي تحديث حالة، لا صلاحية على مشروع خاص

F06 نشر تحديث حالة شهري
    S13 -> "تحديث جديد" -> اختيار الحالة -> كتابة الملخص -> سحب رسم من S12 -> نشر -> إشعار للمتابعين
    نقرات: 6
    edge: مسودة غير منشورة، تحديث بقالب محفوظ

F07 توليد تقرير للمانح
    S15 -> تقرير جديد -> اختيار المانح + الفترة -> معاينة (مشاريع، تقدّم، مؤشرات، ميزانية مصروفة، آخر تحديثات الحالة) -> تصدير PDF/Excel
    نقرات: 5
    edge: مشروع بلا بيانات ميزانية، فترة بلا تحديثات، تقرير ثنائي اللغة (ar/fr)

F08 دعوة ضيف (شريك/مانح) لمشروع واحد
    S16 -> إدخال البريد -> دور "مشاهد" أو "معلّق" -> دعوة -> الضيف عبر S01 يرى المشروع فقط
    نقرات: 4
    edge: البريد موجود كعضو، الضيف يحاول فتح مشروع آخر (P)، سحب الدعوة

F09 المسؤول يعدّل سير العمل
    S17 -> إضافة حالة "بانتظار موافقة المانح" -> تحديد الانتقالات -> حفظ -> S08 تظهر عموداً جديداً
    نقرات: 6
    edge: حذف حالة فيها مهام (إلزام بنقلها)، سير عمل يستخدمه عدة مشاريع
```

**المجموع: 9 مسارات.**

## 5. المكوّنات

| المكوّن | المتغيرات | الحالات | الشاشات |
| --- | --- | --- | --- |
| Button | primary، secondary، ghost، danger، icon | default، hover، focus، disabled، loading | الكل |
| Input / Textarea | text، email، search، number | default، focus، error، disabled | S01 S06 S09 S18 S20 |
| Select / Combobox | single، multi، مع بحث | open، closed، empty | S06 S09 S16 S18 |
| UserPicker / Avatar | فردي، مجموعة (stack) | — ، غير مسند | S02 S07 S08 S09 S16 |
| DatePicker / DateRange | تاريخ، فترة | — ، متأخر (أحمر) | S06 S09 S15 |
| StatusBadge / StatusSelect | حالة المهمة (لون + فئة)، حالة المشروع (5 قيم) | — | S05 S07 S08 S09 S13 S14 |
| TaskRow | قائمة، مهامي، نتيجة بحث | hover، selected، done (مشطوب)، overdue | S03 S07 S20 |
| TaskCard | لوحة | dragging، drop-target، blocked | S08 |
| BoardColumn | — | empty، over-limit، drop-allowed/denied | S08 |
| SectionHeader | قابل للطي | collapsed، expanded | S07 |
| SidePanel | تفاصيل المهمة | open، loading، error | S09 |
| Modal | form، confirm | — | S06 S19 |
| Sidebar / Nav | واسع، مطوي، هاتف (drawer) | active item | الكل |
| ViewTabs | قائمة/لوحة/زمني/تقويم/متابعة/تقدّم | active | S07–S13 |
| Table | قابل للفرز، أعمدة قابلة للتخصيص | empty، loading | S07 S14 S19 |
| ChartCard | أعمدة، دائري، خط، رقم (KPI) | empty، loading | S12 S13 S15 |
| ProgressBar | — | 0%، جزئي، 100% | S05 S14 |
| CommentBox / ActivityFeed | تعليق، إشارة @، سجل تغيير | — | S09 S13 |
| FileUpload / Attachment | — | uploading، error | S09 |
| Toast | success، error، undo | — | الكل |
| EmptyState | لكل شاشة رسالة + إجراء | — | الكل |
| FilterBuilder | سريع (chips)، متقدم | — | S07 S14 S20 |
| LanguageSwitch | ar ↔ fr (يقلب RTL/LTR) | — | S01 S21 |

## 6. نموذج البيانات المستنتج

```
Workspace     id, name, default_locale (ar|fr)
              evidence: R11, R13 (workspace/organization) · confidence: high

User          id, name, email, avatar_url, locale, workspace_role (admin | member | guest)
              evidence: R13 (super admin/admin/member/guest) · confidence: high

Team          id, workspace_id, name            (مثلاً: الإدارة، المالية، المشاريع، التواصل)
              evidence: R11, R12 · confidence: high · ملاحظة: قد يكون اختيارياً لجمعية صغيرة

Project       id, workspace_id, team_id?, name, description, owner_id,
              privacy (private | team | workspace), workflow_id,
              start_date, due_date, color, archived_at,
              donor_id?, budget_amount?, budget_currency?          ← إضافة AFMI
              evidence: R7, R11 · confidence: high (الحقول الأساسية) / guess (حقول المانح)

ProjectMember project_id, user_id, role (admin | editor | commenter | viewer)
              evidence: R11 · confidence: high

Section       id, project_id, name, position
              evidence: R9, R10 · confidence: high

Workflow      id, workspace_id, name
WorkflowStatus id, workflow_id, name, color, category (todo | in_progress | done), position
WorkflowTransition id, workflow_id, from_status_id (null = من أي حالة), to_status_id
              evidence: R14, R15, R16 · confidence: high (المفهوم) / medium (البنية)

Task          id, project_id, section_id, parent_task_id?, title, description (rich text),
              status_id, assignee_id?, start_date?, due_date?, priority?,
              completed_at?, created_by, position, created_at, updated_at
              evidence: R8, R9, R10 · confidence: high
              ملاحظة: Asana تسمح بمهمة في عدة مشاريع — نتجاهل ذلك (guess: غير ضروري)

TaskDependency task_id, depends_on_task_id      ("waiting on")
              evidence: R9 · confidence: high

CustomField   id, workspace_id, name, type (text | number | single_select | multi_select | date)
CustomFieldOption id, field_id, label, color
ProjectField  project_id, field_id, position
TaskFieldValue task_id, field_id, value (json)
              evidence: R8, R10 · confidence: high

Comment       id, task_id, author_id, body, created_at, edited_at
Attachment    id, task_id, uploader_id, file_name, url, size, mime
Activity      id, entity_type, entity_id, actor_id, action, payload (json), created_at
Follower      entity_type, entity_id, user_id
Notification  id, user_id, activity_id, read_at
              evidence: R7 (inbox, comments) · confidence: medium

StatusUpdate  id, project_id, author_id, status (on_track | at_risk | off_track | on_hold | complete),
              title, body (rich text, قد يضم رسوماً مضمنة), created_at
              evidence: R5 · confidence: high

Dashboard     id, project_id? (null = شامل), name
Chart         id, dashboard_id, type (bar | donut | line | number), source (tasks | projects),
              group_by, filters (json), position
              evidence: R2, R4, R6 · confidence: medium

Donor         id, name, contact, notes                          ← إضافة AFMI · confidence: guess
Indicator     id, project_id, name, target, current, unit       ← مؤشرات الإنجاز · guess
Expense?      id, project_id, amount, date, category            ← guess، ربما يكفي رقم "المصروف"
Report        id, donor_id?, period_start, period_end, project_ids, locale, generated_file_url
              evidence: حاجة AFMI · confidence: guess
```

## 7. مصفوفة الميزات

انظر `replica/features.csv` — 62 صفاً: 32 ضروري (must)، 15 مهم (should)، 8 اختياري (could)، 7 مستبعد (skip).

## 8. ما لا يمكن نسخه

| البند | السبب |
| --- | --- |
| اسم وشعار وأيقونات Asana/Jira وألوانهما | علامات تجارية — نصمم هوية خاصة بـ AFMI |
| سوق التكاملات (مئات التطبيقات) والشراكات | اتفاقيات تجارية وشبكة — نكتفي بالبريد وربما تصدير |
| الذكاء الاصطناعي المدمج (Asana AI / Atlassian Intelligence) | نماذج ومحتوى مملوك؛ يمكن إضافة شيء خاص لاحقاً |
| مكتبة القوالب الجاهزة | محتوى مملوك — نكتب قوالب AFMI الخاصة (مشروع ممول، حملة تواصل، تقرير سنوي) |
| تطبيقات iOS/Android الأصلية | خارج النطاق — الويب المتجاوب يكفي |
| الامتثال المؤسسي (SSO/SAML، SOC2، data residency) | ليس من حاجة جمعية صغيرة |
| نظام Jira الكامل (JQL، Sprints، Scrum، Confluence) | للبرمجيات لا للجمعيات — نأخذ سير العمل فقط |

## 9. الحجم

| البند | العدد |
| --- | --- |
| شاشات | 21 (منها 15 ضرورية للنسخة الأولى) |
| مسارات | 9 |
| كيانات | ≈24 (منها 5 خاصة بـ AFMI) |

**الأجزاء الصعبة:**

1. **سير العمل القابل للتخصيص + لوحة السحب والإفلات**: التحقق من الانتقالات المسموحة، ربط الأعمدة بالحالات، والترتيب (position) دون تعارض عند التعديل المتزامن.
2. **التقارير ولوحات المتابعة**: رسوم مبنية على فلاتر ديناميكية، تجميع عبر المشاريع، وتصدير PDF/Excel بالعربية (خطوط RTL في PDF صعبة فعلاً).
3. **ثنائية اللغة RTL/LTR**: كل المكوّنات (الجدول الزمني، اللوحة، الرسوم، التواريخ) يجب أن تنقلب اتجاهاً.
4. (أقل) الإشعارات والبريد، والتحديث اللحظي بين المستخدمين، والصلاحيات على ثلاثة مستويات (مساحة/مشروع/ضيف).

**التقدير: M (بضعة أسابيع)** للنسخة الأولى بالميزات الضرورية (must)، مع افتراض مطوّر واحد مدعوم بـ Claude.
إضافة الجدول الزمني (Gantt) والتحديث اللحظي والأتمتة تدفعها نحو **L**. لا وعود بنسخة مطابقة.
