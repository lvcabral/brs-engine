sub main()
    print getInterface(1.123, "ifFloat")
    print getInterface({}, "ifAssociativeArray");
    print getInterface(1, "ifToStr");
    print findMemberFunction({}, "count")
    print FindMemberFunction("", "left")
    print GetInterface("", "ifStringOps")
    print FindMemberFunction(1, "tostr")
    print GetInterface(1, "iftostr")
    print Type(RunGarbageCollector());
end sub