const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rooms = new Map();
const MAX_PLAYERS = 12;

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}
function roomSummary(room) {
  return { code: room.code, players: [...room.players.values()].map(p => ({
    id: p.id, name: p.name, x: p.x, z: p.z, y: p.y, color: p.color, alive: p.alive
  })), state: room.state, lavaY: room.lavaY, timeLeft: room.timeLeft, winner: room.winner || null };
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", roomSummary(room));
}
function resetRound(room) {
  room.state = "waiting";
  room.lavaY = -4.2;
  room.timeLeft = 10;
  room.winner = null;
  for (const p of room.players.values()) {
    p.x = (Math.random() - 0.5) * 5;
    p.z = (Math.random() - 0.5) * 5;
    p.y = 1.2;
    p.alive = true;
  }
  emitRoom(room);
}
function removePlayer(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(code);
  if (!room.players.size) {
    clearInterval(room.timer);
    rooms.delete(code);
    return;
  }
  if (room.state === "playing") checkWinner(room);
  emitRoom(room);
}
function startRound(room) {
  if (room.players.size < 1) return;
  room.state = "playing";
  room.lavaY = -4.2;
  room.timeLeft = 5;
  room.winner = null;
  for (const p of room.players.values()) {
    p.x = (Math.random() - 0.5) * 5;
    p.z = (Math.random() - 0.5) * 5;
    p.y = 1.2;
    p.alive = true;
  }
  emitRoom(room);
}
function checkWinner(room) {
  const alive = [...room.players.values()].filter(p => p.alive);
  if (alive.length <= 1 && room.state === "playing") {
    room.state = "finished";
    room.winner = alive[0]?.name || "Ninguém";
    room.timeLeft = 8;
    emitRoom(room);
  }
}

io.on("connection", socket => {
  socket.on("room:create", ({ name }, reply = () => {}) => {
    removePlayer(socket);
    const code = makeCode();
    const room = { code, players: new Map(), state: "waiting", lavaY: -4.2, timeLeft: 10, winner: null, timer: null };
    rooms.set(code, room);
    joinRoom(socket, room, name, reply);
    room.timer = setInterval(() => {
      if (!rooms.has(room.code)) return;
      if (room.state === "waiting") {
        room.timeLeft--;
        if (room.timeLeft <= 0) startRound(room);
        else emitRoom(room);
      } else if (room.state === "playing") {
        room.timeLeft--;
        room.lavaY += 0.055;
        for (const p of room.players.values()) {
          if (p.alive && p.y < room.lavaY + 0.45) p.alive = false;
        }
        if (room.timeLeft <= 0) {
          room.state = "finished";
          const alive = [...room.players.values()].filter(p => p.alive);
          room.winner = alive[0]?.name || "Ninguém";
          room.timeLeft = 8;
        }
        checkWinner(room);
        emitRoom(room);
      } else {
        room.timeLeft--;
        if (room.timeLeft <= 0) resetRound(room);
        else emitRoom(room);
      }
    }, 1000);
  });
  socket.on("room:join", ({ code, name }, reply = () => {}) => {
    removePlayer(socket);
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return reply({ ok: false, error: "Sala não encontrada. Confira o código." });
    if (room.players.size >= MAX_PLAYERS) return reply({ ok: false, error: "A sala está cheia." });
    if (room.state === "playing") return reply({ ok: false, error: "A rodada já começou. Tente novamente em instantes." });
    joinRoom(socket, room, name, reply);
  });
  socket.on("player:move", data => {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.id);
    if (!room || !p || room.state !== "playing" || !p.alive) return;
    p.x = Math.max(-13, Math.min(13, Number(data.x) || 0));
    p.z = Math.max(-13, Math.min(13, Number(data.z) || 0));
    p.y = Math.max(-1, Math.min(20, Number(data.y) || 1));
    socket.to(room.code).emit("player:moved", { id: socket.id, x: p.x, y: p.y, z: p.z });
    if (p.y < room.lavaY + 0.45) {
      p.alive = false;
      emitRoom(room);
      checkWinner(room);
    }
  });
  socket.on("room:leave", () => removePlayer(socket));
  socket.on("disconnect", () => removePlayer(socket));
});

function joinRoom(socket, room, rawName, reply) {
  const name = String(rawName || "Jogador").trim().slice(0, 16) || "Jogador";
  const colors = ["#43c6ff", "#ffcf4a", "#ff6b8a", "#9d82ff", "#5de0a0", "#ff9955"];
  const p = { id: socket.id, name, x: (Math.random() - .5) * 5, y: 1.2, z: (Math.random() - .5) * 5, color: colors[room.players.size % colors.length], alive: true };
  room.players.set(socket.id, p);
  socket.join(room.code);
  socket.data.roomCode = room.code;
  reply({ ok: true, code: room.code, id: socket.id });
  emitRoom(room);
}
server.listen(PORT, () => console.log(`Lava Rush rodando em http://localhost:${PORT}`));
