export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;

const multiplayerButton = document.getElementById("multiplayer-button") as HTMLButtonElement | null;
const customGameButton = document.getElementById("custom-game-button") as HTMLButtonElement | null;
const tournamentButton = document.getElementById("tournament-button") as HTMLButtonElement | null;

function deactivateOtherButtonsThan(button: HTMLButtonElement) {
    if (!button)
        return;
    if (button != multiplayerButton && multiplayerButton)
        multiplayerButton.removeAttribute("current-mode");
    if (button != customGameButton && customGameButton)
        customGameButton.removeAttribute("current-mode");
    if (button != tournamentButton && tournamentButton)
        tournamentButton.removeAttribute("current-mode");
}

function handleMultiplayerButtonClick(button: HTMLButtonElement) {
    if (multiplayerButton?.hasAttribute("current-mode"))
        return;
    deactivateOtherButtonsThan(button);
    button.setAttribute("current-mode");
    //TODO Implement the switching of divs using the unloaded CSS class
}

function handleCustomGameButtonClick(button: HTMLButtonElement) {
    if (customGameButton?.hasAttribute("current-mode"))
        return;
    button.setAttribute("current-mode");
    //TODO Implement the switching of divs using the unloaded CSS class

}

function handleTournamentButtonClick(button: HTMLButtonElement) {
    if (tournamentButton?.hasAttribute("current-mode"))
        return;
    button.setAttribute("current-mode");
    //TODO Implement the switching of divs using the unloaded CSS class
}

addListener(multiplayerButton, 'click', handleMultiplayerButtonClick)
addListener(customGameButton, 'click', handleCustomGameButtonClick)
addListener(tournamentButton, 'click', handleTournamentButtonClick)