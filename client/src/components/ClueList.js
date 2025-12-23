import React, { useState } from 'react';

const ClueList = ({ clues = [] }) => {
    const [activeTab, setActiveTab] = useState('ACROSS');

    // Filter Clues by Direction
    const acrossClues = clues.filter(c => c.direction === 'ACROSS').sort((a, b) => a.number - b.number);
    const downClues = clues.filter(c => c.direction === 'DOWN').sort((a, b) => a.number - b.number);

    const displayList = activeTab === 'ACROSS' ? acrossClues : downClues;

    return (
        <div className="clue-box">
            <div className="clue-tabs">
                <button
                    className={`clue-tab ${activeTab === 'DOWN' ? 'active' : ''}`}
                    onClick={() => setActiveTab('DOWN')}
                >
                    Down
                </button>
                <button
                    className={`clue-tab ${activeTab === 'ACROSS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ACROSS')}
                >
                    Across
                </button>
            </div>

            <div className="clue-list">
                {displayList.length === 0 && <div className="clue-item">No clues found.</div>}

                {displayList.map((clue, idx) => (
                    <div key={idx} className="clue-item">
                        {clue.number}. {clue.clue}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClueList;
