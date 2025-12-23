import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

// Assets
import themeMusicFile from './assets/Theme Music.mp3';

// Components
import SplashScreen from './components/SplashScreen';
import MenuScreen from './components/MenuScreen';
import OnboardingScreen from './components/OnboardingScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
const socket = io(SERVER_URL);

function App() {
    const [serverStatus, setServerStatus] = useState('Connecting...');
    const [currentScreen, setCurrentScreen] = useState('SPLASH'); // SPLASH, MENU, ONBOARDING, LOBBY, GAME, RESULTS
    const [bgImage, setBgImage] = useState('menu-background.jpg');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [onboardingTab, setOnboardingTab] = useState('CREATE');
    const [isBgReady, setIsBgReady] = useState(false);

    // Session State
    const [sessionId, setSessionId] = useState(null);
    const [playerId, setPlayerId] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [finalScores, setFinalScores] = useState({});
    const [finalWordsSolved, setFinalWordsSolved] = useState({});

    // Audio State
    const [themeAudio] = useState(new Audio(themeMusicFile));
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        themeAudio.loop = true;
        themeAudio.volume = 0.5;
        const playAudio = () => {
            themeAudio.play().catch(e => console.log("Audio autoplay blocked:", e));
        };
        // Attempt to play on first click
        document.addEventListener('click', playAudio, { once: true });

        return () => {
            themeAudio.pause();
            document.removeEventListener('click', playAudio);
        };
    }, [themeAudio]);

    // Volume Control based on Screen + Mute
    useEffect(() => {
        themeAudio.muted = isMuted;
        if (currentScreen === 'GAME') {
            themeAudio.volume = isMuted ? 0 : 0.1;
        } else {
            themeAudio.volume = isMuted ? 0 : 0.5;
        }
    }, [currentScreen, themeAudio, isMuted]);

    // Socket connection & Global Event Listeners
    useEffect(() => {
        socket.on('connect', () => {
            setServerStatus('Connected');
            // Attempt Rejoin if data exists
            const savedSessionId = localStorage.getItem('hw_sessionId');
            const savedPlayerId = localStorage.getItem('hw_playerId');
            if (savedSessionId && savedPlayerId) {
                console.log("Attempting to Rejoin session:", savedSessionId);
                socket.emit('CMD_REJOIN_SESSION', { sessionId: savedSessionId, playerId: savedPlayerId });
            }
        });
        socket.on('disconnect', () => setServerStatus('Disconnected'));

        // --- Session Events ---
        socket.on('RES_SESSION_CREATED', (data) => {
            console.log('Session Created:', data);
            setSessionId(data.sessionId);
            setPlayerId(data.playerId);
            setSessionData(data.session);

            // Persist
            localStorage.setItem('hw_sessionId', data.sessionId);
            localStorage.setItem('hw_playerId', data.playerId);

            // Single Player: Skip Lobby, Start Immediately
            if (data.session.settings.mode === 'Single Player') {
                socket.emit('CMD_START_GAME', { sessionId: data.sessionId });
            } else {
                setCurrentScreen('LOBBY'); // Server says we are in!
            }
        });

        socket.on('RES_SESSION_JOINED', (data) => {
            console.log('Session Joined:', data);
            setSessionId(data.sessionId);
            setPlayerId(data.playerId);
            setSessionData(data.session);

            localStorage.setItem('hw_sessionId', data.sessionId);
            localStorage.setItem('hw_playerId', data.playerId);

            setCurrentScreen('LOBBY'); // Server says we are in!
        });

        socket.on('EVT_SESSION_UPDATE', (data) => {
            console.log('Session Update:', data);
            setSessionData(data.session);
            // If game status changes, we could auto-switch screens here too
            if (data.session.status === 'GAME' && currentScreen !== 'GAME' && currentScreen !== 'RESULTS') { // Avoid auto-switch if already in results unless resumed
                setCurrentScreen('GAME');
                setBgImage('menu-background3.jpg');
            }
        });

        socket.on('EVT_GAME_RESUMED', () => {
            setCurrentScreen('GAME');
            setBgImage('menu-background3.jpg');
        });

        socket.on('EVT_SESSION_CLOSED', () => {
            // Host closed it. Go to Menu/Onboarding.
            setSessionId(null);
            setSessionData(null);
            localStorage.removeItem('hw_sessionId');
            localStorage.removeItem('hw_playerId');
            setCurrentScreen('ONBOARDING');
            alert("Session Closed by Host.");
        });

        socket.on('ERR_SESSION', (err) => {
            if (err.code === 'REJOIN_FAILED') {
                localStorage.removeItem('hw_sessionId');
                localStorage.removeItem('hw_playerId');
            }
            alert(`Error: ${err.msg}`);
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('RES_SESSION_CREATED');
            socket.off('RES_SESSION_JOINED');
            socket.off('EVT_SESSION_UPDATE');
            socket.off('EVT_GAME_RESUMED');
            socket.off('EVT_SESSION_CLOSED');
            socket.off('ERR_SESSION');
        };
    }, [currentScreen]);

    // Background image preloader
    useEffect(() => {
        setIsBgReady(false);
        const img = new Image();
        img.src = `${process.env.PUBLIC_URL}/assets/${bgImage}`;
        img.onload = () => {
            setTimeout(() => setIsBgReady(true), 100);
        };
        img.onerror = () => {
            console.error(`Failed to load background: ${bgImage}`);
            setIsBgReady(true);
        };
    }, [bgImage]);

    // Navigation Handlers
    const handleSplashComplete = () => {
        setCurrentScreen('MENU');
        setBgImage('menu-background.jpg');
    };

    const handleStartOnboarding = (tab = 'CREATE') => {
        setIsTransitioning(true);
        setOnboardingTab(tab);
        setTimeout(() => {
            setCurrentScreen('ONBOARDING');
            setBgImage('menu-background2.jpg');
            setIsTransitioning(false);
        }, 800);
    };

    // Actions triggering Server Commands
    const handleCreateSession = (playerName, mode, words, timeLimit, numTeams) => {
        console.log('App: Creating session...', { playerName, mode, words, timeLimit, numTeams });
        socket.emit('CMD_CREATE_SESSION', {
            playerName,
            settings: { mode, customWords: words, timeLimit, numTeams }
        });
    };

    const handleJoinSession = (code, playerName) => {
        socket.emit('CMD_JOIN_SESSION', {
            sessionId: code,
            playerName
        });
    };

    const handleStartGame = () => {
        // Host only triggers this
        if (sessionId) {
            socket.emit('CMD_START_GAME', { sessionId });
        }
    };

    const handleGameEnd = (scores, wordsSolved) => {
        setFinalScores(scores || {});
        setFinalWordsSolved(wordsSolved || {});
        setCurrentScreen('RESULTS');
        setBgImage('menu-background4.jpg');
    };

    const handleBackToOnboarding = () => {
        if (sessionId) {
            socket.emit('CMD_LEAVE_SESSION');
            setSessionId(null);
            setPlayerId(null);
            setSessionData(null);
        }
        setCurrentScreen('ONBOARDING');
    };

    const handleBackToMenu = () => {
        // Cleanup if in session
        if (sessionId) {
            socket.emit('CMD_LEAVE_SESSION');
            setSessionId(null);
            setPlayerId(null);
            setSessionData(null);
        }
        setCurrentScreen('MENU');
        setBgImage('menu-background.jpg');
    };

    return (
        <div className="App">
            {/* Real background div */}
            <div
                className="app-background"
                style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/assets/${bgImage})` }}
            />

            <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '10px', padding: '5px', opacity: 0.5, color: '#fff', zIndex: 100 }}>
                Server: {serverStatus}
            </div>

            {currentScreen === 'SPLASH' && <SplashScreen onComplete={handleSplashComplete} />}

            {/* Only show these screens if BG is ready */}
            {isBgReady && (
                <>
                    {currentScreen === 'MENU' && <MenuScreen onStartOnboarding={handleStartOnboarding} isExiting={isTransitioning} />}
                    {currentScreen === 'ONBOARDING' && (
                        <OnboardingScreen
                            onCancel={handleBackToMenu}
                            initialTab={onboardingTab}
                            onCreateSession={handleCreateSession}
                            onJoinSession={handleJoinSession}
                        />
                    )}
                    {currentScreen === 'LOBBY' && (
                        <LobbyScreen
                            sessionData={sessionData}
                            playerId={playerId}
                            onStartGame={handleStartGame}
                            onGoBack={handleBackToOnboarding}
                            socket={socket}
                        />
                    )}
                    {currentScreen === 'GAME' && <GameScreen socket={socket} sessionId={sessionId} sessionData={sessionData} playerId={playerId} onGameEnd={handleGameEnd} onLeaveSession={handleBackToMenu} isMuted={isMuted} toggleMute={() => setIsMuted(!isMuted)} />}
                    {currentScreen === 'RESULTS' && <ResultsScreen socket={socket} sessionId={sessionId} scores={finalScores} wordsSolved={finalWordsSolved} sessionData={sessionData} playerId={playerId} onBackToMenu={handleBackToMenu} />}
                </>
            )}
        </div>
    );
}

export default App;