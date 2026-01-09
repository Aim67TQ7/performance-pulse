export type EvaluationStatus = 'draft' | 'submitted' | 'reviewed' | 'signed' | 'reopened';

export type OverallRating = 'cannot_evaluate' | 'exceptional' | 'excellent' | 'fully_satisfactory' | 'marginal' | 'unacceptable';

export interface EmployeeInfo {
  name: string;
  title: string;
  department: string;
  periodYear: number;
  supervisorId?: string;
  supervisorName?: string;
}

// Competency type for database
export interface Competency {
  id: string;
  name: string;
  definition: string;
  observable_behaviors: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Competency rating from employee
export interface CompetencyRating {
  competencyId: string;
  competencyName: string;
  score: number | null; // 1-5
  comments: string;
}

// Performance objective with measurable target
export interface PerformanceObjective {
  id: string;
  objective: string;
  measurableTarget: string;
  actual: string;
}

export interface QuantitativeData {
  // New structured performance objectives
  performanceObjectives: PerformanceObjective[];
  workAccomplishments: string;
  // Legacy fields (for backwards compatibility)
  personalDevelopment?: string;
  quantitativeRating?: OverallRating | null;
  // Competency-based fields
  competencies: CompetencyRating[];
  overallQuantitativeRating: OverallRating | null;
}

export interface QualitativeFactors {
  // Planning & Organization
  forecastingPlanningSkills: number | null;
  administrationSkills: number | null;
  leadership: number | null;
  safety: number | null;
  developingEmployees: number | null;
  // Interpersonal
  communicationSkills: number | null;
  developingCooperationTeamwork: number | null;
  customerSatisfaction: number | null;
  peerRelationships: number | null;
  subordinateRelationships: number | null;
  // Individual
  jobKnowledgeKnowHow: number | null;
  qualityImage: number | null;
  attitude: number | null;
  decisionMaking: number | null;
  creativityInitiative: number | null;
}

export interface SummaryData {
  employeeSummary: string;
  targetsForNextYear: string;
  qualitativeRating: OverallRating | null;
  overallRating: OverallRating | null;
}

export interface EvaluationData {
  id?: string;
  employeeId?: string;
  employeeInfo: EmployeeInfo;
  quantitative: QuantitativeData;
  qualitative: QualitativeFactors;
  summary: SummaryData;
  status: EvaluationStatus;
  lastSavedAt?: Date;
  submittedAt?: Date;
  supervisorId?: string;
  managerId?: string;
  pdfUrl?: string;
  pdfGeneratedAt?: Date;
  reopenedAt?: Date;
  reopenedBy?: string;
  reopenReason?: string;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  type: 'validation' | 'save' | 'submit' | 'network' | 'unknown';
  message: string;
  context?: Record<string, unknown>;
  resolved: boolean;
}

export const RATING_OPTIONS: { value: OverallRating; label: string; description: string; score?: number }[] = [
  { value: 'exceptional', label: 'Exceptional', description: 'Always performs beyond requirements', score: 5 },
  { value: 'excellent', label: 'Excellent', description: 'Consistently effective, no weaknesses', score: 4 },
  { value: 'fully_satisfactory', label: 'Fully Satisfactory', description: 'Expected performance for the position', score: 3 },
  { value: 'marginal', label: 'Marginal', description: 'Below average in some major areas', score: 2 },
  { value: 'unacceptable', label: 'Unacceptable', description: 'Does not meet expectations', score: 1 },
  { value: 'cannot_evaluate', label: 'Cannot Evaluate', description: 'Insufficient information to rate' },
];

export const QUALITATIVE_FACTORS = {
  planningOrganization: [
    { key: 'forecastingPlanningSkills', label: 'Forecasting & Planning Skills' },
    { key: 'administrationSkills', label: 'Administration Skills' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'safety', label: 'Safety' },
    { key: 'developingEmployees', label: 'Developing Employees' },
  ],
  interpersonal: [
    { key: 'communicationSkills', label: 'Communication Skills' },
    { key: 'developingCooperationTeamwork', label: 'Developing Cooperation & Teamwork' },
    { key: 'customerSatisfaction', label: 'Customer Satisfaction' },
    { key: 'peerRelationships', label: 'Peer Relationships' },
    { key: 'subordinateRelationships', label: 'Subordinate Relationships' },
  ],
  individual: [
    { key: 'jobKnowledgeKnowHow', label: 'Job Knowledge/Know How' },
    { key: 'qualityImage', label: 'Quality Image' },
    { key: 'attitude', label: 'Attitude' },
    { key: 'decisionMaking', label: 'Decision Making' },
    { key: 'creativityInitiative', label: 'Creativity/Initiative' },
  ],
} as const;

export const LIKERT_SCALE = [
  { value: 5, label: '5', description: 'Exceptional' },
  { value: 4, label: '4', description: 'Excellent' },
  { value: 3, label: '3', description: 'Fully Satisfactory' },
  { value: 2, label: '2', description: 'Marginal' },
  { value: 1, label: '1', description: 'Unacceptable' },
];
