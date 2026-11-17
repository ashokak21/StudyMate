// StudyMate server - uses only Node.js built-in modules (no npm install needed).
// Run:  node server.js   then open http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
const RE = /^RA2511\d{9}$/i, MAX_FILE = 25e6;
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'];
const TYPES = ['Lecture Notes', 'Assignment', 'Reference', 'Question Paper', 'Video'];
fs.mkdirSync(path.join(DATA, 'files'), { recursive: true });
const DB_FILE = path.join(DATA, 'db.json');

// ===== DATABASE (a JSON file on the server's disk) =====
const today = () => new Date().toISOString().slice(0, 10);
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const makeUser = (o, pw) => {
  const salt = crypto.randomBytes(8).toString('hex');
  return { saved: [], joined: today(), ...o, salt, pw: hash(pw, salt) };
};
function seed() {
  return {
    nid: 10, sessions: {},
    subjects: ['Database Management', 'Operating Systems', 'Data Structures'],
    users: [
      makeUser({ id: 1, name: 'System Admin', username: 'admin', role: 'admin', email: 'admin@college.edu' }, 'admin123'),
      makeUser({ id: 2, name: 'Dr. Meena Kumar', username: 'meena', role: 'faculty', email: 'meena@college.edu', dept: 'Computer Science' }, 'faculty123'),
      makeUser({ id: 3, name: 'Prof. Ravi S.', username: 'ravi', role: 'faculty', email: 'ravi@college.edu', dept: 'Computer Science' }, 'faculty123'),
      makeUser({ id: 4, name: 'Arun Kumar', username: 'ra2511000000001', role: 'student', email: 'arun@college.edu', dept: 'Computer Science', saved: [1] }, 'student123'),
      makeUser({ id: 5, name: 'Divya R.', username: 'ra2511000000002', role: 'student', email: 'divya@college.edu', dept: 'Information Technology' }, 'student123')],
    mats: [
      { id: 1, title: 'Chapter 1 – Introduction to DBMS', desc: 'ER model, keys and relational basics.', subject: 'Database Management', unit: 'Unit 1', type: 'Lecture Notes', uid: 2, by: 'Dr. Meena Kumar', date: '2026-09-02', file: 'dbms-ch1.pdf', dl: 42 },
      { id: 2, title: 'SQL Basics Cheat Sheet', desc: 'Quick reference for SELECT, JOIN, GROUP BY.', subject: 'Database Management', unit: 'Unit 2', type: 'Reference', uid: 2, by: 'Dr. Meena Kumar', date: '2026-09-10', file: 'sql-basics.pdf', dl: 67 },
      { id: 3, title: 'Process Scheduling Slides', desc: 'FCFS, SJF, Round Robin with examples.', subject: 'Operating Systems', unit: 'Unit 2', type: 'Lecture Notes', uid: 3, by: 'Prof. Ravi S.', date: '2026-09-15', file: 'scheduling.pptx', dl: 31 },
      { id: 4, title: 'Assignment 1 – Linked Lists', desc: 'Implement singly and doubly linked lists.', subject: 'Data Structures', unit: 'Unit 1', type: 'Assignment', uid: 3, by: 'Prof. Ravi S.', date: '2026-09-20', file: 'll-assign.pdf', dl: 18 }],
    anns: [{ id: 1, text: 'Internal test 1 begins next Monday. Revise Units 1–2.', uid: 2, by: 'Dr. Meena Kumar', date: '2026-10-05' }]
  };
}
let db;
function commit() { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); }
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = seed(); commit(); }
const fileOf = id => path.join(DATA, 'files', String(id));

// ===== HELPERS =====
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const safe = u => { const { pw, salt, ...rest } = u; return rest; };
function readBody(req, max) {
  return new Promise((ok, no) => {
    const chunks = []; let n = 0;
    req.on('data', d => { n += d.length; if (n <= max) chunks.push(d); });
    req.on('end', () => n > max ? no(fail(413, 'File or request too large')) : ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
}
const readJson = async req => { const b = await readBody(req, 4e5); try { return b.length ? JSON.parse(b) : {}; } catch (e) { throw fail(400, 'Bad request'); } };
const IDLE_MS = (+process.env.IDLE_MINUTES || 30) * 60 * 1000;   // auto logout after 30 minutes of inactivity
function auth(req) {   // finds the logged-in user from the token
  const t = (req.headers.authorization || '').slice(7), s = db.sessions[t], id = s && (s.id ?? s);
  if (s && s.at && Date.now() - s.at > IDLE_MS) { delete db.sessions[t]; commit(); throw fail(401, 'You were logged out after 30 minutes of inactivity.'); }
  const u = id && db.users.find(x => x.id === id);
  if (!u) throw fail(401, 'Please log in again.');
  if (typeof s === 'object') s.at = Date.now();
  return u;
}
const need = (u, ...roles) => { if (!roles.includes(u.role)) throw fail(403, 'You are not allowed to do this.'); };
const clean = (s, n) => String(s ?? '').trim().slice(0, n);
const emailOk = e => /^\S+@\S+\.\S+$/.test(e);
const tries = {};   // login attempts per username (lock 30s after 5 failures)

function matFields(o) {
  const m = { title: clean(o.title, 150), desc: clean(o.desc, 300), subject: o.subject, unit: o.unit, type: o.type };
  if (!m.title) throw fail(400, 'Title cannot be empty.');
  if (!db.subjects.includes(m.subject) || !UNITS.includes(m.unit) || !TYPES.includes(m.type)) throw fail(400, 'Invalid subject, unit or type.');
  return m;
}
const fname = q => path.basename(clean(q || 'file', 120)) || 'file';
function canEdit(u, m) { if (!m) throw fail(404, 'Material not found.'); if (u.role !== 'admin' && m.uid !== u.id) throw fail(403, 'You can only change your own materials.'); }
function addUser(o, role, pw) {
  const username = clean(o.username, 30).toLowerCase();
  if (!clean(o.name, 80) || !emailOk(clean(o.email, 80)) || !username) throw fail(400, 'Fill all fields with valid details.');
  if (String(pw || '').length < 6) throw fail(400, 'Password must be at least 6 characters.');
  if (role === 'student' && !RE.test(username)) throw fail(400, 'Student ID must be RA2511 followed by 9 digits.');
  if (db.users.some(x => x.username === username)) throw fail(400, 'This ID is already registered.');
  if (db.users.some(x => (x.email || '').toLowerCase() === clean(o.email, 80).toLowerCase())) throw fail(400, 'This email is already registered.');
  db.users.push(makeUser({ id: db.nid++, name: clean(o.name, 80), email: clean(o.email, 80), username, role, dept: o.dept }, pw));
}

// ===== API ROUTES =====
async function api(req, res, url) {
  const m = req.method, p = url.pathname.slice(4), q = url.searchParams;
  if (m === 'POST' && p === '/login') {                         // LOGIN
    const b = await readJson(req), k = clean(b.username, 40).toLowerCase(), t = tries[k];
    if (t && t.until > Date.now()) throw fail(429, 'Too many attempts. Wait ' + Math.ceil((t.until - Date.now()) / 1000) + 's.');
    const u = db.users.find(x => x.username === k || (x.email || '').toLowerCase() === k);   // login by e-mail, register number or username
    const ok = u && crypto.timingSafeEqual(Buffer.from(hash(String(b.password || ''), u.salt)), Buffer.from(u.pw));
    if (!ok) { const r = tries[k] = tries[k] || { n: 0 }; if (++r.n >= 5) { r.until = Date.now() + 30000; r.n = 0; } throw fail(401, 'Invalid ID or password.'); }
    delete tries[k];
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = { id: u.id, at: Date.now() }; u.prev = u.last; u.last = new Date().toLocaleString(); commit();
    return send(res, 200, { token });
  }
  if (m === 'POST' && p === '/register') {                      // STUDENT REGISTRATION
    const b = await readJson(req);
    addUser({ name: b.name, email: b.email, username: String(b.regno || '').toLowerCase(), dept: b.dept }, 'student', b.password);
    commit(); return send(res, 200, { ok: true });
  }
  const u = auth(req);                                          // everything below needs a login
  let mm;
  if (m === 'POST' && p === '/logout') { delete db.sessions[(req.headers.authorization || '').slice(7)]; commit(); return send(res, 200, { ok: true }); }
  if (m === 'GET' && p === '/state') return send(res, 200, { me: safe(u), users: u.role === 'admin' ? db.users.map(safe) : [], subjects: db.subjects, mats: db.mats, anns: db.anns });

  if (m === 'POST' && p === '/mats') {                          // UPLOAD (faculty / admin)
    need(u, 'faculty', 'admin');
    const f = matFields(Object.fromEntries(q)), data = await readBody(req, MAX_FILE);
    if (!data.length) throw fail(400, 'Choose a file.');
    const id = db.nid++; fs.writeFileSync(fileOf(id), data);
    db.mats.push({ id, ...f, uid: u.id, by: u.name, date: today(), file: fname(q.get('filename')), dl: 0 }); commit();
    return send(res, 200, { id });
  }
  if ((mm = p.match(/^\/mats\/(\d+)(\/file)?$/))) {
    const id = +mm[1], mat = db.mats.find(x => x.id === id);
    if (m === 'GET' && mm[2]) {                                 // DOWNLOAD
      if (!mat) throw fail(404, 'Material not found.');
      mat.dl++; if (u.role === 'student') u.dls = (u.dls || 0) + 1; commit();
      const real = fs.existsSync(fileOf(id)), name = real ? mat.file : mat.file + '.txt';
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(name), 'Access-Control-Expose-Headers': 'X-Filename' });
      return res.end(real ? fs.readFileSync(fileOf(id)) : 'Demo placeholder for "' + mat.title + '" (' + mat.subject + ', ' + mat.unit + ').');
    }
    if (m === 'PUT' && !mm[2]) { canEdit(u, mat); Object.assign(mat, matFields(await readJson(req))); commit(); return send(res, 200, { ok: true }); }   // EDIT
    if (m === 'POST' && mm[2]) { canEdit(u, mat); const d = await readBody(req, MAX_FILE); if (!d.length) throw fail(400, 'Choose a file.'); fs.writeFileSync(fileOf(id), d); mat.file = fname(q.get('filename')); commit(); return send(res, 200, { ok: true }); }   // REPLACE FILE
    if (m === 'DELETE' && !mm[2]) { canEdit(u, mat); db.mats = db.mats.filter(x => x.id !== id); fs.rmSync(fileOf(id), { force: true }); commit(); return send(res, 200, { ok: true }); }   // DELETE
  }
  if (m === 'POST' && (mm = p.match(/^\/save\/(\d+)$/))) {      // STUDENT SAVE / UNSAVE
    const id = +mm[1]; u.saved = u.saved || [];
    u.saved = u.saved.includes(id) ? u.saved.filter(x => x !== id) : [...u.saved, id]; commit(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/anns') {                          // ANNOUNCEMENTS
    need(u, 'faculty', 'admin'); const t = clean((await readJson(req)).text, 500);
    if (!t) throw fail(400, 'Write something first.');
    db.anns.push({ id: db.nid++, text: t, uid: u.id, by: u.name, date: today() }); commit(); return send(res, 200, { ok: true });
  }
  if (m === 'DELETE' && (mm = p.match(/^\/anns\/(\d+)$/))) {
    const a = db.anns.find(x => x.id === +mm[1]); if (!a) throw fail(404, 'Not found.');
    if (u.role !== 'admin' && a.uid !== u.id) throw fail(403, 'You can only remove your own announcements.');
    db.anns = db.anns.filter(x => x !== a); commit(); return send(res, 200, { ok: true });
  }
  if (m === 'PUT' && p === '/me') {                             // PROFILE
    const b = await readJson(req), name = clean(b.name, 80), email = clean(b.email, 80), phone = clean(b.phone, 10);
    if (b.name !== undefined) {
      if (!name) throw fail(400, 'Name cannot be empty.'); if (!emailOk(email)) throw fail(400, 'Enter a valid email address.');
      if (db.users.some(x => x.id !== u.id && (x.email || '').toLowerCase() === email.toLowerCase())) throw fail(400, 'This email is already in use.');
      if (phone && !/^\d{10}$/.test(phone)) throw fail(400, 'Phone must be 10 digits.');
      Object.assign(u, { name, email, phone, bio: clean(b.bio, 160) });
      for (const k of ['dept', 'year', 'desig']) if (b[k]) u[k] = clean(b[k], 40);
      db.mats.forEach(x => { if (x.uid === u.id) x.by = name; }); db.anns.forEach(x => { if (x.uid === u.id) x.by = name; });
    }
    if (b.photo === null) delete u.photo; else if (typeof b.photo === 'string' && b.photo.startsWith('data:image/') && b.photo.length < 3e5) u.photo = b.photo;
    commit(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/me/password') {
    const b = await readJson(req);
    if (hash(String(b.current || ''), u.salt) !== u.pw) throw fail(400, 'Current password is incorrect.');
    if (String(b.next || '').length < 6) throw fail(400, 'Min 6 characters.');
    u.salt = crypto.randomBytes(8).toString('hex'); u.pw = hash(b.next, u.salt); commit(); return send(res, 200, { ok: true });
  }

  need(u, 'admin');                                             // ===== ADMIN ONLY BELOW =====
  if (m === 'POST' && p === '/subjects') { const n = clean((await readJson(req)).name, 80); if (n && !db.subjects.includes(n)) { db.subjects.push(n); commit(); } return send(res, 200, { ok: true }); }
  if (m === 'POST' && p === '/subjects/delete') {
    const n = (await readJson(req)).name; db.subjects = db.subjects.filter(s => s !== n);
    db.mats.filter(x => x.subject === n).forEach(x => fs.rmSync(fileOf(x.id), { force: true })); db.mats = db.mats.filter(x => x.subject !== n); commit(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/users') { const b = await readJson(req); if (!['faculty', 'student', 'admin'].includes(b.role)) throw fail(400, 'Invalid role.'); addUser(b, b.role, b.password); commit(); return send(res, 200, { ok: true }); }
  if ((mm = p.match(/^\/users\/(\d+)(\/reset)?$/))) {
    const t = db.users.find(x => x.id === +mm[1]); if (!t) throw fail(404, 'User not found.');
    if (m === 'POST' && mm[2]) { const pw = String((await readJson(req)).password || ''); if (pw.length < 6) throw fail(400, 'Min 6 characters.'); t.salt = crypto.randomBytes(8).toString('hex'); t.pw = hash(pw, t.salt); commit(); return send(res, 200, { ok: true }); }
    if (m === 'DELETE' && !mm[2]) {
      if (t.id === u.id) throw fail(400, 'You cannot remove yourself.');
      db.mats.filter(x => x.uid === t.id).forEach(x => fs.rmSync(fileOf(x.id), { force: true }));
      db.mats = db.mats.filter(x => x.uid !== t.id); db.users = db.users.filter(x => x !== t);
      for (const s in db.sessions) if ((db.sessions[s].id ?? db.sessions[s]) === t.id) delete db.sessions[s];
      commit(); return send(res, 200, { ok: true });
    }
  }
  throw fail(404, 'Unknown request.');
}

// ===== WEB SERVER (serves the pages + API) =====
const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js' };
const TYPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const f = PAGES[url.pathname]; if (!f) throw fail(404, 'Page not found');
    res.writeHead(200, { 'Content-Type': TYPE[path.extname(f)], 'Cache-Control': 'no-cache' }); res.end(fs.readFileSync(path.join(PUB, f)));
  } catch (e) { if (!e.code) console.error(e); if (!res.headersSent) send(res, e.code || 500, { error: e.code ? e.message : 'Server error' }); }
}).listen(PORT, () => console.log('StudyMate running at http://localhost:' + PORT));
