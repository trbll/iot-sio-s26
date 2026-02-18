const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log(`NEXUS server online — port ${PORT}`);
});

const io = new Server(server);

// ── State ────────────────────────────────────────────────────
const users = new Map();
const chatHistory = [];
const MAX_HISTORY = 50;
let accentColor = "#00f0ff";

const COLORS = [
  "#00f0ff", "#ff006e", "#00ff88", "#ffbe0b",
  "#fb5607", "#8338ec", "#3a86ff", "#06d6a0",
  "#118ab2", "#ff7744", "#44ffcc", "#aa77ff",
];
let colorIdx = 0;

function nextColor() {
  const c = COLORS[colorIdx % COLORS.length];
  colorIdx++;
  return c;
}

function userList() {
  return [...users.values()].map(({ id, name, color }) => ({ id, name, color }));
}

// ── Simulated IoT sensors ────────────────────────────────────
let sensors = { temperature: 23, humidity: 55, pressure: 1013, light: 600 };

function tickSensors() {
  const t = Date.now() / 1000;
  sensors = {
    temperature: +(22 + Math.sin(t / 10) * 2 + Math.random() * 0.5).toFixed(1),
    humidity:    +(50 + Math.cos(t / 8) * 10 + Math.random() * 2).toFixed(1),
    pressure:    +(1013 + Math.sin(t / 15) * 4 + Math.random()).toFixed(1),
    light:       Math.round(500 + Math.sin(t / 5) * 250 + Math.random() * 50),
  };
  return sensors;
}

setInterval(() => io.emit("sensors:update", tickSensors()), 2000);

// ── Socket.IO ────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`+ socket ${socket.id}`);

  // Join with display name
  socket.on("user:join", (name) => {
    const user = {
      id: socket.id,
      name: (name || "Anon").slice(0, 20),
      color: nextColor(),
    };
    users.set(socket.id, user);

    socket.emit("init", {
      user,
      users: userList(),
      chatHistory,
      accentColor,
      sensors,
    });

    socket.broadcast.emit("user:joined", user);
    io.emit("users:count", users.size);
    console.log(`  ${user.name} joined (${users.size} online)`);
  });

  // Chat
  socket.on("chat:message", (text) => {
    const u = users.get(socket.id);
    if (!u || typeof text !== "string" || !text.trim()) return;

    const msg = {
      id: `${Date.now()}-${socket.id}`,
      userId: socket.id,
      userName: u.name,
      userColor: u.color,
      text: text.trim().slice(0, 500),
      timestamp: Date.now(),
    };
    chatHistory.push(msg);
    if (chatHistory.length > MAX_HISTORY) chatHistory.shift();
    io.emit("chat:message", msg);
  });

  socket.on("chat:typing", (isTyping) => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.broadcast.emit("chat:typing", {
      userId: socket.id,
      userName: u.name,
      isTyping,
    });
  });

  // Canvas
  socket.on("canvas:draw", (d) => socket.broadcast.emit("canvas:draw", d));
  socket.on("canvas:clear", () => socket.broadcast.emit("canvas:clear"));

  socket.on("canvas:cursor", (pos) => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.broadcast.emit("canvas:cursor", {
      userId: socket.id,
      userName: u.name,
      userColor: u.color,
      ...pos,
    });
  });

  // Reactions
  socket.on("reaction:send", (emoji) => {
    const u = users.get(socket.id);
    if (!u) return;
    io.emit("reaction:receive", {
      emoji,
      userName: u.name,
      userColor: u.color,
    });
  });

  // Theme accent color (shared across all clients)
  socket.on("theme:change", (color) => {
    if (typeof color !== "string") return;
    accentColor = color;
    socket.broadcast.emit("theme:change", color);
  });

  // Latency measurement
  socket.on("ping:check", (ts) => socket.emit("ping:response", ts));

  // Disconnect
  socket.on("disconnect", () => {
    const u = users.get(socket.id);
    users.delete(socket.id);
    if (u) {
      io.emit("user:left", { id: socket.id, name: u.name });
      io.emit("users:count", users.size);
      console.log(`  ${u.name} left (${users.size} online)`);
    }
  });
});
