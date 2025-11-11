import nodemailer from 'nodemailer';
import { emailTemplates } from './database.js';

/**
 * Create email transporter
 */
function createTransporter() {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // For development, use ethereal email (fake SMTP)
  if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
    console.warn('⚠ SMTP not configured, emails will be logged to console');
    return null;
  }

  return nodemailer.createTransporter(config);
}

/**
 * Render email template with variables
 */
function renderTemplate(template, variables) {
  let html = template.html_body;
  let text = template.text_body;
  let subject = template.subject;

  // Replace template variables {{variableName}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value || '');
    text = text.replace(regex, value || '');
    subject = subject.replace(regex, value || '');
  }

  return { html, text, subject };
}

/**
 * Send report email
 */
export async function sendReportEmail(options) {
  const {
    recipients,
    schedule,
    reportPath,
    reportData = {}
  } = options;

  try {
    const transporter = createTransporter();

    // Get email template
    const template = await emailTemplates.getDefault();
    if (!template) {
      throw new Error('No email template found');
    }

    // Prepare template variables
    const variables = {
      projectName: schedule.name || 'SonarQube Report',
      componentKey: schedule.sonar_component,
      branch: schedule.branch || 'main',
      date: new Date().toLocaleString(),
      issueCount: reportData.issueCount || 'N/A',
      criticalCount: reportData.criticalCount || 'N/A',
      sonarUrl: schedule.sonar_url
    };

    // Render template
    const { html, text, subject } = renderTemplate(template, variables);

    // Prepare email
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipients.map(r => r.email).join(', '),
      subject,
      text,
      html,
      attachments: reportPath ? [{
        filename: `sonarhawk-report-${Date.now()}.html`,
        path: reportPath
      }] : []
    };

    // Send email
    if (transporter) {
      const info = await transporter.sendMail(mailOptions);
      console.log('✓ Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } else {
      // Development mode - log to console
      console.log('📧 Email would be sent to:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Recipients:', recipients.length);
      return { success: true, messageId: 'dev-mode' };
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Test SMTP configuration
 */
export async function testEmailConfig() {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      return { success: false, message: 'SMTP not configured' };
    }

    await transporter.verify();
    return { success: true, message: 'SMTP configuration is valid' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Send test email
 */
export async function sendTestEmail(to) {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      throw new Error('SMTP not configured');
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'SonarHawk Test Email',
      text: 'This is a test email from SonarHawk. If you received this, your email configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>🦅 SonarHawk Test Email</h2>
          <p>This is a test email from SonarHawk.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">SonarHawk Automated Testing</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Test email failed:', error);
    throw error;
  }
}
