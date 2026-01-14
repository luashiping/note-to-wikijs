import { App, PluginSettingTab, Setting } from 'obsidian';
import NoteToWikiJSPlugin from '../main';
import { WikiJSAPI } from './wikijs-api';
import { WikiJSSettings } from './types';

export const DEFAULT_SETTINGS: WikiJSSettings = {
	wikiUrl: '',
	apiToken: '',
	defaultTags: [],
	autoConvertLinks: true,
	preserveObsidianSyntax: false,
};

export class WikiJSSettingTab extends PluginSettingTab {
	plugin: NoteToWikiJSPlugin;

	constructor(app: App, plugin: NoteToWikiJSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Wiki.js settings')
			.setHeading();

		new Setting(containerEl)
			.setName('Wiki.js URL')
			.setDesc('The base URL of your Wiki.js instance (e.g., https://wiki.example.com)')
			.addText(text => text
				.setPlaceholder('https://wiki.example.com')
				.setValue(this.plugin.settings.wikiUrl)
				.onChange(async (value) => {
					this.plugin.settings.wikiUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API token')
			.setDesc('Your Wiki.js API token (can be generated in Wiki.js Admin > API Access)')
			.addText(text => text
				.setPlaceholder('Enter your API token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value.trim();
					await this.plugin.saveSettings();
				}));

		// Connection test button
		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Test the connection to your Wiki.js instance')
			.addButton(button => button
				.setButtonText('Test connection')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Testing...');
					button.setDisabled(true);
					
					try {
						if (!this.plugin.settings.wikiUrl || !this.plugin.settings.apiToken) {
							throw new Error('Please fill in both Wiki.js URL and API token');
						}

						const api = new WikiJSAPI(this.plugin.settings);
						const isConnected = await api.checkConnection();
						
						if (isConnected) {
							button.setButtonText('✅ Connected');
							this.plugin.showNotice('Successfully connected to Wiki.js!', 3000);
						} else {
							button.setButtonText('❌ Failed');
							this.plugin.showNotice('Failed to connect to Wiki.js. Please check your settings.', 5000);
						}
					} catch (error) {
						button.setButtonText('❌ Error');
						this.plugin.showNotice(`Connection error: ${error.message}`, 5000);
					}
					
					setTimeout(() => {
						button.setButtonText('Test connection');
						button.setDisabled(false);
					}, 3000);
				}));

		new Setting(containerEl)
			.setName('Default tags')
			.setDesc('Default tags to add to uploaded pages (comma-separated)')
			.addText(text => text
				.setPlaceholder('tag1, tag2, tag3')
				.setValue(this.plugin.settings.defaultTags.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.defaultTags = value
						.split(',')
						.map(tag => tag.trim())
						.filter(tag => tag.length > 0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto convert links')
			.setDesc('Automatically convert relative links to absolute Wiki.js paths')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConvertLinks)
				.onChange(async (value) => {
					this.plugin.settings.autoConvertLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Preserve Obsidian syntax')
			.setDesc('Keep Obsidian-specific syntax (like [[links]] and callouts) unchanged')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.preserveObsidianSyntax)
				.onChange(async (value) => {
					this.plugin.settings.preserveObsidianSyntax = value;
					await this.plugin.saveSettings();
				}));

		// Advanced settings section
		new Setting(containerEl)
			.setName('Advanced settings')
			.setHeading();

		new Setting(containerEl)
			.setName('Upload behavior')
			.setDesc('Choose what happens when uploading a note that already exists in Wiki.js')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Ask each time')
				.addOption('update', 'Always update existing page')
				.addOption('create-new', 'Create new page with different name')
				.setValue(this.plugin.settings.uploadBehavior || 'ask')
				.onChange(async (value) => {
					this.plugin.settings.uploadBehavior = value as 'ask' | 'update' | 'create-new';
					await this.plugin.saveSettings();
				}));

		// Usage instructions
		new Setting(containerEl)
			.setName('Usage')
			.setHeading();
		
		const usageDiv = containerEl.createDiv();
		usageDiv.createEl('p', { text: 'To upload a note to Wiki.js:' });
		
		const ol = usageDiv.createEl('ol');
		ol.createEl('li', { text: 'Open the note you want to upload' });
		ol.createEl('li', { text: 'Use the command palette (Ctrl/Cmd + P) and search for "Upload to Wiki.js"' });
		ol.createEl('li', { text: 'Or right-click on a file in the file explorer and select "Upload to Wiki.js"' });
		
		const noteP = usageDiv.createEl('p');
		noteP.createEl('strong', { text: 'Note: ' });
		noteP.appendText('The plugin will automatically convert Obsidian-specific syntax to be compatible with Wiki.js unless you enable "Preserve Obsidian syntax".');
	}
}
