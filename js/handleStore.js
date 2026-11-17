// FileSystemHandleをIndexedDBに保存・読み出しするための最小限のラッパー

const DB_NAME = 'code-export-tool';
const STORE_NAME = 'handles';
const KEY = 'lastOpened';
const LIST_KEY = 'list';

export class HandleStore {
	#dbPromise;

	constructor() {
		this.#dbPromise = this.#openDB();
	}

	#openDB() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, 1);
			
			request.onupgradeneeded = () => {
				request.result.createObjectStore(STORE_NAME);
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async save(handle) {
		const db = await this.#dbPromise;
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).put(handle, KEY);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	// 一覧(複数のhandle)を丸ごと保存する
	async saveList(handles) {
		const db = await this.#dbPromise;
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).put(handles, LIST_KEY);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	// 保存済みの一覧を返す。一覧が未保存なら、旧形式(1件のみ)を引き継ぐ
	async loadList() {
		const db = await this.#dbPromise;
		const list = await new Promise((resolve, reject) => {
			const request = db.transaction(STORE_NAME, 'readonly')
				.objectStore(STORE_NAME).get(LIST_KEY);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
		if (list) return list;

		const single = await this.load();
		return single ? [single] : [];
	}

	async load() {
		const db = await this.#dbPromise;
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const request = tx.objectStore(STORE_NAME).get(KEY);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
	}
}