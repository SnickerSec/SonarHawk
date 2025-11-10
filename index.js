import { writeFile, readFile, mkdir } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import ejs from "ejs";
import got from "got";
import hpagent from "hpagent";
import { getProperties } from "properties-file";
import semver from "semver";
import { readFileSync, existsSync } from "node:fs";
import { getProxyForUrl } from 'proxy-from-env';
import Bottleneck from 'bottleneck';
import QuickLRU from 'quick-lru';
import { homedir } from 'os';
import { env } from 'process';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants
const PAGE_SIZE = 500;
const MAX_RESULTS = 10000;
const MAX_PAGE = MAX_RESULTS / PAGE_SIZE;
const CACHE_MAX_SIZE = 1000;
const CACHE_MAX_AGE = 1000 * 60 * 5; // 5 minutes

// Rate limiter
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100 // minimum time between requests
});

// Cache initialization
const cache = new QuickLRU({
  maxSize: CACHE_MAX_SIZE,
  maxAge: CACHE_MAX_AGE
});

// Type validation
const validateOptions = (options) => {
  const required = ['sonarurl', 'sonarcomponent'];
  for (const field of required) {
    if (!options[field]) {
      throw new Error(`Missing required option: ${field}`);
    }
  }
};

const SEVERITY_WEIGHTS = {
  MINOR: 0,
  MAJOR: 1,
  CRITICAL: 2,
  BLOCKER: 3
};

const HOTSPOT_SEVERITIES = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
};

// Configuration types based on SonarQube version
const getSonarConfig = (version) => {
  const baseConfig = {
    issuesFilter: "&types=VULNERABILITY",
    rulesFilter: "&types=VULNERABILITY",
    issueStatuses: "OPEN,CONFIRMED,REOPENED",
    hotspotStatuses: "TO_REVIEW"
  };

  if (semver.satisfies(version, "7.3 - 7.8")) {
    return {
      ...baseConfig,
      issuesFilter: "&types=VULNERABILITY,SECURITY_HOTSPOT",
      rulesFilter: "&types=VULNERABILITY,SECURITY_HOTSPOT"
    };
  }

  if (semver.satisfies(version, "7.8 - 7.9")) {
    return {
      ...baseConfig,
      issuesFilter: "&types=VULNERABILITY,SECURITY_HOTSPOT",
      rulesFilter: "&types=VULNERABILITY,SECURITY_HOTSPOT",
      issueStatuses: "OPEN,CONFIRMED,REOPENED,TO_REVIEW"
    };
  }

  if (semver.satisfies(version, ">=8.0")) {
    return {
      ...baseConfig,
      rulesFilter: "&types=VULNERABILITY,SECURITY_HOTSPOT"
    };
  }

  return baseConfig;
};

// Link generators
const createIssueLink = (baseURL, branch, component) => (issue) => {
  const branchParam = branch ? `branch=${encodeURIComponent(branch)}&` : "";
  return `<a href="${baseURL}/project/issues?${branchParam}id=${encodeURIComponent(component)}&issues=${encodeURIComponent(issue.key)}&open=${encodeURIComponent(issue.key)}">${issue.message}</a>`;
};

const createHotspotLink = (baseURL, branch, component) => (hotspot) => {
  const branchParam = branch ? `branch=${encodeURIComponent(branch)}&` : "";
  return `<a href="${baseURL}/security_hotspots?${branchParam}id=${encodeURIComponent(component)}&hotspots=${encodeURIComponent(hotspot.key)}">${hotspot.message}</a>`;
};

/**
 * @typedef {Object} SonarClientOptions
 * @property {string} [baseURL] - Base URL for the SonarQube instance
 * @property {boolean} [debug] - Enable debug logging
 */

/**
 * Custom error class for SonarQube API errors
 */
class SonarApiError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'SonarApiError';
    this.response = response;
    this.statusCode = response?.statusCode;
  }
}

/**
 * Client for interacting with SonarQube API
 */
class SonarClient {
  constructor(options = {}) {
    if (typeof options === 'string') {
      options = { sonarUrl: options };
    }

    this.options = {
      debug: false,
      ...options
    };

    if (!this.options.sonarUrl) {
      throw new Error('SonarQube URL is required');
    }

    this.debugLog = this.options.debug ? console.debug : () => {};
    this.baseURL = this.options.sonarUrl.replace(/\/+$/, '');
    this.token = this.options.sonarToken;
    this.username = this.options.sonarUsername;
    this.password = this.options.sonarPassword;
    this.headers = {}; // Initialize headers property
    this.agent = this.setupProxy();

    // Add retry config
    this.retryConfig = {
      limit: 3,
      methods: ['GET', 'POST'],
      statusCodes: [408, 429, 500, 502, 503, 504],
      maxRetryAfter: 10000
    };

    // Add logging
    this.logger = options.logger || console;

    this.debugLog(`Initialized SonarClient with URL: ${this.baseURL}`);
    if (this.token) {
      this.debugLog('Using token authentication');
    } else if (this.username) {
      this.debugLog('Using username/password authentication');
    }
  }

  /**
   * Joins URL parts ensuring proper formatting
   * @private
   */
  _joinUrl(base, path) {
    // Safely trim slashes without regex
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = `${cleanBase}/${cleanPath}`;
    this.debugLog(`Joining URLs - Base: ${cleanBase}, Path: ${cleanPath}, Result: ${url}`);
    return url;
  }

  /**
   * Sets up proxy configuration if needed
   * @private
   */
  setupProxy() {
    const proxy = getProxyForUrl(this.baseURL);
    if (!proxy) {
      this.debugLog("No proxy configuration detected");
      return null;
    }

    this.debugLog(`Using proxy: ${new URL(proxy)}`);
    return {
      https: new hpagent.HttpsProxyAgent({ proxy })
    };
  }

  /**
   * Authenticates with SonarQube using credentials or token
   * @param {Object} credentials - Authentication credentials
   * @throws {SonarApiError} If authentication fails
   */
  async authenticate(credentials) {
    try {
      const { username, password, token } = credentials;
      this.debugLog('Authenticating with SonarQube...');

      if (token) {
        this.debugLog('Setting up token authentication');
        // SonarQube expects Bearer token authentication
        this.headers['Authorization'] = `Bearer ${token}`;
      } else if (username && password) {
        this.debugLog('Setting up username/password authentication');
        const response = await this.post("api/authentication/login", {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: `login=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        });
        
        if (response.headers?.['set-cookie']) {
          this.headers["Cookie"] = response.headers["set-cookie"]
            .map(cookie => cookie.split(";")[0])
            .join("; ");
        }
      } else {
        throw new Error("No authentication credentials provided");
      }

      // Verify authentication
      this.debugLog('Verifying authentication...');
      await this.get("api/authentication/validate");
      this.debugLog('Authentication successful');
    } catch (error) {
      this.debugLog('Authentication failed:', error);
      throw new SonarApiError(
        `Authentication failed: ${error.message}`,
        error.response || { statusCode: 401, body: { error: error.message } }
      );
    }
  }

  /**
   * Makes a GET request to the SonarQube API
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional request options
   * @returns {Promise<Object>} - Response data
   */
  async get(endpoint, options = {}) {
    const normalizeOptions = (obj) => {
      return Object.keys(obj)
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {});
    };
    
    const cacheKey = `${endpoint}${JSON.stringify(normalizeOptions(options))}`;
    
    if (cache.has(cacheKey)) {
      this.debugLog('Cache hit for:', endpoint);
      return cache.get(cacheKey);
    }

    try {
      const url = this._joinUrl(this.baseURL, endpoint);
      this.debugLog(`GET Request to: ${url}`);
      
      const requestOptions = {
        headers: this._getHeaders(),
        responseType: 'json',
        retry: this.retryConfig,
        timeout: {
          request: 30000 // 30 seconds timeout
        },
        ...options
      };

      if (this.agent) {
        requestOptions.agent = this.agent;
      }

      const response = await limiter.schedule(() => 
        got.get(url, requestOptions)
      );

      cache.set(cacheKey, response.body);
      return response.body;
    } catch (error) {
      this._handleError(error, 'GET');
    }
  }

  /**
   * Makes a POST request to the SonarQube API
   * @param {string} path - API endpoint path
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} - Response data
   */
  async post(path, params = {}) {
    try {
      const url = this._joinUrl(this.baseURL, path);
      this.debugLog(`POST Request to: ${url}`);

      const requestOptions = {
        headers: this._getHeaders(),
        responseType: 'json',
        retry: this.retryConfig,
        timeout: {
          request: 30000
        },
        ...params
      };

      if (this.agent) {
        requestOptions.agent = this.agent;
      }

      const response = await got.post(url, requestOptions);
      return response.body;
    } catch (error) {
      this._handleError(error, 'POST');
    }
  }

  /**
   * Generates headers for API requests
   * @private
   * @returns {Object} - Headers object
   */
  _getHeaders() {
    return {
      'Cache-Control': 'no-cache',
      ...this.headers // Include any auth headers set during authenticate()
    };
  }

  /**
   * Paginates through API results
   * @param {string} path - API endpoint path
   * @param {Function} processor - Function to process results
   * @param {number} pageSize - Results per page
   * @returns {Promise<Array>} Processed results
   */
  async paginate(path, processor, pageSize = PAGE_SIZE) {
    const results = [];
    let page = 1;
    let nbResults;

    do {
      this.debugLog(`Fetching page ${page}`);
      const json = await this.get(`${path}&ps=${pageSize}&p=${page}`);
      nbResults = processor(json, results);
      page++;
      
      if (page > MAX_PAGE) {
        console.warn(`WARNING: Reached maximum page limit of ${MAX_PAGE}`);
        break;
      }
    } while (nbResults === pageSize);

    return results;
  }

  _handleError(error, method) {
    this.logger.error(`${method} Request failed:`, {
      message: error.message,
      code: error.code,
      statusCode: error.response?.statusCode,
      url: error.response?.url
    });

    if (error.response) {
      throw new SonarApiError(
        `${method} request failed: ${error.response.statusCode} ${error.response.statusMessage}`,
        error.response
      );
    } else {
      throw new SonarApiError(`Network error: ${error.code || error.message}`, {
        statusCode: 0,
        body: { error: error.message }
      });
    }
  }
}

// Enhanced data collectors with better error handling
const collectors = {
  async rules(client, config, options) {
    const rules = new Map();
    const withOrganization = options.sonarOrganization ? 
      `&organization=${options.sonarOrganization}` : "";
    
    try {
      await client.paginate(
        `/api/rules/search?activation=true&f=name,htmlDesc,severity${config.rulesFilter}${withOrganization}`,
        (json, results) => {
          json.rules.forEach(r => rules.set(r.key, {
            name: r.name,
            htmlDesc: r.htmlDesc,
            severity: r.severity
          }));
          return json.rules.length;
        }
      );
      return rules;
    } catch (error) {
      throw new SonarApiError("Failed to collect rules", error.response);
    }
  },

  async issues(client, config, options, rules) {
    const withOrganization = options.sonarOrganization ? `&organization=${options.sonarOrganization}` : "";
    const newCodePeriodFilter = options.inNewCodePeriod ? "&inNewCodePeriod=true" : "";
    const issueLink = createIssueLink(client.baseURL, options.branch, options.sonarcomponent);

    try {
      const issues = await client.paginate(
        `/api/issues/search?componentKeys=${options.sonarcomponent}&statuses=${config.issueStatuses}&resolutions=&s=STATUS&asc=no${newCodePeriodFilter}${config.issuesFilter}${withOrganization}&additionalFields=tags`,
        (json, results) => {
          results.push(...json.issues.map(issue => processIssue(issue, rules, issueLink)));
          return json.issues.length;
        }
      );
      return issues;
    } catch (error) {
      throw new SonarApiError("Failed to collect issues", error.response);
    }
  },

  async hotspots(client, config, options) {
    if (options.noSecurityHotspot) {
      return [];
    }

    const withOrganization = options.sonarOrganization ? `&organization=${options.sonarOrganization}` : "";
    const newCodePeriodFilter = options.inNewCodePeriod ? "&inNewCodePeriod=true" : "";
    const hotspotLink = createHotspotLink(client.baseURL, options.branch, options.sonarcomponent);
    const hotspots = [];

    try {
      // First collect hotspot keys
      const keys = await client.paginate(
      `/api/hotspots/search?projectKey=${options.sonarcomponent}${newCodePeriodFilter}${withOrganization}&status=${config.hotspotStatuses}`,
      (json, results) => {
        results.push(...json.hotspots.map(h => h.key));
        return json.hotspots.length;
      }
      );

      // Then get details for each hotspot
      for (const key of keys) {
      const hotspot = await client.get(`/api/hotspots/show?hotspot=${key}`);
      let severity = HOTSPOT_SEVERITIES[hotspot.rule.vulnerabilityProbability] || "MEDIUM";
      if (severity === "BLOCKER") severity = "HIGH";
      hotspots.push(processHotspot(hotspot, severity, hotspotLink));
      }
      // Convert BLOCKER severity to HIGH for HTML output
      hotspots.forEach(hotspot => {
        if (hotspot.severity === 'BLOCKER') {
          hotspot.severity = 'HIGH';
        }
      });
      return hotspots;
    } catch (error) {
      throw new SonarApiError("Failed to collect hotspots", error.response);
    }
  },

  async qualityGateStatus(client, options) {
    if (!options.qualityGateStatus) {
      return false;
    }

    const filterProjectStatus = options.pullRequest ? `&pullRequest=${options.pullRequest}` : "";
    try {
      const json = await client.get(
        `/api/qualitygates/project_status?projectKey=${options.sonarcomponent}${filterProjectStatus}`
      );

      // Map numeric values to letters
      const conditionValue = new Map([
        ["1", "A"],
        ["2", "B"],
        ["3", "C"],
        ["4", "D"]
      ]);

      // Get date for quality gate status
      let periodDate = 'N/A';
      if (json.projectStatus.period) {
        periodDate = new Date(json.projectStatus.period.date).toISOString().substring(0, 10);
      } else if (json.projectStatus.periods?.[0]) {
        periodDate = new Date(json.projectStatus.periods[0].date).toISOString().substring(0, 10);
      }

      // Process conditions
      if (json.projectStatus.conditions) {
        json.projectStatus.conditions.forEach(condition => {
          condition.metricKey = condition.metricKey.replace(/_/g, " ");
          if (condition.metricKey !== "new duplicated lines density") {
            condition.actualValue = conditionValue.get(condition.actualValue);
            condition.errorThreshold = conditionValue.get(condition.errorThreshold);
          } else {
            condition.actualValue = `${condition.actualValue}%`;
            condition.errorThreshold = `${condition.errorThreshold}%`;
          }
        });
      }

      return {
        ...json,
        periodDate
      };
    } catch (error) {
      throw new SonarApiError("Failed to collect quality gate status", error.response);
    }
  },

  async coverage(client, options) {
    if (!options.coverage) {
      return null;
    }

    const filterCoverage = options.pullRequest ? `&pullRequest=${options.pullRequest}` : "";
    try {
      const json = await client.get(
        `/api/measures/component?component=${options.sonarcomponent}&metricKeys=coverage${filterCoverage}`
      );

      return json.component.measures[0]?.value || 0;
    } catch (error) {
      throw new SonarApiError("Failed to collect coverage", error.response);
    }
  },

  async newCodePeriod(client, options) {
    if (!options.inNewCodePeriod) {
      return null;
    }

    try {
      const json = await client.get(
        `/api/new_code_periods/list?project=${options.sonarcomponent}`
      );

      return `${json.newCodePeriods[0].type} > ${json.newCodePeriods[0].value}`;
    } catch (error) {
      throw new SonarApiError("Failed to collect new code period", error.response);
    }
  }
};

// Data processing functions
const processIssue = (issue, rules, createLink) => {
  const rule = rules.get(issue.rule);
  const message = rule ? rule.name : "/";
  let severity = issue.severity || rule?.severity;

  // Convert BLOCKER to HIGH
  if (severity === 'BLOCKER') {
    severity = 'HIGH';
  }

  return {
    rule: issue.rule,
    severity,
    status: issue.status,
    link: createLink(issue),
    component: issue.component.split(":").pop(),
    line: issue.line,
    description: message,
    message: issue.message,
    key: issue.key,
    tags: issue.tags || []
  };
};

const processHotspot = (hotspot, severity, createLink) => ({
  rule: hotspot.rule.key,
  severity,
  status: hotspot.status,
  link: createLink(hotspot),
  component: hotspot.component.key.split(":").pop(),
  line: hotspot.line,
  description: hotspot.rule ? hotspot.rule.name : "/",
  message: hotspot.message,
  key: hotspot.key,
  tags: hotspot.tags || []
});

// Trend data management
const TREND_DATA_DIR = join(homedir(), '.sonarhawk', 'trends');

async function ensureTrendDataDir() {
  try {
    await mkdir(TREND_DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }
}

async function saveTrendData(projectComponent, reportData) {
  await ensureTrendDataDir();

  const sanitizedComponent = projectComponent.replace(/[^a-z0-9]/gi, '_');
  const trendFile = join(TREND_DATA_DIR, `${sanitizedComponent}.json`);

  let history = [];

  // Load existing history
  try {
    if (existsSync(trendFile)) {
      const content = await readFile(trendFile, 'utf-8');
      history = JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to load trend history:', error.message);
  }

  // Create trend snapshot
  const snapshot = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    summary: reportData.summary,
    coverage: reportData.coverage || 0,
    qualityGateStatus: reportData.qualityGateStatus?.projectStatus?.status || 'N/A',
    totalIssues: reportData.issues.length,
    branch: reportData.branch || 'main',
    compliance: reportData.compliance ? {
      owaspCount: reportData.compliance.owasp?.length || 0,
      cweCount: reportData.compliance.cwe?.length || 0,
      sansCount: reportData.compliance.sans?.length || 0
    } : null
  };

  // Add to history (keep last 100 snapshots)
  history.push(snapshot);
  if (history.length > 100) {
    history = history.slice(-100);
  }

  // Save updated history
  await writeFile(trendFile, JSON.stringify(history, null, 2));
  console.error(`Trend data saved to ${trendFile}`);

  return history;
}

async function loadTrendData(projectComponent, periodDays = 90) {
  await ensureTrendDataDir();

  const sanitizedComponent = projectComponent.replace(/[^a-z0-9]/gi, '_');
  const trendFile = join(TREND_DATA_DIR, `${sanitizedComponent}.json`);

  if (!existsSync(trendFile)) {
    return [];
  }

  try {
    const content = await readFile(trendFile, 'utf-8');
    let history = JSON.parse(content);

    // Filter by period if specified
    if (periodDays) {
      const cutoffDate = Date.now() - (periodDays * 24 * 60 * 60 * 1000);
      history = history.filter(snapshot => snapshot.timestamp >= cutoffDate);
    }

    return history;
  } catch (error) {
    console.error('Failed to load trend data:', error.message);
    return [];
  }
}

function calculateTrends(history) {
  if (history.length < 2) {
    return {
      hasTrendData: false,
      message: 'Need at least 2 historical snapshots for trend analysis'
    };
  }

  const latest = history[history.length - 1];
  const oldest = history[0];
  const previous = history.length > 1 ? history[history.length - 2] : oldest;

  // Calculate deltas
  const calculateDelta = (current, previous) => {
    if (!previous) return { value: 0, percent: 0, direction: 'stable' };
    const delta = current - previous;
    const percent = previous !== 0 ? ((delta / previous) * 100).toFixed(1) : 0;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';
    return { value: delta, percent, direction };
  };

  return {
    hasTrendData: true,
    dataPoints: history.length,
    periodDays: Math.ceil((latest.timestamp - oldest.timestamp) / (1000 * 60 * 60 * 24)),
    latest: latest,
    oldest: oldest,
    deltas: {
      high: calculateDelta(latest.summary.high, previous.summary.high),
      medium: calculateDelta(latest.summary.medium, previous.summary.medium),
      low: calculateDelta(latest.summary.low, previous.summary.low),
      total: calculateDelta(latest.totalIssues, previous.totalIssues),
      coverage: calculateDelta(latest.coverage, previous.coverage)
    },
    overallTrend: {
      high: calculateDelta(latest.summary.high, oldest.summary.high),
      medium: calculateDelta(latest.summary.medium, oldest.summary.medium),
      low: calculateDelta(latest.summary.low, oldest.summary.low),
      total: calculateDelta(latest.totalIssues, oldest.totalIssues),
      coverage: calculateDelta(latest.coverage, oldest.coverage)
    },
    history: history
  };
}

// Slack Integration
async function sendSlackNotification(reportData, options) {
  const webhookUrl = options.slackWebhook || env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('No Slack webhook URL provided. Use --slack-webhook or set SLACK_WEBHOOK_URL environment variable.');
    return;
  }

  try {
    // Check thresholds
    const shouldNotify = !options.slackThreshold ||
      reportData.summary.high >= (options.slackThreshold || 0);

    if (!shouldNotify) {
      console.error(`Slack notification skipped: High severity (${reportData.summary.high}) below threshold (${options.slackThreshold})`);
      return;
    }

    // Determine severity color
    let color = '#36a64f'; // Green (good)
    if (reportData.summary.high > 0) {
      color = '#d9534f'; // Red (critical)
    } else if (reportData.summary.medium > 5) {
      color = '#f0ad4e'; // Orange (warning)
    }

    // Build trend text
    let trendText = '';
    if (reportData.trendAnalysis && reportData.trendAnalysis.hasTrendData) {
      const trend = reportData.trendAnalysis.deltas.total;
      const emoji = trend.direction === 'down' ? '📉' : trend.direction === 'up' ? '📈' : '➡️';
      const sign = trend.value > 0 ? '+' : '';
      trendText = `\n*Trend:* ${emoji} ${sign}${trend.value} issues (${sign}${trend.percent}% vs previous report)`;
    }

    // Create Slack message
    const message = {
      username: 'SonarHawk',
      icon_emoji: ':hawk:',
      attachments: [
        {
          color: color,
          title: `🔒 Security Report: ${reportData.projectName || reportData.sonarComponent}`,
          title_link: reportData.reportUrl || `${reportData.sonarBaseURL}/dashboard?id=${reportData.sonarComponent}`,
          fields: [
            {
              title: 'High Severity',
              value: reportData.summary.high.toString(),
              short: true
            },
            {
              title: 'Medium Severity',
              value: reportData.summary.medium.toString(),
              short: true
            },
            {
              title: 'Low Severity',
              value: reportData.summary.low.toString(),
              short: true
            },
            {
              title: 'Total Issues',
              value: (reportData.summary.high + reportData.summary.medium + reportData.summary.low).toString(),
              short: true
            }
          ],
          footer: `SonarHawk • Generated on ${reportData.date}`,
          footer_icon: 'https://www.sonarqube.org/logos/index/sonarqube-logo.png',
          text: `📊 *Branch:* ${reportData.branch || 'main'}${trendText}`,
          mrkdwn_in: ['text', 'fields']
        }
      ]
    };

    // Add compliance summary if available
    if (reportData.compliance && reportData.compliance.hasComplianceData) {
      const complianceFields = [];

      if (reportData.compliance.owasp && reportData.compliance.owasp.length > 0) {
        const topOwasp = reportData.compliance.owasp.slice(0, 3).map(o => `${o.category}: ${o.count}`).join('\n');
        complianceFields.push({
          title: 'Top OWASP Categories',
          value: topOwasp,
          short: false
        });
      }

      if (complianceFields.length > 0) {
        message.attachments.push({
          color: '#563d7c',
          title: '📋 Compliance Summary',
          fields: complianceFields,
          mrkdwn_in: ['text', 'fields']
        });
      }
    }

    // Send to Slack
    console.error('Sending notification to Slack...');
    const response = await got.post(webhookUrl, {
      json: message,
      timeout: { request: 10000 }
    });

    if (response.statusCode === 200) {
      console.error('✓ Slack notification sent successfully');
    } else {
      console.error(`✗ Slack notification failed: ${response.statusCode}`);
    }

  } catch (error) {
    console.error('Failed to send Slack notification:', error.message);
  }
}

// ===========================
// PR/Branch Analysis & Decoration
// ===========================

/**
 * Decorate a GitHub Pull Request with Quality Gate status and issues
 */
async function decorateGitHubPR(reportData, options) {
  try {
    const token = options.githubToken || env.GITHUB_TOKEN;
    if (!token) {
      console.error('GitHub token not provided. Set --github-token or GITHUB_TOKEN env var');
      return;
    }

    // Parse owner/repo from GITHUB_REPOSITORY or --github-repo
    const repoString = options.githubRepo || env.GITHUB_REPOSITORY;
    if (!repoString) {
      console.error('GitHub repository not specified. Set --github-repo or GITHUB_REPOSITORY env var (format: owner/repo)');
      return;
    }

    const [owner, repo] = repoString.split('/');
    const prNumber = parseInt(options.prKey || env.GITHUB_PR_NUMBER || env.PR_NUMBER);

    if (!prNumber) {
      console.error('PR number not provided. Set --pr-key or GITHUB_PR_NUMBER env var');
      return;
    }

    const octokit = new Octokit({ auth: token });

    // Determine overall status
    const qualityGateStatus = reportData.qualityGateStatus?.projectStatus?.status;
    const passed = qualityGateStatus === 'OK';
    const highIssues = reportData.summary.high || 0;
    const mediumIssues = reportData.summary.medium || 0;
    const lowIssues = reportData.summary.low || 0;
    const totalIssues = reportData.issues.length;

    // Build PR comment body
    let commentBody = `## 🦅 SonarHawk Security Analysis\n\n`;

    // Quality Gate Status
    if (passed) {
      commentBody += `### ✅ Quality Gate: PASSED\n\n`;
    } else {
      commentBody += `### ❌ Quality Gate: FAILED\n\n`;
    }

    // Summary table
    commentBody += `| Severity | Count |\n`;
    commentBody += `|----------|-------|\n`;
    commentBody += `| 🔴 High | ${highIssues} |\n`;
    commentBody += `| 🟠 Medium | ${mediumIssues} |\n`;
    commentBody += `| 🟡 Low | ${lowIssues} |\n`;
    commentBody += `| **Total** | **${totalIssues}** |\n\n`;

    // Trend information if available
    if (reportData.trendAnalysis && reportData.trendAnalysis.hasTrendData) {
      const deltas = reportData.trendAnalysis.deltas;
      commentBody += `### 📈 Trends (vs Previous)\n\n`;
      commentBody += `- High: ${deltas.high.value > 0 ? '+' : ''}${deltas.high.value} (${deltas.high.percent}%)\n`;
      commentBody += `- Medium: ${deltas.medium.value > 0 ? '+' : ''}${deltas.medium.value} (${deltas.medium.percent}%)\n`;
      commentBody += `- Low: ${deltas.low.value > 0 ? '+' : ''}${deltas.low.value} (${deltas.low.percent}%)\n\n`;
    }

    // Compliance summary
    if (reportData.compliance && reportData.compliance.hasComplianceData) {
      commentBody += `### 📋 Compliance\n\n`;
      if (reportData.compliance.owasp && reportData.compliance.owasp.length > 0) {
        const topOwasp = reportData.compliance.owasp.slice(0, 3);
        commentBody += `**Top OWASP Issues:**\n`;
        topOwasp.forEach(item => {
          commentBody += `- ${item.category}: ${item.count}\n`;
        });
        commentBody += `\n`;
      }
    }

    // Top issues (high severity only)
    if (highIssues > 0) {
      const highSeverityIssues = reportData.issues
        .filter(issue => issue.severity === 'HIGH')
        .slice(0, 5);

      commentBody += `### 🔴 High Severity Issues (Top ${Math.min(5, highIssues)})\n\n`;
      highSeverityIssues.forEach((issue, index) => {
        commentBody += `${index + 1}. **${issue.rule}**\n`;
        commentBody += `   - Component: \`${issue.component}\`\n`;
        commentBody += `   - Line: ${issue.line || 'N/A'}\n`;
        commentBody += `   - Message: ${issue.message}\n\n`;
      });

      if (highIssues > 5) {
        commentBody += `_... and ${highIssues - 5} more high severity issues_\n\n`;
      }
    }

    // Link to full report
    if (options.output && options.reportUrl) {
      commentBody += `\n📊 [View Full Report](${options.reportUrl})\n`;
    }

    commentBody += `\n---\n`;
    commentBody += `🤖 Generated by [SonarHawk](https://github.com/SnickerSec/SonarHawk)`;

    // Post comment to PR
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody
    });

    console.error(`✓ Posted PR comment to ${owner}/${repo}#${prNumber}`);

    // Create/Update Check Run if enabled
    if (options.githubCheckRun) {
      const sha = options.githubSha || env.GITHUB_SHA;
      if (!sha) {
        console.error('GitHub SHA not provided for check run. Set --github-sha or GITHUB_SHA env var');
        return;
      }

      await octokit.checks.create({
        owner,
        repo,
        name: 'SonarHawk Security Analysis',
        head_sha: sha,
        status: 'completed',
        conclusion: passed ? 'success' : 'failure',
        output: {
          title: passed ? '✅ Quality Gate Passed' : '❌ Quality Gate Failed',
          summary: `Found ${totalIssues} issues: ${highIssues} high, ${mediumIssues} medium, ${lowIssues} low`,
          text: commentBody
        }
      });

      console.error(`✓ Created GitHub Check Run`);
    }

  } catch (error) {
    console.error('Failed to decorate GitHub PR:', error.message);
  }
}

/**
 * Decorate a GitLab Merge Request with Quality Gate status and issues
 */
async function decorateGitLabMR(reportData, options) {
  try {
    const token = options.gitlabToken || env.GITLAB_TOKEN;
    if (!token) {
      console.error('GitLab token not provided. Set --gitlab-token or GITLAB_TOKEN env var');
      return;
    }

    const projectId = options.gitlabProject || env.CI_PROJECT_ID;
    const mrIid = options.prKey || env.CI_MERGE_REQUEST_IID;
    const gitlabUrl = options.gitlabUrl || env.CI_SERVER_URL || 'https://gitlab.com';

    if (!projectId || !mrIid) {
      console.error('GitLab project ID or MR IID not provided');
      return;
    }

    const qualityGateStatus = reportData.qualityGateStatus?.projectStatus?.status;
    const passed = qualityGateStatus === 'OK';
    const highIssues = reportData.summary.high || 0;
    const mediumIssues = reportData.summary.medium || 0;
    const lowIssues = reportData.summary.low || 0;
    const totalIssues = reportData.issues.length;

    // Build MR note body (similar to GitHub comment)
    let noteBody = `## 🦅 SonarHawk Security Analysis\n\n`;

    if (passed) {
      noteBody += `### ✅ Quality Gate: PASSED\n\n`;
    } else {
      noteBody += `### ❌ Quality Gate: FAILED\n\n`;
    }

    noteBody += `| Severity | Count |\n`;
    noteBody += `|----------|-------|\n`;
    noteBody += `| 🔴 High | ${highIssues} |\n`;
    noteBody += `| 🟠 Medium | ${mediumIssues} |\n`;
    noteBody += `| 🟡 Low | ${lowIssues} |\n`;
    noteBody += `| **Total** | **${totalIssues}** |\n\n`;

    if (highIssues > 0) {
      const highSeverityIssues = reportData.issues
        .filter(issue => issue.severity === 'HIGH')
        .slice(0, 5);

      noteBody += `### 🔴 High Severity Issues (Top ${Math.min(5, highIssues)})\n\n`;
      highSeverityIssues.forEach((issue, index) => {
        noteBody += `${index + 1}. **${issue.rule}**\n`;
        noteBody += `   - Component: \`${issue.component}\`\n`;
        noteBody += `   - Line: ${issue.line || 'N/A'}\n`;
        noteBody += `   - Message: ${issue.message}\n\n`;
      });

      if (highIssues > 5) {
        noteBody += `_... and ${highIssues - 5} more high severity issues_\n\n`;
      }
    }

    noteBody += `\n---\n`;
    noteBody += `🤖 Generated by [SonarHawk](https://github.com/SnickerSec/SonarHawk)`;

    // Post note to MR
    const response = await axios.post(
      `${gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/notes`,
      { body: noteBody },
      { headers: { 'PRIVATE-TOKEN': token } }
    );

    console.error(`✓ Posted MR comment to GitLab project ${projectId} MR !${mrIid}`);

    // Update commit status
    if (options.gitlabCommitStatus) {
      const sha = options.gitlabSha || env.CI_COMMIT_SHA;
      if (sha) {
        await axios.post(
          `${gitlabUrl}/api/v4/projects/${projectId}/statuses/${sha}`,
          {
            state: passed ? 'success' : 'failed',
            name: 'SonarHawk Security Analysis',
            description: `${totalIssues} issues: ${highIssues} high, ${mediumIssues} medium, ${lowIssues} low`
          },
          { headers: { 'PRIVATE-TOKEN': token } }
        );

        console.error(`✓ Updated GitLab commit status`);
      }
    }

  } catch (error) {
    console.error('Failed to decorate GitLab MR:', error.message);
  }
}

/**
 * Decorate an Azure DevOps Pull Request with Quality Gate status
 */
async function decorateAzurePR(reportData, options) {
  try {
    const token = options.azureToken || env.AZURE_DEVOPS_TOKEN || env.SYSTEM_ACCESSTOKEN;
    if (!token) {
      console.error('Azure DevOps token not provided. Set --azure-token or AZURE_DEVOPS_TOKEN env var');
      return;
    }

    const organization = options.azureOrg || env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI?.replace('https://dev.azure.com/', '').replace('/', '');
    const project = options.azureProject || env.SYSTEM_TEAMPROJECT;
    const repoId = options.azureRepo || env.BUILD_REPOSITORY_ID;
    const prId = options.prKey || env.SYSTEM_PULLREQUEST_PULLREQUESTID;

    if (!organization || !project || !repoId || !prId) {
      console.error('Azure DevOps organization, project, repo, or PR ID not provided');
      return;
    }

    const qualityGateStatus = reportData.qualityGateStatus?.projectStatus?.status;
    const passed = qualityGateStatus === 'OK';
    const highIssues = reportData.summary.high || 0;
    const mediumIssues = reportData.summary.medium || 0;
    const lowIssues = reportData.summary.low || 0;
    const totalIssues = reportData.issues.length;

    // Build PR comment
    let commentContent = `## 🦅 SonarHawk Security Analysis\n\n`;

    if (passed) {
      commentContent += `### ✅ Quality Gate: PASSED\n\n`;
    } else {
      commentContent += `### ❌ Quality Gate: FAILED\n\n`;
    }

    commentContent += `| Severity | Count |\n`;
    commentContent += `|----------|-------|\n`;
    commentContent += `| 🔴 High | ${highIssues} |\n`;
    commentContent += `| 🟠 Medium | ${mediumIssues} |\n`;
    commentContent += `| 🟡 Low | ${lowIssues} |\n`;
    commentContent += `| **Total** | **${totalIssues}** |\n\n`;

    if (highIssues > 0) {
      const highSeverityIssues = reportData.issues
        .filter(issue => issue.severity === 'HIGH')
        .slice(0, 5);

      commentContent += `### 🔴 High Severity Issues (Top ${Math.min(5, highIssues)})\n\n`;
      highSeverityIssues.forEach((issue, index) => {
        commentContent += `${index + 1}. **${issue.rule}**\n`;
        commentContent += `   - Component: \`${issue.component}\`\n`;
        commentContent += `   - Line: ${issue.line || 'N/A'}\n`;
        commentContent += `   - Message: ${issue.message}\n\n`;
      });

      if (highIssues > 5) {
        commentContent += `_... and ${highIssues - 5} more high severity issues_\n\n`;
      }
    }

    commentContent += `\n---\n`;
    commentContent += `🤖 Generated by [SonarHawk](https://github.com/SnickerSec/SonarHawk)`;

    const apiUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoId}/pullRequests/${prId}/threads?api-version=7.0`;

    // Post comment thread
    await axios.post(
      apiUrl,
      {
        comments: [{ content: commentContent, commentType: 1 }],
        status: 1 // Active
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.error(`✓ Posted PR comment to Azure DevOps ${organization}/${project} PR #${prId}`);

  } catch (error) {
    console.error('Failed to decorate Azure DevOps PR:', error.message);
  }
}

/**
 * Main PR decoration router - detects platform and decorates accordingly
 */
async function decoratePR(reportData, options) {
  // Determine platform
  const platform = options.prPlatform ||
                   (env.GITHUB_ACTIONS ? 'github' : '') ||
                   (env.GITLAB_CI ? 'gitlab' : '') ||
                   (env.AZURE_DEVOPS ? 'azure' : '') ||
                   (env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI ? 'azure' : '');

  if (!platform) {
    console.error('PR platform not detected. Set --pr-platform (github|gitlab|azure) or run in CI environment');
    return;
  }

  console.error(`Decorating PR on platform: ${platform}`);

  switch (platform.toLowerCase()) {
    case 'github':
      await decorateGitHubPR(reportData, options);
      break;
    case 'gitlab':
      await decorateGitLabMR(reportData, options);
      break;
    case 'azure':
      await decorateAzurePR(reportData, options);
      break;
    default:
      console.error(`Unknown PR platform: ${platform}`);
  }
}

// Process compliance data from issues
const processComplianceData = (issues) => {
  const compliance = {
    owasp: {
      'a1-injection': [],
      'a2-broken-authentication': [],
      'a3-sensitive-data-exposure': [],
      'a4-xxe': [],
      'a5-broken-access-control': [],
      'a6-security-misconfiguration': [],
      'a7-xss': [],
      'a8-insecure-deserialization': [],
      'a9-vulnerable-components': [],
      'a10-insufficient-logging': []
    },
    cwe: new Map(),
    sans: new Map(),
    otherTags: new Set()
  };

  issues.forEach(issue => {
    if (!issue.tags || issue.tags.length === 0) return;

    issue.tags.forEach(tag => {
      const lowerTag = tag.toLowerCase();

      // OWASP Top 10 (2017 and 2021 versions)
      if (lowerTag.includes('owasp-a') || lowerTag.includes('owasp-top-10')) {
        // Map OWASP tags to categories
        if (lowerTag.includes('a1') || lowerTag.includes('injection')) {
          compliance.owasp['a1-injection'].push(issue);
        } else if (lowerTag.includes('a2') || lowerTag.includes('authentication')) {
          compliance.owasp['a2-broken-authentication'].push(issue);
        } else if (lowerTag.includes('a3') || lowerTag.includes('sensitive-data')) {
          compliance.owasp['a3-sensitive-data-exposure'].push(issue);
        } else if (lowerTag.includes('a4') || lowerTag.includes('xxe')) {
          compliance.owasp['a4-xxe'].push(issue);
        } else if (lowerTag.includes('a5') || lowerTag.includes('access-control')) {
          compliance.owasp['a5-broken-access-control'].push(issue);
        } else if (lowerTag.includes('a6') || lowerTag.includes('misconfiguration')) {
          compliance.owasp['a6-security-misconfiguration'].push(issue);
        } else if (lowerTag.includes('a7') || lowerTag.includes('xss') || lowerTag.includes('cross-site')) {
          compliance.owasp['a7-xss'].push(issue);
        } else if (lowerTag.includes('a8') || lowerTag.includes('deserialization')) {
          compliance.owasp['a8-insecure-deserialization'].push(issue);
        } else if (lowerTag.includes('a9') || lowerTag.includes('component')) {
          compliance.owasp['a9-vulnerable-components'].push(issue);
        } else if (lowerTag.includes('a10') || lowerTag.includes('logging')) {
          compliance.owasp['a10-insufficient-logging'].push(issue);
        }
      }
      // CWE (Common Weakness Enumeration)
      else if (lowerTag.includes('cwe')) {
        const cweMatch = tag.match(/cwe-?(\d+)/i);
        if (cweMatch) {
          const cweId = `CWE-${cweMatch[1]}`;
          if (!compliance.cwe.has(cweId)) {
            compliance.cwe.set(cweId, []);
          }
          compliance.cwe.get(cweId).push(issue);
        }
      }
      // SANS Top 25
      else if (lowerTag.includes('sans-top') || lowerTag.includes('sans25')) {
        const sansMatch = tag.match(/sans[- ]?(\d+)/i);
        if (sansMatch) {
          const sansId = `SANS-${sansMatch[1]}`;
          if (!compliance.sans.has(sansId)) {
            compliance.sans.set(sansId, []);
          }
          compliance.sans.get(sansId).push(issue);
        }
      } else {
        compliance.otherTags.add(tag);
      }
    });
  });

  // Convert Maps to sorted arrays for easier template rendering
  const cweArray = Array.from(compliance.cwe.entries())
    .map(([id, issues]) => ({ id, count: issues.length, issues }))
    .sort((a, b) => b.count - a.count);

  const sansArray = Array.from(compliance.sans.entries())
    .map(([id, issues]) => ({ id, count: issues.length, issues }))
    .sort((a, b) => b.count - a.count);

  // Calculate OWASP stats
  const owaspStats = Object.entries(compliance.owasp).map(([category, issues]) => ({
    category: category.replace(/-/g, ' ').toUpperCase(),
    categoryId: category,
    count: issues.length,
    issues
  })).filter(item => item.count > 0);

  return {
    owasp: owaspStats,
    cwe: cweArray,
    sans: sansArray,
    otherTags: Array.from(compliance.otherTags),
    hasComplianceData: owaspStats.length > 0 || cweArray.length > 0 || sansArray.length > 0
  };
};

// Portfolio report generation function
const generatePortfolioReport = async (options) => {
  const { onError = () => process.exit(1) } = options;

  try {
    // Parse portfolio projects from options
    let projects = [];

    if (options.portfolioConfig) {
      // Load from JSON file
      const configData = await readFile(options.portfolioConfig, 'utf-8');
      const config = JSON.parse(configData);
      projects = config.projects;
    } else if (options.portfolioProjects) {
      // Parse from command line (comma-separated)
      projects = options.portfolioProjects.split(',').map(p => {
        const [component, name] = p.split(':');
        return { component: component.trim(), name: name?.trim() || component.trim() };
      });
    } else {
      throw new Error('Portfolio requires either --portfolio-config or --portfolio-projects');
    }

    console.error(`Generating portfolio report for ${projects.length} projects...`);

    // Initialize client
    const client = new SonarClient({
      sonarUrl: options.sonarurl,
      sonarToken: options.sonartoken,
      sonarUsername: options.sonarusername,
      sonarPassword: options.sonarpassword,
      debug: options.debug
    });

    // Get SonarQube version
    const version = await client.get("/api/system/status").then(res => semver.coerce(res.version));
    console.error("SonarQube version: %s", version);

    const config = getSonarConfig(version);

    // Authenticate if credentials provided
    if (client.token || (client.username && client.password)) {
      await client.authenticate({
        username: client.username,
        password: client.password,
        token: client.token
      });
    }

    // Collect data for all projects
    const portfolioData = [];
    let totalIssues = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;

    for (const project of projects) {
      console.error(`Collecting data for project: ${project.name}`);

      try {
        const projectOptions = {
          ...options,
          sonarcomponent: project.component,
          project: project.name
        };

        // Collect project data
        const rules = await collectors.rules(client, config, projectOptions);
        const issues = await collectors.issues(client, config, projectOptions, rules);
        const hotspots = await collectors.hotspots(client, config, projectOptions);
        const qualityGateStatus = await collectors.qualityGateStatus(client, projectOptions);
        const coverage = await collectors.coverage(client, projectOptions);

        const allIssues = [...issues, ...hotspots];
        const summary = {
          high: allIssues.filter(i => i.severity === "HIGH" || i.severity === "BLOCKER").length,
          medium: allIssues.filter(i => i.severity === "MEDIUM").length,
          low: allIssues.filter(i => i.severity === "LOW").length,
          total: allIssues.length
        };

        // Aggregate totals
        totalIssues += summary.total;
        totalHigh += summary.high;
        totalMedium += summary.medium;
        totalLow += summary.low;

        portfolioData.push({
          name: project.name,
          component: project.component,
          summary,
          qualityGateStatus: qualityGateStatus?.projectStatus?.status || 'N/A',
          coverage: coverage || 0,
          issues: allIssues,
          compliance: processComplianceData(allIssues)
        });

      } catch (error) {
        console.error(`Failed to collect data for ${project.name}:`, error.message);
        portfolioData.push({
          name: project.name,
          component: project.component,
          error: error.message,
          summary: { high: 0, medium: 0, low: 0, total: 0 }
        });
      }
    }

    // Prepare portfolio summary data
    const data = {
      date: new Date().toLocaleDateString("en-us", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      portfolioName: options.portfolioName || 'Security Portfolio',
      sonarBaseURL: client.baseURL,
      projects: portfolioData,
      totalProjects: projects.length,
      aggregateSummary: {
        totalIssues,
        high: totalHigh,
        medium: totalMedium,
        low: totalLow,
        avgCoverage: portfolioData.reduce((sum, p) => sum + (p.coverage || 0), 0) / portfolioData.length,
        qualityGatesPassed: portfolioData.filter(p => p.qualityGateStatus === 'OK').length,
        qualityGatesFailed: portfolioData.filter(p => p.qualityGateStatus === 'ERROR').length
      }
    };

    // Generate portfolio output
    await generatePortfolioOutput(data, options);

    console.error('Portfolio report generated successfully');
    return data;

  } catch (error) {
    console.error('Portfolio generation error:', error.message);
    throw error;
  }
};

// Main report generation function
const generateReport = async (options) => {
  const { onError = () => process.exit(1) } = options;
  
  try {
    // Load properties file if specified
    const properties = options.sonarPropertiesFile ? 
      getProperties(readFileSync(options.sonarPropertiesFile)) : 
      {};

    // Initialize client with all necessary options
    const client = new SonarClient({
      sonarUrl: options.sonarurl || properties["sonar.host.url"],
      sonarToken: options.sonartoken,
      sonarUsername: options.sonarusername || properties["sonar.login"],
      sonarPassword: options.sonarpassword || properties["sonar.password"],
      debug: options.debug
    });

    // Get SonarQube version
    const version = await client.get("/api/system/status").then(res => semver.coerce(res.version));
    console.error("sonarqube version: %s", version);

    // Get configuration based on version
    const config = getSonarConfig(version);
    
    // Authenticate only if credentials are provided
    if (client.token || (client.username && client.password)) {
      try {
        await client.authenticate({
          username: client.username,
          password: client.password,
          token: client.token
        });
      } catch (error) {
        console.error('Authentication failed:', error.message);
        throw error;
      }
    }

    // Collect all data
    const rules = await collectors.rules(client, config, options);
    const issues = await collectors.issues(client, config, options, rules);
    const hotspots = await collectors.hotspots(client, config, options);
    const qualityGateStatus = await collectors.qualityGateStatus(client, options);
    const coverage = await collectors.coverage(client, options);
    const newCodePeriod = await collectors.newCodePeriod(client, options);

    // Combine and process data
    const allIssues = [...issues, ...hotspots].sort((a, b) =>
      SEVERITY_WEIGHTS[b.severity] - SEVERITY_WEIGHTS[a.severity]
    );

    // Filter rules if needed
    if (!options.noRulesInReport && options.onlyDetectedRules) {
      for (const [key] of rules) {
        if (!allIssues.some(issue => issue.rule === key)) {
          rules.delete(key);
        }
      }
    }

    // Process compliance data
    const complianceData = processComplianceData(allIssues);

    // Prepare final data object
    const data = {
      date: new Date().toLocaleDateString("en-us", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      projectName: options.project || properties["sonar.projectName"],
      applicationName: options.application,
      releaseName: options.release,
      pullRequest: options.pullrequest,
      branch: options.branch,
      inNewCodePeriod: newCodePeriod,
      allBugs: options.allbugs,
      fixMissingRule: options.fixMissingRule,
      noSecurityHotspot: !options.securityHotspot,
      noRulesInReport: !options.rulesInReport,
      onlyDetectedRules: options.onlyDetectedRules,
      vulnerabilityPhrase: options.vulnerabilityPhrase,
      noCoverage: !options.coverage,
      vulnerabilityPluralPhrase: options.vulnerabilityPluralPhrase,
      sonarBaseURL: client.baseURL,
      sonarComponent: options.sonarcomponent || properties["sonar.projectKey"],
      sonarOrganization: options.sonarorganization,
      rules,
      issues: allIssues,
      qualityGateStatus,
      qualityGateStatusPeriodDate: qualityGateStatus?.periodDate || 'N/A',
      coverage,
      deltaAnalysis: newCodePeriod ? "Yes" : "No",
      compliance: complianceData,
      includeCompliance: options.includeCompliance !== false, // Default to true
      summary: {
        high: allIssues.filter(issue =>
          issue.severity === "HIGH" || issue.severity === "BLOCKER"
        ).length,
        medium: allIssues.filter(issue =>
          issue.severity === "MEDIUM"
        ).length,
        low: allIssues.filter(issue =>
          issue.severity === "LOW"
        ).length
      }
    };

    // Save trend data if requested
    if (options.saveTrendData) {
      await saveTrendData(options.sonarcomponent, data);
    }

    // Load and add trend data if available
    if (options.includeTrends) {
      const trendHistory = await loadTrendData(
        options.sonarcomponent,
        options.trendPeriod || 90
      );
      const trendAnalysis = calculateTrends(trendHistory);
      data.trendAnalysis = trendAnalysis;
    }

    // Generate reports
    await generateOutput(data, options);

    // Send Slack notification if requested
    if (options.slackWebhook || env.SLACK_WEBHOOK_URL) {
      await sendSlackNotification(data, options);
    }

    // Decorate PR/MR if requested (Developer Edition feature)
    if (options.prDecoration || options.prKey) {
      await decoratePR(data, options);
    }

    // Print summary to console
    console.error(await ejs.renderFile(
      resolve(__dirname, "summary.txt.ejs"),
      data,
      {}
    ));

    // Exit with error if issues found and exit code requested
    if (options.exitCode && allIssues.length > 0) {
      const error = new Error("Issues were found");
      error.data = data;
      onError(error);
    }

    return data;

  } catch (error) {
    console.error(
      "Error: %s - %s - %s - %s - %s",
      error.code,
      error.message,
      error.response?.statusCode,
      error.response?.statusMessage,
      JSON.stringify(error.response?.body, null, 2)
    );
    throw error;
  }
};

// Portfolio output generation
async function generatePortfolioOutput(data, options) {
  // Save JSON report if requested
  if (options.saveReportJson) {
    await writeFile(
      options.saveReportJson,
      JSON.stringify(data, null, 2)
    );
  }

  // Generate HTML portfolio report
  if (options.output) {
    const templateFile = resolve(__dirname, "portfolio.ejs");
    console.error("using portfolio template file: %s", templateFile);

    if (!existsSync(templateFile)) {
      throw new Error(`Portfolio template file not found: ${templateFile}`);
    }

    const renderedFile = await ejs.renderFile(
      templateFile,
      {
        ...data,
        lightTheme: options.lightTheme === true,
        darkTheme: !options.lightTheme
      },
      {}
    );

    await writeFile(options.output, renderedFile);
  }
}

// Custom Dashboard Configuration
const DASHBOARD_PRESETS = {
  executive: {
    name: 'Executive Dashboard',
    description: 'High-level overview for executives',
    sections: ['summary', 'trends', 'qualityGate', 'compliance'],
    hideDetails: true,
    emphasize: ['high']
  },
  developer: {
    name: 'Developer Dashboard',
    description: 'Detailed view for developers',
    sections: ['summary', 'details', 'rules', 'compliance'],
    hideDetails: false,
    emphasize: ['high', 'medium']
  },
  security: {
    name: 'Security Team Dashboard',
    description: 'Security-focused view',
    sections: ['summary', 'compliance', 'details', 'trends', 'rules'],
    hideDetails: false,
    emphasize: ['high', 'medium', 'low']
  },
  audit: {
    name: 'Audit & Compliance Dashboard',
    description: 'Compliance-focused for auditors',
    sections: ['summary', 'compliance', 'qualityGate'],
    hideDetails: true,
    emphasize: ['high']
  },
  minimal: {
    name: 'Minimal Dashboard',
    description: 'Essential information only',
    sections: ['summary'],
    hideDetails: true,
    emphasize: ['high']
  }
};

async function loadDashboardConfig(options) {
  // Check for custom dashboard config file
  if (options.dashboardConfig) {
    try {
      const configPath = resolve(options.dashboardConfig);
      if (existsSync(configPath)) {
        const configData = await readFile(configPath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error(`Failed to load dashboard config: ${error.message}`);
    }
  }

  // Use preset if specified
  if (options.dashboardPreset && DASHBOARD_PRESETS[options.dashboardPreset]) {
    return DASHBOARD_PRESETS[options.dashboardPreset];
  }

  // Default: all sections
  return {
    name: 'Default Dashboard',
    sections: ['summary', 'trends', 'compliance', 'details', 'rules', 'qualityGate'],
    hideDetails: false,
    emphasize: ['high', 'medium', 'low']
  };
}

// Output generation
async function generateOutput(data, options) {
  // Save JSON report if requested
  if (options.saveReportJson) {
    const replacer = (key, value) => {
      if (key === "rules") {
        return Array.from(value).reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
      }
      return value;
    };

    await writeFile(
      options.saveReportJson,
      JSON.stringify(data, replacer, 2)
    );
  }

  // Always generate HTML report using index.ejs
  if (options.output) {
    const stylesheetFile = options.stylesheetFile ||
      resolve(__dirname, "style.css");
    const stylesheet = await readFile(stylesheetFile, "binary");
    console.error("using stylesheet file: %s", stylesheetFile);

    let templateFile;
    if (options.ejsFile) {
      const localPath = resolve(__dirname, options.ejsFile);
      templateFile = existsSync(localPath) ? localPath : resolve(options.ejsFile);
    } else {
      templateFile = resolve(__dirname, "index.ejs");
    }

    console.error("using template file: %s", templateFile);

    if (!existsSync(templateFile)) {
      throw new Error(`Template file not found: ${templateFile}`);
    }

    // Load dashboard configuration
    const dashboardConfig = await loadDashboardConfig(options);
    console.error(`using dashboard: ${dashboardConfig.name}`);

    // Filter issues based on dashboard.emphasize if specified
    let filteredIssues = data.issues;
    if (dashboardConfig.emphasize && dashboardConfig.emphasize.length > 0) {
      const emphasizeSeverities = dashboardConfig.emphasize.map(s => s.toUpperCase());
      filteredIssues = data.issues.filter(issue =>
        emphasizeSeverities.includes(issue.severity)
      );
    }

    const renderedFile = await ejs.renderFile(
      templateFile,
      {
        ...data,
        issues: filteredIssues,
        stylesheet,
        lightTheme: options.lightTheme === true,
        darkTheme: !options.lightTheme,
        dashboard: dashboardConfig
      },
      {}
    );

    await writeFile(options.output, renderedFile);
  }
}

// Command builder function
const buildCommand = () => {
  try {
    const program = new Command();
    program
      .description("Generate a vulnerability report from a SonarQube instance.")
    .option(
      "--ejs-file <filename>",
      "EJS template file to use for report generation."
    )
    .option(     
        "--http-proxy",
        "the proxy to use to reach the sonarqube instance (http://<host>:<port>)"
        )
    .option(
      "--project <project>",
      "name of the project, displayed in the header of the generated report"
    )
    .option(
      "--application <application>", 
      "name of the application, displayed in the header of the generated report"
    )
    .option(
      "--release <release>",
      "name of the release, displayed in the header of the generated report"
    )
    .option(
      "--branch <branch>",
      "Branch in Sonarqube that we want to get the issues for"
    )
    .option(
      "--pullrequest <pr>",
      "pull request ID in Sonarqube for which to get the issues/hotspots"
    )
    .option(
      "--sonarurl <url>",
      "base URL of the SonarQube instance to query from"  
    )
    .option("--sonarcomponent <component>", "id of the component to query from")
    .option("--sonarusername <username>", "auth username")
    .option("--sonarpassword <password>", "auth password") 
    .option("--sonartoken <token>", "auth token")
    .option(
      "--sonarorganization <organization>",
      "name of the sonarcloud.io organization"
    )
    .option(
      "--in-new-code-period",
      "flag to indicate if the reporting should be done using the new code definition (delta analysis)."
    )
    .option(
      "--allbugs",
      "flag to indicate if the report should contain all bugs, not only vulnerabilities."
    )
    .option(
      "--fix-missing-rule", 
      "Extract rules without filtering on type (even if allbugs=false). Not useful if allbugs=true."
    )
    .option(
      "--no-security-hotspot",
      "Set this flag for old versions of sonarQube without security hotspots (<7.3)."
    )
    .option(
      "--coverage",
      "Set this flag to include code coverage status in the report."
    )
    .option(
      "--link-issues",
      "Set this flag to create links to Sonar from reported issues"
    )
    .option(
      "--quality-gate-status", 
      "Set this flag to include quality gate status in the report."
    )
    .option(
      "--no-rules-in-report",
      'Set this flag to omit "Known Security Rules" section from report.'
    )
    .option(
      "--only-detected-rules",
      "Set this flag to include only detected rules in the report. Not useful if no-rules-in-report=true."
    )
    .option(
      "--vulnerability-phrase <phrase>",
      "Set to override 'Vulnerability' phrase in the report."
    )
    .option(
      "--vulnerability-plural-phrase <phrase>", 
      "Set to override 'Vulnerabilities' phrase in the report."
    )
    .option(
      "--save-report-json <filename>",
      "Save the report data in JSON format. Set to target file name"
    )
    .option(
      "--sonar-properties-file <filename>",
      "To use a sonar properties file."
    )
    .option(
      "--stylesheet-file <filename>",
      "CSS stylesheet file path."
    )
    .option(
      "--output <filename>",
      "Output report file path."
    )
    .option(
      "--debug",
      "Enable debug logging"
    )
    .option(
      "--dark-theme",
      "Enable dark theme for the report"
    )
    .option(
      "--light-theme",
      "Enable light theme for the report (dark theme is default)"
    )
    .option(
      "--include-compliance",
      "Include compliance section with OWASP, CWE, and SANS categorization (enabled by default)"
    )
    .option(
      "--no-include-compliance",
      "Disable compliance section in the report"
    )
    .option(
      "--portfolio-mode",
      "Enable portfolio mode to aggregate multiple projects"
    )
    .option(
      "--portfolio-config <file>",
      "JSON configuration file for portfolio projects"
    )
    .option(
      "--portfolio-projects <projects>",
      "Comma-separated list of projects (format: component:name,component:name)"
    )
    .option(
      "--portfolio-name <name>",
      "Name for the portfolio report"
    )
    .option(
      "--save-trend-data",
      "Save current report data for trend analysis (stored in ~/.sonarhawk/trends)"
    )
    .option(
      "--include-trends",
      "Include trend analysis in report (requires historical data from --save-trend-data)"
    )
    .option(
      "--trend-period <days>",
      "Number of days to include in trend analysis (default: 90)",
      "90"
    )
    .option(
      "--slack-webhook <url>",
      "Slack webhook URL for notifications (or set SLACK_WEBHOOK_URL env var)"
    )
    .option(
      "--slack-threshold <number>",
      "Only send Slack notification if high severity issues >= threshold",
      "0"
    )
    .option(
      "--slack-channel <channel>",
      "Slack channel for notifications (optional, webhook default is used if not specified)"
    )
    .option(
      "--dashboard-preset <preset>",
      "Use a predefined dashboard layout: executive, developer, security, audit, minimal"
    )
    .option(
      "--dashboard-config <file>",
      "Custom dashboard configuration JSON file"
    )
    // PR/Branch Analysis & Decoration (Developer Edition features)
    .option(
      "--pr-decoration",
      "Enable PR/MR decoration (posts results as comment) - auto-detected in CI"
    )
    .option(
      "--pr-key <number>",
      "Pull Request / Merge Request number or ID"
    )
    .option(
      "--pr-platform <platform>",
      "Platform for PR decoration: github, gitlab, azure (auto-detected in CI)"
    )
    .option(
      "--github-token <token>",
      "GitHub Personal Access Token (or set GITHUB_TOKEN env var)"
    )
    .option(
      "--github-repo <owner/repo>",
      "GitHub repository in format owner/repo (or set GITHUB_REPOSITORY env var)"
    )
    .option(
      "--github-sha <sha>",
      "GitHub commit SHA for check runs (or set GITHUB_SHA env var)"
    )
    .option(
      "--github-check-run",
      "Create GitHub Check Run in addition to PR comment"
    )
    .option(
      "--gitlab-token <token>",
      "GitLab Personal Access Token (or set GITLAB_TOKEN env var)"
    )
    .option(
      "--gitlab-project <id>",
      "GitLab project ID (or set CI_PROJECT_ID env var)"
    )
    .option(
      "--gitlab-url <url>",
      "GitLab instance URL (default: https://gitlab.com or CI_SERVER_URL env var)"
    )
    .option(
      "--gitlab-sha <sha>",
      "GitLab commit SHA for commit status (or set CI_COMMIT_SHA env var)"
    )
    .option(
      "--gitlab-commit-status",
      "Update GitLab commit status in addition to MR comment"
    )
    .option(
      "--azure-token <token>",
      "Azure DevOps Personal Access Token (or set AZURE_DEVOPS_TOKEN / SYSTEM_ACCESSTOKEN env var)"
    )
    .option(
      "--azure-org <organization>",
      "Azure DevOps organization name"
    )
    .option(
      "--azure-project <project>",
      "Azure DevOps project name"
    )
    .option(
      "--azure-repo <repoId>",
      "Azure DevOps repository ID"
    )
    .option(
      "--report-url <url>",
      "Public URL where the report will be accessible (for PR comments)"
    )
    .option(
      "--branch-name <name>",
      "Branch name for branch analysis (for SonarQube sonar.branch.name parameter)"
    )
    .option(
      "--branch-target <target>",
      "Target branch for comparison (for SonarQube sonar.branch.target parameter)"
    )
        .addHelpText(
          "after",
          `
    Examples:
      Generate single project report:
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --output=report.html

      Generate report with compliance view:
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --include-compliance --output=report.html

      Generate portfolio report:
        sonarhawk --portfolio-mode --portfolio-name="Enterprise Security" --sonarurl=https://sonarqube.company.com --sonartoken=xxx --portfolio-projects="app1:Frontend,app2:Backend,app3:API" --output=portfolio.html

      Generate portfolio report from config file:
        sonarhawk --portfolio-mode --sonarurl=https://sonarqube.company.com --sonartoken=xxx --portfolio-config=portfolio.json --output=portfolio.html

      Portfolio config JSON format (portfolio.json):
        {
          "projects": [
            { "component": "app1:main", "name": "Frontend App" },
            { "component": "app2:main", "name": "Backend API" },
            { "component": "app3:main", "name": "Mobile App" }
          ]
        }

      Trend Analysis (track improvements over time):
        # First run: Save baseline data
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --save-trend-data --output=report.html

        # Subsequent runs: Save data AND show trends
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --save-trend-data --include-trends --output=report.html

        # Show trends for last 30 days
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --include-trends --trend-period=30 --output=report.html

      Export to PDF:
        Open the generated HTML report in a browser and click "Export to PDF" button (or press Ctrl/Cmd+P)

      Slack Integration (send notifications to Slack):
        # Basic Slack notification
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --slack-webhook=https://hooks.slack.com/services/YOUR/WEBHOOK/URL --output=report.html

        # Only notify if high severity >= 5
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --slack-webhook=https://hooks.slack.com/services/YOUR/WEBHOOK/URL --slack-threshold=5 --output=report.html

        # Use environment variable for webhook
        export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --output=report.html

      Custom Dashboards (different views for different audiences):
        # Executive dashboard (high-level overview)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --dashboard-preset=executive --output=executive-report.html

        # Developer dashboard (detailed view with code issues)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --dashboard-preset=developer --output=dev-report.html

        # Security team dashboard (security-focused)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --dashboard-preset=security --output=security-report.html

        # Audit & compliance dashboard
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --dashboard-preset=audit --output=audit-report.html

        # Custom dashboard from JSON config
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --dashboard-config=my-dashboard.json --output=custom-report.html

      Dashboard Presets:
        - executive: High-level summary, trends, quality gates (for management)
        - developer: Detailed issues, rules, compliance (for dev teams)
        - security: Security focus with compliance data (for security teams)
        - audit: Compliance and quality gates only (for auditors)
        - minimal: Essential summary only (for quick checks)

      Custom Dashboard JSON Format:
        {
          "name": "My Custom Dashboard",
          "description": "Custom view for my team",
          "sections": ["summary", "trends", "compliance", "details", "rules", "qualityGate"],
          "hideDetails": false,
          "emphasize": ["high", "medium"]
        }

      PR/MR Decoration (Developer Edition Feature - replicate in Community):
        # GitHub PR Decoration (auto-detected in GitHub Actions)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-key=<PR_NUMBER> --github-token=<GITHUB_TOKEN> --output=report.html

        # GitHub with manual configuration
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-decoration --pr-key=123 --pr-platform=github --github-token=ghp_xxx --github-repo=owner/repo --output=report.html

        # GitHub with Check Run (shows in PR checks tab)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-key=123 --github-token=ghp_xxx --github-repo=owner/repo --github-sha=<COMMIT_SHA> --github-check-run --output=report.html

        # GitLab MR Decoration (auto-detected in GitLab CI)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-key=<CI_MERGE_REQUEST_IID> --gitlab-token=<GITLAB_TOKEN> --output=report.html

        # GitLab with commit status
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-key=<CI_MERGE_REQUEST_IID> --gitlab-token=<GITLAB_TOKEN> --gitlab-commit-status --output=report.html

        # Azure DevOps PR Decoration (auto-detected in Azure Pipelines)
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-key=<PULLREQUEST_ID> --azure-token=<SYSTEM_ACCESSTOKEN> --output=report.html

        # Azure DevOps with manual configuration
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --pr-decoration --pr-key=456 --pr-platform=azure --azure-token=xxx --azure-org=myorg --azure-project=myproject --azure-repo=repo-id --output=report.html

      Branch Analysis (Developer Edition Feature):
        # Analyze a feature branch
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --branch-name=feature/new-feature --output=report.html

        # Analyze and compare to target branch
        sonarhawk --project=MyProject --sonarurl=https://sonarqube.company.com --sonarcomponent=myapp:main --sonartoken=xxx --branch-name=feature/new-feature --branch-target=main --output=report.html

      CI/CD Integration Examples:
        See the README or documentation for full CI/CD integration examples for:
        - GitHub Actions (.github/workflows/sonar.yml)
        - GitLab CI (.gitlab-ci.yml)
        - Azure Pipelines (azure-pipelines.yml)

        Environment variables detected automatically in CI:
        - GitHub Actions: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, etc.
        - GitLab CI: GITLAB_TOKEN, CI_PROJECT_ID, CI_MERGE_REQUEST_IID, etc.
        - Azure Pipelines: SYSTEM_ACCESSTOKEN, Build.Repository.Name, etc.

      Notes:
        - Trend data is stored in ~/.sonarhawk/trends/
        - Run with --save-trend-data regularly (e.g., in CI/CD) to build historical data
        - At least 2 snapshots are needed for trend analysis
        - Get Slack webhook URL from: https://api.slack.com/messaging/webhooks
        - Slack notifications include trend data if available

        PR/MR Decoration Requirements:
        - GitHub: Personal Access Token with 'repo' scope (or use GITHUB_TOKEN in Actions)
        - GitLab: Personal Access Token with 'api' scope
        - Azure DevOps: Personal Access Token with 'Code (Read & Write)' scope
        - For Check Runs (GitHub): Token needs 'checks:write' permission
        - Auto-detection works in CI environments (GitHub Actions, GitLab CI, Azure Pipelines)
        - PR decoration replicates SonarQube Developer Edition's PR analysis feature ($10k+/year value)
    `
        );
    
    return program;
  } catch (error) {
    console.error('Error building command:', error);
    throw error;
  }
};

export {
  buildCommand,
  generateReport,
  generatePortfolioReport,
  SonarClient,
  SonarApiError,
  collectors, // Export collectors for testing
  validateOptions // Export validation
};