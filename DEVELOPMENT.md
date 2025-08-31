# Development Guide

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

For development with hot reload:

```bash
npm run dev
```

This will watch for changes and automatically rebuild the plugin.

## Building

To build for production:

```bash
npm run build
```

This will create the `main.js` file that can be used in Obsidian.

## Testing

1. Copy the built files to your Obsidian vault's plugins directory:
   ```
   {vault}/.obsidian/plugins/note-to-wikijs/
   ```

2. Enable the plugin in Obsidian Settings > Community Plugins

3. Configure the plugin with your Wiki.js instance details

## File Structure

```
src/
├── types.ts              # TypeScript type definitions
├── wikijs-api.ts         # Wiki.js GraphQL API client
├── markdown-processor.ts # Markdown conversion utilities  
├── settings.ts          # Plugin settings UI
└── upload-modal.ts      # Upload dialog modal

main.ts                  # Main plugin entry point
manifest.json           # Plugin manifest
package.json           # NPM package configuration
styles.css             # Plugin styles
```

## API Reference

### WikiJSAPI

Main class for interacting with Wiki.js GraphQL API:

- `checkConnection()` - Test API connectivity
- `createPage()` - Create a new page
- `updatePage()` - Update existing page
- `getPageByPath()` - Retrieve page by path

### MarkdownProcessor

Handles conversion of Obsidian markdown to Wiki.js format:

- `processMarkdown()` - Convert content
- `generatePath()` - Generate Wiki.js path from filename
- `extractTags()` - Extract tags from content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Debugging

Enable developer console in Obsidian to see error messages and logs.

Common issues:
- API token permissions
- Network connectivity
- Invalid Wiki.js URL format
- GraphQL query errors
