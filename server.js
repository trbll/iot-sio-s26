const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

// Create an Express app and wrap it in a plain HTTP server.
// Socket.IO needs access to the raw HTTP server (not just Express)
// so it can upgrade incoming connections from HTTP to WebSocket.
const app = express();
const server = http.createServer(app);

// process.env.PORT lets hosting platforms (Heroku, Render, etc.) tell our app
// which port to use.  If that variable isn't set (e.g. on your laptop), fall
// back to 3000 so you can visit http://localhost:3000 during development.
const PORT = process.env.PORT || 3000;

// Serve everything in the /public folder as static files (HTML, CSS, JS).
// This is how the browser receives script.js and the rest of the front-end.
app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Attach Socket.IO to the HTTP server.
// io is the central hub that manages all connected clients.
const io = new Server(server);

// Server-side state: we remember the most recent background color so that
// clients who join *after* the color was changed still see the right color.
// Without this, late joiners would always start with the default.
var lastBackgroundColor = "#00ff00";

// "connection" fires every time a new client opens a socket to this server.
// Each client gets its own `socket` object with a unique socket.id.
io.on("connection", (socket) => 
{
  console.log(`Client connected: ${socket.id}`);

  // Immediately send this new client the last-known background color.
  // socket.emit() sends ONLY to this one socket — no other clients see it.
  socket.emit('backgroundColorChanged', lastBackgroundColor);

  // "disconnect" fires when this specific client's connection closes —
  // whether they closed the tab, lost network, or the server ended the socket.
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // socket.emit() sends back to the SAME client that sent the message.
  // Compare this with socket.broadcast.emit() used below, which sends to
  // every client EXCEPT the sender.  io.emit() (not used here) would send
  // to ALL clients including the sender.
  socket.on('buttonPushed', () => {
    console.log(`Button pushed by client: ${socket.id}`);
    socket.emit('buttonPushed');
  });

  // socket.broadcast.emit() sends to every OTHER connected client, but NOT
  // back to the sender.  This makes sense for the slider because the sender
  // already moved their own slider — we only need to sync everyone else.
  socket.on('moodChanged', (sliderValue) => {
    console.log(`Mood changed by client: ${socket.id} to ${sliderValue}`);
    socket.broadcast.emit('moodChanged', sliderValue);
  });

  // Two things happen here: (1) we persist the color in server memory so
  // future clients can be initialized with it, and (2) we broadcast to all
  // other clients so they update in real time.
  socket.on('backgroundColorChanged', (backgroundColor) => {
    console.log(`Background color changed by client: ${socket.id} to ${backgroundColor}`);
    lastBackgroundColor = backgroundColor;
    socket.broadcast.emit('backgroundColorChanged', lastBackgroundColor);
  });

});
