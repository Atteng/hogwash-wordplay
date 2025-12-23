import React from 'react';
import './GameScreen.css';

// Assets
import soundIcon from '../assets/sound_icon.png';
import homeIcon from '../assets/home_icon.png';
import infoIcon from '../assets/info_icon.png';
import themeIcon from '../assets/theme_icon.png';
import lbIcon from '../assets/lb_icon.png';

const GameHeader = ({ time = "00:00:17", hintsLeft = 5, onThemeClick, onLeaderboardClick, onHintClick, onHomeClick, isMuted, onToggleMute }) => {
    return (
        <div className="game-header">
            <div className="header-left">
                <div className="time-badge">
                    <span className="badge-label">Time</span>
                    <span className="badge-value">{time}</span>
                </div>

                <div className="hint-badge">
                    <span className="badge-label">Hint</span>
                    <span className="badge-value">{hintsLeft} Left</span>
                </div>
            </div>

            <div className="header-right">
                <button className="icon-btn mobile-only-btn" title="Leaderboard" onClick={onLeaderboardClick}>
                    <img src={lbIcon} alt="Leaderboard" />
                </button>
                <button className="icon-btn" title="Sound" onClick={onToggleMute} style={{ opacity: isMuted ? 0.3 : 1 }}>
                    <img src={soundIcon} alt="Sound" />
                </button>
                <button className="icon-btn" title="Home/Leave" onClick={onHomeClick}><img src={homeIcon} alt="Home" /></button>
                <button className="icon-btn" title="Info/Hint" onClick={onHintClick}><img src={infoIcon} alt="Hint" /></button>
                <button className="icon-btn" title="Theme" onClick={null} style={{ opacity: 0.5, cursor: 'default' }}><img src={themeIcon} alt="Theme" /></button>
            </div>
        </div>
    );
};

export default GameHeader;
