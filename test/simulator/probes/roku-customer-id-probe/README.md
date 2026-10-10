# Roku Customer ID Probe

Captures what a real Roku (OS 16.0+) returns for the `ChannelStore` node's **`GetRokuCustomerId`**
command, sent through the generic request framework (`request` → `requestStatus`), so brs-engine's
mock can match it.

## What it measures

Sends these requests one at a time (each waits for its `requestStatus`, or a 10s timeout):

| Case | Question it answers |
| --- | --- |
| `basic` | Exact `requestStatus` keys/types, `statusMessage` text, and the `rokuCustomerId` format |
| `with context` | Is `context` echoed back as-is (including a numeric member)? |
| `lowercase command` / `padded command` | Is the command matched case-insensitively / trimmed? What does `command` echo? |
| `repeat (stable?)` | Is the id stable across calls? (summary line `all ids identical`) |
| `unknown command` / `missing command` / `non-string command` | Status code and message for invalid requests, and whether a reply arrives at all |

For every received id the probe reports type, length, and whether it is 32-digit hex (lower/any
case), a dashed UUID, digits only, or contains uppercase.

## Device results (Roku 3941X, OS 16.0.4 build 834)

`device-trace.txt` (customer id and client id redacted, shape preserved). The engine now matches it:

- `rokucustomerid` is a **32-digit lowercase hex** string, stable across calls.
- Every `requestStatus` has the same six **lowercase** keys, always present: `result`, `command`,
  `status`, `context`, `statusmessage`, `requestid`.
- `requestid` is an integer counting requests, starting at 0.
- The command must match **exactly**: `getrokucustomerid` and `" GetRokuCustomerId "` both fail.
- Failure is `status: -4`, `statusmessage: "Invalid request"`, with an **empty** `result` AA.
- `command` echoes the request's string as-is, or `""` when it is missing or not a string.
- `context` is echoed when the command is a string (even an unknown one), otherwise it is an empty
  AA, even if one was sent (`missing command` case).

The only remaining trace difference is the `for each` order of the app's own `context` AA
(`n, id` on the device), the general AA-ordering question covered by `aa-json-order-probe`.

## Running

Side-load the folder (zip it, excluding nothing but build artifacts) on a Roku with OS 16.0+, then
watch the BrightScript console (`telnet <roku-ip> 8085`) and filter lines prefixed `[probe]`.
Save the device output as `device-trace.txt` next to this README. To compare, run on the engine:

```bash
brs-cli --root test/simulator/probes/roku-customer-id-probe
```

`engine-trace.txt` is the brs-engine baseline (default `customerId`).

> **Why the next request is sent from a timer:** the engine completes a request synchronously, so a
> request sent from inside the `requestStatus` observer has its reply written while that field is
> still notifying, and the engine's per-field re-entrancy guard drops the nested notification. On a
> device the reply arrives later, so chaining from the observer should work there. The `basic` case
> sends from `init()`, and every later one from the `gap` timer, to keep both runs comparable.

> The customer id is account data — redact it before committing a device trace if needed (keep its
> length and character classes intact).
