const GameManager = require('./GameManager');
const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> sessionData
        this.gameManagers = new Map(); // sessionId -> gameManagerInstance
        this.socketToPlayer = new Map(); // socketId -> { sessionId, playerId }
    }

    generateUUID() {
        // Fallback if crypto.randomUUID not available (Node < 14.17)
        if (crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Generate a random 6-character ID (e.g. "ABC-123")
    generateSessionId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            if (i === 3) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    createSession(hostSocketId, playerName, options = {}) {
        const sessionId = this.generateSessionId();
        const hostPlayerId = this.generateUUID();

        const mode = options.mode || 'COMPETITIVE';
        const numTeams = options.numTeams || 2;

        const newSession = {
            id: sessionId,
            hostId: hostPlayerId,
            players: new Map(), // playerId -> playerData
            status: 'LOBBY',
            settings: {
                timeLimit: options.timeLimit || 600,
                mode: mode,
                difficulty: options.difficulty || 'NORMAL',
                customWords: options.customWords || null,
                numTeams: numTeams,
                hintLimit: options.hintLimit || 20
            },
            teams: [],
            createdAt: Date.now()
        };

        if (mode === 'Teams') {
            const maxPerTeam = Math.floor(30 / numTeams);
            for (let i = 0; i < numTeams; i++) {
                newSession.teams.push({
                    id: i + 1,
                    name: `Team ${String.fromCharCode(65 + i)}`,
                    players: [], // Array of playerIds
                    maxPlayers: maxPerTeam
                });
            }
        }

        const hostPlayer = {
            id: hostPlayerId,
            socketId: hostSocketId, // Important for ID mapping!
            name: playerName,
            isHost: true,
            score: 0,
            wordsSolved: 0,
            ready: true,
            teamId: null
        };

        newSession.players.set(hostPlayerId, hostPlayer);
        this.sessions.set(sessionId, newSession);

        // Map Socket
        this.socketToPlayer.set(hostSocketId, { sessionId, playerId: hostPlayerId });

        console.log(`[SessionManager] Session created: ${sessionId} by ${playerName} (${hostPlayerId})`);
        return { session: newSession, playerId: hostPlayerId };
    }

    joinSession(sessionId, socketId, playerName) {
        const session = this.sessions.get(sessionId);

        if (!session) return { error: 'Session not found' };
        // Allow re-join logic is separate? Or check here?
        // Usually plain join creates NEW player.

        if (session.status !== 'LOBBY') return { error: 'Game already in progress' };

        const playerId = this.generateUUID();

        const newPlayer = {
            id: playerId,
            socketId: socketId,
            name: playerName,
            isHost: false,
            score: 0,
            wordsSolved: 0,
            ready: false,
            teamId: null
        };

        session.players.set(playerId, newPlayer);
        this.socketToPlayer.set(socketId, { sessionId, playerId });

        console.log(`[SessionManager] ${playerName} joined session ${sessionId}`);

        return { session: session, player: newPlayer, playerId: playerId };
    }

    rejoinSession(sessionId, playerId, newSocketId) {
        const session = this.sessions.get(sessionId);
        if (!session) return { error: 'Session not found' };

        if (!session.players.has(playerId)) return { error: 'Player not found in session' };

        const player = session.players.get(playerId);

        // Update Socket
        // Remove old socket mapping if exists?
        // Actually we don't know the old socket easily unless we store it, but we can just overwrite if conflict.
        // Or finding by value in Map (slow).
        // Since 'socketToPlayer' is Keyed by SocketID, the old socket entry will just linger until disconnect cleanup cleans it.
        // We set new mapping.

        player.socketId = newSocketId;
        this.socketToPlayer.set(newSocketId, { sessionId, playerId });

        console.log(`[SessionManager] ${player.name} RE-JOINED session ${sessionId} with new socket`);

        return { session, player };
    }

    joinTeam(sessionId, playerId, teamId) {
        const session = this.sessions.get(sessionId);
        if (!session) return { error: 'Session not found' };
        if (session.settings.mode !== 'Teams') return { error: 'Not in Teams mode' };

        const team = session.teams.find(t => t.id === teamId);
        if (!team) return { error: 'Team not found' };

        if (team.players.length >= team.maxPlayers) return { error: 'Team is full' };

        const player = session.players.get(playerId);
        if (!player) return { error: 'Player not found' };

        // Remove from old team
        if (player.teamId) {
            const oldTeam = session.teams.find(t => t.id === player.teamId);
            if (oldTeam) {
                oldTeam.players = oldTeam.players.filter(pid => pid !== playerId);
            }
        }

        team.players.push(playerId);
        player.teamId = teamId;

        return { success: true };
    }

    // Explicit Leave (CMD_LEAVE_SESSION)
    leaveSession(socketId) {
        const info = this.socketToPlayer.get(socketId);
        if (!info) return null;

        const { sessionId, playerId } = info;
        const session = this.sessions.get(sessionId);

        if (session && session.players.has(playerId)) {
            const player = session.players.get(playerId);

            // Remove from Team
            if (player.teamId && session.teams) {
                const team = session.teams.find(t => t.id === player.teamId);
                if (team) {
                    team.players = team.players.filter(pid => pid !== playerId);
                }
            }

            session.players.delete(playerId);
            console.log(`[SessionManager] ${player.name} explicitly left session ${sessionId}`);

            // Remove Map
            this.socketToPlayer.delete(socketId);

            // If host leaves
            if (player.isHost) {
                if (session.players.size > 0) {
                    const nextPlayerId = session.players.keys().next().value;
                    session.players.get(nextPlayerId).isHost = true;
                    session.hostId = nextPlayerId;
                } else {
                    this.closeSession(sessionId, playerId); // Destroy
                    return { sessionId, destroyed: true };
                }
            }
            return { sessionId, session, playerId };
        }
        return null;
    }

    // Disconnect (Socket closed) - Do NOT remove player from session (Persistence)
    handleDisconnect(socketId) {
        const info = this.socketToPlayer.get(socketId);
        if (!info) return null;

        const { sessionId, playerId } = info;
        const session = this.sessions.get(sessionId);

        if (session && session.players.has(playerId)) {
            const player = session.players.get(playerId);
            player.socketId = null; // Mark as disconnected
            console.log(`[SessionManager] ${player.name} disconnected (socket closed)`);
        }

        this.socketToPlayer.delete(socketId);
        return { sessionId };
    }

    startGame(io, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return { error: 'Session not found' };

        // SAFETY: If a game is already running (e.g. double click), stop it first!
        if (this.gameManagers.has(sessionId)) {
            console.log(`[SessionManager] Stopping existing game for ${sessionId} before start.`);
            this.gameManagers.get(sessionId).endGame();
            this.gameManagers.delete(sessionId);
        }

        session.status = 'GAME';
        session.startTime = Date.now();

        const gameManager = new GameManager(io, sessionId, session.settings, session.players);
        this.gameManagers.set(sessionId, gameManager);
        gameManager.start();

        return { session };
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    // Input handlers need to look up PlayerID from SocketID?
    // Actually, App.js sends `socket.emit('CMD_INPUT...', { sessionId, x, y ...})`.
    // It doesn't send PlayerID usually, we rely on SocketID identification.
    // BUT now SocketID != PlayerID (well, mapping exists).
    // `server.js` knows `socket.id`. It can look up `playerId`.
    // So `handleInput` arguments should probably change to accept `socketId` and resolve `playerId`?
    // OR `server.js` resolves it.
    // Let's make `server.js` resolve it using `socketToPlayer`.

    // So these methods expect `playerId`.
    handleInput(sessionId, playerId, x, y, letter) {
        if (!this.gameManagers.has(sessionId)) return;
        this.gameManagers.get(sessionId).handleInput(playerId, x, y, letter);
    }

    handleSelect(sessionId, playerId, x, y) {
        if (!this.gameManagers.has(sessionId)) return;
        this.gameManagers.get(sessionId).handleSelect(playerId, x, y);
    }

    sendGameState(sessionId, socketId) {
        // Need to know WHO this socket belongs to to send their specific grid?
        // `GameManager.sendStateTo(socketId)`.
        // `GameManager` logic uses `socketId` to identify target for `io.to(socketId)`.
        // BUT it needs `playerId` to know which grid to send!
        // So we need to resolve `socketId -> playerId`.

        const info = this.socketToPlayer.get(socketId);
        if (info && info.sessionId === sessionId) {
            if (!this.gameManagers.has(sessionId)) return;
            this.gameManagers.get(sessionId).sendStateTo(socketId, info.playerId);
        }
    }

    requestHint(sessionId, playerId) {
        if (!this.gameManagers.has(sessionId)) return;
        this.gameManagers.get(sessionId).provideHint(playerId);
    }

    extendTime(sessionId, requesterId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== requesterId) return;
        if (this.gameManagers.has(sessionId)) this.gameManagers.get(sessionId).extendTime();
    }

    restartGame(sessionId, requesterId, io) {
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== requesterId) return;

        if (this.gameManagers.has(sessionId)) {
            this.gameManagers.get(sessionId).endGame();
        }

        const gameManager = new GameManager(io, sessionId, session.settings, session.players);
        this.gameManagers.set(sessionId, gameManager);
        gameManager.start();

        session.status = 'GAME';

        const serializedSession = {
            ...session,
            players: Array.from(session.players.values())
        };

        io.to(sessionId).emit('EVT_SESSION_UPDATE', { session: serializedSession });
    }

    closeSession(sessionId, requesterId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== requesterId) return;

        if (this.gameManagers.has(sessionId)) {
            this.gameManagers.get(sessionId).endGame();
            this.gameManagers.delete(sessionId);
        }
        this.sessions.delete(sessionId);
        return { success: true };
    }

    // Helper for Server.js to resolve ID
    getPlayerId(socketId) {
        const info = this.socketToPlayer.get(socketId);
        return info ? info.playerId : null;
    }

    // Helper to format session for client (Map -> Array)
    serializeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return {
            ...session,
            players: Array.from(session.players.values())
        };
    }
}

module.exports = new SessionManager();
