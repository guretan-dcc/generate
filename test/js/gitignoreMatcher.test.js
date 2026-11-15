import { TestGroup } from '../helper/testHelper.js';
import { GitignoreMatcher } from '../../js/gitignoreMatcher.js';
import { HandleTreeBuilder } from '../../js/handleTreeBuilder.js';

const test = new TestGroup();

// --- 1. GitignoreMatcher単体 ---
const matcher = new GitignoreMatcher([
	'# コメント',
	'',
	'*.log',
	'dist/',
	'/build',
	'docs/*.tmp',
	'**/cache',
	'!keep.log'
].join('\n'));

test.checkValue('拡張子パターンは任意の階層にマッチ', matcher.isIgnored('a/b/x.log', false), true);
test.checkValue('!で再includeできる', matcher.isIgnored('keep.log', false), false);
test.checkValue('末尾/はディレクトリのみ(ディレクトリ)', matcher.isIgnored('dist', true), true);
test.checkValue('末尾/はディレクトリのみ(ファイルは対象外)', matcher.isIgnored('dist', false), false);
test.checkValue('先頭/はルート直下のみ', matcher.isIgnored('build', true), true);
test.checkValue('先頭/は深い階層にはマッチしない', matcher.isIgnored('src/build', true), false);
test.checkValue('途中に/があるパターンは基準位置から', matcher.isIgnored('docs/a.tmp', false), true);
test.checkValue('途中に/があるパターンは深い階層に効かない', matcher.isIgnored('x/docs/a.tmp', false), false);
test.checkValue('**/ は任意の深さにマッチ', matcher.isIgnored('a/b/cache', true), true);
test.checkValue('コメント行は無視される', matcher.isIgnored('# コメント', false), false);


// --- 2. HandleTreeBuilderとの統合 ---
function makeFile(name, content = '') {
	return {
		kind: 'file',
		name,
		async getFile() {
			return { async text() { return content; } };
		}
	};
}

function makeDir(name, children = []) {
	return {
		kind: 'directory',
		name,
		async *values() {
			yield* children;
		}
	};
}

function names(tree) {
	return tree.children.map((c) => (c.type === 'directory' ? `${c.name}/` : c.name));
}

const root = makeDir('root', [
	makeFile('.gitignore', '*.log\ndist/\n'),
	makeFile('a.js'),
	makeFile('debug.log'),
	makeDir('dist', [makeFile('bundle.js')]),
	makeDir('src', [
		makeFile('.gitignore', '!important.log\nsecret.js\n'),
		makeFile('b.js'),
		makeFile('secret.js'),
		makeFile('important.log'),
		makeFile('other.log')
	])
]);

test.checkFunction(
	'useGitignore有効: ルートの.gitignoreが反映される',
	async () => names(await new HandleTreeBuilder([], { useGitignore: true }).build(root)),
	['src/', '.gitignore', 'a.js']
);

test.checkFunction(
	'useGitignore有効: サブディレクトリの.gitignoreが優先され!で再includeできる',
	async () => {
		const tree = await new HandleTreeBuilder([], { useGitignore: true }).build(root);
		return names(tree.children.find((c) => c.name === 'src'));
	},
	['.gitignore', 'b.js', 'important.log']
);

test.checkFunction(
	'useGitignore無効(デフォルト): 従来どおり除外しない',
	async () => names(await new HandleTreeBuilder().build(root)),
	['dist/', 'src/', '.gitignore', 'a.js', 'debug.log']
);
