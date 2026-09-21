// ============================================================
// eSign AI - Avatar Message Bus with Animation Queue
// Receives commands and plays sign animations sequentially
// ============================================================

(() => {
    "use strict";

    const MESSAGE_SOURCE = "ESIGN_AI";

    const animationQueue = [];

    let currentCommand = null;
    let currentAnimationTimer = null;
    let avatarReadyCheckTimer = null;
    let queueIsProcessing = false;

    console.log("eSign AI: Animation queue message bus loaded.");

    window.addEventListener("message", handleIncomingMessage);

    /**
     * Receives commands from content.js.
     */
    function handleIncomingMessage(event) {
        if (event.source !== window.parent) {
            return;
        }

        const message = event.data;

        if (!isValidMessage(message)) {
            return;
        }

        console.log("eSign AI: Command received:", message);

        switch (message.type) {
            case "PLAY_ANIMATION":
                addAnimationToQueue(message);
                break;

            case "PLAY_IDLE":
                clearAnimationQueue();
                playIdle();
                break;

            case "SET_CAPTION":
                setCaption(message.text);
                break;

            case "CLEAR_QUEUE":
                clearAnimationQueue();
                break;

            case "LIST_ANIMATIONS":
                sendAnimationList();
                break;

            case "CHECK_READY":
                sendReadyStatus();
                break;

            default:
                sendResponse({
                    type: "COMMAND_ERROR",
                    error: `Unknown command: ${message.type}`
                });
        }
    }

    /**
     * Confirms that a message belongs to eSign AI.
     */
    function isValidMessage(message) {
        return Boolean(
            message &&
            typeof message === "object" &&
            message.source === MESSAGE_SOURCE &&
            typeof message.type === "string"
        );
    }

    /**
     * Adds an animation command to the queue.
     */
    function addAnimationToQueue(message) {
        const animationName = String(
            message.animation || ""
        ).trim();

        if (!animationName) {
            sendResponse({
                type: "COMMAND_ERROR",
                error: "No animation name was provided."
            });

            return;
        }

        const command = {
            animation: animationName,
            caption: String(
                message.caption || animationName
            ).trim(),

            durationMs: getNumber
            (
                message.durationMs,
                null
            ),

            fadeDuration: getNumber(
                message.fadeDuration,
                0.25
            )
        };

        /*
         * Prevent the same animation from being inserted repeatedly
         * beside itself in the queue.
         */
        if (isDuplicateQueuedAnimation(command.animation)) {
            console.log(
                `eSign AI: Duplicate "${command.animation}" ignored.`
            );

            sendResponse({
                type: "ANIMATION_DUPLICATE_IGNORED",
                animation: command.animation
            });

            return;
        }

        animationQueue.push(command);

        console.log(
            "eSign AI: Animation added to queue:",
            command.animation
        );

        sendResponse({
            type: "ANIMATION_QUEUED",
            animation: command.animation,
            queueLength: animationQueue.length
        });

        processAnimationQueue();
    }

    /**
     * Checks whether this animation is already playing
     * or is the latest queued animation.
     */
    function isDuplicateQueuedAnimation(animationName) {
        const normalizedName =
            normalizeAnimationName(animationName);

        if (
            currentCommand &&
            normalizeAnimationName(
                currentCommand.animation
            ) === normalizedName
        ) {
            return true;
        }

        const lastQueuedCommand =
            animationQueue[
                animationQueue.length - 1
            ];

        if (
            lastQueuedCommand &&
            normalizeAnimationName(
                lastQueuedCommand.animation
            ) === normalizedName
        ) {
            return true;
        }

        return false;
    }

    /**
     * Processes animations one by one.
     */
    function processAnimationQueue() {
        if (queueIsProcessing) {
            return;
        }

        if (!avatarEngineIsReady()) {
            waitForAvatar();
            return;
        }

        if (animationQueue.length === 0) {
            playIdle();
            return;
        }

        queueIsProcessing = true;

        currentCommand =
            animationQueue.shift();

        playQueuedAnimation(
            currentCommand
        );
    }

    /**
     * Plays the next queued animation.
     */
    function playQueuedAnimation(command)
     {
        clearCurrentAnimationTimer();

        const played =
            window.eSignAvatar.playAnimation(
                command.animation,
                {
                    loop: false,
                    fadeDuration:
                        command.fadeDuration
                }
            );

        if (!played) {
            console.warn(
                `eSign AI: Animation "${command.animation}" was not found.`
            );

            setCaption(
                `Sign unavailable: ${command.caption}`
            );

            sendResponse({
                type: "ANIMATION_NOT_FOUND",
                animation: command.animation
            });

            finishCurrentAnimation(1000);
            return;
        }

        setCaption(command.caption);

        sendResponse({
            type: "ANIMATION_STARTED",
            animation: command.animation,
            remainingQueue:
                animationQueue.length
        });

        console.log(
            `eSign AI: Playing "${command.animation}".`
        );

        const realDurationMs =
        getRealAnimationDurationMs
        (
            command.animation,
            command.durationMs
        );

        console.log
        (
            `eSign AI: "${command.animation}" duration:`,
            realDurationMs,
            "ms"
        );

        currentAnimationTimer = window.setTimeout(() =>
        {
            currentAnimationTimer = null;
            completeCurrentAnimation();
        }, realDurationMs);
    }

    function getRealAnimationDurationMs
        (
            animationName,
            requestedDurationMs
        ) 
    {
            /*
            * Use a manually provided duration only when it is valid.
            */
            if (
                Number.isFinite(requestedDurationMs) &&
                requestedDurationMs > 0
            ) {
                return Math.max(300, requestedDurationMs);
            }

            if (
                avatarEngineIsReady() &&
                typeof window.eSignAvatar.getAnimationDuration ===
                    "function"
            ) {
                const durationSeconds =
                    window.eSignAvatar.getAnimationDuration(
                        animationName
                    );

                if (
                    Number.isFinite(durationSeconds) &&
                    durationSeconds > 0
                ) {
                    /*
                    * Convert seconds to milliseconds.
                    * Subtract a small amount so the next sign begins
                    * without an unnecessary pause.
                    */
                    return Math.max(
                        300,
                        durationSeconds * 1000 - 100
                    );
                }
            }

            return 1200;
    }

    /**
     * Completes the current sign and begins the next one.
     */
    function completeCurrentAnimation() {
        if (currentCommand) {
            sendResponse({
                type: "ANIMATION_FINISHED",
                animation:
                    currentCommand.animation
            });
        }

        currentCommand = null;
        queueIsProcessing = false;

        if (animationQueue.length > 0) {
            /*
             * Small transition delay between signs.
             * This prevents immediate animation collisions.
             */
            window.setTimeout(() => 
            {
            processAnimationQueue();
            }, 20);

            return;
        }

        playIdle();
    }

    /**
     * Finishes a failed or unavailable animation.
     */
    function finishCurrentAnimation(delayMs) {
        clearCurrentAnimationTimer();

        currentAnimationTimer =
            window.setTimeout(() => {
                currentAnimationTimer = null;

                completeCurrentAnimation();
            }, delayMs);
    }

    /**
     * Returns the avatar to Idle.
     */
    function playIdle() {
        if (!avatarEngineIsReady()) {
            return false;
        }

        const played =
            window.eSignAvatar.playIdle();

        if (played) {
            setCaption(
                "Waiting for captions..."
            );

            sendResponse({
                type: "IDLE_STARTED"
            });
        }

        return played;
    }

    /**
     * Clears waiting animations.
     *
     * It does not stop the animation currently playing unless
     * PLAY_IDLE is also received.
     */
    function clearAnimationQueue() {
        animationQueue.length = 0;

        sendResponse({
            type: "QUEUE_CLEARED"
        });

        console.log(
            "eSign AI: Animation queue cleared."
        );
    }

    /**
     * Stops the current timer.
     */
    function clearCurrentAnimationTimer() {
        if (currentAnimationTimer !== null) {
            window.clearTimeout(
                currentAnimationTimer
            );

            currentAnimationTimer = null;
        }
    }

    /**
     * Updates the caption below the avatar.
     */
    function setCaption(text) {
        const signText =
            document.getElementById(
                "signText"
            );

        if (!signText) {
            return;
        }

        const cleanCaption =
            String(
                text ||
                "Waiting for captions..."
            ).trim();

        signText.textContent =
            cleanCaption ||
            "Waiting for captions...";
    }

    /**
     * Waits until avatar.js finishes loading the GLB file.
     */
    function waitForAvatar() {
        if (avatarReadyCheckTimer !== null) {
            return;
        }

        let attempts = 0;
        const maximumAttempts = 40;

        avatarReadyCheckTimer =
            window.setInterval(() => {
                attempts += 1;

                if (avatarEngineIsReady()) {
                    window.clearInterval(
                        avatarReadyCheckTimer
                    );

                    avatarReadyCheckTimer = null;

                    sendResponse({
                        type: "AVATAR_READY"
                    });

                    processAnimationQueue();
                    return;
                }

                if (
                    attempts >=
                    maximumAttempts
                ) {
                    window.clearInterval(
                        avatarReadyCheckTimer
                    );

                    avatarReadyCheckTimer = null;

                    animationQueue.length = 0;
                    queueIsProcessing = false;

                    sendResponse({
                        type: "AVATAR_LOAD_TIMEOUT"
                    });
                }
            }, 250);
    }

    /**
     * Checks whether the avatar engine is ready.
     */
    function avatarEngineIsReady() {
        return Boolean(
            window.eSignAvatar &&
            typeof window.eSignAvatar.isReady ===
                "function" &&
            window.eSignAvatar.isReady()
        );
    }

    /**
     * Sends the available animation list.
     */
    function sendAnimationList() {
        if (!avatarEngineIsReady()) {
            sendResponse({
                type: "AVATAR_NOT_READY"
            });

            return;
        }

        sendResponse({
            type: "ANIMATION_LIST",
            animations:
                window.eSignAvatar.listAnimations()
        });
    }

    /**
     * Sends avatar readiness status.
     */
    function sendReadyStatus() {
        sendResponse({
            type: "AVATAR_READY_STATUS",
            ready: avatarEngineIsReady(),
            queueLength:
                animationQueue.length,
            currentAnimation:
                currentCommand
                    ? currentCommand.animation
                    : null
        });
    }

    /**
     * Sends responses to content.js.
     */
    function sendResponse(payload) {
        window.parent.postMessage(
            {
                source: MESSAGE_SOURCE,
                ...payload
            },
            "*"
        );
    }

    /**
     * Normalizes animation names for duplicate checks.
     */
    function normalizeAnimationName(name) {
        return String(name || "")
            .trim()
            .toLowerCase();
    }

    /**
     * Safely reads numeric values.
     */
    function getNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    /**
     * Temporary developer controls.
     */
    window.eSignMessageBus = {
        play(
            animation,
            durationMs = 2500,
            caption = animation
        ) {
            addAnimationToQueue({
                animation,
                caption,
                durationMs,
                fadeDuration: 0.15
            });
        },

        sequence(animationNames) {
            if (!Array.isArray(animationNames)) {
                return;
            }

            animationNames.forEach(
                (animationName) => {
                    addAnimationToQueue({
                        animation:
                            animationName,
                        caption:
                            animationName,
                        durationMs: 2500,
                        fadeDuration: 0.15
                    });
                }
            );
        },

        idle() {
            clearAnimationQueue();
            return playIdle();
        },

        clearQueue() {
            clearAnimationQueue();
        },

        queueLength() {
            return animationQueue.length;
        },

        currentAnimation() {
            return currentCommand
                ? currentCommand.animation
                : null;
        },

        isReady() {
            return avatarEngineIsReady();
        }
    };

    window.addEventListener(
        "beforeunload",
        () => {
            clearCurrentAnimationTimer();

            if (
                avatarReadyCheckTimer !==
                null
            ) {
                window.clearInterval(
                    avatarReadyCheckTimer
                );
            }

            window.removeEventListener(
                "message",
                handleIncomingMessage
            );
        }
    );
})();