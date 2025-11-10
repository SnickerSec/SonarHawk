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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SonarHawk Demo Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 40px 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #333;
      margin-top: 0;
      font-size: 2.5em;
    }
    .subtitle {
      color: #666;
      font-size: 1.2em;
      margin-bottom: 30px;
    }
    .feature {
      background: #f8f9fa;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .feature h3 {
      margin-top: 0;
      color: #667eea;
    }
    .feature ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .feature li {
      margin: 8px 0;
    }
    .note {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .screenshot {
      background: #e9ecef;
      padding: 60px 20px;
      text-align: center;
      border-radius: 8px;
      margin: 20px 0;
      color: #6c757d;
      font-style: italic;
    }
    .cta {
      background: #667eea;
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
      font-size: 1.1em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦅 SonarHawk Demo Report</h1>
    <p class="subtitle">Enhanced SonarQube Vulnerability Reports</p>

    <div class="note">
      <strong>📝 Note:</strong> This is a demonstration page. A real SonarHawk report contains actual vulnerability data from your SonarQube instance.
    </div>

    <div class="feature">
      <h3>📊 What's Included in a Real Report</h3>
      <ul>
        <li><strong>Executive Summary</strong> - High-level overview of security findings</li>
        <li><strong>Vulnerability Details</strong> - Complete list with severity, type, and location</li>
        <li><strong>Security Hotspots</strong> - Areas requiring security review</li>
        <li><strong>Code Coverage</strong> - Test coverage metrics (optional)</li>
        <li><strong>Quality Gate Status</strong> - Pass/fail indicators (optional)</li>
        <li><strong>Rule Descriptions</strong> - Detailed explanation of each security rule</li>
      </ul>
    </div>

    <div class="feature">
      <h3>✨ Key Features</h3>
      <ul>
        <li>🎨 Dark/Light theme support</li>
        <li>📱 Fully responsive design</li>
        <li>🔗 Clickable links to SonarQube issues</li>
        <li>📄 Self-contained HTML file</li>
        <li>🎯 Filterable and sortable tables</li>
        <li>📈 Visual charts and metrics</li>
        <li>💾 Export to PDF capability</li>
      </ul>
    </div>

    <div class="screenshot">
      [Sample vulnerability table would appear here with columns for Severity, Type, Message, File, and Line]
    </div>

    <div class="feature">
      <h3>🚀 How to Generate Your Own Report</h3>
      <ul>
        <li>Enter your SonarQube server URL</li>
        <li>Provide your project key</li>
        <li>Add authentication credentials (token recommended)</li>
        <li>Click "Generate Report"</li>
        <li>Download your comprehensive security report!</li>
      </ul>
    </div>

    <div class="cta">
      Connect your SonarQube instance to generate a real report with your project's security findings!
    </div>

    <p style="text-align: center; color: #999; margin-top: 40px;">
      🤖 Generated with SonarHawk<br>
      <small>Your enhanced SonarQube reporting tool</small>
    </p>
  </div>
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
