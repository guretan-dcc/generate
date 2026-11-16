// js/main.js
import { DropZone } from './dropZone.js';
import { HandleTreeBuilder } from './handleTreeBuilder.js';
import { MarkdownBuilder } from './markdownBuilder.js';
import { HandleStore } from './handleStore.js';

const status = document.getElementById('status');
const ignoreHidden = document.getElementById('ignoreHidden');
const ignoreNodeModules = document.getElementById('ignoreNodeModules');
const useGitignore = document.getElementById('useGitignore');
const openButton = document.getElementById('openButton');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const markdownBuilder = new MarkdownBuilder();
const handleStore = new HandleStore();

let lastHandle = null;

function buildIgnoreRules() {
	const rules = [];
	if (ignoreHidden.checked) rules.push({ type: 'prefix', value: '.' });
	if (ignoreNodeModules.checked) rules.push({ type: 'exact', value: 'node_modules' });
	return rules;
}

// ドロップ/オープン時はhandleを保持するだけ。中身の読み込み・生成はしない
function setHandle(handle) {
	lastHandle = handle;
	openButton.style.display = 'none';
	handleStore.save(handle);
	status.textContent = `対象: ${handle.name}\n「全文コピー」または「MDをダウンロード」を押した時点の内容で生成します`;
}

// ボタンが押された時だけ、その時点のフォルダ内容とチェック状態でMarkdownを生成する
async function generateMarkdown() {
	const treeBuilder = new HandleTreeBuilder(buildIgnoreRules(), {
		useGitignore: useGitignore.checked
	});
	const tree = await treeBuilder.build(lastHandle);
	return markdownBuilder.build(tree);
}

new DropZone(setHandle);

openButton.addEventListener('click', async () => {
	const previous = await handleStore.load();
	const handle = await window.showDirectoryPicker(
		previous ? { startIn: previous } : {}
	);
	setHandle(handle);
});

function flashLabel(button, message) {
	const original = button.textContent;
	button.textContent = message;
	setTimeout(() => {
		button.textContent = original;
	}, 1500);
}

copyButton.addEventListener('click', async () => {
	if (!lastHandle) return;

	const markdown = await generateMarkdown();

	try {
		await navigator.clipboard.writeText(markdown);
	} catch {
		// Clipboard APIが使えない環境向けのフォールバック(一時的なtextareaを使う)
		const temp = document.createElement('textarea');
		temp.value = markdown;
		document.body.appendChild(temp);
		temp.select();
		document.execCommand('copy');
		temp.remove();
	}

	flashLabel(copyButton, 'コピーしました');
});

downloadButton.addEventListener('click', async () => {
	if (!lastHandle) return;

	const markdown = await generateMarkdown();

	const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${lastHandle.name || 'output'}.md`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);

	flashLabel(downloadButton, 'ダウンロードしました');
});
