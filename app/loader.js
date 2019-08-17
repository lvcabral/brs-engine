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
            if (asset.path.substr(0, 4) !== "http") {
                url = "../" + asset.path;
            }
            var arrayBuffer = download(url);
            var blob = new Blob([new Uint8Array(arrayBuffer)], { type: asset.type });
            files.push({ path: asset.path, blob: blob });
        });
        packImages(files).then(function() {
            postMessage(message);
        });
    } catch (e) {
        onError(e);
    }
};

function onError(e) {
    throw e;
}

async function packImages(files) {
    events = [];
    paths = [];
    files.forEach(file => {
        paths.push(file.path);
        events.push(createImageBitmap(file.blob));
    });
    return Promise.all(events).then(bmps => {
        for (var index = 0; index < bmps.length; index++) {
            message.push({ path: paths[index], bmp: bmps[index] });
        }
    });
}

function download(url) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Note: synchronous
        xhr.responseType = "arraybuffer";
        xhr.send();
        return xhr.response;
    } catch (e) {
        onError(e);
    }
}
