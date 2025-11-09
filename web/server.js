import express from 'express';
import cors from 'cors';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile, unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Import main project file
const { generateReport } = await import('../index.js');

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
  // In production, allow the same origin
  app.use(cors({
    origin: true,
    credentials: true
  }));
}

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: isDev ? 'development' : 'production',
    version: '1.0.0'
  });
});

// Serve static files in production
if (!isDev) {
  const distPath = join(__dirname, 'dist');
  app.use(express.static(distPath));
  console.log('Serving static files from:', distPath);
}

// API endpoint for report generation
app.post('/api/generate', async (req, res) => {
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
