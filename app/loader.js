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
    if (!data.files) {
        return;
    }

    try {
        var localFiles = [];
        var fs = requestFileSystemSync(TEMPORARY, 1024 * 1024 /*1MB*/);
        data.files.forEach(file => {
            var fileEntry = fs.root.getFile(file.fileName, { create: true });
            var arrayBuffer = makeRequest("../" + file.folder + "/" + file.fileName);
            var blob = new Blob([new Uint8Array(arrayBuffer)], { type: file.type });
            fileEntry.createWriter().write(blob);
            localFiles.push({
                name: fileEntry.name,
                path: fileEntry.fullPath,
                url: fileEntry.toURL(),
            });
        });
        postMessage(localFiles);
    } catch (e) {
        onError(e);
    }
};

function onError(e) {
    throw e;
}
