import React, { useState, useEffect } from 'react';
import './GameScreen.css';

// Components
import GameHeader from './GameHeader';
import CrosswordGrid from './CrosswordGrid';
import GameLeaderboard from './GameLeaderboard';
import ClueList from './ClueList';

// Assets
import clickSoundFile from '../assets/click.mp3';
import hintSoundFile from '../assets/hint.mp3';
import correctSoundFile from '../assets/correct.mp3';
import heartbeatSoundFile from '../assets/heartbeat.mp3';

const GameScreen = ({ socket, sessionId, sessionData, onGameEnd, onLeaveSession, isMuted, toggleMute, playerId }) => {
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(600); // 10 mins default
    const [grid, setGrid] = useState([]);
    const [clues, setClues] = useState([]);
    const [cursors, setCursors] = useState({});
    const [scores, setScores] = useState({});
    const [hintsUsed, setHintsUsed] = useState(0);

    // Audio
    const [clickAudio] = useState(new Audio(clickSoundFile));
    const [hintAudio] = useState(new Audio(hintSoundFile));
    const [correctAudio] = useState(new Audio(correctSoundFile));
    const [heartbeatAudio] = useState(new Audio(heartbeatSoundFile));

    useEffect(() => {
        heartbeatAudio.loop = true;
        return () => { heartbeatAudio.pause(); };
    }, [heartbeatAudio]);

    useEffect(() => {
        if (!socket || !sessionId) return;

        // Request initial state (in case we joined after start or refreshed)
        socket.emit('CMD_REQUEST_GAME_STATE', { sessionId });

        socket.on('EVT_GAME_TICK', (data) => {
            setTimeRemaining(data.timeRemaining);

            // Heartbeat Logic
            if (data.timeRemaining <= 30 && data.timeRemaining > 0) {
                if (!isMuted) heartbeatAudio.play().catch(e => { });
                else heartbeatAudio.pause();
            } else {
                heartbeatAudio.pause();
                heartbeatAudio.currentTime = 0;
            }

            if (data.cursors) setCursors(data.cursors);

            // Score Change Detection (Correct Sound)
            if (data.scores) {
                // Check if MY score increased
                setScores(prev => {
                    // Use playerId for lookup
                    if (playerId) {
                        const old = prev[playerId] || 0;
                        const newScore = data.scores[playerId] || 0;
                        if (newScore > old && !isMuted) correctAudio.play().catch(e => { });
                    }
                    return data.scores;
                });
            } else {
                if (data.scores) setScores(data.scores);
            }

            if (data.hintsUsed && playerId) {
                const count = data.hintsUsed[playerId] || 0;
                setHintsUsed(count);
            }
        });

        socket.on('EVT_GRID_UPDATE', (data) => {
            setGrid(data.grid);
            if (data.clues) setClues(data.clues);
        });

        socket.on('EVT_GAME_OVER', (data) => {
            alert(data.message);
            onGameEnd(data.scores, data.wordsSolved);
        });

        return () => {
            socket.off('EVT_GAME_TICK');
            socket.off('EVT_GRID_UPDATE');
            socket.off('EVT_GAME_OVER');
        };
    }, [socket, sessionId, onGameEnd, isMuted, correctAudio, heartbeatAudio, playerId]); // Added deps

    // Format Seconds into MM:SS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleHintRequest = () => {
        if (!isMuted) hintAudio.play().catch(e => { });
        if (socket && sessionId) {
            socket.emit('CMD_REQUEST_HINT', { sessionId });
        }
    };

    const handleHome = () => {
        if (onLeaveSession) onLeaveSession();
    };

    return (
        <div className="game-screen fade-in">
            <GameHeader
                time={formatTime(timeRemaining)}
                hintsLeft={(sessionData?.settings?.hintLimit || 20) - hintsUsed}
                onThemeClick={onGameEnd} // Debug/Dev
                onLeaderboardClick={() => setShowLeaderboard(true)}
                onHintClick={handleHintRequest}
                onHomeClick={handleHome}
                isMuted={isMuted}
                onToggleMute={toggleMute}
            />

            <div className="game-content">
                {/* Left: Grid Area */}
                <div className="game-grid-area">
                    <CrosswordGrid
                        grid={grid}
                        cursors={cursors}
                        socket={socket}
                        sessionId={sessionId}
                        onCellClick={() => { if (!isMuted) clickAudio.play().catch(e => { }) }}
                    />
                </div>

                {/* Right: Info Panel (Leaderboard + Clues) */}
                <div className="game-info-panel">
                    <GameLeaderboard
                        scores={scores}
                        players={sessionData ? sessionData.players : []}
                        mode={sessionData ? sessionData.settings.mode : 'Competitive'}
                    />
                    <ClueList clues={clues} />
                </div>
            </div>

            {/* Mobile Leaderboard Popup */}
            {showLeaderboard && (
                <div className="leaderboard-popup-overlay" onClick={() => setShowLeaderboard(false)}>
                    <div className="leaderboard-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header">
                            <h3>LEADERBOARD</h3>
                            <button className="close-btn" onClick={() => setShowLeaderboard(false)}>×</button>
                        </div>
                        <GameLeaderboard
                            scores={scores}
                            players={sessionData ? sessionData.players : []}
                            mode={sessionData ? sessionData.settings.mode : 'Competitive'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameScreen;
