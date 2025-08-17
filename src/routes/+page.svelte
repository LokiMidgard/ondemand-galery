<script lang="ts">
	import { getFiles } from '$lib/data.remote';
	import type { RemoteQuery } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import ExifReader from 'exifreader';
	import { crossfade, fade, fly } from 'svelte/transition';
	import md from 'markdown-it';
	import { TimeSpan } from '$lib';
	import FileUpload from '$lib/components/FileUpload.svelte';

	let files = $state(getFiles());
	let selectedIndex: number | undefined = $state();
	let dialog: HTMLDialogElement | undefined = $state();

	const mdParser = new md({});

	const [send, receive] = crossfade({
		duration: 400,
		fallback: (node, params) => fade(node)
	});

	$effect(() => {
		if (selectedIndex == undefined) {
			document.body.classList.remove('noScroll');
		} else {
			document.body.classList.add('noScroll');
		}
	});

	// let selectedData = $derived.by(() => {
	// 	if (
	// 		!files.ready ||
	// 		selectedIndex == undefined ||
	// 		selectedIndex < 0 ||
	// 		selectedIndex >= files.current.length ||
	// 		files.current[selectedIndex].type !== 'image' ||
	// 		!files.current[selectedIndex].path
	// 	) {
	// 		console.log('No image selected or invalid index');
	// 		return;
	// 	}

	// 	// get image byte data
	// 	return fetch(files.current[selectedIndex].path)
	// 		.then((response) => response.arrayBuffer())
	// 		.then((buffer) => {
	// 			const tags = ExifReader.load(buffer);
	//             // return  (tags.parameters.value); // Ensure prompt is parsed if it exists
	// 			return tags;
	// 		});
	// });

	onMount(() => {
		const id = setInterval(async () => {
			await files.refresh();
		}, 5000);
		return () => {
			clearInterval(id);
		};
	});

	function handleUploadComplete() {
		// Refresh files immediately after upload
		files.refresh();
	}
</script>

<svelte:body
	onkeydown={(e) => {
		if (e.key === 'Escape' && selectedIndex !== undefined) {
			selectedIndex = undefined;
		} else if (e.key === 'ArrowLeft' && selectedIndex !== undefined && files.ready) {
			selectedIndex = (selectedIndex - 1 + files.current.length) % files.current.length;
		} else if (e.key === 'ArrowRight' && selectedIndex !== undefined && files.ready) {
			selectedIndex = (selectedIndex + 1) % files.current.length;
		} else if (e.key === 'ArrowDown' && selectedIndex !== undefined) {
			// Scroll down the page
			dialog?.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
		} else if (e.key === 'ArrowUp' && selectedIndex !== undefined) {
			// Scroll up the page
			dialog?.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
		}
	}}
/>

{#if files.ready}
	<details>
		<summary>Upload Files</summary>
		<FileUpload onUploadComplete={handleUploadComplete} />
	</details>
	<div class="gallery">
		{#each files.current as f, i (f.path)}
			<button
				onclick={() => {
					selectedIndex = i;
					console.log('selected index is', i);
				}}
			>
				{#if f.type == 'image'}
					<img class="bg" src={f.thumbnail ?? f.path} alt="galery entry" />
					{#if selectedIndex != i}
						<img
							src={f.thumbnail ?? f.path}
							alt="galery entry"
							out:send={{ key: f.path }}
							in:receive={{ key: f.path }}
						/>
						{#if f.meta}
							<div class="meta-badge">meta</div>
						{/if}
						<div class="time">{f.timestamp?.toLocaleString()}</div>
					{/if}
				{:else if f.type == 'text'}
					<div class="entry">
						{f.value.substring(0, 100)}{f.value.length > 100 ? '…' : ''}
					</div>
				{:else}
					<div class="entry">Unknown file type</div>
				{/if}
			</button>
		{/each}
	</div>
	{#if selectedIndex != undefined}
		{@const current = files.current[selectedIndex]}
		<dialog open transition:fade bind:this={dialog}>
			<button
				class="close"
				onclick={() => {
					selectedIndex = undefined;
				}}>X</button
			>
			<button
				class="previous paging"
				onclick={() => {
					if (selectedIndex == undefined || !files.ready) return;
					selectedIndex = (selectedIndex - 1 + files.current.length) % files.current.length;
				}}>&leftarrow;</button
			>
			<button
				class="next paging"
				onclick={() => {
					if (selectedIndex == undefined || !files.ready) return;
					selectedIndex = (selectedIndex + 1) % files.current.length;
				}}>&rightarrow;</button
			>
			{#if current.type == 'text'}
				<div class="entry">
					{current.value}
				</div>
			{:else}
				{@const currentPath = current?.path}

				<img
					class="entry"
					src={current.path}
					alt="galery entry"
					out:send={{ key: currentPath }}
					in:receive={{ key: currentPath }}
				/>
				<div class="details" transition:fly={{ y: 200, duration: 600 }}>
					<dl>
						<dt>Path:</dt>
						<dd>{current.path}</dd>
						<dt>Time:</dt>
						<dd>
							{current.timestamp ? current.timestamp.toLocaleString() : 'Unknown'}
						</dd>
						{#if current.meta?.took}
							<dt>Took:</dt>
							<dd>
								{new TimeSpan(0, 0, current.meta.took)}
							</dd>
						{/if}
						{#if current.meta?.dimensions}
							<dt>Dimensions:</dt>
							<dd>{current.meta.dimensions.width} x {current.meta.dimensions.height}</dd>
						{/if}
						{#if current.meta?.seed}
							<dt>Seed:</dt>
							<dd>{current.meta.seed}</dd>
						{/if}
						{#if current.meta?.prompt}
							<dt>Prompt:</dt>
							<dd>{@html mdParser.render(current.meta.prompt.positive)}</dd>
						{/if}
						{#if current.meta?.prompt?.negative}
							<dt>Negative Prompt:</dt>
							<dd>{@html mdParser.render(current.meta.prompt.negative)}</dd>
						{/if}
						{#if current.meta?.steps}
							<dt>Steps:</dt>
							<dd>{current.meta.steps}</dd>
						{/if}
						{#if current.meta?.additional && Object.keys(current.meta.additional).length > 0}
							<dt>Additional:</dt>
							<dd>
								{#each Object.entries(current.meta.additional) as [key, value]}
									<strong>{key}:</strong> {value}<br />
								{/each}
							</dd>
						{/if}

						{#if current.meta?.cfg}
							<dt>CFG Scale:</dt>
							<dd>{current.meta.cfg}</dd>
						{/if}
						{#if current.meta?.model}
							<dt>Model:</dt>
							<dd>{current.meta.model}</dd>
						{/if}
						{#if current.meta?.sampler}
							<dt>Sampler:</dt>
							<dd>{current.meta.sampler}</dd>
						{/if}
						{#if current.meta?.sceduler}
							<dt>Sceduler:</dt>
							<dd>{current.meta.sceduler}</dd>
						{/if}
					</dl>
				</div>
				<!-- {#await selectedData}
					Loading…
					{:then data}{#if data}{JSON.stringify(data, null, 2)}
					{:else}
					No EXIF data found.
					{/if}
					{/await} -->
			{/if}
		</dialog>
	{/if}
{:else if files.loading}
	Loading…
{:else if files.error}
	<pre>
        {JSON.stringify(files.error, undefined, 2)}
    </pre>
{/if}

<style>
	:global(.noScroll) {
		background-color: red;
		overflow: hidden;
	}
	dialog {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(200, 200, 200, 0.9);
		overflow-y: scroll;
		overflow-x: hidden;
		padding: 0;
		z-index: 1000;

		& > .entry {
			img& {
				object-fit: contain;
				pointer-events: none;
			}
			div& {
				background-color: white;
			}

			z-index: 900;
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			max-width: 90vw;
			max-height: 90vh;
			margin: auto;

			display: block;
			box-shadow:
				0 0 10px rgba(0, 0, 0, 0.5),
				0 0 20px rgba(0, 0, 0, 0.3);
		}

		& > .close {
			position: fixed;
			top: 1rem;
			right: 1rem;
			background-color: rgba(0, 0, 0, 0.5);
			color: white;
			border: none;
			padding: 0.5rem;
			cursor: pointer;
			font-size: 1.5rem;
			z-index: 10;
			transition: background-color 0.3s ease;
			height: 2rem;
			width: 2rem;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			&:hover {
				background-color: rgba(0, 0, 0, 0.8);
			}
		}

		& > .paging {
			position: fixed;
			top: 50%;
			transform: translateY(-50%);
			background-color: rgba(0, 0, 0, 0.5);
			color: white;
			border: none;
			padding: 1rem;
			cursor: pointer;
			font-size: 2rem;
			z-index: 10;
			transition: background-color 0.3s ease;
			&.previous {
				left: 1rem;
			}
			&.next {
				right: 1rem;
			}
			&:hover {
				background-color: rgba(0, 0, 0, 0.8);
			}
		}
		.details {
			z-index: 1000;
			position: relative;
			margin-top: 98vh;
			background-color: rgba(200, 200, 200, 0.9);
			transform: translateZ(-100px);
			margin-left: 3rem;
			margin-right: 3rem;
			margin-bottom: 1rem;
			padding: 1rem;
			box-shadow:
				0 0 10px rgba(0, 0, 0, 0.5),
				0 0 20px rgba(0, 0, 0, 0.3);
		}
	}

	.gallery {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;

		.meta-badge {
			grid-row: 1;
			grid-column: 1;
			width: fit-content;
			height: fit-content;
			color: white;
			padding: 0.5rem 3rem;
			transform: translateY(1rem) translateX(-2rem) rotate(-45deg);
			background-color: royalblue;
			box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
			z-index: 20;
		}
		.time {
			grid-row: 1;
			grid-column: 1;
			position: relative;
			color: white;
			text-shadow:
				0 0 1px rgba(0, 0, 0, 1),
				0 0 2px rgba(0, 0, 0, 1),
				0 0 3px rgba(0, 0, 0, 1),
				0 0 4px rgba(0, 0, 0, 1),
				0 0 10px rgba(0, 0, 0, 0.5);
			padding: 0.5rem 1rem;
			z-index: 21;
			align-self: end;
			justify-self: end;
		}

		& > * {
			width: 15rem;
			height: 15rem;
			display: grid;
			overflow: hidden;
			padding: 0;
			&:is(button) {
				border: none;
				background: none;
				padding: 0;
				cursor: pointer;
				position: relative;
				transition:
					box-shadow 300ms ease,
					transform 300ms ease;
				box-shadow: 0 0 0px rgba(0, 0, 0, 0.5);
				&:hover {
					z-index: 10;
					box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
					transform: scale(1.05);
				}
			}
			& > img {
				width: 15rem;
				height: 15rem;
				object-fit: contain;
				grid-row: 1;
				grid-column: 1;
				filter: blur(0);
				transition: transform 1200ms ease;
				z-index: 15;
				&:hover {
					/* transform: scale(1.1); */
				}
				cursor: pointer;
				&.bg {
					width: 15rem;
					height: 15rem;

					filter: blur(2px);
					object-fit: cover;
					grid-row: 1;
					grid-column: 1;
					transform: scaleX(1.3) scaleY(1.3);
					overflow: hidden;
					z-index: 10;
				}
			}
		}
	}
</style>
