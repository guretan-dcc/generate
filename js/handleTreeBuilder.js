import { GitignoreMatcher } from './gitignoreMatcher.js';

export class HandleTreeBuilder {
	#ignoreRules;
	#useGitignore;

	constructor(ignoreRules = [], { useGitignore = false } = {}) {
		this.#ignoreRules = ignoreRules;
		this.#useGitignore = useGitignore;
	}

	// gitignoreContexts: 親ディレクトリから引き継いだ { matcher, basePath } の配列
	// path: 選択したルートからの相対パス
	async build(handle, gitignoreContexts = [], path = '') {
		// 単体ファイルの場合は先に返す
		if(handle.kind ==='file')
			return this.#buildSingleFile(handle);

		const children = [];
		for await (const child of handle.values()) children.push(child);

		// このディレクトリの.gitignoreがあれば、ルールとして追加する
		const contexts = await this.#withLocalGitignore(children, gitignoreContexts, path);

		const items = [];

		for (const child of children) {
			if (this.#matchesIgnoreRules(child.name)) continue;

			const childPath = path ? `${path}/${child.name}` : child.name;
			if (this.#isGitignored(contexts, childPath, child.kind === 'directory')) continue;

			if (child.kind === 'directory') {
				items.push(await this.build(child, contexts, childPath));
			} else if (child.kind === 'file') {
				items.push({
					type: 'file',
					name: child.name,
					handle: child
				});
			}
		}

		this.#sort(items);

		return {
			type: 'directory',
			name: handle.name,
			children: items
		};
	}

	// 直下に.gitignoreがあれば読み込み、引き継いだ一覧の末尾に加えて返す
	async #withLocalGitignore(children, contexts, path) {
		if (!this.#useGitignore) return contexts;

		const gitignore = children.find(
			(child) => child.kind === 'file' && child.name === '.gitignore'
		);
		if (!gitignore) return contexts;

		try {
			const file = await gitignore.getFile();
			const matcher = new GitignoreMatcher(await file.text());
			return [...contexts, { matcher, basePath: path }];
		} catch (e) {
			console.error('.gitignoreの読み込みエラー', e);
			return contexts;
		}
	}

	// 親から子の順に判定し、最後にマッチした結果を採用する(子の.gitignoreが優先)
	#isGitignored(contexts, path, isDirectory) {
		let ignored = false;
		for (const { matcher, basePath } of contexts) {
			const relative = basePath ? path.slice(basePath.length + 1) : path;
			const result = matcher.match(relative, isDirectory);
			if (result !== null) ignored = result;
		}
		return ignored;
	}

	#matchesIgnoreRules(name) {
		return this.#ignoreRules.some((rule) => {
			if (rule.type === 'exact') return name === rule.value;
			if (rule.type === 'prefix') return name.startsWith(rule.value);
			if (rule.type === 'suffix') return name.endsWith(rule.value);
			return false;
		});
	}

	// フォルダ→隠しファイル→拡張子→名前の順にソート
	#sort(items) {
		items.sort((a, b) => {
			// フォルダ＞ファイルの順に並べる
			if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;

			// 隠しファイル（例: .gitignore）を前方に並べる
			const isHiddenA = a.name.startsWith('.');
			const isHiddenB = b.name.startsWith('.');
			if (isHiddenA !== isHiddenB) return isHiddenA ? -1 : 1;

			// 拡張子順
			if (a.type === 'file') {
				const extentionA = this.#getExtention(a.name);
				const extentionB = this.#getExtention(b.name);
				if (extentionA !== extentionB)
					return extentionA.localeCompare(extentionB, undefined, { numeric: true });
			}

			// 名前の順
			return a.name.localeCompare(b.name, undefined, { numeric: true });
		});

	}

	// ファイル拡張子の取得
	#getExtention(name) {
		// 隠しファイルの場合最初のドットを消す
		if (name.startsWith('.'))
			name = name.slice(1);

		// 残りの文字列にドットが含まれていれば、最後のドット以降は拡張子とする
		if (!name.includes('.')) return '';
		return name.slice(name.indexOf('.') + 1);
	}

	// 単一ファイルを、ファイル1件だけを持つ擬似ディレクトリツリーとして返す
	#buildSingleFile(fileHandle) {
		return {
			type: 'directory',
			name: fileHandle.name,
			children: [
				{ type: 'file', name: fileHandle.name, handle: fileHandle }
			]
		};
	}
}