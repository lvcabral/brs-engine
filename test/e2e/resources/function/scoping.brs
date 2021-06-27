sub Main()
    functionScoped = "I'm function scoped"

    _ = (sub()
        print "Global: " type(RebootSystem) <> "<uninitialized>"
        print "Module: " type(ModuleDefined) <> "<uninitialized>"
        print "Function: " type(functionScoped) <> "<uninitialized>"
    end sub)()
end sub

sub ModuleDefined()
    ' just needs to exist
end sub
