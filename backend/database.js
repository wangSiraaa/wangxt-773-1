const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data.db');
let db = null;

function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('保存数据库失败:', e);
  }
}

function rowsToObjects(columns, rows) {
  if (!rows || rows.length === 0) return [];
  return rows.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function query(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const cleanParams = params.map(p => p === undefined ? null : p);
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams);
  const columns = stmt.getColumnNames();
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.get());
  }
  stmt.free();
  return rowsToObjects(columns, rows);
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

function execute(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  try {
    const cleanParams = params.map(p => p === undefined ? null : p);
    const stmt = db.prepare(sql);
    stmt.run(cleanParams);
    stmt.free();
    saveDatabase();
  } catch (e) {
    console.error('SQL执行错误:', sql);
    console.error('参数:', params);
    console.error('错误详情:', e);
    throw e;
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  let dbData = null;
  if (fs.existsSync(dbPath)) {
    try {
      dbData = fs.readFileSync(dbPath);
    } catch (e) {
      console.warn('读取现有数据库失败，将创建新数据库');
    }
  }
  
  db = new SQL.Database(dbData);

  try {
    db.run('PRAGMA journal_mode = WAL');
  } catch (e) {}
  try {
    db.run('PRAGMA foreign_keys = ON');
  } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('resident', 'evaluator', 'handler', 'legal')),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY,
      house_code TEXT UNIQUE NOT NULL,
      owner_name TEXT NOT NULL,
      id_card TEXT NOT NULL,
      address TEXT NOT NULL,
      area REAL NOT NULL,
      structure_type TEXT,
      build_year INTEGER,
      phone TEXT NOT NULL,
      auxiliaries TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'scheme_draft', 'scheme_confirmed', 'objection', 'contracting', 'signed', 'archived')),
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      base_price REAL NOT NULL,
      structure_price REAL DEFAULT 0,
      decoration_price REAL DEFAULT 0,
      auxiliary_price REAL DEFAULT 0,
      other_price REAL DEFAULT 0,
      total_price REAL NOT NULL,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'rejected')),
      confirmed_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (house_id) REFERENCES houses(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(house_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      evaluation_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      compensation_type TEXT NOT NULL CHECK (compensation_type IN ('money', 'house', 'mixed')),
      money_amount REAL DEFAULT 0,
      house_area REAL DEFAULT 0,
      house_location TEXT,
      transition_fee REAL DEFAULT 0,
      move_fee REAL DEFAULT 0,
      reward_amount REAL DEFAULT 0,
      other_items TEXT,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'rejected', 'modified')),
      remark TEXT,
      confirmed_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (house_id) REFERENCES houses(id),
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(house_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS objections (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('evaluation', 'scheme', 'other')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')),
      handler_remark TEXT,
      freeze_contract INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (house_id) REFERENCES houses(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      contract_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'main' CHECK (type IN ('main', 'supplementary')),
      parent_contract_id TEXT,
      sign_date DATETIME,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'signed', 'frozen', 'archived')),
      signed_by TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (house_id) REFERENCES houses(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id),
      FOREIGN KEY (signed_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      house_id TEXT,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS archives (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      evaluation_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      archive_no TEXT UNIQUE NOT NULL,
      archive_type TEXT NOT NULL DEFAULT 'normal' CHECK (archive_type IN ('normal', 'batch')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'archived', 'cancelled')),
      evaluation_consistent INTEGER DEFAULT 1,
      remark TEXT,
      archived_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (house_id) REFERENCES houses(id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const users = [
      { id: 'u1', username: 'resident1', password: bcrypt.hashSync('123456', salt), role: 'resident', name: '张三' },
      { id: 'u2', username: 'evaluator1', password: bcrypt.hashSync('123456', salt), role: 'evaluator', name: '李评估' },
      { id: 'u3', username: 'handler1', password: bcrypt.hashSync('123456', salt), role: 'handler', name: '王经办' },
      { id: 'u4', username: 'legal1', password: bcrypt.hashSync('123456', salt), role: 'legal', name: '赵法务' },
    ];
    users.forEach(u => {
      execute(
        'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)',
        [u.id, u.username, u.password, u.role, u.name]
      );
    });
  }

  saveDatabase();
  console.log('数据库初始化完成');
}

module.exports = {
  initDatabase,
  query,
  queryOne,
  execute,
  saveDatabase
};
