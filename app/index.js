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

// Device Data
let currentChannel = { id: "", running: false };
const deviceInfo = {
    developerId: "UniqueDeveloperId",
    friendlyName: "BrightScript Emulator Web",
    serialNumber: "BRSEMUAPP092",
    deviceModel: "8000X",
    firmwareVersion: "049.10E04111A",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Default: "Asap" to use alternative fonts "Roboto" or "Open Sans"
    fontPath: "../fonts/", // change the fontPath to "../fonts-alt/"
    maxSimulStreams: 2, // Max number of audio resource streams
    connectionType: "WiFiConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    lowResolutionCanvas: true,
};

if (supportedBrowser()) {
    channelInfo.innerHTML = "<br/>";

    const customKeys = new Map();
    customKeys.set("Home", "home");

    // Initialize Device Emulator and subscribe to events
    brsEmu.initialize(deviceInfo, self.crossOriginIsolated, false, customKeys);

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
        } else if (event === "version") {
            libVersion.innerHTML = data;
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

// Touch handlers
const mc = new Hammer(display);
// let the pan gesture support all directions.
// this will block the vertical scrolling on a touch-device while on the element
mc.get("pan").set({ direction: Hammer.DIRECTION_ALL });

// listen to events...
var singleTap = new Hammer.Tap({ event: "tap" });
mc.add([singleTap]);
mc.on("panleft panright panup pandown tap", function (ev) {
    console.log(ev.type);
    if (ev.type.slice(0, 3) === "pan") {
        brsEmu.sendKeyPress(ev.type.slice(3));
    } else if (ev.type === "tap") {
        brsEmu.sendKeyPress("select");
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
    console.log(info.engine.name, info.platform.type, info.browser.version);
    const browserVersion = parseVersionString(info.browser.version);
    let supported = false;
    if (info.engine.name == "Blink") {
        supported =
            (info.platform.type == "desktop" && browserVersion.major > 68) ||
            browserVersion.major > 88;
    } else if (info.engine.name == "Gecko") {
        supported = browserVersion.major > 104;
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
