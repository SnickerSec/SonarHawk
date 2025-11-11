import { Router } from 'express';
import { schedules, emailRecipients, jobExecutions } from '../services/database.js';
import {
  addSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  triggerScheduleNow,
  getSchedulerStatus,
  validateCronExpression,
  getNextExecutions
} from '../services/schedulerService.js';
import { testEmailConfig, sendTestEmail } from '../services/emailService.js';

const router = Router();

// Get all schedules
router.get('/', async (req, res) => {
  try {
    const allSchedules = await schedules.getAll();
    res.json({ schedules: allSchedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get a single schedule
router.get('/:id', async (req, res) => {
  try {
    const schedule = await schedules.getById(parseInt(req.params.id));
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Include recipients
    const recipients = await emailRecipients.getBySchedule(schedule.id);
    schedule.recipients = recipients;

    res.json({ schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create a new schedule
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      cronExpression,
      timezone,
      enabled,
      reportOptions,
      recipients: recipientsList
    } = req.body;

    // Validate required fields
    if (!name || !sonarUrl || !sonarComponent || !cronExpression) {
      return res.status(400).json({
        error: 'Missing required fields: name, sonarUrl, sonarComponent, cronExpression'
      });
    }

    // Validate cron expression
    if (!validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    // Create schedule
    const schedule = await addSchedule({
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      cronExpression,
      timezone: timezone || 'UTC',
      enabled: enabled ?? true,
      reportOptions
    });

    // Add recipients
    if (recipientsList && Array.isArray(recipientsList)) {
      for (const recipient of recipientsList) {
        await emailRecipients.add(schedule.id, recipient.email, recipient.name);
      }
    }

    res.status(201).json({ schedule });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update a schedule
router.put('/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const {
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      cronExpression,
      timezone,
      enabled,
      reportOptions,
      recipients: recipientsList
    } = req.body;

    // Validate cron expression if provided
    if (cronExpression && !validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    // Update schedule
    const schedule = await updateSchedule(scheduleId, {
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      cronExpression,
      timezone: timezone || 'UTC',
      enabled,
      reportOptions
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Update recipients if provided
    if (recipientsList && Array.isArray(recipientsList)) {
      // Get existing recipients
      const existing = await emailRecipients.getBySchedule(scheduleId);
      const existingEmails = new Set(existing.map(r => r.email));
      const newEmails = new Set(recipientsList.map(r => r.email));

      // Remove recipients not in new list
      for (const recipient of existing) {
        if (!newEmails.has(recipient.email)) {
          await emailRecipients.remove(scheduleId, recipient.email);
        }
      }

      // Add new recipients
      for (const recipient of recipientsList) {
        if (!existingEmails.has(recipient.email)) {
          await emailRecipients.add(scheduleId, recipient.email, recipient.name);
        }
      }
    }

    res.json({ schedule });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete a schedule
router.delete('/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    await deleteSchedule(scheduleId);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Toggle schedule enabled/disabled
router.patch('/:id/toggle', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const schedule = await toggleSchedule(scheduleId, enabled);
    res.json({ schedule });
  } catch (error) {
    console.error('Toggle schedule error:', error);
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

// Manually trigger a schedule (run now)
router.post('/:id/trigger', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const result = await triggerScheduleNow(scheduleId);
    res.json(result);
  } catch (error) {
    console.error('Trigger schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get schedule execution history
router.get('/:id/executions', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 10;
    const executions = await jobExecutions.getBySchedule(scheduleId, limit);
    res.json({ executions });
  } catch (error) {
    console.error('Get executions error:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

// Get recent executions across all schedules
router.get('/executions/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const executions = await jobExecutions.getRecent(limit);
    res.json({ executions });
  } catch (error) {
    console.error('Get recent executions error:', error);
    res.status(500).json({ error: 'Failed to fetch recent executions' });
  }
});

// Get scheduler status
router.get('/status/info', async (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json(status);
  } catch (error) {
    console.error('Get scheduler status error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduler status' });
  }
});

// Validate cron expression
router.post('/validate/cron', async (req, res) => {
  try {
    const { cronExpression } = req.body;
    if (!cronExpression) {
      return res.status(400).json({ error: 'cronExpression is required' });
    }

    const isValid = validateCronExpression(cronExpression);
    const result = { valid: isValid };

    if (isValid) {
      result.nextExecutions = getNextExecutions(cronExpression);
    }

    res.json(result);
  } catch (error) {
    console.error('Validate cron error:', error);
    res.status(500).json({ error: 'Failed to validate cron expression' });
  }
});

// Email configuration endpoints

// Test SMTP configuration
router.get('/email/test-config', async (req, res) => {
  try {
    const result = await testEmailConfig();
    res.json(result);
  } catch (error) {
    console.error('Test email config error:', error);
    res.status(500).json({ error: 'Failed to test email configuration' });
  }
});

// Send test email
router.post('/email/send-test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const result = await sendTestEmail(email);
    res.json(result);
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default router;
