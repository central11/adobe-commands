const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChickozIndustrialSolvents****^';
const DATA_FILE = path.join(__dirname, 'workflows.json');
const VALID_APPS = new Set(['ps', 'ai', 'id', 'pr']);

app.use(express.json());
app.use(express.static(__dirname));

function readStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEntry(body) {
  const n = typeof body.n === 'string' ? body.n.trim() : '';
  const s = typeof body.s === 'string' ? body.s.trim() : '';
  const t = Array.isArray(body.t)
    ? body.t.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (!n || !s) {
    return null;
  }
  return { n, s, t };
}

function ensureApp(store, appId) {
  if (!Array.isArray(store[appId])) {
    store[appId] = [];
  }
}

function requireAuth(req, res, next) {
  const pwd = req.get('x-admin-password') || '';
  if (pwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.post('/api/auth', (req, res) => {
  const pwd = req.body && req.body.password ? String(req.body.password) : '';
  if (pwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ ok: true });
});

app.get('/api/workflows', (_req, res) => {
  return res.json(readStore());
});

app.post('/api/workflows/:appId', requireAuth, (req, res) => {
  const appId = req.params.appId;
  if (!VALID_APPS.has(appId)) {
    return res.status(400).json({ error: 'Invalid appId' });
  }

  const entry = normalizeEntry(req.body || {});
  if (!entry) {
    return res.status(400).json({ error: 'Invalid workflow payload' });
  }

  const store = readStore();
  ensureApp(store, appId);
  const created = { id: crypto.randomUUID(), ...entry };
  store[appId].push(created);
  writeStore(store);
  return res.status(201).json(created);
});

app.put('/api/workflows/:appId/:workflowId', requireAuth, (req, res) => {
  const appId = req.params.appId;
  const workflowId = req.params.workflowId;
  if (!VALID_APPS.has(appId)) {
    return res.status(400).json({ error: 'Invalid appId' });
  }

  const entry = normalizeEntry(req.body || {});
  if (!entry) {
    return res.status(400).json({ error: 'Invalid workflow payload' });
  }

  const store = readStore();
  ensureApp(store, appId);
  const idx = store[appId].findIndex((w) => w.id === workflowId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  store[appId][idx] = { id: workflowId, ...entry };
  writeStore(store);
  return res.json(store[appId][idx]);
});

app.delete('/api/workflows/:appId/:workflowId', requireAuth, (req, res) => {
  const appId = req.params.appId;
  const workflowId = req.params.workflowId;
  if (!VALID_APPS.has(appId)) {
    return res.status(400).json({ error: 'Invalid appId' });
  }

  const store = readStore();
  ensureApp(store, appId);
  const before = store[appId].length;
  store[appId] = store[appId].filter((w) => w.id !== workflowId);
  if (store[appId].length === before) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  writeStore(store);
  return res.status(204).send();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
