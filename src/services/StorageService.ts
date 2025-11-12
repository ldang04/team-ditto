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
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

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
            allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
          }
        );

        if (createError) {
          logger.error("StorageService: Error creating bucket:", createError);
        } else {
          logger.info(`StorageService: Bucket "${this.BUCKET_NAME}" created successfully`);
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
      logger.info(
        `StorageService: Uploading image for content ${contentId}`
      );

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
      const { data, error } = await supabase.storage
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
   * Upload multiple images (for batch generation)
   * @param images - Array of image data objects
   * @param projectId - Project ID for organizing files
   * @param contentIds - Array of content IDs corresponding to each image
   * @returns Array of public URLs
   */
  static async uploadMultipleImages(
    images: Array<{ imageData: string; mimeType: string }>,
    projectId: string,
    contentIds: string[]
  ): Promise<string[]> {
    logger.info(
      `StorageService: Uploading ${images.length} images in batch`
    );

    if (images.length !== contentIds.length) {
      throw new Error(
        "Number of images must match number of content IDs"
      );
    }

    const uploadPromises = images.map((image, index) =>
      this.uploadImage(
        image.imageData,
        image.mimeType,
        projectId,
        contentIds[index]
      )
    );

    try {
      const urls = await Promise.all(uploadPromises);
      logger.info(
        `StorageService: Successfully uploaded ${urls.length} images`
      );
      return urls;
    } catch (error: any) {
      logger.error("StorageService: Batch upload failed:", error);
      throw new Error(`Batch image upload failed: ${error.message}`);
    }
  }

  /**
   * Delete an image from storage
   * @param imageUrl - Public URL of the image to delete
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const filePath = this.extractFilePathFromUrl(imageUrl);

      if (!filePath) {
        throw new Error("Invalid image URL");
      }

      logger.info(`StorageService: Deleting image at ${filePath}`);

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        logger.error("StorageService: Delete error:", error);
        throw new Error(`Failed to delete image: ${error.message}`);
      }

      logger.info("StorageService: Image deleted successfully");
    } catch (error: any) {
      logger.error("StorageService: Delete failed:", error);
      throw new Error(`Image deletion failed: ${error.message}`);
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

  /**
   * Extract file path from Supabase Storage public URL
   */
  private static extractFilePathFromUrl(url: string): string | null {
    try {
      // Supabase storage URLs follow pattern:
      // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const match = url.match(
        /\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/
      );
      return match ? match[1] : null;
    } catch (error) {
      logger.error("StorageService: Error extracting file path:", error);
      return null;
    }
  }

  /**
   * Check if an image exists in storage
   * @param imageUrl - Public URL to check
   * @returns boolean indicating if image exists
   */
  static async imageExists(imageUrl: string): Promise<boolean> {
    try {
      const filePath = this.extractFilePathFromUrl(imageUrl);

      if (!filePath) {
        return false;
      }

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(filePath.split("/")[0], {
          search: filePath.split("/").pop(),
        });

      return !error && data && data.length > 0;
    } catch (error) {
      logger.error("StorageService: Error checking image existence:", error);
      return false;
    }
  }

  /**
   * Get signed URL for temporary access (if needed for private content)
   * @param filePath - File path in storage
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   */
  static async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error: any) {
      logger.error("StorageService: Error creating signed URL:", error);
      throw new Error(`Signed URL creation failed: ${error.message}`);
    }
  }
}

