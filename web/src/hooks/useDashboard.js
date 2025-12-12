import { useState, useEffect, useCallback } from 'react';
import { projectsApi } from '../services/api';

export function useDashboard(projectId) {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [topRules, setTopRules] = useState([]);
  const [severityBreakdown, setSeverityBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [summaryRes, trendsRes, rulesRes, severityRes] = await Promise.all([
        projectsApi.getSummary(projectId),
        projectsApi.getTrends(projectId),
        projectsApi.getTopRules(projectId),
        projectsApi.getSeverityBreakdown(projectId),
      ]);

      setSummary(summaryRes.summary);
      setTrends(trendsRes.trends || []);
      setTopRules(rulesRes.topRules || []);
      setSeverityBreakdown(severityRes.breakdown || []);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refresh = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    summary,
    trends,
    topRules,
    severityBreakdown,
    loading,
    error,
    refresh,
  };
}

export function useSyncStatus(projectId) {
  const [syncStatus, setSyncStatus] = useState({ status: 'idle' });
  const [syncing, setSyncing] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await projectsApi.getSyncStatus(projectId);
      setSyncStatus(res.status);
      setSyncing(res.status.status === 'running');
    } catch (err) {
      console.error('Failed to check sync status:', err);
    }
  }, [projectId]);

  const triggerSync = useCallback(async () => {
    if (!projectId) return;

    setSyncing(true);
    try {
      await projectsApi.sync(projectId);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const res = await projectsApi.getSyncStatus(projectId);
        setSyncStatus(res.status);
        if (res.status.status !== 'running') {
          setSyncing(false);
          clearInterval(pollInterval);
        }
      }, 2000);
    } catch (err) {
      setSyncing(false);
      console.error('Failed to trigger sync:', err);
      throw err;
    }
  }, [projectId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    syncStatus,
    syncing,
    triggerSync,
    checkStatus,
  };
}
