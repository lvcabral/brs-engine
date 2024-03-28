sub main()
	response = fetch({url: "https://www.boredapi.com/api/activity"})
	if response.ok
		json = response.json()
		?"The response was: "; json
	end if
end sub


' options: {
'     url:     [req] string - http or https url
'     timeout: [opt] int - ms to wait before timeout (defaults to 0 (no timeout))
'     headers: [opt] assocarray - list of request headers where key=headername and val=headervalue
'     method:  [opt] string - the HTTP method. GET|POST|PUT|DELETE|etc (defaults to GET)
'                if you are doing a normal GET or POST, you can omit this - it is only useful for the other verbs
'     body:    [opt] string - the preformatted request body (ie: form data). 
'                if specified, the request method will default to POST unless overridden with options.method
' }
'
' returns Response object: {
'    status:  int - the HTTP status code (ex: 200); can be negative to indicate transport error
'    ok:      bool - true if the response is successful (200-299)
'    headers: assocarray - where each header name is a key and the value is an object
'    text():  string - function that returns the raw string response
'    json():  object - function that returns the response parsed as JSON
'    xml():   object - function that returns the response parsed as an roXmlElement
' }
'
function fetch(options)
    timeout = options.timeout
    if timeout = invalid then timeout = 0

    response = invalid
    port = CreateObject("roMessagePort")
    request = CreateObject("roUrlTransfer")
    request.SetCertificatesFile("common:/certs/ca-bundle.crt")
    request.InitClientCertificates()
    request.RetainBodyOnError(true)
    request.SetMessagePort(port)
    if options.headers <> invalid
        for each header in options.headers
            val = options.headers[header]
            if val <> invalid then request.addHeader(header, val)
        end for
    end if
    if options.method <> invalid
        request.setRequest(options.method)
    end if
    request.SetUrl(options.url)

    requestSent = invalid
    if options.body <> invalid
        requestSent = request.AsyncPostFromString(options.body)
    else
        requestSent = request.AsyncGetToString()
    end if
    if (requestSent)
        msg = wait(timeout, port)
        status = -999
        body = "(TIMEOUT)"
        headers = {}
        if (type(msg) = "roUrlEvent")
			xx = msg.getString()
			print msg
			print msg = xx
			print msg > xx
			print msg < xx
			print msg >= xx
			print msg <= xx
            print msg <> xx
			print "prefix -> " + msg
            print msg + " <- suffix"
            print "getInt: "; msg.getInt()
			print FindMemberFunction(msg, "getInt")
			print FindMemberFunction(msg, "getString")
            status = msg.GetResponseCode()
            headersArray = msg.GetResponseHeadersArray()
            for each headerObj in headersArray
                for each headerName in headerObj
                    val = {
                        value: headerObj[headerName]
                        next: invalid
                    }
                    current = headers[headerName]
                    if current <> invalid
                        prev = current
                        while current <> invalid
                            prev = current
                            current = current.next
                        end while
                        prev.next = val
                    else
                        headers[headerName] = val
                    end if
                end for
            end for
            body = msg.GetString()
            if status < 0 then body = msg.GetFailureReason()
        end if

        response = {
            _body: body,
            status: status,
            ok: (status >= 200 AND status < 300),
            headers: headers,
            text: function()
                return m._body
            end function,
            json: function()
                return ParseJSON(m._body)
            end function,
            xml: function()
                if m._body = invalid then return invalid
                xml = CreateObject("roXMLElement") '
                if NOT xml.Parse(m._body) then return invalid
                return xml
            end function
        }
    end if

    return response
end function