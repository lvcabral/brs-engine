# How add the BrightScript Engine to a Web Application

The **brs-engine** project is published as a `node` package, so you can use `npm`:

```console
$ npm install brs-engine
```

## Sample Application

This repository provides a sample web application for testing the engine, located under the `packages/browser/` folder, you can download the full example from the [release page](https://github.com/lvcabral/brs-engine/releases) with the libraries already integrated, or you can try the simpler example listed below.

To learn more about the _methods_ and _events_ exposed by the library visit the [API documentation](./engine-api.md).

**Important Notes:**

Your web application cannot be executed as pure HTML page, because some functionalities used by the engine have security restrictions on the browser platform, so you will need a web server to run it. For that you can use `Apache`, `IIS` or any other simpler web server, but please make sure that your web application is hosted with [COOP and COEP custom headers](https://developer.chrome.com/blog/enabling-shared-array-buffer/) to allow isolation and enable the browser to support **ShareArrayBuffer**. More information visit: [Chrome - Enabling ShareArrayBuffer](https://developer.chrome.com/blog/enabling-shared-array-buffer/)

### Using Webpack DevServer

The repository provides a script to run the Webpack DevServer, with COOP and COEP headers, to help testing the web application on development environment. In order to start the web server, execute:

```console
$ npm run start
```

The command above, will open a new tab in the default browser, directly on the address: `http://localhost:6502/`. It may take a few seconds to the web page to show up, as the script will load the app and the API library first.

By default the server will use the port `6502`, if you prefer another port just change it inside the webpack configuration file at `packages/browser/config/webpack.config.js`.

## Simple Web Example

Here's the most simple example to use the app to run BrightScript code. Make sure the library files `brs.api.js` and `brs.worker.js` are located in a folder name `lib/` under the main folder where you host the file `example.html` (code below). Remember that you need to host this files on a web server like the one described in the section above.

### example.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>BrightScript Engine Example</title>
    <link rel="icon" href="data:;base64,iVBORwOKGO=" />
</head>
<body>
    <canvas id="display" width="854px" height="480px"></canvas>
    <video id="player" style="display: none" crossorigin="anonymous"></video><br /><br />
    <label for="source-code">
    Type some BrightScript code: (open Developer Tools console to see <b>print</b> outputs)
    </label><br /><br />
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
    <script type="text/javascript" >
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
        // Initialize Simulated Device
        brs.initialize({}, { debugToConsole: true, disableKeys: true });
        // OnClick handler to execute the code
        function executeBrs() {
            source = document.getElementById("source-code").value;
            brs.execute("main.brs", source, { clearDisplayOnExit: false });
        }
    </script>
</body>
</html>
```

## How to Debug your BrightScript Code

You can see the debug messages from `print` statements in your code using the _browser or desktop application console_, just make sure you open the _Developer Tools (Ctrl+Shift+i)_ before loading your app `.zip` package or `.brs` file. Exceptions from the engine library will be shown there too.

If you added a break point (`stop`) in your code, you can also debug using the _browser console_, just send the commands using `debug` method like this: `brs.debug("help")`, but for a better debugging experience, is recommended to use the [desktop application](https://github.com/lvcabral/brs-desktop) integrated with either:

- [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=RokuCommunity.brightscript) - Add `"enableDebugProtocol": false` to your `launch.json` configuration.
- Any Telnet client connected on port 8085.

The Roku `registry` data is stored on the browser **Local Storage** and you can inspect it also using the Developer Tools (Application tab).

If your code does show an error in some scenario not listed on the [limitations documentation](./limitations.md), feel free to [open an issue](https://github.com/lvcabral/brs-engine/issues).

## Games and Demos

You can try the engine by running one of the demonstration apps included in the repository, those are pre-configured as _clickable icons_ on `package/browser/index.html` and `package/browser/index.js`. In addition to those, you can load your own code, either as a single **.brs** file or an app **.zip/.bpk package**. Below there is a list of tested games that are publicly available with source code, download the `.zip` files and have fun!

- [Prince of Persia for Roku](https://github.com/lvcabral/Prince-of-Persia-Roku) port by Marcelo Lv Cabral - Download [zip file](https://github.com/lvcabral/Prince-of-Persia-Roku/releases/download/v0.18.3778/Prince-of-Persia-Roku-018.zip)
- [Lode Runner for Roku](https://github.com/lvcabral/Lode-Runner-Roku) remake by Marcelo Lv Cabral - Download [zip file](https://github.com/lvcabral/Lode-Runner-Roku/releases/download/v0.18.707/Lode-Runner-Roku-018.zip)
- [Retaliate](https://github.com/lvcabral/retaliate-roku) game by Romans I XVI - Download [zip file](https://github.com/lvcabral/retaliate-roku/releases/download/v1.7.0-emu/retaliate-brs-emu.zip)

