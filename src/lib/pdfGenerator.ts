import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EvaluationData, QUALITATIVE_FACTORS, RATING_OPTIONS } from '@/types/evaluation';
import { supabase } from '@/integrations/supabase/client';

const RATING_LABELS: Record<string, string> = {
  exceptional: 'Exceptional',
  excellent: 'Excellent',
  fully_satisfactory: 'Fully Satisfactory',
  marginal: 'Marginal',
  unacceptable: 'Unacceptable',
  cannot_evaluate: 'Cannot Evaluate',
};

const QUALITATIVE_LABELS: Record<string, string> = {
  forecastingPlanningSkills: 'Forecasting & Planning Skills',
  administrationSkills: 'Administration Skills',
  leadership: 'Leadership',
  safety: 'Safety',
  developingEmployees: 'Developing Employees',
  communicationSkills: 'Communication Skills',
  developingCooperationTeamwork: 'Developing Cooperation & Teamwork',
  customerSatisfaction: 'Customer Satisfaction',
  peerRelationships: 'Peer Relationships',
  subordinateRelationships: 'Subordinate Relationships',
  jobKnowledgeKnowHow: 'Job Knowledge/Know How',
  qualityImage: 'Quality Image',
  attitude: 'Attitude',
  decisionMaking: 'Decision Making',
  creativityInitiative: 'Creativity/Initiative',
};

function createPdfHtml(data: EvaluationData): string {
  const qualitativeRows = Object.entries(data.qualitative)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${QUALITATIVE_LABELS[key] || key}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${value || '-'}</td>
      </tr>
    `).join('');

  return `
    <div id="pdf-content" style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; background: white; color: #333;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px;">
        <h1 style="color: #1e3a5f; margin: 0 0 10px 0; font-size: 24px;">BUNTING MAGNETICS</h1>
        <h2 style="color: #555; margin: 0; font-size: 18px;">Performance Evaluation Program</h2>
        <p style="color: #777; margin: 10px 0 0 0; font-size: 14px;">Evaluation Period: ${data.employeeInfo.periodYear}</p>
      </div>

      <!-- Employee Information -->
      <div style="margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h3 style="color: #1e3a5f; margin: 0 0 15px 0; font-size: 16px;">Employee Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; width: 30%;"><strong>Name:</strong></td>
            <td style="padding: 8px 0;">${data.employeeInfo.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Title:</strong></td>
            <td style="padding: 8px 0;">${data.employeeInfo.title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Department:</strong></td>
            <td style="padding: 8px 0;">${data.employeeInfo.department}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Supervisor:</strong></td>
            <td style="padding: 8px 0;">${data.employeeInfo.supervisorName || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <!-- Quantitative Section -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e3a5f; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">Section I: Quantitative Assessment</h3>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0; font-size: 14px;">Performance Objectives</h4>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
            ${data.quantitative.performanceObjectives || 'Not provided'}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0; font-size: 14px;">Work Accomplishments</h4>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
            ${data.quantitative.workAccomplishments || 'Not provided'}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0; font-size: 14px;">Personal Development</h4>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
            ${data.quantitative.personalDevelopment || 'Not provided'}
          </div>
        </div>

        <div style="background: #e8f4f8; padding: 15px; border-radius: 4px; text-align: center;">
          <strong>Quantitative Rating:</strong> ${RATING_LABELS[data.quantitative.quantitativeRating || ''] || 'Not rated'}
        </div>
      </div>

      <!-- Qualitative Section -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e3a5f; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">Section II: Qualitative Assessment</h3>
        <p style="color: #666; font-size: 12px; margin-bottom: 15px;">Scale: 5 = Exceptional, 4 = Excellent, 3 = Fully Satisfactory, 2 = Marginal, 1 = Unacceptable</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #1e3a5f; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Factor</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 80px;">Rating</th>
            </tr>
          </thead>
          <tbody>
            ${qualitativeRows}
          </tbody>
        </table>
      </div>

      <!-- Summary Section -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e3a5f; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">Section III: Summary</h3>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0; font-size: 14px;">Employee Self-Summary</h4>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
            ${data.summary.employeeSummary || 'Not provided'}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0; font-size: 14px;">Targets for Next Year</h4>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
            ${data.summary.targetsForNextYear || 'Not provided'}
          </div>
        </div>

        <div style="display: flex; gap: 20px;">
          <div style="flex: 1; background: #e8f4f8; padding: 15px; border-radius: 4px; text-align: center;">
            <strong>Qualitative Rating:</strong><br/>
            ${RATING_LABELS[data.summary.qualitativeRating || ''] || 'Not rated'}
          </div>
          <div style="flex: 1; background: #1e3a5f; color: white; padding: 15px; border-radius: 4px; text-align: center;">
            <strong>Overall Rating:</strong><br/>
            ${RATING_LABELS[data.summary.overallRating || ''] || 'Not rated'}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 11px; text-align: center;">
        <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Bunting Magnetics Co. | Confidential Employee Document</p>
      </div>
    </div>
  `;
}

export async function generateEvaluationPdf(data: EvaluationData): Promise<string> {
  // Create a hidden container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.innerHTML = createPdfHtml(data);
  document.body.appendChild(container);

  try {
    const content = container.querySelector('#pdf-content') as HTMLElement;
    
    // Render to canvas
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Calculate dimensions for A4
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Convert to blob
    const pdfBlob = pdf.output('blob');
    const localUrl = URL.createObjectURL(pdfBlob);

    // Generate filename
    const sanitizedName = data.employeeInfo.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `PEP_${sanitizedName}_${data.employeeInfo.periodYear}.pdf`;
    const storagePath = `pdfs/${data.id}/${filename}`;

    // Upload to Supabase storage (best-effort)
    try {
      const { error: uploadError } = await supabase.storage
        .from('pep-evaluations')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('pep-evaluations')
        .getPublicUrl(storagePath);

      const pdfUrl = urlData.publicUrl;

      // Update evaluation record with PDF URL
      const { error: updateError } = await supabase
        .from('pep_evaluations')
        .update({
          pdf_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('Failed to update evaluation with PDF URL:', updateError);
      }

      return pdfUrl;
    } catch (err) {
      // Still allow the user to download locally even if storage upload fails.
      console.error('PDF upload failed; returning local download URL instead.', err);
      return localUrl;
    }
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
