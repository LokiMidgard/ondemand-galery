import { json, type RequestHandler } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs/promises';

const uploadPath = path.resolve((process.env as { UPLOAD_PATH?: string }).UPLOAD_PATH ?? './gallery');

// Configure maximum file size (default 50MB, can be overridden with env var)
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;

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
        const errors: Array<{ name: string; error: string }> = [];

        for (const file of files) {
            if (!file.name) {
                continue;
            }

            // Check file size
            if (file.size > maxFileSize) {
                errors.push({
                    name: file.name,
                    error: `File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`
                });
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

        // Return results with both successes and errors
        const response: any = {
            success: uploadedFiles.length > 0,
            uploaded: uploadedFiles.length,
            total: files.length,
            files: uploadedFiles
        };

        if (errors.length > 0) {
            response.errors = errors;
            response.message = `Uploaded ${uploadedFiles.length} of ${files.length} files. ${errors.length} files had errors.`;
        } else {
            response.message = `Successfully uploaded ${uploadedFiles.length} file(s)`;
        }

        return json(response);

    } catch (error) {
        console.error('Upload error:', error);
        return json({ 
            error: 'Failed to upload files', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
};
