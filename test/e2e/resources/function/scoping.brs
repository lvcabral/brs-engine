sub Main()
    functionScoped = "I'm function scoped"

    _ = (sub()
        print "Global: " type(RebootSystem) <> "<UNINITIALIZED>"
        print "Module: " type(ModuleDefined) <> "<UNINITIALIZED>"
        print "Function: " type(functionScoped) <> "<UNINITIALIZED>"
    end sub)()
end sub

sub ModuleDefined()
    ' just needs to exist
end sub
