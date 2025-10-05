'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { AssigneeSelector } from './AssigneeSelector';
import { MilestoneSelector } from './MilestoneSelector';
import { LabelSelector } from './LabelSelector';

export function ProjectMappingCard({ 
  project, 
  config,
  onUpdate,
  onRemove,
  onProjectIdChange,
  loadingProjectData = false
}) {
  const [estimate, setEstimate] = useState(project.estimate || '8h');

  const handleUpdate = useCallback((field, value) => {
    onUpdate(project.id, field, value);
  }, [project.id, onUpdate]);

  const handleEstimateChange = useCallback((e) => {
    const value = e.target.value;
    setEstimate(value);
    handleUpdate('estimate', value);
  }, [handleUpdate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{project.projectName}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(project.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* GitLab Project Selection */}
        <div>
          <Label className="py-1">GitLab Project</Label>
          <i className='text-xs py-2'> 
            {project.projectId && `If project name is not shown in the dropdown but its already picked Project ID:{${project.projectId}}`}
          </i>
          <Select
            value={project.projectId || 'none'}
            onValueChange={(value) => onProjectIdChange(project.id, value === 'none' ? '' : value)}
          >
            <SelectTrigger className="mb-2 py-2">
              <SelectValue placeholder="Select GitLab project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project selected (won't sync)</SelectItem>
              {config.availableProjects?.map((gitlabProject) => (
                <SelectItem key={gitlabProject.id} value={gitlabProject.id.toString()}>
                  {gitlabProject.name_with_namespace || gitlabProject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!project.projectId || project.projectId === 'none') && (
            <p className="text-xs text-amber-600 mt-1">
              This project will be skipped during sync
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assignee */}
          <div>
            <Label className="pb-2">Assignee</Label>
            <AssigneeSelector
              project={project}
              currentAssignee={project.assignee}
              onAssigneeChange={(value) => handleUpdate('assignee', value)}
              disabled={!project.projectId || loadingProjectData}
            />
          </div>

          {/* Milestone */}
          <div>
            <Label className="pb-2">Milestone</Label>
            <MilestoneSelector
              project={project}
              currentMilestone={project.milestone}
              onMilestoneChange={(value) => handleUpdate('milestone', value)}
              disabled={!project.projectId || loadingProjectData}
            />
          </div>
        </div>

        {/* Labels */}
        <div>
          <Label className="pb-2">Labels</Label>
          {loadingProjectData ? (
            <div className="text-sm text-gray-500 py-2">Loading labels...</div>
          ) : !project.projectId ? (
            <div className="text-sm text-gray-500 py-2">Select GitLab project first</div>
          ) : (
            <LabelSelector
              project={project}
              onAddLabel={(labelName) => {
                const newLabels = project.labels.includes(labelName) 
                  ? project.labels 
                  : [...project.labels, labelName];
                handleUpdate('labels', newLabels);
              }}
              onRemoveLabel={(labelName) => {
                const newLabels = project.labels.filter(l => l !== labelName);
                handleUpdate('labels', newLabels);
              }}
            />
          )}
        </div>

        {/* Estimate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="pb-2">Default Estimate</Label>
            <Input
              placeholder="8h"
              value={estimate}
              onChange={handleEstimateChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
