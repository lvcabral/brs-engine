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
