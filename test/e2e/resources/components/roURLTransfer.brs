sub main()
    ' TEST Sync GET
    url = "https://raw.githubusercontent.com/lvcabral/brs-engine/refs/heads/master/package.json"
    file="tmp:/tmp.json"
    http = CreateObject("roUrlTransfer")
    http.SetCertificatesFile("common:/certs/ca-bundle.crt")
    http.InitClientCertificates()
    http.RetainBodyOnError(true)
    http.AddHeader("Content-Type", "application/json")
    http.EnableEncodings(true)
    http.EnablePeerVerification(false)
    http.SetUrl(url)
    ret = http.GetToFile(file)
    if ret <> 200
        print "File not cached! http return code: "; ret
        tmpFile = ""
    end if
    json = ParseJson(ReadAsciiFile(file))
    print json.description
    print "Repository: "; json.repository.url
    print "Website:    "; json.homepage
    ' Test Async POST
    port = CreateObject("roMessagePort")
    http.SetMessagePort(port)
    api = {
        url: "https://reqres.in/api/users",
        body: {name: "Employee", job: "SW Engineer"}
    }
    http.AddHeader("x-api-key", "reqres-free-v1")
    body = FormatJson(api.body)
    timeout = 3000
    http.SetUrl(api.url)
    if http.AsyncPostFromString(body)
        msg = wait(timeout, port)
        if type(msg) = "roUrlEvent"
            print "The status was: "; msg.GetResponseCode()
            print "The target IP was: "; isValidIP(msg.GetTargetIPAddress())
            status = msg.GetResponseCode()
            if  status >= 200 and status < 300
                response = ParseJson(msg.GetString())
                print "The response was: "; response.name; " is "; response.job
            else
                print "The failure reason was: "; msg.GetFailureReason()
            end if
        end if
    end if
end sub

function isValidIP(ip as String) as String
    ' Regular expression pattern for a valid IPv4 address
    ipPattern = "^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
    ' Create a regex object
    regex = CreateObject("roRegex", ipPattern, "")
    ' Check if the IP matches the pattern
    if regex.IsMatch(ip)
        return "Valid"
    else
        return "Invalid"
    end if
end function
