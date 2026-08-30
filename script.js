// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 1 DI 4)
// Geometria a Righe Alternate (6,5,6,5,6), Pattern Manuale a 3 Colori e Stato
// ============================================================================

const ROWS = 5;
const MAX_PIECES = 6;

// Ritorna il numero corretto di colonne per una determinata riga (0-indexed)
function getColsForId(r) {
    return (r % 2 === 0) ? 6 : 5; // Righe 0, 2, 4 -> 6 colonne | Righe 1, 3 -> 5 colonne
}

// Calcola i vicini in una griglia esagonale a nido d'ape compatta (Righe alternate 6 e 5)
function getNeighborCoords(r, c, dir) {
    const isRowOf5 = (r % 2 !== 0);
    switch(dir) {
        case 0: return isRowOf5 ? {r: r - 1, c: c}     : {r: r - 1, c: c - 1}; // Alto-Sx
        case 1: return isRowOf5 ? {r: r - 1, c: c + 1} : {r: r - 1, c: c};     // Alto-Dx
        case 2: return {r: r,     c: c + 1};                                // Destra
        case 3: return isRowOf5 ? {r: r + 1, c: c + 1} : {r: r + 1, c: c};     // Basso-Dx
        case 4: return isRowOf5 ? {r: r + 1, c: c}     : {r: r + 1, c: c - 1}; // Basso-Sx
        case 5: return {r: r,     c: c - 1};                                // Sinistra
        default: return null;
    }
}

let gameState = {
    board: [], // Array di array a lunghezza variabile (6, 5, 6, 5, 6)
    currentPlayer: 'B',
    lastMoves: { B: null, N: null },
    resurrectionPending: false,
    selectedPiece: null,
    validTargets: [],
    mustCapture: false
};

function initGame() {
    gameState.board = [];
    for (let r = 0; r < ROWS; r++) {
        gameState.board.push(Array(getColsForId(r)).fill(null));
    }
    
    // Posizionamento iniziale stabile bidimensionale [riga][colonna]
    for (let c = 0; c < 6; c++) {
        gameState.board[0][c] = 'N'; // 6 Rossi posizionati stabilmente sulla riga 0
        gameState.board[4][c] = 'B'; // 6 Ori posizionati stabilmente sulla riga 4
    }
    
    gameState.currentPlayer = 'B';
    gameState.lastMoves = { B: null, N: null };
    gameState.resurrectionPending = false;
    gameState.selectedPiece = null;
    gameState.validTargets = [];
    
    checkGlobalCaptures();
    renderBoard();
    updateUI();
}

function isValidCoord(r, c) {
    if (r < 0 || r >= ROWS) return false;
    return c >= 0 && c < getColsForId(r);
}

function countLivePieces(board, player) {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (board[r][c] === player) count++;
        }
    }
    return count;
}

function checkGlobalCaptures() {
    gameState.mustCapture = false;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (gameState.board[r][c] === gameState.currentPlayer) {
                const moves = getPieceMoves(gameState.board, r, c, gameState.lastMoves[gameState.currentPlayer]);
                if (moves.some(m => m.isCapture)) {
                    gameState.mustCapture = true;
                    return;
                }
            }
        }
    }
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 2 DI 4)
// Calcolo Mosse Mappato su Dimensioni Variabili e Generatore Scenari Combo
// ============================================================================

function getPieceMoves(board, r, c, playerLastMove) {
    const player = board[r][c];
    if (!player) return [];
    
    let captures = [];
    let normals = [];
    
    for (let d = 0; d < 6; d++) {
        const neighbor = getNeighborCoords(r, c, d);
        if (!neighbor || !isValidCoord(neighbor.r, neighbor.c)) continue;
        
        const opponent = (player === 'B') ? 'N' : 'B';
        
        if (board[neighbor.r][neighbor.c] === opponent) {
            const landing = getNeighborCoords(neighbor.r, neighbor.c, d);
            if (landing && isValidCoord(landing.r, landing.c) && board[landing.r][landing.c] === null) {
                captures.push({
                    fromR: r, fromC: c,
                    toR: landing.r, toC: landing.c,
                    isCapture: true,
                    capturedR: neighbor.r, capturedC: neighbor.c
                });
            }
        } else if (board[neighbor.r][neighbor.c] === null) {
            let violatesMelina = false;
            if (playerLastMove) {
                if (neighbor.r === playerLastMove.fromR && neighbor.c === playerLastMove.fromC &&
                    r === playerLastMove.toR && c === playerLastMove.toC) {
                    violatesMelina = true;
                }
            }
            if (!violatesMelina) {
                normals.push({
                    fromR: r, fromC: c,
                    toR: neighbor.r, toC: neighbor.c,
                    isCapture: false
                });
            }
        }
    }
    return captures.length > 0 ? captures : normals;
}

function getBoardsAfterFullCombo(initialBoard, startR, startC, player, lastMoveRef) {
    let results = [];
    
    function simulate(currentBoard, r, c, stepByStepMoves) {
        let moves = getPieceMoves(currentBoard, r, c, lastMoveRef);
        let captureMoves = moves.filter(m => m.isCapture);
        
        if (captureMoves.length === 0) {
            let generatedBoards = [];
            const pieceCount = countLivePieces(currentBoard, player);
            const isMeta = (player === 'B' && r === 0 && startR !== 0) || 
                           (player === 'N' && r === 4 && startR !== 4);
                           
            if (isMeta && pieceCount < MAX_PIECES) {
                for (let br = 0; br < ROWS; br++) {
                    for (let bc = 0; bc < getColsForId(br); bc++) {
                        if (currentBoard[br][bc] === null) {
                            let resBoard = currentBoard.map(row => [...row]);
                            resBoard[br][bc] = player;
                            generatedBoards.push({
                                board: resBoard,
                                lastMove: { fromR: startR, fromC: startC, toR: r, toC: c },
                                steps: [...stepByStepMoves]
                            });
                        }
                    }
                }
            } else {
                generatedBoards.push({
                    board: currentBoard.map(row => [...row]),
                    lastMove: { fromR: startR, fromC: startC, toR: r, toC: c },
                    steps: [...stepByStepMoves]
                });
            }
            results.push(...generatedBoards);
            return;
        }
        
        for (let cap of captureMoves) {
            let nextBoard = currentBoard.map(row => [...row]);
            nextBoard[cap.capturedR][cap.capturedC] = null;
            nextBoard[cap.toR][cap.toC] = player;
            nextBoard[cap.fromR][cap.fromC] = null;
            
            simulate(nextBoard, cap.toR, cap.toC, [...stepByStepMoves, cap]);
        }
    }
    
    simulate(initialBoard.map(row => [...row]), startR, startC, []);
    return results;
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 3 DI 4)
// IA Cautelativa ed Euristica di Risurrezione Strategica
// ============================================================================

// AGGIORNATO: Matrice di valutazione riscritta per spingere l'IA a usare la Risurrezione
function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (board[r][c] === 'N') {
                score += 100; // Valore base pedina PC
                
                // STRATEGIA: Penalizza leggermente le pedine PC bloccate sulla riga di Meta (riga 4)
                if (r === 4) {
                    score += 15; // Massimo avanzamento territoriale ma ridotto rispetto a prima
                } else {
                    score += (r * 25); // Premia fortemente la spinta territoriale attiva (es. riga 3)
                }
            } else if (board[r][c] === 'B') {
                score -= 100; // Valore base pedina Umano
                if (r === 0) {
                    score -= 15;
                } else {
                    score -= ((4 - r) * 25);
                }
            }
        }
    }
    return score;
}

function makeCPUMove() {
    let cpuScenarios = [];
    let hasCaptures = false;
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (gameState.board[r][c] === 'N') {
                let moves = getPieceMoves(gameState.board, r, c, gameState.lastMoves.N);
                if (moves.some(m => m.isCapture)) hasCaptures = true;
            }
        }
    }
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (gameState.board[r][c] === 'N') {
                let moves = getPieceMoves(gameState.board, r, c, gameState.lastMoves.N);
                if (hasCaptures) moves = moves.filter(m => m.isCapture);
                
                for (let m of moves) {
                    if (m.isCapture) {
                        let combos = getBoardsAfterFullCombo(gameState.board, r, c, 'N', gameState.lastMoves.N);
                        cpuScenarios.push(...combos);
                    } else {
                        let nextBoard = gameState.board.map(row => [...row]);
                        nextBoard[m.toR][m.toC] = 'N';
                        nextBoard[m.fromR][m.fromC] = null;
                        
                        const isMeta = (m.toR === 4 && m.fromR !== 4);
                        if (isMeta && countLivePieces(nextBoard, 'N') < MAX_PIECES) {
                            // STRATEGIA: Genera scenari di risurrezione simulando TUTTE le caselle vuote
                            // L'IA valuterà matematicamente quale casella di rinascita disturba di più l'Umano
                            for (let br = 0; br < ROWS; br++) {
                                for (let bc = 0; bc < getColsForId(br); bc++) {
                                    if (nextBoard[br][bc] === null) {
                                        let resBoard = nextBoard.map(row => [...row]);
                                        resBoard[br][bc] = 'N';
                                        cpuScenarios.push({ board: resBoard, lastMove: m, steps: [m] });
                                    }
                                }
                            }
                        } else {
                            cpuScenarios.push({ board: nextBoard, lastMove: m, steps: [m] });
                        }
                    }
                }
            }
        }
    }
    
    if (cpuScenarios.length === 0) {
        endGame('B');
        return;
    }
    
    let bestScore = -Infinity;
    let bestScenario = null;
    
    for (let scenario of cpuScenarios) {
        let humanMoves = [];
        let hHasCaptures = false;
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < getColsForId(r); c++) {
                if (scenario.board[r][c] === 'B') {
                    let mvs = getPieceMoves(scenario.board, r, c, scenario.lastMove);
                    if (mvs.some(m => m.isCapture)) hHasCaptures = true;
                }
            }
        }
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < getColsForId(r); c++) {
                if (scenario.board[r][c] === 'B') {
                    let mvs = getPieceMoves(scenario.board, r, c, scenario.lastMove);
                    if (hHasCaptures) mvs = mvs.filter(m => m.isCapture);
                    humanMoves.push(...mvs);
                }
            }
        }
        
        let worstHumanScore = Infinity;
        if (humanMoves.length === 0) {
            worstHumanScore = evaluateBoard(scenario.board) + 500;
        } else {
            for (let hm of humanMoves) {
                let tempBoard = scenario.board.map(row => [...row]);
                if (hm.isCapture) tempBoard[hm.capturedR][hm.capturedC] = null;
                tempBoard[hm.toR][hm.toC] = 'B';
                tempBoard[hm.fromR][hm.fromC] = null;
                let scr = evaluateBoard(tempBoard);
                if (scr < worstHumanScore) worstHumanScore = scr;
            }
        }
        
        if (worstHumanScore > bestScore || bestScenario === null) {
            bestScore = worstHumanScore;
            bestScenario = scenario;
        }
    }
    
    executeAnimateCPUSteps(bestScenario.steps, bestScenario.board, bestScenario.lastMove);
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 4 DI 4)
// Renderizzatore Temporizzato, Gestione dei Salti ed Eventi di Gioco Mobile-First
// ============================================================================

function renderBoard() {
    const boardDiv = document.getElementById('hex-board');
    if (!boardDiv) return;
    boardDiv.innerHTML = '';
    
    // NOTA: Ricordati di riempire queste due righe a mano alla riga dell'errore su VS Code!
    const rowEvenPattern =[1, 2, 3, 1, 2, 3]; 
    const rowOddPattern  =[3, 1, 2, 3, 1];    
    
    for (let r = 0; r < ROWS; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = `hex-row ${r % 2 !== 0 ? 'odd' : 'even'}`;
        
        const cols = getColsForId(r);
        const currentPattern = (r % 2 === 0) ? rowEvenPattern : rowOddPattern;
        
        for (let c = 0; c < cols; c++) {
            const cellDiv = document.createElement('div');
            const colorIndex = currentPattern[c];
            
            cellDiv.className = `hex-cell color-${colorIndex}`;
            cellDiv.dataset.row = r;
            cellDiv.dataset.col = c;
            
            if (gameState.selectedPiece && gameState.selectedPiece.r === r && gameState.selectedPiece.c === c) {
                cellDiv.classList.add('selectable');
            }
            if (gameState.validTargets.some(t => t.toR === r && t.toC === c)) {
                cellDiv.classList.add('highlight-target');
            }
            
            const piece = gameState.board[r][c];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = `piece ${piece === 'B' ? 'white' : 'black'}`;
                
                if (gameState.currentPlayer === piece && !gameState.resurrectionPending) {
                    if (gameState.mustCapture && piece === 'B') {
                        const pMoves = getPieceMoves(gameState.board, r, c, gameState.lastMoves.B);
                        if (pMoves.some(m => m.isCapture)) {
                            pieceDiv.classList.add('can-capture');
                        }
                    } else {
                        pieceDiv.classList.add('active-turn');
                    }
                }
                cellDiv.appendChild(pieceDiv);
            }
            
            cellDiv.addEventListener('click', () => handleCellClick(r, c));
            rowDiv.appendChild(cellDiv);
        }
        boardDiv.appendChild(rowDiv);
    }
}

function executeAnimateCPUSteps(steps, finalBoard, finalLastMove) {
    let index = 0;
    
    function nextStep() {
        if (index < steps.length) {
            let m = steps[index];
            if (m.isCapture) {
                gameState.board[m.capturedR][m.capturedC] = null;
            }
            gameState.board[m.toR][m.toC] = 'N';
            gameState.board[m.fromR][m.fromC] = null;
            
            renderBoard();
            index++;
            setTimeout(nextStep, 550);
        } else {
            gameState.board = finalBoard;
            gameState.lastMoves.N = finalLastMove;
            
            if (checkVictoryConditions()) return;
            
            gameState.currentPlayer = 'B';
            checkGlobalCaptures();
            renderBoard();
            updateUI();
        }
    }
    nextStep();
}

function handleCellClick(r, c) {
    if (gameState.currentPlayer !== 'B') return;
    
    if (gameState.resurrectionPending) {
        if (gameState.board[r][c] === null) {
            gameState.board[r][c] = 'B';
            gameState.resurrectionPending = false;
            if (checkVictoryConditions()) return;
            executeTurnPassToCPU();
        }
        return;
    }
    
    if (gameState.board[r][c] === 'B') {
        const moves = getPieceMoves(gameState.board, r, c, gameState.lastMoves.B);
        if (gameState.mustCapture && !moves.some(m => m.isCapture)) return;
        
        gameState.selectedPiece = { r, c };
        gameState.validTargets = gameState.mustCapture ? moves.filter(m => m.isCapture) : moves;
        renderBoard();
        return;
    }
    
    const targetMove = gameState.validTargets.find(t => t.toR === r && t.toC === c);
    if (targetMove) {
        const startR = gameState.selectedPiece.r;
        if (targetMove.isCapture) {
            gameState.board[targetMove.capturedR][targetMove.capturedC] = null;
        }
        
        gameState.board[r][c] = 'B';
        gameState.board[targetMove.fromR][targetMove.fromC] = null;
        gameState.lastMoves.B = targetMove;
        
        if (targetMove.isCapture) {
            const nextMoves = getPieceMoves(gameState.board, r, c, gameState.lastMoves.B);
            if (nextMoves.some(m => m.isCapture)) {
                gameState.selectedPiece = { r, c };
                gameState.validTargets = nextMoves.filter(m => m.isCapture);
                renderBoard();
                return;
            }
        }
        
        const isMeta = (r === 0 && startR !== 0);
        if (isMeta && countLivePieces(gameState.board, 'B') < MAX_PIECES) {
            gameState.resurrectionPending = true;
            gameState.selectedPiece = null;
            gameState.validTargets = [];
            renderBoard();
            document.getElementById('turn-indicator').innerText = "RISURREZIONE! Scegli un esagono vuoto";
            return;
        }
        
        if (checkVictoryConditions()) return;
        executeTurnPassToCPU();
    }
}

function executeTurnPassToCPU() {
    gameState.selectedPiece = null;
    gameState.validTargets = [];
    gameState.currentPlayer = 'N';
    renderBoard();
    updateUI();
    setTimeout(makeCPUMove, 600);
}

function checkVictoryConditions() {
    const bCount = countLivePieces(gameState.board, 'B');
    const nCount = countLivePieces(gameState.board, 'N');
    
    if (bCount === 0) { endGame('N'); return true; }
    if (nCount === 0) { endGame('B'); return true; }
    
    let bOnFront = 0, nOnFront = 0;
    for (let c = 0; c < 6; c++) {
        if (gameState.board[4][c] === 'N') nOnFront++; 
        if (gameState.board[0][c] === 'B') bOnFront++; 
    }
    if (bOnFront === 6) { endGame('B'); return true; }
    if (nOnFront === 6) { endGame('N'); return true; }
    
    return false;
}

function updateUI() {
    if (gameState.resurrectionPending) return;
    document.getElementById('score-human').innerText = countLivePieces(gameState.board, 'B');
    document.getElementById('score-cpu').innerText = countLivePieces(gameState.board, 'N');
    
    if (gameState.currentPlayer) {
        document.getElementById('turn-indicator').innerText = 
            gameState.currentPlayer === 'B' ? "Turno dell'Umano (Oro)" : "Calcolo IA (Rossi)...";
    }
}

window.onload = initGame;
