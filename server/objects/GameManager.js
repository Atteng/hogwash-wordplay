const GridGenerator = require('./GridGenerator');

class GameManager {
    constructor(io, sessionId, settings, players = new Map()) {
        this.io = io;
        this.sessionId = sessionId;
        this.settings = settings;
        this.players = players; // Values have .socketId

        this.timeRemaining = settings.timeLimit || 600;
        this.timerInterval = null;
        this.status = 'ACTIVE';

        this.mode = settings.mode || 'Competitive'; // Competitive, Co-Op, Teams

        // Generate Base Grid
        const generated = this.generateBaseGrid();
        this.baseGrid = generated.grid;
        this.baseClues = generated.clues;

        this.grids = new Map();

        // --- GRID INITIALIZATION ---
        if (this.mode === 'Co-Op') {
            this.grids.set('SHARED', this.cloneGrid(this.baseGrid));
        } else if (this.mode === 'Teams') {
            this.grids.set('GLOBAL', this.cloneGrid(this.baseGrid));
        } else {
            // Competitive: On demand
        }

        this.cursors = {};
        this.scores = {};
        this.wordsSolved = {}; // playerId -> count
        this.hintsUsed = {}; // playerId -> total hints used
    }

    generateBaseGrid() {
        if (this.settings.customWords && this.settings.customWords.length > 0) {
            const generator = new GridGenerator(this.settings.customWords);
            return generator.generate();
        } else {
            return { grid: this.generateMockGrid(), clues: [] };
        }
    }

    cloneGrid(grid) {
        return JSON.parse(JSON.stringify(grid));
    }

    generateMockGrid() {
        const size = 10;
        const grid = Array(size).fill(null).map(() => Array(size).fill(null).map(() => ({
            value: '',
            correct: 'A',
            isBlack: false,
            number: null,
            isHint: false
        })));

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if ((x + y) % 3 === 0) grid[y][x].isBlack = true;
            }
        }
        return grid;
    }

    getGridFor(playerId) {
        // CO-OP
        if (this.mode === 'Co-Op') {
            return this.grids.get('SHARED');
        }

        // TEAMS
        if (this.mode === 'Teams') {
            const player = this.players.get(playerId);
            if (!player || !player.teamId) {
                return this.grids.get('GLOBAL');
            }

            const teamKey = `TEAM_${player.teamId}`;
            if (!this.grids.has(teamKey)) {
                const globalState = this.grids.get('GLOBAL') || this.baseGrid;
                this.grids.set(teamKey, this.cloneGrid(globalState));
            }
            return this.grids.get(teamKey);
        }

        // COMPETITIVE
        if (!this.grids.has(playerId)) {
            this.grids.set(playerId, this.cloneGrid(this.baseGrid));
        }
        return this.grids.get(playerId);
    }

    start() {
        this.timerInterval = setInterval(() => this.tick(), 1000);
    }

    tick() {
        if (this.status !== 'ACTIVE') return;
        this.timeRemaining--;

        this.io.to(this.sessionId).emit('EVT_GAME_TICK', {
            timeRemaining: this.timeRemaining,
            scores: this.scores, // Keys are UUIDs
            cursors: this.cursors, // Keys are UUIDs
            hintsUsed: this.hintsUsed // Keys are UUIDs
        });

        if (this.timeRemaining <= 0) {
            this.endGame();
        }
    }

    extendTime() {
        this.timeRemaining += 300; // +5 mins
        if (this.status === 'ENDED') {
            this.status = 'ACTIVE';
            this.timerInterval = setInterval(() => this.tick(), 1000);
        }

        this.io.to(this.sessionId).emit('EVT_GAME_RESUMED', { timeRemaining: this.timeRemaining });
    }

    handleInput(playerId, x, y, letter) {
        if (this.status !== 'ACTIVE') return;

        const grid = this.getGridFor(playerId);
        if (!grid) return;

        if (!grid[y] || !grid[y][x]) return;

        const cell = grid[y][x];
        if (cell.isBlack || cell.isSolved) return;

        cell.value = letter.toUpperCase();

        // Check for Word Completion
        this.checkWordComplete(grid, x, y, playerId);

        this.broadcastState(playerId, grid);
    }

    provideHint(playerId) {
        if (this.status !== 'ACTIVE') return;

        const hintsUsed = this.hintsUsed[playerId] || 0;
        if (hintsUsed >= 20) return;

        const grid = this.getGridFor(playerId);
        const candidates = [];
        grid.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (!cell.isBlack && !cell.isSolved && cell.value !== cell.correct) {
                    candidates.push({ r, c });
                }
            });
        });

        if (candidates.length === 0) return;

        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const cell = grid[target.r][target.c];
        cell.value = cell.correct;
        cell.isHint = true;

        this.hintsUsed[playerId] = hintsUsed + 1;

        this.checkWordComplete(grid, target.c, target.r, playerId);

        this.broadcastState(playerId, grid);
    }

    checkWordComplete(grid, x, y, playerId) {
        const relevantClues = this.baseClues.filter(c => {
            if (c.direction === 'ACROSS') {
                return c.y === y && x >= c.x && x < c.x + c.word.length;
            } else {
                return c.x === x && y >= c.y && y < c.y + c.word.length;
            }
        });

        relevantClues.forEach(clue => {
            let isFull = true;
            let isCorrect = true;
            let hintsInWord = 0;
            const cellsToUpdate = [];

            for (let i = 0; i < clue.word.length; i++) {
                const cx = clue.direction === 'ACROSS' ? clue.x + i : clue.x;
                const cy = clue.direction === 'ACROSS' ? clue.y : clue.y + i;
                const cell = grid[cy][cx];

                if (!cell.value) { isFull = false; break; }
                if (cell.value !== cell.correct) { isCorrect = false; }
                if (cell.isHint) hintsInWord++;
                cellsToUpdate.push({ cell, x: cx, y: cy });
            }

            if (isFull && isCorrect) {
                console.log(`[GameManager] Word Solved: ${clue.word} by ${playerId}`);

                let teamId = null;
                if (this.players.has(playerId)) {
                    const p = this.players.get(playerId);
                    if (p.teamId) teamId = p.teamId;
                }

                // SCORING
                let points = (clue.word.length * 2) - hintsInWord;
                if (points < 0) points = 0;

                this.scores[playerId] = (this.scores[playerId] || 0) + points;
                this.wordsSolved[playerId] = (this.wordsSolved[playerId] || 0) + 1;

                // Mark Local Grid
                cellsToUpdate.forEach(item => {
                    item.cell.isSolved = true;
                    item.cell.solvedBy = playerId;
                    item.cell.solvedByTeam = teamId;
                });

                if (this.mode === 'Teams') {
                    this.syncSolutionToAll(cellsToUpdate, playerId, teamId);
                }

                this.checkForWin(grid);
            }
        });
    }

    checkForWin(grid) {
        const allSolved = this.baseClues.every(clue => {
            for (let i = 0; i < clue.word.length; i++) {
                const cx = clue.direction === 'ACROSS' ? clue.x + i : clue.x;
                const cy = clue.direction === 'ACROSS' ? clue.y : clue.y + i;
                const cell = grid[cy][cx];
                if (!cell.isSolved) return false;
            }
            return true;
        });

        if (allSolved) {
            console.log(`[GameManager] Grid Complete! Ending Game.`);
            this.endGame();
        }
    }

    syncSolutionToAll(solvedCells, playerId, teamId) {
        const globalGrid = this.grids.get('GLOBAL');
        if (globalGrid) {
            solvedCells.forEach(item => {
                const gCell = globalGrid[item.y][item.x];
                gCell.value = item.cell.value;
                gCell.isSolved = true;
                gCell.solvedBy = playerId;
                gCell.solvedByTeam = teamId;
            });
        }

        for (const [key, tGrid] of this.grids.entries()) {
            if (key.startsWith('TEAM_') || key === 'SHARED') {
                solvedCells.forEach(item => {
                    const tCell = tGrid[item.y][item.x];
                    tCell.value = item.cell.value;
                    tCell.isSolved = true;
                    tCell.solvedBy = playerId;
                    tCell.solvedByTeam = teamId;
                });
            }
        }

        this.io.to(this.sessionId).emit('EVT_GAME_TICK', {
            timeRemaining: this.timeRemaining,
            scores: this.scores,
            cursors: this.cursors,
            hintsUsed: this.hintsUsed
        });

        // Broadcast to relevant sockets
        for (const [pid, player] of this.players.entries()) {
            if (player.socketId) {
                const grid = this.getGridFor(pid);
                this.io.to(player.socketId).emit('EVT_GRID_UPDATE', { grid: grid, clues: this.baseClues });
            }
        }
    }

    broadcastState(playerId, grid) {
        if (this.mode === 'Co-Op') {
            this.io.to(this.sessionId).emit('EVT_GRID_UPDATE', { grid, clues: this.baseClues });
        } else if (this.mode === 'Teams') {
            const p = this.players.get(playerId);
            if (p && p.teamId) {
                // Broadcast to teammates
                Array.from(this.players.values()).forEach(tm => {
                    if (tm.teamId === p.teamId && tm.socketId) {
                        this.io.to(tm.socketId).emit('EVT_GRID_UPDATE', { grid, clues: this.baseClues });
                    }
                });
            } else {
                // Fallback: If player has no team (e.g. join bug), send update just to them
                // This prevents the UI from appearing "frozen" if they are in limbo
                if (p && p.socketId) {
                    this.io.to(p.socketId).emit('EVT_GRID_UPDATE', { grid, clues: this.baseClues });
                }
            }
        } else {
            // Competitive: Send only to me
            const p = this.players.get(playerId);
            if (p && p.socketId) {
                this.io.to(p.socketId).emit('EVT_GRID_UPDATE', { grid, clues: this.baseClues });
            }
        }
    }

    handleSelect(playerId, x, y) {
        this.cursors[playerId] = { x, y };
    }

    sendStateTo(socketId, playerId) {
        if (!playerId) return; // Need playerId to get grid
        const grid = this.getGridFor(playerId);
        this.io.to(socketId).emit('EVT_GRID_UPDATE', {
            grid: grid,
            clues: this.baseClues
        });

        this.io.to(socketId).emit('EVT_GAME_TICK', {
            timeRemaining: this.timeRemaining,
            scores: this.scores,
            cursors: this.cursors,
            hintsUsed: this.hintsUsed
        });
    }

    endGame() {
        clearInterval(this.timerInterval);
        this.status = 'ENDED';
        this.io.to(this.sessionId).emit('EVT_GAME_OVER', {
            scores: this.scores,
            wordsSolved: this.wordsSolved,
            message: 'Game Over!'
        });
    }
}

module.exports = GameManager;
