// ============================================================
// eSign AI - Avatar Engine
// Phase 1: Load the GLB avatar and loop the Idle animation
// ============================================================

(() => {
    "use strict";

    // --------------------------------------------------------
    // HTML elements
    // --------------------------------------------------------

    const canvas = document.getElementById("renderCanvas");
    const loadingMessage = document.getElementById("loading-message");
    const signText = document.getElementById("signText");

    if (!canvas) {
        console.error("eSign AI: The renderCanvas element was not found.");
        return;
    }

    // --------------------------------------------------------
    // Check that Three.js and GLTFLoader loaded correctly
    // --------------------------------------------------------

    if (typeof THREE === "undefined") {
        showError(
            "Three.js did not load. Check libs/three.min.js."
        );

        return;
    }

    if (typeof THREE.GLTFLoader === "undefined") {
        showError(
            "GLTFLoader did not load. Check libs/GLTFLoader.js."
        );

        return;
    }

    // --------------------------------------------------------
    // Main Three.js variables
    // --------------------------------------------------------

    let scene;
    let camera;
    let renderer;
    let clock;

    let avatarModel = null;
    let animationMixer = null;
    let currentAction = null;

    const animationClips = new Map();

    // Used to prevent rendering after the page is closed.
    let engineRunning = true;

    // --------------------------------------------------------
    // Start the avatar engine
    // --------------------------------------------------------

    initializeScene();
    loadAvatar();
    startRenderLoop();

    // --------------------------------------------------------
    // Scene initialization
    // --------------------------------------------------------

    function initializeScene() {
        scene = new THREE.Scene();

        // Transparent background allows the HTML background to show.
        scene.background = null;

        camera = new THREE.PerspectiveCamera(
            35,
            getCanvasAspectRatio(),
            0.01,
            1000
        );

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        );

        renderer.setClearColor(0x000000, 0);

        // Three.js r128 uses outputEncoding.
        if ("outputEncoding" in renderer) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        }

        // Improve the appearance of Blender materials.
        if ("physicallyCorrectLights" in renderer) {
            renderer.physicallyCorrectLights = true;
        }

        clock = new THREE.Clock();

        addLighting();
        resizeRenderer();

        window.addEventListener("resize", resizeRenderer);

        console.log("eSign AI: Three.js scene initialized.");
    }

    // --------------------------------------------------------
    // Lighting
    // --------------------------------------------------------

    function addLighting() {
        // Soft light that reaches the entire avatar.
        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,
            0x444444,
            1.8
        );

        hemisphereLight.position.set(0, 5, 0);
        scene.add(hemisphereLight);

        // Main front light.
        const keyLight = new THREE.DirectionalLight(
            0xffffff,
            2.2
        );

        keyLight.position.set(3, 5, 6);
        scene.add(keyLight);

        // Softer light from the opposite side.
        const fillLight = new THREE.DirectionalLight(
            0xffffff,
            1.2
        );

        fillLight.position.set(-4, 3, 4);
        scene.add(fillLight);

        // Back light separates the avatar from the background.
        const rimLight = new THREE.DirectionalLight(
            0xffffff,
            0.8
        );

        rimLight.position.set(0, 4, -5);
        scene.add(rimLight);
    }

    // --------------------------------------------------------
    // Load avatar.glb
    // --------------------------------------------------------

    function loadAvatar() {
        setLoadingMessage("Loading avatar...");

        const loader = new THREE.GLTFLoader();
        const avatarURL = chrome.runtime.getURL("avatar.glb");

        loader.load(
            avatarURL,

            // Avatar loaded successfully.
            (gltf) => {
                avatarModel = gltf.scene;
                    console.log(
                    "eSign AI: Available animations:",
                    gltf.animations.map(animation => animation.name)
                     );

                if (!avatarModel) {
                    showError(
                        "The GLB file loaded, but no avatar scene was found."
                    );

                    return;
                }

                prepareAvatarModel(avatarModel);
                scene.add(avatarModel);

                frameAvatarInCamera(avatarModel);
                registerAnimations(gltf.animations || []);

                hideLoadingMessage();

                console.log("eSign AI: Avatar loaded successfully.");
            },

            // Loading progress.
            (progressEvent) => {
                updateLoadingProgress(progressEvent);
            },

            // Loading failed.
            (error) => {
                console.error(
                    "eSign AI: Failed to load avatar.glb.",
                    error
                );

                showError(
                    "Avatar could not load. Check avatar.glb and the extension files."
                );
            }
        );
    }

    // --------------------------------------------------------
    // Prepare model materials and shadows
    // --------------------------------------------------------

    function prepareAvatarModel(model) {
        model.traverse((object) => {
            if (!object.isMesh) {
                return;
            }

            object.frustumCulled = false;

            if (!object.material) {
                return;
            }

            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];

            materials.forEach((material) => {
                if (
                    material.map &&
                    "encoding" in material.map
                ) {
                    material.map.encoding = THREE.sRGBEncoding;
                }

                material.needsUpdate = true;
            });
        });
    }

    // --------------------------------------------------------
    // Read and store animations
    // --------------------------------------------------------

    function registerAnimations(clips) {
        animationClips.clear();

        if (clips.length === 0) {
            console.warn(
                "eSign AI: No animations were found in avatar.glb."
            );

            setSignText("Avatar loaded, but no animations were found.");
            return;
        }

        animationMixer = new THREE.AnimationMixer(avatarModel);

        clips.forEach((clip) => {
            animationClips.set(
                normalizeAnimationName(clip.name),
                clip
            );
        });

        console.log(
            "eSign AI: Animations found:",
            clips.map((clip) => clip.name)
        );

        const idleClip = findAnimationClip("Idle");

        if (!idleClip) {
            console.warn(
                'eSign AI: The "Idle" animation was not found.'
            );

            setSignText(
                'Avatar loaded, but the "Idle" animation was not found.'
            );

            return;
        }

        playAnimation("Idle", {
            loop: true,
            fadeDuration: 0
        });

        setSignText("Waiting for captions...");
    }

    // --------------------------------------------------------
    // Animation controls
    // --------------------------------------------------------

    function findAnimationClip(animationName) {
        const normalizedName =
            normalizeAnimationName(animationName);

        return animationClips.get(normalizedName) || null;
    }

    function playAnimation
    (
    animationName,
    options = {}
    ) 
    {
        if (!animationMixer) {
            console.warn(
                "eSign AI: Animation mixer is not ready."
            );

            return false;
        }

        const clip = findAnimationClip(animationName);

        if (!clip) {
            console.warn(
                `eSign AI: Animation "${animationName}" was not found.`
            );

            return false;
        }

        const {
            loop = false,
            fadeDuration = 0.25
        } = options;

        const nextAction =
            animationMixer.clipAction(clip);

        /*
        * If the same animation is requested again,
        * restart it from the beginning.
        */
        if (currentAction === nextAction) {
        nextAction.stop();
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveTimeScale(1);
        nextAction.setEffectiveWeight(1);

        if (loop) {
            nextAction.setLoop(
                THREE.LoopRepeat,
                Infinity
            );

            nextAction.clampWhenFinished = false;
        } else {
            nextAction.setLoop(
                THREE.LoopOnce,
                1
            );

            nextAction.clampWhenFinished = true;
        }

        nextAction.play();

        return true;
        }

        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveTimeScale(1);
        nextAction.setEffectiveWeight(1);

        if (loop) {
            nextAction.setLoop(
                THREE.LoopRepeat,
                Infinity
            );

            nextAction.clampWhenFinished = false;
        } else {
            nextAction.setLoop(
                THREE.LoopOnce,
                1
            );

            nextAction.clampWhenFinished = true;
        }

        nextAction.play();

        if (currentAction) {
            currentAction.crossFadeTo(
                nextAction,
                Math.max(0, fadeDuration),
                false
            );
        }

        currentAction = nextAction;

        console.log(
            `eSign AI: Playing animation "${clip.name}".`
        );

        return true;
    }

    // --------------------------------------------------------
    // Camera framing
    // --------------------------------------------------------

    function frameAvatarInCamera(model) {
    const boundingBox = new THREE.Box3().setFromObject(model);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    boundingBox.getSize(size);
    boundingBox.getCenter(center);

    const maxDimension = Math.max(
        size.x,
        size.y,
        size.z
    );

    if (
        !Number.isFinite(maxDimension) ||
        maxDimension <= 0
    ) {
        console.warn(
            "eSign AI: Could not calculate avatar size."
        );

        camera.position.set(0, 0, 4);
        camera.lookAt(0, 0, 0);

        return;
    }

    // =========================================================
    // 1. CENTER THE AVATAR
    // =========================================================

    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    // Move avatar slightly upward inside the eSign canvas.
    // Increase 0.12 if you want the avatar higher.
    // Reduce it if the avatar becomes too high.
    model.position.y += maxDimension * 0.18;

    // =========================================================
    // 2. CALCULATE CAMERA DISTANCE
    // =========================================================

    const verticalFov =
        THREE.MathUtils.degToRad(camera.fov);

    let cameraDistance =
        maxDimension /
        (2 * Math.tan(verticalFov / 2));

    // =========================================================
    // 3. ZOOM
    // =========================================================

    // Smaller number = closer / larger avatar
    // Larger number = farther / smaller avatar
    cameraDistance *= 0.17;

    // =========================================================
    // 4. CAMERA POSITION
    // =========================================================

    // Keep camera level with the avatar.
    // Do NOT move the camera upward separately.
    const cameraHeight = 0;

    camera.position.set(
        0,
        cameraHeight,
        cameraDistance
    );

    // =========================================================
    // 5. CAMERA VIEW DIRECTION
    // =========================================================

    // Look straight ahead at the same height.
    // This prevents the camera from looking down or up.
    camera.lookAt(
        0,
        cameraHeight,
        0
    );

    // =========================================================
    // 6. CAMERA CLIPPING
    // =========================================================

    camera.near = Math.max(
        cameraDistance / 100,
        0.01
    );

    camera.far = Math.max(
        cameraDistance * 100,
        100
    );

    camera.updateProjectionMatrix();

    // =========================================================
    // DEBUG INFO
    // =========================================================

    console.log(
        "eSign AI: Avatar framed.",
        {
            size: size,
            center: center,
            maxDimension: maxDimension,
            cameraDistance: cameraDistance,
            modelPosition: model.position,
            cameraPosition: camera.position
        }
    );
}

    // --------------------------------------------------------
    // Render loop
    // --------------------------------------------------------

    function startRenderLoop() {
        renderer.setAnimationLoop(renderFrame);
    }

    function renderFrame() {
        if (!engineRunning) {
            return;
        }

        const deltaTime = Math.min(
            clock.getDelta(),
            0.1
        );

        if (animationMixer) {
            animationMixer.update(deltaTime);
        }

        renderer.render(scene, camera);
    }

    // --------------------------------------------------------
    // Responsive resizing
    // --------------------------------------------------------

    function resizeRenderer() {
        const width = Math.max(
            canvas.clientWidth,
            1
        );

        const height = Math.max(
            canvas.clientHeight,
            1
        );

        const drawingBufferWidth =
            canvas.width / renderer.getPixelRatio();

        const drawingBufferHeight =
            canvas.height / renderer.getPixelRatio();

        const needsResize =
            Math.floor(drawingBufferWidth) !==
                Math.floor(width) ||
            Math.floor(drawingBufferHeight) !==
                Math.floor(height);

        if (needsResize) {
            renderer.setSize(width, height, false);
        }

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function getCanvasAspectRatio() {
        const width = Math.max(
            canvas.clientWidth,
            1
        );

        const height = Math.max(
            canvas.clientHeight,
            1
        );

        return width / height;
    }

    // --------------------------------------------------------
    // Loading and error messages
    // --------------------------------------------------------

    function updateLoadingProgress(progressEvent) {
        if (
            !progressEvent ||
            !progressEvent.total
        ) {
            setLoadingMessage("Loading avatar...");
            return;
        }

        const percentage = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
        );

        setLoadingMessage(
            `Loading avatar... ${percentage}%`
        );
    }

    function setLoadingMessage(message) {
        if (!loadingMessage) {
            return;
        }

        loadingMessage.textContent = message;
        loadingMessage.classList.remove("error");
        loadingMessage.hidden = false;
    }

    function hideLoadingMessage() {
        if (!loadingMessage) {
            return;
        }

        loadingMessage.hidden = true;
    }

    function showError(message) {
        console.error(`eSign AI: ${message}`);

        if (loadingMessage) {
            loadingMessage.textContent = message;
            loadingMessage.classList.add("error");
            loadingMessage.hidden = false;
        }

        setSignText("Avatar engine error");
    }

    function setSignText(message) {
        if (!signText) {
            return;
        }

        signText.textContent = message;
    }

    // --------------------------------------------------------
    // Utility functions
    // --------------------------------------------------------

    function normalizeAnimationName(name) {
        return String(name || "")
            .trim()
            .toLowerCase();
    }

    // --------------------------------------------------------
    // Temporary testing API
    // --------------------------------------------------------
    // This lets us test animations through the avatar iframe's
    // DevTools console. It will later be replaced by messageBus.js.

    window.eSignAvatar = 
    {
        playAnimation,

        listAnimations() {
            return Array.from(animationClips.values()).map(
                (clip) => clip.name
            );
        },

       playIdle() 
       {
            return playAnimation("Idle", {
            loop: true,
            fadeDuration: 0.25
            });
        },

        isReady() {
            return Boolean(
                avatarModel &&
                animationMixer
            );
        },

        getAnimationDuration(animationName) {
            if (!avatarModel || animationClips.size === 0) {
                return null;
            }

            const normalizedName = String(animationName || "")
                .trim()
                .toLowerCase();

            const clip = Array.from(
                animationClips.values()
            ).find((animationClip) => {
                return animationClip.name
                    .trim()
                    .toLowerCase() === normalizedName;
            });

            if (!clip) {
                return null;
            }

            return clip.duration;
        }
    };

    // --------------------------------------------------------
    // Cleanup
    // --------------------------------------------------------

    window.addEventListener("beforeunload", () => {
        engineRunning = false;

        window.removeEventListener(
            "resize",
            resizeRenderer
        );

        if (renderer) {
            renderer.setAnimationLoop(null);
            renderer.dispose();
        }

        if (animationMixer && avatarModel) {
            animationMixer.stopAllAction();
            animationMixer.uncacheRoot(avatarModel);
        }
    });
})();