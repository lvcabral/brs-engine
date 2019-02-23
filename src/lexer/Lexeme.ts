export enum Lexeme {
    // parens (and friends)
    LeftParen,
    RightParen,
    LeftSquare,
    RightSquare,
    LeftBrace,
    RightBrace,

    // operators
    Caret,
    Minus,
    Plus,
    Star,
    Slash,
    Mod,
    Backslash,

    // bitshift
    LeftShift, // <<
    RightShift, // >>

    // assignment operators
    CaretEqual,      // ^=
    MinusEqual,      // -=
    PlusEqual,       // +=
    StarEqual,       // *=
    SlashEqual,      // /=
    BackslashEqual,  // \=
    LeftShiftEqual,  // <<=
    RightShiftEqual, // >>=

    // comparators
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    Equal,
    LessGreater, // BrightScript uses `<>` for "not equal"

    // literals
    Identifier,
    String,
    Integer,
    Float,
    Double,
    LongInteger,

    // other single-character symbols
    Dot,
    Comma,
    Colon,
    Semicolon,

    // conditional compilation
    HashIf,
    HashElseIf,
    HashElse,
    HashEndIf,
    HashConst,
    HashError,
    HashErrorMessage,

    // keywords
    // canonical source: https://sdkdocs.roku.com/display/sdkdoc/Reserved+Words
    And,
    Box,
    CreateObject,
    Dim,
    Else,
    ElseIf,
    End,
    EndFunction,
    EndFor,
    EndIf,
    EndSub,
    EndWhile,
    Eval,
    Exit,
    ExitFor, // not technically a reserved word, but definitely a lexeme
    ExitWhile,
    False,
    For,
    ForEach,
    Function,
    GetGlobalAA,
    GetLastRunCompileError,
    GetLastRunRunTimeError,
    Goto,
    If,
    Invalid,
    Let,
    LineNum,
    Next,
    Not,
    ObjFun,
    Or,
    Pos,
    Print,
    Rem,
    Return,
    Step,
    Sub,
    Tab,
    Then,
    To,
    True,
    Type,
    While,

    // structural
    Newline,
    Eof
}
