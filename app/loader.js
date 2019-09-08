self.requestFileSystemSync = self.webkitRequestFileSystemSync || self.requestFileSystemSync;

var message = [];

onmessage = function(e) {
    var data = e.data;
    if (!data.assets) {
        return;
    }
    try {
        var files = [];
        data.assets.forEach(asset => {
            var url = asset.path;
            if (asset.type == "image/png") {
                var arrayBuffer = download(url, "arraybuffer");
                var blob = new Blob([new Uint8Array(arrayBuffer)], { type: asset.type });
                files.push({ path: asset.path, blob: blob });
            } else {
                var xml = download(url, "text");
                files.push({ path: asset.path, text: xml });
            }
        });
        packAssets(files).then(function() {
            postMessage(message);
        });
    } catch (e) {
        onError(e);
    }
};

function onError(e) {
    throw e;
}

async function packAssets(files) {
    events = [];
    paths = [];
    bmps = 0;
    txts = 0;
    files.forEach(file => {
        if (file.blob) {
            paths.push({ url: file.path, id: bmps, type: "image" });
            events.push(createImageBitmap(file.blob));
            bmps++;
        } else {
            paths.push({ url: file.path, id: txts, type: "text" });
            events.push(Promise.resolve(file.text));
            txts++;
        }
    });
    return Promise.all(events).then(assets => {
        for (var index = 0; index < assets.length; index++) {
            if (assets[index] instanceof ImageBitmap) {
                message.push({ path: paths[index], bmp: assets[index] });
            } else {
                message.push({ path: paths[index], txt: assets[index] });
            }
        }
    });
}

function download(url, type) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Note: synchronous
        xhr.responseType = type;
        xhr.send();
        return xhr.response;
    } catch (e) {
        onError(e);
    }
}
