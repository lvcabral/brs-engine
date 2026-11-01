' Captures, \N replacements, back references and Split when a pattern is rewritten with extra capture
' groups (possessive quantifiers and atomic groups).
sub main()
    r = CreateObject("roRegex", "(a)a++(c)", "")
    m = r.Match("aaac")
    print "match: " + m[0] + "|" + m[1] + "|" + m[2] + "|" + m.Count().toStr()
    print "matchAll: " + r.MatchAll("aaac aaac").Count().toStr()
    print "replace: " + r.ReplaceAll("aaac", "[\2][\1]")
    print "replace1: " + r.Replace("aaac", "[\2][\1]")
    b = CreateObject("roRegex", "(x)(?>y+)\1", "")
    print "backref: " + b.IsMatch("xyyx").toStr() + " " + b.IsMatch("xyyy").toStr()
    parts = CreateObject("roRegex", "(?>,+)", "").Split("a,,b,c")
    print "split: " + parts.GetEntry(0) + "|" + parts.GetEntry(1) + "|" + parts.GetEntry(2) + "|" + parts.Count().toStr()
    parts = CreateObject("roRegex", "(,)++", "").Split("a,,b")
    print "splitGroup: " + parts.GetEntry(0) + "|" + parts.GetEntry(1) + "|" + parts.GetEntry(2) + "|" + parts.Count().toStr()
    ' ranges starting with an escape, \- next to \p{..}, unknown POSIX class, ReplaceAll with \N
    print "range: " + CreateObject("roRegex", "^[\x00-\x7F]+$", "").IsMatch("abc").toStr() + " " + CreateObject("roRegex", "^[\x41-\x5a]+$", "").IsMatch("abc").toStr() + " " + CreateObject("roRegex", "^[\t-\r]$", "").IsMatch(Chr(10)).toStr()
    print "unicodeDash: " + CreateObject("roRegex", "^\p{L}\-\p{L}$", "").IsMatch("a-b").toStr()
    print "unknownPosix: " + type(CreateObject("roRegex", "[[:foo:]]", ""))
    print "replaceAll: " + CreateObject("roRegex", "(a)(b)", "").ReplaceAll("abab", "\2\1")
end sub
