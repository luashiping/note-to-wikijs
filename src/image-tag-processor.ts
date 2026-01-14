import { App, TFile, normalizePath } from 'obsidian';

/**
 * ImageTagProcessor - 参考 obsidian-image-upload-toolkit 的实现
 * 用于处理图片路径解析和文件定位
 */
export class ImageTagProcessor {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 从图片路径解析出实际的 TFile 对象
	 * 参考 obsidian-image-upload-toolkit 的路径解析逻辑
	 */
	resolveImageFile(imagePath: string, sourceFile: TFile): TFile | null {
		// 移除查询参数和哈希
		const cleanPath = imagePath.split('?')[0].split('#')[0].trim();
		
		// 跳过外部链接
		if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://') || cleanPath.startsWith('data:')) {
			return null;
		}

		// 方法1: 使用 metadataCache 获取资源路径（Obsidian 标准方法）
		try {
			const resourcePath = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				sourceFile.path
			);
			if (resourcePath instanceof TFile) {
				return resourcePath;
			}
		} catch (error) {
			console.debug('metadataCache method failed:', error);
		}

		// 方法2: 尝试直接路径查找（绝对路径）
		let normalizedPath = normalizePath(cleanPath);
		if (normalizedPath.startsWith('/')) {
			normalizedPath = normalizedPath.substring(1);
		}
		
		let file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (file instanceof TFile) {
			return file;
		}

		// 方法3: 相对于源文件的路径
		if (sourceFile.parent) {
			const parentPath = sourceFile.parent.path;
			// 处理相对路径 ./ 或 ../
			let relativePath = cleanPath;
			if (relativePath.startsWith('./')) {
				relativePath = relativePath.substring(2);
			}
			
			// 构建完整路径
			const fullPath = normalizePath(`${parentPath}/${relativePath}`);
			file = this.app.vault.getAbstractFileByPath(fullPath);
			if (file instanceof TFile) {
				return file;
			}

			// 处理 ../ 相对路径
			if (cleanPath.startsWith('../')) {
				const parts = cleanPath.split('/');
				let currentPath = parentPath;
				
				for (const part of parts) {
					if (part === '..') {
						const parent = this.app.vault.getAbstractFileByPath(currentPath)?.parent;
						if (parent) {
							currentPath = parent.path;
						} else {
							break;
						}
					} else if (part !== '.' && part !== '') {
						currentPath = normalizePath(`${currentPath}/${part}`);
					}
				}
				
				file = this.app.vault.getAbstractFileByPath(currentPath);
				if (file instanceof TFile) {
					return file;
				}
			}
		}

		// 方法4: 检查 Obsidian 的附件文件夹设置
		// Obsidian 可能配置了默认附件文件夹
		const attachmentFolder = this.getAttachmentFolder(sourceFile);
		if (attachmentFolder) {
			const attachmentPath = normalizePath(`${attachmentFolder}/${cleanPath}`);
			file = this.app.vault.getAbstractFileByPath(attachmentPath);
			if (file instanceof TFile) {
				return file;
			}
		}

		// 方法5: 在整个 vault 中按文件名搜索（最后的手段）
		const fileName = cleanPath.split('/').pop() || cleanPath;
		if (fileName) {
			const allFiles = this.app.vault.getFiles();
			// 支持的图片扩展名
			const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.excalidraw'];
			
			// 优先查找同目录下的文件
			if (sourceFile.parent) {
				// 如果文件名没有扩展名，尝试添加常见扩展名
				const hasExtension = fileName.includes('.');
				if (!hasExtension) {
					for (const ext of imageExtensions) {
						const fileNameWithExt = `${fileName}${ext}`;
						const sameDirFile = allFiles.find(f => 
							f.name === fileNameWithExt && 
							f.parent?.path === sourceFile.parent.path
						);
						if (sameDirFile) {
							return sameDirFile;
						}
					}
				} else {
					const sameDirFile = allFiles.find(f => 
						f.name === fileName && 
						f.parent?.path === sourceFile.parent.path
					);
					if (sameDirFile) {
						return sameDirFile;
					}
				}
			}
			
			// 如果同目录没找到，在整个 vault 中查找
			const hasExtension = fileName.includes('.');
			if (!hasExtension) {
				// 尝试添加扩展名
				for (const ext of imageExtensions) {
					const fileNameWithExt = `${fileName}${ext}`;
					const foundFile = allFiles.find(f => f.name === fileNameWithExt);
					if (foundFile) {
						return foundFile;
					}
				}
			} else {
				const foundFile = allFiles.find(f => f.name === fileName);
				if (foundFile) {
					return foundFile;
				}
			}
		}

		return null;
	}

	/**
	 * 获取文件的附件文件夹路径
	 * 参考 Obsidian 的附件文件夹设置逻辑
	 */
	private getAttachmentFolder(sourceFile: TFile): string | null {
		// Obsidian 的附件文件夹可能通过以下方式配置：
		// 1. 全局设置中的附件文件夹
		// 2. 文件夹级别的附件文件夹
		// 3. 文件同目录下的附件文件夹
		
		// 方法1: 检查文件同目录下是否有附件文件夹
		if (sourceFile.parent) {
			const parentPath = sourceFile.parent.path;
			// 常见的附件文件夹名称
			const attachmentFolderNames = ['attachments', 'assets', 'images', 'media', 'files'];
			
			for (const folderName of attachmentFolderNames) {
				const folderPath = normalizePath(`${parentPath}/${folderName}`);
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (folder && 'children' in folder) {
					return folderPath;
				}
			}
		}

		// 方法2: 检查全局附件文件夹（如果 Obsidian 有 API 可以获取）
		// 注意：Obsidian API 可能不直接暴露这个设置，这里使用常见路径
		const commonAttachmentPaths = ['attachments', 'assets', 'images'];
		for (const path of commonAttachmentPaths) {
			const folder = this.app.vault.getAbstractFileByPath(path);
			if (folder && 'children' in folder) {
				return path;
			}
		}

		return null;
	}

	/**
	 * 批量解析图片文件
	 */
	resolveImageFiles(
		images: Array<{ name: string; path: string }>,
		sourceFile: TFile
	): Map<string, TFile> {
		const imageFileMap = new Map<string, TFile>();
		
		for (const image of images) {
			const file = this.resolveImageFile(image.path, sourceFile);
			if (file) {
				imageFileMap.set(image.path, file);
			} else {
				console.warn(`Cannot resolve image: ${image.name} (path: ${image.path})`);
			}
		}
		
		return imageFileMap;
	}
}

