import React from 'react';

const GameLeaderboard = ({ scores = {}, players = [], mode }) => {

    // Process and Sort PLayers
    const leaderboardData = players.map(p => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        score: scores[p.id] || 0,
        // We don't track 'solved count' in scores object yet, but we could. For now omitting or keeping static 0
        solved: 0
    })).sort((a, b) => b.score - a.score);

    const getTeamClass = (teamId) => {
        if (!teamId) return '';
        return ['text-team-a', 'text-team-b', 'text-team-c', 'text-team-d'][teamId - 1]; // We need text color classes
    };

    // Helper: Map teamId to Color Name for reference
    // Actually, we should just use inline style or the class if we define text colors.
    // I'll use the border-color vars for text? Or just add inline styles.
    const getTeamStyle = (teamId) => {
        if (!teamId) return {};
        const colors = ['#ff007f', '#ffffff', '#888888', '#00ff00'];
        return { color: colors[teamId - 1] };
    };

    return (
        <div className="leaderboard-container">
            <div className="leaderboard-header">
                <div className="lb-col rank">#</div>
                <div className="lb-col name">Name</div>
                <div className="lb-col score">Score</div>
            </div>

            <div className="leaderboard-list">
                {leaderboardData.length === 0 && <div style={{ padding: '10px', textAlign: 'center', color: '#888' }}>Waiting for players...</div>}

                {leaderboardData.map((p, idx) => (
                    <div key={p.id} className="lb-row">
                        <div className="lb-col rank">{idx + 1}</div>
                        <div className="lb-col name" style={mode === 'Teams' ? getTeamStyle(p.teamId) : {}}>
                            {p.name} {mode === 'Teams' && p.teamId && `(Team ${String.fromCharCode(64 + p.teamId)})`}
                        </div>
                        <div className="lb-col score">{p.score} pts</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GameLeaderboard;
