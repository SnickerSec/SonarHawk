import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

/**
 * Initialize database schema
 */
export async function initDatabase() {
  try {
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = await readFile(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Query helper
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Transaction helper
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Schedule queries
export const schedules = {
  async create(schedule) {
    const result = await query(
      `INSERT INTO schedules
       (name, description, sonar_url, sonar_component, sonar_token, sonar_organization, branch, cron_expression, timezone, enabled, report_options)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        schedule.name,
        schedule.description,
        schedule.sonarUrl,
        schedule.sonarComponent,
        schedule.sonarToken,
        schedule.sonarOrganization,
        schedule.branch,
        schedule.cronExpression,
        schedule.timezone || 'UTC',
        schedule.enabled ?? true,
        JSON.stringify(schedule.reportOptions || {})
      ]
    );
    return result.rows[0];
  },

  async update(id, schedule) {
    const result = await query(
      `UPDATE schedules
       SET name = $1, description = $2, sonar_url = $3, sonar_component = $4,
           sonar_token = $5, sonar_organization = $6, branch = $7,
           cron_expression = $8, timezone = $9, enabled = $10, report_options = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        schedule.name,
        schedule.description,
        schedule.sonarUrl,
        schedule.sonarComponent,
        schedule.sonarToken,
        schedule.sonarOrganization,
        schedule.branch,
        schedule.cronExpression,
        schedule.timezone || 'UTC',
        schedule.enabled ?? true,
        JSON.stringify(schedule.reportOptions || {}),
        id
      ]
    );
    return result.rows[0];
  },

  async delete(id) {
    await query('DELETE FROM schedules WHERE id = $1', [id]);
  },

  async getAll() {
    const result = await query('SELECT * FROM schedules ORDER BY created_at DESC');
    return result.rows;
  },

  async getById(id) {
    const result = await query('SELECT * FROM schedules WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getEnabled() {
    const result = await query('SELECT * FROM schedules WHERE enabled = true');
    return result.rows;
  },

  async toggleEnabled(id, enabled) {
    const result = await query(
      'UPDATE schedules SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [enabled, id]
    );
    return result.rows[0];
  }
};

// Email recipient queries
export const emailRecipients = {
  async add(scheduleId, email, name) {
    const result = await query(
      'INSERT INTO email_recipients (schedule_id, email, name) VALUES ($1, $2, $3) ON CONFLICT (schedule_id, email) DO UPDATE SET name = $3 RETURNING *',
      [scheduleId, email, name]
    );
    return result.rows[0];
  },

  async remove(scheduleId, email) {
    await query('DELETE FROM email_recipients WHERE schedule_id = $1 AND email = $2', [scheduleId, email]);
  },

  async getBySchedule(scheduleId) {
    const result = await query('SELECT * FROM email_recipients WHERE schedule_id = $1', [scheduleId]);
    return result.rows;
  }
};

// Job execution queries
export const jobExecutions = {
  async create(scheduleId) {
    const result = await query(
      'INSERT INTO job_executions (schedule_id, status, started_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
      [scheduleId, 'running']
    );
    return result.rows[0];
  },

  async updateSuccess(id, reportPath, emailSent) {
    const result = await query(
      `UPDATE job_executions
       SET status = $1, completed_at = CURRENT_TIMESTAMP,
           duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
           report_path = $2, email_sent = $3
       WHERE id = $4 RETURNING *`,
      ['success', reportPath, emailSent, id]
    );
    return result.rows[0];
  },

  async updateFailure(id, errorMessage, emailError = null) {
    const result = await query(
      `UPDATE job_executions
       SET status = $1, completed_at = CURRENT_TIMESTAMP,
           duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
           error_message = $2, email_error = $3
       WHERE id = $4 RETURNING *`,
      ['failed', errorMessage, emailError, id]
    );
    return result.rows[0];
  },

  async getBySchedule(scheduleId, limit = 10) {
    const result = await query(
      'SELECT * FROM job_executions WHERE schedule_id = $1 ORDER BY started_at DESC LIMIT $2',
      [scheduleId, limit]
    );
    return result.rows;
  },

  async getRecent(limit = 20) {
    const result = await query(
      'SELECT * FROM job_executions ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }
};

// Email template queries
export const emailTemplates = {
  async get(name) {
    const result = await query('SELECT * FROM email_templates WHERE name = $1', [name]);
    return result.rows[0];
  },

  async getDefault() {
    const result = await query('SELECT * FROM email_templates WHERE is_default = true');
    return result.rows[0];
  }
};

export default pool;
