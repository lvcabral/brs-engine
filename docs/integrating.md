# How add the Emulator to a Web Application

This repository provides a sample web appplication for testing the emulator, located under the `app` folder, you can download it from the [release page](https://github.com/lvcabral/brs-emu/releases) with the libraries already integrated, or you can try the simpler example below.

The application cannot be executed as pure HTML page, because some functionalities used by the emulator have security restrictions on the browser engine, so you will need a web server to run it. For that you can use `Apache`, `IIS` or any other simpler web server (see below), but please note that starting from **Chrome** version **92**, the emulator web app will require to be hosted with [COOP and COEP custom headers](https://developer.chrome.com/blog/enabling-shared-array-buffer/) to allow isolation and enable usage of **ShareArrayBuffer**. More information visit: https://developer.chrome.com/blog/enabling-shared-array-buffer/

## Simple Python Web Server

The repository provides a **Python 3** script to create a simplified web server to help testing the web application on development environment, in order to start the web server, on a terminal, go to the `app/` folder located under repository root, and execute:
```shell
    python ./web-server.py
```
By default the server will use the port 8080, if you prefer another port just change it inside the python script (**web-server.py**).
To run the web application navigate with your Chromium based browser to `http://localhost:8080/index.html` (web app) or `http://localhost:8080/example.html` (simple web example).

## Simple Web Example

Make sure you get the library files `brsEmu.js` and `brsEmu.worker.js` and place in the folder `lib` under the main folder where you save the files `example.html` and `example.js`. To learn more about the methods and events of the library visit the [API documentation](docs/emulator-api.md). Remember to host these files on a web server


### example.html
```html
<!DOCTYPE html>
<head>
    <title>BrightScript Emulator</title>
</head>
<body>
<canvas id="display" width="854px" height="480px"></canvas><br />
<label for="story">Type some Brightscript code (open developer tools to see the console):</label><br />
<textarea id="source-code" name="source-code" rows="15" cols="100">
    purple=&h6F1AB1FF
    screen=CreateObject("roScreen")
    screen.SetAlphaEnable(true)
    screen.Clear(purple)
    screen.DrawRect(300, 100, 300, 300, &h80)
    screen.finish()
    while true
        ' loop forever to avoid finish
    end while
</textarea><br />
<input id="clickMe" type="button" value="Run Code!" onclick="executeBrs();" />
<script type="text/javascript" src="lib/brsEmu.js"></script>
<script type="text/javascript" src="example.js"></script>
</body>
</html>
```

### example.js
```javascript
// Initialize Device Emulator and subscribe to events
brsEmu.initialize({}, true, true);
brsEmu.subscribe("myApp", (event, data) => {
    if (event === "loaded") {
        console.log(`Source code loaded: ${data.id}`);
    } else if (event === "started") {
        console.log(`Source code executing: ${data.id}`);
    } else if (event === "closed" || event === "error") {
        console.log(`Execution terminated! ${event}: ${data}`);
    } else if (event === "version") {
        console.log(`brsEmu version ${data}`);
    } else {
        console.log(`received unhandled event "${event}"`)
    }
});
function executeBrs()
{
    source = document.getElementById("source-code").value
    brsEmu.execute("main.brs", source);
}
```

