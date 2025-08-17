import { json, type RequestHandler } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs/promises';

const uploadPath = path.resolve((process.env as { UPLOAD_PATH?: string }).UPLOAD_PATH ?? './gallery');

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Ensure the upload path exists
        await fs.mkdir(uploadPath, { recursive: true });

        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        
        if (!files || files.length === 0) {
            return json({ error: 'No files provided' }, { status: 400 });
        }

        const uploadedFiles: Array<{ name: string; size: number; path: string }> = [];

        for (const file of files) {
            if (!file.name) {
                continue;
            }

            // Generate a safe filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = path.extname(file.name);
            const baseName = path.basename(file.name, extension);
            const safeFilename = `${timestamp}_${baseName}${extension}`;
            
            const filePath = path.join(uploadPath, safeFilename);
            
            // Convert File to Buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Write file to disk
            await fs.writeFile(filePath, buffer);
            
            uploadedFiles.push({
                name: file.name,
                size: file.size,
                path: safeFilename
            });
        }

        return json({ 
            success: true, 
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
            files: uploadedFiles 
        });

    } catch (error) {
        console.error('Upload error:', error);
        return json({ 
            error: 'Failed to upload files', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
};
