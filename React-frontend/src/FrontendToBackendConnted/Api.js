const API_URL = "http://localhost:5000/api";
const TOKEN_KEY = "todo_id_token";
const USER_KEY = "todo_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession({ idToken, user }) {
  if (idToken) localStorage.setItem(TOKEN_KEY, idToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    if (res.status === 401) clearSession();
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

export async function register(email, password) {
  const data = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession({ idToken: data.idToken, user: data.user });
  return data;
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession({ idToken: data.idToken, user: data.user });
  return data;
}

export async function getTodos() {
  const data = await request("/todos");
  return data.todos || [];
}

export async function getTodo(id) {
  const data = await request(`/todos/${id}`);
  return data.todo;
}

export async function createTodo(title) {
  const data = await request("/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return data.todo;
}

export async function updateTodo(id, update) {
  const data = await request(`/todos/${id}`, {
    method: "PUT",
    body: JSON.stringify(update),
  });
  return data.todo;
}

export async function deleteTodo(id) {
  const data = await request(`/todos/${id}`, { method: "DELETE" });
  return data.deleted;
}
