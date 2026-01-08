import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { EvaluationData } from '@/types/evaluation';

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

type PdfContext = {
  doc: PDFDocument;
  page: ReturnType<PDFDocument['addPage']>;
  font: any;
  fontBold: any;
  cursorY: number;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 50;
const MARGIN_Y = 50;
const LINE_GAP = 4;

function clampText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function makeFilename(data: EvaluationData): string {
  const name = clampText(data.employeeInfo?.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
  const year = clampText(data.employeeInfo?.periodYear || new Date().getFullYear());
  return `PEP_${name}_${year}.pdf`;
}

function newPage(ctx: Omit<PdfContext, 'page' | 'cursorY'>): PdfContext {
  const page = ctx.doc.addPage([A4.width, A4.height]);
  return {
    ...ctx,
    page,
    cursorY: A4.height - MARGIN_Y,
  };
}

function ensureSpace(ctx: PdfContext, neededHeight: number): PdfContext {
  if (ctx.cursorY - neededHeight >= MARGIN_Y) return ctx;
  return newPage({ doc: ctx.doc, font: ctx.font, fontBold: ctx.fontBold } as any);
}

function wrapLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const normalized = (text || '').replace(/\r\n/g, '\n');
  const paragraphs = normalized.split('\n');

  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const w = font.widthOfTextAtSize(candidate, fontSize);
      if (w <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // If single word is too long, hard-break it.
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            const cand = chunk + ch;
            if (font.widthOfTextAtSize(cand, fontSize) <= maxWidth) {
              chunk = cand;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          if (chunk) lines.push(chunk);
          current = '';
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function drawText(ctx: PdfContext, text: string, opts: { fontSize: number; bold?: boolean; color?: { r: number; g: number; b: number } } ) {
  const { fontSize, bold, color } = opts;
  const font = bold ? ctx.fontBold : ctx.font;
  const maxWidth = A4.width - MARGIN_X * 2;
  const lines = wrapLines(text, font, fontSize, maxWidth);

  const lineHeight = fontSize + LINE_GAP;
  const needed = lines.length * lineHeight;
  ctx = ensureSpace(ctx, needed);

  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_X,
      y: ctx.cursorY - fontSize,
      size: fontSize,
      font,
      color: color ? rgb(color.r, color.g, color.b) : rgb(0.15, 0.15, 0.15),
    });
    ctx.cursorY -= lineHeight;
  }

  return ctx;
}

function drawDivider(ctx: PdfContext) {
  ctx = ensureSpace(ctx, 18);
  const y = ctx.cursorY - 8;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: A4.width - MARGIN_X, y },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.85),
  });
  ctx.cursorY -= 18;
  return ctx;
}

function drawKeyValue(ctx: PdfContext, key: string, value: string) {
  const fontSize = 11;
  const keyText = `${key}: `;
  const keyWidth = ctx.fontBold.widthOfTextAtSize(keyText, fontSize);
  const maxWidth = A4.width - MARGIN_X * 2;
  const valueMaxWidth = Math.max(50, maxWidth - keyWidth);

  const valueLines = wrapLines(value, ctx.font, fontSize, valueMaxWidth);
  const lineHeight = fontSize + LINE_GAP;
  const needed = valueLines.length * lineHeight;
  ctx = ensureSpace(ctx, needed);

  // first line with key
  ctx.page.drawText(keyText, {
    x: MARGIN_X,
    y: ctx.cursorY - fontSize,
    size: fontSize,
    font: ctx.fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });

  ctx.page.drawText(valueLines[0] || '', {
    x: MARGIN_X + keyWidth,
    y: ctx.cursorY - fontSize,
    size: fontSize,
    font: ctx.font,
    color: rgb(0.15, 0.15, 0.15),
  });

  ctx.cursorY -= lineHeight;

  for (let i = 1; i < valueLines.length; i++) {
    ctx.page.drawText(valueLines[i], {
      x: MARGIN_X + keyWidth,
      y: ctx.cursorY - fontSize,
      size: fontSize,
      font: ctx.font,
      color: rgb(0.15, 0.15, 0.15),
    });
    ctx.cursorY -= lineHeight;
  }

  return ctx;
}

async function buildPdfBytes(data: EvaluationData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let ctx: PdfContext = newPage({ doc, font, fontBold } as any);

  // Title
  ctx = drawText(ctx, 'BUNTING MAGNETICS', { fontSize: 18, bold: true, color: { r: 0.12, g: 0.23, b: 0.37 } });
  ctx = drawText(ctx, 'Performance Self-Assessment', { fontSize: 14, bold: true });
  ctx = drawText(ctx, `Assessment Period: ${clampText(data.employeeInfo?.periodYear)}`, { fontSize: 11, color: { r: 0.35, g: 0.35, b: 0.35 } });
  ctx = drawDivider(ctx);

  // Employee info
  ctx = drawText(ctx, 'Employee Information', { fontSize: 13, bold: true, color: { r: 0.12, g: 0.23, b: 0.37 } });
  ctx = drawKeyValue(ctx, 'Name', clampText(data.employeeInfo?.name) || '');
  ctx = drawKeyValue(ctx, 'Title', clampText(data.employeeInfo?.title) || '');
  ctx = drawKeyValue(ctx, 'Department', clampText(data.employeeInfo?.department) || '');
  ctx = drawKeyValue(ctx, 'Supervisor', clampText(data.employeeInfo?.supervisorName) || 'N/A');
  ctx = drawDivider(ctx);

  // Quantitative
  ctx = drawText(ctx, 'Section I: Quantitative Assessment', { fontSize: 13, bold: true, color: { r: 0.12, g: 0.23, b: 0.37 } });
  ctx = drawText(ctx, 'Performance Objectives', { fontSize: 12, bold: true });
  ctx = drawText(ctx, clampText(data.quantitative?.performanceObjectives) || 'Not provided', { fontSize: 11 });
  ctx = drawText(ctx, 'Work Accomplishments', { fontSize: 12, bold: true });
  ctx = drawText(ctx, clampText(data.quantitative?.workAccomplishments) || 'Not provided', { fontSize: 11 });
  ctx = drawText(ctx, 'Personal Development', { fontSize: 12, bold: true });
  ctx = drawText(ctx, clampText(data.quantitative?.personalDevelopment) || 'Not provided', { fontSize: 11 });
  ctx = drawKeyValue(ctx, 'Quantitative Rating', RATING_LABELS[clampText(data.quantitative?.quantitativeRating)] || 'Not rated');
  ctx = drawDivider(ctx);

  // Qualitative
  ctx = drawText(ctx, 'Section II: Qualitative Assessment', { fontSize: 13, bold: true, color: { r: 0.12, g: 0.23, b: 0.37 } });
  ctx = drawText(ctx, 'Scale: 5 Exceptional, 4 Excellent, 3 Fully Satisfactory, 2 Marginal, 1 Unacceptable', {
    fontSize: 10,
    color: { r: 0.35, g: 0.35, b: 0.35 },
  });

  // Simple two-column list
  const entries = Object.entries(data.qualitative || {});
  for (const [key, val] of entries) {
    const label = QUALITATIVE_LABELS[key] || key;
    const rating = val === null || val === undefined ? '-' : String(val);
    ctx = drawKeyValue(ctx, label, rating);
  }
  ctx = drawDivider(ctx);

  // Summary
  ctx = drawText(ctx, 'Section III: Summary', { fontSize: 13, bold: true, color: { r: 0.12, g: 0.23, b: 0.37 } });
  ctx = drawText(ctx, 'Employee Self-Summary', { fontSize: 12, bold: true });
  ctx = drawText(ctx, clampText(data.summary?.employeeSummary) || 'Not provided', { fontSize: 11 });
  ctx = drawText(ctx, 'Targets for Next Year', { fontSize: 12, bold: true });
  ctx = drawText(ctx, clampText(data.summary?.targetsForNextYear) || 'Not provided', { fontSize: 11 });
  ctx = drawKeyValue(ctx, 'Qualitative Rating', RATING_LABELS[clampText(data.summary?.qualitativeRating)] || 'Not rated');
  ctx = drawKeyValue(ctx, 'Overall Rating', RATING_LABELS[clampText(data.summary?.overallRating)] || 'Not rated');

  // Footer
  ctx = drawDivider(ctx);
  ctx = drawText(ctx, `Generated on ${new Date().toLocaleString('en-US')}`, { fontSize: 9, color: { r: 0.45, g: 0.45, b: 0.45 } });
  ctx = drawText(ctx, 'Bunting Magnetics Co. | Confidential Employee Document', { fontSize: 9, color: { r: 0.45, g: 0.45, b: 0.45 } });

  return await doc.save();
}

export async function generateEvaluationPdf(data: EvaluationData): Promise<string> {
  // Always generate locally first so the user can download even if storage fails.
  const pdfBytes = await buildPdfBytes(data);

  // pdf-lib returns Uint8Array<ArrayBufferLike> which TS won't accept directly as a BlobPart in some configs.
  // Re-wrap into a "safe" Uint8Array backed by a plain ArrayBuffer.
  const safeBytes = new Uint8Array(pdfBytes);
  const pdfBlob = new Blob([safeBytes], { type: 'application/pdf' });
  const localUrl = URL.createObjectURL(pdfBlob);

  // If we don't have an evaluation id yet, we can't upload/update reliably.
  if (!data.id) return localUrl;

  const filename = makeFilename(data);
  const storagePath = `pdfs/${data.id}/${filename}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('pep-evaluations')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('pep-evaluations')
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('pep_evaluations')
      .update({
        pdf_url: pdfUrl,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('Failed to update evaluation with PDF URL:', updateError);
      // Still return the public URL; worst case supervisor may not see it if DB update fails.
    }

    return pdfUrl;
  } catch (err) {
    console.error('PDF upload failed; returning local download URL instead.', err);
    return localUrl;
  }
}
