const socket = io();

const lobby = document.getElementById("lobby");
const gamePanel = document.getElementById("gamePanel");
const createBtn = document.getElementById("createBtn");
const joinForm = document.getElementById("joinForm");
const roomCodeInput = document.getElementById("roomCodeInput");
const lobbyFeedback = document.getElementById("lobbyFeedback");
const gameFeedback = document.getElementById("gameFeedback");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const copyBtn = document.getElementById("copyBtn");
const leaveBtn = document.getElementById("leaveBtn");
const restartBtn = document.getElementById("restartBtn");
const statusMark = document.getElementById("statusMark");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const cells = [...document.querySelectorAll(".cell")];

let mySymbol = null;
let currentState = null;
let roomCode = null;
let disconnected = false;

function setFeedback(element, message) {
  element.textContent = message || "";
}

function enterRoom(result) {
  roomCode = result.code;
  mySymbol = result.symbol;
  currentState = null;
  disconnected = false;
  roomCodeLabel.textContent = roomCode;
  lobby.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  setFeedback(gameFeedback, "");
}

createBtn.addEventListener("click", () => {
  createBtn.disabled = true;
  socket.emit("create-room", (result) => {
    createBtn.disabled = false;
    if (!result?.ok) return setFeedback(lobbyFeedback, result?.message || "Could not create a room.");
    enterRoom(result);
  });
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) {
    return setFeedback(lobbyFeedback, "Enter a valid four-character code.");
  }
  socket.emit("join-room", code, (result) => {
    if (!result?.ok) return setFeedback(lobbyFeedback, result?.message || "Could not join room.");
    enterRoom(result);
  });
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 4);
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    copyBtn.textContent = "Copied!";
  } catch {
    setFeedback(gameFeedback, `Share this room code: ${roomCode}`);
  }
  setTimeout(() => { copyBtn.textContent = "Copy"; }, 1400);
});

cells.forEach((cell) => {
  cell.addEventListener("click", () => {
    if (disconnected || !currentState) return;
    socket.emit("make-move", Number(cell.dataset.index));
  });
});

restartBtn.addEventListener("click", () => socket.emit("restart-game"));

leaveBtn.addEventListener("click", () => {
  socket.emit("leave-room");
  mySymbol = null;
  roomCode = null;
  currentState = null;
  disconnected = false;
  gamePanel.classList.add("hidden");
  lobby.classList.remove("hidden");
  setFeedback(lobbyFeedback, "You left the room. Create or join another room.");
});

socket.on("game-state", (state) => {
  currentState = state;
  mySymbol = state.yourSymbol || mySymbol;
  disconnected = state.status === "disconnected";
  render(state);
});

socket.on("notice", (message) => setFeedback(gameFeedback, message));

socket.on("opponent-disconnected", ({ message }) => {
  disconnected = true;
  setFeedback(gameFeedback, message);
  if (currentState) render(currentState);
});

socket.on("connect", () => {
  // A page refresh or network reconnect does not restore a previous room.
  if (roomCode && !currentState) setFeedback(gameFeedback, "Reconnected. Create or join a room to continue.");
});

socket.on("disconnect", () => {
  disconnected = true;
  setFeedback(gameFeedback, "Connection lost. Refresh the page and create or join a room again.");
  cells.forEach((cell) => { cell.disabled = true; });
});

function render(state) {
  const waiting = state.status === "waiting";
  const playing = state.status === "playing";
  const ended = state.status === "finished" || state.status === "draw";
  const isMyTurn = playing && state.currentTurn === mySymbol;

  state.board.forEach((value, index) => {
    const cell = cells[index];
    cell.textContent = value || "";
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.disabled = !playing || !isMyTurn || Boolean(value) || disconnected;
    cell.setAttribute("aria-label", `Square ${index + 1}${value ? `, ${value}` : ""}`);
  });

  document.getElementById("playerX").classList.toggle("active", playing && state.currentTurn === "X");
  document.getElementById("playerO").classList.toggle("active", playing && state.currentTurn === "O");
  document.getElementById("xDot").classList.toggle("connected", state.players.X);
  document.getElementById("oDot").classList.toggle("connected", state.players.O);
  document.getElementById("xYou").textContent = mySymbol === "X" ? "YOU" : "";
  document.getElementById("oYou").textContent = mySymbol === "O" ? "YOU" : "";

  restartBtn.classList.toggle("hidden", !ended || disconnected);
  restartBtn.disabled = !state.players.X || !state.players.O;

  if (state.status === "disconnected") {
    statusMark.textContent = "!";
    statusTitle.textContent = "Player disconnected";
    statusText.textContent = "This room cannot continue. Leave and create a new room.";
  } else if (waiting) {
    statusMark.textContent = "…";
    statusTitle.textContent = "Waiting for a player";
    statusText.textContent = "Share the room code with your friend.";
  } else if (state.status === "finished") {
    statusMark.textContent = "★";
    statusTitle.textContent = state.winner === mySymbol ? "You won!" : `Player ${state.winner} wins`;
    statusText.textContent = state.winner === mySymbol ? "Nice moves. Ready for another round?" : "Good game. Try again?";
  } else if (state.status === "draw") {
    statusMark.textContent = "=";
    statusTitle.textContent = "It's a draw!";
    statusText.textContent = "That was close. Play another round?";
  } else {
    statusMark.textContent = state.currentTurn;
    statusTitle.textContent = isMyTurn ? "Your turn" : `Player ${state.currentTurn}'s turn`;
    statusText.textContent = isMyTurn ? `You are ${mySymbol}. Pick an empty square.` : `You are ${mySymbol}. Hang tight.`;
  }
}
