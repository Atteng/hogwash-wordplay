# Game Design Document (As-Built)
*Hogwash Wordplay*

## 1. Overview
**Real-Time Crossword Game** where players race to solve grids. Built with React (Client) and Node.js/Socket.io (Server).
- **Players**: 1 to 30+.
- **Timing**: Configurable (Default 10 mins). Host can extend time by 5 mins.
- **End Game**: Time runs out or Grid completed.

## 2. Game Modes
### A. Competitive (Default)
-   **Isolation**: Each player has their own private grid.
-   **Goal**: Solve the most words for the highest score.
-   **Visuals**: Pink styling.

### B. Co-op
-   **Shared Grid**: All players work on the *exact same* grid in real-time.
-   **Cursors**: See other players' selection cursors.
-   **Goal**: Solve the grid together.

### C. Teams (Territory Mode)
-   **Shared Board**: All teams play on one global grid.
-   **Fog of War**: Typed letters are local/hidden until a valid word is completed.
-   **Capture**: First team to complete a valid word "captures" those cells (permanently colored in Team Color).
-   **Scoring**: Points go to the team that captures the word.

## 3. Scoring & Stats
### Scoring Formula
`Score = (WordLength * 2) - HintsUsed`
-   **Length**: Longer words = More points.
-   **Hints**: Each hint used on a word reduces the potential score (or global hint count reduces score? Implemented as direct deduction or tracking).
-   **Current Impl**: Hints tracked globally per player/session. Score is purely added based on word completion. Hints are limited (20 default).

### Statistics
-   **Score**: Primary metric.
-   **Words Solved**: Tracked per player/team. displayed in Results table.
-   **Rank**: Calculated dynamically.

## 4. Audio System
-   **Theme Music**: Plays on loop (Volume 0.5 in Menus, 0.1 in Game).
-   **Effects**:
    -   `Click`: Grid interaction.
    -   `Hint`: using a hint.
    -   `Correct`: "Ding" when score increases (word solved).
    -   `Heartbeat`: Loop when Time <= 30s.
    -   `Fanfare`: Results screen entry.
-   **Controls**: Global Mute button in Game Header (persists across screens).

## 5. UI & UX
-   **Glassmorphism**: Heavy use of `backdrop-filter` and translucent layers.
-   **Responsive**:
    -   **Mobile**: Stacked layouts, sticky inputs, pinch-zoom grid.
    -   **Desktop**: Three-panel layout (Grid | Info | Leaderboard).
-   **Custom Results Messages**:
    -   **Teams**: "Your collective brainpower...", "Builds bridges...", etc.
    -   **Individual**: "Cross-piggy enlightenment", "DeFi IQ...", etc.

## 6. Technical Architecture
### Persistence (Reconnection)
-   **IDs**: `PlayerID` (UUID) is decoupled from `SocketID`.
-   **Storage**: `localStorage` saves `sessionId` and `playerId`.
-   **Logic**: On page refresh, app checks storage and emits `CMD_REJOIN_SESSION`.
-   **State Restoration**: Server sends full Session Data + Grid State immediately upon rejoin.

### Architecture
-   **Server**: Node.js + Express + Socket.io.
    -   `SessionManager`: Handles Rooms, Players, Reconnection.
    -   `GameManager`: Handles Game Loop, Grid Logic, Team Sync.
-   **Client**: React.
    -   `App.js`: Router & Audio Manager.
    -   `GameScreen`: Main logic hub.
-   **Deployment**:
    -   Server: Render.com (Web Service).
    -   Client: Vercel (Static Site) via `process.env.REACT_APP_SERVER_URL`.

## 7. Configuration
-   **Custom Words**: Host can input custom words to generate unique grids.
-   **Difficulty**: Adjusts grid density/clues (Conceptual).
-   **Time Limit**: Configurable via Onboarding slider.
