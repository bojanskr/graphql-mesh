import LocalForage from 'localforage';
import { KeyValueCache, KeyValueCacheSetOptions, YamlConfig } from '@graphql-mesh/types';
import { createInMemoryLRUDriver } from './InMemoryLRUDriver.js';

LocalForage.defineDriver(createInMemoryLRUDriver()).catch(err =>
  console.error('Failed at defining InMemoryLRU driver', err),
);

export default class LocalforageCache<V = any> implements KeyValueCache<V> {
  private localforage: LocalForage;
  constructor(config?: YamlConfig.LocalforageConfig) {
    const driverNames = config?.driver || ['INDEXEDDB', 'WEBSQL', 'LOCALSTORAGE', 'INMEMORY_LRU'];
    this.localforage = LocalForage.createInstance({
      name: config?.name || 'graphql-mesh-cache',
      storeName: config?.storeName || 'graphql-mesh-cache-store',
      // @ts-expect-error - Weird error
      driver: driverNames.map(driverName => LocalForage[driverName] ?? driverName),
      size: config?.size,
      version: config?.version,
      description: config?.description,
    });
  }

  async get(key: string) {
    const expiresAt = await this.localforage.getItem<number>(`${key}.expiresAt`);
    if (expiresAt && Date.now() > expiresAt) {
      await this.localforage.removeItem(key);
    }
    return this.localforage.getItem<V>(key.toString());
  }

  async getKeysByPrefix(prefix: string) {
    const keys = await this.localforage.keys();
    return keys.filter(key => key.startsWith(prefix));
  }

  async set(key: string, value: V, options?: KeyValueCacheSetOptions) {
    const jobs: Promise<any>[] = [this.localforage.setItem<V>(key, value)];
    if (options?.ttl) {
      jobs.push(this.localforage.setItem(`${key}.expiresAt`, Date.now() + options.ttl * 1000));
    }
    await Promise.all(jobs);
  }

  delete(key: string) {
    return this.localforage.removeItem(key);
  }
}
