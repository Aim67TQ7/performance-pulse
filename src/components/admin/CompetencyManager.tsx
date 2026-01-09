import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Competency } from '@/types/evaluation';
import { Loader2, Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export const CompetencyManager = () => {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    definition: '',
    observable_behaviors: '',
    is_active: true,
  });

  const fetchCompetencies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pep_competencies')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCompetencies(data || []);
    } catch (error) {
      console.error('Failed to load competencies:', error);
      toast.error('Failed to load competencies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetencies();
  }, []);

  const openAddDialog = () => {
    setEditingCompetency(null);
    setFormData({
      name: '',
      definition: '',
      observable_behaviors: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (competency: Competency) => {
    setEditingCompetency(competency);
    setFormData({
      name: competency.name,
      definition: competency.definition,
      observable_behaviors: competency.observable_behaviors,
      is_active: competency.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.definition.trim() || !formData.observable_behaviors.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCompetency) {
        // Update existing
        const { error } = await supabase
          .from('pep_competencies')
          .update({
            name: formData.name,
            definition: formData.definition,
            observable_behaviors: formData.observable_behaviors,
            is_active: formData.is_active,
          })
          .eq('id', editingCompetency.id);

        if (error) throw error;
        toast.success('Competency updated successfully');
      } else {
        // Create new
        const maxOrder = Math.max(...competencies.map(c => c.display_order), 0);
        const { error } = await supabase
          .from('pep_competencies')
          .insert({
            name: formData.name,
            definition: formData.definition,
            observable_behaviors: formData.observable_behaviors,
            is_active: formData.is_active,
            display_order: maxOrder + 1,
          });

        if (error) throw error;
        toast.success('Competency added successfully');
      }

      setIsDialogOpen(false);
      fetchCompetencies();
    } catch (error) {
      console.error('Failed to save competency:', error);
      toast.error('Failed to save competency');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this competency?')) return;

    try {
      const { error } = await supabase
        .from('pep_competencies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Competency deleted');
      fetchCompetencies();
    } catch (error) {
      console.error('Failed to delete competency:', error);
      toast.error('Failed to delete competency');
    }
  };

  const moveCompetency = async (id: string, direction: 'up' | 'down') => {
    const index = competencies.findIndex(c => c.id === id);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= competencies.length) return;

    const current = competencies[index];
    const swapWith = competencies[newIndex];

    try {
      // Swap display_order values
      await supabase
        .from('pep_competencies')
        .update({ display_order: swapWith.display_order })
        .eq('id', current.id);

      await supabase
        .from('pep_competencies')
        .update({ display_order: current.display_order })
        .eq('id', swapWith.id);

      fetchCompetencies();
    } catch (error) {
      console.error('Failed to reorder competencies:', error);
      toast.error('Failed to reorder');
    }
  };

  const toggleActive = async (competency: Competency) => {
    try {
      const { error } = await supabase
        .from('pep_competencies')
        .update({ is_active: !competency.is_active })
        .eq('id', competency.id);

      if (error) throw error;
      fetchCompetencies();
    } catch (error) {
      console.error('Failed to toggle competency status:', error);
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Performance Competencies</CardTitle>
            <CardDescription>
              Manage the competency questions shown in the self-evaluation form
            </CardDescription>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Competency
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {competencies.map((competency, index) => (
              <div
                key={competency.id}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  competency.is_active 
                    ? 'bg-card border-border' 
                    : 'bg-muted/50 border-border/50 opacity-60'
                }`}
              >
                {/* Reorder Controls */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveCompetency(competency.id, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveCompetency(competency.id, 'down')}
                    disabled={index === competencies.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{competency.name}</h4>
                    {!competency.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{competency.definition}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Observable Behaviors:</span> {competency.observable_behaviors}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={competency.is_active}
                    onCheckedChange={() => toggleActive(competency)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(competency)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(competency.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {competencies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No competencies configured. Click "Add Competency" to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCompetency ? 'Edit Competency' : 'Add New Competency'}
            </DialogTitle>
            <DialogDescription>
              Define the competency, its meaning, and observable behaviors that demonstrate it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Competency Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Teamwork and Collaboration"
              />
            </div>

            <div>
              <Label htmlFor="definition">Definition</Label>
              <Textarea
                id="definition"
                value={formData.definition}
                onChange={(e) => setFormData(prev => ({ ...prev, definition: e.target.value }))}
                placeholder="Describe what this competency means..."
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="behaviors">Observable Behaviors</Label>
              <Textarea
                id="behaviors"
                value={formData.observable_behaviors}
                onChange={(e) => setFormData(prev => ({ ...prev, observable_behaviors: e.target.value }))}
                placeholder="List behaviors that demonstrate this competency..."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="active">Active (visible in evaluation form)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCompetency ? 'Save Changes' : 'Add Competency'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
