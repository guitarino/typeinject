import { escapeRegExp } from "./utils";

export function containsDependencyTree(text: string, dependencyTree: string[]) {
    const regex = new RegExp(
        dependencyTree
            .map(dep => `_typeinjectType[0-9]+\\\(${escapeRegExp(dep)}\\\)`)
            .join(` -> `)
    );
    return regex.test(text);
}