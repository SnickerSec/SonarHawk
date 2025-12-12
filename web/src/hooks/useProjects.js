import { useState, useEffect, useCallback } from 'react';
import { projectsApi } from '../services/api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await projectsApi.getAll();
      setProjects(res.projects || []);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (data) => {
    try {
      const res = await projectsApi.create(data);
      setProjects((prev) => [res.project, ...prev]);
      return res.project;
    } catch (err) {
      console.error('Failed to create project:', err);
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (id, data) => {
    try {
      const res = await projectsApi.update(id, data);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? res.project : p))
      );
      return res.project;
    } catch (err) {
      console.error('Failed to update project:', err);
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (id) => {
    try {
      await projectsApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
      throw err;
    }
  }, []);

  const refresh = useCallback(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh,
  };
}

export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await projectsApi.getById(projectId);
      setProject(res.project);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const refresh = useCallback(() => {
    fetchProject();
  }, [fetchProject]);

  return {
    project,
    loading,
    error,
    refresh,
  };
}
