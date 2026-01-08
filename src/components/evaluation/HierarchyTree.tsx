import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, Download, CheckCircle2, Clock, FileEdit, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HierarchyMember {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  evaluation_status: 'not_started' | 'draft' | 'submitted' | 'reopened' | 'reviewed' | 'signed';
  submitted_at: string | null;
  pdf_url: string | null;
  email: string | null;
  children: HierarchyMember[];
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', variant: 'outline' as const, icon: Clock },
  draft: { label: 'In Progress', variant: 'secondary' as const, icon: FileEdit },
  reopened: { label: 'Reopened', variant: 'default' as const, icon: FileEdit },
  submitted: { label: 'View Submission', variant: 'default' as const, icon: CheckCircle2 },
  reviewed: { label: 'View Submission', variant: 'default' as const, icon: CheckCircle2 },
  signed: { label: 'View Submission', variant: 'default' as const, icon: CheckCircle2 },
};

interface HierarchyNodeProps {
  member: HierarchyMember;
  level: number;
  defaultExpanded?: boolean;
}

const HierarchyNode = ({ member, level, defaultExpanded = false }: HierarchyNodeProps) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const hasChildren = member.children.length > 0;
  const config = STATUS_CONFIG[member.evaluation_status];
  const StatusIcon = config.icon;
  const canViewPdf = member.pdf_url && ['submitted', 'reviewed', 'signed'].includes(member.evaluation_status);

  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            "flex items-center justify-between gap-4 py-3 px-2 hover:bg-muted/50 rounded-md transition-colors",
            level > 0 && "border-l-2 border-muted ml-4"
          )}
          style={{ paddingLeft: level > 0 ? `${level * 16 + 8}px` : undefined }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <div className="w-6" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate text-sm">
                {member.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.job_title || 'No title'} • {member.department || 'No department'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {member.submitted_at && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {new Date(member.submitted_at).toLocaleDateString()}
              </span>
            )}
            {member.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => window.open(member.pdf_url!, '_blank')}
              >
                <Download className="w-3 h-3" />
                PDF
              </Button>
            )}
            {canViewPdf ? (
              <Badge 
                variant={config.variant} 
                className="gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setPdfDialogOpen(true)}
              >
                <StatusIcon className="w-3 h-3" />
                View Submission
              </Badge>
            ) : (
              <Badge 
                variant={config.variant} 
                className="gap-1 text-xs"
              >
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            )}
          </div>
        </div>
        {hasChildren && (
          <CollapsibleContent>
            <div className="space-y-0.5">
              {member.children.map((child) => (
                <HierarchyNode
                  key={child.id}
                  member={child}
                  level={level + 1}
                  defaultExpanded={defaultExpanded}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>

      {/* PDF Viewer Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>{member.name} - Evaluation</span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open(member.pdf_url!, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {member.pdf_url && (
              <iframe
                src={member.pdf_url}
                className="w-full h-full border rounded-md"
                title={`${member.name} Evaluation PDF`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface HierarchyTreeProps {
  data: HierarchyMember[];
  defaultExpanded?: boolean;
}

export const HierarchyTree = ({ data, defaultExpanded = false }: HierarchyTreeProps) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {data.map((member) => (
        <HierarchyNode
          key={member.id}
          member={member}
          level={0}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
};

// Utility function to build tree from flat list
export function buildHierarchyTree(
  flatList: Array<{
    id: string;
    name: string;
    job_title: string | null;
    department: string | null;
    evaluation_status: string;
    submitted_at: string | null;
    pdf_url: string | null;
    email: string | null;
    reports_to: string | null;
  }>,
  rootId: string | null = null
): HierarchyMember[] {
  const nodeMap = new Map<string, HierarchyMember>();
  const roots: HierarchyMember[] = [];

  // Create all nodes first
  flatList.forEach((item) => {
    nodeMap.set(item.id, {
      id: item.id,
      name: item.name,
      job_title: item.job_title,
      department: item.department,
      evaluation_status: (item.evaluation_status || 'not_started') as HierarchyMember['evaluation_status'],
      submitted_at: item.submitted_at,
      pdf_url: item.pdf_url,
      email: item.email,
      children: [],
    });
  });

  // Build tree structure
  flatList.forEach((item) => {
    const node = nodeMap.get(item.id)!;
    if (item.reports_to === rootId) {
      // Direct child of root
      roots.push(node);
    } else if (item.reports_to && nodeMap.has(item.reports_to)) {
      // Add to parent's children
      nodeMap.get(item.reports_to)!.children.push(node);
    }
  });

  // Sort by name
  const sortByName = (a: HierarchyMember, b: HierarchyMember) => a.name.localeCompare(b.name);
  roots.sort(sortByName);
  nodeMap.forEach((node) => node.children.sort(sortByName));

  return roots;
}

// Utility to collect all emails from incomplete members in hierarchy
export function collectIncompleteEmails(members: HierarchyMember[]): string[] {
  const emails: string[] = [];
  
  const traverse = (node: HierarchyMember) => {
    if (!['submitted', 'reviewed', 'signed'].includes(node.evaluation_status) && node.email) {
      emails.push(node.email);
    }
    node.children.forEach(traverse);
  };
  
  members.forEach(traverse);
  return emails;
}

// Utility to count stats from hierarchy
export function countHierarchyStats(members: HierarchyMember[]): {
  total: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
} {
  let total = 0;
  let submitted = 0;
  let inProgress = 0;
  let notStarted = 0;

  const traverse = (node: HierarchyMember) => {
    total++;
    if (['submitted', 'reviewed', 'signed'].includes(node.evaluation_status)) {
      submitted++;
    } else if (['draft', 'reopened'].includes(node.evaluation_status)) {
      inProgress++;
    } else {
      notStarted++;
    }
    node.children.forEach(traverse);
  };

  members.forEach(traverse);
  return { total, submitted, inProgress, notStarted };
}
