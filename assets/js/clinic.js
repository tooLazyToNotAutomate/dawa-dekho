// Clinic dashboard: login, today's status, stock, appointments, questions, settings.
import {
  load, db, onChange, update, resetData, prefs, esc, icon, mount, draft, toast,
  todayStr, fmtDate, fmtTime, timeAgo, clinicName, stockCounts, isPhone, weekday,
} from './core.js';
import { APP } from './config.js';
import { MEDICINES, CATS } from './data.js';
import { makeT } from './i18n.js';

load();
const P = prefs('clinic');
const S = {
  route: 'today', lang: P.get('lang', 'en'), clinicId: P.get('session', null),
  tab: 'pending', stockCat: 'all', err: '', resetArm: false,
};
const t = makeT(() => S.lang);
document.documentElement.lang = S.lang;
document.title = APP.name + ' – ' + t('dash.for');

const ROUTES = ['today', 'stock', 'appts', 'queries', 'settings'];
const me = () => db().clinics.find((c) => c.id === S.clinicId);
const myAppts = () => db().appointments.filter((a) => a.clinicId === S.clinicId);
const myQs = () => db().queries.filter((q) => q.clinicId === S.clinicId);
const pendingN = () => myAppts().filter((a) => a.status === 'pending').length;
const openQs = () => myQs().filter((q) => !q.reply).length;
const fv = (k, fallback) => esc(draft[k] ?? fallback ?? '');
const chip = (cls, text) => `<span class="chip chip--${cls}">${text}</span>`;
const empty = (ic, text) => `<div class="empty">${icon(ic)}<div>${text}</div></div>`;
const langSeg = () => `<div class="seg" role="group" aria-label="${t('language')}">
  <button class="seg__b ${S.lang === 'en' ? 'seg__b--on' : ''}" data-act="lang" data-val="en">English</button>
  <button class="seg__b ${S.lang === 'te' ? 'seg__b--on' : ''}" data-act="lang" data-val="te">తెలుగు</button></div>`;

/* ---------- login ---------- */
function loginView() {
  const names = db().clinics.map((c) => `<code>${esc(c.login)}</code>`).join(' ');
  const feats = [['toggle-right', 'login.f1'], ['package', 'login.f2'], ['inbox', 'login.f3']];
  return `<div class="login">
    <aside class="login__side">
      <div class="brand"><div class="brand__logo">${icon('hospital')}</div>
        <div><div class="brand__n">${esc(APP.name)}</div><div class="brand__t">${esc(APP.tagline[S.lang])}</div></div></div>
      <div class="login__pitch">
        <h2>${t('login.pitch')}</h2>
        <ul>${feats.map(([ic, k]) => `<li><span>${icon(ic === 'toggle-right' ? 'layout-dashboard' : ic)}</span>${t(k)}</li>`).join('')}</ul>
      </div>
    </aside>
    <section class="login__form">
      <div class="login__box">
        <div class="brand login__mini"><div class="brand__logo" style="background:var(--navy)">${icon('hospital')}</div>
          <div class="brand__n" style="color:var(--navy)">${esc(APP.name)}</div></div>
        <h1 class="h1">${t('login.title')}</h1><div class="muted" style="margin-top:2px">${t('dash.for')}</div><div class="sp"></div>
        <label class="field"><span class="label">${t('login.user')}</span><input class="input" data-draft="l.user" value="${fv('l.user')}" autocapitalize="none" autocomplete="username"></label><div class="sp-s"></div>
        <label class="field"><span class="label">${t('login.pass')}</span><input class="input" type="password" data-draft="l.pass" value="${fv('l.pass')}" autocomplete="current-password"></label>
        ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}<div class="sp"></div>
        <button class="btn btn--primary btn--block" data-act="login">${icon('lock')} ${t('login.go')}</button>
        <div class="demo-box">${t('login.demo')} ${names}<br>${t('login.pass')}: <code>${esc(APP.demoPassword)}</code></div>
        <div class="sp"></div>${langSeg()}
      </div>
    </section>
  </div>`;
}

/* ---------- shell ---------- */
const NAV = [['today', 'layout-dashboard'], ['stock', 'package'], ['appts', 'calendar-days'], ['queries', 'inbox'], ['settings', 'settings']];
function badge(r) { const n = r === 'appts' ? pendingN() : r === 'queries' ? openQs() : 0; return n ? `<span class="side__badge">${n}</span>` : ''; }
function shell(c, body) {
  return `<div class="shell">
    <aside class="side">
      <div class="brand"><div class="brand__logo">${icon('hospital')}</div><div><div class="brand__n">${esc(APP.name)}</div><div class="brand__t">${t('dash.for')}</div></div></div>
      <div class="side__who">${esc(clinicName(c, S.lang))}</div>
      ${NAV.map(([r, ic]) => `<button class="side__item ${S.route === r ? 'side__item--on' : ''}" data-act="go" data-val="${r}">${icon(ic)}<span>${t('dn.' + r)}</span>${badge(r)}</button>`).join('')}
      <div class="side__sp"></div>
      <button class="side__item" data-act="logout">${icon('log-out')}<span>${t('logout')}</span></button>
    </aside>
    <main class="main">${body}</main>
  </div>
  <nav class="dnav" aria-label="Main">${NAV.map(([r, ic]) => `<button class="nav__item ${S.route === r ? 'nav__item--on' : ''}" data-act="go" data-val="${r}">${icon(ic)}<span>${t('dn.' + r)}</span>${badge(r)}</button>`).join('')}</nav>`;
}
const head = (title, sub = '') => `<div class="main__head"><div><h1 class="h1">${title}</h1>${sub ? `<div class="muted">${sub}</div>` : ''}</div></div>`;

/* ---------- today ---------- */
function todayView(c) {
  const counts = stockCounts(c);
  const today = myAppts().filter((a) => a.date === todayStr() && ['pending', 'confirmed'].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
  const attention = MEDICINES.filter((m) => c.stock[m.id] !== 'in').sort((a, b) => (c.stock[a.id] === 'out' ? 0 : 1) - (c.stock[b.id] === 'out' ? 0 : 1));
  const tog = (on, act, ic, title, subOn, subOff) => `<button class="tog ${on ? 'tog--on' : 'tog--off'}" data-act="${act}" role="switch" aria-checked="${on}">
    <span class="tog__ic">${icon(ic)}</span><span><span class="tog__t" style="display:block">${title}</span><span class="tog__s">${on ? subOn : subOff}</span></span><span class="switch"></span></button>`;
  return `${head(t('today.title'), fmtDate(todayStr(), S.lang, { weekday: 'long', day: 'numeric', month: 'long' }))}
  <div class="togs">
    ${tog(c.isOpen, 'toggleOpen', 'hospital', t('tog.open'), t('tog.open.on'), t('tog.open.off'))}
    ${tog(c.doctor, 'toggleDoctor', 'stethoscope', t('tog.doc'), t('tog.doc.on'), t('tog.doc.off'))}
  </div>
  <div class="sp-s"></div>
  <div class="row" style="flex-wrap:wrap"><span class="small muted">${t('patientsSee')} · ${t('updated')} ${timeAgo(c.statusUpdatedAt, t)}</span>
    <button class="btn btn--soft btn--sm" data-act="touchStatus">${icon('badge-check')} ${t('confirmStatus')}</button></div>
  <div class="sp"></div>
  <div class="kpis">
    <button class="kpi ${pendingN() ? 'kpi--alert' : ''}" data-act="goTab" data-val="appts:pending"><b>${pendingN()}</b><span>${t('kpi.pending')}</span></button>
    <button class="kpi" data-act="goTab" data-val="appts:upcoming"><b>${today.length}</b><span>${t('kpi.today')}</span></button>
    <button class="kpi ${openQs() ? 'kpi--alert' : ''}" data-act="go" data-val="queries"><b>${openQs()}</b><span>${t('kpi.qs')}</span></button>
    <button class="kpi ${counts.out ? 'kpi--alert' : ''}" data-act="go" data-val="stock"><b>${counts.out}</b><span>${t('kpi.out')}</span></button>
  </div>
  <div class="sect"><h2 class="h2">${t('today.appts')}</h2></div>
  ${today.length ? today.map((a) => `<div class="appt"><div class="appt__top"><div><div class="appt__when">${fmtTime(a.time, S.lang)} · ${esc(a.name)}</div>
    <div class="muted small">${t('type.' + a.type)} · ${t('reason.' + a.reason)}</div></div>${chip(a.status, t('as.' + a.status))}</div></div>`).join('') : empty('calendar-days', t('today.none'))}
  <div class="sect"><h2 class="h2">${t('today.stock')}</h2><button class="btn btn--ghost btn--sm" data-act="go" data-val="stock">${t('dn.stock')}</button></div>
  ${attention.length ? attention.slice(0, 6).map((m) => `<div class="srow"><span class="med__dot med__dot--${c.stock[m.id]}"></span><span class="med__n">${esc(m.name)}</span>
    ${chip(c.stock[m.id], t('stock.' + c.stock[m.id]))}<button class="btn btn--soft btn--sm" data-act="setStock" data-id="${m.id}" data-val="in">${t('markIn')}</button></div>`).join('') : empty('circle-check', t('allIn'))}`;
}

/* ---------- stock ---------- */
function stockView(c) {
  const counts = stockCounts(c);
  const q = (draft['s.q'] || '').trim().toLowerCase();
  const list = MEDICINES.filter((m) => (S.stockCat === 'all' || m.cat === S.stockCat) && (!q || m.name.toLowerCase().includes(q)));
  const seg = (m) => `<div class="seg3" role="group" aria-label="${esc(m.name)}">${['in', 'low', 'out'].map((k) =>
    `<button class="${c.stock[m.id] === k ? 'on-' + k : ''}" data-act="setStock" data-id="${m.id}" data-val="${k}" aria-pressed="${c.stock[m.id] === k}">${t('stock.' + k)}</button>`).join('')}</div>`;
  return `${head(t('stock.title'), `${t('stockUpdated')} ${timeAgo(c.stockUpdatedAt, t)} · ${t('patientsSee')}`)}
  <div class="sumbar" style="max-width:420px"><div class="sum sum--in"><b>${counts.in}</b><span>${t('stock.in')}</span></div><div class="sum sum--low"><b>${counts.low}</b><span>${t('stock.low')}</span></div><div class="sum sum--out"><b>${counts.out}</b><span>${t('stock.out')}</span></div></div>
  <div class="sp"></div>
  <div class="cols" style="align-items:center;flex-wrap:wrap"><div class="search" style="min-width:220px">${icon('search')}<input class="input" type="search" data-draft="s.q" data-live placeholder="${t('meds.search')}" value="${fv('s.q')}"></div>
    <button class="btn btn--soft" data-act="allIn" style="flex:none">${icon('circle-check')} ${t('markAllIn')}</button></div>
  <div class="sp-s"></div>
  <div class="filters">${['all', ...CATS].map((k) => `<button class="fbtn ${S.stockCat === k ? 'fbtn--on' : ''}" data-act="stockCat" data-val="${k}">${t('cat.' + k)}</button>`).join('')}</div>
  <div class="sp-s"></div>
  ${list.length ? list.map((m) => `<div class="srow"><span class="med__n">${esc(m.name)}<span class="muted small" style="display:block;font-weight:400">${t('cat.' + m.cat)}</span></span>${seg(m)}</div>`).join('') : empty('search', t('meds.none'))}`;
}

/* ---------- appointments ---------- */
function apptGroups() {
  const all = myAppts();
  const key = (a) => a.date + a.time;
  return {
    pending: all.filter((a) => a.status === 'pending').sort((a, b) => key(a).localeCompare(key(b))),
    upcoming: all.filter((a) => a.status === 'confirmed' && a.date >= todayStr()).sort((a, b) => key(a).localeCompare(key(b))),
    past: all.filter((a) => a.status === 'done' || a.status === 'cancelled' || (a.status === 'confirmed' && a.date < todayStr())).sort((a, b) => key(b).localeCompare(key(a))),
  };
}
function apptsView() {
  const g = apptGroups();
  const list = g[S.tab];
  return `${head(t('appts.title'))}
  <div class="seg" style="max-width:520px">${['pending', 'upcoming', 'past'].map((k) =>
    `<button class="seg__b ${S.tab === k ? 'seg__b--on' : ''}" data-act="tab" data-val="${k}">${t('tab.' + k)} (${g[k].length})</button>`).join('')}</div><div class="sp"></div>
  ${list.length ? list.map(apptCard).join('') : empty('calendar-days', t('appts.none'))}`;
}
function apptCard(a) {
  const editable = a.status === 'pending' || (a.status === 'confirmed' && a.date >= todayStr());
  return `<div class="appt">
    <div class="appt__top"><div>
      <div class="appt__when">${fmtDate(a.date, S.lang, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(a.time, S.lang)}</div>
      <div style="font-weight:600;margin-top:2px">${esc(a.name)} · <a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></div>
      <div class="wrap" style="margin-top:8px"><span class="tag">${icon(a.type === 'online' ? 'phone-call' : 'hospital')}${t('type.' + a.type)}</span><span class="tag">${t('reason.' + a.reason)}</span></div>
    </div>${chip(a.status, t('as.' + a.status))}</div>
    ${a.type === 'online' && editable ? `<div class="note"><b>${t('type.online')}</b>${t('appt.callHelp')}</div>` : ''}
    ${editable ? `<div class="sp-s"></div><label class="field"><span class="small muted">${t('appt.note')}</span>
      <input class="input" data-draft="n:${a.id}" value="${fv('n:' + a.id, a.note)}" placeholder="${t(a.type === 'online' ? 'appt.note.ph.online' : 'appt.note.ph')}"></label>
      <div class="appt__acts">
        ${a.status === 'pending' ? `<button class="btn btn--primary btn--sm" data-act="apptSet" data-id="${a.id}" data-val="confirmed">${icon('check')} ${t('confirm')}</button>` : `<button class="btn btn--primary btn--sm" data-act="apptSet" data-id="${a.id}" data-val="done">${icon('badge-check')} ${t('markDone')}</button>`}
        <button class="btn btn--ghost btn--sm" data-act="apptSet" data-id="${a.id}" data-val="${a.status}">${t('saveNote')}</button>
        ${a.type === 'online' ? `<a class="btn btn--soft btn--sm" href="tel:${esc(a.phone)}">${icon('phone')} ${t('callPatient')}</a>` : ''}
        <button class="btn btn--danger btn--sm" data-act="apptSet" data-id="${a.id}" data-val="cancelled">${t('cancel')}</button>
      </div>`
      : (a.note ? `<div class="note"><b>${t('appt.note')}</b>${esc(a.note)}</div>` : '')}
  </div>`;
}

/* ---------- questions ---------- */
function queriesView() {
  const qs = [...myQs()].sort((a, b) => (a.reply ? 1 : 0) - (b.reply ? 1 : 0) || b.createdAt - a.createdAt);
  return `${head(t('qs.title'))}
  ${qs.length ? qs.map((q) => `<div class="appt">
    <div class="appt__top"><div><div style="font-weight:700;color:var(--navy)">${esc(q.name)} · <a href="tel:${esc(q.phone)}" style="font-weight:600">${esc(q.phone)}</a></div>
      <div class="muted small">${timeAgo(q.createdAt, t)}</div></div>${q.reply ? chip('confirmed', t('answered')) : chip('pending', t('waiting'))}</div>
    <div style="margin-top:10px">${esc(q.text)}</div>
    ${q.reply ? `<div class="note"><b>${t('yourReply')}</b>${esc(q.reply)}</div>`
      : `<div class="sp-s"></div><textarea class="textarea" style="min-height:76px" data-draft="r:${q.id}" placeholder="${t('qs.ph')}">${fv('r:' + q.id)}</textarea>
      <div class="appt__acts"><button class="btn btn--primary btn--sm" data-act="reply" data-id="${q.id}">${icon('send')} ${t('qs.send')}</button></div>`}
  </div>`).join('') : empty('inbox', t('qs.none'))}`;
}

/* ---------- settings ---------- */
function settingsView(c) {
  return `${head(t('dn.settings'))}
  <section class="card" style="max-width:640px"><h2 class="h2">${t('set.clinic')}</h2><div class="sp-s"></div>
    <label class="field"><span class="label">${t('set.address')}</span><input class="input" data-draft="s.address" value="${fv('s.address', c.address)}"></label><div class="sp-s"></div>
    <label class="field"><span class="label">${t('set.maps')}</span><input class="input" data-draft="s.maps" value="${fv('s.maps', c.mapsLink)}" placeholder="https://maps.google.com/…"><div class="hint">${t('set.maps.hint')}</div></label><div class="sp-s"></div>
    <label class="field"><span class="label">${t('set.phone')}</span><input class="input" data-draft="s.phone" value="${fv('s.phone', c.phone)}" inputmode="numeric" maxlength="10"></label><div class="sp-s"></div>
    <div class="cols"><label class="field"><span class="label">${t('set.opens')}</span><input class="input" type="time" data-draft="s.open" value="${fv('s.open', c.open)}"></label>
      <label class="field"><span class="label">${t('set.closes')}</span><input class="input" type="time" data-draft="s.close" value="${fv('s.close', c.close)}"></label></div><div class="sp-s"></div>
    <div class="label">${t('set.weekoff')}</div>
    <div class="wrap">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="fbtn ${c.closedDays.includes(d) ? 'fbtn--on' : ''}" data-act="toggleDay" data-val="${d}" aria-pressed="${c.closedDays.includes(d)}">${weekday(d, S.lang)}</button>`).join('')}</div>
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}<div class="sp"></div>
    <button class="btn btn--primary" data-act="saveClinic">${t('save')}</button></section>
  <div class="sp"></div>
  <section class="card" style="max-width:640px"><h2 class="h2">${icon('languages')} ${t('language')}</h2><div class="sp-s"></div>${langSeg()}</section>
  <div class="sp"></div>
  <section class="card" style="max-width:640px"><div class="wrap"><button class="btn btn--danger" data-act="resetDemo">${S.resetArm ? t('set.reset.sure') : t('set.reset')}</button>
    <button class="btn btn--ghost" data-act="logout">${icon('log-out')} ${t('logout')}</button></div></section>`;
}

/* ---------- router ---------- */
function build() {
  const c = me();
  if (!c) return loginView();
  const body = { today: todayView, stock: stockView, appts: apptsView, queries: queriesView, settings: settingsView }[S.route](c);
  return shell(c, body);
}
const readHash = () => { const r = location.hash.replace(/^#\//, ''); S.route = ROUTES.includes(r) ? r : 'today'; };
function go(r) { S.err = ''; S.resetArm = false; if (location.hash === '#/' + r) { S.route = r; view.render(); } else location.hash = '#/' + r; }
window.addEventListener('hashchange', () => { readHash(); S.err = ''; S.resetArm = false; window.scrollTo(0, 0); view.render(); });

const touch = (c) => { c.statusUpdatedAt = Date.now(); };
const actions = {
  go: (d) => go(d.val),
  goTab: (d) => { const [r, tab] = d.val.split(':'); S.tab = tab; go(r); },
  tab: (d) => { S.tab = d.val; view.render(); },
  lang: (d) => { S.lang = d.val; P.set('lang', d.val); document.documentElement.lang = d.val; view.render(); },
  login: () => {
    const u = (draft['l.user'] || '').trim().toLowerCase(), p = draft['l.pass'] || '';
    const c = db().clinics.find((x) => x.login === u && x.password === p);
    if (!c) { S.err = t('login.err'); view.render(); return; }
    S.clinicId = c.id; P.set('session', c.id); draft['l.pass'] = ''; S.err = ''; S.route = 'today'; location.hash = '#/today'; view.render();
  },
  logout: () => { P.del('session'); S.clinicId = null; view.render(); },
  toggleOpen: () => update((d) => { const c = d.clinics.find((x) => x.id === S.clinicId); c.isOpen = !c.isOpen; touch(c); }),
  toggleDoctor: () => update((d) => { const c = d.clinics.find((x) => x.id === S.clinicId); c.doctor = !c.doctor; touch(c); }),
  touchStatus: () => { update((d) => touch(d.clinics.find((x) => x.id === S.clinicId))); toast(t('confirmed')); },
  setStock: (d0) => update((d) => { const c = d.clinics.find((x) => x.id === S.clinicId); c.stock[d0.id] = d0.val; c.stockUpdatedAt = Date.now(); }),
  allIn: () => { update((d) => { const c = d.clinics.find((x) => x.id === S.clinicId); for (const m of MEDICINES) c.stock[m.id] = 'in'; c.stockUpdatedAt = Date.now(); }); toast(t('markedAll')); },
  stockCat: (d) => { S.stockCat = d.val; view.render(); },
  apptSet: (d0) => {
    const note = draft['n:' + d0.id];
    update((d) => {
      const a = d.appointments.find((x) => x.id === d0.id);
      if (!a) return;
      if (note !== undefined) a.note = note.trim();
      a.status = d0.val;
    });
    delete draft['n:' + d0.id];
    toast(t('saved'));
  },
  reply: (d0) => {
    const text = (draft['r:' + d0.id] || '').trim();
    if (text.length < 2) { toast(t('qs.empty')); return; }
    update((d) => { const q = d.queries.find((x) => x.id === d0.id); q.reply = text; q.repliedAt = Date.now(); });
    delete draft['r:' + d0.id]; toast(t('qs.sent'));
  },
  toggleDay: (d0) => update((d) => {
    const c = d.clinics.find((x) => x.id === S.clinicId); const n = Number(d0.val);
    c.closedDays = c.closedDays.includes(n) ? c.closedDays.filter((x) => x !== n) : [...c.closedDays, n];
  }),
  saveClinic: () => {
    const c = me();
    const address = (draft['s.address'] ?? c.address).trim(), maps = (draft['s.maps'] ?? c.mapsLink).trim();
    const phone = (draft['s.phone'] ?? c.phone).trim(), open = draft['s.open'] ?? c.open, close = draft['s.close'] ?? c.close;
    if (address.length < 4) { S.err = t('err.address'); view.render(); return; }
    if (!isPhone(phone)) { S.err = t('err.phone'); view.render(); return; }
    if (!open || !close || close <= open) { S.err = t('err.hours'); view.render(); return; }
    if (maps && !/^https?:\/\//i.test(maps)) { S.err = t('err.maps'); view.render(); return; }
    S.err = '';
    update((d) => { const x = d.clinics.find((i) => i.id === S.clinicId); Object.assign(x, { address, mapsLink: maps, phone, open, close }); });
    for (const k of ['s.address', 's.maps', 's.phone', 's.open', 's.close']) delete draft[k];
    toast(t('saved'));
  },
  resetDemo: () => {
    if (!S.resetArm) { S.resetArm = true; view.render(); return; }
    S.resetArm = false; resetData(); toast(t('set.reset.done'));
  },
};

const view = mount(document.getElementById('app'), build, actions);
onChange(() => view.soft());
readHash();
view.render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('../sw.js').catch(() => {});
}
