import React, { useState } from 'react';
import './OnboardingScreen.css';

const OnboardingScreen = ({ onFinish, onCancel, initialTab = 'CREATE', onCreateSession, onJoinSession }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [username, setUsername] = useState('Crouton');
    const [timer, setTimer] = useState('10 Minutes');
    const [gameMode, setGameMode] = useState('Competitive');
    const [numTeams, setNumTeams] = useState(2);
    const [sessionId, setSessionId] = useState('');

    const [wordInput, setWordInput] = useState('');

    const handleAction = () => {
        if (!username) {
            alert('Please enter a username');
            return;
        }

        if (activeTab === 'CREATE') {
            // Validate Words
            const lines = wordInput.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 5) {
                alert(`Please enter at least 5 words. (Current: ${lines.length})`);
                return;
            }
            if (lines.length > 30) {
                alert(`Too many words! Max 30. (Current: ${lines.length})`);
                return;
            }

            // Optional: Basic format check (WORD|Clue)
            const parsedWords = lines.map(line => {
                const parts = line.split('|');
                if (parts.length < 2) return null;
                return { word: parts[0].trim().toUpperCase(), clue: parts[1].trim() };
            });

            if (parsedWords.includes(null)) {
                alert('Invalid format. Use: WORD|Clue (check for missing |)');
                return;
            }

            console.log('Validation passed. Creating session with words:', parsedWords);

            // Parse Timer ("10 Minutes" -> 600)
            const timeLimit = parseInt(timer.split(' ')[0]) * 60;

            onCreateSession(username, gameMode, parsedWords, timeLimit, numTeams);
        } else {
            if (!sessionId) {
                alert('Please enter a Session ID');
                return;
            }
            onJoinSession(sessionId, username);
        }
    };

    const modes = {
        'Competitive': 'Players compete against one another based on speed and accuracy.',
        'Co-Op': 'All players solve a single shared grid (with a team limit on hints).',
        'Teams': 'Players compete against each other as teams on a shared boards and "Fog of War" mechanics.',
        'Single Player': 'A "Zen mode" for solo practice.'
    };

    return (
        <div className="session-menu-overlay fade-in">
            <div className="session-menu-container">
                {/* Tab Header */}
                <div className="tab-header">
                    <button
                        className={`tab-btn ${activeTab === 'CREATE' ? 'active' : ''}`}
                        onClick={() => setActiveTab('CREATE')}
                    >
                        CREATE SESSION
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'JOIN' ? 'active' : ''}`}
                        onClick={() => setActiveTab('JOIN')}
                    >
                        JOIN SESSION
                    </button>
                </div>

                <div className={`session-content ${activeTab === 'CREATE' ? 'create-layout' : 'join-layout'}`}>
                    {activeTab === 'CREATE' ? (
                        <>
                            {/* CREATE TAB: TWO COLUMN LAYOUT */}
                            <div className="form-column">
                                <div className="row-inputs-all">
                                    <div className="input-group">
                                        <label>Your Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter Username"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Timer Duration</label>
                                        <select value={timer} onChange={(e) => setTimer(e.target.value)}>
                                            <option>5 Minutes</option>
                                            <option>10 Minutes</option>
                                            <option>15 Minutes</option>
                                            <option>30 Minutes</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Game Mode</label>
                                        <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                                            <option>Competitive</option>
                                            <option>Co-Op</option>
                                            <option>Teams</option>
                                            <option>Single Player</option>
                                        </select>
                                    </div>

                                    {/* Team Count Selector (Only for Teams Mode) */}
                                    {gameMode === 'Teams' && (
                                        <div className="input-group fadeIn">
                                            <label>Number of Teams</label>
                                            <select value={numTeams} onChange={(e) => setNumTeams(parseInt(e.target.value))}>
                                                <option value={2}>2 Teams</option>
                                                <option value={3}>3 Teams</option>
                                                <option value={4}>4 Teams</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="input-group">
                                    <label>Word & Clues</label>
                                    <textarea
                                        placeholder="WORD|Clue (One Per Line)&#10;Min: 5 Words, Max 30 Words"
                                        rows="12"
                                        value={wordInput}
                                        onChange={(e) => setWordInput(e.target.value)}
                                    ></textarea>
                                    <span className="helper-text">Format: WORD|Clue (One Per Line) | Min: 5 Words, Max 30 Words</span>
                                </div>
                            </div>

                            <div className="info-column">
                                <div className="info-box dark-glass">
                                    <div className="info-header">Mode Description</div>
                                    <div className="info-body">
                                        {Object.entries(modes).map(([name, desc]) => (
                                            <p key={name}>
                                                <strong>{name}:</strong> {desc}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* JOIN TAB: HORIZONTAL LAYOUT */}
                            <div className="form-section">
                                <div className="row-inputs">
                                    <div className="input-group">
                                        <label>Your Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter Username"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Session ID</label>
                                        <input
                                            type="text"
                                            value={sessionId}
                                            onChange={(e) => setSessionId(e.target.value)}
                                            placeholder="Enter Session ID Provided by your Host"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="info-section">
                                <div className="info-banner dark-glass">
                                    <div className="info-banner-content">
                                        <div className="info-header">Getting Familiar with Hogwash</div>
                                        <p className="intro-text">Depending on your Session Host, there are various multiplayer options to choose from. Below is a list so you get a preview. On the Next Page (Lobby), you'll get to know the Specific Game Mode Picked</p>
                                        <div className="info-grid-horizontal">
                                            {Object.entries(modes).filter(([k]) => k !== 'Single Player').map(([name, desc]) => (
                                                <div key={name} className="info-item-horiz">
                                                    <strong>{name}:</strong> {desc}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="info-banner-mascot">
                                        <img src={`${process.env.PUBLIC_URL}/assets/Mascot.PNG`} alt="Mascot" />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="session-footer">
                    <button className="action-btn primary" onClick={handleAction}>
                        {activeTab === 'CREATE' ? 'CREATE NEW GAME' : 'JOIN GAME'}
                    </button>
                    <button className="action-btn secondary" onClick={onCancel}>
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingScreen;
