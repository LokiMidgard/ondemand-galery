import { query } from '$app/server';
import { getFiles as storedFiles } from '../hooks.server';

export const getFiles = query(async () => {
    // await delay(3000); // test
    const files = storedFiles();
    return files;
});

