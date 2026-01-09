import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, Menu } from 'obsidian';
import { WikiJSSettings } from './src/types';
import { WikiJSSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { UploadModal } from './src/upload-modal';
import { WikiJSAPI } from './src/wikijs-api';
import { MarkdownProcessor } from './src/markdown-processor';

export default class NoteToWikiJSPlugin extends Plugin {
	settings: WikiJSSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('upload', 'Upload current note to Wiki.js', (evt: MouseEvent) => {
			this.uploadCurrentNote();
		});
		ribbonIconEl.addClass('wikijs-ribbon-icon');

		// Add command to upload current note
		this.addCommand({
			id: 'upload-current-note',
			name: 'Upload current note to Wiki.js',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.uploadCurrentNote();
			}
		});

		// Add command to upload specific file
		this.addCommand({
			id: 'upload-file-to-wikijs',
			name: 'Upload file to Wiki.js',
			callback: () => {
				this.selectAndUploadFile();
			}
		});

	// Add command to bulk upload files
	// TODO: Re-enable after adding image upload support for bulk upload
	// this.addCommand({
	// 	id: 'bulk-upload-to-wikijs',
	// 	name: 'Bulk upload folder to Wiki.js',
	// 	callback: () => {
	// 		this.bulkUploadFolder();
	// 	}
	// });

		// Add context menu item for files
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Upload to Wiki.js')
							.setIcon('upload')
							.onClick(async () => {
								this.uploadFile(file);
							});
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new WikiJSSettingTab(this.app, this));

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Wiki.js Ready');
		statusBarItemEl.addClass('wikijs-status-bar');

		console.log('Note to Wiki.js plugin loaded');
	}

	onunload() {
		console.log('Note to Wiki.js plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	showNotice(message: string, duration: number = 5000) {
		new Notice(message, duration);
	}

	private async uploadCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		
		if (!activeFile) {
			this.showNotice('No active file to upload');
			return;
		}

		if (activeFile.extension !== 'md') {
			this.showNotice('Only markdown files can be uploaded to Wiki.js');
			return;
		}

		await this.uploadFile(activeFile);
	}

	private async uploadFile(file: TFile) {
		// Validate settings
		if (!this.settings.wikiUrl || !this.settings.apiToken) {
			this.showNotice('Please configure Wiki.js settings first (URL and API Token)');
			return;
		}

		// Test connection before uploading
		const api = new WikiJSAPI(this.settings);
		const isConnected = await api.checkConnection();
		
		if (!isConnected) {
			this.showNotice('Cannot connect to Wiki.js. Please check your settings.');
			return;
		}

		// Open upload modal
		const modal = new UploadModal(this.app, this, file);
		modal.open();
	}

	private async selectAndUploadFile() {
		const files = this.app.vault.getMarkdownFiles();
		
		if (files.length === 0) {
			this.showNotice('No markdown files found in vault');
			return;
		}

		// Create file selection modal
		const modal = new FileSelectionModal(this.app, files, (file) => {
			this.uploadFile(file);
		});
		modal.open();
	}

	// TODO: Re-enable bulk upload after adding image upload support
	// private async bulkUploadFolder() {
	// 	const folders = this.app.vault.getAllLoadedFiles()
	// 		.filter(file => 'children' in file)
	// 		.map(folder => folder.path);

	// 	if (folders.length === 0) {
	// 		this.showNotice('No folders found in vault');
	// 		return;
	// 	}

	// 	// Create folder selection modal
	// 	const modal = new FolderSelectionModal(this.app, folders, async (folderPath) => {
	// 		await this.uploadFolderContents(folderPath);
	// 	});
	// 	modal.open();
	// }

	// private async uploadFolderContents(folderPath: string) {
	// 	const files = this.app.vault.getMarkdownFiles()
	// 		.filter(file => file.path.startsWith(folderPath));

	// 	if (files.length === 0) {
	// 		this.showNotice(`No markdown files found in folder: ${folderPath}`);
	// 		return;
	// 	}

	// 	const modal = new BulkUploadModal(this.app, this, files);
	// 	modal.open();
	// }
}

// File Selection Modal
class FileSelectionModal extends Modal {
	files: TFile[];
	onFileSelect: (file: TFile) => void;

	constructor(app: App, files: TFile[], onFileSelect: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onFileSelect = onFileSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select File to Upload' });

		const fileList = contentEl.createDiv('file-list');
		
		this.files.forEach(file => {
			const fileItem = fileList.createDiv('file-item');
			fileItem.style.cssText = 'padding: 8px; border: 1px solid var(--background-modifier-border); margin: 4px 0; cursor: pointer; border-radius: 4px;';
			
			fileItem.createEl('div', { text: file.name, cls: 'file-name' });
			fileItem.createEl('div', { text: file.path, cls: 'file-path setting-item-description' });
			
			fileItem.onclick = () => {
				this.close();
				this.onFileSelect(file);
			};

			fileItem.onmouseenter = () => {
				fileItem.style.backgroundColor = 'var(--background-modifier-hover)';
			};

			fileItem.onmouseleave = () => {
				fileItem.style.backgroundColor = '';
			};
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// TODO: Re-enable after adding image upload support for bulk upload
// Folder Selection Modal
class FolderSelectionModal extends Modal {
	folders: string[];
	onFolderSelect: (folder: string) => void;

	constructor(app: App, folders: string[], onFolderSelect: (folder: string) => void) {
		super(app);
		this.folders = folders;
		this.onFolderSelect = onFolderSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select Folder to Upload' });

		const folderList = contentEl.createDiv('folder-list');
		
		this.folders.forEach(folder => {
			const folderItem = folderList.createDiv('folder-item');
			folderItem.style.cssText = 'padding: 8px; border: 1px solid var(--background-modifier-border); margin: 4px 0; cursor: pointer; border-radius: 4px;';
			
			folderItem.createEl('div', { text: folder || '(Root)', cls: 'folder-name' });
			
			folderItem.onclick = () => {
				this.close();
				this.onFolderSelect(folder);
			};

			folderItem.onmouseenter = () => {
				folderItem.style.backgroundColor = 'var(--background-modifier-hover)';
			};

			folderItem.onmouseleave = () => {
				folderItem.style.backgroundColor = '';
			};
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// TODO: Re-enable after adding image upload support for bulk upload
// Bulk Upload Modal
class BulkUploadModal extends Modal {
	plugin: NoteToWikiJSPlugin;
	files: TFile[];
	private uploadProgress: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {};
	private uploadResults: { [key: string]: string } = {};

	constructor(app: App, plugin: NoteToWikiJSPlugin, files: TFile[]) {
		super(app);
		this.plugin = plugin;
		this.files = files;
		
		// Initialize progress tracking
		this.files.forEach(file => {
			this.uploadProgress[file.path] = 'pending';
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: `Bulk Upload (${this.files.length} files)` });

		// File list
		const fileListDiv = contentEl.createDiv('bulk-upload-list');
		fileListDiv.style.cssText = 'max-height: 300px; overflow-y: auto; margin: 10px 0;';

		this.files.forEach(file => {
			const fileItem = fileListDiv.createDiv('bulk-upload-item');
			fileItem.style.cssText = 'padding: 8px; border: 1px solid var(--background-modifier-border); margin: 4px 0; border-radius: 4px;';
			
			const fileName = fileItem.createEl('span', { text: file.name });
			const status = fileItem.createEl('span', { cls: 'upload-status' });
			status.style.cssText = 'float: right; font-size: 0.8em;';
			
			this.updateFileStatus(file.path, status);
		});

		// Progress bar
		const progressDiv = contentEl.createDiv('progress-container');
		const progressBar = progressDiv.createEl('div', { cls: 'progress-bar' });
		progressBar.style.cssText = 'width: 100%; height: 20px; background: var(--background-secondary); border-radius: 10px; margin: 10px 0;';
		
		const progressFill = progressBar.createEl('div', { cls: 'progress-fill' });
		progressFill.style.cssText = 'height: 100%; background: var(--color-accent); border-radius: 10px; width: 0%; transition: width 0.3s;';

		// Buttons
		const buttonDiv = contentEl.createDiv('modal-button-container');
		
		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelButton.onclick = () => this.close();

		const uploadButton = buttonDiv.createEl('button', { 
			text: 'Start Upload',
			cls: 'mod-cta'
		});
		uploadButton.onclick = () => this.startBulkUpload(progressFill, uploadButton);
	}

	private updateFileStatus(filePath: string, statusElement: HTMLElement) {
		const status = this.uploadProgress[filePath];
		const result = this.uploadResults[filePath];
		
		switch (status) {
			case 'pending':
				statusElement.textContent = '⏳ Pending';
				statusElement.style.color = 'var(--text-muted)';
				break;
			case 'uploading':
				statusElement.textContent = '🔄 Uploading...';
				statusElement.style.color = 'var(--color-accent)';
				break;
			case 'success':
				statusElement.textContent = '✅ Success';
				statusElement.style.color = 'var(--color-green)';
				break;
			case 'error':
				statusElement.textContent = '❌ Error';
				statusElement.style.color = 'var(--color-red)';
				if (result) {
					statusElement.title = result;
				}
				break;
		}
	}

	private async startBulkUpload(progressFill: HTMLElement, uploadButton: HTMLButtonElement) {
		uploadButton.textContent = 'Uploading...';
		uploadButton.disabled = true;

		const api = new WikiJSAPI(this.plugin.settings);
		const processor = new MarkdownProcessor(this.plugin.settings);

		let completed = 0;
		const total = this.files.length;

		for (const file of this.files) {
			this.uploadProgress[file.path] = 'uploading';
			this.updateFileStatusInModal(file.path);
			
			try {
				const content = await this.app.vault.read(file);
				const path = processor.generatePath(file.name, file.parent?.path);
				const processed = processor.processMarkdown(content, file.name, path);
				const tags = processor.extractTags(content);

				// Check if page exists
				let existingPage;
				try {
					existingPage = await api.getPageByPath(path);
				} catch (error) {
					existingPage = null;
				}

				let result;
				if (existingPage) {
					result = await api.updatePage(
						existingPage.id,
						path,
						processed.title,
						processed.content,
						undefined,
						tags
					);
				} else {
					result = await api.createPage(
						path,
						processed.title,
						processed.content,
						undefined,
						tags
					);
				}

				if (result.success) {
					this.uploadProgress[file.path] = 'success';
					this.uploadResults[file.path] = result.pageUrl || '';
				} else {
					this.uploadProgress[file.path] = 'error';
					this.uploadResults[file.path] = result.message;
				}

			} catch (error) {
				this.uploadProgress[file.path] = 'error';
				this.uploadResults[file.path] = error.message;
			}

			completed++;
			const progress = (completed / total) * 100;
			progressFill.style.width = `${progress}%`;
			
			this.updateFileStatusInModal(file.path);
		}

		const successCount = Object.values(this.uploadProgress).filter(status => status === 'success').length;
		const errorCount = Object.values(this.uploadProgress).filter(status => status === 'error').length;

		uploadButton.textContent = `Completed (${successCount} success, ${errorCount} errors)`;
		
		this.plugin.showNotice(`Bulk upload completed: ${successCount} successful, ${errorCount} errors`);
	}

	private updateFileStatusInModal(filePath: string) {
		const statusElements = this.contentEl.querySelectorAll('.upload-status');
		const fileIndex = this.files.findIndex(f => f.path === filePath);
		
		if (fileIndex >= 0 && statusElements[fileIndex]) {
			this.updateFileStatus(filePath, statusElements[fileIndex] as HTMLElement);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
