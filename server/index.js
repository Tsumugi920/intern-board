// InternBoard - 校园实习招聘平台
// Node.js + Express, data persisted in server/data.json, no database.
// Resources: companies, jobs, applications, resumes, interviews, favorites, messages.
// Hardening (mirrors teamspace): client-supplied id is ignored on create,
// PUT cannot change id/createdAt, status values are whitelisted, salary
// ranges are validated, duplicate applications / duplicate favorites -> 409,
// applying to a closed job -> 409, application status transitions are enforced.
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT) || 3033;
const DATA = path.join(__dirname, 'data.json');
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function load() { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
function save(d) { fs.writeFileSync(DATA, JSON.stringify(d, null, 2)); }
function nextId(list) { return list.length ? Math.max(...list.map(x => x.id)) + 1 : 1; }
function page(list, q) {
  const p = Math.max(1, Number(q.page) || 1), s = Math.min(50, Number(q.size) || 20);
  return { total: list.length, page: p, size: s, items: list.slice((p - 1) * s, p * s) };
}
function clean(body) {
  const b = { ...body };
  delete b.id;
  delete b.createdAt;
  return b;
}

const JOB_STATUS = ['open', 'closed'];
const APP_STATUS = ['投递', '初筛', '面试', 'offer', '拒绝'];
const APP_TRANSITIONS = {
  '投递': ['初筛', '拒绝'],
  '初筛': ['面试', '拒绝'],
  '面试': ['offer', '拒绝'],
  'offer': ['拒绝'],
  '拒绝': []
};
const INTERVIEW_RESULT = ['待定', '通过', '未通过'];
const RESUME_VISIBILITY = ['公开', '私密'];

function badSalary(body) {
  for (const f of ['salaryMin', 'salaryMax']) {
    if (body[f] !== undefined && (!Number.isFinite(Number(body[f])) || Number(body[f]) < 0)) return true;
  }
  if (body.salaryMin !== undefined && body.salaryMax !== undefined && Number(body.salaryMin) > Number(body.salaryMax)) return true;
  return false;
}
function sortList(list, q, allowed) {
  const sort = q.sort, order = q.order === 'desc' ? -1 : 1;
  if (!sort || !allowed.includes(sort)) return list;
  return [...list].sort((a, b) => {
    const av = a[sort], bv = b[sort];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * order;
    return String(av).localeCompare(String(bv), 'zh') * order;
  });
}
function search(list, q) {
  if (!q.q) return list;
  return list.filter(x => JSON.stringify(x).includes(q.q));
}

// Generic CRUD: GET list (filter + q + sort + page), GET one, POST, PUT, DELETE.
function crud(base, key, filterFields, opts) {
  opts = opts || {};
  app.get('/api/' + base, (req, res) => {
    const d = load(); let out = d[key];
    filterFields.forEach(f => { if (req.query[f] !== undefined) out = out.filter(x => String(x[f]) === String(req.query[f])); });
    out = search(out, req.query);
    out = sortList(out, req.query, opts.sortable || []);
    res.json(page(out, req.query));
  });
  app.get('/api/' + base + '/:id', (req, res) => {
    const d = load(); const x = d[key].find(i => i.id === Number(req.params.id));
    if (!x) return res.status(404).json({ error: 'not found' });
    res.json(x);
  });
  app.post('/api/' + base, (req, res) => {
    if (opts.statusValues && req.body.status !== undefined && !opts.statusValues.includes(req.body.status)) return res.status(400).json({ error: 'bad status' });
    if (opts.validate) { const err = opts.validate(req.body, load()); if (err) return res.status(err.code).json({ error: err.msg }); }
    const d = load(); const body = clean(req.body);
    const x = { id: nextId(d[key]), ...body, createdAt: new Date().toISOString().slice(0, 10) };
    if (opts.defaults) Object.assign(x, opts.defaults, body);
    d[key].push(x); save(d); res.status(201).json(x);
  });
  app.put('/api/' + base + '/:id', (req, res) => {
    if (opts.statusValues && req.body.status !== undefined && !opts.statusValues.includes(req.body.status)) return res.status(400).json({ error: 'bad status' });
    if (opts.validatePut) { const err = opts.validatePut(req.body, load()); if (err) return res.status(err.code).json({ error: err.msg }); }
    const d = load(); const x = d[key].find(i => i.id === Number(req.params.id));
    if (!x) return res.status(404).json({ error: 'not found' });
    Object.assign(x, clean(req.body)); save(d); res.json(x);
  });
  app.delete('/api/' + base + '/:id', (req, res) => {
    const d = load(); const i = d[key].findIndex(x => x.id === Number(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'not found' });
    d[key].splice(i, 1); save(d); res.json({ ok: true });
  });
}

function applyValidation(body, d, jobId) {
  const job = d.jobs.find(j => j.id === Number(jobId !== undefined ? jobId : body.jobId));
  if (!job) return { code: 404, msg: 'job not found' };
  if (job.status === 'closed') return { code: 409, msg: 'job is closed' };
  const dup = d.applications.find(a => a.jobId === job.id && a.applicant === body.applicant && a.studentId === body.studentId);
  if (dup) return { code: 409, msg: 'already applied to this job' };
  return null;
}

// Companies: verified flag, industry/location filters
crud('companies', 'companies', ['industry', 'location', 'verified']);

// Jobs: salary validation + status whitelist + sort by salary/deadline/views
crud('jobs', 'jobs', ['companyId', 'company', 'type', 'location', 'status'], {
  statusValues: JOB_STATUS,
  sortable: ['salaryMin', 'salaryMax', 'deadline', 'views'],
  validate: (body) => badSalary(body) ? { code: 400, msg: 'bad salary range' } : null,
  validatePut: (body) => badSalary(body) ? { code: 400, msg: 'bad salary range' } : null
});

// Applications: duplicate + closed-job checks, status whitelist
crud('applications', 'applications', ['jobId', 'applicant', 'status'], {
  statusValues: APP_STATUS,
  validate: (body, d) => applyValidation(body, d)
});

// Resumes: visibility whitelist
crud('resumes', 'resumes', ['studentId', 'major', 'visibility'], {
  validate: (body) => (body.visibility !== undefined && !RESUME_VISIBILITY.includes(body.visibility)) ? { code: 400, msg: 'bad visibility' } : null
});

// Interviews: result whitelist
crud('interviews', 'interviews', ['applicationId', 'interviewer', 'result'], {
  validate: (body) => (body.result !== undefined && !INTERVIEW_RESULT.includes(body.result)) ? { code: 400, msg: 'bad result' } : null,
  validatePut: (body) => (body.result !== undefined && !INTERVIEW_RESULT.includes(body.result)) ? { code: 400, msg: 'bad result' } : null
});

// Favorites: duplicate save (same user + job) -> 409
crud('favorites', 'favorites', ['user', 'jobId'], {
  validate: (body, d) => {
    const dup = d.favorites.find(f => f.user === body.user && Number(f.jobId) === Number(body.jobId));
    return dup ? { code: 409, msg: 'already favorited' } : null;
  }
});

// Messages: thread per application
crud('messages', 'messages', ['applicationId', 'from', 'to']);

// Shortcut: apply to a job (creates an application; duplicate/closed -> 409)
app.post('/api/jobs/:id/apply', (req, res) => {
  const d = load();
  const err = applyValidation(req.body, d, req.params.id);
  if (err) return res.status(err.code).json({ error: err.msg });
  const body = clean(req.body);
  const x = { id: nextId(d.applications), jobId: Number(req.params.id), status: '投递', createdAt: new Date().toISOString().slice(0, 10), ...body, jobId: Number(req.params.id), status: '投递' };
  d.applications.push(x); save(d); res.status(201).json(x);
});

// Shortcut: favorite a job (duplicate -> 409)
app.post('/api/jobs/:id/favorite', (req, res) => {
  const d = load();
  const job = d.jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'job not found' });
  const dup = d.favorites.find(f => f.user === req.body.user && f.jobId === job.id);
  if (dup) return res.status(409).json({ error: 'already favorited' });
  const x = { id: nextId(d.favorites), jobId: job.id, user: req.body.user, createdAt: new Date().toISOString().slice(0, 10) };
  d.favorites.push(x); save(d); res.status(201).json(x);
});

// Application status transition with enforced rules
app.post('/api/applications/:id/transition', (req, res) => {
  const d = load(); const x = d.applications.find(a => a.id === Number(req.params.id));
  if (!x) return res.status(404).json({ error: 'not found' });
  const to = req.body.status;
  if (!APP_STATUS.includes(to)) return res.status(400).json({ error: 'bad status' });
  if (!APP_TRANSITIONS[x.status].includes(to)) return res.status(400).json({ error: 'illegal transition from ' + x.status + ' to ' + to });
  x.status = to; save(d); res.json(x);
});

// Nested lists
app.get('/api/jobs/:id/applications', (req, res) => {
  const d = load();
  if (!d.jobs.find(j => j.id === Number(req.params.id))) return res.status(404).json({ error: 'job not found' });
  res.json(page(d.applications.filter(a => a.jobId === Number(req.params.id)), req.query));
});
app.get('/api/applications/:id/interviews', (req, res) => {
  const d = load();
  if (!d.applications.find(a => a.id === Number(req.params.id))) return res.status(404).json({ error: 'application not found' });
  res.json(page(d.interviews.filter(i => i.applicationId === Number(req.params.id)), req.query));
});
app.get('/api/applications/:id/messages', (req, res) => {
  const d = load();
  if (!d.applications.find(a => a.id === Number(req.params.id))) return res.status(404).json({ error: 'application not found' });
  res.json(page(d.messages.filter(m => m.applicationId === Number(req.params.id)), req.query));
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const d = load();
  const jobsByStatus = {}, appsByStatus = {}, jobsByType = {};
  d.jobs.forEach(j => { jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1; jobsByType[j.type] = (jobsByType[j.type] || 0) + 1; });
  d.applications.forEach(a => { appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1; });
  res.json({
    companies: d.companies.length, jobs: d.jobs.length, applications: d.applications.length,
    resumes: d.resumes.length, interviews: d.interviews.length,
    favorites: d.favorites.length, messages: d.messages.length,
    openJobs: d.jobs.filter(j => j.status === 'open').length,
    jobsByStatus, jobsByType, appsByStatus,
    totalViews: d.jobs.reduce((s, j) => s + Number(j.views || 0), 0),
    offerCount: d.applications.filter(a => a.status === 'offer').length
  });
});

app.listen(PORT, () => console.log('intern-board listening on ' + PORT));
