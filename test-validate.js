/**
 * Test script to demonstrate real content validation
 * 
 * This script:
 * 1. Generates real content using /api/generate
 * 2. Validates the generated content using /api/validate
 * 3. Shows real AI analysis and scores
 * 
 * Usage:
 *   API_KEY=your-key PROJECT_ID=your-project-id node test-validate.js
 */

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PROJECT_ID = process.env.PROJECT_ID;

if (!API_KEY || !PROJECT_ID) {
  console.error("Error: Missing required environment variables");
  console.error("Usage: API_KEY=your-key PROJECT_ID=your-project-id node test-validate.js");
  process.exit(1);
}

async function testRealValidation() {
  console.log("Testing Real Content Validation\n");

  // Step 1: Generate real content with AI
  console.log("Step 1: Generating content with AI...");
  const generateResponse = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      project_id: PROJECT_ID,
      prompt: "Create a short social media post about our innovative new product",
      variantCount: 1
    })
  });

  if (!generateResponse.ok) {
    console.error("Generation failed:", await generateResponse.text());
    return;
  }

  const generated = await generateResponse.json();
  console.log("Content generated successfully!");
  console.log(`   Content ID: ${generated.variants[0].content_id}`);
  console.log(`   Content Preview: ${generated.variants[0].generated_content.substring(0, 100)}...`);
  console.log();

  // Step 2: Validate the generated content by ID
  console.log("Step 2: Validating generated content...");
  const validateByIdResponse = await fetch(`${BASE_URL}/api/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      content_id: generated.variants[0].content_id
    })
  });

  if (!validateByIdResponse.ok) {
    console.error("Validation failed:", await validateByIdResponse.text());
    return;
  }

  const validation1 = await validateByIdResponse.json();
  console.log("Validation complete!\n");
  
  console.log("VALIDATION RESULTS:");
  console.log("=" .repeat(50));
  console.log(`   Brand Consistency: ${validation1.validation.brand_consistency_score}/100`);
  console.log(`   Quality Score: ${validation1.validation.quality_score}/100`);
  console.log(`   Overall Score: ${validation1.validation.overall_score}/100`);
  console.log(`   Passes Validation: ${validation1.validation.passes_validation ? "YES" : "NO"}`);
  console.log();

  console.log("STRENGTHS:");
  validation1.validation.strengths.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s}`);
  });
  console.log();

  if (validation1.validation.issues.length > 0) {
    console.log("ISSUES:");
    validation1.validation.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
      console.log(`      Suggestion: ${issue.suggestion}`);
    });
    console.log();
  }

  console.log("RECOMMENDATIONS:");
  validation1.validation.recommendations.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r}`);
  });
  console.log();

  console.log("SUMMARY:");
  console.log(`   ${validation1.validation.summary}`);
  console.log("=" .repeat(50));
  console.log();

  // Step 3: Test with bad content
  console.log("Step 3: Testing with intentionally bad content...");
  const badContent = "BUY NOW!!! AMAZING DEAL!!! CLICK HERE!!!";
  
  const validateBadResponse = await fetch(`${BASE_URL}/api/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      content: badContent,
      project_id: PROJECT_ID
    })
  });

  if (!validateBadResponse.ok) {
    console.error("Validation failed:", await validateBadResponse.text());
    return;
  }

  const validation2 = await validateBadResponse.json();
  console.log("Bad content validated!\n");
  
  console.log("BAD CONTENT RESULTS:");
  console.log("=" .repeat(50));
  console.log(`   Content: "${badContent}"`);
  console.log(`   Overall Score: ${validation2.validation.overall_score}/100`);
  console.log(`   Passes Validation: ${validation2.validation.passes_validation ? "YES" : "NO"}`);
  console.log(`   Issues Found: ${validation2.validation.issues.length}`);
  console.log("=" .repeat(50));
  console.log();

  console.log("Test complete! This was real AI analysis using Vertex AI.");
}

// Run the test
testRealValidation().catch(console.error);

