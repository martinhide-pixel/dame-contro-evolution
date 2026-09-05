// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 1 DI 5)
// Costanti, Struttura Geometrica Esagonale, Stato Iniziale e Setup Globale
// ============================================================================

const ROWS = 5;
const MAX_PIECES = 6;

function getColsForId(r) {
    return (r % 2 === 0) ? 6 : 5; 
}

function getNeighborCoords(r, c, dir) {
    const isRowOf5 = (r % 2 !== 0);
    switch(dir) {
        case 0: return isRowOf5 ? {r: r - 1, c: c}     : {r: r - 1, c: c - 1}; 
        case 1: return isRowOf5 ? {r: r - 1, c: c + 1} : {r: r - 1, c: c};     
        case 2: return {r: r,     c: c + 1};                                
        case 3: return isRowOf5 ? {r: r + 1, c: c + 1} : {r: r + 1, c: c};     
        case 4: return isRowOf5 ? {r: r + 1, c: c}     : {r: r + 1, c: c - 1}; 
        case 5: return {r: r,     c: c - 1};                                
        default: return null;
    }
}

let gameState = {
    board: [], 
    currentPlayer: 'B',
    lastMoves: { B: null, N: null },
    resurrectionPending: false,
    selectedPiece: null,
    validTargets: [],
    mustCapture: false,
    mode: 'ai',
    originalStartR: null
};

function initGame() {
    gameState.board = [];
    for (let r = 0; r < ROWS; r++) {
        gameState.board.push(Array(getColsForId(r)).fill(null));
    }
    
    const selectElem = document.getElementById('game-mode');
    if (selectElem) gameState.mode = selectElem.value;
    
    const oldOverlay = document.getElementById('victory-popup');
    if (oldOverlay) oldOverlay.remove();
    
    // Inizializzazione rigida coordinata per coordinata anti-allucinazione
    gameState.board[0][0] = 'N';
    gameState.board[0][1] = 'N';
    gameState.board[0][2] = 'N';
    gameState.board[0][3] = 'N';
    gameState.board[0][4] = 'N';
    gameState.board[0][5] = 'N'; 
    
    gameState.board[4][0] = 'B';
    gameState.board[4][1] = 'B';
    gameState.board[4][2] = 'B';
    gameState.board[4][3] = 'B';
    gameState.board[4][4] = 'B';
    gameState.board[4][5] = 'B'; 
    
    gameState.currentPlayer = 'B';
    gameState.lastMoves = { B: null, N: null };
    gameState.resurrectionPending = false;
    gameState.selectedPiece = null;
    gameState.validTargets = [];
    gameState.originalStartR = null;
    
    checkGlobalCaptures();
    renderBoard();
    updateUI();
}

function isValidCoord(r, c) {
    if (r < 0 || r >= ROWS) return false;
    return c >= 0 && c < getColsForId(r);
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 2 DI 5)
// Funzioni di Analisi Stato, Catture Obbligatorie e Calcolo Mosse Pezzo
// ============================================================================

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

function getPieceMoves(board, r, c, playerLastMove) {
    const player = board[r][c];
    if (!player) return [];
    
    let captures = [];
    let normals = [];
    
    for (let d = 0; d < 6; d++) {
        const neighbor = getNeighborCoords(r, c, d);
        if (!neighbor || !isValidCoord(neighbor.r, neighbor.c)) continue;
        
        const opponent = (player === 'B' ? 'N' : 'B');
        
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
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 3 DI 5)
// Generatore Scenari Combo Multiple Ricorsivo ed Euristica dell'IA
// ============================================================================

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

function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (board[r][c] === 'N') {
                score += 100; 
                if (r === 4) score += 15; 
                else score += (r * 25); 
            } else if (board[r][c] === 'B') {
                score -= 100; 
                if (r === 0) score -= 15;
                else score -= ((4 - r) * 25);
            }
        }
    }
    return score;
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 4 DI 5)
// Algoritmo Decisionale Predittivo Minimax della CPU (Rossi)
// ============================================================================

function makeCPUMove() {
    if (gameState.mode === 'pvp') return; 
    
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
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 5 DI 6)
// Disegno Grafico della Plancia, Pattern Pietra Reale e Calcolo Slide Superior
// ============================================================================

function renderBoard() {
    const boardDiv = document.getElementById('hex-board');
    if (!boardDiv) return;
    boardDiv.innerHTML = '';
    
    const rowEvenPattern =[1, 2, 3, 1, 2, 3]; 
    const rowOddPattern  =[3, 1, 2, 3, 1];    
    
    for (let r = 0; r < ROWS; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = `hex-row ${r % 2 !== 0 ? 'odd' : 'even'}`;
        
        for (let c = 0; c < getColsForId(r); c++) {
            const cellDiv = document.createElement('div');
            const colorIndex = (r % 2 === 0) ? rowEvenPattern[c] : rowOddPattern[c];
            
            cellDiv.className = `hex-cell color-${colorIndex}`;
            cellDiv.id = `cell-${r}-${c}`;
            
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
                pieceDiv.id = `piece-${r}-${c}`;
                
                if (gameState.currentPlayer === piece && !gameState.resurrectionPending) {
                    const pMoves = getPieceMoves(gameState.board, r, c, gameState.lastMoves[gameState.currentPlayer]);
                    if (gameState.mustCapture && pMoves.some(m => m.isCapture)) {
                        pieceDiv.classList.add('can-capture');
                    } else if (!gameState.mustCapture) {
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

function calculateAndApplySlide(m, callback) {
    const fromCell = document.getElementById(`cell-${m.fromR}-${m.fromC}`);
    const toCell = document.getElementById(`cell-${m.toR}-${m.toC}`);
    const piece = document.getElementById(`piece-${m.fromR}-${m.fromC}`);
    
    if (fromCell && toCell && piece) {
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const deltaX = toRect.left - fromRect.left;
        const deltaY = toRect.top - fromRect.top;
        
        piece.classList.add('sliding');
        piece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        setTimeout(() => {
            piece.classList.remove('sliding');
            callback();
        }, 450);
    } else {
        callback();
    }
}
// ============================================================================
// DAME CONTRO EVOLUTION - SCRIPT.JS (PARTE 6 DI 6)
// Gestione Salti IA, Input Click Giocatore, Regole di Vittoria e Inizializzazione Dom
// ============================================================================

function executeAnimateCPUSteps(steps, finalBoard, finalLastMove) {
    let index = 0;
    function nextStep() {
        if (index < steps.length) {
            let m = steps[index];
            calculateAndApplySlide(m, () => {
                if (m.isCapture) gameState.board[m.capturedR][m.capturedC] = null;
                gameState.board[m.toR][m.toC] = 'N';
                gameState.board[m.fromR][m.fromC] = null;
                renderBoard();
                index++;
                setTimeout(nextStep, 100);
            });
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
    if (gameState.currentPlayer === null) return;
    const isPlayerOro = (gameState.currentPlayer === 'B');
    
    if (gameState.resurrectionPending) {
        if (gameState.board[r][c] === null) {
            gameState.board[r][c] = gameState.currentPlayer;
            gameState.resurrectionPending = false;
            if (checkVictoryConditions()) return;
            if (gameState.mode === 'pvp') {
                gameState.currentPlayer = isPlayerOro ? 'N' : 'B';
                checkGlobalCaptures();
                renderBoard();
                updateUI();
            } else {
                executeTurnPassToCPU();
            }
        }
        return;
    }
    
    if (gameState.board[r][c] === gameState.currentPlayer) {
        const lastRef = isPlayerOro ? gameState.lastMoves.B : gameState.lastMoves.N;
        const moves = getPieceMoves(gameState.board, r, c, lastRef);
        if (gameState.mustCapture && !moves.some(m => m.isCapture)) return;
        
        gameState.selectedPiece = { r, c };
        gameState.validTargets = gameState.mustCapture ? moves.filter(m => m.isCapture) : moves;
        renderBoard();
        return;
    }
    
    const targetMove = gameState.validTargets.find(t => t.toR === r && t.toC === c);
    if (targetMove && gameState.selectedPiece) {
        const startR = gameState.selectedPiece.r;
        
        calculateAndApplySlide(targetMove, () => {
            if (targetMove.isCapture) gameState.board[targetMove.capturedR][targetMove.capturedC] = null;
            gameState.board[r][c] = gameState.currentPlayer;
            gameState.board[targetMove.fromR][targetMove.fromC] = null;
            
            if (isPlayerOro) gameState.lastMoves.B = targetMove;
            else gameState.lastMoves.N = targetMove;
            
            if (targetMove.isCapture) {
                const nextRef = isPlayerOro ? gameState.lastMoves.B : gameState.lastMoves.N;
                const nextMoves = getPieceMoves(gameState.board, r, c, nextRef);
                if (nextMoves.some(m => m.isCapture)) {
                    gameState.selectedPiece = { r, c };
                    gameState.validTargets = nextMoves.filter(m => m.isCapture);
                    renderBoard();
                    return;
                }
            }
            
            const isMeta = (isPlayerOro && r === 0 && startR !== 0) || (!isPlayerOro && r === 4 && startR !== 4);
            if (isMeta && countLivePieces(gameState.board, gameState.currentPlayer) < MAX_PIECES) {
                gameState.resurrectionPending = true;
                gameState.selectedPiece = null;
                gameState.validTargets = [];
                renderBoard();
                document.getElementById('turn-indicator').innerText = "RISURREZIONE! Scegli un esagono vuoto";
                return;
            }
            
            if (checkVictoryConditions()) return;
            
            if (gameState.mode === 'pvp') {
                gameState.currentPlayer = isPlayerOro ? 'N' : 'B';
                gameState.selectedPiece = null;
                gameState.validTargets = [];
                checkGlobalCaptures();
                renderBoard();
                updateUI();
            } else {
                executeTurnPassToCPU();
            }
        });
    }
}

function executeTurnPassToCPU() {
    gameState.selectedPiece = null;
    gameState.validTargets = [];
    gameState.currentPlayer = 'N';
    renderBoard();
    updateUI();
    setTimeout(makeCPUMove, 300);
}

function checkVictoryConditions() {
    const bCount = countLivePieces(gameState.board, 'B');
    const nCount = countLivePieces(gameState.board, 'N');
    if (bCount === 0) { endGame('N'); return true; }
    if (nCount === 0) { endGame('B'); return true; }
    
    let bOnFrontRow = 0, nOnFrontRow = 0;
    for (let c = 0; c < 6; c++) {
        if (gameState.board[0][c] === 'N') nOnFrontRow++; 
        if (gameState.board[4][c] === 'B') bOnFrontRow++; 
    }
    if (bOnFrontRow === 6) { endGame('B'); return true; }
    if (nOnFrontRow === 6) { endGame('N'); return true; }
    
    let bTotalInvasionCount = 0, nTotalInvasionCount = 0;
    for (let r = 0; r <= 1; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (gameState.board[r][c] === 'B') bTotalInvasionCount++;
        }
    }
    for (let r = 3; r <= 4; r++) {
        for (let c = 0; c < getColsForId(r); c++) {
            if (gameState.board[r][c] === 'N') nTotalInvasionCount++;
        }
    }
    if (bTotalInvasionCount === 11) { endGame('B'); return true; }
    if (nTotalInvasionCount === 11) { endGame('N'); return true; }
    return false;
}

function endGame(winner) {
    let titleMsg = "", subMsg = "";
    if (gameState.mode === 'pvp') {
        titleMsg = "TRIONFO!";
        subMsg = winner === 'B' ? "Il Giocatore 1 (Oro) vince!" : "Il Giocatore 2 (Rossi) vince!";
    } else {
        if (winner === 'B') {
            titleMsg = "TRIONFO!";
            subMsg = "L'Umano ha sottomesso l'IA";
        } else {
            titleMsg = "SCONFITTA!";
            subMsg = "L'IA ha preso il controllo";
        }
    }
    
    document.getElementById('turn-indicator').innerText = titleMsg + " " + subMsg;
    gameState.currentPlayer = null;
    
    const container = document.getElementById('board-container');
    if (container) {
        const overlay = document.createElement('div');
        overlay.id = 'victory-popup';
        overlay.className = 'victory-overlay';
        
        const title = document.createElement('div');
        title.className = 'victory-title';
        title.innerText = titleMsg;
        
        const sub = document.createElement('div');
        sub.className = 'victory-sub';
        sub.innerText = subMsg;
        
        overlay.appendChild(title);
        overlay.appendChild(sub);
        container.appendChild(overlay);
        
        setTimeout(() => overlay.classList.add('show'), 50);
    }
    renderBoard();
}

function updateUI() {
    if (gameState.resurrectionPending) return;
    document.getElementById('score-human').innerText = countLivePieces(gameState.board, 'B');
    document.getElementById('score-cpu').innerText = countLivePieces(gameState.board, 'N');
    
    if (gameState.currentPlayer) {
        if (gameState.mode === 'pvp') {
            document.getElementById('turn-indicator').innerText = 
                gameState.currentPlayer === 'B' ? "Turno del Giocatore 1 (Oro)" : "Turno del Giocatore 2 (Rossi)";
        } else {
            document.getElementById('turn-indicator').innerText = 
                gameState.currentPlayer === 'B' ? "Turno dell'Umano (Oro)" : "Calcolo IA (Rossi)...";
        }
    }
}

document.addEventListener('DOMContentLoaded', initGame);
