var display = document.getElementById("display");
var screenSize = { width: 854, height: 480 };
var ctx = display.getContext("2d", { alpha: false });
var bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
var bufferCtx = bufferCanvas.getContext("2d");
var buffer = new ImageData(screenSize.width, screenSize.height);
var dirty = false;
var splashTimeout = 1600;
var brsWorker;
var source = [];
var assets = [];
assets.push({ path: "images/sprite.png", type: "image/png" });
assets.push({ path: "images/roku-logo.png", type: "image/png" });
assets.push({ path: "images/AmigaBoingBall.png", type: "image/png" });
assets.push({ path: "images/BallShadow.png", type: "image/png" });
assets.push({ path: "images/earth.png", type: "image/png" });
assets.push({ path: "assets/3ballset.png", type: "image/png" });
assets.push({ path: "assets/4ballset.png", type: "image/png" });
assets.push({ path: "assets/5ballset.png", type: "image/png" });
assets.push({ path: "assets/6ballset.png", type: "image/png" });
assets.push({ path: "assets/8ballset.png", type: "image/png" });
assets.push({ path: "assets/bitmapset.xml", type: "text/xml" });
assets.push({ path: "assets/anims/kid-sequence.json", type: "text/json" });
assets.push({ path: "assets/sprites/kid.json", type: "text/json" });
assets.push({ path: "assets/sprites/kid-l.png", type: "image/png" });
assets.push({ path: "assets/sprites/kid-r.png", type: "image/png" });
var fileSelector = document.getElementById("file");
var zip = new JSZip();

fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function(progressEvent) {
        source.push(this.result);
        loadAssets();
    };
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    var ext = file.name.split(".").pop();
    if (ext === "zip") {
        handleFile(file);
    } else {
        reader.readAsText(file);
    }
};

function handleFile(f) {
    console.log("Loading " + f.name + "...");
    JSZip.loadAsync(f).then(
        function(zip) {
            var manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        var manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function(ln) {
                            line = ln.split("=");
                            manifestMap.set(line[0], line[1]);
                        });
                        splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }
                        var splashHD = manifestMap.get("splash_screen_hd");
                        if (splashHD && splashHD.substr(0, 5) === "pkg:/") {
                            splashFile = zip.file(splashHD.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then(blob => {
                                    createImageBitmap(blob).then(imgData => {
                                        display.style.display = "initial";
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
                    },
                    function error(e) {
                        console.error("Error uncompressing manifest:" + e.message);
                    }
                );
            } else {
                console.error("Invalid Roku package: missing manifest.");
                return;
            }
            var sourceEvents = [];
            zip.forEach(function(relativePath, zipEntry) {
                if (!zipEntry.dir && relativePath.toLowerCase().substr(0, 6) === "source") {
                    sourceEvents.push(zipEntry.async("string"));
                }
            });
            Promise.all(sourceEvents).then(
                function success(contents) {
                    contents.forEach(content => {
                        source.push(content);
                    });
                    setTimeout(function() {
                        loadAssets();
                    }, splashTimeout);
                },
                function error(e) {
                    console.error("Error uncompressing file " + +e.message);
                }
            );
        },
        function(e) {
            console.error("Error reading " + f.name + ": " + e.message);
        }
    );
}

function loadAssets() {
    var loader = new Worker("app/loader.js");
    loader.onmessage = function(e) {
        paths = [];
        imgs = [];
        txts = [];
        e.data.forEach(file => {
            paths.push(file.path);
            if (file.bmp) {
                imgs.push(file.bmp);
            } else {
                txts.push(file.txt);
            }
        });
        loader.terminate();
        runChannel();
    };
    loader.postMessage({ assets: assets });
}
function runChannel() {
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, display.width, display.height);
    display.style.display = "initial";
    brsWorker = new Worker("./lib/brsLib.js");
    brsWorker.addEventListener("message", saveBuffer);
    var payload = { brs: source[0], paths: paths, texts: txts, images: imgs };
    brsWorker.postMessage(payload, imgs);
}

function saveBuffer(event) {
    buffer = event.data;
    dirty = true;
}
function drawCanvas() {
    if (dirty) {
        bufferCanvas.width = buffer.width;
        bufferCanvas.height = buffer.height;
        bufferCtx.putImageData(buffer, 0, 0);
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
        dirty = false;
    }
    requestAnimationFrame(drawCanvas);
}
requestAnimationFrame(drawCanvas);
