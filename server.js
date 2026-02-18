const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const io = new Server(server);

io.on("connection", (socket) => 
{

  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

});
