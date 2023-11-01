# How add the BrightScript Emulator to a Web Application

This repository provides a sample web application for testing the emulator, located under the `app` folder, you can download the full example from the [release page](https://github.com/lvcabral/brs-emu/releases) with the libraries already integrated, or you can try the simpler example described below.

To learn more about the methods and events of the library visit the [API documentation](emulator-api.md).

The application cannot be executed as pure HTML page, because some functionalities used by the emulator have security restrictions on the browser engine, so you will need a web server to run it. For that you can use `Apache`, `IIS` or any other simpler web server (see below), but please note that any web app using the emulator requires to be hosted with [COOP and COEP custom headers](https://developer.chrome.com/blog/enabling-shared-array-buffer/) to allow isolation and enable the browser to support **ShareArrayBuffer**. More information visit: <https://developer.chrome.com/blog/enabling-shared-array-buffer/>

## Simple Python Web Server

The repository provides a **Python 3** script to create a simplified web server, with COOP and COEP headers, to help testing the web application on development environment. In order to start the web server, on a terminal, go to the `app/` folder located under the repository root, and execute:

```shell
    python3 ./web-server.py
```

By default the server will use the port `6502`, if you prefer another port just change it inside the python script (**web-server.py**).
To run the web application navigate with your browser to `http://localhost:6502/index.html`.

## Simple Web Example

Make sure the library files `brsEmu.js` and `brsEmu.worker.js` are located in the folder `lib` under the main folder where you create the files `example.html` and `example.js` (code below). Remember that you need to host these files on a web server like the on described in the section above.

### example.html

```html
<!DOCTYPE html>
<head>
    <title>BrightScript Emulator</title>
    <link rel="icon" href="data:;base64,iVBORwOKGO=" />
</head>
<body>
<canvas id="display" width="854px" height="480px"></canvas><br />
<label for="story">
Type some BrightScript code: (open Developer Tools console to see <b>print</b> outputs)
</label><br />
<textarea id="source-code" name="source-code" rows="15" cols="100">
' BrightScript Hello World
sub main()
	text = "Hello World"
	purple=&h6F1AB1FF
	white = &hFFFFFFFF
	screen = createObject("roScreen")
	screen.clear(purple)
	font = createObject("roFontRegistry").getDefaultFont()
	w = font.getOneLineWidth(text, screen.getWidth())
	h = font.getOneLineHeight()
	x = cInt((screen.getWidth() - w) / 2)
	y = cInt((screen.getHeight() - h) / 2)
	screen.drawText(text, x, y, white, font)
	print text
	screen.swapBuffers()
end sub
</textarea><br />
<input id="clickMe" type="button" value="Run Code!" onclick="executeBrs();" />
<script type="text/javascript" src="lib/brsEmu.js"></script>
<script type="text/javascript" src="example.js"></script>
</body>
</html>
```

### example.js

```javascript
// Initialize Device Emulator
brsEmu.initialize({}, { debugToConsole: true, disableKeys: true });
// Subscribe to Events (optional)
brsEmu.subscribe("myApp", (event, data) => {
    if (event === "loaded") {
        console.info(`Source code loaded: ${data.id}`);
    } else if (event === "started") {
        console.info(`Source code executing: ${data.id}`);
    } else if (event === "closed" || event === "error") {
        console.info(`Execution terminated! ${event}: ${data}`);
    }
});
// OnClick handler to execute the code
function executeBrs() {
    source = document.getElementById("source-code").value;
    brsEmu.execute("main.brs", source, { clearDisplayOnExit: false });
}
```
