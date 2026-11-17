// js/main.js
import { DropZone } from './dropZone.js';
import { HandleTreeBuilder } from './handleTreeBuilder.js';
import { MarkdownBuilder } from './markdownBuilder.js';
import { HandleStore } from './handleStore.js';

const status = document.getElementById('status');
const folderList = document.getElementById('folderList');
const ignoreHidden = document.getElementById('ignoreHidden');
const ignoreNodeModules = document.getElementById('ignoreNodeModules');
const useGitignore = document.getElementById('useGitignore');
const openButton = document.getElementById('openButton');
const markdownBuilder = new MarkdownBuilder();
const handleStore = new HandleStore();

// 登録済みのフォルダ一覧(画面の並び順と同じ)
const handles = [];

function buildIgnoreRules() {
	const rules = [];
	if (ignoreHidden.checked) rules.push({ type: 'prefix', value: '.' });
	if (ignoreNodeModules.checked) rules.push({ type: 'exact', value: 'node_modules' });
	return rules;
}

// 読み取り権限を確認する。切れていれば再度許可を求める(ボタン押下などのユーザー操作の中で呼ぶこと)
async function ensurePermission(handle) {
	const options = { mode: 'read' };
	if ((await handle.queryPermission(options)) === 'granted') return true;
	return (await handle.requestPermission(options)) === 'granted';
}

// ボタンが押された時だけ、その時点のフォルダ内容とチェック状態でMarkdownを生成する
// 権限が得られなければnullを返す
async function generateMarkdown(handle) {
	if (!(await ensurePermission(handle))) return null;
	const treeBuilder = new HandleTreeBuilder(buildIgnoreRules(), {
		useGitignore: useGitignore.checked
	});
	const tree = await treeBuilder.build(handle);
	return markdownBuilder.build(tree);
}

function flashLabel(button, message) {
	const original = button.textContent;
	button.textContent = message;
	setTimeout(() => {
		button.textContent = original;
	}, 1500);
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// Clipboard APIが使えない環境向けのフォールバック(一時的なtextareaを使う)
		const temp = document.createElement('textarea');
		temp.value = text;
		document.body.appendChild(temp);
		temp.select();
		document.execCommand('copy');
		temp.remove();
	}
}

function downloadText(text, fileName) {
	const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

// 一覧が空のときだけ案内を表示する
function updateStatus() {
	status.hidden = handles.length > 0;
}

function saveList() {
	handleStore.saveList(handles).catch((error) => {
		console.error('一覧を保存できませんでした', error);
	});
}

function createButton(label) {
	const button = document.createElement('button');
	button.textContent = label;
	return button;
}

// 1フォルダ分の行を作る(名前・コピー・ダウンロード・削除)
function createRow(handle) {
	const row = document.createElement('li');
	row.className = 'folder';

	const name = document.createElement('span');
	name.className = 'name';
	name.textContent = handle.name;
	name.title = handle.name;

	const message = document.createElement('span');
	message.className = 'message';

	const copyButton = createButton('全文コピー');
	const downloadButton = createButton('MDをダウンロード');
	const removeButton = createButton('×');
	removeButton.title = '一覧から外す';

	// 押した時点の最新の内容で生成する
	async function run(button, doneLabel, action) {
		message.textContent = '';
		const markdown = await generateMarkdown(handle);
		if (markdown === null) {
			message.textContent = '読み取りが許可されませんでした';
			return;
		}
		await action(markdown);
		flashLabel(button, doneLabel);
	}

	copyButton.addEventListener('click', () =>
		run(copyButton, 'コピーしました', copyText)
	);
	downloadButton.addEventListener('click', () =>
		run(downloadButton, 'ダウンロードしました', (markdown) =>
			downloadText(markdown, `${handle.name || 'output'}.md`)
		)
	);
	removeButton.addEventListener('click', () => {
		handles.splice(handles.indexOf(handle), 1);
		row.remove();
		saveList();
		updateStatus();
	});

	row.append(name, message, copyButton, downloadButton, removeButton);
	return row;
}

// 一覧に追加する。同じフォルダが既にあれば追加しない
async function addHandle(handle, { save = true } = {}) {
	for (const existing of handles) {
		if (await existing.isSameEntry(handle)) return;
	}
	handles.push(handle);
	folderList.append(createRow(handle));
	updateStatus();
	if (save) saveList();
}

// ページを開いたとき、前回の一覧を復元する
async function restoreList() {
	try {
		for (const handle of await handleStore.loadList()) {
			await addHandle(handle, { save: false });
		}
	} catch (error) {
		console.error('前回の一覧を復元できませんでした', error);
	}
}

new DropZone(addHandle);

openButton.addEventListener('click', async () => {
	try {
		// 直近に追加したフォルダの場所から開く
		const startIn = handles.at(-1);
		const handle = await window.showDirectoryPicker(startIn ? { startIn } : {});
		await addHandle(handle);
	} catch (error) {
		// ダイアログのキャンセルは無視する
		if (error.name !== 'AbortError') throw error;
	}
});

restoreList();
