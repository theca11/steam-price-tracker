import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import path from 'node:path';
import url from 'node:url';
import copy from 'rollup-plugin-copy';
import license from 'rollup-plugin-license';


const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = 'dev.theca11.steam-price-tracker.sdPlugin';
const banner = `/**
* @overview Steam Price Tracker Stream Deck plugin
* @author the_ca11
* @license MIT
* @copyright the_ca11 2024-${new Date().getFullYear()}
*/`;

/**
 * @type {import('rollup').RollupOptions}
 */
const pluginConfig = {
	input: 'src/plugin/plugin.ts',
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath))
				.href;
		},
		banner
	},
	external: ['sharp'],
	plugins: [
		{
			name: 'watch-externals',
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			},
		},
		typescript({
			tsconfig: 'src/plugin/tsconfig.json',
			mapRoot: isWatching ? './' : undefined,
		}),
		json(),
		nodeResolve({
			browser: false,
			exportConditions: ['node'],
			preferBuiltins: true,
		}),
		commonjs(),
		!isWatching && terser(),
		{
			name: 'emit-module-package-file',
			generateBundle() {
				this.emitFile({
					fileName: 'package.json',
					source: `{ "type": "module" }`,
					type: 'asset',
				});
			},
		},
		copy({
			targets: [
				{ src: ['./LICENSE', './CHANGELOG.md'], dest: `${sdPlugin}` },
			],
			verbose: true,
			copyOnce: isWatching,
		}),
		license({
			thirdParty: {
				includePrivate: false,
				output: {
					file: `${sdPlugin}/3rdparty-licenses.txt`,
					template(dependencies) {
						const sortedDeps = dependencies.sort((a, b) =>
							a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
						);
						return [
							'This file lists third-party dependencies and their corresponding license notice.\n',
							...sortedDeps.map(
								(dep) =>
									`${dep.name} (v${dep.version}) - ${dep.license}\n\n${dep.licenseText}`,
							),
						].join('\n--------------------\n\n');
					},
				},
			},
		}),

	],
};

const piConfig = {
	input: 'src/pi/pi.ts',
	output: {
		file: `${sdPlugin}/bin/pi.js`,
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath))
				.href;
		},
		banner
	},
	plugins: [
		{
			name: 'watch-externals',
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			},
		},
		typescript({
			tsconfig: 'src/pi/tsconfig.json',
			mapRoot: isWatching ? './' : undefined,
		}),
		json(),
		nodeResolve({
			browser: true,
			preferBuiltins: true,
		}),
		commonjs(),
		!isWatching && terser(),
	],
};

export default [pluginConfig, piConfig];
