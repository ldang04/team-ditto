/**
 * services/StorageService.ts
 *
 * Handles file storage operations with Supabase Storage.
 * Manages image uploads, retrieval, and URL generation for generated content.
 */

import { supabase } from "../config/supabaseClient";
import logger from "../config/logger";
import { randomBytes } from "crypto";

export class StorageService {
  private static readonly BUCKET_NAME = "content-images";
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Initialize storage bucket (ensure it exists)
   * This should be called on app startup
   */
  static async initialize(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();

      if (listError) {
        logger.error("StorageService: Error listing buckets:", listError);
        return;
      }

      const bucketExists = buckets?.some((b) => b.name === this.BUCKET_NAME);

      if (!bucketExists) {
        logger.info(
          `StorageService: Bucket "${this.BUCKET_NAME}" does not exist. Creating...`
        );

        const { error: createError } = await supabase.storage.createBucket(
          this.BUCKET_NAME,
          {
            public: true, // Images are public for content generation use
            fileSizeLimit: this.MAX_FILE_SIZE,
            allowedMimeTypes: [
              "image/png",
              "image/jpeg",
              "image/jpg",
              "image/webp",
            ],
          }
        );

        if (createError) {
          logger.error("StorageService: Error creating bucket:", createError);
        } else {
          logger.info(
            `StorageService: Bucket "${this.BUCKET_NAME}" created successfully`
          );
        }
      } else {
        logger.info(
          `StorageService: Bucket "${this.BUCKET_NAME}" already exists`
        );
      }
    } catch (error) {
      logger.error("StorageService: Initialization error:", error);
    }
  }

  /**
   * Upload an image to Supabase Storage
   * @param imageData - Base64 encoded image data
   * @param mimeType - MIME type of the image (e.g., 'image/png')
   * @param projectId - Project ID for organizing files
   * @param contentId - Content ID for file naming
   * @returns Public URL of the uploaded image
   */
  static async uploadImage(
    imageData: string,
    mimeType: string,
    projectId: string,
    contentId: string
  ): Promise<string> {
    try {
      logger.info(`StorageService: Uploading image for content ${contentId}`);

      // Convert base64 to buffer
      const buffer = Buffer.from(imageData, "base64");

      // Validate file size
      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(
          `Image size (${buffer.length} bytes) exceeds maximum allowed size (${this.MAX_FILE_SIZE} bytes)`
        );
      }

      // Generate unique filename
      const fileExtension = this.getFileExtension(mimeType);
      const randomSuffix = randomBytes(8).toString("hex");
      const fileName = `${projectId}/${contentId}_${randomSuffix}.${fileExtension}`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        logger.error("StorageService: Upload error:", error);
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      logger.info(
        `StorageService: Image uploaded successfully to ${publicUrl}`
      );

      return publicUrl;
    } catch (error: any) {
      logger.error("StorageService: Upload failed:", error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  /**
   * Get file extension from MIME type
   */
  private static getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
    };

    return extensions[mimeType] || "png";
  }
}
