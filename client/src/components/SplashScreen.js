import React, { useEffect, useRef, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
    // --- CONFIGURATION ZONE ---

    // Dynamically adjust grid based on viewport aspect ratio
    const isPortrait = window.innerHeight > window.innerWidth;

    // 1. Pixel Size: Adjust based on orientation
    // Portrait (mobile): 11 columns × 16 rows
    // Landscape (desktop/tablet): 16 columns × 11 rows
    const COLUMNS = isPortrait ? 11 : 16;
    const ROWS = isPortrait ? 16 : 11;

    // 2. Wave Speed: Time in ms between each ring.
    // Increased to 200ms to "reduce speed a bit"
    const WAVE_DELAY_MS = 200;

    // 3. Colors: Pink Palette
    const PALETTE = ['#D81B60', '#AD1457', '#880E4F', '#F06292', '#ec407a'];
    // ---------------------------

    // State to track if we are in "Exit" mode
    const [exiting, setExiting] = useState(false);

    // Generate the grid data once
    const pixels = React.useMemo(() => {
        const grid = [];
        const centerRow = ROWS / 2;
        const centerCol = COLUMNS / 2;
        const totalMaxDist = Math.sqrt(Math.pow(COLUMNS / 2, 2) + Math.pow(ROWS / 2, 2));

        for (let i = 0; i < COLUMNS * ROWS; i++) {
            const row = Math.floor(i / COLUMNS);
            const col = i % COLUMNS;

            // Distance Logic
            const deltaX = col - centerCol;
            const deltaY = row - centerRow;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // "Glitch Wave" Logic (Traveling Rings)
            // Ring Size: Adjusted to 3.5 to keep bands wide despite higher resolution
            const ringSize = 3.5;
            const band = Math.floor(dist / ringSize);

            // Bands 0 (Center) and 2 (Outer Ring) are visible.
            // Band 1 is the "Gap".
            const isVisible = (band % 2 === 0);

            let color = 'transparent';
            let popDelay = '0ms';

            if (isVisible) {
                color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                popDelay = `${dist * WAVE_DELAY_MS}ms`;
            }

            const exitDelay = dist * 100;

            grid.push({
                id: i,
                color: color,
                popDelay: popDelay,
                exitDelay: `${exitDelay}ms`,
                key: i
            });
        }
        return { grid, maxDelay: totalMaxDist * WAVE_DELAY_MS };
    }, []);

    useEffect(() => {
        const WAIT_TIME = 3000;
        const ANIMATION_DURATION = 600;

        // Trigger Exit
        const exitTimer = setTimeout(() => {
            setExiting(true);
        }, WAIT_TIME);

        // Completion
        const completeTimer = setTimeout(() => {
            if (onComplete) onComplete();
        }, WAIT_TIME + pixels.maxDelay + ANIMATION_DURATION + 500);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete, pixels.maxDelay]);

    return (
        <div className="splash-screen-container">
            <div
                id="pixel-canvas"
                style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}
            >
                {pixels.grid.map((p) => (
                    <div
                        key={p.key}
                        className={`pixel ${exiting ? 'exiting' : ''}`}
                        style={{
                            backgroundColor: p.color, // Initial color
                            '--pixel-color': p.color, // For CSS var usage
                            '--pop-delay': p.popDelay,
                            '--exit-delay': p.exitDelay
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export default SplashScreen;
