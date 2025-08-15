import path from 'path';
import fs from 'fs/promises';
import type { Handle } from '@sveltejs/kit';
import ExifReader from 'exifreader';

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

const galeryPath = path.resolve((process.env as { GALLERY_PATH?: string }).GALLERY_PATH ?? './gallery');
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



// sample metadata for testing
// {
//   "modelname": "",
//   "positive": "This is a digital for an illustration for a 'young adault' / \"teen\" novel depicting a 13 year old boy standing in a vast, arid desert landscape. The 13 year old boy has short, dark frizzy brown hair and tained skin, amber-colored eyes, with a serious expression on his face. He is wearing a red hadband, a used, black, hooded poncho that seems to have a triangular shape, it drapes over his shoulders and the tip of the triangular reaches down to his belly. Underneath the Poncho, he has on a dark brown tunic with long sleeves and loose-fitting brown pants. On his feet he has worn roman lether sandals. A wide red sash is tied around his waist, and a small knife is fastened to it. He also wears a red scarf wrapped around his neck. His hands are relaxed at his sides, and he stands with a slightly forward-leaning posture.nnThe background features a bright desert with small, scattered rocks and a clear blue sky with a few white clouds. The desert extends to the horizon, where it meets a slightly darker rocky outcrop. The wind blows sand playfully over the plain.",
//   "negative": "",
//   "width": "1328",
//   "height": "1328",
//   "seed": "752388247315520",
//   "steps": "30",
//   "cfg": "2.592825949192047",
//   "sampler_name": "euler",
//   "scheduler_name": "karras",
//   "denoise": "1.0",
//   "clip_skip": "0",
//   "custom": "karras",
//   "additional_hashes": "",
//   "ckpt_path": "",
//   "a111_params": "This is a digital for an illustration for a 'young adault' / \"teen\" novel depicting a 13 year old boy standing in a vast, arid desert landscape. The 13 year old boy has short, dark frizzy brown hair and tained skin, amber-colored eyes, with a serious expression on his face. He is wearing a red hadband, a used, black, hooded poncho that seems to have a triangular shape, it drapes over his shoulders and the tip of the triangular reaches down to his belly. Underneath the Poncho, he has on a dark brown tunic with long sleeves and loose-fitting brown pants. On his feet he has worn roman lether sandals. A wide red sash is tied around his waist, and a small knife is fastened to it. He also wears a red scarf wrapped around his neck. His hands are relaxed at his sides, and he stands with a slightly forward-leaning posture.nnThe background features a bright desert with small, scattered rocks and a clear blue sky with a few white clouds. The desert extends to the horizon, where it meets a slightly darker rocky outcrop. The wind blows sand playfully over the plain.nNegative prompt: nSteps: 30, Sampler: Euler Karras, CFG scale: 2.592825949192047, Seed: 752388247315520, Size: 1328x1328, karras, Model: , Hashes: {\"model\":\"\"}, Version: ComfyUI",
//   "final_hashes": ""
// }

// load files from the gallery path on server start
type Entry = {
    path: string,
    type: 'video' | 'image'
    timestamp?: Date


    meta?: {
        dimensions?: {
            width: number,
            height: number
        },
        seed?: number,
        prompt?: {
            positive: string,
            negative?: string
        },
        cfg?: number
        model?: string,
        sampler?: string,
        sceduler?: string,
        steps?: number,
        additional: Record<string, string | undefined>
        took?: number
    }
} | {
    value: string,
    type: 'text'
    timestamp?: Date


    meta?: {
        seed?: number,
        prompt?: {
            positive: string,
            negative?: string
        },
        model?: string,
        additional: Record<string, string | undefined>
        took?: number
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
            const textExtension = ['.md', '.txt']

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
            if (textExtension.includes(extension)) {
                return {
                    path: x,
                    type: 'text' as const
                }
            }
            console.log(`Dose not match ${x}`)
            return null;
        }).filter((x): x is { path: string, type: 'video' | 'image' | 'text' } => x != null)
            .map(async x => {

                const fullPath = path.join(galeryPath, x.path);
                const fileDate = await fs.stat(fullPath).then(stat => stat.mtime);

                if (x.type == 'text') {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    return { value: content, type: x.type, timestamp: fileDate } satisfies Entry;
                } else {

                    const meta = x.type == 'image' ? await extractMetadataFromImage(fullPath) : undefined;


                    const publicPath = path.join('gallery', x.path);

                    return { path: publicPath, type: x.type, meta, timestamp: fileDate } satisfies Entry;
                }
            }));

        files = await images;

        files = files.sort((a, b) => {
            if (a.timestamp && b.timestamp) {
                return b.timestamp.getTime() - a.timestamp.getTime();
            }
            if (a.timestamp) {
                return -1; // a is newer
            }
            if (b.timestamp) {
                return 1; // b is newer
            }
            return 0; // both are equal
        }
        );



    } catch (error) {
        console.error('Error reading gallery directory:', error);
        files = [];
    }
}

async function extractMetadataFromImage(imagePath: string): Promise<Entry['meta'] | undefined> {
    try {

        const tags = await ExifReader.load(imagePath);
        const textToSearch = tags?.parameters?.value;

        if (!textToSearch) {
            return undefined;
        }
        return await extractJSON(textToSearch) ?? await extractPythonObjectFromText(textToSearch)
            ;

    } catch (error) {
        console.error(`Error extracting metadata from image ${imagePath}:`, error);
        return undefined;
    }
    // find the first occurrence  of `Metadata(`

}

async function extractJSON(textToSearch: string): Promise<Entry['meta'] | undefined> {

    try {

        // Example JSON structure
        //   {
        //     "took": 166.96579384803772,
        //     "id": "ed0201c9-35c2-41f4-acfe-c1d9b2013e39",
        //     "metadata": {
        //         "modelname": "qwen_image_fp8_e4m3fn.safetensors",
        //         "positive": "This is a digital illustration for a young adult / teen novel. Depict a 13-year-old boy standing in a vast, arid desert landscape. The boy has short, dark, frizzy brown hair, tanned skin, and amber-colored eyes, with a serious expression. He wears a narrow red headband. Over his shoulders is a worn black Mexican-style poncho: it is a simple, triangular, hoodless piece of cloth with no sleeves, hanging down to his belly in the front. Underneath the poncho he wears a dark brown long-sleeved tunic and loose-fitting brown trousers. On his feet are old Roman-style leather sandals. Around his waist is a wide red sash; a small, used knife is securely tucked under this sash so that only the handle partly sticks out. He also has a red scarf wrapped around his neck. His hands hang relaxed at his sides, and his stance leans slightly forward as if bracing against the wind.\\n\\nIn the background: a bright desert with scattered stones and a clear blue sky with a few small white clouds. The desert extends to the horizon where it meets a darker rocky outcrop. Fine sand blows across the ground in the wind.",
        //         "negative": "",
        //         "width": 128,
        //         "height": 128,
        //         "seed": 556805218312646,
        //         "steps": 1,
        //         "cfg": 2.4006744623184204,
        //         "sampler_name": "simple",
        //         "scheduler_name": "euler",
        //         "denoise": 1.0,
        //         "clip_skip": 0,
        //         "custom": "foo",
        //         "additional_hashes": "",
        //         "ckpt_path": "/opt/comfyui/models/diffusion_models/qwen_image_fp8_e4m3fn.safetensors",
        //         "a111_params": "This is a digital illustration for a young adult / teen novel. Depict a 13-year-old boy standing in a vast, arid desert landscape. The boy has short, dark, frizzy brown hair, tanned skin, and amber-colored eyes, with a serious expression. He wears a narrow red headband. Over his shoulders is a worn black Mexican-style poncho: it is a simple, triangular, hoodless piece of cloth with no sleeves, hanging down to his belly in the front. Underneath the poncho he wears a dark brown long-sleeved tunic and loose-fitting brown trousers. On his feet are old Roman-style leather sandals. Around his waist is a wide red sash; a small, used knife is securely tucked under this sash so that only the handle partly sticks out. He also has a red scarf wrapped around his neck. His hands hang relaxed at his sides, and his stance leans slightly forward as if bracing against the wind.\\n\\nIn the background: a bright desert with scattered stones and a clear blue sky with a few small white clouds. The desert extends to the horizon where it meets a darker rocky outcrop. Fine sand blows across the ground in the wind.\\nNegative prompt: \\nSteps: 1, Sampler: simple_euler, CFG scale: 2.4006744623184204, Seed: 556805218312646, Size: 128x128, foo, Model hash: 98763a1277, Model: qwen_image_fp8_e4m3fn, Hashes: {\\"model\\":\\"98763a1277\\"}, Version: ComfyUI",
        //         "final_hashes": "qwen_image_fp8_e4m3fn:98763a1277"
        //     }
        // }

        const json = JSON.parse(textToSearch) as {
            id: string,
            took: number,
            metadata: {
                modelname?: string,
                positive?: string,
                negative?: string,
                width?: number,
                height?: number,
                seed?: number,
                steps?: number,
                cfg?: number,
                sampler_name?: string,
                scheduler_name?: string,
                denoise?: number,
                clip_skip?: number,
                custom?: string,
                additional_hashes?: string,
                ckpt_path?: string,
                a111_params?: string,
                final_hashes?: string
            }
        };
        if (!json.metadata) {
            return undefined;
        }
        const metadata: Entry['meta'] = {
            dimensions: json.metadata.width && json.metadata.height ? {
                width: json.metadata.width,
                height: json.metadata.height
            } : undefined,
            seed: json.metadata.seed,
            prompt: json.metadata.positive ? {
                positive: json.metadata.positive,
                negative: json.metadata.negative
            } : undefined,
            cfg: json.metadata.cfg,
            model: json.metadata.modelname,
            sampler: json.metadata.sampler_name,
            sceduler: json.metadata.scheduler_name,
            steps: json.metadata.steps,
            took: json.took,
            additional: {
                "modelHash": json.metadata.final_hashes?.split(':')[1],
                "ckptPath": json.metadata.ckpt_path,
                "custom": json.metadata.custom,
                "additionalHashes": json.metadata.additional_hashes,
                "a111Params": json.metadata.a111_params
            }
        };
        return metadata;
    } catch {
        return undefined;
    }

}
async function extractPythonObjectFromText(textToSearch: string) {

    const metadataStart = textToSearch.indexOf('Metadata(');
    if (metadataStart === -1) {
        return undefined;
    }
    // the metadata may include text that contains `)` so we need to find the matching `)` by ignoring any `)` that is inside a `' or `"` string but also ignoring any `\'` or `\"` escape sequences 
    let metadataEnd = metadataStart + 'Metadata('.length;
    let inString: '\'' | '"' | undefined = undefined;
    let escapeNext = false;


    while (metadataEnd < textToSearch.length) {
        const char = textToSearch[metadataEnd];
        if (escapeNext) {
            escapeNext = false;
        }
        else if (char === '\\') {
            escapeNext = true;
        }
        else if (inString) {
            if (char === inString) {
                inString = undefined;
            }
        } else if (char === '\'' || char === '"') {
            inString = char as '\'' | '"';
        }
        else if (char === ')') {
            break;
        }
        metadataEnd++;
    }

    if (metadataEnd === textToSearch.length) {
        return undefined;
    }

    // the metadata looks like key='value', key2="value2", key3=value3
    const metadataText = textToSearch.substring(metadataStart + 'Metadata('.length, metadataEnd).trim();



    const data: Record<string, string> = {};

    let state: 'searchForKey' | 'inKey' | 'inValue' = 'searchForKey';
    let currentKey = '';
    let currentValue = '';
    let inStringValue: '\'' | '"' | undefined = undefined;
    escapeNext = false;
    for (let index = 0; index < metadataText.length; index++) {
        const char = metadataText[index];
        if (escapeNext) {
            escapeNext = false;
            if (char == 'n') {
                currentValue += '\n';
            } else if (char == 'r') {
                currentValue += '\r';
            } else if (char == 't') {
                currentValue += '\t';
            } else if (char == 'b') {
                currentValue += '\b';
            } else if (char == 'f') {
                currentValue += '\f';
            } else if (char == 'v') {
                currentValue += '\v';
            } else if (char == '0') {
                currentValue += '\0';
            } else if (char == 'x') {
                // hex escape sequence, e.g. \x20 for space
                const hex = metadataText.substring(index + 1, index + 3);
                currentValue += String.fromCharCode(parseInt(hex, 16));
                index += 2; // skip the next two characters
            } else if (char == 'u') {
                // unicode escape sequence, e.g. \u20AC for Euro sign
                const hex = metadataText.substring(index + 1, index + 5);
                currentValue += String.fromCharCode(parseInt(hex, 16));
                index += 4; // skip the next four characters
            } else if (char == 'U') {
                // unicode escape sequence, e.g. \U0001F600 for grinning face emoji
                const hex = metadataText.substring(index + 1, index + 9);
                currentValue += String.fromCodePoint(parseInt(hex, 16));
                index += 8; // skip the next eight characters
            } else if (char == 's') {
                // space escape sequence, e.g. \s for space
                currentValue += ' ';
            } else if (char == 'l') {
                // line feed escape sequence, e.g. \l for line feed
                currentValue += '\n';
            } else if (char == 'c') {
                // control character escape sequence, e.g. \cA for start of heading
                const nextChar = metadataText[index + 1];
                if (nextChar) {
                    currentValue += String.fromCharCode(nextChar.charCodeAt(0) - 64); // Control characters are ASCII 1-26
                    index++; // skip the next character
                }
            } else if (char == 'e') {
                // escape character, e.g. \e for escape
                currentValue += '\x1B'; // ASCII escape character
            } else if (char == 'd') {
                // decimal escape sequence, e.g. \d65 for 'A'
                const decimal = metadataText.substring(index + 1, index + 3);
                currentValue += String.fromCharCode(parseInt(decimal, 10));
                index += 2; // skip the next two characters
            } else if (char == 'p') {
                // percent escape sequence, e.g. \p20 for space
                const percent = metadataText.substring(index + 1, index + 3);
                currentValue += String.fromCharCode(parseInt(percent, 16));
                index += 2; // skip the next two characters
            } else {
                currentValue += char;
            }
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        if (inStringValue) {
            if (char === inStringValue) {
                inStringValue = undefined;
            }
            else {
                currentValue += char;
            }
            continue;
        }
        if (char === '\'' || char === '"') {
            inStringValue = char as '\'' | '"';
            continue;
        }
        if (state === 'searchForKey') {
            if (char === '=') {
                // we found a key
                state = 'inValue';
                continue;
            }
            if (char === ' ' || char === '\n' || char === '\r') {
                // we found a space, continue to search for the key
                continue;
            }
            if (char === ',') {
                // we found a comma, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            // we are in the key
            if (char === '\t') {
                // we found a tab, continue to search for the key
                continue;
            }
            if (char === ' ') {
                // we found a space, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            if (char === '\n' || char === '\r') {
                // we found a newline, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            // we are in the key
            currentKey += char;
            state = 'inKey';
        }
        else if (state === 'inKey') {
            if (char === '=') {
                // we found a key
                state = 'inValue';
                continue;
            }
            if (char === ' ' || char === '\n' || char === '\r') {
                // we found a space, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            if (char === ',') {
                // we found a comma, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            if (char === '\t') {
                // we found a tab, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            if (char === '\n' || char === '\r') {
                // we found a newline, continue to search for the key
                if (currentKey) {
                    data[currentKey] = '';
                    currentKey = '';
                }
                continue;
            }
            // we are in the key
            currentKey += char;
        }
        else if (state === 'inValue') {
            if (char === ',') {
                // we found a comma, save the key and value
                if (currentKey) {
                    data[currentKey] = currentValue;
                    currentKey = '';
                    currentValue = '';
                }
                state = 'searchForKey';
                continue;
            }
            if (char === ' ' || char === '\n' || char === '\r') {
                // we found a space, save the key and value
                if (currentKey) {
                    data[currentKey] = currentValue;
                    currentKey = '';
                    currentValue = '';
                }
                state = 'searchForKey';
                continue;
            }
            if (char === '\t') {
                // we found a tab, save the key and value
                if (currentKey) {
                    data[currentKey] = currentValue;
                    currentKey = '';
                    currentValue = '';
                }
                state = 'searchForKey';
                continue;
            }
            if (char === '\n' || char === '\r') {
                // we found a newline, save the key and value
                if (currentKey) {
                    data[currentKey] = currentValue;
                    currentKey = '';
                    currentValue = '';
                }
                state = 'searchForKey';
                continue;
            }
            // we are in the value
            if (char === '\'') {
                // we found a single quote, start a string
                inStringValue = '\'';
                continue;
            }
            if (char === '"') {
                // we found a double quote, start a string
                inStringValue = '"';
                continue;
            }
            // we are in the value
            currentValue += char;
        }
    }

    // if we are still in a value, save the key and value
    if (currentKey) {
        data[currentKey] = currentValue;
        currentKey = '';
        currentValue = '';
    }

    // now we have a data object that looks like this:
    // {
    //   "modelname": "",
    //   "positive": "This is a digital for an illustration for a 'young adault' / \"teen\" novel depicting a 13 year old boy standing in a vast, arid desert landscape. The 13 year old boy has short, dark frizzy brown hair and tained skin, amber-colored eyes, with a serious expression on his face. He is wearing a red hadband, a used, black, hooded poncho that seems to have a triangular shape, it drapes over his shoulders and the tip of the triangular reaches down to his belly. Underneath the Poncho, he has on a dark brown tunic with long sleeves and loose-fitting brown pants. On his feet he has worn roman lether sandals. A wide red sash is tied around his waist, and a small knife is fastened to it. He also wears a red scarf wrapped around his neck. His hands are relaxed at his sides, and he stands with a slightly forward-leaning posture.nnThe background features a bright desert with small, scattered rocks and a clear blue sky with a few white clouds. The desert extends to the horizon, where it meets a slightly darker rocky outcrop. The wind blows sand playfully over the plain.",
    //   "negative": "",
    //   "width": "1328",
    //   "height": "1328",
    //   "seed": "752388247315520",
    //   "steps": "30",
    //   "cfg": "2.592825949192047",
    //   "sampler_name": "euler",
    //   "scheduler_name": "karras",
    //   "denoise": "1.0",
    //   "clip_skip": "0",
    //   "custom": "karras",
    //   "additional_hashes": "",
    //   "ckpt_path": "",
    //   "a111_params": "This is a digital for an illustration for a 'young adault' / \"teen\" novel depicting a 13 year old boy standing in a vast, arid desert landscape. The 13 year old boy has short, dark frizzy brown hair and tained skin, amber-colored eyes, with a serious expression on his face. He is wearing a red hadband, a used, black, hooded poncho that seems to have a triangular shape, it drapes over his shoulders and the tip of the triangular reaches down to his belly. Underneath the Poncho, he has on a dark brown tunic with long sleeves and loose-fitting brown pants. On his feet he has worn roman lether sandals. A wide red sash is tied around his waist, and a small knife is fastened to it. He also wears a red scarf wrapped around his neck. His hands are relaxed at his sides, and he stands with a slightly forward-leaning posture.nnThe background features a bright desert with small, scattered rocks and a clear blue sky with a few white clouds. The desert extends to the horizon, where it meets a slightly darker rocky outcrop. The wind blows sand playfully over the plain.nNegative prompt: nSteps: 30, Sampler: Euler Karras, CFG scale: 2.592825949192047, Seed: 752388247315520, Size: 1328x1328, karras, Model: , Hashes: {\"model\":\"\"}, Version: ComfyUI",
    //   "final_hashes": ""
    // }
    // we need to convert it to the expected metadata format


    const custom = data.custom?.length > 0 ? parseCustomData(data.custom) : undefined;

    const metadata: Entry['meta'] = {
        dimensions: data.width?.length > 0 && data.height?.length > 0 ? {
            width: parseInt(data.width ?? '0', 10),
            height: parseInt(data.height ?? '0', 10)
        } : undefined,
        seed: data.seed ? parseInt(data.seed, 10) : undefined,
        prompt: data.positive.length > 0 ? {
            positive: data.positive ?? '',
            negative: data.negative?.length > 0 ? data.negative : undefined
        } : undefined,
        cfg: data.cfg ? parseFloat(data.cfg) : undefined,
        model: data.modelname.length > 0 ? data.modelname : undefined,
        sampler: data.sampler_name?.length > 0 ? data.sampler_name : undefined,
        sceduler: data.scheduler_name?.length > 0 ? data.scheduler_name : undefined,
        steps: data.steps ? parseInt(data.steps, 10) : undefined,

        took: custom?.elapsed_time,
        additional: {
        }
    };

    return metadata;


    function parseCustomData(data: string) {
        try {

            return JSON.parse(data) as {
                elapsed_time?: number,
            };
        } catch {
            return {};
        }
    }

}
(async () => {


    // Initialize files on server start
    // call loadFiles when the filesystem changes
    const waitch = fs.watch(galeryPath, { recursive: true });
    let timeout: NodeJS.Timeout | undefined = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const event of waitch) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(async () => {
            timeout = undefined;
            console.log('File system change detected, reloading files...');
            await loadFiles();
        }
            , 3000);
    }
})();


await loadFiles();


