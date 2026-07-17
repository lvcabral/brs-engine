import { getLibrarySource, Lexer, logError, Parser, preprocessor as PP, Stmt, FileSystem } from "brs-engine";
import { ComponentDefinition, ComponentScript } from "./ComponentDefinition";
import { SGNodeFactory } from "../factory/NodeFactory";
import * as path from "path";

/**
 * Resolves the function scope for SceneGraph components based on their
 * inheritance hierarchy.
 */
export class ComponentScopeResolver {
    private readonly excludedNames: string[] = ["init"];
    private readonly parserLexerFn: (scripts: ComponentScript[]) => Stmt.Statement[];
    /** Parsed library function statements, keyed by library name — each library is parsed once per app. */
    private readonly memoizedLibraries = new Map<string, Stmt.Function[]>();

    /**
     * @param componentMap Component definition map to reference for function resolution.
     * @param fs File system instance for reading files.
     * @param manifest Manifest map for resource resolution.
     */
    constructor(
        readonly componentMap: Map<string, ComponentDefinition>,
        private readonly fs: FileSystem,
        private readonly manifest: Map<string, string>
    ) {
        this.parserLexerFn = this.getLexerParserFn(fs, manifest);
    }

    /**
     * Resolves the component functions in scope based on the extends hierarchy.
     * @param component Instance of the component to resolve function scope for.
     * @returns All statements in scope for the resolved component
     */
    public resolve(component: ComponentDefinition): Stmt.Statement[] {
        const statementMap = Array.from(this.getStatements(component));
        return this.flatten(statementMap, this.getDeclaredLibraries(statementMap));
    }

    /**
     * Collects the names of BrightScript libraries declared via `Library` statements
     * in any script of the component hierarchy.
     * @param statementMap Statement collections broken up by component.
     * @returns The set of declared library names.
     */
    private getDeclaredLibraries(statementMap: Stmt.Statement[][]): Set<string> {
        const libraryNames = new Set<string>();
        for (const statements of statementMap) {
            for (const statement of statements) {
                const filePath = statement instanceof Stmt.Library ? statement.tokens.filePath : undefined;
                if (filePath) {
                    libraryNames.add(filePath.text.slice(1, -1));
                }
            }
        }
        // bslDefender depends on bslCore, so load it as well
        if (libraryNames.has("v30/bslDefender.brs")) {
            libraryNames.add("v30/bslCore.brs");
        }
        return libraryNames;
    }

    /**
     * Loads and parses a BrightScript library, keeping only its function definitions.
     * Results are memoized so each library is lexed/parsed at most once per resolver.
     * @param libName The library name as declared in the `Library` statement.
     * @returns The library's function statements (empty when unknown or not required by the manifest).
     */
    private getLibraryFunctions(libName: string): Stmt.Function[] {
        let functions = this.memoizedLibraries.get(libName);
        if (!functions) {
            functions = [];
            const source = getLibrarySource(this.fs, libName, this.manifest);
            if (source !== undefined) {
                const lexer = new Lexer();
                const parser = new Parser();
                lexer.onError(logError);
                parser.onError(logError);
                const scanResults = lexer.scan(source, libName);
                const parseResults = parser.parse(scanResults.tokens);
                functions = parseResults.statements.filter(
                    (statement): statement is Stmt.Function => statement instanceof Stmt.Function
                );
            }
            this.memoizedLibraries.set(libName, functions);
        }
        return functions;
    }

    /**
     * Takes a sequence of statement collections and flattens them into a
     * single statement collection. This function assumes that the components
     * given in the statement map are in order of hierarchy with the furthest
     * inheriting component first.
     * @param statementMap Statement collections broken up by component.
     * @param libraryNames Names of libraries declared by the hierarchy's scripts.
     * @returns A collection of statements that have been flattened based on hierarchy.
     */
    private flatten(statementMap: Stmt.Statement[][], libraryNames: Set<string>): Stmt.Statement[] {
        const isFunction = (statement: Stmt.Statement): statement is Stmt.Function =>
            statement instanceof Stmt.Function;
        // Component scripts only contribute their function definitions to the component's scope;
        // top-level executable statements (e.g. a stray `print` or `library`) must not be run.
        let statements: Stmt.Function[] = (statementMap.shift() || []).filter(isFunction);
        let statementMemo = new Set(statements.map((statement) => statement.name.text.toLowerCase()));
        while (statementMap.length > 0) {
            let extendedFns = statementMap.shift() || [];
            statements = statements.concat(
                extendedFns.filter(isFunction).filter((statement) => {
                    let statementName = statement.name.text.toLowerCase();
                    let haveFnName = statementMemo.has(statementName);
                    if (!haveFnName) {
                        statementMemo.add(statementName);
                    }
                    return !haveFnName && !this.excludedNames.includes(statementName);
                })
            );
        }
        // Append the functions of any `Library` declared by the hierarchy's scripts;
        // functions defined by the components themselves take precedence.
        for (const libName of libraryNames) {
            for (const libFunction of this.getLibraryFunctions(libName)) {
                const functionName = libFunction.name.text.toLowerCase();
                if (!statementMemo.has(functionName)) {
                    statementMemo.add(functionName);
                    statements.push(libFunction);
                }
            }
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

    /**
     * Creates a memoized lexer/parser function for component scripts.
     * @param fs File system instance for reading files.
     * @param manifest Manifest map for resource resolution.
     * @returns A function that lexes and parses component scripts.
     */
    private getLexerParserFn(fs: FileSystem, manifest: Map<string, string>) {
        /**
         * Map file URIs to that script's statements, so each shared file is only parsed once.
         */
        const memoizedStatements = new Map<string, Stmt.Statement[]>();
        return function parse(scripts: ComponentScript[]): Stmt.Statement[] {
            function lexAndParseScript(script: ComponentScript) {
                let contents;
                let filename;
                if (script.uri !== undefined) {
                    filename = script.uri.replaceAll(/[/\\]+/g, path.posix.sep);
                    try {
                        contents = fs.readFileSync(filename, "utf-8");
                        script.content = contents;
                    } catch (err) {
                        let errno = (err as NodeJS.ErrnoException)?.errno || -4858;
                        throw new Error(`brs: can't open file '${filename}': [Errno ${errno}]`);
                    }
                } else if (script.content === undefined) {
                    throw new Error("brs: invalid script object");
                } else {
                    contents = script.content;
                    filename = script.xmlPath || "xml";
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

            const statements: Stmt.Statement[] = [];
            for (const script of scripts) {
                if (script.uri !== undefined) {
                    let parsed = memoizedStatements.get(script.uri);
                    if (!parsed) {
                        parsed = lexAndParseScript(script);
                        memoizedStatements.set(script.uri, parsed);
                    }
                    statements.push(...parsed);
                } else if (script.content !== undefined) {
                    statements.push(...lexAndParseScript(script));
                }
            }
            return statements;
        };
    }
}
