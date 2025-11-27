// We need to declare these functions on the window object for global access
declare global {
    interface Window {
        translatePage: typeof translatePage;
        translateElement: typeof translateElement;
        getUserLang: typeof getUserLang;
    }
}

const DefaultLocale = "en";

/**
 * Gets the user's lang
 * @returns  
 */
export function getUserLang() {
    /// TODO: improve this function to ask the backend for the user's preferred language FIRST
    /// then fallback to browser settings
    if (navigator.languages !== undefined) 
        return navigator.languages[0]; 
    return navigator.language;
}

/**
 * Fetchs translation json
 * @param language 
 * @returns translation json 
 */
async function fetchTranslationJson(
    language: string
): Promise<Record<string, any> | null> {
    try {
        const res = await fetch(`../../resources/translations/${language}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        return await res.json();
    } catch (err) {
        console.error("Fetch error:", err);
        return null;
    }
}

/**
 * Gets nested json value
 * @param json 
 * @param keys 
 * @returns nested json value 
 */
function getNestedJsonValue(
    json: Record<string, any>,
    keys: string[]
): string | null {
    let value: any = json;
    for (const key of keys) {
        if (value[key] === undefined) {
            return null;
        }
        value = value[key];
    }
    return typeof value === "string" ? value : null;
}

function correlateLangCode(lang: string): string {
    const langMap: Record<string, string> = {
        "en": "en",
        "fr": "fr",
        "es": "es",
    };

    const shortLang = lang.split('-')[0]; // Handle cases like 'en-US', 'fr-CA', etc.
    return langMap[shortLang] || DefaultLocale;
}

/**
 * Translates page
 * @param language 
 * @returns  
 */
export function translatePage(
    language: string
) {
    const correlatedLanguage = correlateLangCode(language);
    const translationPromise = fetchTranslationJson(correlatedLanguage);
    if (!translationPromise) return;
    
    translationPromise.then((json) => {
        if (json) {
            document.querySelectorAll<HTMLElement>("[data-translate-key]").forEach((element) => {
                const key = element.getAttribute("data-translate-key");
                if (key) {
                    const keys = key.split(".");
                    const translatedText = getNestedJsonValue(json, keys);
                    if (translatedText) {
                        element.innerText = translatedText;
                    }
                }
            });
        }
    });
}

function printToJsonLine(key: string, text: string) {
    // For development purposes only: prints key-text pairs to console
    console.log(`"${key}": "${text.replace(/"/g, '\\"')}",`);
}

/**
 * Translates element
 * @param language 
 * @param element 
 * @returns  
 */
export function translateElement(language: string, element: HTMLElement) {
    const correlatedLanguage = correlateLangCode(language);
    const translationPromise = fetchTranslationJson(correlatedLanguage);
    if (!translationPromise) return;
    if (!element || !element.hasAttribute("data-translate-key")) return;

    translationPromise.then((json) => {
        if (json) {
            const key = element.getAttribute("data-translate-key");
            if (key) {
                /// Delete when done getting all the initial texts
                printToJsonLine(key, element.innerText);
                const keys = key.split(".");
                const translatedText = getNestedJsonValue(json, keys);
                if (translatedText) {
                    element.innerText = translatedText;
                }
            }
        }
    });
}

window.translatePage = translatePage;
window.translateElement = translateElement;
window.getUserLang = getUserLang;

translatePage(getUserLang());