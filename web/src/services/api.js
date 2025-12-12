// API base URL - use relative URLs in production, localhost in development
const getApiUrl = (path) => {
  const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';
  return `${baseUrl}${path}`;
};

// Generic fetch wrapper with error handling
async function fetchApi(path, options = {}) {
  const url = getApiUrl(path);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// Projects API
// ============================================
export const projectsApi = {
  getAll: () => fetchApi('/api/dashboard/projects'),

  getById: (id) => fetchApi(`/api/dashboard/projects/${id}`),

  create: (data) => fetchApi('/api/dashboard/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => fetchApi(`/api/dashboard/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => fetchApi(`/api/dashboard/projects/${id}`, {
    method: 'DELETE',
  }),

  sync: (id) => fetchApi(`/api/dashboard/projects/${id}/sync`, {
    method: 'POST',
  }),

  getSyncStatus: (id) => fetchApi(`/api/dashboard/projects/${id}/sync-status`),

  getSummary: (id) => fetchApi(`/api/dashboard/projects/${id}/summary`),

  getTrends: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/dashboard/projects/${id}/trends${query ? `?${query}` : ''}`);
  },

  getTopRules: (id, limit = 10) => fetchApi(`/api/dashboard/projects/${id}/top-rules?limit=${limit}`),

  getSeverityBreakdown: (id) => fetchApi(`/api/dashboard/projects/${id}/severity-breakdown`),

  getScans: (id, limit = 50) => fetchApi(`/api/dashboard/projects/${id}/scans?limit=${limit}`),
};

// ============================================
// Findings API
// ============================================
export const findingsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/dashboard/findings?${query}`);
  },

  getById: (id) => fetchApi(`/api/dashboard/findings/${id}`),

  updateStatus: (id, localStatus, performedBy) => fetchApi(`/api/dashboard/findings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ localStatus, performedBy }),
  }),

  updateAssignment: (id, assignedTo, performedBy) => fetchApi(`/api/dashboard/findings/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo, performedBy }),
  }),

  updatePriority: (id, priority, performedBy) => fetchApi(`/api/dashboard/findings/${id}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority, performedBy }),
  }),

  updateDueDate: (id, dueDate, performedBy) => fetchApi(`/api/dashboard/findings/${id}/due-date`, {
    method: 'PATCH',
    body: JSON.stringify({ dueDate, performedBy }),
  }),

  getComments: (id) => fetchApi(`/api/dashboard/findings/${id}/comments`),

  addComment: (id, author, content) => fetchApi(`/api/dashboard/findings/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author, content }),
  }),

  deleteComment: (commentId) => fetchApi(`/api/dashboard/comments/${commentId}`, {
    method: 'DELETE',
  }),

  getHistory: (id, limit = 50) => fetchApi(`/api/dashboard/findings/${id}/history?limit=${limit}`),
};

// ============================================
// Users API
// ============================================
export const usersApi = {
  getAll: () => fetchApi('/api/dashboard/users'),

  getById: (id) => fetchApi(`/api/dashboard/users/${id}`),

  create: (data) => fetchApi('/api/dashboard/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  delete: (id) => fetchApi(`/api/dashboard/users/${id}`, {
    method: 'DELETE',
  }),
};

// ============================================
// Sync Status API
// ============================================
export const syncApi = {
  getAllStatuses: () => fetchApi('/api/dashboard/sync-status'),
};
