import { writeFile, readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import ejs from "ejs";
import got from "got";
import hpagent from "hpagent";
import { getProperties } from "properties-file";
import semver from "semver";
import { readFileSync, existsSync } from "node:fs";
import { getProxyForUrl } from 'proxy-from-env';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants
const PAGE_SIZE = 500;
const MAX_RESULTS = 10000;
const MAX_PAGE = MAX_RESULTS / PAGE_SIZE;

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
    // Remove trailing slash from base and leading slash from path
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const url = `${cleanBase}/${cleanPath}`;
    this.debugLog(`Joining URLs - Base: ${cleanBase}, Path: ${cleanPath}, Result: ${url}`);
    return url;
  }

  /**
   * Sets up proxy configuration if needed
   * @private
   */
  setupProxy() {
    const proxy = getProxyForUrl(this.baseUrl);
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
    try {
      const url = this._joinUrl(this.baseURL, endpoint);
      this.debugLog(`GET Request to: ${url}`);
      
      const requestOptions = {
        headers: this._getHeaders(),
        responseType: 'json',
        retry: {
          limit: 2,
          methods: ['GET']
        },
        timeout: {
          request: 30000 // 30 seconds timeout
        },
        ...options
      };

      if (this.agent) {
        requestOptions.agent = this.agent;
      }

      const response = await got.get(url, requestOptions);
      return response.body;
    } catch (error) {
      this.debugLog(`GET Request failed: ${error.message}`);
      if (error.response) {
        this.debugLog(`Status Code: ${error.response.statusCode}`);
        this.debugLog(`Response Body: ${JSON.stringify(error.response.body, null, 2)}`);
        throw new SonarApiError(`GET request failed: ${error.response.statusCode} ${error.response.statusMessage}`, error.response);
      } else {
        this.debugLog(`Network Error: ${error.code || error.message}`);
        throw new SonarApiError(`Network error: ${error.code || error.message}`, {
          statusCode: 0,
          body: { error: error.message }
        });
      }
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
        retry: {
          limit: 2,
          methods: ['POST']
        },
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
      this.debugLog(`POST Request failed: ${error.message}`);
      if (error.response) {
        this.debugLog(`Status Code: ${error.response.statusCode}`);
        this.debugLog(`Response Body: ${JSON.stringify(error.response.body, null, 2)}`);
        throw new SonarApiError(`POST request failed: ${error.response.statusCode} ${error.response.statusMessage}`, error.response);
      } else {
        this.debugLog(`Network Error: ${error.code || error.message}`);
        throw new SonarApiError(`Network error: ${error.code || error.message}`, {
          statusCode: 0,
          body: { error: error.message }
        });
      }
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
        `/api/issues/search?componentKeys=${options.sonarcomponent}&statuses=${config.issueStatuses}&resolutions=&s=STATUS&asc=no${newCodePeriodFilter}${config.issuesFilter}${withOrganization}`,
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
    key: issue.key
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
  key: hotspot.key
});

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
      qualityGateStatusPeriodDate: qualityGateStatus?.periodDate || 'N/A', // Add this line
      coverage,
      deltaAnalysis: newCodePeriod ? "Yes" : "No",
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

    // Generate reports
    await generateOutput(data, options);

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

    // Try to use provided template first, then fall back to default index.ejs
    const templateFile = options.ejsFile ? 
      (existsSync(resolve(__dirname, options.ejsFile)) ? 
        resolve(__dirname, options.ejsFile) : 
        resolve(options.ejsFile)) :
      resolve(__dirname, "index.ejs");

    console.error("using template file: %s", templateFile);

    if (!existsSync(templateFile)) {
      throw new Error(`Template file not found: ${templateFile}`);
    }

    const renderedFile = await ejs.renderFile(
      templateFile,
      { ...data, stylesheet },
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
        .addHelpText(
          "after",
          `
    Example:
    sonarflex --project=MyProject --application=MyApp --release=v1.0.0 --sonarurl=http://my.sonar.example.com --sonarcomponent=myapp:1.0.0 --in-new-code-period > /tmp/sonar-report`
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
  SonarClient,
  SonarApiError,
  collectors // Export collectors for testing
};