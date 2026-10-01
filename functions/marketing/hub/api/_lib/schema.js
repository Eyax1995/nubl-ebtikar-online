// مخطط قاعدة البيانات + تعريف الكيانات والصلاحيات (مصدر الحقيقة للواجهة الخلفية)

export const SCHEMA_VERSION = 1;

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
  `CREATE INDEX IF NOT EXISTS ix_leads_owner ON leads(owner_id)`,
  `CREATE INDEX IF NOT EXISTS ix_leads_phone ON leads(phone)`,
  `CREATE INDEX IF NOT EXISTS ix_deals_stage ON deals(stage)`,
  `CREATE INDEX IF NOT EXISTS ix_act_lead ON activities(lead_id)`,
  `CREATE INDEX IF NOT EXISTS ix_tasks_assignee ON tasks(assignee_id, status)`,
  `CREATE INDEX IF NOT EXISTS ix_content_client ON content(client_id, publish_date)`,
  `CREATE INDEX IF NOT EXISTS ix_inv_client ON invoices(client_id, status)`,
];

// الأدوار
export const ROLES = {
  admin: 'المدير العام',
  manager: 'مدير الخدمات التسويقية',
  sales: 'مبيعات / مندوب',
  account: 'إدارة الحسابات والسوشيال',
  designer: 'تصميم ومونتاج',
  finance: 'المالية',
};

// الصلاحيات لكل كيان: r = قراءة، w = إنشاء/تعديل، d = حذف، own = يرى ما يخصه فقط (حقل الملكية)
// ما لم يُذكر الدور فلا وصول.
const ALL = { admin: 'rwd', manager: 'rwd' };
export const ENTITIES = {
  leads: {
    cols: ['name', 'company', 'phone', 'email', 'city', 'sector', 'segment', 'source', 'status', 'score', 'owner_id', 'next_followup', 'interest', 'notes', 'client_id'],
    search: ['name', 'company', 'phone', 'email', 'city', 'notes'],
    perms: { ...ALL, sales: 'rw', account: 'rw', finance: 'r' }, own: { sales: 'owner_id' }, ownOrNull: true, order: 'id DESC',
  },
  deals: {
    cols: ['title', 'lead_id', 'client_id', 'stage', 'value', 'probability', 'expected_close', 'owner_id', 'sector', 'package', 'loss_reason', 'notes', 'closed_at'],
    search: ['title', 'notes', 'package'],
    perms: { ...ALL, sales: 'rw', account: 'r', finance: 'r' }, own: { sales: 'owner_id' }, order: 'id DESC',
  },
  activities: {
    cols: ['kind', 'lead_id', 'deal_id', 'client_id', 'subject', 'outcome', 'notes', 'at', 'user_id', 'next_step', 'next_date'],
    search: ['subject', 'notes', 'outcome'],
    perms: { ...ALL, sales: 'rw', account: 'rw', finance: 'r', designer: 'r' }, own: { sales: 'user_id', designer: 'user_id' }, order: 'at DESC, id DESC',
  },
  visits: {
    cols: ['place_name', 'lead_id', 'client_id', 'city', 'lat', 'lng', 'accuracy', 'photo_id', 'outcome', 'interest', 'notes', 'user_id', 'at'],
    search: ['place_name', 'city', 'notes'],
    perms: { ...ALL, sales: 'rw', account: 'r' }, own: { sales: 'user_id' }, order: 'at DESC, id DESC',
  },
  clients: {
    cols: ['name', 'brand', 'sector', 'contact_name', 'phone', 'email', 'city', 'cr_number', 'vat_number', 'national_address', 'status',
      'account_manager_id', 'package', 'start_date', 'renewal_date', 'health', 'report_day', 'socials', 'drive_link', 'notes', 'lead_id'],
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
    perms: { ...ALL, sales: 'r', account: 'r', finance: 'rw' }, own: { sales: 'owner_id' }, order: 'id DESC',
  },
  invoices: {
    cols: ['number', 'client_id', 'contract_id', 'issue_date', 'due_date', 'description', 'subtotal', 'vat', 'total', 'paid', 'status', 'tax_ref', 'notes'],
    search: ['number', 'description', 'tax_ref'],
    perms: { ...ALL, finance: 'rwd' }, order: 'due_date DESC, id DESC',
  },
  payments: {
    cols: ['invoice_id', 'client_id', 'amount', 'method', 'ref', 'paid_at', 'notes', 'user_id'],
    search: ['ref', 'notes'],
    perms: { ...ALL, finance: 'rwd' }, order: 'paid_at DESC, id DESC',
  },
  expenses: {
    cols: ['category', 'vendor', 'amount', 'vat', 'date', 'client_id', 'notes', 'receipt_link', 'user_id'],
    search: ['category', 'vendor', 'notes'],
    perms: { ...ALL, finance: 'rwd' }, order: 'date DESC, id DESC',
  },
  projects: {
    cols: ['name', 'client_id', 'contract_id', 'type', 'status', 'start_date', 'due_date', 'owner_id', 'notes'],
    search: ['name', 'notes', 'type'],
    perms: { ...ALL, account: 'rw', designer: 'r', sales: 'r', finance: 'r' }, order: 'id DESC',
  },
  tasks: {
    cols: ['title', 'project_id', 'client_id', 'assignee_id', 'status', 'priority', 'due_date', 'revisions', 'est_hours', 'spent_hours', 'description', 'link', 'done_at'],
    search: ['title', 'description'],
    perms: { ...ALL, account: 'rw', designer: 'rw', sales: 'rw', finance: 'rw' },
    own: { designer: 'assignee_id', sales: 'assignee_id', finance: 'assignee_id' }, ownAlsoCreator: true, order: 'due_date IS NULL, due_date, id DESC',
  },
  content: {
    cols: ['client_id', 'publish_date', 'platform', 'format', 'pillar', 'title', 'caption', 'status', 'assignee_id', 'designer_id', 'revisions', 'asset_link', 'notes'],
    search: ['title', 'caption', 'pillar'],
    perms: { ...ALL, account: 'rw', designer: 'rw' }, order: 'publish_date, id',
  },
  seasons: {
    cols: ['name', 'date', 'sectors', 'notes', 'plan_days', 'print_days'],
    search: ['name', 'notes'],
    perms: { ...ALL, sales: 'r', account: 'rw', designer: 'r', finance: 'r' }, order: 'date',
  },
  articles: {
    cols: ['category', 'title', 'body'],
    search: ['title', 'body', 'category'],
    perms: { ...ALL, sales: 'r', account: 'rw', designer: 'r', finance: 'r' }, order: 'category, title',
  },
  users: {
    cols: ['name', 'email', 'phone', 'role', 'title', 'active', 'commission_rate'],
    search: ['name', 'email', 'phone'],
    perms: { admin: 'rw', manager: 'r', sales: 'r', account: 'r', designer: 'r', finance: 'r' }, order: 'active DESC, name',
  },
};

// أعمدة تُخفى عن أدوار معيّنة (حماية الأرقام المالية)
export const HIDDEN = {
  designer: ['value', 'monthly_value', 'total_value', 'subtotal', 'vat', 'total', 'paid', 'price', 'monthly', 'commission_rate'],
};

export const DEFAULT_SETTINGS = {
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
};
