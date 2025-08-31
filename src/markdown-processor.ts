import { WikiJSSettings } from './types';

export class MarkdownProcessor {
	private settings: WikiJSSettings;

	constructor(settings: WikiJSSettings) {
		this.settings = settings;
	}

	/**
	 * Convert Obsidian markdown to Wiki.js compatible markdown
	 */
	processMarkdown(content: string, fileName: string): { content: string; title: string } {
		let processedContent = content;

		// Extract title from file name or first heading
		let title = this.extractTitle(content, fileName);

		if (!this.settings.preserveObsidianSyntax) {
			// Convert Obsidian-specific syntax
			processedContent = this.convertObsidianLinks(processedContent);
			processedContent = this.convertObsidianTags(processedContent);
			processedContent = this.convertObsidianCallouts(processedContent);
		}

		if (this.settings.autoConvertLinks) {
			processedContent = this.convertInternalLinks(processedContent);
		}

		// Clean up any remaining Obsidian-specific elements
		processedContent = this.cleanupObsidianSyntax(processedContent);

		return {
			content: processedContent.trim(),
			title
		};
	}

	private extractTitle(content: string, fileName: string): string {
		// Try to find the first heading
		const headingMatch = content.match(/^#\s+(.+)$/m);
		if (headingMatch) {
			return headingMatch[1].trim();
		}

		// If no heading found, use filename without extension
		return fileName.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
	}

	private convertObsidianLinks(content: string): string {
		// Convert [[Link]] to [Link](Link)
		return content.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, link, pipe, displayText) => {
			const text = displayText || link;
			const url = link.replace(/\s+/g, '-').toLowerCase();
			return `[${text}](/${url})`;
		});
	}

	private convertObsidianTags(content: string): string {
		// Convert #tag to proper markdown
		return content.replace(/(^|\s)#([a-zA-Z0-9_/-]+)/g, '$1`#$2`');
	}

	private convertObsidianCallouts(content: string): string {
		// Convert Obsidian callouts to blockquotes
		const calloutRegex = /^>\s*\[!(\w+)\]([^\n]*)\n((?:^>.*$\n?)*)/gm;
		
		return content.replace(calloutRegex, (match, type, title, body) => {
			const cleanBody = body.replace(/^>\s?/gm, '');
			const titleText = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
			
			return `> **${titleText}**\n>\n${cleanBody.split('\n').map((line: string) => `> ${line}`).join('\n')}\n`;
		});
	}

	private convertInternalLinks(content: string): string {
		// Convert relative links to absolute Wiki.js paths
		return content.replace(/\[([^\]]+)\]\((?!https?:\/\/)([^)]+)\)/g, (match, text, url) => {
			if (url.startsWith('/')) {
				return match; // Already absolute
			}
			return `[${text}](/${url})`;
		});
	}

	private cleanupObsidianSyntax(content: string): string {
		// Remove YAML frontmatter
		content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
		
		// Remove empty callout blocks
		content = content.replace(/^>\s*\[![^\]]*\]\s*$/gm, '');
		
		// Clean up multiple consecutive newlines
		content = content.replace(/\n{3,}/g, '\n\n');
		
		return content;
	}

	/**
	 * Generate a Wiki.js compatible path from the file name
	 */
	generatePath(fileName: string, folderPath?: string): string {
		// Remove .md extension
		let path = fileName.replace(/\.md$/, '');
		
		// Convert to lowercase and replace spaces with hyphens
		path = path.toLowerCase().replace(/\s+/g, '-');
		
		// Remove date prefixes (YYYY-MM-DD-)
		path = path.replace(/^\d{4}-\d{2}-\d{2}-/, '');
		
		// Remove special characters except hyphens and underscores
		path = path.replace(/[^a-z0-9\-_]/g, '');
		
		// Add folder path if provided
		if (folderPath && folderPath !== '/') {
			const cleanFolderPath = folderPath
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9\-_/]/g, '')
				.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
			
			if (cleanFolderPath) {
				path = `${cleanFolderPath}/${path}`;
			}
		}
		
		return path;
	}

	/**
	 * Extract tags from content (YAML frontmatter or inline tags)
	 */
	extractTags(content: string): string[] {
		const tags: string[] = [];
		
		// Extract from YAML frontmatter
		const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (yamlMatch) {
			const yamlContent = yamlMatch[1];
			const tagsMatch = yamlContent.match(/^tags:\s*\[(.*?)\]$/m) || 
							 yamlContent.match(/^tags:\s*(.+)$/m);
			
			if (tagsMatch) {
				const tagString = tagsMatch[1];
				if (tagString.includes('[')) {
					// Array format: [tag1, tag2, tag3]
					const arrayTags = tagString.match(/["']?([^,"']+)["']?/g);
					if (arrayTags) {
						tags.push(...arrayTags.map(tag => tag.replace(/["']/g, '').trim()));
					}
				} else {
					// Simple format: tag1, tag2, tag3
					tags.push(...tagString.split(',').map(tag => tag.trim()));
				}
			}
		}
		
		// Extract inline hashtags
		const hashtagMatches = content.match(/(^|\s)#([a-zA-Z0-9_/-]+)/g);
					if (hashtagMatches) {
				hashtagMatches.forEach(match => {
					const tag = match.trim().substring(1); // Remove #
					if (tags.indexOf(tag) === -1) {
						tags.push(tag);
					}
				});
			}
		
		return tags.filter(tag => tag.length > 0);
	}
}
