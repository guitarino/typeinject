import { DEP_NAME } from "./utils";
import { SCOPE_NAME } from "./scopes";
import { TContainerInternal, TDependencyDecorator } from "../types";
import { createImplementation } from "../createImplementation";

export function createDependencyDecorator(container: TContainerInternal): TDependencyDecorator {
    return function dependency(id: string) {
        return function (Class: any): any {
            const { prototype } = Class;
            const userDependencies = prototype[DEP_NAME] || [];
            const scope = prototype[SCOPE_NAME];
            delete prototype[DEP_NAME];
            delete prototype[SCOPE_NAME];
            return createImplementation(container, id, userDependencies, Class, scope);
        }
    }
}