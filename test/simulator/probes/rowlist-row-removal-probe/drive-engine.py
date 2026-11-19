#!/usr/bin/env python3
"""Runs the probe on the engine CLI (after `npm run build:cli`) under a pty and answers its await lines:
a key name is typed as that remote key, "shot" saves a Ctrl+S snapshot as engine-<name>.png (not committed).
Writes engine-trace.txt."""
import os, pty, re, select, shutil, sys, time

here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.abspath(os.path.join(here, "../../../.."))
out = here
os.makedirs(out, exist_ok=True)
snap = os.path.join(out, "engine-current.png")
keys = {"Down": b"\x1b[B", "Up": b"\x1b[A", "Left": b"\x1b[D", "Right": b"\x1b[C", "Select": b"\r"}

pid, fd = pty.fork()
if pid == 0:
    os.execvp("node", ["node", os.path.join(repo, "packages/node/bin/brs.cli.js"), "--root", here, "--snapshot", snap])

buf = b""
handled = set()
deadline = time.time() + 180
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 0.1)
    if r:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        buf += data
    text = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", buf.decode("utf-8", "replace")).replace("\r", "")
    for m in re.finditer(r"PROBE\|(\d+)\|await\|(\w+)\|[^\n]*?(?:name=(\S+))?\n", text):
        seq, what, name = m.group(1), m.group(2), m.group(3)
        if seq in handled:
            continue
        handled.add(seq)
        if what == "shot":
            if os.path.exists(snap):
                os.remove(snap)
            os.write(fd, b"\x13")
            for _ in range(30):
                time.sleep(0.1)
                if os.path.exists(snap):
                    break
            if os.path.exists(snap):
                shutil.move(snap, os.path.join(out, "engine-%s.png" % name))
        else:
            os.write(fd, keys[what])
    if re.search(r"PROBE\|\d+\|done\|", text):
        time.sleep(1)
        break
os.write(fd, b"\x04")
time.sleep(1)
try:
    os.kill(pid, 9)
except OSError:
    pass
lines = [l for l in text.split("\n") if l.startswith("PROBE|")]
with open(os.path.join(out, "engine-trace.txt"), "w") as f:
    f.write("\n".join(lines) + "\n")
print("Wrote engine-trace.txt (%d lines)" % len(lines))
