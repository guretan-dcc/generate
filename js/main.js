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
let currentMarkdown = '';
let currentName = 'output';

function buildIgnoreRules() {
	const rules = [];
	if (ignoreHidden.checked) rules.push({ type: 'prefix', value: '.' });
	if (ignoreNodeModules.checked) rules.push({ type: 'exact', value: 'node_modules' });
	return rules;
}

async function render(handle) {
	lastHandle = handle;
	openButton.style.display = 'none';
	handleStore.save(handle);
	const treeBuilder = new HandleTreeBuilder(buildIgnoreRules(), {
		useGitignore: useGitignore.checked
	});
	const tree = await treeBuilder.build(handle);
	currentMarkdown = await markdownBuilder.build(tree);
	currentName = handle.name || 'output';
	status.textContent = `読み込み済み: ${currentName}\n(${currentMarkdown.length.toLocaleString()} 文字)\n「MDをダウンロード」または「全文コピー」を使ってください`;
}

function reRender() {
	if (lastHandle) render(lastHandle);
}

new DropZone(render);

openButton.addEventListener('click', async () => {
	const previous = await handleStore.load();
	const handle = await window.showDirectoryPicker(
		previous ? { startIn: previous } : {}
	);
	render(handle);
});

function flashLabel(button, message) {
	const original = button.textContent;
	button.textContent = message;
	setTimeout(() => {
		button.textContent = original;
	}, 1500);
}

copyButton.addEventListener('click', async () => {
	if (!currentMarkdown) return;

	try {
		await navigator.clipboard.writeText(currentMarkdown);
	} catch {
		// Clipboard APIが使えない環境向けのフォールバック(一時的なtextareaを使う)
		const temp = document.createElement('textarea');
		temp.value = currentMarkdown;
		document.body.appendChild(temp);
		temp.select();
		document.execCommand('copy');
		temp.remove();
	}

	flashLabel(copyButton, 'コピーしました');
});

downloadButton.addEventListener('click', () => {
	if (!currentMarkdown) return;

	const blob = new Blob([currentMarkdown], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${currentName}.md`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);

	flashLabel(downloadButton, 'ダウンロードしました');
});

ignoreHidden.addEventListener('change', reRender);
ignoreNodeModules.addEventListener('change', reRender);
useGitignore.addEventListener('change', reRender);
window.addEventListener('focus', reRender);
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') reRender();
});
setInterval(reRender, 60_000);