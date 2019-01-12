import {
    TypeIdentifierMap,
    TImplementationMap,
    TImplementationScopes,
    TSingletons,
    TDependencies,
    TImplementationScope,
    TConfiguration,
    TAnyImplementation,
    TDependencyUserDescriptor,
    TDependencyDescriptor,
    TContainerInternal
} from "./types";

export class Container implements TContainerInternal {
    private typeIndex: number = 0;
    private typeIdentifiers: TypeIdentifierMap = {};
    private implementations: TImplementationMap = {};
    private scopes: TImplementationScopes = {};
    private singletons: TSingletons = {};
    private dependencies: TDependencies = {};
    private defaultScope: TImplementationScope = 'transient';
    private defaultLazy: boolean = false;
    private isSingletonWarningDisabled: boolean = false;
    private isStaticWarningDisabled: boolean = false;

    public configure = (configuration: TConfiguration) => {
        if (configuration.defaultScope != null) {
            this.defaultScope = configuration.defaultScope;
        }
        if (configuration.defaultLazy != null) {
            this.defaultLazy = configuration.defaultLazy;
        }
        if (configuration.isSingletonWarningDisabled != null) {
            this.isSingletonWarningDisabled = configuration.isSingletonWarningDisabled;
        }
        if (configuration.isStaticWarningDisabled != null) {
            this.isStaticWarningDisabled = configuration.isStaticWarningDisabled;
        }
    }

    private addTypeIdentifier(id: string, children: string[]): string {
        if (!this.typeIdentifiers[id]) {
            this.typeIdentifiers[id] = [];
        }
        const typeIdentifiers = this.typeIdentifiers[id];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const grandchildren = this.typeIdentifiers[child];
            if (!~typeIdentifiers.indexOf(child)) {
                typeIdentifiers.push(child);
            }
            if (grandchildren) {
                this.addTypeIdentifier(id, grandchildren);
            }
        }
        return id;
    }

    public type = (...children: string[]) => {
        return this.addTypeIdentifier(`_dinjType${this.typeIndex++}`, children);
    }

    private addImplementation(id: string, implementation: TAnyImplementation) {
        if (!this.implementations[id]) {
            this.implementations[id] = [];
        }
        this.implementations[id].push(implementation);
    }

    public registerImplementation(id: string, implementation: TAnyImplementation, scope?: TImplementationScope) {
        const children = this.typeIdentifiers[id];
        this.addImplementation(id, implementation);
        this.scopes[id] = scope ? scope : this.defaultScope;
        if (children) {
            for (let i = 0; i < children.length; i++) {
                this.addImplementation(children[i], implementation);
            }
        }
    }

    public registerDependencies(id: string, userDependencies: TDependencyUserDescriptor[]) {
        const dependencies: TDependencyDescriptor[] = [];
        for (let i = 0; i < userDependencies.length; i++) {
            const userDependency = userDependencies[i];
            dependencies.push({
                isLazy: userDependency.isLazy != null ? userDependency.isLazy : this.defaultLazy,
                isMulti: userDependency.isMulti != null ? userDependency.isMulti : false,
                name: userDependency.name,
                id: userDependency.id
            });
        }
        this.dependencies[id] = dependencies;
    }
    
    private createLazyGetter(dependency: TDependencyDescriptor) {
        let dependencyInstance: any = null;
        return () => {
            if (!dependencyInstance) {
                if (dependency.isMulti) {
                    dependencyInstance = this.getMulti(dependency.id);
                }
                else {
                    dependencyInstance = this.get(dependency.id);
                }
            }
            return dependencyInstance;
        }
    }

    public transferStaticProperties(klass: TAnyImplementation, implementation: TAnyImplementation) {
        let propertyIds = [
            ...Object.getOwnPropertyNames(klass),
            ...Object.getOwnPropertySymbols(klass)
        ];
        for (var i = 0; i < propertyIds.length; i++) {
            try {
                const propertyId = propertyIds[i];
                const descriptor = Object.getOwnPropertyDescriptor(klass, propertyId);
                if (descriptor) {
                    Object.defineProperty(implementation, propertyId, descriptor);
                }
            }
            catch(_) {
                if (!this.isStaticWarningDisabled) {
                    console.warn(`Not able to transfer all static properties of provided class. To disable this warning, configure 'isStaticWarningDisabled' to be 'true'.`);
                }
            }
        }
        return implementation;
    }

    public getSelf(id: string, instance: any) {
        if (this.scopes[id] === 'singleton') {
            if (!this.singletons[id]) {
                this.singletons[id] = instance;
            }
            else if(!this.isSingletonWarningDisabled) {
                console.warn(`The dependency ${id} is configured as a singleton. Creating it with 'new' may be unintentional. To disable this warning, configure 'isSingletonWarningDisabled' to be 'true'.`);
            }
        }
        const dependencies = this.dependencies[id];
        for (let i = 0; i < dependencies.length; i++) {
            const dependency = dependencies[i];
            if (dependency.isLazy) {
                Object.defineProperty(instance, dependency.name, {
                    get: this.createLazyGetter(dependency)
                })
            }
            else {
                if (dependency.isMulti) {
                    instance[dependency.name] = this.getMulti(dependency.id);
                }
                else {
                    instance[dependency.name] = this.get(dependency.id);
                }
            }
        }
    }

    public get = <T>(id: string, index: number = 0): T => {
        if (this.scopes[id] === 'singleton') {
            if (this.singletons[id]) {
                return this.singletons[id];
            }
        }
        const implementation = this.implementations[id][index];
        const instance = new implementation();
        if (this.scopes[id] === 'singleton') {
            this.singletons[id] = instance;
        }
        return instance;
    }

    private getMulti<T>(id: string): T {
        const implementationCount = this.implementations[id].length;
        const instances: any = [];
        for (let i = 0; i < implementationCount; i++) {
            instances.push(this.get(id, i));
        }
        return instances;
    }
}