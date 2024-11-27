/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const fileButton = document.getElementById("fileButton");
const channelInfo = document.getElementById("channelInfo");
const libVersion = document.getElementById("libVersion");
const display = document.getElementById("display");
const stats = document.getElementById("stats");
const loading = document.getElementById("loading");
const channel1 = document.getElementById("channel1");
const channel2 = document.getElementById("channel2");
const channel3 = document.getElementById("channel3");
const channel4 = document.getElementById("channel4");
const passwordDialog = document.getElementById("passwordDialog");

// Channel status object
let currentApp = { id: "", running: false };
let currentZip = null;
let debugMode = "continue";

// Start the engine
channelInfo.innerHTML = "<br/>";
// Custom device configuration (see /api/index.ts for all fields)
const customDeviceInfo = {
    developerId: "UniqueDeveloperId", // As in Roku devices, segregates Registry data
    locale: "en_US", // Used if channel supports localization
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Default: "Asap" to use alternative fonts "Roboto" or "Open Sans"
    fontPath: "../fonts/", // change the fontPath to "../fonts-alt/"
    maxFps: 30, // Limited to minimize issues with iOS/iPadOS
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
customKeys.set("Digit8", "info");
customKeys.set("ShiftLeft", "playonly"); // Support for Prince of Persia
customKeys.set("Shift+ArrowRight", "right"); // Support for Prince of Persia
customKeys.set("Shift+ArrowLeft", "left"); // Support for Prince of Persia
customKeys.set("Shift+ArrowUp", "up"); // Support for Prince of Persia
customKeys.set("Shift+ArrowDown", "down"); // Support for Prince of Persia

// Initialize device and subscribe to events
libVersion.innerHTML = brs.getVersion();
brs.subscribe("app", (event, data) => {
    if (event === "loaded") {
        currentApp = data;
        fileButton.style.visibility = "hidden";
        let infoHtml = data.title + "<br/>";
        infoHtml += data.subtitle + "<br/>";
        infoHtml += data.version;
        channelInfo.innerHTML = infoHtml;
        channelIcons("hidden");
        loading.style.visibility = "hidden";
    } else if (event === "started") {
        currentApp = data;
        stats.style.visibility = "visible";
    } else if (event === "launch") {
        if (data?.app) {
            brs.terminate("EXIT_USER_NAV");
            currentApp = { id: "", running: false };
            currentZip = null;
            loadZip(data.app);
        }
    } else if (event === "browser") {
        if (data?.url && currentZip) {
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
        mountZip("./channels/data.zip");
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

function runFile(file, password = "") {
    const reader = new FileReader();
    const fileExt = file?.name.split(".").pop()?.toLowerCase() ?? "";
    if (fileExt === "zip" || fileExt === "bpk" || fileExt === "brs") {
        reader.onload = function (evt) {
            // file is loaded
            if (password !== null) {
                currentZip = evt.target.result;
                brs.execute(file.name, currentZip, {
                    clearDisplayOnExit: true,
                    muteSound: false,
                    execSource: "auto-run-dev",
                    password: password,
                    debugOnCrash: true,
                });
            }
        };
        reader.onerror = function (evt) {
            console.error(`Error opening ${file.name}:${reader.error}`);
        };
        reader.readAsArrayBuffer(file);
    }
}

// Download Zip
function loadZip(zip) {
    if (currentApp.running) {
        return;
    }
    display.style.opacity = 0;
    loading.style.visibility = "visible";
    channelIcons("visible");
    fileSelector.value = null;
    fetch(zip)
        .then(function (response) {
            if (response.status === 200 || response.status === 0) {
                return response.blob().then(function (zipBlob) {
                    zipBlob.arrayBuffer().then(function (zipData) {
                        currentZip = zipData;
                        brs.execute(zip, zipData, { execSource: "homescreen" });
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
    channelInfo.innerHTML = "<br/>";
    fileButton.style.visibility = "visible";
    loading.style.visibility = "hidden";
    stats.style.visibility = "hidden";
    channelIcons("visible");
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

// Channel icons Visibility
function channelIcons(visibility) {
    if (channel4) {
        channel1.style.visibility = visibility;
        channel2.style.visibility = visibility;
        channel3.style.visibility = visibility;
        channel4.style.visibility = visibility;
    }
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
        console.error("Failed to open popup window");
    }
    return newWindow;
}
