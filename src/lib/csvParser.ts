export interface ParsedEmployee {
  id?: string;
  name_first: string;
  name_last: string;
  job_title?: string;
  department?: string;
  location?: string;
  badge_number?: string;
  user_email?: string;
  employee_number?: string;
  reports_to?: string;
  is_active?: boolean;
  hire_date?: string;
  benefit_class?: string;
  job_level?: string;
  business_unit?: string;
  work_category?: string;
}

export interface ParseResult {
  employees: ParsedEmployee[];
  errors: { row: number; error: string }[];
  headers: string[];
}

// Column mappings - map CSV headers to employee fields
const COLUMN_MAPPINGS: Record<string, keyof ParsedEmployee> = {
  // ID fields
  'id': 'id',
  'employee_id': 'id',
  'emp_id': 'id',
  
  // Name fields
  'name_first': 'name_first',
  'first_name': 'name_first',
  'firstname': 'name_first',
  'first': 'name_first',
  'fname': 'name_first',
  
  'name_last': 'name_last',
  'last_name': 'name_last',
  'lastname': 'name_last',
  'last': 'name_last',
  'lname': 'name_last',
  'surname': 'name_last',
  
  // Job fields
  'job_title': 'job_title',
  'jobtitle': 'job_title',
  'title': 'job_title',
  'position': 'job_title',
  
  'job_level': 'job_level',
  'joblevel': 'job_level',
  'level': 'job_level',
  
  // Organization fields
  'department': 'department',
  'dept': 'department',
  
  'location': 'location',
  'office': 'location',
  'site': 'location',
  
  'business_unit': 'business_unit',
  'businessunit': 'business_unit',
  'bu': 'business_unit',
  'division': 'business_unit',
  
  // Employee identifiers
  'badge_number': 'badge_number',
  'badgenumber': 'badge_number',
  'badge': 'badge_number',
  'badge_num': 'badge_number',
  
  'employee_number': 'employee_number',
  'employeenumber': 'employee_number',
  'emp_number': 'employee_number',
  'emp_num': 'employee_number',
  'empno': 'employee_number',
  
  // Contact
  'user_email': 'user_email',
  'email': 'user_email',
  'useremail': 'user_email',
  'mail': 'user_email',
  'e-mail': 'user_email',
  
  // Hierarchy
  'reports_to': 'reports_to',
  'reportsto': 'reports_to',
  'manager': 'reports_to',
  'manager_id': 'reports_to',
  'supervisor': 'reports_to',
  
  // Status/dates
  'is_active': 'is_active',
  'isactive': 'is_active',
  'active': 'is_active',
  'status': 'is_active',
  
  'hire_date': 'hire_date',
  'hiredate': 'hire_date',
  'start_date': 'hire_date',
  'startdate': 'hire_date',
  
  // Classification
  'benefit_class': 'benefit_class',
  'benefitclass': 'benefit_class',
  'employment_type': 'benefit_class',
  'emp_type': 'benefit_class',
  
  'work_category': 'work_category',
  'workcategory': 'work_category',
  'category': 'work_category',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseBoolean(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return ['true', 'yes', '1', 'active', 'y'].includes(lower);
}

function parseDateString(value: string): string | undefined {
  if (!value.trim()) return undefined;
  
  // Try to parse various date formats
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  }
  
  // Try MM/DD/YYYY format
  const parts = value.split(/[\/\-]/);
  if (parts.length === 3) {
    const [first, second, third] = parts;
    // Check if it's MM/DD/YYYY or DD/MM/YYYY or YYYY-MM-DD
    if (third.length === 4) {
      // Could be MM/DD/YYYY or DD/MM/YYYY
      const month = parseInt(first, 10);
      const day = parseInt(second, 10);
      const year = parseInt(third, 10);
      if (month <= 12 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    } else if (first.length === 4) {
      // YYYY-MM-DD
      return `${first}-${String(second).padStart(2, '0')}-${String(third).padStart(2, '0')}`;
    }
  }
  
  return undefined;
}

export function parseCSV(csvContent: string): ParseResult {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { employees: [], errors: [{ row: 0, error: 'Empty CSV file' }], headers: [] };
  }

  // Parse header row
  const headerLine = lines[0];
  const rawHeaders = parseCSVLine(headerLine);
  const headers = rawHeaders.map(h => normalizeHeader(h));
  
  // Map headers to employee fields
  const columnMap: Map<number, keyof ParsedEmployee> = new Map();
  headers.forEach((header, index) => {
    const mappedField = COLUMN_MAPPINGS[header];
    if (mappedField) {
      columnMap.set(index, mappedField);
    }
  });

  const employees: ParsedEmployee[] = [];
  const errors: { row: number; error: string }[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const values = parseCSVLine(line);
      const employee: Partial<ParsedEmployee> = {};

      columnMap.forEach((field, colIndex) => {
        const value = values[colIndex]?.trim() || '';
        
        if (!value) return;

        switch (field) {
          case 'is_active':
            employee[field] = parseBoolean(value);
            break;
          case 'hire_date':
            employee[field] = parseDateString(value);
            break;
          default:
            (employee as Record<string, unknown>)[field] = value;
        }
      });

      // Validate required fields
      if (!employee.name_first || !employee.name_last) {
        errors.push({ row: i + 1, error: 'Missing required fields: name_first, name_last' });
        continue;
      }

      employees.push(employee as ParsedEmployee);
    } catch (error) {
      errors.push({ row: i + 1, error: `Parse error: ${error}` });
    }
  }

  return { employees, errors, headers: rawHeaders };
}
