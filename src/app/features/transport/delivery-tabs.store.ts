import { Injectable } from '@angular/core';

export interface DeliveryTabSnapshot {
  deliveryId: string | null;
  originalRecord?: Record<string, any>;
  changedForm: Record<string, any>;
  record?: Record<string, any>;
  form?: Record<string, any>;
}

export interface DeliveryTabsSnapshot {
  businessId: string;
  tabs: DeliveryTabSnapshot[];
  activeTab: number;
}

@Injectable({ providedIn: 'root' })
export class DeliveryTabsStore {
  private database?: Promise<IDBDatabase>;
  private writes: Promise<void> = Promise.resolve();

  async load(businessId: string): Promise<DeliveryTabsSnapshot | null> {
    await this.writes.catch(() => undefined);
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction('tabs', 'readonly').objectStore('tabs').get(businessId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  save(snapshot: DeliveryTabsSnapshot): Promise<void> {
    this.writes = this.writes.catch(() => undefined).then(async () => {
      const database = await this.open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('tabs', 'readwrite');
        transaction.objectStore('tabs').put(snapshot);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    });
    return this.writes;
  }

  remove(businessId: string): Promise<void> {
    this.writes = this.writes.catch(() => undefined).then(async () => {
      const database = await this.open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('tabs', 'readwrite');
        transaction.objectStore('tabs').delete(businessId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    });
    return this.writes;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = indexedDB.open('bill-for-bill-delivery-tabs', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('tabs', { keyPath: 'businessId' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.database;
  }
}
