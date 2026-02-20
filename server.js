const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

// Create an Express app and wrap it in a plain HTTP server.
// Socket.IO needs access to the raw HTTP server (not just Express)
// so it can upgrade incoming connections from HTTP to WebSocket.
const app = express();
const server = http.createServer(app);

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

// Server-side state: we remember the most recent background color so that new
// clients can be initialized with it. IN PRACTICE, DON'T DO IT THIS EXACT WAY.
var lastBackgroundColor = "#00ff00";

// "connection" fires every time a new client opens a socket to this server.
// Each client gets its own `socket` object with a unique socket.id.
io.on("connection", (socket) => 
{

  console.log(`Client connected: ${socket.id}`);
  socket.emit('colorChangedResponse', lastBackgroundColor );

  // "disconnect" fires when this specific client's connection closes —
  // whether they closed the tab, lost network, or the server ended the socket.
  socket.on("disconnect", () => 
  {
    console.log(`Client disconnected: ${socket.id}`);
  });

  socket.on('buttonPushed', () => 
  {
    console.log(`Button pushed by client: ${socket.id}`);
    socket.emit('buttonPushedResponse', {} );
  });

  socket.on('moodChanged', (sliderValue) => 
  {
    console.log(`Mood changed by client: ${socket.id} to ${sliderValue}`);
    socket.broadcast.emit('moodChangedResponse', sliderValue );
  });

  socket.on('colorChanged', (colorValue) => 
  {
    lastBackgroundColor = colorValue;
    console.log(`Color changed by client: ${socket.id} to ${colorValue}`);
    socket.broadcast.emit('colorChangedResponse', lastBackgroundColor );
  });

});
