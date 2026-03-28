import { supabase } from "./supabaseClient.js";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const THEME_WEIGHTS = {
  REGULATORY: 0.35,
  RISK: 0.25,
  CONTRACT: 0.20,
  OPTIMIZATION: 0.20,
};

const WEIGHT_CONSTRAINTS = {
  MIN: 0.05,
  MAX: 0.5,
  SUM_TOLERANCE: 0.001,
};

const LLM_ADJUSTMENT_LIMIT = 0.10;

async function computeBaseWeights(ccf) {
  console.log(`📊 Computing base weights for project...`);

  try {
    validateCCF(ccf);

    const weights = JSON.parse(JSON.stringify(THEME_WEIGHTS));
    const adjustments = {};

    const complexityIndex = computeComplexityIndex(ccf);
    adjustments.complexity = complexityIndex;

    if (ccf.modification_structurelle) {
      weights.REGULATORY *= 1.15;
      weights.RISK *= 1.10;
      adjustments.structuralImpact = 1.15;
      console.log(`  📐 Structural modification detected - adjusted weights`);
    }

    if (ccf.zone_abf) {
      weights.REGULATORY *= 1.20;
      adjustments.abfImpact = 1.20;
      console.log(`  🏛️ ABF zone detected - regulatory weight increased`);
    }

    if (ccf.erp) {
      weights.REGULATORY *= 1.25;
      weights.RISK *= 1.15;
      adjustments.erpImpact = 1.25;
      console.log(`  🚨 ERP building detected - significant weight adjustment`);
    }

    if (ccf.permis_requis) {
      weights.REGULATORY *= 1.12;
      weights.CONTRACT *= 1.08;
      adjustments.permitsImpact = 1.12;
      console.log(`  📋 Permits required - contract weight adjusted`);
    }

    if (ccf.lot_technique_sensible) {
      weights.RISK *= 1.20;
      weights.OPTIMIZATION *= 1.10;
      adjustments.technicalRiskImpact = 1.20;
      console.log(`  ⚙️ Sensitive technical lots detected - risk weight increased`);
    }

    if (ccf.surface && ccf.surface > 1000) {
      weights.REGULATORY *= 1.08;
      weights.RISK *= 1.05;
      adjustments.surfaceImpact = 1.08;
      console.log(`  📏 Large surface (${ccf.surface}m²) - weights adjusted`);
    }

    const normalizedWeights = normalizeWeights(weights);

    console.log(`  ✅ Base weights computed`);
    console.log(`     Regulatory: ${(normalizedWeights.REGULATORY * 100).toFixed(1)}%`);
    console.log(`     Risk: ${(normalizedWeights.RISK * 100).toFixed(1)}%`);
    console.log(`     Contract: ${(normalizedWeights.CONTRACT * 100).toFixed(1)}%`);
    console.log(`     Optimization: ${(normalizedWeights.OPTIMIZATION * 100).toFixed(1)}%`);
    console.log(`     Complexity Index: ${complexityIndex.toFixed(3)}`);

    return {
      weights: normalizedWeights,
      complexity_index: complexityIndex,
      adjustments,
      base_calculated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Base weights computation failed: ${error.message}`);
    throw new Error(`Base weight computation error: ${error.message}`);
  }
}

async function adjustWeightsWithLLM(baseWeights, ccf) {
  console.log(`🤖 Adjusting weights with LLM analysis...`);

  try {
    if (!baseWeights || typeof baseWeights !== "object") {
      throw new Error("Invalid baseWeights object");
    }

    const ccfContext = formatCCFForLLM(ccf);

    const systemPrompt = `You are a BTP (construction) project complexity expert.
Analyze the project context and suggest weight adjustments for audit scoring.
Current weights: Regulatory=${(baseWeights.REGULATORY * 100).toFixed(1)}%, Risk=${(baseWeights.RISK * 100).toFixed(1)}%, Contract=${(baseWeights.CONTRACT * 100).toFixed(1)}%, Optimization=${(baseWeights.OPTIMIZATION * 100).toFixed(1)}%.

Respond with ONLY a JSON object with keys: regulatory_adj, risk_adj, contract_adj, optimization_adj.
Each value must be a number between -${(LLM_ADJUSTMENT_LIMIT * 100).toFixed(0)}% and +${(LLM_ADJUSTMENT_LIMIT * 100).toFixed(0)}%.
Example: {"regulatory_adj": 0.03, "risk_adj": -0.02, "contract_adj": 0.01, "optimization_adj": -0.02}`;

    const userPrompt = `Analyze this BTP project context and suggest weight adjustments:
${ccfContext}

Return ONLY the JSON adjustment object. No explanation.`;

    console.log(`  📤 Calling LLM for weight analysis...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const adjustmentText = response.choices[0].message.content;
    console.log(`  ✅ LLM response received`);

    let adjustments;
    try {
      adjustments = JSON.parse(adjustmentText);
    } catch (parseError) {
      console.error(`⚠️ LLM response not JSON, using defaults: ${adjustmentText}`);
      adjustments = { regulatory_adj: 0, risk_adj: 0, contract_adj: 0, optimization_adj: 0 };
    }

    const constrainedAdjustments = constrainAdjustments(adjustments);

    const adjustedWeights = {
      REGULATORY: baseWeights.REGULATORY + constrainedAdjustments.regulatory_adj,
      RISK: baseWeights.RISK + constrainedAdjustments.risk_adj,
      CONTRACT: baseWeights.CONTRACT + constrainedAdjustments.contract_adj,
      OPTIMIZATION: baseWeights.OPTIMIZATION + constrainedAdjustments.optimization_adj,
    };

    const finalWeights = normalizeWeights(adjustedWeights);

    console.log(`  ✅ Weights adjusted by LLM`);
    console.log(`     Regulatory: ${(baseWeights.REGULATORY * 100).toFixed(1)}% → ${(finalWeights.REGULATORY * 100).toFixed(1)}%`);
    console.log(`     Risk: ${(baseWeights.RISK * 100).toFixed(1)}% → ${(finalWeights.RISK * 100).toFixed(1)}%`);
    console.log(`     Contract: ${(baseWeights.CONTRACT * 100).toFixed(1)}% → ${(finalWeights.CONTRACT * 100).toFixed(1)}%`);
    console.log(`     Optimization: ${(baseWeights.OPTIMIZATION * 100).toFixed(1)}% → ${(finalWeights.OPTIMIZATION * 100).toFixed(1)}%`);

    return {
      weights: finalWeights,
      llm_adjustments: constrainedAdjustments,
      llm_adjusted_at: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`⚠️ LLM adjustment failed: ${error.message}`);
    console.log(`  📌 Returning base weights (no LLM adjustment applied)`);
    return {
      weights: baseWeights,
      llm_adjustments: null,
      llm_adjustment_failed: true,
      error: error.message,
    };
  }
}

function validateWeights(weights) {
  console.log(`🔍 Validating weights...`);

  if (!weights || typeof weights !== "object") {
    throw new Error("Invalid weights object");
  }

  const requiredKeys = ["REGULATORY", "RISK", "CONTRACT", "OPTIMIZATION"];
  for (const key of requiredKeys) {
    if (!(key in weights)) {
      throw new Error(`Missing weight key: ${key}`);
    }

    const value = weights[key];
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error(`Invalid weight value for ${key}: ${value}`);
    }

    if (value < 0) {
      throw new Error(`Negative weight not allowed for ${key}: ${value}`);
    }

    if (value < WEIGHT_CONSTRAINTS.MIN) {
      throw new Error(`Weight ${key} below minimum (${WEIGHT_CONSTRAINTS.MIN}): ${value}`);
    }

    if (value > WEIGHT_CONSTRAINTS.MAX) {
      throw new Error(`Weight ${key} exceeds maximum (${WEIGHT_CONSTRAINTS.MAX}): ${value}`);
    }
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const sumError = Math.abs(sum - 1.0);

  if (sumError > WEIGHT_CONSTRAINTS.SUM_TOLERANCE) {
    throw new Error(
      `Weights sum to ${sum.toFixed(4)}, expected 1.0 (tolerance: ±${WEIGHT_CONSTRAINTS.SUM_TOLERANCE})`
    );
  }

  console.log(`  ✅ Weights validated`);
  console.log(`     Sum: ${sum.toFixed(6)} (within tolerance)`);
  console.log(`     All constraints respected`);

  return true;
}

async function saveProjectComplexityProfile(projectId, ccf, baseWeights, llmResult) {
  console.log(`💾 Saving complexity profile to Supabase...`);

  try {
    validateWeights(llmResult?.weights || baseWeights);

    const finalWeights = llmResult?.weights || baseWeights;
    const complexityIndex = baseWeights.complexity_index || 0;

    const profile = {
      project_id: projectId,
      ccf_snapshot: JSON.stringify(ccf),
      complexity_index: complexityIndex,
      regulatory_weight: finalWeights.REGULATORY,
      risk_weight: finalWeights.RISK,
      contract_weight: finalWeights.CONTRACT,
      optimization_weight: finalWeights.OPTIMIZATION,
      base_weights: JSON.stringify(baseWeights.weights),
      llm_adjustments: llmResult?.llm_adjustments
        ? JSON.stringify(llmResult.llm_adjustments)
        : null,
      llm_adjustment_failed: llmResult?.llm_adjustment_failed || false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("project_complexity_profiles").insert(profile);

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    console.log(`  ✅ Profile saved (project_id: ${projectId})`);
    return { data, success: true };
  } catch (error) {
    console.error(`❌ Profile save failed: ${error.message}`);
    throw new Error(`Profile save error: ${error.message}`);
  }
}

async function generateComplexityProfile(projectId, ccf) {
  console.log(`🎯 Generating project complexity profile (${projectId})...`);

  try {
    console.log(`\n📋 Input CCF:`);
    console.log(`   Type: ${ccf.type_travaux}`);
    console.log(`   Surface: ${ccf.surface}m²`);
    console.log(`   Complexity: ${ccf.complexite_estimee}`);

    const baseResult = await computeBaseWeights(ccf);
    console.log(`\n📊 Base weights computed`);

    const llmResult = await adjustWeightsWithLLM(baseResult.weights, ccf);
    console.log(`\n🤖 LLM adjustment applied`);

    const finalWeights = llmResult.weights || baseResult.weights;
    validateWeights(finalWeights);
    console.log(`\n✅ Final weights validated`);

    const explanation = generateExplanation(ccf, baseResult, llmResult, finalWeights);

    const profileData = await saveProjectComplexityProfile(projectId, ccf, baseResult, llmResult);
    console.log(`\n💾 Profile persisted in Supabase`);

    const result = {
      project_id: projectId,
      weights: finalWeights,
      complexity_index: baseResult.complexity_index,
      explanation,
      base_weights: baseResult.weights,
      llm_adjustments: llmResult.llm_adjustments,
      llm_applied: !!llmResult.weights && !llmResult.llm_adjustment_failed,
      generated_at: new Date().toISOString(),
    };

    console.log(`\n🎉 Complexity profile generated successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Profile generation failed: ${error.message}`);
    throw new Error(`Complexity profile generation error: ${error.message}`);
  }
}

function computeComplexityIndex(ccf) {
  let index = 0.2;

  if (ccf.type_travaux === "neuf") index += 0.25;
  else if (ccf.type_travaux === "renovation") index += 0.15;
  else if (ccf.type_travaux === "extension") index += 0.10;

  if (ccf.surface > 2000) index += 0.15;
  else if (ccf.surface > 1000) index += 0.10;
  else if (ccf.surface > 500) index += 0.05;

  if (ccf.modification_structurelle) index += 0.20;
  if (ccf.zone_abf) index += 0.10;
  if (ccf.erp) index += 0.15;
  if (ccf.permis_requis) index += 0.10;
  if (ccf.lot_technique_sensible) index += 0.12;

  return Math.min(index, 1.0);
}

function normalizeWeights(weights) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (sum === 0) {
    return {
      REGULATORY: 0.35,
      RISK: 0.25,
      CONTRACT: 0.20,
      OPTIMIZATION: 0.20,
    };
  }

  const normalized = {};
  for (const [key, value] of Object.entries(weights)) {
    let normalizedValue = value / sum;

    if (normalizedValue < WEIGHT_CONSTRAINTS.MIN) {
      normalizedValue = WEIGHT_CONSTRAINTS.MIN;
    } else if (normalizedValue > WEIGHT_CONSTRAINTS.MAX) {
      normalizedValue = WEIGHT_CONSTRAINTS.MAX;
    }

    normalized[key] = normalizedValue;
  }

  const normalizedSum = Object.values(normalized).reduce((a, b) => a + b, 0);
  const adjustmentFactor = 1.0 / normalizedSum;

  const finalWeights = {};
  for (const [key, value] of Object.entries(normalized)) {
    finalWeights[key] = value * adjustmentFactor;
  }

  return finalWeights;
}

function constrainAdjustments(adjustments) {
  return {
    regulatory_adj: Math.max(
      -LLM_ADJUSTMENT_LIMIT,
      Math.min(LLM_ADJUSTMENT_LIMIT, adjustments.regulatory_adj || 0)
    ),
    risk_adj: Math.max(
      -LLM_ADJUSTMENT_LIMIT,
      Math.min(LLM_ADJUSTMENT_LIMIT, adjustments.risk_adj || 0)
    ),
    contract_adj: Math.max(
      -LLM_ADJUSTMENT_LIMIT,
      Math.min(LLM_ADJUSTMENT_LIMIT, adjustments.contract_adj || 0)
    ),
    optimization_adj: Math.max(
      -LLM_ADJUSTMENT_LIMIT,
      Math.min(LLM_ADJUSTMENT_LIMIT, adjustments.optimization_adj || 0)
    ),
  };
}

function validateCCF(ccf) {
  if (!ccf || typeof ccf !== "object") {
    throw new Error("Invalid CCF object");
  }

  const requiredFields = ["type_travaux", "surface", "localisation"];
  for (const field of requiredFields) {
    if (!(field in ccf)) {
      throw new Error(`Missing required CCF field: ${field}`);
    }
  }

  if (typeof ccf.surface !== "number" || ccf.surface <= 0) {
    throw new Error(`Invalid surface: ${ccf.surface}`);
  }
}

function formatCCFForLLM(ccf) {
  return `
- Type: ${ccf.type_travaux}
- Surface: ${ccf.surface}m²
- Structural modification: ${ccf.modification_structurelle ? "Yes" : "No"}
- ABF zone: ${ccf.zone_abf ? "Yes" : "No"}
- ERP building: ${ccf.erp ? "Yes" : "No"}
- Permits required: ${ccf.permis_requis ? "Yes" : "No"}
- Sensitive technical lots: ${ccf.lot_technique_sensible ? "Yes" : "No"}
- Location: ${ccf.localisation}
- Estimated complexity: ${ccf.complexite_estimee || "Not specified"}`;
}

function generateExplanation(ccf, baseResult, llmResult, finalWeights) {
  const factors = [];

  if (ccf.modification_structurelle) {
    factors.push("Structural modification increases regulatory & risk assessment");
  }
  if (ccf.zone_abf) {
    factors.push("ABF zone requires enhanced regulatory compliance review");
  }
  if (ccf.erp) {
    factors.push("ERP building significantly increases regulatory & risk weights");
  }
  if (ccf.permis_requis) {
    factors.push("Permit requirements add contractual complexity");
  }
  if (ccf.lot_technique_sensible) {
    factors.push("Sensitive technical lots elevate risk assessment");
  }

  const llmNote = llmResult.llm_adjustment_failed
    ? "LLM adjustment unavailable - base weights applied"
    : llmResult.weights
      ? "LLM analysis applied contextual adjustments"
      : "Base weights used";

  return {
    complexity_factors: factors,
    complexity_index: baseResult.complexity_index,
    llm_status: llmNote,
    final_distribution: {
      regulatory: `${(finalWeights.REGULATORY * 100).toFixed(1)}%`,
      risk: `${(finalWeights.RISK * 100).toFixed(1)}%`,
      contract: `${(finalWeights.CONTRACT * 100).toFixed(1)}%`,
      optimization: `${(finalWeights.OPTIMIZATION * 100).toFixed(1)}%`,
    },
  };
}

export {
  computeBaseWeights,
  adjustWeightsWithLLM,
  validateWeights,
  saveProjectComplexityProfile,
  generateComplexityProfile,
};
