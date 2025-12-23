import React from 'react';
import './MenuScreen.css';

const MenuScreen = ({ onStartOnboarding, isExiting }) => {
    return (
        <div className={`menu-screen ${isExiting ? 'fade-out' : ''}`}>
            <div className={`menu-content ${isExiting ? 'exit-slide-down' : ''}`}>
                <div className="menu-brand">
                    <h1 className="menu-title">Hogwash Wordplay</h1>
                </div>

                <div className="menu-actions">
                    <button className="menu-btn primary" onClick={() => onStartOnboarding('CREATE')}>
                        Create Session
                    </button>
                    <button className="menu-btn secondary" onClick={() => onStartOnboarding('JOIN')}>
                        Join Session
                    </button>
                    <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '1rem' }}>
                        v1.0.0-beta
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MenuScreen;
