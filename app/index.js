var display = document.getElementById("display");
var ctx = display.getContext("2d", { alpha: false });
var buffer = new ImageData(854, 480);
var dirty = false;
var brsWorker;
var paths = [];
var imgs = [];
var assets = [];
var files = [];
var loader = new Worker("app/loader.js");
loader.onmessage = function(e) {
    files = e.data;
    packImages().then(function() {
        fileSelector.style = "";
        loader.terminate();
    });
};
assets.push({ path: "img/sprite.png", type: "image/png" });
assets.push({ path: "img/roku-logo.png", type: "image/png" });
assets.push({ path: "img/AmigaBoingBall.png", type: "image/png" });
assets.push({ path: "img/BallShadow.png", type: "image/png" });
loader.postMessage({ assets: assets });

async function packImages() {
    events = [];
    files.forEach(file => {
        paths.push(file.path);
        events.push(createImageBitmap(file.blob));
    });
    return Promise.all(events).then(bmps => {
        for (var index = 0; index < bmps.length; index++) {
            imgs.push(bmps[index]);
        }
    });
}

var fileSelector = document.getElementById("file");
fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function(progressEvent) {
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        display.style.display = "initial";
        brsWorker = new Worker("./lib/brsLib.js");
        brsWorker.addEventListener("message", saveBuffer);
        var payload = { brs: this.result, paths: paths, images: imgs };
        brsWorker.postMessage(payload, imgs);
    };
    if (brsWorker != undefined) {
        brsWorker.terminate();
        paths = [];
        imgs = [];
        packImages().then(function() {
            reader.readAsText(file);
        });
    } else {
        reader.readAsText(file);
    }
};

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
