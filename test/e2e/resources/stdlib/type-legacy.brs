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
end sub