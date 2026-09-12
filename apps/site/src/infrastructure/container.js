// Central dependency container.
//
// This is the single place allowed to reference a concrete infrastructure
// implementation. Page components resolve dependencies through the facade
// below and depend only on the IDocsContentSource contract. A lightweight
// registry is used deliberately — for a static presentation site a full DI
// framework would be unnecessary ceremony.

import { DOCS_CONTENT_SOURCE } from '@/contracts/DocsContentSource';
import { InMemoryDocsContentSource } from '@/infrastructure/InMemoryDocsContentSource';

class Container {
  constructor() {
    /** @type {Map<string, Function>} */
    this._factories = new Map();
    /** @type {Map<string, any>} */
    this._singletons = new Map();
  }

  registerSingleton(token, factory) {
    this._factories.set(token, factory);
    return this;
  }

  resolve(token) {
    if (this._singletons.has(token)) return this._singletons.get(token);
    const factory = this._factories.get(token);
    if (!factory) throw new Error(`No provider registered for token: ${token}`);
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
  }
  return _container;
}

/** @returns {import('@/contracts/DocsContentSource').IDocsContentSource} */
export function getDocsContentSource() {
  return getContainer().resolve(DOCS_CONTENT_SOURCE);
}
