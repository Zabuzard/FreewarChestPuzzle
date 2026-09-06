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
    var matches = npcRow.textContent.match(/\bTiefe\s+(\d+):/g);
    if (!matches || !matches.length) { return null; }

    var match = matches[matches.length - 1].match(/\bTiefe\s+(\d+):/);
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
        chestNpc.lastRotation = rotation;

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

function createPuzzleClock(positions, position, previousPosition, results, depth, lastRotation) {
    var size = 192;
    var center = size / 2;
    var radius = 74;
    var handRadius = 52;
    var labelRadius = 86;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.style.display = 'block';
    svg.style.marginTop = '0.4em';
    svg.style.backgroundColor = '#17191d';
    svg.style.border = '1px solid #3a3f47';
    svg.style.borderRadius = '50%';
    svg.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.35)';

    var depthResults = results && results[depth];
    var goodPositions = depthResults ? depthResults.good || [] : [];
    var badPositions = depthResults ? depthResults.bad || [] : [];

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
        line.setAttribute('stroke', '#e5e7eb');
        line.setAttribute('stroke-width', width);
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', opacity);

        svg.appendChild(line);
    }

    function addArc(from, to) {
        if (from === to) { return; }

        var clockwise = ((to - from + positions) % positions);
        var counterClockwise = positions - clockwise;
        var direction;

        if (clockwise === counterClockwise && lastRotation) {
            direction = lastRotation > 0 ? 1 : -1;
        } else {
            direction = clockwise <= counterClockwise ? 1 : -1;
        }

        var steps = direction === 1 ? clockwise : counterClockwise;

        if (steps === 0) { return; }

        var arcRadius = radius - 12;
        var start = getPoint(from, arcRadius);
        var end = getPoint(to, arcRadius);
        var largeArc = steps > positions / 2 ? 1 : 0;
        var sweep = direction === 1 ? 1 : 0;

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + start.x + ' ' + start.y + ' A ' + arcRadius + ' ' + arcRadius + ' 0 ' + largeArc + ' ' + sweep + ' ' + end.x + ' ' + end.y);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#818892');
        path.setAttribute('stroke-width', '9');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.3');

        svg.appendChild(path);

        var middlePosition = from + direction * (steps / 2);
        middlePosition = ((middlePosition % positions) + positions) % positions;
        var labelPoint = getPoint(middlePosition, arcRadius - 20);

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelPoint.x);
        text.setAttribute('y', labelPoint.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.style.setProperty('fill', direction === 1 ? '#f2b880' : '#c6a4d8', 'important');
        text.setAttribute('stroke', '#17191d');
        text.setAttribute('stroke-width', '3');
        text.setAttribute('paint-order', 'stroke');
        text.textContent = steps + (direction === 1 ? 'R' : 'L');

        svg.appendChild(text);

        var arrowPosition = from + direction * (steps - 0.6);
        arrowPosition = ((arrowPosition % positions) + positions) % positions;

        var arrowPoint = getPoint(arrowPosition, arcRadius);
        var arrowAngle = arrowPosition / positions * Math.PI * 2 - Math.PI / 2;
        var tangentAngle = arrowAngle + (direction === 1 ? Math.PI / 2 : -Math.PI / 2);
        var arrowSize = 8;

        var arrowLeft = {
            x: arrowPoint.x - Math.cos(tangentAngle - 0.5) * arrowSize,
            y: arrowPoint.y - Math.sin(tangentAngle - 0.5) * arrowSize
        };

        var arrowRight = {
            x: arrowPoint.x - Math.cos(tangentAngle + 0.5) * arrowSize,
            y: arrowPoint.y - Math.sin(tangentAngle + 0.5) * arrowSize
        };

        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', 'M ' + arrowPoint.x + ' ' + arrowPoint.y + ' L ' + arrowLeft.x + ' ' + arrowLeft.y + ' L ' + arrowRight.x + ' ' + arrowRight.y + ' Z');
        arrow.setAttribute('fill', direction === 1 ? '#f2b880' : '#c6a4d8');
        arrow.setAttribute('stroke', '#17191d');
        arrow.setAttribute('stroke-width', '2');
        arrow.setAttribute('paint-order', 'stroke');

        svg.appendChild(arrow);
    }

    addArc(previousPosition, position);

    for (var i = 0; i < positions; i++) {
        if (goodPositions.indexOf(i) !== -1) {
            addCircle(i, 9, '#6f9fc9', '#4f789e');
        } else if (badPositions.indexOf(i) !== -1) {
            addCircle(i, 9, '#b56f6f', '#8e4f4f');
        }
    }

    for (var i = 0; i < positions; i++) {
        var labelPoint = getPoint(i, labelRadius);

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelPoint.x);
        text.setAttribute('y', labelPoint.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', '#aeb4bd');
        text.textContent = i;

        svg.appendChild(text);
    }

    addHand(previousPosition, 0.25, 3);
    addHand(position, 0.9, 4);

    var centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', center);
    centerCircle.setAttribute('cy', center);
    centerCircle.setAttribute('r', 5);
    centerCircle.setAttribute('fill', '#f1f3f5');

    svg.appendChild(centerCircle);

    return svg;
}

function createMoveFeedback(feedback) {
    var container = document.createElement('div');

    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-start';
    container.style.gap = '0.4em';
    container.style.padding = '0.65em 0.8em';
    container.style.backgroundColor = '#202329';
    container.style.border = '1px solid #353a42';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';

    var label = document.createElement('div');
    label.textContent = 'Feedback';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.color = '#b8bec8';
    label.style.letterSpacing = '0.02em';

    container.appendChild(label);

    var circles = document.createElement('div');
    circles.style.display = 'flex';
    circles.style.alignItems = 'center';
    circles.style.gap = '0.35em';

    for (var i = 0; i < feedback.length; i++) {
        var circle = document.createElement('div');

        circle.style.width = '32px';
        circle.style.height = '32px';
        circle.style.borderRadius = '50%';
        circle.style.backgroundColor = feedback[i] === 'Klick' ? '#6f9fc9' : '#b56f6f';
        circle.style.border = '2px solid ' + (feedback[i] === 'Klick' ? '#4f789e' : '#8e4f4f');
        circle.style.boxSizing = 'border-box';
        circle.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.25)';

        circles.appendChild(circle);
    }

    container.appendChild(circles);

    return container;
}

function displayPuzzleState(npcRow, npcId, depth, positions, position, previousPosition, results, lastRotation) {
    if (npcRow.querySelector('.freewar-chest-puzzle-info')) { return; }

    var info = document.createElement('div');

    info.className = 'freewar-chest-puzzle-info';
    info.style.clear = 'both';
    info.style.marginTop = '0.5em';
    info.style.padding = '0.45em 0.6em';
    info.style.border = '1px solid #353a42';
    info.style.backgroundColor = '#202329';
    info.style.color = '#aeb4bd';
    info.style.borderRadius = '8px';

    // var text = 'Chest-NPC ID: ' + npcId + ' | Depth: ' + depth + ' | Positions: ' + positions + ' | Previous Position: ' + previousPosition + ' | Position: ' + position;

    // if (results) {
    //     var depths = Object.keys(results);

    //     for (var i = 0; i < depths.length; i++) {
    //         var resultDepth = depths[i];
    //         var result = results[resultDepth];

    //         text += ' | Depth ' + resultDepth + ': Good [' + result.good.join(', ') + '] Bad [' + result.bad.join(', ') + ']';
    //     }
    // }

    // info.textContent = text;
    // npcRow.appendChild(info);

    var clockContainer = document.createElement('div');
    clockContainer.style.display = 'flex';
    clockContainer.style.alignItems = 'flex-start';
    clockContainer.style.gap = '1em';
    clockContainer.style.padding = '0.25em 0';

    var clockColumn = document.createElement('div');
    clockColumn.style.display = 'flex';
    clockColumn.style.flexDirection = 'column';
    clockColumn.style.alignItems = 'center';

    var sideColumn = document.createElement('div');
    sideColumn.style.display = 'flex';
    sideColumn.style.flexDirection = 'column';
    sideColumn.style.alignItems = 'flex-start';
    sideColumn.style.gap = '0.8em';
    sideColumn.style.marginTop = '0.6em';

    var depthLabel = document.createElement('div');
    depthLabel.textContent = 'Depth ' + depth;
    depthLabel.style.fontSize = '13px';
    depthLabel.style.fontWeight = '600';
    depthLabel.style.color = '#d4d8de';
    depthLabel.style.padding = '0.4em 0.7em';
    depthLabel.style.backgroundColor = '#202329';
    depthLabel.style.border = '1px solid #353a42';
    depthLabel.style.borderRadius = '7px';

    clockColumn.appendChild(createPuzzleClock(positions, position, previousPosition, results, depth, lastRotation));

    sideColumn.appendChild(depthLabel);
    sideColumn.appendChild(createMoveFeedback(getMoveFeedback(npcRow)));

    clockContainer.appendChild(clockColumn);
    clockContainer.appendChild(sideColumn);

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
                lastRotation: 0,
                results: {},
                state: 'unknown',
                lastSeen: now
            };
            changed = true;
        } else {
            chestNpcs[npcId].lastSeen = now;

            var failed = npcRow.textContent.indexOf('Du musst noch mal von vorn beginnen.') !== -1;

            if (failed) {
                addKnownPosition(chestNpcs[npcId], chestNpcs[npcId].depth, chestNpcs[npcId].position, 'bad');
                chestNpcs[npcId].position = 0;
                chestNpcs[npcId].previousPosition = 0;
                changed = true;
            }

            if (chestNpcs[npcId].depth !== depth) {
                if (!failed) {
                    if (chestNpcs[npcId].depth < depth) {
                        addKnownPosition(chestNpcs[npcId], chestNpcs[npcId].depth, chestNpcs[npcId].position, 'good');
                    } else {
                        addKnownPosition(chestNpcs[npcId], depth, chestNpcs[npcId].position, 'bad');
                    }
                }

                chestNpcs[npcId].depth = depth;
                chestNpcs[npcId].position = 0;
                chestNpcs[npcId].previousPosition = 0;
                chestNpcs[npcId].lastRotation = 0;
                changed = true;
            }

            if (chestNpcs[npcId].positions === undefined || chestNpcs[npcId].positions === null) {
                if (positions !== null) {
                    chestNpcs[npcId].positions = positions;
                    changed = true;
                }
            }

            if (chestNpcs[npcId].position === undefined || chestNpcs[npcId].position === null) {
                chestNpcs[npcId].position = 0;
                changed = true;
            }

            if (chestNpcs[npcId].previousPosition === undefined || chestNpcs[npcId].previousPosition === null) {
                chestNpcs[npcId].previousPosition = 0;
                changed = true;
            }

            if (chestNpcs[npcId].lastRotation === undefined || chestNpcs[npcId].lastRotation === null) {
                chestNpcs[npcId].lastRotation = 0;
                changed = true;
            }

            if (!chestNpcs[npcId].results) {
                chestNpcs[npcId].results = {};
                changed = true;
            }
        }

        if (chestNpcs[npcId].positions !== null && chestNpcs[npcId].positions !== undefined) {
            addRotationListeners(npcRow, npcId);
            displayPuzzleState(npcRow, npcId, depth, chestNpcs[npcId].positions, chestNpcs[npcId].position, chestNpcs[npcId].previousPosition, chestNpcs[npcId].results, chestNpcs[npcId].lastRotation);
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
