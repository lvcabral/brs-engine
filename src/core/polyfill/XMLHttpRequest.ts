/**
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: import { XMLHttpRequest } from "XMLHttpRequest";
 *
 * Source:
 *  GitHub: https://github.com/mjwwit/node-XMLHttpRequest
 *  NPM: https://www.npmjs.com/package/xmlhttprequest-ssl
 *
 * @author Dan DeFelippi <dan@driverdan.com>
 * @contributor David Ellis <d.f.ellis@ieee.org>
 * @contributor Michael de Wit <mjwwit@gmail.com> (Fork used in this project)
 * @contributor Marcelo Lv Cabral <marcelo@lvcabral.com> (TypeScript conversion and sync fixes)
 * @license MIT
 */

import * as fs from "fs";
import * as Url from "url";
import * as http from "http";
import * as https from "https";
import * as crypto from "crypto";
import { spawn } from "child_process";

/**
 * `XMLHttpRequest` constructor.
 *
 * Supported options for the `opts` object are:
 *
 *  - `agent`: An http.Agent instance; http.globalAgent may be used; if 'undefined', agent usage is disabled
 *
 * @param {Object} opts optional "options" object
 */

// Set some default headers
const defaultHeaders = {
    "User-Agent": "node-XMLHttpRequest",
    Accept: "*/*",
};

// These headers are not user setable.
// The following are allowed but banned in the spec:
// * user-agent
const forbiddenRequestHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "content-transfer-encoding",
    "cookie",
    "cookie2",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via",
];

// These request methods are not allowed
const forbiddenRequestMethods = ["TRACE", "TRACK", "CONNECT"];

export class XMLHttpRequest {
    /**
     * Private variables
     */

    // Constructor Options
    private _opts: any;

    // Holds http.js objects
    private _request: any;
    private _response: any;

    // Request settings
    private _settings: any = {};

    // Disable header blacklist.
    // Not part of XHR specs.
    private _disableHeaderCheck = false;
    private _headers: any;

    // Send flag
    private _sendFlag = false;
    // Error flag, used when errors occur or abort is called
    private _errorFlag = false;
    private _abortedFlag = false;

    // Event listeners
    private _listeners: any = {};

    /**
     * Constants
     */

    readonly UNSENT = 0;
    readonly OPENED = 1;
    readonly HEADERS_RECEIVED = 2;
    readonly LOADING = 3;
    readonly DONE = 4;

    /**
     * Public vars
     */

    // Current state
    public readyState = this.UNSENT;

    // Result & response
    public responseType: any = null;
    public responseText = "";
    public responseXML = "";
    public response = Buffer.alloc(0);
    public status = 0;
    public statusText = "";
    public withCredentials = false;

    constructor(opts?: any) {
        this._opts = opts ?? {};
        this._headers = { ...defaultHeaders };
        this._request = null;
        this._response = null;

        // Event listeners
        this._listeners = {};
    }

    /**
     * Private methods
     */

    /**
     * Check if the specified header is allowed.
     *
     * @param string header Header to validate
     * @return boolean False if not allowed, otherwise true
     */
    private isAllowedHttpHeader(header: string) {
        return this._disableHeaderCheck || (header && forbiddenRequestHeaders.indexOf(header.toLowerCase()) === -1);
    }

    /**
     * Check if the specified method is allowed.
     *
     * @param string method Request method to validate
     * @return boolean False if not allowed, otherwise true
     */
    private isAllowedHttpMethod(method: string) {
        return method && forbiddenRequestMethods.indexOf(method) === -1;
    }

    /**
     * Public methods
     */

    /**
     * Open the connection. Currently supports local server requests.
     *
     * @param string method Connection method (eg GET, POST)
     * @param string url URL for the connection.
     * @param boolean async Asynchronous connection. Default is true.
     * @param string user Username for basic authentication (optional)
     * @param string password Password for basic authentication (optional)
     */
    open(method: string, url: string, async?: boolean, user?: string, password?: string) {
        this.abort();
        this._errorFlag = false;
        this._abortedFlag = false;

        // Check for valid request method
        if (!this.isAllowedHttpMethod(method)) {
            throw new Error("SecurityError: Request method not allowed");
        }

        this._settings = {
            method: method,
            url: url.toString(),
            async: async ?? true,
            user: user ?? null,
            password: password ?? null,
        };

        this.setState(this.OPENED);
    }

    /**
     * Disables or enables isAllowedHttpHeader() check the request. Enabled by default.
     * This does not conform to the W3C spec.
     *
     * @param boolean state Enable or disable header checking.
     */
    setDisableHeaderCheck(state: boolean) {
        this._disableHeaderCheck = state;
    }

    /**
     * Sets a header for the request.
     *
     * @param string header Header name
     * @param string value Header value
     * @return boolean Header added
     */
    setRequestHeader(header: string, value: string) {
        if (this.readyState !== this.OPENED) {
            throw new Error("INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN");
        }
        if (!this.isAllowedHttpHeader(header)) {
            console.warn('Refused to set unsafe header "' + header + '"');
            return false;
        }
        if (this._sendFlag) {
            throw new Error("INVALID_STATE_ERR: send flag is true");
        }
        this._headers[header] = value;
        return true;
    }

    /**
     * Gets a header from the server response.
     *
     * @param string header Name of header to get.
     * @return string Text of the header or null if it doesn't exist.
     */
    getResponseHeader(header: string) {
        if (
            typeof header === "string" &&
            this.readyState > this.OPENED &&
            this._response.headers[header.toLowerCase()] &&
            !this._errorFlag
        ) {
            return this._response.headers[header.toLowerCase()];
        }
        return null;
    }

    /**
     * Gets all the response headers.
     *
     * @return string A string with all response headers separated by CR+LF
     */
    getAllResponseHeaders() {
        if (this.readyState < this.HEADERS_RECEIVED || this._errorFlag) {
            return "";
        }
        let result = "";

        for (let i in this._response.headers) {
            // Cookie headers are excluded
            if (i !== "set-cookie" && i !== "set-cookie2") {
                result += `${i}: ${this._response.headers[i]}\r\n`;
            }
        }
        return result.slice(0, -2);
    }

    /**
     * Gets a request header
     *
     * @param string name Name of header to get
     * @return string Returns the request header or empty string if not set
     */
    getRequestHeader(name: string) {
        // @TODO Make this case insensitive
        if (typeof name === "string" && this._headers[name]) {
            return this._headers[name];
        }

        return "";
    }

    /**
     * Sends the request to the server.
     *
     * @param string data Optional data to send as request body.
     */
    send(data?: string | Buffer | null) {
        if (this.readyState !== this.OPENED) {
            throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
        }

        if (this._sendFlag) {
            throw new Error("INVALID_STATE_ERR: send has already been called");
        }

        let ssl = false,
            local = false;
        const url = Url.parse(this._settings.url);
        let host;
        // Determine the server
        switch (url.protocol) {
            case "https:":
                ssl = true;
                host = url.hostname;
                break;

            case "http:":
                host = url.hostname;
                break;

            case "file:":
                local = true;
                break;

            case undefined:
            case "":
                host = "localhost";
                break;

            default:
                throw new Error("Protocol not supported.");
        }

        // Load files off the local filesystem (file://)
        if (local) {
            if (this._settings.method !== "GET") {
                throw new Error("XMLHttpRequest: Only GET method is supported");
            }
            if (!url.pathname) {
                throw new Error("XMLHttpRequest: An invalid or illegal path was specified");
            }
            if (this._settings.async) {
                fs.readFile(decodeURI(url.pathname), (error, data) => {
                    if (error) {
                        this.handleError(error, error.errno || -1);
                    } else {
                        this.status = 200;
                        this.responseText = data.toString("utf8");
                        this.response = data as Buffer<ArrayBuffer>;
                        this.setState(this.DONE);
                    }
                });
            } else {
                try {
                    this.response = fs.readFileSync(decodeURI(url.pathname)) as Buffer<ArrayBuffer>;
                    this.responseText = this.response.toString("utf8");
                    this.status = 200;
                    this.setState(this.DONE);
                } catch (e: any) {
                    this.handleError(e, e.errno || -1);
                }
            }

            return;
        }

        // Default to port 80. If accessing localhost on another port be sure
        // to use http://localhost:port/path
        const port = url.port || (ssl ? 443 : 80);
        // Add query string if one is used
        const uri = `${url.pathname}${url.search ?? ""}`;

        // Set the Host header or the server may reject the request
        this._headers["Host"] = host;
        if (!((ssl && port === 443) || port === 80)) {
            this._headers["Host"] += `:${url.port}`;
        }

        // Set Basic Auth if necessary
        if (this._settings.user) {
            let authBuf = Buffer.from(`${this._settings.user}:${this._settings.password ?? ""}`);
            this._headers["Authorization"] = "Basic " + authBuf.toString("base64");
        }

        // Set content length header
        if (this._settings.method === "GET" || this._settings.method === "HEAD") {
            data = null;
        } else if (data) {
            this._headers["Content-Length"] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

            if (!this._headers["Content-Type"]) {
                this._headers["Content-Type"] = "text/plain;charset=UTF-8";
            }
        } else if (this._settings.method === "POST") {
            // For a post with no data set Content-Length: 0.
            // This is required by buggy servers that don't meet the specs.
            this._headers["Content-Length"] = 0;
        }

        const agent = this._opts.agent || false;
        const options: any = {
            host: host,
            port: port,
            path: uri,
            method: this._settings.method,
            headers: this._headers,
            agent: agent,
        };

        if (ssl) {
            options.pfx = this._opts.pfx;
            options.key = this._opts.key;
            options.passphrase = this._opts.passphrase;
            options.cert = this._opts.cert;
            options.ca = this._opts.ca;
            options.ciphers = this._opts.ciphers;
            options.rejectUnauthorized = this._opts.rejectUnauthorized === false ? false : true;
        }

        // Reset error flag
        this._errorFlag = false;
        // Handle async requests
        if (this._settings.async) {
            // Use the proper protocol
            const doRequest = ssl ? https.request : http.request;

            // Request is being sent, set send flag
            this._sendFlag = true;

            // As per spec, this is called here for historical reasons.
            this.dispatchEvent("readystatechange");

            // Handler for the response
            const responseHandler = (resp: any) => {
                // Set response property to the response we got back
                // This is so it remains accessible outside this scope
                this._response = resp;
                // Check for redirect
                // @TODO Prevent looped redirects
                if (
                    this._response.statusCode === 302 ||
                    this._response.statusCode === 303 ||
                    this._response.statusCode === 307
                ) {
                    // Change URL to the redirect location
                    this._settings.url = this._response.headers.location;
                    const url = Url.parse(this._settings.url);
                    // Set host variable in case it's used later
                    host = url.hostname;
                    // Options for the new request
                    let newOptions: any = {
                        hostname: url.hostname,
                        port: url.port,
                        path: url.path,
                        method: this._response.statusCode === 303 ? "GET" : this._settings.method,
                        headers: this._headers,
                    };

                    if (ssl) {
                        newOptions.pfx = this._opts.pfx;
                        newOptions.key = this._opts.key;
                        newOptions.passphrase = this._opts.passphrase;
                        newOptions.cert = this._opts.cert;
                        newOptions.ca = this._opts.ca;
                        newOptions.ciphers = this._opts.ciphers;
                        newOptions.rejectUnauthorized = this._opts.rejectUnauthorized === false ? false : true;
                    }

                    // Issue the new request
                    this._request = doRequest(newOptions, responseHandler).on("error", errorHandler);
                    this._request.end();
                    // @TODO Check if an XHR event needs to be fired here
                    return;
                }

                this.setState(this.HEADERS_RECEIVED);
                this.status = this._response.statusCode;

                this._response.on("data", (chunk: any) => {
                    // Make sure there's some data
                    if (chunk) {
                        const data = Buffer.from(chunk);
                        this._response = Buffer.concat([this.response, data]);
                    }
                    // Don't emit state changes if the connection has been aborted.
                    if (this._sendFlag) {
                        this.setState(this.LOADING);
                    }
                });

                this._response.on("end", () => {
                    if (this._sendFlag) {
                        // The sendFlag needs to be set before setState is called.  Otherwise if we are chaining callbacks
                        // there can be a timing issue (the callback is called and a new call is made before the flag is reset).
                        this._sendFlag = false;
                        // Discard the 'end' event if the connection has been aborted
                        this.setState(this.DONE);
                        // Construct responseText from response
                        this.responseText = this._response.toString("utf8");
                    }
                });

                this._response.on("error", (error: Error) => {
                    this.handleError(error);
                });
            };

            // Error handler for the request
            const errorHandler = (error: Error) => {
                this.handleError(error);
            };

            // Create the request
            this._request = doRequest(options, responseHandler).on("error", errorHandler);

            if (this._opts.autoUnref) {
                this._request.on("socket", (socket: any) => {
                    socket.unref();
                });
            }

            // Node 0.4 and later won't accept empty data. Make sure it's needed.
            if (data) {
                this._request.write(data);
            }

            this._request.end();

            this.dispatchEvent("loadstart");
        } else {
            // Synchronous
            // Create a temporary file for communication with the other Node process
            const contentFile = `.node-xhr-content-${crypto.randomUUID()}`;
            const syncFile = `.node-xhr-sync-${crypto.randomUUID()}`;
            fs.writeFileSync(syncFile, "", "utf8");
            // The async request the other Node process executes
            const execString =
                "const http = require('http'), https = require('https'), fs = require('fs');" +
                "const doRequest = http" +
                (ssl ? "s" : "") +
                ".request;" +
                "const options = " +
                JSON.stringify(options) +
                ";" +
                "let responseText = '';" +
                "let responseData = Buffer.alloc(0);" +
                "let req = doRequest(options, function(response) {" +
                "response.on('data', function(chunk) {" +
                "  const data = Buffer.from(chunk);" +
                "  responseText += data.toString('utf8');" +
                "  responseData = Buffer.concat([responseData, data]);" +
                "});" +
                "response.on('end', function() {" +
                "fs.writeFileSync('" +
                contentFile +
                "', JSON.stringify({err: null, data: {statusCode: response.statusCode, headers: response.headers, text: responseText, data: responseData.toString('base64')}}), 'utf8');" +
                "fs.unlinkSync('" +
                syncFile +
                "');" +
                "});" +
                "response.on('error', function(error) {" +
                "fs.writeFileSync('" +
                contentFile +
                "', 'NODE-XMLHTTPREQUEST-ERROR:' + JSON.stringify(error), 'utf8');" +
                "fs.unlinkSync('" +
                syncFile +
                "');" +
                "});" +
                "}).on('error', function(error) {" +
                "fs.writeFileSync('" +
                contentFile +
                "', 'NODE-XMLHTTPREQUEST-ERROR:' + JSON.stringify(error), 'utf8');" +
                "fs.unlinkSync('" +
                syncFile +
                "');" +
                "});" +
                (data ? "req.write('" + JSON.stringify(data).slice(1, -1).replace(/'/g, "\\'") + "');" : "") +
                "req.end();";
            // Start the other Node Process, executing this string
            const syncProc = spawn(process.argv[0], ["-e", execString]);
            while (fs.existsSync(syncFile)) {
                // Wait while the sync file is empty
            }
            this.responseText = fs.readFileSync(contentFile, "utf8");
            // Kill the child process once the file has data
            syncProc.stdin.end();
            // Remove the temporary file
            fs.unlinkSync(contentFile);
            if (/^NODE-XMLHTTPREQUEST-ERROR:/.exec(this.responseText)) {
                // If the file returned an error, handle it
                const errorObj = JSON.parse(this.responseText.replace(/^NODE-XMLHTTPREQUEST-ERROR:/, ""));
                this.handleError(errorObj, 503);
            } else {
                // If the file returned okay, parse its data and move to the DONE state
                const resp = JSON.parse(this.responseText.replace(/^NODE-XMLHTTPREQUEST-STATUS:[0-9]*,(.*)/, "$1"));
                this.status = resp.data.statusCode;
                this._response = {
                    statusCode: this.status,
                    headers: resp.data.headers,
                };
                this.responseText = resp.data.text;
                this.response = Buffer.from(resp.data.data, "base64");
                this.setState(this.DONE);
            }
        }
    }

    /**
     * Called when an error is encountered to deal with it.
     * @param  status  {number}    HTTP status code to use rather than the default (0) for XHR errors.
     */
    handleError(error: any, status?: number) {
        this.status = status ?? 0;
        this.statusText = typeof error === "string" ? error : error.message ?? error.code ?? "";
        this.responseText = error.stack ?? "";
        this._errorFlag = true;
        this.setState(this.DONE);
    }

    /**
     * Aborts a request.
     */
    abort() {
        if (this._request) {
            this._request.abort();
            this._request = null;
        }

        this._headers = { ...defaultHeaders };
        this.responseText = "";
        this.responseXML = "";
        this.response = Buffer.alloc(0);

        this._errorFlag = this._abortedFlag = true;
        if (
            this.readyState !== this.UNSENT &&
            (this.readyState !== this.OPENED || this._sendFlag) &&
            this.readyState !== this.DONE
        ) {
            this._sendFlag = false;
            this.setState(this.DONE);
        }
        this.readyState = this.UNSENT;
    }

    /**
     * Adds an event listener. Preferred method of binding to events.
     */
    addEventListener(event: string, callback: Function) {
        if (!(event in this._listeners)) {
            this._listeners[event] = [];
        }
        // Currently allows duplicate callbacks. Should it?
        this._listeners[event].push(callback);
    }

    /**
     * Remove an event callback that has already been bound.
     * Only works on the matching funciton, cannot be a copy.
     */
    removeEventListener(event: string, callback: Function) {
        if (event in this._listeners) {
            // Filter will return a new array with the callback removed
            this._listeners[event] = this._listeners[event].filter((ev: Function) => {
                return ev !== callback;
            });
        }
    }

    /**
     * Dispatch any events attached using addEventListener.
     */
    dispatchEvent(event: string) {
        if (event in this._listeners) {
            for (let i = 0, len = this._listeners[event].length; i < len; i++) {
                if (this.readyState === this.DONE && this._settings.async) {
                    setTimeout(() => {
                        this._listeners[event][i].call(this);
                    }, 0);
                } else {
                    this._listeners[event][i].call(this);
                }
            }
        }
    }

    /**
     * Changes readyState and calls onreadystatechange.
     *
     * @param int state New state
     */
    setState(state: number) {
        if (this.readyState === state || (this.readyState === this.UNSENT && this._abortedFlag)) {
            return;
        }

        this.readyState = state;

        if (this._settings.async || this.readyState < this.OPENED || this.readyState === this.DONE) {
            this.dispatchEvent("readystatechange");
        }

        if (this.readyState === this.DONE) {
            let fire;

            if (this._abortedFlag) fire = "abort";
            else if (this._errorFlag) fire = "error";
            else fire = "load";

            this.dispatchEvent(fire);

            // @TODO figure out InspectorInstrumentation::didLoadXHR(cookie)
            this.dispatchEvent("loadend");
        }
    }
}
