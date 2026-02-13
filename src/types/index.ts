export interface GitHubProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubCommit {
  sha: string;
  message: string;
}

export interface GitHubEvent {
  type: string;
  repo: { name: string };
  created_at: string;
  payload: {
    action?: string;
    commits?: GitHubCommit[];
    pull_request?: { title: string; html_url: string; number?: number };
  };
}

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
}

export interface GitHubData {
  profile: GitHubProfile;
  events: GitHubEvent[];
  repos: GitHubRepo[];
}

export interface ZennArticle {
  title: string;
  slug: string;
  emoji: string;
  article_type: string;
  liked_count: number;
  published_at: string;
  path: string;
  topics?: string[];
}

export interface ZennData {
  articles: ZennArticle[];
}

export interface NewspaperProps {
  gh: GitHubData | null;
  zenn: ZennData | null;
  usernames: { ghUser: string; zennUser: string };
  aiComment: string | null;
}
