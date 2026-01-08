export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListener): void;
declare function getUserLang(): string;
declare function translateElement(lang: string, el: HTMLElement): void;
declare function translateElementAsync(lang: string, el: HTMLElement): Promise<void>;
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
        // Add the data-translate-key attribute for localization
        p.setAttribute('data-translate-key', 'publicLobbies.selectHint');
        translateElement(getUserLang(), p);
        summaryContent.appendChild(p);
        return;
    }

    const g = games[selectedIndex];
    const { current, max: localMax } = playersCount(g);

    // try to fetch authoritative settings for the selected lobby
    let max: number | undefined;
    try {
        const candidate = String(g.code ?? g.id ?? '');
        const query = (/^[A-Z0-9]{4}$/.test(candidate.toUpperCase())) ? `code=${encodeURIComponent(candidate.toUpperCase())}` : `gameId=${encodeURIComponent(candidate)}`;
        const res = await fetch(`/api/game/settings?${query}`, { credentials: 'include' });
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

    // prefer authoritative max from server; fall back to local info
    const finalMax = (typeof max === 'number') ? max : localMax;

    const infoList = document.createElement('div');
    infoList.className = 'public-lobby-info-list';

    const codeRow = document.createElement('div');
    codeRow.textContent = `Code: ${g.code ? String(g.code).toUpperCase() : '—'}`;
    infoList.appendChild(codeRow);
    const playersRow = document.createElement('div');
    playersRow.setAttribute('data-translate-key', 'publicLobbies.columns.players');
    await translateElementAsync(getUserLang(), playersRow);
    const playersText = (typeof finalMax === 'number') ? `${current}/${finalMax}` : String(current);
    playersRow.textContent = (playersRow.textContent || '') + `: ${playersText}`;
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
        // ensure user is logged in before attempting join
        const isLogged = await window.currentUserReady.then(() => Boolean(window.currentUser)).catch(() => false);
        if (!isLogged) {
            notify?.('Please log in to join a lobby.', { type: 'warning' });
            return;
        }
        // Decide candidate and navigate to the lobby page with the code/gameId in the URL.
        const candidate = String(g.code ?? g.id ?? '').trim();
        if (!candidate) {
            notify?.('Invalid game identifier.', { type: 'error' });
            return;
        }

        const isCode = /^[A-Z0-9]{4}$/.test(candidate.toUpperCase());
        const url = isCode
            ? `/lobby?code=${encodeURIComponent(candidate.toUpperCase())}`
            : `/lobby?gameId=${encodeURIComponent(candidate)}`;

        // navigate to lobby; the lobby page will pick the code from the URL and perform the join
        loadPage(url);
    } catch (err: any) {
        console.error('Join failed', err);
        notify?.(`Join failed: ${err?.message ?? err}`, { type: 'error' });
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
(() => {
    try {
        const cur = window.currentUser;
        let userData: any = null;
        if (cur)
            userData = cur;

        console.log('Public lobbies page user data:', userData);
        // If no user info found, return to home
        if (!userData) {
            loadPage('/home');
            notify?.('Please log in to access public lobbies.', { type: 'warning' });
            return;
        }
    } catch (err) {
        loadPage('/home');
    }
})();