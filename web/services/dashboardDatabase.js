import { query, transaction } from './database.js';

// ============================================
// Projects
// ============================================
export const projects = {
  async create(project) {
    const result = await query(
      `INSERT INTO projects
       (name, description, sonar_url, sonar_component, sonar_token, sonar_organization, branch, sync_enabled, sync_interval_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.name,
        project.description,
        project.sonarUrl,
        project.sonarComponent,
        project.sonarToken,
        project.sonarOrganization,
        project.branch || 'main',
        project.syncEnabled ?? true,
        project.syncIntervalMinutes || 60
      ]
    );
    return result.rows[0];
  },

  async update(id, project) {
    const result = await query(
      `UPDATE projects
       SET name = $1, description = $2, sonar_url = $3, sonar_component = $4,
           sonar_token = $5, sonar_organization = $6, branch = $7,
           sync_enabled = $8, sync_interval_minutes = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        project.name,
        project.description,
        project.sonarUrl,
        project.sonarComponent,
        project.sonarToken,
        project.sonarOrganization,
        project.branch,
        project.syncEnabled,
        project.syncIntervalMinutes,
        id
      ]
    );
    return result.rows[0];
  },

  async delete(id) {
    await query('DELETE FROM projects WHERE id = $1', [id]);
  },

  async getAll() {
    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM findings WHERE project_id = p.id) as finding_count,
        (SELECT COUNT(*) FROM findings WHERE project_id = p.id AND local_status = 'new') as new_finding_count
       FROM projects p
       ORDER BY p.created_at DESC`
    );
    return result.rows;
  },

  async getById(id) {
    const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByKey(sonarUrl, sonarComponent, branch) {
    const result = await query(
      'SELECT * FROM projects WHERE sonar_url = $1 AND sonar_component = $2 AND branch = $3',
      [sonarUrl, sonarComponent, branch]
    );
    return result.rows[0];
  },

  async updateLastSync(id) {
    const result = await query(
      'UPDATE projects SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  async getEnabledForSync() {
    const result = await query('SELECT * FROM projects WHERE sync_enabled = true');
    return result.rows;
  }
};

// ============================================
// Scans
// ============================================
export const scans = {
  async create(projectId, scanData) {
    const result = await query(
      `INSERT INTO scans
       (project_id, scan_date, total_issues, blocker_count, critical_count, major_count, minor_count, info_count, hotspot_count, quality_gate_status, coverage, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        projectId,
        scanData.scanDate || new Date(),
        scanData.totalIssues || 0,
        scanData.blockerCount || 0,
        scanData.criticalCount || 0,
        scanData.majorCount || 0,
        scanData.minorCount || 0,
        scanData.infoCount || 0,
        scanData.hotspotCount || 0,
        scanData.qualityGateStatus,
        scanData.coverage,
        JSON.stringify(scanData.rawData || {})
      ]
    );
    return result.rows[0];
  },

  async getByProject(projectId, limit = 50) {
    const result = await query(
      'SELECT * FROM scans WHERE project_id = $1 ORDER BY scan_date DESC LIMIT $2',
      [projectId, limit]
    );
    return result.rows;
  },

  async getLatest(projectId) {
    const result = await query(
      'SELECT * FROM scans WHERE project_id = $1 ORDER BY scan_date DESC LIMIT 1',
      [projectId]
    );
    return result.rows[0];
  },

  async getTrends(projectId, startDate, endDate, limit = 30) {
    const result = await query(
      `SELECT
        DATE(scan_date) as date,
        MAX(total_issues) as total_issues,
        MAX(blocker_count) as blocker_count,
        MAX(critical_count) as critical_count,
        MAX(major_count) as major_count,
        MAX(minor_count) as minor_count,
        MAX(hotspot_count) as hotspot_count,
        MAX(quality_gate_status) as quality_gate_status
       FROM scans
       WHERE project_id = $1
         AND scan_date >= $2
         AND scan_date <= $3
       GROUP BY DATE(scan_date)
       ORDER BY date DESC
       LIMIT $4`,
      [projectId, startDate, endDate, limit]
    );
    return result.rows;
  },

  async getComparison(projectId, scanId1, scanId2) {
    const result = await query(
      'SELECT * FROM scans WHERE project_id = $1 AND id IN ($2, $3) ORDER BY scan_date',
      [projectId, scanId1, scanId2]
    );
    return result.rows;
  }
};

// ============================================
// Findings
// ============================================
export const findings = {
  async upsert(projectId, finding) {
    const result = await query(
      `INSERT INTO findings
       (project_id, sonar_key, rule_key, rule_name, severity, type, status, resolution, component, line, message, description, sonar_link, effort, debt, tags, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (project_id, sonar_key)
       DO UPDATE SET
         severity = EXCLUDED.severity,
         status = EXCLUDED.status,
         resolution = EXCLUDED.resolution,
         message = EXCLUDED.message,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        projectId,
        finding.sonarKey,
        finding.ruleKey,
        finding.ruleName,
        finding.severity,
        finding.type,
        finding.status,
        finding.resolution,
        finding.component,
        finding.line,
        finding.message,
        finding.description,
        finding.sonarLink,
        finding.effort,
        finding.debt,
        finding.tags || []
      ]
    );
    return result.rows[0];
  },

  async getByProject(projectId, filters = {}) {
    let queryStr = `
      SELECT f.*,
        (SELECT COUNT(*) FROM finding_comments WHERE finding_id = f.id) as comment_count
      FROM findings f
      WHERE f.project_id = $1`;
    const params = [projectId];
    let paramIndex = 2;

    if (filters.severity) {
      queryStr += ` AND f.severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters.severities && filters.severities.length > 0) {
      queryStr += ` AND f.severity = ANY($${paramIndex++})`;
      params.push(filters.severities);
    }

    if (filters.type) {
      queryStr += ` AND f.type = $${paramIndex++}`;
      params.push(filters.type);
    }

    if (filters.status) {
      queryStr += ` AND f.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.localStatus) {
      queryStr += ` AND f.local_status = $${paramIndex++}`;
      params.push(filters.localStatus);
    }

    if (filters.assignedTo) {
      queryStr += ` AND f.assigned_to = $${paramIndex++}`;
      params.push(filters.assignedTo);
    }

    if (filters.ruleKey) {
      queryStr += ` AND f.rule_key = $${paramIndex++}`;
      params.push(filters.ruleKey);
    }

    if (filters.search) {
      queryStr += ` AND (f.message ILIKE $${paramIndex} OR f.component ILIKE $${paramIndex} OR f.rule_name ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Sorting
    const sortColumn = filters.sortBy || 'first_seen_at';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const validSortColumns = ['severity', 'status', 'first_seen_at', 'last_seen_at', 'local_status', 'priority', 'component'];
    if (validSortColumns.includes(sortColumn)) {
      queryStr += ` ORDER BY f.${sortColumn} ${sortOrder}`;
    } else {
      queryStr += ' ORDER BY f.first_seen_at DESC';
    }

    // Pagination
    if (filters.limit) {
      queryStr += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      queryStr += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await query(queryStr, params);
    return result.rows;
  },

  async countByProject(projectId, filters = {}) {
    let queryStr = 'SELECT COUNT(*) as count FROM findings WHERE project_id = $1';
    const params = [projectId];
    let paramIndex = 2;

    if (filters.severity) {
      queryStr += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }
    if (filters.localStatus) {
      queryStr += ` AND local_status = $${paramIndex++}`;
      params.push(filters.localStatus);
    }
    if (filters.search) {
      queryStr += ` AND (message ILIKE $${paramIndex} OR component ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
    }

    const result = await query(queryStr, params);
    return parseInt(result.rows[0].count, 10);
  },

  async getById(id) {
    const result = await query(
      `SELECT f.*,
        (SELECT COUNT(*) FROM finding_comments WHERE finding_id = f.id) as comment_count
       FROM findings f
       WHERE f.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async updateLocalStatus(id, localStatus, performedBy) {
    return transaction(async (client) => {
      // Get current value
      const current = await client.query('SELECT local_status FROM findings WHERE id = $1', [id]);
      const oldValue = current.rows[0]?.local_status;

      // Update status
      const result = await client.query(
        `UPDATE findings
         SET local_status = $1, updated_at = CURRENT_TIMESTAMP,
             resolved_at = CASE WHEN $1 IN ('resolved', 'false_positive', 'wontfix') THEN CURRENT_TIMESTAMP ELSE resolved_at END
         WHERE id = $2 RETURNING *`,
        [localStatus, id]
      );

      // Add history entry
      await client.query(
        `INSERT INTO finding_history (finding_id, action, field_name, old_value, new_value, performed_by)
         VALUES ($1, 'status_change', 'local_status', $2, $3, $4)`,
        [id, oldValue, localStatus, performedBy]
      );

      return result.rows[0];
    });
  },

  async updateAssignment(id, assignedTo, performedBy) {
    return transaction(async (client) => {
      // Get current value
      const current = await client.query('SELECT assigned_to FROM findings WHERE id = $1', [id]);
      const oldValue = current.rows[0]?.assigned_to;

      // Update assignment
      const result = await client.query(
        'UPDATE findings SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [assignedTo, id]
      );

      // Add history entry
      await client.query(
        `INSERT INTO finding_history (finding_id, action, field_name, old_value, new_value, performed_by)
         VALUES ($1, 'assignment', 'assigned_to', $2, $3, $4)`,
        [id, oldValue, assignedTo, performedBy]
      );

      return result.rows[0];
    });
  },

  async updatePriority(id, priority, performedBy) {
    return transaction(async (client) => {
      // Get current value
      const current = await client.query('SELECT priority FROM findings WHERE id = $1', [id]);
      const oldValue = current.rows[0]?.priority?.toString();

      // Update priority
      const result = await client.query(
        'UPDATE findings SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [priority, id]
      );

      // Add history entry
      await client.query(
        `INSERT INTO finding_history (finding_id, action, field_name, old_value, new_value, performed_by)
         VALUES ($1, 'priority_change', 'priority', $2, $3, $4)`,
        [id, oldValue, priority.toString(), performedBy]
      );

      return result.rows[0];
    });
  },

  async updateDueDate(id, dueDate, performedBy) {
    return transaction(async (client) => {
      const current = await client.query('SELECT due_date FROM findings WHERE id = $1', [id]);
      const oldValue = current.rows[0]?.due_date?.toISOString();

      const result = await client.query(
        'UPDATE findings SET due_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [dueDate, id]
      );

      await client.query(
        `INSERT INTO finding_history (finding_id, action, field_name, old_value, new_value, performed_by)
         VALUES ($1, 'due_date_change', 'due_date', $2, $3, $4)`,
        [id, oldValue, dueDate, performedBy]
      );

      return result.rows[0];
    });
  },

  async getStatistics(projectId) {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'BLOCKER') as blocker_count,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count,
        COUNT(*) FILTER (WHERE severity = 'MAJOR') as major_count,
        COUNT(*) FILTER (WHERE severity = 'MINOR') as minor_count,
        COUNT(*) FILTER (WHERE severity = 'INFO') as info_count,
        COUNT(*) FILTER (WHERE type = 'SECURITY_HOTSPOT') as hotspot_count,
        COUNT(*) FILTER (WHERE type = 'VULNERABILITY') as vulnerability_count,
        COUNT(*) FILTER (WHERE type = 'BUG') as bug_count,
        COUNT(*) FILTER (WHERE local_status = 'new') as new_count,
        COUNT(*) FILTER (WHERE local_status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE local_status IN ('resolved', 'false_positive', 'wontfix')) as resolved_count,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count
       FROM findings
       WHERE project_id = $1`,
      [projectId]
    );
    return result.rows[0];
  },

  async getTopRules(projectId, limit = 10) {
    const result = await query(
      `SELECT
        rule_key,
        rule_name,
        COUNT(*) as count,
        MAX(severity) as max_severity
       FROM findings
       WHERE project_id = $1
       GROUP BY rule_key, rule_name
       ORDER BY count DESC
       LIMIT $2`,
      [projectId, limit]
    );
    return result.rows;
  },

  async getSeverityBreakdown(projectId) {
    const result = await query(
      `SELECT
        severity,
        COUNT(*) as count
       FROM findings
       WHERE project_id = $1
       GROUP BY severity
       ORDER BY
         CASE severity
           WHEN 'BLOCKER' THEN 1
           WHEN 'CRITICAL' THEN 2
           WHEN 'MAJOR' THEN 3
           WHEN 'MINOR' THEN 4
           WHEN 'INFO' THEN 5
         END`,
      [projectId]
    );
    return result.rows;
  },

  async markStaleAsResolved(projectId, lastSyncDate) {
    // Mark findings not seen in latest sync as potentially resolved
    const result = await query(
      `UPDATE findings
       SET status = 'CLOSED',
           local_status = CASE WHEN local_status = 'new' THEN 'resolved' ELSE local_status END,
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1
         AND last_seen_at < $2
         AND status NOT IN ('CLOSED', 'RESOLVED')
       RETURNING id`,
      [projectId, lastSyncDate]
    );
    return result.rows.length;
  }
};

// ============================================
// Finding Comments
// ============================================
export const findingComments = {
  async add(findingId, author, content) {
    return transaction(async (client) => {
      const result = await client.query(
        'INSERT INTO finding_comments (finding_id, author, content) VALUES ($1, $2, $3) RETURNING *',
        [findingId, author, content]
      );

      // Add history entry
      await client.query(
        `INSERT INTO finding_history (finding_id, action, new_value, performed_by)
         VALUES ($1, 'comment_added', $2, $3)`,
        [findingId, content.substring(0, 100), author]
      );

      return result.rows[0];
    });
  },

  async update(id, content) {
    const result = await query(
      'UPDATE finding_comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [content, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await query('DELETE FROM finding_comments WHERE id = $1', [id]);
  },

  async getByFinding(findingId) {
    const result = await query(
      'SELECT * FROM finding_comments WHERE finding_id = $1 ORDER BY created_at ASC',
      [findingId]
    );
    return result.rows;
  }
};

// ============================================
// Finding History
// ============================================
export const findingHistory = {
  async add(findingId, action, fieldName, oldValue, newValue, performedBy) {
    const result = await query(
      `INSERT INTO finding_history (finding_id, action, field_name, old_value, new_value, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [findingId, action, fieldName, oldValue, newValue, performedBy]
    );
    return result.rows[0];
  },

  async getByFinding(findingId, limit = 50) {
    const result = await query(
      'SELECT * FROM finding_history WHERE finding_id = $1 ORDER BY created_at DESC LIMIT $2',
      [findingId, limit]
    );
    return result.rows;
  }
};

// ============================================
// Dashboard Users
// ============================================
export const dashboardUsers = {
  async create(user) {
    const result = await query(
      'INSERT INTO dashboard_users (email, name, role, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.email, user.name, user.role || 'user', user.avatarUrl]
    );
    return result.rows[0];
  },

  async update(id, user) {
    const result = await query(
      'UPDATE dashboard_users SET name = $1, role = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [user.name, user.role, user.avatarUrl, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await query('DELETE FROM dashboard_users WHERE id = $1', [id]);
  },

  async getAll() {
    const result = await query('SELECT * FROM dashboard_users ORDER BY name');
    return result.rows;
  },

  async getById(id) {
    const result = await query('SELECT * FROM dashboard_users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByEmail(email) {
    const result = await query('SELECT * FROM dashboard_users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async upsert(user) {
    const result = await query(
      `INSERT INTO dashboard_users (email, name, role, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [user.email, user.name, user.role || 'user', user.avatarUrl]
    );
    return result.rows[0];
  }
};
