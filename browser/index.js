/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const fileButton = document.getElementById("fileButton");
const appInfo = document.getElementById("appInfo");
const libVersion = document.getElementById("libVersion");
const display = document.getElementById("display");
const stats = document.getElementById("stats");
const loading = document.getElementById("loading");
const passwordDialog = document.getElementById("passwordDialog");

// App List
const appIcons = [
    document.getElementById("app01"),
    document.getElementById("app02"),
    document.getElementById("app03"),
    document.getElementById("app04"),
];
const appList = [
    {
        id: "home-01",
        title: "Rect Bounce Example",
        version: "1.0.0",
        path: "apps/Rect-Bounce.zip",
        icon: "images/icons/rect-bounce-icon.png",
    },
    {
        id: "home-02",
        title: "Ball Boing Example",
        version: "1.0.0",
        path: "apps/Ball-Boing.zip",
        icon: "images/icons/ball-boing-icon.png",
    },
    {
        id: "home-03",
        title: "Collisions Example",
        version: "1.0.3",
        path: "apps/Collisions.zip",
        icon: "images/icons/collisions-icon.png",
    },
    {
        id: "home-04",
        title: "Custom Video Player",
        version: "1.0.0",
        path: "apps/custom-video-player.zip",
        icon: "images/icons/custom-video-player.png",
    },
];
appIcons.forEach((icon, index) => {
    icon.src = appList[index].icon;
    icon.title = appList[index].title;
    icon.alt = appList[index].title;
    icon.onclick = () => loadZip(appList[index].id);
});

// App Configuration
// Pause the engine when the browser window loses focus
// If `false` use `roCECStatus` in BrightScript to control app behavior
const pauseOnBlur = false;
let debugMode = "continue";

// App status objects
let currentApp = { id: "", running: false };
let currentZip = null;

// Start the engine
appInfo.innerHTML = "<br/>";
// Custom device configuration (see /api/index.ts for all fields)
const customDeviceInfo = {
    developerId: "UniqueDeveloperId", // As in Roku devices, segregates Registry data
    locale: "en_US", // Used if app supports localization
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    maxFps: 30, // Limited refresh rate to minimize issues with iOS/iPadOS
    appList: appList,
};
const customKeys = new Map();
customKeys.set("Comma", "rev"); // Keep consistency with older versions
customKeys.set("Period", "fwd"); // Keep consistency with older versions
customKeys.set("Space", "play"); // Keep consistency with older versions
customKeys.set("NumpadMultiply", "info"); // Keep consistency with older versions
customKeys.set("KeyA", "a"); // Keep consistency with older versions
customKeys.set("KeyZ", "b"); // Keep consistency with older versions
customKeys.set("PageUp", "ignore"); // do not handle on browser
customKeys.set("PageDown", "ignore"); // do not handle on browser
customKeys.set("ShiftLeft", "playonly"); // Support for Prince of Persia
customKeys.set("Shift+ArrowRight", "right"); // Support for Prince of Persia
customKeys.set("Shift+ArrowLeft", "left"); // Support for Prince of Persia
customKeys.set("Shift+ArrowUp", "up"); // Support for Prince of Persia
customKeys.set("Shift+ArrowDown", "down"); // Support for Prince of Persia

// Initialize device and subscribe to events
libVersion.innerHTML = brs.getVersion();
brs.subscribe("web-app", (event, data) => {
    if (event === "loaded") {
        currentApp = data;
        fileButton.style.visibility = "hidden";
        let infoHtml = data.title + "<br/>";
        infoHtml += data.subtitle + "<br/>";
        if (data.version.trim() !== "") {
            infoHtml += "v" + data.version;
        }
        appInfo.innerHTML = infoHtml;
        appIconsVisibility("hidden");
        loading.style.visibility = "hidden";
    } else if (event === "started") {
        currentApp = data;
        stats.style.visibility = "visible";
    } else if (event === "launch") {
        if (data?.app) {
            brs.terminate("EXIT_USER_NAV");
            currentApp = { id: "", running: false };
            currentZip = null;
            loadZip(data.app, data.params);
        }
    } else if (event === "browser") {
        if (data?.url) {
            openBrowser(data.url, data.width, data.height);
        }
    } else if (event === "closed" || event === "error") {
        closeApp();
    } else if (event === "debug") {
        if (["stop", "pause", "continue"].includes(data.level)) {
            debugMode = data.level;
        }
    } else if (event === "version") {
        console.info(`Interpreter Library v${data}`);
        mountZip("./apps/data.zip");
    }
});
brs.initialize(customDeviceInfo, {
    debugToConsole: true,
    customKeys: customKeys,
    showStats: true,
});

// File selector
const fileSelector = document.getElementById("file");
fileButton.onclick = function () {
    fileSelector.click();
};
fileSelector.onclick = function () {
    this.value = null;
};
fileSelector.onchange = function () {
    const file = this.files[0];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (fileExt === "zip" || fileExt === "bpk" || fileExt === "brs") {
        if (fileExt === "bpk") {
            passwordDialog.showModal();
        } else {
            runFile(file);
        }
    } else {
        console.error(`File format not supported: ${fileExt}`);
    }
};
passwordDialog.addEventListener("close", (e) => {
    if (passwordDialog.returnValue === "ok") {
        runFile(fileSelector.files[0], document.forms.passwordForm.password.value);
    }
    document.forms.passwordForm.password.value = "";
});

/**
 * Run files from the file system loaded from the purple button
 * @param {File} file - File object to be executed
 * @param {string} password - Password to decrypt the `bpk` file
 */
function runFile(file, password = "") {
    const reader = new FileReader();
    const fileExt = file?.name.split(".").pop()?.toLowerCase() ?? "";
    if (fileExt === "zip" || fileExt === "bpk" || fileExt === "brs") {
        reader.onload = function (evt) {
            // file is loaded
            if (password !== null) {
                currentZip = evt.target.result;
                brs.execute(
                    file.name,
                    currentZip,
                    {
                        clearDisplayOnExit: true,
                        muteSound: false,
                        password: password,
                        debugOnCrash: true,
                    },
                    new Map([["source", "auto-run-dev"]])
                );
            }
        };
        reader.onerror = function (evt) {
            console.error(`Error opening ${file.name}:${reader.error}`);
        };
        reader.readAsArrayBuffer(file);
    }
}

/**
 * Downloads an app package from the server and execute it
 * @param {string} appId the path to the zip file
 */
function loadZip(appId, params) {
    if (currentApp.running) {
        console.warn("There is an App already running!");
        return;
    }
    const app = appList.find((app) => app.id === appId);
    if (!app) {
        console.error(`App not found: ${appId}!`);
        return;
    }
    console.log(`Selected App: ${app.id} - ${app.title}`);
    display.style.opacity = 0;
    loading.style.visibility = "visible";
    appIconsVisibility("visible");
    fileSelector.value = null;

    fetch(app.path)
        .then(function (response) {
            if (response.status === 200 || response.status === 0) {
                return response.blob().then(function (zipBlob) {
                    zipBlob.arrayBuffer().then(function (zipData) {
                        currentZip = zipData;
                        if (!params) {
                            params = new Map([["source", "homescreen"]]);
                        }
                        brs.execute(
                            app.path,
                            zipData,
                            { entryPoint: true, debugOnCrash: false },
                            params,
                        );
                        display.focus();
                    });
                });
            } else {
                loading.style.visibility = "hidden";
                return Promise.reject(new Error(response.statusText));
            }
        })
        .catch((err) => {
            console.error(`Error attempting to load zip: ${err.message} (${err.name})`);
        });
}

function mountZip(zip) {
    fetch(zip)
        .then(function (response) {
            if (response.status === 200 || response.status === 0) {
                return response.blob().then(function (zipBlob) {
                    zipBlob.arrayBuffer().then(function (zipData) {
                        brs.mountExt(zipData);
                    });
                });
            } else {
                return Promise.reject(new Error(response.statusText));
            }
        })
        .catch((err) => {
            console.error(`Error attempting to mount zip: ${err.message} (${err.name})`);
        });
}

// Clear App data and display
function closeApp() {
    currentApp = { id: "", running: false };
    currentZip = null;
    display.style.opacity = 0;
    appInfo.innerHTML = "<br/>";
    fileButton.style.visibility = "visible";
    loading.style.visibility = "hidden";
    stats.style.visibility = "hidden";
    appIconsVisibility("visible");
    fileSelector.value = null;
    if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
            console.error(`Error attempting to exit fullscreen mode: ${err.message} (${err.name})`);
        });
    }
}

// Display Fullscreen control
display.addEventListener("dblclick", function (event) {
    event.preventDefault();
    if (currentApp.running) {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.error(
                    `Error attempting to exit fullscreen mode: ${err.message} (${err.name})`
                );
            });
        } else {
            display.requestFullscreen().catch((err) => {
                console.error(
                    `Error attempting to start fullscreen mode: ${err.message} (${err.name})`
                );
            });
        }
    }
});

display.addEventListener("mousedown", function (event) {
    if (event.detail === 2) {
        event.preventDefault();
    }
});

// App icons Visibility
function appIconsVisibility(visibility) {
    appIcons.forEach((icon) => {
        icon.style.visibility = visibility;
    });
}

function parseVersionString(str) {
    if (typeof str != "string") {
        return {};
    }
    const vArray = str.split(".");
    return {
        major: parseInt(vArray[0]) || 0,
        minor: parseInt(vArray[1]) || 0,
        patch: parseInt(vArray[2]) || 0,
    };
}

function toggleDiv(divId) {
    const objDiv = document.getElementById(divId);
    const butExpNew = document.getElementById("expand-new");
    const butExp = document.getElementById("expand");
    const butCol = document.getElementById("collapse");
    if (objDiv.style.display == "") {
        objDiv.style.display = "none";
        butExp.style.display = "";
        butCol.style.display = "none";
    } else {
        objDiv.style.display = "";
        butExp.style.display = "none";
        butExpNew.style.display = "none";
        butCol.style.display = "";
    }
}

if (pauseOnBlur) {
    window.onfocus = function () {
        if (currentApp.running && debugMode === "pause") {
            brs.debug("cont");
        }
    };

    window.onblur = function () {
        if (currentApp.running && debugMode === "continue") {
            brs.debug("pause");
        }
    };
}

// Browser Event Handler
function openBrowser(url, width, height) {
    if (!url.startsWith("file://")) {
        openPopup(url, width, height);
        return;
    }
    if (!url.startsWith("file:///pkg_")) {
        console.error("Error: Invalid local file path!", data.url);
        return;
    }
    if (!currentZip) {
        console.error("Error: No zip file loaded!", data.url);
        return;
    }
    const Buffer = BrowserFS.BFSRequire("buffer").Buffer;
    const filePath = url.replace("file:///pkg_", "");

    // Configure BrowserFS
    const fsOptions = {
        fs: "MountableFileSystem",
        options: {
            "pkg:": {
                fs: "ZipFS",
                options: {
                    zipData: Buffer.from(currentZip),
                },
            },
        },
    };
    BrowserFS.configure(fsOptions, (err) => {
        if (err) {
            return console.error(err);
        }
        OpenLocalFile(filePath, width, height);
    });
}

// Function called when BrowserFS is ready
function OpenLocalFile(filePath, width, height) {
    const path = BrowserFS.BFSRequire("path");
    const basePath = path.dirname(filePath);
    const fs = BrowserFS.BFSRequire("fs");
    fs.readFile(`pkg:/${filePath}`, "utf8", function (err, data) {
        if (err) {
            return console.error(err);
        }
        replaceRelativePaths(data, fs, basePath)
            .then((updatedData) => {
                // Open a new window to display the content
                const popup = openPopup("about:blank", width, height);
                popup?.document?.write(updatedData);
            })
            .catch((err) => {
                console.error("Error processing images:", err);
            });
    });
}

// Function to replace relative paths with base64 URLs and add crossorigin attribute
function replaceRelativePaths(html, fs, basePath) {
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    const promises = [];

    function processMatch(match, p1) {
        return new Promise((resolve, reject) => {
            // Check if the path is relative
            if (p1.startsWith("http://") || p1.startsWith("https://")) {
                // Add crossorigin attribute to non-local images if it doesn't already exist
                if (!match[0].includes("crossorigin=")) {
                    html = html.replace(
                        match[0],
                        match[0].replace("<img", "<img crossorigin='anonymous'")
                    );
                }
                resolve();
                return;
            }
            const path = BrowserFS.BFSRequire("path");
            const resolvedPath = path.resolve(basePath, p1);
            fs.readFile(`pkg:/${resolvedPath}`, function (err, fileData) {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                const base64Data = btoa(String.fromCharCode.apply(null, new Uint8Array(fileData)));
                let mimeType = "application/octet-stream";
                const extension = path.extname(p1).replace(/^\./, "");
                if (extension !== "") {
                    mimeType = `image/${extension}`;
                }
                const dataURL = `data:${mimeType};base64,${base64Data}`;
                html = html.replace(p1, dataURL);
                resolve();
            });
        });
    }

    while ((match = imgRegex.exec(html)) !== null) {
        promises.push(processMatch(match, match[1]));
    }

    return Promise.all(promises).then(() => html);
}

function openPopup(url, width, height) {
    const newWindow = window.open(url, "_blank", `width=${width},height=${height},popup`);
    if (newWindow) {
        newWindow.focus();
    } else {
        console.error("Failed to open popup window!");
    }
    return newWindow;
}
