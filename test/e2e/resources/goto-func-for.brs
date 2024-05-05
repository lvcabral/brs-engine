sub main()
    print "starting goto test"
    this = {}
	this.start = function() as string
        abort = 0
		jump = 0
        m.paused = true
		while true
			for i = 5 to -1 step -1
				if i = 3
					jump++
					goto end_of_For_Loop
				end if
                abort++
                print "not jumped:"; i
				end_of_for_loop:
				if jump = 1
					print "did jump!"; i
					jump = -1
                else if abort > 5
                    print "error: aborting"
                    goto out_of_for_loop
				end if
			end for
			out_of_for_loop:
            if i = -1
                print "successful goto test!"
                exit while
			else
				print "error the for loop was cut short!", i
				exit while
            end if
        end while
        return "finished goto test"
	end function
    print this.start()
end sub


