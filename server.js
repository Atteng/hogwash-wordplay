require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const SessionManager = require('./server/objects/SessionManager');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

const PORT = 3001;

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- SESSION MANAGEMENT ---

  socket.on('CMD_CREATE_SESSION', (data) => {
    const { playerName, settings } = data;
    const { session, playerId } = SessionManager.createSession(socket.id, playerName, settings);

    socket.join(session.id);
    socket.emit('RES_SESSION_CREATED', {
      sessionId: session.id,
      playerId,
      session: SessionManager.serializeSession(session.id)
    });
  });

  socket.on('CMD_JOIN_SESSION', (data) => {
    const { sessionId, playerName } = data;
    const result = SessionManager.joinSession(sessionId, socket.id, playerName);

    if (result.error) {
      socket.emit('ERR_SESSION', { msg: result.error });
    } else {
      socket.join(sessionId);

      const sSession = SessionManager.serializeSession(sessionId);

      socket.emit('RES_SESSION_JOINED', {
        sessionId: result.session.id,
        playerId: result.playerId,
        session: sSession
      });

      io.to(sessionId).emit('EVT_SESSION_UPDATE', { session: sSession });

      // If game is active, send state
      if (result.session.status === 'GAME') {
        SessionManager.sendGameState(sessionId, socket.id);
      }
    }
  });

  socket.on('CMD_JOIN_TEAM', (data) => {
    const { sessionId, teamId } = data;
    const playerId = SessionManager.getPlayerId(socket.id);

    if (playerId) {
      const result = SessionManager.joinTeam(sessionId, playerId, teamId);
      if (result.error) {
        socket.emit('ERR_SESSION', { msg: result.error });
      } else {
        const sSession = SessionManager.serializeSession(sessionId);
        io.to(sessionId).emit('EVT_SESSION_UPDATE', { session: sSession });
      }
    }
  });

  socket.on('CMD_REJOIN_SESSION', (data) => {
    const { sessionId, playerId } = data;
    console.log(`Check Rejoin: ${sessionId} / ${playerId} for ${socket.id}`);
    const result = SessionManager.rejoinSession(sessionId, playerId, socket.id);

    if (result.error) {
      socket.emit('ERR_SESSION', { msg: result.error, code: 'REJOIN_FAILED' });
    } else {
      socket.join(sessionId);

      const sSession = SessionManager.serializeSession(sessionId);

      socket.emit('RES_SESSION_JOINED', {
        sessionId: result.session.id,
        playerId: playerId,
        session: sSession
      });

      // Send current game state if Active
      if (result.session.status === 'GAME') {
        SessionManager.sendGameState(sessionId, socket.id);
      }

      console.log(`Player ${result.player.name} rejoined successfully.`);
    }
  });

  socket.on('CMD_LEAVE_SESSION', () => {
    const result = SessionManager.leaveSession(socket.id);
    if (result) {
      socket.leave(result.sessionId);
      if (!result.destroyed) {
        const sSession = SessionManager.serializeSession(result.sessionId);
        if (sSession) {
          io.to(result.sessionId).emit('EVT_SESSION_UPDATE', { session: sSession });
        }
      } else {
        io.to(result.sessionId).emit('EVT_SESSION_CLOSED');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Handle Disconnect (Preserve Session)
    SessionManager.handleDisconnect(socket.id);
  });

  // --- GAMEPLAY INPUT ---

  socket.on('CMD_REQUEST_GAME_STATE', (data) => {
    const { sessionId } = data;
    SessionManager.sendGameState(sessionId, socket.id);
  });

  socket.on('CMD_START_GAME', (data) => {
    const { sessionId } = data;
    const result = SessionManager.startGame(io, sessionId);
    if (result.error) {
      socket.emit('ERR_SESSION', { msg: result.error });
    } else {
      // Updated session status
      const sSession = SessionManager.serializeSession(sessionId);
      io.to(sessionId).emit('EVT_SESSION_UPDATE', { session: sSession });
    }
  });

  socket.on('CMD_INPUT_LETTER', (data) => {
    const { sessionId, x, y, letter } = data;
    const playerId = SessionManager.getPlayerId(socket.id);
    if (playerId) {
      SessionManager.handleInput(sessionId, playerId, x, y, letter);
    }
  });

  socket.on('CMD_SELECT_CELL', (data) => {
    const { sessionId, x, y } = data;
    const playerId = SessionManager.getPlayerId(socket.id);
    if (playerId) {
      SessionManager.handleSelect(sessionId, playerId, x, y);
    }
  });

  socket.on('CMD_REQUEST_HINT', (data) => {
    const { sessionId } = data;
    const playerId = SessionManager.getPlayerId(socket.id);
    if (playerId) {
      SessionManager.requestHint(sessionId, playerId);
    }
  });

  // --- HOST ACTIONS ---

  socket.on('CMD_EXTEND_TIME', (data) => {
    const { sessionId, requesterId } = data;
    SessionManager.extendTime(sessionId, requesterId);
  });

  socket.on('CMD_RESTART_GAME', (data) => {
    const { sessionId, requesterId } = data;
    SessionManager.restartGame(sessionId, requesterId, io);
  });

  socket.on('CMD_CLOSE_SESSION', (data) => {
    const { sessionId, requesterId } = data;
    const result = SessionManager.closeSession(sessionId, requesterId);
    if (result && result.success) {
      io.to(sessionId).emit('EVT_SESSION_CLOSED');
    }
  });

});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
