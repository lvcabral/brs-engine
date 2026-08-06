' AA / ParseJson Order Probe.
'
' Question: does `for each key in anAssociativeArray` (and `Keys()`) enumerate in declaration/
' insertion order on a real Roku, for (a) an AA literal and (b) an AA produced by ParseJson? And
' does the answer change once the AA has "enough" keys (folklore: large AAs switch to a hash-based
' internal representation)?
'
' Triggered by: a real "movies"/"series" ContentHandler app (SGDEX sample) where brs-engine's
' `for each item in json` walks a ParseJson'd AA in declared order ("movies" before "series", since
' that is how the source feed.json declares them) but a real device reportedly showed the opposite
' ("series" then "movies") for the exact same 2-key slice of a larger JSON object. brs-engine's own
' `for each`/`Keys()` do NOT even agree with each other today (compare PROBE|small-lit|foreach vs
' PROBE|small-lit|keys below) — `RoAssociativeArray.getElements()` (used by `Keys()`/`Items()`)
' sorts lexicographically, while `getNext()` (used by `for each`) walks the backing `Map` in
' insertion order. Whether a real device's `for each` and `Keys()` also diverge, and whether either
' matches insertion order, alphabetical order, or something else (a hash-bucket order that only
' shows up once the AA is "large"), is exactly what this probe measures.
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:  brs-cli test/simulator/probes/aa-json-order-probe
'
' Trace format: PROBE|<case>|<method>|<comma-separated key order>

sub Main()
    print "PROBE|000|boot|start"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    ' --- Small case (4 keys): declared order d, a, c, b ---
    ' Chosen so forward-insertion, reverse-insertion, alphabetical, and reverse-alphabetical all
    ' predict four DIFFERENT full sequences:
    '   forward-insertion:    d, a, c, b
    '   reverse-insertion:    b, c, a, d
    '   alphabetical:         a, b, c, d
    '   reverse-alphabetical: d, c, b, a
    smallKeys = ["d", "a", "c", "b"]
    smallLit = { d: "d", a: "a", c: "c", b: "b" }
    RunCase("small-lit", smallLit)

    smallJson = ParseJson(BuildJsonObject(smallKeys))
    RunCase("small-json", smallJson)

    ' --- Large case (20 keys, letters a-t): a scrambled declaration order, distinct from both
    ' alphabetical and reverse-alphabetical, to expose whether a bigger AA switches to a
    ' hash-bucket-like order (the well-known "large AA" folklore) instead of insertion order.
    largeKeys = ["m", "b", "t", "f", "q", "a", "k", "s", "c", "p", "g", "n", "d", "r", "h", "e", "j", "o", "i", "l"]
    largeLit = {
        m: "m", b: "b", t: "t", f: "f", q: "q", a: "a", k: "k", s: "s", c: "c", p: "p"
        g: "g", n: "n", d: "d", r: "r", h: "h", e: "e", j: "j", o: "o", i: "i", l: "l"
    }
    RunCase("large-lit", largeLit)

    largeJson = ParseJson(BuildJsonObject(largeKeys))
    RunCase("large-json", largeJson)

    print "PROBE|999|boot|end"
end sub

' Builds a JSON object string `{"k0":"k0","k1":"k1",...}` from an array of key names, each key
' reused as its own value, in the exact array order (avoids the readability trap of manually
' hand-doubling quote characters in a BrightScript string literal).
function BuildJsonObject(keys as Object) as String
    q = Chr(34)
    result = "{"
    for i = 0 to keys.Count() - 1
        if i > 0 then result = result + ","
        result = result + q + keys[i] + q + ":" + q + keys[i] + q
    end for
    result = result + "}"
    return result
end function

sub RunCase(label as String, aa as Object)
    foreachOrder = ""
    for each key in aa
        if foreachOrder <> "" then foreachOrder = foreachOrder + ","
        foreachOrder = foreachOrder + key
    end for
    print "PROBE|" + label + "|foreach|" + foreachOrder

    keysOrder = ""
    for each key in aa.Keys()
        if keysOrder <> "" then keysOrder = keysOrder + ","
        keysOrder = keysOrder + key
    end for
    print "PROBE|" + label + "|keys|" + keysOrder
end sub
