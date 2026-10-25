// مخطط قاعدة البيانات + تعريف الكيانات والصلاحيات (مصدر الحقيقة للواجهة الخلفية)

export const SCHEMA_VERSION = 24;

export const DDL = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT, role TEXT NOT NULL DEFAULT 'account', title TEXT, pass_hash TEXT, pass_salt TEXT, must_change INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1, commission_rate REAL DEFAULT 0, last_login TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, company TEXT, phone TEXT, email TEXT, city TEXT,
    sector TEXT, segment TEXT, source TEXT, status TEXT DEFAULT 'جديد', score INTEGER DEFAULT 0, owner_id INTEGER, next_followup TEXT,
    interest TEXT, notes TEXT, client_id INTEGER, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS deals (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, lead_id INTEGER, client_id INTEGER,
    stage TEXT DEFAULT 'جديدة', value REAL DEFAULT 0, probability INTEGER DEFAULT 10, expected_close TEXT, owner_id INTEGER,
    sector TEXT, package TEXT, loss_reason TEXT, notes TEXT, closed_at TEXT, created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, lead_id INTEGER, deal_id INTEGER, client_id INTEGER,
    subject TEXT, outcome TEXT, notes TEXT, at TEXT DEFAULT (datetime('now')), user_id INTEGER, next_step TEXT, next_date TEXT,
    created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, place_name TEXT, lead_id INTEGER, client_id INTEGER, city TEXT,
    lat REAL, lng REAL, accuracy REAL, photo_id INTEGER, outcome TEXT, interest TEXT, notes TEXT, user_id INTEGER,
    at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, brand TEXT, sector TEXT, contact_name TEXT,
    phone TEXT, email TEXT, city TEXT, cr_number TEXT, vat_number TEXT, national_address TEXT, status TEXT DEFAULT 'نشط',
    account_manager_id INTEGER, package TEXT, start_date TEXT, renewal_date TEXT, health TEXT DEFAULT 'جيد', report_day INTEGER,
    socials TEXT, drive_link TEXT, notes TEXT, lead_id INTEGER, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, sector TEXT, code TEXT, name TEXT NOT NULL,
    months INTEGER DEFAULT 0, monthly REAL DEFAULT 0, price REAL DEFAULT 0, unit TEXT, plan TEXT, delivery TEXT, details TEXT,
    active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, client_id INTEGER, lead_id INTEGER, deal_id INTEGER,
    title TEXT, items TEXT, subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, vat REAL DEFAULT 0, total REAL DEFAULT 0, valid_until TEXT,
    status TEXT DEFAULT 'مسودة', plan TEXT, months INTEGER DEFAULT 0, notes TEXT, terms TEXT, created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS contracts (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, client_id INTEGER, quote_id INTEGER, title TEXT,
    package TEXT, start_date TEXT, end_date TEXT, months INTEGER DEFAULT 1, monthly_value REAL DEFAULT 0, total_value REAL DEFAULT 0,
    plan TEXT DEFAULT 'monthly', auto_renew INTEGER DEFAULT 1, notice_days INTEGER DEFAULT 30, status TEXT DEFAULT 'مسودة',
    signed_at TEXT, file_link TEXT, owner_id INTEGER, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, client_id INTEGER, contract_id INTEGER,
    issue_date TEXT, due_date TEXT, description TEXT, subtotal REAL DEFAULT 0, vat REAL DEFAULT 0, total REAL DEFAULT 0, paid REAL DEFAULT 0,
    status TEXT DEFAULT 'مسودة', tax_ref TEXT, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, client_id INTEGER, amount REAL NOT NULL,
    method TEXT, ref TEXT, paid_at TEXT, notes TEXT, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, vendor TEXT, amount REAL NOT NULL, vat REAL DEFAULT 0,
    date TEXT, client_id INTEGER, notes TEXT, receipt_link TEXT, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, client_id INTEGER, contract_id INTEGER,
    type TEXT, status TEXT DEFAULT 'نشط', start_date TEXT, due_date TEXT, owner_id INTEGER, notes TEXT, created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, project_id INTEGER, client_id INTEGER,
    assignee_id INTEGER, status TEXT DEFAULT 'جديدة', priority TEXT DEFAULT 'عادية', due_date TEXT, revisions INTEGER DEFAULT 0,
    est_hours REAL, spent_hours REAL, description TEXT, link TEXT, created_by INTEGER, done_at TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, publish_date TEXT, platform TEXT, format TEXT,
    pillar TEXT, title TEXT, caption TEXT, status TEXT DEFAULT 'فكرة', assignee_id INTEGER, designer_id INTEGER, revisions INTEGER DEFAULT 0,
    asset_link TEXT, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS seasons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date TEXT NOT NULL, sectors TEXT,
    notes TEXT, plan_days INTEGER DEFAULT 42, print_days INTEGER DEFAULT 28, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, title TEXT NOT NULL, body TEXT,
    author_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, mime TEXT, size INTEGER, data TEXT, user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, entity TEXT, entity_id INTEGER,
    detail TEXT, at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL, category TEXT, kind TEXT DEFAULT 'task',
    emoji TEXT, description TEXT, role TEXT, default_assignee_id INTEGER, priority TEXT DEFAULT 'عادية', due_days INTEGER DEFAULT 2, est_hours REAL,
    title_tpl TEXT, fields TEXT, checklist TEXT, roles TEXT, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, uses INTEGER DEFAULT 0,
    created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS tg_state (chat_id TEXT PRIMARY KEY, user_id INTEGER, state TEXT, updated_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS tg_codes (code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT, title TEXT, body TEXT,
    link TEXT, channels TEXT, read_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, read_at, id)`,
  `CREATE TABLE IF NOT EXISTS api_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT, prefix TEXT,
    token_hash TEXT NOT NULL UNIQUE, scope TEXT DEFAULT 'read', expires_at TEXT, last_used_at TEXT, uses INTEGER DEFAULT 0, revoked_at TEXT,
    created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_tokens_user ON api_tokens(user_id)`,
  `CREATE INDEX IF NOT EXISTS ix_leads_owner ON leads(owner_id)`,
  `CREATE INDEX IF NOT EXISTS ix_leads_phone ON leads(phone)`,
  `CREATE INDEX IF NOT EXISTS ix_deals_stage ON deals(stage)`,
  `CREATE INDEX IF NOT EXISTS ix_act_lead ON activities(lead_id)`,
  `CREATE INDEX IF NOT EXISTS ix_tasks_assignee ON tasks(assignee_id, status)`,
  `CREATE INDEX IF NOT EXISTS ix_content_client ON content(client_id, publish_date)`,
  `CREATE INDEX IF NOT EXISTS ix_inv_client ON invoices(client_id, status)`,
  // طلبات عروض الأسعار بين القطاعات (مع منصة الدعاية والإعلان) — انظر _lib/xq.js
  `CREATE TABLE IF NOT EXISTS xq_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL UNIQUE, direction TEXT NOT NULL, number TEXT NOT NULL,
    peer_id TEXT, status TEXT NOT NULL DEFAULT 'pending', title TEXT, requester_user_id INTEGER, requester_name TEXT, requester_phone TEXT, requester_email TEXT,
    client_id INTEGER, client_name TEXT, client_company TEXT, client_phone TEXT, client_email TEXT, needed_by TEXT, notes TEXT, links TEXT, suggested_total REAL,
    handler_user_id INTEGER, handler_name TEXT, handler_phone TEXT, quote_number TEXT, quote_total REAL, quote_vat_included INTEGER DEFAULT 0, quote_valid_until TEXT,
    quote_note TEXT, quoted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_xq_dir ON xq_requests(direction, status, id)`,
  `CREATE TABLE IF NOT EXISTS xq_items (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, uid TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
    qty REAL DEFAULT 1, unit TEXT, suggested_price REAL, quoted_price REAL, sort INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS ix_xqi_req ON xq_items(request_id)`,
  `CREATE TABLE IF NOT EXISTS xq_files (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, item_uid TEXT, side TEXT DEFAULT 'request',
    origin TEXT DEFAULT 'local', file_id INTEGER, peer_file_id TEXT, name TEXT, mime TEXT, size INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_xqf_req ON xq_files(request_id)`,
  `CREATE TABLE IF NOT EXISTS xq_events (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, event_uid TEXT NOT NULL UNIQUE, event TEXT NOT NULL,
    by_name TEXT, side TEXT DEFAULT 'local', note TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_xqe_req ON xq_events(request_id, id)`,
  `CREATE TABLE IF NOT EXISTS xq_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, payload TEXT NOT NULL, request_id INTEGER, tries INTEGER DEFAULT 0,
    last_error TEXT, created_at TEXT DEFAULT (datetime('now')), sent_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_xqo_pending ON xq_outbox(sent_at, id)`,
  // v7: أطراف المهمة (تعدد المكلّفين + أطراف خارجية) والتذكيرات
  `CREATE TABLE IF NOT EXISTS task_people (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, user_id INTEGER, ext_name TEXT, ext_phone TEXT,
    ext_kind TEXT, role TEXT DEFAULT 'مكلّف', added_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_tp_task ON task_people(task_id)`,
  `CREATE INDEX IF NOT EXISTS ix_tp_user ON task_people(user_id)`,
  `CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id INTEGER NOT NULL, title TEXT,
    remind_at TEXT NOT NULL, user_ids TEXT, channels TEXT DEFAULT 'app,wa,tg', note TEXT, status TEXT DEFAULT 'pending', sent_at TEXT,
    created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_rem_due ON reminders(status, remind_at)`,
  `CREATE INDEX IF NOT EXISTS ix_rem_ent ON reminders(entity, entity_id)`,
  // v8: المناديب الخارجيون بنظام العمولة — انظر _lib/reps.js
  `CREATE TABLE IF NOT EXISTS reps (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, city TEXT,
    rate REAL DEFAULT 10, months INTEGER DEFAULT 12, base TEXT DEFAULT 'net', bank_name TEXT, iban TEXT, status TEXT DEFAULT 'نشط', notes TEXT,
    portal_hash TEXT, portal_prefix TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS commissions (id INTEGER PRIMARY KEY AUTOINCREMENT, rep_id INTEGER NOT NULL, client_id INTEGER, contract_id INTEGER,
    invoice_id INTEGER, payment_id INTEGER UNIQUE, base_amount REAL DEFAULT 0, rate REAL DEFAULT 0, amount REAL DEFAULT 0, status TEXT DEFAULT 'مستحقة',
    payout_id INTEGER, note TEXT, earned_at TEXT, approved_by INTEGER, approved_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_comm_rep ON commissions(rep_id, status)`,
  `CREATE INDEX IF NOT EXISTS ix_comm_client ON commissions(client_id)`,
  `CREATE TABLE IF NOT EXISTS rep_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, rep_id INTEGER NOT NULL, total REAL DEFAULT 0, count INTEGER DEFAULT 0,
    method TEXT, ref TEXT, paid_at TEXT, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS ix_rpo_rep ON rep_payouts(rep_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ix_reps_portal ON reps(portal_hash)`,
  // v9: استوديو الذكاء — الخطط التسويقية للعملاء (انظر _lib/studio.js)
  `CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, title TEXT, start_date TEXT, months INTEGER DEFAULT 3,
    goals TEXT, budget TEXT, status TEXT DEFAULT 'مسودة', doc TEXT, engine TEXT, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_plans_client ON plans(client_id)`,
  // v10: دمج مروج الحجاز — أرشيف خام لكل سجل مستورد (المصدر، الكيان، المعرّف القديم ← الجديد)
  `CREATE TABLE IF NOT EXISTS legacy_import (src TEXT NOT NULL, entity TEXT NOT NULL, old_id TEXT NOT NULL, new_id INTEGER, data TEXT,
    at TEXT DEFAULT (datetime('now')), PRIMARY KEY (src, entity, old_id))`,
  // v11: المحاسبة (شجرة الحسابات والقيود) والموارد البشرية (الموظفون، مسير الرواتب، السلف) — لكل جهة
  `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, name TEXT NOT NULL, type TEXT, parent_id INTEGER,
    is_group INTEGER DEFAULT 0, active INTEGER DEFAULT 1, notes TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_accounts_org ON accounts(org, code)`,
  `CREATE TABLE IF NOT EXISTS journals (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, date TEXT, description TEXT, status TEXT DEFAULT 'مرحّل', ref TEXT,
    lines TEXT, total REAL DEFAULT 0, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_journals_org ON journals(org, date)`,
  `CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, job_title TEXT, phone TEXT, email TEXT, start_date TEXT,
    status TEXT DEFAULT 'على رأس العمل', basic_salary REAL DEFAULT 0, housing REAL DEFAULT 0, transport REAL DEFAULT 0, other_allow REAL DEFAULT 0, fixed_deduct REAL DEFAULT 0,
    bank_name TEXT, iban TEXT, user_id INTEGER, notes TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS payroll (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, month TEXT, employee_id INTEGER, basic REAL DEFAULT 0, allowances REAL DEFAULT 0,
    bonus REAL DEFAULT 0, deductions REAL DEFAULT 0, advance_deduct REAL DEFAULT 0, net REAL DEFAULT 0, status TEXT DEFAULT 'مسودة', paid_date TEXT, cash_account INTEGER,
    notes TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_payroll_month ON payroll(org, month)`,
  `CREATE TABLE IF NOT EXISTS advances (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, date TEXT, employee_id INTEGER, amount REAL DEFAULT 0, installment REAL DEFAULT 0,
    paid_back REAL DEFAULT 0, reason TEXT, cash_account INTEGER, status TEXT DEFAULT 'قائمة', notes TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  // v12: الحملات الإعلانية — المؤشرات (CTR، CPL، CPA، ROAS) تُحسب في الواجهة من الأرقام الخام
  `CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, platform TEXT, client_id INTEGER, objective TEXT,
    status TEXT DEFAULT 'مخطط', start_date TEXT, end_date TEXT, budget REAL DEFAULT 0, spend REAL DEFAULT 0, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0, conversions INTEGER DEFAULT 0, revenue REAL DEFAULT 0, owner_id INTEGER, notes TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  'CREATE INDEX IF NOT EXISTS ix_campaigns_client ON campaigns(client_id)',
  // v13: النسخ الاحتياطي اليومي — JSON مضغوط gzip مقسّم على صفوف (انظر _lib/backup.js)
  `CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, kind TEXT DEFAULT 'daily', status TEXT DEFAULT 'running',
    tables INTEGER DEFAULT 0, rows INTEGER DEFAULT 0, raw_size INTEGER DEFAULT 0, size INTEGER DEFAULT 0, chunks INTEGER DEFAULT 0, error TEXT,
    user_id INTEGER, created_at TEXT DEFAULT (datetime('now')), done_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS backup_chunks (backup_id INTEGER NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (backup_id, seq))`,
  // v14: فهارس عارض سجل التدقيق (التصفية بالمستخدم والكيان والتاريخ)
  'CREATE INDEX IF NOT EXISTS ix_audit_at ON audit(at)',
  'CREATE INDEX IF NOT EXISTS ix_audit_user ON audit(user_id, id)',
  'CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit(entity, entity_id)',
  // v16: التوظيف — الوظائف المعلنة وطلبات التقديم من صفحة «انضم إلينا» (انظر _lib/hiring.js)
  `CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, title TEXT NOT NULL, summary TEXT, details TEXT, location TEXT,
    modes TEXT, skills TEXT, tools TEXT, extra_q TEXT, status TEXT DEFAULT 'مفتوحة', sort INTEGER DEFAULT 0, org TEXT DEFAULT 'nubl',
    created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, job_id INTEGER, job_title TEXT, name TEXT NOT NULL, phone TEXT,
    email TEXT, city TEXT, experience TEXT, skills TEXT, tools TEXT, portfolio TEXT, cv_link TEXT, cv_name TEXT, cv_mime TEXT, cv_size INTEGER, cv_chunks INTEGER DEFAULT 0,
    mode TEXT, salary TEXT, start_when TEXT, answer TEXT, status TEXT DEFAULT 'جديد', rating INTEGER, notes TEXT, owner_id INTEGER, ip_hash TEXT, submits INTEGER DEFAULT 1,
    org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  'CREATE INDEX IF NOT EXISTS ix_apps_job ON applications(job_id, status)',
  'CREATE INDEX IF NOT EXISTS ix_apps_phone ON applications(phone, job_id)',
  `CREATE TABLE IF NOT EXISTS app_files (app_id INTEGER NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (app_id, seq))`,
  // v18: مسار العميل — أحداث مراحل العرض/العقد/الفاتورة، وطابور رسائل واتساب للعميل والمندوب (انظر _lib/track.js)
  `CREATE TABLE IF NOT EXISTS track_events (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, client_id INTEGER, quote_id INTEGER, event TEXT NOT NULL,
    title TEXT, detail TEXT, client_text TEXT, by_user INTEGER, via TEXT, org TEXT DEFAULT 'nubl', created_at TEXT DEFAULT (datetime('now')))`,
  'CREATE INDEX IF NOT EXISTS ix_tev_lead ON track_events(lead_id, id)',
  'CREATE INDEX IF NOT EXISTS ix_tev_client ON track_events(client_id, id)',
  'CREATE INDEX IF NOT EXISTS ix_tev_quote ON track_events(quote_id, event)',
  `CREATE TABLE IF NOT EXISTS client_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, lead_id INTEGER, client_id INTEGER, to_phone TEXT NOT NULL,
    to_name TEXT, role TEXT DEFAULT 'client', text TEXT NOT NULL, link TEXT, status TEXT DEFAULT 'pending', mode TEXT, error TEXT, tries INTEGER DEFAULT 0,
    dedupe TEXT UNIQUE, created_at TEXT DEFAULT (datetime('now')), sent_at TEXT)`,
  'CREATE INDEX IF NOT EXISTS ix_cmsg_status ON client_msgs(status, id)',
  // v18: إشعارات الدفع لأجهزة الفريق (Web Push — تطبيق الجوال المثبّت وسطح المكتب)
  `CREATE TABLE IF NOT EXISTS push_subs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    ua TEXT, fails INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), last_ok TEXT)`,
  'CREATE INDEX IF NOT EXISTS ix_push_user ON push_subs(user_id)',
  // v19: جلسات التشخيص — الحجز الذاتي، الاستبيان وتحليله، Google Meet، التذكيرات (انظر _lib/sessions.js). الأوقات بتوقيت الرياض «YYYY-MM-DD HH:MM»
  `CREATE TABLE IF NOT EXISTS diag_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, lead_id INTEGER, client_id INTEGER, start_at TEXT NOT NULL, end_at TEXT,
    mode TEXT DEFAULT 'video', status TEXT DEFAULT 'محجوزة', name TEXT, company TEXT, phone TEXT, email TEXT, city TEXT, sector TEXT, notes_client TEXT, source TEXT,
    host_id INTEGER, meet_link TEXT, gcal_id TEXT, survey TEXT, survey_at TEXT, brief TEXT, brief_engine TEXT, brief_at TEXT, notes TEXT, outcome TEXT, cancel_reason TEXT,
    rem_team24 INTEGER DEFAULT 0, rem_team1 INTEGER DEFAULT 0, rem_client24 INTEGER DEFAULT 0, rem_client1 INTEGER DEFAULT 0, rem_outcome INTEGER DEFAULT 0,
    org TEXT DEFAULT 'nubl', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
  'CREATE INDEX IF NOT EXISTS ix_diag_start ON diag_sessions(start_at, status)',
  'CREATE INDEX IF NOT EXISTS ix_diag_lead ON diag_sessions(lead_id)',
];

// الجهات داخل المنصة (فصل الأعمال حسب طبيعة العملاء — الفريق والإدارة واحدة)
export const ORGS = {
  nubl: { name: 'نُبل وابتكار للتسويق', short: 'نُبل وابتكار', sector: 'القطاع الربحي' },
  morooj: { name: 'مروج الحجاز للأعمال التجارية', short: 'مروج الحجاز', sector: 'القطاع غير الربحي' },
};
export const ORG_ENTITIES = ['leads', 'deals', 'activities', 'visits', 'clients', 'catalog', 'quotes', 'contracts', 'invoices', 'payments', 'expenses', 'projects', 'tasks', 'content', 'plans', 'campaigns'];

// ترحيلات تُطبّق مرة واحدة على قواعد قائمة (فشل أي سطر = العمود موجود مسبقاً)
export const MIGRATIONS = [
  'ALTER TABLE tasks ADD COLUMN template_id INTEGER',
  'ALTER TABLE tasks ADD COLUMN checklist TEXT',
  'ALTER TABLE tasks ADD COLUMN data TEXT',
  "ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'المنصة'",
  'ALTER TABLE users ADD COLUMN tg_chat_id TEXT',
  'ALTER TABLE users ADD COLUMN tg_username TEXT',
  'CREATE INDEX IF NOT EXISTS ix_tasks_tpl ON tasks(template_id)',
  'CREATE INDEX IF NOT EXISTS ix_users_tg ON users(tg_chat_id)',
  'ALTER TABLE users ADD COLUMN notify_wa INTEGER DEFAULT 1',
  'ALTER TABLE users ADD COLUMN notify_tg INTEGER DEFAULT 1',
  // v5: طلب القطاع الآخر مرتبط بعرض السعر في «عروض الأسعار» (ترقيمها وقالبها)
  'ALTER TABLE xq_requests ADD COLUMN quote_id INTEGER',
  // v8: ربط المندوب بالعميل المحتمل والصفقة والعميل + نهاية مدة استحقاقه
  'ALTER TABLE leads ADD COLUMN rep_id INTEGER',
  'ALTER TABLE deals ADD COLUMN rep_id INTEGER',
  'ALTER TABLE clients ADD COLUMN rep_id INTEGER',
  'ALTER TABLE clients ADD COLUMN rep_until TEXT',
  'CREATE INDEX IF NOT EXISTS ix_clients_rep ON clients(rep_id)',
  'CREATE INDEX IF NOT EXISTS ix_leads_rep ON leads(rep_id)',
  // v9: مستندات الذكاء (عرض BBR) واعتماد الأسعار، والعقد الذكي، وحقول المنشور الجاهز للجدولة
  'ALTER TABLE quotes ADD COLUMN doc TEXT',
  'ALTER TABLE quotes ADD COLUMN price_review INTEGER DEFAULT 0',
  'ALTER TABLE quotes ADD COLUMN approved_by INTEGER',
  'ALTER TABLE quotes ADD COLUMN approved_at TEXT',
  'ALTER TABLE quotes ADD COLUMN ai_engine TEXT',
  'ALTER TABLE contracts ADD COLUMN doc TEXT',
  // v20: التوقيع الإلكتروني للعقد من رابط المتابعة — JSON {name, title, at, ip, ua, code, sig (PNG data URL)}
  'ALTER TABLE contracts ADD COLUMN esign TEXT',
  // v21: دعوة المقابلة الشخصية للمتقدم وتأكيده لها من رابط موقّع (hiring.js)
  'ALTER TABLE applications ADD COLUMN interview_at TEXT',
  "ALTER TABLE applications ADD COLUMN interview_mode TEXT DEFAULT 'حضوري'",
  'ALTER TABLE applications ADD COLUMN interview_status TEXT',
  'ALTER TABLE applications ADD COLUMN interview_note TEXT',
  'ALTER TABLE applications ADD COLUMN interview_sent_at TEXT',
  'ALTER TABLE applications ADD COLUMN interview_replied_at TEXT',
  // v22: رسالة الاعتذار اللطيف (نحتفظ ببياناتك لاحتياج مستقبلي) — متى أُرسلت
  'ALTER TABLE applications ADD COLUMN regret_sent_at TEXT',
  // v23: جدولة المقابلة المؤكدة — حدث Google Calendar (+Meet للفيديو) ومهمة متابعة
  'ALTER TABLE applications ADD COLUMN gcal_id TEXT',
  'ALTER TABLE applications ADD COLUMN meet_link TEXT',
  'ALTER TABLE applications ADD COLUMN followup_task_id INTEGER',
  // v24: تذكير صباح يوم المقابلة لمن لم يؤكد (hiringTick في /wa/health)
  'ALTER TABLE applications ADD COLUMN interview_reminded_at TEXT',
  'ALTER TABLE content ADD COLUMN publish_time TEXT',
  'ALTER TABLE content ADD COLUMN hashtags TEXT',
  'ALTER TABLE content ADD COLUMN cta TEXT',
  'ALTER TABLE content ADD COLUMN brief TEXT',
  'ALTER TABLE content ADD COLUMN plan_id INTEGER',
  "ALTER TABLE content ADD COLUMN source TEXT DEFAULT 'المنصة'",
  // v11: السندات على المقبوضات والمصروفات + حساب الإيراد في الفاتورة
  'ALTER TABLE payments ADD COLUMN number TEXT', 'ALTER TABLE payments ADD COLUMN cash_account INTEGER', 'ALTER TABLE payments ADD COLUMN account_id INTEGER',
  'ALTER TABLE payments ADD COLUMN description TEXT', "ALTER TABLE payments ADD COLUMN status TEXT DEFAULT 'مرحّل'",
  'ALTER TABLE expenses ADD COLUMN number TEXT', 'ALTER TABLE expenses ADD COLUMN cash_account INTEGER', 'ALTER TABLE expenses ADD COLUMN account_id INTEGER',
  "ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'مرحّل'", 'ALTER TABLE invoices ADD COLUMN revenue_account INTEGER',
  'CREATE TRIGGER IF NOT EXISTS tg_payroll_org_ins AFTER INSERT ON payroll WHEN NEW.employee_id IS NOT NULL BEGIN UPDATE payroll SET org = COALESCE((SELECT org FROM employees WHERE id = NEW.employee_id), org) WHERE id = NEW.id; END',
  'CREATE TRIGGER IF NOT EXISTS tg_advances_org_ins AFTER INSERT ON advances WHEN NEW.employee_id IS NOT NULL BEGIN UPDATE advances SET org = COALESCE((SELECT org FROM employees WHERE id = NEW.employee_id), org) WHERE id = NEW.id; END',
  // v15: صلاحيات الأقسام لكل مستخدم (NULL = كل الأقسام) — انظر _lib/sections.js
  'ALTER TABLE users ADD COLUMN sections TEXT',
  // v16: أول وظيفة معلنة (من نموذج Google للمصممة — 20 أكتوبر 2026) تُزرع مرة واحدة إن لم توجد وظائف
  `INSERT INTO jobs (slug, title, summary, details, location, modes, skills, tools, extra_q, status, sort)
    SELECT 'designer', 'مصممة جرافيك ومونتاج ومحتوى',
    'نبحث عن مصممة تجمع التصميم والمونتاج وكتابة المحتوى العربي، لتنضم إلى فريق يعمل لعلامات حقيقية من الفكرة إلى المطبوع.',
    'نُبل وابتكار للخدمات التسويقية — الذراع التسويقية لمؤسسة نُبل وابتكار للأعمال التجارية في جدة. التقديم يستغرق خمس دقائق، ومعرض الأعمال هو أهم ما ننظر إليه.',
    'جدة — حي الحمدانية', '["حضوري في جدة","عن بُعد","مرن"]',
    '["تصميم منشورات التواصل","مونتاج الفيديو والريلز","كتابة المحتوى العربي","تصميم المطبوعات","الموشن جرافيك","الهويات البصرية"]',
    '["Photoshop","Illustrator","InDesign","Premiere Pro","After Effects","CapCut","Figma","Canva"]',
    'أفضل عمل صممتِه ولماذا؟ (سطران)', 'مفتوحة', 10
    WHERE NOT EXISTS (SELECT 1 FROM jobs)`,
  // v17: وظيفة المصممة حضورية فقط في جدة (قرار إياد 20 أكتوبر 2026) — لا عن بُعد ولا مرن
  `UPDATE jobs SET modes = '["حضوري في جدة"]', updated_at = datetime('now') WHERE slug = 'designer' AND modes LIKE '%عن بُعد%'`,
  // v10: الجهة (نُبل وابتكار = القطاع الربحي · مروج الحجاز = القطاع غير الربحي) + وراثتها آلياً من العميل/العميل المحتمل
  ...ORG_MIGRATIONS(),
];

function ORG_MIGRATIONS() {
  const out = [];
  for (const t of ORG_ENTITIES) {
    out.push(`ALTER TABLE ${t} ADD COLUMN org TEXT DEFAULT 'nubl'`);
    out.push(`CREATE INDEX IF NOT EXISTS ix_${t}_org ON ${t}(org)`);
  }
  // مصادر الوراثة لكل جدول بالترتيب: أول أب موجود يحدد الجهة
  const PARENTS = {
    clients: [['leads', 'lead_id']],
    deals: [['clients', 'client_id'], ['leads', 'lead_id']],
    activities: [['clients', 'client_id'], ['leads', 'lead_id'], ['deals', 'deal_id']],
    visits: [['clients', 'client_id'], ['leads', 'lead_id']],
    quotes: [['clients', 'client_id'], ['leads', 'lead_id'], ['deals', 'deal_id']],
    contracts: [['clients', 'client_id']], invoices: [['clients', 'client_id']],
    payments: [['clients', 'client_id'], ['invoices', 'invoice_id']], expenses: [['clients', 'client_id']],
    projects: [['clients', 'client_id']], tasks: [['clients', 'client_id'], ['projects', 'project_id']],
    content: [['clients', 'client_id']], plans: [['clients', 'client_id']], campaigns: [['clients', 'client_id']],
  };
  for (const [t, ps] of Object.entries(PARENTS)) {
    const expr = `COALESCE(${ps.map(([pt, c]) => `(SELECT org FROM ${pt} WHERE id = NEW.${c})`).join(', ')}, org)`;
    const when = ps.map(([, c]) => `NEW.${c} IS NOT NULL`).join(' OR ');
    out.push(`CREATE TRIGGER IF NOT EXISTS tg_${t}_org_ins AFTER INSERT ON ${t} WHEN ${when} BEGIN UPDATE ${t} SET org = ${expr} WHERE id = NEW.id; END`);
    out.push(`CREATE TRIGGER IF NOT EXISTS tg_${t}_org_upd AFTER UPDATE OF ${ps.map(([, c]) => c).join(', ')} ON ${t} WHEN ${when} BEGIN UPDATE ${t} SET org = ${expr} WHERE id = NEW.id; END`);
  }
  // نقل عميل بين الجهتين ينقل كل ما يخصه
  const kids = ['deals', 'activities', 'visits', 'quotes', 'contracts', 'invoices', 'payments', 'expenses', 'projects', 'tasks', 'content', 'plans', 'campaigns'];
  out.push('DROP TRIGGER IF EXISTS tg_clients_org_move'); // يُعاد إنشاؤه كلما زادت قائمة التوابع
  out.push(`CREATE TRIGGER IF NOT EXISTS tg_clients_org_move AFTER UPDATE OF org ON clients WHEN NEW.org IS NOT OLD.org BEGIN ${kids.map((k) => `UPDATE ${k} SET org = NEW.org WHERE client_id = NEW.id;`).join(' ')} END`);
  return out;
}

// إعدادات سرية لا تُرسل للواجهة أبداً
export const SECRET_SETTINGS = ['tg_token', 'tg_secret', 'tg_cron_key', 'wa_bridge_token', 'hook_token', 'xq_secret', 'track_secret', 'vapid_private', 'google_refresh', 'google_state'];

// الأدوار
export const ROLES = {
  admin: 'المدير العام',
  manager: 'مدير الخدمات التسويقية',
  sales: 'مبيعات / مندوب',
  account: 'إدارة الحسابات والسوشيال',
  designer: 'تصميم ومونتاج',
  finance: 'المالية',
  executive: 'الإدارة التنفيذية (اطلاع)',
};

// الصلاحيات لكل كيان: r = قراءة، w = إنشاء/تعديل، d = حذف، own = يرى ما يخصه فقط (حقل الملكية)
// ما لم يُذكر الدور فلا وصول.
const ALL = { admin: 'rwd', manager: 'rwd', executive: 'r' };
export const ENTITIES = {
  leads: {
    cols: ['name', 'company', 'phone', 'email', 'city', 'sector', 'segment', 'source', 'status', 'score', 'owner_id', 'next_followup', 'interest', 'notes', 'client_id', 'rep_id'],
    search: ['name', 'company', 'phone', 'email', 'city', 'notes'],
    perms: { ...ALL, sales: 'rw', account: 'rw', finance: 'r' }, own: { sales: 'owner_id' }, ownOrNull: true, order: 'id DESC',
  },
  deals: {
    cols: ['title', 'lead_id', 'client_id', 'stage', 'value', 'probability', 'expected_close', 'owner_id', 'sector', 'package', 'loss_reason', 'notes', 'closed_at', 'rep_id'],
    search: ['title', 'notes', 'package'],
    perms: { ...ALL, sales: 'rw', account: 'r', finance: 'r' }, own: { sales: 'owner_id' }, order: 'id DESC',
  },
  activities: {
    cols: ['kind', 'lead_id', 'deal_id', 'client_id', 'subject', 'outcome', 'notes', 'at', 'user_id', 'next_step', 'next_date'],
    search: ['subject', 'notes', 'outcome'],
    perms: { ...ALL, sales: 'rw', account: 'rw', finance: 'rw', executive: 'rw', designer: 'r' }, own: { sales: 'user_id', designer: 'user_id' }, order: 'at DESC, id DESC',
  },
  visits: {
    cols: ['place_name', 'lead_id', 'client_id', 'city', 'lat', 'lng', 'accuracy', 'photo_id', 'outcome', 'interest', 'notes', 'user_id', 'at'],
    search: ['place_name', 'city', 'notes'],
    perms: { ...ALL, sales: 'rw', account: 'r' }, own: { sales: 'user_id' }, order: 'at DESC, id DESC',
  },
  clients: {
    cols: ['name', 'brand', 'sector', 'contact_name', 'phone', 'email', 'city', 'cr_number', 'vat_number', 'national_address', 'status',
      'account_manager_id', 'package', 'start_date', 'renewal_date', 'health', 'report_day', 'socials', 'drive_link', 'notes', 'lead_id', 'rep_id', 'rep_until'],
    search: ['name', 'brand', 'contact_name', 'phone', 'email', 'city'],
    perms: { ...ALL, sales: 'r', account: 'rw', designer: 'r', finance: 'rw' }, order: 'name',
  },
  catalog: {
    cols: ['kind', 'sector', 'code', 'name', 'months', 'monthly', 'price', 'unit', 'plan', 'delivery', 'details', 'active'],
    search: ['name', 'code', 'sector'],
    perms: { ...ALL, sales: 'r', account: 'r', finance: 'rw' }, order: 'kind, sector, months, id',
  },
  quotes: {
    cols: ['number', 'client_id', 'lead_id', 'deal_id', 'title', 'items', 'subtotal', 'discount', 'vat', 'total', 'valid_until', 'status', 'plan', 'months', 'notes', 'terms'],
    search: ['number', 'title', 'notes'],
    perms: { ...ALL, sales: 'rw', account: 'r', finance: 'rw' }, own: { sales: 'created_by' }, order: 'id DESC',
  },
  contracts: {
    cols: ['number', 'client_id', 'quote_id', 'title', 'package', 'start_date', 'end_date', 'months', 'monthly_value', 'total_value', 'plan',
      'auto_renew', 'notice_days', 'status', 'signed_at', 'file_link', 'owner_id', 'notes'],
    search: ['number', 'title', 'package', 'notes'],
    perms: { ...ALL, sales: 'r', account: 'r', finance: 'rwd' }, own: { sales: 'owner_id' }, order: 'id DESC',
  },
  invoices: {
    cols: ['number', 'client_id', 'contract_id', 'issue_date', 'due_date', 'description', 'subtotal', 'vat', 'total', 'paid', 'status', 'tax_ref', 'notes', 'revenue_account'],
    search: ['number', 'description', 'tax_ref'],
    perms: { ...ALL, finance: 'rwd' }, order: 'due_date DESC, id DESC',
  },
  payments: {
    cols: ['invoice_id', 'client_id', 'amount', 'method', 'ref', 'paid_at', 'notes', 'user_id', 'number', 'cash_account', 'account_id', 'description', 'status'],
    search: ['ref', 'notes'],
    perms: { ...ALL, finance: 'rwd' }, order: 'paid_at DESC, id DESC',
  },
  expenses: {
    cols: ['category', 'vendor', 'amount', 'vat', 'date', 'client_id', 'notes', 'receipt_link', 'user_id', 'number', 'cash_account', 'account_id', 'status'],
    search: ['category', 'vendor', 'notes'],
    perms: { ...ALL, finance: 'rwd' }, order: 'date DESC, id DESC',
  },
  projects: {
    cols: ['name', 'client_id', 'contract_id', 'type', 'status', 'start_date', 'due_date', 'owner_id', 'notes'],
    search: ['name', 'notes', 'type'],
    perms: { ...ALL, account: 'rw', designer: 'r', sales: 'r', finance: 'r' }, order: 'id DESC',
  },
  tasks: {
    cols: ['title', 'project_id', 'client_id', 'assignee_id', 'status', 'priority', 'due_date', 'revisions', 'est_hours', 'spent_hours', 'description', 'link', 'done_at',
      'template_id', 'checklist', 'data', 'source'],
    search: ['title', 'description'],
    perms: { ...ALL, account: 'rw', designer: 'rw', sales: 'rw', finance: 'rw' },
    own: { designer: 'assignee_id', sales: 'assignee_id', finance: 'assignee_id' }, ownAlsoCreator: true, order: 'due_date IS NULL, due_date, id DESC',
  },
  content: {
    cols: ['client_id', 'publish_date', 'publish_time', 'platform', 'format', 'pillar', 'title', 'caption', 'hashtags', 'cta', 'brief', 'status', 'assignee_id', 'designer_id', 'revisions', 'asset_link', 'notes', 'plan_id', 'source'],
    search: ['title', 'caption', 'pillar'],
    perms: { ...ALL, account: 'rw', designer: 'rw' }, order: 'publish_date, id',
  },
  seasons: {
    cols: ['name', 'date', 'sectors', 'notes', 'plan_days', 'print_days'],
    search: ['name', 'notes'],
    perms: { ...ALL, sales: 'r', account: 'rw', designer: 'r', finance: 'r' }, order: 'date',
  },
  templates: {
    cols: ['code', 'name', 'category', 'kind', 'emoji', 'description', 'role', 'default_assignee_id', 'priority', 'due_days', 'est_hours',
      'title_tpl', 'fields', 'checklist', 'roles', 'active', 'sort'],
    search: ['name', 'code', 'category', 'description'],
    perms: { ...ALL, sales: 'r', account: 'r', designer: 'r', finance: 'r' }, order: 'active DESC, sort, category, id',
  },
  articles: {
    cols: ['category', 'title', 'body'],
    search: ['title', 'body', 'category'],
    perms: { ...ALL, sales: 'r', account: 'rw', designer: 'r', finance: 'r' }, order: 'category, title',
  },
  plans: {
    cols: ['client_id', 'title', 'start_date', 'months', 'goals', 'budget', 'status', 'notes'],
    search: ['title', 'goals', 'notes'],
    perms: { ...ALL, account: 'rw', sales: 'r', designer: 'r', finance: 'r' }, order: 'id DESC',
  },
  reps: {
    cols: ['name', 'phone', 'email', 'city', 'rate', 'months', 'base', 'bank_name', 'iban', 'status', 'notes'],
    search: ['name', 'phone', 'email', 'city'],
    perms: { ...ALL, finance: 'rw', sales: 'r', account: 'r' }, order: "status = 'نشط' DESC, name",
  },
  // ---- التسويق: الحملات الإعلانية (v12) ----
  campaigns: {
    cols: ['name', 'platform', 'client_id', 'objective', 'status', 'start_date', 'end_date', 'budget', 'spend', 'impressions', 'clicks', 'leads', 'conversions', 'revenue', 'owner_id', 'notes'],
    search: ['name', 'platform', 'notes'],
    perms: { ...ALL, account: 'rw', sales: 'r', finance: 'r' }, order: "status = 'نشطة' DESC, start_date DESC, id DESC",
  },
  // ---- المحاسبة والموارد البشرية (v11) — لكل جهة حساباتها وموظفوها ----
  accounts: {
    cols: ['code', 'name', 'type', 'parent_id', 'is_group', 'active', 'notes', 'org'],
    search: ['code', 'name'], perms: { ...ALL, finance: 'rwd' }, order: 'code',
  },
  journals: {
    cols: ['number', 'date', 'description', 'status', 'ref', 'lines', 'total', 'org'],
    search: ['number', 'description', 'ref'], perms: { ...ALL, manager: 'r', finance: 'rwd' }, order: 'date DESC, id DESC',
  },
  employees: {
    cols: ['name', 'job_title', 'phone', 'email', 'start_date', 'status', 'basic_salary', 'housing', 'transport', 'other_allow', 'fixed_deduct', 'bank_name', 'iban', 'user_id', 'notes', 'org'],
    search: ['name', 'job_title', 'phone', 'email'], perms: { admin: 'rwd', finance: 'rwd', manager: 'r', executive: 'r' }, order: "status = 'على رأس العمل' DESC, name",
  },
  payroll: {
    cols: ['number', 'month', 'employee_id', 'basic', 'allowances', 'bonus', 'deductions', 'advance_deduct', 'net', 'status', 'paid_date', 'cash_account', 'notes', 'org'],
    search: ['number', 'month', 'notes'], perms: { admin: 'rwd', finance: 'rwd', manager: 'r', executive: 'r' }, order: 'month DESC, id DESC',
  },
  advances: {
    cols: ['number', 'date', 'employee_id', 'amount', 'installment', 'paid_back', 'reason', 'cash_account', 'status', 'notes', 'org'],
    search: ['number', 'reason'], perms: { admin: 'rwd', finance: 'rwd', manager: 'r', executive: 'r' }, order: 'date DESC, id DESC',
  },
  // ---- التوظيف (v16): الوظائف المعلنة وطلبات التقديم — بلا حذف (تُغلق الوظيفة ويُستبعد الطلب) ----
  jobs: {
    cols: ['slug', 'title', 'summary', 'details', 'location', 'modes', 'skills', 'tools', 'extra_q', 'status', 'sort', 'org'],
    search: ['title', 'summary', 'slug'], perms: { admin: 'rw', manager: 'rw', executive: 'r' }, order: "status = 'مفتوحة' DESC, sort, id DESC",
  },
  applications: {
    cols: ['number', 'job_id', 'job_title', 'name', 'phone', 'email', 'city', 'experience', 'skills', 'tools', 'portfolio', 'cv_link', 'mode', 'salary', 'start_when',
      'answer', 'status', 'rating', 'notes', 'owner_id', 'org'],
    search: ['name', 'phone', 'email', 'city', 'number', 'notes'], perms: { admin: 'rw', manager: 'rw', executive: 'r' }, order: 'id DESC',
  },
  users: {
    cols: ['name', 'email', 'phone', 'role', 'title', 'active', 'commission_rate'],
    search: ['name', 'email', 'phone'],
    perms: { admin: 'rw', manager: 'r', sales: 'r', account: 'r', designer: 'r', finance: 'r', executive: 'r' }, order: 'active DESC, name',
  },
};

for (const t of ORG_ENTITIES) if (!ENTITIES[t].cols.includes('org')) ENTITIES[t].cols.push('org');

// أعمدة تُخفى عن أدوار معيّنة (حماية الأرقام المالية)
export const HIDDEN = {
  designer: ['value', 'monthly_value', 'total_value', 'subtotal', 'vat', 'total', 'paid', 'price', 'monthly', 'commission_rate', 'rate', 'iban', 'bank_name', 'rep_until'],
  sales: ['iban', 'bank_name'],
  manager: ['iban'],
  account: ['iban', 'bank_name'],
};

export const DEFAULT_SETTINGS = {
  // مروج الحجاز (من شهادة السجل التجاري وإثبات العنوان الوطني وخطاب الآيبان — 18 أكتوبر 2026). الرقم الضريبي للمكلّف الرئيس وفروعه.
  morooj_company_name: 'مؤسسة مروج الحجاز للأعمال التجارية',
  morooj_cr_number: '7049022358',
  morooj_vat_number: '302024915400003',
  morooj_address: 'جدة — حي الحمدانية — العنوان الوطني JGAA8066',
  morooj_bank_line: 'البنك الأهلي السعودي — باسم مؤسسة مروج الحجاز للأعمال التجارية — الآيبان SA8710000001400035472300 (سويفت NCBKSAJE)',
  company_name: 'نُبل وابتكار للخدمات التسويقية',
  company_city: 'جدة — حي الحمدانية',
  cr_number: '4030598563',
  vat_number: '302024915400003',
  sales_phone: '0563413040',
  vat_rate: '15',
  quote_validity_days: '15',
  hour_cost: '75',
  commission_rep: '5',
  commission_close: '3',
  renewal_uplift: '10',
  stale_days: '7',
  wa_bridge_url: '',
  lead_notify_roles: 'admin,manager,sales',
  xq_peer_url: 'https://nubl-ebtikar.com/AJAX/xq_bridge.php',
  xq_handler_roles: 'admin,manager',
  // تظهر في عروض الأسعار والعقود المولّدة (من نموذج عرض BBR المعتمد)
  legal_name: 'مؤسسة نبل وابتكار للأعمال التجارية',
  bank_line: 'البنك الأهلي السعودي — باسم مؤسسة نبل وابتكار للأعمال التجارية — الآيبان SA7510000075500002249706 · الرقم الضريبي 302024915400003 · س.ت 4030598563',
  sign_name: 'إياد المغيرة',
  sign_title: 'مدير قطاع التسويق',
  // التقارير الدورية لكل عضو (واتساب + تلجرام) — reports.js
  reports_enabled: '1',
  client_notify: '1', // إشعارات العملاء على واتساب (track.js) — '0' يوقفها مع بقاء تسجيل الأحداث
  // حجز جلسات التشخيص (sessions.js): الأيام 0=الأحد…6=السبت، الساعات بتوقيت الرياض، المدة والفاصل بالدقائق، الإشعار المسبق بالساعات
  book_days: '6,0,1,2,3,4', book_from: '12:00', book_to: '21:00', book_len: '45', book_gap: '15', book_notice_h: '12', book_horizon_d: '14', book_capacity: '1',
  report_times: '08:00,17:00',
};
