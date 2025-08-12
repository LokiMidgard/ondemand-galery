<script lang="ts">
	import { getFiles } from '$lib/data.remote';
	import type { RemoteQuery } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import ExifReader from 'exifreader';

	let files: ReturnType<typeof getFiles> = $state({});
	let selectedIndex: number | undefined = $state();

	$effect(() => {
		if (selectedIndex == undefined) {
			document.body.classList.remove('noScroll');
		} else {
			document.body.classList.add('noScroll');
		}
	});

	let selectedData = $derived.by(() => {
		if (
			!files.ready ||
			selectedIndex == undefined ||
			selectedIndex < 0 ||
			selectedIndex >= files.current.length ||
			files.current[selectedIndex].type !== 'image' ||
			!files.current[selectedIndex].path
		) {
			console.log('No image selected or invalid index');
			return;
		}

		// get image byte data
		return fetch(files.current[selectedIndex].path)
			.then((response) => response.arrayBuffer())
			.then((buffer) => {
				const tags = ExifReader.load(buffer);
                return  (tags.parameters.value); // Ensure prompt is parsed if it exists
				return tags;
			});
	});

	onMount(() => {
		files = getFiles();
		const id = setInterval(async () => {
			// await files.refresh();
		}, 5000);
		return () => {
			clearInterval(id);
		};
	});
</script>

{#if files.ready}
	<div class="gallery">
		{#each files.current as f, i (f.path)}
			<button
				onclick={() => {
					selectedIndex = i;
					console.log('selected index is', i);
				}}
			>
				{#if f.type == 'image'}
					<img class="bg" src={f.path} alt="galery entry" />
					<img src={f.path} alt="galery entry" />
				{/if}
			</button>
		{/each}
	</div>
	{#if selectedIndex != undefined}
		{@const current = files.current[selectedIndex]}
		<dialog open>
			<button
				onclick={() => {
					if (selectedIndex == undefined || !files.ready) return;
					selectedIndex = (selectedIndex - 1 + files.current.length) % files.current.length;
				}}>&leftarrow;</button
			>
			<button
				onclick={() => {
					if (selectedIndex == undefined || !files.ready) return;
					selectedIndex = (selectedIndex + 1) % files.current.length;
				}}>&rightarrow;</button
			>
			<img style="max-width: 100px;" src={current.path} alt="galery entry" />
{#await selectedData}
					Loading…
				{:then data}{#if data}{data}
						<!-- {JSON.stringify(data, undefined, 2)} -->
					{:else}
						No EXIF data found.
					{/if}
				{/await}
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
		position: absolute;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(200, 200, 200, 0.9);
        overflow: scroll;
	}

	.gallery {
		display: flex;
		flex-wrap: wrap;

		img {
			object-fit: contain;
			grid-row: 1;
			grid-column: 1;
			filter: blur(0);
			transition: transform 1200ms ease;
			&:hover {
				transform: scale(1.1);
			}
			cursor: pointer;
		}
		img.bg {
			filter: blur(2px);
			object-fit: cover;
			grid-row: 1;
			grid-column: 1;
			transform: scaleX(1.3) scaleY(1.3);
			overflow: hidden;
		}

		* {
			width: 15rem;
			height: 15rem;
			display: grid;
			overflow: hidden;
			padding: 0;
		}
	}
</style>
