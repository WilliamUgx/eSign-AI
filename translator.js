console.log("eSign AI: translator.js started loading");


/**
 * ======================================================
 * TEXT NORMALIZATION
 * ======================================================
 */

function normalizeTranslatorText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/**
 * ======================================================
 * TRANSLATOR SETTINGS
 * ======================================================
 */

const ESIGN_TRANSLATOR_SETTINGS = {
    mode: "offline",

    signLanguage: "USL",

    /*
     * This can later point to a secure translation server.
     *
     * Never store an AI API key directly inside
     * the Chrome extension.
     */
    backendUrl: "http://127.0.0.1:5000/translate",

    requestTimeout: 8000,

    /*
     * Controls whether the local sentence analyzer
     * removes unnecessary grammar words.
     */
    simplifyOfflineText: true,

    /*
     * Print detailed analyzer information in the console.
     */
    debugOfflineAnalyzer: true
};


/**
 * ======================================================
 * PROTECTED PHRASES
 * ======================================================
 *
 * These phrases should remain together because the
 * dictionary may contain them as one sign.
 */

const ESIGN_PROTECTED_PHRASES = [
    "thank you very much",
    "thank you",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "you are welcome",
    "how are you",
    "nice to meet you",
    "see you later",
    "see you soon",
    "what is your name",
    "my name is",
    "i love you",
    "excuse me",
    "please help me",
    "do not",
    "cannot",
    "can not",
    "will not",
    "should not",
    "would not",
    "could not"
];


/**
 * ======================================================
 * PHRASE REPLACEMENT RULES
 * ======================================================
 *
 * These convert common spoken-English expressions
 * into simpler sign-friendly concepts.
 *
 * The replacement should use words or phrases that
 * exist, or will exist, in your dictionary.
 */

const ESIGN_PHRASE_REPLACEMENTS = [
    {
        pattern: /\bi would like to\b/g,
        replacement: "want"
    },

    {
        pattern: /\bi want to\b/g,
        replacement: "want"
    },

    {
        pattern: /\bi am going to\b/g,
        replacement: "will"
    },

    {
        pattern: /\bwe are going to\b/g,
        replacement: "we will"
    },

    {
        pattern: /\bthey are going to\b/g,
        replacement: "they will"
    },

    {
        pattern: /\byou are going to\b/g,
        replacement: "you will"
    },

    {
        pattern: /\bgoing to\b/g,
        replacement: "will"
    },

    {
        pattern: /\bwould you please\b/g,
        replacement: "please"
    },

    {
        pattern: /\bcould you please\b/g,
        replacement: "please"
    },

    {
        pattern: /\bcan you please\b/g,
        replacement: "please"
    },

    {
        pattern: /\bdo you know\b/g,
        replacement: "know"
    },

    {
        pattern: /\bdo you understand\b/g,
        replacement: "understand"
    },

    {
        pattern: /\bmake sure\b/g,
        replacement: "ensure"
    },

    {
        pattern: /\ba lot of\b/g,
        replacement: "many"
    },

    {
        pattern: /\blots of\b/g,
        replacement: "many"
    },

    {
        pattern: /\bvery big\b/g,
        replacement: "large"
    },

    {
        pattern: /\bvery small\b/g,
        replacement: "small"
    },

    {
        pattern: /\bat this moment\b/g,
        replacement: "now"
    },

    {
        pattern: /\bat the moment\b/g,
        replacement: "now"
    },

    {
        pattern: /\bright now\b/g,
        replacement: "now"
    },

    {
        pattern: /\bin the future\b/g,
        replacement: "future"
    },

    {
        pattern: /\bin the past\b/g,
        replacement: "past"
    },

    {
        pattern: /\bthanks a lot\b/g,
        replacement: "thank you"
    },

    {
        pattern: /\bthanks very much\b/g,
        replacement: "thank you very much"
    },

    {
        pattern: /\bthanks\b/g,
        replacement: "thank you"
    },

    {
        pattern: /\bhi there\b/g,
        replacement: "hello"
    },

    {
        pattern: /\bhey there\b/g,
        replacement: "hello"
    },

    {
        pattern: /\bgoodbye\b/g,
        replacement: "bye"
    },

    {
        pattern: /\bsee ya\b/g,
        replacement: "see you"
    },

    {
        pattern: /\bkids\b/g,
        replacement: "children"
    },

    {
        pattern: /\bchildrens\b/g,
        replacement: "children"
    },

    {
        pattern: /\bpeople\b/g,
        replacement: "person"
    },

    {
        pattern: /\bpersons\b/g,
        replacement: "person"
    },

    {
        pattern: /\bwatching\b/g,
        replacement: "watch"
    },

    {
        pattern: /\bwatched\b/g,
        replacement: "watch"
    },

    {
        pattern: /\bshows\b/g,
        replacement: "show"
    },

    {
        pattern: /\bshowing\b/g,
        replacement: "show"
    },

    {
        pattern: /\bshowed\b/g,
        replacement: "show"
    },

    {
        pattern: /\bworking\b/g,
        replacement: "work"
    },

    {
        pattern: /\bworked\b/g,
        replacement: "work"
    },

    {
        pattern: /\bhelping\b/g,
        replacement: "help"
    },

    {
        pattern: /\bhelped\b/g,
        replacement: "help"
    },

    {
        pattern: /\busing\b/g,
        replacement: "use"
    },

    {
        pattern: /\bused\b/g,
        replacement: "use"
    },

    {
        pattern: /\blooking\b/g,
        replacement: "look"
    },

    {
        pattern: /\blooked\b/g,
        replacement: "look"
    },

    {
        pattern: /\bplaying\b/g,
        replacement: "play"
    },

    {
        pattern: /\bplayed\b/g,
        replacement: "play"
    },

    {
        pattern: /\blearning\b/g,
        replacement: "learn"
    },

    {
        pattern: /\blearned\b/g,
        replacement: "learn"
    },

    {
        pattern: /\bstarted\b/g,
        replacement: "start"
    },

    {
        pattern: /\bstarting\b/g,
        replacement: "start"
    },

    {
        pattern: /\bfinished\b/g,
        replacement: "finish"
    },

    {
        pattern: /\bfinishing\b/g,
        replacement: "finish"
    }
];


/**
 * ======================================================
 * OPTIONAL GRAMMAR WORDS
 * ======================================================
 *
 * These words often do not require a separate sign.
 *
 * This list is intentionally conservative. Do not add
 * words such as "not", "before", "after", "who", "what",
 * "where", "when" or "why" because they carry meaning.
 */

const ESIGN_OPTIONAL_WORDS = new Set([
    "a",
    "an",
    "the",

    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",

    "do",
    "does",
    "did",

    "have",
    "has",
    "had",

    "of",

    "that",
    "which",

    "just",
    "really",
    "actually",
    "basically",

    "uh",
    "um",
    "erm",
    "hmm"
]);


/**
 * ======================================================
 * IMPORTANT WORDS
 * ======================================================
 *
 * These words must never be removed by the optional-word
 * filter because changing or removing them could reverse
 * or damage the meaning of the sentence.
 */

const ESIGN_IMPORTANT_WORDS = new Set([
    "not",
    "no",
    "never",

    "before",
    "after",

    "past",
    "present",
    "future",

    "yesterday",
    "today",
    "tomorrow",
    "now",

    "who",
    "what",
    "where",
    "when",
    "why",
    "how",

    "can",
    "cannot",
    "could",
    "should",
    "would",
    "will",
    "must",
    "may",
    "might",

    "i",
    "me",
    "my",
    "mine",

    "you",
    "your",
    "yours",

    "he",
    "him",
    "his",

    "she",
    "her",
    "hers",

    "we",
    "us",
    "our",

    "they",
    "them",
    "their"
]);


/**
 * ======================================================
 * LOCAL ANALYZER HELPERS
 * ======================================================
 */


/**
 * Applies the common phrase and word replacements.
 */
function applyOfflineReplacementRules(text) {
    let result = text;

    ESIGN_PHRASE_REPLACEMENTS.forEach((rule) => {
        result = result.replace(
            rule.pattern,
            rule.replacement
        );
    });

    return normalizeTranslatorText(result);
}


/**
 * Temporarily converts protected phrases into tokens.
 *
 * Example:
 *
 * "thank you for watching"
 *
 * becomes:
 *
 * "__esign_phrase_1__ for watch"
 */
function protectOfflinePhrases(text) {
    let protectedText = text;

    const phraseMap = new Map();

    const sortedPhrases = [
        ...ESIGN_PROTECTED_PHRASES
    ].sort((firstPhrase, secondPhrase) => {
        return secondPhrase.length - firstPhrase.length;
    });

    sortedPhrases.forEach((phrase, index) => {
        const normalizedPhrase =
            normalizeTranslatorText(phrase);

        const token =
            `esignprotectedphrase${index}`;

        const escapedPhrase =
            normalizedPhrase.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const phrasePattern =
            new RegExp(
                `\\b${escapedPhrase}\\b`,
                "g"
            );

        if (phrasePattern.test(protectedText)) {
            protectedText =
                protectedText.replace(
                    phrasePattern,
                    token
                );

            phraseMap.set(
                token,
                normalizedPhrase
            );
        }
    });

    return {
        protectedText,
        phraseMap
    };
}


/**
 * Restores phrases that were temporarily protected.
 */
function restoreOfflinePhrases(
    text,
    phraseMap
) {
    let restoredText = text;

    phraseMap.forEach((phrase, token) => {
        const tokenPattern =
            new RegExp(
                `\\b${token}\\b`,
                "g"
            );

        restoredText =
            restoredText.replace(
                tokenPattern,
                phrase
            );
    });

    return normalizeTranslatorText(restoredText);
}


/**
 * Removes optional grammar and filler words.
 */
function removeOfflineOptionalWords(text) {
    const words = text.split(" ");

    const usefulWords = words.filter((word) => {
        if (!word) {
            return false;
        }

        /*
         * Protected phrase tokens must remain.
         */
        if (
            word.startsWith(
                "esignprotectedphrase"
            )
        ) {
            return true;
        }

        /*
         * Important words must always remain.
         */
        if (ESIGN_IMPORTANT_WORDS.has(word)) {
            return true;
        }

        return !ESIGN_OPTIONAL_WORDS.has(word);
    });

    return usefulWords.join(" ");
}


/**
 * Removes immediately repeated words.
 *
 * Example:
 *
 * "hello hello everyone"
 *
 * becomes:
 *
 * "hello everyone"
 */
function removeOfflineRepeatedWords(text) {
    const words = text.split(" ");

    const cleanedWords = [];

    let previousWord = "";

    words.forEach((word) => {
        if (!word) {
            return;
        }

        if (word === previousWord) {
            return;
        }

        cleanedWords.push(word);

        previousWord = word;
    });

    return cleanedWords.join(" ");
}


/**
 * Removes repeated phrases while preserving order.
 *
 * Example:
 *
 * "thank you thank you"
 *
 * becomes:
 *
 * "thank you"
 */
function removeOfflineRepeatedPhrases(text) {
    let result = text;

    const sortedPhrases = [
        ...ESIGN_PROTECTED_PHRASES
    ].sort((firstPhrase, secondPhrase) => {
        return secondPhrase.length - firstPhrase.length;
    });

    sortedPhrases.forEach((phrase) => {
        const escapedPhrase =
            phrase.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const repeatedPhrasePattern =
            new RegExp(
                `\\b(${escapedPhrase})(?:\\s+\\1)+\\b`,
                "g"
            );

        result = result.replace(
            repeatedPhrasePattern,
            phrase
        );
    });

    return normalizeTranslatorText(result);
}


/**
 * Creates a list of individual concepts for debugging.
 */
function createOfflineConceptList(text) {
    const protectedResult =
        protectOfflinePhrases(text);

    const concepts =
        protectedResult.protectedText
            .split(" ")
            .filter(Boolean)
            .map((concept) => {
                if (
                    protectedResult.phraseMap.has(
                        concept
                    )
                ) {
                    return protectedResult.phraseMap.get(
                        concept
                    );
                }

                return concept;
            });

    return concepts;
}


/**
 * ======================================================
 * MAIN LOCAL SENTENCE ANALYZER
 * ======================================================
 */

function analyzeSentenceOffline(
    text,
    signLanguage
) {
    const originalText =
        normalizeTranslatorText(text);

    if (!originalText) {
        return {
            originalText: "",
            simplifiedText: "",
            concepts: []
        };
    }


    /*
     * Step 1:
     * Replace common spoken expressions and word forms.
     */
    let analyzedText =
        applyOfflineReplacementRules(
            originalText
        );


    /*
     * Step 2:
     * Keep multi-word dictionary phrases together.
     */
    const protectedResult =
        protectOfflinePhrases(
            analyzedText
        );


    analyzedText =
        protectedResult.protectedText;


    /*
     * Step 3:
     * Remove optional grammar and filler words.
     */
    if (
        ESIGN_TRANSLATOR_SETTINGS
            .simplifyOfflineText
    ) {
        analyzedText =
            removeOfflineOptionalWords(
                analyzedText
            );
    }


    /*
     * Step 4:
     * Remove repeated words.
     */
    analyzedText =
        removeOfflineRepeatedWords(
            analyzedText
        );


    /*
     * Step 5:
     * Restore protected multi-word phrases.
     */
    analyzedText =
        restoreOfflinePhrases(
            analyzedText,
            protectedResult.phraseMap
        );


    /*
     * Step 6:
     * Remove repeated protected phrases.
     */
    analyzedText =
        removeOfflineRepeatedPhrases(
            analyzedText
        );


    const concepts =
        createOfflineConceptList(
            analyzedText
        );


    const result = {
        originalText,
        simplifiedText: analyzedText,
        concepts,
        signLanguage
    };


    if (
        ESIGN_TRANSLATOR_SETTINGS
            .debugOfflineAnalyzer
    ) {
        console.log(
            "================================"
        );

        console.log(
            "eSign AI local analyzer"
        );

        console.log(
            "Sign language:",
            signLanguage
        );

        console.log(
            "Original:",
            result.originalText
        );

        console.log(
            "Simplified:",
            result.simplifiedText
        );

        console.log(
            "Concepts:",
            result.concepts
        );

        console.log(
            "================================"
        );
    }


    return result;
}


/**
 * ======================================================
 * MAIN TRANSLATION FUNCTION
 * ======================================================
 *
 * Used by content.js.
 *
 * Modes:
 *
 * offline = use the local sentence analyzer
 * ai      = request translation from the secure backend
 */

async function translateCaptionForSigning(text) {
    const normalizedText =
        normalizeTranslatorText(text);

    if (!normalizedText) {
        return "";
    }

    if (
        ESIGN_TRANSLATOR_SETTINGS.mode ===
        "ai"
    ) {
        try {
            return await requestAITranslation(
                normalizedText,
                ESIGN_TRANSLATOR_SETTINGS
                    .signLanguage
            );
        } catch (error) {
            console.warn(
                "eSign AI translation failed. Using local analyzer.",
                error
            );

            return translateOffline(
                normalizedText,
                ESIGN_TRANSLATOR_SETTINGS
                    .signLanguage
            );
        }
    }

    return translateOffline(
        normalizedText,
        ESIGN_TRANSLATOR_SETTINGS
            .signLanguage
    );
}


/**
 * ======================================================
 * OFFLINE TRANSLATION
 * ======================================================
 */

function translateOffline(
    text,
    signLanguage
) {
    const analysis =
        analyzeSentenceOffline(
            text,
            signLanguage
        );

    return analysis.simplifiedText;
}


/**
 * ======================================================
 * AI BACKEND REQUEST
 * ======================================================
 */

async function requestAITranslation(
    text,
    signLanguage
) {
    const controller =
        new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, ESIGN_TRANSLATOR_SETTINGS.requestTimeout);

    try {
        const response = await fetch(
            ESIGN_TRANSLATOR_SETTINGS.backendUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    text,
                    signLanguage
                }),

                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `Translation server returned ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data ||
            typeof data.translation !==
                "string"
        ) {
            throw new Error(
                "Translation server returned invalid data."
            );
        }

        const translatedText =
            normalizeTranslatorText(
                data.translation
            );

        console.log(
            "eSign AI original text:",
            text
        );

        console.log(
            "eSign AI translated text:",
            translatedText
        );

        return translatedText;
    } finally {
        clearTimeout(timeoutId);
    }
}


/**
 * ======================================================
 * CHANGE SIGN LANGUAGE
 * ======================================================
 */

function setSignLanguage(languageCode) {
    const supportedLanguages = [
        "USL",
        "ASL",
        "BSL",
        "KSL"
    ];

    const normalizedCode =
        String(languageCode || "")
            .trim()
            .toUpperCase();

    if (
        !supportedLanguages.includes(
            normalizedCode
        )
    ) {
        console.warn(
            "eSign AI unsupported language:",
            normalizedCode
        );

        return false;
    }

    ESIGN_TRANSLATOR_SETTINGS.signLanguage =
        normalizedCode;

    console.log(
        "eSign AI sign language changed to:",
        normalizedCode
    );

    return true;
}


/**
 * ======================================================
 * CHANGE TRANSLATION MODE
 * ======================================================
 */

function setTranslationMode(mode) {
    const normalizedMode =
        String(mode || "")
            .trim()
            .toLowerCase();

    if (
        normalizedMode !== "offline" &&
        normalizedMode !== "ai"
    ) {
        console.warn(
            "eSign AI invalid translation mode:",
            normalizedMode
        );

        return false;
    }

    ESIGN_TRANSLATOR_SETTINGS.mode =
        normalizedMode;

    console.log(
        "eSign AI translation mode changed to:",
        normalizedMode
    );

    return true;
}


/**
 * ======================================================
 * CHANGE OFFLINE SIMPLIFICATION
 * ======================================================
 */

function setOfflineSimplification(enabled) {
    ESIGN_TRANSLATOR_SETTINGS
        .simplifyOfflineText =
        Boolean(enabled);

    console.log(
        "eSign AI offline simplification:",
        ESIGN_TRANSLATOR_SETTINGS
            .simplifyOfflineText
    );

    return true;
}


/**
 * ======================================================
 * TEST LOCAL ANALYZER
 * ======================================================
 *
 * This can be called by content.js or by the
 * Developer Control Panel.
 */

function testOfflineAnalyzer(text) {
    return analyzeSentenceOffline(
        text,
        ESIGN_TRANSLATOR_SETTINGS
            .signLanguage
    );
}


/**
 * ======================================================
 * EXPOSE TRANSLATOR
 * ======================================================
 */

window.eSignTranslator = {
    translateCaptionForSigning,

    analyzeSentenceOffline,

    testOfflineAnalyzer,

    setSignLanguage,

    setTranslationMode,

    setOfflineSimplification,

    settings: ESIGN_TRANSLATOR_SETTINGS
};


console.log(
    "eSign AI translator loaded with local sentence analyzer."
);