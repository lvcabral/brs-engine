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
    brsEmu.execute("main.brs", source, false);
}
