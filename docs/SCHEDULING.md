# 📅 Scheduling & Email Notifications

SonarHawk now supports automated report generation with email notifications!

## Features

- ⏰ **Cron-based Scheduling**: Set up recurring reports (daily, weekly, monthly, custom)
- 📧 **Email Notifications**: Automatically send reports to team members
- 📊 **Execution History**: Track all scheduled report generations
- 🔄 **Manual Triggers**: Run scheduled reports on-demand
- 🎨 **HTML Email Templates**: Beautiful, responsive email notifications
- 🌍 **Timezone Support**: Schedule reports in any timezone

## Setup

### 1. Database Configuration

Add PostgreSQL database URL to your environment:

```bash
# Railway automatically provides DATABASE_URL
# For local development:
export DATABASE_URL=postgresql://user:password@localhost:5432/sonarhawk
```

### 2. SMTP Configuration

Configure email settings:

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM="SonarHawk <noreply@yourdomain.com>"
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Use the App Password as SMTP_PASS

### 3. Start Server

```bash
npm run start
# Server will automatically initialize database and scheduler
```

## API Endpoints

### Schedules

- `GET /api/schedules` - List all schedules
- `GET /api/schedules/:id` - Get schedule details
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `PATCH /api/schedules/:id/toggle` - Enable/disable schedule
- `POST /api/schedules/:id/trigger` - Run schedule immediately

### Execution History

- `GET /api/schedules/:id/executions` - Get execution history for a schedule
- `GET /api/schedules/executions/recent` - Get recent executions across all schedules

### Email Testing

- `GET /api/schedules/email/test-config` - Test SMTP configuration
- `POST /api/schedules/email/send-test` - Send test email

### Scheduler Status

- `GET /api/schedules/status/info` - Get active jobs status
- `POST /api/schedules/validate/cron` - Validate cron expression

## Creating a Schedule

### Example Request

```bash
curl -X POST http://localhost:3000/api/schedules \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Weekly Security Report",
    "description": "Security scan every Monday at 9am",
    "sonarUrl": "https://sonarcloud.io",
    "sonarComponent": "my-project-key",
    "sonarToken": "your-sonar-token",
    "branch": "main",
    "cronExpression": "0 9 * * 1",
    "timezone": "America/New_York",
    "enabled": true,
    "reportOptions": {
      "securityHotspot": true,
      "coverage": true,
      "darkTheme": true
    },
    "recipients": [
      { "email": "team@company.com", "name": "Security Team" },
      { "email": "manager@company.com", "name": "Manager" }
    ]
  }'
```

### Schedule Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Schedule name |
| description | string | No | Description |
| sonarUrl | string | Yes | SonarQube server URL |
| sonarComponent | string | Yes | Project key |
| sonarToken | string | No | Authentication token |
| sonarOrganization | string | No | Organization (for SonarCloud) |
| branch | string | No | Branch name |
| cronExpression | string | Yes | Cron schedule expression |
| timezone | string | No | Timezone (default: UTC) |
| enabled | boolean | No | Enable/disable (default: true) |
| reportOptions | object | No | Report generation options |
| recipients | array | No | Email recipients |

## Cron Expression Examples

```bash
# Every day at 9:00 AM
0 9 * * *

# Every Monday at 9:00 AM
0 9 * * 1

# Every weekday at 9:00 AM
0 9 * * 1-5

# Every hour
0 * * * *

# Every 6 hours
0 */6 * * *

# First day of month at 9:00 AM
0 9 1 * *
```

**Cron Format:** `minute hour day month weekday`

## Email Template Variables

The default email template supports these variables:

- `{{projectName}}` - Schedule name
- `{{componentKey}}` - SonarQube component
- `{{branch}}` - Branch name
- `{{date}}` - Generation timestamp
- `{{issueCount}}` - Total issues found
- `{{criticalCount}}` - Critical issues
- `{{sonarUrl}}` - SonarQube URL

## Database Schema

### Tables

- **schedules** - Scheduled report configurations
- **email_recipients** - Email addresses for each schedule
- **job_executions** - Execution history and status
- **email_templates** - Customizable email templates

## Troubleshooting

### Scheduler Not Starting

Check logs for:
```
✓ Database initialized
✓ Scheduler initialized
✓ Scheduling & Email features enabled
```

If missing, verify `DATABASE_URL` is set.

### Emails Not Sending

1. Test SMTP config:
```bash
curl http://localhost:3000/api/schedules/email/test-config
```

2. Send test email:
```bash
curl -X POST http://localhost:3000/api/schedules/email/send-test \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com"}'
```

3. Check SMTP credentials and firewall settings

### Schedule Not Running

1. Check if schedule is enabled:
```bash
curl http://localhost:3000/api/schedules/:id
```

2. Verify cron expression:
```bash
curl -X POST http://localhost:3000/api/schedules/validate/cron \\
  -H "Content-Type: application/json" \\
  -d '{"cronExpression": "0 9 * * 1"}'
```

3. Check execution history:
```bash
curl http://localhost:3000/api/schedules/:id/executions
```

## Railway Deployment

### Add PostgreSQL

1. In Railway dashboard, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL`

### Set Environment Variables

Add SMTP variables in Railway service settings:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=SonarHawk <noreply@yourdomain.com>
```

### Deploy

```bash
git add .
git commit -m "Add scheduling and email features"
git push origin master
```

Railway will automatically deploy and initialize the database.

## Next Steps

- [ ] Build UI for schedule management (coming soon)
- [ ] Add Slack/Teams webhook support
- [ ] Custom email templates via API
- [ ] Schedule templates/presets
- [ ] Advanced filtering and grouping

---

📖 For more information, visit: https://github.com/SnickerSec/SonarHawk
