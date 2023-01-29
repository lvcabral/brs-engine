/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const fileButton = document.getElementById("fileButton");
const channelInfo = document.getElementById("channelInfo");
const libVersion = document.getElementById("libVersion");
const display = document.getElementById("display");
const loading = document.getElementById("loading");
const channel1 = document.getElementById("channel1");
const channel2 = document.getElementById("channel2");
const channel3 = document.getElementById("channel3");

// Customize Device Info - Some fields are informational, others change the emulator behavior
let currentChannel = { id: "", running: false };
const customDeviceInfo = {
    developerId: "UniqueDeveloperId", // As in Roku devices, segregates Registry data
    locale: "en_US", // Used if channel supports localization
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Default: "Asap" to use alternative fonts "Roboto" or "Open Sans"
    fontPath: "../fonts/", // change the fontPath to "../fonts-alt/"
    lowResolutionCanvas: true,
};

// Start the emulator
if (supportedBrowser()) {
    channelInfo.innerHTML = "<br/>";

    const customKeys = new Map();
    customKeys.set("Comma", "rev"); // Keep consistency with older versions
    customKeys.set("Period", "fwd"); // Keep consistency with older versions
    customKeys.set("Space", "play"); // Keep consistency with older versions
    customKeys.set("PageUp", "ignore"); // do not handle on browser
    customKeys.set("PageDown", "ignore"); // do not handle on browser

    // Initialize Device Emulator and subscribe to events
    libVersion.innerHTML = brsEmu.getVersion();
    brsEmu.initialize(customDeviceInfo, false, customKeys);
    brsEmu.subscribe("app", (event, data) => {
        if (event === "loaded") {
            currentChannel = data;
            fileButton.style.visibility = "hidden";
            let infoHtml = data.title + "<br/>";
            infoHtml += data.subtitle + "<br/>";
            infoHtml += data.version;
            channelInfo.innerHTML = infoHtml;
        } else if (event === "started") {
            currentChannel = data;
            channelIcons("hidden");
            loading.style.visibility = "hidden";
        } else if (event === "closed" || event === "error") {
            currentChannel = { id: "", running: false };
            display.style.opacity = 0;
            channelInfo.innerHTML = "<br/>";
            fileButton.style.visibility = "visible";
            loading.style.visibility = "hidden";
            channelIcons("visible");
            fileSelector.value = null;
        }
    });
} else {
    channelIcons("hidden");
    fileButton.style.visibility = "hidden";
    let infoHtml = "";
    infoHtml += "<br/>";
    infoHtml += "Your browser is not supported!";
    channelInfo.innerHTML = infoHtml;
}

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
    fetch(zip).then(function (response) {
        if (response.status === 200 || response.status === 0) {
            brsEmu.execute(zip, response.blob());
            display.focus();
        } else {
            loading.style.visibility = "hidden";
            return Promise.reject(new Error(response.statusText));
        }
    });
}

// Display Fullscreen control
display.addEventListener("dblclick", function (event) {
    event.preventDefault();
    if (currentChannel.running) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            display.requestFullscreen();
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

// Browser Check
function supportedBrowser() {
    const info = bowser.parse(window.navigator.userAgent);
    const browserVersion = parseVersionString(info.browser.version);
    let supported = false;
    if (info.engine.name == "Blink") {
        supported =
            (info.platform.type == "desktop" && browserVersion.major > 68) ||
            browserVersion.major > 88;
    } else if (info.engine.name == "Gecko") {
        supported = browserVersion.major > 104;
    }
    if (!supported) {
        console.error(
            "Browser not supported:",
            info.engine.name,
            info.platform.type,
            info.browser.version
        );
    }
    return supported;
}

function parseVersionString(str) {
    if (typeof str != "string") {
        return {};
    }
    var vArray = str.split(".");
    return {
        major: parseInt(vArray[0]) || 0,
        minor: parseInt(vArray[1]) || 0,
        patch: parseInt(vArray[2]) || 0,
    };
}
