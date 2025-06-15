import { keywordsSet } from "./keywords"

export class SqlTokens implements Iterable<Token> {
    sql: string;

    constructor(sql: string) {
        this.sql = sql;
    }

    public [Symbol.iterator]() {
        return new SqlTokenizer(this.sql);
    }
}

export class SqlTokenizer implements Iterator<Token> {
    sql: Iterator<string>;
    peeked?: IteratorResult<string>;

    constructor(sql: string) {
        // Use the iterator implementation because it handles unicode code points.
        this.sql = sql[Symbol.iterator]();
    }

    public next(): IteratorResult<Token> {
        let nextCodePointResult: IteratorResult<string> = this.peeked ?? this.sql.next();
        if (this.peeked !== undefined) {
            this.peeked = undefined;
        }

        const tokenCodePoints: string[] = [];
        let tokenType: TokenType | undefined = undefined;
        outer:
        while (!nextCodePointResult.done) {
            const currentCodePoint = nextCodePointResult.value;
            switch (currentCodePoint) {
                case 'a':
                case 'b':
                case 'c':
                case 'd':
                case 'e':
                case 'f':
                case 'g':
                case 'h':
                case 'i':
                case 'j':
                case 'k':
                case 'l':
                case 'm':
                case 'n':
                case 'o':
                case 'p':
                case 'q':
                case 'r':
                case 's':
                case 't':
                case 'u':
                case 'v':
                case 'w':
                case 'x':
                case 'y':
                case 'z':
                case 'A':
                case 'B':
                case 'C':
                case 'D':
                case 'E':
                case 'F':
                case 'G':
                case 'H':
                case 'I':
                case 'J':
                case 'K':
                case 'L':
                case 'M':
                case 'N':
                case 'O':
                case 'P':
                case 'Q':
                case 'R':
                case 'S':
                case 'T':
                case 'U':
                case 'V':
                case 'W':
                case 'X':
                case 'Y':
                case 'Z':
                case '_':
                    if (tokenType === undefined) {
                        tokenType = TokenType.identifier;
                    }

                    if (tokenType === TokenType.identifier
                        || tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    if (tokenType === undefined) {
                        tokenType = TokenType.number;
                    }

                    if (tokenType === TokenType.identifier
                        || tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.number
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case ',':
                case '.':
                case ';':
                    if (tokenType === undefined) {
                        switch (currentCodePoint) {
                            case ',': tokenType = TokenType.comma; break;
                            case '.': tokenType = TokenType.period; break;
                            case ';': tokenType = TokenType.semicolon; break;
                            default: throw new Error("Unexpected character");
                        }
                        tokenCodePoints.push(currentCodePoint);
                        break outer;
                    } else if (tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.number
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case '(':
                    if (tokenType === undefined) {
                        tokenType = TokenType.openParen;
                        tokenCodePoints.push(currentCodePoint);
                    } else if (tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push('(');
                    } else {
                        this.peeked = nextCodePointResult;
                    }
                    break outer;

                case ')':
                    if (tokenType === undefined) {
                        tokenType = TokenType.closeParen;
                        tokenCodePoints.push(currentCodePoint);
                    } else if (tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(')');
                    } else {
                        this.peeked = nextCodePointResult;
                    }
                    break outer;

                case '"':
                    if (tokenType === undefined) {
                        tokenType = TokenType.doubleQuotedString;
                        tokenCodePoints.push('"');
                    } else if (tokenType === TokenType.doubleQuotedString) {
                        tokenCodePoints.push('"');

                        const nextResult = this.sql.next();
                        if (!nextResult.done && nextResult.value === '"') {
                            tokenCodePoints.push('"');
                        } else if (!nextResult.done) {
                            this.peeked = nextResult;
                            break outer;
                        } else {
                            break outer;
                        }
                    } else if (tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push('"');
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case '\'':
                    if (tokenType === undefined) {
                        tokenType = TokenType.singleQuotedString;
                        tokenCodePoints.push('\'');
                    } else if (tokenType === TokenType.singleQuotedString) {
                        tokenCodePoints.push('\'');

                        const nextResult = this.sql.next();
                        if (!nextResult.done && nextResult.value === '\'') {
                            tokenCodePoints.push('\'');
                        } else if (!nextResult.done) {
                            this.peeked = nextResult;
                            break outer;
                        } else {
                            break outer;
                        }
                    } else if (tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push('\'');
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case ' ':
                case '\f':
                case '\n':
                case '\r':
                case '\t':
                case '\v':
                case '\u00A0':
                case '\u2028':
                case '\u2029':
                    if (tokenType === undefined) {
                        tokenType = TokenType.whitespace;
                    }

                    if (tokenType === TokenType.whitespace) {
                        tokenCodePoints.push(currentCodePoint);
                    } else if (tokenType === TokenType.singleLineComment) {
                        tokenCodePoints.push(currentCodePoint)
                        if (currentCodePoint === '\n') {
                            break outer;
                        }
                    } else if (tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case '*':
                    if (tokenType === TokenType.multiLineComment) {
                        const nextResult = this.sql.next();
                        if (!nextResult.done && nextResult.value === '/') {
                            tokenCodePoints.push('*');
                            tokenCodePoints.push('/');
                            break outer;
                        } else {
                            tokenCodePoints.push('*');
                            if (!nextResult.done) {
                                tokenCodePoints.push(nextResult.value);
                            } else {
                                break outer;
                            }
                        }
                    } else {
                        if (tokenType === undefined) {
                            tokenType = TokenType.asterisk;
                        }

                        if (tokenType === TokenType.asterisk) {
                            tokenCodePoints.push(currentCodePoint);
                            break outer;
                        } else if (tokenType === TokenType.singleLineComment) {
                            tokenCodePoints.push(currentCodePoint);
                        } else {
                            this.peeked = nextCodePointResult;
                            break outer;
                        }
                    }
                    break;

                case '/':
                    if (tokenType === undefined) {
                        const nextResult = this.sql.next();
                        if (!nextResult.done && nextResult.value === '*') {
                            tokenType = TokenType.multiLineComment;
                            tokenCodePoints.push('/');
                            tokenCodePoints.push('*');
                        } else {
                            tokenType = TokenType.unknown;
                            tokenCodePoints.push('/');
                            if (!nextResult.done) {
                                this.peeked = nextResult;
                            }
                            break outer;
                        }
                    } else if (tokenType === TokenType.unknown
                        || tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                case '-':
                    if (tokenType === undefined) {
                        const nextResult = this.sql.next();
                        if (!nextResult.done && nextResult.value === '-') {
                            tokenType = TokenType.singleLineComment;
                            tokenCodePoints.push('-');
                            tokenCodePoints.push('-');
                        } else {
                            tokenType = TokenType.unknown;
                            tokenCodePoints.push('-');
                            if (!nextResult.done) {
                                this.peeked = nextResult;
                            }
                            break outer;
                        }
                    } else if (tokenType === TokenType.unknown
                        || tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push('-');
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;

                default:
                    if (tokenType === undefined) {
                        tokenType = TokenType.unknown;
                    }

                    if (tokenType === TokenType.unknown
                        || tokenType === TokenType.singleQuotedString
                        || tokenType === TokenType.doubleQuotedString
                        || tokenType === TokenType.singleLineComment
                        || tokenType === TokenType.multiLineComment) {
                        tokenCodePoints.push(currentCodePoint);
                    } else {
                        this.peeked = nextCodePointResult;
                        break outer;
                    }
                    break;
            }

            nextCodePointResult = this.sql.next();
        }

        let tokenString = tokenCodePoints.join("");
        const tokenStringUpper = tokenString.toUpperCase();
        if (tokenType === TokenType.identifier
            && keywordsSet.has(tokenStringUpper)) {
            tokenType = TokenType.keyword;
            tokenString = tokenStringUpper;
        }

        return tokenType === undefined
            ? {
                done: true,
                value: undefined
            }
            : {
                done: false,
                value: new Token(tokenType, tokenString),
            }
    }
};

export class Token {
    type: TokenType;
    text: string;

    constructor(type: TokenType, rawText: string) {
        this.type = type;
        this.text = rawText;
    }
};

export enum TokenType {
    unknown,
    comma,
    period,
    semicolon,
    asterisk,
    openParen,
    closeParen,
    keyword,
    identifier,
    singleLineComment,
    multiLineComment,
    singleQuotedString,
    doubleQuotedString,
    number,
    whitespace,
};
