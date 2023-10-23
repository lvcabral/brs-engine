/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
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

// Channel status object
let currentChannel = { id: "", running: false };

// Start the emulator
channelInfo.innerHTML = "<br/>";
// Custom Device Configuration (see /api/index.ts for all fields)
const customDeviceInfo = {
    developerId: "UniqueDeveloperId", // As in Roku devices, segregates Registry data
    locale: "en_US", // Used if channel supports localization
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Default: "Asap" to use alternative fonts "Roboto" or "Open Sans"
    fontPath: "../fonts/", // change the fontPath to "../fonts-alt/"
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

// Initialize Device Emulator and subscribe to events
libVersion.innerHTML = brsEmu.getVersion();
brsEmu.initialize(customDeviceInfo, {
    debugToConsole: true,
    customKeys: customKeys,
    showStats: true,
});
brsEmu.subscribe("app", (event, data) => {
    if (event === "loaded") {
        currentChannel = data;
        fileButton.style.visibility = "hidden";
        let infoHtml = data.title + "<br/>";
        infoHtml += data.subtitle + "<br/>";
        infoHtml += data.version;
        channelInfo.innerHTML = infoHtml;
        channelIcons("hidden");
        loading.style.visibility = "hidden";
    } else if (event === "started") {
        currentChannel = data;
        stats.style.visibility = "visible";
    } else if (event === "closed" || event === "error") {
        currentChannel = { id: "", running: false };
        display.style.opacity = 0;
        channelInfo.innerHTML = "<br/>";
        fileButton.style.visibility = "visible";
        loading.style.visibility = "hidden";
        stats.style.visibility = "hidden";
        channelIcons("visible");
        fileSelector.value = null;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.error(
                    `Error attempting to exit fullscreen mode: ${err.message} (${err.name})`
                );
            });
        }
    }
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
    const reader = new FileReader();
    const fileExt = file.name.split(".").pop();
    if (fileExt === "zip" || fileExt === "brs") {
        reader.onload = function (evt) {
            // file is loaded
            brsEmu.execute(file.name, evt.target.result);
            channelIcons("hidden");
        };
        reader.onerror = function (evt) {
            console.error(`Error opening ${file.name}:${reader.error}`);
        };
        reader.readAsArrayBuffer(file);
    } else {
        console.error(`File format not supported: ${fileExt}`);
    }
};
// Download Zip
function loadZip(zip) {
    if (currentChannel.running) {
        return;
    }
    display.style.opacity = 0;
    loading.style.visibility = "visible";
    channelIcons("visible");
    fileSelector.value = null;
    fetch(zip)
        .then(function (response) {
            if (response.status === 200 || response.status === 0) {
                brsEmu.execute(zip, response.blob(), true, false, "homescreen");
                display.focus();
            } else {
                loading.style.visibility = "hidden";
                return Promise.reject(new Error(response.statusText));
            }
        })
        .catch((err) => {
            console.error(`Error attempting to load zip: ${err.message} (${err.name})`);
        });
}

// Display Fullscreen control
display.addEventListener("dblclick", function (event) {
    event.preventDefault();
    if (currentChannel.running) {
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
    if (channel3) {
        channel1.style.visibility = visibility;
        channel2.style.visibility = visibility;
        channel3.style.visibility = visibility;
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
