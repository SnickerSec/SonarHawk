import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile, unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Import main project file
const indexModule = await import('../index.js');
const { generateReport } = indexModule;

const app = express();
const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// CORS configuration - more permissive in development
if (isDev) {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
} else {
  // In production, disable CORS for same-origin only
  app.use(cors({
    origin: false,
    credentials: true
  }));
}

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit report generation to 10 per 15 minutes
  message: 'Too many report generation requests, please try again later.'
});

app.use(express.json({ limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: isDev ? 'development' : 'production',
    version: '1.0.0'
  });
});

// Demo report endpoint
app.get('/api/demo', async (req, res) => {
  try {
    process.chdir(projectRoot);

    // Create demo report with sample data
    const demoOptions = {
      sonarUrl: 'https://sonarcloud.io',
      sonarComponent: 'demo:project',
      sonarOrganization: 'demo-org',
      project: 'Demo Project',
      application: 'Sample Application',
      release: 'v1.0.0',
      securityHotspot: true,
      coverage: true,
      linkIssues: true,
      qualityGateStatus: true,
      rulesInReport: true,
      darkTheme: true,
      output: resolve(projectRoot, `demo-report-${Date.now()}.html`)
    };

    // Note: This will fail gracefully as it's demo data
    // We'll catch the error and serve a pre-made demo message
    try {
      await generateReport(demoOptions);
      const reportHtml = await readFile(demoOptions.output, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(reportHtml);
      await unlink(demoOptions.output).catch(() => {});
    } catch (error) {
      // If demo generation fails, serve a demo HTML page explaining the report
      const demoHtml = `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SonarHawk Demo Report</title>
  <style>
    :root {
      --bg-primary: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-tertiary: #0f3460;
      --text-primary: #eaeaea;
      --text-secondary: #a8a8a8;
      --border-color: #2d2d44;
      --accent-color: #667eea;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --critical-color: #dc2626;
    }

    [data-theme="light"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --bg-tertiary: #e9ecef;
      --text-primary: #333333;
      --text-secondary: #666666;
      --border-color: #dee2e6;
      --accent-color: #667eea;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --critical-color: #dc2626;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      margin: 0;
      padding: 20px;
      transition: background-color 0.3s, color 0.3s;
    }

    .header {
      max-width: 1200px;
      margin: 0 auto 30px;
      padding: 30px;
      background: var(--bg-secondary);
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .header-content h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .header-content .subtitle {
      color: var(--text-secondary);
      font-size: 1.1em;
    }

    .theme-toggle {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1em;
      transition: opacity 0.3s;
    }

    .theme-toggle:hover {
      opacity: 0.9;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: var(--bg-secondary);
      padding: 24px;
      border-radius: 12px;
      border-left: 4px solid var(--accent-color);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stat-card.critical { border-left-color: var(--critical-color); }
    .stat-card.high { border-left-color: var(--danger-color); }
    .stat-card.medium { border-left-color: var(--warning-color); }
    .stat-card.low { border-left-color: var(--success-color); }

    .stat-card h3 {
      color: var(--text-secondary);
      font-size: 0.9em;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .stat-card .value {
      font-size: 2.5em;
      font-weight: bold;
    }

    .section {
      background: var(--bg-secondary);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .section h2 {
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--border-color);
    }

    .table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-top: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 600px;
    }

    thead {
      background: var(--bg-tertiary);
    }

    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid var(--border-color);
    }

    td {
      padding: 15px;
      border-bottom: 1px solid var(--border-color);
    }

    tbody tr {
      transition: background-color 0.2s;
    }

    tbody tr:hover {
      background: var(--bg-tertiary);
    }

    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
    }

    .severity-critical {
      background: var(--critical-color);
      color: white;
    }

    .severity-high {
      background: var(--danger-color);
      color: white;
    }

    .severity-medium {
      background: var(--warning-color);
      color: white;
    }

    .severity-low {
      background: var(--success-color);
      color: white;
    }

    .note {
      background: var(--bg-tertiary);
      border-left: 4px solid var(--accent-color);
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }

    .footer {
      text-align: center;
      color: var(--text-secondary);
      margin-top: 40px;
      padding: 20px;
    }

    code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        text-align: center;
        gap: 20px;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .table-wrapper {
        border-radius: 8px;
        box-shadow: inset 0 0 0 1px var(--border-color);
      }

      table {
        font-size: 0.85em;
      }

      th, td {
        padding: 10px 8px;
        white-space: nowrap;
      }

      td:nth-child(3) {
        max-width: 200px;
        white-space: normal;
        word-wrap: break-word;
      }

      .section {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <h1>🦅 SonarHawk Demo Report</h1>
      <p class="subtitle">Demo Project v1.0.0 - Sample Security Analysis</p>
    </div>
    <button class="theme-toggle" onclick="toggleTheme()">
      <span id="theme-icon">☀️</span> Toggle Theme
    </button>
  </div>

  <div class="container">
    <div class="note">
      <strong>📝 Demo Report:</strong> This is a sample report showing SonarHawk's capabilities. Real reports contain actual vulnerability data from your SonarQube instance.
    </div>

    <div class="stats">
      <div class="stat-card critical">
        <h3>Critical</h3>
        <div class="value">2</div>
      </div>
      <div class="stat-card high">
        <h3>High</h3>
        <div class="value">5</div>
      </div>
      <div class="stat-card medium">
        <h3>Medium</h3>
        <div class="value">12</div>
      </div>
      <div class="stat-card low">
        <h3>Low</h3>
        <div class="value">8</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 Vulnerability Details</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Type</th>
              <th>Message</th>
              <th>File</th>
              <th>Line</th>
            </tr>
          </thead>
          <tbody>
          <tr>
            <td><span class="severity-badge severity-critical">Critical</span></td>
            <td>SQL Injection</td>
            <td>User input is used in SQL query without sanitization</td>
            <td><code>src/database/queries.js</code></td>
            <td>145</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-critical">Critical</span></td>
            <td>Authentication</td>
            <td>Hardcoded credentials found in source code</td>
            <td><code>config/database.js</code></td>
            <td>23</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-high">High</span></td>
            <td>XSS</td>
            <td>Potential Cross-Site Scripting vulnerability</td>
            <td><code>components/UserProfile.jsx</code></td>
            <td>67</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-high">High</span></td>
            <td>Path Traversal</td>
            <td>File path constructed from user input without validation</td>
            <td><code>utils/fileHandler.js</code></td>
            <td>89</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-high">High</span></td>
            <td>Insecure Crypto</td>
            <td>Weak cryptographic algorithm (MD5) used for hashing</td>
            <td><code>auth/passwordUtils.js</code></td>
            <td>34</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-medium">Medium</span></td>
            <td>CSRF</td>
            <td>Missing CSRF token validation on state-changing operation</td>
            <td><code>routes/api/users.js</code></td>
            <td>156</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-medium">Medium</span></td>
            <td>Information Disclosure</td>
            <td>Sensitive information exposed in error messages</td>
            <td><code>middleware/errorHandler.js</code></td>
            <td>42</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-medium">Medium</span></td>
            <td>Regex DoS</td>
            <td>Regular expression vulnerable to catastrophic backtracking</td>
            <td><code>validators/emailValidator.js</code></td>
            <td>18</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-low">Low</span></td>
            <td>Code Smell</td>
            <td>Function has too many parameters (12 > 7 max)</td>
            <td><code>services/reportGenerator.js</code></td>
            <td>203</td>
          </tr>
          <tr>
            <td><span class="severity-badge severity-low">Low</span></td>
            <td>Maintainability</td>
            <td>Cognitive complexity of function is too high (27 > 15 max)</td>
            <td><code>controllers/authController.js</code></td>
            <td>78</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="section">
      <h2>✨ Report Features</h2>
      <ul style="list-style: none; padding-left: 0;">
        <li style="margin: 12px 0;">✅ <strong>Dark/Light Theme:</strong> Toggle between themes (try the button above!)</li>
        <li style="margin: 12px 0;">✅ <strong>Detailed Analysis:</strong> Complete vulnerability information with file locations</li>
        <li style="margin: 12px 0;">✅ <strong>Severity Badges:</strong> Color-coded severity levels for quick identification</li>
        <li style="margin: 12px 0;">✅ <strong>Responsive Design:</strong> Works perfectly on desktop, tablet, and mobile</li>
        <li style="margin: 12px 0;">✅ <strong>Self-Contained:</strong> Single HTML file with all styling included</li>
        <li style="margin: 12px 0;">✅ <strong>Export Ready:</strong> Print to PDF or save for documentation</li>
      </ul>
    </div>

    <div class="section">
      <h2>🚀 Generate Your Own Report</h2>
      <p style="margin-bottom: 15px;">To create a real report with your project's data:</p>
      <ol style="padding-left: 20px;">
        <li style="margin: 10px 0;">Enter your SonarQube server URL (e.g., <code>sonarqube.company.com</code>)</li>
        <li style="margin: 10px 0;">Provide your project key from SonarQube</li>
        <li style="margin: 10px 0;">Add authentication (token recommended, or username/password)</li>
        <li style="margin: 10px 0;">Click "Generate Report" and download your comprehensive security analysis!</li>
      </ol>
    </div>

    <div class="footer">
      🤖 Generated with <strong>SonarHawk</strong><br>
      <small>Enhanced SonarQube Vulnerability Reporting</small>
    </div>
  </div>

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      const icon = document.getElementById('theme-icon');

      html.setAttribute('data-theme', newTheme);
      icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';

      // Save preference
      localStorage.setItem('theme', newTheme);
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(demoHtml);
    }
  } catch (error) {
    console.error('Demo report failed:', error);
    res.status(500).send('<h1>Error generating demo report</h1><p>Please try again later.</p>');
  }
});

// Connection test endpoint
app.post('/api/test-connection', async (req, res) => {
  try {
    process.chdir(projectRoot);

    const { SonarClient } = await import('../index.js');

    // Validate required fields
    if (!req.body.sonarurl) {
      return res.status(400).json({
        success: false,
        error: 'SonarQube URL is required'
      });
    }

    if (!req.body.sonarcomponent) {
      return res.status(400).json({
        success: false,
        error: 'Project key/component is required'
      });
    }

    // Test connection using got HTTP client directly
    const { default: got } = await import('got');
    const testUrl = req.body.sonarurl.replace(/\/+$/, '');

    const headers = {};
    if (req.body.sonartoken) {
      headers['Authorization'] = `Bearer ${req.body.sonartoken}`;
    } else if (req.body.sonarusername && req.body.sonarpassword) {
      const credentials = Buffer.from(`${req.body.sonarusername}:${req.body.sonarpassword}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Test 1: Get server version
    const statusResponse = await got.get(`${testUrl}/api/system/status`, {
      headers,
      responseType: 'json',
      timeout: { request: 10000 },
      throwHttpErrors: true
    });

    const status = statusResponse.body;

    // Test 2: Validate authentication if credentials provided
    if (req.body.sonartoken || (req.body.sonarusername && req.body.sonarpassword)) {
      await got.get(`${testUrl}/api/authentication/validate`, {
        headers,
        responseType: 'json',
        timeout: { request: 10000 },
        throwHttpErrors: true
      });
    }

    // Test 3: Check project access
    await got.get(`${testUrl}/api/projects/search?projects=${encodeURIComponent(req.body.sonarcomponent)}`, {
      headers,
      responseType: 'json',
      timeout: { request: 10000 },
      throwHttpErrors: true
    });

    res.json({
      success: true,
      message: 'Connection successful',
      server: {
        version: status.version,
        status: status.status
      }
    });
  } catch (error) {
    console.error('Connection test failed:', error);

    let errorMessage = 'Connection test failed';
    let statusCode = 500;

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Cannot reach SonarQube server. Please check the URL and network connection.';
      statusCode = 400;
    }
    // Handle HTTP errors from got
    else if (error.response) {
      statusCode = error.response.statusCode;
      if (statusCode === 401) {
        errorMessage = 'Authentication failed. Please check your credentials.';
      } else if (statusCode === 403) {
        errorMessage = 'Access denied. Please check your permissions.';
      } else if (statusCode === 404) {
        errorMessage = 'Project not found. Please check the project key.';
      } else {
        errorMessage = `Server error: ${statusCode}`;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: isDev ? error.message : undefined
    });
  }
});

// Serve static files in production
if (!isDev) {
  const distPath = join(__dirname, 'dist');
  const { existsSync, readdirSync } = await import('fs');

  console.log('Dist path:', distPath);
  console.log('Dist exists:', existsSync(distPath));

  if (existsSync(distPath)) {
    const files = readdirSync(distPath);
    console.log('Files in dist:', files);
    app.use(express.static(distPath));
    console.log('Serving static files from:', distPath);
  } else {
    console.error('ERROR: dist directory does not exist! Build may have failed.');
  }
}

// API endpoint for report generation
app.post('/api/generate', generateLimiter, async (req, res) => {
  try {
    process.chdir(projectRoot);

    // Create temporary file path for report
    const tempOutput = resolve(projectRoot, `temp-report-${Date.now()}.html`);

    // Transform form data to match CLI option names
    const options = {
      sonarUrl: req.body.sonarurl,
      sonarComponent: req.body.sonarcomponent,
      sonarToken: req.body.sonartoken,
      sonarUsername: req.body.sonarusername,
      sonarPassword: req.body.sonarpassword,
      sonarOrganization: req.body.sonarorganization,
      project: req.body.project,
      application: req.body.application,
      release: req.body.release,
      branch: req.body.branch,
      pullRequest: req.body.pullrequest,
      inNewCodePeriod: req.body.inNewCodePeriod === true,
      allBugs: req.body.allbugs === true,
      securityHotspot: req.body.securityHotspot !== false, // Default true
      coverage: req.body.coverage === true,
      linkIssues: req.body.linkIssues === true,
      qualityGateStatus: req.body.qualityGateStatus === true,
      rulesInReport: req.body.rulesInReport !== false, // Default true
      onlyDetectedRules: req.body.onlyDetectedRules === true,
      fixMissingRule: req.body.fixMissingRule === true,
      darkTheme: req.body.darkTheme !== false, // Default true
      includeCompliance: req.body.includeCompliance === true,
      saveTrendData: req.body.saveTrendData === true,
      includeTrends: req.body.includeTrends === true,
      // Slack Integration
      slackWebhook: req.body.enableSlack === true ? req.body.slackWebhook : undefined,
      slackThreshold: req.body.enableSlack === true && req.body.slackThreshold ? parseInt(req.body.slackThreshold, 10) : undefined,
      vulnerabilityPhrase: req.body.vulnerabilityPhrase,
      vulnerabilityPluralPhrase: req.body.vulnerabilityPluralPhrase,
      httpProxy: req.body.httpProxy,
      debug: req.body.debug === true,
      output: tempOutput
    };

    // Remove undefined values
    Object.keys(options).forEach(key => {
      if (options[key] === undefined || options[key] === null || options[key] === '') {
        delete options[key];
      }
    });

    console.log('Generating report with options:', {
      ...options,
      sonarToken: options.sonarToken ? '***' : undefined,
      sonarPassword: options.sonarPassword ? '***' : undefined
    });

    await generateReport(options);

    // Read generated file and send it
    const reportHtml = await readFile(tempOutput, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="sonarhawk-report.html"');
    res.send(reportHtml);

    // Clean up temp file
    await unlink(tempOutput).catch(console.error);

  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate report',
      details: isDev ? error.stack : undefined
    });
  }
});

// Serve index.html for all other routes in production (SPA fallback)
if (!isDev) {
  app.use((req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`SonarHawk server running on port ${port}`);
  console.log(`Environment: ${isDev ? 'development' : 'production'}`);
  if (isDev) {
    console.log('API available at http://localhost:3000/api');
    console.log('Frontend should be running on http://localhost:5173');
  } else {
    console.log(`Access the application at http://0.0.0.0:${port}`);
  }
});
