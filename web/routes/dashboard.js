import { Router } from 'express';
import {
  projects,
  scans,
  findings,
  findingComments,
  findingHistory,
  dashboardUsers
} from '../services/dashboardDatabase.js';
import { syncProject, getSyncStatus, getAllSyncStatuses } from '../services/syncService.js';

const router = Router();

// ============================================
// Projects
// ============================================

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const allProjects = await projects.getAll();
    res.json({ projects: allProjects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get a single project
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await projects.getById(parseInt(req.params.id));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create a new project
router.post('/projects', async (req, res) => {
  try {
    const {
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      syncEnabled,
      syncIntervalMinutes
    } = req.body;

    // Validate required fields
    if (!name || !sonarUrl || !sonarComponent) {
      return res.status(400).json({
        error: 'Missing required fields: name, sonarUrl, sonarComponent'
      });
    }

    const project = await projects.create({
      name,
      description,
      sonarUrl,
      sonarComponent,
      sonarToken,
      sonarOrganization,
      branch,
      syncEnabled,
      syncIntervalMinutes
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'A project with this URL, component, and branch already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
});

// Update a project
router.put('/projects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await projects.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = await projects.update(id, req.body);
    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete a project
router.delete('/projects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await projects.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await projects.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Trigger sync for a project
router.post('/projects/:id/sync', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await projects.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Start sync in background
    syncProject(id).catch(err => console.error('Background sync failed:', err));

    res.json({ message: 'Sync started', status: getSyncStatus(id) });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// Get sync status for a project
router.get('/projects/:id/sync-status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    res.json({ status: getSyncStatus(id) });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Get all sync statuses
router.get('/sync-status', async (req, res) => {
  try {
    res.json({ statuses: getAllSyncStatuses() });
  } catch (error) {
    console.error('Get all sync statuses error:', error);
    res.status(500).json({ error: 'Failed to get sync statuses' });
  }
});

// ============================================
// Dashboard Analytics
// ============================================

// Get summary stats for a project
router.get('/projects/:id/summary', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await projects.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stats = await findings.getStatistics(id);
    const latestScan = await scans.getLatest(id);

    res.json({
      summary: {
        ...stats,
        lastSyncAt: existing.last_sync_at,
        qualityGateStatus: latestScan?.quality_gate_status
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get trend data for charts
router.get('/projects/:id/trends', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { startDate, endDate, limit } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const trends = await scans.getTrends(id, start, end, parseInt(limit) || 30);
    res.json({ trends });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Get top violated rules
router.get('/projects/:id/top-rules', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 10;

    const topRules = await findings.getTopRules(id, limit);
    res.json({ topRules });
  } catch (error) {
    console.error('Get top rules error:', error);
    res.status(500).json({ error: 'Failed to fetch top rules' });
  }
});

// Get severity breakdown
router.get('/projects/:id/severity-breakdown', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const breakdown = await findings.getSeverityBreakdown(id);
    res.json({ breakdown });
  } catch (error) {
    console.error('Get severity breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch severity breakdown' });
  }
});

// Get scan history
router.get('/projects/:id/scans', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;

    const scanList = await scans.getByProject(id, limit);
    res.json({ scans: scanList });
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// ============================================
// Findings
// ============================================

// Get findings with filters
router.get('/findings', async (req, res) => {
  try {
    const {
      projectId,
      severity,
      severities,
      type,
      status,
      localStatus,
      assignedTo,
      ruleKey,
      search,
      sortBy,
      sortOrder,
      limit,
      offset
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const filters = {
      severity,
      severities: severities ? severities.split(',') : undefined,
      type,
      status,
      localStatus,
      assignedTo,
      ruleKey,
      search,
      sortBy,
      sortOrder,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    };

    const findingsList = await findings.getByProject(parseInt(projectId), filters);
    const totalCount = await findings.countByProject(parseInt(projectId), filters);

    res.json({
      findings: findingsList,
      total: totalCount,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error) {
    console.error('Get findings error:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

// Get a single finding
router.get('/findings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const finding = await findings.getById(id);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    // Include comments and history
    const comments = await findingComments.getByFinding(id);
    const history = await findingHistory.getByFinding(id);

    res.json({
      finding: {
        ...finding,
        comments,
        history
      }
    });
  } catch (error) {
    console.error('Get finding error:', error);
    res.status(500).json({ error: 'Failed to fetch finding' });
  }
});

// Update finding local status
router.patch('/findings/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { localStatus, performedBy } = req.body;

    if (!localStatus) {
      return res.status(400).json({ error: 'localStatus is required' });
    }

    const validStatuses = ['new', 'acknowledged', 'in_progress', 'resolved', 'false_positive', 'wontfix'];
    if (!validStatuses.includes(localStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const finding = await findings.updateLocalStatus(id, localStatus, performedBy || 'system');
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    res.json({ finding });
  } catch (error) {
    console.error('Update finding status error:', error);
    res.status(500).json({ error: 'Failed to update finding status' });
  }
});

// Assign finding to user
router.patch('/findings/:id/assign', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { assignedTo, performedBy } = req.body;

    const finding = await findings.updateAssignment(id, assignedTo, performedBy || 'system');
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    res.json({ finding });
  } catch (error) {
    console.error('Update finding assignment error:', error);
    res.status(500).json({ error: 'Failed to update finding assignment' });
  }
});

// Update finding priority
router.patch('/findings/:id/priority', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { priority, performedBy } = req.body;

    if (priority === undefined || priority < 0 || priority > 4) {
      return res.status(400).json({ error: 'Priority must be between 0 and 4' });
    }

    const finding = await findings.updatePriority(id, priority, performedBy || 'system');
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    res.json({ finding });
  } catch (error) {
    console.error('Update finding priority error:', error);
    res.status(500).json({ error: 'Failed to update finding priority' });
  }
});

// Update finding due date
router.patch('/findings/:id/due-date', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { dueDate, performedBy } = req.body;

    const finding = await findings.updateDueDate(id, dueDate, performedBy || 'system');
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    res.json({ finding });
  } catch (error) {
    console.error('Update finding due date error:', error);
    res.status(500).json({ error: 'Failed to update finding due date' });
  }
});

// ============================================
// Finding Comments
// ============================================

// Get comments for a finding
router.get('/findings/:id/comments', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const comments = await findingComments.getByFinding(id);
    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add a comment to a finding
router.post('/findings/:id/comments', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { author, content } = req.body;

    if (!author || !content) {
      return res.status(400).json({ error: 'author and content are required' });
    }

    const comment = await findingComments.add(id, author, content);
    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete a comment
router.delete('/comments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await findingComments.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================
// Finding History
// ============================================

// Get history for a finding
router.get('/findings/:id/history', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const history = await findingHistory.getByFinding(id, limit);
    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ============================================
// Dashboard Users
// ============================================

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await dashboardUsers.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create or update a user
router.post('/users', async (req, res) => {
  try {
    const { email, name, role, avatarUrl } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'email and name are required' });
    }

    const user = await dashboardUsers.upsert({ email, name, role, avatarUrl });
    res.status(201).json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get a single user
router.get('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await dashboardUsers.getById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await dashboardUsers.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
