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

function displayNpcId(npcRow, npcId, wasAlreadyMemorized) {
    if (npcRow.querySelector('.freewar-chest-puzzle-info')) { return; }

    var info = document.createElement('div');

    info.className = 'freewar-chest-puzzle-info';
    info.style.clear = 'both';
    info.style.marginTop = '0.5em';
    info.style.padding = '0.25em';
    info.style.border = '1px solid #999';
    info.style.backgroundColor = '#eee';
    info.style.color = '#000';

    info.textContent = 'Chest-NPC ID: ' + npcId + (wasAlreadyMemorized ? ' (memorized)' : ' (new)');
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

        var wasAlreadyMemorized = Object.prototype.hasOwnProperty.call(chestNpcs, npcId);

        if (!wasAlreadyMemorized) {
            chestNpcs[npcId] = {
                id: npcId,
                state: 'unknown',
                progress: 0,
                lastSeen: Date.now()
            };
            changed = true;
        } else {
            chestNpcs[npcId].lastSeen = Date.now();
            changed = true;
        }

        displayNpcId(npcRow, npcId, wasAlreadyMemorized);
    }

    if (changed) { saveChestNpcs(chestNpcs); }
}

function init() { processChestNpcs(); }

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
