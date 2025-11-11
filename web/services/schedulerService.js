import cron from 'node-cron';
import { schedules, emailRecipients, jobExecutions } from './database.js';
import { sendReportEmail } from './emailService.js';
import { generateReport } from '../../index.js';
import { resolve } from 'path';
import { unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// Store active cron jobs
const activeCronJobs = new Map();

/**
 * Execute a scheduled report generation
 */
async function executeScheduledReport(schedule) {
  const executionId = await jobExecutions.create(schedule.id);
  const tempOutput = resolve(projectRoot, `temp-scheduled-report-${schedule.id}-${Date.now()}.html`);

  console.log(`🔄 Starting scheduled report for: ${schedule.name}`);

  try {
    // Prepare report options
    const reportOptions = {
      sonarUrl: schedule.sonar_url,
      sonarComponent: schedule.sonar_component,
      sonarToken: schedule.sonar_token,
      sonarOrganization: schedule.sonar_organization,
      branch: schedule.branch,
      output: tempOutput,
      ...JSON.parse(schedule.report_options || '{}')
    };

    // Generate report
    process.chdir(projectRoot);
    await generateReport(reportOptions);
    console.log(`✓ Report generated: ${schedule.name}`);

    // Get email recipients
    const recipients = await emailRecipients.getBySchedule(schedule.id);

    let emailSent = false;
    let emailError = null;

    // Send email if there are recipients
    if (recipients.length > 0) {
      try {
        await sendReportEmail({
          recipients,
          schedule,
          reportPath: tempOutput,
          reportData: {
            issueCount: 'N/A', // TODO: Extract from report
            criticalCount: 'N/A'
          }
        });
        emailSent = true;
        console.log(`✓ Email sent to ${recipients.length} recipient(s)`);
      } catch (error) {
        emailError = error.message;
        console.error('Email sending failed:', error);
      }
    } else {
      console.log('⚠ No email recipients configured for this schedule');
    }

    // Update execution status
    await jobExecutions.updateSuccess(executionId, tempOutput, emailSent);

    // Clean up temp file
    try {
      await unlink(tempOutput);
    } catch (err) {
      console.warn('Failed to delete temp file:', err);
    }

    console.log(`✅ Scheduled report completed: ${schedule.name}`);
  } catch (error) {
    console.error(`❌ Scheduled report failed: ${schedule.name}`, error);
    await jobExecutions.updateFailure(executionId, error.message);
  }
}

/**
 * Start a cron job for a schedule
 */
function startCronJob(schedule) {
  // Validate cron expression
  if (!cron.validate(schedule.cron_expression)) {
    console.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cron_expression}`);
    return;
  }

  // Stop existing job if any
  stopCronJob(schedule.id);

  // Create new cron job
  const cronJob = cron.schedule(
    schedule.cron_expression,
    () => executeScheduledReport(schedule),
    {
      scheduled: true,
      timezone: schedule.timezone || 'UTC'
    }
  );

  activeCronJobs.set(schedule.id, {
    job: cronJob,
    schedule
  });

  console.log(`✓ Started cron job for: ${schedule.name} (${schedule.cron_expression})`);
}

/**
 * Stop a cron job
 */
function stopCronJob(scheduleId) {
  const existing = activeCronJobs.get(scheduleId);
  if (existing) {
    existing.job.stop();
    activeCronJobs.delete(scheduleId);
    console.log(`✓ Stopped cron job for schedule ID: ${scheduleId}`);
  }
}

/**
 * Initialize all enabled schedules
 */
export async function initializeScheduler() {
  try {
    const enabledSchedules = await schedules.getEnabled();
    console.log(`📅 Initializing ${enabledSchedules.length} scheduled job(s)...`);

    for (const schedule of enabledSchedules) {
      startCronJob(schedule);
    }

    console.log('✅ Scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
    throw error;
  }
}

/**
 * Reload all schedules (useful after updates)
 */
export async function reloadSchedules() {
  console.log('🔄 Reloading all schedules...');

  // Stop all existing jobs
  for (const [scheduleId] of activeCronJobs) {
    stopCronJob(scheduleId);
  }

  // Reinitialize
  await initializeScheduler();
}

/**
 * Add a new schedule and start its cron job
 */
export async function addSchedule(scheduleData) {
  const schedule = await schedules.create(scheduleData);

  if (schedule.enabled) {
    startCronJob(schedule);
  }

  return schedule;
}

/**
 * Update a schedule and restart its cron job if needed
 */
export async function updateSchedule(scheduleId, scheduleData) {
  const schedule = await schedules.update(scheduleId, scheduleData);

  // Restart cron job
  stopCronJob(scheduleId);
  if (schedule.enabled) {
    startCronJob(schedule);
  }

  return schedule;
}

/**
 * Delete a schedule and stop its cron job
 */
export async function deleteSchedule(scheduleId) {
  stopCronJob(scheduleId);
  await schedules.delete(scheduleId);
}

/**
 * Toggle schedule enabled status
 */
export async function toggleSchedule(scheduleId, enabled) {
  const schedule = await schedules.toggleEnabled(scheduleId, enabled);

  if (enabled) {
    startCronJob(schedule);
  } else {
    stopCronJob(scheduleId);
  }

  return schedule;
}

/**
 * Manually trigger a schedule (run now)
 */
export async function triggerScheduleNow(scheduleId) {
  const schedule = await schedules.getById(scheduleId);
  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Execute immediately (don't wait)
  executeScheduledReport(schedule).catch(err => {
    console.error('Manual trigger failed:', err);
  });

  return { message: 'Report generation started' };
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  const activeJobs = [];

  for (const [scheduleId, { schedule }] of activeCronJobs) {
    activeJobs.push({
      scheduleId,
      name: schedule.name,
      cronExpression: schedule.cron_expression,
      timezone: schedule.timezone
    });
  }

  return {
    totalActive: activeJobs.length,
    activeJobs
  };
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expression) {
  return cron.validate(expression);
}

/**
 * Get next execution times for a cron expression
 */
export function getNextExecutions(cronExpression, count = 5) {
  if (!cron.validate(cronExpression)) {
    throw new Error('Invalid cron expression');
  }

  // Create temporary job to get execution times
  const times = [];
  const tempJob = cron.schedule(cronExpression, () => {}, { scheduled: false });

  // Get next N execution times
  // Note: node-cron doesn't have built-in method for this, so we'll estimate
  const now = new Date();
  const message = `Next execution: ${now.toLocaleString()}`;

  tempJob.destroy();

  return {
    message,
    note: 'Exact future times require additional library (e.g., cron-parser)'
  };
}

/**
 * Cleanup on shutdown
 */
export function shutdownScheduler() {
  console.log('🛑 Shutting down scheduler...');
  for (const [scheduleId] of activeCronJobs) {
    stopCronJob(scheduleId);
  }
  console.log('✓ Scheduler stopped');
}

// Handle graceful shutdown
process.on('SIGINT', shutdownScheduler);
process.on('SIGTERM', shutdownScheduler);
