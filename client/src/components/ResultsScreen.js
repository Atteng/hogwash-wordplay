import React from 'react';
import './ResultsScreen.css';

import homeIcon from '../assets/home_icon.png';
import restartIcon from '../assets/restart_icon.png';
import addIcon from '../assets/add_icon.png';
import fanfareFile from '../assets/fanfare.mp3';

const ResultsScreen = ({ socket, sessionId, onBackToMenu, scores = {}, wordsSolved = {}, sessionData, playerId }) => {
    const players = sessionData ? sessionData.players : [];
    const mode = sessionData ? sessionData.settings.mode : 'Competitive';
    const isHost = sessionData && sessionData.hostId === playerId;

    // Audio
    React.useEffect(() => {
        const audio = new Audio(fanfareFile);
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Fanfare blocked', e));
    }, []);

    // --- Data Processing ---
    let rankedResults = [];
    let myRank = '-';
    let myTeamRank = '-';

    if (mode === 'Teams') {
        // Group by Team
        const teams = {};
        players.forEach(p => {
            if (!p.teamId) return;
            if (!teams[p.teamId]) teams[p.teamId] = { id: p.teamId, score: 0, players: [] };
            teams[p.teamId].score += (scores[p.id] || 0);
            teams[p.teamId].players.push(p);
        });

        // Convert to Array & Sort
        const teamList = Object.values(teams).sort((a, b) => b.score - a.score);

        // Flatten for Display (Show players, but Rank is Team Rank?)
        // Or show Teams? User asked for "Your TEAM finished...".
        // Let's show Players but maybe grouped? Or just Standard Leaderboard but with Team Messaging?
        // Let's stick to Player Leaderboard for the table (as implemented before), 
        // BUT Calculate Team Rank for the Message.

        // Find My Team Rank
        const myPlayer = players.find(p => p.id === playerId);
        if (myPlayer && myPlayer.teamId) {
            const myTeamIndex = teamList.findIndex(t => t.id === myPlayer.teamId);
            myTeamRank = myTeamIndex + 1;
        }

        // Standard Player Ranking for Table
        rankedResults = players.map(p => ({
            id: p.id,
            name: p.name,
            score: scores[p.id] || 0,
            words: wordsSolved[p.id] || 0,
            isMe: p.id === playerId,
            teamId: p.teamId
        })).sort((a, b) => b.score - a.score).map((p, idx) => ({ ...p, rank: idx + 1 }));

        myRank = myTeamRank; // For the message, use Team Rank

    } else {
        // Individual
        rankedResults = players.map(p => ({
            id: p.id,
            name: p.name,
            score: scores[p.id] || 0,
            words: wordsSolved[p.id] || 0,
            isMe: p.id === playerId,
            teamId: null
        })).sort((a, b) => b.score - a.score).map((p, idx) => ({ ...p, rank: idx + 1 }));

        const myResult = rankedResults.find(p => p.isMe);
        myRank = myResult ? myResult.rank : '-';
    }

    // --- Action Handlers ---
    const handleHome = () => {
        if (isHost && socket) {
            // Close Session for everyone
            socket.emit('CMD_CLOSE_SESSION', { sessionId, requesterId: playerId });
        } else {
            // Just leave locally
            onBackToMenu();
        }
    };

    const handleRestart = () => {
        if (!isHost) return;
        if (socket) {
            socket.emit('CMD_RESTART_GAME', { sessionId, requesterId: playerId });
        }
    };

    const handleExtend = () => {
        if (!isHost) return;
        if (socket) {
            socket.emit('CMD_EXTEND_TIME', { sessionId, requesterId: playerId });
        }
    };

    // --- Helpers ---
    const getRankSuffix = (n) => {
        if (!n || isNaN(n)) return '';
        const j = n % 10, k = n % 100;
        if (j === 1 && k !== 11) return "st";
        if (j === 2 && k !== 12) return "nd";
        if (j === 3 && k !== 13) return "rd";
        return "th";
    };

    const getTeamStyle = (teamId) => {
        if (!teamId) return {};
        const colors = ['#ff007f', '#ffffff', '#CD853F', '#00ff00'];
        return { color: colors[teamId - 1] };
    };

    // --- Message Logic ---
    const getRankDescription = (rank, isTeam) => {
        if (isTeam) {
            if (rank === 1) return "Your collective brainpower has conquered the piggyverse";
            if (rank === 2) return "Your team builds bridges where others see walls";
            if (rank === 3) return "Seamless coordination led you to the podium";
            if (rank >= 4 && rank <= 10) return "Your team’s synergy is as efficient as a Superform route";
            if (rank >= 11 && rank <= 25) return "Good teamwork, but there’s still more alpha to harvest";
            return "Your team survived the wild; now it's time to scale the leaderboard";
        } else {
            if (rank === 1) return "You’ve achieved cross-piggy enlightenment";
            if (rank === 2) return "Did you write the Piggy bye-laws? Your DeFi IQ is officially off the charts";
            if (rank === 3) return "Oink. You navigate the Piggy ecosystem like a pro.";
            if (rank >= 4 && rank <= 10) return "You’re well on your way to scholar status";
            if (rank >= 11 && rank <= 20) return "Your knowledge is sloppy, read piggy docs thrice a day";
            return "The porktocracy is disappointed piglet!, do better next time";
        }
    };

    let mainMessage = "";
    const rankSuffix = getRankSuffix(myRank);
    const description = getRankDescription(myRank, mode === 'Teams');

    if (mode === 'Teams') {
        const teamText = `YOUR TEAM FINISHED ${myRank}${rankSuffix}`;
        mainMessage = `CONGRATS! ${teamText}, ${description.toUpperCase()}`;
    } else {
        const playerText = `YOU FINISHED ${myRank}${rankSuffix}`;
        mainMessage = `CONGRATS! ${playerText}, ${description.toUpperCase()}`;
    }

    let displayList = rankedResults.slice(0, 10);
    // Ensure 'Me' is visible
    if (!displayList.find(p => p.isMe)) {
        const me = rankedResults.find(p => p.isMe);
        if (me) displayList.push(me);
    }

    return (
        <div className="results-screen fade-in">
            {/* Header Section */}
            <div className="results-header">
                <h1 className="game-over-title">GAME OVER</h1>
                <p className="congrats-text">
                    {mainMessage}
                </p>

                {/* Action Icons */}
                <div className="result-actions">
                    <button className="icon-btn" onClick={handleHome} title={isHost ? "Close Session" : "Leave"}>
                        <img src={homeIcon} alt="Home" />
                    </button>

                    {/* Host Only Actions */}
                    <button
                        className={`icon-btn ${!isHost ? 'disabled' : ''}`}
                        onClick={handleRestart}
                        title="Restart Game"
                        disabled={!isHost}
                        style={{ opacity: isHost ? 1 : 0.5, cursor: isHost ? 'pointer' : 'not-allowed' }}
                    >
                        <img src={restartIcon} alt="Restart" />
                    </button>

                    <button
                        className={`icon-btn ${!isHost ? 'disabled' : ''}`}
                        onClick={handleExtend}
                        title="Extend Time (+5m)"
                        disabled={!isHost}
                        style={{ opacity: isHost ? 1 : 0.5, cursor: isHost ? 'pointer' : 'not-allowed' }}
                    >
                        <img src={addIcon} alt="Extend" />
                    </button>
                </div>
            </div>

            {/* Main Content: Table Centered */}
            <div className="results-content">
                {/* Leaderboard Table */}
                <div className="results-leaderboard-container">
                    <div className="table-header">
                        <div className="col rank">Rank</div>
                        <div className="col name">Name</div>
                        <div className="col score">Score</div>
                        <div className="col score">Words</div>
                    </div>

                    <div className="table-body">
                        {displayList.map((player) => (
                            <div
                                key={player.id}
                                className={`table-row ${player.isMe ? 'highlight' : ''}`}
                            >
                                <div className="col rank" style={player.isMe ? { color: '#D81B60' } : {}}>
                                    {player.rank}{getRankSuffix(player.rank)}
                                </div>
                                <div
                                    className="col name"
                                    style={mode === 'Teams' ? getTeamStyle(player.teamId) : (player.isMe ? { color: '#D81B60' } : {})}
                                >
                                    {player.name} {mode === 'Teams' && `(T${String.fromCharCode(64 + player.teamId)})`}
                                </div>
                                <div className={`col score ${player.isMe ? 'text-pink' : ''}`}>
                                    {player.score}
                                </div>
                                <div className={`col score ${player.isMe ? 'text-pink' : ''}`}>
                                    {player.words}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsScreen;
