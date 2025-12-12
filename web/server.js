import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile, unlink } from 'fs/promises';
import dns from 'dns/promises';

/**
 * SSRF Protection: Validates that a URL does not point to internal/private networks
 * @param {string} urlString - The URL to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateUrlNotInternal(urlString) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  const hostname = parsedUrl.hostname;

  // Block localhost and common internal hostnames
  const blockedHostnames = [
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback'
  ];

  if (blockedHostnames.includes(hostname.toLowerCase())) {
    return { valid: false, error: 'Requests to localhost are not allowed' };
  }

  // Check if hostname is an IP address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Regex);

  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (isPrivateIPv4(octets)) {
      return { valid: false, error: 'Requests to private IP addresses are not allowed' };
    }
  }

  // For hostnames, resolve DNS and check if it points to private IP
  if (!ipv4Match) {
    try {
      const addresses = await dns.resolve4(hostname);
      for (const addr of addresses) {
        const addrMatch = addr.match(ipv4Regex);
        if (addrMatch) {
          const octets = addrMatch.slice(1).map(Number);
          if (isPrivateIPv4(octets)) {
            return { valid: false, error: 'URL resolves to a private IP address' };
          }
        }
      }
    } catch {
      // DNS resolution failed - allow the request to proceed and fail naturally
      // This handles cases where the hostname doesn't resolve
    }
  }

  return { valid: true };
}

/**
 * Check if an IPv4 address (as array of octets) is private/internal
 */
function isPrivateIPv4(octets) {
  const [a, b, c, d] = octets;

  // Validate octets are in range
  if (octets.some(o => o < 0 || o > 255)) {
    return true; // Invalid IP, treat as blocked
  }

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 10.0.0.0/8 - Private
  if (a === 10) return true;

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 - Link-local (includes AWS metadata endpoint)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;

  // 100.64.0.0/10 - Shared Address Space (CGN)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 - Documentation (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 198.51.100.0/24 - Documentation (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 - Documentation (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved
  if (a >= 240) return true;

  return false;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Import main project file
const indexModule = await import('../src/index.js');
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

// Connection test endpoint
app.post('/api/test-connection', async (req, res) => {
  try {
    process.chdir(projectRoot);

    const { SonarClient } = await import('../src/index.js');

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
    // Remove trailing slashes using a safe string method to avoid ReDoS
    let testUrl = req.body.sonarurl;
    while (testUrl.endsWith('/')) {
      testUrl = testUrl.slice(0, -1);
    }

    // Validate URL to prevent SSRF attacks (checks protocol and blocks private IPs)
    const urlValidation = await validateUrlNotInternal(testUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        error: urlValidation.error
      });
    }

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

    // Validate URL to prevent SSRF attacks (checks protocol and blocks private IPs)
    if (req.body.sonarurl) {
      const urlValidation = await validateUrlNotInternal(req.body.sonarurl);
      if (!urlValidation.valid) {
        return res.status(400).json({
          error: urlValidation.error
        });
      }
    }

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
    res.setHeader('Content-Disposition', 'attachment; filename="codeguard-report.html"');
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
  console.log(`CodeGuard server running on port ${port}`);
  console.log(`Environment: ${isDev ? 'development' : 'production'}`);
  if (isDev) {
    console.log('API available at http://localhost:3000/api');
    console.log('Frontend should be running on http://localhost:5173');
  } else {
    console.log(`Access the application at http://0.0.0.0:${port}`);
  }
});
