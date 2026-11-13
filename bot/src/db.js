import { SESSION_MS } from './domain.js';

export class Store {
  constructor(db) { this.db = db; }
  sql(query, ...params) { return this.db.prepare(query).bind(...params); }

  async claim(updateId, now) {
    const claimed = await this.sql(`INSERT INTO updates(update_id, status, lease_until, created_at)
      VALUES (?, 'processing', ?, ?) ON CONFLICT(update_id) DO UPDATE SET lease_until = excluded.lease_until
      WHERE updates.status = 'processing' AND updates.lease_until <= ? RETURNING update_id`,
    updateId, now + 30_000, now, now).first();
    if (claimed) return 'claimed';
    const row = await this.sql('SELECT status FROM updates WHERE update_id = ?', updateId).first();
    return row?.status === 'done' ? 'done' : 'busy';
  }

  async release(updateId) {
    await this.sql("UPDATE updates SET lease_until = 0 WHERE update_id = ? AND status = 'processing'", updateId).run();
  }

  async session(userId, now) {
    const row = await this.sql('SELECT * FROM sessions WHERE user_id = ?', userId).first();
    if (!row || row.updated_at < now - SESSION_MS) return null;
    try { return { kind: row.kind, ...JSON.parse(row.payload) }; } catch { return null; }
  }
  saveSession(userId, kind, data, now) {
    return this.sql(`INSERT INTO sessions(user_id, kind, payload, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload, updated_at = excluded.updated_at`,
    userId, kind, JSON.stringify(data), now);
  }
  clearSession(userId) { return this.sql('DELETE FROM sessions WHERE user_id = ?', userId); }
  calendar() { return this.sql('SELECT * FROM calendar WHERE id = 1').first(); }
  async admins() {
    const { results } = await this.sql('SELECT user_id FROM admins ORDER BY created_at').all();
    return results.map(row => row.user_id);
  }
  application(id) { return this.sql('SELECT * FROM applications WHERE id = ?', id).first(); }
  pending(userId) { return this.sql("SELECT * FROM applications WHERE user_id = ? AND status = 'pending'", userId).first(); }
  latest(userId) { return this.sql('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', userId).first(); }
  roll(updateId) { return this.sql('SELECT * FROM rolls WHERE update_id = ?', updateId).first(); }

  async counts() {
    const { results } = await this.sql('SELECT status, COUNT(*) AS total FROM applications GROUP BY status').all();
    return Object.assign({ pending: 0, accepted: 0, rejected: 0 }, Object.fromEntries(results.map(r => [r.status, r.total])));
  }
  async list(status, offset) {
    const { results } = await this.sql('SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC, rowid DESC LIMIT 6 OFFSET ?', status, offset).all();
    return results;
  }

  async commit(updateId, statements, effects, now) {
    const requests = effects.map((effect, sequence) => {
      const condition = effect.condition || { sql: '1', params: [] };
      return this.sql(`INSERT OR IGNORE INTO outbox(update_id, sequence, method, payload, created_at)
        SELECT ?, ?, ?, ?, ? WHERE ${condition.sql}`, updateId, sequence, effect.method,
      JSON.stringify(effect.payload), now, ...condition.params);
    });
    await this.db.batch([...statements, ...requests,
      this.sql("UPDATE updates SET status = 'done', lease_until = 0 WHERE update_id = ?", updateId)]);
  }

  async flush(send, now, updateId = null) {
    const filter = updateId === null ? '' : ' AND update_id = ?';
    const params = updateId === null ? [now, now] : [now, now, updateId];
    const { results } = await this.sql(`SELECT id FROM outbox WHERE status = 'pending' AND retry_at <= ?
      AND lease_until <= ?${filter} ORDER BY id LIMIT 5`, ...params).all();
    for (const item of results) {
      const row = await this.sql(`UPDATE outbox SET lease_until = ?, attempts = attempts + 1
        WHERE id = ? AND status = 'pending' AND lease_until <= ? RETURNING *`, now + 60_000, item.id, now).first();
      if (!row) continue;
      let result;
      try { result = await send(row.method, JSON.parse(row.payload)); }
      catch { result = { ok: false, retry: true }; }
      if (result.ok) await this.sql("UPDATE outbox SET status = 'sent', lease_until = 0 WHERE id = ?", row.id).run();
      else if (!result.retry) await this.sql("UPDATE outbox SET status = 'failed', lease_until = 0 WHERE id = ?", row.id).run();
      else {
        const wait = Math.max(30_000, Math.min(3_600_000, (result.retryAfter || Math.min(900, 2 ** Math.min(row.attempts, 9))) * 1000));
        await this.sql('UPDATE outbox SET lease_until = 0, retry_at = ? WHERE id = ?', now + wait, row.id).run();
      }
    }
  }

  async cleanup(now) {
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    await this.db.batch([
      this.sql('DELETE FROM sessions WHERE updated_at < ?', now - SESSION_MS),
      this.sql("DELETE FROM outbox WHERE created_at < ? AND status <> 'pending'", cutoff),
      this.sql("DELETE FROM updates WHERE created_at < ? AND status = 'done' AND NOT EXISTS (SELECT 1 FROM outbox WHERE outbox.update_id = updates.update_id)", cutoff),
    ]);
  }
}
