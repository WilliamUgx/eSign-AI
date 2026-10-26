console.log("eSign AI: dictionary.js started loading");


/**
 * ======================================================
 * SIGN DICTIONARY
 * ======================================================
 */

const SIGN_DICTIONARY = [

    // --------------------------------------------------
    // GREETINGS
    // --------------------------------------------------

    {
        id: 1,

        phrases: [
            "hello",
            "hi",
            "hey",
            "greetings"
        ],

        animation: "Hello",//

        priority: 100,

        category: "Greeting"
    },

    {
        id: 2,

        phrases: [
            "thank ",
            "thanks",
            //"many thanks",
           // "thank you very much"
        ],

        animation: "ThankYou",

        priority: 200,

        category: "Courtesy"
    },

    {
        id: 3,

        phrases: [
            //"goodbye",
            //"good bye",
            "bye",
            "see you later"
        ],

        animation: "bye",

        priority: 300,

        category: "Greeting"
    },

    {
        id: 4,

        phrases: [
            "good morning"
        ],

        sequence: [
            "Good",
            "Morning"
        ],

        priority: 200,

        category: "Greeting"
    },

    {
        id: 5,

        phrases: [
            "welcome",
            "you are welcome"
        ],

        animation: "Welcome",

        priority: 90,

        category: "Greeting"
    },

    {
        id: 6,

        phrases: [
            "good",
            "great",
            "well done"
        ],

        animation: "Good",

        priority: 80,

        category: "Expression"
    },


    // --------------------------------------------------
    // PRONOUNS
    // --------------------------------------------------

    {
        id: 7,

        phrases: [
            "i",
            "me",
            "myself"
        ],

        animation: "I",

        priority: 100,

        category: "Pronoun"
    },

    {
        id: 8,

        phrases: [
            "you",
            "your",
            "yourself"
        ],

        animation: "You",

        priority: 100,

        category: "Pronoun"
    },

    {
        id: 9,

        phrases: [
            "we",
            "us",
            "ourselves"
        ],

        animation: "We",

        priority: 100,

        category: "Pronoun"
    },


    // --------------------------------------------------
    // YES / NO
    // --------------------------------------------------

    {
        id: 10,

        phrases: [
            "yes",
            "yeah",
            "yep",
            "correct"
        ],

        animation: "Yes",

        priority: 100,

        category: "Response"
    },

    {
        id: 11,

        phrases: [
            "no",
            "nope",
            "not"
        ],

        animation: "No",

        priority: 100,

        category: "Response"
    },


    // --------------------------------------------------
    // TIME
    // --------------------------------------------------

    {
        id: 12,

        phrases: [
            "today",
            "this day"
        ],

        animation: "Today",

        priority: 100,

        category: "Time"
    },

    {
        id: 13,

        phrases: [
            "now",
            "right now",
            "at the moment"
        ],

        animation: "Now",

        priority: 120,

        category: "Time"
    },


    // --------------------------------------------------
    // PEOPLE
    // --------------------------------------------------

    {
        id: 14,

        phrases: [
            "people",
            "persons",
            "everyone"
        ],

        animation: "People",

        priority: 90,

        category: "People"
    },


    // --------------------------------------------------
    // COMMUNICATION / MEDIA
    // --------------------------------------------------

    {
        id: 15,

        phrases: [
            "video",
            "videos"
        ],

        animation: "Video",

        priority: 100,

        category: "Media"
    },

    {
        id: 16,

        phrases: [
            "show",
            "show me",
            "display"
        ],

        animation: "Show",

        priority: 110,

        category: "Communication"
    },


    // --------------------------------------------------
    // UNDERSTANDING
    // --------------------------------------------------

    {
        id: 17,

        phrases: [
            "understand",
            "understood",
            "i understand"
        ],

        animation: "Understand",

        priority: 120,

        category: "Understanding"
    }

];


/**
 * ======================================================
 * NORMALIZATION
 * ======================================================
 */

function normalizeDictionaryText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/**
 * ======================================================
 * DICTIONARY INDEX
 * ======================================================
 *
 * The index allows very fast phrase lookup.
 *
 * Example:
 *
 * hello -> dictionary entry
 * hi -> dictionary entry
 * thank you -> dictionary entry
 */

const ESIGN_DICTIONARY_INDEX = new Map();

let ESIGN_MAX_PHRASE_WORDS = 1;


/**
 * Returns all phrases from a dictionary entry.
 *
 * Supports both:
 *
 * phrases: [...]
 *
 * and the older:
 *
 * phrase: "..."
 */

function getDictionaryEntryPhrases(entry) {
    const phrases = [];

    if (Array.isArray(entry.phrases)) {
        phrases.push(...entry.phrases);
    }

    if (
        typeof entry.phrase === "string" &&
        entry.phrase.trim()
    ) {
        phrases.push(entry.phrase);
    }

    return [
        ...new Set(
            phrases
                .map(normalizeDictionaryText)
                .filter(Boolean)
        )
    ];
}


/**
 * Returns the animations belonging to an entry.
 */

function getDictionaryEntryAnimations(entry) {

    if (
        Array.isArray(entry.sequence) &&
        entry.sequence.length > 0
    ) {
        return entry.sequence.filter(Boolean);
    }

    if (
        typeof entry.animation === "string" &&
        entry.animation.trim()
    ) {
        return [entry.animation.trim()];
    }

    return [];
}


/**
 * Builds the fast dictionary index.
 */

function buildESignDictionaryIndex() {

    ESIGN_DICTIONARY_INDEX.clear();

    ESIGN_MAX_PHRASE_WORDS = 1;

    SIGN_DICTIONARY.forEach((entry) => {

        const phrases =
            getDictionaryEntryPhrases(entry);

        const animations =
            getDictionaryEntryAnimations(entry);

        phrases.forEach((phrase) => {

            const wordCount =
                phrase.split(" ").length;

            ESIGN_MAX_PHRASE_WORDS =
                Math.max(
                    ESIGN_MAX_PHRASE_WORDS,
                    wordCount
                );

            const indexedEntry = {
                id: entry.id,
                phrase,
                phrases,
                animations,
                animation:
                    entry.animation || null,
                sequence:
                    Array.isArray(entry.sequence)
                        ? [...entry.sequence]
                        : null,
                priority:
                    Number(entry.priority) || 0,
                category:
                    entry.category || "Uncategorized",
                originalEntry: entry
            };

            /*
             * When two entries contain the same phrase,
             * keep the entry with the higher priority.
             */

            const existingEntry =
                ESIGN_DICTIONARY_INDEX.get(
                    phrase
                );

            if (
                !existingEntry ||
                indexedEntry.priority >
                    existingEntry.priority
            ) {
                ESIGN_DICTIONARY_INDEX.set(
                    phrase,
                    indexedEntry
                );
            }
        });
    });

    console.log(
        "eSign AI dictionary index built:",
        {
            entries: SIGN_DICTIONARY.length,
            phrases:
                ESIGN_DICTIONARY_INDEX.size,
            maximumPhraseWords:
                ESIGN_MAX_PHRASE_WORDS
        }
    );
}


/**
 * ======================================================
 * FAST PHRASE LOOKUP
 * ======================================================
 */

function findIndexedSignPhrase(phrase) {

    const normalizedPhrase =
        normalizeDictionaryText(phrase);

    if (!normalizedPhrase) {
        return null;
    }

    return (
        ESIGN_DICTIONARY_INDEX.get(
            normalizedPhrase
        ) || null
    );
}


/**
 * Checks whether a phrase exists.
 */

function hasSignPhrase(phrase) {

    return Boolean(
        findIndexedSignPhrase(phrase)
    );
}


/**
 * ======================================================
 * DICTIONARY COVERAGE ANALYZER
 * ======================================================
 *
 * Uses longest-phrase-first matching.
 *
 * Example:
 *
 * "thank you very much everyone"
 *
 * It checks:
 *
 * "thank you very much"
 *
 * before checking:
 *
 * "thank"
 * "you"
 * "very"
 * "much"
 */

function analyzeDictionaryCoverage(text) {

    const normalizedText =
        normalizeDictionaryText(text);

    if (!normalizedText) {
        return {
            text: "",
            matched: [],
            missing: [],
            matchedConceptCount: 0,
            missingConceptCount: 0,
            totalConceptCount: 0,
            coveragePercentage: 0,
            animationQueue: []
        };
    }

    const words =
        normalizedText
            .split(" ")
            .filter(Boolean);

    const matched = [];

    const missing = [];

    const animationQueue = [];

    let wordIndex = 0;

    while (wordIndex < words.length) {

        let matchedEntry = null;

        let matchedPhrase = "";

        let matchedWordCount = 0;

        const maximumWordsToCheck =
            Math.min(
                ESIGN_MAX_PHRASE_WORDS,
                words.length - wordIndex
            );

        /*
         * Longest phrase first.
         */

        for (
            let phraseLength =
                maximumWordsToCheck;
            phraseLength >= 1;
            phraseLength--
        ) {

            const candidatePhrase =
                words
                    .slice(
                        wordIndex,
                        wordIndex +
                            phraseLength
                    )
                    .join(" ");

            const candidateEntry =
                findIndexedSignPhrase(
                    candidatePhrase
                );

            if (candidateEntry) {

                matchedEntry =
                    candidateEntry;

                matchedPhrase =
                    candidatePhrase;

                matchedWordCount =
                    phraseLength;

                break;
            }
        }

        if (matchedEntry) {

            matched.push({
                phrase: matchedPhrase,
                entryId: matchedEntry.id,
                category:
                    matchedEntry.category,
                animations: [
                    ...matchedEntry.animations
                ]
            });

            matchedEntry.animations.forEach(
                (animationName) => {
                    animationQueue.push(
                        animationName
                    );
                }
            );

            wordIndex +=
                matchedWordCount;

        } else {

            missing.push(
                words[wordIndex]
            );

            wordIndex += 1;
        }
    }

    const matchedConceptCount =
        matched.length;

    const missingConceptCount =
        missing.length;

    const totalConceptCount =
        matchedConceptCount +
        missingConceptCount;

    const coveragePercentage =
        totalConceptCount > 0
            ? Math.round(
                (
                    matchedConceptCount /
                    totalConceptCount
                ) * 100
            )
            : 0;

    return {
        text: normalizedText,
        matched,
        missing,
        matchedConceptCount,
        missingConceptCount,
        totalConceptCount,
        coveragePercentage,
        animationQueue
    };
}


/**
 * ======================================================
 * MISSING-WORD STATISTICS
 * ======================================================
 */

const ESIGN_MISSING_WORD_STATISTICS =
    new Map();


/**
 * Records missing concepts.
 */

function recordMissingDictionaryWords(
    missingWords
) {

    if (!Array.isArray(missingWords)) {
        return;
    }

    missingWords.forEach((word) => {

        const normalizedWord =
            normalizeDictionaryText(word);

        if (!normalizedWord) {
            return;
        }

        const previousCount =
            ESIGN_MISSING_WORD_STATISTICS.get(
                normalizedWord
            ) || 0;

        ESIGN_MISSING_WORD_STATISTICS.set(
            normalizedWord,
            previousCount + 1
        );
    });
}


/**
 * Returns the most frequently missing words.
 */

function getTopMissingDictionaryWords(
    limit = 10
) {

    const safeLimit =
        Math.max(
            1,
            Number(limit) || 10
        );

    return Array.from(
        ESIGN_MISSING_WORD_STATISTICS.entries()
    )
        .map(([word, count]) => {
            return {
                word,
                count
            };
        })
        .sort((firstItem, secondItem) => {

            if (
                secondItem.count !==
                firstItem.count
            ) {
                return (
                    secondItem.count -
                    firstItem.count
                );
            }

            return firstItem.word.localeCompare(
                secondItem.word
            );
        })
        .slice(
            0,
            safeLimit
        );
}


/**
 * Clears missing-word statistics.
 */

function clearMissingDictionaryStatistics() {

    ESIGN_MISSING_WORD_STATISTICS.clear();

    console.log(
        "eSign AI missing-word statistics cleared."
    );
}


/**
 * ======================================================
 * BUILD INDEX
 * ======================================================
 */

buildESignDictionaryIndex();


/**
 * ======================================================
 * EXPOSE DICTIONARY API
 * ======================================================
 */

window.eSignDictionary =
    SIGN_DICTIONARY;

window.eSignDictionaryTools = {

    dictionary:
        SIGN_DICTIONARY,

    index:
        ESIGN_DICTIONARY_INDEX,

    buildIndex:
        buildESignDictionaryIndex,

    normalizeText:
        normalizeDictionaryText,

    getEntryPhrases:
        getDictionaryEntryPhrases,

    getEntryAnimations:
        getDictionaryEntryAnimations,

    findPhrase:
        findIndexedSignPhrase,

    hasPhrase:
        hasSignPhrase,

    analyzeCoverage:
        analyzeDictionaryCoverage,

    recordMissingWords:
        recordMissingDictionaryWords,

    getTopMissingWords:
        getTopMissingDictionaryWords,

    clearMissingStatistics:
        clearMissingDictionaryStatistics
};


console.log(
    "eSign AI dictionary loaded with coverage analyzer."
);