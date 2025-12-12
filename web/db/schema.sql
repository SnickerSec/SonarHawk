-- SonarHawk Database Schema for Scheduling & Email Notifications

-- Schedules table: stores report generation schedules
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sonar_url VARCHAR(500) NOT NULL,
  sonar_component VARCHAR(255) NOT NULL,
  sonar_token VARCHAR(500),
  sonar_organization VARCHAR(255),
  branch VARCHAR(255),
  cron_expression VARCHAR(100) NOT NULL, -- e.g., "0 9 * * 1" for Monday 9am
  timezone VARCHAR(50) DEFAULT 'UTC',
  enabled BOOLEAN DEFAULT true,
  report_options JSONB, -- stores all report configuration options
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email recipients table: stores email addresses for each schedule
CREATE TABLE IF NOT EXISTS email_recipients (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schedule_id, email)
);

-- Job executions table: tracks execution history
CREATE TABLE IF NOT EXISTS job_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'running'
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  report_path VARCHAR(500),
  email_sent BOOLEAN DEFAULT false,
  email_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates table: customizable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_job_executions_schedule ON job_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_job_executions_started ON job_executions(started_at);

-- ============================================
-- Dashboard Tables for Findings Tracking
-- ============================================

-- Projects table: stores tracked SonarQube projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  sonar_url VARCHAR(500) NOT NULL,
  sonar_component VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sonar_token VARCHAR(500),
  sonar_organization VARCHAR(255),
  branch VARCHAR(255) DEFAULT 'main',
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sonar_url, sonar_component, branch)
);

-- Scans table: tracks each sync/scan from SonarQube
CREATE TABLE IF NOT EXISTS scans (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  scan_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_issues INTEGER DEFAULT 0,
  blocker_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  major_count INTEGER DEFAULT 0,
  minor_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  hotspot_count INTEGER DEFAULT 0,
  quality_gate_status VARCHAR(50),
  coverage DECIMAL(5,2),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Findings table: stores individual issues/hotspots
CREATE TABLE IF NOT EXISTS findings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  sonar_key VARCHAR(255) NOT NULL,
  rule_key VARCHAR(255) NOT NULL,
  rule_name VARCHAR(500),
  severity VARCHAR(50) NOT NULL, -- 'BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'
  type VARCHAR(50) NOT NULL, -- 'VULNERABILITY', 'BUG', 'CODE_SMELL', 'SECURITY_HOTSPOT'
  status VARCHAR(50) NOT NULL, -- 'OPEN', 'CONFIRMED', 'REOPENED', 'RESOLVED', 'CLOSED'
  resolution VARCHAR(50), -- 'FIXED', 'FALSE-POSITIVE', 'WONTFIX', 'REMOVED'
  component VARCHAR(500) NOT NULL,
  line INTEGER,
  message TEXT NOT NULL,
  description TEXT,
  sonar_link TEXT,
  effort VARCHAR(50),
  debt VARCHAR(50),
  tags TEXT[],
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  -- Local tracking fields (user can manage these)
  local_status VARCHAR(50) DEFAULT 'new', -- 'new', 'acknowledged', 'in_progress', 'resolved', 'false_positive', 'wontfix'
  assigned_to VARCHAR(255),
  priority INTEGER DEFAULT 0, -- 0=none, 1=low, 2=medium, 3=high, 4=critical
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, sonar_key)
);

-- Finding comments table
CREATE TABLE IF NOT EXISTS finding_comments (
  id SERIAL PRIMARY KEY,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  author VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Finding history/audit log
CREATE TABLE IF NOT EXISTS finding_history (
  id SERIAL PRIMARY KEY,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'status_change', 'assignment', 'comment_added', 'priority_change', 'created', 'synced'
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  performed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard users table for assignments
CREATE TABLE IF NOT EXISTS dashboard_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user', 'viewer'
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_sync_enabled ON projects(sync_enabled);
CREATE INDEX IF NOT EXISTS idx_scans_project_date ON scans(project_id, scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_findings_project ON findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_local_status ON findings(local_status);
CREATE INDEX IF NOT EXISTS idx_findings_assigned ON findings(assigned_to);
CREATE INDEX IF NOT EXISTS idx_findings_rule ON findings(rule_key);
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(type);
CREATE INDEX IF NOT EXISTS idx_findings_first_seen ON findings(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_finding_comments_finding ON finding_comments(finding_id);
CREATE INDEX IF NOT EXISTS idx_finding_history_finding ON finding_history(finding_id);

-- Insert default email template
INSERT INTO email_templates (name, subject, html_body, text_body, is_default)
VALUES (
  'default_report',
  'SonarHawk Report: {{projectName}} - {{date}}',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; }
    .footer { background: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
    .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-label { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🦅 SonarHawk Report</h1>
      <p>{{projectName}}</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your scheduled SonarQube report has been generated successfully.</p>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">{{issueCount}}</div>
          <div class="stat-label">Total Issues</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{criticalCount}}</div>
          <div class="stat-label">Critical</div>
        </div>
      </div>

      <p><strong>Project:</strong> {{projectName}}</p>
      <p><strong>Component:</strong> {{componentKey}}</p>
      <p><strong>Branch:</strong> {{branch}}</p>
      <p><strong>Generated:</strong> {{date}}</p>

      <p>The detailed report is attached to this email.</p>

      <a href="{{sonarUrl}}" class="button">View in SonarQube</a>
    </div>
    <div class="footer">
      <p>Generated by SonarHawk | Automated Security Reporting</p>
      <p>This is an automated message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>',
  'SonarHawk Report

Project: {{projectName}}
Component: {{componentKey}}
Branch: {{branch}}
Generated: {{date}}

Total Issues: {{issueCount}}
Critical Issues: {{criticalCount}}

The detailed report is attached to this email.

View in SonarQube: {{sonarUrl}}

---
Generated by SonarHawk | Automated Security Reporting',
  true
) ON CONFLICT (name) DO NOTHING;
