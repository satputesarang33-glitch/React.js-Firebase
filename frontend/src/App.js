import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import {
  login,
  register,
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  getStoredUser,
  clearSession,
  getToken,
} from "./FrontendToBackendConnted/Api";

function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getTodos();
      setTodos(data);
    } catch (err) {
      setError(err.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken() && user) {
      fetchTodos();
    }
  }, [user, fetchTodos]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = isLogin
        ? await login(email, password)
        : await register(email, password);
      setUser(res.user);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setTodos([]);
    setError("");
    setEditingId(null);
  };

  const handleCreateTodo = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setError("");
    setLoading(true);
    try {
      const created = await createTodo(newTitle.trim());
      setTodos((prev) => [created, ...prev]);
      setNewTitle("");
    } catch (err) {
      setError(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTodo = async (todo) => {
    setError("");
    try {
      const updated = await updateTodo(todo.id, {
        completed: !todo.completed,
      });
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, ...updated } : t))
      );
    } catch (err) {
      setError(err.message || "Failed to update task status");
    }
  };

  const handleStartEdit = (todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setError("");
    try {
      const updated = await updateTodo(editingId, {
        title: editTitle.trim(),
      });
      setTodos((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...updated } : t))
      );
      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      setError(err.message || "Failed to update task title");
    }
  };

  const handleDeleteTodo = async (id) => {
    setError("");
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete task");
    }
  };

  return (
    <div className="app">
      <div className="shell">
        <header className="header">
          {user ? (
            <div className="header-row">
              <div>
                <p className="eyebrow">Logged in as</p>
                <h1>{user.email}</h1>
                <p className="subtitle">Manage your everyday tasks</p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p className="eyebrow">Firebase Todo App</p>
              <h1>{isLogin ? "Welcome back" : "Create Account"}</h1>
              <p className="subtitle">
                {isLogin
                  ? "Sign in to access and sync your tasks"
                  : "Sign up to start organizing your tasks"}
              </p>
            </div>
          )}
        </header>

        {error && <div className="error">{error}</div>}

        {!user ? (
          <form className="auth-form" onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading
                ? "Processing..."
                : isLogin
                ? "Sign In"
                : "Create Account"}
            </button>

            <p className="auth-switch">
              {isLogin ? "Need an account? " : "Already have an account? "}
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
              >
                {isLogin ? "Register now" : "Sign in here"}
              </button>
            </p>
          </form>
        ) : (
          <main>
            <form className="composer" onSubmit={handleCreateTodo}>
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={100}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !newTitle.trim()}
              >
                Add Task
              </button>
            </form>

            <section className="list">
              {todos.length === 0 ? (
                <p className="empty">No tasks found. Add a task above to get started!</p>
              ) : (
                <ul>
                  {todos.map((todo) => (
                    <li
                      key={todo.id}
                      className={todo.completed ? "done" : ""}
                    >
                      {editingId === todo.id ? (
                        <form
                          className="edit-form"
                          onSubmit={handleSaveEdit}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={100}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!editTitle.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(todo.completed)}
                              onChange={() => handleToggleTodo(todo)}
                            />
                            <span>{todo.title}</span>
                          </label>
                          <div className="actions">
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => handleStartEdit(todo)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDeleteTodo(todo.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;