class GridGenerator {
    constructor(words, width = 15, height = 15) {
        this.words = words; // Array of { word: "HELLO", clue: "Greeting" }
        this.width = width;
        this.height = height;
        this.grid = this.createEmptyGrid();
        this.placements = [];
        this.skipped = [];
    }

    createEmptyGrid() {
        return Array(this.height).fill(null).map(() => Array(this.width).fill(null));
    }

    generate() {
        // 1. Sort words by length
        const sortedWords = [...this.words].sort((a, b) => b.word.length - a.word.length);

        // 2. Clear state
        this.grid = this.createEmptyGrid();
        this.placements = [];
        this.skipped = [];

        // 3. Greedy Placement
        this.placeWordsGreedy(sortedWords);

        return this.compileGrid();
    }

    placeWordsGreedy(wordList) {
        if (wordList.length === 0) return;

        const currentWordObj = wordList[0];
        const remainingWords = wordList.slice(1);
        const word = currentWordObj.word;
        let placed = false;

        // A. If Empty Grid -> Center 1st Word
        if (this.placements.length === 0) {
            const startX = Math.floor((this.width - word.length) / 2);
            const startY = Math.floor(this.height / 2);

            if (this.canPlace(word, startX, startY, 'ACROSS')) {
                this.addWordToGrid(currentWordObj, startX, startY, 'ACROSS');
                placed = true;
            } else if (this.canPlace(word, Math.floor(this.width / 2), Math.floor((this.height - word.length) / 2), 'DOWN')) {
                this.addWordToGrid(currentWordObj, Math.floor(this.width / 2), Math.floor((this.height - word.length) / 2), 'DOWN');
                placed = true;
            }

        } else {
            // B. Find Intersection
            // Iterate all cells to find valid intersection
            // We want to stop at the FIRST valid placement to be fast/greedy
            // (Or iterate all and pick 'best', but first valid is fine for now)

            outerLoop:
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const cell = this.grid[y][x];
                    if (cell) {
                        for (let i = 0; i < word.length; i++) {
                            if (word[i] === cell.char) {
                                // Try ACROSS
                                const startX_A = x - i;
                                const startY_A = y;
                                if (this.canPlace(word, startX_A, startY_A, 'ACROSS')) {
                                    this.addWordToGrid(currentWordObj, startX_A, startY_A, 'ACROSS');
                                    placed = true;
                                    break outerLoop;
                                }

                                // Try DOWN
                                const startX_D = x;
                                const startY_D = y - i;
                                if (this.canPlace(word, startX_D, startY_D, 'DOWN')) {
                                    this.addWordToGrid(currentWordObj, startX_D, startY_D, 'DOWN');
                                    placed = true;
                                    break outerLoop;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!placed) {
            // Log skip but continue
            this.skipped.push(currentWordObj.word);
        }

        // Recurse to next word regardless of result
        this.placeWordsGreedy(remainingWords);
    }

    canPlace(word, x, y, direction) {
        if (x < 0 || y < 0) return false;
        if (direction === 'ACROSS') {
            if (x + word.length > this.width) return false;
        } else {
            if (y + word.length > this.height) return false;
        }

        for (let i = 0; i < word.length; i++) {
            const curX = direction === 'ACROSS' ? x + i : x;
            const curY = direction === 'ACROSS' ? y : y + i;
            const char = word[i];
            const cell = this.grid[curY][curX];

            if (cell !== null) {
                if (cell.char !== char) return false;
            } else {
                if (direction === 'ACROSS') {
                    if (this.hasNeighbor(curX, curY - 1)) return false;
                    if (this.hasNeighbor(curX, curY + 1)) return false;
                } else {
                    if (this.hasNeighbor(curX - 1, curY)) return false;
                    if (this.hasNeighbor(curX + 1, curY)) return false;
                }
            }
        }

        // End Caps
        const startPrevX = direction === 'ACROSS' ? x - 1 : x;
        const startPrevY = direction === 'ACROSS' ? y : y - 1;
        if (this.isValidCell(startPrevX, startPrevY) && this.grid[startPrevY][startPrevX]) return false;

        const endNextX = direction === 'ACROSS' ? x + word.length : x;
        const endNextY = direction === 'ACROSS' ? y : y + word.length;
        if (this.isValidCell(endNextX, endNextY) && this.grid[endNextY][endNextX]) return false;

        return true;
    }

    hasNeighbor(x, y) {
        if (!this.isValidCell(x, y)) return false;
        return this.grid[y][x] !== null;
    }

    isValidCell(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    addWordToGrid(wordObj, x, y, direction) {
        const word = wordObj.word;
        for (let i = 0; i < word.length; i++) {
            const curX = direction === 'ACROSS' ? x + i : x;
            const curY = direction === 'ACROSS' ? y : y + i;
            this.grid[curY][curX] = { char: word[i] };
        }
        this.placements.push({ word: wordObj.word, clue: wordObj.clue, x, y, direction });
    }

    compileGrid() {
        const output = Array(this.height).fill(null).map(() =>
            Array(this.width).fill(null).map(() => ({
                value: '',
                correct: '',
                isBlack: true,
                number: null
            }))
        );

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x]) {
                    output[y][x].isBlack = false;
                    output[y][x].correct = this.grid[y][x].char;
                }
            }
        }

        let numberCounter = 1;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (output[y][x].isBlack) continue;

                let isStart = false;
                if ((x === 0 || output[y][x - 1].isBlack) && (x + 1 < this.width && !output[y][x + 1].isBlack)) isStart = true;
                if ((y === 0 || output[y - 1][x].isBlack) && (y + 1 < this.height && !output[y + 1][x].isBlack)) isStart = true;

                if (isStart) {
                    output[y][x].number = numberCounter++;
                }
            }
        }

        const refinedClues = this.placements.map(p => {
            const cell = output[p.y][p.x];
            return {
                ...p,
                number: cell.number
            };
        });

        return { grid: output, clues: refinedClues, skipped: this.skipped };
    }
}

module.exports = GridGenerator;
