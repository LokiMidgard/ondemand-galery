<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let fileInput: HTMLInputElement;
	let isDragOver = $state(false);
	let isUploading = $state(false);
	let uploadMessage = $state('');
	let uploadError = $state('');
	let uploadProgress = $state(0);

	// Props
	interface Props {
		onUploadComplete?: () => void;
	}
	let { onUploadComplete }: Props = $props();

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			uploadFiles(Array.from(files));
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			uploadFiles(Array.from(files));
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		// Only set isDragOver to false if we're leaving the drop zone entirely
		const target = event.currentTarget as Element;
		if (!event.relatedTarget || !target?.contains(event.relatedTarget as Node)) {
			isDragOver = false;
		}
	}

	async function uploadFiles(files: File[]) {
		if (files.length === 0) return;

		isUploading = true;
		uploadError = '';
		uploadMessage = '';
		uploadProgress = 0;

		try {
			const formData = new FormData();
			files.forEach(file => {
				formData.append('files', file);
			});

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok && result.success) {
				uploadMessage = result.message;
				uploadProgress = 100;
				
				// Reset file input
				if (fileInput) {
					fileInput.value = '';
				}
				
				// Call callback if provided
				if (onUploadComplete) {
					onUploadComplete();
				}
				
				// Clear success message after 3 seconds
				setTimeout(() => {
					uploadMessage = '';
					uploadProgress = 0;
				}, 3000);
			} else {
				uploadError = result.error || 'Upload failed';
			}
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	function openFileDialog() {
		fileInput?.click();
	}
</script>

<div class="upload-container">
	<div 
		class="drop-zone"
		class:drag-over={isDragOver}
		class:uploading={isUploading}
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		role="button"
		tabindex="0"
		onclick={openFileDialog}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openFileDialog();
			}
		}}
	>
		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept="image/*,.txt,.md"
			onchange={handleFileSelect}
			style="display: none;"
		/>
		
		<div class="upload-content">
			{#if isUploading}
				<div class="uploading-state" transition:fade>
					<div class="spinner"></div>
					<p>Uploading files...</p>
					{#if uploadProgress > 0}
						<div class="progress-bar">
							<div class="progress-fill" style="width: {uploadProgress}%"></div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="upload-prompt" transition:fade>
					<svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="17,8 12,3 7,8"/>
						<line x1="12" y1="3" x2="12" y2="15"/>
					</svg>
					<p class="primary-text">Drop files here or click to upload</p>
					<p class="secondary-text">Supports images, text files (.txt, .md)</p>
					<button type="button" class="upload-button" onclick={openFileDialog}>
						Choose Files
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if uploadMessage}
		<div class="message success" transition:fly={{ y: -10, duration: 300 }}>
			{uploadMessage}
		</div>
	{/if}

	{#if uploadError}
		<div class="message error" transition:fly={{ y: -10, duration: 300 }}>
			{uploadError}
		</div>
	{/if}
</div>

<style>
	.upload-container {
		margin: 2rem auto;
		max-width: 600px;
		width: 100%;
	}

	.drop-zone {
		border: 2px dashed #ccc;
		border-radius: 8px;
		padding: 3rem 2rem;
		text-align: center;
		cursor: pointer;
		transition: 
			border-color 0.3s ease,
			background-color 0.3s ease,
			transform 0.2s ease;
		background-color: #fafafa;
	}

	.drop-zone:hover {
		border-color: #007bff;
		background-color: #f0f8ff;
		transform: translateY(-2px);
	}

	.drop-zone.drag-over {
		border-color: #007bff;
		background-color: #e3f2fd;
		transform: scale(1.02);
	}

	.drop-zone.uploading {
		border-color: #28a745;
		background-color: #f8fff9;
		cursor: not-allowed;
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.upload-icon {
		width: 48px;
		height: 48px;
		color: #666;
		margin-bottom: 0.5rem;
	}

	.primary-text {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0;
		color: #333;
	}

	.secondary-text {
		font-size: 0.9rem;
		margin: 0;
		color: #666;
	}

	.uploading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #e3f2fd;
		border-top: 3px solid #007bff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.progress-bar {
		width: 200px;
		height: 8px;
		background-color: #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #007bff;
		transition: width 0.3s ease;
		border-radius: 4px;
	}

	.message {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 4px;
		text-align: center;
		font-weight: 500;
	}

	.message.success {
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.upload-button {
		background-color: #007bff;
		color: white;
		border: none;
		padding: 0.75rem 2rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: 
			background-color 0.3s ease,
			transform 0.2s ease;
		margin-top: 1rem;
	}

	.upload-button:hover {
		background-color: #0056b3;
		transform: translateY(-1px);
	}

	.upload-button:active {
		transform: translateY(0);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.upload-container {
			margin: 1rem;
		}
		
		.drop-zone {
			padding: 2rem 1rem;
		}
		
		.upload-icon {
			width: 36px;
			height: 36px;
		}
		
		.primary-text {
			font-size: 1rem;
		}
		
		.secondary-text {
			font-size: 0.85rem;
		}
	}
</style>
