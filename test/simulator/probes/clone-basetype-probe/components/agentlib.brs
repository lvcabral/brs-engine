sub init()
    m.token = "init-default"
end sub

sub configure(token as String)
    m.token = token
end sub

function readToken() as String
    if m.token = invalid then return "UNSET"
    return m.token
end function
