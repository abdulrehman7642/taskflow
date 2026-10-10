const $ = (id) => document.getElementById(id);

let token = localStorage.getItem("taskflow_token");
let registerMode = false;
let filter = "all";
let tasks = [];

// ---------- API helper: adds the auth header and handles errors in one place ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401 && token) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---------- View switching ----------
function showApp() {
  $("auth-view").hidden = true;
  $("app-view").hidden = false;
  loadTasks();
}
function showAuth() {
  $("auth-view").hidden = false;
  $("app-view").hidden = true;
}
function logout() {
  token = null;
  localStorage.removeItem("taskflow_token");
  showAuth();
}

// ---------- Auth ----------
$("toggle-mode").addEventListener("click", () => {
  registerMode = !registerMode;
  $("auth-submit").textContent = registerMode ? "Register" : "Log in";
  $("toggle-mode").textContent = registerMode ? "Have an account? Log in" : "No account? Register";
  $("auth-mode-text").textContent = registerMode ? "Create your account" : "Log in to see your tasks";
  $("auth-error").textContent = "";
});

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("auth-error").textContent = "";
  try {
    const data = await api(registerMode ? "/api/register" : "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: $("email").value, password: $("password").value }),
    });
    token = data.token;
    localStorage.setItem("taskflow_token", token);
    $("auth-form").reset();
    showApp();
  } catch (err) {
    $("auth-error").textContent = err.message;
  }
});
$("logout").addEventListener("click", logout);

// ---------- Tasks ----------
async function loadTasks() {
  try {
    tasks = await api("/api/tasks");
    render();
  } catch (err) {
    console.error(err);
  }
}

function render() {
  const visible = tasks.filter((t) => filter === "all" || (filter === "done" ? t.done : !t.done));
  const list = $("task-list");
  list.innerHTML = "";

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing here yet.";
    list.appendChild(li);
  }

  visible.forEach((t) => {
    const li = document.createElement("li");
    if (t.done) li.className = "done";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.addEventListener("change", async () => {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: cb.checked }) });
      loadTasks();
    });

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = t.title; // textContent (not innerHTML) prevents XSS

    const badge = document.createElement("span");
    badge.className = `badge ${t.priority}`;
    badge.textContent = t.priority;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await api(`/api/tasks/${t.id}`, { method: "DELETE" });
      loadTasks();
    });

    li.append(cb, title, badge, del);
    list.appendChild(li);
  });

  const remaining = tasks.filter((t) => !t.done).length;
  $("count").textContent = `${remaining} task${remaining === 1 ? "" : "s"} remaining`;
}

$("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title: $("title").value, priority: $("priority").value }),
  });
  $("title").value = "";
  loadTasks();
});

document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filters button").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });
});

// ---------- Boot ----------
token ? showApp() : showAuth();
