/** API client for the Agentic Demo Brain backend. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// Workspaces
export const api = {
  // Workspaces
  listWorkspaces: () => request<any[]>("/workspaces"),
  getWorkspace: (id: string) => request<any>(`/workspaces/${id}`),
  createWorkspace: (data: any) =>
    request<any>("/workspaces", { method: "POST", body: JSON.stringify(data) }),
  updateWorkspace: (id: string, data: any) =>
    request<any>(`/workspaces/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Documents
  listDocuments: (wsId: string) => request<any[]>(`/workspaces/${wsId}/documents`),
  uploadDocument: async (wsId: string, formData: FormData) => {
    return uploadRequest<any>(`/workspaces/${wsId}/documents`, formData);
  },
  deleteDocument: (wsId: string, docId: string) =>
    request<any>(`/workspaces/${wsId}/documents/${docId}`, { method: "DELETE" }),

  // Credentials
  listCredentials: (wsId: string) => request<any[]>(`/workspaces/${wsId}/credentials`),
  addCredential: (wsId: string, data: any) =>
    request<any>(`/workspaces/${wsId}/credentials`, { method: "POST", body: JSON.stringify(data) }),
  deleteCredential: (wsId: string, credId: string) =>
    request<any>(`/workspaces/${wsId}/credentials/${credId}`, { method: "DELETE" }),

  // Recipes
  listRecipes: (wsId: string) => request<any[]>(`/workspaces/${wsId}/recipes`),
  createRecipe: (wsId: string, data: any) =>
    request<any>(`/workspaces/${wsId}/recipes`, { method: "POST", body: JSON.stringify(data) }),
  updateRecipe: (wsId: string, recipeId: string, data: any) =>
    request<any>(`/workspaces/${wsId}/recipes/${recipeId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRecipe: (wsId: string, recipeId: string) =>
    request<any>(`/workspaces/${wsId}/recipes/${recipeId}`, { method: "DELETE" }),

  // Policies
  listPolicies: (wsId: string) => request<any[]>(`/workspaces/${wsId}/policies`),
  createPolicy: (wsId: string, data: any) =>
    request<any>(`/workspaces/${wsId}/policies`, { method: "POST", body: JSON.stringify(data) }),
  deletePolicy: (wsId: string, policyId: string) =>
    request<any>(`/workspaces/${wsId}/policies/${policyId}`, { method: "DELETE" }),

  // Sessions
  createSession: (data: any) =>
    request<any>("/sessions", { method: "POST", body: JSON.stringify(data) }),
  getSession: (sessionId: string) => request<any>(`/sessions/${sessionId}`),
  getMessages: (sessionId: string) => request<any[]>(`/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, content: string) =>
    request<any>(`/sessions/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ content, message_type: "text" }),
    }),
  startBrowser: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/start-browser`, { method: "POST" }),
  startLive: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/live/start`, { method: "POST" }),
  pauseLive: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/controls/pause`, { method: "POST" }),
  resumeLive: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/controls/resume`, { method: "POST" }),
  nextLiveStep: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/controls/next-step`, { method: "POST" }),
  restartLive: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/controls/restart`, { method: "POST" }),
  executeRecipe: (sessionId: string, recipeId: string) =>
    request<any>(`/sessions/${sessionId}/execute-recipe?recipe_id=${recipeId}`, { method: "POST" }),
  getScreenshot: (sessionId: string) => request<any>(`/sessions/${sessionId}/screenshot`),
  getBrowserState: (sessionId: string) => request<any>(`/sessions/${sessionId}/browser-state`),
  endSession: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/end`, { method: "POST" }),
  getSessionSummary: (sessionId: string) => request<any>(`/sessions/${sessionId}/summary`),
  getSessionActions: (sessionId: string) => request<any[]>(`/sessions/${sessionId}/actions`),

  // Analytics
  getWorkspaceAnalytics: (wsId: string) => request<any>(`/workspaces/${wsId}/analytics`),
  getWorkspaceSessions: (wsId: string) => request<any[]>(`/workspaces/${wsId}/sessions`),

  // Voice
  startVoice: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/voice/start`, { method: "POST" }),
};

export const adminApi = {
  login: (email: string, password: string) =>
    request<any>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<any>("/admin/auth/logout", { method: "POST" }),
  me: () => request<any>("/admin/auth/me"),

  getDashboard: () => request<any>("/admin/dashboard"),
  listProducts: () => request<any[]>("/admin/products"),
  createProduct: (data: any) =>
    request<any>("/admin/products", { method: "POST", body: JSON.stringify(data) }),
  getProduct: (id: string) => request<any>(`/admin/products/${id}`),
  updateProduct: (id: string, data: any) =>
    request<any>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listKnowledgeSources: (id: string, sourceType?: string) =>
    request<any[]>(`/admin/products/${id}/knowledge${sourceType ? `?source_type=${encodeURIComponent(sourceType)}` : ""}`),
  addHelpDoc: (id: string, data: any) =>
    request<any>(`/admin/products/${id}/knowledge/help-docs`, { method: "POST", body: JSON.stringify(data) }),
  addCustomEntry: (id: string, data: any) =>
    request<any>(`/admin/products/${id}/knowledge/custom-entries`, { method: "POST", body: JSON.stringify(data) }),
  addFileSource: (id: string, formData: FormData) =>
    uploadRequest<any>(`/admin/products/${id}/knowledge/files`, formData),
  addVideoSource: (id: string, formData: FormData) =>
    uploadRequest<any>(`/admin/products/${id}/knowledge/videos`, formData),

  getProductConfig: (id: string) => request<any>(`/admin/products/${id}/config`),
  updateProductConfig: (id: string, data: any) =>
    request<any>(`/admin/products/${id}/config`, { method: "PUT", body: JSON.stringify(data) }),
  getProductSessionSettings: (id: string) => request<any>(`/admin/products/${id}/session-settings`),
  updateProductSessionSettings: (id: string, data: any) =>
    request<any>(`/admin/products/${id}/session-settings`, { method: "PUT", body: JSON.stringify(data) }),
  getProductShare: (id: string) => request<any>(`/admin/products/${id}/share`),
  updateProductShare: (id: string, data: any) =>
    request<any>(`/admin/products/${id}/share`, { method: "PUT", body: JSON.stringify(data) }),
  testAgent: (id: string, message: string) =>
    request<any>(`/admin/products/${id}/test-agent`, { method: "POST", body: JSON.stringify({ message }) }),

  listSessions: (workspaceId?: string) =>
    request<any[]>(`/admin/sessions${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}`),
  getSessionDetail: (sessionId: string) => request<any>(`/admin/sessions/${sessionId}`),

  listEmbedShare: () => request<any[]>("/admin/embed-share"),
  getBranding: () => request<any>("/admin/branding"),
  updateBranding: (data: any) =>
    request<any>("/admin/branding", { method: "PUT", body: JSON.stringify(data) }),
  getAccountSettings: () => request<any>("/admin/settings/account"),
  getMembers: () => request<any>("/admin/settings/members"),
  createInvite: (data: any) =>
    request<any>("/admin/settings/invites", { method: "POST", body: JSON.stringify(data) }),
  getBilling: () => request<any>("/admin/settings/billing"),
  updateBilling: (data: any) =>
    request<any>("/admin/settings/billing", { method: "PUT", body: JSON.stringify(data) }),
  getApiKeys: (workspaceId?: string) =>
    request<any>(`/admin/settings/api-keys${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}`),
  saveApiKey: (data: any) =>
    request<any>("/admin/settings/api-keys", { method: "PUT", body: JSON.stringify(data) }),
};
