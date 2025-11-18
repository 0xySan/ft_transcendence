export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject, options?: boolean): void;

const multiplayerButton = document.getElementById("lobby-multiplayer-button") as HTMLButtonElement | null;
const customGameButton = document.getElementById("lobby-custom-game-button") as HTMLButtonElement | null;
const tournamentButton = document.getElementById("lobby-tournament-button") as HTMLButtonElement | null;
const multiplayerTab = document.getElementById("lobby-multiplayer-tab") as HTMLDivElement | null;
const customGameTab = document.getElementById("lobby-custom-game-tab") as HTMLDivElement | null;
const tournamentTab = document.getElementById("lobby-tournament-tab") as HTMLDivElement | null;

function deactivateOtherButtonsThan(button: HTMLButtonElement | null) {
    if (!button) return;
    if (multiplayerButton && multiplayerButton !== button) multiplayerButton.classList.remove("current-mode");
    if (customGameButton && customGameButton !== button) customGameButton.classList.remove("current-mode");
    if (tournamentButton && tournamentButton !== button) tournamentButton.classList.remove("current-mode");
}

function showCorrectTab(tab: HTMLDivElement | null) {
    if (!tab) return;
    if (multiplayerTab && multiplayerTab !== tab) multiplayerTab.classList.add("unloaded");
    if (customGameTab && customGameTab !== tab) customGameTab.classList.add("unloaded");
    if (tournamentTab && tournamentTab !== tab) tournamentTab.classList.add("unloaded");
    console.log("Showing tab:", tab.id);
    tab.classList.remove("unloaded");
}

function handleMultiplayerButtonClick(evt: Event) {
    console.log("0");
    const button = evt.currentTarget as HTMLButtonElement | null;
    console.log("1");
    if (!button) return;
    console.log("2");
    if (button.classList.contains("current-mode")) return;
    console.log("Multiplayer button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    showCorrectTab(multiplayerTab);
}

function handleCustomGameButtonClick(evt: Event) {
    const button = evt.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    if (button.classList.contains("current-mode")) return;
    console.log("Custom game button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    showCorrectTab(customGameTab);
}

function handleTournamentButtonClick(evt: Event) {
    const button = evt.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    if (button.classList.contains("current-mode")) return;
    console.log("Tournament button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    showCorrectTab(tournamentTab);
}

addListener(multiplayerButton, 'click', handleMultiplayerButtonClick);
addListener(customGameButton, 'click', handleCustomGameButtonClick);
addListener(tournamentButton, 'click', handleTournamentButtonClick);
console.log(multiplayerTab, customGameTab, tournamentTab);