var display = document.getElementById("display");
var ctx = display.getContext("2d", { alpha: false });
var buffer = new ImageData(854, 480);
var dirty = false;
var brsWorker;
var source = [];
var assets = [];
assets.push({ path: "img/sprite.png", type: "image/png" });
assets.push({ path: "img/roku-logo.png", type: "image/png" });
assets.push({ path: "img/AmigaBoingBall.png", type: "image/png" });
assets.push({ path: "img/BallShadow.png", type: "image/png" });

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
        e.data.forEach(file => {
            paths.push(file.path);
            imgs.push(file.bmp);
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
        var payload = { brs: source[0], paths: paths, images: imgs };
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
        ctx.putImageData(buffer, 0, 0);
        dirty = false;
    }
    requestAnimationFrame(drawCanvas);
}
requestAnimationFrame(drawCanvas);
