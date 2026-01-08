import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import type { EvaluationData } from '@/types/evaluation';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 16;
const SECTION_GAP = 24;

// Bunting brand colors (RGB 0-1 scale)
const COLORS = {
  primaryRed: rgb(0.89, 0.106, 0.137),      // #E31B23
  burgundy: rgb(0.545, 0.122, 0.255),       // #8B1F41
  darkGray: rgb(0.176, 0.176, 0.176),       // #2D2D2D
  mediumGray: rgb(0.4, 0.4, 0.4),           // #666666
  lightGray: rgb(0.96, 0.96, 0.96),         // #F5F5F5
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
};

const RATING_LABELS: Record<string, string> = {
  exceptional: 'Exceptional',
  excellent: 'Excellent',
  fully_satisfactory: 'Fully Satisfactory',
  marginal: 'Marginal',
  unacceptable: 'Unacceptable',
  cannot_evaluate: 'Cannot Evaluate',
};

const QUALITATIVE_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Average',
  3: 'Average',
  4: 'Above Average',
  5: 'Excellent',
};

const QUALITATIVE_FACTOR_LABELS: Record<string, string> = {
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

const QUALITATIVE_SECTIONS: Record<string, { key: string; label: string }[]> = {
  'Planning & Organization': [
    { key: 'forecastingPlanningSkills', label: 'Forecasting & Planning Skills' },
    { key: 'administrationSkills', label: 'Administration Skills' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'safety', label: 'Safety' },
    { key: 'developingEmployees', label: 'Developing Employees' },
  ],
  'Interpersonal Skills': [
    { key: 'communicationSkills', label: 'Communication Skills' },
    { key: 'developingCooperationTeamwork', label: 'Developing Cooperation & Teamwork' },
    { key: 'customerSatisfaction', label: 'Customer Satisfaction' },
    { key: 'peerRelationships', label: 'Peer Relationships' },
    { key: 'subordinateRelationships', label: 'Subordinate Relationships' },
  ],
  'Individual Competencies': [
    { key: 'jobKnowledgeKnowHow', label: 'Job Knowledge/Know How' },
    { key: 'qualityImage', label: 'Quality Image' },
    { key: 'attitude', label: 'Attitude' },
    { key: 'decisionMaking', label: 'Decision Making' },
    { key: 'creativityInitiative', label: 'Creativity/Initiative' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PdfContext {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  logo: PDFImage | null;
  pages: PDFPage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function clampText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return '';
}

function makeFilename(data: EvaluationData): string {
  const name = clampText(data.employeeInfo?.name).replace(/\s+/g, '_') || 'Employee';
  const year = data.employeeInfo?.periodYear || new Date().getFullYear();
  return `PEP_${name}_${year}.pdf`;
}

function formatDate(date?: string | null): string {
  if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Management
// ─────────────────────────────────────────────────────────────────────────────

function newPage(ctx: PdfContext): PdfContext {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pages.push(page);
  return { ...ctx, page, y: PAGE_HEIGHT - MARGIN };
}

function ensureSpace(ctx: PdfContext, needed: number): PdfContext {
  if (ctx.y - needed < MARGIN + 40) {
    return newPage(ctx);
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Utilities
// ─────────────────────────────────────────────────────────────────────────────

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

function drawText(
  ctx: PdfContext,
  text: string,
  opts: { fontSize?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number; x?: number } = {}
): PdfContext {
  const fontSize = opts.fontSize ?? 11;
  const font = opts.font ?? ctx.fontRegular;
  const color = opts.color ?? COLORS.darkGray;
  const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
  const x = opts.x ?? MARGIN;

  const lines = wrapLines(clampText(text), font, fontSize, maxWidth);
  let currentCtx = ctx;

  for (const line of lines) {
    currentCtx = ensureSpace(currentCtx, LINE_HEIGHT);
    currentCtx.page.drawText(line, { x, y: currentCtx.y, size: fontSize, font, color });
    currentCtx.y -= LINE_HEIGHT;
  }
  return currentCtx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header & Footer
// ─────────────────────────────────────────────────────────────────────────────

function drawPageHeader(ctx: PdfContext): PdfContext {
  const { page, logo, fontBold } = ctx;
  
  // Draw logo if available
  if (logo) {
    const logoHeight = 30;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - 5,
      width: logoWidth,
      height: logoHeight,
    });
  }

  // Company name
  page.drawText('BUNTING MAGNETICS', {
    x: logo ? MARGIN + 80 : MARGIN,
    y: PAGE_HEIGHT - MARGIN + 5,
    size: 14,
    font: fontBold,
    color: COLORS.primaryRed,
  });

  // Accent line
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 15,
    width: CONTENT_WIDTH,
    height: 2,
    color: COLORS.primaryRed,
  });

  return { ...ctx, y: PAGE_HEIGHT - MARGIN - 35 };
}

function addPageNumbers(ctx: PdfContext): void {
  const totalPages = ctx.pages.length;
  ctx.pages.forEach((page, index) => {
    const text = `Page ${index + 1} of ${totalPages}`;
    const textWidth = ctx.fontRegular.widthOfTextAtSize(text, 9);
    page.drawText(text, {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y: 25,
      size: 9,
      font: ctx.fontRegular,
      color: COLORS.mediumGray,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Styled Elements
// ─────────────────────────────────────────────────────────────────────────────

function drawSectionHeader(ctx: PdfContext, title: string): PdfContext {
  ctx = ensureSpace(ctx, 40);
  ctx.y -= 10;
  
  // Red section bar
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 2,
    width: CONTENT_WIDTH,
    height: 24,
    color: COLORS.primaryRed,
  });
  
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN + 10,
    y: ctx.y + 4,
    size: 12,
    font: ctx.fontBold,
    color: COLORS.white,
  });
  
  ctx.y -= 35;
  return ctx;
}

function drawSubsectionHeader(ctx: PdfContext, title: string): PdfContext {
  ctx = ensureSpace(ctx, 30);
  ctx.y -= 8;
  
  ctx.page.drawText(title, {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: COLORS.burgundy,
  });
  
  // Burgundy underline
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: ctx.fontBold.widthOfTextAtSize(title, 12),
    height: 1.5,
    color: COLORS.burgundy,
  });
  
  ctx.y -= 20;
  return ctx;
}

function drawInfoBox(ctx: PdfContext, items: { label: string; value: string }[]): PdfContext {
  const boxHeight = items.length * 22 + 20;
  ctx = ensureSpace(ctx, boxHeight);
  
  // Box background
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - boxHeight + 10,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: COLORS.lightGray,
    borderColor: COLORS.mediumGray,
    borderWidth: 0.5,
  });
  
  ctx.y -= 5;
  
  for (const item of items) {
    ctx.page.drawText(`${item.label}:`, {
      x: MARGIN + 15,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: COLORS.darkGray,
    });
    ctx.page.drawText(clampText(item.value), {
      x: MARGIN + 140,
      y: ctx.y,
      size: 10,
      font: ctx.fontRegular,
      color: COLORS.darkGray,
    });
    ctx.y -= 22;
  }
  
  ctx.y -= 10;
  return ctx;
}

function drawTextBox(ctx: PdfContext, label: string, content: string): PdfContext {
  ctx = drawSubsectionHeader(ctx, label);
  
  const lines = wrapLines(clampText(content) || 'N/A', ctx.fontRegular, 10, CONTENT_WIDTH - 30);
  const boxHeight = Math.max(lines.length * 14 + 20, 50);
  ctx = ensureSpace(ctx, boxHeight);
  
  // Box background
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - boxHeight + 15,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: COLORS.white,
    borderColor: COLORS.mediumGray,
    borderWidth: 0.5,
  });
  
  ctx.y -= 5;
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN + 15,
      y: ctx.y,
      size: 10,
      font: ctx.fontRegular,
      color: COLORS.darkGray,
    });
    ctx.y -= 14;
  }
  
  ctx.y -= 15;
  return ctx;
}

function drawRatingBadge(ctx: PdfContext, label: string, rating: string | null, x: number, width: number): PdfContext {
  const displayRating = RATING_LABELS[rating ?? ''] || rating || 'Not Rated';
  const badgeHeight = 50;
  
  // Badge background
  ctx.page.drawRectangle({
    x,
    y: ctx.y - badgeHeight + 15,
    width,
    height: badgeHeight,
    color: COLORS.lightGray,
    borderColor: COLORS.primaryRed,
    borderWidth: 1.5,
  });
  
  // Label
  ctx.page.drawText(label, {
    x: x + 10,
    y: ctx.y,
    size: 9,
    font: ctx.fontBold,
    color: COLORS.burgundy,
  });
  
  // Rating value
  const ratingWidth = ctx.fontBold.widthOfTextAtSize(displayRating, 11);
  ctx.page.drawText(displayRating, {
    x: x + (width - ratingWidth) / 2,
    y: ctx.y - 22,
    size: 11,
    font: ctx.fontBold,
    color: COLORS.primaryRed,
  });
  
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qualitative Table
// ─────────────────────────────────────────────────────────────────────────────

function drawQualitativeTable(
  ctx: PdfContext,
  sectionTitle: string,
  factors: { key: string; label: string }[],
  data: Record<string, number | null>
): PdfContext {
  ctx = drawSubsectionHeader(ctx, sectionTitle);
  
  const rowHeight = 20;
  const tableHeight = (factors.length + 1) * rowHeight;
  ctx = ensureSpace(ctx, tableHeight + 20);
  
  // Column widths
  const col1Width = CONTENT_WIDTH * 0.5;
  const col2Width = CONTENT_WIDTH * 0.15;
  const col3Width = CONTENT_WIDTH * 0.35;
  
  // Header row
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - rowHeight + 5,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: COLORS.burgundy,
  });
  
  ctx.page.drawText('Factor', { x: MARGIN + 10, y: ctx.y - 10, size: 9, font: ctx.fontBold, color: COLORS.white });
  ctx.page.drawText('Rating', { x: MARGIN + col1Width + 10, y: ctx.y - 10, size: 9, font: ctx.fontBold, color: COLORS.white });
  ctx.page.drawText('Description', { x: MARGIN + col1Width + col2Width + 10, y: ctx.y - 10, size: 9, font: ctx.fontBold, color: COLORS.white });
  
  ctx.y -= rowHeight;
  
  // Data rows
  factors.forEach((factor, index) => {
    const isEven = index % 2 === 0;
    const rating = (data as Record<string, number | null>)[factor.key] as number | null;
    const ratingLabel = rating ? QUALITATIVE_LABELS[rating] || '' : 'Not Rated';
    
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - rowHeight + 5,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: isEven ? COLORS.lightGray : COLORS.white,
      borderColor: COLORS.mediumGray,
      borderWidth: 0.25,
    });
    
    ctx.page.drawText(factor.label, { x: MARGIN + 10, y: ctx.y - 10, size: 9, font: ctx.fontRegular, color: COLORS.darkGray });
    ctx.page.drawText(rating ? String(rating) : '-', { x: MARGIN + col1Width + 25, y: ctx.y - 10, size: 9, font: ctx.fontBold, color: COLORS.primaryRed });
    ctx.page.drawText(ratingLabel, { x: MARGIN + col1Width + col2Width + 10, y: ctx.y - 10, size: 9, font: ctx.fontRegular, color: COLORS.darkGray });
    
    ctx.y -= rowHeight;
  });
  
  ctx.y -= 15;
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover Page
// ─────────────────────────────────────────────────────────────────────────────

function drawCoverPage(ctx: PdfContext, data: EvaluationData): PdfContext {
  const { page, logo, fontBold, fontRegular } = ctx;
  const year = data.employeeInfo?.periodYear || new Date().getFullYear();
  
  // Logo centered at top
  if (logo) {
    const logoHeight = 80;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, {
      x: (PAGE_WIDTH - logoWidth) / 2,
      y: PAGE_HEIGHT - 150,
      width: logoWidth,
      height: logoHeight,
    });
  }
  
  // Company name
  const companyName = 'BUNTING MAGNETICS';
  const companyWidth = fontBold.widthOfTextAtSize(companyName, 18);
  page.drawText(companyName, {
    x: (PAGE_WIDTH - companyWidth) / 2,
    y: PAGE_HEIGHT - 180,
    size: 18,
    font: fontBold,
    color: COLORS.primaryRed,
  });
  
  // Decorative line
  page.drawRectangle({
    x: PAGE_WIDTH / 2 - 100,
    y: PAGE_HEIGHT - 210,
    width: 200,
    height: 3,
    color: COLORS.primaryRed,
  });
  
  // Document title
  const title1 = 'ANNUAL PERFORMANCE';
  const title2 = 'SELF-ASSESSMENT';
  const title1Width = fontBold.widthOfTextAtSize(title1, 24);
  const title2Width = fontBold.widthOfTextAtSize(title2, 24);
  
  page.drawText(title1, {
    x: (PAGE_WIDTH - title1Width) / 2,
    y: PAGE_HEIGHT - 280,
    size: 24,
    font: fontBold,
    color: COLORS.darkGray,
  });
  page.drawText(title2, {
    x: (PAGE_WIDTH - title2Width) / 2,
    y: PAGE_HEIGHT - 310,
    size: 24,
    font: fontBold,
    color: COLORS.darkGray,
  });
  
  // Year
  const yearStr = String(year);
  const yearWidth = fontBold.widthOfTextAtSize(yearStr, 48);
  page.drawText(yearStr, {
    x: (PAGE_WIDTH - yearWidth) / 2,
    y: PAGE_HEIGHT - 380,
    size: 48,
    font: fontBold,
    color: COLORS.primaryRed,
  });
  
  // Employee info box
  const infoBoxY = PAGE_HEIGHT - 480;
  const infoBoxHeight = 120;
  page.drawRectangle({
    x: MARGIN + 50,
    y: infoBoxY - infoBoxHeight,
    width: CONTENT_WIDTH - 100,
    height: infoBoxHeight,
    color: COLORS.lightGray,
    borderColor: COLORS.primaryRed,
    borderWidth: 1,
  });
  
  const employeeName = clampText(data.employeeInfo?.name) || 'Employee Name';
  const employeeTitle = clampText(data.employeeInfo?.title) || 'Job Title';
  const department = clampText(data.employeeInfo?.department) || 'Department';
  const supervisor = clampText(data.employeeInfo?.supervisorName) || 'Supervisor';
  
  const nameWidth = fontBold.widthOfTextAtSize(employeeName, 16);
  page.drawText(employeeName, {
    x: (PAGE_WIDTH - nameWidth) / 2,
    y: infoBoxY - 30,
    size: 16,
    font: fontBold,
    color: COLORS.darkGray,
  });
  
  const titleWidth = fontRegular.widthOfTextAtSize(employeeTitle, 12);
  page.drawText(employeeTitle, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: infoBoxY - 50,
    size: 12,
    font: fontRegular,
    color: COLORS.mediumGray,
  });
  
  const deptWidth = fontRegular.widthOfTextAtSize(department, 12);
  page.drawText(department, {
    x: (PAGE_WIDTH - deptWidth) / 2,
    y: infoBoxY - 70,
    size: 12,
    font: fontRegular,
    color: COLORS.mediumGray,
  });
  
  const supervisorLabel = `Supervisor: ${supervisor}`;
  const supervisorWidth = fontRegular.widthOfTextAtSize(supervisorLabel, 11);
  page.drawText(supervisorLabel, {
    x: (PAGE_WIDTH - supervisorWidth) / 2,
    y: infoBoxY - 95,
    size: 11,
    font: fontRegular,
    color: COLORS.burgundy,
  });
  
  // Generation date
  const dateStr = `Generated: ${formatDate()}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 10);
  page.drawText(dateStr, {
    x: (PAGE_WIDTH - dateWidth) / 2,
    y: 80,
    size: 10,
    font: fontRegular,
    color: COLORS.mediumGray,
  });
  
  // Confidential watermark
  const confText = 'CONFIDENTIAL';
  const confWidth = fontBold.widthOfTextAtSize(confText, 12);
  page.drawText(confText, {
    x: (PAGE_WIDTH - confWidth) / 2,
    y: 50,
    size: 12,
    font: fontBold,
    color: COLORS.burgundy,
  });
  
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Page
// ─────────────────────────────────────────────────────────────────────────────

function drawSignaturePage(ctx: PdfContext, data: EvaluationData): PdfContext {
  ctx = newPage(ctx);
  ctx = drawPageHeader(ctx);
  
  ctx = drawSectionHeader(ctx, 'Signatures & Acknowledgment');
  
  // Acknowledgment text
  ctx.y -= 10;
  const ackText = 'By signing below, I acknowledge that I have reviewed this performance self-assessment. My signature does not necessarily indicate agreement with all aspects of the evaluation, but confirms that I have read and discussed it with my supervisor.';
  const ackLines = wrapLines(ackText, ctx.fontRegular, 10, CONTENT_WIDTH - 20);
  
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - (ackLines.length * 14) - 15,
    width: CONTENT_WIDTH,
    height: ackLines.length * 14 + 20,
    color: COLORS.lightGray,
    borderColor: COLORS.burgundy,
    borderWidth: 0.5,
  });
  
  for (const line of ackLines) {
    ctx.page.drawText(line, {
      x: MARGIN + 10,
      y: ctx.y - 5,
      size: 10,
      font: ctx.fontRegular,
      color: COLORS.darkGray,
    });
    ctx.y -= 14;
  }
  ctx.y -= 30;
  
  // Signature sections
  const signatureWidth = CONTENT_WIDTH;
  const drawSignatureBlock = (label: string, name: string) => {
    ctx.y -= 20;
    
    // Label
    ctx.page.drawText(label, {
      x: MARGIN,
      y: ctx.y,
      size: 12,
      font: ctx.fontBold,
      color: COLORS.burgundy,
    });
    ctx.y -= 45;
    
    // Signature line
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y + 2,
      width: signatureWidth * 0.6,
      height: 1,
      color: COLORS.darkGray,
    });
    ctx.page.drawText('Signature', {
      x: MARGIN,
      y: ctx.y - 12,
      size: 9,
      font: ctx.fontRegular,
      color: COLORS.mediumGray,
    });
    
    ctx.y -= 35;
    
    // Name line
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y + 2,
      width: signatureWidth * 0.4,
      height: 1,
      color: COLORS.darkGray,
    });
    ctx.page.drawText(name || 'Printed Name', {
      x: MARGIN,
      y: ctx.y + 8,
      size: 10,
      font: ctx.fontRegular,
      color: COLORS.darkGray,
    });
    ctx.page.drawText('Printed Name', {
      x: MARGIN,
      y: ctx.y - 12,
      size: 9,
      font: ctx.fontRegular,
      color: COLORS.mediumGray,
    });
    
    // Date line
    ctx.page.drawRectangle({
      x: MARGIN + signatureWidth * 0.5,
      y: ctx.y + 2,
      width: signatureWidth * 0.3,
      height: 1,
      color: COLORS.darkGray,
    });
    ctx.page.drawText('Date', {
      x: MARGIN + signatureWidth * 0.5,
      y: ctx.y - 12,
      size: 9,
      font: ctx.fontRegular,
      color: COLORS.mediumGray,
    });
    
    ctx.y -= 25;
  };
  
  drawSignatureBlock('EMPLOYEE', clampText(data.employeeInfo?.name));
  drawSignatureBlock('SUPERVISOR', clampText(data.employeeInfo?.supervisorName));
  drawSignatureBlock('DEPARTMENT MANAGER (Optional)', '');
  
  // Footer timestamp
  const timestamp = `Document generated on ${formatDate()} at ${new Date().toLocaleTimeString()}`;
  const timestampWidth = ctx.fontRegular.widthOfTextAtSize(timestamp, 8);
  ctx.page.drawText(timestamp, {
    x: (PAGE_WIDTH - timestampWidth) / 2,
    y: 40,
    size: 8,
    font: ctx.fontRegular,
    color: COLORS.mediumGray,
  });
  
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating Scale Legend
// ─────────────────────────────────────────────────────────────────────────────

function drawRatingLegend(ctx: PdfContext): PdfContext {
  ctx = ensureSpace(ctx, 60);
  
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 45,
    width: CONTENT_WIDTH,
    height: 50,
    color: COLORS.lightGray,
    borderColor: COLORS.mediumGray,
    borderWidth: 0.5,
  });
  
  ctx.page.drawText('RATING SCALE:', {
    x: MARGIN + 10,
    y: ctx.y - 15,
    size: 9,
    font: ctx.fontBold,
    color: COLORS.burgundy,
  });
  
  const scale = [
    '1 = Needs Improvement',
    '2 = Below Average',
    '3 = Average',
    '4 = Above Average',
    '5 = Excellent',
  ];
  
  const startX = MARGIN + 100;
  const spacing = (CONTENT_WIDTH - 110) / 5;
  
  scale.forEach((item, index) => {
    ctx.page.drawText(item, {
      x: startX + index * spacing,
      y: ctx.y - 30,
      size: 8,
      font: ctx.fontRegular,
      color: COLORS.darkGray,
    });
  });
  
  ctx.y -= 60;
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PDF Builder
// ─────────────────────────────────────────────────────────────────────────────

async function buildPdfBytes(data: EvaluationData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  
  // Try to embed logo
  let logo: PDFImage | null = null;
  try {
    const logoResponse = await fetch('/bunting-logo.png');
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      logo = await doc.embedPng(new Uint8Array(logoBytes));
    }
  } catch {
    console.warn('Could not embed logo');
  }
  
  let ctx: PdfContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    fontRegular,
    fontBold,
    logo,
    pages: [],
  };
  ctx.pages.push(ctx.page);
  
  // ─── PAGE 1: COVER ───
  ctx = drawCoverPage(ctx, data);
  
  // ─── PAGE 2: EMPLOYEE INFO & QUANTITATIVE ───
  ctx = newPage(ctx);
  ctx = drawPageHeader(ctx);
  
  ctx = drawSectionHeader(ctx, 'Section I: Employee Information');
  ctx = drawInfoBox(ctx, [
    { label: 'Employee Name', value: data.employeeInfo?.name || 'N/A' },
    { label: 'Job Title', value: data.employeeInfo?.title || 'N/A' },
    { label: 'Department', value: data.employeeInfo?.department || 'N/A' },
    { label: 'Supervisor', value: data.employeeInfo?.supervisorName || 'N/A' },
    { label: 'Assessment Period', value: String(data.employeeInfo?.periodYear || new Date().getFullYear()) },
  ]);
  
  ctx.y -= SECTION_GAP;
  ctx = drawSectionHeader(ctx, 'Section II: Quantitative Assessment');
  
  ctx = drawTextBox(ctx, 'Performance Objectives', data.quantitative?.performanceObjectives || '');
  ctx = drawTextBox(ctx, 'Work Accomplishments', data.quantitative?.workAccomplishments || '');
  ctx = drawTextBox(ctx, 'Personal Development', data.quantitative?.personalDevelopment || '');
  
  ctx.y -= 15;
  ctx = ensureSpace(ctx, 70);
  ctx = drawRatingBadge(ctx, 'QUANTITATIVE RATING', data.quantitative?.quantitativeRating ?? null, MARGIN, CONTENT_WIDTH);
  ctx.y -= 55;
  
  // ─── PAGE 3-4: QUALITATIVE ASSESSMENT ───
  ctx = newPage(ctx);
  ctx = drawPageHeader(ctx);
  ctx = drawSectionHeader(ctx, 'Section III: Qualitative Assessment');
  ctx = drawRatingLegend(ctx);
  
  for (const [sectionTitle, factors] of Object.entries(QUALITATIVE_SECTIONS)) {
    ctx = drawQualitativeTable(ctx, sectionTitle, factors, data.qualitative as unknown as Record<string, number | null>);
  }
  
  // ─── PAGE 4-5: SUMMARY ───
  ctx = ensureSpace(ctx, 200);
  if (ctx.y < PAGE_HEIGHT / 2) {
    ctx = newPage(ctx);
    ctx = drawPageHeader(ctx);
  }
  
  ctx = drawSectionHeader(ctx, 'Section IV: Summary');
  ctx = drawTextBox(ctx, 'Employee Self-Summary', data.summary?.employeeSummary || '');
  ctx = drawTextBox(ctx, 'Targets for Next Year', data.summary?.targetsForNextYear || '');
  
  ctx.y -= 15;
  ctx = ensureSpace(ctx, 80);
  
  // Rating badges row
  const badgeWidth = (CONTENT_WIDTH - 20) / 3;
  ctx = drawRatingBadge(ctx, 'QUALITATIVE', data.summary?.qualitativeRating ?? null, MARGIN, badgeWidth);
  ctx = drawRatingBadge(ctx, 'QUANTITATIVE', data.quantitative?.quantitativeRating ?? null, MARGIN + badgeWidth + 10, badgeWidth);
  ctx = drawRatingBadge(ctx, 'OVERALL', data.summary?.overallRating ?? null, MARGIN + (badgeWidth + 10) * 2, badgeWidth);
  ctx.y -= 55;
  
  // ─── FINAL PAGE: SIGNATURES ───
  ctx = drawSignaturePage(ctx, data);
  
  // Add page numbers to all pages
  addPageNumbers(ctx);
  
  return doc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEvaluationPdf(data: EvaluationData): Promise<string> {
  const pdfBytes = await buildPdfBytes(data);
  const safeBytes = new Uint8Array(pdfBytes);
  const blob = new Blob([safeBytes], { type: 'application/pdf' });
  const localUrl = URL.createObjectURL(blob);
  const filename = makeFilename(data);

  // Best-effort upload to Supabase Storage
  if (data.id) {
    const storagePath = `pdfs/${data.id}/${filename}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('pep-evaluations')
        .upload(storagePath, blob, { upsert: true, contentType: 'application/pdf' });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('pep-evaluations')
          .getPublicUrl(storagePath);

        if (urlData?.publicUrl) {
          await supabase
            .from('pep_evaluations')
            .update({ pdf_url: urlData.publicUrl, pdf_generated_at: new Date().toISOString() })
            .eq('id', data.id);
          return urlData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('PDF upload failed, using local URL:', err);
    }
  }

  return localUrl;
}
