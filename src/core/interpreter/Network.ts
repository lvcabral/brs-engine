/// #if !BROWSER
import { XMLHttpRequest } from "../polyfill/XMLHttpRequest";
/// #endif

/**
 * Download helper function
 * @param url url of the file to be downloaded
 * @param type return type (eg. arraybuffer)
 */
export function download(
    url: string,
    type: XMLHttpRequestResponseType,
    customHeaders?: Map<string, string>,
    cookiesEnabled?: boolean
): any {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Note: synchronous
        xhr.responseType = type;
        customHeaders?.forEach((value: string, key: string) => {
            xhr.setRequestHeader(key, value);
        });
        if (cookiesEnabled !== undefined) {
            xhr.withCredentials = cookiesEnabled;
        }
        xhr.send();
        if (xhr.status !== 200) {
            postMessage(`error,HTTP Error downloading ${url}: ${xhr.statusText}`);
            return undefined;
        }
        return xhr.response;
    } catch (err: any) {
        postMessage(`error,Error downloading ${url}: ${err.message}`);
    }
    return undefined;
}

/**
 * Function to get the external IP address
 * @returns ip address or empty string
 */

export function getExternalIp(): string {
    const url = "https://api.ipify.org";
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Note: synchronous
        xhr.responseType = "text";
        xhr.send();
        if (xhr.status !== 200) {
            throw new Error(`[getExternalIp] Error getting ${url}: status ${xhr.status} - ${xhr.statusText}`);
        }
        const ip = xhr.responseText;
        return isValidIP(ip) ? ip : "";
    } catch (err: any) {
        throw new Error(`[getExternalIp] Error getting ${url}: ${err.message}`);
    }
}

/**
 * Function to DNS resolve a hostname to an IP address
 * @param host the hostname to resolve
 * @returns the resolved IP address or null if not found
 */
const DNSCache = new Map<string, string>();
export function resolveHostToIP(host: string): string | null {
    if (!isValidHostname(host)) {
        return null;
    }
    if (DNSCache.has(host)) {
        return DNSCache.get(host) as string;
    }
    const servers = ["https://dns.google/resolve", "https://cloudflare-dns.com/dns-query"];
    const errors: string[] = [];
    for (const server of servers) {
        const url = `${server}?name=${host}&type=A`;
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Synchronous request
        xhr.setRequestHeader("Accept", "application/dns-json");
        try {
            xhr.send();
            if (xhr.status !== 200) {
                return null;
            }
            const response = JSON.parse(xhr.responseText);
            if (response.Answer && response.Answer.length > 0) {
                const answer = response.Answer.find((ans: any) => ans.type === 1); // Type 1 is A record
                if (answer && isValidIP(answer.data)) {
                    DNSCache.set(host, answer.data);
                    return answer.data;
                }
            }
        } catch (err: any) {
            errors.push(`[resolveHostToIP] Error resolving ${host} from ${server}: ${err.message}`);
        }
    }
    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
    return null;
}

/**
 * Function to evaluate if a string is a valid IP address
 * @param ip the string to evaluate
 * @returns true if the string is a valid IP address or false otherwise
 */
export function isValidIP(ip: string): boolean {
    if (!ip) {
        return false;
    }
    const parts = ip.split(".");
    return (
        parts.length === 4 &&
        parts.every((part) => {
            const num = Number(part);
            return !isNaN(num) && num >= 0 && num <= 255;
        })
    );
}

/**
 * Function to validate a DNS hostname
 * @param hostname the hostname to validate
 * @returns true if the hostname is valid or false otherwise
 */
export function isValidHostname(hostname: string): boolean {
    if (hostname.length > 253) {
        return false;
    }
    const labels = hostname.split(".");
    const labelRegex = /^[a-zA-Z0-9-]{1,63}$/;
    for (const label of labels) {
        if (label.length > 63 || label.length === 0) {
            return false;
        }
        if (!labelRegex.test(label) || label.startsWith("-") || label.endsWith("-")) {
            return false;
        }
    }
    return true;
}

/**
 * Function to get the host from a URL
 * @param url the URL to parse
 * @returns the host or an empty string if the URL is invalid
 */
export function getHost(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.host;
    } catch (err: any) {
        return "";
    }
}
