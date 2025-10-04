// types/json.d.ts
declare global {
    interface JSON {
        parse(text: string, reviver?: ((this: any, key: string, value: any, context?: any) => any) | null): any;
    }
}
export {};
// types/json.d.ts
