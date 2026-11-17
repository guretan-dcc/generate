// ドラッグ&ドロップを受け取り、handleを渡すイベント
export class DropZone {
	#onDrop;

	constructor(onDrop) {
		this.#onDrop = onDrop;

		// ドラッグ中の既定の動作を止める
		window.addEventListener('dragover', (e) => e.preventDefault());
		window.addEventListener('drop', (e) => e.preventDefault());

		// ドロップ時の処理
		window.addEventListener('drop', (e) => this.handleDrop(e));
	}

	async handleDrop(event) {
		// dataTransferはawaitをまたぐと無効になるため、先に全件分のhandle取得を同期的に開始する
		const requests = Array.from(event.dataTransfer.items)
			.filter((item) => item.kind === 'file') //URL等を除外
			.map((item) => item.getAsFileSystemHandle());

		const handles = await Promise.all(requests);
		for (const handle of handles) {
			if (handle) await this.#onDrop(handle);
		}
	}
}