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

    // Fetch current user information from GitLab
    const userResponse = await fetch(`${baseUrl}user`, {
      headers,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid GitLab token or insufficient permissions' },
          { status: 401 }
        );
      }
      
      // Check for WAF challenge or blocked requests
      if (userResponse.status === 202 || userResponse.status === 403) {
        const responseHeaders = Object.fromEntries(userResponse.headers.entries());
        if (responseHeaders['x-amzn-waf-action'] === 'challenge' || 
            responseHeaders['x-amzn-waf-action'] === 'block') {
          return NextResponse.json(
            { 
              error: 'VPN_REQUIRED',
              message: 'GitLab server is blocking the request. Please connect to VPN and try again.',
              details: 'The server returned a WAF challenge response, indicating network restrictions.'
            },
            { status: 403 }
          );
        }
      }
      
      throw new Error(`HTTP error! status: ${userResponse.status}`);
    }

    const user = await userResponse.json();

    // Format user information for the frontend
    const formattedUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      web_url: user.web_url,
      state: user.state,
      is_admin: user.is_admin,
      bio: user.bio,
      location: user.location,
      public_email: user.public_email,
      skype: user.skype,
      linkedin: user.linkedin,
      twitter: user.twitter,
      website_url: user.website_url,
      organization: user.organization,
      job_title: user.job_title,
      pronouns: user.pronouns,
      bot: user.bot,
      work_information: user.work_information,
      followers: user.followers,
      following: user.following,
      created_at: user.created_at,
      last_activity_on: user.last_activity_on,
      confirmed_at: user.confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      current_sign_in_at: user.current_sign_in_at,
      two_factor_enabled: user.two_factor_enabled,
      note: user.note,
      identities: user.identities,
      external: user.external,
      private_profile: user.private_profile,
      commit_email: user.commit_email,
      shared_runners_minutes_limit: user.shared_runners_minutes_limit,
      extra_shared_runners_minutes_limit: user.extra_shared_runners_minutes_limit,
      namespace_id: user.namespace_id,
      created_by_id: user.created_by_id,
      admin: user.admin,
      can_create_group: user.can_create_group,
      can_create_project: user.can_create_project,
      projects_limit: user.projects_limit,
      avatar: user.avatar,
      theme_id: user.theme_id,
      color_scheme_id: user.color_scheme_id,
      password_automatically_set: user.password_automatically_set,
      location: user.location,
      public_email: user.public_email,
      skype: user.skype,
      linkedin: user.linkedin,
      twitter: user.twitter,
      website_url: user.website_url,
      organization: user.organization,
      job_title: user.job_title,
      pronouns: user.pronouns,
      bot: user.bot,
      work_information: user.work_information,
      followers: user.followers,
      following: user.following,
      created_at: user.created_at,
      last_activity_on: user.last_activity_on,
      confirmed_at: user.confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      current_sign_in_at: user.current_sign_in_at,
      two_factor_enabled: user.two_factor_enabled,
      note: user.note,
      identities: user.identities,
      external: user.external,
      private_profile: user.private_profile,
      commit_email: user.commit_email,
      shared_runners_minutes_limit: user.shared_runners_minutes_limit,
      extra_shared_runners_minutes_limit: user.extra_shared_runners_minutes_limit,
      namespace_id: user.namespace_id,
      created_by_id: user.created_by_id,
      admin: user.admin,
      can_create_group: user.can_create_group,
      can_create_project: user.can_create_project,
      projects_limit: user.projects_limit,
      avatar: user.avatar,
      theme_id: user.theme_id,
      color_scheme_id: user.color_scheme_id,
      password_automatically_set: user.password_automatically_set
    };

    return NextResponse.json({
      user: formattedUser,
      success: true
    });
  } catch (error) {
    console.error('Error fetching GitLab user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitLab user: ' + error.message },
      { status: 500 }
    );
  }
}
