import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { gitlabUrl, gitlabToken } = await request.json();

    if (!gitlabUrl || !gitlabToken) {
      return NextResponse.json(
        { error: 'GitLab URL and token are required' },
        { status: 400 }
      );
    }

    // Ensure URL ends with slash
    const baseUrl = gitlabUrl.endsWith('/') ? gitlabUrl : gitlabUrl + '/';
    
    const headers = {
      'Private-Token': gitlabToken,
      'Content-Type': 'application/json',
    };

    // Fetch all projects the user has access to
    // We'll fetch multiple pages to get more projects
    let allProjects = [];
    let page = 1;
    const perPage = 100; // Maximum per page
    
    while (page <= 5) { // Limit to first 5 pages (500 projects max)
      const projectsResponse = await fetch(
        `${baseUrl}projects?membership=true&simple=true&per_page=${perPage}&page=${page}&order_by=last_activity_at&sort=desc`,
        { 
          headers,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }
      );

      if (!projectsResponse.ok) {
        if (projectsResponse.status === 401) {
          return NextResponse.json(
            { error: 'Invalid GitLab token or insufficient permissions' },
            { status: 401 }
          );
        }
        throw new Error(`HTTP error! status: ${projectsResponse.status}`);
      }

      // Check if response has content before parsing JSON
      const responseText = await projectsResponse.text();
      if (!responseText.trim()) {
        console.warn(`Empty response from GitLab API for page ${page}`);
        break;
      }

      let projects;
      try {
        projects = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`Failed to parse JSON response for page ${page}:`, parseError);
        console.error('Response text:', responseText.substring(0, 200) + '...');
        throw new Error(`Invalid JSON response from GitLab API: ${parseError.message}`);
      }

      // Ensure projects is an array
      if (!Array.isArray(projects)) {
        console.error(`Expected array but got ${typeof projects} for page ${page}`);
        console.error('Response:', projects);
        break;
      }
      
      if (projects.length === 0) {
        break; // No more projects
      }
      
      allProjects = allProjects.concat(projects);
      
      if (projects.length < perPage) {
        break; // Last page
      }
      
      page++;
    }

    // Format projects for dropdown
    const formattedProjects = allProjects.map(project => ({
      id: project.id,
      name: project.name,
      name_with_namespace: project.name_with_namespace,
      path_with_namespace: project.path_with_namespace,
      description: project.description,
      web_url: project.web_url,
      last_activity_at: project.last_activity_at,
      avatar_url: project.avatar_url,
      visibility: project.visibility,
    }));

    return NextResponse.json({
      projects: formattedProjects,
      total: formattedProjects.length,
    });
  } catch (error) {
    console.error('Error fetching GitLab projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects: ' + error.message },
      { status: 500 }
    );
  }
}
