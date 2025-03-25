sub Main()
  m.someValue = "root"
  objA = {myMethod: do_something, someValue: "not root"}
  print objA.myMethod()
  anon_func_context()
end sub

function do_something()
  print m.someValue
  return GenericFunction()
end function

function GenericFunction()
  return m.someValue 'Must use Global m
end function

function anon_func_context()
  a = {
    foo: "bar",
    printM: sub()
      print(m.foo)
    end sub
  }
  a.printM()
  a["printM"]()
  x = a["printM"]
  x()
  ' Other test
  logger = createLogger()
  for x = 1 to 3
    logger.log()
  next
end function

function createLogger()
  this = {}
  this.counter = 0
  this.method = "getText"
  this.getText = GET_TEXT
  this.log = LOG_MSG
  return this
end function

function GET_TEXT()
  if m.counter <> invalid
    return "Test Succeeded! " + m.counter.toStr()
  end if
  return "Test Failed!"
end function

sub LOG_MSG()
  m.counter++
  print "Log: "; m.method; " = "; m[m.method]()
end sub