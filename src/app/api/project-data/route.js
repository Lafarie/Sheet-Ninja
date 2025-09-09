import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { gitlabUrl, gitlabToken, projectId } = await request.json();

    if (!gitlabUrl || !gitlabToken || !projectId) {
      return NextResponse.json(
        { error: 'GitLab URL, token, and project ID are required' },
        { status: 400 }
      );
    }

    // Ensure URL ends with slash
    const baseUrl = gitlabUrl.endsWith('/') ? gitlabUrl : gitlabUrl + '/';
    
    const headers = {
      'Private-Token': gitlabToken,
      'Content-Type': 'application/json',
    };

    // Fetch project details (including name)
    const projectResponse = await fetch(`${baseUrl}projects/${projectId}`, {
      headers,
    });

    if (!projectResponse.ok) {
      if (projectResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid GitLab token or insufficient permissions' },
          { status: 401 }
        );
      }
      if (projectResponse.status === 404) {
        return NextResponse.json(
          { error: 'Project not found. Please check the project ID.' },
          { status: 404 }
        );
      }
      throw new Error(`HTTP error! status: ${projectResponse.status}`);
    }

    const project = await projectResponse.json();

    // Fetch project members (assignees)
    const membersResponse = await fetch(`${baseUrl}projects/${projectId}/members/all`, {
      headers,
    });

    let assignees = [];
    if (membersResponse.ok) {
      assignees = await membersResponse.json();
    }

    // Fetch project milestones
    const milestonesResponse = await fetch(`${baseUrl}projects/${projectId}/milestones?state=active`, {
      headers,
    });

    let milestones = [];
    if (milestonesResponse.ok) {
      milestones = await milestonesResponse.json();
    }

    // Fetch project labels
    const labelsResponse = await fetch(`${baseUrl}projects/${projectId}/labels`, {
      headers,
    });

    let labels = [];
    if (labelsResponse.ok) {
      labels = await labelsResponse.json();
    }

    return NextResponse.json({
      name: project.name,
      description: project.description,
      web_url: project.web_url,
      assignees: assignees.map(member => ({
        id: member.id,
        username: member.username,
        name: member.name,
        avatar_url: member.avatar_url,
      })),
      milestones: milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        due_date: milestone.due_date,
      })),
      labels: labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
    });
  } catch (error) {
    console.error('Error fetching project data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project data: ' + error.message },
      { status: 500 }
    );
  }
}
