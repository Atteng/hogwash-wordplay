import React, { useState, useEffect } from 'react';

// Memoized Cell Component for Performance
const GridCell = React.memo(({
    row, col,
    value,
    isBlack,
    number,
    isSolved,
    teamId,
    isActive,
    cursors, // List of players selecting this cell
    onClick
}) => {
    // If it's a black cell, render simplistic
    if (isBlack) {
        return <div className="grid-cell black"></div>;
    }

    // Team Color Logic
    const teamClassMap = ['team-a', 'team-b', 'team-c', 'team-d'];
    const teamClass = teamId ? teamClassMap[teamId - 1] : '';

    return (
        <div
            className={`grid-cell white ${isActive ? 'selected' : ''} ${isSolved ? 'solved' : ''} ${teamClass}`}
            onClick={() => onClick(row, col)}
        >
            {number && <span className="cell-number">{number}</span>}
            {value}

            {/* Render Other Player Cursors */}
            {cursors && cursors.length > 0 && (
                <div className="cursor-indicator">
                    {cursors.length}
                </div>
            )}
        </div>
    );
});

const CrosswordGrid = ({ grid, cursors, socket, sessionId, onCellClick }) => {
    const [activeCell, setActiveCell] = useState(null); // { r, c }

    // Handle Input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!activeCell || !socket || !sessionId) return;
            const { r, c } = activeCell;

            // Check for letter (A-Z)
            if (e.key.match(/^[a-zA-Z]$/)) {
                socket.emit('CMD_INPUT_LETTER', {
                    sessionId,
                    x: c, y: r,
                    letter: e.key.toUpperCase()
                });
            }

            // Backspace/Delete (Clear cell)
            if (e.key === 'Backspace' || e.key === 'Delete') {
                socket.emit('CMD_INPUT_LETTER', {
                    sessionId,
                    x: c, y: r,
                    letter: ''
                });
            }

            // Arrow implementation (optional future polish)
            // Arrows logic requires knowing grid boundaries...
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, socket, sessionId]);

    const handleCellClick = React.useCallback((r, c) => {
        setActiveCell({ r, c });
        if (socket && sessionId) {
            socket.emit('CMD_SELECT_CELL', { sessionId, x: c, y: r });
        }
        if (onCellClick) onCellClick();
    }, [socket, sessionId, onCellClick]);

    if (!grid || grid.length === 0) return <div>Waiting for game...</div>;

    // Helper to find cursors at this cell
    // cursors = { playerId: {x,y}, ... }
    const getCursorsAt = (r, c) => {
        if (!cursors) return [];
        return Object.values(cursors).filter(pos => pos.x === c && pos.y === r);
    };

    return (
        <div className="crossword-grid">
            {grid.map((row, r) => (
                <div key={r} className="grid-row" style={{ display: 'contents' }}>
                    {row.map((cell, c) => (
                        <GridCell
                            key={`${r}-${c}`}
                            row={r}
                            col={c}
                            value={cell.value}
                            isBlack={cell.isBlack}
                            number={cell.number}
                            isSolved={cell.isSolved}
                            teamId={cell.solvedByTeam}
                            isActive={activeCell && activeCell.r === r && activeCell.c === c}
                            cursors={getCursorsAt(r, c)}
                            onClick={handleCellClick}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

export default CrosswordGrid;
