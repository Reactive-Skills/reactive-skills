// Central dependency container.
//
// This is the single place allowed to reference a concrete infrastructure
// implementation. Page components resolve dependencies through the facade
// below and depend only on the IDocsContentSource contract. A lightweight
// registry is used deliberately — for a static presentation site a full DI
// framework would be unnecessary ceremony.

import { DOCS_CONTENT_SOURCE } from '@/contracts/DocsContentSource';
import { InMemoryDocsContentSource } from '@/infrastructure/InMemoryDocsContentSource';
import { REGISTRY_CONTENT_SOURCE } from '@/contracts/RegistryContentSource';
import { InMemoryRegistryContentSource } from '@/infrastructure/InMemoryRegistryContentSource';

class Container {
  constructor() {
    /** @type {Map<any, Function>} */
    this._factories = new Map();
    /** @type {Map<any, any>} */
    this._singletons = new Map();
  }

  registerSingleton(token, factory) {
    this._factories.set(token, factory);
    return this;
  }

  resolve(token) {
    if (this._singletons.has(token)) return this._singletons.get(token);
    const factory = this._factories.get(token);
    if (!factory) throw new Error(`No provider registered for token: ${String(token)}`);
    const instance = factory(this);
    this._singletons.set(token, instance);
    return instance;
  }
}

let _container = null;

export function getContainer() {
  if (!_container) {
    _container = new Container();
    _container.registerSingleton(DOCS_CONTENT_SOURCE, () => new InMemoryDocsContentSource());
    _container.registerSingleton(REGISTRY_CONTENT_SOURCE, () => new InMemoryRegistryContentSource());
  }
  return _container;
}

/** @returns {import('@/contracts/DocsContentSource').IDocsContentSource} */
export function getDocsContentSource() {
  return getContainer().resolve(DOCS_CONTENT_SOURCE);
}

/** @returns {import('@/contracts/RegistryContentSource').IRegistryContentSource} */
export function getRegistryContentSource() {
  return getContainer().resolve(REGISTRY_CONTENT_SOURCE);
}

