import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvaluationData {
  id: string;
  employee_id: string;
  period_year: number;
  status: string;
  employee_info_json: {
    name: string;
    title: string;
    department: string;
    periodYear: number;
    supervisorName?: string;
  };
  quantitative_json: {
    performanceObjectives: string;
    workAccomplishments: string;
    personalDevelopment: string;
    quantitativeRating: string | null;
  };
  qualitative_json: Record<string, number | null>;
  summary_json: {
    employeeSummary: string;
    targetsForNextYear: string;
    qualitativeRating: string | null;
    overallRating: string | null;
  };
}

const RATING_LABELS: Record<string, string> = {
  exceptional: "Exceptional (5)",
  excellent: "Excellent (4)",
  fully_satisfactory: "Fully Satisfactory (3)",
  marginal: "Marginal (2)",
  unacceptable: "Unacceptable (1)",
  cannot_evaluate: "Cannot Evaluate",
};

const QUALITATIVE_LABELS: Record<string, string> = {
  forecastingPlanningSkills: "Forecasting & Planning Skills",
  administrationSkills: "Administration Skills",
  leadership: "Leadership",
  safety: "Safety",
  developingEmployees: "Developing Employees",
  communicationSkills: "Communication Skills",
  developingCooperationTeamwork: "Developing Cooperation & Teamwork",
  customerSatisfaction: "Customer Satisfaction",
  peerRelationships: "Peer Relationships",
  subordinateRelationships: "Subordinate Relationships",
  jobKnowledgeKnowHow: "Job Knowledge/Know How",
  qualityImage: "Quality Image",
  attitude: "Attitude",
  decisionMaking: "Decision Making",
  creativityInitiative: "Creativity/Initiative",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { evaluationId } = await req.json();

    if (!evaluationId) {
      throw new Error("evaluationId is required");
    }

    console.log(`Generating PDF for evaluation: ${evaluationId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch evaluation data
    const { data: evaluation, error: fetchError } = await supabase
      .from("pep_evaluations")
      .select("*")
      .eq("id", evaluationId)
      .single();

    if (fetchError || !evaluation) {
      console.error("Error fetching evaluation:", fetchError);
      throw new Error(`Evaluation not found: ${evaluationId}`);
    }

    const evalData = evaluation as EvaluationData;

    // Generate HTML for PDF
    const html = generatePdfHtml(evalData);

    // For now, we'll store the HTML as a simple text file
    // In production, you'd use a PDF generation service
    const pdfContent = html;
    const fileName = `pep_${evalData.employee_info_json.name.replace(/\s+/g, "_")}_${evalData.period_year}.html`;

    // Upload to storage (create bucket if needed)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pep-evaluations")
      .upload(fileName, new Blob([pdfContent], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      // Don't throw, just log - the evaluation is still valid
    }

    // Get public URL
    let pdfUrl = "";
    if (uploadData) {
      const { data: urlData } = supabase.storage
        .from("pep-evaluations")
        .getPublicUrl(fileName);
      pdfUrl = urlData.publicUrl;
    }

    // Update evaluation with PDF URL
    const { error: updateError } = await supabase
      .from("pep_evaluations")
      .update({
        pdf_url: pdfUrl,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", evaluationId);

    if (updateError) {
      console.error("Error updating evaluation with PDF URL:", updateError);
    }

    console.log(`PDF generated successfully: ${pdfUrl}`);

    return new Response(
      JSON.stringify({ success: true, pdfUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-pep-pdf:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generatePdfHtml(data: EvaluationData): string {
  const { employee_info_json, quantitative_json, qualitative_json, summary_json, period_year } = data;

  const qualitativeRows = Object.entries(qualitative_json)
    .map(([key, value]) => {
      const label = QUALITATIVE_LABELS[key] || key;
      const rating = value !== null ? value.toString() : "N/A";
      return `<tr><td>${label}</td><td style="text-align: center;">${rating}</td></tr>`;
    })
    .join("");

  // Bunting brand colors
  const buntingRed = "#E31B23";
  const buntingBurgundy = "#8B1F41";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Performance Self-Evaluation - ${employee_info_json.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #333;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 3px solid ${buntingRed};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header-logo {
      width: 80px;
      height: auto;
    }
    .header-text {
      flex: 1;
    }
    .company-name {
      font-size: 28px;
      font-weight: bold;
      color: ${buntingRed};
      letter-spacing: 1px;
      margin: 0;
    }
    .subtitle {
      font-size: 18px;
      color: #666;
      margin-top: 5px;
    }
    h1 {
      font-size: 24px;
      color: ${buntingRed};
      margin-top: 0;
    }
    h2 {
      font-size: 18px;
      color: ${buntingRed};
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
      margin-top: 30px;
    }
    h3 {
      color: ${buntingBurgundy};
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 20px 0;
    }
    .info-item {
      padding: 8px;
      background: #f5f5f5;
    }
    .info-item strong {
      color: #666;
    }
    .section {
      margin-bottom: 30px;
    }
    .text-content {
      background: #fafafa;
      padding: 15px;
      border-left: 3px solid ${buntingRed};
      margin: 10px 0;
      white-space: pre-wrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: ${buntingRed};
      color: white;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .rating-badge {
      display: inline-block;
      padding: 5px 15px;
      background: ${buntingRed};
      color: white;
      border-radius: 4px;
      font-weight: bold;
    }
    .signature-section {
      margin-top: 50px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    .signature-line {
      border-top: 1px solid #333;
      padding-top: 5px;
      margin-top: 40px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid ${buntingRed};
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="https://self.buntinggpt.com/bunting-logo.png" alt="Bunting Magnetics" class="header-logo" onerror="this.style.display='none'"/>
    <div class="header-text">
      <p class="company-name">BUNTING MAGNETICS</p>
      <div class="subtitle">Performance Self-Evaluation</div>
    </div>
  </div>

  <div class="section">
    <h2>Employee Information</h2>
    <div class="info-grid">
      <div class="info-item"><strong>Employee Name:</strong> ${employee_info_json.name}</div>
      <div class="info-item"><strong>Job Title:</strong> ${employee_info_json.title}</div>
      <div class="info-item"><strong>Department:</strong> ${employee_info_json.department}</div>
      <div class="info-item"><strong>Supervisor:</strong> ${employee_info_json.supervisorName || "N/A"}</div>
      <div class="info-item"><strong>Evaluation Period:</strong> January 1 - December 31, ${period_year}</div>
      <div class="info-item"><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="section">
    <h2>Section I: Quantitative Performance</h2>
    
    <h3>Performance Objectives & Results</h3>
    <div class="text-content">${quantitative_json.performanceObjectives || "Not provided"}</div>
    
    <h3>Major Work Accomplishments</h3>
    <div class="text-content">${quantitative_json.workAccomplishments || "Not provided"}</div>
    
    <h3>Personal Development Activities</h3>
    <div class="text-content">${quantitative_json.personalDevelopment || "Not provided"}</div>
    
    <p><strong>Quantitative Rating:</strong> 
      <span class="rating-badge">${RATING_LABELS[quantitative_json.quantitativeRating || ""] || "Not rated"}</span>
    </p>
  </div>

  <div class="section">
    <h2>Section II: Qualitative Factors</h2>
    <table>
      <thead>
        <tr>
          <th>Factor</th>
          <th style="width: 100px;">Rating (1-5)</th>
        </tr>
      </thead>
      <tbody>
        ${qualitativeRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Section III: Summary</h2>
    
    <h3>Employee Self-Assessment Summary</h3>
    <div class="text-content">${summary_json.employeeSummary || "Not provided"}</div>
    
    <h3>Targets for Next Year</h3>
    <div class="text-content">${summary_json.targetsForNextYear || "Not provided"}</div>
    
    <p><strong>Qualitative Rating:</strong> 
      <span class="rating-badge">${RATING_LABELS[summary_json.qualitativeRating || ""] || "Not rated"}</span>
    </p>
    <p><strong>Overall Rating:</strong> 
      <span class="rating-badge">${RATING_LABELS[summary_json.overallRating || ""] || "Not rated"}</span>
    </p>
  </div>

  <div class="signature-section">
    <div>
      <div class="signature-line">Employee Signature</div>
      <p>Date: _______________</p>
    </div>
    <div>
      <div class="signature-line">Supervisor Signature</div>
      <p>Date: _______________</p>
    </div>
  </div>

  <div class="footer">
    <p><strong>Bunting Magnetics</strong> – Performance Evaluation Process (PEP) | Confidential HR Document</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
  `;
}
