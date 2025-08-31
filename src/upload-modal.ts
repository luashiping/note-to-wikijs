import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import NoteToWikiJSPlugin from '../main';
import { MarkdownProcessor } from './markdown-processor';
import { WikiJSAPI } from './wikijs-api';

export class UploadModal extends Modal {
	plugin: NoteToWikiJSPlugin;
	file: TFile;
	private processor: MarkdownProcessor;
	private api: WikiJSAPI;
	
	// Form fields
	private pathInput: string;
	private titleInput: string;
	private tagsInput: string;
	private descriptionInput: string;
	private content: string;

	constructor(app: App, plugin: NoteToWikiJSPlugin, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.processor = new MarkdownProcessor(plugin.settings);
		this.api = new WikiJSAPI(plugin.settings);
		
		// Initialize form fields
		this.initializeFields();
	}

	private async initializeFields() {
		const content = await this.app.vault.read(this.file);
		const processed = this.processor.processMarkdown(content, this.file.name);
		
		this.pathInput = this.processor.generatePath(this.file.name, this.file.parent?.path);
		this.titleInput = processed.title;
		this.content = processed.content;
		this.tagsInput = this.processor.extractTags(content).join(', ');
		this.descriptionInput = '';
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Upload to Wiki.jssss' });

		// File info
		const fileInfoDiv = contentEl.createDiv('file-info');
		fileInfoDiv.createEl('p', { text: `File: ${this.file.name}` });
		fileInfoDiv.createEl('p', { text: `Size: ${this.formatFileSize(this.file.stat.size)}` });

		// Path setting
		new Setting(contentEl)
			.setName('Wiki.js Path')
			.setDesc('The path where this page will be created in Wiki.js')
			.addText(text => text
				.setValue(this.pathInput)
				.onChange(value => this.pathInput = value));

		// Title setting
		new Setting(contentEl)
			.setName('Page Title')
			.setDesc('The title of the page in Wiki.js')
			.addText(text => text
				.setValue(this.titleInput)
				.onChange(value => this.titleInput = value));

		// Description setting
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional description for the page')
			.addTextArea(text => text
				.setValue(this.descriptionInput)
				.onChange(value => this.descriptionInput = value));

		// Tags setting
		new Setting(contentEl)
			.setName('Tags')
			.setDesc('Tags for the page (comma-separated)')
			.addText(text => text
				.setValue(this.tagsInput)
				.setPlaceholder('tag1, tag2, tag3')
				.onChange(value => this.tagsInput = value));

		// Buttons
		const buttonDiv = contentEl.createDiv('modal-button-container');
		
		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelButton.onclick = () => this.close();

		const uploadButton = buttonDiv.createEl('button', { 
			text: 'Upload',
			cls: 'mod-cta'
		});
		uploadButton.onclick = () => this.performUpload();

		// Style the modal
		contentEl.addClass('wikijs-upload-modal');
	}

	private async performUpload() {
		// Validate inputs
		if (!this.pathInput.trim()) {
			new Notice('Path cannot be empty');
			return;
		}

		if (!this.titleInput.trim()) {
			new Notice('Title cannot be empty');
			return;
		}

		const uploadButton = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
		uploadButton.textContent = 'Uploading...';
		uploadButton.disabled = true;

		try {
			// Check if page already exists
			const existingPage = await this.checkIfPageExists();
			
			let result;
			if (existingPage) {
				const shouldUpdate = await this.confirmUpdate(existingPage);
				if (!shouldUpdate) {
					uploadButton.textContent = 'Upload';
					uploadButton.disabled = false;
					return;
				}
				
				result = await this.api.updatePage(
					parseInt(existingPage.id),
					this.pathInput.trim(),
					this.titleInput.trim(),
					this.content,
					this.descriptionInput.trim() || undefined,
					this.parseTags()
				);
			} else {
				result = await this.api.createPage(
					this.pathInput.trim(),
					this.titleInput.trim(),
					this.content,
					this.descriptionInput.trim() || undefined,
					this.parseTags()
				);
			}

			if (result.success) {
				new Notice(`Successfully ${existingPage ? 'updated' : 'created'} page: ${result.pageUrl}`);
				this.close();
			} else {
				new Notice(`Failed to ${existingPage ? 'update' : 'create'} page: ${result.message}`);
			}

		} catch (error) {
			new Notice(`Error uploading page: ${error.message}`);
		} finally {
			uploadButton.textContent = 'Upload';
			uploadButton.disabled = false;
		}
	}

	private async checkIfPageExists(): Promise<any> {
		try {
			const page = await this.api.getPageByPath(this.pathInput.trim());
			return page; // 如果页面不存在，getPageByPath 会返回 null
			// return await this.api.getPageByPath(this.pathInput.trim());
		} catch (error) {
			// Page doesn't exist
			return null;
		}
	}

	private async confirmUpdate(existingPage: any): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Page Already Exists');
			
			const content = modal.contentEl;
			content.createEl('p', { 
				text: `A page already exists at path "${this.pathInput}". What would you like to do?`
			});
			
			content.createEl('p', { 
				text: `Existing page: "${existingPage.title}"`,
				cls: 'setting-item-description'
			});

			const buttonDiv = content.createDiv('modal-button-container');
			
			const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
			cancelButton.onclick = () => {
				modal.close();
				resolve(false);
			};

			const updateButton = buttonDiv.createEl('button', { 
				text: 'Update Existing',
				cls: 'mod-warning'
			});
			updateButton.onclick = () => {
				modal.close();
				resolve(true);
			};

			modal.open();
		});
	}

	private parseTags(): string[] {
		return this.tagsInput
			.split(',')
			.map(tag => tag.trim())
			.filter(tag => tag.length > 0);
	}

	private formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
