export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject, options?: boolean): void;

const multiplayerButton = document.getElementById("lobby-multiplayer-button") as HTMLButtonElement | null;
const customGameButton = document.getElementById("lobby-custom-game-button") as HTMLButtonElement | null;
const tournamentButton = document.getElementById("lobby-tournament-button") as HTMLButtonElement | null;

function deactivateOtherButtonsThan(button: HTMLButtonElement | null) {
    if (!button) return;
    if (multiplayerButton && multiplayerButton !== button) multiplayerButton.classList.remove("current-mode");
    if (customGameButton && customGameButton !== button) customGameButton.classList.remove("current-mode");
    if (tournamentButton && tournamentButton !== button) tournamentButton.classList.remove("current-mode");
}

function handleMultiplayerButtonClick(evt: Event) {
    const button = evt.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    if (button.classList.contains("current-mode")) return;
    console.log("Multiplayer button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    // TODO: Implement the switching of divs using the unloaded CSS class
}

function handleCustomGameButtonClick(evt: Event) {
    const button = evt.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    if (button.classList.contains("current-mode")) return;
    console.log("Custom game button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    // TODO: Implement the switching of divs using the unloaded CSS class
}

function handleTournamentButtonClick(evt: Event) {
    const button = evt.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    if (button.classList.contains("current-mode")) return;
    console.log("Tournament button clicked");
    deactivateOtherButtonsThan(button);
    button.classList.add("current-mode");
    // TODO: Implement the switching of divs using the unloaded CSS class
}

addListener(multiplayerButton, 'click', handleMultiplayerButtonClick);
addListener(customGameButton, 'click', handleCustomGameButtonClick);
addListener(tournamentButton, 'click', handleTournamentButtonClick);