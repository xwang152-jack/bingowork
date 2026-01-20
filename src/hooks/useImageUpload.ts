import { useState, useCallback, useRef } from 'react';

// Constants (mirrored from electron/constants/config.ts)
const ALLOWED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
] as const;

const FILE_SIZE_LIMITS = {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

const ERROR_MESSAGES = {
    INVALID_IMAGE_TYPE: '不支持的图片格式',
    FILE_TOO_LARGE: (maxSize: string) => `文件过大，最大允许 ${maxSize}`,
    UNKNOWN_ERROR: '发生未知错误',
} as const;

export interface ImageUploadResult {
    dataUrl: string;
    mimeType: string;
    size: number;
}

export interface UseImageUploadOptions {
    maxFileSize?: number;
    allowedTypes?: readonly string[];
    onImageLoaded?: (result: ImageUploadResult) => void;
    onError?: (error: string) => void;
}

/**
 * Custom hook for handling image uploads in Bingowork
 * Supports file selection and paste events with validation
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
    const {
        maxFileSize = FILE_SIZE_LIMITS.MAX_IMAGE_SIZE,
        allowedTypes = ALLOWED_IMAGE_TYPES,
        onImageLoaded,
        onError,
    } = options;

    const [images, setImages] = useState<ImageUploadResult[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Validate an image file
     */
    const validateImage = useCallback((file: File): string | null => {
        // Check file type
        if (!file.type.startsWith('image/')) {
            return ERROR_MESSAGES.INVALID_IMAGE_TYPE;
        }

        // Check allowed types
        if (!allowedTypes.includes(file.type)) {
            return ERROR_MESSAGES.INVALID_IMAGE_TYPE;
        }

        // Check file size
        if (file.size > maxFileSize) {
            const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(1);
            return ERROR_MESSAGES.FILE_TOO_LARGE(maxSizeMB + 'MB');
        }

        return null;
    }, [maxFileSize, allowedTypes]);

    /**
     * Convert a file to data URL
     */
    const fileToDataUrl = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }, []);

    /**
     * Process a single image file
     */
    const processImage = useCallback(async (file: File): Promise<ImageUploadResult | null> => {
        // Validate the file
        const error = validateImage(file);
        if (error) {
            onError?.(error);
            return null;
        }

        try {
            // Convert to data URL
            const dataUrl = await fileToDataUrl(file);

            const result: ImageUploadResult = {
                dataUrl,
                mimeType: file.type,
                size: file.size,
            };

            onImageLoaded?.(result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN_ERROR;
            onError?.(errorMessage);
            return null;
        }
    }, [validateImage, fileToDataUrl, onImageLoaded, onError]);

    /**
     * Handle file selection from input
     */
    const handleFileSelect = useCallback(async (file: File): Promise<boolean> => {
        const result = await processImage(file);
        if (result) {
            setImages(prev => [...prev, result]);
            return true;
        }
        return false;
    }, [processImage]);

    /**
     * Handle paste event with images
     */
    const handlePaste = useCallback(async (event: ClipboardEvent): Promise<boolean> => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const results: ImageUploadResult[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const result = await processImage(file);
                    if (result) {
                        results.push(result);
                    }
                }
            }
        }

        if (results.length > 0) {
            setImages(prev => [...prev, ...results]);
            return true;
        }

        return false;
    }, [processImage]);

    /**
     * Handle drag and drop
     */
    const handleDrop = useCallback(async (event: DragEvent): Promise<boolean> => {
        event.preventDefault();

        const files = event.dataTransfer?.files;
        if (!files) return false;

        const results: ImageUploadResult[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = await processImage(file);
            if (result) {
                results.push(result);
            }
        }

        if (results.length > 0) {
            setImages(prev => [...prev, ...results]);
            return true;
        }

        return false;
    }, [processImage]);

    /**
     * Remove an image by index
     */
    const removeImage = useCallback((index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * Clear all images
     */
    const clearImages = useCallback(() => {
        setImages([]);
    }, []);

    /**
     * Trigger file input click
     */
    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    /**
     * Get images as the format expected by the IPC handler
     */
    const getImagesForUpload = useCallback(() => {
        return images.map(img => img.dataUrl);
    }, [images]);

    return {
        images,
        fileInputRef,
        handleFileSelect,
        handlePaste,
        handleDrop,
        removeImage,
        clearImages,
        triggerFileSelect,
        getImagesForUpload,
    };
}
