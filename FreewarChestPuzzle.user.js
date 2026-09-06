// ==UserScript==
// @name        FreewarChestPuzzle
// @namespace   Zabuza
// @description Visualization for the Chest Puzzles in freewar.de
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

var STORAGE_KEY = 'FreewarChestPuzzle_NPCs';
var COOKIE_KEY = 'FreewarChestPuzzle_NPCs';
var STORAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    return npcRow.textContent.indexOf('Kiste aufbrechen') !== -1;
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

function getMoveFeedback(npcRow) {
    var text = npcRow.textContent;
    var start = text.indexOf('Dabei hörst du');

    if (start === -1) { return []; }

    var feedbackText = text.substring(start);
    var matches = feedbackText.match(/\b(Klick|Klack)\b/g);

    return matches || [];
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
        var previousPosition = chestNpc.position;
        var nextDepth = depth;

        if (rotation !== 0) {
            nextDepth = null;
        }

        chestNpc.position = ((position + rotation) % chestNpc.positions + chestNpc.positions) % chestNpc.positions;
        chestNpc.previousPosition = previousPosition;

        if (nextDepth !== null && nextDepth !== depth) {
            chestNpc.position = 0;
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

function createPuzzleClock(positions, position, previousPosition, results) {
    var size = 240;
    var center = size / 2;
    var radius = 92;
    var handRadius = 72;
    var labelRadius = 108;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.style.display = 'block';
    svg.style.marginTop = '0.5em';
    svg.style.backgroundColor = '#1e1e1e';
    svg.style.border = '1px solid #444';
    svg.style.borderRadius = '50%';

    var currentResult = results && results[position];
    var goodPositions = results && results.good ? results.good : [];
    var badPositions = results && results.bad ? results.bad : [];

    if (results) {
        var depthResults = results[Object.keys(results).find(function(key) {
            return results[key] && results[key].good && results[key].bad;
        })];
        if (depthResults) {
            goodPositions = depthResults.good || [];
            badPositions = depthResults.bad || [];
        }
    }

    function getPoint(position, distance) {
        var angle = position / positions * Math.PI * 2 - Math.PI / 2;
        return {
            x: center + Math.cos(angle) * distance,
            y: center + Math.sin(angle) * distance
        };
    }

    function addCircle(position, radiusValue, fill, stroke) {
        var point = getPoint(position, radius);

        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        circle.setAttribute('r', radiusValue);
        circle.setAttribute('fill', fill);

        if (stroke) {
            circle.setAttribute('stroke', stroke);
            circle.setAttribute('stroke-width', '1');
        }

        svg.appendChild(circle);
    }

    function addHand(position, opacity, width) {
        var point = getPoint(position, handRadius);

        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', center);
        line.setAttribute('y1', center);
        line.setAttribute('x2', point.x);
        line.setAttribute('y2', point.y);
        line.setAttribute('stroke', '#e0e0e0');
        line.setAttribute('stroke-width', width);
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', opacity);

        svg.appendChild(line);
    }

    function addArc(from, to) {
        if (from === to) { return; }

        var clockwise = ((to - from + positions) % positions);
        var counterClockwise = positions - clockwise;
        var direction = clockwise <= counterClockwise ? 1 : -1;
        var steps = direction === 1 ? clockwise : counterClockwise;

        if (steps === 0) { return; }

        var start = getPoint(from, radius - 15);
        var end = getPoint(to, radius - 15);
        var largeArc = steps > positions / 2 ? 1 : 0;
        var sweep = direction === 1 ? 1 : 0;

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + start.x + ' ' + start.y + ' A ' + (radius - 15) + ' ' + (radius - 15) + ' 0 ' + largeArc + ' ' + sweep + ' ' + end.x + ' ' + end.y);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#666');
        path.setAttribute('stroke-width', '12');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.35');

        svg.appendChild(path);
    }

    addArc(previousPosition, position);

    for (var i = 0; i < positions; i++) {
        if (goodPositions.indexOf(i) !== -1) {
            addCircle(i, 7, '#6f9fc9', '#4f789e');
        } else if (badPositions.indexOf(i) !== -1) {
            addCircle(i, 7, '#b56f6f', '#8e4f4f');
        }
    }

    for (var i = 0; i < positions; i++) {
        var labelPoint = getPoint(i, labelRadius);

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelPoint.x);
        text.setAttribute('y', labelPoint.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '13');
        text.setAttribute('fill', '#d0d0d0');
        text.textContent = i;

        svg.appendChild(text);
    }

    addHand(previousPosition, 0.25, 5);
    addHand(position, 0.9, 6);

    var centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', center);
    centerCircle.setAttribute('cy', center);
    centerCircle.setAttribute('r', 6);
    centerCircle.setAttribute('fill', '#e0e0e0');

    svg.appendChild(centerCircle);

    return svg;
}

function createMoveFeedback(feedback) {
    var container = document.createElement('div');

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '0.4em';
    container.style.marginTop = '0.5em';
    container.style.marginLeft = '0.75em';

    for (var i = 0; i < feedback.length; i++) {
        var circle = document.createElement('div');

        circle.style.width = '14px';
        circle.style.height = '14px';
        circle.style.borderRadius = '50%';
        circle.style.backgroundColor = feedback[i] === 'Klick' ? '#6f9fc9' : '#b56f6f';
        circle.style.border = '1px solid ' + (feedback[i] === 'Klick' ? '#4f789e' : '#8e4f4f');
        circle.style.boxSizing = 'border-box';

        container.appendChild(circle);
    }

    return container;
}

function displayPuzzleState(npcRow, npcId, depth, positions, position, previousPosition, results) {
    if (npcRow.querySelector('.freewar-chest-puzzle-info')) { return; }

    var info = document.createElement('div');

    info.className = 'freewar-chest-puzzle-info';
    info.style.clear = 'both';
    info.style.marginTop = '0.5em';
    info.style.padding = '0.25em';
    info.style.border = '1px solid #999';
    info.style.backgroundColor = '#eee';
    info.style.color = '#000';

    var text = 'Chest-NPC ID: ' + npcId + ' | Depth: ' + depth + ' | Positions: ' + positions + ' | Previous Position: ' + previousPosition + ' | Position: ' + position;

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

    var clockContainer = document.createElement('div');
    clockContainer.style.display = 'flex';
    clockContainer.style.alignItems = 'center';

    clockContainer.appendChild(createPuzzleClock(positions, position, previousPosition, results));
    clockContainer.appendChild(createMoveFeedback(getMoveFeedback(npcRow)));

    npcRow.appendChild(clockContainer);
}

function processChestNpcs() {
    var chestNpcs = loadChestNpcs();
    var changed = false;
    var now = Date.now();

    for (var storedNpcId in chestNpcs) {
        if (!Object.prototype.hasOwnProperty.call(chestNpcs, storedNpcId)) { continue; }

        if (chestNpcs[storedNpcId].lastSeen && now - chestNpcs[storedNpcId].lastSeen > STORAGE_MAX_AGE_MS) {
            delete chestNpcs[storedNpcId];
            changed = true;
        }
    }

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
                position: 0,
                previousPosition: 0,
                results: {},
                state: 'unknown',
                lastSeen: now
            };
            changed = true;
        } else {
            chestNpcs[npcId].lastSeen = now;

            if (npcRow.textContent.indexOf('Du musst noch mal von vorn beginnen.') !== -1) {
                addKnownPosition(chestNpcs[npcId], depth, chestNpcs[npcId].position, 'bad');
                chestNpcs[npcId].position = 0;
                chestNpcs[npcId].previousPosition = 0;
                changed = true;
            }

            if (chestNpcs[npcId].depth !== depth) {
                if (chestNpcs[npcId].depth < depth) {
                    addKnownPosition(chestNpcs[npcId], chestNpcs[npcId].depth, chestNpcs[npcId].position, 'good');
                } else {
                    addKnownPosition(chestNpcs[npcId], depth, chestNpcs[npcId].position, 'bad');
                }

                chestNpcs[npcId].depth = depth;
                chestNpcs[npcId].position = 0;
                chestNpcs[npcId].previousPosition = 0;
                changed = true;
            }

            if (chestNpcs[npcId].positions === null && positions !== null) {
                chestNpcs[npcId].positions = positions;
                changed = true;
            }

            if (chestNpcs[npcId].position === undefined || chestNpcs[npcId].position === null) {
                chestNpcs[npcId].position = 0;
                changed = true;
            }

            if (chestNpcs[npcId].previousPosition === undefined || chestNpcs[npcId].previousPosition === null) {
                chestNpcs[npcId].previousPosition = 0;
                changed = true;
            }

            if (!chestNpcs[npcId].results) {
                chestNpcs[npcId].results = {};
                changed = true;
            }
        }

        if (chestNpcs[npcId].positions !== null) {
            addRotationListeners(npcRow, npcId);
            displayPuzzleState(npcRow, npcId, depth, chestNpcs[npcId].positions, chestNpcs[npcId].position, chestNpcs[npcId].previousPosition, chestNpcs[npcId].results);
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
