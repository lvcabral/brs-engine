sub main()
    mem = createObject("roAppMemoryMonitor")
    print mem.getChannelAvailableMemory() > 0
    pct = mem.getMemoryLimitPercent()
    print  pct >= 0 and pct <= 100
    limits = mem.getChannelMemoryLimit()
    print limits.maxRokuManagedHeapMemory > 0
end sub