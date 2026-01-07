import { json, type RequestHandler } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs/promises';

const galeryPath = path.resolve((process.env as { GALLERY_PATH?: string }).GALLERY_PATH ?? './gallery');


export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const { filenames } = await request.json() as { filenames: string[] };

        if (!filenames || filenames.length === 0) {
            return json({ error: 'No filenames provided' }, { status: 400 });
        }



        const deletedFiles: string[] = [];
        const notFoundFiles: string[] = [];

        for (const filename of filenames) {
            if (!filename.startsWith('gallery/')) {
                notFoundFiles.push(filename);
                console.warn('Skipping invalid filename, does not start with gallery/:', filename);
                continue;
            }
            if (filename.includes('..')) {
                console.warn('Skipping invalid filename, .. not allowed:', filename);
                throw new Error('Invalid filename, .. not allowed.');
            }
            
            const changedFilename = filename.replace(/^gallery\//, '');
            if(changedFilename.startsWith('/')) {
                console.warn('Skipping invalid filename, leading / not allowed:', filename);
                throw new Error('Invalid filename, leading / not allowed.');
            }
            const filePath = path.join(galeryPath, changedFilename);
            try {
                await fs.unlink(filePath);
                deletedFiles.push(filename);
            } catch (err) {
                console.warn('File not found for deletion:', filePath);
                notFoundFiles.push(filename);
            }
        }

        const response: any = {
            success: deletedFiles.length > 0,
            deleted: deletedFiles,
            notFound: notFoundFiles
        };

        if (deletedFiles.length > 0) {
            response.message = `Deleted ${deletedFiles.length} file(s).`;
        }
        if (notFoundFiles.length > 0) {
            response.message = (response.message || '') + ` ${notFoundFiles.length} file(s) not found.`;
        }

        return json(response);

    } catch (error) {
        console.error('Delete error:', error);
        return json({
            error: 'Failed to delete files',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};