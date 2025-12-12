import { projects, scans, findings } from './dashboardDatabase.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// Store sync status for each project
const syncStatus = new Map();

/**
 * Sync a single project from SonarQube
 * @param {number} projectId - The project ID to sync
 * @returns {Promise<object>} Sync result with statistics
 */
export async function syncProject(projectId) {
  const startTime = Date.now();

  // Update sync status
  syncStatus.set(projectId, { status: 'running', startedAt: new Date(), progress: 0 });

  try {
    // Get project details
    const project = await projects.getById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`[Sync] Starting sync for project: ${project.name} (${project.sonar_component})`);
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 10 });

    // Change to project root and import SonarClient
    process.chdir(projectRoot);
    const { SonarClient } = await import('../../src/index.js');

    // Initialize SonarClient
    const client = new SonarClient(project.sonar_url, {
      token: project.sonar_token,
      organization: project.sonar_organization
    });

    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 20 });

    // Detect SonarQube version
    const version = await client.getVersion();
    console.log(`[Sync] SonarQube version: ${version}`);

    // Fetch rules first
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 30, step: 'Fetching rules' });
    const rules = await client.getRules();
    console.log(`[Sync] Fetched ${rules.size} rules`);

    // Fetch issues (vulnerabilities)
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 50, step: 'Fetching issues' });
    const issuesParams = {
      componentKeys: project.sonar_component,
      types: 'VULNERABILITY,BUG,CODE_SMELL',
      statuses: 'OPEN,CONFIRMED,REOPENED',
      resolved: 'false'
    };
    if (project.branch) {
      issuesParams.branch = project.branch;
    }

    const issues = await client.getIssues(issuesParams);
    console.log(`[Sync] Fetched ${issues.length} issues`);

    // Fetch hotspots
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 70, step: 'Fetching hotspots' });
    let hotspots = [];
    try {
      const hotspotsParams = {
        projectKey: project.sonar_component,
        status: 'TO_REVIEW'
      };
      if (project.branch) {
        hotspotsParams.branch = project.branch;
      }
      hotspots = await client.getHotspots(hotspotsParams);
      console.log(`[Sync] Fetched ${hotspots.length} hotspots`);
    } catch (error) {
      console.warn(`[Sync] Could not fetch hotspots: ${error.message}`);
    }

    // Fetch quality gate status
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 80, step: 'Fetching quality gate' });
    let qualityGate = null;
    try {
      qualityGate = await client.getQualityGateStatus(project.sonar_component, project.branch);
    } catch (error) {
      console.warn(`[Sync] Could not fetch quality gate status: ${error.message}`);
    }

    // Process and store findings
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 85, step: 'Storing findings' });
    const syncDate = new Date();
    let upsertedCount = 0;
    const severityCounts = {
      BLOCKER: 0,
      CRITICAL: 0,
      MAJOR: 0,
      MINOR: 0,
      INFO: 0
    };

    // Process issues
    for (const issue of issues) {
      const finding = {
        sonarKey: issue.key,
        ruleKey: issue.rule,
        ruleName: rules.get(issue.rule)?.name || issue.rule,
        severity: issue.severity,
        type: issue.type,
        status: issue.status,
        resolution: issue.resolution,
        component: extractFileName(issue.component),
        line: issue.line || issue.textRange?.startLine,
        message: issue.message,
        description: rules.get(issue.rule)?.htmlDesc,
        sonarLink: createIssueLink(project.sonar_url, issue.key, project.branch),
        effort: issue.effort,
        debt: issue.debt,
        tags: issue.tags || []
      };

      await findings.upsert(projectId, finding);
      upsertedCount++;
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    }

    // Process hotspots
    for (const hotspot of hotspots) {
      const severity = hotspot.vulnerabilityProbability || 'MEDIUM';
      const mappedSeverity = mapHotspotSeverity(severity);

      const finding = {
        sonarKey: hotspot.key,
        ruleKey: hotspot.rule?.key || hotspot.ruleKey,
        ruleName: hotspot.rule?.name || hotspot.message,
        severity: mappedSeverity,
        type: 'SECURITY_HOTSPOT',
        status: hotspot.status,
        resolution: hotspot.resolution,
        component: extractFileName(hotspot.component),
        line: hotspot.line || hotspot.textRange?.startLine,
        message: hotspot.message,
        description: hotspot.rule?.htmlDesc,
        sonarLink: createHotspotLink(project.sonar_url, hotspot.key, project.branch),
        tags: []
      };

      await findings.upsert(projectId, finding);
      upsertedCount++;
    }

    // Mark stale findings as resolved
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 90, step: 'Cleaning up stale findings' });
    const staleCount = await findings.markStaleAsResolved(projectId, syncDate);
    if (staleCount > 0) {
      console.log(`[Sync] Marked ${staleCount} stale findings as resolved`);
    }

    // Create scan record
    syncStatus.set(projectId, { ...syncStatus.get(projectId), progress: 95, step: 'Recording scan' });
    const scanData = {
      scanDate: syncDate,
      totalIssues: issues.length + hotspots.length,
      blockerCount: severityCounts.BLOCKER,
      criticalCount: severityCounts.CRITICAL,
      majorCount: severityCounts.MAJOR,
      minorCount: severityCounts.MINOR,
      infoCount: severityCounts.INFO,
      hotspotCount: hotspots.length,
      qualityGateStatus: qualityGate?.projectStatus?.status,
      coverage: null,
      rawData: {
        version,
        issueCount: issues.length,
        hotspotCount: hotspots.length,
        ruleCount: rules.size
      }
    };

    await scans.create(projectId, scanData);

    // Update project last sync time
    await projects.updateLastSync(projectId);

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      projectId,
      projectName: project.name,
      duration,
      issuesFound: issues.length,
      hotspotsFound: hotspots.length,
      findingsUpserted: upsertedCount,
      staleMarked: staleCount,
      qualityGate: qualityGate?.projectStatus?.status
    };

    syncStatus.set(projectId, { status: 'completed', completedAt: new Date(), result });
    console.log(`[Sync] Completed sync for ${project.name} in ${duration}ms`);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sync] Failed to sync project ${projectId}:`, error);

    syncStatus.set(projectId, {
      status: 'failed',
      completedAt: new Date(),
      error: error.message
    });

    return {
      success: false,
      projectId,
      duration,
      error: error.message
    };
  }
}

/**
 * Sync all enabled projects
 */
export async function syncAllProjects() {
  const enabledProjects = await projects.getEnabledForSync();
  console.log(`[Sync] Starting sync for ${enabledProjects.length} projects`);

  const results = [];
  for (const project of enabledProjects) {
    const result = await syncProject(project.id);
    results.push(result);
  }

  return results;
}

/**
 * Get sync status for a project
 */
export function getSyncStatus(projectId) {
  return syncStatus.get(projectId) || { status: 'idle' };
}

/**
 * Get all sync statuses
 */
export function getAllSyncStatuses() {
  const statuses = {};
  for (const [id, status] of syncStatus) {
    statuses[id] = status;
  }
  return statuses;
}

// Helper functions
function extractFileName(component) {
  if (!component) return 'unknown';
  const parts = component.split(':');
  return parts[parts.length - 1];
}

function createIssueLink(baseUrl, issueKey, branch) {
  let url = `${baseUrl}/project/issues?id=${encodeURIComponent(issueKey)}&open=${encodeURIComponent(issueKey)}`;
  if (branch) {
    url += `&branch=${encodeURIComponent(branch)}`;
  }
  return url;
}

function createHotspotLink(baseUrl, hotspotKey, branch) {
  let url = `${baseUrl}/security_hotspots?id=${encodeURIComponent(hotspotKey)}&hotspots=${encodeURIComponent(hotspotKey)}`;
  if (branch) {
    url += `&branch=${encodeURIComponent(branch)}`;
  }
  return url;
}

function mapHotspotSeverity(vulnerabilityProbability) {
  const mapping = {
    HIGH: 'CRITICAL',
    MEDIUM: 'MAJOR',
    LOW: 'MINOR'
  };
  return mapping[vulnerabilityProbability] || 'MAJOR';
}
