/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
var display = document.getElementById("display");
var screenSize = { width: 854, height: 480 };
var ctx = display.getContext("2d", { alpha: false });
var fileButton = document.getElementById("fileButton");
var channelInfo = document.getElementById("channelInfo");
channelInfo.innerHTML = "<br/>";
var channel1 = document.getElementById("channel1");
var channel2 = document.getElementById("channel2");
var channel3 = document.getElementById("channel3");
var bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
var bufferCtx = bufferCanvas.getContext("2d");
var buffer = new ImageData(screenSize.width, screenSize.height);
var dirty = false;
var splashTimeout = 1600;
var brsWorker;
var source = [];
var paths = [];
var txts = [];
var imgs = [];
var fonts = [];
var running = false;

// Control buffer
const length = 10;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);

// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

// Device Data
const developerId = "UniqueDeveloperId";
const deviceData = {
    developerId: developerId,
    registry: new Map(),
    deviceModel: "8000X",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    countryCode: "US",
    timeZone: "US/Arizona",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Only this mode is supported for now
};

// Load Registry
const storage = window.localStorage;
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, developerId.length) === developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}

// File selector
var fileSelector = document.getElementById("file");
var zip = new JSZip();

fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function(progressEvent) {
        paths = [];
        imgs = [];
        txts = [];
        fonts = [];
        source.push(this.result);
        paths.push({ url: "source/" + file.name, id: 0, type: "source" });
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        runChannel();
    };
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    if (file.name.split(".").pop() === "zip") {
        console.log("Loading " + file.name + "...");
        running = true;
        openChannelZip(file);
    } else {
        running = true;
        reader.readAsText(file);
    }
    display.focus();
};

// Download Zip
function loadZip(zip) {
    if (running) {
        return;
    }
    running = true;
    display.style.opacity = 0;
    channel1.style.visibility = "visible";
    channel2.style.visibility = "visible";
    channel3.style.visibility = "visible";
    fileSelector.value = null;
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    fetch(zip).then(function(response) {
        if (response.status === 200 || response.status === 0) {
            console.log("Loading " + zip + "...");
            openChannelZip(response.blob());
            display.focus();
        } else {
            running = false;
            return Promise.reject(new Error(response.statusText));
        }
    });
}

// Uncompress Zip and execute
function openChannelZip(f) {
    JSZip.loadAsync(f).then(
        function(zip) {
            var manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        var manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function(ln) {
                            line = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }
                        var splash = manifestMap.get("splash_screen_hd");
                        if (!splash) {
                            splash = manifestMap.get("splash_screen_fhd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_shd");
                            }
                        }
                        ctx.fillStyle = "rgba(0, 0, 0, 1)";
                        ctx.fillRect(0, 0, display.width, display.height);
                        if (splash && splash.substr(0, 5) === "pkg:/") {
                            splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then(blob => {
                                    createImageBitmap(blob).then(imgData => {
                                        channel1.style.visibility = "hidden";
                                        channel2.style.visibility = "hidden";
                                        channel3.style.visibility = "hidden";
                                        display.style.opacity = 1;
                                        ctx.drawImage(
                                            imgData,
                                            0,
                                            0,
                                            screenSize.width,
                                            screenSize.height
                                        );
                                    });
                                });
                            }
                        }
                        fileButton.style.visibility = "hidden";
                        var infoHtml = "";
                        var title = manifestMap.get("title");
                        if (title) {
                            infoHtml += title + "<br/>";
                        }
                        var subtitle = manifestMap.get("subtitle");
                        if (subtitle) {
                            infoHtml += subtitle + "<br/>";
                        }
                        var majorVersion = manifestMap.get("major_version");
                        if (majorVersion) {
                            infoHtml += "v" + majorVersion;
                        }
                        var minorVersion = manifestMap.get("minor_version");
                        if (minorVersion) {
                            infoHtml += "." + minorVersion;
                        }
                        var buildVersion = manifestMap.get("build_version");
                        if (buildVersion) {
                            infoHtml += "." + buildVersion;
                        }
                        channelInfo.innerHTML = infoHtml;
                    },
                    function error(e) {
                        clientException("Error uncompressing manifest:" + e.message, true);
                        running = false;
                        return;
                    }
                );
            } else {
                clientException("Invalid Roku package: missing manifest.", true);
                running = false;
                return;
            }
            var assetPaths = [];
            var assetsEvents = [];
            var bmpId = 0;
            var txtId = 0;
            var srcId = 0;
            var fntId = 0;
            zip.forEach(function(relativePath, zipEntry) {
                if (
                    !zipEntry.dir &&
                    relativePath.toLowerCase().substr(0, 6) === "source" &&
                    relativePath.split(".").pop() === "brs"
                ) {
                    assetPaths.push({ url: relativePath, id: srcId, type: "source" });
                    assetsEvents.push(zipEntry.async("string"));
                    srcId++;
                } else if (
                    !zipEntry.dir &&
                    (relativePath === "manifest" ||
                        relativePath.split(".").pop() === "csv" ||
                        relativePath.split(".").pop() === "xml" ||
                        relativePath.split(".").pop() === "json")
                ) {
                    assetPaths.push({ url: relativePath, id: txtId, type: "text" });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
                } else if (
                    !zipEntry.dir &&
                    (relativePath.split(".").pop() === "png" ||
                        relativePath.split(".").pop() === "gif" ||
                        relativePath.split(".").pop() === "jpg" ||
                        relativePath.split(".").pop() === "jpeg")
                ) {
                    assetPaths.push({ url: relativePath, id: bmpId, type: "image" });
                    assetsEvents.push(zipEntry.async("blob"));
                    bmpId++;
                } else if (
                    !zipEntry.dir &&
                    (relativePath.split(".").pop() === "ttf" ||
                        relativePath.split(".").pop() === "otf")
                ) {
                    assetPaths.push({ url: relativePath, id: fntId, type: "font" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    fntId++;
                }
            });
            Promise.all(assetsEvents).then(
                function success(assets) {
                    paths = [];
                    txts = [];
                    imgs = [];
                    fonts = [];
                    var bmpEvents = [];
                    for (var index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "image") {
                            bmpEvents.push(createImageBitmap(assets[index]));
                        } else if (assetPaths[index].type === "font") {
                            fonts.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else {
                            txts.push(assets[index]);
                        }
                    }
                    Promise.all(bmpEvents).then(
                        function success(bmps) {
                            bmps.forEach(bmp => {
                                imgs.push(bmp);
                            });
                            setTimeout(function() {
                                runChannel();
                            }, splashTimeout);
                        },
                        function error(e) {
                            clientException("Error converting image " + e.message);
                        }
                    );
                },
                function error(e) {
                    clientException("Error uncompressing file " + e.message);
                }
            );
        },
        function(e) {
            clientException("Error reading " + f.name + ": " + e.message, true);
            running = false;
        }
    );
}

// Execute Emulator Web Worker
function runChannel() {
    channel1.style.visibility = "hidden";
    channel2.style.visibility = "hidden";
    channel3.style.visibility = "hidden";
    display.style.opacity = 1;
    display.focus();
    brsWorker = new Worker("./lib/brsEmu.js");
    brsWorker.addEventListener("message", saveBuffer);
    var payload = {
        device: deviceData,
        paths: paths,
        brs: source,
        texts: txts,
        fonts: fonts,
        images: imgs,
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, imgs);
}

// Receive Screen and Registry data from Web Worker
function saveBuffer(event) {
    if (event.data instanceof ImageData) {
        buffer = event.data;
        dirty = true;
        drawCanvas();
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function(value, key) {
            storage.setItem(key, value);
        });
    }
}

// Display screen buffer
function drawCanvas() {
    if (dirty) {
        bufferCanvas.width = buffer.width;
        bufferCanvas.height = buffer.height;
        bufferCtx.putImageData(buffer, 0, 0);
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
        dirty = false;
    }
}

// Remote control emulator
function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 6; // BUTTON_SELECT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 37) {
        sharedArray[0] = 4; // BUTTON_LEFT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 39) {
        sharedArray[0] = 5; // BUTTON_RIGHT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 38) {
        sharedArray[0] = 2; // BUTTON_UP_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 40) {
        sharedArray[0] = 3; // BUTTON_DOWN_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 111) {
        sharedArray[0] = 7; // BUTTON_INSTANT_REPLAY_PRESSED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 10; // BUTTON_INFO_PRESSED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 8; // BUTTON_REWIND_PRESSED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 13; // BUTTON_PLAY_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 190) {
        sharedArray[0] = 9; // BUTTON_FAST_FORWARD_PRESSED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 17; // BUTTON_A_PRESSED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 18; // BUTTON_B_PRESSED
    } else if (event.keyCode == 27) {
        if (brsWorker != undefined) {
            // HOME BUTTON (ESC)
            display.style.opacity = 0;
            channelInfo.innerHTML = "<br/>";
            fileButton.style.visibility = "visible";
            channel1.style.visibility = "visible";
            channel2.style.visibility = "visible";
            channel3.style.visibility = "visible";
            fileSelector.value = null;
            brsWorker.terminate();
            sharedArray[0] = 0;
            running = false;
        }
    }
    // TODO: Send TimeSinceLastKeypress()
}

function keyUpHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 100; // BUTTON_BACK_RELEASED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 106; // BUTTON_SELECT_RELEASED
    } else if (event.keyCode == 37) {
        sharedArray[0] = 104; // BUTTON_LEFT_RELEASED
    } else if (event.keyCode == 39) {
        sharedArray[0] = 105; // BUTTON_RIGHT_RELEASED
    } else if (event.keyCode == 38) {
        sharedArray[0] = 102; // BUTTON_UP_RELEASED
    } else if (event.keyCode == 40) {
        sharedArray[0] = 103; // BUTTON_DOWN_RELEASED
    } else if (event.keyCode == 111) {
        sharedArray[0] = 107; // BUTTON_INSTANT_REPLAY_RELEASED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 110; // BUTTON_INFO_RELEASED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 108; // BUTTON_REWIND_RELEASED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 113; // BUTTON_PLAY_RELEASED
    } else if (event.keyCode == 190) {
        sharedArray[0] = 109; // BUTTON_FAST_FORWARD_RELEASED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 117; // BUTTON_A_RELEASED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 118; // BUTTON_B_RELEASED
    }
}

// Exception Handler
function clientException(msg, msgbox = false) {
    console.error(msg);
    if (msgbox) {
        window.alert(msg);
    }
}
