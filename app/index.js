var display = document.getElementById("display");
var ctx = display.getContext("2d", { alpha: false });
var buffer = new ImageData(854, 480);
var dirty = false;
var brsWorker;
var imgs = [];
var urls = [];
var files = [];
var localFiles = [];

files.push({ fileName: "sprite.png", folder: "img", type: "image/png" });
files.push({ fileName: "roku-logo.png", folder: "img", type: "image/png" });
files.push({ fileName: "AmigaBoingBall.png", folder: "img", type: "image/png" });
files.push({ fileName: "BallShadow.png", folder: "img", type: "image/png" });
var loader = new Worker("app/loader.js");
loader.onmessage = function(e) {
    localFiles = e.data;
    fileSelector.style = "";
    loader.terminate();
};
loader.postMessage({ files: files });

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
        if (brsWorker != undefined) {
            brsWorker.terminate();
        }
        brsWorker = new Worker("./lib/brsLib.js");
        brsWorker.addEventListener("message", saveBuffer);
        if (imgs.length == 0) {
            imgs.push(getImageData("img/sprite.png"));
            imgs.push(getImageData("img/roku-logo.png"));
            imgs.push(getImageData("img/AmigaBoingBall.png"));
            imgs.push(getImageData("img/BallShadow.png"));
        }
        var payload = { brs: this.result, urls: urls, images: imgs };
        brsWorker.postMessage(payload);
    };
    reader.readAsText(file);
};

function getImageData(id) {
    urls.push(id);
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    var img = document.getElementById(id);
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, img.width, img.height);
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
