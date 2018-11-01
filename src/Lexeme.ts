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
    Run,
    Step,
    Stop,
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