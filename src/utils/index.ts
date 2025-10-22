/**
 * utils.ts
 *
 * This file defines ...
 *
 */
import crypto from "crypto";
import { VertexAI } from "@google-cloud/vertexai";
import { supabase } from "../config/supabaseClient";

export function generateApiKey() {
  const key = crypto.randomBytes(32).toString("hex");
  const prefix = key.slice(0, 8);
  return { key, prefix };
}

/**
 * Generates embeddings for text content and stores them in the database
 * TODO: Fix Vertex AI embeddings API integration
 */
export async function embedTextAndAttach(contentId: string, text: string): Promise<void> {
  try {
    // TODO: Implement proper Vertex AI embeddings API - logs would-be embedding for now. 
    console.log(`TODO: generate embedding for content ${contentId}: ${text.substring(0, 100)}...`);
    
    // for now: store a simple text representation in embeddings table
    await supabase.from("embeddings").insert({
      content_id: contentId,
      embedding: [], // Empty array for now
      text_content: text
    });

  } catch (error) {
    // log error (soft fail - doesn't throw error)
    console.warn("Failed to generate/store embedding:", error);
  }
}
