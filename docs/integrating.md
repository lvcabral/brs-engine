# How add the BrightScript Engine to a Web Application

This repository provides a sample web application for testing the engine, located under the `app/` folder, you can download the full example from the [release page](https://github.com/lvcabral/brs-emu/releases) with the libraries already integrated, or you can try the simpler example listed below.

To learn more about the _methods_ and _events_ exposed by the library visit the [API documentation](emulator-api.md).

**Important Notes:**

Your web application cannot be executed as pure HTML page, because some functionalities used by the engine have security restrictions on the browser platform, so you will need a web server to run it. For that you can use `Apache`, `IIS` or any other simpler web server, but please make sure that your web application is hosted with [COOP and COEP custom headers](https://developer.chrome.com/blog/enabling-shared-array-buffer/) to allow isolation and enable the browser to support **ShareArrayBuffer**. More information visit: <https://developer.chrome.com/blog/enabling-shared-array-buffer/>.

## Using Webpack DevServer

The repository provides a script to run the Webpack DevServer, with COOP and COEP headers, to help testing the web application on development environment. In order to start the web server, execute:

```shell
yarn start
```

By default the server will use the port `6502`, if you prefer another port just change it inside the file `webpack.config.js`. The command above, will open a new tab in the default browser, directly on the address: `http://localhost:6502/`. It may take a few seconds to the web page to show up, as the script will build the API library first.

## Simple Web Example

Below you can find the most simple example to use the app to run BrightScript code. Make sure the library files `brs.api.js` and `brs.worker.js` are located in a folder name `lib/` under the main folder where you host the files `example.html` and `example.js` (code below). Remember that you need to host these files on a web server like the one described in the section above.

### example.html

```html
<!DOCTYPE html>
<head>
    <title>BrightScript Engine Example</title>
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
<script type="text/javascript" src="lib/brs.api.js"></script>
<script type="text/javascript" src="example.js"></script>
</body>
</html>
```

### example.js

```javascript
// Initialize Simulated Device
brs.initialize({}, { debugToConsole: true, disableKeys: true });
// Subscribe to Events (optional)
brs.subscribe("myApp", (event, data) => {
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
    brs.execute("main.brs", source, { clearDisplayOnExit: false });
}
```
