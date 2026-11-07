# projets-gestion — منصة إدارة مشاريع AFMI

منصة ويب داخلية لجمعية الغابة النموذجية بإفران (AFMI) لإدارة المشاريع والمهام والتقارير للمانحين.
تجمع بين بساطة أدوات مثل Asana وسير العمل القابل للتخصيص في أدوات مثل Jira، بواجهة عربية وفرنسية.

Plateforme web interne de l'AFMI (Association Forêt Modèle d'Ifrane) pour gérer les projets, les tâches et les rapports aux bailleurs. Interface en arabe et en français.

## الحالة / État

- [x] المرحلة 1: الاستطلاع (recon) — `replica/recon.md`، `replica/features.csv`
- [x] المرحلة 2: الهندسة — `replica/architecture.md`، `replica/schema.sql` (29 جدولاً، مُختبَر)
- [ ] المرحلة 3: نظام التصميم
- [ ] المرحلة 4: البناء

## الملفات / Fichiers

| الملف | المحتوى |
| --- | --- |
| `replica/recon.md` | النطاق، المصادر، 21 شاشة، 9 مسارات، المكوّنات، نموذج البيانات، الحجم |
| `replica/features.csv` | مصفوفة 62 ميزة مع الأولوية وحالة التنفيذ |
| `replica/architecture.md` | التقنيات، الواجهات البرمجية، المخاطر، ترتيب البناء |
| `replica/schema.sql` | مخطط Postgres/Supabase مع RLS |
| `replica/tests/` | اختبارات المخطط (صلاحيات، سير العمل، تبعيات) |
| `replica/screens/` | لقطات مرجعية (لا تُنشر في التطبيق) |

## اختبار المخطط / Tester le schéma

```bash
createdb t
psql -d t -f replica/tests/supabase-stub.sql -f replica/schema.sql -f replica/tests/schema.test.sql
```
