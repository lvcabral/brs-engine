sub main()
    regex = createObject("roRegex", "hello_[0-9]*_world", "i")

    print "HeLlO_123_WoRlD is match of hello_[0-9]*_world: " regex.ismatch("HeLlO_123_WoRlD")
    print "goodbye_123_WoRlD isn't match of hello_[0-9]*_world: " regex.ismatch("HeLlO_123_WoRlD")

    regex = createObject("roRegex", ",", "i")

    print "Replacing ',' in 2019,03,26 by '-' on first occurrence: " regex.replace("2019,03,26", "-")
    print "Replacing ',' in 2019,03,26 by '-' on all occurrences: " regex.replaceall("2019,03,26", "-")
    ' make sure we can call replaceall multiple times without error
    regex.replaceall("2019,03,26", "-")
    parts = regex.split("2019,03,26")
    print "Split by ',': [ " parts[0] " " parts[1] " " parts[2] " ]"

    regex = createObject("roRegex", "\d+", "i")

    matches = regex.match("123 456 789")
    print "First match: [ " matches[0] " ]"

    matches = regex.matchall("123 456 789")
    print "All matches: [ "
    print "[ " matches[0][0] " ]"
    print "[ " matches[1][0] " ]"
    print "[ " matches[2][0] " ]"
    print " ]"

    ' make sure we can call matchall multiple times without error.
    regex.matchall("123 456 789")

    regex = createObject("roRegex", "a(b.)", "i")
    matches = regex.matchall("abx abyz")
    print "Matches with groups: [ "
    print "[ " matches[0][0] ", " matches[0][1] " ]"
    print "[ " matches[1][0] ", " matches[1][1] " ]"
    print " ]"
end sub
