import { useState, useEffect, useCallback } from 'react';
import { findingsApi } from '../services/api';

export function useFindings(projectId, initialFilters = {}) {
  const [findings, setFindings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    severity: null,
    localStatus: null,
    assignedTo: null,
    search: '',
    sortBy: 'first_seen_at',
    sortOrder: 'desc',
    limit: 25,
    offset: 0,
    ...initialFilters,
  });

  const fetchFindings = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        projectId,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== null && v !== '')
        ),
      };

      const res = await findingsApi.getAll(params);
      setFindings(res.findings || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch findings:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      offset: newFilters.offset !== undefined ? newFilters.offset : 0, // Reset offset on filter change
    }));
  }, []);

  const setPage = useCallback((page) => {
    setFilters((prev) => ({
      ...prev,
      offset: page * prev.limit,
    }));
  }, []);

  const refresh = useCallback(() => {
    fetchFindings();
  }, [fetchFindings]);

  return {
    findings,
    total,
    loading,
    error,
    filters,
    updateFilters,
    setPage,
    refresh,
    currentPage: Math.floor(filters.offset / filters.limit),
    totalPages: Math.ceil(total / filters.limit),
  };
}

export function useFinding(findingId) {
  const [finding, setFinding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFinding = useCallback(async () => {
    if (!findingId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await findingsApi.getById(findingId);
      setFinding(res.finding);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch finding:', err);
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    fetchFinding();
  }, [fetchFinding]);

  const updateStatus = useCallback(async (localStatus, performedBy = 'user') => {
    try {
      const res = await findingsApi.updateStatus(findingId, localStatus, performedBy);
      setFinding((prev) => ({ ...prev, ...res.finding }));
      return res.finding;
    } catch (err) {
      console.error('Failed to update status:', err);
      throw err;
    }
  }, [findingId]);

  const updateAssignment = useCallback(async (assignedTo, performedBy = 'user') => {
    try {
      const res = await findingsApi.updateAssignment(findingId, assignedTo, performedBy);
      setFinding((prev) => ({ ...prev, ...res.finding }));
      return res.finding;
    } catch (err) {
      console.error('Failed to update assignment:', err);
      throw err;
    }
  }, [findingId]);

  const updatePriority = useCallback(async (priority, performedBy = 'user') => {
    try {
      const res = await findingsApi.updatePriority(findingId, priority, performedBy);
      setFinding((prev) => ({ ...prev, ...res.finding }));
      return res.finding;
    } catch (err) {
      console.error('Failed to update priority:', err);
      throw err;
    }
  }, [findingId]);

  const addComment = useCallback(async (author, content) => {
    try {
      const res = await findingsApi.addComment(findingId, author, content);
      setFinding((prev) => ({
        ...prev,
        comments: [...(prev.comments || []), res.comment],
      }));
      return res.comment;
    } catch (err) {
      console.error('Failed to add comment:', err);
      throw err;
    }
  }, [findingId]);

  const refresh = useCallback(() => {
    fetchFinding();
  }, [fetchFinding]);

  return {
    finding,
    loading,
    error,
    updateStatus,
    updateAssignment,
    updatePriority,
    addComment,
    refresh,
  };
}
