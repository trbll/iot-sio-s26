const socket = io();
const $ = (id) => document.getElementById(id);

let me = null;
let typingTimeout = null;
const typingUsers = new Map();
const remoteCursors = {};

let canvas, ctx;
let drawing = false;
let lastX = 0, lastY = 0;
let lastCursorEmit = 0;

// ── JOIN ─────────────────────────────────────────────────────
$("joinBtn").addEventListener("click", joinSession);
$("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinSession();
});
$("nameInput").focus();

function joinSession() {
  const name = $("nameInput").value.trim();
  if (!name) { $("nameInput").focus(); return; }
  $("joinBtn").disabled = true;
  $("joinBtn").textContent = "CONNECTING…";
  socket.emit("user:join", name);
}

// ── INIT (server sends full state after join) ────────────────
socket.on("init", (data) => {
  me = data.user;

  $("joinModal").classList.add("hidden");
  $("dashboard").classList.remove("hidden");

  setAccent(data.accentColor);
  $("accentColor").value = data.accentColor;

  data.users.forEach(addUser);
  $("userCount").textContent = `${data.users.length} ONLINE`;

  data.chatHistory.forEach(addChatMessage);

  updateSensors(data.sensors);

  initCanvas();

  measurePing();
  setInterval(measurePing, 5000);

  addLog(`Connected as ${me.name}`);
});

// ── CONNECTION STATUS ────────────────────────────────────────
socket.on("connect", () => {
  $("connStatus").className = "conn-status online";
  $("connStatus").querySelector(".status-text").textContent = "CONNECTED";
});
socket.on("disconnect", () => {
  $("connStatus").className = "conn-status offline";
  $("connStatus").querySelector(".status-text").textContent = "DISCONNECTED";
});

// ── USERS ────────────────────────────────────────────────────
socket.on("user:joined", (user) => {
  addUser(user);
  addLog(`${user.name} connected`);
});

socket.on("user:left", ({ id, name }) => {
  const li = document.querySelector(`[data-uid="${id}"]`);
  if (li) li.remove();

  if (remoteCursors[id]) {
    remoteCursors[id].remove();
    delete remoteCursors[id];
  }

  typingUsers.delete(id);
  renderTyping();
  addLog(`${name} disconnected`);
});

socket.on("users:count", (n) => {
  $("userCount").textContent = `${n} ONLINE`;
});

function addUser(user) {
  if (document.querySelector(`[data-uid="${user.id}"]`)) return;
  const li = document.createElement("li");
  li.dataset.uid = user.id;

  const dot = document.createElement("span");
  dot.className = "user-dot";
  dot.style.background = user.color;
  dot.style.color = user.color;

  const name = document.createElement("span");
  name.className = "user-name";
  name.textContent = user.name + (user.id === me?.id ? " (you)" : "");
  name.style.color = user.color;

  li.append(dot, name);
  $("userList").appendChild(li);
}

// ── CHAT ─────────────────────────────────────────────────────
$("sendBtn").addEventListener("click", sendMessage);
$("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
$("chatInput").addEventListener("input", () => {
  socket.emit("chat:typing", true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("chat:typing", false), 2000);
});

function sendMessage() {
  const text = $("chatInput").value.trim();
  if (!text) return;
  socket.emit("chat:message", text);
  $("chatInput").value = "";
  socket.emit("chat:typing", false);
}

socket.on("chat:message", addChatMessage);

socket.on("chat:typing", ({ userId, userName, isTyping }) => {
  if (isTyping) typingUsers.set(userId, userName);
  else typingUsers.delete(userId);
  renderTyping();
});

function addChatMessage(msg) {
  const div = document.createElement("div");
  div.className = "chat-msg";

  const hdr = document.createElement("div");
  hdr.className = "chat-msg-header";

  const nameEl = document.createElement("span");
  nameEl.className = "chat-msg-name";
  nameEl.style.color = msg.userColor;
  nameEl.textContent = msg.userName;

  const timeEl = document.createElement("span");
  timeEl.className = "chat-msg-time";
  timeEl.textContent = new Date(msg.timestamp)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const textEl = document.createElement("p");
  textEl.className = "chat-msg-text";
  textEl.textContent = msg.text;

  hdr.append(nameEl, timeEl);
  div.append(hdr, textEl);

  const box = $("chatMessages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function renderTyping() {
  const names = [...typingUsers.values()];
  $("typingIndicator").textContent =
    names.length === 0 ? "" :
    names.length === 1 ? `${names[0]} is typing…` :
    `${names.join(", ")} are typing…`;
}

// ── CANVAS ───────────────────────────────────────────────────
function initCanvas() {
  canvas = $("drawCanvas");
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", onDrawMove);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); startDraw(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); onDrawMove(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener("touchend", stopDraw);

  $("brushSize").addEventListener("input", () => {
    $("brushSizeLabel").textContent = $("brushSize").value + "px";
  });
  $("clearBtn").addEventListener("click", clearCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const r = canvas.parentElement.getBoundingClientRect();
  canvas.width = r.width;
  canvas.height = r.height;
}

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function startDraw(e) {
  drawing = true;
  const p = canvasPos(e);
  lastX = p.x;
  lastY = p.y;
}

function onDrawMove(e) {
  const p = canvasPos(e);
  emitCursor(p.x, p.y);
  if (!drawing) return;

  const color = $("brushColor").value;
  const size = +$("brushSize").value;

  drawLine(lastX, lastY, p.x, p.y, color, size);

  socket.emit("canvas:draw", {
    fx: lastX / canvas.width,
    fy: lastY / canvas.height,
    tx: p.x / canvas.width,
    ty: p.y / canvas.height,
    c: color,
    s: size,
  });
  lastX = p.x;
  lastY = p.y;
}

function stopDraw() { drawing = false; }

function drawLine(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("canvas:clear");
}

socket.on("canvas:draw", (d) => {
  drawLine(
    d.fx * canvas.width,  d.fy * canvas.height,
    d.tx * canvas.width,  d.ty * canvas.height,
    d.c, d.s
  );
});

socket.on("canvas:clear", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Cursor tracking — throttled to ~20 Hz
function emitCursor(x, y) {
  const now = Date.now();
  if (now - lastCursorEmit < 50) return;
  lastCursorEmit = now;
  socket.emit("canvas:cursor", {
    x: x / canvas.width,
    y: y / canvas.height,
  });
}

socket.on("canvas:cursor", ({ userId, userName, userColor, x, y }) => {
  let cur = remoteCursors[userId];
  if (!cur) {
    cur = document.createElement("div");
    cur.className = "remote-cursor";

    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    dot.style.background = userColor;

    const lbl = document.createElement("span");
    lbl.className = "cursor-label";
    lbl.style.color = userColor;
    lbl.textContent = userName;

    cur.append(dot, lbl);
    $("canvasWrapper").appendChild(cur);
    remoteCursors[userId] = cur;
  }
  cur.style.left = (x * 100) + "%";
  cur.style.top = (y * 100) + "%";
  cur.style.opacity = "1";
  clearTimeout(cur._fade);
  cur._fade = setTimeout(() => { cur.style.opacity = "0"; }, 3000);
});

// ── SENSORS ──────────────────────────────────────────────────
socket.on("sensors:update", updateSensors);

function updateSensors(d) {
  $("sTemp").textContent  = d.temperature + "°C";
  $("sHumid").textContent = d.humidity + "%";
  $("sPress").textContent = d.pressure + " hPa";
  $("sLight").textContent = d.light + " lux";

  $("sTempBar").style.width  = Math.min(100, (d.temperature / 50) * 100) + "%";
  $("sHumidBar").style.width = Math.min(100, d.humidity) + "%";
  $("sPressBar").style.width = Math.min(100, ((d.pressure - 990) / 50) * 100) + "%";
  $("sLightBar").style.width = Math.min(100, (d.light / 1000) * 100) + "%";
}

// ── REACTIONS ────────────────────────────────────────────────
document.querySelectorAll(".rbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    socket.emit("reaction:send", btn.dataset.emoji);
  });
});

socket.on("reaction:receive", ({ emoji }) => {
  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.textContent = emoji;
  el.style.left = (10 + Math.random() * 80) + "vw";
  el.style.bottom = "60px";
  $("reactionLayer").appendChild(el);
  setTimeout(() => el.remove(), 2700);
});

// ── THEME ────────────────────────────────────────────────────
$("accentColor").addEventListener("input", () => {
  const c = $("accentColor").value;
  setAccent(c);
  socket.emit("theme:change", c);
});

socket.on("theme:change", (c) => {
  setAccent(c);
  $("accentColor").value = c;
});

function setAccent(c) {
  document.documentElement.style.setProperty("--accent", c);
  document.documentElement.style.setProperty("--accent-glow", c + "40");
}

// ── PING ─────────────────────────────────────────────────────
function measurePing() {
  socket.emit("ping:check", Date.now());
}

socket.on("ping:response", (t) => {
  $("pingDisplay").textContent = `PING ${Date.now() - t}ms`;
});

// ── SYSTEM LOG ───────────────────────────────────────────────
function addLog(text) {
  const span = document.createElement("span");
  span.className = "log-entry";
  span.innerHTML = `<span class="hl">◆</span> ${escHtml(text)}`;
  $("systemLog").appendChild(span);
  $("systemLog").scrollLeft = $("systemLog").scrollWidth;
}

function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
