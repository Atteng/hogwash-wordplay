import React, { useState } from 'react';
import './LobbyScreen.css';
import copyIcon from '../assets/copy_icon.png';

const LobbyScreen = ({
    sessionData,
    playerId,
    onStartGame,
    onGoBack,
    socket
}) => {
    // Fallback if sessionData is momentarily null (shouldn't happen due to conditional render)
    const data = sessionData || {
        hostId: 'unknown',
        players: [],
        settings: { timeLimit: 600, mode: 'COMPETITIVE' },
        id: '??????',
        teams: []
    };

    const hostPlayer = data.players.find(p => p.isHost);
    const hostName = hostPlayer ? hostPlayer.name : 'Unknown';
    const isHost = playerId === data.hostId;
    const isTeamsMode = data.settings.mode === 'Teams';

    // Player List
    const playerNames = data.players.map(p => p.name.toUpperCase());

    // Find My Player Data
    const myPlayer = data.players.find(p => p.id === playerId);
    const selectedTeamId = myPlayer ? myPlayer.teamId : null;

    // Team Logic (Use Server Data)
    const teams = data.teams || [];

    const handleTeamSelect = (teamId) => {
        // Find team to check capacity locally (optional, server also checks)
        const team = teams.find(t => t.id === teamId);
        if (team && team.players.length >= team.maxPlayers && teamId !== selectedTeamId) {
            alert(`Team ${team.name} is full.`);
            return;
        }

        // Emit Command
        if (socket && data.id) {
            socket.emit('CMD_JOIN_TEAM', { sessionId: data.id, teamId });
        }
    };

    return (
        <div className="lobby-overlay fade-in">
            <div className="lobby-container">
                {/* Header */}
                <div className="lobby-header">
                    <h1>WAITING LOBBY</h1>
                </div>

                {/* Session Info Grid */}
                <div className="session-info-grid">
                    <div className="info-field">
                        <label>Session Host</label>
                        <input type="text" value={hostName} readOnly />
                    </div>
                    <div className="info-field">
                        <label>Time Duration</label>
                        <input type="text" value={`${Math.floor(data.settings.timeLimit / 60)} Minutes`} readOnly />
                    </div>
                    <div className="info-field">
                        <label>Player Count</label>
                        <input
                            type="text"
                            value={`${data.players.length} Players`}
                            readOnly
                        />
                    </div>
                    <div className="info-field">
                        <label>Game Mode</label>
                        <input type="text" value={data.settings.mode} readOnly />
                    </div>
                    <div className="info-field session-id-field">
                        <label>Session ID</label>
                        <div className="session-id-wrapper">
                            <input type="text" value={data.id} readOnly />
                            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(data.id)}>
                                <img
                                    src={copyIcon}
                                    alt="Copy"
                                    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Team Selection (only for Teams mode) */}
                {isTeamsMode && (
                    <div className="team-selection">
                        <h3>SELECT YOUR TEAM</h3>
                        <div className="teams-grid">
                            {teams.length === 0 ? (
                                <div className="loading-teams">Loading Teams...</div>
                            ) : (
                                teams.map((team, idx) => {
                                    // Map index/id to team-a, team-b...
                                    // team.id is 1-based usually
                                    const colorClass = ['team-a', 'team-b', 'team-c', 'team-d'][idx % 4];

                                    return (
                                        <div
                                            key={team.id}
                                            className={`team-card ${colorClass} ${selectedTeamId === team.id ? 'selected' : ''} ${team.players.length >= team.maxPlayers ? 'full' : ''}`}
                                            onClick={() => handleTeamSelect(team.id)}
                                        >
                                            <div className="team-name">{team.name}</div>
                                            <div className="team-count">
                                                {team.players.length}/{team.maxPlayers} Players
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Joined Players List */}
                <div className="players-section">
                    <div className="players-header">
                        JOINED PLAYERS ({playerNames.length}/30)
                    </div>
                    <div className="players-list">
                        {playerNames.map((player, index) => (
                            <span key={index} className="player-tag">
                                {player}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="lobby-footer">
                    {isHost && (
                        <button
                            className="action-btn primary"
                            onClick={onStartGame}
                            disabled={playerNames.length < 2}
                        >
                            START GAME
                        </button>
                    )}
                    <button className="action-btn secondary" onClick={onGoBack}>
                        GO BACK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LobbyScreen;
