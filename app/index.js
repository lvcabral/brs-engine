var display = document.getElementById("display");
var ctx = display.getContext("2d", { alpha: false });
var buffer = new ImageData(854, 480);
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
        ctx.putImageData(buffer, 0, 0);
        dirty = false;
    }
    requestAnimationFrame(drawCanvas);
}
requestAnimationFrame(drawCanvas);
