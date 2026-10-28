const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function publicState(room) {
  return {
    code: room.code,
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    players: {
      X: Boolean(room.players.X),
      O: Boolean(room.players.O)
    },
    yourSymbol: null
  };
}

function sendState(room) {
  for (const symbol of ["X", "O"]) {
    const player = room.players[symbol];
    if (player) {
      player.emit("game-state", { ...publicState(room), yourSymbol: symbol });
    }
  }
}

function getRoomForSocket(socket) {
  if (!socket.data.roomCode || !socket.data.symbol) return null;
  const room = rooms.get(socket.data.roomCode);
  if (!room) return null;
  if (room.players[socket.data.symbol]?.id !== socket.id) return null;
  return room;
}

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

io.on("connection", (socket) => {
  socket.on("create-room", (callback) => {
    if (socket.data.roomCode) {
      return callback?.({ ok: false, message: "You are already in a room." });
    }

    const code = makeCode();
    const room = {
      code,
      board: Array(9).fill(null),
      currentTurn: "X",
      status: "waiting",
      winner: null,
      players: {
        X: { id: socket.id, emit: (event, payload) => socket.emit(event, payload) },
        O: null
      }
    };

    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.data.symbol = "X";
    socket.join(code);
    callback?.({ ok: true, code, symbol: "X" });
    sendState(room);
    socket.emit("notice", "Room created. Share the code with your friend.");
  });

  socket.on("join-room", (rawCode, callback) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (socket.data.roomCode) {
      return callback?.({ ok: false, message: "You are already in a room." });
    }
    const room = rooms.get(code);
    if (!room) return callback?.({ ok: false, message: "Room not found. Check the code." });
    if (room.players.O) return callback?.({ ok: false, message: "This room is already full." });
    if (room.status !== "waiting") {
      return callback?.({ ok: false, message: "This room is no longer available." });
    }

    room.players.O = { id: socket.id, emit: (event, payload) => socket.emit(event, payload) };
    room.status = "playing";
    socket.data.roomCode = code;
    socket.data.symbol = "O";
    socket.join(code);
    callback?.({ ok: true, code, symbol: "O" });
    io.to(code).emit("notice", "Both players are here. Game on!");
    sendState(room);
  });

  socket.on("make-move", (index) => {
    const room = getRoomForSocket(socket);
    if (!room) return socket.emit("notice", "Join a room before making a move.");
    const symbol = socket.data.symbol;

    if (room.status !== "playing") return socket.emit("notice", "The game is not currently active.");
    if (symbol !== room.currentTurn) return socket.emit("notice", "It is not your turn.");
    if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index] !== null) {
      return socket.emit("notice", "That square is not available.");
    }

    room.board[index] = symbol;
    const winner = checkWinner(room.board);
    if (winner) {
      room.status = "finished";
      room.winner = winner;
    } else if (room.board.every(Boolean)) {
      room.status = "draw";
    } else {
      room.currentTurn = symbol === "X" ? "O" : "X";
    }
    sendState(room);
  });

  socket.on("restart-game", () => {
    const room = getRoomForSocket(socket);
    if (!room) return socket.emit("notice", "Join a room before restarting.");
    if (!room.players.X || !room.players.O) {
      return socket.emit("notice", "Both players must be connected to restart.");
    }
    if (room.status !== "finished" && room.status !== "draw") {
      return socket.emit("notice", "Finish the current game before restarting.");
    }

    room.board = Array(9).fill(null);
    room.currentTurn = "X";
    room.status = "playing";
    room.winner = null;
    io.to(room.code).emit("notice", "New game started. X goes first.");
    sendState(room);
  });

  socket.on("leave-room", () => leaveRoom(socket, true));
  socket.on("disconnect", () => leaveRoom(socket, false));
});

function leaveRoom(socket, notify) {
  const code = socket.data.roomCode;
  const symbol = socket.data.symbol;
  if (!code || !symbol) return;

  const room = rooms.get(code);
  socket.data.roomCode = null;
  socket.data.symbol = null;
  if (!room) return;

  const player = room.players[symbol];
  if (!player || player.id !== socket.id) return;
  room.players[symbol] = null;
  room.status = "disconnected";

  const remaining = room.players[symbol === "X" ? "O" : "X"];
  if (remaining) {
    remaining.emit("opponent-disconnected", {
      message: `Your opponent (${symbol}) disconnected. Create a new room to play again.`
    });
  }

  if (notify) socket.leave(code);
  // Keep the room briefly available only for its remaining player to receive state;
  // a disconnected room cannot accept another player or continue the game.
  if (!room.players.X && !room.players.O) rooms.delete(code);
  else sendState(room);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tic-Tac-Toe server listening on port ${PORT}`);
});
