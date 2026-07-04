sub main()
    ' Regular Integer
    varInt = 1: ? type(varInt), type(varInt, 3)
    varInt.setInt(3) : ? varInt ' No error but print 1 (no change)
    ' Boxed Integer
    boxInt = CreateObject("roInt"): ? type(boxInt), type(boxInt, 3)
    boxInt.setInt(3) : ? boxInt ' Properly boxed print 3
    ' Integer in Array
    arrInt = [1][0]: ? type(arrInt), type(arrInt, 3)
    arrInt.setInt(3) : ? arrInt ' type lies and say is boxed, but is not
    ' Other types in Array
    float = [.1][0]: ? type(float), type(float, 3)
    double = [1#][0]: ? type(double), type(double, 3)
    long = [1&][0]: ? type(long), type(long, 3)
    string = [""][0]: ? type(string), type(string, 3)
    invalue = [invalid][0]: ? type(invalue), type(invalue, 3)
    boolean = [true][0]: ? type(boolean), type(boolean, 3)
    'Types from Registry
    rs = CreateObject("roRegistrySection", "Transient")
    rs.write("option1", "test")
    value1 = rs.read("option1")
    print "registry", type(value1), type(value1, 3)
    aa = {}
    aa.option1 = value1
    print "aa-reg", type(aa.option1), type(aa.option1, 3)
    print "upper-reg", type(ucase(value1)), type(ucase(value1), 3)
    print "left-reg", type(value1.left(1)), type(value1.left(1), 3)
    'Control
    value2 = "test"
    print "value", type(value2), type(value2, 3)
    print "upper", type(ucase(value2)), type(ucase(value2), 3)
    print "left", type(value2.left(1)), type(value2.left(1), 3)
    aa.option2 = value2
    print "aa-val", type(aa.option2), type(aa.option2, 3)
    print "aa-upper", type(ucase(aa.option2)), type(ucase(aa.option2), 3)
    print "aa-left", type(aa.option2.left(1)), type(aa.option2.left(1), 3)
    aa.option3 = box("test")
    print "aa-box", type(aa.option3), type(aa.option3, 3)
    print "upper-box", type(ucase(aa.option3)), type(ucase(aa.option3), 3)
    print "left-box", type(aa.option3.left(1)), type(aa.option3.left(1), 3)
end sub
