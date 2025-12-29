import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import NoteToWikiJSPlugin from '../main';
import { MarkdownProcessor } from './markdown-processor';
import { WikiJSAPI } from './wikijs-api';
import { ImageTagProcessor } from './image-tag-processor';

export class UploadModal extends Modal {
	plugin: NoteToWikiJSPlugin;
	file: TFile;
	private processor: MarkdownProcessor;
	private api: WikiJSAPI;
	private imageProcessor: ImageTagProcessor;
	
	// Form fields
	private pathInput: string;
	private titleInput: string;
	private tagsInput: string;
	private descriptionInput: string;
	private content: string;
	private images: Array<{ name: string; path: string }>;

	constructor(app: App, plugin: NoteToWikiJSPlugin, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.processor = new MarkdownProcessor(plugin.settings);
		this.api = new WikiJSAPI(plugin.settings);
		this.imageProcessor = new ImageTagProcessor(app);
		
		// Initialize form fields
		this.initializeFields();
	}

	private async initializeFields() {
		const content = await this.app.vault.read(this.file);
		const processed = this.processor.processMarkdown(content, this.file.name);
		
		this.pathInput = this.processor.generatePath(this.file.name, this.file.parent?.path);
		this.titleInput = processed.title;
		this.content = processed.content;
		this.images = processed.images;
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

	private async uploadImages(images: Array<{ name: string; path: string }>): Promise<Map<string, string>> {
		const imageMap = new Map<string, string>();
		
		// 在上传图片前，先根据页面路径创建文件夹结构，并获取精确的文件夹 ID
		let targetFolderId = 0;
		try {
			targetFolderId = await this.api.ensureAssetFolderPath(this.pathInput.trim());
			console.log(`Asset folder prepared, folderId: ${targetFolderId}`);
		} catch (error) {
			console.warn('Failed to create asset folder structure:', error);
			// 继续执行，使用根目录
			targetFolderId = 0;
		}
		
		// 使用 ImageTagProcessor 批量解析图片文件
		const imageFileMap = this.imageProcessor.resolveImageFiles(images, this.file);
		
		for (const image of images) {
			try {
				console.log('Processing image:', image.name, 'Original path:', image.path);
				
				const file = imageFileMap.get(image.path);
				
				if (file instanceof TFile) {
					console.log('Found file:', file.path, 'File name:', file.name);
					const arrayBuffer = await this.app.vault.readBinary(file);
					
					// 上传图片到 Wiki.js，使用实际文件的完整文件名（包含扩展名）
					const uploadedFileName = await this.api.uploadAsset(file.name, arrayBuffer, targetFolderId);
					
					// 上传成功，显示提示
					new Notice(`✅ ${file.name} uploaded successfully`);
					console.log(`✅ Successfully uploaded: ${file.name}`);
				} else {
					console.error(`File not found: ${image.name} (path: ${image.path})`);
					new Notice(`Image file not found: ${image.name}`);
				}
			} catch (error) {
				console.error(`Failed to upload image ${image.name}:`, error);
				new Notice(`Failed to upload image ${image.name}: ${error.message}`);
			}
		}
		
		// 返回空的映射，因为不需要替换路径
		return imageMap;
	}

	private replaceImagePaths(content: string, imageMap: Map<string, string>): string {
		let newContent = content;
		for (const [oldPath, newPath] of imageMap) {
			// 替换图片路径，处理可能的相对路径和绝对路径
			const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedOldPath}\\)`, 'g');
			newContent = newContent.replace(regex, `![$1](${newPath})`);
		}
		return newContent;
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
			// 首先上传所有图片
			let processedContent = this.content;
			if (this.images && this.images.length > 0) {
				new Notice(`Uploading ${this.images.length} images...`);
				await this.uploadImages(this.images);
				// 不替换图片路径，保持原样
			}

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
					processedContent,
					this.descriptionInput.trim() || undefined,
					this.parseTags()
				);
			} else {
				result = await this.api.createPage(
					this.pathInput.trim(),
					this.titleInput.trim(),
					processedContent,
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
