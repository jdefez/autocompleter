---

# Usage

This component is based on
[sveltejs/component-template](https://github.com/sveltejs/component-template)

## Consuming components

Your package.json has a `"svelte"` field pointing to `src/index.js`, which
allows Svelte apps to import the source code directly, if they are using a
bundler plugin like
[rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte) or
[svelte-loader](https://github.com/sveltejs/svelte-loader) (where
[`resolve.mainFields`](https://webpack.js.org/configuration/resolve/#resolve-mainfields)
in your webpack config includes `"svelte"`). **This is recommended.**

For everyone else, `npm run build` will bundle your component's source code
into a plain JavaScript module (`dist/index.mjs`) and a UMD script
(`dist/index.js`). This will happen automatically when you publish your
component to npm, courtesy of the `prepublishOnly` hook in package.json.

## Reading list
https://medium.com/@ukchukx/creating-an-inline-input-component-in-svelte-and-publishing-to-npm-84274be1aa73
https://daveceddia.com/svelte-with-sass-in-vscode/
https://dev.to/silvio/how-to-create-a-web-components-in-svelte-2g4j?signin=true
