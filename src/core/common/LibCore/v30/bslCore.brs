' Main Core BrightScript Library

function bslBrightScriptErrorCodes()
    return {
        ERR_OKAY : &hFF
        ERR_NORMAL_END : &hFC
        ERR_VALUE_RETURN : &hE2
        ERR_INTERNAL : &hFE
        ERR_UNDEFINED_OPCD: &hFD
        ERR_UNDEFINED_OP : &hFB
        ERR_MISSING_PARN : &hFA
        ERR_STACK_UNDER : &hF9
        ERR_BREAK : &hF8
        ERR_STOP : &hF7
        ERR_RO0 : &hF6
        ERR_RO1 : &hF5
        ERR_RO2 : &hF4
        ERR_RO3 : &hF3
        ERR_TOO_MANY_PARAM : &hF2
        ERR_WRONG_NUM_PARAM : &hF1
        ERR_RVIG : &hF0
        ERR_NOTPRINTABLE : &hEF
        ERR_NOTWAITABLE : &hEE
        ERR_MUST_BE_STATIC : &hED
        ERR_RO4 : &hEC
        ERR_NOTYPEOP : &hEB
        ERR_USE_OF_UNINIT_VAR : &hE9
        ERR_TM2 : &hE8
        ERR_ARRAYNOTDIMMED : &hE7
        ERR_USE_OF_UNINIT_BRSUBREF : &hE6
        ERR_MUST_HAVE_RETURN : &hE5
        ERR_INVALID_LVALUE : &hE4
        ERR_INVALID_NUM_ARRAY_IDX : &hE3
        ERR_UNICODE_NOT_SUPPORTED : &hE1
        ERR_NOTFUNOPABLE : &hE0
        ERR_STACK_OVERFLOW : &hDF
        ERR_SYNTAX : &h02
        ERR_DIV_ZERO : &h14
        ERR_MISSING_LN : &h0E
        ERR_OUTOFMEM : &h0C
        ERR_STRINGTOLONG : &h1C
        ERR_TM : &h18
        ERR_OS : &h1A
        ERR_RG : &h04
        ERR_NF : &h00
        ERR_FC : &h08
        ERR_DD : &h12
        ERR_BS : &h10
        ERR_OD : &h06
        ERR_CN : &h20
        ERR_BITSHIFT_BAD : &h1E
        ERR_EXECUTION_TIMEOUT : &h23
        ERR_NW : &hBF
        ERR_MISSING_ENDWHILE : &hBE
        ERR_MISSING_ENDIF : &hBC
        ERR_NOLN : &hBB
        ERR_LNSEQ : &hBA
        ERR_LOADFILE : &hB9
        ERR_NOMATCH : &hB8
        ERR_UNEXPECTED_EOF : &hB7
        ERR_FOR_NEXT_MISMATCH : &hB6
        ERR_NO_BLOCK_END : &hB5
        ERR_LABELTWICE : &hB4
        ERR_UNTERMED_STRING : &hB3
        ERR_FUN_NOT_EXPECTED : &hB2
        ERR_TOO_MANY_CONST : &hB1
        ERR_TOO_MANY_VAR : &hB0
        ERR_EXIT_WHILE_NOT_IN_WHILE : &hAF
        ERR_INTERNAL_LIMIT_EXCEDED : &hAE
        ERR_SUB_DEFINED_TWICE : &hAD
        ERR_NOMAIN : &hAC
        ERR_FOREACH_INDEX_TM : &hAB
        ERR_RET_CANNOT_HAVE_VALUE : &hAA
        ERR_RET_MUST_HAVE_VALUE : &hA9
        ERR_FUN_MUST_HAVE_RET_TYPE : &hA8
        ERR_INVALID_TYPE : &hA7
        ERR_NOLONGER : &hA6
        ERR_EXIT_FOR_NOT_IN_FOR : &hA5
        ERR_MISSING_INITILIZER : &hA4
        ERR_IF_TOO_LARGE : &hA3
        ERR_RO_NOT_FOUND : &hA2
        ERR_TOO_MANY_LABELS : &hA1
        ERR_VAR_CANNOT_BE_SUBNAME : &hA0
        ERR_INVALID_CONST_NAME : &h9F
        ERR_CONST_FOLDING : &h9E
        ERR_BUILTIN_FUNCTION : &h9D
    }
end function
function bslUniversalControlEventCodes()
    return {
        BUTTON_BACK_PRESSED : 0
        BUTTON_UP_PRESSED : 2
        BUTTON_DOWN_PRESSED : 3
        BUTTON_LEFT_PRESSED : 4
        BUTTON_RIGHT_PRESSED : 5
        BUTTON_SELECT_PRESSED : 6
        BUTTON_INSTANT_REPLAY_PRESSED : 7
        BUTTON_REWIND_PRESSED : 8
        BUTTON_FAST_FORWARD_PRESSED : 9
        BUTTON_INFO_PRESSED : 10
        BUTTON_PLAY_PRESSED : 13
        BUTTON_ENTER_PRESSED : 15
        BUTTON_A_PRESSED : 17
        BUTTON_B_PRESSED : 18
        BUTTON_PLAY_ONLY_PRESSED : 22
        BUTTON_STOP_PRESSED : 23
        BUTTON_BACK_RELEASED : 100
        BUTTON_UP_RELEASED : 102
        BUTTON_DOWN_RELEASED : 103
        BUTTON_LEFT_RELEASED : 104
        BUTTON_RIGHT_RELEASED : 105
        BUTTON_SELECT_RELEASED : 106
        BUTTON_INSTANT_REPLAY_RELEASED : 107
        BUTTON_REWIND_RELEASED : 108
        BUTTON_FAST_FORWARD_RELEASED : 109
        BUTTON_INFO_RELEASED : 110
        BUTTON_PLAY_RELEASED : 113
        BUTTON_ENTER_RELEASED : 115
        BUTTON_A_RELEASED : 117
        BUTTON_B_RELEASED : 118
        BUTTON_PLAY_ONLY_RELEASED : 122
        BUTTON_STOP_RELEASED : 123
    }
end function
function bslGeneralConstants()
    return {
        MAX_INT : 2147483647
        MIN_INT : -2147483648
    }
end function
function AsciiToHex(ascii)
    digits = "0123456789ABCDEF"
    hex = ""
    out = ""
    for i = 1 to len(ascii)
        dec = asc(mid(ascii, i, 1))
        ch = mid(digits, dec / 16 + 1, 1)
        ch = ch + mid(digits, (dec and 15) + 1, 1)
        out = out + ch
    end for
    return out
end function
function HexToAscii(hex_in)
    out = ""
    hex = LCase(hex_in)
    for i = 1 to len(hex) step 2
        dec1 = asc(mid(hex, i, 1))
        if dec1 >= asc("0") and dec1 <= asc("9") then dec1 = dec1 - asc("0") else dec1 = dec1 - asc("a") + 10
        dec2 = asc(mid(hex, i + 1, 1))
        if dec2 >= asc("0") and dec2 <= asc("9") then dec2 = dec2 - asc("0") else dec2 = dec2 - asc("a") + 10
        dec = dec1 * 16 + dec2
        out = out + chr(dec)
    end for
    return out
end function
function HexToInteger(hex_in)
    out = 0
    hex = LCase(hex_in)
    for i = 1 to len(hex)
        dec1 = asc(mid(hex, i, 1))
        if dec1 >= asc("0") and dec1 <= asc("9") then dec1 = dec1 - asc("0") else dec1 = dec1 - asc("a") + 10
        out = out * 16 + dec1
    end for
    return out
end function
