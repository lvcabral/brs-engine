var display = document.getElementById("display");
var screenSize = { width: 854, height: 480 };
var ctx = display.getContext("2d", { alpha: false });
var bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
var bufferCtx = bufferCanvas.getContext("2d");
var buffer = new ImageData(screenSize.width, screenSize.height);
var dirty = false;
var brsWorker;
var source = [];
var assets = [];

// Control buffer
const length = 10;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);
for (let i = 0; i < length; i++) sharedArray[i] = i && sharedArray[i - 1] + 2;

// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

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

// File selector
var fileSelector = document.getElementById("file");
fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function(progressEvent) {
        source = [this.result];
        loadAssets();
    };
    reader.readAsText(file);
};

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
        fileSelector.style = "";
        loader.terminate();
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        display.style.display = "initial";
        if (brsWorker != undefined) {
            brsWorker.terminate();
        }
        brsWorker = new Worker("./lib/brsLib.js");
        brsWorker.addEventListener("message", saveBuffer);
        var payload = { brs: source[0], paths: paths, texts: txts, images: imgs };
        brsWorker.postMessage(sharedBuffer);
        brsWorker.postMessage(payload, imgs);
    };
    loader.postMessage({ assets: assets });
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

function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 6; // BUTTON_SELECT_PRESSED
    } else if (event.keyCode == 37) {
        sharedArray[0] = 4; // BUTTON_LEFT_PRESSED
    } else if (event.keyCode == 39) {
        sharedArray[0] = 5; // BUTTON_RIGHT_PRESSED
    } else if (event.keyCode == 38) {
        sharedArray[0] = 2; // BUTTON_UP_PRESSED
    } else if (event.keyCode == 40) {
        sharedArray[0] = 3; // BUTTON_DOWN_PRESSED
    } else if (event.keyCode == 27) {
        if (brsWorker != undefined) {
            // HOME BUTTON (ESC)
            display.style.display = "none";
            fileSelector.value = null;
            brsWorker.terminate();
        }
    }
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
    }
}
