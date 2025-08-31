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
}
