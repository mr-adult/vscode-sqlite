import { CancellationToken, DocumentFormattingEditProvider, FormattingOptions, ProviderResult, Range, TextDocument, TextEdit } from "vscode";
import { SqlTokens, Token, TokenType } from "./tokenizer";

export class FormattingProvider implements DocumentFormattingEditProvider {
    constructor() { }

    public provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken
    ): ProviderResult<TextEdit[]> {
        const lineCount = document.lineCount;

        let indentString;
        if (options.insertSpaces) {
            indentString = new Array(options.tabSize)
                .fill(' ')
                .join("");
        } else {
            indentString = new Array(options.tabSize)
                .fill('\t')
                .join("");
        }

        let formatted: string = "";
        try {
            formatted = formatSql(document.getText(), indentString);
        } catch (e) {
            console.error(e);
            throw e;
        }
        return [TextEdit.replace(
            new Range(
                document.lineAt(0).range.start,
                document.lineAt(lineCount - 1).rangeIncludingLineBreak.end
            ),
            formatted)];
    }
}

function formatSql(sql: string, indentString: string): string {
    const parentheticalStack: Parenthetical[] = [{ lines: [{ tokens: [] }] }];

    let indent = 0;
    let indentsContributedBySelects = 0;
    function pushNewLine(): void {
        const topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
        topOfParenStack.lines.push({ tokens: [] });
        for (let i = 0; i < indent; i++) {
            topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                type: TokenType.whitespace,
                text: indentString
            });
        }
    };

    function unwindParentheticalStackOnce(): number {
        const topOfStack = parentheticalStack.pop()!;

        let lenOfTokens = 0;
        for (const line of topOfStack.lines) {
            for (const token of line.tokens) {
                if (token.type === TokenType.whitespace
                    || token.type === TokenType.multiLineComment
                    || token.type === TokenType.singleLineComment
                ) {
                    continue;
                }

                lenOfTokens += token.text.length;
            }
        }

        if (lenOfTokens < 50) {
            const topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
            for (const line of topOfStack.lines) {
                const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                const firstNonWS = line.tokens.find(tok => tok.type !== TokenType.whitespace);
                if (firstNonWS !== undefined
                    && firstNonWS.type !== TokenType.comma
                    && targetLine.tokens.length > 0
                    && targetLine.tokens[targetLine.tokens.length - 1].type !== TokenType.whitespace) {
                    targetLine.tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }

                let allSoFarAreWhitespace = true;
                for (const token of line.tokens) {
                    allSoFarAreWhitespace = allSoFarAreWhitespace
                        && token.type === TokenType.whitespace;
                    if (allSoFarAreWhitespace) { continue; }

                    targetLine
                        .tokens
                        .push(token);
                }
            }
        } else {
            for (let lineNum = 0; lineNum < topOfStack.lines.length; lineNum++) {
                const topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
                if (lineNum === 0) {
                    const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                    const firstNonWS = topOfStack.lines[lineNum].tokens.find(tok => tok.type !== TokenType.whitespace);
                    if (firstNonWS !== undefined
                        && firstNonWS.type !== TokenType.comma
                        && targetLine.tokens.length > 0
                        && targetLine.tokens[targetLine.tokens.length - 1].type !== TokenType.whitespace) {
                        targetLine.tokens.push({
                            type: TokenType.whitespace,
                            text: " ",
                        });
                    }

                    let allSoFarAreWhitespace = true;
                    for (const token of topOfStack.lines[lineNum].tokens) {
                        allSoFarAreWhitespace = allSoFarAreWhitespace
                            && token.type === TokenType.whitespace;
                        if (allSoFarAreWhitespace) { continue; }

                        const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                        targetLine
                            .tokens
                            .push(token);
                    }
                } else {
                    topOfParenStack.lines.push({ tokens: [] })
                    for (const token of topOfStack.lines[lineNum].tokens) {
                        const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                        targetLine
                            .tokens
                            .push(token);
                    }
                }
            }
        }

        return lenOfTokens;
    }

    for (const token of new SqlTokens(sql)) {
        let topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
        switch (token.type) {
            case TokenType.whitespace:
                continue;

            case TokenType.unknown: {
                // Idk, just push it on the current line I guess?
                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                    type: TokenType.whitespace,
                    text: " ",
                });
                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                break;
            }

            case TokenType.comma: {
                pushNewLine();
                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                break;
            }

            case TokenType.period: {
                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                break;
            }

            case TokenType.asterisk: {
                let previousNonWSToken: Token | undefined = undefined;
                lineLoop:
                for (let lineNum = topOfParenStack.lines.length - 1; lineNum >= 0; lineNum--) {
                    const line = topOfParenStack.lines[lineNum];
                    for (let tokenNum = line.tokens.length - 1; tokenNum >= 0; tokenNum--) {
                        const token = line.tokens[tokenNum];
                        if (token.type === TokenType.whitespace) { continue; }
                        previousNonWSToken = token;
                        break lineLoop;
                    }
                }

                if (previousNonWSToken?.type !== TokenType.period) {
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }

                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                break;
            }

            case TokenType.keyword: {
                switch (token.text) {
                    case "CASE":
                        indent++;
                        break;

                    case "WHEN":
                        pushNewLine();
                        break;

                    case "ELSE":
                        pushNewLine();
                        break;

                    case "END":
                        indent--;
                        break;

                    case "SELECT":
                        if (indentsContributedBySelects > 0) {
                            indent -= indentsContributedBySelects;
                            indentsContributedBySelects = 0;
                        }
                        pushNewLine();
                        pushNewLine();
                        break;

                    case "FROM":
                        if (indentsContributedBySelects > 0) {
                            indent--;
                            indentsContributedBySelects--;
                        }
                        pushNewLine();
                        break;

                    case "AND": {
                        let last2NonWS: Token[] = [];
                        const line = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                        for (let tokenNum = line.tokens.length - 1; tokenNum >= 0; tokenNum--) {
                            const token = line.tokens[tokenNum];
                            if (token.type === TokenType.whitespace) { continue; }

                            last2NonWS.push(token);
                            if (last2NonWS.length === 2) {
                                break;
                            }
                        }

                        if (last2NonWS[1]?.type !== TokenType.keyword || last2NonWS[1].text !== "BETWEEN") {
                            indent++;
                            pushNewLine();
                            indent--;
                        }
                        break;
                    }

                    case "OR":
                    case "ON":
                        indent++;
                        pushNewLine();
                        indent--;
                        break;

                    case "CREATE":
                    case "INSERT":
                    case "ALTER":
                    case "UPDATE":
                    case "DELETE":
                        pushNewLine();
                        pushNewLine();
                        break;

                    case "WHERE":
                    case "GROUP":
                    case "ORDER":
                    case "LIMIT":
                    case "VALUES":
                    case "HAVING":
                        pushNewLine();
                        break;
                }

                if (topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.some(tok => tok.type !== TokenType.whitespace)) {
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }

                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);

                switch (token.text) {
                    case "SELECT":
                        indentsContributedBySelects++;
                        indent++;
                        break;

                    case "VALUES":
                        pushNewLine();
                        break;
                }
                break;
            }

            case TokenType.identifier: {
                const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                const precedingToken = targetLine.tokens[targetLine.tokens.length - 1];
                if (precedingToken?.type !== TokenType.period
                    && precedingToken?.type !== TokenType.whitespace) {
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }

                targetLine.tokens.push(token);
                break;
            }

            case TokenType.singleLineComment: {
                const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                if (targetLine.tokens[targetLine.tokens.length - 1]?.type !== TokenType.whitespace) {
                    targetLine.tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }

                targetLine.tokens.push({
                    type: TokenType.multiLineComment,
                    text: ["/*", token.text.substring(2), " */"].join(""),
                });
                break;
            }

            case TokenType.multiLineComment:
                indent++;
                const lines = token.text.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    pushNewLine();

                    topOfParenStack.lines.push({
                        tokens: [{
                            type: TokenType.multiLineComment,
                            text: lines[i].trim(),
                        }]
                    });
                }
                indent--;
                break;

            case TokenType.singleQuotedString:
            case TokenType.doubleQuotedString:
            case TokenType.number: {
                const targetLine = topOfParenStack.lines[topOfParenStack.lines.length - 1];
                if (targetLine.tokens[targetLine.tokens.length - 1]?.type !== TokenType.whitespace) {
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                }
                topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                break;
            }

            case TokenType.openParen: {
                parentheticalStack.push({ lines: [] });
                pushNewLine();
                const topOfParentheticalStack = parentheticalStack[parentheticalStack.length - 1];
                const targetLine = topOfParentheticalStack.lines[topOfParentheticalStack.lines.length - 1];
                targetLine.tokens.push(token);
                indent++;
                pushNewLine();
                break;
            }

            case TokenType.closeParen: {
                indent--;
                if (parentheticalStack.length > 1) {
                    const lenOfTokens = unwindParentheticalStackOnce();
                    const topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
                    let previousNonWSToken = undefined;
                    linesLoop:
                    for (let lineNum = topOfParenStack.lines.length - 1; lineNum >= 0; lineNum--) {
                        const line = topOfParenStack.lines[lineNum];
                        for (let tokenNum = line.tokens.length - 1; tokenNum >= 0; tokenNum--) {
                            const token = line.tokens[tokenNum];
                            if (token.type === TokenType.whitespace) { continue; }
                            previousNonWSToken = token;
                            break linesLoop;
                        }
                    }

                    if (previousNonWSToken?.type !== TokenType.openParen) {
                        topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                            type: TokenType.whitespace,
                            text: " ",
                        });
                    }

                    if (lenOfTokens >= 50) {
                        pushNewLine();
                    }

                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                } else {
                    const topOfParenStack = parentheticalStack[parentheticalStack.length - 1];
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push({
                        type: TokenType.whitespace,
                        text: " ",
                    });
                    pushNewLine();
                    topOfParenStack.lines[topOfParenStack.lines.length - 1].tokens.push(token);
                }
                break;
            }
        }
    }

    while (parentheticalStack.length > 1) {
        unwindParentheticalStackOnce();
    }

    const lines = parentheticalStack.pop()!.lines;
    const emptyLineStash: LineOfTokens[] = [];
    const resultLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.tokens.some(token => token.type !== TokenType.whitespace)) {
            emptyLineStash.push(line);
            continue;
        }

        if (resultLines.length !== 0) {
            const lastResultLine = resultLines[resultLines.length - 1];
            let lastNonWS: string | undefined = undefined;
            for (const char of lastResultLine) {
                if (/\s/.test(char)) { continue; }
                lastNonWS = char;
            }

            if (lastNonWS !== '(') {
                for (let j = 0; j < emptyLineStash.length; j++) {
                    resultLines.push(
                        emptyLineStash[j]
                            .tokens
                            .map(tok => tok.text)
                            .join(""));
                }
            }
        }
        emptyLineStash.length = 0;

        let resultTokens: string[] = [];
        let whitespaceStash: string[] = [];

        for (let j = 0; j < line.tokens.length; j++) {
            const token = line.tokens[j];
            if (token.type === TokenType.whitespace) {
                whitespaceStash.push(token.text);
            } else {
                for (const ws of whitespaceStash) {
                    resultTokens.push(ws);
                }
                whitespaceStash.length = 0;
                resultTokens.push(token.text);
            }
        }

        resultLines.push(resultTokens.join(""));
    }

    resultLines.push("");
    return resultLines.join("\n");
}

type Parenthetical = {
    lines: LineOfTokens[]
}

type LineOfTokens = {
    tokens: Token[]
}
