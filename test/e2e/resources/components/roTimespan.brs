sub main()
    ts = createObject("roTimespan")

    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10T05:47:52Z")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10T05:47:52")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10T05:47")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10T05")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10T")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11-10")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030-11")
    print "can return seconds from date until now: " ts.getsecondstoiso8601date("2030")
    print "can return 2077252342 for date that can't be parsed: " ts.getsecondstoiso8601date("14 Jun 2017 00:00:00 PDT")
end sub
