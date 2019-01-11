sub Main()
    m.houseAge = "newish"

    carpenter = createCarpenter()
    if carpenter.name = "Norm Abrams" setHouseAge()
    carpenter.work()

    print "carpenter.safetyGlassesOn = " carpenter.safetyGlassesOn
    print "m.houseAge = " m.houseAge
end sub

function createCarpenter()
    return {
        name: "Norm Abrams",
        safetyGlassesOn: false
        work: __work
    }
end function

sub __work()
    ' always remember to wear these, safety glasses
    m.safetyGlassesOn = true
end sub

sub setHouseAge()
    m.houseAge = "old"
end sub
