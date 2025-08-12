import path from 'path';
import { env } from '$env/dynamic/public';
import fs from 'fs/promises';
import type { Handle } from '@sveltejs/kit';
import { json } from 'stream/consumers';

export const handle: Handle = async ({ event, resolve }) => {
    if (event.url.pathname.startsWith('/gallery')) {
        // Ensure the gallery path exists
        try {
            await fs.access(galeryPath);
        } catch {
            // return a 404 if the gallery path does not exist
            return new Response('Gallery path not found', { status: 404 });
        }
        // If the request is for the gallery, we need to return the file. it may be liying outside the public directory
        // Normalize and resolve the file path to prevent directory traversal attacks.
        // This ensures that any '..' or similar segments are resolved and the resulting path is strictly within the gallery directory.
        const resolvedPath = path.resolve(galeryPath, '.' + event.url.pathname.replace('/gallery', ''));
        if (!resolvedPath.startsWith(path.resolve(galeryPath))) {
            // Security: Prevent access to files outside the gallery directory.
            return new Response('File not found', { status: 404 });
        }
        try {
            const fileContent = await fs.readFile(resolvedPath);
            return new Response(new Uint8Array(fileContent), {
                status: 200,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`
                }
            });
        } catch (error) {
            console.error('Error reading file:', error);
            return new Response('File not found', { status: 404 });
        }
    }

    const response = await resolve(event);
    return response;
};

let files: Entry[] = [];

const galeryPath =path.resolve((env as { GALLERY_PATH?: string }).GALLERY_PATH ?? './gallery');
console.log(`using gallery path ${galeryPath}`)
// Ensure the gallery path exists
try {
    await fs.access(galeryPath);
} catch {
    console.error(`Gallery path "${galeryPath}" does not exist. Creating it...`);
    await fs.mkdir(galeryPath, { recursive: true });
}


export function getFiles() {
    return files;
}

// load files from the gallery path on server start
type Entry = {
    path: string,
    type: 'video' | 'image' | 'text'
    meta?: {
        seed?: number,
        prompt?: {
            positive: string,
            negative?: string
        },
        cfg?: number
        model?: string,
        sampler?: string,
        steps?: number,
        additional: Record<string, string>
    }
}

async function loadFiles() {
    try {
        const entries = await fs.readdir(galeryPath, { withFileTypes: true, recursive: true });
        const systemFiles = entries
            .filter(entry => entry.isFile())
            .map(entry => {
                const parent = entry.parentPath.substring(galeryPath.length);
                return `${parent}/${entry.name}`
            });

        const images = Promise.all(systemFiles.map(x => {
            const extension = path.extname(x).toLocaleLowerCase();
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif']
            const videoExtensions = ['.mp4', '.webm']
            if (imageExtensions.includes(extension)) {
                return {
                    path: x,
                    type: 'image' as const
                }
            }
            if (videoExtensions.includes(extension)) {
                return {
                    path: x,
                    type: 'video' as const
                }
            }
            console.log(`Dose not match ${x}`)
            return null;
        }).filter((x): x is { path: string, type: 'video' | 'image' } => x != null)
            .map(async x => {

                const pathWithoutExtension = x.path.substring(0, x.path.length - path.extname(x.path).length);
                const filesWithSamePrefix = systemFiles.filter(other => other != x.path && other.startsWith(pathWithoutExtension));
                const jsonFile = filesWithSamePrefix.filter(x => x.toLocaleLowerCase().endsWith('.json'))[0] as string | undefined;
                const meta = jsonFile ?
                    text2Metadata(await fs.readFile(jsonFile, 'utf-8')) : undefined;

                const publicPath = path.join('gallery',x.path);

                return { path: publicPath, type: x.type, meta };
            }));

        files = await images;





    } catch (error) {
        console.error('Error reading gallery directory:', error);
        files = [];
    }
}

function text2Metadata(txt: string): Entry['meta'] {
    return JSON.parse(txt);
}

(async () => {


    // Initialize files on server start
    // call loadFiles when the filesystem changes
    const waitch = fs.watch(galeryPath, { recursive: true });
    for await (const event of waitch) {
        console.log(`Filesystem change (${event.eventType}) detected in ${event.filename}`);
        await loadFiles();
    }
})();


await loadFiles();


