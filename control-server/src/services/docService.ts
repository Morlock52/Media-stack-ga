import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/env.js';

const DOCS_SITE_ROOT = path.join(PROJECT_ROOT, 'docs-site');
const DOCS_DIR = path.join(DOCS_SITE_ROOT, 'src/components/docs');

export const createDoc = (name: string, content: string) => {
    if (!fs.existsSync(DOCS_DIR)) {
        fs.mkdirSync(DOCS_DIR, { recursive: true });
    }
    const filePath = path.join(DOCS_DIR, `${name}.tsx`);
    fs.writeFileSync(filePath, content);
    return { name, filePath };
};

export const updateDoc = (name: string, content: string) => {
    const filePath = path.join(DOCS_DIR, `${name}.tsx`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Doc ${name} not found`);
    }
    fs.writeFileSync(filePath, content);
    return { name, filePath };
};

export const readDoc = (name: string) => {
    const filePath = path.join(DOCS_DIR, `${name}.tsx`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Doc ${name} not found`);
    }
    return fs.readFileSync(filePath, 'utf-8');
};

export const listDocs = () => {
    if (!fs.existsSync(DOCS_DIR)) return [];
    return fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.tsx')).map(f => f.replace('.tsx', ''));
};
