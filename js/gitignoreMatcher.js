// .gitignoreの中身を解釈して、パスが除外対象かどうかを判定する
export class GitignoreMatcher {
	#rules;

	constructor(text = '') {
		this.#rules = this.#parse(text);
	}

	// .gitignoreのある場所からの相対パス(例: "src/a.js")を判定する
	// 最後にマッチしたルールが優先される(!による再include対応)
	// 戻り値: true=除外 / false=!で再include / null=どのルールにも該当しない
	match(relativePath, isDirectory) {
		let result = null;
		for (const rule of this.#rules) {
			if (rule.directoryOnly && !isDirectory) continue;
			if (rule.regex.test(relativePath)) result = !rule.negated;
		}
		return result;
	}

	isIgnored(relativePath, isDirectory) {
		return this.match(relativePath, isDirectory) === true;
	}

	#parse(text) {
		const rules = [];

		for (let line of text.split(/\r?\n/)) {
			// 末尾の空白は無視する(\でエスケープされていない場合)
			line = line.replace(/(?<!\\)\s+$/, '');
			if (line === '' || line.startsWith('#')) continue;

			let negated = false;
			if (line.startsWith('!')) {
				negated = true;
				line = line.slice(1);
			}
			// 先頭の \# や \! はエスケープ
			if (line.startsWith('\\#') || line.startsWith('\\!')) line = line.slice(1);

			let directoryOnly = false;
			if (line.endsWith('/')) {
				directoryOnly = true;
				line = line.slice(0, -1);
			}
			if (line === '') continue;

			// 先頭または途中に/があれば、.gitignoreのある場所を基準に固定する
			const anchored = line.includes('/');
			if (line.startsWith('/')) line = line.slice(1);

			rules.push({
				negated,
				directoryOnly,
				regex: this.#toRegex(line, anchored)
			});
		}

		return rules;
	}

	#toRegex(pattern, anchored) {
		let source = '';

		for (let i = 0; i < pattern.length; i++) {
			const c = pattern[i];

			if (c === '*') {
				if (pattern[i + 1] === '*') {
					const prevIsBoundary = i === 0 || pattern[i - 1] === '/';
					const next = pattern[i + 2];
					if (prevIsBoundary && next === '/') {
						// "**/" は0個以上のディレクトリ
						source += '(?:.*/)?';
						i += 2;
						continue;
					}
					if (prevIsBoundary && next === undefined) {
						// 末尾の "/**" は配下すべて
						source += '.*';
						i += 1;
						continue;
					}
					// それ以外の ** は通常の * と同じ扱い
					i += 1;
				}
				source += '[^/]*';
			} else if (c === '?') {
				source += '[^/]';
			} else if (c === '[') {
				const end = pattern.indexOf(']', i + 2);
				if (end === -1) {
					source += '\\[';
				} else {
					let body = pattern.slice(i + 1, end);
					if (body.startsWith('!')) body = '^' + body.slice(1);
					source += `[${body.replace(/\\/g, '\\\\')}]`;
					i = end;
				}
			} else if (c === '\\' && i + 1 < pattern.length) {
				source += this.#escape(pattern[++i]);
			} else {
				source += this.#escape(c);
			}
		}

		// /を含まないパターンは、どの階層の同名ファイル/フォルダにもマッチする
		const prefix = anchored ? '^' : '^(?:.*/)?';
		return new RegExp(prefix + source + '$');
	}

	#escape(char) {
		return char.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
	}
}
