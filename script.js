// =========================================================================
// PARTE 1 DI 4: CONFIGURAZIONI, STATO DI GIOCO E RENDERING DELLA SCACCHIERA
// =========================================================================

const boardElement = document.getElementById('board');
const resetBtn = document.getElementById('reset-btn');
const gameModeSelect = document.getElementById('game-mode');
const logBox = document.getElementById('log-box');
const victoryScreen = document.getElementById('victory-screen');
const victoryText = document.getElementById('victory-text');

let board = [
    ['N', 'N', 'N', 'N', 'N'],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    ['B', 'B', 'B', 'B', 'B']
];

let currentPlayer = 'B'; 
let selectedPiece = null; 
let isMultiJumpPhase = false; 
let isRevivalPhase = false; 

let gameMode = gameModeSelect.value === 'pvp' ? 'pvp' : 'pvc';
let aiDepth = 2; // Forzato a 2 turni deterministici completi

let lastMoves = { 'B': null, 'N': null };

const DIRECTIONS = [];
for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
        if (x !== 0 || y !== 0) DIRECTIONS.push([x, y]);
    }
}

function countPieces(player, virtualBoard = board) {
    let count = 0;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (virtualBoard[r][c] === player) count++;
        }
    }
    return count;
}

function cloneBoard(matrix) {
    return matrix.map(row => [...row]);
}

function addLog(text, type = 'normal') {
    logBox.innerHTML = ''; 
    const entry = document.createElement('div');
    entry.classList.add('log-entry');
    if (type === 'alert') entry.classList.add('alert-msg');
    if (type === 'victory') entry.classList.add('victory-msg');
    entry.textContent = text;
    logBox.appendChild(entry);
}

function createBoard() {
    boardElement.innerHTML = '';
    const allMandatoryJumps = isRevivalPhase ? [] : getAllMandatoryJumps(currentPlayer, board);
    const hasToJump = allMandatoryJumps.length > 0;

    if (!isMultiJumpPhase && !isRevivalPhase && checkVictory()) return;

    const myLastMove = lastMoves[currentPlayer];

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.classList.add((r + c) % 2 === 0 ? 'chiara' : 'scura');
            cell.dataset.row = r; cell.dataset.col = c;

            if (board[r][c]) {
                const dama = document.createElement('div');
                dama.classList.add('dama', board[r][c]);
                if (board[r][c] === currentPlayer && !hasToJump) {
                    dama.classList.add(currentPlayer === 'B' ? 'active-turn-B' : 'active-turn-N');
                }
                if (hasToJump && board[r][c] === currentPlayer) {
                    if (allMandatoryJumps.some(j => j.fromR === r && j.fromC === c)) dama.classList.add('mandatory-attacker');
                }
                cell.appendChild(dama);
            }

            if (myLastMove && !hasToJump && !isRevivalPhase && !(gameMode === 'pvc' && currentPlayer === 'N')) {
                if (selectedPiece && myLastMove.toRow === selectedPiece.row && myLastMove.toCol === selectedPiece.col) {
                    if (r === myLastMove.fromRow && c === myLastMove.fromCol) cell.classList.add('forbidden');
                }
            }
            if (isRevivalPhase && board[r][c] === null) cell.classList.add('highlight');
            if (selectedPiece && r === selectedPiece.row && c === selectedPiece.col) cell.classList.add('selected');

            cell.addEventListener('click', (e) => onCellClick(e, hasToJump, allMandatoryJumps));
            boardElement.appendChild(cell);
        }
    }

    if (selectedPiece && !isRevivalPhase) {
        highlightMovesForPiece(selectedPiece.row, selectedPiece.col, hasToJump, commissionsForPiece(selectedPiece.row, selectedPiece.col, allMandatoryJumps));
    }

    if (gameMode === 'pvc' && currentPlayer === 'N' && !isMultiJumpPhase) {
        if (isRevivalPhase) {
            setTimeout(executeComputerRevival, 600);
        } else {
            setTimeout(makeDeterministicComputerMove, 300);
        }
    }
}
// =========================================================================
// PARTE 2 DI 4: INTERAZIONE UTENTE E LOGICA DEI SPOSTAMENTI REALI
// =========================================================================

function onCellClick(e, hasToJump, allMandatoryJumps) {
    if (gameMode === 'pvc' && currentPlayer === 'N') return;
    const cell = e.currentTarget;
    const r = parseInt(cell.dataset.row); const c = parseInt(cell.dataset.col);

    if (cell.classList.contains('forbidden')) {
        addLog("Mossa vietata! Non puoi tornare sulla casella rossa.", "alert"); return;
    }
    if (isRevivalPhase) {
        if (cell.classList.contains('highlight')) {
            board[r][c] = currentPlayer; isRevivalPhase = false;
            addLog("Schierata una pedina risorta."); endTurn();
        }
        return;
    }
    if (isMultiJumpPhase) {
        if (cell.classList.contains('highlight')) executeJump(selectedPiece.row, selectedPiece.col, r, c);
        return;
    }
    if (board[r][c] === currentPlayer) {
        if (hasToJump && !allMandatoryJumps.some(j => j.fromR === r && j.fromC === c)) {
            addLog("Obbligo di attacco! Seleziona un pezzo cerchiato.", "alert"); return;
        }
        selectedPiece = { row: r, col: c }; createBoard(); return;
    }
    if (selectedPiece && cell.classList.contains('highlight')) {
        if (hasToJump) executeJump(selectedPiece.row, selectedPiece.col, r, c);
        else executeNormalMove(selectedPiece.row, selectedPiece.col, r, c);
    }
}

function commissionsForPiece(r, c, allJumps) {
    return allJumps.filter(j => j.fromR === r && j.fromC === c);
}

function highlightMovesForPiece(r, c, hasToJump, pieceJumps) {
    document.querySelectorAll('.cell').forEach(el => el.classList.remove('highlight', 'forbidden'));
    if (hasToJump) {
        pieceJumps.forEach(j => {
            document.querySelector(`[data-row='${j.toR}'][data-col='${j.toC}']`).classList.add('highlight');
        });
    } else {
        const myLastMove = lastMoves[currentPlayer];
        const isSamePiece = myLastMove && myLastMove.toRow === r && myLastMove.toCol === c;
        DIRECTIONS.forEach(([dr, dc]) => {
            const nr = r + dr; const nc = c + dc;
            if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && board[nr][nc] === null) {
                if (isSamePiece && myLastMove.fromRow === nr && myLastMove.fromCol === nc) {
                    document.querySelector(`[data-row='${nr}'][data-col='${nc}']`).classList.add('forbidden');
                } else {
                    document.querySelector(`[data-row='${nr}'][data-col='${nc}']`).classList.add('highlight');
                }
            }
        });
    }
}

function executeNormalMove(fromR, fromC, toR, toC) {
    board[toR][toC] = currentPlayer; board[fromR][fromC] = null;
    lastMoves[currentPlayer] = { fromRow: fromR, fromCol: fromC, toRow: toR, toCol: toC };
    addLog(`Mossa effettuata dal giocatore ${currentPlayer === 'B' ? 'Bianco' : 'Nero'}.`);
    if (checkEndLineTrigger(fromR, toR, toC)) return;
    endTurn();
}

function executeJump(fromR, fromC, toR, toC) {
    const midR = Math.floor((parseInt(fromR) + parseInt(toR)) / 2);
    const midC = Math.floor((parseInt(fromC) + parseInt(toC)) / 2);
    board[midR][midC] = null;
    board[toR][toC] = currentPlayer; board[fromR][fromC] = null;
    addLog("Pedina avversaria catturata!", "alert");
    selectedPiece = { row: toR, col: toC };

    const nextJumps = getAllMandatoryJumps(currentPlayer, board).filter(j => j.fromR === toR && j.fromC === toC);
    if (nextJumps.length > 0) {
        isMultiJumpPhase = true;
        if (gameMode === 'pvc' && currentPlayer === 'N') {
            createBoard();
            setTimeout(() => {
                const nextJump = nextJumps.shift();
                executeJump(nextJump.fromR, nextJump.fromC, nextJump.toR, nextJump.toC);
            }, 800);
        } else {
            addLog("Mangiata multipla attiva! Continua l'attacco.", "alert"); createBoard();
        }
    } else {
        isMultiJumpPhase = false;
        if (checkEndLineTrigger(fromR, toR, toC)) return;
        lastMoves[currentPlayer] = null; endTurn();
    }
}
// =========================================================================
// PARTE 3 DI 4: REGOLE DI FINE LINEA, VITTORIA E SPOSTAMENTO DELLE RISURREZIONI
// =========================================================================

function getAllMandatoryJumps(player, virtualBoard) {
    const jumps = []; const opponent = player === 'B' ? 'N' : 'B';
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (virtualBoard[r][c] === player) {
                DIRECTIONS.forEach(([dr, dc]) => {
                    const enemyR = r + dr; const enemyC = c + dc;
                    const landR = r + (dr * 2); const landC = c + (dc * 2);
                    if (landR >= 0 && landR < 5 && landC >= 0 && landC < 5) {
                        if (virtualBoard[enemyR][enemyC] === opponent && virtualBoard[landR][landC] === null) {
                            jumps.push({ fromR: r, fromC: c, toR: landR, toC: landC });
                        }
                    }
                });
            }
        }
    }
    return jumps;
}

function checkEndLineTrigger(fromR, toR, toC) {
    const targetLine = currentPlayer === 'B' ? 0 : 4;
    if (parseInt(toR) === targetLine && parseInt(fromR) !== targetLine) {
        let alive = countPieces(currentPlayer, board);
        if (alive < 5) {
            isRevivalPhase = true;
            addLog("Meta! Scegli dove far risorgere una pedina eliminata.", "alert");
            createBoard();
            return true;
        }
    }
    return false;
}

function endTurn() {
    selectedPiece = null;
    currentPlayer = currentPlayer === 'B' ? 'N' : 'B';
    createBoard();
}

function checkVictory() {
    const bCount = countPieces('B', board); const nCount = countPieces('N', board);
    if (bCount === 0) { showVictory("IL NERO DOMINA IL TABELLONE!"); return true; }
    if (nCount === 0) { showVictory("IL BIANCO HA STERMINATO L'AVVERSARIO!"); return true; }

    let bOnFront = 0, nOnFront = 0;
    for (let c = 0; c < 5; c++) { if (board[c] === 'B') bOnFront++; if (board[c] === 'N') nOnFront++; }
    if (bOnFront === 5) { showVictory("IL BIANCO HA OCCUPATO IL FRONTE!"); return true; }
    if (nOnFront === 5) { showVictory("IL NERO HA OCCUPATO IL FRONTE!"); return true; }

    if (getAllValidMoves(currentPlayer, board, lastMoves[currentPlayer]).length === 0) {
        const winner = currentPlayer === 'B' ? 'NERO' : 'BIANCO';
        showVictory(`SBARRAMENTO COMPLETO! VINCE IL ${winner}`); return true;
    }
    return false;
}

function showVictory(text) {
    victoryText.textContent = text; victoryScreen.classList.remove('hidden');
}

function executeComputerRevival() {
    if (!isRevivalPhase || currentPlayer !== 'N') return;
    let bestR = 0; let bestC = 0; let bestScore = -Infinity;

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (board[r][c] === null) {
                let testB = cloneBoard(board); testB[r][c] = 'N';
                let score = evaluateRevivalStrategicScore(testB, r, c, 'N');
                if (score > bestScore) { bestScore = score; bestR = r; bestC = c; }
            }
        }
    }
    board[bestR][bestC] = 'N'; isRevivalPhase = false;
    addLog(`Il PC risuscita una pedina in posizione [${bestR + 1}, ${bestC + 1}].`);
    endTurn();
}
// =========================================================================
// PARTE 4 DI 4: SIMULATORE COMPLETO DI SCENARI ED EVENTI DI SISTEMA
// =========================================================================

function getAllValidMoves(player, virtualBoard, lastMove) {
    const jumps = getAllMandatoryJumps(player, virtualBoard);
    if (jumps.length > 0) return jumps.map(j => ({ ...j, isJump: true }));
    const moves = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (virtualBoard[r][c] === player) {
                const isSamePiece = lastMove && parseInt(lastMove.toRow) === r && parseInt(lastMove.toCol) === c;
                DIRECTIONS.forEach(([dr, dc]) => {
                    const nr = r + dr; const nc = c + dc;
                    if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && virtualBoard[nr][nc] === null) {
                        if (!(isSamePiece && parseInt(lastMove.fromRow) === nr && parseInt(lastMove.fromCol) === nc)) {
                            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isJump: false });
                        }
                    }
                });
            }
        }
    }
    return moves;
}

// SIMULATORE REALE DI COMBO A ZIGZAG SUI VIRTUAL BOARD
function getBoardsAfterFullCombo(player, move, vBoard) {
    let tempBoard = cloneBoard(vBoard);
    if (move.isJump) tempBoard[Math.floor((move.fromR + move.toR)/2)][Math.floor((move.fromC + move.toC)/2)] = null;
    tempBoard[move.toR][move.toC] = player; tempBoard[move.fromR][move.fromC] = null;

    let targetLine = player === 'B' ? 0 : 4;
    // Controllo Meta di rinfianco
    if (move.toR === targetLine && move.fromR !== targetLine && countPieces(player, tempBoard) < 5) {
        let revivalBoards = [];
        for (let r=0; r<5; r++) {
            for (let c=0; c<5; c++) {
                if (tempBoard[r][c] === null) { let rb = cloneBoard(tempBoard); rb[r][c] = player; revivalBoards.push(rb); }
            }
        }
        return revivalBoards;
    }

    let subJumps = getAllMandatoryJumps(player, tempBoard).filter(j => j.fromR === move.toR && j.fromC === move.toC);
    if (subJumps.length > 0) {
        let comboBoards = [];
        for (let sj of subJumps) { comboBoards = comboBoards.concat(getBoardsAfterFullCombo(player, { ...sj, isJump: true }, tempBoard)); }
        return comboBoards;
    }
    return [tempBoard];
}

function makeDeterministicComputerMove() {
    const pcMoves = getAllValidMoves('N', board, lastMoves['N']);
    if (pcMoves.length === 0) return;

    let bestInitialMove = pcMoves[0]; let bestGlobalScore = -Infinity;

    for (let pm of pcMoves) {
        // TURNO 1 (PC): Genera tutti gli scenari reali post-mossa (incluse combo e risurrezioni del PC)
        let boardsAfterPC = pm.isJump ? getBoardsAfterFullCombo('N', pm, board) : [];
        if (!pm.isJump) {
            let nb = cloneBoard(board); nb[pm.toR][pm.toC] = 'N'; nb[pm.fromR][pm.fromC] = null;
            if (pm.toR === 4 && pm.fromR !== 4 && countPieces('N', nb) < 5) {
                for (let r=0; r<5; r++) {
                    for (let c=0; c<5; c++) { if (nb[r][c] === null) { let rb = cloneBoard(nb); rb[r][c] = 'N'; boardsAfterPC.push(rb); } }
                }
            } else { boardsAfterPC.push(nb); }
        }

        let worstScenarioScoreForPC = Infinity;

        for (let bPC of boardsAfterPC) {
            // TURNO 2 (UMANO): Genera tutte le possibili risposte reali dell'Umano su quella plancia
            const huMoves = getAllValidMoves('B', bPC, lastMoves['B']);
            if (huMoves.length === 0) {
                let s = evaluateBoardStateAdvanced(bPC);
                if (s < worstScenarioScoreForPC) worstScenarioScoreForPC = s; continue;
            }

            for (let hm of huMoves) {
                let boardsAfterHU = hm.isJump ? getBoardsAfterFullCombo('B', hm, bPC) : [];
                if (!hm.isJump) {
                    let nh = cloneBoard(bPC); nh[hm.toR][hm.toC] = 'B'; nh[hm.fromR][hm.fromC] = null;
                    if (hm.toR === 0 && hm.fromR !== 0 && countPieces('B', nh) < 5) {
                        for (let r=0; r<5; r++) {
                            for (let c=0; c<5; c++) { if (nh[r][c] === null) { let rb = cloneBoard(nh); rb[r][c] = 'B'; boardsAfterHU.push(rb); } }
                        }
                    } else { boardsAfterHU.push(nh); }
                }

                // Applica i 4 Pilastri sullo stato finale risultante
                for (let bFinal of boardsAfterHU) {
                    let score = evaluateBoardStateAdvanced(bFinal);
                    if (score < worstScenarioScoreForPC) worstScenarioScoreForPC = score; // Identifica la risposta dell'Umano più dannosa
                }
            }
        }

        if (worstScenarioScoreForPC > bestGlobalScore) {
            bestGlobalScore = worstScenarioScoreForPC; bestInitialMove = pm;
        }
    }

    if (bestInitialMove.isJump) executeJump(bestInitialMove.fromR, bestInitialMove.fromC, bestInitialMove.toR, bestInitialMove.toC);
    else executeNormalMove(bestInitialMove.fromR, bestInitialMove.fromC, bestInitialMove.toR, bestInitialMove.toC);
}

function evaluateRevivalStrategicScore(vBoard, r, c, player) {
    const bCount = countPieces('B', vBoard); const nCount = countPieces('N', vBoard);
    let baseScore = evaluateBoardStateAdvanced(vBoard);
    let opponentJumps = getAllMandatoryJumps(player === 'N' ? 'B' : 'N', vBoard);
    if (nCount >= bCount) {
        if (opponentJumps.some(j => Math.floor((j.fromR + j.toR)/2) === r && Math.floor((j.fromC + j.toC)/2) === c)) baseScore += 5000;
    } else {
        if (r === (player === 'N' ? 3 : 1)) {
            baseScore += 3000;
            let isSafe = !opponentJumps.some(j => j.toR === r && j.toC === c) && !opponentJumps.some(j => Math.floor((j.fromR + j.toR)/2) === r && Math.floor((j.fromC + j.toC)/2) === c);
            if (isSafe) baseScore += 4000; if (vBoard[r + (player === 'N' ? 1 : -1)][c] === null) baseScore += 2500;
        }
    }
    return baseScore;
}

function evaluateBoardStateAdvanced(vBoard) {
    const bCount = countPieces('B', vBoard); const nCount = countPieces('N', vBoard);
    let materialScore = (nCount * 1000) - (bCount * 1000); let positionalScore = 0;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (vBoard[r][c] === 'N') positionalScore += (r * 50);
            else if (vBoard[r][c] === 'B') positionalScore -= ((4 - r) * 50);
        }
    }
    return materialScore + positionalScore;
}

resetBtn.addEventListener('click', () => {
    board = [['N', 'N', 'N', 'N', 'N'], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], ['B', 'B', 'B', 'B', 'B']];
    currentPlayer = 'B'; selectedPiece = null; isMultiJumpPhase = false; isRevivalPhase = false; lastMoves = { 'B': null, 'N': null };
    victoryScreen.classList.add('hidden'); addLog("La partita è stata azzerata. Il Bianco muove per primo."); createBoard();
});

gameModeSelect.addEventListener('change', () => {
    const val = gameModeSelect.value; if (val === 'pvp') gameMode = 'pvp'; else gameMode = 'pvc'; resetBtn.click();
});

createBoard();
