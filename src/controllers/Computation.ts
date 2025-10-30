import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { ContentModel } from "../models/ContentModel";
import { ProjectModel } from "../models/ProjectModel";
import { ThemeModel } from "../models/ThemeModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import { EmbeddingService } from "../services/EmbeddingService";
import "dotenv/config";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const ComputationController = {
  async generate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body} `);
      const {
        project_id,
        prompt,
        media_type = "text", // default
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
      } = req.body;

      let serviceResponse;

      if (!project_id || !prompt) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields: project_id and prompt",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Fetch project data for brand memory
      const { data: project, error: projectError } = await ProjectModel.getById(
        project_id
      );
      if (projectError || !project) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Project not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Fetch theme data for brand memory
      const { data: theme, error: themeError } = await ThemeModel.getById(
        project.theme_id
      );
      if (themeError || !theme) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Initialize Vertex AI
      const vertex = new VertexAI({
        project: process.env.GCP_PROJECT_ID,
        location: "us-central1",
      });

      const model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
      });

      // Build context-aware prompt with brand memory
      // CITATION: used AI to generate prompt for content generation
      const enhancedPrompt = `
        Generate ${variantCount} different variants of ${media_type} content for a marketing campaign with the following requirements:
        
        PROJECT CONTEXT:
        - Project Name: ${project.name}
        - Description: ${project.description}
        - Goals: ${project.goals}
        - Customer Type: ${project.customer_type}
        
        THEME & BRAND:
        - Theme Name: ${theme.name}
        - Font: ${theme.font}
        - Tags: ${theme.tags.join(", ")}
        - Inspirations: ${theme.inspirations.join(", ")}
        
        GENERATION REQUIREMENTS:
        - User Prompt: ${prompt}
        - Media Type: ${media_type}
        - Target Audience: ${target_audience}
        - Style Preferences: ${JSON.stringify(style_preferences)}
        
        Create ${variantCount} distinct, branded content variants that align with the project's theme and goals.
        Each variant should be clearly separated with "---VARIANT_START---" and "---VARIANT_END---" markers.
        Return the content in a format suitable for ${media_type} generation.
      `;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: enhancedPrompt }],
          },
        ],
      });

      const generatedText =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No content generated";

      // parse variants from the response - use regex to separate content.
      const variantRegex = /---VARIANT_START---(.*?)---VARIANT_END---/gs;
      const matches = generatedText.match(variantRegex);

      let variants = [];
      if (matches && matches.length > 0) {
        // extract content from each variant
        variants = matches.map((match) =>
          match
            .replace(/---VARIANT_START---/g, "")
            .replace(/---VARIANT_END---/g, "")
            .trim()
        );
      } else {
        // fallback: split by common separators or use the whole text
        const fallbackVariants = generatedText
          .split("\n\n")
          .filter((v) => v.trim().length > 0);
        variants =
          fallbackVariants.length > 0 ? fallbackVariants : [generatedText];
      }

      // ensure we don't exceed the requested variant count
      variants = variants.slice(0, variantCount);

      // save each variant to database and generate embeddings
      const savedVariants = [];
      for (const variantContent of variants) {
        const { data, error } = await ContentModel.create({
          project_id,
          media_type,
          media_url: "", // TODO: add media url when file storage is implemented
          text_content: variantContent,
        });

        if (error) {
          logger.error("Database save error:", error);
          continue; // if a particular variant fails, continue with others
        }

        // generate and store embeddings
        await EmbeddingService.generateAndStore(data.id, variantContent);

        savedVariants.push({
          content_id: data.id,
          generated_content: variantContent,
        });
      }

      if (savedVariants.length === 0) {
        throw Error("Failed to save any content variants to database");
      }

      serviceResponse = ServiceResponse.success(
        {
          success: true,
          variants: savedVariants,
          project_id,
          media_type,
          variant_count: savedVariants.length,
          timestamp: new Date().toISOString(),
        },
        "Content generated successfully",
        StatusCodes.CREATED
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in ProjectController.generate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * CITATION: Function error handling and JSDoc assisted by Cursor.
   *
   * Validate content against brand guidelines using embedding similarity
   * Accepts either content_id (for existing content) or content + project_id (for new content)
   */
  async validate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body} `);
      const { content_id, content, project_id } = req.body;

      let serviceResponse;

      // Validate input: need either content_id OR (content + project_id)
      if (!content_id && (!content || !project_id)) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Must provide either content_id OR (content + project_id)",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      let projectId: string;
      let textContent: string;
      let contentEmbedding: number[];

      // Scenario 1: Validate existing content by ID
      if (content_id) {
        // Fetch content from database
        const { data: existingContent, error: fetchError } =
          await ContentModel.getById(content_id);

        if (fetchError || !existingContent) {
          serviceResponse = ServiceResponse.failure(
            null,
            "Content not found",
            StatusCodes.NOT_FOUND
          );
          return handleServiceResponse(serviceResponse, res);
        }

        textContent = existingContent.text_content;

        // Try to get existing embedding
        const { data: embeddingData } = await EmbeddingsModel.getByContentId(
          content_id
        );
        if (
          embeddingData &&
          embeddingData.length > 0 &&
          embeddingData[0].embedding.length > 0
        ) {
          contentEmbedding = embeddingData[0].embedding;
        } else {
          // Generate new embedding
          contentEmbedding = await EmbeddingService.generateAndStore(
            content_id,
            textContent
          );
        }

        projectId = existingContent.project_id;
      }
      // Scenario 2: Validate new/raw content
      else {
        textContent = content;
        projectId = project_id;

        // Generate embedding for new content (without storing)
        contentEmbedding = await EmbeddingService.generateDocumentEmbedding(
          textContent
        );
      }

      // Fetch project and theme
      const { data: project, error: projectError } = await ProjectModel.getById(
        projectId
      );

      if (projectError || !project) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Project not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }
      const projectData = project;

      const { data: theme, error: themeError } = await ThemeModel.getById(
        project.theme_id
      );

      if (themeError || !theme) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }
      const themeData = theme;

      // Build brand reference texts
      const brandTexts = [
        `${themeData.name}: ${themeData.tags.join(", ")}`,
        `Inspired by: ${themeData.inspirations.join(", ")}`,
        `${projectData.description}`,
        `Goals: ${projectData.goals}`,
        `Target: ${projectData.customer_type}`,
      ];

      // Generate embeddings for brand references
      const brandEmbeddings = await Promise.all(
        brandTexts.map((text) =>
          EmbeddingService.generateDocumentEmbedding(text)
        )
      );

      // Calculate similarity scores with each brand reference
      const similarityScores = brandEmbeddings.map((brandEmb) =>
        EmbeddingService.cosineSimilarity(contentEmbedding, brandEmb)
      );

      // Average similarity as brand consistency score
      const avgSimilarity =
        similarityScores.reduce((sum, score) => sum + score, 0) /
        similarityScores.length;
      const brandConsistencyScore = Math.round(avgSimilarity * 100);

      // Quality heuristics based on text features
      const qualityScore =
        ComputationController.calculateQualityScore(textContent);

      // Overall score: 60% brand consistency, 40% quality
      const overallScore = Math.round(
        brandConsistencyScore * 0.6 + qualityScore * 0.4
      );
      const passesValidation = overallScore >= 70;

      // Generate insights based on scores
      const strengths = [];
      const issues = [];
      const recommendations = [];

      // Analyze brand consistency
      if (brandConsistencyScore >= 80) {
        strengths.push("Strong alignment with brand guidelines");
      } else if (brandConsistencyScore < 60) {
        issues.push({
          severity: "major",
          category: "brand_alignment",
          description:
            "Content does not strongly align with brand theme and goals",
          suggestion: `Incorporate more elements from: ${themeData.tags
            .slice(0, 3)
            .join(", ")}`,
        });
      }

      // Analyze quality
      if (qualityScore >= 80) {
        strengths.push("High-quality writing with good structure");
      } else if (qualityScore < 60) {
        issues.push({
          severity: "major",
          category: "clarity",
          description: "Content quality could be improved",
          suggestion: "Review for clarity, length, and professional tone",
        });
      }

      // Check for specific patterns
      if (textContent.match(/[!]{2,}/)) {
        issues.push({
          severity: "minor",
          category: "tone",
          description: "Excessive exclamation marks detected",
          suggestion: "Use a more professional tone",
        });
      }

      if (textContent.length < 50) {
        issues.push({
          severity: "minor",
          category: "clarity",
          description: "Content is very short",
          suggestion: "Consider adding more detail to convey value",
        });
      }

      // Generate recommendations
      if (brandConsistencyScore < 80) {
        recommendations.push(
          `Reference brand inspirations: ${themeData.inspirations
            .slice(0, 2)
            .join(", ")}`
        );
      }
      if (
        !textContent
          .toLowerCase()
          .includes(projectData.customer_type.split(" ")[0])
      ) {
        recommendations.push(
          `Address target audience: ${projectData.customer_type}`
        );
      }

      // Build summary
      let summary = "";
      if (overallScore >= 85) {
        summary =
          "Excellent content that aligns well with brand guidelines and maintains high quality.";
      } else if (overallScore >= 70) {
        summary =
          "Good content with minor improvements possible for better brand alignment.";
      } else if (overallScore >= 50) {
        summary =
          "Content needs revision to better align with brand guidelines.";
      } else {
        summary =
          "Content significantly deviates from brand guidelines and requires substantial revision.";
      }

      // Return validation results
      serviceResponse = ServiceResponse.success(
        {
          success: true,
          content_id: content_id || null,
          project_id: projectData.id,
          validation: {
            brand_consistency_score: brandConsistencyScore,
            quality_score: qualityScore,
            overall_score: overallScore,
            passes_validation: passesValidation,
            strengths:
              strengths.length > 0
                ? strengths
                : ["Content meets basic requirements"],
            issues: issues,
            recommendations:
              recommendations.length > 0
                ? recommendations
                : ["Content is well-aligned with brand"],
            summary: summary,
            similarity_details: {
              theme_similarity: Math.round(similarityScores[0] * 100),
              inspiration_similarity: Math.round(similarityScores[1] * 100),
              description_similarity: Math.round(similarityScores[2] * 100),
              goals_similarity: Math.round(similarityScores[3] * 100),
              audience_similarity: Math.round(similarityScores[4] * 100),
            },
          },
          timestamp: new Date().toISOString(),
        },
        "Success",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in ComputationController.validate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  async testVertex(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body} `);
      let serviceResponse;

      logger.info("GCP_PROJECT_ID from env:", process.env.GCP_PROJECT_ID);

      if (!process.env.GCP_PROJECT_ID) {
        serviceResponse = ServiceResponse.failure(
          {
            env_keys: Object.keys(process.env).filter(
              (k) => k.includes("GCP") || k.includes("GOOGLE")
            ),
          },
          "GCP_PROJECT_ID not set",
          StatusCodes.INTERNAL_SERVER_ERROR
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const vertex = new VertexAI({
        project: process.env.GCP_PROJECT_ID,
        location: "us-central1",
      });

      const model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
      });

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: "Say hi from Vertex AI!" }] },
        ],
      });

      const response =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response generated";

      serviceResponse = ServiceResponse.success(
        response,
        "Vertex AI test successful",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in ComputationController.testVertex:", error);
      const serviceResponse = ServiceResponse.failure(
        error,
        "Vertex test failed"
      );
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Calculate quality score based on text heuristics
   */
  calculateQualityScore(text: string): number {
    let score = 70; // Start with baseline

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Length checks
    if (words.length >= 20 && words.length <= 200) {
      score += 10; // Good length
    } else if (words.length < 10 || words.length > 300) {
      score -= 10; // Too short or too long
    }

    // Sentence structure
    if (sentences.length >= 2) {
      score += 5; // Multiple sentences
    }

    // Average word length (indicator of vocabulary)
    const avgWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgWordLength >= 5 && avgWordLength <= 8) {
      score += 5; // Good vocabulary balance
    }

    // Check for excessive punctuation
    if ((text.match(/[!]/g) || []).length > 3) {
      score -= 10; // Too many exclamation marks
    }

    // Check for all caps (unprofessional)
    const capsWords = words.filter(
      (w) => w === w.toUpperCase() && w.length > 2
    );
    if (capsWords.length > words.length * 0.1) {
      score -= 10; // Too much shouting
    }

    // Professional indicators
    const professionalWords = [
      "innovative",
      "professional",
      "seamless",
      "efficient",
      "experience",
      "solution",
    ];
    const professionalCount = professionalWords.filter((pw) =>
      text.toLowerCase().includes(pw)
    ).length;
    score += Math.min(professionalCount * 3, 10);

    return Math.max(0, Math.min(100, score));
  },
};
