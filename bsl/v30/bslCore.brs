'
' Main Core BrightScript Library
'

function bslBrightScriptErrorCodes()

    return {

' runtime errors
      ERR_OKAY          :  &hFF
      ERR_NORMAL_END    :  &hFC         ' normal, but terminate execution.  END, shell "exit", window closed, etc.
      ERR_VALUE_RETURN  :  &hE2         ' return executed, and a value returned on the stack


      ERR_INTERNAL      :  &hFE         ' A condition that shouldn't occur did
      ERR_UNDEFINED_OPCD:  &hFD         ' A opcode that we don't handle
      ERR_UNDEFINED_OP  :  &hFB         ' An expression operator that we don't handle
      ERR_MISSING_PARN  :  &hFA
      ERR_STACK_UNDER   :  &hF9         ' nothing on stack to pop
      ERR_BREAK         :  &hF8         ' scriptBreak() called
      ERR_STOP          :  &hF7         ' stop statement executed
      ERR_RO0           :  &hF6         ' bscNewComponent failed because object class not found
      ERR_RO1           :  &hF5         ' ro function call does not have the right number of parameters
      ERR_RO2           :  &hF4         ' member function not found in object or interface
      ERR_RO3           :  &hF3         ' Interface not a member of object
      ERR_TOO_MANY_PARAM    :  &hF2     ' Too many function parameters to handle
      ERR_WRONG_NUM_PARAM   :  &hF1     ' Incorect number of function parameters
      ERR_RVIG              :  &hF0     ' Function returns a value, but is ignored
      ERR_NOTPRINTABLE      :  &hEF     ' Non Printable value
      ERR_NOTWAITABLE       :  &hEE     ' Tried to Wait on a function that does not have MessagePort interface
      ERR_MUST_BE_STATIC    :  &hED     ' interface calls from type rotINTERFACE must by static
      ERR_RO4               :  &hEC     ' . operator used on a variable that does not contain a legal object or interface reference
      ERR_NOTYPEOP          :  &hEB     ' operation on two typless operands attempted
      ERR_USE_OF_UNINIT_VAR :  &hE9     ' illegal use of uninited var
      ERR_TM2               :  &hE8     ' non-numeric index to array
      ERR_ARRAYNOTDIMMED    :  &hE7
      ERR_USE_OF_UNINIT_BRSUBREF :  &hE6    ' used a reference to SUB that is not initilized
      ERR_MUST_HAVE_RETURN  :  &hE5
      ERR_INVALID_LVALUE    :  &hE4     ' invalid left side of expression
      ERR_INVALID_NUM_ARRAY_IDX :  &hE3 ' invalid number of array indexes
      ERR_UNICODE_NOT_SUPPORTED :  &hE1
      ERR_NOTFUNOPABLE      :  &hE0
      ERR_STACK_OVERFLOW    :  &hDF

      ERR_SYNTAX            :  &h02
      ERR_DIV_ZERO          :  &h14
      ERR_MISSING_LN        :  &h0E
      ERR_OUTOFMEM          :  &h0C
      ERR_STRINGTOLONG      :  &h1C
      ERR_TM                :  &h18     ' Type Mismatch (string / numeric operation mismatch)
      ERR_OS                :  &h1A     ' out of string space
      ERR_RG                :  &h04     ' Return without Gosub
      ERR_NF                :  &h00     ' Next without For
      ERR_FC                :  &h08     ' Invalid parameter passed to function/array (e.g neg matrix dim or squr root)
      ERR_DD                :  &h12     ' Attempted to redimension an array
      ERR_BS                :  &h10     ' Array subscript out of bounds
      ERR_OD                :  &h06     ' Out of Data (READ)
      ERR_CN                :  &h20     ' Continue Not Allowed
      ERR_BITSHIFT_BAD      :  &h1E     ' Invalid Bitwise Shift
      ERR_EXECUTION_TIMEOUT :  &h23     ' Timeout on critical thread

' compiler errors
      ERR_NW                :  &hBF     ' EndWhile with no While
      ERR_MISSING_ENDWHILE  :  &hBE     ' While Statement is missing a matching EndWhile
      ERR_MISSING_ENDIF     :  &hBC     ' end of code reached without finding ENDIF
      ERR_NOLN              :  &hBB     ' no line number found
      ERR_LNSEQ             :  &hBA     ' Line number sequence error
      ERR_LOADFILE          :  &hB9     ' Error loading a file
      ERR_NOMATCH           :  &hB8     ' "Match" statement did not match
      ERR_UNEXPECTED_EOF    :  &hB7     ' End of string being compiled encountered when not expected (missing end of block usually)
      ERR_FOR_NEXT_MISMATCH :  &hB6     ' Variable on a NEXT does not match that for the FOR
      ERR_NO_BLOCK_END      :  &hB5
      ERR_LABELTWICE        :  &hB4     ' Label defined more than once
      ERR_UNTERMED_STRING   :  &hB3     ' litteral string does not have ending quote
      ERR_FUN_NOT_EXPECTED  :  &hB2
      ERR_TOO_MANY_CONST    :  &hB1
      ERR_TOO_MANY_VAR      :  &hB0
      ERR_EXIT_WHILE_NOT_IN_WHILE   :  &hAF
      ERR_INTERNAL_LIMIT_EXCEDED    :  &hAE
      ERR_SUB_DEFINED_TWICE :  &hAD
      ERR_NOMAIN            :  &hAC
      ERR_FOREACH_INDEX_TM  :  &hAB
      ERR_RET_CANNOT_HAVE_VALUE     :  &hAA
      ERR_RET_MUST_HAVE_VALUE       :  &hA9
      ERR_FUN_MUST_HAVE_RET_TYPE    :  &hA8
      ERR_INVALID_TYPE              :  &hA7
      ERR_NOLONGER                  :  &hA6 ' no longer supported
      ERR_EXIT_FOR_NOT_IN_FOR       :  &hA5
      ERR_MISSING_INITILIZER        :  &hA4
      ERR_IF_TOO_LARGE              :  &hA3
      ERR_RO_NOT_FOUND              :  &hA2
      ERR_TOO_MANY_LABELS           :  &hA1
      ERR_VAR_CANNOT_BE_SUBNAME     :  &hA0
      ERR_INVALID_CONST_NAME        :  &h9F
      ERR_CONST_FOLDING             :  &h9E
      ERR_BUILTIN_FUNCTION          :  &h9D

    }

end function

function bslUniversalControlEventCodes()

    return {
        BUTTON_BACK_PRESSED            :   0
        BUTTON_UP_PRESSED              :   2
        BUTTON_DOWN_PRESSED            :   3
        BUTTON_LEFT_PRESSED            :   4
        BUTTON_RIGHT_PRESSED           :   5
        BUTTON_SELECT_PRESSED          :   6
        BUTTON_INSTANT_REPLAY_PRESSED  :   7
        BUTTON_REWIND_PRESSED          :   8
        BUTTON_FAST_FORWARD_PRESSED    :   9
        BUTTON_INFO_PRESSED            :  10
        BUTTON_PLAY_PRESSED            :  13
        BUTTON_ENTER_PRESSED           :  15
        BUTTON_A_PRESSED               :  17
        BUTTON_B_PRESSED               :  18
        BUTTON_PLAY_ONLY_PRESSED       :  22
        BUTTON_STOP_PRESSED            :  23

        BUTTON_BACK_RELEASED           : 100
        BUTTON_UP_RELEASED             : 102
        BUTTON_DOWN_RELEASED           : 103
        BUTTON_LEFT_RELEASED           : 104
        BUTTON_RIGHT_RELEASED          : 105
        BUTTON_SELECT_RELEASED         : 106
        BUTTON_INSTANT_REPLAY_RELEASED : 107
        BUTTON_REWIND_RELEASED         : 108
        BUTTON_FAST_FORWARD_RELEASED   : 109
        BUTTON_INFO_RELEASED           : 110
        BUTTON_PLAY_RELEASED           : 113
        BUTTON_ENTER_RELEASED          : 115
        BUTTON_A_RELEASED              : 117
        BUTTON_B_RELEASED              : 118
        BUTTON_PLAY_ONLY_RELEASED      : 122
        BUTTON_STOP_RELEASED           : 123
    }

end function

function bslGeneralConstants()

    return {
        MAX_INT :  2147483647
        MIN_INT : -2147483648
    }

end function

' input: ascii string
' output: hex string
Function AsciiToHex(ascii)

    digits="0123456789ABCDEF"
    hex=""
    out=""

    for i=1 to len(ascii)
        dec=asc(mid(ascii, i, 1))
        ch=mid(digits, dec/16+1, 1)
        ch=ch+mid(digits, (dec AND 15)+1, 1)
        out=out+ch
    end for

    return out
end function

' input: hex string
' output: ascii string
Function HexToAscii(hex_in)

    out=""
    hex=LCase(hex_in)

    for i=1 to len(hex) step 2
        dec1=asc(mid(hex, i, 1))
        if dec1>=asc("0") AND dec1 <=asc("9") then dec1=dec1-asc("0") else dec1=dec1-asc("a")+10
        dec2=asc(mid(hex, i+1, 1))
        if dec2 >=asc("0") AND dec2 <=asc("9") then dec2=dec2-asc("0") else dec2=dec2-asc("a")+10
        dec=dec1*16+dec2
        out=out+chr(dec)
    end for

    return out

end function

' input: hex string
' output: integer value of input string
Function HexToInteger(hex_in)

    out=0
    hex=LCase(hex_in)

    for i=1 to len(hex)
        dec1=asc(mid(hex, i, 1))
        if dec1>=asc("0") AND dec1 <=asc("9") then dec1=dec1-asc("0") else dec1=dec1-asc("a")+10
        out=out*16+dec1
    end for

    return out

end function
