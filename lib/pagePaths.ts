import { Page } from '../types';

export function pathForPage(page: Page): string {
  switch (page) {
    case Page.About:
      return '/';
    case Page.SessionSettings:
      return '/session';
    case Page.Play:
      return '/play';
    case Page.Competition:
      return '/competition';
    case Page.Progress:
      return '/progress';
    case Page.Leaderboard:
      return '/leaderboard';
    case Page.Terms:
      return '/terms';
    default:
      return '/';
  }
}

export function pageFromPath(pathname: string): Page {
  switch (pathname) {
    case '/session':
      return Page.SessionSettings;
    case '/play':
      return Page.Play;
    case '/competition':
      return Page.Competition;
    case '/progress':
      return Page.Progress;
    case '/leaderboard':
      return Page.Leaderboard;
    case '/terms':
      return Page.Terms;
    case '/':
    default:
      return Page.About;
  }
}
