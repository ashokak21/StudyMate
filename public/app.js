// ===== DATA & SETTINGS =====
// KEY = name used to save data in the browser; RE = allowed student register number format (RA2511 + 9 digits)
const KEY = 'studymate_v5', RE = /^RA2511\d{9}$/i;
const DEPTS = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'];
let editId = 0, D, me = null, view = '', files = {}, mode = 'login', fails = 0, lock = 0, F = { q: '', s: '', t: '', o: 'new' };
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10), show = u => u.role === 'student' ? u.username.toUpperCase() : u.username;
const ICON = { 'Lecture Notes': '📘', 'Assignment': '📝', 'Reference': '📑', 'Question Paper': '❓', 'Video': '🎬' };
const opts = (a, s) => a.map(x => `<option ${x === s ? 'selected' : ''}>${esc(x)}</option>`).join('');
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'], TYPES = Object.keys(ICON);
// theme: switches dark / light mode
function theme() { const r = document.documentElement, d = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); r.dataset.theme = d ? 'light' : 'dark'; }
function setMode(m) { mode = m; render(); }
function nav(v) { view = v; render(); }
function authView() {
    const L = mode === 'login';
    return `<div class="auth"><div class="brand"><h1>Study<span>Mate</span></h1><p>Your Study Material Helper</p><p class="ab">StudyMate is a web-based study material management system that connects faculty and students. Faculty publish and update course materials, and students browse, save and download them anytime.</p><ul class="pts"><li><span class="pi2">📚</span><span><b>Centralized study materials</b></span></li><li><span class="pi2">👥</span><span><b>Role-based access for admin, faculty and students</b></span></li><li><span class="pi2">🔐</span><span><b>Secure login with auto logout</b></span></li></ul><div class="ft">Built for faculty, students and administrators.</div></div><div class="form">` + (L ?
        `<h2>Welcome back</h2><p class="note">Sign in with your email ID, registration number or username.</p><br><div class="row"><div><label>Email ID / Registration No. / Username</label><input id="lu" placeholder="name@college.edu" autocomplete="username"></div><div><label>Password</label><input id="lp" type="password" onkeydown="if(event.key==='Enter')doLogin()"></div></div><div class="err" id="err"></div><button class="b" onclick="doLogin()">Sign in</button><p class="note">New student? <button class="link" onclick="setMode('reg')">Register</button></p><div class="demo"><b>Demo accounts</b><br>Student: arun@college.edu / student123<br>Faculty: meena@college.edu / faculty123<br>Admin: admin@college.edu / admin123</div>` :
        `<h2>Student registration</h2><p class="note">Faculty accounts are created by the admin.</p><br><div class="row"><div><label>Full name</label><input id="rn"></div><div><label>Registration No. (RA2511 + 9 digits)</label><input id="rr" maxlength="15" placeholder="RA2511000000123"></div><div><label>Email</label><input id="re" type="email"></div><div><label>Department</label><select id="rd">${opts(DEPTS)}</select></div><div><label>Password</label><input id="rp" type="password"></div><div><label>Confirm password</label><input id="rc" type="password"></div></div><div class="err" id="err"></div><button class="b" onclick="doReg()">Create account</button><p class="note">Already registered? <button class="link" onclick="setMode('login')">Sign in</button></p>`) + `</div></div>`;
}
// ===== SCREENS (role-based menus) =====
// NAV = which menu items each role (admin / faculty / student) can see
const NAV = { admin: [['dash', '🏠 Dashboard'], ['users', '👥 Users'], ['subjects', '📚 Subjects'], ['mats', '🗂️ Materials'], ['ann', '📢 Announcements']], faculty: [['dash', '🏠 Dashboard'], ['upload', '⬆️ Upload'], ['mine', '🗂️ My Materials'], ['ann', '📢 Announcements']], student: [['dash', '🏠 Dashboard'], ['browse', '🔎 Browse'], ['saved', '⭐ Saved'], ['ann', '📢 Announcements']] };
// matList: builds the list of material cards (Download / Edit / Delete buttons depend on role)
function matList(list, mode) { return list.map(m => { const sv = (me.saved || []).includes(m.id); return `<div class="mat"><div class="ico">${ICON[m.type] || '📄'}</div><div class="i"><b>${esc(m.title)}</b><p>${esc(m.desc)}</p><span class="tag">${esc(m.subject)}</span><span class="tag">${esc(m.unit)}</span><span class="tag">${esc(m.type)}</span><span class="note">${esc(m.by)} · ${m.date} · ⬇ ${m.dl}</span></div>${me.role === 'student' ? `<button class="star" title="Save" onclick="toggleSave(${m.id})">${sv ? '★' : '☆'}</button>` : ''}<button class="b" onclick="dl(${m.id})">Download</button>${mode === 'del' ? `<button class="g" onclick="editMat(${m.id})">Edit</button><button class="d" onclick="delMat(${m.id})">Delete</button>` : ''}</div>`; }).join('') || '<p class="note">Nothing here yet.</p>'; }
const annBox = () => `<div class="card"><h3>📢 Announcements</h3>${D.anns.slice().reverse().map(a => `<div class="ann">${esc(a.text)}<div class="note">${esc(a.by)} · ${a.date}${(me.role === 'admin' || a.uid === me.id) ? ` · <a href="#" onclick="delAnn(${a.id});return false">remove</a>` : ''}</div></div>`).join('') || '<span class="note">None yet.</span>'}</div>`;
const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
// pages: returns the HTML for the current screen (dashboard, browse, upload, users, profile...)
function pages() {
    const M = D.mats, sorted = M.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (view === 'dash') {
        const mine = M.filter(m => m.uid === me.id);
        let s = me.role === 'admin' ? stat(D.users.length, 'Users') + stat(D.subjects.length, 'Subjects') + stat(M.length, 'Materials') + stat(M.reduce((a, m) => a + m.dl, 0), 'Total downloads') : me.role === 'faculty' ? stat(mine.length, 'My uploads') + stat(mine.reduce((a, m) => a + m.dl, 0), 'Downloads of my files') + stat(D.subjects.length, 'Subjects') : stat(M.length, 'Materials') + stat(D.subjects.length, 'Subjects') + stat((me.saved || []).length, 'Saved');
        return `<div class="stats">${s}</div><div class="card"><h3>Recently added</h3>${matList(sorted.slice(0, 3))}</div>` + annBox().replace('<h3>', '<h3>');
    }
    if (view === 'browse')
        return `<div class="card"><div class="row"><div><label>Search</label><input id="q" value="${esc(F.q)}" placeholder="Search title or description…" oninput="filt()"></div><div><label>Subject</label><select id="fs" onchange="filt()"><option value="">All</option>${opts(D.subjects, F.s)}</select></div><div><label>Type</label><select id="ft" onchange="filt()"><option value="">All</option>${opts(TYPES, F.t)}</select></div><div><label>Sort by</label><select id="fo" onchange="filt()"><option value="new">Newest</option><option value="pop" ${F.o === 'pop' ? 'selected' : ''}>Most downloaded</option></select></div></div><div id="res"></div></div>`;
    if (view === 'saved')
        return `<div class="card">${matList(M.filter(m => (me.saved || []).includes(m.id)))}</div>`;
    if (view === 'ann')
        return me.role === 'student' ? annBox() : `<div class="card"><h3>Post announcement</h3><textarea id="at" rows="2" placeholder="Write an announcement…"></textarea><br><br><button class="b" onclick="addAnn()">Post</button></div>` + annBox();
    if (view === 'edit') {
        const m = D.mats.find(x => x.id === editId);
        if (!m)
            return '';
        return `<div class="card"><h3>Edit material</h3><div class="row"><div><label>Title</label><input id="et" value="${esc(m.title)}"></div><div><label>Subject</label><select id="es">${opts(D.subjects, m.subject)}</select></div><div><label>Unit</label><select id="eu">${opts(UNITS, m.unit)}</select></div><div><label>Type</label><select id="ey">${opts(TYPES, m.type)}</select></div></div><div class="row"><div><label>Description</label><input id="ed" value="${esc(m.desc)}"></div><div><label>Replace file (optional) – current: ${esc(m.file)}</label><input type="file" id="ef"></div></div><button class="b" onclick="saveMat()">Save changes</button> <button class="g" onclick="nav(me.role==='admin'?'mats':'mine')">Cancel</button></div>`;
    }
    if (view === 'upload')
        return `<div class="card"><h3>Upload material</h3><div class="row"><div><label>Title</label><input id="mt"></div><div><label>Subject</label><select id="ms">${opts(D.subjects)}</select></div><div><label>Unit</label><select id="mu">${opts(UNITS)}</select></div><div><label>Type</label><select id="my">${opts(TYPES)}</select></div></div><div class="row"><div><label>Description</label><input id="md"></div><div><label>File</label><input type="file" id="mf"></div></div><button class="b" onclick="addMat()">Upload</button><p class="note">Files are saved on the server (max 25 MB each).</p></div>`;
    if (view === 'mine')
        return `<div class="card">${matList(M.filter(m => m.uid === me.id), 'del')}</div>`;
    if (view === 'mats')
        return `<div class="card">${matList(sorted, 'del')}</div>`;
    if (view === 'subjects')
        return `<div class="card"><h3>Add subject</h3><div class="row"><input id="sn" placeholder="Subject name"></div><button class="b" onclick="addSub()">Add</button></div><div class="card">${D.subjects.map((s, i) => `<div class="mat"><div class="i"><b>${esc(s)}</b><p>${M.filter(m => m.subject === s).length} materials</p></div><button class="d" onclick="delSub(${i})">Remove</button></div>`).join('')}</div>`;
    if (view === 'users')
        return `<div class="card"><h3>Create user</h3><div class="row"><div><label>Name</label><input id="un"></div><div><label>Email</label><input id="ue"></div><div><label>Username / Reg. No.</label><input id="uu"></div><div><label>Temporary password</label><input id="up"></div><div><label>Role</label><select id="ur"><option>faculty</option><option>student</option><option>admin</option></select></div></div><div class="err" id="err"></div><button class="b" onclick="addUser()">Create</button></div><div class="card"><h3>All users</h3><div style="overflow-x:auto"><table class="table"><tr><th>Name</th><th>ID</th><th>Role</th><th></th></tr>${D.users.map(u => `<tr><td>${esc(u.name)}<div class="note">${esc(u.email)}</div></td><td>${esc(show(u))}</td><td><span class="tag">${u.role}</span></td><td>${u.id === me.id ? '' : `<button class="g" onclick="resetPw(${u.id})">Reset</button> <button class="d" onclick="delUser(${u.id})">Remove</button>`}</td></tr>`).join('')}</table></div></div>`;
    if (view === 'profile') {
        const st = me.role === 'student', fa = me.role === 'faculty', mine = M.filter(m => m.uid === me.id);
        const av = me.photo ? `<img src="${me.photo}" alt="">` : esc(ini(me.name));
        const stats = st ? stat((me.saved || []).length, 'Saved materials') + stat(me.dls || 0, 'Downloads') + stat(M.length, 'Available materials') : fa ? stat(mine.length, 'Uploads') + stat(mine.reduce((a, m) => a + m.dl, 0), 'Downloads received') + stat(new Set(mine.map(m => m.subject)).size, 'Subjects covered') : stat(D.users.length, 'Users') + stat(M.length, 'Materials') + stat(D.subjects.length, 'Subjects');
        const rec = st ? M.filter(m => (me.saved || []).includes(m.id)).slice(0, 3) : fa ? mine.slice(-3).reverse() : [];
        return `<div class="card pf"><div class="av">${av}</div><div class="pi"><h3 style="font-size:24px;margin:0">${esc(me.name)}</h3><div style="margin:4px 0"><span class="tag">${me.role}</span>${me.dept ? `<span class="tag">${esc(me.dept)}</span>` : ''}${st && me.year ? `<span class="tag">${esc(me.year)}</span>` : ''}${fa && me.desig ? `<span class="tag">${esc(me.desig)}</span>` : ''}</div><p class="note">${esc(show(me))} · ${esc(me.email)}${me.phone ? ' · ' + esc(me.phone) : ''}</p>${me.bio ? `<p>${esc(me.bio)}</p>` : '<p class="note">Add a short bio below.</p>'}<input type="file" id="pf" accept="image/*" hidden onchange="setPhoto(this)"><button class="g" onclick="$('#pf').click()">📷 ${me.photo ? 'Change' : 'Add'} photo</button>${me.photo ? ' <button class="g" onclick="rmPhoto()">Remove</button>' : ''}</div></div>
 <div class="stats">${stats}</div>
 <div class="card"><h3>Personal details</h3><div class="row"><div><label>${st ? 'Registration No.' : 'Username'}</label><input value="${esc(show(me))}" disabled></div><div><label>Full name</label><input id="pn" value="${esc(me.name)}"></div><div><label>Email</label><input id="pe" value="${esc(me.email)}"></div><div><label>Phone (optional)</label><input id="ph" value="${esc(me.phone)}" placeholder="10-digit number"></div>${me.role !== 'admin' ? `<div><label>Department</label><select id="pd">${opts(DEPTS, me.dept)}</select></div>` : ''}${st ? `<div><label>Year of study</label><select id="py">${opts(['1st Year', '2nd Year', '3rd Year', '4th Year'], me.year)}</select></div>` : ''}${fa ? `<div><label>Designation</label><select id="pg">${opts(['Assistant Professor', 'Associate Professor', 'Professor', 'Lecturer'], me.desig)}</select></div>` : ''}</div><div style="margin-bottom:12px"><label>About me</label><textarea id="pb" rows="2" maxlength="160" placeholder="A short bio (max 160 characters)">${esc(me.bio)}</textarea></div><div class="err" id="perr"></div><button class="b" onclick="saveProf()">Save changes</button> <span class="ok" id="pok"></span></div>
 ${rec.length ? `<div class="card"><h3>${st ? 'Recently saved' : 'Recent uploads'}</h3>${matList(rec)}</div>` : ''}
 <div class="card"><h3>Account & security</h3><div class="two"><p class="note" style="margin:0">📅 Member since: <b>${esc(me.joined || '2026-09-01')}</b></p><p class="note" style="margin:0">🕒 Last login: <b>${esc(me.prev || 'First login')}</b></p></div><br><div class="row"><div><label>Current password</label><input id="p0" type="password"></div><div><label>New password</label><input id="p1" type="password" oninput="pwS()"><div class="sm"><i id="smb"></i></div><span class="note" id="smt"></span></div><div><label>Confirm new password</label><input id="p2" type="password"></div></div><div class="err" id="err"></div><button class="b" onclick="chPw()">Update password</button></div>`;
    }
}
// render: the main function - draws the sidebar + current screen. Called after every change
function render() {
    const A = $('#app');
    if (!D)
        return;
    if (!me) {
        A.innerHTML = authView();
        return;
    }
    const t = [...NAV[me.role], ['profile', '👤 Profile']], title = (t.find(x => x[0] === view) || [0, '✏️ Edit material'])[1].replace(/^\S+\s/, '');
    A.innerHTML = `<div class="shell"><aside><div class="logo">Study<span>Mate</span></div><small>Study Material Helper</small>${t.map(x => `<button class="${view === x[0] ? 'on' : ''}" onclick="nav('${x[0]}')">${x[1]}</button>`).join('')}<div class="sp"></div><div class="me">${esc(me.name)}<br>${me.role}</div><button onclick="theme()">🌓 Theme</button><button onclick="logout()">🚪 Logout</button></aside><main><div class="top"><h2>${view === 'dash' ? 'Hello, ' + esc(me.name.split(' ')[0]) : title}</h2></div>${pages()}</main></div>`;
    if (view === 'browse')
        filt();
}
// ===== BROWSE, SEARCH & SAVE =====
// filt: applies search text, subject, type filters and sorting
function filt() {
    F.q = $('#q').value;
    F.s = $('#fs').value;
    F.t = $('#ft').value;
    F.o = $('#fo').value;
    const q = F.q.toLowerCase();
    let l = D.mats.filter(m => (!q || (m.title + ' ' + m.desc).toLowerCase().includes(q)) && (!F.s || m.subject === F.s) && (!F.t || m.type === F.t));
    l.sort((a, b) => F.o === 'pop' ? b.dl - a.dl : b.date.localeCompare(a.date));
    $('#res').innerHTML = matList(l);
}
const ini = n => String(n).split(' ').filter(w => w && !/^(dr|prof)\.?$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
function pwS() {
    const p = $('#p1').value;
    let k = 0;
    if (p.length >= 6)
        k++;
    if (p.length >= 10)
        k++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p))
        k++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p))
        k++;
    const b = $('#smb');
    b.style.width = (p ? k * 25 : 0) + '%';
    b.style.background = ['#b42318', '#b42318', '#d97706', '#0f766e', '#0f766e'][k];
    $('#smt').textContent = p ? ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][k] : '';
}
// editMat / saveMat: faculty or admin edits a material
function editMat(i) {
    const m = D.mats.find(x => x.id === i);
    if (!m || (me.role !== 'admin' && m.uid !== me.id))
        return;
    editId = i;
    nav('edit');
}

// ===== SERVER CONNECTION =====
// All data now lives on the server. api() sends a request with the login token.
let token = localStorage.getItem('studymate_token') || '';
D = { users: [], subjects: [], mats: [], anns: [] };

async function api(path, opt = {}) {
  const headers = { Authorization: 'Bearer ' + token };
  let body = opt.body;
  if (opt.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opt.json); }
  const r = await fetch('/api' + path, { method: opt.method || 'GET', headers, body });
  if (opt.raw && r.ok) return r;
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { dropSession(d.error || 'Please log in again.'); return new Promise(() => { }); }   // session ended: back to login
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function dropSession(msg) {
  token = ''; localStorage.removeItem('studymate_token'); me = null; mode = 'login'; render();
  if (msg) { const e = $('#err'); if (e) e.textContent = msg; }
}
async function load() { const s = await api('/state'); D = s; me = s.me; render(); }   // get fresh data from the server and redraw
async function act(fn) { try { await fn(); await load(); } catch (e) { alert(e.message); } }   // run an action, then refresh

// ===== AUTO LOGOUT (30 minutes of inactivity) =====
const IDLE_MS = 30 * 60 * 1000;
let lastMark = 0;
function markActive() { const n = Date.now(); if (me && n - lastMark > 5000) { lastMark = n; try { localStorage.setItem('studymate_last', n); } catch (e) { } } }
['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, markActive, { passive: true }));
setInterval(() => {
  if (me && Date.now() - (+localStorage.getItem('studymate_last') || 0) > IDLE_MS) {
    api('/logout', { method: 'POST' }).catch(() => { });
    dropSession('You were logged out after 30 minutes of inactivity.');
  }
}, 15000);

// ===== START-UP =====
async function init() {
  if (token) {
    if (Date.now() - (+localStorage.getItem('studymate_last') || 0) > IDLE_MS) { dropSession('You were logged out after 30 minutes of inactivity.'); return; }
    try { view = 'dash'; await load(); return; } catch (e) { }
  }
  render();
}

// ===== LOGIN / REGISTER / LOGOUT =====
async function doLogin() {
  const er = $('#err');
  try {
    const r = await api('/login', { method: 'POST', json: { username: $('#lu').value.trim(), password: $('#lp').value } });
    token = r.token; localStorage.setItem('studymate_token', token); localStorage.setItem('studymate_last', Date.now()); lastMark = Date.now(); view = 'dash'; await load();
  } catch (e) { er.textContent = e.message; }
}
async function doReg() {
  const g = i => $('#' + i).value.trim(), er = m => $('#err').textContent = m, rn = g('rr').toUpperCase(), p = $('#rp').value;
  if (!g('rn') || !g('re') || !rn || !p) return er('Please fill all fields.');
  if (!RE.test(rn)) return er('Registration number must be RA2511 followed by 9 digits (e.g. RA2511000000123).');
  if (!/^\S+@\S+\.\S+$/.test(g('re'))) return er('Enter a valid email address.');
  if (p.length < 6) return er('Password must be at least 6 characters.');
  if (p !== $('#rc').value) return er('Passwords do not match.');
  try {
    await api('/register', { method: 'POST', json: { name: g('rn'), email: g('re'), dept: $('#rd').value, regno: rn, password: p } });
    mode = 'login'; render(); $('#err').innerHTML = '<span class="ok">Registered! Sign in with your email or registration number.</span>';
  } catch (e) { er(e.message); }
}
function logout() {
  if (!confirm('Are you sure you want to log out?')) return;   // confirm before logging out
  api('/logout', { method: 'POST' }).catch(() => { });
  dropSession();
}

// ===== BROWSE / SAVE =====
const toggleSave = i => act(() => api('/save/' + i, { method: 'POST' }));

// ===== ADMIN FUNCTIONS =====
async function addUser() {
  const g = i => $('#' + i).value.trim(), e = $('#err'), r = $('#ur').value, u = g('uu').toLowerCase();
  if (!g('un') || !g('ue') || !u || g('up').length < 6) return e.textContent = 'Fill all fields; password min 6 chars.';
  if (r === 'student' && !RE.test(u)) return e.textContent = 'Student ID must be RA2511 + 9 digits.';
  try { await api('/users', { method: 'POST', json: { name: g('un'), email: g('ue'), username: u, password: g('up'), role: r } }); await load(); } catch (x) { e.textContent = x.message; }
}
async function resetPw(i) {
  const u = D.users.find(x => x.id === i), p = prompt('New temporary password for ' + show(u) + ' (min 6):');
  if (!p || p.length < 6) return;
  try { await api('/users/' + i + '/reset', { method: 'POST', json: { password: p } }); alert('Password reset.'); } catch (e) { alert(e.message); }
}
function delUser(i) { if (confirm('Remove this user and their uploaded materials?')) act(() => api('/users/' + i, { method: 'DELETE' })); }
function addSub() { const n = $('#sn').value.trim(); if (n) act(() => api('/subjects', { method: 'POST', json: { name: n } })); }
function delSub(i) { const s = D.subjects[i]; if (confirm('Remove "' + s + '" and its materials?')) act(() => api('/subjects/delete', { method: 'POST', json: { name: s } })); }

// ===== PROFILE & PASSWORD =====
async function saveProf() {
  const g = i => $('#' + i) ? $('#' + i).value.trim() : undefined, er = $('#perr');
  try {
    await api('/me', { method: 'PUT', json: { name: g('pn'), email: g('pe'), phone: g('ph'), bio: g('pb'), dept: g('pd'), year: g('py'), desig: g('pg') } });
    await load(); $('#pok').textContent = '✓ Profile saved';
  } catch (e) { er.textContent = e.message; }
}
function setPhoto(i) {
  const f = i.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), z = Math.min(im.width, im.height); c.width = c.height = 160;
    c.getContext('2d').drawImage(im, (im.width - z) / 2, (im.height - z) / 2, z, z, 0, 0, 160, 160);
    act(() => api('/me', { method: 'PUT', json: { photo: c.toDataURL('image/jpeg', .8) } }));
  }; im.src = r.result; };
  r.readAsDataURL(f);
}
function rmPhoto() { act(() => api('/me', { method: 'PUT', json: { photo: null } })); }
async function chPw() {
  const e = $('#err'), p = $('#p1').value;
  if (p.length < 6) return e.textContent = 'Min 6 characters.';
  if (p !== $('#p2').value) return e.textContent = 'Passwords do not match.';
  try { await api('/me/password', { method: 'POST', json: { current: $('#p0').value, next: p } }); e.innerHTML = '<span class="ok">Password updated.</span>'; } catch (x) { e.textContent = x.message; }
}

// ===== MATERIALS & ANNOUNCEMENTS =====
async function addMat() {   // faculty upload: the file itself is sent to the server
  const t = $('#mt').value.trim(), f = $('#mf').files[0];
  if (!t || !f) return alert('Enter a title and choose a file');
  if (f.size > 25e6) return alert('File too large (max 25 MB).');
  const q = new URLSearchParams({ title: t, desc: $('#md').value.trim(), subject: $('#ms').value, unit: $('#mu').value, type: $('#my').value, filename: f.name });
  try { await api('/mats?' + q, { method: 'POST', body: f }); view = 'mine'; await load(); } catch (e) { alert(e.message); }
}
async function saveMat() {
  const m = D.mats.find(x => x.id === editId), t = $('#et').value.trim(), f = $('#ef').files[0];
  if (!t) return alert('Title cannot be empty.');
  if (f && f.size > 25e6) return alert('File too large (max 25 MB).');
  try {
    await api('/mats/' + m.id, { method: 'PUT', json: { title: t, subject: $('#es').value, unit: $('#eu').value, type: $('#ey').value, desc: $('#ed').value.trim() } });
    if (f) await api('/mats/' + m.id + '/file?filename=' + encodeURIComponent(f.name), { method: 'POST', body: f });
    view = me.role === 'admin' ? 'mats' : 'mine'; await load();
  } catch (e) { alert(e.message); }
}
function delMat(i) { if (confirm('Delete this material?')) act(() => api('/mats/' + i, { method: 'DELETE' })); }
function addAnn() { const t = $('#at').value.trim(); if (t) act(() => api('/anns', { method: 'POST', json: { text: t } })); }
function delAnn(i) { act(() => api('/anns/' + i, { method: 'DELETE' })); }
async function dl(i) {   // download the real file from the server
  try {
    const r = await api('/mats/' + i + '/file', { raw: true }), b = await r.blob(), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = decodeURIComponent(r.headers.get('X-Filename') || 'file'); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); await load();
  } catch (e) { alert(e.message); }
}

init();
