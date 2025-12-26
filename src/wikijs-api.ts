import { WikiJSSettings, WikiJSCreatePageMutation, WikiJSUpdatePageMutation, WikiJSPageListResponse, UploadResult } from './types';

export class WikiJSAPI {
	private settings: WikiJSSettings;

	constructor(settings: WikiJSSettings) {
		this.settings = settings;
	}

	private async makeGraphQLRequest(query: string, variables?: any): Promise<any> {
		const response = await fetch(`${this.settings.wikiUrl}/graphql`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiToken}`
			},
			// mode: 'cors',
			body: JSON.stringify([{
				operationName: null,
				query,
				variables,
				extensions: {}
			}]),
		});

		const results = await response.json();
		const result = Array.isArray(results) ? results[0] : results;

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(result)}`);
		}
		
		if (result.errors) {
			throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
		}

		return result.data;
	}

	async checkConnection(): Promise<boolean> {
		try {
			const query = `
				{
					pages {
						list(limit: 1) {
							id
						}
					}
				}
			`;
			await this.makeGraphQLRequest(query);
			return true;
		} catch (error) {
			console.error('Connection check failed:', error);
			return false;
		}
	}

	async getPages(): Promise<WikiJSPageListResponse> {
		const query = `
			{
				pages {
					list(orderBy: TITLE) {
						id
						path
						title
						createdAt
						updatedAt
					}
				}
			}
		`;
		return await this.makeGraphQLRequest(query);
	}

	async getPageByPath(path: string): Promise<any> {
		const query = `
			query($path: String!) {
				pages {
					search(query: $path) {
						results {
							id
							title
							description
							path
							locale
						}
					}
				}
			}
		`;
		const result = await this.makeGraphQLRequest(query, { path: path });
		// return result.pages.single;
		// 在搜索结果中查找完全匹配的 path
		const exactMatch = result.pages.search.results.find(
			(page: any) => page.path === path
		);

		return exactMatch || null;
		// return exactMatch ? true : false;
		// return {
		// 	exists: !!exactMatch,
		// 	page: exactMatch || undefined
		// };
	}

	async createPage(
		path: string,
		title: string,
		content: string,
		description?: string,
		tags?: string[]
	): Promise<UploadResult> {
		const mutation = `
      mutation ($content: String!, $description: String!, $editor: String!, $isPrivate: Boolean!, $isPublished: Boolean!, $locale: String!, $path: String!, $publishEndDate: Date, $publishStartDate: Date, $scriptCss: String, $scriptJs: String, $tags: [String]!, $title: String!) {
        pages {
          create(
            content: $content,
            description: $description,
            editor: $editor,
            isPrivate: $isPrivate,
            isPublished: $isPublished,
            locale: $locale,
            path: $path,
            publishEndDate: $publishEndDate,
            publishStartDate: $publishStartDate,
            scriptCss: $scriptCss,
            scriptJs: $scriptJs,
            tags: $tags,
            title: $title
					) {
						responseResult {
							succeeded
							errorCode
							slug
							message
						}
						page {
							id
							path
							title
						}
					}
				}
			}`.trim();

		try {

			const variables = {
				content,
				description: description || '',
				editor: 'markdown',
				isPrivate: false,
				isPublished: true,
				locale: 'zh',
				path,
				publishEndDate: '',
				publishStartDate: '',
				scriptCss: "",
				scriptJs: "",
				tags: (tags || this.settings.defaultTags || []).filter(tag => tag && tag.trim()),
				title
			};

			const result: WikiJSCreatePageMutation = await this.makeGraphQLRequest(mutation, variables);
			
			if (result.pages.create.responseResult.succeeded) {
				return {
					success: true,
					message: 'Page created successfully',
					pageId: result.pages.create.page.id,
					pageUrl: `${this.settings.wikiUrl}/${path}`
				};
			} else {
				return {
					success: false,
					message: result.pages.create.responseResult.message || 'Unknown error occurred'
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Error creating page: ${error.message}`
			};
		}
	}

	async updatePage(
		id: number,
		path: string,
		title: string,
		content: string,
		description?: string,
		tags?: string[]
	): Promise<UploadResult> {
		const mutation = `
			mutation($id: Int!, $path: String!, $title: String!, $content: String!, $description: String, $tags: [String!]) {
				pages {
					update(
						id: $id
						path: $path
						title: $title
						content: $content
						description: $description
						tags: $tags
						isPublished: true
						isPrivate: false
						publishStartDate: ""
						publishEndDate: ""
						scriptCss: ""
						scriptJs: ""
					) {
						responseResult {
							succeeded
							errorCode
							slug
							message
						}
						page {
							id
							path
							title
						}
					}
				}
			}
		`;

		try {
			const variables = {
				id,
				path,
				title,
				// content: content.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'),
				content,
				description: description || '',
				tags: tags || this.settings.defaultTags || []
			};

			const result: WikiJSUpdatePageMutation = await this.makeGraphQLRequest(mutation, variables);
			
			if (result.pages.update.responseResult.succeeded) {
				return {
					success: true,
					message: 'Page updated successfully',
					pageId: result.pages.update.page.id,
					pageUrl: `${this.settings.wikiUrl}/${path}`
				};
			} else {
				return {
					success: false,
					message: result.pages.update.responseResult.message || 'Unknown error occurred'
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Error updating page: ${error.message}`
			};
		}
	}

	/**
	 * 获取资源文件夹列表
	 * @param parentFolderId 父文件夹 ID（0 表示根目录）
	 * @returns 文件夹列表
	 */
	async getAssetFolders(parentFolderId: number = 0): Promise<any[]> {
		const query = `
			query ($parentFolderId: Int!) {
				assets {
					folders(parentFolderId: $parentFolderId) {
						id
						slug
						name
					}
				}
			}
		`;

		try {
			const result = await this.makeGraphQLRequest(query, { parentFolderId });
			return result.assets.folders || [];
		} catch (error) {
			console.error('Get folders error:', error);
			return [];
		}
	}

	/**
	 * 查找指定名称的文件夹 ID
	 * @param parentFolderId 父文件夹 ID
	 * @param folderName 文件夹名称
	 * @returns 文件夹 ID，如果不存在返回 null
	 */
	async findFolderIdByName(parentFolderId: number, folderName: string): Promise<number | null> {
		const folders = await this.getAssetFolders(parentFolderId);
		const folder = folders.find(f => f.slug === folderName || f.name === folderName);
		return folder ? folder.id : null;
	}

	/**
	 * 创建资源文件夹
	 * @param parentFolderId 父文件夹 ID（0 表示根目录）
	 * @param slug 文件夹名称
	 * @returns 创建结果，包含新创建的文件夹 ID
	 */
	async createAssetFolder(parentFolderId: number, slug: string): Promise<{ succeeded: boolean; folderId?: number; message?: string }> {
		const mutation = `
			mutation ($parentFolderId: Int!, $slug: String!) {
				assets {
					createFolder(parentFolderId: $parentFolderId, slug: $slug) {
						responseResult {
							succeeded
							errorCode
							slug
							message
						}
					}
				}
			}
		`;

		try {
			const result = await this.makeGraphQLRequest(mutation, { parentFolderId, slug });
			
			if (result.assets.createFolder.responseResult.succeeded) {
				console.log(`Asset folder created: ${slug}`);
				
				// 创建成功后，查询获取新文件夹的 ID
				const folderId = await this.findFolderIdByName(parentFolderId, slug);
				
				return { 
					succeeded: true,
					folderId: folderId || undefined
				};
			} else {
				return {
					succeeded: false,
					message: result.assets.createFolder.responseResult.message || 'Unknown error'
				};
			}
		} catch (error) {
			console.error('Create folder error:', error);
			return {
				succeeded: false,
				message: error.message
			};
		}
	}

	/**
	 * 根据路径创建文件夹结构
	 * @param path 页面路径（如 "folder1/folder2/page"）
	 * @returns 最终文件夹 ID
	 */
	async ensureAssetFolderPath(path: string): Promise<number> {
		// 从路径中提取文件夹部分
		const parts = path.split('/').filter(p => p.trim());
		if (parts.length === 0) {
			return 0; // 根目录
		}

		// 移除最后一个部分（页面名称），只保留文件夹路径
		const folderParts = parts.slice(0, -1);
		if (folderParts.length === 0) {
			return 0; // 页面在根目录
		}

		let currentFolderId = 0;
		
		// 逐级创建文件夹
		for (const folderName of folderParts) {
			// 首先检查文件夹是否已存在
			let folderId = await this.findFolderIdByName(currentFolderId, folderName);
			
			if (folderId) {
				// 文件夹已存在，使用现有 ID
				console.log(`Folder already exists: ${folderName} (ID: ${folderId})`);
				currentFolderId = folderId;
			} else {
				// 文件夹不存在，创建新文件夹
				const result = await this.createAssetFolder(currentFolderId, folderName);
				
				if (result.succeeded && result.folderId) {
					console.log(`Created folder: ${folderName} (ID: ${result.folderId})`);
					currentFolderId = result.folderId;
				} else {
					// 创建失败，可能是并发问题，再次尝试查询
					folderId = await this.findFolderIdByName(currentFolderId, folderName);
					if (folderId) {
						console.log(`Folder found after retry: ${folderName} (ID: ${folderId})`);
						currentFolderId = folderId;
					} else {
						console.error(`Failed to create or find folder: ${folderName}`);
						// 如果创建失败且找不到，继续使用当前父文件夹 ID
						// 这样至少可以保证后续文件夹在正确的层级
					}
				}
			}
		}

		return currentFolderId;
	}

	async uploadAsset(
		fileName: string,
		fileContent: ArrayBuffer,
		folderId: number = 0
	): Promise<string> {
		try {
			// 创建 FormData
			const formData = new FormData();
			
			// 添加文件夹元数据
			formData.append('mediaUpload', JSON.stringify({ folderId }));
			
			// 根据文件扩展名确定 MIME 类型
			const getContentType = (name: string): string => {
				const ext = name.toLowerCase().split('.').pop() || '';
				const mimeTypes: { [key: string]: string } = {
					'jpg': 'image/jpeg',
					'jpeg': 'image/jpeg',
					'png': 'image/png',
					'gif': 'image/gif',
					'webp': 'image/webp',
					'svg': 'image/svg+xml',
					'bmp': 'image/bmp'
				};
				return mimeTypes[ext] || 'application/octet-stream';
			};
			
			// 添加文件数据
			const blob = new Blob([fileContent], { type: getContentType(fileName) });
			formData.append('mediaUpload', blob, fileName);

			console.log(`Uploading asset: ${fileName} to folder ${folderId} (${blob.size} bytes, ${blob.type})`);

			// 发送请求
			const response = await fetch(`${this.settings.wikiUrl}/u`, {
				method: 'POST',
				headers: {
					'Accept': '*/*',
					'Authorization': `Bearer ${this.settings.apiToken}`,
					// 注意：不要设置 Content-Type，让浏览器自动设置正确的 boundary
				},
				body: formData
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Upload failed: ${response.status} - ${errorText}`);
				throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
			}

			const result = await response.json();
			console.log('Upload response:', result);
			
			if (!result.succeeded) {
				throw new Error(result.message || 'Upload failed');
			}

			// 返回上传后的文件路径
			if (!result.url && !result.path) {
				throw new Error('No file path returned from server');
			}

			const uploadedPath = result.url || result.path;
			console.log(`Asset uploaded successfully: ${uploadedPath}`);
			return uploadedPath;

		} catch (error) {
			console.error('Asset upload error:', error);
			throw new Error(`Error uploading asset: ${error.message}`);
		}
	}
}

