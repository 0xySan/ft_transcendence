// We need to declare these functions on the window object for global access
declare global {
    interface Window {
        translatePage: typeof translatePage;
        translateElement: typeof translateElement;
        getUserLang: typeof getUserLang;
        getTranslatedElementText: typeof getTranslatedElementText;
        getTranslatedTextByKey: typeof getTranslatedTextByKey;
    }
}

const DefaultLocale = "en";

// Cache fetched translation JSONs. We store the Promise so concurrent
// requests for the same language reuse the same in-flight fetch.
const translationCache = new Map<string, Promise<Record<string, any> | null>>();

/**
 * Gets the user's lang
 * @returns user's language code
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
 * @param language code of the language we want to translate to
 * @returns translation json 
 */
async function fetchTranslationJson(
    language: string
): Promise<Record<string, any> | null> {
    if (translationCache.has(language)) {
        return await translationCache.get(language)!;
    }

    const fetchPromise = (async () => {
        try {
            const res = await fetch(`../../resources/translations/${language}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            return await res.json();
        } catch (err) {
            console.error("Fetch error:", err);
            return null;
        }
    })();

    translationCache.set(language, fetchPromise);

    return await fetchPromise;
}

/**
 * Gets nested json value
 * @param json translation json object
 * @param keys array of keys to access nested value
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

/** Correlates language code to available translations
 * @param lang language code to correlate
 * @returns correlated language code
 */
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
 * @param language code of the language we want to translate to
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
                        element.innerHTML = translatedText;
                    }
                }
            });
        }
    });
}

/** Prints key-text pairs to console
 * @param key key of the text 
 * @param text text to be printed
 */
function printToJsonLine(key: string, text: string) {
    // For development purposes only: prints key-text pairs to console
    console.log(`"${key}": "${text.replace(/"/g, '\\"')}",`);
}

/**
 * Translates element
 * @param language code of the language we want to translate to
 * @param element the element to be translated
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

export function getTranslatedElementText(language: string, element: HTMLElement) : Promise<string | null> {
    const correlatedLanguage = correlateLangCode(language);
    const translationPromise = fetchTranslationJson(correlatedLanguage);
    if (!translationPromise) return Promise.resolve(null);
    if (!element || !element.hasAttribute("data-translate-key")) return Promise.resolve(null);

    return translationPromise.then((json) => {
        if (json) {
            const key = element.getAttribute("data-translate-key");
            if (key) {
                const keys = key.split(".");
                const translatedText = getNestedJsonValue(json, keys);
                if (translatedText) {
                    return translatedText;
                }
            }
        }
        return null;
    });
}

// Make it return a string or null if not found
export async function getTranslatedTextByKey(language: string, key: string) : Promise<string | null> {
    const correlatedLanguage = correlateLangCode(language);
    const json = await fetchTranslationJson(correlatedLanguage);
    if (!json) return null;
    const keys = key.split('.');
    return getNestedJsonValue(json, keys);
}

window.translatePage = translatePage;
window.translateElement = translateElement;
window.getTranslatedElementText = getTranslatedElementText;
window.getTranslatedTextByKey = getTranslatedTextByKey;
window.getUserLang = getUserLang;

translatePage(getUserLang());