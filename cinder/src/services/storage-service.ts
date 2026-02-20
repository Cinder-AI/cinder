import { APP_CONFIG } from "../config";

export class StorageService {
    baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl ?? APP_CONFIG.STORAGE_URL;
    }

    async uploadTokenImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file, file.name || 'upload.jpg');

        const res = await fetch(`${this.baseUrl}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            let bodyText = '';
            try {
                bodyText = await res.text();
            } catch (e) {
                bodyText = res.statusText;
            }
            throw new Error(`Upload failed: ${res.status} ${bodyText}`);
        }

        const json = await res.json();
        // storage service returns { url, filename }
        return json.filename ?? json.url ?? '';
    }

    async uploadDataUrl(dataUrl: string, filename = 'upload.jpg'): Promise<string> {
        const blob = this.dataURLtoBlob(dataUrl);
        const file = new File([blob], filename, { type: blob.type });
        return this.uploadTokenImage(file);
    }

    dataURLtoBlob(dataurl: string): Blob {
        const parts = dataurl.split(',');
        const header = parts[0] || '';
        const b64 = parts[1] || '';
        const mimeMatch = header.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const binary = atob(b64);
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
        return new Blob([u8], { type: mime });
    }
}

export const storageService = new StorageService();
export default storageService;
