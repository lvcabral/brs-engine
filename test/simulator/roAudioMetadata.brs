Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen", true, 1280, 720)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
	print "App Manifest"
	print ReadAsciiFile("pkg:/manifest")
	Print "Downloading MP3..."
    'https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/songs/main-theme.mp3
    'https://raw.githubusercontent.com/amugofjava/mp3_info/master/test_files/test_128kpbs_441khz_stereo_10s.mp3
    'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-9-24/292843230-44100-2-bf48d8c7c375fb79.mp3
    'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-9-24/292843228-44100-2-28d72575538b0e22.mp3
    'https://ia600800.us.archive.org/28/items/ConversandoMioloDePotePodcastT01E01/Conversando-Miolo-de-Pote-Podcast-T01E01.mp3
	mp3 = CacheFile("https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-9-24/292843228-44100-2-28d72575538b0e22.mp3", "podcast.mp3")
    image = SaveCoverArtFile(mp3)
	if (image <> "")
		bmp = CreateObject("roBitmap", image)
		screen.DrawObject(0,0, scaleBitmap(bmp, 0.5))
		screen.swapbuffers()
	end if
    while true
        key = wait(0, port).getInt()
        if key = 0
            exit while
        else if key = 5
            print "device uptime:";  UpTime(0)
        else
            print key
        end if
    end while
End Sub

function SaveCoverArtFile(filename As String)
    meta = CreateObject("roAudioMetadata")
    meta.SetUrl(filename)
    print "------------- GetTags() -------------------------"
    tags = meta.GetTags()
    print tags
    print "------------- GetAudioProperties() --------------"
    properties = meta.GetAudioProperties()
    print properties
    print "------------- GetCoverArt() ---------------------"
    thumbnail = meta.GetCoverArt()
	print thumbnail
	tmp_img = ""
    if (thumbnail <> invalid)
        if (thumbnail.bytes = invalid)
            return ""
        end if
        imgtype = thumbnail.type
        image_ext=""
        if (imgtype = "image/jpeg" or imgtype = "jpg")
            image_ext = "jpg"
        else if (imgtype = "image/png" or imgtype = "png")
            image_ext = "png"
        else
            image_ext = "jpg"
        end if
        tmp_img = "tmp:/CoverArtImage" + "." + image_ext
        if (tmp_img <> invalid)
            DeleteFile(tmp_img)
        end if
        thumbnail.bytes.Writefile(tmp_img)
    end if
    return tmp_img
end function

function CacheFile(url as string, file as string, overwrite = false as boolean) as string
    tmpFile = "tmp:/" + file
    if overwrite or not m.files.Exists(tmpFile)
        http = CreateObject("roUrlTransfer")
        http.SetCertificatesFile("common:/certs/ca-bundle.crt")
        if LCase(Right(file, 4)) = "json"
            http.AddHeader("Content-Type", "application/json")
        end if
        http.EnableEncodings(true)
        http.EnablePeerVerification(false)
        http.SetUrl(url)
        ret = http.GetToFile(tmpFile)
        if ret <> 200
            print "File not cached! http return code: "; ret
            tmpFile = ""
        end if
    end if
    return tmpFile
end function

function ScaleBitmap(bitmap as object, scale as float, simpleMode = false as boolean)
    if bitmap = invalid then return bitmap
    if scale = 1.0
        scaled = bitmap
    else if scale = int(scale) or simpleMode
        scaled = CreateObject("roBitmap", { width: int(bitmap.GetWidth() * scale), height: int(bitmap.GetHeight() * scale), alphaenable: true })
        scaled.DrawScaledObject(0, 0, scale, scale, bitmap)
    else
        region = CreateObject("roRegion", bitmap, 0, 0, bitmap.GetWidth(), bitmap.GetHeight())
        region.SetScaleMode(1)
        scaled = CreateObject("roBitmap", { width: int(bitmap.GetWidth() * scale), height: int(bitmap.GetHeight() * scale), alphaenable: true })
        scaled.DrawScaledObject(0, 0, scale, scale, region)
        region = invalid
    end if
    return scaled
end function
