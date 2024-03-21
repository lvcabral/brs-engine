/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { enableSendKeys, initControlModule, sendKey, subscribeControl } from "../api/control";
import { DataType, DebugCommand } from "../worker/enums";
import { isMainThread, parentPort, workerData } from "worker_threads";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import restana from "restana";
import WebSocket, { RawData } from "ws";
import packageInfo from "../../package.json";

const DEBUG = false;
const ECPPORT = 8060;
const SSDPPORT = 1900;
const MAC = getMacAddress();
const UDN = "138aedd0-d6ad-11eb-b8bc-" + MAC.replace(/:\s*/g, "");
let ecp: restana.Service<restana.Protocol.HTTP>;
let ssdp: any;
let device: any;
let sharedArray: Int32Array;
let isECPEnabled = false;
let cliRegistry = new Map<string, string>();

if (!isMainThread && parentPort) {
    device = workerData.device;
    if (device.registry instanceof Map) {
        cliRegistry = device.registry;
    }
    parentPort.on("message", (data) => {
        if (data instanceof SharedArrayBuffer) {
            sharedArray = new Int32Array(data);
            initControlModule(sharedArray);
            enableECP();
        } else if (data instanceof Map) {
            cliRegistry = data;
        }
    });
    parentPort.on("exit", disableECP);
    parentPort.on("close", disableECP);
}

function enableECP() {
    // Create ECP Server
    ecp = restana();
    ecp.getServer().on("error", (error: Error) => {
        parentPort?.postMessage({
            ready: false,
            msg: `Failed to start ECP server:${error.message}\n`,
        });
    });
    ecp.get("/", sendDeviceRoot);
    ecp.get("/device-image.png", sendDeviceImage);
    ecp.get("/ecp_SCPD.xml", sendScpdXML);
    ecp.get("/dial_SCPD.xml", sendScpdXML);
    ecp.get("/query/device-info", sendDeviceInfo);
    ecp.get("//query/device-info", sendDeviceInfo);
    ecp.get("/query/apps", sendApps);
    ecp.get("/query/active-app", sendActiveApp);
    ecp.get("/query/icon/:appID", sendAppIcon);
    ecp.get("/query/registry/:appID", sendRegistry);
    ecp.post("/launch/:appID", sendLaunchApp);
    ecp.post("/keypress/:key", sendKeyPress);
    ecp.post("/keydown/:key", sendKeyDown);
    ecp.post("/keyup/:key", sendKeyUp);
    if (DEBUG) {
        ecp.use((req, res, next) => {
            console.debug(req.url, req.method, req.headers);
            return next();
        });
    }
    ecp.start(ECPPORT)
        .then((server) => {
            // Create SSDP Server
            ssdp = new SSDP({
                location: {
                    port: ECPPORT,
                    path: "/",
                },
                adInterval: 120000,
                ttl: 3600,
                udn: `uuid:roku:ecp:${device.serialNumber}`,
                ssdpSig: "Roku UPnP/1.0 Roku/9.1.0",
                ssdpPort: SSDPPORT,
                suppressRootDeviceAdvertisements: true,
                headers: { "device-group.roku.com": "46F5CCE2472F2B14D77" },
            });
            ssdp.addUSN("roku:ecp");
            ssdp._usns["roku:ecp"] = `uuid:roku:ecp:${device.serialNumber}`;
            // Start server on all interfaces
            ssdp.start()
                .catch((e: Error) => {
                    parentPort?.postMessage({
                        ready: false,
                        msg: `Failed to start SSDP server:${e.message}\n`,
                    });
                })
                .then(() => {
                    subscribeControl("ecp", (event: string) => {
                        if (event === "home" || event === "poweroff") {
                            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXIT);
                        }
                    });
                    enableSendKeys(true);
                    isECPEnabled = true;
                    parentPort?.postMessage({
                        ready: true,
                        msg: "ECP and SSDP servers initialized!\n",
                    });
                });
            // Create ECP-2 WebSocket Server
            const wss = new WebSocket.Server({ noServer: true });
            wss.on("connection", function connection(ws) {
                const auth = `{"notify":"authenticate","param-challenge":"jONQirQ3WxSQWdI9Zn0enA==","timestamp":"${process
                    .uptime()
                    .toFixed(3)}"}`;
                if (DEBUG) {
                    console.debug("received connection!", auth);
                }
                ws.send(auth);
                ws.on("message", function incoming(message) {
                    processRequest(ws, message);
                });
                ws.on("ping", function heartbeat(p) {
                    ws.pong();
                });
            });
            server.on("upgrade", function upgrade(request, socket, head) {
                const pathname = url.parse(request.url ?? "").pathname;
                if (pathname === "/ecp-session") {
                    if (DEBUG) {
                        console.debug("ecp-2 websocket session started!");
                    }
                    wss.handleUpgrade(request, socket, head, function done(ws) {
                        wss.emit("connection", ws, request);
                    });
                } else {
                    socket.destroy();
                }
            });
        })
        .catch((error: Error) => {
            parentPort?.postMessage({ ready: false, msg: `ECP server error:${error.message}\n` });
        });
}

function disableECP() {
    if (isECPEnabled) {
        if (ecp) {
            ecp.close();
        }
        if (ssdp) {
            ssdp.stop();
        }
        isECPEnabled = false;
    }
}

// ECP-2 WebSocket API
function processRequest(ws: WebSocket, message: RawData) {
    if (message) {
        if (DEBUG) {
            console.debug("received: %s", message);
        }
        let reply = "";
        let msg: any;
        try {
            msg = JSON.parse(message.toString());
        } catch (error) {
            console.warn("invalid ecp-2 message:", message);
            return;
        }
        const statusOK = `"response":"${msg["request"]}","response-id":"${msg["request-id"]}","status":"200","status-msg":"OK"`;
        if (msg["request"] == "authenticate" && msg["param-response"]) {
            reply = `{${statusOK}}`;
        } else if (msg["request"]?.startsWith("query")) {
            reply = queryReply(msg, statusOK);
        } else if (msg["request"] == "launch") {
            launchApp(msg["param-channel-id"]);
            reply = `{${statusOK}}`;
        } else if (msg["request"] == "key-press") {
            sendKeyPress(msg["param-key"], null);
            reply = `{${statusOK}}`;
        } else {
            // Reply OK to any other request, including "request-events"
            reply = `{${statusOK}}`;
        }
        if (DEBUG) {
            console.debug(`replying: ${msg["request-id"]}:${msg["request"]} with ${reply}`);
        }
        ws.send(reply);
    }
}

function queryReply(msg: any, statusOK: string) {
    const request = msg["request"];
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    const xml64 = Buffer.from(xml).toString("base64");
    const template = `{"content-data":"$data","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
    let reply = `{${statusOK}}`;
    if (request == "query-device-info") {
        reply = template.replace("$data", genDeviceInfoXml(true));
    } else if (request == "query-themes") {
        reply = template.replace("$data", genThemesXml(true));
    } else if (request == "query-screensavers") {
        reply = template.replace("$data", genScrsvXml(true));
    } else if (request == "query-apps") {
        reply = template.replace("$data", genAppsXml(true));
    } else if (request == "query-icon") {
        reply = template.replace("$data", genAppIcon(true) as string);
        reply = reply.replace("text/xml", "image/png");
    } else if (request == "query-tv-active-channel") {
        reply = template.replace("$data", genActiveApp(true));
    } else if (msg["request"] == "query-media-player") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] == "query-audio-device") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] == "query-textedit-state") {
        const content = Buffer.from(`{"textedit-state":{"textedit-id":"none"}}`).toString("base64");
        reply = template.replace("$data", content);
        reply = reply.replace("text/xml", "application/json");
    }
    return reply;
}

// ECP REST API Methods
function sendDeviceRoot(req: any, res: any) {
    res.setHeader("content-type", "application/xml");
    res.send(genDeviceRootXml());
}

function sendDeviceInfo(req: any, res: any) {
    res.setHeader("content-type", "application/xml");
    res.send(genDeviceInfoXml(false));
}

function sendApps(req: any, res: any) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppsXml(false));
}

function sendActiveApp(req: any, res: any) {
    res.setHeader("content-type", "application/xml");
    res.send(genActiveApp(false));
}

function sendDeviceImage(req: any, res: any) {
    let image = fs.readFileSync(path.join(__dirname, "images", "device-image.png"));
    res.setHeader("content-type", "image/png");
    res.send(image);
}

function sendScpdXML(req: any, res: any) {
    let file = fs.readFileSync(path.join(__dirname, "web", "ecp_SCPD.xml"));
    res.setHeader("content-type", "application/xml");
    res.send(file);
}

function sendAppIcon(req: any, res: any) {
    res.setHeader("content-type", "image/png");
    res.send(genAppIcon(false));
}

function sendRegistry(req: any, res: any) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppRegistry(req.params.appID, false));
}

function sendLaunchApp(req: any, res: any) {
    launchApp(req.params.appID);
    res?.end();
}

function sendKeyDown(req: any, res: any) {
    sendKey(req.params.key, 0);
    res?.end();
}

function sendKeyUp(req: any, res: any) {
    sendKey(req.params.key, 100);
    res?.end();
}

function sendKeyPress(req: any, res: any) {
    setTimeout(() => {
        sendKey(req.params.key, 100);
    }, 300);
    sendKey(req.params.key, 0);
    res?.end();
}

// Content Generation Functions
function genDeviceRootXml() {
    const xml = xmlbuilder.create("root").att("xmlns", "urn:schemas-upnp-org:device-1-0");
    const spec = xml.ele("specVersion");
    spec.ele("major", {}, 1);
    spec.ele("minor", {}, 0);
    const xmlDevice = xml.ele("device");
    xmlDevice.ele("deviceType", {}, "urn:roku-com:device:player:1-0");
    xmlDevice.ele("friendlyName", {}, device.friendlyName);
    xmlDevice.ele("manufacturer", {}, "Roku");
    xmlDevice.ele("manufacturerURL", {}, "https://www.roku.com/");
    xmlDevice.ele("modelDescription", {}, packageInfo.description);
    xmlDevice.ele("modelName", {}, getModelName(device.deviceModel));
    xmlDevice.ele("modelNumber", {}, device.deviceModel);
    xmlDevice.ele("modelURL", {}, "https://www.lvcabral.com/brs/");
    xmlDevice.ele("serialNumber", {}, device.serialNumber);
    xmlDevice.ele("UDN", {}, `uuid:${UDN}`);
    const xmlList = xmlDevice.ele("serviceList");
    const xmlService = xmlList.ele("service");
    xmlService.ele("serviceType", {}, "urn:roku-com:service:ecp:1");
    xmlService.ele("serviceId", {}, "urn:roku-com:serviceId:ecp1-0");
    xmlService.ele("controlURL");
    xmlService.ele("eventSubURL");
    xmlService.ele("SCPDURL", {}, "ecp_SCPD.xml");
    const xmlDial = xmlList.ele("service");
    xmlDial.ele("serviceType", {}, "urn:dial-multiscreen-org:service:dial:1");
    xmlDial.ele("serviceId", {}, "urn:dial-multiscreen-org:serviceId:dial1-0");
    xmlDial.ele("controlURL");
    xmlDial.ele("eventSubURL");
    xmlDial.ele("SCPDURL", {}, "dial_SCPD.xml");
    return xml.end({ pretty: true });
}

function genDeviceInfoXml(encrypt: boolean) {
    const xml = xmlbuilder.create("device-info");
    const modelName = getModelName(device.deviceModel);
    xml.ele("udn", {}, UDN);
    if (encrypt) {
        xml.ele("virtual-device-id", {}, device.serialNumber);
    }
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "Roku");
    xml.ele("model-name", {}, modelName);
    xml.ele("model-number", {}, device.deviceModel);
    xml.ele("model-region", {}, device.countryCode);
    xml.ele("is-tv", {}, modelName.toLowerCase().includes("tv"));
    xml.ele("is-stick", {}, modelName.toLowerCase().includes("stick"));
    xml.ele("ui-resolution", {}, device.displayMode);
    xml.ele("wifi-mac", {}, MAC);
    xml.ele("ethernet-mac", {}, MAC);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "Local");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, modelName);
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, device.firmwareVersion);
    xml.ele("software-version", {}, getRokuOS(device.firmwareVersion));
    xml.ele("software-build", {}, getRokuOS(device.firmwareVersion, false));
    xml.ele("secure-device", {}, true);
    xml.ele("language", {}, device.locale.split("_")[0]);
    xml.ele("country", {}, device.countryCode);
    xml.ele("locale", {}, device.locale);
    xml.ele("time-zone-auto", {}, device.timeZoneAuto);
    xml.ele("time-zone", {}, device.timeZone);
    xml.ele("time-zone-name", {}, device.timeZone);
    xml.ele("time-zone-tz", {}, device.timeZoneIANA);
    xml.ele("time-zone-offset", {}, device.timeZoneOffset);
    xml.ele("clock-format", {}, device.clockFormat);
    xml.ele("uptime", {}, Math.round(process.uptime()));
    xml.ele("power-mode", {}, "PowerOn");
    xml.ele("support-suspend", {}, false);
    xml.ele("support-find-remote", {}, false);
    xml.ele("support-audio-guide", {}, false);
    xml.ele("support-rva", {}, true);
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
    xml.ele("search-enabled", {}, false);
    xml.ele("search-channels-enabled", {}, false);
    xml.ele("voice-search-enabled", {}, false);
    xml.ele("notifications-enabled", {}, true);
    xml.ele("notifications-first-use", {}, false);
    xml.ele("supports-private-listeninig", {}, false);
    xml.ele("headphones-connected", {}, false);
    xml.ele("supports-ecs-textedit", {}, true);
    xml.ele("supports-ecs-microphone", {}, false);
    xml.ele("supports-wake-on-wlan", {}, false);
    xml.ele("has-play-on-roku", {}, false);
    xml.ele("has-mobile-screensaver", {}, false);
    xml.ele("support-url", {}, "roku.com/support");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genThemesXml(encrypt: boolean) {
    const xml = xmlbuilder.create("themes");
    xml.ele("theme", { id: "brand", selected: true }, "Roku (default)");
    xml.ele("theme", { id: "Graphene" }, "Graphene");
    xml.ele("theme", { id: "Brown" }, "Decaf");
    xml.ele("theme", { id: "Space" }, "Nebula");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genScrsvXml(encrypt: boolean) {
    const xml = xmlbuilder.create("screensavers");
    xml.ele("screensaver", { default: true, id: "5533", selected: true }, "Roku Digital Clock");
    xml.ele("screensaver", { id: "5534" }, "Roku Analog Clock");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genAppsXml(encrypt: boolean) {
    const xml = xmlbuilder.create("apps");
    xml.ele(
        "app",
        {
            id: "dev",
            subtype: "sdka",
            type: "appl",
            version: "0.0.0",
        },
        "Side Loaded App via CLI"
    );
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genAppIcon(encrypt: boolean) {
    const image = fs.readFileSync(path.join(__dirname, "../app/images/icons", "channel-icon.png"));
    return encrypt ? image.toString("base64") : image;
}

function genActiveApp(encrypt: boolean) {
    const xml = xmlbuilder.create("apps");
    xml.ele("app", {}, packageInfo.name);
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genAppRegistry(plugin: string, encrypt: boolean) {
    const xml = xmlbuilder.create("plugin-registry");
    if (plugin.toLowerCase() === "dev") {
        const regXml = xml.ele("registry");
        regXml.ele("dev-id", {}, device.developerId);
        regXml.ele("plugins", {}, plugin);
        regXml.ele("space-available", {}, 32768);
        const secsXml = regXml.ele("sections");
        let curSection = "";
        let scXml: xmlbuilder.XMLElementOrXMLNode;
        let itsXml: xmlbuilder.XMLElementOrXMLNode;
        let itXml: xmlbuilder.XMLElementOrXMLNode;
        const registry = new Map([...cliRegistry].sort());
        registry.forEach((value, key) => {
            const sections = key.split(".");
            if (sections.length > 2 && sections[0] === device.developerId) {
                if (sections[1] !== curSection) {
                    curSection = sections[1];
                    scXml = secsXml.ele("section");
                    scXml.ele("name", {}, curSection);
                    itsXml = scXml.ele("items");
                }
                itXml = itsXml.ele("item");
                let key = sections[2];
                if (sections.length > 3) {
                    key = sections.slice(2).join(".");
                }
                itXml.ele("key", {}, key);
                itXml.ele("value", {}, value);
            }
        });
        xml.ele("status", {}, "OK");
    } else {
        xml.ele("status", {}, "FAILED");
        xml.ele("error", {}, `Plugin ${plugin} not found`);
    }
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

// Helper Functions

function launchApp(appID: string) {
    // not supported
}

function getMacAddress() {
    const ifaces = os.networkInterfaces();
    let mac = "";
    Object.keys(ifaces).forEach(function (ifname) {
        if (
            mac !== "" ||
            ifname.toLowerCase().startsWith("vmware") ||
            ifname.toLowerCase().startsWith("virtualbox")
        ) {
            return;
        }
        ifaces[ifname]?.forEach(function (iface: any) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            mac = iface.mac;
            return;
        });
    });
    if (mac === "") {
        mac = "87:3e:aa:9f:77:70";
    }
    return mac;
}

function getRokuOS(firmware: string, version = true) {
    if (firmware?.length) {
        if (version) {
            const versions = "0123456789ACDEFGHJKLMNPRSTUVWXY";
            const major = versions.indexOf(firmware.charAt(2));
            const minor = firmware.slice(4, 5);
            const revision = firmware.slice(7, 8);
            return `${major}.${minor}.${revision}`;
        } else {
            return firmware.slice(8, 12);
        }
    }
    return "";
}

function getModelName(model: string) {
    const modelName = device.models.get(model);
    return modelName ? modelName[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`;
}
