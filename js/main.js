// js/main.js
import { DropZone } from './dropZone.js';
import { HandleTreeBuilder } from './handleTreeBuilder.js';
import { MarkdownBuilder } from './markdownBuilder.js';
import { HandleStore } from './handleStore.js';

const output = document.getElementById('output');
const ignoreHidden = document.getElementById('ignoreHidden');
const ignoreNodeModules = document.getElementById('ignoreNodeModules');
const useGitignore = document.getElementById('useGitignore');
const openButton = document.getElementById('openButton');
const copyButton = document.getElementById('copyButton');
const markdownBuilder = new MarkdownBuilder();
const handleStore = new HandleStore();

let lastHandle = null;

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
	output.value = await markdownBuilder.build(tree);
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

copyButton.addEventListener('click', async () => {
	const text = output.value;
	if (!text) return;

	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// Clipboard APIが使えない環境向けのフォールバック
		output.select();
		document.execCommand('copy');
		output.setSelectionRange(0, 0);
	}

	const original = copyButton.textContent;
	copyButton.textContent = 'コピーしました';
	setTimeout(() => {
		copyButton.textContent = original;
	}, 1500);
});

ignoreHidden.addEventListener('change', reRender);
ignoreNodeModules.addEventListener('change', reRender);
useGitignore.addEventListener('change', reRender);
window.addEventListener('focus', reRender);
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') reRender();
});
setInterval(reRender, 60_000);