// ============================================================
// eSign AI - YouTube Floating Avatar and Caption Controller
// Detects YouTube captions and sends animation commands
// ============================================================

(() => {
    "use strict";
    const SIGN_DICTIONARY =
    window.eSignDictionary || [];
    const ESIGN_SETTINGS = {
    signLanguage: "USL"
    };

    const BOX_ID = "esign-avatar-box";
    const IFRAME_ID = "esign-avatar-frame";
    const MESSAGE_SOURCE = "ESIGN_AI";



    let captionObserver = null;
    let captionCheckTimer = null;

    let lastCaptionText = "";
   

    /*
    * Temporarily stores words that may form part of a phrase
    * in the next caption update.
    *
    * Example:
    * "thank" + "you" becomes "thank you".
    */
    let pendingCaptionWords = "";
    let lastAnimationName = "";
    let lastAnimationTime = 0;
    let captionClearTimer = null;

    /**
     * Local animation dictionary.
     *
     * The animation value must match an animation inside avatar.glb.
     */
    

    /**
     * Creates the floating avatar window.
     */
    function createAvatarWindow() {
        if (document.getElementById(BOX_ID)) {
            return;
        }

        const avatarBox = document.createElement("section");

        avatarBox.id = BOX_ID;
        avatarBox.setAttribute(
            "aria-label",
            "eSign AI sign-language avatar"
        );

        avatarBox.innerHTML = `
            <div id="esign-avatar-header">
                <span id="esign-avatar-title">
                    🧏 eSign AI
                </span>

                <button
                    id="esign-avatar-close"
                    type="button"
                    aria-label="Close sign-language avatar"
                    title="Close"
                >
                    ×
                </button>
            </div>

            <iframe
                id="${IFRAME_ID}"
                title="eSign AI avatar"
                allow="autoplay"
            ></iframe>
        `;

        document.body.appendChild(avatarBox);

        const iframe = avatarBox.querySelector(
            `#${IFRAME_ID}`
        );

        iframe.src = chrome.runtime.getURL(
            "avatar.html"
        );

        iframe.addEventListener("load", () => {
            console.log(
                "eSign AI: Avatar iframe loaded."
            );

            sendAvatarCommand({
                type: "CHECK_READY"
            });

            const currentCaption =
                readCurrentYouTubeCaption();

            if (currentCaption) {
                processCaption(currentCaption);
            }
        });

        enableDragging(avatarBox);
        enableCloseButton(avatarBox);

        startCaptionDetection();
    }

    /**
     * Allows the user to drag the window in both directions.
     */
    function enableDragging(box) {
        const header = box.querySelector(
            "#esign-avatar-header"
        );

        if (!header) {
            return;
        }

        let dragging = false;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;

        header.addEventListener(
            "pointerdown",
            (event) => {
                if (
                    event.target.closest(
                        "#esign-avatar-close"
                    )
                ) {
                    return;
                }

                dragging = true;

                const rectangle =
                    box.getBoundingClientRect();

                pointerOffsetX =
                    event.clientX - rectangle.left;

                pointerOffsetY =
                    event.clientY - rectangle.top;

                header.setPointerCapture(
                    event.pointerId
                );

                header.classList.add(
                    "esign-dragging"
                );

                event.preventDefault();
            }
        );

        header.addEventListener(
            "pointermove",
            (event) => {
                if (!dragging) {
                    return;
                }

                const maximumX = Math.max(
                    0,
                    window.innerWidth -
                        box.offsetWidth
                );

                const maximumY = Math.max(
                    0,
                    window.innerHeight -
                        box.offsetHeight
                );

                const requestedX =
                    event.clientX -
                    pointerOffsetX;

                const requestedY =
                    event.clientY -
                    pointerOffsetY;

                const newX = Math.min(
                    Math.max(0, requestedX),
                    maximumX
                );

                const newY = Math.min(
                    Math.max(0, requestedY),
                    maximumY
                );

                box.style.left = `${newX}px`;
                box.style.top = `${newY}px`;
                box.style.right = "auto";
                box.style.bottom = "auto";
            }
        );

        function stopDragging(event) {
            if (!dragging) {
                return;
            }

            dragging = false;

            header.classList.remove(
                "esign-dragging"
            );

            if (
                header.hasPointerCapture(
                    event.pointerId
                )
            ) {
                header.releasePointerCapture(
                    event.pointerId
                );
            }
        }

        header.addEventListener(
            "pointerup",
            stopDragging
        );

        header.addEventListener(
            "pointercancel",
            stopDragging
        );
    }

    /**
     * Closes the floating avatar window.
     */
    function enableCloseButton(box) {
        const closeButton = box.querySelector(
            "#esign-avatar-close"
        );

        if (!closeButton) {
            return;
        }

        closeButton.addEventListener(
            "click",
            () => {
                stopCaptionDetection();
                box.remove();
            }
        );
    }

    /**
     * Starts watching the YouTube player for caption changes.
     */
    function startCaptionDetection() {
        stopCaptionDetection();

        // Observe the whole document body. YouTube frequently replaces the
        // player and caption container during navigation, so observing only
        // #movie_player can silently stop caption detection.
        const observationTarget = document.body || document.documentElement;

        if (observationTarget) {
            captionObserver = new MutationObserver(() => {
                checkCurrentCaption();
            });

            captionObserver.observe(observationTarget, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Polling remains as a reliable backup for YouTube DOM changes.
        captionCheckTimer = window.setInterval(() => {
            checkCurrentCaption();
        }, 250);

        // Run once immediately instead of waiting for the first mutation.
        checkCurrentCaption();

        console.log("eSign AI: Robust YouTube caption detection started.");
    }

    /**
     * Stops caption detection.
     */
    function stopCaptionDetection() {
        if (captionObserver) {
            captionObserver.disconnect();
            captionObserver = null;
        }

        if (captionCheckTimer !== null) {
            window.clearInterval(
                captionCheckTimer
            );

            captionCheckTimer = null;
        }
    }

    /**
     * Reads and processes the currently visible caption.
     */
    function checkCurrentCaption() 
    {
        const captionText = readCurrentYouTubeCaption();

        if (!captionText) {
            scheduleCaptionReset();
            return;
        }

        cancelCaptionReset();
        processCaption(captionText);
    }

    /**
     * Reads YouTube's visible caption segments.
     */
    function readCurrentYouTubeCaption() {
        // YouTube has used several caption structures over time. Check all
        // known visible caption selectors and ignore hidden/empty elements.
        const selectors = [
            ".ytp-caption-segment",
            ".caption-visual-line .ytp-caption-segment",
            ".ytp-caption-window-container .ytp-caption-segment",
            ".ytp-caption-window-bottom .ytp-caption-segment",
            ".ytp-caption-window-rollup .ytp-caption-segment"
        ];

        const segments = [];
        const seen = new Set();

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                if (seen.has(element)) {
                    return;
                }

                seen.add(element);

                const style = window.getComputedStyle(element);
                const rectangle = element.getBoundingClientRect();
                const text = String(element.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim();

                if (
                    text &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    rectangle.width > 0 &&
                    rectangle.height > 0
                ) {
                    segments.push(text);
                }
            });
        });

        return segments
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Processes a new caption.
     */
    async function processCaption(captionText)
    {
        console.log
        (
        "eSign AI DEBUG: processCaption started",
         captionText
        );
        const cleanCaption = cleanText(captionText);


        if (!cleanCaption) {
            return;
        }

        // Keep the original caption visible immediately while translation
        // is being prepared. It will be replaced by translated text below.
        sendAvatarCommand({
            type: "SET_CAPTION",
            text: captionText
        });

        if (cleanCaption === lastCaptionText) {
            return;
        }

        /*
        * Determine whether this caption continues the previous one.
        * If it is a completely new caption, clear old pending words.
        */
        const isRelatedCaption = captionsAreRelated(
            lastCaptionText,
            cleanCaption
        );

        if (
            lastCaptionText &&
            !isRelatedCaption
        ) {
            pendingCaptionWords = "";

            console.log(
                "eSign AI: New caption detected. Pending words cleared."
            );
        }

        /*
        * YouTube often builds captions gradually:
        *
        * Thank
        * Thank you
        *
        * We normally receive only the newly added words.
        */
        const newCaptionPart = getNewCaptionPart(
            lastCaptionText,
            cleanCaption
        );

        lastCaptionText = cleanCaption;

        console.log("eSign AI full caption:", captionText);
        console.log("eSign AI new words:", newCaptionPart);

        if (!newCaptionPart) {
            return;
        }

        /*
        * Combine previously unmatched words with the newly added words.
        *
        * Example:
        * pending words: "thank"
        * new words:     "you"
        * combined:      "thank you"
        */
        const textToProcess = normalizeCaptionText(
            `${pendingCaptionWords} ${newCaptionPart}`
        );

        if (!textToProcess) {
            return;
        }

        console.log(
            "eSign AI text being checked:",
            textToProcess
        );

        const transformedText = transformToSignLanguageGrammar(
        textToProcess,
        ESIGN_SETTINGS.signLanguage
        );

        console.log(
        "eSign AI selected language:",
        ESIGN_SETTINGS.signLanguage
        );

        console.log(
        "eSign AI transformed caption:",
        transformedText
        );

        let translatedText = textToProcess;

        if (
            window.eSignTranslator &&
             typeof window.eSignTranslator
            .translateCaptionForSigning === "function"
            ) 
            {
            translatedText =
            await window.eSignTranslator
            .translateCaptionForSigning(textToProcess);
            } else 
                {
            console.warn(
            "eSign AI translator is unavailable. Using direct dictionary matching."
            );

            translatedText =
         normalizeCaptionText(textToProcess);
        }



        console.log(
        "eSign AI text sent to dictionary:",
        translatedText
        );

        // Show the translated, sign-friendly sentence below the avatar even
        // when no matching animation exists yet.
        sendAvatarCommand({
            type: "SET_CAPTION",
            text: translatedText || captionText
        });

        const signMatches =
        findMatchingSigns(translatedText);
        console.log(
        "eSign AI DEBUG translated text:",
        translatedText
        );

        console.log(
        "eSign AI DEBUG dictionary result:",
        signMatches
        );


        console.log(
        "eSign AI DEBUG translated text:",
         translatedText
        );

        console.log(
        "eSign AI DEBUG sign matches:",
        signMatches
    );

    if (!Array.isArray(signMatches) || signMatches.length === 0)
    {
        pendingCaptionWords =
            limitPendingWords(translatedText);

        console.log(
            "eSign AI: no dictionary animation found for:",
            translatedText
        );

        return;
        }

        console.log(
            "eSign AI matched signs:",
            signMatches
        );

        signMatches.forEach((signMatch) =>
        {
            console.log(
                "eSign AI calling playMatchedSign:",
                signMatch
            );

            playMatchedSign(
                signMatch,
                translatedText || captionText
            );
        });

        /*
        * Remove the words already translated, but preserve any
        * unmatched words after the final sign.
        */
       pendingCaptionWords = getRemainingPendingWords
       (
        translatedText,
        signMatches
        );

        console.log(
            "eSign AI remaining pending words:",
            pendingCaptionWords
        );
    }



    // ==========================================
// eSign AI Developer Test Message Listener
// Must remain inside the same scope as processCaption()
// ==========================================

window.addEventListener("message", function (event) 
{

    if (event.source !== window) {
        return;
    }

    if (!event.data) {
        return;
    }

    if (event.data.source !== "ESIGN_AI_TEST") {
        return;
    }

    if (event.data.type !== "TEST_CAPTION") {
        return;
    }

    const testText = String(
        event.data.text || ""
    ).trim();

    if (!testText) {
        console.warn(
            "eSign AI TEST: No text was supplied."
        );

        return;
    }

    console.log(
        "================================"
    );

    console.log(
        "eSign AI TEST caption:",
        testText
    );

    console.log(
        "================================"
    );

    processDeveloperCaption(testText);
    });


    /**
     * Processes Developer Panel text without changing YouTube caption memory.
     * This keeps live YouTube caption detection and developer testing independent.
     */
    async function processDeveloperCaption(captionText) {
        const originalText = String(captionText || "").trim();
        const cleanCaption = cleanText(originalText);

        if (!cleanCaption) {
            return;
        }

        // The full developer sentence must always appear on the avatar canvas.
        sendAvatarCommand({
            type: "SET_CAPTION",
            text: originalText
        });

        let translatedText = cleanCaption;

        if (
            window.eSignTranslator &&
            typeof window.eSignTranslator.translateCaptionForSigning === "function"
        ) {
            translatedText = await window.eSignTranslator
                .translateCaptionForSigning(cleanCaption);
        }

        sendAvatarCommand({
            type: "SET_CAPTION",
            text: translatedText || originalText
        });

        const signMatches = findMatchingSigns(translatedText);

        console.log("eSign AI developer translation:", {
            original: originalText,
            translated: translatedText,
            matches: signMatches
        });

        if (!Array.isArray(signMatches) || signMatches.length === 0) {
            return;
        }

        signMatches.forEach((signMatch) => {
            playMatchedSign(signMatch, originalText);
        });
    }




    function normalizeCaptionText(text) 
    {
        return String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
    }


        function getNewCaptionPart(previousCaption, currentCaption) 
        {
            if (!previousCaption) {
                return currentCaption;
            }

            if (currentCaption.startsWith(previousCaption)) {
                return currentCaption
                    .slice(previousCaption.length)
                    .trim();
            }

            /*
            * YouTube sometimes removes words from the beginning:
            *
            * "hello everyone welcome"
            * becomes
            * "everyone welcome to the channel"
            *
            * Find the largest overlap between the previous ending
            * and the current beginning.
            */
            const previousWords = previousCaption.split(" ");
            const currentWords = currentCaption.split(" ");

            const maximumOverlap = Math.min(
                previousWords.length,
                currentWords.length
            );

            for (
                let overlapSize = maximumOverlap;
                overlapSize > 0;
                overlapSize -= 1
            ) {
                const previousEnding = previousWords
                    .slice(-overlapSize)
                    .join(" ");

                const currentBeginning = currentWords
                    .slice(0, overlapSize)
                    .join(" ");

                if (previousEnding === currentBeginning) {
                    return currentWords
                        .slice(overlapSize)
                        .join(" ")
                        .trim();
                }
            }

            // This is probably a completely new caption.
            return currentCaption;
        }


        /**
 * Converts spoken-language captions into a form that is easier
 * for the selected sign-language dictionary to process.
 */
    function transformToSignLanguageGrammar(text, languageCode = "USL")
    {
        const normalizedText = normalizeCaptionText(text);

        if (!normalizedText) {
            return "";
        }

        switch (languageCode) {
            case "USL":
                return transformToUSLGrammar(normalizedText);

            case "ASL":
                return transformToASLGrammar(normalizedText);

            case "BSL":
                return transformToBSLGrammar(normalizedText);

            default:
                return normalizedText;
        }
    }


        /**
         * Initial Ugandan Sign Language processing profile.
         *
         * These first rules remove common spoken-English filler words.
         * More verified USL-specific grammar rules can be added later.
         */
    function transformToUSLGrammar(text) 
    {
        let transformedText = text;

        transformedText = removeGrammarWords(
            transformedText,
            [
                "a",
                "an",
                "the"
            ]
        );

        transformedText = replaceGrammarPhrase(
            transformedText,
            "would you please",
            "please"
        );

        transformedText = replaceGrammarPhrase(
            transformedText,
            "can you please",
            "please"
        );

        transformedText = replaceGrammarPhrase(
            transformedText,
            "could you please",
            "please"
        );

        transformedText = replaceGrammarPhrase(
            transformedText,
            "do you want to",
            "you want"
        );

        transformedText = replaceGrammarPhrase(
            transformedText,
            "are you able to",
            "you can"
        );

        return normalizeCaptionText(transformedText);
    }


    /**
     * Placeholder for future American Sign Language rules.
     */
    function transformToASLGrammar(text) 
    {
        return normalizeCaptionText(text);
    }


    /**
     * Placeholder for future British Sign Language rules.
     */
    function transformToBSLGrammar(text) 
    {
        return normalizeCaptionText(text);
    }


    /**
     * Removes selected complete words without affecting parts
     * of longer words.
     */
    function removeGrammarWords(text, wordsToRemove) 
    {
        const wordSet = new Set(
            wordsToRemove.map((word) =>
                normalizeCaptionText(word)
            )
        );

        return text
            .split(" ")
            .filter((word) => !wordSet.has(word))
            .join(" ")
            .trim();
    }


    /**
     * Replaces a complete phrase inside normalized text.
     */
    function replaceGrammarPhrase(text, phrase, replacement) 
    {
        const normalizedText = normalizeCaptionText(text);
        const normalizedPhrase = normalizeCaptionText(phrase);
        const normalizedReplacement =
            normalizeCaptionText(replacement);

        if (!normalizedPhrase) {
            return normalizedText;
        }

        const escapedPhrase = normalizedPhrase.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const phrasePattern = new RegExp(
            `(^|\\s)${escapedPhrase}(?=\\s|$)`,
            "g"
        );

        return normalizedText
            .replace(
                phrasePattern,
                (fullMatch, leadingSpace) =>
                    `${leadingSpace}${normalizedReplacement}`
            )
            .replace(/\s+/g, " ")
            .trim();
    }




        /**
 * Checks whether the current caption continues from the previous caption.
 */
    function captionsAreRelated(previousCaption, currentCaption) 
    {
        if (!previousCaption || !currentCaption) {
            return false;
        }

        if (
            currentCaption.startsWith(previousCaption) ||
            previousCaption.startsWith(currentCaption)
        ) {
            return true;
        }

        const previousWords = previousCaption.split(" ");
        const currentWords = currentCaption.split(" ");

        const maximumOverlap = Math.min(
            previousWords.length,
            currentWords.length
        );

        for (
            let overlapSize = maximumOverlap;
            overlapSize > 0;
            overlapSize -= 1
        ) {
            const previousEnding = previousWords
                .slice(-overlapSize)
                .join(" ");

            const currentBeginning = currentWords
                .slice(0, overlapSize)
                .join(" ");

            if (previousEnding === currentBeginning) {
                return true;
            }
        }

        return false;
        }


        /**
         * Keeps only a limited number of recent unmatched words.
         * This prevents the pending buffer from becoming too large.
         */
        function limitPendingWords(text, maximumWords = 8) 
        {
        const normalizedText = normalizeCaptionText(text);

        if (!normalizedText) {
            return "";
        }

        const words = normalizedText.split(" ");

        return words
        .slice(-maximumWords)
        .join(" ")
        .trim();
        }


        /**
         * Keeps only the words that appear after the final matched sign.
         */
        function getRemainingPendingWords(text, signMatches)
        {
        const normalizedText = normalizeCaptionText(text);

        if (
            !normalizedText ||
            !Array.isArray(signMatches) ||
            signMatches.length === 0
        ) {
            return limitPendingWords(normalizedText);
        }

        let finalMatchedPosition = 0;

        signMatches.forEach((signMatch) => {
            const phrase =
                signMatch.normalizedPhrase ||
                normalizeCaptionText(signMatch.phrase);

            const matchEnd =
                Number(signMatch.position || 0) +
                phrase.length;

            if (matchEnd > finalMatchedPosition) {
                finalMatchedPosition = matchEnd;
            }
        });

        const remainingText = normalizedText
            .slice(finalMatchedPosition)
            .trim();

        return limitPendingWords(remainingText);
    }




    /**
     * Finds a known sign inside the caption.
     */
    function findMatchingSigns(text) 
    {
        const normalizedText = normalizeCaptionText(text);

        if (!normalizedText) {
            return [];
        }

        const possibleMatches = [];

        SIGN_DICTIONARY.forEach((entry) =>
        {
        if (!entry) {
        return;
        }

        const entryPhrases = Array.isArray(entry.phrases)
        ? entry.phrases
        : entry.phrase
            ? [entry.phrase]
            : [];

        entryPhrases.forEach((phrase) => {
        const normalizedPhrase =
            normalizeCaptionText(phrase);

        if (!normalizedPhrase) 
        {
            return;
        }

            /*
            * Find every occurrence of this phrase.
            */
            const searchableText = ` ${normalizedText} `;
            const searchablePhrase = ` ${normalizedPhrase} `;

            let searchPosition = 0;

            while (searchPosition < searchableText.length) {
            const matchPosition = searchableText.indexOf(
                searchablePhrase,
                searchPosition
            );

            if (matchPosition === -1) {
                break;
            }

            possibleMatches.push({
                ...entry,

                phrase: phrase,

                position: Math.max(
                    0,
                    matchPosition - 1
                ),

                normalizedPhrase
            });

            searchPosition =
                matchPosition +
                searchablePhrase.length;
            }
         });
        });

        if (possibleMatches.length === 0) {
            return [];
        }

        /*
        * First evaluate matches by:
        *
        * 1. Position in the caption
        * 2. Higher priority
        * 3. Longer phrase
        */
        possibleMatches.sort((first, second) => {
            if (first.position !== second.position) {
                return first.position - second.position;
            }

            const priorityDifference =
                Number(second.priority || 0) -
                Number(first.priority || 0);

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            return (
                second.normalizedPhrase.length -
                first.normalizedPhrase.length
            );
        });

        /*
        * Remove overlapping matches.
        *
        * Example:
        * If the dictionary later contains both:
        *
        * "good"
        * "good morning"
        *
        * We should play only "good morning", because it is the
        * longer and more specific phrase.
        */
        const selectedMatches = [];

        possibleMatches.forEach((candidate) => {
            const candidateStart = candidate.position;
            const candidateEnd =
                candidateStart +
                candidate.normalizedPhrase.length;

            const overlapsExistingMatch =
                selectedMatches.some((selected) => {
                    const selectedStart = selected.position;
                    const selectedEnd =
                        selectedStart +
                        selected.normalizedPhrase.length;

                    return (
                        candidateStart < selectedEnd &&
                        candidateEnd > selectedStart
                    );
                });

            if (!overlapsExistingMatch) {
                selectedMatches.push(candidate);
            }
        });

        /*
        * Return matches in the order they appeared in the caption.
        */
        selectedMatches.sort(
            (first, second) =>
                first.position - second.position
        );

        return selectedMatches;
    }

    /**
     * Checks for a complete word or phrase.
     *
     * This prevents "hi" from matching inside a word such as "this".
     */
    function containsCompletePhrase(
        caption,
        phrase
    ) {
        const escapedPhrase =
            escapeRegularExpression(
                cleanText(phrase)
            ).replace(/\s+/g, "\\s+");

        const expression =
            new RegExp(
                `(^|\\s)${escapedPhrase}(?=\\s|$)`,
                "i"
            );

        return expression.test(caption);
    }

    /**
     * Sends the matched animation to the avatar.
     */
    function playMatchedSign(
            signMatch,
            originalCaption
        ) 
    {
        console.log
        (
            "eSign AI DEBUG: preparing animation",
            signMatch
        );

        console.log
        (
        "eSign AI DEBUG playMatchedSign received:",
        signMatch
        );
            if (!signMatch) {
                return;
            }

            if (
                Array.isArray(signMatch.sequence) &&
                signMatch.sequence.length > 0
            ) {
                signMatch.sequence.forEach(
                    (animationName) => {
                        sendAvatarCommand({
                            type: "PLAY_ANIMATION",
                            animation: animationName,
                            caption: originalCaption,
                            fadeDuration: 0.25
                        });
                    }
                );

                return;
            }

            if (signMatch.animation) {
                sendAvatarCommand({
                    type: "PLAY_ANIMATION",
                    animation: signMatch.animation,
                    caption: originalCaption,
                    fadeDuration: 0.25
                });
            }
    }

        /**
         * Resets caption memory after captions disappear.
         */
        function scheduleCaptionReset()
        {
            if (captionClearTimer !== null) {
                return;
            }

            captionClearTimer = window.setTimeout(() => {
                captionClearTimer = null;
                lastCaptionText = "";
                lastAnimationName = "";
                lastAnimationTime = 0;
            }, 1200);
}

/**
 * Cancels the reset when captions are still visible.
 */
function cancelCaptionReset() 
{
    if (captionClearTimer === null) {
        return;
    }

    window.clearTimeout(captionClearTimer);
    captionClearTimer = null;
}

    /**
     * Sends a command to avatar.html through its iframe.
     */
    function sendAvatarCommand(command) {
        const iframe =
            document.getElementById(
                IFRAME_ID
            );

        if (
            !iframe ||
            !iframe.contentWindow
        ) {
            return false;
        }

        iframe.contentWindow.postMessage(
            {
                source: MESSAGE_SOURCE,
                ...command
            },
            "*"
        );

        return true;
    }

    /**
     * Cleans text for matching.
     */
    function cleanText(text) {
        return String(text || "")
            .toLowerCase()
            .replace(
                /[\u2018\u2019]/g,
                "'"
            )
            .replace(
                /[^a-z0-9'\s]/g,
                " "
            )
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Escapes text before placing it inside a regular expression.
     */
    function escapeRegularExpression(text) {
        return text.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    }

    /**
     * Resets the caption system when YouTube opens another video.
     */
    function resetForNewVideo() {
        lastCaptionText = "";
        lastAnimationName = "";
        lastAnimationTime = 0;

        stopCaptionDetection();

        window.setTimeout(() => {
            createAvatarWindow();

            if (
                document.getElementById(
                    BOX_ID
                )
            ) {
                startCaptionDetection();

                sendAvatarCommand({
                    type: "PLAY_IDLE"
                });
            }
        }, 700);
    }

    /**
     * Handles YouTube's internal page navigation.
     */
    function watchYouTubeNavigation() {
        document.addEventListener(
            "yt-navigate-finish",
            resetForNewVideo
        );
    }

    /**
     * Logs responses coming from the avatar iframe.
     */
    function listenForAvatarResponses()
    {
        window.addEventListener(
            "message",
            (event) => {
                const message = event.data;

                if (
                    !message ||
                    message.source !==
                        MESSAGE_SOURCE
                ) {
                    return;
                }

                console.log(
                    "eSign AI avatar response:",
                    message
                );
            }
        );
    }
    /**
 * Receives simulated captions from the YouTube page console.
 */
    function listenForTestCaptions()
    {
        window.addEventListener(
        "message",
        (event) => {
            if (event.source !== window) {
                return;
            }

            const message = event.data;

            if (
                !message ||
                message.source !==
                    "ESIGN_AI_TEST" ||
                message.type !==
                    "SIMULATE_CAPTION"
            ) {
                return;
            }

            const captionText = String(
                message.text || ""
            ).trim();

            if (!captionText) {
                console.warn(
                    "eSign AI Test: Caption text is empty."
                );

                return;
            }

            console.log(
                "eSign AI Test: Simulated caption:",
                captionText
            );

            processCaption(captionText);
        }
        );
    }

    /**
 * Exposes eSignAITest inside YouTube's normal console.
 */
    
    /**
     * Temporary developer controls.
     *
     * These can be used in the YouTube console.
     */
    window.eSignAI = {
        play(animation, caption = animation) {
            return sendAvatarCommand({
                type: "PLAY_ANIMATION",
                animation,
                caption,
                fadeDuration: 0.25
            });
        },

        idle() {
            return sendAvatarCommand({
                type: "PLAY_IDLE"
            });
        },

        caption(text) {
            return sendAvatarCommand({
                type: "SET_CAPTION",
                text
            });
        },

        readCaption() {
            return readCurrentYouTubeCaption();
        },

        restartCaptionDetection() {
            startCaptionDetection();
        }
    };

    createAvatarWindow();
    watchYouTubeNavigation();
    listenForAvatarResponses();
    listenForTestCaptions();

// start of debug pannel 
        // ======================================================
// eSign AI Developer Control Panel
// ======================================================

function createESignDeveloperPanel()
{
    // Prevent duplicate panels.
    if (
        document.getElementById(
            "esign-ai-developer-panel"
        )
    )
    {
        return;
    }


    // ==================================================
    // CREATE PANEL
    // ==================================================

    const panel =
        document.createElement("div");

    panel.id =
        "esign-ai-developer-panel";


    panel.innerHTML = `

        <div id="esign-dev-header">

            <div id="esign-dev-title">

                <span id="esign-dev-title-icon">
                    AI
                </span>

                <div>
                    <div>
                        eSign AI Developer
                    </div>

                    <div id="esign-dev-subtitle">
                        Offline translation debugger
                    </div>
                </div>

            </div>


            <div id="esign-dev-header-buttons">

                <button
                    id="esign-dev-minimize"
                    type="button"
                    title="Minimize panel"
                >
                    −
                </button>

                <button
                    id="esign-dev-close"
                    type="button"
                    title="Close panel"
                >
                    ×
                </button>

            </div>

        </div>


        <div id="esign-dev-body">

            <label id="esign-dev-label">
                Text to Sign
            </label>


            <textarea
                id="esign-dev-input"
                placeholder="Type a sentence such as: Hello everyone, thank you for watching."
                rows="4"
            ></textarea>


            <div id="esign-dev-input-help">

                Press
                <strong>Ctrl + Enter</strong>
                to test

            </div>


            <button
                id="esign-dev-play"
                type="button"
            >
                ▶ Analyze and Play
            </button>


            <div id="esign-dev-status">
                Ready to test
            </div>


            <div class="esign-dev-main-section">

                <div class="esign-dev-section-header">

                    <div class="esign-dev-section-title">
                        Quick Tests
                    </div>

                </div>


                <div id="esign-dev-quick-buttons">

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Hello"
                    >
                        Hello
                    </button>

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Thank you"
                    >
                        Thank You
                    </button>

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Welcome"
                    >
                        Welcome
                    </button>

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Good"
                    >
                        Good
                    </button>

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Bye"
                    >
                        Bye
                    </button>

                    <button
                        class="esign-quick-test"
                        type="button"
                        data-text="Hello thank you"
                    >
                        Hello + Thank You
                    </button>

                </div>

            </div>


            <div id="esign-dev-last-test">

                Last test:

                <span id="esign-dev-last-text">
                    None
                </span>

            </div>


            <div id="esign-dev-analysis">


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Original Sentence
                        </div>

                        <span class="esign-analysis-badge">
                            Input
                        </span>

                    </div>

                    <div
                        id="esign-dev-original"
                        class="esign-analysis-content"
                    >
                        No sentence tested yet.
                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Simplified Sentence
                        </div>

                        <span class="esign-analysis-badge">
                            Offline
                        </span>

                    </div>

                    <div
                        id="esign-dev-simplified"
                        class="esign-analysis-content esign-highlighted-content"
                    >
                        No sentence analyzed yet.
                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Matched Signs
                        </div>

                        <span
                            id="esign-dev-matched-count"
                            class="esign-count-badge esign-count-success"
                        >
                            0
                        </span>

                    </div>

                    <div
                        id="esign-dev-matched"
                        class="esign-analysis-list"
                    >
                        No matching signs yet.
                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Missing Signs
                        </div>

                        <span
                            id="esign-dev-missing-count"
                            class="esign-count-badge esign-count-danger"
                        >
                            0
                        </span>

                    </div>

                    <div
                        id="esign-dev-missing"
                        class="esign-analysis-list"
                    >
                        No missing signs yet.
                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Dictionary Coverage
                        </div>

                        <div id="esign-dev-coverage-percent">
                            0%
                        </div>

                    </div>


                    <div id="esign-dev-coverage-summary">
                        0 matched / 0 total concepts
                    </div>


                    <div id="esign-dev-coverage-bar">

                        <div
                            id="esign-dev-coverage-fill"
                        ></div>

                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Animation Queue
                        </div>

                        <span class="esign-analysis-badge">
                            Playback
                        </span>

                    </div>

                    <div
                        id="esign-dev-queue"
                        class="esign-analysis-content"
                    >
                        Empty
                    </div>

                </div>


                <div class="esign-analysis-section">

                    <div class="esign-analysis-title-row">

                        <div class="esign-analysis-title">
                            Top Missing Words
                        </div>

                        <button
                            id="esign-dev-clear-statistics"
                            type="button"
                        >
                            Clear
                        </button>

                    </div>

                    <div
                        id="esign-dev-top-missing"
                        class="esign-analysis-list"
                    >
                        No statistics yet.
                    </div>

                </div>

            </div>

        </div>
    `;


    // ==================================================
    // CREATE STYLES
    // ==================================================

    const style =
        document.createElement("style");

    style.id =
        "esign-ai-developer-panel-style";


    style.textContent = `

        #esign-ai-developer-panel
        {
            position: fixed;

            top: 85px;
            left: 20px;

            width: 360px;

            max-width:
                calc(100vw - 30px);

            background: #ffffff;

            color: #1f2937;

            border-radius: 16px;

            box-shadow:
                0 18px 50px
                rgba(0, 0, 0, 0.34);

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            z-index: 2147483647;

            overflow: hidden;

            border:
                1px solid
                rgba(15, 23, 42, 0.13);
        }


        #esign-dev-header
        {
            display: flex;

            align-items: center;

            justify-content: space-between;

            padding: 12px 14px;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #1d4ed8,
                    #312e81
                );

            color: white;

            cursor: move;

            user-select: none;
        }


        #esign-dev-title
        {
            display: flex;

            align-items: center;

            gap: 10px;

            font-size: 14px;

            font-weight: 700;
        }


        #esign-dev-title-icon
        {
            display: flex;

            align-items: center;

            justify-content: center;

            width: 34px;
            height: 34px;

            border-radius: 10px;

            background:
                rgba(255, 255, 255, 0.18);

            border:
                1px solid
                rgba(255, 255, 255, 0.24);

            font-size: 12px;

            font-weight: 800;
        }


        #esign-dev-subtitle
        {
            margin-top: 2px;

            color:
                rgba(255, 255, 255, 0.76);

            font-size: 10px;

            font-weight: 500;
        }


        #esign-dev-header-buttons
        {
            display: flex;

            gap: 6px;
        }


        #esign-dev-header-buttons button
        {
            width: 28px;
            height: 28px;

            border: none;

            border-radius: 7px;

            background:
                rgba(255, 255, 255, 0.16);

            color: white;

            font-size: 18px;

            cursor: pointer;

            line-height: 26px;
        }


        #esign-dev-header-buttons button:hover
        {
            background:
                rgba(255, 255, 255, 0.30);
        }


        #esign-dev-body
        {
            max-height: 76vh;

            overflow-y: auto;

            padding: 14px;

            scrollbar-width: thin;
        }


        #esign-dev-label
        {
            display: block;

            margin-bottom: 7px;

            font-size: 13px;

            font-weight: 700;
        }


        #esign-dev-input
        {
            width: 100%;

            box-sizing: border-box;

            resize: vertical;

            min-height: 82px;

            padding: 10px;

            border:
                1px solid
                #cbd5e1;

            border-radius: 10px;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            font-size: 13px;

            line-height: 1.45;

            color: #111827;

            background: #f8fafc;

            outline: none;
        }


        #esign-dev-input:focus
        {
            border-color: #2563eb;

            background: #ffffff;

            box-shadow:
                0 0 0 3px
                rgba(37, 99, 235, 0.13);
        }


        #esign-dev-input-help
        {
            margin-top: 5px;

            color: #94a3b8;

            font-size: 10px;

            text-align: right;
        }


        #esign-dev-play
        {
            width: 100%;

            margin-top: 10px;

            padding: 11px;

            border: none;

            border-radius: 10px;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #1d4ed8
                );

            color: white;

            font-size: 13px;

            font-weight: 700;

            cursor: pointer;

            box-shadow:
                0 6px 14px
                rgba(37, 99, 235, 0.25);
        }


        #esign-dev-play:hover
        {
            filter: brightness(1.06);
        }


        #esign-dev-play:active
        {
            transform: scale(0.985);
        }


        #esign-dev-play:disabled
        {
            cursor: wait;

            opacity: 0.7;
        }


        #esign-dev-status
        {
            margin-top: 10px;

            padding: 9px 10px;

            border-radius: 9px;

            background: #eff6ff;

            color: #1d4ed8;

            font-size: 11px;

            font-weight: 700;
        }


        .esign-dev-main-section
        {
            margin-top: 15px;
        }


        .esign-dev-section-header
        {
            display: flex;

            align-items: center;

            justify-content: space-between;

            margin-bottom: 8px;
        }


        .esign-dev-section-title
        {
            font-size: 12px;

            font-weight: 800;

            color: #334155;
        }


        #esign-dev-quick-buttons
        {
            display: grid;

            grid-template-columns:
                repeat(2, 1fr);

            gap: 7px;
        }


        .esign-quick-test
        {
            padding: 8px 7px;

            border:
                1px solid
                #cbd5e1;

            border-radius: 8px;

            background: #f8fafc;

            color: #334155;

            font-size: 11px;

            font-weight: 700;

            cursor: pointer;
        }


        .esign-quick-test:hover
        {
            border-color: #2563eb;

            background: #eff6ff;

            color: #1d4ed8;
        }


        #esign-dev-last-test
        {
            margin-top: 14px;

            padding-top: 11px;

            border-top:
                1px solid
                #e2e8f0;

            font-size: 10px;

            color: #64748b;
        }


        #esign-dev-last-text
        {
            color: #1e293b;

            font-weight: 700;
        }


        #esign-dev-analysis
        {
            margin-top: 13px;
        }


        .esign-analysis-section
        {
            margin-top: 9px;

            padding: 10px;

            border:
                1px solid
                #e2e8f0;

            border-radius: 10px;

            background: #f8fafc;
        }


        .esign-analysis-title-row
        {
            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 8px;

            margin-bottom: 7px;
        }


        .esign-analysis-title
        {
            color: #334155;

            font-size: 11px;

            font-weight: 800;
        }


        .esign-analysis-badge
        {
            padding: 3px 6px;

            border-radius: 20px;

            background: #dbeafe;

            color: #1d4ed8;

            font-size: 9px;

            font-weight: 800;
        }


        .esign-count-badge
        {
            min-width: 18px;

            padding: 3px 6px;

            border-radius: 20px;

            font-size: 9px;

            font-weight: 800;

            text-align: center;
        }


        .esign-count-success
        {
            background: #dcfce7;

            color: #166534;
        }


        .esign-count-danger
        {
            background: #fee2e2;

            color: #991b1b;
        }


        .esign-analysis-content
        {
            color: #475569;

            font-size: 11px;

            line-height: 1.5;

            word-break: break-word;
        }


        .esign-highlighted-content
        {
            padding: 8px;

            border-radius: 7px;

            background: #ffffff;

            border:
                1px solid
                #dbeafe;

            color: #1e3a8a;

            font-weight: 700;
        }


        .esign-analysis-list
        {
            display: flex;

            flex-wrap: wrap;

            gap: 5px;

            color: #64748b;

            font-size: 11px;
        }


        .esign-matched-chip
        {
            padding: 4px 7px;

            border-radius: 20px;

            background: #dcfce7;

            color: #166534;

            font-size: 10px;

            font-weight: 700;
        }


        .esign-missing-chip
        {
            padding: 4px 7px;

            border-radius: 20px;

            background: #fee2e2;

            color: #991b1b;

            font-size: 10px;

            font-weight: 700;
        }


        .esign-statistic-chip
        {
            padding: 4px 7px;

            border-radius: 20px;

            background: #fef3c7;

            color: #92400e;

            font-size: 10px;

            font-weight: 700;
        }


        #esign-dev-coverage-summary
        {
            margin-bottom: 7px;

            color: #64748b;

            font-size: 10px;
        }


        #esign-dev-coverage-bar
        {
            width: 100%;

            height: 9px;

            overflow: hidden;

            border-radius: 10px;

            background: #e2e8f0;
        }


        #esign-dev-coverage-fill
        {
            width: 0%;

            height: 100%;

            border-radius: 10px;

            background:
                linear-gradient(
                    90deg,
                    #2563eb,
                    #22c55e
                );

            transition:
                width 0.3s ease;
        }


        #esign-dev-coverage-percent
        {
            color: #1d4ed8;

            font-size: 12px;

            font-weight: 900;
        }


        #esign-dev-clear-statistics
        {
            padding: 3px 7px;

            border:
                1px solid
                #cbd5e1;

            border-radius: 6px;

            background: white;

            color: #475569;

            font-size: 9px;

            font-weight: 700;

            cursor: pointer;
        }


        #esign-dev-clear-statistics:hover
        {
            border-color: #dc2626;

            color: #dc2626;
        }


        #esign-ai-open-developer
        {
            position: fixed;

            left: 18px;
            bottom: 18px;

            width: 50px;
            height: 50px;

            border: none;

            border-radius: 50%;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #312e81
                );

            color: white;

            font-size: 12px;

            font-weight: 800;

            cursor: pointer;

            box-shadow:
                0 8px 22px
                rgba(0, 0, 0, 0.32);

            z-index: 2147483647;

            display: none;
        }


        #esign-ai-open-developer:hover
        {
            transform: scale(1.05);
        }

    `;


    document.head.appendChild(style);

    document.body.appendChild(panel);


    // ==================================================
    // CREATE REOPEN BUTTON
    // ==================================================

    const reopenButton =
        document.createElement("button");

    reopenButton.id =
        "esign-ai-open-developer";

    reopenButton.textContent =
        "AI";

    reopenButton.title =
        "Open eSign AI Developer Panel";

    document.body.appendChild(
        reopenButton
    );


    // ==================================================
    // GET ELEMENTS
    // ==================================================

    const input =
        document.getElementById(
            "esign-dev-input"
        );

    const playButton =
        document.getElementById(
            "esign-dev-play"
        );

    const status =
        document.getElementById(
            "esign-dev-status"
        );

    const lastText =
        document.getElementById(
            "esign-dev-last-text"
        );

    const originalDisplay =
        document.getElementById(
            "esign-dev-original"
        );

    const simplifiedDisplay =
        document.getElementById(
            "esign-dev-simplified"
        );

    const matchedDisplay =
        document.getElementById(
            "esign-dev-matched"
        );

    const missingDisplay =
        document.getElementById(
            "esign-dev-missing"
        );

    const matchedCount =
        document.getElementById(
            "esign-dev-matched-count"
        );

    const missingCount =
        document.getElementById(
            "esign-dev-missing-count"
        );

    const coverageSummary =
        document.getElementById(
            "esign-dev-coverage-summary"
        );

    const coverageFill =
        document.getElementById(
            "esign-dev-coverage-fill"
        );

    const coveragePercent =
        document.getElementById(
            "esign-dev-coverage-percent"
        );

    const queueDisplay =
        document.getElementById(
            "esign-dev-queue"
        );

    const topMissingDisplay =
        document.getElementById(
            "esign-dev-top-missing"
        );

    const clearStatisticsButton =
        document.getElementById(
            "esign-dev-clear-statistics"
        );

    const minimizeButton =
        document.getElementById(
            "esign-dev-minimize"
        );

    const closeButton =
        document.getElementById(
            "esign-dev-close"
        );

    const body =
        document.getElementById(
            "esign-dev-body"
        );

    const header =
        document.getElementById(
            "esign-dev-header"
        );


    // ==================================================
    // STATUS HELPER
    // ==================================================

    function setDeveloperStatus(
        message,
        type = "info"
    )
    {
        status.textContent =
            message;

        if (type === "success")
        {
            status.style.background =
                "#ecfdf5";

            status.style.color =
                "#047857";

            return;
        }

        if (type === "error")
        {
            status.style.background =
                "#fef2f2";

            status.style.color =
                "#b91c1c";

            return;
        }

        if (type === "warning")
        {
            status.style.background =
                "#fffbeb";

            status.style.color =
                "#92400e";

            return;
        }

        status.style.background =
            "#eff6ff";

        status.style.color =
            "#1d4ed8";
    }


    // ==================================================
    // CHIP CREATOR
    // ==================================================

    function createAnalysisChip(
        text,
        className
    )
    {
        const chip =
            document.createElement("span");

        chip.className =
            className;

        chip.textContent =
            text;

        return chip;
    }


    // ==================================================
    // RENDER MATCHED SIGNS
    // ==================================================

    function renderMatchedSigns(
        matchedSigns
    )
    {
        matchedDisplay.innerHTML =
            "";

        const safeMatchedSigns =
            Array.isArray(matchedSigns)
                ? matchedSigns
                : [];

        matchedCount.textContent =
            String(safeMatchedSigns.length);

        if (
            safeMatchedSigns.length === 0
        )
        {
            matchedDisplay.textContent =
                "No matching signs.";

            return;
        }

        safeMatchedSigns.forEach(
            (matchedItem) =>
            {
                const animations =
                    Array.isArray(
                        matchedItem.animations
                    )
                        ? matchedItem.animations
                        : [];

                const animationText =
                    animations.length > 0
                        ? animations.join(" → ")
                        : "No animation";

                const chip =
                    createAnalysisChip(
                        `✓ ${matchedItem.phrase} (${animationText})`,
                        "esign-matched-chip"
                    );

                matchedDisplay.appendChild(
                    chip
                );
            }
        );
    }


    // ==================================================
    // RENDER MISSING SIGNS
    // ==================================================

    function renderMissingSigns(
        missingSigns
    )
    {
        missingDisplay.innerHTML =
            "";

        const safeMissingSigns =
            Array.isArray(missingSigns)
                ? missingSigns
                : [];

        missingCount.textContent =
            String(safeMissingSigns.length);

        if (
            safeMissingSigns.length === 0
        )
        {
            missingDisplay.textContent =
                "All concepts are available.";

            return;
        }

        safeMissingSigns.forEach(
            (missingWord) =>
            {
                const chip =
                    createAnalysisChip(
                        `✕ ${missingWord}`,
                        "esign-missing-chip"
                    );

                missingDisplay.appendChild(
                    chip
                );
            }
        );
    }


    // ==================================================
    // RENDER TOP MISSING WORDS
    // ==================================================

    function renderTopMissingWords()
    {
        topMissingDisplay.innerHTML =
            "";

        if (
            !window.eSignDictionaryTools ||
            typeof window.eSignDictionaryTools
                .getTopMissingWords !==
                "function"
        )
        {
            topMissingDisplay.textContent =
                "Dictionary statistics unavailable.";

            return;
        }

        const topMissingWords =
            window.eSignDictionaryTools
                .getTopMissingWords(10);

        if (
            !Array.isArray(topMissingWords) ||
            topMissingWords.length === 0
        )
        {
            topMissingDisplay.textContent =
                "No statistics yet.";

            return;
        }

        topMissingWords.forEach(
            (item) =>
            {
                const chip =
                    createAnalysisChip(
                        `${item.word} (${item.count})`,
                        "esign-statistic-chip"
                    );

                topMissingDisplay.appendChild(
                    chip
                );
            }
        );
    }


    // ==================================================
    // RENDER COVERAGE RESULTS
    // ==================================================

    function renderCoverageAnalysis(
        originalText,
        simplifiedText,
        coverage
    )
    {
        originalDisplay.textContent =
            originalText ||
            "No original sentence.";

        simplifiedDisplay.textContent =
            simplifiedText ||
            "No simplified sentence.";

        renderMatchedSigns(
            coverage.matched
        );

        renderMissingSigns(
            coverage.missing
        );

        coverageSummary.textContent =
            `${coverage.matchedConceptCount} matched / ` +
            `${coverage.totalConceptCount} total concepts`;

        coverageFill.style.width =
            `${coverage.coveragePercentage}%`;

        coveragePercent.textContent =
            `${coverage.coveragePercentage}%`;

        if (
            Array.isArray(
                coverage.animationQueue
            ) &&
            coverage.animationQueue.length > 0
        )
        {
            queueDisplay.textContent =
                coverage.animationQueue.join(
                    " → "
                ) +
                " → Idle";
        }
        else
        {
            queueDisplay.textContent =
                "No animations queued.";
        }

        renderTopMissingWords();
    }


    // ==================================================
    // ANALYZE AND PLAY
    // ==================================================

    async function sendDeveloperTest(
        text
    )
    {
        const cleanText =
            String(text || "").trim();

        if (!cleanText)
        {
            setDeveloperStatus(
                "Please type a phrase first.",
                "error"
            );

            input.focus();

            return;
        }


        playButton.disabled =
            true;

        playButton.textContent =
            "Analyzing...";

        lastText.textContent =
            cleanText;

        setDeveloperStatus(
            "Analyzing sentence...",
            "info"
        );


        try
        {
            if (
                !window.eSignTranslator ||
                typeof window.eSignTranslator
                    .translateCaptionForSigning !==
                    "function"
            )
            {
                throw new Error(
                    "Translator is not available."
                );
            }


            if (
                !window.eSignDictionaryTools ||
                typeof window.eSignDictionaryTools
                    .analyzeCoverage !==
                    "function"
            )
            {
                throw new Error(
                    "Dictionary coverage analyzer is not available."
                );
            }


            const simplifiedText =
                await window.eSignTranslator
                    .translateCaptionForSigning(
                        cleanText
                    );


            const coverage =
                window.eSignDictionaryTools
                    .analyzeCoverage(
                        simplifiedText
                    );


            if (
                typeof window.eSignDictionaryTools
                    .recordMissingWords ===
                    "function"
            )
            {
                window.eSignDictionaryTools
                    .recordMissingWords(
                        coverage.missing
                    );
            }


            renderCoverageAnalysis(
                cleanText,
                simplifiedText,
                coverage
            );


            if (
                coverage.matchedConceptCount > 0
            )
            {
                setDeveloperStatus(
                    `Playing ${coverage.matchedConceptCount} matched sign concept(s).`,
                    "success"
                );
            }
            else
            {
                setDeveloperStatus(
                    "No matching signs were found.",
                    "warning"
                );
            }


            console.log(
                "eSign AI Developer Analysis:",
                {
                    original:
                        cleanText,

                    simplified:
                        simplifiedText,

                    coverage
                }
            );


            /*
             * Send the original sentence through
             * the normal caption pipeline.
             */
            window.postMessage(
                {
                    source:
                        "ESIGN_AI_TEST",

                    type:
                        "TEST_CAPTION",

                    text:
                        cleanText
                },
                "*"
            );
        }
        catch (error)
        {
            console.error(
                "eSign AI developer analysis failed:",
                error
            );

            setDeveloperStatus(
                `Analysis failed: ${error.message}`,
                "error"
            );
        }
        finally
        {
            playButton.disabled =
                false;

            playButton.textContent =
                "▶ Analyze and Play";
        }
    }


    // ==================================================
    // PLAY BUTTON
    // ==================================================

    playButton.addEventListener(
        "click",
        () =>
        {
            sendDeveloperTest(
                input.value
            );
        }
    );


    // ==================================================
    // CTRL + ENTER
    // ==================================================

    input.addEventListener(
        "keydown",
        (event) =>
        {
            if (
                event.key === "Enter" &&
                event.ctrlKey
            )
            {
                event.preventDefault();

                sendDeveloperTest(
                    input.value
                );
            }
        }
    );


    // ==================================================
    // QUICK TEST BUTTONS
    // ==================================================

    const quickButtons =
        panel.querySelectorAll(
            ".esign-quick-test"
        );

    quickButtons.forEach(
        (button) =>
        {
            button.addEventListener(
                "click",
                () =>
                {
                    const testText =
                        button.dataset.text;

                    input.value =
                        testText;

                    sendDeveloperTest(
                        testText
                    );
                }
            );
        }
    );


    // ==================================================
    // CLEAR STATISTICS
    // ==================================================

    clearStatisticsButton.addEventListener(
        "click",
        () =>
        {
            if (
                window.eSignDictionaryTools &&
                typeof window.eSignDictionaryTools
                    .clearMissingStatistics ===
                    "function"
            )
            {
                window.eSignDictionaryTools
                    .clearMissingStatistics();
            }

            renderTopMissingWords();

            setDeveloperStatus(
                "Missing-word statistics cleared.",
                "info"
            );
        }
    );


    // ==================================================
    // MINIMIZE PANEL
    // ==================================================

    let panelMinimized =
        false;

    minimizeButton.addEventListener(
        "click",
        () =>
        {
            panelMinimized =
                !panelMinimized;

            if (panelMinimized)
            {
                body.style.display =
                    "none";

                minimizeButton.textContent =
                    "+";
            }
            else
            {
                body.style.display =
                    "block";

                minimizeButton.textContent =
                    "−";
            }
        }
    );


    // ==================================================
    // CLOSE AND REOPEN PANEL
    // ==================================================

    closeButton.addEventListener(
        "click",
        () =>
        {
            panel.style.display =
                "none";

            reopenButton.style.display =
                "block";
        }
    );


    reopenButton.addEventListener(
        "click",
        () =>
        {
            panel.style.display =
                "block";

            reopenButton.style.display =
                "none";
        }
    );


    // ==================================================
    // DRAG PANEL
    // ==================================================

    let dragging =
        false;

    let dragOffsetX =
        0;

    let dragOffsetY =
        0;


    header.addEventListener(
        "mousedown",
        (event) =>
        {
            if (
                event.target.tagName ===
                "BUTTON"
            )
            {
                return;
            }

            dragging =
                true;

            const panelRectangle =
                panel.getBoundingClientRect();

            dragOffsetX =
                event.clientX -
                panelRectangle.left;

            dragOffsetY =
                event.clientY -
                panelRectangle.top;

            event.preventDefault();
        }
    );


    document.addEventListener(
        "mousemove",
        (event) =>
        {
            if (!dragging)
            {
                return;
            }

            let newLeft =
                event.clientX -
                dragOffsetX;

            let newTop =
                event.clientY -
                dragOffsetY;


            const maximumLeft =
                window.innerWidth -
                panel.offsetWidth;

            const maximumTop =
                window.innerHeight -
                panel.offsetHeight;


            newLeft =
                Math.max(
                    0,
                    Math.min(
                        newLeft,
                        maximumLeft
                    )
                );

            newTop =
                Math.max(
                    0,
                    Math.min(
                        newTop,
                        maximumTop
                    )
                );


            panel.style.left =
                `${newLeft}px`;

            panel.style.top =
                `${newTop}px`;

            panel.style.right =
                "auto";

            panel.style.bottom =
                "auto";
        }
    );


    document.addEventListener(
        "mouseup",
        () =>
        {
            dragging =
                false;
        }
    );


    renderTopMissingWords();


    console.log(
        "eSign AI: Developer panel version 2 created."
    );
}


// ======================================================
// Start Developer Panel
// ======================================================

function startESignDeveloperPanel()
{
    if (document.body)
    {
        createESignDeveloperPanel();

        return;
    }

    document.addEventListener(
        "DOMContentLoaded",
        createESignDeveloperPanel,
        {
            once: true
        }
    );
}


startESignDeveloperPanel();



// Developer test listener is registered once above.

})(); 
// end of content.js