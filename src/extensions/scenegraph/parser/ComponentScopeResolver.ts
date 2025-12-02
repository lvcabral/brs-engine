import { Lexer, logError, Parser, preprocessor as PP, Stmt, FileSystem } from "brs-engine";
import { ComponentDefinition, ComponentScript } from "./ComponentDefinition";
import { SGNodeFactory } from "../factory/SGNodeFactory";
import pSettle from "p-settle";
import * as path from "path";

export class ComponentScopeResolver {
    private readonly excludedNames: string[] = ["init"];
    private readonly parserLexerFn: (scripts: ComponentScript[]) => Promise<Stmt.Statement[]>;

    /**
     * @param componentMap Component definition map to reference for function resolution.
     * @param fs File system instance for reading files.
     * @param manifest Manifest map for resource resolution.
     */
    constructor(
        readonly componentMap: Map<string, ComponentDefinition>,
        fs: FileSystem,
        manifest: Map<string, string>
    ) {
        this.parserLexerFn = this.getLexerParserFn(fs, manifest);
    }

    /**
     * Resolves the component functions in scope based on the extends hierarchy.
     * @param component Instance of the component to resolve function scope for.
     * @returns All statements in scope for the resolved component
     */
    public async resolve(component: ComponentDefinition): Promise<Stmt.Statement[]> {
        let statementResults = await pSettle(Array.from(this.getStatements(component)));
        let rejected = statementResults.filter((res) => res.isRejected);
        if (rejected.length > 0) {
            rejected.forEach((rejection: PromiseRejectedResult) =>
                rejection.reason.messages.forEach((msg: string) => console.error(msg))
            );
            throw new Error(`Unable to resolve scope for component ${component.name}`);
        }
        return this.flatten(statementResults.map((res) => (res.isFulfilled ? res.value : [])));
    }

    /**
     * Takes a sequence of statement collections and flattens them into a
     * single statement collection. This function assumes that the components
     * given in the statement map are in order of hierarchy with the furthest
     * inheriting component first.
     * @param statementMap Statement collections broken up by component.
     * @returns A collection of statements that have been flattened based on hierarchy.
     */
    private flatten(statementMap: Stmt.Statement[][]): Stmt.Statement[] {
        let statements = statementMap.shift() || [];
        let statementMemo = new Set(
            statements.filter((_): _ is Stmt.Function => true).map((statement) => statement.name.text.toLowerCase())
        );
        while (statementMap.length > 0) {
            let extendedFns = statementMap.shift() || [];
            statements = statements.concat(
                extendedFns
                    .filter((_): _ is Stmt.Function => true)
                    .filter((statement) => {
                        let statementName = statement.name.text.toLowerCase();
                        let haveFnName = statementMemo.has(statementName);
                        if (!haveFnName) {
                            statementMemo.add(statementName);
                        }
                        return !haveFnName && !this.excludedNames.includes(statementName);
                    })
            );
        }
        return statements;
    }

    /**
     * Generator function that walks the component hierarchy and produces an
     * ordered list of component statement collections.
     * @param component Component to begin statement aggregation chain.
     * @returns An ordered array of component statement arrays.
     */
    private *getStatements(component: ComponentDefinition) {
        yield this.parserLexerFn(component.scripts);

        let currentComponent: ComponentDefinition | undefined = component;
        while (currentComponent.extends) {
            // If this is a built-in node component, then no work is needed and we can return.
            if (SGNodeFactory.canResolveNodeType(currentComponent.extends)) {
                return;
            }

            let previousComponent = currentComponent;
            currentComponent = this.componentMap.get(currentComponent.extends.toLowerCase());
            if (!currentComponent) {
                // The reference implementation doesn't allow extensions of unknown node subtypes, but
                // BRS hasn't implemented every node type in the reference implementation!  For now,
                // let's warn when we detect unknown subtypes.
                console.error(
                    `Warning: XML component '${previousComponent.name}' extends unknown component '${previousComponent.extends}'. Ignoring extension.`
                );
                return;
            }
            yield this.parserLexerFn(currentComponent.scripts);
        }
    }
    private getLexerParserFn(fs: FileSystem, manifest: Map<string, string>) {
        /**
         * Map file URIs or Source Content to promises. The promises resolve to an array of that script's statements.
         * This allows us to only parse each shared file once.
         */
        const memoizedStatements = new Map<string, Promise<Stmt.Statement[]>>();
        return async function parse(scripts: ComponentScript[]): Promise<Stmt.Statement[]> {
            async function lexAndParseScript(script: ComponentScript) {
                let contents;
                let filename;
                if (script.uri !== undefined) {
                    filename = script.uri.replaceAll(/[\/\\]+/g, path.posix.sep);
                    try {
                        contents = fs.readFileSync(filename, "utf-8");
                        script.content = contents;
                    } catch (err) {
                        let errno = (err as NodeJS.ErrnoException)?.errno || -4858;
                        throw new Error(`brs: can't open file '${filename}': [Errno ${errno}]`);
                    }
                } else if (script.content !== undefined) {
                    contents = script.content;
                    filename = script.xmlPath || "xml";
                } else {
                    throw new Error("brs: invalid script object");
                }
                const lexer = new Lexer();
                const preprocessor = new PP.Preprocessor();
                const parser = new Parser();
                for (const emitter of [lexer, preprocessor, parser]) {
                    emitter.onError(logError);
                }

                const scanResults = lexer.scan(contents, filename);
                if (scanResults.errors.length > 0) {
                    throw new Error("Error occurred during lexing");
                }

                const preprocessResults = preprocessor.preprocess(scanResults.tokens, manifest);
                if (preprocessResults.errors.length > 0) {
                    throw new Error("Error occurred during pre-processing");
                }

                const parseResults = parser.parse(preprocessResults.processedTokens);
                if (parseResults.errors.length > 0) {
                    throw new Error("Error occurred parsing");
                }

                return parseResults.statements;
            }

            const promises: Promise<Stmt.Statement[]>[] = [];
            for (const script of scripts) {
                if (script.uri !== undefined) {
                    const maybeStatements = memoizedStatements.get(script.uri);
                    if (maybeStatements) {
                        promises.push(maybeStatements);
                    } else {
                        const statementsPromise = lexAndParseScript(script);
                        if (!memoizedStatements.has(script.uri)) {
                            memoizedStatements.set(script.uri, statementsPromise);
                        }
                        promises.push(statementsPromise);
                    }
                } else if (script.content !== undefined) {
                    promises.push(lexAndParseScript(script));
                }
            }
            let parsedScripts = await pSettle(promises);

            // don't execute anything if there were reading, lexing, or parsing errors
            if (parsedScripts.some((script) => script.isRejected)) {
                const messages = parsedScripts
                    .filter((script) => script.isRejected)
                    .map((rejection) => (rejection as PromiseRejectedResult).reason.message);
                throw new Error(messages.join("\n"));
            }

            // combine statements from all scripts into one array
            return parsedScripts
                .map((script) => (script.isFulfilled ? script.value : []))
                .reduce((allStatements, fileStatements) => [...allStatements, ...fileStatements], []);
        };
    }
}
