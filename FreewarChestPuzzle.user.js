// ==UserScript==
// @name        FreewarChestPuzzle
// @namespace   Zabuza
// @description Visualization for the Chest Puzzles in freewar.de
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

var STORAGE_KEY = 'FreewarChestPuzzle_NPCs';
var COOKIE_KEY = 'FreewarChestPuzzle_NPCs';

function loadChestNpcs() {
    var value;
    try {
        value = window.localStorage.getItem(STORAGE_KEY);

        if (value) {
            var parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        }
    } catch (e) { }
    try {
        var cookies = document.cookie.split(';');

        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();

            if (cookie.indexOf(COOKIE_KEY + '=') === 0) {
                value = decodeURIComponent(cookie.substring((COOKIE_KEY + '=').length));
                var parsedCookie = JSON.parse(value);
                if (parsedCookie && typeof parsedCookie === 'object') {
                    return parsedCookie;
                }
            }
        }
    } catch (e) {}
    return {};
}

function saveChestNpcs(chestNpcs) {
    var value = JSON.stringify(chestNpcs);
    try {
        window.localStorage.setItem(STORAGE_KEY, value);
        return;
    } catch (e) {}
    try {
        document.cookie = COOKIE_KEY + '=' + encodeURIComponent(value) + '; path=/';
    } catch (e) {}
}

function getNpcId(npcRow) {
    if (!npcRow || !npcRow.id) { return null; }
    var match = npcRow.id.match(/^npc-(\d+)$/);
    return match ? match[1] : null;
}

function isChestNpc(npcRow) {
    var links = npcRow.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
        if (links[i].textContent.trim() === 'Kiste aufbrechen') {
            return true;
        }
    }
    return false;
}

function getDepth(npcRow) {
    var match = npcRow.textContent.match(/\bTiefe\s+(\d+):/);
    return match ? parseInt(match[1], 10) : null;
}

function getPositions(npcRow) {
    var links = npcRow.getElementsByTagName('a');
    var maxRotation = 0;

    for (var i = 0; i < links.length; i++) {
        var match = links[i].href.match(/[?&]rot=(-?\d+)/);
        if (!match) { continue; }

        var rotation = Math.abs(parseInt(match[1], 10));
        if (rotation > maxRotation) {
            maxRotation = rotation;
        }
    }

    return maxRotation > 0 ? maxRotation * 2 : null;
}

function addKnownPosition(chestNpc, depth, position, type) {
    if (!chestNpc.results) {
        chestNpc.results = {};
    }

    if (!chestNpc.results[depth]) {
        chestNpc.results[depth] = {
            good: [],
            bad: []
        };
    }

    var positions = chestNpc.results[depth][type];

    if (positions.indexOf(position) === -1) {
        positions.push(position);
    }
}

function addRotationListener(link, npcId, rotation) {
    link.addEventListener('click', function() {
        var chestNpcs = loadChestNpcs();
        var chestNpc = chestNpcs[npcId];
        if (!chestNpc || !chestNpc.positions) { return; }

        var depth = chestNpc.depth;
        var position = chestNpc.position;
        var nextDepth = depth;

        if (rotation !== 0) {
            nextDepth = null;
        }

        chestNpc.position = ((position - 1 + rotation) % chestNpc.positions + chestNpc.positions) % chestNpc.positions + 1;

        if (nextDepth !== null && nextDepth !== depth) {
            chestNpc.position = 1;
        }

        saveChestNpcs(chestNpcs);
    });
}

function addRotationListeners(npcRow, npcId) {
    var links = npcRow.getElementsByTagName('a');

    for (var i = 0; i < links.length; i++) {
        var match = links[i].href.match(/[?&]rot=(-?\d+)/);
        if (!match || links[i].dataset.freewarChestPuzzleRotation) { continue; }

        var rotation = parseInt(match[1], 10);
        links[i].dataset.freewarChestPuzzleRotation = 'true';
        addRotationListener(links[i], npcId, rotation);
    }
}

function displayPuzzleState(npcRow, npcId, depth, positions, position, results) {
    if (npcRow.querySelector('.freewar-chest-puzzle-info')) { return; }

    var info = document.createElement('div');

    info.className = 'freewar-chest-puzzle-info';
    info.style.clear = 'both';
    info.style.marginTop = '0.5em';
    info.style.padding = '0.25em';
    info.style.border = '1px solid #999';
    info.style.backgroundColor = '#eee';
    info.style.color = '#000';

    var text = 'Chest-NPC ID: ' + npcId + ' | Depth: ' + depth + ' | Positions: ' + positions + ' | Position: ' + position;

    if (results) {
        var depths = Object.keys(results);

        for (var i = 0; i < depths.length; i++) {
            var resultDepth = depths[i];
            var result = results[resultDepth];

            text += ' | Depth ' + resultDepth + ': Good [' + result.good.join(', ') + '] Bad [' + result.bad.join(', ') + ']';
        }
    }

    info.textContent = text;
    npcRow.appendChild(info);
}

function processChestNpcs() {
    var chestNpcs = loadChestNpcs();
    var changed = false;

    var npcRows = document.querySelectorAll('.listusersrow.npcrow');

    for (var i = 0; i < npcRows.length; i++) {
        var npcRow = npcRows[i];
        if (!isChestNpc(npcRow)) { continue; }

        var npcId = getNpcId(npcRow);
        if (!npcId) { continue; }

        var depth = getDepth(npcRow);
        if (depth === null) { continue; }

        var positions = getPositions(npcRow);
        var wasAlreadyMemorized = Object.prototype.hasOwnProperty.call(chestNpcs, npcId);

        if (!wasAlreadyMemorized) {
            chestNpcs[npcId] = {
                id: npcId,
                depth: depth,
                positions: positions,
                position: 1,
                results: {},
                state: 'unknown'
            };
            changed = true;
        } else {
            if (chestNpcs[npcId].depth !== depth) {
                if (chestNpcs[npcId].depth < depth) {
                    addKnownPosition(chestNpcs[npcId], chestNpcs[npcId].depth, chestNpcs[npcId].position, 'good');
                } else {
                    addKnownPosition(chestNpcs[npcId], chestNpcs[npcId].depth, chestNpcs[npcId].position, 'bad');
                }

                chestNpcs[npcId].depth = depth;
                chestNpcs[npcId].position = 1;
                changed = true;
            }

            if (chestNpcs[npcId].positions === null && positions !== null) {
                chestNpcs[npcId].positions = positions;
                changed = true;
            }

            if (!chestNpcs[npcId].position) {
                chestNpcs[npcId].position = 1;
                changed = true;
            }

            if (!chestNpcs[npcId].results) {
                chestNpcs[npcId].results = {};
                changed = true;
            }
        }

        if (chestNpcs[npcId].positions !== null) {
            addRotationListeners(npcRow, npcId);
            displayPuzzleState(npcRow, npcId, depth, chestNpcs[npcId].positions, chestNpcs[npcId].position, chestNpcs[npcId].results);
        }
    }

    if (changed) { saveChestNpcs(chestNpcs); }
}

function init() { processChestNpcs(); }

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
