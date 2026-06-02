import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('page.tsx')) results.push(file);
        }
    });
    return results;
}

const files = walk('src/app/(guest)/checkin');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix the signature: params: { reference: string } -> params: Promise<{ reference: string }>
    // and extract params at the top of the function
    let match = content.match(/export default async function\s+\w+\(\s*(?:{\s*params(?:,\s*searchParams)?\s*}|{.*?params.*?})\s*:\s*{(.*?)}\s*\)\s*{/s);
    if (match) {
        // If already fixed, skip
        if (content.includes('await params;')) return;

        // Replace the parameters with promises if they aren't already
        let newHeader = match[0]
            .replace(/params\s*:\s*{\s*(.*?)\s*}/, "params: Promise<{$1}>")
            .replace(/searchParams\s*:\s*{\s*(.*?)\s*}/, "searchParams: Promise<{$1}>");
        
        let awaitBlock = `\n    const resolvedParams = await params;\n`;
        if (content.includes('searchParams')) {
            awaitBlock += `    const resolvedSearchParams = await searchParams;\n`;
        }

        // Now replace params.xxx with resolvedParams.xxx in the rest of the file
        // Also handle searchParams.xxx -> resolvedSearchParams.xxx
        
        let newContent = content.replace(match[0], newHeader + awaitBlock);
        
        newContent = newContent.replace(/params\./g, "resolvedParams.");
        newContent = newContent.replace(/searchParams\./g, "resolvedSearchParams.");

        // Fix the redirect inside try/catch bug
        // If there's a redirect, we need to move it out of the try block or return it
        if (newContent.includes('redirect(')) {
            // we can just make it throw again if it catches NEXT_REDIRECT
            // Actually, next/navigation redirect throws an error. 
            // In catch (error) { if(error.message === 'NEXT_REDIRECT') throw error; }
            newContent = newContent.replace(/catch\s*\((.*?)\)\s*{/g, `catch ($1) {\n        if ($1 && typeof $1 === 'object' && 'digest' in $1 && String($1.digest).startsWith('NEXT_REDIRECT')) throw $1;`);
        }

        fs.writeFileSync(file, newContent, 'utf8');
        console.log("Fixed", file);
    }
});
