export {};

declare function translatePage(language: string): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;

translatePage(getUserLang());