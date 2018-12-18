sub Main()
    functionScoped = "I'm function scoped"

    _ = (sub()
        print "Global: " RebootSystem <> "<UNINITIALIZED>"
        print "Module: " ModuleDefined <> "<UNINITIALIZED>"
        print "Function: " functionScoped <> "<UNINITIALIZED>"
    end sub)()
end sub

sub ModuleDefined()
    ' just needs to exist
end sub
