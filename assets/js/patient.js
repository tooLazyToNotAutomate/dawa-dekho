// Patient app (PWA): pick a clinic, see live status, medicines, book, ask, records.
import {
  load, db, onChange, update, prefs, uid, esc, icon, mount, draft, val, toast,
  todayStr, dateStr, fmtDate, fmtTime, timeAgo, clinicName, clinicArea, clinicState,
  stockCounts, slotsFor, mapsUrl, isPhone, weekday,
} from './core.js';
import { APP } from './config.js';
import { MEDICINES, CATS } from './data.js';
import { makeT } from './i18n.js';

load();
const P = prefs('app');
const S = {
  route: 'home', lang: P.get('lang', 'en'), clinicId: P.get('clinic', null),
  recTab: 'appts', medCat: 'all', medStatus: null,
  type: 'visit', reason: 'bp', date: null, time: null, err: '', booked: null, cancelArm: null, installEvt: null,
};
const t = makeT(() => S.lang);
document.documentElement.lang = S.lang;
document.title = APP.name;

const ROUTES = ['pick', 'home', 'meds', 'book', 'ask', 'records', 'settings'];
const profile = () => P.get('profile', { name: '', phone: '' });
const clinic = () => db().clinics.find((c) => c.id === S.clinicId);
const cname = (c) => esc(clinicName(c, S.lang));

function setProfile(name, phone) {
  P.set('profile', { name, phone });
  for (const k of ['b', 'q', 'p']) { draft[k + '.name'] = name; draft[k + '.phone'] = phone; }
}
function prefill() {
  const p = profile();
  for (const k of ['b', 'q', 'p']) {
    if (draft[k + '.name'] === undefined) draft[k + '.name'] = p.name;
    if (draft[k + '.phone'] === undefined) draft[k + '.phone'] = p.phone;
  }
}

/* ---------- shared bits ---------- */
const LEVEL_ICON = { good: 'circle-check', warn: 'triangle-alert', bad: 'circle-x', stale: 'clock' };
const stLabel = (c) => t('st.' + clinicState(c).level);

function top(c) {
  if (!c) return `<header class="top top--plain"><div class="top__clinic"><span class="top__name">${esc(APP.name)}</span></div></header>`;
  return `<header class="top">
    <button class="top__clinic" data-act="go" data-val="pick"><span class="top__label">${t('yourClinic')}</span>
      <span class="top__name"><span>${cname(c)}</span>${icon('chevron-right')}</span></button>
    <button class="icon-btn" data-act="go" data-val="settings" aria-label="${t('nav.settings')}">${icon('settings')}</button>
  </header>`;
}
const NAV = [['home', 'house'], ['meds', 'pill'], ['book', 'calendar-plus'], ['ask', 'message-circle-question'], ['records', 'clipboard-list']];
const nav = () => `<nav class="nav" aria-label="Main">${NAV.map(([r, ic]) =>
  `<button class="nav__item ${S.route === r ? 'nav__item--on' : ''}" data-act="nav" data-val="${r}" ${S.route === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t('nav.' + r)}</span></button>`).join('')}</nav>`;
const shell = (c, body) => `<div class="app">${top(c)}<main class="page">${body}</main>${nav()}</div>`;
const langSeg = () => `<div class="seg" role="group" aria-label="${t('language')}">
  <button class="seg__b ${S.lang === 'en' ? 'seg__b--on' : ''}" data-act="lang" data-val="en">English</button>
  <button class="seg__b ${S.lang === 'te' ? 'seg__b--on' : ''}" data-act="lang" data-val="te">తెలుగు</button></div>`;
const chip = (cls, text) => `<span class="chip chip--${cls}">${text}</span>`;
const empty = (ic, text) => `<div class="empty">${icon(ic)}<div>${text}</div></div>`;

/* ---------- pick clinic ---------- */
function pickView() {
  const cl = db().clinics;
  return `<div class="app">
    <div class="hero-intro">
      <div class="brand"><div class="brand__logo">${icon('hospital')}</div>
        <div><div class="brand__n">${esc(APP.name)}</div><div class="brand__t">${esc(APP.tagline[S.lang])}</div></div></div>
      <h1>${t('pick.title')}</h1>
    </div>
    <div class="page">
      ${langSeg()}<div class="sp"></div>
      ${cl.map((c) => {
        const lv = clinicState(c).level;
        return `<button class="pick ${c.id === S.clinicId ? 'pick--on' : ''}" data-act="choose" data-id="${c.id}">
          <span class="dot dot--${lv}"></span>
          <span class="row__body"><span class="row__t" style="display:block">${cname(c)}</span>
          <span class="row__s" style="display:block">${esc(clinicArea(c, S.lang))}</span>
          <span class="row__s" style="display:block;font-weight:600">${stLabel(c)}</span></span>
          ${icon('chevron-right')}</button>`;
      }).join('')}
      ${S.clinicId && clinic() ? `<div class="sp"></div><button class="btn btn--ghost btn--block" data-act="go" data-val="home">${icon('arrow-left')} ${t('back')}</button>` : ''}
    </div></div>`;
}

/* ---------- home ---------- */
function homeView(c) {
  const st = clinicState(c);
  const days = c.closedDays.map((d) => weekday(d, S.lang)).join(', ');
  const counts = stockCounts(c);
  const outList = MEDICINES.filter((m) => c.stock[m.id] === 'out').slice(0, 6);
  const others = db().clinics.filter((x) => x.id !== c.id && clinicState(x).level === 'good');
  const p = profile();
  const mine = p.phone ? db().appointments.filter((a) => a.clinicId === c.id && a.phone === p.phone && ['pending', 'confirmed'].includes(a.status) && a.date >= todayStr())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] : null;
  return `
  <section class="status status--${st.level}" aria-live="polite">
    <div class="status__main">
      <div class="status__ic">${icon(LEVEL_ICON[st.level])}</div>
      <div><div class="status__big">${t('hero.' + st.level + '.big')}</div><div class="status__sub">${t('hero.' + st.level + '.sub')}</div></div>
    </div>
    <div class="status__meta">
      <div>${icon('clock')}<span>${t('hours')}: ${fmtTime(c.open, S.lang)} – ${fmtTime(c.close, S.lang)}${days ? ` · ${t('closedOn')} ${days}` : ''}</span></div>
      <div>${icon('refresh-cw')}<span>${t('updated')} ${timeAgo(c.statusUpdatedAt, t)}</span></div>
    </div>
  </section>
  <div class="sp"></div>
  <section class="card">
    <div class="row"><div class="row__ic">${icon('map-pin')}</div>
      <div class="row__body"><div class="row__t">${esc(c.address)}</div></div></div>
    <div class="sp-s"></div>
    <div class="stack" style="gap:8px">
      <a class="btn btn--soft btn--block" href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">${icon('external-link')} ${t('openMaps')}</a>
      <a class="btn btn--ghost btn--block" href="tel:${esc(c.phone)}">${icon('phone')} ${t('call')} · ${esc(c.phone)}</a>
    </div>
  </section>
  ${st.level !== 'good' && others.length ? `<div class="sp"></div><section class="card">
    <div class="h2">${t('others.title')}</div><div class="sp-s"></div>
    ${others.map((x) => `<div class="row" style="padding:6px 0"><span class="dot dot--good" style="width:12px;height:12px;border-radius:50%;flex:none"></span>
      <div class="row__body"><div class="row__t">${cname(x)}</div><div class="row__s">${stLabel(x)}</div></div>
      <button class="btn btn--soft btn--sm" data-act="choose" data-id="${x.id}">${t('switch')}</button></div>`).join('')}
  </section>` : ''}
  ${mine ? `<div class="sp"></div><button class="card row" style="width:100%;text-align:left" data-act="nav" data-val="records">
    <div class="row__ic">${icon('calendar-check')}</div>
    <div class="row__body"><div class="row__t">${t('yourAppt')}</div>
    <div class="row__s">${fmtDate(mine.date, S.lang)} · ${fmtTime(mine.time, S.lang)}</div></div>${chip(mine.status, t('as.' + mine.status))}</button>` : ''}
  <div class="sp"></div>
  <div class="tiles">
    <button class="tile tile--a" data-act="nav" data-val="meds"><span class="tile__ic">${icon('pill')}</span>
      <span class="tile__t">${t('nav.meds')}</span><span class="tile__s">${counts.out ? t('tile.meds.out', { n: counts.out }) : t('tile.meds.ok')}</span></button>
    <button class="tile" data-act="startBook" data-val="visit"><span class="tile__ic">${icon('calendar-plus')}</span>
      <span class="tile__t">${t('tile.book')}</span><span class="tile__s">${t('tile.book.s')}</span></button>
    <button class="tile tile--b" data-act="startBook" data-val="online"><span class="tile__ic">${icon('phone-call')}</span>
      <span class="tile__t">${t('tile.online')}</span><span class="tile__s">${t('tile.online.s')}</span></button>
    <button class="tile tile--c" data-act="nav" data-val="ask"><span class="tile__ic">${icon('message-circle-question')}</span>
      <span class="tile__t">${t('tile.ask')}</span><span class="tile__s">${t('tile.ask.s')}</span></button>
  </div>
  <div class="sp"></div>
  <section class="card">
    <div class="h2">${t('outNow')}</div><div class="sp-s"></div>
    ${outList.length ? `<div class="wrap">${outList.map((m) => chip('out', esc(m.name))).join('')}</div>`
      : `<div class="row">${icon('circle-check')}<span style="font-weight:600;color:var(--good)">${t('allIn')}</span></div>`}
    <div class="hint">${t('stockUpdated')} ${timeAgo(c.stockUpdatedAt, t)}</div>
  </section>`;
}

/* ---------- medicines ---------- */
function medsView(c) {
  const counts = stockCounts(c);
  const q = (draft['m.q'] || '').trim().toLowerCase();
  const list = MEDICINES.filter((m) => (S.medCat === 'all' || m.cat === S.medCat)
    && (!S.medStatus || c.stock[m.id] === S.medStatus) && (!q || m.name.toLowerCase().includes(q)));
  const sum = (k) => `<button class="sum sum--${k} ${S.medStatus === k ? 'sum--sel' : ''}" data-act="medStatus" data-val="${k}" aria-pressed="${S.medStatus === k}"><b>${counts[k]}</b><span>${t('stock.' + k)}</span></button>`;
  const groups = CATS.map((cat) => ({ cat, items: list.filter((m) => m.cat === cat) })).filter((g) => g.items.length);
  return `
  <h1 class="h1">${t('meds.title')}</h1>
  <div class="muted small">${t('stockUpdated')} ${timeAgo(c.stockUpdatedAt, t)}</div><div class="sp"></div>
  <div class="sumbar">${sum('in')}${sum('low')}${sum('out')}</div><div class="sp"></div>
  <div class="search">${icon('search')}<input class="input" type="search" data-draft="m.q" data-live placeholder="${t('meds.search')}" value="${val('m.q')}" aria-label="${t('meds.search')}"></div>
  <div class="sp-s"></div>
  <div class="filters">${['all', ...CATS].map((k) => `<button class="fbtn ${S.medCat === k ? 'fbtn--on' : ''}" data-act="medCat" data-val="${k}">${t('cat.' + k)}</button>`).join('')}</div>
  ${groups.length ? groups.map((g) => `<div class="group">${t('cat.' + g.cat)}</div>${g.items.map((m) => `
    <div class="med"><span class="med__dot med__dot--${c.stock[m.id]}"></span><span class="med__n">${esc(m.name)}</span>${chip(c.stock[m.id], t('stock.' + c.stock[m.id]))}</div>`).join('')}`).join('')
    : empty('search', t('meds.none'))}`;
}

/* ---------- book ---------- */
function openDates(c) {
  return Array.from({ length: 7 }, (_, i) => {
    const ds = dateStr(i);
    const ok = slotsFor(c, ds).some((s) => !s.past && s.left > 0);
    return { ds, ok };
  });
}
function bookView(c) {
  if (S.booked) {
    const a = db().appointments.find((x) => x.id === S.booked.id) || S.booked;
    return `<div class="center"><div class="ok-big">${icon('check')}</div>
      <h1 class="h1">${t('book.sent')}</h1><div class="muted">${t('book.sent.s')}</div></div><div class="sp"></div>
      <section class="card">
        <div class="kv"><span>${t('clinic')}</span><span>${cname(c)}</span></div>
        <div class="kv"><span>${t('type')}</span><span>${t('type.' + a.type)}</span></div>
        <div class="kv"><span>${t('date')}</span><span>${fmtDate(a.date, S.lang, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
        <div class="kv"><span>${t('time')}</span><span>${fmtTime(a.time, S.lang)}</span></div>
        <div class="kv"><span>${t('status')}</span><span>${chip(a.status, t('as.' + a.status))}</span></div>
      </section><div class="sp"></div>
      <button class="btn btn--primary btn--block" data-act="nav" data-val="records">${t('book.viewRecords')}</button><div class="sp-s"></div>
      <button class="btn btn--ghost btn--block" data-act="bookAgain">${t('book.another')}</button>`;
  }
  const dates = openDates(c);
  if (!S.date || !dates.find((d) => d.ds === S.date && d.ok)) { S.date = (dates.find((d) => d.ok) || {}).ds || null; S.time = null; }
  const slots = S.date ? slotsFor(c, S.date) : [];
  return `
  <h1 class="h1">${t('book.title')}</h1><div class="sp"></div>
  <div class="seg" role="group">
    <button class="seg__b ${S.type === 'visit' ? 'seg__b--on' : ''}" data-act="setType" data-val="visit">${icon('hospital')} ${t('type.visit')}</button>
    <button class="seg__b ${S.type === 'online' ? 'seg__b--on' : ''}" data-act="setType" data-val="online">${icon('phone-call')} ${t('type.online')}</button>
  </div>
  ${S.type === 'online' ? `<div class="note"><b>${t('type.online')}</b>${t('book.online.help')}</div>` : ''}
  <div class="sp"></div>
  <div class="label">${t('book.reason')}</div>
  <div class="reasons">${['bp', 'diabetes', 'refill', 'fever', 'other'].map((r) => `<button class="fbtn ${S.reason === r ? 'fbtn--on' : ''}" data-act="setReason" data-val="${r}">${t('reason.' + r)}</button>`).join('')}</div>
  <div class="sp"></div>
  <div class="label">${t('book.date')}</div>
  <div class="datestrip">${dates.map((d) => `<button class="dp ${S.date === d.ds ? 'dp--on' : ''} ${d.ok ? '' : 'dp--off'}" data-act="setDate" data-val="${d.ds}" aria-label="${fmtDate(d.ds, S.lang)}">
    <small>${fmtDate(d.ds, S.lang, { weekday: 'short' })}</small><b>${Number(d.ds.slice(8))}</b><small>${fmtDate(d.ds, S.lang, { month: 'short' })}</small></button>`).join('')}</div>
  <div class="sp"></div>
  <div class="label">${t('book.time')}</div>
  ${slots.length ? `<div class="slots">${slots.map((s) => `<button class="slot ${S.time === s.time ? 'slot--on' : ''} ${s.past || s.left < 1 ? 'slot--off' : ''}" data-act="setTime" data-val="${s.time}">${fmtTime(s.time, S.lang)}</button>`).join('')}</div>`
    : `<div class="muted">${t('book.noslots')}</div>`}
  <div class="sp"></div>
  <label class="field"><span class="label">${t('yourName')}</span><input class="input" data-draft="b.name" value="${val('b.name')}" autocomplete="name"></label><div class="sp-s"></div>
  <label class="field"><span class="label">${t('yourPhone')}</span><input class="input" data-draft="b.phone" value="${val('b.phone')}" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="98XXXXXXXX"></label>
  ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
  <div class="sp"></div>
  <button class="btn btn--primary btn--block" data-act="submitBook">${icon('calendar-check')} ${t('book.confirm')}</button>`;
}

/* ---------- ask ---------- */
function askView(c) {
  const p = profile();
  const mine = p.phone ? db().queries.filter((q) => q.clinicId === c.id && q.phone === p.phone).sort((a, b) => b.createdAt - a.createdAt) : [];
  return `
  <h1 class="h1">${t('ask.title')}</h1><div class="muted">${t('ask.sub')}</div><div class="sp"></div>
  <label class="field"><span class="label">${t('ask.q')}</span><textarea class="textarea" data-draft="q.text" maxlength="300" placeholder="${t('ask.ph')}">${val('q.text')}</textarea></label><div class="sp-s"></div>
  <label class="field"><span class="label">${t('yourName')}</span><input class="input" data-draft="q.name" value="${val('q.name')}" autocomplete="name"></label><div class="sp-s"></div>
  <label class="field"><span class="label">${t('yourPhone')}</span><input class="input" data-draft="q.phone" value="${val('q.phone')}" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="98XXXXXXXX"></label>
  ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
  <div class="sp"></div>
  <button class="btn btn--primary btn--block" data-act="submitAsk">${icon('send')} ${t('ask.send')}</button>
  ${mine.length ? `<div class="group">${t('ask.yours')}</div>${mine.map(qCard).join('')}` : ''}`;
}
function qCard(q) {
  const c = db().clinics.find((x) => x.id === q.clinicId);
  return `<div class="card"><div class="row__s">${c ? cname(c) : ''} · ${timeAgo(q.createdAt, t)}</div>
    <div class="row__t" style="font-weight:600;margin-top:2px">${esc(q.text)}</div>
    ${q.reply ? `<div class="note"><b>${t('fromClinic')}</b>${esc(q.reply)}</div>` : `<div style="margin-top:8px">${chip('pending', t('waiting'))}</div>`}</div>`;
}

/* ---------- records ---------- */
function recordsView() {
  const p = profile();
  const appts = p.phone ? db().appointments.filter((a) => a.phone === p.phone).sort((a, b) => b.createdAt - a.createdAt) : [];
  const qs = p.phone ? db().queries.filter((q) => q.phone === p.phone).sort((a, b) => b.createdAt - a.createdAt) : [];
  const tab = S.recTab;
  return `
  <h1 class="h1">${t('rec.title')}</h1>
  ${p.name ? `<div class="muted">${esc(p.name)} · ${esc(p.phone)}</div>` : ''}<div class="sp"></div>
  <div class="seg"><button class="seg__b ${tab === 'appts' ? 'seg__b--on' : ''}" data-act="recTab" data-val="appts">${t('rec.appts')} (${appts.length})</button>
  <button class="seg__b ${tab === 'qs' ? 'seg__b--on' : ''}" data-act="recTab" data-val="qs">${t('rec.qs')} (${qs.length})</button></div><div class="sp"></div>
  ${tab === 'appts' ? (appts.length ? appts.map(apptCard).join('') : empty('calendar-days', t('rec.noAppts')))
    : (qs.length ? qs.map(qCard).join('') : empty('message-circle-question', t('rec.noQs')))}`;
}
function apptCard(a) {
  const c = db().clinics.find((x) => x.id === a.clinicId);
  const active = ['pending', 'confirmed'].includes(a.status);
  return `<div class="card">
    <div class="row" style="align-items:flex-start"><div class="row__body">
      <div class="row__t">${fmtDate(a.date, S.lang, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(a.time, S.lang)}</div>
      <div class="row__s">${c ? cname(c) : ''}</div></div>${chip(a.status, t('as.' + a.status))}</div>
    <div class="wrap" style="margin-top:10px"><span class="tag">${icon(a.type === 'online' ? 'phone-call' : 'hospital', '')}${t('type.' + a.type)}</span><span class="tag">${t('reason.' + a.reason)}</span></div>
    ${a.note ? `<div class="note"><b>${t('fromClinic')}</b>${esc(a.note)}</div>` : ''}
    ${active ? `<div class="sp-s"></div><button class="btn btn--danger btn--sm" data-act="cancelAppt" data-id="${a.id}">${S.cancelArm === a.id ? t('cancel.sure') : t('cancel')}</button>` : ''}
  </div>`;
}

/* ---------- settings ---------- */
function settingsView(c) {
  return `
  <h1 class="h1">${t('nav.settings')}</h1><div class="sp"></div>
  <section class="card"><div class="label">${icon('languages')} ${t('language')}</div>${langSeg()}</section>
  <section class="card"><div class="label">${t('yourClinic')}</div>
    ${c ? `<div class="row"><div class="row__body"><div class="row__t">${cname(c)}</div><div class="row__s">${esc(clinicArea(c, S.lang))}</div></div>
    <button class="btn btn--soft btn--sm" data-act="go" data-val="pick">${t('change')}</button></div>`
      : `<button class="btn btn--primary btn--block" data-act="go" data-val="pick">${t('pick.cta')}</button>`}</section>
  <section class="card"><div class="label">${t('profile')}</div>
    <label class="field"><span class="small muted">${t('yourName')}</span><input class="input" data-draft="p.name" value="${val('p.name')}" autocomplete="name"></label><div class="sp-s"></div>
    <label class="field"><span class="small muted">${t('yourPhone')}</span><input class="input" data-draft="p.phone" value="${val('p.phone')}" inputmode="numeric" maxlength="10" placeholder="98XXXXXXXX"></label>
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}<div class="sp-s"></div>
    <button class="btn btn--primary btn--block" data-act="saveProfile">${t('save')}</button>
    <div class="hint">${t('profile.hint')}</div></section>
  ${S.installEvt ? `<button class="btn btn--ghost btn--block" data-act="install">${icon('download')} ${t('install')}</button>` : `<div class="card small muted">${icon('download')} ${t('install.hint')}</div>`}
`;
}

/* ---------- router/view ---------- */
function build() {
  prefill();
  const c = clinic();
  let r = S.route;
  if (!c && r !== 'settings') r = 'pick';
  if (r === 'pick') return pickView();
  const body = { home: homeView, meds: medsView, book: bookView, ask: askView, records: recordsView, settings: settingsView }[r](c);
  return shell(c, body);
}

const readHash = () => { const r = location.hash.replace(/^#\//, ''); S.route = ROUTES.includes(r) ? r : 'home'; };
function go(r) {
  S.err = ''; S.cancelArm = null;
  if (location.hash === '#/' + r) { S.route = r; window.scrollTo(0, 0); view.render(); } else location.hash = '#/' + r;
}
window.addEventListener('hashchange', () => { readHash(); S.err = ''; window.scrollTo(0, 0); view.render(); });

const fail = (k) => { S.err = t(k); view.render(); };

const actions = {
  go: (d) => go(d.val),
  nav: (d) => { if (d.val === 'book') S.booked = null; go(d.val); },
  choose: (d) => { S.clinicId = d.id; P.set('clinic', d.id); S.date = null; S.time = null; S.booked = null; S.medCat = 'all'; S.medStatus = null; go('home'); },
  lang: (d) => { S.lang = d.val; P.set('lang', d.val); document.documentElement.lang = d.val; view.render(); },
  medCat: (d) => { S.medCat = d.val; view.render(); },
  medStatus: (d) => { S.medStatus = S.medStatus === d.val ? null : d.val; view.render(); },
  startBook: (d) => { S.type = d.val; S.booked = null; go('book'); },
  setType: (d) => { S.type = d.val; view.render(); },
  setReason: (d) => { S.reason = d.val; view.render(); },
  setDate: (d) => { S.date = d.val; S.time = null; view.render(); },
  setTime: (d) => { S.time = d.val; S.err = ''; view.render(); },
  bookAgain: () => { S.booked = null; view.render(); window.scrollTo(0, 0); },
  recTab: (d) => { S.recTab = d.val; view.render(); },
  submitBook: () => {
    const c = clinic();
    const name = (draft['b.name'] || '').trim(), phone = (draft['b.phone'] || '').trim();
    if (!S.date || !S.time) return fail('err.slot');
    if (name.length < 2) return fail('err.name');
    if (!isPhone(phone)) return fail('err.phone');
    if (db().appointments.some((x) => x.clinicId === c.id && x.phone === phone && x.date === S.date && x.time === S.time && x.status !== 'cancelled')) return fail('err.dup');
    const slot = slotsFor(c, S.date).find((x) => x.time === S.time);
    if (!slot || slot.past || slot.left < 1) { S.time = null; return fail('err.taken'); }
    const a = { id: uid('a'), clinicId: c.id, name, phone, type: S.type, reason: S.reason, date: S.date, time: S.time, status: 'pending', note: '', createdAt: Date.now() };
    update((d) => d.appointments.push(a));
    setProfile(name, phone);
    S.booked = a; S.err = ''; S.time = null; view.render(); window.scrollTo(0, 0);
  },
  submitAsk: () => {
    const c = clinic();
    const text = (draft['q.text'] || '').trim(), name = (draft['q.name'] || '').trim(), phone = (draft['q.phone'] || '').trim();
    if (text.length < 5) return fail('err.text');
    if (name.length < 2) return fail('err.name');
    if (!isPhone(phone)) return fail('err.phone');
    update((d) => d.queries.push({ id: uid('q'), clinicId: c.id, name, phone, text, createdAt: Date.now(), reply: '', repliedAt: 0 }));
    setProfile(name, phone); draft['q.text'] = ''; S.err = ''; view.render(); toast(t('ask.done'));
  },
  cancelAppt: (d) => {
    if (S.cancelArm !== d.id) { S.cancelArm = d.id; view.render(); return; }
    S.cancelArm = null;
    update((x) => { const a = x.appointments.find((i) => i.id === d.id); if (a) a.status = 'cancelled'; });
    toast(t('cancel.done'));
  },
  saveProfile: () => {
    const name = (draft['p.name'] || '').trim(), phone = (draft['p.phone'] || '').trim();
    if (name.length < 2) return fail('err.name');
    if (!isPhone(phone)) return fail('err.phone');
    setProfile(name, phone); S.err = ''; view.render(); toast(t('saved'));
  },
  install: async () => { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; view.render(); } },
};

const view = mount(document.getElementById('app'), build, actions);
onChange(() => view.soft());
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; view.soft(); });
readHash();
view.render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
