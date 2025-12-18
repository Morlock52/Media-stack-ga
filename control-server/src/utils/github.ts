
export interface GitHubMetadata {
    name: string;
    description: string;
    owner: string;
    repo: string;
    readme?: string;
    topics?: string[];
    stars?: number;
}

export const scrapeGitHubRepo = async (url: string): Promise<GitHubMetadata> => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        throw new Error('Invalid GitHub URL');
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    // Fetch repo info from GitHub API
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) {
        throw new Error(`Failed to fetch repo info: ${repoRes.statusText}`);
    }
    const repoData: any = await repoRes.json();

    // Fetch README
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
    });
    const readme = readmeRes.ok ? await readmeRes.text() : undefined;

    return {
        name: repoData.name,
        description: repoData.description || '',
        owner,
        repo,
        readme,
        topics: repoData.topics || [],
        stars: repoData.stargazers_count
    };
};
