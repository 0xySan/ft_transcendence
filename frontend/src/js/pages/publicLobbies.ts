export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListener): void;
declare function notify(message: string, options?: { type?: string }): void;
declare function loadPage(url: string): void;

type RawGame = Record<string, any>;

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

const listContainer = getEl<HTMLDivElement>('public-lobby-list');
const summaryContent = getEl<HTMLDivElement>('public-lobby-summary-content');
const updateBtn = getEl<HTMLButtonElement>('public-lobbies-update-btn');

let games: RawGame[] = [];
let selectedIndex = -1;
let lastUpdateTs = 0;
let cooldownTimer: number | null = null;

function playersCount(g: RawGame): { current: number; max?: number } {
    // players might be an array, object, or serialized form
    const p = g.players;
    let current = 0;
    if (Array.isArray(p)) current = p.length;
    else if (p instanceof Array) current = p.length;
    else if (p && typeof p === 'object') current = Object.keys(p).length;
    else if (typeof p === 'number') current = p;
    else if (typeof p === 'string') current = Number(p) || 0;

    const max = typeof g.maxPlayers === 'number' ? g.maxPlayers : undefined;
    return { current, max };
}

function gameKey(g: RawGame): string {
    return String(g.code ?? g.id ?? '');
}

function createEntryElement(g: RawGame, idx: number): HTMLDivElement {
    const { current, max } = playersCount(g);
    console.log('Creating entry element for game', g, 'with players', current, max);
    const entry = document.createElement('div');
    entry.className = 'public-lobby-entry';
    entry.dataset.key = gameKey(g);

    if (idx === selectedIndex) entry.classList.add('selected');

    const codeDiv = document.createElement('div');
    codeDiv.className = 'public-lobby-title font-poppins-semibold';
    codeDiv.textContent = g.code ? String(g.code).toUpperCase() : `Game ${idx + 1}`;

    const ownerDiv = document.createElement('div');
    ownerDiv.className = 'public-lobby-subtitle';
    // intentionally not showing owner per request
    ownerDiv.textContent = '';

    const playersDiv = document.createElement('div');
    playersDiv.className = 'public-lobby-players';
    playersDiv.textContent = max ? `${current}/${max}` : String(current);

    entry.appendChild(codeDiv);
    entry.appendChild(ownerDiv);
    entry.appendChild(playersDiv);

    entry.addEventListener('click', () => {
        const key = entry.dataset.key;
        const idxNow = Array.from(listContainer.children).findIndex((c) => (c as HTMLElement).dataset?.key === key);
        if (idxNow >= 0) selectLobby(idxNow);
    });

    return entry;
}

function updateList(newGames: RawGame[]): void {
    // map existing elements by key
    const existingMap = new Map<string, HTMLDivElement>();
    Array.from(listContainer.children).forEach((child) => {
        const el = child as HTMLDivElement;
        const k = (el as HTMLElement).dataset?.key;
        if (k) existingMap.set(k, el);
    });

    // iterate desired order, reuse, update or create
    newGames.forEach((g, idx) => {
        const k = gameKey(g);
        const existing = existingMap.get(k);
        const desiredBefore = listContainer.children[idx] as HTMLElement | undefined;

        if (existing) {
            // update players text if changed
            const playersEl = existing.querySelector('.public-lobby-players');
            const { current, max } = playersCount(g);
            const newText = max ? `${current}/${max}` : String(current);
            if (playersEl && playersEl.textContent !== newText) playersEl.textContent = newText;

            // move element to correct position if necessary
            if (desiredBefore !== existing) {
                if (desiredBefore) listContainer.insertBefore(existing, desiredBefore);
                else listContainer.appendChild(existing);
            }
            existingMap.delete(k);
        } else {
            const newEl = createEntryElement(g, idx);
            if (desiredBefore) listContainer.insertBefore(newEl, desiredBefore);
            else listContainer.appendChild(newEl);
        }
    });

    // remove leftovers
    for (const leftover of existingMap.values()) leftover.remove();

    // update selection index based on selected key
    if (selectedIndex >= 0) {
        const selectedKey = ((listContainer.children[selectedIndex] as HTMLElement)?.dataset?.key) ?? null;
        if (!selectedKey) selectedIndex = -1;
    }
}

function updateSelectionVisual(): void {
    Array.from(listContainer.children).forEach((child, i) => {
        const el = child as HTMLElement;
        if (i === selectedIndex) el.classList.add('selected');
        else el.classList.remove('selected');
    });
}

async function loadAndRenderSummary(): Promise<void> {
    summaryContent.innerHTML = '';
    if (selectedIndex < 0 || selectedIndex >= games.length) {
        const p = document.createElement('p');
        p.textContent = 'Select a lobby to see details.';
        summaryContent.appendChild(p);
        return;
    }

    const g = games[selectedIndex];
    const { current } = playersCount(g);

    // try to fetch authoritative settings for the selected lobby
    let max: number | undefined;
    try {
        const candidate = String(g.code ?? g.id ?? '');
        const query = (/^[A-Z0-9]{4}$/.test(candidate.toUpperCase())) ? `code=${encodeURIComponent(candidate.toUpperCase())}` : `gameId=${encodeURIComponent(candidate)}`;
        const res = await fetch(`/api/game/settings?${query}`);
        if (res.ok) {
            const data = await res.json();
            const settings = data?.settings;
            if (settings && settings.game && typeof settings.game.maxPlayers === 'number') {
                max = settings.game.maxPlayers;
            }
        }
    } catch (e) {
        // ignore fetch errors; we'll fallback to local info
        console.error('Failed to fetch lobby settings', e);
    }

    const infoList = document.createElement('div');
    infoList.className = 'public-lobby-info-list';

    const codeRow = document.createElement('div');
    codeRow.textContent = `Code: ${g.code ? String(g.code).toUpperCase() : '—'}`;
    infoList.appendChild(codeRow);
    const playersRow = document.createElement('div');
    playersRow.textContent = (typeof max === 'number') ? `Players: ${current} / ${max}` : `Players: ${current}`;
    infoList.appendChild(playersRow);

    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'JOIN';
    joinBtn.className = 'auth-btn public-lobby-join-btn';
    joinBtn.addEventListener('click', () => joinLobby(g));

    summaryContent.appendChild(infoList);
    summaryContent.appendChild(joinBtn);
}

async function fetchGames(): Promise<void> {
    try {
        const res = await fetch('/api/game/');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('Public lobbies fetched:', data);
            games = Array.isArray(data.games) ? data.games : [];
            // preserve selection by key when possible
            const prevSelectedKey = (selectedIndex >= 0 && listContainer.children[selectedIndex])
                ? (listContainer.children[selectedIndex] as HTMLElement).dataset?.key ?? null
                : null;

                updateList(games);

                // restore selection
                if (prevSelectedKey) {
                    const idx = Array.from(listContainer.children).findIndex((c) => (c as HTMLElement).dataset?.key === prevSelectedKey);
                    selectedIndex = idx >= 0 ? idx : (games.length ? 0 : -1);
                } else {
                    selectedIndex = games.length ? 0 : -1;
                }

                updateSelectionVisual();
                loadAndRenderSummary();
    } catch (err: any) {
        console.error('Failed to fetch public games', err);
        notify?.(`Failed to fetch public lobbies: ${err.message ?? err}`, { type: 'error' });
    }
}

function selectLobby(idx: number): void {
    if (idx < 0 || idx >= games.length) return;
    selectedIndex = idx;
    updateSelectionVisual();
    loadAndRenderSummary();
}

async function joinLobby(g: RawGame): Promise<void> {
    try {
        // Decide payload like lobbySocket.joinGame: if a 4-char code, send as code, otherwise as gameId
        const candidate = String(g.code ?? g.id ?? '');
        const payload = (/^[A-Z0-9]{4}$/.test(candidate.toUpperCase()))
            ? { code: candidate.toUpperCase() }
            : { gameId: candidate };

        const res = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const gameId = data.gameId;
        const authToken = data.authToken;

        if (!authToken) throw new Error('Missing auth token');

        // Store token so the lobby page can use it to connect the websocket if needed
        try {
            sessionStorage.setItem('pendingGameAuthToken', authToken);
            if (gameId) sessionStorage.setItem('pendingGameId', gameId);
        } catch (e) {
            /* ignore storage errors */
        }

        notify?.('Joined lobby successfully.', { type: 'success' });
        // navigate to lobby page where websocket/connect logic lives
        loadPage('/lobby');
    } catch (err: any) {
        console.error('Join failed', err);
        notify?.(`Join failed: ${err.message ?? err}`, { type: 'error' });
    }
}

function startCooldown(): void {
    lastUpdateTs = Date.now();
    updateBtn.disabled = true;
    let remaining = 10;
    const originalTitle = updateBtn.title;
    updateBtn.title = `Update (${remaining})`;
    cooldownTimer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            if (cooldownTimer) window.clearInterval(cooldownTimer);
            cooldownTimer = null;
            updateBtn.disabled = false;
            updateBtn.title = originalTitle;
        } else {
            updateBtn.title = `Update (${remaining})`;
        }
    }, 1000) as unknown as number;
}

addListener(updateBtn, 'click', () => {
    const now = Date.now();
    if (now - lastUpdateTs < 10_000) return;
    fetchGames();
    startCooldown();
});

// auto-load
fetchGames();
