self.requestFileSystemSync = self.webkitRequestFileSystemSync || self.requestFileSystemSync;

function makeRequest(url) {
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

onmessage = function(e) {
    var data = e.data;

    // Make sure we have the right parameters.
    if (!data.assets) {
        return;
    }

    try {
        var message = [];
        data.assets.forEach(asset => {
            var arrayBuffer = makeRequest("../" + asset.path);
            var blob = new Blob([new Uint8Array(arrayBuffer)], { type: asset.type });
            message.push({ path: asset.path, blob: blob });
        });
        postMessage(message);
    } catch (e) {
        onError(e);
    }
};

function onError(e) {
    throw e;
}
